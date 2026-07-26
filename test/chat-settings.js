// The chat settings panel looked blank because the closed artifact panel's iframe
// was still painting over it. These checks assert the settings are genuinely on
// screen and hittable, and that closed panels stop painting at all.
const WebSocket = require('ws');
const http = require('http');

const PORT = process.argv[2] || 9239;

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
    if (await c.eval(`document.readyState === 'complete' && !!document.querySelector('#p-assistant')`)) break;
    await wait(500);
  }

  console.log('\n========== CHAT SETTINGS PANEL ==========\n');

  // start from a known state, transitions suppressed (an occluded window does not
  // composite, so a mid-transition read would be meaningless)
  await c.eval(`(() => {
    for (const id of ['panel','artifact-panel']) {
      const el = document.querySelector('#'+id);
      el.style.transition = 'none';
      el.classList.add('closed');
    }
    void document.body.offsetWidth;
  })()`);
  await wait(150);

  check(await c.eval(`getComputedStyle(document.querySelector('#artifact-panel')).visibility === 'hidden'`),
    'a closed artifact panel stops painting');
  check(await c.eval(`getComputedStyle(document.querySelector('#panel')).visibility === 'hidden'`),
    'a closed settings panel stops painting');

  // open chat settings the way the button does
  await c.eval(`document.querySelector('#btn-panel').click(); void document.body.offsetWidth;`);
  await wait(200);
  check(!(await c.eval(`document.querySelector('#panel').classList.contains('closed')`)),
    'the toggle opens the panel');
  check(await c.eval(`getComputedStyle(document.querySelector('#panel')).visibility === 'visible'`),
    'the open panel is visible');

  // every control must be the thing you actually hit at its own centre
  const probe = JSON.parse(await c.eval(`(() => {
    const ids = ['p-assistant','p-system','p-temp','p-topp','p-maxtok'];
    const out = {};
    for (const id of ids) {
      const el = document.querySelector('#'+id);
      if (!el) { out[id] = 'MISSING'; continue; }
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) { out[id] = 'zero-size'; continue; }
      const hit = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
      out[id] = hit ? (hit.id || hit.tagName.toLowerCase()) : 'nothing';
    }
    return JSON.stringify(out);
  })()`));
  for (const [id, hit] of Object.entries(probe)) {
    check(hit === id, `${id} is reachable, not covered`, hit === id ? '' : `hit "${hit}" instead`);
  }

  // and the values are populated, not an empty shell
  const vals = JSON.parse(await c.eval(`JSON.stringify({
    assistantOptions: document.querySelectorAll('#p-assistant option').length,
    temp: document.querySelector('#p-temp').value,
    maxtok: document.querySelector('#p-maxtok').value
  })`));
  check(vals.assistantOptions >= 1, 'assistant picker is populated', vals.assistantOptions + ' option(s)');
  check(vals.temp !== '' && vals.maxtok !== '', 'sliders and fields carry their saved values',
    `temperature ${vals.temp}, max tokens ${vals.maxtok}`);

  // Editing must persist. Compare against the value the slider actually settled on:
  // it has step="0.05", so an arbitrary number snaps and asserting on the number we
  // asked for would fail even when saving works perfectly.
  const wanted = await c.eval(`(() => {
    const t = document.querySelector('#p-temp');
    t.value = '0.65';
    t.dispatchEvent(new Event('input'));
    return t.value;              // post-snap
  })()`);
  // The save is debounced and then crosses IPC, so poll rather than guessing a
  // single sleep long enough to cover both.
  let saved = null;
  for (let i = 0; i < 20; i++) {
    saved = await c.eval(`(async () => (await window.pristudio.getSettings()).temperature)()`);
    if (Math.abs(saved - parseFloat(wanted)) < 0.001) break;
    await wait(250);
  }
  check(Math.abs(saved - parseFloat(wanted)) < 0.001, 'changing a setting saves it',
    `slider settled on ${wanted}, saved ${saved}`);

  // restore
  await c.eval(`(async () => {
    S.settings = await window.pristudio.saveSettings({ temperature: 0.4 });
    initPanel();
    for (const id of ['panel','artifact-panel']) {
      const el = document.querySelector('#'+id);
      el.classList.add('closed');
      el.style.transition = '';
    }
  })()`);

  console.log(`\n=========================================`);
  console.log(`RESULT: ${fails === 0 ? 'all checks passed' : fails + ' FAILED'}`);
  console.log(`=========================================\n`);
  c.close();
  process.exit(fails ? 1 : 0);
})();
