const { spawn, execFile } = require('child_process');
const { EventEmitter } = require('events');
const http = require('http');
const path = require('path');
const { EXE } = require('./platform');

// Manages the bundled llama-server.exe: device discovery, lifecycle, health.
class ServerManager extends EventEmitter {
  constructor({ binDir, port }) {
    super();
    this.binDir = binDir;
    this.port = port;
    this.proc = null;
    this.state = 'stopped'; // stopped | starting | ready | error
    this.modelPath = null;
    this.lastError = null;
    this.logTail = [];
    this.intentionalStop = false;
    this.startSeq = 0; // concurrent start() calls: only the latest may touch state
  }

  get exePath() {
    return path.join(this.binDir, 'llama-server' + EXE);
  }

  status() {
    return {
      state: this.state,
      modelPath: this.modelPath,
      port: this.port,
      error: this.lastError,
    };
  }

  setState(state, error = null) {
    this.state = state;
    this.lastError = error;
    this.emit('status', this.status());
  }

  listDevices() {
    return new Promise((resolve) => {
      execFile(this.exePath, ['--list-devices'], { timeout: 30000 }, (err, stdout) => {
        if (err) return resolve([]);
        const devices = [];
        for (const line of stdout.split('\n')) {
          const m = line.match(/^\s+(\w+):\s+(.+?)\s+\((\d+)\s+MiB,\s+(\d+)\s+MiB free\)/);
          if (m) devices.push({ id: m[1], name: m[2], totalMiB: +m[3], freeMiB: +m[4] });
        }
        resolve(devices);
      });
    });
  }

  // Which device to run on.
  //
  // A measured result always wins. Assuming the discrete card is fastest is wrong
  // often enough to matter: on a laptop whose dGPU has been powered down by the
  // graphics driver, the integrated GPU measured 15.1 tok/s against the "better"
  // discrete card's 3.4 — and the old rule picked the slow one every time.
  // Without a measurement we still guess discrete-first, but it is only a guess.
  pickDevice(devices, measured = null) {
    if (!devices.length) return null;
    if (measured && devices.some((d) => d.id === measured)) return measured;

    const discrete = /geforce|rtx|gtx|quadro|radeon rx|arc a|arc b/i;
    const integrated = /\(tm\) graphics|iris|uhd|hd graphics|vega \d+ graphics/i;
    const score = (d) => {
      let s = d.freeMiB;
      if (discrete.test(d.name)) s += 1000000;
      if (integrated.test(d.name)) s -= 1000000;
      return s;
    };
    return devices.slice().sort((a, b) => score(b) - score(a))[0].id;
  }

  // Is this reply real text, or is the backend producing rubbish?
  // Deliberately crude and model-agnostic: a broken device gives back one character
  // over and over, or a wall of replacement characters, and both are easy to spot
  // without assuming anything about what the model was going to say.
  static looksCoherent(s) {
    const t = String(s || '').trim();
    if (t.length < 4) return false;
    const printable = (t.match(/[\x20-\x7E]/g) || []).length / t.length;
    if (printable < 0.7) return false;                 // mostly not plain text
    const counts = Object.create(null);
    for (const ch of t) counts[ch] = (counts[ch] || 0) + 1;
    const topShare = Math.max(...Object.values(counts)) / t.length;
    if (topShare > 0.5) return false;                  // one character dominates
    // real words, or a plain list of numbers — the timing prompt asks the model to
    // count, so a correct reply legitimately contains no letters at all
    return /[a-z]{2,}/i.test(t) || /\d+\s*,\s*\d+\s*,\s*\d+/.test(t);
  }

  // Times a short generation on each device so the choice rests on evidence.
  // Runs its own server instances on a spare port and leaves the live one alone;
  // onProgress reports which device is being measured.
  async benchmarkDevices({ modelPath, ctx = 2048, onProgress = null }) {
    const devices = await this.listDevices();
    if (!devices.length) return { devices: [], best: null, error: 'No graphics devices were found.' };

    const port = this.port + 977;   // well clear of the live engine
    const results = [];

    for (const dev of devices) {
      if (onProgress) onProgress({ id: dev.id, name: dev.name, state: 'testing' });
      const r = await this.timeDevice({ modelPath, ctx, device: dev.id, port });
      results.push({ id: dev.id, name: dev.name, ...r });
      if (onProgress) onProgress({ id: dev.id, name: dev.name, state: 'done', ...r });
    }

    const ok = results.filter((r) => r.tps > 0);
    const best = ok.length ? ok.slice().sort((a, b) => b.tps - a.tps)[0].id : null;
    return { devices: results, best };
  }

