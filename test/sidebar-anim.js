// The sidebar animation relies on transition-behavior: allow-discrete, which is
// recent CSS. Check the engine really supports it rather than assuming, then check
// the coordinated pieces: the slide, the contents leaving, the greeting fading and
// the reopen button arriving — and that state ends up correct either way.
const WebSocket = require('ws');
const http = require('http');

const PORT = process.argv[2] || 9254;

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
  await c.eval(`showView('chat'); newChat(); document.querySelector('#sidebar').classList.remove('collapsed');`);
  await wait(500);

  console.log('\n======== ANIMACIÓN DE LA BARRA LATERAL ========\n');

  // 1. does this engine actually support the modern bits?
  const support = JSON.parse(await c.eval(`JSON.stringify({
    discrete: CSS.supports('transition-behavior', 'allow-discrete'),
    startingStyle: CSS.supports('selector(:has(*))') && (() => {
      try { return [...document.styleSheets].some(s => { try { return [...s.cssRules].some(r => r.constructor.name === 'CSSStartingStyleRule'); } catch { return false; } }); } catch { return false; }
    })(),
    chrome: (navigator.userAgent.match(/Chrome\\/([0-9]+)/) || [])[1]
  })`));
  check(support.discrete, 'the engine supports transition-behavior: allow-discrete',
    `Chrome ${support.chrome}`);
  check(support.startingStyle, '@starting-style rules parsed rather than dropped');

  // 2. the slide itself
  const slide = JSON.parse(await c.eval(`(() => {
    const cs = getComputedStyle(document.querySelector('#sidebar'));
    return JSON.stringify({ prop: cs.transitionProperty, dur: cs.transitionDuration, ease: cs.transitionTimingFunction });
  })()`));
  check(/margin-left/.test(slide.prop), 'the panel animates its own width out of the layout', slide.prop);
  check(parseFloat(slide.dur) >= 0.3, 'long enough to read as movement', `${slide.dur} (was 0.18s)`);
  check(/cubic-bezier/.test(slide.ease), 'eased rather than linear', slide.ease);

  // 3. contents drift out with it
  const inner = JSON.parse(await c.eval(`(() => {
    const el = document.querySelector('#chat-list');
    const cs = getComputedStyle(el);
    return JSON.stringify({ prop: cs.transitionProperty });
  })()`));
  check(/opacity/.test(inner.prop) && /transform/.test(inner.prop),
    'the contents fade and drift instead of being cropped', inner.prop);

  // Settled state has to be read with transitions off. `display` is animated with
  // allow-discrete, which holds the old value until the transition finishes — and
  // an occluded Electron window never composites, so it never finishes here.
  const settled = () => c.eval(`(() => {
    const es = document.querySelector('#empty-state');
    const bx = document.querySelector('#btn-expand');
    const gi = es.querySelector('.greeting-inner');
    for (const el of [es, bx, gi]) { if (el) el.style.transition = 'none'; }
    void document.body.offsetWidth;
    const out = {
      greeting: getComputedStyle(es).display,
      greetH: Math.round(es.getBoundingClientRect().height),
      expand: getComputedStyle(bx).display,
      expandOpacity: getComputedStyle(bx).opacity,
      hasHiddenAttr: bx.hasAttribute('hidden'),
      collapsed: document.querySelector('#sidebar').classList.contains('collapsed')
    };
    for (const el of [es, bx, gi]) { if (el) el.style.transition = ''; }
    return JSON.stringify(out);
  })()`);

  // 4. open state
  const open = JSON.parse(await settled());
  check(open.greetH > 80, 'open: the greeting is shown', `${open.greetH}px tall`);
  check(open.expand === 'none', 'open: the reopen button is hidden');

  // 5. collapse via the real button, and let it settle
  await c.eval(`document.querySelector('#btn-collapse').click()`);
  await wait(700);
  const shut = JSON.parse(await settled());
  check(shut.collapsed, 'the collapse button collapses it');
  check(shut.greetH === 0, 'collapsed: the greeting is collapsed away', `${shut.greetH}px tall`);
  check(shut.expand !== 'none', 'collapsed: the reopen button is there', `display: ${shut.expand}`);
  check(!shut.hasHiddenAttr, 'the button is driven by CSS, not a hidden attribute');

  // 6. and back
  await c.eval(`document.querySelector('#btn-expand').click()`);
  await wait(700);
  const back = JSON.parse(await settled());
  check(!back.collapsed, 'the reopen button reopens it');
  check(back.greetH > 80, 'reopened: the greeting is back', `${back.greetH}px tall`);
  check(back.expand === 'none', 'reopened: the reopen button steps aside again');

  console.log(`\n==============================================`);
  console.log(`RESULTADO: ${fails === 0 ? 'todo correcto' : fails + ' FALLOS'}`);
  console.log(`==============================================\n`);
  c.close();
  process.exit(fails ? 1 : 0);
})();
