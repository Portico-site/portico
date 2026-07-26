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

  async start({ modelPath, ctx = 8192, ngl = 99, device = 'auto', mmproj = null }) {
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

    const args = [
      '--model', modelPath,
      '--port', String(this.port),
      '--host', '127.0.0.1',
      '-c', String(ctx),
      // single chat slot: 4x less KV-cache VRAM than the default 4 slots
      '--parallel', '1',
    ];
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
    const ok = await this.waitHealthy(240000, myProc);
    if (token !== this.startSeq) return this.status(); // superseded while loading
    if (ok) {
      this.setState('ready');
    } else if (this.state !== 'error') {
      await this.stop();
      this.setState('error', 'Model failed to load (timed out). Try a smaller model or lower context size.');
    }
    return this.status();
  }

  waitHealthy(timeoutMs, proc) {
    const deadline = Date.now() + timeoutMs;
    return new Promise((resolve) => {
      const tick = () => {
        if (!this.proc || (proc && this.proc !== proc)) return resolve(false);
        if (Date.now() > deadline) return resolve(false);
        const req = http.get({ host: '127.0.0.1', port: this.port, path: '/health', timeout: 2000 }, (res) => {
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
