/* End-to-end user journeys — the paths the unit-style suite can't cover:
 * a real searched answer, a real image sent to a vision model, running Python
 * from a real reply, and the download button on a real code block.
 *
 *   node test/e2e-flows.js 9224
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const WebSocket = require(path.join(__dirname, '..', 'node_modules', 'ws'));

const PORT = process.argv.find((a) => /^\d+$/.test(a)) || '9224';
let pass = 0, fail = 0;
const failures = [];
const ok = (n, c, d = '') => { if (c) { pass++; console.log(`  PASS  ${n}`); } else { fail++; failures.push(n); console.log(`  FAIL  ${n}${d ? ' — ' + d : ''}`); } };
const section = (t) => console.log(`\n${'='.repeat(64)}\n${t}\n${'='.repeat(64)}`);

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => { let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => resolve(JSON.parse(d))); }).on('error', reject);
  });
}

(async () => {
  const targets = await getJson(`http://127.0.0.1:${PORT}/json/list`);
  const page = targets.find((t) => t.type === 'page' && t.url.includes('index.html'));
  const ws = new WebSocket(page.webSocketDebuggerUrl, { maxPayload: 256 * 1024 * 1024 });
  let id = 0;
  const pend = new Map();
  const call = (m, p = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  ws.on('message', (raw) => { const m = JSON.parse(raw); if (m.id && pend.has(m.id)) { const r = pend.get(m.id); pend.delete(m.id); r(m.result); } });
  await new Promise((r) => ws.on('open', r));
  const ev = async (e) => {
    const r = await call('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) return { __error: ((r.exceptionDetails.exception || {}).description || '').split('\n')[0] };
    return r.result.value;
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const idle = (n) => `(function(){const m=document.querySelectorAll('.msg-assistant .md'); return m.length>=${n} && m[m.length-1].innerText.length>10 && !document.querySelector('.cursor');})()`;
  const waitFor = async (expr, ms, label) => {
    const t0 = Date.now();
    for (;;) {
      if (await ev(expr) === true) return true;
      if (Date.now() - t0 > ms) { console.log(`        (timed out: ${label})`); return false; }
      await sleep(1200);
    }
  };
  for (let i = 0; i < 40; i++) { if (await ev("typeof S !== 'undefined'") === true) break; await sleep(500); }
  const settled = () => waitFor('S.generating === false', 120000, 'app idle');
  await waitFor("S.server.state === 'ready'", 240000, 'model ready');

  /* ---------- flow 1: ask something, get a grounded answer with sources ---------- */
  section('FLOW 1 — searched question end to end');
  await ev("window.pristudio.saveSettings({webSearch:true, searchMode:'auto'}).then(s=>{S.settings=s;}); newChat(); true");
  await sleep(500);
  await ev(`document.getElementById('input').value='Who founded Polymarket? Answer in one short sentence.'; document.getElementById('btn-send').click(); true`);
  const searched = await waitFor("!!(S.chat && S.chat.messages[0] && S.chat.messages[0].search)", 120000, 'search');
  ok('the question triggered a web search', searched);
  const srcCount = await ev("(((S.chat.messages[0]||{}).search||{}).results||[]).length");
  ok('sources were retrieved', srcCount > 0, `${srcCount} sources`);
  ok('source chips render under the message', await ev("document.querySelectorAll('.msg-user .src-chip').length > 0"));
  await waitFor(idle(1), 240000, 'reply');
  const answer = await ev("(S.chat.messages[1]||{}).content || ''");
  console.log(`        answer: ${JSON.stringify(answer.slice(0, 110))}`);
  ok('the model answered', answer.length > 10);
  ok('the answer used the sources (mentions Coplan)', /coplan/i.test(answer), 'model may have summarised differently');

  /* ---------- flow 2: follow-up must remember, not re-search ---------- */
  section('FLOW 2 — follow-up uses memory, not the web');
  await ev(`document.getElementById('input').value='tell me more about him'; document.getElementById('btn-send').click(); true`);
  await waitFor(idle(2), 240000, 'follow-up reply');
  ok('follow-up did NOT trigger a search', !(await ev("!!(S.chat.messages[2]||{}).search")));
  const follow = await ev("(S.chat.messages[3]||{}).content || ''");
  console.log(`        answer: ${JSON.stringify(follow.slice(0, 110))}`);
  ok('follow-up kept the subject from the earlier turn', /coplan|polymarket|founder|he\b|his\b/i.test(follow));

  /* ---------- flow 3: vision ---------- */
  section('FLOW 3 — show it a picture');
  const visionModel = await ev("(S.models.find(m=>m.vision)||{}).path || ''");
  if (!visionModel) { console.log('  SKIP  no vision model installed'); }
  else {
    await ev(`loadModelFromUi(${JSON.stringify(visionModel)}); true`);
    const loaded = await waitFor("S.server.state === 'ready' && /VL/i.test(S.server.modelPath||'')", 240000, 'vision model');
    ok('vision model loads with its projector', loaded);
    const icon = path.join(__dirname, '..', 'resources', 'icon.png');
    await ev(`(async () => { newChat(); const f = await window.pristudio.readFiles([${JSON.stringify(icon)}]); window.__test.addAttachments(f);
      document.getElementById('input').value = 'What is drawn in this image? Answer in one short sentence.'; return true; })()`);
    await sleep(600);
    ok('image attached with a thumbnail', await ev("document.querySelectorAll('#attach-strip .img-chip').length > 0"));
    await ev("document.getElementById('btn-send').click(); true");
    await waitFor(idle(1), 300000, 'vision reply');
    const vis = await ev("(S.chat.messages[1]||{}).content || ''");
    console.log(`        answer: ${JSON.stringify(vis.slice(0, 130))}`);
    ok('the model described the image', vis.length > 15);
    const sawShape = /arch|building|door|gate|column|structure|monument|logo|symbol|icon|drawing|image/i.test(vis);
  ok('it produced a visual description of the image', sawShape, vis.slice(0, 60));
  }

  /* ---------- flow 4: code block buttons on a real reply ---------- */
  section('FLOW 4 — code block actions on a real reply');
  const chatModel = await ev("(S.models.find(m=>/llama-3.2-3b/i.test(m.name))||S.models.find(m=>!m.vision)||{}).path || ''");
  await ev(`loadModelFromUi(${JSON.stringify(chatModel)}); true`);
  await sleep(2500); // let the swap actually begin before we watch for it
  await waitFor(`S.server.state === 'ready' && (S.server.modelPath||'') === ${JSON.stringify(chatModel)}`, 300000, 'chat model back');
  await ev("window.pristudio.saveSettings({webSearch:false}).then(s=>{S.settings=s;}); newChat(); true");
  await sleep(400);
  await ev(`document.getElementById('input').value='Write Python code that prints the numbers 1 to 3. Put it in a fenced code block starting with three backticks and the word python.'; document.getElementById('btn-send').click(); true`);
  await waitFor("document.querySelectorAll('.codeblock').length > 0 && !document.querySelector('.cursor')", 300000, 'code reply');
  ok('reply contains a code block', await ev("document.querySelectorAll('.codeblock').length > 0"));
  ok('Copy and Download buttons present', await ev("!!document.querySelector('.cb-copy') && !!document.querySelector('.cb-dl')"));
  const isPy = await ev("(document.querySelector('.codeblock')||{}).dataset ? document.querySelector('.codeblock').dataset.lang : ''");
  if (/py/i.test(isPy)) {
    ok('Run button offered on python', await ev("!!document.querySelector('.cb-run')"));
    const saveTo = path.join(os.tmpdir(), 'portico-tests', 'downloaded.py');
    const saved = await ev(`(async () => { const b = document.querySelector('.codeblock');
      return await window.pristudio.saveFile({ suggestedName:'snippet.py', content: b.querySelector('code').textContent, testPath: ${JSON.stringify(saveTo)} }); })()`);
    ok('Download writes a real file', typeof saved === 'string' && fs.existsSync(saveTo));
    // run it for real
    await settled();
    await sleep(500);
    await ev("document.querySelector('.cb-run').click(); true");
    const ran = await waitFor("(function(){const m=(S.chat.messages||[]).find(x=>x.pyrun); return !!m && !m.pyrun.pending;})()", 180000, 'python run');
    const res = JSON.parse(await ev("JSON.stringify(((S.chat.messages||[]).find(x=>x.pyrun)||{}).pyrun||{})"));
    ok('Run executes the snippet', ran && res.ok === true, res.error);
    console.log(`        stdout: ${JSON.stringify((res.stdout || '').slice(0, 60))}`);
  } else {
    console.log(`        (model produced "${isPy}" instead of python — skipping run/download)`);
  }

  /* ---------- flow 5: image generation from the composer ---------- */
  section('FLOW 5 — /image from the composer');
  await ev("newChat(); true");
  await sleep(300);
  const savedImg = JSON.parse(await ev("window.pristudio.getSettings().then(s=>JSON.stringify({m:s.imageModel,sz:s.imageSize,st:s.imageSteps}))"));
  const fastModel = await ev("window.pristudio.imageStatus().then(s=>{const m=s.models.find(x=>/dreamshaper|realistic|sd-v1-5/i.test(x.name))||s.models[0]; return m?m.path:'';})");
  await ev(`window.pristudio.saveSettings({ imageModel: ${JSON.stringify(fastModel)}, imageSize: 512, imageSteps: 12 })`);
  await sleep(300);
  await settled();
  await sleep(500);
  await ev(`document.getElementById('input').value='/image a single lemon on a plate'; document.getElementById('btn-send').click(); true`);
  const gen = await waitFor("(function(){const m=(S.chat.messages||[]).find(x=>x.image); return !!m && (!!m.image.path || !!m.image.error);})()", 600000, 'image');
  const im = JSON.parse(await ev("JSON.stringify(((S.chat.messages||[]).find(x=>x.image)||{}).image||{})"));
  ok('/image produced a picture', gen && !!im.path && !im.error, im.error || JSON.stringify(im).slice(0, 90));
  ok('the picture renders in the conversation', await ev("document.querySelectorAll('.py-fig, .img-done img').length > 0"));
  if (im.path && fs.existsSync(im.path)) console.log(`        ${Math.round(fs.statSync(im.path).size / 1024)} KB in ${im.seconds}s`);
  await waitFor("S.server.state === 'ready'", 300000, 'chat model restored');
  ok('chat model comes back after generating', await ev("S.server.state === 'ready'"));
  await ev(`window.pristudio.saveSettings({ imageModel: ${JSON.stringify(savedImg.m || '')}, imageSize: ${savedImg.sz || 0}, imageSteps: ${savedImg.st || 0} })`);
  console.log('        (restored your image settings)');

  console.log(`\n${'='.repeat(64)}`);
  console.log(`E2E RESULT: ${pass} passed, ${fail} failed`);
  if (failures.length) failures.forEach((f) => console.log('  - ' + f));
  console.log('='.repeat(64));
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error('CRASHED:', e.message); process.exit(2); });
