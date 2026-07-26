const { spawn, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { EXE, IS_WIN } = require('./platform');

// Local image generation via stable-diffusion.cpp (same ggml/Vulkan family as llama.cpp).
// The engine is ~106 MB so it is downloaded on demand rather than bundled.

const ENGINE_URL = 'https://github.com/leejet/stable-diffusion.cpp/releases/download/master-782-b290693/sd-master-b290693-bin-win-vulkan-x64.zip';

// Measured on a 4 GB RTX 3050 Ti: fp16 weights overflow VRAM, q8_0 fits in ~1.7 GB
// and renders 512x512 / 20 steps in ~67 s. CPU-only took 355 s for the same image.
const DEFAULTS = { width: 512, height: 512, steps: 20, cfg: 7, sampler: 'euler_a', quant: 'q8_0' };

// Different families want very different settings: a Turbo/Lightning model at 20 steps
// and CFG 7 produces mush, while SD 1.5 at 4 steps produces noise.
function modelPreset(modelPath) {
  const n = String(modelPath || '').toLowerCase();
  const isTurbo = /turbo|lightning|lcm|hyper/.test(n);
  const isXL = /xl|sdxl/.test(n);
  return {
    steps: isTurbo ? 4 : 20,
    cfg: isTurbo ? 1.0 : 7.0,
    // SDXL is trained at 1024 but that is heavy on 4 GB, so meet in the middle
    size: isXL ? 768 : 512,
    // big models must be quantised harder to fit a small card
    quant: isXL ? 'q4_0' : 'q8_0',
    family: isTurbo ? 'turbo' : (isXL ? 'sdxl' : 'sd15'),
  };
}

function engineDir(isDev, appRoot, resourcesPath) {
  return isDev ? path.join(appRoot, 'resources', 'sd') : path.join(resourcesPath, 'sd');
}

function enginePath(dir) {
  return path.join(dir, 'sd-cli' + EXE);
}

function hasEngine(dir) {
  try { return fs.existsSync(enginePath(dir)); } catch { return false; }
}

// Image checkpoints are .safetensors; chat models are .gguf, so the split is clean.
function listImageModels(modelsDir) {
  try {
    return fs.readdirSync(modelsDir)
      .filter((f) => /\.safetensors$/i.test(f))
      .map((f) => {
        const full = path.join(modelsDir, f);
        const st = fs.statSync(full);
        return { name: f.replace(/\.safetensors$/i, ''), file: f, path: full, sizeBytes: st.size };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch { return []; }
}

function downloadEngine(destDir, onProgress) {
  return new Promise((resolve, reject) => {
    // The bundled ENGINE_URL is a Windows/Vulkan build, and unpacking below uses
    // PowerShell's Expand-Archive. stable-diffusion.cpp does not publish ready-made
    // macOS/Linux binaries, so on those platforms auto-install can't be offered —
    // but the rest of the code is portable: drop a compiled `sd-cli` (built from
    // github.com/leejet/stable-diffusion.cpp) into this folder and it will be used.
    if (!IS_WIN) {
      return reject(new Error(
        'Automatic image-engine install is Windows-only. On this platform, build ' +
        'stable-diffusion.cpp and place the `sd-cli` binary in:\n' + destDir));
    }
    fs.mkdirSync(destDir, { recursive: true });
    const zipPath = path.join(destDir, 'engine.zip');
    const file = fs.createWriteStream(zipPath);

    const get = (url, redirects = 0) => {
      if (redirects > 8) return reject(new Error('Too many redirects'));
      https.get(url, { headers: { 'User-Agent': 'Portico' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return get(new URL(res.headers.location, url).toString(), redirects + 1);
        }
        if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
        const total = parseInt(res.headers['content-length'] || '0', 10);
        let received = 0;
        let last = 0;
        res.on('data', (c) => {
          received += c.length;
          if (onProgress && Date.now() - last > 400) { last = Date.now(); onProgress({ received, total }); }
        });
        res.pipe(file);
        file.on('finish', () => file.close(() => {
          // Expand-Archive ships with Windows; avoids adding an unzip dependency
          execFile('powershell', ['-NoProfile', '-Command',
            `Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force`],
          (err) => {
            try { fs.unlinkSync(zipPath); } catch {}
            if (err) return reject(new Error('Could not unpack the engine: ' + err.message));
            if (!hasEngine(destDir)) return reject(new Error('Engine unpacked but sd-cli.exe is missing'));
            resolve(destDir);
          });
        }));
      }).on('error', reject);
    };
    get(ENGINE_URL);
  });
}

let current = null; // the running generation, so it can be cancelled

function generate(opts) {
  const {
    engineDir: dir, modelPath, prompt, negative = '', outPath,
    width = DEFAULTS.width, height = DEFAULTS.height, steps = DEFAULTS.steps,
    cfg = DEFAULTS.cfg, sampler = DEFAULTS.sampler, seed = -1,
    device = 'vulkan0', quant = DEFAULTS.quant, onProgress,
  } = opts;

  return new Promise((resolve, reject) => {
    if (!hasEngine(dir)) return reject(new Error('Image engine is not installed'));
    if (!modelPath || !fs.existsSync(modelPath)) return reject(new Error('Image model not found'));

    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    const args = [
      '-m', modelPath, '-p', String(prompt), '-o', outPath,
      '-W', String(width), '-H', String(height),
      '--steps', String(steps), '--cfg-scale', String(cfg),
      '--sampling-method', sampler, '--seed', String(seed),
      '--vae-tiling',          // keeps the VAE step inside 4 GB cards
      '--diffusion-fa',
    ];
    if (negative) args.push('-n', String(negative));
    if (quant && quant !== 'none') args.push('--type', quant);
    if (device && device !== 'auto') args.push('--backend', device);

    const proc = spawn(enginePath(dir), args, { windowsHide: true });
    current = proc;
    let log = '';
    const onData = (buf) => {
      const s = buf.toString();
      log += s;
      if (log.length > 40000) log = log.slice(-20000);
      // progress lines look like:  |=====>   | 7/20 - 2.50it/s
      const m = [...s.matchAll(/\|\s*(\d+)\/(\d+)\s*-/g)].pop();
      if (m && onProgress) onProgress({ step: +m[1], total: +m[2] });
    };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);
    proc.on('error', (e) => { current = null; reject(e); });
    proc.on('exit', (code) => {
      current = null;
      if (code === 0 && fs.existsSync(outPath)) return resolve({ path: outPath });
      if (/out of (device )?memory|ErrorOutOfDeviceMemory/i.test(log)) {
        return reject(new Error('Ran out of GPU memory. Try a smaller size, or unload the chat model first.'));
      }
      const err = (log.split('\n').filter((l) => /error/i.test(l)).pop() || '').trim();
      reject(new Error(err || `Image generation failed (code ${code})`));
    });
  });
}

function cancel() {
  if (current) { try { current.kill(); } catch {} current = null; return true; }
  return false;
}

module.exports = { engineDir, enginePath, hasEngine, listImageModels, downloadEngine, generate, cancel, modelPreset, DEFAULTS, ENGINE_URL };
