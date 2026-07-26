const fs = require('fs');
const path = require('path');
const https = require('https');
const { EventEmitter } = require('events');

// Curated models — every URL verified ungated & direct-downloadable.
// Grouped by `cat`; the Discover tab renders them under these headers in order.
const CATALOG = [
  // ---------- Fast & light ----------
  {
    id: 'llama-3.2-1b',
    name: 'Llama 3.2 1B Instruct',
    cat: 'Fast & light',
    file: 'Llama-3.2-1B-Instruct-Q8_0.gguf',
    url: 'https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q8_0.gguf',
    sizeGB: 1.3,
    desc: 'Tiny and very fast. Good for quick questions on any machine.',
  },
  {
    id: 'llama-3.2-3b',
    name: 'Llama 3.2 3B Instruct',
    cat: 'Fast & light',
    file: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    sizeGB: 2.0,
    desc: 'Great balance of speed and quality for everyday chat.',
  },
  {
    id: 'phi-3.5-mini',
    name: 'Phi 3.5 Mini Instruct',
    cat: 'Fast & light',
    file: 'Phi-3.5-mini-instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Phi-3.5-mini-instruct-GGUF/resolve/main/Phi-3.5-mini-instruct-Q4_K_M.gguf',
    sizeGB: 2.4,
    desc: 'Small Microsoft model, strong at reasoning for its size.',
  },

  // ---------- Everyday chat ----------
  {
    id: 'qwen-2.5-7b',
    name: 'Qwen 2.5 7B Instruct',
    cat: 'Everyday chat',
    file: 'Qwen2.5-7B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Qwen2.5-7B-Instruct-GGUF/resolve/main/Qwen2.5-7B-Instruct-Q4_K_M.gguf',
    sizeGB: 4.7,
    desc: 'Noticeably smarter than the small ones. ~5 GB free RAM/VRAM.',
  },
  {
    id: 'llama-3.1-8b',
    name: 'Llama 3.1 8B Instruct',
    cat: 'Everyday chat',
    file: 'Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf',
    sizeGB: 4.9,
    desc: 'Meta’s classic all-rounder, supports up to 128K context. ~6 GB.',
  },
  {
    id: 'qwen3-8b',
    name: 'Qwen3 8B',
    cat: 'Everyday chat',
    file: 'Qwen3-8B-Q4_K_M.gguf',
    url: 'https://huggingface.co/Qwen/Qwen3-8B-GGUF/resolve/main/Qwen3-8B-Q4_K_M.gguf',
    sizeGB: 5.0,
    desc: 'Newer Qwen generation; thinks step-by-step before hard answers. ~6 GB.',
  },
  {
    id: 'gemma-2-9b',
    name: 'Gemma 2 9B It',
    cat: 'Everyday chat',
    file: 'gemma-2-9b-it-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/gemma-2-9b-it-GGUF/resolve/main/gemma-2-9b-it-Q4_K_M.gguf',
    sizeGB: 5.8,
    desc: 'Google’s Gemma 2 — polished, natural writing style. ~7 GB.',
  },
  {
    id: 'mistral-nemo-12b',
    name: 'Mistral Nemo 12B Instruct',
    cat: 'Everyday chat',
    file: 'Mistral-Nemo-Instruct-2407-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Mistral-Nemo-Instruct-2407-GGUF/resolve/main/Mistral-Nemo-Instruct-2407-Q4_K_M.gguf',
    sizeGB: 7.5,
    desc: 'Mistral × NVIDIA. 128K context — long documents and creative writing. ~9 GB.',
  },

  // ---------- Reasoning (DeepSeek) ----------
  {
    id: 'deepseek-r1-7b',
    name: 'DeepSeek R1 Distill Qwen 7B',
    cat: 'Reasoning (DeepSeek)',
    file: 'DeepSeek-R1-Distill-Qwen-7B-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/DeepSeek-R1-Distill-Qwen-7B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-7B-Q4_K_M.gguf',
    sizeGB: 4.7,
    desc: 'Shows its step-by-step thinking before answering. Strong at math and logic. ~6 GB.',
  },
  {
    id: 'deepseek-r1-14b',
    name: 'DeepSeek R1 Distill Qwen 14B',
    cat: 'Reasoning (DeepSeek)',
    file: 'DeepSeek-R1-Distill-Qwen-14B-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/DeepSeek-R1-Distill-Qwen-14B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-14B-Q4_K_M.gguf',
    sizeGB: 9.0,
    desc: 'Much stronger reasoning; worth it if you have ~11 GB free RAM/VRAM.',
  },

  // ---------- Coding ----------
  {
    id: 'qwen-2.5-coder-7b',
    name: 'Qwen 2.5 Coder 7B',
    cat: 'Coding',
    file: 'Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Qwen2.5-Coder-7B-Instruct-GGUF/resolve/main/Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf',
    sizeGB: 4.7,
    desc: 'Specialised for programming help and code generation. ~6 GB.',
  },
  {
    id: 'qwen-2.5-coder-14b',
    name: 'Qwen 2.5 Coder 14B',
    cat: 'Coding',
    file: 'Qwen2.5-Coder-14B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Qwen2.5-Coder-14B-Instruct-GGUF/resolve/main/Qwen2.5-Coder-14B-Instruct-Q4_K_M.gguf',
    sizeGB: 9.0,
    desc: 'The serious coding assistant — much better at real-world code. ~11 GB.',
  },

  // ---------- Specialists ----------
  {
    id: 'qwen-2.5-math-7b',
    name: 'Qwen 2.5 Math 7B',
    cat: 'Specialists',
    file: 'Qwen2.5-Math-7B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Qwen2.5-Math-7B-Instruct-GGUF/resolve/main/Qwen2.5-Math-7B-Instruct-Q4_K_M.gguf',
    sizeGB: 4.7,
    desc: 'Tuned purely for math — step-by-step problem solving and proofs. ~6 GB.',
  },
  {
    id: 'aya-23-8b',
    name: 'Aya 23 8B',
    cat: 'Specialists',
    file: 'aya-23-8B-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/aya-23-8B-GGUF/resolve/main/aya-23-8B-Q4_K_M.gguf',
    sizeGB: 5.1,
    desc: 'Cohere’s multilingual specialist — excellent Spanish + 22 other languages. ~6 GB.',
  },
  {
    id: 'hermes-3-8b',
    name: 'Hermes 3 Llama 3.1 8B',
    cat: 'Specialists',
    file: 'Hermes-3-Llama-3.1-8B.Q4_K_M.gguf',
    url: 'https://huggingface.co/NousResearch/Hermes-3-Llama-3.1-8B-GGUF/resolve/main/Hermes-3-Llama-3.1-8B.Q4_K_M.gguf',
    sizeGB: 4.9,
    desc: 'Neutral, highly steerable assistant — great at following complex instructions and personas. ~6 GB.',
  },

  // ---------- For powerful PCs ----------
  {
    id: 'qwen3-14b',
    name: 'Qwen3 14B',
    cat: 'For powerful PCs',
    file: 'Qwen3-14B-Q4_K_M.gguf',
    url: 'https://huggingface.co/Qwen/Qwen3-14B-GGUF/resolve/main/Qwen3-14B-Q4_K_M.gguf',
    sizeGB: 9.0,
    desc: 'Excellent quality-per-GB with thinking mode. Needs ~11 GB free RAM/VRAM.',
  },
  {
    id: 'gemma-2-27b',
    name: 'Gemma 2 27B It',
    cat: 'For powerful PCs',
    file: 'gemma-2-27b-it-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/gemma-2-27b-it-GGUF/resolve/main/gemma-2-27b-it-Q4_K_M.gguf',
    sizeGB: 16.7,
    desc: 'Google’s big Gemma — beautiful writing. Needs ~19 GB (32 GB RAM PC or big GPU).',
  },
  {
    id: 'qwen3-32b',
    name: 'Qwen3 32B',
    cat: 'For powerful PCs',
    file: 'Qwen3-32B-Q4_K_M.gguf',
    url: 'https://huggingface.co/Qwen/Qwen3-32B-GGUF/resolve/main/Qwen3-32B-Q4_K_M.gguf',
    sizeGB: 19.8,
    desc: 'Near-flagship quality with thinking mode. Needs ~22 GB (32 GB RAM PC).',
  },
  {
    id: 'deepseek-r1-32b',
    name: 'DeepSeek R1 Distill Qwen 32B',
    cat: 'For powerful PCs',
    file: 'DeepSeek-R1-Distill-Qwen-32B-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/DeepSeek-R1-Distill-Qwen-32B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-32B-Q4_K_M.gguf',
    sizeGB: 19.9,
    desc: 'The strongest local reasoner here. Needs ~22 GB (32 GB RAM PC).',
  },
  // ---------- Vision (needs the matching projector below) ----------
  {
    id: 'qwen2.5-vl-3b',
    name: 'Qwen2.5-VL 3B (vision)',
    cat: 'Vision — can see images',
    file: 'Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/ggml-org/Qwen2.5-VL-3B-Instruct-GGUF/resolve/main/Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf',
    sizeGB: 1.9,
    desc: 'Reads photos, screenshots, diagrams and handwriting. Download the projector below as well — both files are needed.',
  },
  {
    id: 'qwen2.5-vl-3b-mmproj',
    name: 'Qwen2.5-VL 3B — vision projector',
    cat: 'Vision — can see images',
    file: 'mmproj-Qwen2.5-VL-3B.gguf',
    url: 'https://huggingface.co/ggml-org/Qwen2.5-VL-3B-Instruct-GGUF/resolve/main/mmproj-Qwen2.5-VL-3B-Instruct-f16.gguf',
    sizeGB: 1.3,
    desc: 'The "eyes" for the model above. Portico pairs them automatically once both are here.',
  },
  {
    id: 'whisper-base',
    name: 'Whisper Base (speech to text)',
    cat: 'Vision — can see images',
    file: 'whisper/ggml-base.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
    sizeGB: 0.15,
    desc: 'Powers the microphone button. Understands ~99 languages including Spanish. Runs on the CPU.',
  },

  // ---------- Image generation ----------
  {
    id: 'dreamshaper-8',
    name: 'DreamShaper 8',
    cat: 'Image generation',
    file: 'dreamshaper-8.safetensors',
    url: 'https://huggingface.co/Lykon/DreamShaper/resolve/main/DreamShaper_8_pruned.safetensors',
    sizeGB: 2.1,
    desc: 'Best all-round starting point for /image. Same size and speed as SD 1.5 but far better composition, lighting and people.',
  },
  {
    id: 'realistic-vision-6',
    name: 'Realistic Vision 6',
    cat: 'Image generation',
    file: 'realistic-vision-6.safetensors',
    url: 'https://huggingface.co/SG161222/Realistic_Vision_V6.0_B1_noVAE/resolve/main/Realistic_Vision_V6.0_NV_B1_fp16.safetensors',
    sizeGB: 2.1,
    desc: 'Photographic realism — portraits, places, products. Same speed as SD 1.5.',
  },
  {
    id: 'sd-1-5',
    name: 'Stable Diffusion 1.5 (base)',
    cat: 'Image generation',
    file: 'sd-v1-5-fp16.safetensors',
    url: 'https://huggingface.co/Comfy-Org/stable-diffusion-v1-5-archive/resolve/main/v1-5-pruned-emaonly-fp16.safetensors',
    sizeGB: 2.1,
    desc: 'The original 2022 model. Works everywhere, but the finetunes above beat it at the same cost.',
  },
  {
    id: 'sdxl-turbo',
    name: 'SDXL Turbo',
    cat: 'Image generation',
    file: 'sdxl-turbo.safetensors',
    url: 'https://huggingface.co/stabilityai/sdxl-turbo/resolve/main/sd_xl_turbo_1.0_fp16.safetensors',
    sizeGB: 6.9,
    desc: 'SDXL quality in only 4 steps — the fast way into SDXL. Portico runs it at 4-bit to fit small GPUs.',
  },
  {
    id: 'juggernaut-xl-v9',
    name: 'Juggernaut XL v9',
    cat: 'Image generation',
    file: 'juggernaut-xl-v9.safetensors',
    url: 'https://huggingface.co/RunDiffusion/Juggernaut-XL-v9/resolve/main/Juggernaut-XL_v9_RunDiffusionPhoto_v2.safetensors',
    sizeGB: 7.1,
    desc: 'The heavyweight: a top photorealism SDXL finetune that runs the full 25–30 steps instead of Turbo’s 4. Best quality here, and by far the slowest — expect minutes per image on a 4 GB GPU.',
  },
  {
    id: 'sdxl-base',
    name: 'SDXL base 1.0',
    cat: 'Image generation',
    file: 'sdxl-base-1.0.safetensors',
    url: 'https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/main/sd_xl_base_1.0_0.9vae.safetensors',
    sizeGB: 6.9,
    desc: 'The original full SDXL — 25–30 steps, stronger prompt following than Turbo. Slow on 4 GB cards.',
  },

  {
    id: 'llama-3.3-70b',
    name: 'Llama 3.3 70B Instruct',
    cat: 'For powerful PCs',
    file: 'Llama-3.3-70B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Llama-3.3-70B-Instruct-GGUF/resolve/main/Llama-3.3-70B-Instruct-Q4_K_M.gguf',
    sizeGB: 42.5,
    desc: 'Flagship-class open model. Only for 64 GB RAM machines or serious GPUs (~45 GB).',
  },
];

