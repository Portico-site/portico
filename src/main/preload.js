const { contextBridge, ipcRenderer } = require('electron');

// If highlight.js can't load, chat still works — code blocks just lose colors.
let hljs = null;
try { hljs = require('highlight.js'); } catch { /* fall back to escaping */ }

function highlight(code, lang) {
  try {
    if (hljs) {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
      }
      return hljs.highlightAuto(code).value;
    }
  } catch { /* fall through */ }
  return code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

contextBridge.exposeInMainWorld('pristudio', {
  debugInfo: () => ipcRenderer.invoke('debug-info'),
  pickFiles: () => ipcRenderer.invoke('pick-files'),
  readFiles: (paths) => ipcRenderer.invoke('read-files', paths),
  saveFile: (opts) => ipcRenderer.invoke('save-file', opts),
  webSearch: (query, opts) => ipcRenderer.invoke('web-search', query, opts),
  imageStatus: () => ipcRenderer.invoke('image-status'),
  installImageEngine: () => ipcRenderer.invoke('install-image-engine'),
  generateImage: (opts) => ipcRenderer.invoke('generate-image', opts),
  cancelImage: () => ipcRenderer.invoke('cancel-image'),
  showImage: (p) => ipcRenderer.invoke('show-image', p),
  onImageProgress: (cb) => ipcRenderer.on('image-progress', (e, p) => cb(p)),
  onImageStage: (cb) => ipcRenderer.on('image-stage', (e, p) => cb(p)),
  onImageEngineProgress: (cb) => ipcRenderer.on('image-engine-progress', (e, p) => cb(p)),

  logClientError: (payload) => ipcRenderer.invoke('log-client-error', payload),
  openLogs: () => ipcRenderer.invoke('open-logs'),
  diagnostics: () => ipcRenderer.invoke('diagnostics'),
  updateCheck: () => ipcRenderer.invoke('update-check'),
  updateDownload: () => ipcRenderer.invoke('update-download'),
  updateInstall: () => ipcRenderer.invoke('update-install'),
  updateState: () => ipcRenderer.invoke('update-state'),
  onUpdateState: (cb) => ipcRenderer.on('update-state', (e, s) => cb(s)),

  setTitleBarTheme: (t) => ipcRenderer.invoke('set-title-bar-theme', t),

  voiceInfo: () => ipcRenderer.invoke('voice-info'),
  transcribe: (opts) => ipcRenderer.invoke('transcribe', opts),

  pythonInfo: () => ipcRenderer.invoke('python-info'),
  pythonScan: (code) => ipcRenderer.invoke('python-scan', code),
  pythonInstall: (names) => ipcRenderer.invoke('python-install', names),
  runPython: (opts) => ipcRenderer.invoke('run-python', opts),
  cancelPython: () => ipcRenderer.invoke('cancel-python'),
  onPythonInstallLog: (cb) => ipcRenderer.on('python-install-log', (e, l) => cb(l)),

  searchEngines: () => ipcRenderer.invoke('search-engines'),
  testSearchEngines: () => ipcRenderer.invoke('test-search-engines'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (patch) => ipcRenderer.invoke('save-settings', patch),

  listModels: () => ipcRenderer.invoke('list-models'),
  getCatalog: () => ipcRenderer.invoke('get-catalog'),
  deleteModel: (p) => ipcRenderer.invoke('delete-model', p),
  openModelsFolder: () => ipcRenderer.invoke('open-models-folder'),
  downloadModel: (id) => ipcRenderer.invoke('download-model', id),
  cancelDownload: (id) => ipcRenderer.invoke('cancel-download', id),
  onDownloadProgress: (cb) => ipcRenderer.on('download-progress', (e, p) => cb(p)),

  // chat streaming runs in main so the access key never reaches the page
  chatStart: (payload) => ipcRenderer.invoke('chat-start', payload),
  chatAbort: () => ipcRenderer.invoke('chat-abort'),
  onChatChunk: (cb) => ipcRenderer.on('chat-chunk', (e, d) => cb(d)),
  onChatDone: (cb) => ipcRenderer.on('chat-done', () => cb()),
  onChatError: (cb) => ipcRenderer.on('chat-error', (e, d) => cb(d)),

  networkInfo: () => ipcRenderer.invoke('network-info'),
  generateShareKey: () => ipcRenderer.invoke('generate-share-key'),
  testRemote: (opts) => ipcRenderer.invoke('test-remote', opts),
  listProviders: () => ipcRenderer.invoke('list-providers'),
  applySharing: () => ipcRenderer.invoke('apply-sharing'),

  serverStatus: () => ipcRenderer.invoke('server-status'),
  listDevices: () => ipcRenderer.invoke('list-devices'),
  hardwareInfo: () => ipcRenderer.invoke('hardware-info'),
  encryptionStatus: () => ipcRenderer.invoke('encryption-status'),
  benchmarkDevices: () => ipcRenderer.invoke('benchmark-devices'),
  onDeviceBenchmarkProgress: (cb) => ipcRenderer.on('device-benchmark-progress', (e, p) => cb(p)),
  loadModel: (p) => ipcRenderer.invoke('load-model', p),
  unloadModel: () => ipcRenderer.invoke('unload-model'),
  onServerStatus: (cb) => ipcRenderer.on('server-status', (e, s) => cb(s)),

  listProjects: () => ipcRenderer.invoke('list-projects'),
  saveProject: (p) => ipcRenderer.invoke('save-project', p),
  deleteProject: (id) => ipcRenderer.invoke('delete-project', id),
  pickProjectFiles: () => ipcRenderer.invoke('pick-project-files'),

  listAssistants: () => ipcRenderer.invoke('list-assistants'),
  saveAssistant: (a) => ipcRenderer.invoke('save-assistant', a),
  deleteAssistant: (id) => ipcRenderer.invoke('delete-assistant', id),

  writeArtifact: (o) => ipcRenderer.invoke('write-artifact', o),
  openArtifactExternally: (p) => ipcRenderer.invoke('open-artifact-externally', p),

  listChats: () => ipcRenderer.invoke('list-chats'),
  getChat: (id) => ipcRenderer.invoke('get-chat', id),
  saveChat: (chat) => ipcRenderer.invoke('save-chat', chat),
  deleteChat: (id) => ipcRenderer.invoke('delete-chat', id),

  highlight,
});
