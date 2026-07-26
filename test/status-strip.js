// Verifies the status strip: segments render, the effort menu actually changes the
// setting, and the token panel reports real numbers with working controls.
const WebSocket = require('ws');
const http = require('http');

const PORT = process.argv[2] || 9232;

function cdp(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let id = 0; const pending = new Map();
    ws.on('open', () => resolve({
      send(m, p) { return new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); }); },
      async eval(e) {
        const r = await this.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true });
        if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception));
        return r.result.value;
      },
      close: () => ws.close(),
    }));
    ws.on('error', reject);
    ws.on('message', (d) => {
      const m = JSON.parse(d);
      if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
    });
  });
}

let fails = 0;
const check = (ok, msg, extra = '') => { if (!ok) fails++; console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}${extra ? '\n        ' + extra : ''}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const list = await new Promise((res) => http.get(`http://127.0.0.1:${PORT}/json/list`, (x) => { let b = ''; x.on('data', (c) => { b += c; }); x.on('end', () => res(JSON.parse(b))); }));
  const page = list.find((t) => t.type === 'page' && /index\.html/.test(t.url));
  const c = await cdp(page.webSocketDebuggerUrl);
  await c.send('Runtime.enable');
  for (let n = 0; n < 60; n++) {
    if (await c.eval(`document.readyState === 'complete' && !!document.querySelector('#st-tokens-val')`)) break;
    await wait(500);
  }

  console.log('\n=========== STATUS STRIP ===========\n');

  const segs = JSON.parse(await c.eval(`JSON.stringify({
    strip: !!document.querySelector('#status-strip'),
    model: (document.querySelector('#st-model .st-val')||{}).textContent,
    effort: (document.querySelector('#st-effort .st-val')||{}).textContent,
    tokens: (document.querySelector('#st-tokens-val')||{}).textContent,
    ring: !!document.querySelector('#st-ring'),
    modelSelectHidden: document.querySelector('#composer-model').hidden,
    selectStillInDom: !!document.querySelector('#composer-model')
  })`));
  check(segs.strip, 'status strip renders');
  check(!!segs.model, 'model segment shows a name', segs.model);
  check(/Quick|Balanced|Deep/.test(segs.effort || ''), 'effort segment shows a level', segs.effort);
  check(/%$/.test(segs.tokens || ''), 'token segment shows a percentage', segs.tokens);
  check(segs.ring, 'usage ring is present');
  check(segs.selectStillInDom && segs.modelSelectHidden,
    'the old model <select> is kept hidden for compatibility');

  // effort menu changes the setting for real
  await c.eval(`window.pristudio.saveSettings({effort:'balanced'})`);
  await c.eval(`(async()=>{ S.settings = await window.pristudio.getSettings(); renderStatusStrip(); })()`);
  await c.eval(`document.querySelector('#st-effort').click()`);
  await wait(200);
  const menu = JSON.parse(await c.eval(`(() => { const m=document.querySelector('.row-menu'); return JSON.stringify({open:!!m, items: m?[...m.querySelectorAll('.row-menu-item')].map(b=>b.textContent):[]}); })()`));
  check(menu.open, 'effort segment opens a menu');
  check(menu.items.join(',') === 'Quick,Balanced,Deep', 'menu lists the three levels', menu.items.join(' / '));

  await c.eval(`[...document.querySelectorAll('.row-menu-item')].find(b=>b.textContent==='Deep').click()`);
  await wait(400);
  const saved = await c.eval(`(async()=> (await window.pristudio.getSettings()).effort)()`);
  check(saved === 'deep', 'choosing Deep saves the setting', 'effort = ' + saved);
  check((await c.eval(`document.querySelector('#st-effort .st-val').textContent`)) === 'Deep', 'strip updates to Deep');

  // effort must actually change the request, not just the label
  const deepMax = await c.eval(`effortMaxTokens()`);
  const deepSys = await c.eval(`buildApiMessages([{role:'user',content:'what is 17% of 240?'}]).messages[0].content`);
  await c.eval(`(async()=>{ S.settings = await window.pristudio.saveSettings({effort:'quick'}); })()`);
  const quickMax = await c.eval(`effortMaxTokens()`);
  const quickSys = await c.eval(`buildApiMessages([{role:'user',content:'what is 17% of 240?'}]).messages[0].content`);
  check(deepMax > quickMax, 'Deep allows a longer reply than Quick', `deep ${deepMax} vs quick ${quickMax} tokens`);
  check(/step by step/i.test(deepSys || ''), 'Deep injects a reasoning instruction');
  check(/concise|directly/i.test(quickSys || ''), 'Quick injects a brevity instruction');

  // token panel
  await c.eval(`(async()=>{ S.settings = await window.pristudio.saveSettings({effort:'balanced'}); renderStatusStrip(); })()`);
  await c.eval(`document.querySelector('#st-tokens').click()`);
  await wait(250);
  const panel = JSON.parse(await c.eval(`(() => {
    const p = document.querySelector('.tok-panel');
    if (!p) return JSON.stringify({open:false});
    return JSON.stringify({
      open: true,
      opened: p.classList.contains('open'),
      rows: [...p.querySelectorAll('.tok-row')].map(r=>r.textContent.replace(/\\s+/g,' ').trim()),
      hasBar: !!p.querySelector('.tok-bar'),
      hasCtx: !!p.querySelector('#tok-ctx'),
      hasMax: !!p.querySelector('#tok-max')
    });
  })()`));
  check(panel.open, 'token segment opens the usage panel');
  check(panel.opened, 'panel plays its open animation');
  check(panel.hasBar, 'panel shows the breakdown bar');
  check(panel.rows.some((r) => /Context window/.test(r)), 'panel reports the context window', panel.rows[0]);
  check(panel.rows.some((r) => /Used/.test(r)), 'panel reports how much is used', (panel.rows.find((r) => /Used/.test(r)) || ''));
  check(panel.hasCtx && panel.hasMax, 'panel offers context size and reply length controls');

  // the controls persist
  await c.eval(`(() => { const s=document.querySelector('#tok-ctx'); s.value='8192'; s.dispatchEvent(new Event('change')); })()`);
  await wait(400);
  const ctxSaved = await c.eval(`(async()=> (await window.pristudio.getSettings()).contextSize)()`);
  check(ctxSaved === 8192, 'changing context size in the panel saves it', 'contextSize = ' + ctxSaved);

  // restore
  await c.eval(`(async()=>{ S.settings = await window.pristudio.saveSettings({contextSize:4096, effort:'balanced'}); renderStatusStrip(); })()`);
  await c.eval(`document.querySelectorAll('.row-menu').forEach(m=>m.remove())`);

  console.log(`\n====================================`);
  console.log(`RESULT: ${fails === 0 ? 'all checks passed' : fails + ' FAILED'}`);
  console.log(`====================================\n`);
  c.close();
  process.exit(fails ? 1 : 0);
})();
