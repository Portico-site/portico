const http = require('http');
const https = require('https');
const os = require('os');
const { URL } = require('url');

// Talks to the chat engine — either the one this app started locally, or another
// machine's Portico on the network.
//
// Requests are made from the main process rather than the renderer for two reasons:
// the access key never enters the page, and the renderer's CSP can stay locked to
// loopback instead of being widened to allow arbitrary hosts.

// Where the engine lives right now, given the user's settings.
function endpoint(settings) {
  if (settings.remoteMode && settings.remoteUrl) {
    return { base: normalizeUrl(settings.remoteUrl), key: settings.remoteKey || '', remote: true };
  }
  return { base: `http://127.0.0.1:${settings.port}`, key: settings.shareKey || '', remote: false };
}

// People type "192.168.1.40:8033" or "192.168.1.40" — accept both and fill in the rest.
function normalizeUrl(raw, defaultPort = 8033) {
  let s = String(raw || '').trim().replace(/\/+$/, '');
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'http://' + s;
  try {
    const u = new URL(s);
    if (!u.port && u.protocol === 'http:') u.port = String(defaultPort);
    return u.origin;
  } catch { return ''; }
}

// LAN addresses this machine can be reached on, so a host can read one out to
// the people who need to connect. Skips loopback and virtual adapters.
function localAddresses() {
  const out = [];
  const ifaces = os.networkInterfaces();
  for (const [name, addrs] of Object.entries(ifaces)) {
    if (/^(vEthernet|VMware|VirtualBox|Loopback|Hyper-V|docker|br-|veth)/i.test(name)) continue;
    for (const a of addrs || []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      out.push({ iface: name, address: a.address });
    }
  }
  // physical LAN/Wi-Fi ranges first — those are the ones colleagues can actually reach
  out.sort((x, y) => {
    const rank = (ip) => (/^192\.168\./.test(ip) ? 0 : /^10\./.test(ip) ? 1 : /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ? 2 : 3);
    return rank(x.address) - rank(y.address);
  });
  return out;
}

function request(urlStr, { method = 'GET', key = '', body = null, timeout = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(urlStr); } catch { return reject(new Error('Bad address')); }
    const mod = u.protocol === 'https:' ? https : http;
    const headers = { 'Content-Type': 'application/json' };
    if (key) headers.Authorization = `Bearer ${key}`;
    const req = mod.request(u, { method, headers, timeout }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('Timed out')); });
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

// Is there a working engine at this address, and what is it serving?
// Used by the "Test connection" button and by client-mode status polling.
async function probe({ url, key }) {
  const base = normalizeUrl(url);
  if (!base) return { ok: false, error: 'That address does not look right.' };
  try {
    // Reachability first. /health is deliberately NOT behind the access key in
    // llama.cpp, so it proves the host is there but says nothing about the key.
    // It also answers 503 while a model is still loading.
    const health = await request(`${base}/health`, { timeout: 8000 });
    if (health.status === 503) {
      return { ok: false, error: 'The host is still loading its model. Try again in a moment.' };
    }
    if (health.status !== 200) {
      return { ok: false, error: `The host answered with HTTP ${health.status}.` };
    }
    // /props IS behind the key (unlike /health and /v1/models, which are public),
    // so this is what actually validates it — and it names the model too.
    const p = await request(`${base}/props`, { key, timeout: 8000 });
    if (p.status === 401 || p.status === 403) {
      return { ok: false, error: 'The host rejected the access key.' };
    }
    if (p.status !== 200) {
      return { ok: false, error: `The host answered with HTTP ${p.status}.` };
    }
    let model = null;
    let slots = null;
    try {
      const j = JSON.parse(p.body);
      if (j.model_path) model = String(j.model_path).split(/[\\/]/).pop();
      if (j.total_slots) slots = j.total_slots;
    } catch { /* the name is a nicety; a 200 already proved the key */ }
    return { ok: true, model, slots, base };
  } catch (e) {
    const msg = /ECONNREFUSED/.test(e.message) ? 'Nothing is answering at that address. Is Portico sharing on the host?'
      : /EHOSTUNREACH|ENETUNREACH/.test(e.message) ? 'That machine cannot be reached from this network.'
      : /ETIMEDOUT|Timed out/.test(e.message) ? 'The host did not answer in time.'
      : e.message;
    return { ok: false, error: msg };
  }
}

// Streams a chat completion, calling onChunk with each decoded SSE payload.
// Returns a handle with abort(), so the renderer's stop button still works.
function streamChat({ settings, payload, onChunk, onDone, onError }) {
  const { base, key } = endpoint(settings);
  let u;
  try { u = new URL(`${base}/v1/chat/completions`); } catch {
    onError(new Error('The engine address is not valid.')); return { abort() {} };
  }
  const mod = u.protocol === 'https:' ? https : http;
  const headers = { 'Content-Type': 'application/json' };
  if (key) headers.Authorization = `Bearer ${key}`;

  let aborted = false;
  const req = mod.request(u, { method: 'POST', headers }, (res) => {
    if (res.statusCode !== 200) {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        if (aborted) return;
        if (res.statusCode === 401 || res.statusCode === 403) {
          return onError(new Error('The host rejected the access key. Check it in Settings.'));
        }
        onError(new Error(`Engine returned HTTP ${res.statusCode}${body ? ': ' + body.slice(0, 200) : ''}`));
      });
      return;
    }
    res.setEncoding('utf8');
    let buf = '';
    res.on('data', (c) => {
      if (aborted) return;
      buf += c;
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith('data:')) continue;
        const p = t.slice(5).trim();
        if (p === '[DONE]') continue;
        onChunk(p);
      }
    });
    res.on('end', () => { if (!aborted) onDone(); });
    res.on('error', (e) => { if (!aborted) onError(e); });
  });

  req.on('error', (e) => {
    if (aborted) return;
    const msg = /ECONNREFUSED/.test(e.message)
      ? (settings.remoteMode
        ? 'Lost contact with the host machine. It may have stopped sharing.'
        : 'The local engine is not running.')
      : e.message;
    onError(new Error(msg));
  });

  req.write(JSON.stringify(payload));
  req.end();

  return {
    abort() {
      aborted = true;
      try { req.destroy(); } catch { /* already gone */ }
    },
  };
}

module.exports = { endpoint, normalizeUrl, localAddresses, probe, streamChat };
