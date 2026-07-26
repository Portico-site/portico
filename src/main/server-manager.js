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

  // Prefer a discrete GPU over integrated graphics, then most free VRAM.
  pickDevice(devices) {
    if (!devices.length) return null;
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

  // host: '127.0.0.1' keeps the engine private to this machine (the default).
  // '0.0.0.0' exposes it to the local network — only ever set alongside an apiKey.
  // parallel: how many chats can be served at once. Each slot carves its own slice
  // out of the KV cache, so raising it costs VRAM; 1 is right for a personal machine.
  async start({ modelPath, ctx = 8192, ngl = 99, device = 'auto', mmproj = null,
                host = '127.0.0.1', apiKey = '', parallel = 1 }) {
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
      dev = this.pickDevice(devices);
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
