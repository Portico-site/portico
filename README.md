# Portico

A desktop app for chatting with AI models that run **entirely on your own computer**.
Windows, macOS and Linux.
No account, no subscription, no cloud. Your conversations, files and audio never leave the
machine unless you explicitly switch web search on.

Think of it as a private alternative to ChatGPT or Claude, where you choose the model.

![Portico runs local language models with a Claude-style dark interface](resources/icon.png)

---

## What it can do

| | |
|---|---|
| 💬 **Chat** | Streaming replies, markdown, syntax-highlighted code, conversation history and search |
| 🧠 **Any GGUF model** | 20+ curated models in the built-in catalogue, from 1 GB to 42 GB, or drop in your own |
| 🌐 **Web search** | Optional. 12 sources — general web, news, coding, science, prediction markets, flights, shopping — each switchable |
| 📎 **Attachments** | Read PDFs, text, CSV and ~30 code formats |
| 👁️ **Vision** | Show it a photo, screenshot or diagram and ask about it |
| 🎙️ **Voice input** | Dictate messages; transcription runs locally via whisper.cpp |
| 🎨 **Image generation** | `/image a red bicycle` — Stable Diffusion running on your GPU |
| 📊 **Run Python** | Execute snippets from a reply and see matplotlib charts inline |
| 🧩 **Artifacts** | HTML and SVG replies render live in a sandboxed preview panel |
| 📁 **Projects** | Group chats with shared instructions and reference files |
| 🎭 **Assistants** | Save personas: instructions plus generation settings, reusable in any chat |

---

## Requirements

- **Windows 10 or 11** (64-bit), **macOS 11+**, or **Linux** (64-bit)
- **8 GB RAM minimum**, 16 GB comfortable
- A **GPU helps a lot** but is not required — Vulkan-capable on Windows/Linux
  (NVIDIA, AMD, Intel), Metal on Apple Silicon
- Disk space for models: **2 GB** gets you started, more if you collect them
- **Python 3** only if you want the "Run" button for code snippets

Everything else — the inference engine, the speech engine — ships with the app.

### Platform support

| | Chat | Web search, files, projects | Voice input | Image generation |
|---|---|---|---|---|
| **Windows** | ✅ | ✅ | ✅ | ✅ |
| **macOS** | ✅ | ✅ | build it yourself | build it yourself |
| **Linux** | ✅ | ✅ | build it yourself | build it yourself |

Windows is the most tested platform. On macOS and Linux the chat engine and the
whole interface work the same, but the voice and image engines don't publish
prebuilt binaries — see [resources/RESOURCES.md](resources/RESOURCES.md) to add
them. The app runs fine without them; those features just show as unavailable.

---

## Install

**Windows**

1. Download `Portico Setup <version>.exe` from the releases page.
2. Run it. Windows will warn about an **unknown publisher** because the app is not
   code-signed — click **More info → Run anyway**.

**macOS**

1. Download the `.dmg` (`arm64` for Apple Silicon, `x64` for Intel) and drag Portico
   to Applications.
2. The app is not notarized, so Gatekeeper blocks it on first open — **right-click
   the app → Open**, then confirm. You only do this once.

**Linux**

1. Download the `.AppImage`, then `chmod +x Portico-*.AppImage` and run it —
   or install the `.deb` with `sudo dpkg -i portico_*.deb`.
2. GPU acceleration needs a Vulkan driver (`mesa-vulkan-drivers` or the NVIDIA
   driver). Without one it falls back to CPU, which still works but is slower.

Then, on any platform: open **Models → Discover** and download a chat model.
*Llama 3.2 3B* (2 GB) is a good starting point; *Qwen 2.5 7B* if you have the RAM.

---

## Choosing a model

Bigger models are smarter and slower. On a 4 GB GPU:

| Model | Size | Speed | Use it for |
|---|---|---|---|
| Llama 3.2 3B | 2.0 GB | ~50 tok/s | everyday chat, fast answers |
| Phi 3.5 Mini | 2.4 GB | ~8 tok/s | reasoning in a small package |
| Qwen 2.5 7B | 4.7 GB | slower | noticeably better answers |
| Qwen 2.5 Coder 7B/14B | 4.7 / 9 GB | slower | programming help |
| DeepSeek R1 Distill | 4.7 / 9 GB | slow | step-by-step reasoning |
| Qwen2.5-VL 3B + projector | 1.9 + 1.3 GB | ~34 s per image | looking at images |

