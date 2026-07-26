const fs = require('fs');
const path = require('path');
const os = require('os');

// Local-only diagnostics. Nothing is ever uploaded — the file is there so a user can
// look at it, or send it themselves when reporting a problem.

const MAX_BYTES = 2 * 1024 * 1024; // rotate at 2 MB, keep one previous file
let logPath = null;
let dir = null;
let appVersion = '?';

function stamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function rotateIfBig() {
  try {
    if (!logPath || !fs.existsSync(logPath)) return;
    if (fs.statSync(logPath).size < MAX_BYTES) return;
    const prev = path.join(dir, 'portico.previous.log');
    try { fs.rmSync(prev, { force: true }); } catch {}
    fs.renameSync(logPath, prev);
  } catch {}
}

function write(level, msg, extra) {
  const line = `[${stamp()}] ${level} ${msg}${extra ? ' ' + safe(extra) : ''}\n`;
  try {
    rotateIfBig();
    if (logPath) fs.appendFileSync(logPath, line);
  } catch {}
  if (level === 'ERROR') console.error(line.trim()); else console.log(line.trim());
}

function safe(o) {
  try {
    if (o instanceof Error) return `${o.message}\n${o.stack || ''}`;
    return typeof o === 'string' ? o : JSON.stringify(o);
  } catch { return String(o); }
}

function init(userDataDir, version) {
  dir = path.join(userDataDir, 'logs');
  appVersion = version || '?';
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
  logPath = path.join(dir, 'portico.log');
  write('INFO', '--- Portico started ---', {
    version: appVersion,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    os: `${os.type()} ${os.release()}`,
    cpus: os.cpus().length,
    ramGB: Math.round(os.totalmem() / 1e9),
  });
  return logPath;
}

const info = (m, e) => write('INFO', m, e);
const warn = (m, e) => write('WARN', m, e);
const error = (m, e) => write('ERROR', m, e);

// Anything that would otherwise kill the app silently ends up here.
function captureProcessErrors() {
  process.on('uncaughtException', (err) => error('uncaught exception in main', err));
  process.on('unhandledRejection', (reason) => error('unhandled promise rejection in main', reason));
}

function paths() {
  return { dir, file: logPath, previous: dir ? path.join(dir, 'portico.previous.log') : null };
}

function tail(lines = 200) {
  try {
    const txt = fs.readFileSync(logPath, 'utf8').split('\n');
    return txt.slice(-lines).join('\n');
  } catch { return ''; }
}

module.exports = { init, info, warn, error, captureProcessErrors, paths, tail };
