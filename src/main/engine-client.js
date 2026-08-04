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

// Places an engine can live. The only ones that are not your own hardware are
// marked `offMachine`, because that changes what Portico is allowed to promise.
//
// Payment is deliberately NOT handled here. You buy credit on the provider's own
// site and paste the key it gives you — Portico never touches a wallet, a private
// key or a card. A chat client has no business holding those.
const PROVIDERS = {
  lan: {
    label: 'Another computer on my network',
    kind: 'llamacpp', base: '', needsModel: false, offMachine: false,
  },
  redpill: {
    label: 'RedPill — GPU inside a secure enclave',
    kind: 'openai', base: 'https://api.red-pill.ai/v1', needsModel: true, offMachine: true,
    attested: true, signup: 'https://red-pill.ai',
    note: 'Runs on H100/H200 hardware in confidential mode, and can prove it cryptographically.',
  },
  openrouter: {
    label: 'OpenRouter — many models, one key',
    kind: 'openai', base: 'https://openrouter.ai/api/v1', needsModel: true, offMachine: true,
    signup: 'https://openrouter.ai',
    note: 'A broker in front of many providers. Includes some enclave-backed models.',
  },
  custom: {
    label: 'Any other OpenAI-compatible service',
    kind: 'openai', base: '', needsModel: true, offMachine: true,
  },
};

function providerOf(settings) {
  return PROVIDERS[settings && settings.remoteProvider] || PROVIDERS.lan;
}

// Where the engine lives right now, given the user's settings.
function endpoint(settings) {
  if (settings.remoteMode) {
    const p = providerOf(settings);
    const base = normalizeUrl(settings.remoteUrl || p.base);
    if (base) {
      return {
        base, key: settings.remoteKey || '', remote: true,
        kind: p.kind, model: p.needsModel ? (settings.remoteModelName || '') : '',
        offMachine: !!p.offMachine,
      };
    }
  }
  return {
    base: `http://127.0.0.1:${settings.port}`, key: settings.shareKey || '',
    remote: false, kind: 'llamacpp', model: '', offMachine: false,
  };
}