Speeds are what this app measured on an RTX 3050 Ti Laptop (4 GB). Your mileage varies.

**Small models make mistakes.** A 3B model will state wrong facts confidently. For anything
that matters, turn on web search and click the source links.

---

## Privacy

- Chats, settings, files and audio stay in `%APPDATA%\Portico`.
- The model runs locally; prompts are never uploaded.
- **Web search is the one exception**: when the globe toggle is on, your question is sent to
  a search engine. The footer turns amber to remind you, and it is off by default.
- Model downloads come from Hugging Face; that is the only other outbound traffic. Each one
  is checked against a SHA-256 the catalogue pins from that repository, and a file that does
  not match is deleted rather than kept.
- Diagnostics logs are written locally and never sent anywhere. **Settings → Open log folder.**

---

## Running Python safely

The ▶ Run button executes code **on your PC with your permissions** — unlike ChatGPT, which
uses a throwaway cloud sandbox. Portico therefore:

- never runs anything automatically,
- scans first and warns you if the code touches files, the network or the system,
- kills anything still running after 90 seconds.

That is defence in depth, not a real sandbox. **Read the code before you click Run**,
especially when the reply was influenced by web search results.

---

## Troubleshooting

**A model fails to load.** Usually not enough memory. Lower **Context size** in Settings, or
pick a smaller model. The error message will say if it ran out of GPU memory.

**Search returns nothing.** The free engines rate-limit. Open **Settings → Search engines →
Test engines** to see which are working right now, and untick the ones that are not.

**Image generation says out of memory.** Reduce the image size, or use an SD 1.5-class model
rather than SDXL.

**It forgot the earlier conversation.** Watch the *memory* meter next to the send button.
When it fills, the oldest messages are dropped. Raise **Context size** — at the cost of
speed and VRAM.

**Something crashed.** Settings → **Copy diagnostics**, then paste that into your bug report.

---

## Build from source

```bash
npm install
npm start          # run in development
npm run dist       # Windows installer  -> dist/
npm run dist:mac   # macOS .dmg + .zip   (must run on macOS)
npm run dist:linux # Linux AppImage + .deb
```

Checks that need nothing running:

```bash
npm run test:hardware   # settings derived across a sweep of imaginary machines
npm run test:thinking   # the live reasoning display
npm run test:downloads  # model checksums are enforced, including on resume
npm run pin-hashes      # refresh catalogue checksums from Hugging Face
```

The Windows installer is unsigned, so it opens with a SmartScreen warning.
[docs/SIGNING.md](docs/SIGNING.md) lists what fixes that, what each option costs,
and the two environment variables it takes once you have a certificate.

Each platform can only be built on itself — a `.dmg` in particular requires a Mac.
To build all three without owning the machines, use the included GitHub Actions
workflow (`.github/workflows/build.yml`): push the repo, open **Actions → build →
Run workflow**, and download the installers from the run's artifacts.

The native engine binaries are not in git (too large). CI downloads them per
platform; for local builds see [resources/RESOURCES.md](resources/RESOURCES.md).

Auto-update is wired but inactive until you publish. To enable it: set `build.publish.owner`
and `repo` in `package.json`, then attach the installer to a GitHub Release whose tag matches
the version.

---

## Built on

Portico is a shell around excellent open-source work:

- [llama.cpp](https://github.com/ggml-org/llama.cpp) — language model inference (MIT)
- [stable-diffusion.cpp](https://github.com/leejet/stable-diffusion.cpp) — image generation (MIT)
- [whisper.cpp](https://github.com/ggml-org/whisper.cpp) — speech to text (MIT)
- [Electron](https://electronjs.org) (MIT), [marked](https://marked.js.org) (MIT),
  [DOMPurify](https://github.com/cure53/DOMPurify) (Apache-2.0),
  [highlight.js](https://highlightjs.org) (BSD-3-Clause)

**Models carry their own licences**, which are not Portico's. Llama models follow Meta's
Llama Community License; Gemma has Google's terms; Qwen and most others are Apache-2.0;
Stable Diffusion uses the CreativeML OpenRAIL-M licence. Check the model's page on Hugging
Face before using its output commercially.

---

## Licence

MIT — see [LICENSE](LICENSE).
