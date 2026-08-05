// Does the composer travel, or does it jump?
//
// An occluded Electron window does not composite, so transitions sit frozen and a
// timed sample proves nothing. Instead this drives the transition's own timeline
// with getAnimations() + currentTime, which advances regardless of painting, and
// measures the composer at each step. A jump shows up as one big gap between
// otherwise small ones.
const WebSocket = require('ws');
const http = require('http');

const PORT = process.argv[2] || 9256;

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
  await wait(600);

  console.log('\n===== ¿SE DESLIZA O SALTA? =====\n');

  const inner = await c.eval(`!!document.querySelector('#empty-state > .greeting-inner')`);
  check(inner, 'the greeting has the inner wrapper the collapse needs');

  const prop = await c.eval(`getComputedStyle(document.querySelector('#empty-state')).transitionProperty`);
  check(/grid-template-rows/.test(prop), 'the height is animated rather than switched off', prop);
  check(!/display/.test(prop), 'display is no longer part of it — that was the jump', prop);

  // Walk the transition's own timeline and record where the composer sits.
  const samples = JSON.parse(await c.eval(`(() => {
    const sb = document.querySelector('#sidebar');
    const wrap = document.querySelector('#composer-wrap');
    const es = document.querySelector('#empty-state');
    sb.classList.remove('collapsed');
    void document.body.offsetWidth;
    const start = Math.round(wrap.getBoundingClientRect().top);

    sb.classList.add('collapsed');          // begin the collapse
    const anims = es.getAnimations();
    if (!anims.length) return JSON.stringify({ error: 'no transition started' });
    const dur = Math.max(...anims.map(a => (a.effect.getTiming().duration || 0)));

    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const t = (dur * i) / 10;
      anims.forEach(a => { a.currentTime = t; });
      document.body.offsetHeight;           // force layout at this instant
      pts.push(Math.round(wrap.getBoundingClientRect().top));
    }
    anims.forEach(a => a.finish());
    document.body.offsetHeight;
    const end = Math.round(wrap.getBoundingClientRect().top);
    sb.classList.remove('collapsed');
    return JSON.stringify({ dur, start, end, pts });
  })()`));

  if (samples.error) {
    check(false, 'a transition actually starts on collapse', samples.error);
  } else {
    console.log(`        recorrido del compositor: ${samples.pts.join(' → ')}`);
    const steps = samples.pts.slice(1).map((v, i) => Math.abs(v - samples.pts[i]));
    const biggest = Math.max(...steps);
    const total = Math.abs(samples.pts[samples.pts.length - 1] - samples.pts[0]);
    check(total > 20, 'the composer does move as the greeting goes', `${total}px in total`);
    // A snap puts the whole distance in a single step. Easing legitimately makes
    // some steps larger than others, so the bar is "no single step carries most of
    // it", not "every step is equal".
    check(biggest <= total * 0.55, 'it travels rather than jumping',
      `paso mayor ${biggest}px de ${total}px totales`);
    check(steps.filter((s) => s > 0).length >= 5, 'the movement is spread over the timeline, not front-loaded',
      `${steps.filter((s) => s > 0).length} de 10 tramos con movimiento`);
  }

  console.log(`\n================================`);
  console.log(`RESULTADO: ${fails === 0 ? 'todo correcto' : fails + ' FALLOS'}`);
  console.log(`================================\n`);
  c.close();
  process.exit(fails ? 1 : 0);
})();
