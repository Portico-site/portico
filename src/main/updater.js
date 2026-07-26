const logger = require('./logger');

// Auto-update over GitHub Releases.
//
// This only does anything once the app is published somewhere: set `build.publish` in
// package.json to your repo and upload the installer to a GitHub Release. Until then
// every check simply reports "no update feed configured" instead of failing noisily —
// the plumbing is here so switching it on later is a one-line change.

let autoUpdater = null;
let wired = false;
let lastState = { status: 'idle' };

function feedConfigured(pkg) {
  const p = pkg && pkg.build && pkg.build.publish;
  if (!p) return false;
  const entry = Array.isArray(p) ? p[0] : p;
  if (!entry) return false;
  if (entry.provider === 'github') return !!entry.owner && entry.owner !== 'YOUR_GITHUB_USERNAME';
  return true;
}

function load() {
  if (autoUpdater) return autoUpdater;
  try {
    autoUpdater = require('electron-updater').autoUpdater;
    autoUpdater.autoDownload = false;          // ask before pulling ~130 MB
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.logger = { info: (m) => logger.info('updater: ' + m), warn: (m) => logger.warn('updater: ' + m), error: (m) => logger.error('updater: ' + m), debug: () => {} };
  } catch (e) {
    logger.warn('electron-updater unavailable', e);
    autoUpdater = null;
  }
  return autoUpdater;
}

function init(send, pkg, isDev) {
  const up = load();
  if (!up || wired) return;
  wired = true;
  const push = (state) => { lastState = state; send('update-state', state); };
  up.on('checking-for-update', () => push({ status: 'checking' }));
  up.on('update-available', (i) => push({ status: 'available', version: i.version, notes: i.releaseNotes || '' }));
  up.on('update-not-available', () => push({ status: 'current' }));
  up.on('download-progress', (p) => push({ status: 'downloading', percent: Math.round(p.percent), speed: p.bytesPerSecond }));
  up.on('update-downloaded', (i) => push({ status: 'ready', version: i.version }));
  up.on('error', (e) => { logger.error('updater error', e); push({ status: 'error', message: String(e && e.message || e) }); });
  module.exports._ctx = { pkg, isDev };
}

async function check({ pkg, isDev }) {
  if (isDev) return { status: 'dev', message: 'Updates are not checked when running from source.' };
  if (!feedConfigured(pkg)) {
    return { status: 'unconfigured', message: 'No update feed is set up yet. Publish a GitHub Release and set "build.publish" in package.json.' };
  }
  const up = load();
  if (!up) return { status: 'error', message: 'The updater component is missing from this build.' };
  try {
    const r = await up.checkForUpdates();
    return r && r.updateInfo
      ? { status: 'checked', version: r.updateInfo.version }
      : { status: 'checked' };
  } catch (e) {
    return { status: 'error', message: String(e && e.message || e) };
  }
}

async function download() {
  const up = load();
  if (!up) return { error: 'Updater unavailable' };
  try { await up.downloadUpdate(); return { ok: true }; }
  catch (e) { return { error: String(e && e.message || e) }; }
}

function installNow() {
  const up = load();
  if (!up) return false;
  setImmediate(() => up.quitAndInstall(false, true));
  return true;
}

module.exports = { init, check, download, installNow, feedConfigured, state: () => lastState };