// A chat model becomes a vision model when a matching mmproj-*.gguf sits beside it.
function findProjector(dir, modelFile) {
  let files;
  try { files = fs.readdirSync(dir); } catch { return null; }
  const projectors = files.filter((f) => /^mmproj.*\.gguf$/i.test(f));
  if (!projectors.length) return null;
  // Compare on alphanumerics only: "Qwen2.5-VL-3B-Instruct-Q4_K_M" vs
  // "mmproj-Qwen2.5-VL-3B" share "qwen25vl3b", which is the real signal.
  const norm = (s) => s.replace(/\.gguf$/i, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const model = norm(modelFile);
  const longestShared = (a, b) => {
    let best = 0;
    for (let i = 0; i < a.length; i++) {
      for (let j = i + best + 1; j <= a.length; j++) {
        if (b.includes(a.slice(i, j))) best = j - i; else break;
      }
    }
    return best;
  };
  let bestFile = null;
  let bestLen = 0;
  for (const p of projectors) {
    const len = longestShared(model, norm(p).replace(/^mmproj/, ''));
    if (len > bestLen) { bestLen = len; bestFile = p; }
  }
  // 8+ shared characters means it names the same model, not a coincidence
  return bestLen >= 8 ? path.join(dir, bestFile) : null;
}

function scanModels(dir) {
  try {
    return fs.readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith('.gguf'))
      .filter((f) => !/^mmproj/i.test(f))   // projectors are companions, not chat models
      .map((f) => {
        const full = path.join(dir, f);
        const stat = fs.statSync(full);
        const quant = (f.match(/\b(I?Q\d+[_A-Z0-9]*|F16|BF16|F32)\b/i) || [null])[0];
        const mmproj = findProjector(dir, f);
        return { name: f.replace(/\.gguf$/i, ''), file: f, path: full, sizeBytes: stat.size, quant, mmproj, vision: !!mmproj };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

// Downloads with redirect-following, progress events, cancel and resume support.
class Downloader extends EventEmitter {
  constructor() {
    super();
    this.active = new Map(); // id -> { req, stream, cancelled }
  }

  isActive(id) {
    return this.active.has(id);
  }

  cancel(id) {
    const d = this.active.get(id);
    if (d) {
      d.cancelled = true;
      try { d.req.destroy(); } catch {}
      try { d.stream.close(); } catch {}
    }
  }

  download(id, url, destPath) {
    return new Promise((resolve, reject) => {
      // catalogue entries may sit in a subfolder (e.g. whisper/ggml-base.bin)
      try { fs.mkdirSync(path.dirname(destPath), { recursive: true }); } catch {}
      const partPath = destPath + '.part';
      let received = fs.existsSync(partPath) ? fs.statSync(partPath).size : 0;
      const startAt = received;

      const doRequest = (reqUrl, redirects) => {
        if (redirects > 8) return fail(new Error('Too many redirects'));
        const headers = {};
        if (startAt > 0) headers.Range = `bytes=${startAt}-`;
        const req = https.get(reqUrl, { headers }, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume();
            return doRequest(new URL(res.headers.location, reqUrl).toString(), redirects + 1);
          }
          if (res.statusCode !== 200 && res.statusCode !== 206) {
            res.resume();
            return fail(new Error(`Download failed: HTTP ${res.statusCode}`));
          }
          const resuming = res.statusCode === 206;
          if (!resuming && startAt > 0) received = 0; // server ignored Range; start over
          const total = (parseInt(res.headers['content-length'] || '0', 10) || 0) + (resuming ? startAt : 0);
          const stream = fs.createWriteStream(partPath, { flags: resuming ? 'a' : 'w' });
          const entry = this.active.get(id);
          entry.req = req;
          entry.stream = stream;

          let lastEmit = 0;
          let lastBytes = received;
          let lastTime = Date.now();
          res.on('data', (chunk) => {
            received += chunk.length;
            const now = Date.now();
            if (now - lastEmit > 400) {
              const speed = (received - lastBytes) / ((now - lastTime) / 1000);
              lastBytes = received; lastTime = now; lastEmit = now;
              this.emit('progress', { id, received, total, speed });
            }
          });
          res.pipe(stream);
          stream.on('finish', () => {
            if (this.active.get(id)?.cancelled) return; // close() from cancel also fires finish
            stream.close(() => {
              try {
                fs.renameSync(partPath, destPath);
                this.active.delete(id);
                this.emit('progress', { id, received, total, speed: 0, done: true });
                resolve(destPath);
              } catch (e) { fail(e); }
            });
          });
          res.on('error', fail);
          stream.on('error', fail);
        });
        req.on('error', fail);
        const entry = this.active.get(id);
        entry.req = req;
      };

      const fail = (err) => {
        const d = this.active.get(id);
        this.active.delete(id);
        if (d?.cancelled) {
          this.emit('progress', { id, cancelled: true });
          resolve(null); // .part kept on disk for resume
        } else {
          this.emit('progress', { id, error: err.message });
          reject(err);
        }
      };

      this.active.set(id, { req: null, stream: null, cancelled: false });
      doRequest(url, 0);
    });
  }
}

module.exports = { CATALOG, scanModels, Downloader };
