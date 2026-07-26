# Portico (née PriStudio) — Build Prompt (the single source of truth for this project)

Build a Windows desktop app (.exe) for chatting with locally-run language models,
like LM Studio, with a UI styled after the **Claude desktop app in dark mode**.
100% local: no telemetry, no cloud — the only network use is downloading models
from Hugging Face when the user asks.

## Tech stack (chosen for speed of build + small failure surface)

- **Electron** — desktop shell, packaged with **electron-builder** into an NSIS installer .exe.
- **Renderer: plain HTML/CSS/JS** — no React, no bundler, no build step. Faster to build, easier to debug.
- **Inference: `llama-server.exe` from llama.cpp (Vulkan build)** — bundled with the app.
  Vulkan runs on both the NVIDIA dGPU and AMD iGPU, needs no CUDA runtime, one zip.
- **Main process (Node)** owns: spawning/killing llama-server, model file management,
  Hugging Face downloads with progress, settings + chat persistence (JSON files in `userData`).

## Architecture

```
[Electron main] ──spawn──> llama-server.exe --model <gguf> --port 8033 -ngl 99 -c 8192
[Renderer UI]  ──fetch──> http://127.0.0.1:8033/v1/chat/completions  (stream: true, SSE)
[IPC bridge]   list/load/unload models · download model · server status · settings · chats
```

- Streaming tokens render as they arrive; a Stop button aborts the fetch.
- If llama-server crashes: show a banner, offer one-click relaunch, suggest smaller
  model/context if it looks like out-of-memory.

## UI — Claude app, dark

**Palette:** background `#262624` · sidebar `#1f1e1d` · raised surface `#30302e` ·
text `#faf9f5` · muted text `#b0aea2` · borders `#3a3a37` · accent (buttons, highlights) `#d97757`.

**Type:** serif (Georgia stack) for the empty-state greeting and headings; clean
sans (system stack) for everything else.

**Layout — three zones:**

1. **Left sidebar** (collapsible): "New chat" button, search box, conversation list
   grouped by date (Today / Yesterday / Previous 7 days…), hover shows rename/delete.
   Bottom: model status pill (name + loaded/idle dot) and a settings gear.
2. **Main chat**: empty state shows a serif greeting ("What's on your mind?") with the
   composer centered; in a conversation, user messages sit in rounded bubbles on a
   raised surface, assistant replies are plain text on the background, rendered as
   **markdown with syntax-highlighted code blocks + copy button**. Composer is a
   rounded box with model picker, send, and stop-while-generating.
3. **Right panel** (toggleable): generation settings — system prompt, temperature,
   top_p, max tokens, context size, GPU layers. Per-chat overrides of global defaults.

Custom dark title bar (Windows titleBarOverlay) so the whole window is dark.

## Features (v1, in build order)

- **M1** Scaffold + dark window + full UI shell with mock data.
- **M2** Spawn llama-server, real chat with streaming, stop + regenerate + copy.
- **M3** Conversations: persist to disk, rename, delete, search, auto-title from first message.
- **M4** Model manager: scan models folder for `.gguf` (show size/quant), load/unload,
  curated download list with progress bar + cancel + resume-safe temp files.
- **M5** Settings panel wired for real; error handling polish.
- **M6** Package with electron-builder → installer .exe; install and verify the installed copy.

## Curated starter models (fit 4 GB VRAM + 16 GB RAM)

| Model | Size | Good at |
|---|---|---|
| Llama 3.2 3B Instruct Q4_K_M | ~2.0 GB | fast general chat |
| Qwen 2.5 7B Instruct Q4_K_M | ~4.7 GB | smarter, still usable speed |
| Phi-3.5 Mini Instruct Q4_K_M | ~2.4 GB | reasoning, small |

## Efficiency rules

- Stream everything; never block the UI thread (all file/network work in main process).
- Default `-ngl 99` (offload all layers that fit to GPU), context 4096, `--parallel 1`
  (single chat slot = 4x less KV-cache VRAM). Measured on the RTX 3050 Ti: 60.9 tok/s
  with these flags vs 8.8 tok/s when llama.cpp splits across the iGPU / overfills VRAM.
- Pin inference to the discrete GPU (`--device VulkanN`), auto-detected at startup.
- Load a model once and keep the server warm between messages in the same chat.
- Persist chats as small per-conversation JSON files, written debounced, not on every token.

## Verification (definition of done per milestone)

Launch the app after each milestone and exercise the new feature for real —
send a message and watch it stream, kill the server process and watch recovery,
run the final installer on a clean path and chat from the installed copy.
