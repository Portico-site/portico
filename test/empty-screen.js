// The empty screen lost its logo and heading, so the composer should now be
// genuinely centred rather than pushed up by a percentage margin. Also checks the
// chat settings sliders are drawn rather than inherited from the platform.
const WebSocket = require('ws');
const http = require('http');

const PORT = process.argv[2] || 9251;

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
  await c.eval(`showView('chat'); newChat();`);
  await wait(600);

  console.log('\n========== PANTALLA VACÍA ==========\n');

  const gone = JSON.parse(await c.eval(`JSON.stringify({
    mark: !!document.querySelector('.greeting-mark'),
    heading: !!document.querySelector('.greeting'),
    emptyStatePresent: !!document.querySelector('#empty-state'),
    bodyText: (document.querySelector('#view-chat').innerText || '').includes("What's on your mind")
  })`));
  check(!gone.mark, 'the logo is gone from the empty screen');
  check(!gone.heading, 'the heading is gone');
  check(!gone.bodyText, '"What\'s on your mind?" no longer appears');
  check(gone.emptyStatePresent, 'the empty-state element is still there for the code that keys off it');

  // centring: the gap above the composer should match the gap below it
  const geo = JSON.parse(await c.eval(`(() => {
    const view = document.querySelector('#view-chat');
    const wrap = document.querySelector('#composer-wrap');
    const v = view.getBoundingClientRect();
    const w = wrap.getBoundingClientRect();
    return JSON.stringify({
      isEmpty: view.classList.contains('empty'),
      above: Math.round(w.top - v.top),
      below: Math.round(v.bottom - w.bottom),
      viewH: Math.round(v.height),
      justify: getComputedStyle(view).justifyContent
    });
  })()`));
  check(geo.isEmpty, 'the view is in its empty state');
  check(geo.justify === 'center', 'the view centres its contents', `justify-content: ${geo.justify}`);
  const skew = Math.abs(geo.above - geo.below);
  check(skew <= 24, 'the composer sits centred, not pushed up',
    `${geo.above}px above vs ${geo.below}px below (difference ${skew}px)`);

  console.log('\n========== AJUSTES DE CHAT ==========\n');
  await c.eval(`document.querySelector('#panel').classList.remove('closed')`);
  await wait(300);
  const sl = JSON.parse(await c.eval(`(() => {
    const r = document.querySelector('#p-temp');
    const cs = getComputedStyle(r);
    const chip = document.querySelector('#p-temp-v');
    const chipCs = chip ? getComputedStyle(chip) : null;
    return JSON.stringify({
      appearance: cs.appearance,
      h: cs.height,
      chipFont: chipCs ? chipCs.fontFamily.split(',')[0] : null,
      chipBg: chipCs ? chipCs.backgroundColor : null,
      textareaMin: getComputedStyle(document.querySelector('#p-system')).minHeight
    });
  })()`));
  check(sl.appearance === 'none', 'the sliders are drawn, not the platform default', `appearance: ${sl.appearance}`);
  check(sl.h === '18px', 'the slider has a deliberate height', sl.h);
  check(/mono|Cascadia|Consolas/i.test(sl.chipFont || ''), 'the value reads as a chip in a monospaced face', sl.chipFont);
  check(sl.chipBg && sl.chipBg !== 'rgba(0, 0, 0, 0)', 'the chip has a surface behind it', sl.chipBg);
  check(parseInt(sl.textareaMin, 10) >= 80, 'the prompt box has room to write in', sl.textareaMin);

  await c.eval(`document.querySelector('#panel').classList.add('closed')`);

  console.log(`\n====================================`);
  console.log(`RESULTADO: ${fails === 0 ? 'todo correcto' : fails + ' FALLOS'}`);
  console.log(`====================================\n`);
  c.close();
  process.exit(fails ? 1 : 0);
})();