  timeDevice({ modelPath, ctx, device, port }) {
    return new Promise((resolve) => {
      // No -ngl: let llama.cpp fit what it can, exactly as a normal start does.
      // Forcing all layers would make a small card fail outright on a big model,
      // when in practice it would partially offload and still be usable — the test
      // has to measure the configuration the app actually runs.
      const args = [
        '--model', modelPath, '--port', String(port), '--host', '127.0.0.1',
        '-c', String(ctx), '--parallel', '1', '--device', device,
      ];
      const proc = spawn(this.exePath, args, { windowsHide: true });
      let log = '';
      const grab = (b) => { log += b.toString(); if (log.length > 20000) log = log.slice(-10000); };
      proc.stdout.on('data', grab);
      proc.stderr.on('data', grab);

      let settled = false;
      const done = (out) => {
        if (settled) return;
        settled = true;
        try { proc.kill(); } catch {}
        setTimeout(() => resolve(out), 600);   // let the port close before the next one
      };
      // a device that cannot host the model is a legitimate result, not a failure
      const giveUp = setTimeout(() => done({ tps: 0, error: 'Timed out loading the model.' }), 180000);
      proc.on('exit', () => {
        if (settled) return;
        clearTimeout(giveUp);
        const hint = /out of memory|failed to allocate/i.test(log) ? 'Not enough memory on this device.' : 'The engine stopped.';
        done({ tps: 0, error: hint });
      });

      const waitThenTime = async () => {
        for (let i = 0; i < 180; i++) {
          if (settled) return;
          const up = await new Promise((res) => {
            const r = http.get({ host: '127.0.0.1', port, path: '/health', timeout: 2000 }, (x) => { x.resume(); res(x.statusCode === 200); });
            r.on('error', () => res(false));
            r.on('timeout', () => { r.destroy(); res(false); });
          });
          if (up) break;
          await new Promise((r) => setTimeout(r, 1000));
        }
        if (settled) return;
        const ask = (maxTokens) => new Promise((res) => {
          const body = JSON.stringify({
            messages: [{ role: 'user', content: 'Count from 1 to 60, separated by commas.' }],
            max_tokens: maxTokens, temperature: 0,
          });
          const req = http.request({ host: '127.0.0.1', port, path: '/v1/chat/completions', method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: 120000 },
          (x) => { let s = ''; x.on('data', (c) => { s += c; }); x.on('end', () => { try { res(JSON.parse(s)); } catch { res(null); } }); });
          req.on('error', () => res(null));
          req.on('timeout', () => { req.destroy(); res(null); });
          req.write(body); req.end();
        });
        await ask(8);                       // warm up; the first call includes setup
        const t0 = Date.now();
        const r = await ask(100);
        const secs = (Date.now() - t0) / 1000;
        const n = (r && r.usage && r.usage.completion_tokens) || 0;
        const text = (r && r.choices && r.choices[0] && r.choices[0].message
          && r.choices[0].message.content || '').trim();
        clearTimeout(giveUp);

        if (!(n > 0 && secs > 0)) return done({ tps: 0, error: 'No reply from the engine.' });
        // Speed counts for nothing if the words are wrong. Some backends run fast
        // and emit nonsense — measured here on an integrated GPU that was twice as
        // quick as the discrete card and produced nothing but repeated characters.
        if (!ServerManager.looksCoherent(text)) {
          return done({ tps: 0, error: 'This device runs, but produces garbled text.' });
        }
        done({ tps: n / secs });
      };
      waitThenTime();
    });
  }

