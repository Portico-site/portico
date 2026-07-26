# Native engine binaries — per platform

Portico bundles three native engines. The **code is fully cross-platform**; what
differs per OS is the compiled binary. Drop the right files into the folders
below and `electron-builder` will bundle them into that platform's installer.

At runtime the packaged app always looks in `resourcesPath/llama`,
`resourcesPath/whisper`, and (downloaded) `userData/sd-engine`. The per-platform
`extraResources` in `package.json` copy the correct folder into place, so only
the binaries change — never the code.

| Platform / arch | llama.cpp folder | whisper folder |
|---|---|---|
| Windows x64 | `resources/llama/` (already filled) | `resources/whisper/Release/` (already filled) |
| macOS Apple Silicon | `resources/llama-mac-arm64/` | `resources/whisper-mac-arm64/` |
| macOS Intel | `resources/llama-mac-x64/` | `resources/whisper-mac-x64/` |
| Linux x64 | `resources/llama-linux-x64/` | `resources/whisper-linux-x64/` |

---

## 1. llama.cpp (chat — required)

Prebuilt binaries are published on every release:
https://github.com/ggml-org/llama.cpp/releases (tags look like `b4321`).

Download the matching asset, unzip it, and copy **`llama-server` plus every
shared library next to it** (`*.dylib` on macOS, `*.so` on Linux) into the
folder above. Flat layout — no subfolders.

| Platform | Release asset | GPU backend |
|---|---|---|
| macOS arm64 | `llama-<tag>-bin-macos-arm64.zip` | Metal (fast on Apple Silicon) |
| macOS x64 | `llama-<tag>-bin-macos-x64.zip` | CPU / Metal |
| Linux x64 | `llama-<tag>-bin-ubuntu-vulkan-x64.zip` | Vulkan (needs a Vulkan driver) |

> The Linux user needs a Vulkan driver installed (Mesa/NVIDIA). If you want a
> zero-dependency build, use `llama-<tag>-bin-ubuntu-x64.zip` (CPU only) instead.

## 2. whisper.cpp (voice — optional)

whisper.cpp does **not** ship prebuilt macOS/Linux binaries, so build it:

```bash
git clone https://github.com/ggerganov/whisper.cpp && cd whisper.cpp
cmake -B build && cmake --build build --config Release
# copy build/bin/whisper-cli  ->  resources/whisper-<platform>/
```

If the folder is left empty, voice input simply shows as "not installed" — the
rest of the app works normally.

## 3. stable-diffusion.cpp (image generation — optional)

No prebuilt macOS/Linux binaries exist, and auto-install is Windows-only. To
enable image generation on macOS/Linux, build it and drop the `sd-cli` binary in
the app's `userData/sd-engine/` folder:

```bash
git clone --recursive https://github.com/leejet/stable-diffusion.cpp && cd stable-diffusion.cpp
cmake -B build -DSD_METAL=ON     # macOS;  use -DSD_VULKAN=ON on Linux
cmake --build build --config Release
```

## Icons (optional but recommended)

- macOS: add `resources/icon.icns` and reference it in `build.mac.icon`.
- Linux: add `resources/icon.png` (512×512) and reference it in `build.linux.icon`.

Without them electron-builder falls back to the default Electron icon (a warning,
not an error).

## Building

```bash
npm run dist          # Windows installer (.exe)
npm run dist:mac      # macOS .dmg + .zip   (must run on macOS)
npm run dist:linux    # Linux AppImage + .deb (run on Linux, or Docker)
```

macOS `.dmg` can only be built on a Mac. Linux is best built on Linux or in a
container. See `.github/workflows/build.yml` for a CI matrix that builds all
three without owning the machines.

## macOS code signing (for distribution)

An unsigned mac build runs locally but Gatekeeper blocks it for other users.
To distribute you need an Apple Developer account ($99/yr), then set
`CSC_LINK` / `CSC_KEY_PASSWORD` and notarization creds. Because the llama
binaries aren't signed by us, the app also needs these entitlements:

- `com.apple.security.cs.allow-jit`
- `com.apple.security.cs.allow-unsigned-executable-memory`
- `com.apple.security.cs.disable-library-validation`
