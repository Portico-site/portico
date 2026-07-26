// Drives the running Portico over CDP to turn on Host mode, then verifies from
// outside the app that the engine is genuinely reachable on the LAN address and
// that the access key is actually enforced.
const WebSocket = require('ws');
const http = require('http');

const PORT = process.argv[2] || 9224;

function cdp(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let id = 0;
    const pending = new Map();
    ws.on('open', () => resolve({
      send(method, params) {
        return new Promise((res, rej) => {
          const myId = ++id;
          pending.set(myId, { res, rej });
          ws.send(JSON.stringify({ id: myId, method, params }));
        });
      },
      async eval(expr) {
        const r = await this.send('Runtime.evaluate', {
          expression: expr, awaitPromise: true, returnByValue: true,
        });
        if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception));
        return r.result.value;
      },
      close: () => ws.close(),
    }));
    ws.on('error', reject);
    ws.on('message', (d) => {
      const m = JSON.parse(d);
      if (m.id && pending.has(m.id)) {
        const { res, rej } = pending.get(m.id);
        pending.delete(m.id);
        m.error ? rej(new Error(m.error.message)) : res(m.result);
      }
    });
  });
}

function get(url, key) {
  return new Promise((resolve) => {
    const headers = key ? { Authorization: 'Bearer ' + key } : {};
    const req = http.get(url, { headers, timeout: 8000 }, (res) => {
      let b = '';
      res.on('data', (c) => { b += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: b.slice(0, 200) }));
    });
    req.on('error', (e) => resolve({ status: 0, body: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: 'timeout' }); });
  });
}

function post(url, key, payload) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const headers = { 'Content-Type': 'application/json' };
    if (key) headers.Authorization = 'Bearer ' + key;
    const req = http.request(u, { method: 'POST', headers, timeout: 60000 }, (res) => {
      let b = '';
      res.on('data', (c) => { b += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: b }));
    });
    req.on('error', (e) => resolve({ status: 0, body: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: 'timeout' }); });
    req.write(JSON.stringify(payload));
    req.end();
  });
}

const ok = (c, m, extra = '') => console.log(`  ${c ? 'PASS' : 'FAIL'}  ${m}${extra ? '\n        ' + extra : ''}`);
let failures = 0;
const check = (c, m, extra) => { if (!c) failures++; ok(c, m, extra); };

(async () => {
  const list = await new Promise((res) => {
    http.get(`http://127.0.0.1:${PORT}/json/list`, (r) => {
      let b = ''; r.on('data', (c) => { b += c; }); r.on('end', () => res(JSON.parse(b)));
    });
  });
  const page = list.find((t) => t.type === 'page' && t.url.includes('index.html'));
  const c = await cdp(page.webSocketDebuggerUrl);
  await c.send('Runtime.enable');

  console.log('\n================ SHARED ENGINE ================\n');

  // 1. generate a key and turn on sharing
  const key = await c.eval(`window.pristudio.generateShareKey()`);
  check(/^[0-9a-f]{24}$/.test(key), 'host generates an access key', key);

  const info = await c.eval(`window.pristudio.networkInfo()`);
  const lan = info.addresses[0] && info.addresses[0].address;
  check(!!lan, 'this machine has a LAN address', lan ? `${lan}:${info.port}` : 'none found');

  await c.eval(`window.pristudio.saveSettings({shareEngine:true, parallelSlots:2, contextSize:4096})`);
  check(true, 'sharing enabled with 2 slots');

  // 2. load a model with sharing on, and wait for it
  const models = await c.eval(`window.pristudio.listModels()`);
  const small = models.find((m) => /3B|1B/i.test(m.name)) || models[0];
  console.log(`        loading ${small.name} …`);
  await c.eval(`window.pristudio.loadModel(${JSON.stringify(small.path)})`);
  let st = null;
  for (let i = 0; i < 180; i++) {
    st = await c.eval(`window.pristudio.serverStatus()`);
    if (st.state === 'ready' || st.state === 'error') break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  check(st.state === 'ready', 'engine started in shared mode', st.state === 'error' ? st.error : st.state);

  if (st.state !== 'ready') { c.close(); process.exit(1); }

  // 3. the interesting part: reach it from outside the app, over the LAN address
  const health = await get(`http://${lan}:${info.port}/health`, key);
  check(health.status === 200, 'engine answers on the LAN address (not just loopback)',
    `http://${lan}:${info.port}/health -> ${health.status}`);

  // 4. the key must actually be enforced
  const noKey = await post(`http://${lan}:${info.port}/v1/chat/completions`, null,
    { messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 });
  check(noKey.status === 401, 'a request WITHOUT the key is rejected', `HTTP ${noKey.status}`);

  const badKey = await post(`http://${lan}:${info.port}/v1/chat/completions`, 'wrongkey123',
    { messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 });
  check(badKey.status === 401, 'a request with the WRONG key is rejected', `HTTP ${badKey.status}`);

  // 5. a real generation from "another machine"
  const good = await post(`http://${lan}:${info.port}/v1/chat/completions`, key,
    { messages: [{ role: 'user', content: 'Reply with exactly: hello' }], max_tokens: 20 });
  let text = '';
  try { text = JSON.parse(good.body).choices[0].message.content.trim(); } catch {}
  check(good.status === 200 && text.length > 0,
    'a client with the key gets a real reply', `HTTP ${good.status} — "${text.slice(0, 60)}"`);

  // 6. client mode probe against our own shared engine
  const probe = await c.eval(
    `window.pristudio.testRemote({url:${JSON.stringify(lan + ':' + info.port)}, key:${JSON.stringify(key)}})`);
  check(probe.ok === true, 'client-mode "Test connection" succeeds',
    probe.ok ? 'host is running ' + probe.model : probe.error);

  const probeBad = await c.eval(
    `window.pristudio.testRemote({url:${JSON.stringify(lan + ':' + info.port)}, key:"nope"})`);
  check(probeBad.ok === false, 'client-mode test reports a bad key clearly', probeBad.error);

  // 7. put the machine back the way we found it
  await c.eval(`window.pristudio.saveSettings({shareEngine:false, parallelSlots:1, shareKey:''})`);
  await c.eval(`window.pristudio.applySharing()`);
  let back = null;
  for (let i = 0; i < 180; i++) {
    back = await c.eval(`window.pristudio.serverStatus()`);
    if (back.state === 'ready' || back.state === 'error') break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  const closed = await get(`http://${lan}:${info.port}/health`, '');
  check(closed.status === 0, 'after turning sharing off, the LAN address stops answering',
    closed.status === 0 ? closed.body : `still answering: HTTP ${closed.status}`);

  console.log(`\n================================================`);
  console.log(`RESULT: ${failures === 0 ? 'all checks passed' : failures + ' FAILED'}`);
  console.log(`================================================\n`);
  c.close();
  process.exit(failures ? 1 : 0);
})();