// Two very different things end up here.
//
//   a colleague's machine   192.168.1.40:8033          -> http, add the engine port
//   a hosted provider       https://x.ai/api/v1        -> https, and the path MATTERS
//
// The path used to be discarded (URL.origin), which quietly sent every request to
// /v1/chat/completions at the domain root — a 404 for any provider that serves its
// API under a prefix. Local addresses keep the old behaviour exactly.
function normalizeUrl(raw, defaultPort = 8033) {
  let s = String(raw || '').trim().replace(/\/+$/, '');
  if (!s) return '';

  const hasScheme = /^https?:\/\//i.test(s);
  const bare = s.replace(/^https?:\/\//i, '');
  const host = bare.split('/')[0].split(':')[0];
  // an address on your own network, versus something on the internet
  const isLocal = /^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(host)
    || /\.local$/i.test(host);

  if (!hasScheme) s = (isLocal ? 'http://' : 'https://') + s;

  try {
    const u = new URL(s);
    // the engine port is only a sensible default for a machine on your network
    if (!u.port && u.protocol === 'http:' && isLocal) u.port = String(defaultPort);
    const path = u.pathname.replace(/\/+$/, '');
    return u.origin + (path === '/' ? '' : path);
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
//
// `kind` decides how to ask. llama.cpp has /health and /props; a hosted service has
// neither, and answers /models instead. Asking the wrong one reports a healthy
// endpoint as broken.
async function probe({ url, key, kind = 'llamacpp', model = '' }) {
  const base = normalizeUrl(url);
  if (!base) return { ok: false, error: 'That address does not look right.' };
  if (kind === 'openai') return probeOpenAI(base, key, model);
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
    // named apart from the `model` parameter, which is only meaningful for hosted
    // providers — llama.cpp reports whatever it happens to have loaded
    let loaded = null;
    let slots = null;
    try {
      const j = JSON.parse(p.body);
      if (j.model_path) loaded = String(j.model_path).split(/[\\/]/).pop();
      if (j.total_slots) slots = j.total_slots;
    } catch { /* the name is a nicety; a 200 already proved the key */ }
    return { ok: true, model: loaded, slots, base };
  } catch (e) {
    const msg = /ECONNREFUSED/.test(e.message) ? 'Nothing is answering at that address. Is Portico sharing on the host?'
      : /EHOSTUNREACH|ENETUNREACH/.test(e.message) ? 'That machine cannot be reached from this network.'
      : /ETIMEDOUT|Timed out/.test(e.message) ? 'The host did not answer in time.'
      : e.message;
    return { ok: false, error: msg };
  }
}

// A hosted, OpenAI-compatible service.
//
// Do NOT judge the key by /models. Measured against OpenRouter: that endpoint is
// public, and a deliberately invalid key still returned 200 with 338 models — the
// same trap as llama.cpp's unauthenticated /health. The only honest test is to send
// the request the app will actually send, so this asks for a single token. It costs
// a fraction of a cent and proves the address, the key and the model name at once.
async function probeOpenAI(base, key, model) {
  if (!key) return { ok: false, error: 'This service needs an API key. Create one on the provider’s site and paste it here.' };
  try {
    // 1. address + the list of names the user may type
    const r = await request(`${base}/models`, { key, timeout: 12000 });
    if (r.status === 404) {
      return { ok: false, error: 'No API found there. Check the address includes the version, e.g. /api/v1' };
    }
    if (r.status === 401 || r.status === 403) {
      return { ok: false, error: 'The provider rejected that API key.' };
    }
    if (r.status !== 200) return { ok: false, error: `The provider answered with HTTP ${r.status}.` };

    let models = [];
    try {
      models = (JSON.parse(r.body).data || []).map((m) => m.id).filter(Boolean);
    } catch { /* handled below */ }
    if (!models.length) {
      return { ok: false, error: 'That address answered, but served no model list. Check it ends with the API version, e.g. /api/v1' };
    }

    // 2. the key, for real — the smallest possible completion
    const pick = model && models.includes(model) ? model : models[0];
    const t = await request(`${base}/chat/completions`, {
      method: 'POST', key, timeout: 30000,
      body: { model: pick, messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 },
    });
    if (t.status === 401 || t.status === 403) {
      return { ok: false, error: 'The provider rejected that API key.' };
    }
    if (t.status === 402) {
      return { ok: false, error: 'The key works, but the account has no credit.' };
    }
    if (t.status === 404) {
      return { ok: false, error: `The key works, but "${pick}" is not a model this provider serves.` };
    }
    if (t.status !== 200) {
      let detail = '';
      try { detail = (JSON.parse(t.body).error || {}).message || ''; } catch {}
      return { ok: false, error: `The provider answered with HTTP ${t.status}${detail ? ': ' + detail.slice(0, 120) : ''}` };
    }

    return { ok: true, base, models, verified: true, model: `key works · ${models.length} models available` };
  } catch (e) {
    const msg = /ENOTFOUND/.test(e.message) ? 'That address does not resolve. Check the spelling.'
      : /ETIMEDOUT|Timed out/.test(e.message) ? 'The provider did not answer in time.'
      : /CERT|SSL|TLS/i.test(e.message) ? 'The secure connection could not be established.'
      : e.message;
    return { ok: false, error: msg };
  }
}

// Streams a chat completion, calling onChunk with each decoded SSE payload.
// Returns a handle with abort(), so the renderer's stop button still works.
function streamChat({ settings, payload, onChunk, onDone, onError }) {
  const { base, key, model } = endpoint(settings);
  // llama.cpp serves one model and ignores the field; a hosted provider requires it
  // and rejects the request outright without it.
  if (model) payload = { ...payload, model };
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

module.exports = {
  endpoint, normalizeUrl, localAddresses, probe, streamChat, PROVIDERS, providerOf,
};
