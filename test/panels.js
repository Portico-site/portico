// Checks the four reported problems are actually fixed in the running app:
// the artifact close button is reachable, Escape closes it, the token panel is
// compact and right-aligned, and the context figure is not printed twice.
const WebSocket = require('ws');
const http = require('http');

const PORT = process.argv[2] || 9233;

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

  console.log('\n=========== REPORTED FIXES ===========\n');

  // ---- 1. artifact panel close button is not under the OS window buttons ----
  // Suppress the slide-in transition before measuring: an occluded Electron window
  // does not composite, so the panel can still be part-way open 400ms later and the
  // geometry read would be meaningless.
  await c.eval(`(async () => {
    await window.pristudio.writeArtifact({ html: '<h1>test artifact</h1>', title: 'Close test' });
    const p = document.querySelector('#artifact-panel');
    p.style.transition = 'none';
    p.classList.remove('closed');
    void p.offsetWidth;
  })()`);
  await wait(200);

  const geo = JSON.parse(await c.eval(`(() => {
    const head = document.querySelector('.ap-head');
    const close = document.querySelector('#ap-close');
    const r = close.getBoundingClientRect();
    const wcoVar = getComputedStyle(document.documentElement).getPropertyValue('--wco-w').trim();
    const o = navigator.windowControlsOverlay;
    let bar = null;
    if (o && o.visible) { const b = o.getTitlebarAreaRect(); bar = { x: b.x, width: b.width }; }
    // the strip Windows reserves at the top-right for its own buttons
    const reserved = bar ? window.innerWidth - (bar.x + bar.width) : null;
    return JSON.stringify({
      closeRight: Math.round(r.right), closeTop: Math.round(r.top), closeW: Math.round(r.width),
      winW: window.innerWidth, reserved, wcoVar,
      headPadRight: getComputedStyle(head).paddingRight,
      // is the close button clear of the reserved strip?
      clear: bar ? r.right <= (bar.x + bar.width) : null,
      // and is it the element you actually hit at its own centre?
      hit: (() => { const el = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2); return el ? (el.id || el.className || el.tagName) : null; })()
    });
  })()`));
  check(geo.wcoVar !== '', 'window-control width measured at runtime', '--wco-w = ' + geo.wcoVar + (geo.reserved !== null ? `  (Windows reserves ${geo.reserved}px)` : ''));
  check(geo.headPadRight && parseFloat(geo.headPadRight) > 100, 'artifact header reserves that strip', 'padding-right = ' + geo.headPadRight);
  check(geo.clear !== false, 'close button sits clear of the OS window buttons',
    `close button right edge ${geo.closeRight}px, window ${geo.winW}px`);
  check(/ap-close|icon-btn/.test(String(geo.hit)), 'close button is the element under its own centre', 'hit: ' + geo.hit);

  // clicking it works
  await c.eval(`document.querySelector('#ap-close').click()`);
  await wait(300);
  check(await c.eval(`document.querySelector('#artifact-panel').classList.contains('closed')`),
    'clicking close dismisses the artifact');

  // Escape also works
  await c.eval(`document.querySelector('#artifact-panel').classList.remove('closed')`);
  await wait(200);
  await c.eval(`document.querySelector('#artifact-panel').style.transition = ''`);
  await c.eval(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))`);
  await wait(300);
  check(await c.eval(`document.querySelector('#artifact-panel').classList.contains('closed')`),
    'Escape closes the artifact too');

  // ---- 2 & 3. token panel is compact and right-aligned ----
  await c.eval(`document.querySelector('#st-tokens').click()`);
  await wait(250);
  const panel = JSON.parse(await c.eval(`(() => {
    const p = document.querySelector('.tok-panel');
    if (!p) return JSON.stringify({open:false});
    const r = p.getBoundingClientRect();
    const col = document.querySelector('#composer-wrap').getBoundingClientRect();
    return JSON.stringify({
      open: true,
      width: Math.round(r.width),
      right: Math.round(r.right),
      colRight: Math.round(col.right),
      insideViewport: r.left >= 0 && r.right <= window.innerWidth,
      // "above" means clear of the button it belongs to — the strip's own top edge
      // sits ~8px higher because of its padding, which is not a useful reference
      aboveStrip: r.bottom <= document.querySelector('#st-tokens').getBoundingClientRect().top + 1
    });
  })()`));
  check(panel.open, 'token panel opens');
  check(panel.width <= 290, 'panel is compact, not stretched across the chat', panel.width + 'px wide');
  check(Math.abs(panel.right - panel.colRight) <= 2, 'panel is right-aligned to the composer column',
    `panel right ${panel.right}px vs column right ${panel.colRight}px`);
  check(panel.insideViewport, 'panel stays inside the window');
  check(panel.aboveStrip, 'panel opens upward, above the strip');

  await c.eval(`document.querySelectorAll('.row-menu').forEach(m=>m.remove())`);

  // ---- 4. the context figure is not shown twice ----
  // the meter is only written when a request is built, so build one first
  await c.eval(`updateContextMeter(buildApiMessages([{role:'user',content:'hello there'}]))`);
  const dup = JSON.parse(await c.eval(`(() => {
    const m = document.querySelector('#ctx-meter');
    const strip = document.querySelector('#status-strip');
    return JSON.stringify({
      meterHidden: m.hidden,
      meterText: m.textContent,
      stripText: strip.innerText.replace(/\\s+/g,' ').trim()
    });
  })()`));
  check(dup.meterHidden, 'the duplicate "memory %" label is hidden');
  check(/memory/.test(dup.meterText), 'but it is still kept up to date (the suite reads it)', dup.meterText || '(empty)');
  check(!/memory/i.test(dup.stripText), 'the strip shows the figure once, via the ring', dup.stripText);

  console.log(`\n======================================`);
  console.log(`RESULT: ${fails === 0 ? 'all checks passed' : fails + ' FAILED'}`);
  console.log(`======================================\n`);
  c.close();
  process.exit(fails ? 1 : 0);
})();
