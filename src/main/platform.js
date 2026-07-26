const path = require('path');

// Cross-platform helpers for locating the bundled native engines.
//
// On Windows the engines are .exe; on macOS/Linux they have no extension.
// Packaged builds always copy the per-OS binaries into resourcesPath/<engine>
// (see the per-platform `extraResources` in package.json), so at runtime only
// the *filename* differs between platforms — the directory layout is the same.
//
// In dev (unpackaged) the binaries live under resources/. Windows keeps the
// original flat layout (resources/llama, resources/whisper); macOS/Linux use
// arch-suffixed sibling folders (resources/llama-mac-arm64, resources/llama-linux-x64…)
// so a checkout can hold all platforms' binaries side by side without clashing.

const IS_WIN = process.platform === 'win32';
const IS_MAC = process.platform === 'darwin';
const IS_LINUX = process.platform === 'linux';

// Appended to bare engine names to get the real executable filename.
const EXE = IS_WIN ? '.exe' : '';

// e.g. 'mac-arm64', 'linux-x64', 'win'
const PLATFORM_ARCH = IS_WIN ? 'win' : `${IS_MAC ? 'mac' : 'linux'}-${process.arch}`;

// Dev-mode resource directory for an engine ('llama' | 'whisper' | 'sd').
// Windows returns the original path unchanged; other platforms get the
// arch-suffixed sibling folder.
function devEngineDir(appRoot, name) {
  return IS_WIN
    ? path.join(appRoot, 'resources', name)
    : path.join(appRoot, 'resources', `${name}-${PLATFORM_ARCH}`);
}

module.exports = { IS_WIN, IS_MAC, IS_LINUX, EXE, PLATFORM_ARCH, devEngineDir };