  // host: '127.0.0.1' keeps the engine private to this machine (the default).
  // '0.0.0.0' exposes it to the local network — only ever set alongside an apiKey.
  // parallel: how many chats can be served at once. Each slot carves its own slice
  // out of the KV cache, so raising it costs VRAM; 1 is right for a personal machine.
  async start({ modelPath, ctx = 8192, ngl = 99, device = 'auto', mmproj = null,
                host = '127.0.0.1', apiKey = '', parallel = 1, measuredDevice = null }) {
    const token = ++this.startSeq;
    await this.stop();
    if (token !== this.startSeq) return this.status(); // a newer start superseded us
    this.modelPath = modelPath;
    this.logTail = [];
    this.intentionalStop = false;
    this.setState('starting');

    let dev = device;
    if (dev === 'auto') {
      const devices = await this.listDevices();
      dev = this.pickDevice(devices, measuredDevice);
    }

    // Refuse to listen beyond loopback without a key — an open engine on a shared
    // network is a machine anyone can run arbitrary prompts on.
    const exposed = host && host !== '127.0.0.1' && host !== 'localhost';
    if (exposed && !apiKey) {
      this.setState('error', 'Refusing to share the engine without an access key.');
      return this.status();
    }

    const slots = Math.max(1, Math.min(16, Number(parallel) || 1));
    // llama.cpp splits -c across slots, so each chat would silently get ctx/slots.
    // Scale it up so every connected person gets the context size that was configured.
    const totalCtx = ctx * slots;
    const args = [
      '--model', modelPath,
      '--port', String(this.port),
      '--host', String(host),
      '-c', String(totalCtx),
      // one slot per concurrent chat; 1 uses 4x less KV-cache VRAM than the default 4
      '--parallel', String(slots),
    ];
    if (apiKey) args.push('--api-key', String(apiKey));
    // ngl >= 99 means "automatic": omit -ngl so llama.cpp fits as many layers as the
    // GPU's free VRAM allows. Forcing 99 crashes models whose weights+KV exceed VRAM.
    if (Number.isFinite(Number(ngl)) && Number(ngl) < 99) args.push('-ngl', String(ngl));
    if (dev) args.push('--device', dev);
    // vision models pair a .gguf with a projector; without it images are ignored
    if (mmproj) args.push('--mmproj', mmproj);

    this.proc = spawn(this.exePath, args, { windowsHide: true });
    const onLog = (buf) => {
      const text = buf.toString();
      this.logTail.push(text);
      if (this.logTail.length > 60) this.logTail.shift();
    };
    this.proc.stdout.on('data', onLog);
    this.proc.stderr.on('data', onLog);
    this.proc.on('exit', (code) => {
      this.proc = null;
      if (this.intentionalStop) return;
      const log = this.logTail.join('');
      let hint = '';
      if (/failed to allocate|kv cache|out of memory|OutOfMemory/i.test(log)) {
        hint = '\nLooks like it ran out of GPU/RAM memory — lower the context size in Settings, or use a smaller model.';
      }
      const tail = log.split('\n').filter((l) => /\sE\s|error/i.test(l)).slice(-4).join('\n');
      this.setState('error', `Engine stopped unexpectedly (code ${code}).${hint}\n${tail}`);
    });

    const myProc = this.proc;
    const ok = await this.waitHealthy(240000, myProc, apiKey);
    if (token !== this.startSeq) return this.status(); // superseded while loading
    if (ok) {
      this.setState('ready');
    } else if (this.state !== 'error') {
      await this.stop();
      this.setState('error', 'Model failed to load (timed out). Try a smaller model or lower context size.');
    }
    return this.status();
  }

  waitHealthy(timeoutMs, proc, apiKey = '') {
    const deadline = Date.now() + timeoutMs;
    // Always polled over loopback: even when the engine is bound to 0.0.0.0 for
    // sharing, it is still our own child process on this machine.
    const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
    return new Promise((resolve) => {
      const tick = () => {
        if (!this.proc || (proc && this.proc !== proc)) return resolve(false);
        if (Date.now() > deadline) return resolve(false);
        const req = http.get({ host: '127.0.0.1', port: this.port, path: '/health', headers, timeout: 2000 }, (res) => {
          res.resume();
          if (res.statusCode === 200) resolve(true);
          else setTimeout(tick, 700);
        });
        req.on('error', () => setTimeout(tick, 700));
        req.on('timeout', () => { req.destroy(); setTimeout(tick, 700); });
      };
      tick();
    });
  }

  stop() {
    return new Promise((resolve) => {
      if (!this.proc) {
        if (this.state !== 'error') this.setState('stopped');
        this.modelPath = null;
        return resolve();
      }
      this.intentionalStop = true;
      const p = this.proc;
      p.once('exit', () => {
        this.proc = null;
        this.modelPath = null;
        this.setState('stopped');
        resolve();
      });
      p.kill();
      setTimeout(() => { try { p.kill('SIGKILL'); } catch {} }, 3000);
    });
  }
}

module.exports = ServerManager;
