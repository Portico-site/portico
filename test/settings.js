// Checks the regrouped settings page: cards built, nothing lost, switches styled,
// and the conditional boxes opening with height rather than a hard cut.
const WebSocket = require('ws');
const http = require('http');

const PORT = process.argv[2] || 9249;

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
    if (await c.eval(`document.readyState === 'complete'`)) break;
    await wait(500);
  }

  console.log('\n=========== AJUSTES ===========\n');

  await c.eval(`showView('settings')`);
  await wait(900);

  const info = JSON.parse(await c.eval(`(() => {
    const form = document.querySelector('#settings-form');
    const gs = [...form.querySelectorAll('.set-group')];
    const wanted = ['s-dir','s-device','s-ctx','s-ngl','s-port','s-remote','s-share','s-bench','s-save','s-imgmodel','s-nres'];
    return JSON.stringify({
      groups: gs.map(g => ({
        title: g.querySelector('.set-group-title').textContent,
        items: g.querySelectorAll('.set-group-body > *').length,
        delay: getComputedStyle(g).animationDelay
      })),
      strayDividers: form.querySelectorAll('.settings-sep').length,
      directChildren: form.children.length,
      missingIds: wanted.filter(i => !document.getElementById(i)),
      fieldsTotal: form.querySelectorAll('.field').length
    });
  })()`));

  check(info.groups.length >= 5, 'the flat list became cards', info.groups.length + ' cards');
  info.groups.forEach((g) => console.log(`          ${g.title.padEnd(26)} ${String(g.items).padStart(2)} items   delay ${g.delay}`));
  check(info.strayDividers === 0, 'no text dividers left over');
  check(info.directChildren === info.groups.length, 'every field ended up inside a card',
    `${info.directChildren} direct children vs ${info.groups.length} cards`);
  check(info.missingIds.length === 0, 'no control lost its id', info.missingIds.join(', ') || '');
  check(info.fieldsTotal >= 20, 'all the fields survived the regroup', info.fieldsTotal + ' fields');
  check(info.groups.some((g) => g.delay !== '0s'), 'cards arrive staggered, not all at once');

  // switches
  const sw = JSON.parse(await c.eval(`(() => {
    const el = document.querySelector('.check-row input[type=checkbox]');
    const cs = getComputedStyle(el);
    return JSON.stringify({ w: cs.width, h: cs.height, radius: cs.borderRadius, appearance: cs.appearance });
  })()`));
  check(sw.w === '34px' && sw.h === '20px', 'checkboxes render as switches', `${sw.w} × ${sw.h}, radius ${sw.radius}`);

  // conditional box opens with height
  await c.eval(`(() => { const r = document.querySelector('#s-remote'); if (r.checked) r.click(); })()`);
  await wait(400);
  const shut = JSON.parse(await c.eval(`(() => { const b = document.querySelector('#s-remote-box'); const cs = getComputedStyle(b); return JSON.stringify({ hidden: b.hidden, open: b.classList.contains('open'), max: cs.maxHeight }); })()`));
  check(shut.hidden && !shut.open, 'the conditional box is closed to start', `hidden=${shut.hidden}`);

  await c.eval(`document.querySelector('#s-remote').click()`);
  await wait(500);
  // Read the transition property BEFORE suppressing it — an occluded Electron
  // window does not composite, so a transition sits frozen at its first frame and
  // any height measured mid-animation is meaningless.
  const transition = await c.eval(`getComputedStyle(document.querySelector('#s-remote-box')).transitionProperty`);
  const open = JSON.parse(await c.eval(`(() => {
    const b = document.querySelector('#s-remote-box');
    b.style.transition = 'none';           // jump to the settled state
    void b.offsetWidth;
    const cs = getComputedStyle(b);
    const r = b.getBoundingClientRect();
    const out = { hidden: b.hidden, open: b.classList.contains('open'), max: cs.maxHeight, h: Math.round(r.height) };
    b.style.transition = '';
    return JSON.stringify(out);
  })()`));
  check(!open.hidden && open.open, 'switching it on reveals the box');
  check(open.h > 60, 'the box actually has height once open', `${open.h}px tall, max-height ${open.max}`);
  check(/max-height/.test(transition), 'it animates open rather than cutting in', transition);

  // put it back
  await c.eval(`(() => { const r = document.querySelector('#s-remote'); if (r.checked) r.click(); })()`);
  await wait(400);
  await c.eval(`showView('chat')`);

  console.log(`\n===============================`);
  console.log(`RESULTADO: ${fails === 0 ? 'todo correcto' : fails + ' FALLOS'}`);
  console.log(`===============================\n`);
  c.close();
  process.exit(fails ? 1 : 0);
})();
