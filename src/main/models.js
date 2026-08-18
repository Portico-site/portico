const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
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
    sha256: '432f310a77f4650a88d0fd59ecdd7cebed8d684bafea53cbff0473542964f0c3',
    sizeGB: 1.3,
    desc: 'Tiny and very fast. Good for quick questions on any machine.',
  },
  {
    id: 'llama-3.2-3b',
    name: 'Llama 3.2 3B Instruct',
    cat: 'Fast & light',
    file: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    sha256: '6c1a2b41161032677be168d354123594c0e6e67d2b9227c84f296ad037c728ff',
    sizeGB: 2.0,
    desc: 'Great balance of speed and quality for everyday chat.',
  },
  {
    id: 'phi-3.5-mini',
    name: 'Phi 3.5 Mini Instruct',
    cat: 'Fast & light',
    file: 'Phi-3.5-mini-instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Phi-3.5-mini-instruct-GGUF/resolve/main/Phi-3.5-mini-instruct-Q4_K_M.gguf',
    sha256: 'e4165e3a71af97f1b4820da61079826d8752a2088e313af0c7d346796c38eff5',
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
    sha256: '65b8fcd92af6b4fefa935c625d1ac27ea29dcb6ee14589c55a8f115ceaaa1423',
    sizeGB: 4.7,
    desc: 'Noticeably smarter than the small ones. ~5 GB free RAM/VRAM.',
  },
  {
    id: 'llama-3.1-8b',
    name: 'Llama 3.1 8B Instruct',
    cat: 'Everyday chat',
    file: 'Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf',
    sha256: '7b064f5842bf9532c91456deda288a1b672397a54fa729aa665952863033557c',
    sizeGB: 4.9,
    desc: 'Meta’s classic all-rounder, supports up to 128K context. ~6 GB.',
  },
  {
    id: 'qwen3-8b',
    name: 'Qwen3 8B',
    cat: 'Everyday chat',
    file: 'Qwen3-8B-Q4_K_M.gguf',
    url: 'https://huggingface.co/Qwen/Qwen3-8B-GGUF/resolve/main/Qwen3-8B-Q4_K_M.gguf',
    sha256: 'd98cdcbd03e17ce47681435b5150e34c1417f50b5c0019dd560e4882c5745785',
    sizeGB: 5.0,
    desc: 'Newer Qwen generation; thinks step-by-step before hard answers. ~6 GB.',
  },
  {
    id: 'gemma-2-9b',
    name: 'Gemma 2 9B It',
    cat: 'Everyday chat',
    file: 'gemma-2-9b-it-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/gemma-2-9b-it-GGUF/resolve/main/gemma-2-9b-it-Q4_K_M.gguf',
    sha256: '13b2a7b4115bbd0900162edcebe476da1ba1fc24e718e8b40d32f6e300f56dfe',
    sizeGB: 5.8,
    desc: 'Google’s Gemma 2 — polished, natural writing style. ~7 GB.',
  },
  {
    id: 'mistral-nemo-12b',
    name: 'Mistral Nemo 12B Instruct',
    cat: 'Everyday chat',
    file: 'Mistral-Nemo-Instruct-2407-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Mistral-Nemo-Instruct-2407-GGUF/resolve/main/Mistral-Nemo-Instruct-2407-Q4_K_M.gguf',
    sha256: '7c1a10d202d8788dbe5628dc962254d10654c853cae6aaeca0618f05490d4a46',
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
    sha256: '731ece8d06dc7eda6f6572997feb9ee1258db0784827e642909d9b565641937b',
    sizeGB: 4.7,
    desc: 'Shows its step-by-step thinking before answering. Strong at math and logic. ~6 GB.',
  },
  {
    id: 'deepseek-r1-14b',
    name: 'DeepSeek R1 Distill Qwen 14B',
    cat: 'Reasoning (DeepSeek)',
    file: 'DeepSeek-R1-Distill-Qwen-14B-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/DeepSeek-R1-Distill-Qwen-14B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-14B-Q4_K_M.gguf',
    sha256: '0b319bd0572f2730bfe11cc751defe82045fad5085b4e60591ac2cd2d9633181',
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
    sha256: '1664fccab734674a50763490a8c6931b70e3f2f8ec10031b54806d30e5f956b6',
    sizeGB: 4.7,
    desc: 'Specialised for programming help and code generation. ~6 GB.',
  },
  {
    id: 'qwen-2.5-coder-14b',
    name: 'Qwen 2.5 Coder 14B',
    cat: 'Coding',
    file: 'Qwen2.5-Coder-14B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Qwen2.5-Coder-14B-Instruct-GGUF/resolve/main/Qwen2.5-Coder-14B-Instruct-Q4_K_M.gguf',
    sha256: '2946d28c9e1bb2bcae6d42e8678863a31775df6f740315c7d7e6d6b6411f5937',
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
    sha256: '7e03cee8c65b9ebf9ca14ddb010aca27b6b18e6c70f2779e94e7451d9529c091',
    sizeGB: 4.7,
    desc: 'Tuned purely for math — step-by-step problem solving and proofs. ~6 GB.',
  },
  {
    id: 'aya-23-8b',
    name: 'Aya 23 8B',
    cat: 'Specialists',
    file: 'aya-23-8B-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/aya-23-8B-GGUF/resolve/main/aya-23-8B-Q4_K_M.gguf',
    sha256: '21b3aa3abf067f78f6fe08deb80660cc4ee8ad7b4ab873a98d87761f9f858b0f',
    sizeGB: 5.1,
    desc: 'Cohere’s multilingual specialist — excellent Spanish + 22 other languages. ~6 GB.',
  },
  {
    id: 'hermes-3-8b',
    name: 'Hermes 3 Llama 3.1 8B',
    cat: 'Specialists',
    file: 'Hermes-3-Llama-3.1-8B.Q4_K_M.gguf',
    url: 'https://huggingface.co/NousResearch/Hermes-3-Llama-3.1-8B-GGUF/resolve/main/Hermes-3-Llama-3.1-8B.Q4_K_M.gguf',
    sha256: 'd4403ce5a6e930f4c2509456388c20d633a15ff08dd52ef3b142ff1810ec3553',
    sizeGB: 4.9,
    desc: 'Neutral, highly steerable assistant — great at following complex instructions and personas. ~6 GB.',
  },

  // ---------- Mixture of Experts ----------
  // These hold many "expert" sub-networks but only run two of them per word. That
  // buys the speed of a small model at the memory cost of a large one — so the size
  // below is what must fit in RAM, while the speed feels like the "active" figure.
  // Every URL and size here was checked against the file itself.
  {
    id: 'granite-3.1-moe',
    name: 'Granite 3.1 MoE (3B, 800M active)',
    cat: 'Mixture of Experts',
    file: 'granite-3.1-3b-a800m-instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/granite-3.1-3b-a800m-instruct-GGUF/resolve/main/granite-3.1-3b-a800m-instruct-Q4_K_M.gguf',
    sha256: '48e0edcd578fd4462f26127f04c651d0e650741110185297741089aea01a82b3',
    sizeGB: 1.9,
    desc: 'IBM’s tiny mixture-of-experts. Only 800M of its 3B run per word, so it is very quick even on a laptop with no graphics card. ~2 GB.',
  },
  {
    id: 'olmoe-1b-7b',
    name: 'OLMoE (7B, 1B active)',
    cat: 'Mixture of Experts',
    file: 'olmoe-1b-7b-0924-instruct-q4_k_m.gguf',
    url: 'https://huggingface.co/allenai/OLMoE-1B-7B-0924-Instruct-GGUF/resolve/main/olmoe-1b-7b-0924-instruct-q4_k_m.gguf',
    sha256: '8c310f1435a1222338fd2d3d974975be9cd908180b644bab0c2a94da1ac32f3f',
    sizeGB: 3.9,
    desc: 'Fully open model from Allen AI. Reads like a 7B, runs at roughly 1B speed. ~4 GB.',
  },
  {
    id: 'deepseek-v2-lite',
    name: 'DeepSeek V2 Lite (16B, 2.4B active)',
    cat: 'Mixture of Experts',
    file: 'DeepSeek-V2-Lite-Chat-Q4_K_M.gguf',
    url: 'https://huggingface.co/second-state/DeepSeek-V2-Lite-Chat-GGUF/resolve/main/DeepSeek-V2-Lite-Chat-Q4_K_M.gguf',
    sha256: '30b4fb4ab1fbe1c6a827303ea898296c9faf8f54d6cdf8b9fbdda7a7ebfb292a',
    sizeGB: 9.7,
    desc: '16B of knowledge at about 2.4B speed. Needs ~11 GB of RAM free, but answers far faster than its size suggests.',
  },
  {
    id: 'deepseek-coder-v2-lite',
    name: 'DeepSeek Coder V2 Lite (16B, 2.4B active)',
    cat: 'Mixture of Experts',
    file: 'DeepSeek-Coder-V2-Lite-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/DeepSeek-Coder-V2-Lite-Instruct-GGUF/resolve/main/DeepSeek-Coder-V2-Lite-Instruct-Q4_K_M.gguf',
    sha256: '603bd3f8a0281d16571da7c08bd661ee17ff0d1be6fcbd1b42242da257ef0bb8',
    sizeGB: 9.7,
    desc: 'The same idea aimed at code — strong at many languages, and quick for its size. Needs ~11 GB of RAM free.',
  },
  {
    id: 'qwen3-30b-a3b',
    name: 'Qwen3 30B A3B (30B, 3B active)',
    cat: 'Mixture of Experts',
    file: 'Qwen3-30B-A3B-Q4_K_M.gguf',
    url: 'https://huggingface.co/Qwen/Qwen3-30B-A3B-GGUF/resolve/main/Qwen3-30B-A3B-Q4_K_M.gguf',
    sha256: '0d003f6662faee786ed5da3e31b29c978de5ae5d275c8794c606a7f3c01aa8f5',
    sizeGB: 17.3,
    desc: 'Only 3B of its 30B run per word, so it is quick — but all 30B must still fit in memory. Needs ~20 GB free (32 GB RAM PC).',
  },

  // ---------- For powerful PCs ----------
  {
    id: 'qwen3-14b',
    name: 'Qwen3 14B',
    cat: 'For powerful PCs',
    file: 'Qwen3-14B-Q4_K_M.gguf',
    url: 'https://huggingface.co/Qwen/Qwen3-14B-GGUF/resolve/main/Qwen3-14B-Q4_K_M.gguf',
    sha256: '500a8806e85ee9c83f3ae08420295592451379b4f8cf2d0f41c15dffeb6b81f0',
    sizeGB: 9.0,
    desc: 'Excellent quality-per-GB with thinking mode. Needs ~11 GB free RAM/VRAM.',
  },
  {
    id: 'gemma-2-27b',
    name: 'Gemma 2 27B It',
    cat: 'For powerful PCs',
    file: 'gemma-2-27b-it-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/gemma-2-27b-it-GGUF/resolve/main/gemma-2-27b-it-Q4_K_M.gguf',
    sha256: '503a87ab47c9e7fb27545ec8592b4dc4493538bd47b397ceb3197e10a0370d23',
    sizeGB: 16.7,
    desc: 'Google’s big Gemma — beautiful writing. Needs ~19 GB (32 GB RAM PC or big GPU).',
  },
  {
    id: 'qwen3-32b',
    name: 'Qwen3 32B',
    cat: 'For powerful PCs',
    file: 'Qwen3-32B-Q4_K_M.gguf',
    url: 'https://huggingface.co/Qwen/Qwen3-32B-GGUF/resolve/main/Qwen3-32B-Q4_K_M.gguf',
    sha256: 'efd971561896866f0e910cce52761ca77b1b138090c7f15fe284676d57d1f689',
    sizeGB: 19.8,
    desc: 'Near-flagship quality with thinking mode. Needs ~22 GB (32 GB RAM PC).',
  },
  {
    id: 'deepseek-r1-32b',
    name: 'DeepSeek R1 Distill Qwen 32B',
    cat: 'For powerful PCs',
    file: 'DeepSeek-R1-Distill-Qwen-32B-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/DeepSeek-R1-Distill-Qwen-32B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-32B-Q4_K_M.gguf',
    sha256: 'bed9b0f551f5b95bf9da5888a48f0f87c37ad6b72519c4cbd775f54ac0b9fc62',
    sizeGB: 19.9,
    desc: 'The strongest local reasoner here. Needs ~22 GB (32 GB RAM PC).',
  },
  {
    id: 'llama-3.3-70b',
    name: 'Llama 3.3 70B Instruct',
    cat: 'For powerful PCs',
    file: 'Llama-3.3-70B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Llama-3.3-70B-Instruct-GGUF/resolve/main/Llama-3.3-70B-Instruct-Q4_K_M.gguf',
    sha256: '32df3baccb556f9840059b2528b2dee4d3d516b24afdfb9d0c56ff5f63e3a664',
    sizeGB: 42.5,
    desc: 'Flagship-class open model. Only for 64 GB RAM machines or serious GPUs (~45 GB).',
  },
  // ---------- Vision (needs the matching projector below) ----------
  {
    id: 'qwen2.5-vl-3b',
    name: 'Qwen2.5-VL 3B (vision)',
    cat: 'Vision — can see images',
    file: 'Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/ggml-org/Qwen2.5-VL-3B-Instruct-GGUF/resolve/main/Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf',
    sha256: 'd02fe9b69ad8cadbbd228e387667af66612c44bed29ffc8eb1e7caf9ac486c12',
    sizeGB: 1.9,
    desc: 'Reads photos, screenshots, diagrams and handwriting. Download the projector below as well — both files are needed.',
  },
  {
    id: 'qwen2.5-vl-3b-mmproj',
    name: 'Qwen2.5-VL 3B — vision projector',
    cat: 'Vision — can see images',
    file: 'mmproj-Qwen2.5-VL-3B.gguf',
    url: 'https://huggingface.co/ggml-org/Qwen2.5-VL-3B-Instruct-GGUF/resolve/main/mmproj-Qwen2.5-VL-3B-Instruct-f16.gguf',
    sha256: 'b9160fe9d814d1fadf68395677468534778b39ac33c2e7561b7b218626e60d5e',
    sizeGB: 1.3,
    desc: 'The "eyes" for the model above. Portico pairs them automatically once both are here.',
  },
  {
    id: 'whisper-base',
    name: 'Whisper Base (speech to text)',
    cat: 'Vision — can see images',
    file: 'whisper/ggml-base.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
    sha256: '60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe',
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
    sha256: '879db523c30d3b9017143d56705015e15a2cb5628762c11d086fed9538abd7fd',
    sizeGB: 2.1,
    desc: 'Best all-round starting point for /image. Same size and speed as SD 1.5 but far better composition, lighting and people.',
  },
  {
    id: 'realistic-vision-6',
    name: 'Realistic Vision 6',
    cat: 'Image generation',
    file: 'realistic-vision-6.safetensors',
    url: 'https://huggingface.co/SG161222/Realistic_Vision_V6.0_B1_noVAE/resolve/main/Realistic_Vision_V6.0_NV_B1_fp16.safetensors',
    sha256: 'c48bfd159cd7a6507b128685e963c398fa72399cefafaf603781df50ce836cc7',
    sizeGB: 2.1,
    desc: 'Photographic realism — portraits, places, products. Same speed as SD 1.5.',
  },
  {
    id: 'sd-1-5',
    name: 'Stable Diffusion 1.5 (base)',
    cat: 'Image generation',
    file: 'sd-v1-5-fp16.safetensors',
    url: 'https://huggingface.co/Comfy-Org/stable-diffusion-v1-5-archive/resolve/main/v1-5-pruned-emaonly-fp16.safetensors',
    sha256: 'e9476a13728cd75d8279f6ec8bad753a66a1957ca375a1464dc63b37db6e3916',
    sizeGB: 2.1,
    desc: 'The original 2022 model. Works everywhere, but the finetunes above beat it at the same cost.',
  },
  {
    id: 'sdxl-turbo',
    name: 'SDXL Turbo',
    cat: 'Image generation',
    file: 'sdxl-turbo.safetensors',
    url: 'https://huggingface.co/stabilityai/sdxl-turbo/resolve/main/sd_xl_turbo_1.0_fp16.safetensors',
    sha256: 'e869ac7d6942cb327d68d5ed83a40447aadf20e0c3358d98b2cc9e270db0da26',
    sizeGB: 6.9,
    desc: 'SDXL quality in only 4 steps — the fast way into SDXL. Portico runs it at 4-bit to fit small GPUs.',
  },
  {
    id: 'juggernaut-xl-v9',
    name: 'Juggernaut XL v9',
    cat: 'Image generation',
    file: 'juggernaut-xl-v9.safetensors',
    url: 'https://huggingface.co/RunDiffusion/Juggernaut-XL-v9/resolve/main/Juggernaut-XL_v9_RunDiffusionPhoto_v2.safetensors',
    sha256: 'c9e3e68f89b8e38689e1097d4be4573cf308de4e3fd044c64ca697bdb4aa8bca',
    sizeGB: 7.1,
    desc: 'The heavyweight: a top photorealism SDXL finetune that runs the full 25–30 steps instead of Turbo’s 4. Best quality here, and by far the slowest — expect minutes per image on a 4 GB GPU.',
  },
  {
    id: 'sdxl-base',
    name: 'SDXL base 1.0',
    cat: 'Image generation',
    file: 'sdxl-base-1.0.safetensors',
    url: 'https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/main/sd_xl_base_1.0_0.9vae.safetensors',
    sha256: 'e6bb9ea85bbf7bf6478a7c6d18b71246f22e95d41bcdd80ed40aa212c33cfeff',
    sizeGB: 6.9,
    desc: 'The original full SDXL — 25–30 steps, stronger prompt following than Turbo. Slow on 4 GB cards.',
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

  /**
   * @param expectSha  the sha256 the catalogue pinned for this file, from the
   *   repository that publishes it. Downloading several gigabytes of weights and
   *   running them without checking what arrived is the one place this app took a
   *   file on trust. Entries without a pinned hash still download — the app says
   *   which ones those are rather than pretending everything was checked.
   */
  download(id, url, destPath, expectSha) {
    return new Promise((resolve, reject) => {
      // catalogue entries may sit in a subfolder (e.g. whisper/ggml-base.bin)
      try { fs.mkdirSync(path.dirname(destPath), { recursive: true }); } catch {}
      const partPath = destPath + '.part';
      let received = fs.existsSync(partPath) ? fs.statSync(partPath).size : 0;
      const startAt = received;
      const want = String(expectSha || '').toLowerCase();
      // hashed as it arrives, so a 40 GB model is not read a second time
      const hash = want ? crypto.createHash('sha256') : null;
      let fullPass = false;

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
          // Bytes already on disk never passed through the running hash, so a resumed
          // download is checked by reading the finished file once instead. Rare, and
          // simpler than juggling the read and the socket at the same time.
          if (hash && resuming && startAt > 0) fullPass = true;
          const total = (parseInt(res.headers['content-length'] || '0', 10) || 0) + (resuming ? startAt : 0);
          const stream = fs.createWriteStream(partPath, { flags: resuming ? 'a' : 'w' });
          const entry = this.active.get(id);
          entry.req = req;
          entry.stream = stream;

          let lastEmit = 0;
          let lastBytes = received;
          let lastTime = Date.now();
          res.on('data', (chunk) => {
            if (hash) hash.update(chunk);
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
              const settle = (got) => {
                // A file that is not what the catalogue says it is does not get to sit
                // on disk looking finished. It is deleted, so the next attempt starts
                // clean rather than resuming from bytes already known to be wrong.
                if (want && got !== want) {
                  try { fs.unlinkSync(partPath); } catch {}
                  this.active.delete(id);
                  const err = new Error(
                    'The downloaded file does not match the checksum published for it. '
                    + 'It has been deleted. This usually means the download was corrupted; '
                    + 'if it keeps happening, do not use the file.');
                  this.emit('progress', { id, error: err.message, checksum: 'failed' });
                  return reject(err);
                }
                try {
                  fs.renameSync(partPath, destPath);
                  this.active.delete(id);
                  this.emit('progress', {
                    id, received, total, speed: 0, done: true,
                    checksum: want ? 'ok' : 'none',
                  });
                  resolve(destPath);
                } catch (e) { fail(e); }
              };

              if (!hash) return settle(null);
              if (!fullPass) return settle(hash.digest('hex'));
              // resumed: hash what is actually on disk, start to end
              this.emit('progress', { id, received, total, speed: 0, verifying: true });
              const h2 = crypto.createHash('sha256');
              const rs = fs.createReadStream(partPath);
              rs.on('data', (c) => h2.update(c));
              rs.on('end', () => settle(h2.digest('hex')));
              rs.on('error', fail);
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
