const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { EXE } = require('./platform');

// Speech-to-text with whisper.cpp. Runs on the CPU, entirely offline — the audio
// never leaves the machine, which is the whole point of doing it locally.

function whisperExe(dir) {
  // the Windows release zip nests binaries under Release/; packaged builds flatten it
  const flat = path.join(dir, 'whisper-cli' + EXE);
  const nested = path.join(dir, 'Release', 'whisper-cli' + EXE);
  if (fs.existsSync(flat)) return flat;
  if (fs.existsSync(nested)) return nested;
  return null;
}

function hasEngine(dir) {
  return !!whisperExe(dir);
}

function listModels(modelsDir) {
  const dir = path.join(modelsDir, 'whisper');
  try {
    return fs.readdirSync(dir)
      .filter((f) => /^ggml-.*\.bin$/i.test(f))
      .map((f) => {
        const full = path.join(dir, f);
        return { name: f.replace(/^ggml-|\.bin$/gi, ''), file: f, path: full, sizeBytes: fs.statSync(full).size };
      })
      .sort((a, b) => a.sizeBytes - b.sizeBytes);
  } catch { return []; }
}

// wavBytes: 16-bit PCM WAV, mono, 16 kHz (the renderer resamples before sending)
function transcribe({ engineDir, modelPath, wavBytes, language = 'auto', onProgress }) {
  return new Promise((resolve) => {
    const exe = whisperExe(engineDir);
    if (!exe) return resolve({ error: 'Speech engine is not installed.' });
    if (!modelPath || !fs.existsSync(modelPath)) return resolve({ error: 'No speech model found.' });

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'portico-stt-'));
    const wav = path.join(dir, 'input.wav');
    try { fs.writeFileSync(wav, Buffer.from(wavBytes)); } catch (e) { return resolve({ error: e.message }); }

    const args = ['-m', modelPath, '-f', wav, '-nt', '-np', '-t', String(Math.max(2, Math.min(os.cpus().length - 1, 8)))];
    if (language && language !== 'auto') args.push('-l', language);
    else args.push('-l', 'auto');

    const proc = spawn(exe, args, { windowsHide: true, cwd: dir });
    let out = '';
    let err = '';
    const timer = setTimeout(() => { try { proc.kill(); } catch {} }, 180000);
    proc.stdout.on('data', (b) => { out += b.toString(); if (onProgress) onProgress(out.trim().slice(-80)); });
    proc.stderr.on('data', (b) => { err += b.toString(); });
    proc.on('error', (e) => { clearTimeout(timer); resolve({ error: e.message }); });
    proc.on('exit', (code) => {
      clearTimeout(timer);
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
      if (code !== 0) {
        const line = err.split('\n').filter((l) => /error/i.test(l)).pop();
        return resolve({ error: line || `Transcription failed (code ${code})` });
      }
      // whisper prints one line per segment; blank audio yields [BLANK_AUDIO]
      const text = out.split('\n').map((l) => l.trim())
        .filter((l) => l && !/^\[.*\]$/.test(l))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      resolve({ text });
    });
  });
}

module.exports = { hasEngine, whisperExe, listModels, transcribe };
