const { app, BrowserWindow, ipcMain, shell, dialog, session } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const Store = require('./store');
const ServerManager = require('./server-manager');
const { CATALOG, scanModels, Downloader } = require('./models');
const { research, engineInfo, testEngines } = require('./websearch');
const imagegen = require('./imagegen');
const pyrun = require('./pyrun');
const voice = require('./voice');
const logger = require('./logger');
const updater = require('./updater');
const engineClient = require('./engine-client');
const { devEngineDir } = require('./platform');
const pkg = require('../../package.json');

const isDev = !app.isPackaged;
const appRoot = path.join(__dirname, '..', '..');
const llamaBinDir = isDev
  ? devEngineDir(appRoot, 'llama')
  : path.join(process.resourcesPath, 'llama');

let win = null;
let store = null;
let server = null;
const downloader = new Downloader();

function defaultSettings() {
  return {
    modelsDir: isDev
      ? path.join(__dirname, '..', '..', 'models')
      : path.join(app.getPath('userData'), 'models'),
    port: 8033,
    device: 'auto',
    gpuLayers: 99,
    contextSize: 4096,
    temperature: 0.8,
    topP: 0.95,
    maxTokens: 2048,
    systemPrompt: '',
    lastModelPath: null,
    webSearch: false,      // off by default: keeps the app fully offline unless asked
    searchResults: 6,
    searchReadPages: 3,
    braveApiKey: '',
    searchEngines: {},     // {engineId: bool}; unset means on (except Brave, which needs a key)
    searchAlwaysAllSources: false,
    searchMode: 'auto',    // 'auto' = skip chit-chat/follow-ups; 'always' = search every message
    theme: 'dark',         // dark | ultradark | light | sepia
    voiceModel: '',        // empty = use the first whisper model found
    voiceLanguage: 'auto', // whisper auto-detects; set 'es'/'en' to force
    visionModel: '',       // gguf that has a matching mmproj
    imageModel: '',        // empty = use the first image model found
    imageSteps: 0,         // 0 = auto (let the model's preset decide)
    imageSize: 0,          // 0 = auto
    imageQuant: 'q8_0',    // fp16 weights overflow a 4 GB card; q8_0 fits in ~1.7 GB
    imageDevice: 'vulkan0',

    // ---------- shared engine over the network ----------
    // Host mode: this machine runs the model and lets others on the LAN use it.
    // Off by default — turning it on is what opens the engine beyond loopback.
    shareEngine: false,
    shareKey: '',          // required when sharing; generated on first enable
    parallelSlots: 1,      // concurrent chats the host serves; each costs KV-cache VRAM

    // Client mode: use another machine's engine instead of running one here.
    remoteMode: false,
    remoteUrl: '',         // e.g. http://192.168.1.40:8033
    remoteKey: '',
  };
}

function send(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

// Engine launch options derived from settings. Sharing is what decides whether the
// engine listens beyond loopback, so it is resolved in one place rather than at
// each call site — a start that forgot it would quietly un-share the machine.
function startOpts(s, modelPath, mmproj = null) {
  return {
    modelPath,
    ctx: s.contextSize,
    ngl: s.gpuLayers,
    device: s.device,
    mmproj,
    host: s.shareEngine ? '0.0.0.0' : '127.0.0.1',
    apiKey: s.shareEngine ? (s.shareKey || '') : '',
    parallel: s.shareEngine ? (s.parallelSlots || 1) : 1,
  };
}

// Frame colours per theme, mirroring the CSS. Used for the very first paint so the
// window doesn't open dark and then flip to light.
const THEME_CHROME = {
  dark: { bg: '#262624', titleBar: '#1f1e1d', symbol: '#b0aea2' },
  ultradark: { bg: '#0a0a09', titleBar: '#000000', symbol: '#9b988f' },
  light: { bg: '#faf9f5', titleBar: '#f0eee6', symbol: '#5f5c54' },
  sepia: { bg: '#f4ead6', titleBar: '#ebdfc4', symbol: '#6a5c44' },
};

function createWindow() {
  const startupTheme = THEME_CHROME[(store.getSettings().theme)] || THEME_CHROME.dark;
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 940,
    minHeight: 600,
    backgroundColor: startupTheme.bg,
    title: 'Portico',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: startupTheme.titleBar, symbolColor: startupTheme.symbol, height: 38 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
    },
  });
  win.setMenuBarVisibility(false);

  // A blank window with no explanation is the worst failure mode — record the cause.
  win.webContents.on('render-process-gone', (e, details) => {
    logger.error('renderer process gone', details);
  });
  win.webContents.on('unresponsive', () => logger.warn('window became unresponsive'));
  win.webContents.on('preload-error', (e, p, err) => logger.error('preload failed: ' + p, err));
  app.on('child-process-gone', (e, details) => logger.error('child process gone', details));
  win.webContents.on('console-message', (e, level, message, line, sourceId) => {
    if (level >= 3) logger.error(`renderer console: ${message} (${sourceId}:${line})`);
  });

  if (isDev) {
    win.webContents.on('console-message', (e, level, message, line, sourceId) => {
      if (level >= 2) console.log(`[renderer] ${message} (${sourceId}:${line})`);
    });
  }
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  // A link inside a model reply must never navigate the app away from its own UI.
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) {
      e.preventDefault();
      if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    }
  });
}

