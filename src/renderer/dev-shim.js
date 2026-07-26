/* Browser-preview shim: only activates outside Electron (window.pristudio missing).
   Lets the UI run in a plain browser against a manually started llama-server. */
(function () {
  if (window.pristudio) return;
  if (location.protocol === 'file:') {
    // The packaged app loads via file:// and must have the real bridge —
    // never mask its failure with mocks. (http:// = browser dev preview.)
    document.body.innerHTML = '<div style="padding:40px;font-family:sans-serif;color:#e0655a">' +
      'Portico failed to initialize (preload bridge missing). Please reinstall the app.</div>';
    throw new Error('pristudio bridge missing inside Electron');
  }

  const settings = {
    modelsDir: 'C:\\Users\\jolop\\Downloads\\PriStudio\\models',
    port: 8033,
    device: 'auto',
    gpuLayers: 99,
    contextSize: 8192,
    temperature: 0.8,
    topP: 0.95,
    maxTokens: 2048,
    systemPrompt: '',
    lastModelPath: null,
    webSearch: false,
    searchResults: 4,
    searchReadPages: 3,
    braveApiKey: '',
    searchEngines: {},
    searchAlwaysAllSources: false,
    searchMode: 'auto',
    shareEngine: false,
    shareKey: '',
    parallelSlots: 1,
    remoteMode: false,
    remoteUrl: '',
    remoteKey: '',
  };
  const chats = {};
  let serverCb = null;
  const chatCbs = {};
  let chatCtrl = null;
  let status = { state: 'stopped', modelPath: null, port: 8033 };

  const model = {
    name: 'Llama-3.2-3B-Instruct-Q4_K_M',
    file: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    path: 'C:\\Users\\jolop\\Downloads\\PriStudio\\models\\Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    sizeBytes: 2019377696,
    quant: 'Q4_K_M',
  };

  window.pristudio = {
    getSettings: async () => settings,
    saveSettings: async (p) => Object.assign(settings, p),
    listModels: async () => [model],
    getCatalog: async () => [
      { id: 'llama-3.2-3b', name: 'Llama 3.2 3B Instruct', cat: 'Fast & light', sizeGB: 2.0, desc: 'Great balance of speed and quality.', installed: true },
      { id: 'qwen-2.5-7b', name: 'Qwen 2.5 7B Instruct', cat: 'Everyday chat', sizeGB: 4.7, desc: 'Noticeably smarter; needs ~5 GB free.', installed: false },
      { id: 'deepseek-r1-7b', name: 'DeepSeek R1 Distill Qwen 7B', cat: 'Reasoning (DeepSeek)', sizeGB: 4.7, desc: 'Shows its step-by-step thinking.', installed: false },
    ],
    deleteModel: async () => true,
    openModelsFolder: async () => {},
    pickFiles: async () => [{ name: 'example.pdf', text: 'Mock file content for preview.', chars: 30, truncated: false }],
    webSearch: async (q) => ({
      query: q, engine: 'MockEngine', fetchedAt: new Date().toISOString(),
      results: [
        { title: 'Mock result one', url: 'https://example.com/one', snippet: 'Preview snippet.', text: 'Mock page text.', fetched: true },
        { title: 'Mock result two', url: 'https://en.wikipedia.org/wiki/Test', snippet: 'Another snippet.', fetched: false },
      ],
    }),
    openExternal: async (u) => window.open(u, '_blank'),
    logClientError: async () => {},
    openLogs: async () => {},
    diagnostics: async () => ({ version: '0.0.0-mock', electron: 'mock', os: 'mock', cpus: 1, ramGB: 1, settings: {}, server: { state: 'stopped' }, chatModels: [], imageModels: [], voiceModels: [], logTail: '' }),
    updateCheck: async () => ({ status: 'dev', message: 'Mock preview — updates not checked.' }),
    updateDownload: async () => ({ ok: true }),
    updateInstall: async () => true,
    updateState: async () => ({ status: 'idle', configured: false, isDev: true, version: '0.0.0-mock' }),
    onUpdateState: () => {},
    setTitleBarTheme: async () => true,
    voiceInfo: async () => ({ engineInstalled: true, models: [{ name: 'base', path: 'C:/mock/ggml-base.bin' }] }),
    transcribe: async () => ({ text: 'mock transcription' }),
    pythonInfo: async () => ({ found: true, version: '3.11.4', packages: { matplotlib: '3.9', numpy: '1.25' } }),
    pythonScan: async () => [],
    pythonInstall: async () => ({ ok: true }),
    runPython: async () => ({ error: 'Running Python only works inside the Portico app.' }),
    cancelPython: async () => {},
    onPythonInstallLog: () => {},
    listProjects: async () => [],
    saveProject: async (p) => [p],
    deleteProject: async () => [],
    pickProjectFiles: async () => [{ name: 'notes.pdf', text: 'Mock project file.', chars: 18 }],
    listAssistants: async () => [],
    saveAssistant: async (a) => [a],
    deleteAssistant: async () => [],
    writeArtifact: async ({ html }) => ({ path: 'mock.html', url: 'data:text/html;charset=utf-8,' + encodeURIComponent(html) }),
    openArtifactExternally: async () => {},
    imageStatus: async () => ({ engineInstalled: true, models: [{ name: 'sd-v1-5', path: 'C:/mock/sd.safetensors' }], defaults: { width: 512, height: 512, steps: 20 } }),
    installImageEngine: async () => ({ ok: true }),
    generateImage: async () => ({ error: 'Image generation only works inside the Portico app.' }),
    cancelImage: async () => {},
    showImage: async () => {},
    onImageProgress: () => {},
    onImageStage: () => {},
    onImageEngineProgress: () => {},
    searchEngines: async () => [
      { id: 'brave', label: 'Brave Search', kind: 'web', desc: 'Needs a key.', needsKey: true },
      { id: 'marginalia', label: 'Marginalia', kind: 'web', desc: 'Independent index.', needsKey: false },
      { id: 'wikipedia', label: 'Wikipedia', kind: 'web', desc: 'Encyclopedia facts.', needsKey: false },
      { id: 'googlenews', label: 'Google News', kind: 'news', desc: 'Recent headlines.', needsKey: false },
      { id: 'polymarket', label: 'Polymarket', kind: 'markets', desc: 'Live odds.', needsKey: false },
      { id: 'flights', label: 'Live flights', kind: 'flights', desc: 'Aircraft in the air.', needsKey: false },
      { id: 'shopping', label: 'Shopping', kind: 'shopping', desc: 'Product pages.', needsKey: false },
    ],
    testSearchEngines: async () => [
      { id: 'marginalia', label: 'Marginalia', kind: 'web', ok: true, count: 3, ms: 1200 },
      { id: 'wikipedia', label: 'Wikipedia', kind: 'web', ok: true, count: 3, ms: 400 },
      { id: 'googlenews', label: 'Google News', kind: 'news', ok: false, error: 'mock failure' },
    ],
    saveFile: async (opts) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([opts.content], { type: 'text/plain' }));
      a.download = opts.suggestedName || 'code.txt';
      a.click();
      return opts.suggestedName;
    },
    readFiles: async (paths) => (paths || []).map((p) => ({ name: String(p).split(/[\\/]/).pop(), text: 'Mock content of ' + p, chars: 20, truncated: false })),
    downloadModel: async () => true,
    cancelDownload: async () => {},
    onDownloadProgress: () => {},
    serverStatus: async () => status,
    listDevices: async () => [
      { id: 'Vulkan0', name: 'NVIDIA GeForce RTX 3050 Ti Laptop GPU', totalMiB: 3962, freeMiB: 3367 },
      { id: 'Vulkan1', name: 'AMD Radeon(TM) Graphics', totalMiB: 8071, freeMiB: 7667 },
    ],
    loadModel: async (p) => {
      status = { state: 'starting', modelPath: p, port: 8033 };
      serverCb && serverCb(status);
      // assume llama-server was started manually for the preview
      const check = async () => {
        try {
          const r = await fetch('http://127.0.0.1:8033/health');
          if (r.ok) { status = { state: 'ready', modelPath: p, port: 8033 }; serverCb && serverCb(status); return; }
        } catch {}
        setTimeout(check, 800);
      };
      check();
      return status;
    },
    unloadModel: async () => {
      status = { state: 'stopped', modelPath: null, port: 8033 };
      serverCb && serverCb(status);
      return status;
    },
    onServerStatus: (cb) => { serverCb = cb; },

    // The real app streams chat from the main process; in the browser preview there
    // is no main process, so fetch directly from the manually started llama-server.
    chatStart: async (payload) => {
      const s = settings.remoteMode && settings.remoteUrl
        ? settings.remoteUrl.replace(/\/+$/, '')
        : `http://127.0.0.1:${settings.port}`;
      const base = /^https?:\/\//.test(s) ? s : 'http://' + s;
      const headers = { 'Content-Type': 'application/json' };
      const key = settings.remoteMode ? settings.remoteKey : settings.shareKey;
      if (key) headers.Authorization = 'Bearer ' + key;
      chatCtrl = new AbortController();
      try {
        const res = await fetch(base + '/v1/chat/completions',
          { method: 'POST', headers, body: JSON.stringify(payload), signal: chatCtrl.signal });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop();
          for (const line of lines) {
            const t = line.trim();
            if (!t.startsWith('data:')) continue;
            const p = t.slice(5).trim();
            if (p !== '[DONE]') chatCbs.chunk && chatCbs.chunk(p);
          }
        }
        chatCbs.done && chatCbs.done();
      } catch (e) {
        if (e.name !== 'AbortError') chatCbs.error && chatCbs.error({ message: e.message });
      }
      return { ok: true };
    },
    chatAbort: async () => { if (chatCtrl) { chatCtrl.abort(); chatCtrl = null; } },
    onChatChunk: (cb) => { chatCbs.chunk = cb; },
    onChatDone: (cb) => { chatCbs.done = cb; },
    onChatError: (cb) => { chatCbs.error = cb; },

    networkInfo: async () => ({
      shareEngine: settings.shareEngine, shareKey: settings.shareKey,
      parallelSlots: settings.parallelSlots, remoteMode: settings.remoteMode,
      remoteUrl: settings.remoteUrl, remoteKey: settings.remoteKey, port: settings.port,
      addresses: [{ iface: 'Wi-Fi (mock)', address: '192.168.1.40' }],
    }),
    generateShareKey: async () => {
      settings.shareKey = Array.from({ length: 24 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
      return settings.shareKey;
    },
    testRemote: async ({ url }) => (url
      ? { ok: true, model: 'mock-model.gguf', base: url }
      : { ok: false, error: 'Enter an address first.' }),
    applySharing: async () => status,
    listChats: async () => Object.values(chats).map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt, createdAt: c.createdAt })),
    getChat: async (id) => chats[id] || null,
    saveChat: async (c) => { chats[c.id] = JSON.parse(JSON.stringify(c)); },
    deleteChat: async (id) => { delete chats[id]; },
    highlight: (code) => code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
  };
})();
