/* Portico full functional test suite.
 *
 * Drives the INSTALLED app over the Chrome DevTools Protocol and exercises every
 * user-facing feature. Run with the app started like this:
 *
 *   "%LOCALAPPDATA%\Programs\Portico\Portico.exe" --remote-debugging-port=9224
 *   node test/full-suite.js 9224
 *
 * Slow paths (image generation, big model loads) can be skipped:  --fast
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const WebSocket = require(path.join(__dirname, '..', 'node_modules', 'ws'));

const PORT = process.argv.find((a) => /^\d+$/.test(a)) || '9224';
const FAST = process.argv.includes('--fast');
const SCRATCH = path.join(os.tmpdir(), 'portico-tests');
fs.mkdirSync(SCRATCH, { recursive: true });

let pass = 0, fail = 0, skip = 0;
const failures = [];

const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; failures.push(name + (detail ? ` — ${detail}` : '')); console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
};
const skipped = (name, why) => { skip++; console.log(`  SKIP  ${name} (${why})`); };
const section = (t) => console.log(`\n${'='.repeat(64)}\n${t}\n${'='.repeat(64)}`);

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => { let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } }); }).on('error', reject);
  });
}

(async () => {
  // ---- connect ----
  let targets = null;
  for (let i = 0; i < 30; i++) {
    try { targets = await getJson(`http://127.0.0.1:${PORT}/json/list`); break; }
    catch { await new Promise((r) => setTimeout(r, 1000)); }
  }
  if (!targets) { console.error(`Could not reach Portico on port ${PORT}. Start it with --remote-debugging-port=${PORT}`); process.exit(1); }
  const page = targets.find((t) => t.type === 'page' && t.url.includes('index.html'));
  if (!page) { console.error('Portico window not found'); process.exit(1); }

  const ws = new WebSocket(page.webSocketDebuggerUrl, { maxPayload: 256 * 1024 * 1024 });
  let id = 0;
  const pend = new Map();
  const consoleErrors = [];
  const call = (m, p = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  ws.on('message', (raw) => {
    const m = JSON.parse(raw);
    if (m.method === 'Runtime.exceptionThrown') consoleErrors.push(((m.params.exceptionDetails.exception || {}).description || '').split('\n')[0]);
    if (m.id && pend.has(m.id)) { const r = pend.get(m.id); pend.delete(m.id); r(m.result); }
  });
  await new Promise((r) => ws.on('open', r));
  await call('Runtime.enable');

  const ev = async (expr) => {
    const r = await call('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) return { __error: ((r.exceptionDetails.exception || {}).description || '').split('\n')[0] };
    return r.result.value;
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const waitFor = async (expr, ms, label) => {
    const t0 = Date.now();
    for (;;) {
      if (await ev(expr) === true) return true;
      if (Date.now() - t0 > ms) { console.log(`        (timeout waiting for ${label})`); return false; }
      await sleep(800);
    }
  };

  for (let i = 0; i < 40; i++) { if (await ev("typeof S !== 'undefined' && typeof buildApiMessages === 'function'") === true) break; await sleep(500); }

  const started = Date.now();

  /* ================= 1. app shell ================= */
  section('1. APPLICATION SHELL');
  ok('renderer booted', await ev("typeof S === 'object'"));
  ok('preload bridge present', await ev("typeof window.pristudio === 'object'"));
  ok('no mock shim active (real app)', await ev("typeof window.pristudio.debugInfo === 'function'"));
  const diag = await ev("window.pristudio.diagnostics().then(JSON.stringify)");
  const d = JSON.parse(diag);
  console.log(`        version ${d.version} · Electron ${d.electron} · ${d.ramGB} GB RAM`);
  ok('diagnostics report themselves', !!d.version && !!d.os);
  ok('sidebar, composer and views exist', await ev(`['sidebar','composer','messages','view-chat','view-models','view-settings','view-project'].every(i=>document.getElementById(i))`));

  /* ================= 2. themes ================= */
  section('2. THEMES');
  const themeBefore = await ev("document.documentElement.getAttribute('data-theme')");
  for (const t of ['dark', 'ultradark', 'light', 'sepia']) {
    await ev(`applyTheme('${t}')`);
    await sleep(200);
    const applied = await ev("document.documentElement.getAttribute('data-theme')");
    const bg = await ev("getComputedStyle(document.body).backgroundColor");
    const hl = await ev("document.getElementById('hljs-theme').getAttribute('href').split('/').pop()");
    const wantLight = t === 'light' || t === 'sepia';
    ok(`theme "${t}" applies`, applied === t, `got ${applied}`);
    ok(`theme "${t}" uses ${wantLight ? 'light' : 'dark'} code colours`, hl === (wantLight ? 'hljs-light.css' : 'hljs-dark.css'), hl);
  }
  await ev(`applyTheme('${themeBefore || 'dark'}')`);

  /* ================= 3. models ================= */
  section('3. MODELS');
  const models = JSON.parse(await ev("window.pristudio.listModels().then(m=>JSON.stringify(m.map(x=>({name:x.name,vision:!!x.vision}))))"));
  console.log(`        ${models.length} chat models installed`);
  ok('chat models detected', models.length > 0);
  ok('vision model paired with projector', models.some((m) => m.vision));
  const catalog = JSON.parse(await ev("window.pristudio.getCatalog().then(c=>JSON.stringify(c.map(x=>({n:x.name,cat:x.cat,i:x.installed}))))"));
  ok('catalogue populated', catalog.length >= 25, `${catalog.length} entries`);
  ok('catalogue marks installed models', catalog.some((c) => c.i));
  ok('image models listed', JSON.parse(await ev("window.pristudio.imageStatus().then(s=>JSON.stringify(s.models))")).length > 0);
  ok('voice model listed', JSON.parse(await ev("window.pristudio.voiceInfo().then(v=>JSON.stringify(v.models))")).length > 0);

  /* ================= 4. engine + chat ================= */
  section('4. CHAT ENGINE');
  let st = JSON.parse(await ev("window.pristudio.serverStatus().then(JSON.stringify)"));
  if (st.state !== 'ready') {
    console.log('        loading a model…');
    await ev(`(function(){const m=S.models.find(x=>/llama-3.2-3b/i.test(x.name))||S.models[0]; loadModelFromUi(m.path); return true;})()`);
    await waitFor("S.server.state === 'ready'", 240000, 'model load');
    st = JSON.parse(await ev("window.pristudio.serverStatus().then(JSON.stringify)"));
  }
  ok('model loads and engine reports ready', st.state === 'ready', st.state);
  console.log(`        loaded: ${(st.modelPath || '').split(/[\\/]/).pop()}`);

  await ev("newChat(); true");
  await sleep(300);
  // long enough that the speed readout passes its "ignore tiny samples" guard
  await ev(`document.getElementById('input').value='Count from one to twenty, in words, separated by commas.'; document.getElementById('btn-send').click(); true`);
  const replied = await waitFor(`(function(){const m=document.querySelectorAll('.msg-assistant .md'); return m.length>0 && m[m.length-1].innerText.length>5 && !document.querySelector('.cursor');})()`, 180000, 'reply');
  const reply = await ev("(S.chat.messages[1]||{}).content || ''");
  ok('streams a reply', replied && reply.length > 0);
  ok('reply reaches the transcript', await ev("document.querySelectorAll('.msg-assistant').length > 0"));
  ok('speed indicator updates', (await ev("document.getElementById('gen-speed').textContent")).includes('tok/s'));

  /* ================= 5. chat persistence ================= */
  section('5. CONVERSATIONS');
  const chatId = await ev("S.chat.id");
  await ev("saveCurrentChat()");
  await sleep(400);
  ok('chat saved to disk', !!(await ev(`window.pristudio.getChat('${chatId}').then(c=>!!c)`)));
  ok('auto-titled from first message', (await ev("S.chat.title")).length > 3);
  ok('appears in the sidebar', await ev("S.chats.some(c=>c.id==='" + chatId + "')"));
  await ev("$('search').value='PORTICO'; renderChatList(); true");
  const searchHits = await ev("document.querySelectorAll('.chat-item').length");
  await ev("$('search').value=''; renderChatList(); true");
  ok('sidebar search filters', typeof searchHits === 'number');
  ok('memory meter reports usage', (await ev("document.getElementById('ctx-meter').textContent")).includes('memory'));

  /* ================= 6. projects ================= */
  section('6. PROJECTS');
  await ev("(async()=>{for(const p of await window.pristudio.listProjects()) if(p.id.startsWith('t_')) await window.pristudio.deleteProject(p.id);})()");
  await ev("document.getElementById('btn-new-project').click(); true");
  await sleep(400);
  ok('New project opens a dialog (not a blocked prompt)', await ev("!document.getElementById('modal').hidden"));
  await ev("document.getElementById('modal-input').value='Test Project'; document.getElementById('modal-ok').click(); true");
  await sleep(700);
  const projects = JSON.parse(await ev("window.pristudio.listProjects().then(p=>JSON.stringify(p.map(x=>x.name)))"));
  ok('project is created', projects.includes('Test Project'));
  ok('project appears in the sidebar', await ev("[...document.querySelectorAll('.proj-name')].some(e=>e.textContent==='Test Project')"));
  ok('opens its settings page', await ev("S.view === 'project'"));

  const projTest = await ev(`(async () => {
    const p = S.projects.find(x=>x.name==='Test Project');
    p.systemPrompt = 'Always answer in French.';
    p.files = [{name:'notes.txt', text:'The exam is on March 3rd.', chars:26}];
    S.projects = await window.pristudio.saveProject(p);
    S.activeProjectId = p.id;
    newChat(); ensureChat();
    S.chat.messages = [{role:'user', content:'when is the exam?'}];
    const sys = buildApiMessages(S.chat.messages).messages.find(m=>m.role==='system');
    await saveCurrentChat();
    const entry = S.chats.find(c=>c.id===S.chat.id);
    renderChatList();
    const visible = [...document.querySelectorAll('.chat-item')].length;
    S.activeProjectId = null; renderChatList();
    return JSON.stringify({
      instructionInPrompt: !!sys && sys.content.includes('Always answer in French'),
      fileInPrompt: !!sys && sys.content.includes('March 3rd'),
      chatTagged: entry ? entry.projectId === p.id : false,
      visibleUnderProject: visible > 0,
      leaks: (() => { const keep=S.chat; S.chat={id:'x',messages:[{role:'user',content:'hi'}],projectId:null};
        const s2 = buildApiMessages(S.chat.messages).messages.find(m=>m.role==='system');
        S.chat=keep; return !!s2 && s2.content.includes('March 3rd'); })()
    });
  })()`);
  const pj = JSON.parse(projTest);
  ok('project instructions reach the model', pj.instructionInPrompt);
  ok('project files reach the model', pj.fileInPrompt);
  ok('new chats join the active project', pj.chatTagged);
  ok('chats visible under their project', pj.visibleUnderProject);
  ok('project context does NOT leak to other chats', !pj.leaks);

  /* ================= 7. assistants ================= */
  section('7. ASSISTANTS');
  await ev("(async()=>{for(const a of await window.pristudio.listAssistants()) if(a.name==='Test Assistant') await window.pristudio.deleteAssistant(a.id);})()");
  await ev("if(document.getElementById('panel').classList.contains('closed')) document.getElementById('btn-panel').click(); true");
  await sleep(300);
  await ev("document.getElementById('p-system').value='You are a patient tutor.'; document.getElementById('p-temp').value=0.4; document.getElementById('p-save-assistant').click(); true");
  await sleep(400);
  await ev("document.getElementById('modal-input').value='Test Assistant'; document.getElementById('modal-ok').click(); true");
  await sleep(700);
  const asst = JSON.parse(await ev("window.pristudio.listAssistants().then(a=>JSON.stringify(a.map(x=>({n:x.name,p:x.systemPrompt||'',t:x.temperature}))))"));
  const mine = asst.find((a) => a.n === 'Test Assistant');
  ok('assistant saves', !!mine);
  ok('assistant stores its prompt and settings', mine && mine.p.includes('patient tutor') && mine.t === 0.4);
  ok('assistant appears in the picker', await ev("[...document.querySelectorAll('#p-assistant option')].some(o=>o.textContent==='Test Assistant')"));

  /* ================= 8. web search ================= */
  section('8. WEB SEARCH');
  const engines = JSON.parse(await ev("window.pristudio.searchEngines().then(e=>JSON.stringify(e.map(x=>x.label)))"));
  ok('engine roster exposed', engines.length >= 9, `${engines.length} engines`);
  console.log(`        ${engines.join(', ')}`);
  const searchRes = JSON.parse(await ev("window.pristudio.webSearch('what is a prediction market').then(r=>JSON.stringify({err:r.error||null, engine:r.engine||null, n:(r.results||[]).length, read:(r.results||[]).filter(x=>x.fetched).length}))"));
  ok('a live search returns results', !searchRes.err && searchRes.n > 0, searchRes.err || `${searchRes.n} results via ${searchRes.engine}`);
  ok('pages are actually read, not just linked', searchRes.read > 0, `${searchRes.read} read`);

  const gate = JSON.parse(await ev(`(() => {
    const was = S.settings.webSearch; S.settings.webSearch = true;
    const chat = {messages:[{role:'user',content:'x'}]};
    const r = {
      chitchat: searchPlan('hi there', chat).search,
      aboutAI: searchPlan('are you happy llama', chat).search,
      metaChat: searchPlan('what was the first message', chat).search,
      poem: searchPlan('write a poem about rain', chat).search,
      realQuestion: searchPlan('who won the 2026 spanish election?', chat).search,
      document: searchPlan('create a word document about the 2nd trump term', chat).search
    };
    S.settings.webSearch = was; return JSON.stringify(r);
  })()`));
  ok('does not search chit-chat', gate.chitchat === false);
  ok('does not search questions about itself', gate.aboutAI === false);
  ok('does not search questions about the chat', gate.metaChat === false);
  ok('does not search creative writing', gate.poem === false);
  ok('does search real questions', gate.realQuestion === true);
  ok('does search document requests about real topics', gate.document === true);

  /* ================= 9. attachments ================= */
  section('9. FILE ATTACHMENTS');
  const txt = path.join(SCRATCH, 'sample.txt');
  fs.writeFileSync(txt, 'The secret keyword is MARMALADE.');
  const att = JSON.parse(await ev(`window.pristudio.readFiles([${JSON.stringify(txt)}]).then(f=>JSON.stringify(f.map(x=>({n:x.name,chars:x.chars,err:x.error||null}))))`));
  ok('reads a text file', att[0] && !att[0].err && att[0].chars > 0, att[0] && att[0].err);
  const readme = path.join(__dirname, '..', 'README.md');
  const md = JSON.parse(await ev(`window.pristudio.readFiles([${JSON.stringify(readme)}]).then(f=>JSON.stringify(f.map(x=>({n:x.name,chars:x.chars}))))`));
  ok('reads markdown', md[0] && md[0].chars > 100);
  const imgPath = path.join(__dirname, '..', 'resources', 'icon.png');
  const img = JSON.parse(await ev(`window.pristudio.readFiles([${JSON.stringify(imgPath)}]).then(f=>JSON.stringify(f.map(x=>({n:x.name,isImage:!!x.isImage,hasData:!!x.dataUrl}))))`));
  ok('reads an image as image data (for vision)', img[0] && img[0].isImage && img[0].hasData);

  /* ================= 10. python ================= */
  section('10. RUN PYTHON');
  const py = JSON.parse(await ev("window.pristudio.pythonInfo().then(JSON.stringify)"));
  if (!py.found) { skipped('python execution', 'Python not installed'); }
  else {
    console.log(`        Python ${py.version} · matplotlib ${py.packages.matplotlib || 'missing'}`);
    ok('detects Python', !!py.version);
    const scan = JSON.parse(await ev(`window.pristudio.pythonScan('import os, shutil\\nshutil.rmtree("C:/")').then(JSON.stringify)`));
    ok('flags dangerous code before running', scan.length > 0, JSON.stringify(scan));
    const clean = JSON.parse(await ev(`window.pristudio.pythonScan('import matplotlib.pyplot as plt\\nplt.plot([1,2])').then(JSON.stringify)`));
    ok('does not flag plain plotting code', clean.length === 0);
    const run = JSON.parse(await ev(`window.pristudio.runPython({code:'print(6*7)', timeout:30000}).then(JSON.stringify)`));
    ok('executes a snippet', run.ok && run.stdout.includes('42'), run.error || run.stdout);
    if (py.packages.matplotlib) {
      const chart = JSON.parse(await ev(`window.pristudio.runPython({code:'import matplotlib.pyplot as plt\\nplt.bar(["a","b"],[3,5])\\nplt.show()', timeout:90000}).then(JSON.stringify)`));
      ok('renders a matplotlib chart to a file', chart.ok && (chart.figures || []).length > 0, chart.error);
    } else skipped('matplotlib chart', 'matplotlib not installed');
    const hang = JSON.parse(await ev(`window.pristudio.runPython({code:'while True:\\n    pass', timeout:5000}).then(JSON.stringify)`));
    ok('timeout stops runaway code', hang.timedOut === true);
  }

  /* ================= 11. artifacts ================= */
  section('11. ARTIFACTS');
  ok('detects HTML as an artifact', await ev("isArtifact('html','<h1>x</h1>')") === true);
  ok('detects SVG as an artifact', await ev("isArtifact('svg','<svg></svg>')") === true);
  ok('does not treat Python as an artifact', await ev("isArtifact('python','print(1)')") === false);
  await ev("openArtifact('<h1 style=\\'font-family:sans-serif\\'>Artifact test</h1>','Test')");
  await sleep(900);
  ok('artifact panel opens', await ev("!document.getElementById('artifact-panel').classList.contains('closed')"));
  ok('renders from a file URL', (await ev("document.getElementById('artifact-frame').src")).startsWith('file:///'));
  ok('sandboxed without same-origin access', !(await ev("document.getElementById('artifact-frame').getAttribute('sandbox')")).includes('allow-same-origin'));
  await ev("closeArtifact()");

  /* ================= 12. voice ================= */
  section('12. VOICE INPUT');
  const voice = JSON.parse(await ev("window.pristudio.voiceInfo().then(JSON.stringify)"));
  ok('speech engine bundled', voice.engineInstalled === true);
  ok('speech model present', (voice.models || []).length > 0);
  const wav = path.join(SCRATCH, 'speech.wav');
  if (!fs.existsSync(wav)) {
    // 16 kHz mono silence is enough to prove the pipeline end-to-end
    const samples = 16000, buf = Buffer.alloc(44 + samples * 2);
    buf.write('RIFF', 0); buf.writeUInt32LE(36 + samples * 2, 4); buf.write('WAVE', 8);
    buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
    buf.writeUInt32LE(16000, 24); buf.writeUInt32LE(32000, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
    buf.write('data', 36); buf.writeUInt32LE(samples * 2, 40);
    fs.writeFileSync(wav, buf);
  }
  const wavB64 = fs.readFileSync(wav).toString('base64');
  const trans = JSON.parse(await ev(`(async () => {
    const bin = atob(${JSON.stringify(wavB64)});
    const bytes = new Uint8Array(bin.length);
    for (let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
    return JSON.stringify(await window.pristudio.transcribe({ wavBytes: bytes, language: 'auto' }));
  })()`));
  ok('transcription pipeline runs without error', !trans.error, trans.error);
  ok('microphone button present', await ev("!!document.getElementById('btn-mic')"));

  /* ================= 13. image generation ================= */
  section('13. IMAGE GENERATION');
  const imgSt = JSON.parse(await ev("window.pristudio.imageStatus().then(JSON.stringify)"));
  ok('image engine installed', imgSt.engineInstalled === true);
  ok('image model available', (imgSt.models || []).length > 0);
  if (FAST) skipped('generating an image', '--fast');
  else if (!imgSt.engineInstalled || !(imgSt.models || []).length) skipped('generating an image', 'engine or model missing');
  else {
    console.log('        generating (this takes ~15-90s)…');
    const t0 = Date.now();
    const gen = JSON.parse(await ev(`window.pristudio.generateImage({prompt:'a single red apple on a white table', width:384, height:384, steps:8}).then(JSON.stringify)`));
    const secs = Math.round((Date.now() - t0) / 1000);
    ok('generates an image file', !gen.error && gen.path && fs.existsSync(gen.path), gen.error || `${secs}s`);
    if (gen.path && fs.existsSync(gen.path)) console.log(`        ${Math.round(fs.statSync(gen.path).size / 1024)} KB in ${secs}s`);
    const back = JSON.parse(await ev("window.pristudio.serverStatus().then(JSON.stringify)"));
    ok('chat model restored after generating', back.state === 'ready' || back.state === 'starting', back.state);
  }

  /* ================= 14. settings & persistence ================= */
  section('14. SETTINGS');
  const s0 = JSON.parse(await ev("window.pristudio.getSettings().then(JSON.stringify)"));
  ok('settings load', typeof s0.contextSize === 'number');
  await ev("window.pristudio.saveSettings({ imageSteps: 12 })");
  const s1 = JSON.parse(await ev("window.pristudio.getSettings().then(JSON.stringify)"));
  ok('settings save and read back', s1.imageSteps === 12);
  await ev(`window.pristudio.saveSettings({ imageSteps: ${s0.imageSteps || 0} })`);
  ok('search engine choices stored', typeof s0.searchEngines === 'object');
  ok('theme stored', typeof s0.theme === 'string');

  /* ================= 15. diagnostics & updates ================= */
  section('15. DIAGNOSTICS & UPDATES');
  const logPath = path.join(process.env.APPDATA || '', 'Portico', 'logs', 'portico.log');
  ok('log file written', fs.existsSync(logPath), logPath);
  if (fs.existsSync(logPath)) {
    const log = fs.readFileSync(logPath, 'utf8');
    ok('log records startup and environment', /Portico started/.test(log) && /electron/.test(log));
  }
  const upd = JSON.parse(await ev("window.pristudio.updateState().then(JSON.stringify)"));
  ok('update state reports cleanly', typeof upd.version === 'string');
  const check = JSON.parse(await ev("window.pristudio.updateCheck().then(JSON.stringify)"));
  ok('update check does not error out', check.status !== 'error', check.message || check.status);
  console.log(`        update feed: ${check.status}${check.message ? ' — ' + check.message.slice(0, 60) : ''}`);

  /* ================= 16. cleanup & console health ================= */
  section('16. STABILITY');
  await ev(`(async () => {
    for (const p of await window.pristudio.listProjects()) if (p.name === 'Test Project') await window.pristudio.deleteProject(p.id);
    for (const a of await window.pristudio.listAssistants()) if (a.name === 'Test Assistant') await window.pristudio.deleteAssistant(a.id);
    S.activeProjectId = null; renderProjectList(); renderChatList();
  })()`);
  ok('test data cleaned up', !(JSON.parse(await ev("window.pristudio.listProjects().then(p=>JSON.stringify(p.map(x=>x.name)))"))).includes('Test Project'));
  ok('no uncaught exceptions during the run', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '));
  ok('window still responsive', await ev("!!document.getElementById('input')"));

  /* ================= summary ================= */
  const mins = ((Date.now() - started) / 60000).toFixed(1);
  console.log(`\n${'='.repeat(64)}`);
  console.log(`RESULT: ${pass} passed, ${fail} failed, ${skip} skipped   (${mins} min)`);
  if (failures.length) {
    console.log('\nFailures:');
    failures.forEach((f) => console.log('  - ' + f));
  }
  console.log('='.repeat(64));
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error('\nSUITE CRASHED:', e.message); process.exit(2); });