// Single instance: a second launch just focuses the existing window
// (two instances would fight over the engine port and the profile lock).
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

// One-time migration: the app was briefly named PriStudio — carry chats/settings over.
function migrateOldUserData() {
  const ud = app.getPath('userData');
  const oldDir = path.join(app.getPath('appData'), 'PriStudio');
  try {
    if (fs.existsSync(path.join(ud, 'settings.json')) || !fs.existsSync(path.join(oldDir, 'settings.json'))) return;
    fs.mkdirSync(path.join(ud, 'chats'), { recursive: true });
    fs.copyFileSync(path.join(oldDir, 'settings.json'), path.join(ud, 'settings.json'));
    const oldChats = path.join(oldDir, 'chats');
    if (fs.existsSync(oldChats)) {
      for (const f of fs.readdirSync(oldChats)) {
        if (f.endsWith('.json')) fs.copyFileSync(path.join(oldChats, f), path.join(ud, 'chats', f));
      }
    }
  } catch { /* fresh start is fine */ }
}

logger.captureProcessErrors();

app.whenReady().then(() => {
  logger.init(app.getPath('userData'), app.getVersion());

  // The renderer needs the microphone for voice input; everything else stays denied.
  // Audio is transcribed locally and never leaves the machine.
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => {
    callback(permission === 'media' || permission === 'audioCapture');
  });
  session.defaultSession.setPermissionCheckHandler((wc, permission) =>
    permission === 'media' || permission === 'audioCapture');

  migrateOldUserData();
  store = new Store(app.getPath('userData'), defaultSettings());
  // v0.14: image size/steps became "auto by model". Older installs stored the previous
  // fixed defaults, which would now silently override the per-model presets.
  const cur = store.getSettings();
  if (!cur.imageAutoMigrated) {
    const patch = { imageAutoMigrated: true };
    if (cur.imageSize === 512) patch.imageSize = 0;
    if (cur.imageSteps === 20) patch.imageSteps = 0;
    store.saveSettings(patch);
  }
  fs.mkdirSync(store.getSettings().modelsDir, { recursive: true });

  server = new ServerManager({ binDir: llamaBinDir, port: store.getSettings().port });
  server.on('status', (s) => send('server-status', s));
  downloader.on('progress', (p) => send('download-progress', p));

  registerIpc();
  createWindow();
  updater.init(send, pkg, isDev);
  // quiet check on startup; the UI only speaks up if something is actually available
  if (!isDev && updater.feedConfigured(pkg)) {
    setTimeout(() => updater.check({ pkg, isDev }).catch(() => {}), 8000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', async () => {
  await server?.stop();
  app.quit();
});

app.on('before-quit', () => {
  server?.stop();
});

// ---------- file attachments ----------

const TEXT_EXTS = new Set([
  '.txt', '.md', '.markdown', '.csv', '.tsv', '.json', '.xml', '.yaml', '.yml',
  '.html', '.css', '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.c', '.cpp', '.h',
  '.cs', '.go', '.rs', '.rb', '.php', '.sql', '.sh', '.bat', '.ps1', '.r', '.ini',
  '.toml', '.log', '.tex',
]);
const MAX_FILE_CHARS = 60000;

const IMAGE_EXTS = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.bmp': 'image/bmp' };

async function extractFile(p) {
  const name = path.basename(p);
  try {
    const ext = path.extname(p).toLowerCase();
    const stat = fs.statSync(p);
    if (stat.size > 25 * 1024 * 1024) return { name, error: 'File is larger than 25 MB' };
    // images go to the model as pixels, not text — needs a vision model loaded
    if (IMAGE_EXTS[ext]) {
      const b64 = fs.readFileSync(p).toString('base64');
      return { name, isImage: true, mime: IMAGE_EXTS[ext], dataUrl: `data:${IMAGE_EXTS[ext]};base64,${b64}`, bytes: stat.size };
    }
    let text;
    if (ext === '.pdf') {
      const { PDFParse } = require('pdf-parse');
      const parser = new PDFParse({ data: fs.readFileSync(p) });
      text = (await parser.getText()).text || '';
    } else {
      const buf = fs.readFileSync(p);
      if (!TEXT_EXTS.has(ext) && buf.includes(0)) return { name, error: 'Unsupported binary file type' };
      text = buf.toString('utf8');
    }
    text = text.replace(/\r\n/g, '\n').trim();
    if (!text) return { name, error: 'No readable text found in file' };
    const truncated = text.length > MAX_FILE_CHARS;
    if (truncated) text = text.slice(0, MAX_FILE_CHARS);
    return { name, text, chars: text.length, truncated };
  } catch (e) {
    return { name, error: e.message };
  }
}

function registerIpc() {
  ipcMain.handle('pick-files', async () => {
    const r = await dialog.showOpenDialog(win, {
      title: 'Attach files',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Documents, code & images', extensions: ['pdf', 'txt', 'md', 'csv', 'json', 'log', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', ...[...TEXT_EXTS].map((e) => e.slice(1))] },
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] },
        { name: 'All files', extensions: ['*'] },
      ],
    });
    if (r.canceled) return [];
    const out = [];
    for (const p of r.filePaths.slice(0, 5)) out.push(await extractFile(p));
    return out;
  });
  ipcMain.handle('read-files', async (e, paths) => {
    const out = [];
    for (const p of (paths || []).slice(0, 5)) out.push(await extractFile(String(p)));
    return out;
  });
  ipcMain.handle('web-search', async (e, query, opts) => {
    const s = store.getSettings();
    try {
      const r = await research(String(query || '').slice(0, 300), {
        settings: s,
        maxResults: s.searchResults,
        readPages: s.searchReadPages,
        // keep retrieved text proportional to the model's context window
        charBudget: Math.max(3000, Math.min((s.contextSize || 4096) * 1.5, 20000)),
        ...(opts || {}),
      });
      return r;
    } catch (err) {
      return { error: err.message, query: String(query || '') };
    }
  });
  // ---------- image generation ----------
  // Downloaded on demand, so keep it in userData — reinstalling the app would wipe
  // anything stored inside the program folder.
  const imgDir = () => (isDev
    ? devEngineDir(appRoot, 'sd')
    : path.join(app.getPath('userData'), 'sd-engine'));

  ipcMain.handle('image-status', () => ({
    engineInstalled: imagegen.hasEngine(imgDir()),
    models: imagegen.listImageModels(store.getSettings().modelsDir),
    defaults: imagegen.DEFAULTS,
  }));
  ipcMain.handle('install-image-engine', async () => {
    try {
      await imagegen.downloadEngine(imgDir(), (p) => send('image-engine-progress', p));
      return { ok: true };
    } catch (e) { return { error: e.message }; }
  });
  ipcMain.handle('generate-image', async (e, opts) => {
    const s = store.getSettings();
    const models = imagegen.listImageModels(s.modelsDir);
    const chosen = models.find((m) => m.path === s.imageModel);
    const model = opts.modelPath || (chosen && chosen.path) || (models[0] && models[0].path);
    if (!model) return { error: 'No image model installed — download one from the Models tab.' };

    // A 4 GB card cannot hold the chat model and the image model at once, so free it
    // and put it back afterwards.
    const wasLoaded = server.status().state === 'ready' ? server.status().modelPath : null;
    if (wasLoaded) { send('image-stage', { stage: 'freeing-vram' }); await server.stop(); }

    const outPath = path.join(app.getPath('userData'), 'images',
      `${Date.now()}-${String(opts.prompt || 'image').replace(/[^a-z0-9]+/gi, '-').slice(0, 40).toLowerCase()}.png`);
    // Turbo and SDXL models need their own step/CFG/size, otherwise the output is mush.
    const preset = imagegen.modelPreset(model);
    try {
      send('image-stage', { stage: 'generating' });
      const r = await imagegen.generate({
        engineDir: imgDir(),
        modelPath: model,
        prompt: opts.prompt,
        negative: opts.negative || '',
        outPath,
        // an explicit choice in Settings wins; 0 means "match the model"
        width: opts.width || s.imageSize || preset.size,
        height: opts.height || s.imageSize || preset.size,
        steps: opts.steps || s.imageSteps || preset.steps,
        cfg: opts.cfg || preset.cfg,
        seed: opts.seed === undefined ? -1 : opts.seed,
        quant: preset.quant,
        device: s.imageDevice,
        onProgress: (p) => send('image-progress', p),
      });
      return { path: r.path, model: path.basename(model), preset: preset.family };
    } catch (err) {
      return { error: err.message };
    } finally {
      if (wasLoaded) {
        send('image-stage', { stage: 'reloading-chat-model' });
        server.start(startOpts(s, wasLoaded));
      }
    }
  });
  ipcMain.handle('cancel-image', () => imagegen.cancel());
  ipcMain.handle('show-image', (e, p) => { if (p && fs.existsSync(String(p))) shell.showItemInFolder(String(p)); });

  // ---------- speech to text ----------
  const whisperDir = () => (isDev
    ? devEngineDir(appRoot, 'whisper')
    : path.join(process.resourcesPath, 'whisper'));

  ipcMain.handle('voice-info', () => ({
    engineInstalled: voice.hasEngine(whisperDir()),
    models: voice.listModels(store.getSettings().modelsDir),
  }));
  ipcMain.handle('transcribe', async (e, { wavBytes, language }) => {
    const s = store.getSettings();
    const models = voice.listModels(s.modelsDir);
    const chosen = models.find((m) => m.path === s.voiceModel) || models[0];
    if (!chosen) return { error: 'No speech model found. Download one from Models → Discover.' };
    return voice.transcribe({
      engineDir: whisperDir(),
      modelPath: chosen.path,
      wavBytes,
      language: language || s.voiceLanguage || 'auto',
    });
  });

  // ---------- running Python from a chat message ----------
  ipcMain.handle('python-info', () => pyrun.info());
  ipcMain.handle('python-scan', (e, code) => pyrun.scan(String(code || '')));
  ipcMain.handle('python-install', (e, names) =>
    pyrun.installPackages(Array.isArray(names) ? names : ['matplotlib'], (line) => send('python-install-log', line)));
  ipcMain.handle('run-python', async (e, { code, timeout }) => {
    const r = await pyrun.run(String(code || ''), { timeout });
    // figures live in a temp dir; copy them somewhere durable so chats keep working
    if (r.figures && r.figures.length) {
      const keepDir = path.join(app.getPath('userData'), 'plots');
      fs.mkdirSync(keepDir, { recursive: true });
      r.figures = r.figures.map((f, i) => {
        const dest = path.join(keepDir, `${Date.now()}-${i + 1}.png`);
        try { fs.copyFileSync(f, dest); return dest; } catch { return f; }
      });
    }
    try { if (r.dir) fs.rmSync(r.dir, { recursive: true, force: true }); } catch {}
    delete r.dir;
    return r;
  });
  ipcMain.handle('cancel-python', () => pyrun.cancel());

  // ---------- updates ----------
  ipcMain.handle('update-check', () => updater.check({ pkg, isDev }));
  ipcMain.handle('update-download', () => updater.download());
  ipcMain.handle('update-install', () => updater.installNow());
  ipcMain.handle('update-state', () => ({ ...updater.state(), configured: updater.feedConfigured(pkg), isDev, version: app.getVersion() }));

  // ---------- diagnostics ----------
  ipcMain.handle('log-client-error', (e, payload) => { logger.error('renderer: ' + (payload && payload.message), payload); });
  ipcMain.handle('open-logs', () => shell.openPath(logger.paths().dir));
  ipcMain.handle('diagnostics', () => {
    const s = store.getSettings();
    return {
      version: app.getVersion(),
      electron: process.versions.electron,
      os: `${os.type()} ${os.release()} (${os.arch()})`,
      cpus: os.cpus().length,
      ramGB: Math.round(os.totalmem() / 1e9),
      settings: {
        contextSize: s.contextSize, gpuLayers: s.gpuLayers, device: s.device,
        webSearch: s.webSearch, imageQuant: s.imageQuant,
      },
      server: server.status(),
      chatModels: scanModels(s.modelsDir).map((m) => m.name),
      imageModels: imagegen.listImageModels(s.modelsDir).map((m) => m.name),
      voiceModels: voice.listModels(s.modelsDir).map((m) => m.name),
      logTail: logger.tail(60),
    };
  });

  // The frame is drawn by Windows, not by our CSS, so it has to be repainted per theme.
  ipcMain.handle('set-title-bar-theme', (e, t) => {
    if (!win || win.isDestroyed() || !t) return false;
    try {
      if (win.setTitleBarOverlay) win.setTitleBarOverlay({ color: t.color, symbolColor: t.symbolColor, height: 38 });
      if (t.bg) win.setBackgroundColor(t.bg);
      return true;
    } catch (err) {
      logger.warn('could not repaint the title bar', err);
      return false;
    }
  });

  ipcMain.handle('search-engines', () => engineInfo());
  ipcMain.handle('test-search-engines', () => testEngines(store.getSettings()));
  ipcMain.handle('open-external', (e, url) => {
    if (/^https?:\/\//i.test(String(url))) shell.openExternal(String(url));
  });

  ipcMain.handle('save-file', async (e, opts) => {
    const suggested = String((opts && opts.suggestedName) || 'code.txt').replace(/[<>:"/\\|?*]/g, '_');
    const content = String((opts && opts.content) || '');
    if (opts && opts.testPath) { // used by automated tests to skip the native dialog
      fs.writeFileSync(String(opts.testPath), content, 'utf8');
      return String(opts.testPath);
    }
    const r = await dialog.showSaveDialog(win, {
      title: 'Save code as…',
      defaultPath: path.join(app.getPath('downloads'), suggested),
    });
    if (r.canceled || !r.filePath) return null;
    fs.writeFileSync(r.filePath, content, 'utf8');
    return r.filePath;
  });

  ipcMain.handle('debug-info', () => {
    const out = { userData: app.getPath('userData'), settingsPath: store.settingsPath, chatsDir: store.chatsDir, inMemory: store.getSettings() };
    try { out.settingsRaw = fs.readFileSync(store.settingsPath, 'utf8'); } catch (e) { out.settingsRaw = 'ERR: ' + e.message; }
    try { out.chatsList = fs.readdirSync(store.chatsDir); } catch (e) { out.chatsList = 'ERR: ' + e.message; }
    return out;
  });
  ipcMain.handle('get-settings', () => store.getSettings());
  ipcMain.handle('save-settings', (e, patch) => store.saveSettings(patch));

  ipcMain.handle('list-models', () => scanModels(store.getSettings().modelsDir));
  ipcMain.handle('get-catalog', () => {
    const dir = store.getSettings().modelsDir;
    // image checkpoints are .safetensors, so scanModels (gguf only) would miss them
    // scanModels hides projectors and only sees .gguf, so add the companions back:
    // mmproj files and whisper models live alongside but are catalogued too.
    let projectors = [];
    try { projectors = fs.readdirSync(dir).filter((f) => /^mmproj.*\.gguf$/i.test(f)); } catch {}
    const installed = new Set([
      ...scanModels(dir).map((m) => m.file),
      ...imagegen.listImageModels(dir).map((m) => m.file),
      ...projectors,
      ...voice.listModels(dir).map((m) => 'whisper/' + m.file),
    ]);
    return CATALOG.map((m) => ({
      ...m,
      installed: installed.has(m.file),
      downloading: downloader.isActive(m.id),
      partial: fs.existsSync(path.join(store.getSettings().modelsDir, m.file + '.part')),
    }));
  });
  ipcMain.handle('delete-model', async (e, modelPath) => {
    const dir = path.resolve(store.getSettings().modelsDir);
    const resolved = path.resolve(modelPath);
    if (!resolved.startsWith(dir)) return false;
    if (server.status().modelPath === modelPath) await server.stop();
    try { fs.unlinkSync(resolved); return true; } catch { return false; }
  });
  ipcMain.handle('open-models-folder', () => shell.openPath(store.getSettings().modelsDir));

  ipcMain.handle('download-model', (e, id) => {
    const m = CATALOG.find((x) => x.id === id);
    if (!m || downloader.isActive(id)) return false;
    const dest = path.join(store.getSettings().modelsDir, m.file);
    downloader.download(id, m.url, dest).catch(() => {});
    return true;
  });
  ipcMain.handle('cancel-download', (e, id) => downloader.cancel(id));

  ipcMain.handle('server-status', () => server.status());
  ipcMain.handle('list-devices', () => server.listDevices());
  ipcMain.handle('load-model', async (e, modelPath) => {
    const s = store.getSettings();
    store.saveSettings({ lastModelPath: modelPath });
    const found = scanModels(s.modelsDir).find((m) => m.path === modelPath);
    return server.start(startOpts(s, modelPath, found && found.mmproj ? found.mmproj : null));
  });
  ipcMain.handle('unload-model', () => server.stop().then(() => server.status()));

  // ---------- chat streaming ----------
  // The request is made here, not in the renderer, so the access key stays out of
  // the page and the CSP can stay pinned to loopback.
  let chatStream = null;
  ipcMain.handle('chat-start', (e, payload) => {
    if (chatStream) { try { chatStream.abort(); } catch {} }
    const s = store.getSettings();
    chatStream = engineClient.streamChat({
      settings: s,
      payload,
      onChunk: (data) => send('chat-chunk', data),
      onDone: () => { chatStream = null; send('chat-done', {}); },
      onError: (err) => { chatStream = null; send('chat-error', { message: err.message }); },
    });
    return { ok: true };
  });
  ipcMain.handle('chat-abort', () => {
    if (chatStream) { try { chatStream.abort(); } catch {} chatStream = null; }
    return { ok: true };
  });

  // ---------- shared engine ----------
  ipcMain.handle('network-info', () => {
    const s = store.getSettings();
    return {
      shareEngine: !!s.shareEngine,
      shareKey: s.shareKey || '',
      parallelSlots: s.parallelSlots || 1,
      remoteMode: !!s.remoteMode,
      remoteUrl: s.remoteUrl || '',
      remoteKey: s.remoteKey || '',
      port: s.port,
      addresses: engineClient.localAddresses(),
    };
  });
  ipcMain.handle('generate-share-key', () => {
    // 24 hex chars: long enough that guessing is hopeless, short enough to read aloud
    const key = require('crypto').randomBytes(12).toString('hex');
    store.saveSettings({ shareKey: key });
    return key;
  });
  ipcMain.handle('test-remote', (e, { url, key }) => engineClient.probe({ url, key }));
  // Turning sharing on or off changes the bind address, which only takes effect when
  // the engine (re)starts — so restart it if a model is currently loaded.
  ipcMain.handle('apply-sharing', async () => {
    const s = store.getSettings();
    const loaded = server.status().modelPath;
    if (!loaded) return server.status();
    const found = scanModels(s.modelsDir).find((m) => m.path === loaded);
    return server.start(startOpts(s, loaded, found && found.mmproj ? found.mmproj : null));
  });

  // ---------- projects ----------
  ipcMain.handle('list-projects', () => store.listProjects());
  ipcMain.handle('save-project', (e, p) => store.saveProject(p));
  ipcMain.handle('delete-project', (e, id) => store.deleteProject(id));
  ipcMain.handle('pick-project-files', async () => {
    const r = await dialog.showOpenDialog(win, {
      title: 'Add reference files to this project',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Documents & text', extensions: ['pdf', 'txt', 'md', 'csv', 'json', 'log', ...[...TEXT_EXTS].map((x) => x.slice(1))] }, { name: 'All files', extensions: ['*'] }],
    });
    if (r.canceled) return [];
    const out = [];
    for (const p of r.filePaths.slice(0, 20)) out.push(await extractFile(p));
    return out;
  });

  // ---------- assistants ----------
  ipcMain.handle('list-assistants', () => store.listAssistants());
  ipcMain.handle('save-assistant', (e, a) => store.saveAssistant(a));
  ipcMain.handle('delete-assistant', (e, id) => store.deleteAssistant(id));

  // ---------- artifacts ----------
  // Written to a real file so the preview runs in its own file:// origin inside a
  // sandboxed frame — it cannot reach the app's page, IPC or your data.
  ipcMain.handle('write-artifact', (e, { id, html }) => {
    const safe = String(id || Date.now()).replace(/[^\w-]/g, '');
    const p = path.join(store.artifactsDir, safe + '.html');
    fs.writeFileSync(p, String(html || ''), 'utf8');
    return { path: p, url: 'file:///' + p.replace(/\\/g, '/') };
  });
  ipcMain.handle('open-artifact-externally', (e, p) => {
    if (p && fs.existsSync(String(p))) shell.openPath(String(p));
  });

  ipcMain.handle('list-chats', () => store.listChats());
  ipcMain.handle('get-chat', (e, id) => store.getChat(id));
  ipcMain.handle('save-chat', (e, chat) => store.saveChat(chat));
  ipcMain.handle('delete-chat', (e, id) => store.deleteChat(id));
}
