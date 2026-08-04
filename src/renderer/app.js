/* PriStudio renderer — vanilla JS, no build step. */
const api = window.pristudio;
const $ = (id) => document.getElementById(id);

const ICONS = {
  sidebar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="9" y1="4" x2="9" y2="20"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  sliders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>',
  stop: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  pencil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.83 2.83 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>',
  clip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>',
  image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="6 4 20 12 6 20 6 4"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  // two overlapping bubbles, matching the reference sidebar
  chats: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8.5 14.5H7l-3 2.5v-2.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/><path d="M20 20.5l-3-2.5h-6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2v2.5z"/></svg>',
  // archive tray
  projects: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="5" rx="1.5"/><path d="M5 8v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8"/><line x1="10" y1="12" x2="14" y2="12"/></svg>',
  dots: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>',
};

/* ---------- themes ---------- */

const THEMES = [
  { id: 'dark', name: 'Dark', hint: 'Warm charcoal — the original look', titleBar: '#1f1e1d', symbol: '#b0aea2', bg: '#262624', light: false },
  { id: 'ultradark', name: 'Ultra dark', hint: 'True black — kinder to OLED screens and night eyes', titleBar: '#000000', symbol: '#9b988f', bg: '#0a0a09', light: false },
  { id: 'light', name: 'Light', hint: 'Warm paper — matches the Portico website', titleBar: '#f0eee6', symbol: '#5f5c54', bg: '#faf9f5', light: true },
  { id: 'sepia', name: 'Sepia', hint: 'Amber paper — easiest for long reading', titleBar: '#ebdfc4', symbol: '#6a5c44', bg: '#f4ead6', light: true },
];

// Applied before the first paint (see the bottom of this file) so the window never
// flashes the wrong colour while settings load from disk.
function applyTheme(id) {
  const theme = THEMES.find((t) => t.id === id) || THEMES[0];
  document.documentElement.setAttribute('data-theme', theme.id);
  const link = document.getElementById('hljs-theme');
  if (link) {
    const want = theme.light ? 'vendor/hljs-light.css' : 'vendor/hljs-dark.css';
    if (!link.getAttribute('href').endsWith(want.split('/').pop())) link.setAttribute('href', want);
  }
  try { localStorage.setItem('portico-theme', theme.id); } catch {}
  // the Windows title bar is drawn by the OS, so it has to be told separately
  if (window.pristudio && api.setTitleBarTheme) api.setTitleBarTheme({ color: theme.titleBar, symbolColor: theme.symbol, bg: theme.bg });
  return theme;
}

const S = {
  settings: null,
  chats: [],
  chat: null,
  models: [],
  catalog: [],
  devices: [],
  server: { state: 'stopped', modelPath: null },
  generating: false,
  abort: null,
  view: 'chat',
  tab: 'installed',
  downloads: {}, // id -> progress
  pendingFiles: [], // attachments staged in the composer
  recorder: null,
  transcribing: false,
  projects: [],
  assistants: [],
  activeProjectId: null,
  editingProjectId: null,
  artifact: null,
};

/* ---------- helpers ---------- */

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtBytes(n) {
  if (!n) return '?';
  if (n > 1e9) return (n / 1e9).toFixed(2) + ' GB';
  if (n > 1e6) return (n / 1e6).toFixed(0) + ' MB';
  return (n / 1e3).toFixed(0) + ' KB';
}

function baseName(p) {
  return p ? p.split(/[\\/]/).pop().replace(/\.gguf$/i, '') : '';
}

// "Qwen2.5-Coder-7B-Instruct-Q4_K_M" -> "Qwen2.5 Coder 7B".
// The status strip wants a name a person would say out loud, not the filename:
// the quantisation and the word "Instruct" are on every model and distinguish
// nothing, so they only crowd out the part that matters.
function shortModelName(p) {
  let n = baseName(p);
  if (!n) return '';
  n = n
    // trailing quantisation: -Q4_K_M, .Q8_0, -IQ4_XS, -f16 (the underscores are
    // part of the token, so this has to consume them to reach the end)
    .replace(/[.\-_](?:i?q\d+(?:_[a-z0-9]+)*|f16|fp16|bf16)$/i, '')
    // "instruct"/"chat"/"it" appear on nearly every model and separate nothing
    .replace(/[.\-_](?:instruct|chat|it|sft|hf)(?=[.\-_]|$)/gi, '')
    .replace(/[\-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return n;
}

let toastTimer = null;
function toast(msg, ms = 3200) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

marked.use({
  gfm: true,
  breaks: true,
  renderer: {
    code({ text, lang }) {
      const hl = api.highlight(text, lang || '');
      const art = isArtifact(lang, text)
        ? '<button class="cb-art">Open artifact</button>' : '';
      const runnable = RE_PY_LANG.test(lang || '') ? '<button class="cb-run">▶ Run</button>' : '';
      return `<div class="codeblock" data-lang="${esc(lang || '')}"><div class="cb-head"><span>${esc(lang || 'code')}</span>` +
        `<span class="cb-actions">${runnable}${art}<button class="cb-dl">Download</button><button class="cb-copy">Copy</button></span>` +
        `</div><pre><code class="hljs">${hl}</code></pre></div>`;
    },
  },
});

function renderMd(md) {
  // Reasoning models (DeepSeek R1, Qwen3) wrap their inner monologue in <think> tags —
  // show it as a collapsible block, open while it's still streaming, collapsed once done.
  let src = md || '';
  src = src.replace(/<think>([\s\S]*?)(<\/think>|$)/g, (m0, inner, close) => {
    const body = inner.trim();
    if (!body && close) return '\n\n';
    return '\n\n<details class="think"' + (close ? '' : ' open') +
      '><summary>Thinking…</summary><div class="think-body">' + esc(body) + '</div></details>\n\n';
  });
  return DOMPurify.sanitize(marked.parse(src));
}

/* ---------- views ---------- */

function showView(name) {
  S.view = name;
  $('view-chat').hidden = name !== 'chat';
  $('view-models').hidden = name !== 'models';
  $('view-settings').hidden = name !== 'settings';
  $('view-project').hidden = name !== 'project';
  if (name === 'chat') {
    const proj = currentProject();
    $('header-title').textContent = (S.chat ? S.chat.title : 'New chat') + (proj ? ` · ${proj.name}` : '');
  } else {
    $('header-title').textContent = { models: 'Models', settings: 'Settings', project: 'Project' }[name] || '';
  }
  if (name === 'models') renderModelsView();
  if (name === 'settings') renderSettingsView();
}

/* ---------- text-input modal (Electron forbids window.prompt) ---------- */

function askText({ title, message = '', value = '', placeholder = '', ok = 'OK' }) {
  return new Promise((resolve) => {
    const overlay = $('modal');
    const input = $('modal-input');
    $('modal-title').textContent = title;
    const msgEl = $('modal-message');
    msgEl.textContent = message;
    msgEl.hidden = !message;
    input.value = value;
    input.placeholder = placeholder;
    $('modal-ok').textContent = ok;
    overlay.hidden = false;
    void overlay.offsetWidth;              // force a reflow so the transition still plays…
    overlay.classList.add('open');         // …but visibility never depends on rAF firing
    input.focus();
    input.select();

    const close = (result) => {
      overlay.classList.remove('open');
      setTimeout(() => { overlay.hidden = true; }, 160);
      cleanup();
      resolve(result);
    };
    const onOk = () => close(input.value.trim());
    const onCancel = () => close(null);
    const onKey = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); onOk(); }
      else if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
    };
    const onOverlay = (e) => { if (e.target === overlay) onCancel(); };
    function cleanup() {
      $('modal-ok').removeEventListener('click', onOk);
      $('modal-cancel').removeEventListener('click', onCancel);
      input.removeEventListener('keydown', onKey);
      overlay.removeEventListener('click', onOverlay);
    }
    $('modal-ok').addEventListener('click', onOk);
    $('modal-cancel').addEventListener('click', onCancel);
    input.addEventListener('keydown', onKey);
    overlay.addEventListener('click', onOverlay);
  });
}

/* ---------- projects ---------- */

const newId = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function currentProject() {
  return S.projects.find((p) => p.id === S.activeProjectId) || null;
}

async function refreshProjects() {
  S.projects = await api.listProjects();
  renderProjectList();
}

function renderProjectList() {
  const box = $('project-list');
  if (!box) return;
  const rows = [`<div class="proj-row${!S.activeProjectId ? ' active' : ''}" data-project="">
      <span class="proj-name">All chats</span></div>`];
  for (const p of S.projects) {
    rows.push(`<div class="proj-row${S.activeProjectId === p.id ? ' active' : ''}" data-project="${esc(p.id)}">
      <span class="proj-name">${esc(p.name)}</span>
      <button class="icon-btn proj-edit" data-project="${esc(p.id)}" title="Project settings">${ICONS.gear}</button>
    </div>`);
  }
  box.innerHTML = rows.join('');
  box.querySelectorAll('.proj-row').forEach((row) => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('.proj-edit')) return;
      S.activeProjectId = row.dataset.project || null;
      renderProjectList();
      renderChatList();
      updateSidebarNav();
      if (S.view !== 'chat') showView('chat');
    });
  });
  box.querySelectorAll('.proj-edit').forEach((btn) => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); openProject(btn.dataset.project); });
  });
}

async function createProject() {
  const name = await askText({ title: 'New project', placeholder: 'e.g. Data Analysis course', ok: 'Create' });
  if (!name) return;
  const p = { id: newId('p'), name, systemPrompt: '', files: [], createdAt: Date.now() };
  S.projects = await api.saveProject(p);
  S.activeProjectId = p.id;
  renderProjectList();
  renderChatList();
  openProject(p.id);
}

function openProject(id) {
  const p = S.projects.find((x) => x.id === id);
  if (!p) return;
  S.editingProjectId = id;
  showView('project');
  $('proj-title').textContent = p.name;
  $('proj-name').value = p.name;
  $('proj-prompt').value = p.systemPrompt || '';
  renderProjectFiles(p.files || []);
}

function renderProjectFiles(files) {
  const box = $('proj-files');
  box.innerHTML = files.length
    ? files.map((f, i) => `<span class="file-chip">${ICONS.file}<span class="fc-name">${esc(f.name)}</span>` +
        `<span class="fc-meta">${Math.round((f.chars || 0) / 1000)}k</span>` +
        `<button class="fc-x" data-i="${i}" title="Remove">✕</button></span>`).join('')
    : '<div class="hint">No files yet. Anything you add here is available to every chat in the project.</div>';
  const total = files.reduce((n, f) => n + (f.chars || 0), 0);
  $('proj-files-hint').textContent = total
    ? `${files.length} file(s), ${Math.round(total / 1000)}k characters — trimmed to fit the model's context window.`
    : '';
  box.querySelectorAll('.fc-x').forEach((b) => b.addEventListener('click', () => {
    const p = S.projects.find((x) => x.id === S.editingProjectId);
    p.files.splice(+b.dataset.i, 1);
    renderProjectFiles(p.files);
  }));
}

/* ---------- assistants ---------- */

async function refreshAssistants() {
  S.assistants = await api.listAssistants();
  renderAssistantPicker();
}

function renderAssistantPicker() {
  const sel = $('p-assistant');
  if (!sel) return;
  const active = S.chat && S.chat.assistantId;
  sel.innerHTML = '<option value="">None — use the settings below</option>' +
    S.assistants.map((a) => `<option value="${esc(a.id)}" ${active === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('');
}

function applyAssistant(a) {
  if (!a) return;
  $('p-system').value = a.systemPrompt || '';
  if (a.temperature !== undefined) { $('p-temp').value = a.temperature; $('p-temp-v').textContent = a.temperature; }
  if (a.topP !== undefined) { $('p-topp').value = a.topP; $('p-topp-v').textContent = a.topP; }
  if (a.maxTokens !== undefined) $('p-maxtok').value = a.maxTokens;
  panelSave();
  if (a.modelPath && S.models.some((m) => m.path === a.modelPath) && S.server.modelPath !== a.modelPath) {
    $('composer-model').value = a.modelPath;
    loadModelFromUi(a.modelPath);
  }
}

async function saveCurrentAsAssistant() {
  const name = await askText({ title: 'Save as assistant', placeholder: 'e.g. Study tutor, Code reviewer', ok: 'Save' });
  if (!name) return;
  const a = {
    id: newId('a'),
    name,
    systemPrompt: $('p-system').value,
    temperature: parseFloat($('p-temp').value),
    topP: parseFloat($('p-topp').value),
    maxTokens: parseInt($('p-maxtok').value, 10) || 2048,
    modelPath: $('composer-model').value && $('composer-model').value !== '__none' ? $('composer-model').value : '',
  };
  S.assistants = await api.saveAssistant(a);
  if (S.chat) { S.chat.assistantId = a.id; await saveCurrentChat(); }
  renderAssistantPicker();
  $('p-assistant').value = a.id;
  toast('Assistant "' + a.name + '" saved');
}

async function manageAssistants() {
  if (!S.assistants.length) { toast('No assistants saved yet'); return; }
  const sel = $('p-assistant');
  const current = S.assistants.find((a) => a.id === sel.value);
  if (!current) { toast('Pick an assistant in the list above, then Manage to delete it'); return; }
  if (!confirm(`Delete the assistant "${current.name}"? Chats already using it keep their settings.`)) return;
  S.assistants = await api.deleteAssistant(current.id);
  renderAssistantPicker();
  toast('Deleted "' + current.name + '"');
}

/* ---------- sidebar / chat list ---------- */

function groupLabel(ts) {
  const d = new Date(ts);
  const now = new Date();
  const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const today = startOfDay(now);
  const diffDays = Math.floor((today - startOfDay(d)) / 86400000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return 'Previous 7 days';
  if (diffDays < 30) return 'Previous 30 days';
  return 'Older';
}

function renderChatList() {
  const q = $('search').value.trim().toLowerCase();
  const list = $('chat-list');
  list.innerHTML = '';
  let lastGroup = null;
  for (const c of S.chats) {
    if (q && !c.title.toLowerCase().includes(q)) continue;
    if (S.activeProjectId && c.projectId !== S.activeProjectId) continue;
    const g = groupLabel(c.updatedAt || c.createdAt || Date.now());
    if (g !== lastGroup) {
      lastGroup = g;
      const gl = document.createElement('div');
      gl.className = 'chat-group-label';
      gl.textContent = g;
      list.appendChild(gl);
    }
    const item = document.createElement('div');
    item.className = 'chat-item' + (S.chat && S.chat.id === c.id ? ' active' : '');
    item.innerHTML = `<div class="chat-name">${esc(c.title)}</div>` +
      `<div class="chat-actions">` +
      `<button class="icon-btn a-more" title="More">${ICONS.dots}</button></div>`;
    item.querySelector('.chat-name').addEventListener('click', () => openChat(c.id));

    const doDelete = async () => {
      await api.deleteChat(c.id);
      S.chats = S.chats.filter((x) => x.id !== c.id);
      if (S.chat && S.chat.id === c.id) newChat();
      renderChatList();
    };
    item.querySelector('.a-more').addEventListener('click', (e) => {
      e.stopPropagation();
      openRowMenu(e.currentTarget, [
        { label: 'Rename', run: () => startRename() },
        { label: 'Delete', danger: true, run: doDelete },
      ]);
    });

    const startRename = () => {
      const input = document.createElement('input');
      input.className = 'rename';
      input.value = c.title;
      item.innerHTML = '';
      item.appendChild(input);
      input.focus();
      input.select();
      const commit = async () => {
        const title = input.value.trim() || c.title;
        c.title = title;
        const full = await api.getChat(c.id);
        if (full) { full.title = title; await api.saveChat(full); }
        if (S.chat && S.chat.id === c.id) { S.chat.title = title; $('header-title').textContent = title; }
        renderChatList();
      };
      input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') input.blur();
        if (ev.key === 'Escape') { input.value = c.title; input.blur(); }
      });
      input.addEventListener('blur', commit);
    };
    list.appendChild(item);
  }
}

// Small popup anchored to a row's "…" button. One at a time; any click, scroll or
// Escape dismisses it.
function openRowMenu(anchor, items, place) {
  document.querySelectorAll('.row-menu').forEach((m) => m.remove());
  const menu = document.createElement('div');
  menu.className = 'row-menu';
  for (const it of items) {
    const b = document.createElement('button');
    b.className = 'row-menu-item' + (it.danger ? ' danger' : '');
    b.textContent = it.label;
    b.addEventListener('click', (e) => { e.stopPropagation(); menu.remove(); it.run(); });
    menu.appendChild(b);
  }
  document.body.appendChild(menu);
  const r = anchor.getBoundingClientRect();
  // flip above the button when asked to, or when there is no room below
  const below = place !== 'up' && window.innerHeight - r.bottom > menu.offsetHeight + 8;
  menu.style.left = Math.min(r.left, window.innerWidth - menu.offsetWidth - 8) + 'px';
  menu.style.top = (below ? r.bottom + 4 : r.top - menu.offsetHeight - 4) + 'px';
  // Force the reflow, then add the class synchronously. requestAnimationFrame does
  // NOT fire while the window is occluded, which would leave the menu stuck at
  // opacity 0 — the same trap the modals hit.
  void menu.offsetWidth;
  menu.classList.add('open');

  const close = () => { menu.remove(); document.removeEventListener('click', close); window.removeEventListener('keydown', onKey, true); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  setTimeout(() => document.addEventListener('click', close), 0);
  window.addEventListener('keydown', onKey, true);
}

/* ---------- chat ---------- */

function newChat() {
  stopGeneration();
  S.chat = null;
  $('messages').innerHTML = '';
  $('view-chat').classList.add('empty');
  $('empty-state').hidden = false;
  $('header-title').textContent = 'New chat';
  showView('chat');
  renderChatList();
  $('input').focus();
}

async function openChat(id) {
  stopGeneration();
  const chat = await api.getChat(id);
  if (!chat) return;
  S.chat = chat;
  showView('chat');
  $('view-chat').classList.remove('empty');
  $('empty-state').hidden = true;
  $('header-title').textContent = chat.title;
  renderMessages();
  renderChatList();
  scrollToBottom(true);
}

function ensureChat() {
  if (S.chat) return S.chat;
  S.chat = {
    id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    title: 'New chat',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
    projectId: S.activeProjectId || null,   // new chats join the selected project
    assistantId: null,
  };
  $('view-chat').classList.remove('empty');
  $('empty-state').hidden = true;
  return S.chat;
}

function messageEl(msg, idx) {
  const div = document.createElement('div');
  if (msg.role === 'user') {
    div.className = 'msg msg-user';
    const chips = (msg.attachments || []).map((a) => fileChipHtml(a, false)).join('');
    let srcs = '';
    if (msg.search && msg.search.results && msg.search.results.length) {
      srcs = `<div class="msg-sources">${ICONS.globe}<span class="src-label">Sources</span>${sourceChipsHtml(msg.search.results)}</div>`;
    } else if (msg.searchFailed) {
      // never let a failed search masquerade as a grounded answer
      srcs = `<div class="msg-sources search-failed">${ICONS.globe}<span class="src-label">Web search unavailable — answered from the model’s own knowledge</span></div>`;
    }
    div.innerHTML = `<div class="bubble">${chips ? `<div class="bubble-files">${chips}</div>` : ''}${esc(msg.content)}</div>${srcs}`;
  } else if (msg.image) {
    div.className = 'msg msg-assistant msg-image';
    div.innerHTML = imageBlockHtml(msg.image);
  } else if (msg.pyrun) {
    div.className = 'msg msg-assistant msg-pyrun';
    div.innerHTML = pyResultHtml(msg.pyrun);
  } else {
    div.className = 'msg msg-assistant';
    div.innerHTML = `<div class="md">${renderMd(msg.content)}</div>` +
      `<div class="msg-actions">` +
      `<button class="icon-btn a-copy" title="Copy">${ICONS.copy}</button>` +
      `<button class="icon-btn a-regen" title="Regenerate" hidden>${ICONS.refresh}</button></div>`;
    div.querySelector('.a-copy').addEventListener('click', () => {
      navigator.clipboard.writeText(msg.content);
      toast('Copied');
    });
    div.querySelector('.a-regen').addEventListener('click', () => regenerate());
  }
  div.dataset.idx = idx;
  return div;
}

function renderMessages() {
  const box = $('messages');
  box.innerHTML = '';
  if (!S.chat) return;
  S.chat.messages.forEach((m, i) => box.appendChild(messageEl(m, i)));
  updateRegenVisibility();
}

function updateRegenVisibility() {
  const box = $('messages');
  box.querySelectorAll('.a-regen').forEach((b) => { b.hidden = true; });
  if (!S.chat || S.generating) return;
  const last = S.chat.messages[S.chat.messages.length - 1];
  if (last && last.role === 'assistant') {
    const lastEl = box.lastElementChild;
    const btn = lastEl && lastEl.querySelector('.a-regen');
    if (btn) btn.hidden = false;
  }
}

function nearBottom() {
  const sc = $('chat-scroll');
  return sc.scrollHeight - sc.scrollTop - sc.clientHeight < 120;
}

function scrollToBottom(force) {
  const sc = $('chat-scroll');
  if (force || nearBottom()) sc.scrollTop = sc.scrollHeight;
}

/* ---------- server / model handling ---------- */

function updatePill() {
  const dot = $('pill-dot');
  const text = $('pill-text');
  const st = S.server;

  // In client mode the local engine is deliberately idle — reporting "no model
  // loaded" would look broken, so show where the model actually is instead.
  if (S.settings && S.settings.remoteMode) {
    dot.className = 'dot ready';
    const host = (S.settings.remoteUrl || '').replace(/^https?:\/\//, '') || 'another computer';
    text.textContent = S.remoteModel ? `${S.remoteModel} · ${host}` : host;
    renderStatusStrip();
    return;
  }

  dot.className = 'dot ' + st.state;
  if (st.state === 'ready') text.textContent = baseName(st.modelPath);
  else if (st.state === 'starting') text.textContent = 'Loading ' + baseName(st.modelPath) + '…';
  else if (st.state === 'error') text.textContent = 'Engine error';
  else text.textContent = 'No model loaded';

  const sel = $('composer-model');
  if (st.state === 'ready' && st.modelPath && sel.value !== st.modelPath) sel.value = st.modelPath;
  renderStatusStrip();
}

function showError(msg) {
  $('error-text').textContent = msg;
  $('error-banner').hidden = false;
}

// In client mode, ask the host what it is serving so the pill can name the model
// and an unreachable host is reported before the user types a whole message.
async function refreshRemoteStatus() {
  const s = S.settings;
  if (!s || !s.remoteMode || !s.remoteUrl) { S.remoteModel = null; return; }
  const r = await api.testRemote({ url: s.remoteUrl, key: s.remoteKey });
  S.remoteModel = r.ok ? r.model : null;
  if (!r.ok) showError('Cannot reach the host machine: ' + r.error);
  else $('error-banner').hidden = true;
  updatePill();
}

api.onServerStatus((st) => {
  S.server = st;
  updatePill();
  if (st.state === 'error' && st.error) showError(st.error);
  if (st.state === 'ready') $('error-banner').hidden = true;
  if (S.view === 'models') renderModelsView();
});

// The reply is streamed by the main process (so the engine's access key never
// reaches this page) and arrives as events. Only one generation runs at a time,
// so a single set of hooks is enough — same shape as S.imageHooks.
api.onChatChunk((data) => { if (S.chatHooks) S.chatHooks.chunk(data); });
api.onChatDone(() => { if (S.chatHooks) S.chatHooks.done(); });
api.onChatError((e) => { if (S.chatHooks) S.chatHooks.error(e); });

function waitForReady(timeoutMs = 120000) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const iv = setInterval(() => {
      if (S.server.state === 'ready') { clearInterval(iv); resolve(true); }
      else if (S.server.state === 'error' || Date.now() - t0 > timeoutMs) { clearInterval(iv); resolve(false); }
    }, 300);
  });
}

async function ensureModelLoaded() {
  // In client mode the model lives on the host machine — there is nothing to load
  // here, and the host is responsible for having one ready.
  if (S.settings && S.settings.remoteMode) return true;
  if (S.server.state === 'ready') return true;
  if (S.server.state === 'starting') return waitForReady();
  const sel = $('composer-model').value;
  if (!sel || sel === '__none') {
    toast('No model — open Models and download one first');
    showView('models');
    return false;
  }
  api.loadModel(sel);
  S.server = { state: 'starting', modelPath: sel };
  updatePill();
  return waitForReady();
}

async function loadModelFromUi(path) {
  $('error-banner').hidden = true;
  api.loadModel(path);
}

function refreshComposerModels() {
  const sel = $('composer-model');
  sel.innerHTML = '';
  if (!S.models.length) {
    const o = document.createElement('option');
    o.value = '__none';
    o.textContent = 'No models installed';
    sel.appendChild(o);
    return;
  }
  for (const m of S.models) {
    const o = document.createElement('option');
    o.value = m.path;
    o.textContent = m.name;
    sel.appendChild(o);
  }
  const preferred = S.server.modelPath || S.settings.lastModelPath;
  if (preferred && S.models.some((m) => m.path === preferred)) sel.value = preferred;
}

/* ---------- generation ---------- */

function setGenerating(on) {
  S.generating = on;
  $('btn-send').innerHTML = on ? ICONS.stop : ICONS.up;
  $('btn-send').title = on ? 'Stop' : 'Send';
  updateRegenVisibility();
}

function stopGeneration() {
  if (S.abort) { S.abort.abort(); S.abort = null; }
  setGenerating(false);
}

async function saveCurrentChat() {
  if (!S.chat) return;
  S.chat.updatedAt = Date.now();
  await api.saveChat(S.chat);
  const idx = S.chats.findIndex((c) => c.id === S.chat.id);
  // projectId/assistantId must ride along, or the chat disappears from its project filter
  const entry = { id: S.chat.id, title: S.chat.title, updatedAt: S.chat.updatedAt, createdAt: S.chat.createdAt, projectId: S.chat.projectId || null, assistantId: S.chat.assistantId || null };
  if (idx >= 0) S.chats[idx] = entry; else S.chats.unshift(entry);
  S.chats.sort((a, b) => b.updatedAt - a.updatedAt);
  renderChatList();
}

async function send() {
  if (S.generating) { stopGeneration(); return; }
  const input = $('input');
  const text = input.value.trim();
  const files = S.pendingFiles.slice();
  if (!text && !files.length) return;

  // don't let an image be silently dropped because a text-only model is loaded
  if (files.some((f) => f.isImage) && !currentModelHasVision()) {
    const vision = S.models.filter((m) => m.vision);
    const msg = vision.length
      ? `The loaded model cannot see images. Switch to ${vision[0].name} first — send anyway (the image will be ignored)?`
      : 'The loaded model cannot see images, and no vision model is installed. Send anyway (the image will be ignored)?';
    if (!confirm(msg)) return;
  }

  const imageCmd = text.match(RE_IMAGE_CMD);
  if (imageCmd) {
    input.value = '';
    autoGrow(input);
    await runImageGeneration(imageCmd[2].trim());
    return;
  }

  const chat = ensureChat();
  const msg = { role: 'user', content: text };
  if (files.length) msg.attachments = files;
  chat.messages.push(msg);
  if (chat.messages.filter((m) => m.role === 'user').length === 1) {
    const t = text || files.map((f) => f.name).join(', ');
    chat.title = t.replace(/\s+/g, ' ').slice(0, 48) + (t.length > 48 ? '…' : '');
    $('header-title').textContent = chat.title;
  }
  input.value = '';
  S.pendingFiles = [];
  renderAttachStrip();
  autoGrow(input);
  renderMessages();
  $('messages').lastElementChild?.classList.add('msg-new'); // animate just this one
  scrollToBottom(true);
  await saveCurrentChat();

  const plan = searchPlan(text, chat);
  if (plan.search) {
    setGenerating(true);
    const status = document.createElement('div');
    status.className = 'search-status';
    status.innerHTML = `${ICONS.globe}<span>Searching the web for “${esc(plan.query.slice(0, 60))}”…</span>`;
    $('messages').appendChild(status);
    scrollToBottom(true);
    try {
      const res = await api.webSearch(plan.query);
      if (res && res.error) {
        msg.searchFailed = res.error;
        toast('Search failed — answering from the model’s own knowledge');
      } else if (res && res.results && res.results.length) {
        msg.search = res;
        const read = res.results.filter((r) => r.fetched).length;
        status.innerHTML = `${ICONS.globe}<span>Read ${read} of ${res.results.length} results via ${esc(res.engine)}</span>`;
      }
    } catch (err) {
      msg.searchFailed = err.message;
      toast('Search failed — answering from the model’s own knowledge');
    }
    status.remove();
    setGenerating(false);
    if (S.chat !== chat) return; // user switched chats while we searched
    renderMessages();
    $('messages').lastElementChild?.classList.add('msg-new'); // fade the sources in
    scrollToBottom(true);
    await saveCurrentChat();
  }

  await streamAssistantReply();
}

async function regenerate() {
  if (S.generating || !S.chat) return;
  const msgs = S.chat.messages;
  if (msgs.length && msgs[msgs.length - 1].role === 'assistant') msgs.pop();
  renderMessages();
  await streamAssistantReply();
}

async function streamAssistantReply() {
  const chat = S.chat;
  setGenerating(true);

  const ok = await ensureModelLoaded();
  if (!ok || S.chat !== chat) { setGenerating(false); return; }

  const asstMsg = { role: 'assistant', content: '' };
  chat.messages.push(asstMsg);
  const el = messageEl(asstMsg, chat.messages.length - 1);
  el.classList.add('msg-new');
  $('messages').appendChild(el);
  const mdDiv = el.querySelector('.md');
  mdDiv.innerHTML = '<span class="cursor"></span>';
  scrollToBottom(true);

  const s = S.settings;
  const built = buildApiMessages(chat.messages.slice(0, -1));
  const apiMessages = built.messages;
  updateContextMeter(built);

  let t0 = 0; // set on first token so speed reflects generation only
  let tokens = 0;
  let renderQueued = false;
  const queueRender = () => {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      mdDiv.innerHTML = renderMd(asstMsg.content) + (S.generating ? '<span class="cursor"></span>' : '');
      scrollToBottom(false);
    });
  };

  await new Promise((resolve) => {
    let settled = false;
    // stopping is a normal outcome, not a failure — the partial reply is kept
    const finish = (err) => {
      if (settled) return;
      settled = true;
      S.chatHooks = null;
      if (err) {
        asstMsg.content += (asstMsg.content ? '\n\n' : '') + '*[Error: ' + err.message + ']*';
        toast('Generation failed: ' + err.message);
      }
      resolve();
    };

    S.chatHooks = {
      chunk: (payload) => {
        try {
          const j = JSON.parse(payload);
          const delta = j.choices && j.choices[0] && j.choices[0].delta;
          if (delta && delta.content) {
            if (!t0) t0 = Date.now();
            asstMsg.content += delta.content;
            tokens++;
            queueRender();
          }
        } catch {}
      },
      done: () => finish(null),
      error: (e) => finish(new Error((e && e.message) || 'Engine error')),
    };

    // keeps the existing stop button working: same .abort() shape as AbortController
    S.abort = { abort: () => { api.chatAbort(); finish(null); } };

    api.chatStart({
      messages: apiMessages,
      stream: true,
      temperature: s.temperature,
      top_p: s.topP,
      max_tokens: effortMaxTokens(),
    }).catch((e) => finish(new Error(e.message)));
  });

  S.abort = null;
  setGenerating(false);
  if (!asstMsg.content) {
    chat.messages.pop();
    renderMessages();
  } else {
    mdDiv.innerHTML = renderMd(asstMsg.content);
    const secs = t0 ? (Date.now() - t0) / 1000 : 0;
    if (tokens > 3 && secs > 0.3) $('gen-speed').textContent = (tokens / secs).toFixed(1) + ' tok/s';
    updateRegenVisibility();
  }
  scrollToBottom(false);
  if (S.chat === chat) await saveCurrentChat();
}

/* ---------- models view ---------- */

function renderModelsView() {
  $('tab-installed').hidden = S.tab !== 'installed';
  $('tab-discover').hidden = S.tab !== 'discover';
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === S.tab));

  const inst = $('tab-installed');
  inst.innerHTML = '';
  if (!S.models.length) {
    inst.innerHTML = '<div class="empty-note">No models installed yet — open the Discover tab to download one.</div>';
  }
  for (const m of S.models) {
    const loaded = S.server.state === 'ready' && S.server.modelPath === m.path;
    const loading = S.server.state === 'starting' && S.server.modelPath === m.path;
    const card = document.createElement('div');
    card.className = 'model-card';
    card.innerHTML =
      `<div class="info"><div class="name">${esc(m.name)}</div>` +
      `<div class="meta">${fmtBytes(m.sizeBytes)}${m.quant ? ' · ' + esc(m.quant) : ''}</div></div>` +
      `<div class="actions">` +
      (loaded ? '<span class="badge loaded">Loaded</span><button class="btn b-unload">Unload</button>'
        : loading ? '<span class="badge">Loading…</span>'
        : '<button class="btn primary b-load">Load</button>') +
      `<button class="icon-btn b-del" title="Delete file">${ICONS.trash}</button></div>`;
    card.querySelector('.b-load')?.addEventListener('click', () => loadModelFromUi(m.path));
    card.querySelector('.b-unload')?.addEventListener('click', () => api.unloadModel());
    card.querySelector('.b-del')?.addEventListener('click', async () => {
      if (!confirm(`Delete ${m.name} (${fmtBytes(m.sizeBytes)}) from disk?`)) return;
      await api.deleteModel(m.path);
      await refreshModels();
      renderModelsView();
    });
    inst.appendChild(card);
  }
  const openBtn = document.createElement('button');
  openBtn.className = 'btn';
  openBtn.textContent = 'Open models folder';
  openBtn.style.marginTop = '8px';
  openBtn.addEventListener('click', () => api.openModelsFolder());
  inst.appendChild(openBtn);

  const disc = $('tab-discover');
  disc.innerHTML = '';
  let lastCat = null;
  for (const m of S.catalog) {
    const cat = m.cat || 'Models';
    if (cat !== lastCat) {
      lastCat = cat;
      const h = document.createElement('div');
      h.className = 'model-group-label';
      h.textContent = cat;
      disc.appendChild(h);
    }
    const card = document.createElement('div');
    card.className = 'model-card';
    const dl = S.downloads[m.id];
    const downloading = dl && !dl.done && !dl.error && !dl.cancelled;
    let actions;
    if (m.installed) actions = '<span class="badge loaded">Installed</span>';
    else if (downloading) actions = '<button class="btn b-cancel">Cancel</button>';
    else actions = `<button class="btn primary b-dl">${m.partial ? 'Resume' : 'Download'}</button>`;
    card.innerHTML =
      `<div class="info"><div class="name">${esc(m.name)}</div>` +
      `<div class="meta">~${m.sizeGB} GB · GGUF</div>` +
      `<div class="desc">${esc(m.desc)}</div>` +
      (downloading
        ? `<div class="progress-wrap"><div class="progress-bar"><div style="width:${dl.total ? (100 * dl.received / dl.total).toFixed(1) : 0}%"></div></div>` +
          `<div class="progress-label">${fmtBytes(dl.received)} / ${fmtBytes(dl.total)} · ${fmtBytes(dl.speed)}/s</div></div>`
        : '') +
      `</div><div class="actions">${actions}</div>`;
    card.querySelector('.b-dl')?.addEventListener('click', async () => {
      S.downloads[m.id] = { received: 0, total: m.sizeGB * 1e9, speed: 0 };
      await api.downloadModel(m.id);
      renderModelsView();
    });
    card.querySelector('.b-cancel')?.addEventListener('click', () => api.cancelDownload(m.id));
    disc.appendChild(card);
  }
}

api.onDownloadProgress(async (p) => {
  S.downloads[p.id] = p;
  if (p.done) {
    toast('Download complete');
    await refreshModels();
    S.catalog = await api.getCatalog();
  }
  if (p.error) toast('Download failed: ' + p.error);
  if (p.cancelled) S.catalog = await api.getCatalog();
  if (S.view === 'models') renderModelsView();
});

async function refreshModels() {
  S.models = await api.listModels();
  refreshComposerModels();
}

/* ---------- search engine picker ---------- */

const KIND_LABEL = {
  web: 'general web', news: 'news', tech: 'coding', academic: 'science',
  markets: 'prediction markets', flights: 'flights', shopping: 'shopping',
};

function engineOn(id) {
  const chosen = (S.settings && S.settings.searchEngines) || {};
  return chosen[id] === undefined ? id !== 'brave' : !!chosen[id];
}

async function renderEngineList() {
  const box = $('engine-list');
  if (!box) return;
  if (!S.engines) S.engines = await api.searchEngines();
  box.innerHTML = S.engines.map((e) => {
    const noKey = e.needsKey && !((S.settings.braveApiKey || '').trim());
    return `<label class="engine-row${noKey ? ' disabled' : ''}">
      <input type="checkbox" data-engine="${esc(e.id)}" ${engineOn(e.id) ? 'checked' : ''} ${noKey ? 'disabled' : ''} />
      <span class="eng-main">
        <span class="eng-name">${esc(e.label)}<span class="eng-kind">${esc(KIND_LABEL[e.kind] || e.kind)}</span>
          <span class="eng-status" data-status="${esc(e.id)}"></span></span>
        <span class="eng-desc">${esc(e.desc)}${noKey ? ' — add the API key below to enable.' : ''}</span>
      </span>
    </label>`;
  }).join('');
  box.querySelectorAll('input[data-engine]').forEach((cb) => {
    cb.addEventListener('change', async () => {
      const map = { ...(S.settings.searchEngines || {}), [cb.dataset.engine]: cb.checked };
      // update local state before awaiting, or two quick clicks lose one another's change
      S.settings.searchEngines = map;
      S.settings = await api.saveSettings({ searchEngines: map });
    });
  });
}

function renderThemePicker() {
  const box = $('theme-grid');
  if (!box) return;
  const active = (S.settings && S.settings.theme) || 'dark';
  box.innerHTML = THEMES.map((t) => `
    <button class="theme-card${t.id === active ? ' active' : ''}" data-theme-id="${t.id}" title="${esc(t.hint)}">
      <span class="theme-swatch" data-swatch="${t.id}">
        <span class="ts-side"></span><span class="ts-main"><span class="ts-bubble"></span><span class="ts-line"></span></span>
      </span>
      <span class="theme-name">${esc(t.name)}</span>
      <span class="theme-hint">${esc(t.hint)}</span>
    </button>`).join('');
  box.querySelectorAll('.theme-card').forEach((card) => {
    card.addEventListener('click', async () => {
      const id = card.dataset.themeId;
      applyTheme(id);
      S.settings = await api.saveSettings({ theme: id });
      box.querySelectorAll('.theme-card').forEach((c) => c.classList.toggle('active', c === card));
      toast(`${THEMES.find((t) => t.id === id).name} theme applied`);
    });
  });
}

async function wireAboutSection() {
  const st = await api.updateState();
  $('s-version').textContent = 'v' + st.version + (st.isDev ? ' (running from source)' : '');

  $('s-logs').addEventListener('click', () => api.openLogs());
  $('s-diag').addEventListener('click', async () => {
    const d = await api.diagnostics();
    const text = [
      `Portico ${d.version} · Electron ${d.electron}`,
      `${d.os} · ${d.cpus} CPU cores · ${d.ramGB} GB RAM`,
      `Settings: ${JSON.stringify(d.settings)}`,
      `Engine: ${d.server.state}${d.server.modelPath ? ' — ' + d.server.modelPath.split(/[\\/]/).pop() : ''}`,
      `Chat models: ${d.chatModels.join(', ') || 'none'}`,
      `Image models: ${d.imageModels.join(', ') || 'none'} · Voice: ${d.voiceModels.join(', ') || 'none'}`,
      '',
      '--- recent log ---',
      d.logTail,
    ].join('\n');
    await navigator.clipboard.writeText(text);
    toast('Diagnostics copied to the clipboard');
  });

  $('s-update').addEventListener('click', async () => {
    const btn = $('s-update');
    btn.disabled = true;
    $('s-update-hint').textContent = 'Checking…';
    const r = await api.updateCheck();
    btn.disabled = false;
    if (r.status === 'dev') $('s-update-hint').textContent = r.message;
    else if (r.status === 'unconfigured') $('s-update-hint').textContent = r.message;
    else if (r.status === 'error') $('s-update-hint').textContent = 'Update check failed: ' + r.message;
    else $('s-update-hint').textContent = 'Checked. You will be told here if a newer version exists.';
  });
}

// Update progress arrives from the main process whenever a check is running.
function wireUpdateEvents() {
  api.onUpdateState(async (s) => {
    const hint = $('s-update-hint');
    if (s.status === 'available') {
      if (confirm(`Portico ${s.version} is available. Download it now?`)) api.updateDownload();
    } else if (s.status === 'downloading' && hint) {
      hint.textContent = `Downloading update… ${s.percent}%`;
    } else if (s.status === 'ready') {
      if (confirm(`Portico ${s.version} is ready. Restart to install it now?`)) api.updateInstall();
      else toast('The update will install next time you close Portico');
    } else if (s.status === 'current' && hint) {
      hint.textContent = 'You are on the latest version.';
    }
  });
}

async function renderImageModelPicker() {
  const sel = $('s-imgmodel');
  if (!sel) return;
  const st = await api.imageStatus();
  if (!st.models.length) {
    sel.innerHTML = '<option>No image model installed</option>';
    $('s-imgmodel-hint').textContent = 'Download one from Models → Discover → Image generation.';
    return;
  }
  sel.innerHTML = st.models.map((m) =>
    `<option value="${esc(m.path)}" ${S.settings.imageModel === m.path ? 'selected' : ''}>${esc(m.name)} (${(m.sizeBytes / 1e9).toFixed(1)} GB)</option>`).join('');
  if (!S.settings.imageModel) sel.value = st.models[0].path;
  const describe = () => {
    const n = sel.value.toLowerCase();
    $('s-imgmodel-hint').textContent = /turbo|xl/.test(n)
      ? 'SDXL-class: sharper and more photographic, but roughly 5× slower on a 4 GB GPU. Portico runs it at 4 steps and 4-bit automatically.'
      : 'SD 1.5-class: about 15 seconds per 512px image on this machine.';
  };
  describe();
  sel.addEventListener('change', describe);

  // Rough cost warning, from what this machine actually measured:
  // SD 1.5 at 512/20 ≈ 15 s; time scales with pixels and with steps.
  const estimate = () => {
    const el = $('s-img-estimate');
    if (!el) return;
    const xl = /turbo|xl/i.test(sel.value);
    const size = parseInt($('s-imgsize').value, 10) || (xl ? 768 : 512);
    const steps = parseInt($('s-imgsteps').value, 10) || (xl && /turbo/i.test(sel.value) ? 4 : 20);
    const secs = Math.round(15 * (xl ? 3.2 : 1) * ((size * size) / (512 * 512)) * (steps / 20));
    el.textContent = secs > 90
      ? `About ${Math.round(secs / 60)} minute${secs >= 120 ? 's' : ''} per image at these settings — you can cancel a running one.`
      : `Roughly ${secs}s per image at these settings.`;
    el.style.color = secs > 180 ? 'var(--warn)' : '';
  };
  estimate();
  ['s-imgsize', 's-imgsteps'].forEach((idv) => $(idv) && $(idv).addEventListener('change', estimate));
  sel.addEventListener('change', estimate);
}

async function testEngines() {
  const btn = $('s-test');
  btn.disabled = true;
  $('test-status').textContent = 'Testing each engine with a sample search…';
  document.querySelectorAll('.eng-status').forEach((el) => { el.textContent = '…'; el.className = 'eng-status'; });
  try {
    const rows = await api.testSearchEngines();
    let ok = 0;
    for (const r of rows) {
      const el = document.querySelector(`.eng-status[data-status="${r.id}"]`);
      if (!el) continue;
      if (r.skipped) { el.textContent = r.reason; el.className = 'eng-status off'; }
      else if (r.ok) { ok++; el.textContent = `${r.count} results · ${(r.ms / 1000).toFixed(1)}s`; el.className = 'eng-status ok'; }
      else { el.textContent = String(r.error).slice(0, 60); el.className = 'eng-status bad'; }
    }
    $('test-status').textContent = `${ok} of ${rows.filter((r) => !r.skipped).length} enabled engines working right now.`;
  } catch (e) {
    $('test-status').textContent = 'Test failed: ' + e.message;
  }
  btn.disabled = false;
}

/* ---------- settings view ---------- */

async function renderSettingsView() {
  const s = S.settings;
  S.devices = await api.listDevices();
  const form = $('settings-form');
  form.innerHTML = `
    <label class="field"><span>Models folder</span>
      <div class="field-row">
        <input id="s-dir" type="text" value="${esc(s.modelsDir)}" spellcheck="false" />
        <button class="btn" id="s-open">Open</button>
      </div>
    </label>
    <label class="field"><span>GPU device</span>
      <select id="s-device">
        <option value="auto">Auto${s.measuredDevice ? ' (measured: ' + esc(s.measuredDevice) + ')' : ' (prefer fastest GPU)'}</option>
        ${S.devices.map((d) => `<option value="${esc(d.id)}" ${s.device === d.id ? 'selected' : ''}>${esc(d.id)} — ${esc(d.name)} (${d.totalMiB} MiB)</option>`).join('')}
      </select>
      <span class="hint">Detected: ${S.devices.map((d) => esc(d.name)).join(' · ') || 'none (CPU mode)'}</span>
      <div class="field-row" style="margin-top:6px">
        <button class="btn" id="s-bench">Test graphics cards</button>
        <span class="hint" id="s-bench-status"></span>
      </div>
      <div id="s-bench-results" class="bench-results"></div>
      <span class="hint">The fastest card is not always the biggest one. On laptops the
        discrete GPU is sometimes powered down by the driver, which makes it far slower
        than the built-in graphics — testing measures what is actually true on this machine.</span>
    </label>
    <label class="field"><span>Context size <em>memory used for conversation history</em></span>
      <select id="s-ctx">
        ${[2048, 4096, 8192, 16384, 32768, 65536, 131072].map((v) => `<option value="${v}" ${s.contextSize === v ? 'selected' : ''}>${v >= 65536 ? v + ' (needs lots of RAM/VRAM)' : v}</option>`).join('')}
      </select>
      <span class="hint">65536+ only works on models that support long context (Llama 3.1, Mistral Nemo…).</span>
    </label>
    <label class="field"><span>GPU layers <em>99 = automatic (offloads as much as fits in VRAM)</em></span>
      <input id="s-ngl" type="number" min="0" max="99" value="${s.gpuLayers}" />
      <span class="hint">Leave at 99 unless you know why — a lower number forces fewer layers onto the GPU.</span>
    </label>
    <label class="field"><span>Engine port</span>
      <input id="s-port" type="number" min="1024" max="65535" value="${s.port}" />
      <span class="hint">Applies after restarting the app.</span>
    </label>

    <div class="settings-sep">Shared engine</div>
    <div class="field">
      <span>Run the model somewhere else, or let others use this machine.</span>
      <span class="hint">One computer with a good graphics card can serve everyone else on the
        same network. Chats, files and projects always stay on each person's own machine —
        only the model runs on the host.</span>
    </div>

    <label class="check-row">
      <input id="s-remote" type="checkbox" ${s.remoteMode ? 'checked' : ''} />
      <span>Run the model somewhere else <em>(this machine stops running its own)</em></span>
    </label>
    <div id="s-remote-box" class="net-box" ${s.remoteMode ? '' : 'hidden'}>
      <label class="field"><span>Where</span>
        <select id="s-provider"></select>
        <span class="hint" id="s-provider-note"></span>
      </label>
      <label class="field"><span id="s-url-label">Host address</span>
        <input id="s-remoteurl" type="text" placeholder="192.168.1.40:8033"
               value="${esc(s.remoteUrl || '')}" spellcheck="false" />
      </label>
      <label class="field" id="s-model-field" hidden><span>Model name</span>
        <input id="s-remotemodel" type="text" placeholder="e.g. phala/deepseek-r1-70b"
               value="${esc(s.remoteModelName || '')}" spellcheck="false" />
        <span class="hint">A hosted service runs many models, so it needs to be told which one.</span>
      </label>
      <label class="field"><span id="s-key-label">Access key</span>
        <input id="s-remotekey" type="password" placeholder="paste the key from the host"
               value="${esc(s.remoteKey || '')}" spellcheck="false" />
      </label>
      <div class="field-row">
        <button class="btn" id="s-remotetest">Test connection</button>
        <span class="hint" id="s-remotestatus"></span>
      </div>
      <div class="net-warn" id="s-offmachine" hidden>
        <strong>This sends what you type to another company.</strong> Portico's promise that
        nothing leaves your computer does not apply while this is on — the app will say so under
        the message box. Your chats and files still stay here; only the question and the answer
        travel. You pay the provider directly on their own site; Portico never handles a wallet,
        a card or a private key.
      </div>
    </div>

    <label class="check-row">
      <input id="s-share" type="checkbox" ${s.shareEngine ? 'checked' : ''} />
      <span>Share this computer's engine <em>(let others on the network use it)</em></span>
    </label>
    <div id="s-share-box" class="net-box" ${s.shareEngine ? '' : 'hidden'}>
      <label class="field"><span>Access key <em>anyone with this can use the engine</em></span>
        <div class="field-row">
          <input id="s-sharekey" type="text" value="${esc(s.shareKey || '')}" spellcheck="false" readonly />
          <button class="btn" id="s-newkey">New key</button>
        </div>
      </label>
      <label class="field"><span>People at once</span>
        <select id="s-slots">
          ${[1, 2, 4, 6, 8].map((v) => `<option value="${v}" ${(s.parallelSlots || 1) === v ? 'selected' : ''}>${v}${v === 1 ? ' (just you)' : ''}</option>`).join('')}
        </select>
        <span class="hint">Each extra person needs their own slice of video memory. If the model
          stops loading after raising this, lower it or reduce the context size.</span>
      </label>
      <div class="field">
        <span>This computer's address</span>
        <div id="s-addresses" class="hint"></div>
      </div>
      <div class="net-warn">
        Traffic is unencrypted, so only share on a network you trust — an office or home LAN.
        Do not forward this port to the internet; use a VPN if people need access from outside.
      </div>
    </div>

    <div class="settings-sep">Appearance</div>
    <div class="field">
      <span>Theme</span>
      <div class="theme-grid" id="theme-grid"></div>
    </div>

    <div class="settings-sep">Image generation</div>
    <label class="field"><span>Image model <em>used by /image</em></span>
      <select id="s-imgmodel"></select>
      <span class="hint" id="s-imgmodel-hint"></span>
    </label>
    <label class="field"><span>Image size</span>
      <select id="s-imgsize">
        <option value="0" ${!s.imageSize ? 'selected' : ''}>Auto — match the model</option>
        ${[384, 512, 640, 768, 1024].map((v) => `<option value="${v}" ${s.imageSize === v ? 'selected' : ''}>${v} × ${v}${v >= 768 ? ' (needs more VRAM)' : ''}</option>`).join('')}
      </select>
    </label>
    <label class="field"><span>Steps <em>more = slower, usually better</em></span>
      <select id="s-imgsteps">
        <option value="0" ${!s.imageSteps ? 'selected' : ''}>Auto — match the model</option>
        ${[4, 8, 12, 20, 30, 40, 60].map((v) => `<option value="${v}" ${s.imageSteps === v ? 'selected' : ''}>${v}${v === 4 ? ' (Turbo models only)' : ''}</option>`).join('')}
      </select>
      <span class="hint">Auto uses 4 steps for Turbo models and 20 for the rest. Setting a number here overrides that for every model — raising steps on a Turbo model mostly just costs time.</span>
      <span class="hint" id="s-img-estimate"></span>
    </label>
    <label class="field"><span>Weight precision</span>
      <select id="s-imgquant">
        ${[['q8_0', 'q8_0 — best quality that fits 4 GB'], ['q4_0', 'q4_0 — smallest, for big models on small GPUs'], ['none', 'full precision — needs a large GPU']].map(([v, l]) => `<option value="${v}" ${s.imageQuant === v ? 'selected' : ''}>${l}</option>`).join('')}
      </select>
    </label>

    <div class="settings-sep">Search engines</div>
    <div class="field">
      <span>Which sources may the AI use?</span>
      <div id="engine-list" class="engine-list"></div>
      <label class="check-row" style="margin-top:4px">
        <input id="s-allsrc" type="checkbox" ${s.searchAlwaysAllSources ? 'checked' : ''} />
        <span>Always use every ticked source <em>(otherwise news, coding and science sources join only when the question looks like theirs)</em></span>
      </label>
      <div class="field-row" style="margin-top:8px">
        <button class="btn" id="s-test">Test engines</button>
        <span id="test-status" class="hint"></span>
      </div>
    </div>

    <div class="settings-sep">Web search</div>
    <label class="field"><span>Results per search</span>
      <select id="s-nres">
        ${[3, 4, 5, 6, 8].map((v) => `<option value="${v}" ${s.searchResults === v ? 'selected' : ''}>${v}</option>`).join('')}
      </select>
    </label>
    <label class="field"><span>Pages to actually read <em>more = better answers, slower</em></span>
      <select id="s-nread">
        ${[1, 2, 3, 4].map((v) => `<option value="${v}" ${s.searchReadPages === v ? 'selected' : ''}>${v}</option>`).join('')}
      </select>
    </label>
    <label class="field"><span>Brave Search API key <em>optional</em></span>
      <input id="s-brave" type="text" value="${esc(s.braveApiKey || '')}" placeholder="leave empty to use DuckDuckGo + Wikipedia" spellcheck="false" />
      <span class="hint">Free search engines block automated queries, so results can fall back to Wikipedia. A free Brave Search API key (2,000 searches/month) makes web results reliable. Get one yourself at search.brave.com/api — Portico stores it locally and only sends it to Brave.</span>
    </label>
    <div><button class="btn primary" id="s-save">Save settings</button></div>

    <div class="settings-sep">About &amp; troubleshooting</div>
    <div class="field">
      <span>Version <em id="s-version">…</em></span>
      <div class="field-row" style="margin-top:6px">
        <button class="btn" id="s-update">Check for updates</button>
        <button class="btn" id="s-logs">Open log folder</button>
        <button class="btn" id="s-diag">Copy diagnostics</button>
      </div>
      <span class="hint" id="s-update-hint">Logs stay on this PC. "Copy diagnostics" puts your versions, settings and the last 60 log lines on the clipboard so you can paste them into a bug report.</span>
    </div>
    <div class="field"><span class="hint">Engine settings (device, context, GPU layers) apply the next time a model is loaded.</span></div>
  `;
  renderThemePicker();
  renderEngineList();
  renderImageModelPicker();
  wireAboutSection();
  $('s-test').addEventListener('click', testEngines);
  $('s-open').addEventListener('click', () => api.openModelsFolder());
  wireSharedEngine();
  wireDeviceBenchmark();
  $('s-save').addEventListener('click', async () => {
    S.settings = await api.saveSettings({
      modelsDir: $('s-dir').value.trim(),
      device: $('s-device').value,
      contextSize: parseInt($('s-ctx').value, 10),
      gpuLayers: parseInt($('s-ngl').value, 10),
      port: parseInt($('s-port').value, 10),
      searchResults: parseInt($('s-nres').value, 10),
      searchReadPages: parseInt($('s-nread').value, 10),
      braveApiKey: $('s-brave').value.trim(),
      searchAlwaysAllSources: $('s-allsrc').checked,
      imageModel: ($('s-imgmodel').value || '').startsWith('No image') ? '' : $('s-imgmodel').value,
      imageSize: parseInt($('s-imgsize').value, 10),
      imageSteps: parseInt($('s-imgsteps').value, 10),
      imageQuant: $('s-imgquant').value,
      remoteMode: $('s-remote').checked,
      remoteProvider: $('s-provider').value,
      remoteUrl: $('s-remoteurl').value.trim(),
      remoteKey: $('s-remotekey').value.trim(),
      remoteModelName: $('s-remotemodel').value.trim(),
      shareEngine: $('s-share').checked,
      parallelSlots: parseInt($('s-slots').value, 10) || 1,
    });
    // sharing changes the engine's bind address, which only takes effect on restart
    await api.applySharing();
    await refreshRemoteStatus();
    await refreshModels();
    await renderEngineList(); // a new Brave key can unlock that engine
    updatePill();
    toast('Settings saved');
  });
}

// Times each graphics device on a real generation, then remembers the winner.
// Takes a couple of minutes because every device has to load the model.
function wireDeviceBenchmark() {
  const btn = $('s-bench');
  const status = $('s-bench-status');
  const box = $('s-bench-results');

  const draw = (rows, best) => {
    box.innerHTML = rows.map((r) => {
      const win = best && r.id === best;
      const val = r.tps > 0 ? r.tps.toFixed(1) + ' tok/s' : (r.error || 'not usable');
      return `<div class="bench-row${win ? ' best' : ''}">
        <span class="bench-name">${esc(r.name || r.id)}</span>
        <span class="bench-val">${esc(val)}${win ? ' · fastest' : ''}</span>
      </div>`;
    }).join('');
  };

  // show whatever the last run found, so the numbers survive reopening Settings
  if (S.settings.deviceBenchmark) draw(S.settings.deviceBenchmark, S.settings.measuredDevice);

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    box.innerHTML = '';
    status.textContent = 'Testing… this stops the current model for a minute or two.';
    const r = await api.benchmarkDevices();
    btn.disabled = false;
    if (r.error) { status.textContent = r.error; return; }
    draw(r.devices, r.best);
    S.settings = await api.getSettings();
    const winner = r.devices.find((d) => d.id === r.best);
    status.textContent = winner
      ? `Using ${winner.name} from now on.`
      : 'No device could run the model.';
    renderSettingsView();   // refresh the "Auto (measured: …)" label
  });

  api.onDeviceBenchmarkProgress((p) => {
    if (p.state === 'testing') status.textContent = `Testing ${p.name}…`;
  });
}

// Host and client mode controls. The two are mutually exclusive: a machine either
// runs the model for others or borrows someone else's, never both.
function wireSharedEngine() {
  const remote = $('s-remote');
  const share = $('s-share');

  const sync = () => {
    $('s-remote-box').hidden = !remote.checked;
    $('s-share-box').hidden = !share.checked;
  };

  remote.addEventListener('change', () => {
    if (remote.checked && share.checked) {
      share.checked = false;
      toast('Sharing turned off — a machine cannot host and borrow at the same time');
    }
    sync();
  });

  share.addEventListener('change', async () => {
    if (share.checked && remote.checked) {
      remote.checked = false;
      toast('Switched off using a remote engine');
    }
    // sharing without a key would expose the engine to anyone on the network
    if (share.checked && !$('s-sharekey').value.trim()) {
      $('s-sharekey').value = await api.generateShareKey();
    }
    sync();
  });

  $('s-newkey').addEventListener('click', async () => {
    $('s-sharekey').value = await api.generateShareKey();
    toast('New key — everyone connecting will need to update it');
  });

  // the provider list drives the rest of the form, so nothing is hard-coded here
  api.listProviders().then((list) => {
    S.providers = list;
    const sel = $('s-provider');
    if (!sel) return;
    sel.innerHTML = list.map((p) =>
      `<option value="${esc(p.id)}" ${(s.remoteProvider || 'lan') === p.id ? 'selected' : ''}>${esc(p.label)}</option>`).join('');
    const sync = () => {
      const p = list.find((x) => x.id === sel.value) || list[0];
      $('s-provider-note').textContent = p.note || '';
      $('s-model-field').hidden = !p.needsModel;
      $('s-offmachine').hidden = !p.offMachine;
      $('s-url-label').textContent = p.offMachine ? 'API address' : 'Host address';
      $('s-key-label').textContent = p.offMachine ? 'API key' : 'Access key';
      const url = $('s-remoteurl');
      url.placeholder = p.base || '192.168.1.40:8033';
      // a preset knows its own address; leave a hand-typed one alone
      if (p.base && !url.value) url.value = p.base;
      if (!p.offMachine && list.some((x) => x.base === url.value)) url.value = '';
    };
    sel.addEventListener('change', sync);
    sync();
  });

  $('s-remotetest').addEventListener('click', async () => {
    const st = $('s-remotestatus');
    st.textContent = 'Checking…';
    const r = await api.testRemote({
      url: $('s-remoteurl').value.trim(),
      key: $('s-remotekey').value.trim(),
      provider: $('s-provider').value,
    });
    st.textContent = r.ok
      ? `Connected${r.model ? ' — ' + r.model : ''}`
      : r.error;
    st.style.color = r.ok ? 'var(--ok, #6a9955)' : 'var(--danger, #d08770)';
    // show what may be typed in the model field
    if (r.ok && r.models && r.models.length && !$('s-remotemodel').value) {
      $('s-remotemodel').placeholder = 'e.g. ' + r.models[0];
    }
  });

  // show the addresses other machines would use to reach this one
  api.networkInfo().then((info) => {
    const box = $('s-addresses');
    if (!box) return;
    box.innerHTML = info.addresses.length
      ? info.addresses.map((a) => `<code>${esc(a.address)}:${info.port}</code> <em>${esc(a.iface)}</em>`).join('<br>')
      : 'No network connection found.';
  });
}

/* ---------- right panel ---------- */

let panelSaveTimer = null;
function panelSave() {
  clearTimeout(panelSaveTimer);
  panelSaveTimer = setTimeout(async () => {
    S.settings = await api.saveSettings({
      systemPrompt: $('p-system').value,
      temperature: parseFloat($('p-temp').value),
      topP: parseFloat($('p-topp').value),
      maxTokens: parseInt($('p-maxtok').value, 10) || 2048,
    });
  }, 400);
}

function initPanel() {
  const s = S.settings;
  $('p-system').value = s.systemPrompt || '';
  $('p-temp').value = s.temperature;
  $('p-topp').value = s.topP;
  $('p-maxtok').value = s.maxTokens;
  $('p-temp-v').textContent = s.temperature;
  $('p-topp-v').textContent = s.topP;
  $('p-system').addEventListener('input', panelSave);
  $('p-temp').addEventListener('input', () => { $('p-temp-v').textContent = $('p-temp').value; panelSave(); });
  $('p-topp').addEventListener('input', () => { $('p-topp-v').textContent = $('p-topp').value; panelSave(); });
  $('p-maxtok').addEventListener('input', panelSave);
}

/* ---------- composer ---------- */

function autoGrow(ta) {
  ta.style.height = 'auto';
  ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
}

/* ---------- web search ---------- */

function updateSearchButton() {
  const on = !!(S.settings && S.settings.webSearch);
  const btn = $('btn-search');
  btn.classList.toggle('on', on);
  btn.title = on
    ? 'Web search: ON — your message is sent to a search engine'
    : 'Web search: off — everything stays on your PC';
  // The line under the composer is a promise, so it has to track what is actually
  // true. Two separate things can send your words off this machine — web search,
  // and running the model at a hosted provider — and the hosted case is the more
  // serious of the two, so it wins the message.
  const provider = (S.providers || []).find((p) => p.id === (S.settings && S.settings.remoteProvider));
  const offMachine = !!(S.settings && S.settings.remoteMode && provider && provider.offMachine);

  $('input').placeholder = offMachine ? 'Message the hosted model…'
    : on ? 'Ask anything — Portico will search the web…'
    : 'Message your local model…';

  const hint = $('composer-hint');
  if (offMachine) {
    const who = provider.label.split('—')[0].trim();
    hint.innerHTML = `Model runs at ${esc(who)} · what you type leaves this computer`
      + (on ? ' · web search on' : '');
  } else if (on) {
    hint.innerHTML = 'Web search on · your question goes to a search engine — the model still runs locally';
  } else {
    hint.innerHTML = 'Runs 100% locally · nothing leaves your PC';
  }
  hint.classList.toggle('warn', on || offMachine);
}

async function toggleSearch() {
  S.settings = await api.saveSettings({ webSearch: !S.settings.webSearch });
  updateSearchButton();
  toast(S.settings.webSearch ? 'Web search on — queries leave your PC' : 'Web search off — fully local again');
}

/* hover menu on the globe button */

const KIND_ORDER = ['web', 'news', 'tech', 'academic', 'markets', 'flights', 'shopping'];
let searchMenuTimer = null;

async function renderSearchMenu() {
  const menu = $('search-menu');
  if (!S.engines) S.engines = await api.searchEngines();
  const on = !!S.settings.webSearch;
  const groups = KIND_ORDER
    .map((kind) => [kind, S.engines.filter((e) => e.kind === kind)])
    .filter(([, list]) => list.length);

  menu.innerHTML =
    `<button class="sm-master${on ? ' on' : ''}" id="sm-master">
       <span class="sm-dot"></span>
       <span>Web search is <b>${on ? 'ON' : 'OFF'}</b></span>
     </button>
     <label class="sm-row sm-mode" title="Skips chit-chat, follow-ups like “tell me more”, and writing tasks — they don’t need the web.">
       <input type="checkbox" id="sm-auto" ${S.settings.searchMode !== 'always' ? 'checked' : ''} />
       <span>Only search when useful</span>
     </label>
     <div class="sm-body${on ? '' : ' dim'}">` +
    groups.map(([kind, list]) => `
      <div class="sm-group">${esc(KIND_LABEL[kind] || kind)}</div>` +
      list.map((e) => {
        const noKey = e.needsKey && !((S.settings.braveApiKey || '').trim());
        return `<label class="sm-row${noKey ? ' disabled' : ''}" title="${esc(e.desc)}">
          <input type="checkbox" data-menu-engine="${esc(e.id)}" ${engineOn(e.id) ? 'checked' : ''} ${noKey ? 'disabled' : ''} />
          <span>${esc(e.label)}${noKey ? ' <em>(needs key)</em>' : ''}</span>
        </label>`;
      }).join('')).join('') +
    `</div>
     <button class="sm-more" id="sm-more">All search settings…</button>`;

  $('sm-master').addEventListener('click', async (e) => { e.stopPropagation(); await toggleSearch(); renderSearchMenu(); });
  $('sm-auto').addEventListener('change', async (e) => {
    e.stopPropagation();
    S.settings = await api.saveSettings({ searchMode: e.target.checked ? 'auto' : 'always' });
  });
  $('sm-more').addEventListener('click', (e) => { e.stopPropagation(); hideSearchMenu(true); showView('settings'); });
  menu.querySelectorAll('input[data-menu-engine]').forEach((cb) => {
    cb.addEventListener('change', async (e) => {
      e.stopPropagation();
      const map = { ...(S.settings.searchEngines || {}), [cb.dataset.menuEngine]: cb.checked };
      S.settings.searchEngines = map; // sync first: rapid clicks must not overwrite each other
      S.settings = await api.saveSettings({ searchEngines: map });
      if (S.view === 'settings') renderEngineList();
    });
  });
}

async function showSearchMenu() {
  clearTimeout(searchMenuTimer);
  const menu = $('search-menu');
  if (!menu.hidden) return;
  menu.hidden = false;
  await renderSearchMenu();
  // The composer sits mid-screen on an empty chat and at the bottom in a conversation,
  // so size the menu against the space actually above the button.
  const above = $('btn-search').getBoundingClientRect().top - 16;
  menu.style.maxHeight = Math.max(150, Math.min(330, above)) + 'px';
}

function hideSearchMenu(now) {
  clearTimeout(searchMenuTimer);
  if (now) { $('search-menu').hidden = true; return; }
  searchMenuTimer = setTimeout(() => { $('search-menu').hidden = true; }, 280);
}

function sourceChipsHtml(sources) {
  return sources.map((s, i) => {
    let host = '';
    try { host = new URL(s.url).hostname.replace(/^www\./, ''); } catch { host = s.url.slice(0, 30); }
    const tip = `${s.title || s.url}${s.source ? `\n\nFound via ${s.source}` : ''}${s.fetched ? '\nPage was read' : (s.noFetch ? '\nHeadline only' : '\nNot read')}`;
    return `<a class="src-chip" href="${esc(s.url)}" title="${esc(tip)}">` +
      `<span class="src-n">${i + 1}</span><span class="src-host">${esc(host)}</span></a>`;
  }).join('');
}

// Turns retrieved pages into a context block the model can cite from.
function buildSearchContext(res) {
  const lines = [
    `WEB SEARCH RESULTS for "${res.query}" (retrieved ${new Date(res.fetchedAt).toLocaleString()}, via ${res.engine}):`,
    '',
  ];
  res.results.forEach((r, i) => {
    lines.push(`[${i + 1}] ${r.title || r.url}${r.source ? ` (via ${r.source})` : ''}`);
    lines.push(`URL: ${r.url}`);
    if (r.noFetch && !r.text) lines.push('(headline only — full article not retrieved)');
    const body = (r.text || r.snippet || '').trim();
    if (body) lines.push(body);
    lines.push('');
  });
  lines.push(
    'HOW TO ANSWER:',
    '1. Answer the question directly in your first sentence. Never open with "Based on the ' +
    'sources", "According to the search results", or any description of what you were given.',
    '2. Some sources above will be irrelevant — a search engine matched them on wording alone. ' +
    'Use only the ones that genuinely address the question and ignore the rest in silence. ' +
    'Do not summarise an irrelevant source just because it is there.',
    '3. If none of them address the question, say so in one sentence and stop.',
    '4. If the question is very broad, answer the most useful part of it, then offer to narrow down.',
    '5. Cite as [1], [2] immediately after the fact each source supports.',
    `6. Today is ${new Date().toDateString()}, which is later than your training data. Where a ` +
    'source disagrees with your memory, THE SOURCE IS RIGHT — especially about dates, ' +
    'elections, office holders and recent events.',
    '7. Never invent numbers, prices, percentages, odds, dates or quotations. State a figure ' +
    'or quote a sentence only if it appears verbatim above.',
    '8. Write in the same language the question was asked in.'
  );
  return lines.join('\n');
}

/* ---------- voice input ---------- */

// whisper.cpp wants 16 kHz mono 16-bit PCM, so decode and resample here rather than
// shipping whatever codec the browser recorded in.
async function blobToWav16k(blob) {
  const raw = await blob.arrayBuffer();
  const ctx = new AudioContext();
  const decoded = await ctx.decodeAudioData(raw);
  ctx.close();
  const frames = Math.ceil(decoded.duration * 16000);
  const off = new OfflineAudioContext(1, Math.max(frames, 1), 16000);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start();
  const rendered = await off.startRendering();
  const pcm = rendered.getChannelData(0);

  const buf = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(buf);
  const str = (off2, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off2 + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); view.setUint32(4, 36 + pcm.length * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true); view.setUint32(28, 32000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  str(36, 'data'); view.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(buf);
}

function setMicState(state) {
  const btn = $('btn-mic');
  btn.classList.toggle('recording', state === 'recording');
  btn.classList.toggle('busy', state === 'transcribing');
  btn.title = state === 'recording' ? 'Stop recording and transcribe'
    : state === 'transcribing' ? 'Transcribing…'
    : 'Dictate a message (speech stays on this PC)';
}

async function toggleMic() {
  if (S.recorder && S.recorder.state === 'recording') { S.recorder.stop(); return; }
  if (S.transcribing) return;

  const info = await api.voiceInfo();
  if (!info.engineInstalled) { toast('Speech engine is missing from this install'); return; }
  if (!info.models.length) { toast('No speech model — download one from Models → Discover'); return; }

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
  } catch (e) {
    toast('Microphone unavailable: ' + e.message);
    return;
  }

  const chunks = [];
  const rec = new MediaRecorder(stream);
  S.recorder = rec;
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  rec.onstop = async () => {
    stream.getTracks().forEach((t) => t.stop());
    S.recorder = null;
    S.transcribing = true;
    setMicState('transcribing');
    try {
      const wav = await blobToWav16k(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }));
      const res = await api.transcribe({ wavBytes: wav, language: S.settings.voiceLanguage || 'auto' });
      if (res.error) toast('Transcription failed: ' + res.error);
      else if (!res.text) toast('Nothing was heard');
      else {
        const input = $('input');
        input.value = (input.value ? input.value.trimEnd() + ' ' : '') + res.text;
        autoGrow(input);
        input.focus();
      }
    } catch (e) {
      toast('Could not process the recording: ' + e.message);
    }
    S.transcribing = false;
    setMicState('idle');
  };
  rec.start();
  setMicState('recording');
  toast('Recording — click the mic again to stop');
}

/* ---------- running Python ---------- */

const RE_PY_LANG = /^(python|py|python3)$/i;

function pyResultHtml(r) {
  if (r.pending) {
    return `<div class="py-block py-running">${ICONS.play}<span>Running Python… <em>${esc(r.note || '')}</em></span></div>`;
  }
  if (r.error) {
    return `<div class="py-block py-error">${ICONS.play}<span>${esc(r.error)}</span></div>`;
  }
  const figs = (r.figures || []).map((f) =>
    `<img class="py-fig" src="file:///${esc(String(f).replace(/\\/g, '/'))}" alt="figure" />`).join('');
  const out = (r.stdout || '').trim();
  const err = (r.stderr || '').trim();
  const head = r.timedOut ? 'Stopped — it ran too long'
    : r.ok ? `Ran in ${r.seconds}s${figs ? ` · ${r.figures.length} figure${r.figures.length > 1 ? 's' : ''}` : ''}`
    : 'Finished with an error';
  return `<div class="py-block${r.ok ? '' : ' py-failed'}">
      <div class="py-head">${ICONS.play}<span>${esc(head)}</span></div>
      ${figs ? `<div class="py-figs">${figs}</div>` : ''}
      ${out ? `<pre class="py-out">${esc(out)}</pre>` : ''}
      ${err ? `<pre class="py-out py-stderr">${esc(err)}</pre>` : ''}
      ${!out && !err && !figs ? '<div class="py-none">The code ran but produced no output or figures.</div>' : ''}
    </div>`;
}

async function ensurePythonReady(code) {
  const info = await api.pythonInfo();
  if (!info.found) {
    toast('Python was not found on this PC');
    return { ok: false, message: 'Python 3 is not installed, or is not on your PATH. Install it from python.org and restart Portico.' };
  }
  // only nag about libraries the snippet actually uses
  const needed = ['matplotlib', 'numpy', 'pandas', 'seaborn'].filter(
    (m) => new RegExp(`\\b(import|from)\\s+${m}\\b`).test(code) && !info.packages[m]);
  if (needed.length) {
    const ok = confirm(`This code needs ${needed.join(', ')}, which ${needed.length > 1 ? 'are' : 'is'} not installed.\n\nInstall with pip now? (a one-time download)`);
    if (!ok) return { ok: false, message: `Missing Python package(s): ${needed.join(', ')}` };
    toast('Installing ' + needed.join(', ') + '…');
    const r = await api.pythonInstall(needed);
    if (r.error) return { ok: false, message: 'pip failed: ' + r.error };
    toast('Installed ' + needed.join(', '));
  }
  return { ok: true };
}

async function runPythonBlock(code) {
  const chat = ensureChat();

  // This runs real code on the user's machine — flag anything beyond plotting first.
  const risky = await api.pythonScan(code);
  if (risky.length) {
    const go = confirm(
      'This code does more than draw a chart. It:\n\n' +
      risky.map((r) => '  • ' + r).join('\n') +
      '\n\nIt runs on your PC with your permissions. Only continue if you have read the code and trust it.\n\nRun anyway?');
    if (!go) return;
  }

  const msg = { role: 'assistant', pyrun: { pending: true, note: 'checking Python…' } };
  chat.messages.push(msg);
  renderMessages();
  scrollToBottom(true);
  const redraw = () => {
    const el = $('messages').lastElementChild;
    if (el) el.innerHTML = pyResultHtml(msg.pyrun);
  };

  const ready = await ensurePythonReady(code);
  if (!ready.ok) {
    msg.pyrun = { error: ready.message };
    renderMessages(); await saveCurrentChat(); return;
  }

  msg.pyrun = { pending: true, note: '' };
  redraw();
  const t0 = Date.now();
  const res = await api.runPython({ code, timeout: 90000 });
  msg.pyrun = { ...res, seconds: Math.round((Date.now() - t0) / 1000) };
  renderMessages();
  scrollToBottom(false);
  await saveCurrentChat();
}

/* ---------- artifacts ---------- */

// Only self-contained pages are worth previewing.
function isArtifact(lang, code) {
  const l = (lang || '').toLowerCase();
  if (l === 'html' || l === 'svg') return true;
  const head = code.slice(0, 400).toLowerCase();
  return head.includes('<!doctype html') || head.includes('<html') || head.trimStart().startsWith('<svg');
}

function artifactDoc(code) {
  const t = code.trim();
  if (t.toLowerCase().startsWith('<svg')) {
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#262624';
    return `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;height:100%;display:grid;place-items:center;background:${bg}}svg{max-width:100%;max-height:100%}</style>${t}`;
  }
  if (/<html[\s>]/i.test(t) || /<!doctype/i.test(t)) return t;
  return `<!doctype html><meta charset="utf-8"><body>${t}`;
}

async function openArtifact(code, title) {
  S.artifact = { code, title: title || 'Artifact' };
  const written = await api.writeArtifact({ id: newId('art'), html: artifactDoc(code) });
  S.artifact.path = written.path;
  $('artifact-title').textContent = S.artifact.title;
  $('artifact-frame').src = written.url;
  $('artifact-code').querySelector('code').innerHTML = api.highlight(code, 'html');
  showArtifactTab('preview');
  $('artifact-panel').classList.remove('closed');
  $('panel').classList.add('closed');           // one right-hand panel at a time
  $('btn-panel').classList.remove('on');
}

function showArtifactTab(which) {
  const preview = which === 'preview';
  $('artifact-frame').hidden = !preview;
  $('artifact-code').hidden = preview;
  $('ap-tab-preview').classList.toggle('active', preview);
  $('ap-tab-code').classList.toggle('active', !preview);
}

function closeArtifact() {
  $('artifact-panel').classList.add('closed');
  $('artifact-frame').src = 'about:blank';
}

// Windows draws the minimise/maximise/close buttons over the top-right of the
// frame. Measure how much room they take so panels can keep their own controls
// clear of them — hard-coding it breaks at other display scalings.
function trackWindowControls() {
  const apply = () => {
    const o = navigator.windowControlsOverlay;
    if (!o || !o.visible) return;                 // no overlay: the CSS fallback stands
    const bar = o.getTitlebarAreaRect();
    const w = Math.max(0, window.innerWidth - bar.width - bar.x);
    document.documentElement.style.setProperty('--wco-w', Math.round(w) + 'px');
  };
  apply();
  if (navigator.windowControlsOverlay) {
    navigator.windowControlsOverlay.addEventListener('geometrychange', apply);
  }
  window.addEventListener('resize', apply);
}

/* ---------- image generation ---------- */

const RE_IMAGE_CMD = /^\/(image|img|draw)\s+([\s\S]+)/i;

function imageBlockHtml(img) {
  if (img.error) {
    return `<div class="img-block img-error">${ICONS.image}<span>${esc(img.error)}</span></div>`;
  }
  if (!img.path) {
    const pct = img.total ? Math.round((img.step / img.total) * 100) : 0;
    // High settings can run for minutes, so there must always be a way out.
    return `<div class="img-block img-pending">
        <div class="img-stage">${esc(img.stage || 'Generating image…')}</div>
        <div class="progress-bar"><div style="width:${pct}%"></div></div>
        <div class="img-pending-foot">
          <span class="progress-label">${img.total ? `step ${img.step} of ${img.total}` : 'preparing…'}</span>
          <button class="btn img-cancel">Cancel</button>
        </div>
      </div>`;
  }
  const src = 'file:///' + String(img.path).replace(/\\/g, '/');
  return `<figure class="img-block img-done">
      <img src="${esc(src)}" alt="${esc(img.prompt || '')}" />
      <figcaption>
        <span class="img-prompt">${esc(img.prompt || '')}</span>
        <span class="img-actions">
          <button class="btn img-open" data-path="${esc(img.path)}">Show file</button>
          <button class="btn img-again" data-prompt="${esc(img.prompt || '')}">Again</button>
        </span>
      </figcaption>
    </figure>`;
}

async function ensureImageReady() {
  const st = await api.imageStatus();
  if (!st.engineInstalled) {
    if (!confirm('Image generation needs a one-time engine download (about 106 MB). Install it now?')) return null;
    toast('Downloading image engine…');
    const r = await api.installImageEngine();
    if (r.error) { toast('Engine install failed: ' + r.error); return null; }
    toast('Image engine installed');
    return api.imageStatus();
  }
  return st;
}

async function runImageGeneration(prompt) {
  const chat = ensureChat();
  chat.messages.push({ role: 'user', content: '/image ' + prompt });
  // pending must be set from the very first state, or anything watching this message
  // (the UI, tests) sees an unfinished image as finished
  const imgMsg = { role: 'assistant', content: '', image: { prompt, pending: true, stage: 'Checking image engine…' } };
  chat.messages.push(imgMsg);
  renderMessages();
  scrollToBottom(true);
  setGenerating(true);

  const st = await ensureImageReady();
  if (!st) {
    imgMsg.image = { prompt, error: 'Image engine not installed.' };
    setGenerating(false); renderMessages(); return;
  }
  if (!st.models.length) {
    imgMsg.image = { prompt, error: 'No image model found. Open Models → Discover and download Stable Diffusion 1.5.' };
    setGenerating(false); renderMessages(); await saveCurrentChat(); return;
  }

  const redraw = () => {
    const el = $('messages').lastElementChild;
    if (el) el.innerHTML = imageBlockHtml(imgMsg.image);
  };
  S.imageHooks = {
    progress: (p) => { imgMsg.image.step = p.step; imgMsg.image.total = p.total; imgMsg.image.stage = 'Painting…'; redraw(); },
    stage: (s) => {
      const labels = { 'freeing-vram': 'Freeing GPU memory (unloading chat model)…', generating: 'Loading image model…', 'reloading-chat-model': 'Restoring chat model…' };
      imgMsg.image.stage = labels[s.stage] || s.stage; redraw();
    },
  };

  const t0 = Date.now();
  const res = await api.generateImage({ prompt });
  S.imageHooks = null;
  if (res.error && /cancel|kill|terminated|code null/i.test(res.error)) {
    imgMsg.image = { prompt, error: 'Image generation cancelled.' };
  } else if (res.error) imgMsg.image = { prompt, error: res.error };
  else imgMsg.image = { prompt, path: res.path, seconds: Math.round((Date.now() - t0) / 1000) };

  if (chat.messages.filter((m) => m.role === 'user').length === 1) {
    chat.title = prompt.slice(0, 48);
    $('header-title').textContent = chat.title;
  }
  setGenerating(false);
  renderMessages();
  scrollToBottom(true);
  await saveCurrentChat();
  if (!res.error) toast(`Image ready in ${imgMsg.image.seconds}s`);
}

/* ---------- code download ---------- */

const LANG_EXT = {
  html: 'html', css: 'css', javascript: 'js', js: 'js', typescript: 'ts', ts: 'ts',
  python: 'py', py: 'py', json: 'json', markdown: 'md', md: 'md', csv: 'csv',
  java: 'java', c: 'c', cpp: 'cpp', csharp: 'cs', cs: 'cs', sql: 'sql',
  bash: 'sh', sh: 'sh', shell: 'sh', powershell: 'ps1', ps1: 'ps1',
  xml: 'xml', yaml: 'yml', yml: 'yml', rust: 'rs', go: 'go', php: 'php', ruby: 'rb', r: 'r',
};

function codeFileName(lang, code) {
  let ext = LANG_EXT[(lang || '').toLowerCase()];
  if (!ext) {
    const head = code.slice(0, 200).toLowerCase();
    if (head.includes('<!doctype html') || head.includes('<html')) ext = 'html';
    else ext = 'txt';
  }
  return 'code.' + ext;
}

async function downloadCode(block) {
  const code = block.querySelector('code').textContent;
  const name = codeFileName(block.dataset.lang, code);
  const saved = await api.saveFile({ suggestedName: name, content: code });
  if (saved) toast('Saved: ' + saved);
}

/* ---------- attachments ---------- */

function fileChipHtml(a, removable) {
  if (a.isImage) {
    return `<span class="file-chip img-chip" title="${esc(a.name)}">` +
      `<img class="fc-thumb" src="${esc(a.dataUrl)}" alt="" />` +
      `<span class="fc-name">${esc(a.name)}</span>` +
      (removable ? '<button class="fc-x" title="Remove">✕</button>' : '') + '</span>';
  }
  return `<span class="file-chip" title="${esc(a.name)}${a.truncated ? ' (truncated)' : ''}">` +
    `${ICONS.file}<span class="fc-name">${esc(a.name)}</span>` +
    `<span class="fc-meta">${Math.round((a.chars || 0) / 1000)}k${a.truncated ? '+' : ''}</span>` +
    (removable ? '<button class="fc-x" title="Remove">✕</button>' : '') + '</span>';
}

function renderAttachStrip() {
  const strip = $('attach-strip');
  if (!S.pendingFiles.length) { strip.hidden = true; strip.innerHTML = ''; return; }
  strip.hidden = false;
  strip.innerHTML = S.pendingFiles.map((a) => fileChipHtml(a, true)).join('');
  strip.querySelectorAll('.fc-x').forEach((btn, i) => btn.addEventListener('click', () => {
    S.pendingFiles.splice(i, 1);
    renderAttachStrip();
  }));
}

function addAttachments(results) {
  let addedImage = false;
  for (const r of results || []) {
    if (r.error) { toast(`${r.name}: ${r.error}`); continue; }
    if (S.pendingFiles.length >= 5) { toast('Maximum 5 files per message'); break; }
    if (r.isImage) addedImage = true;
    S.pendingFiles.push(r);
  }
  renderAttachStrip();
  // an image is useless unless a vision model is loaded — say so before they send
  if (addedImage && !currentModelHasVision()) {
    const vision = S.models.filter((m) => m.vision);
    toast(vision.length
      ? `This model cannot see images — switch to ${vision[0].name} in the model picker`
      : 'This model cannot see images — download a vision model from Models → Discover');
  }
}

async function attachFiles() {
  addAttachments(await api.pickFiles());
}

// Attachment text is injected into the prompt sent to the model, budgeted so that
// big files don't blow past the context window (~3 chars per token, minus headroom).
const CHARS_PER_TOKEN = 3.6; // rough but stable for English

// Full retrieved text — only ever used for the message being answered right now.
// Images can only be sent as image parts, and only to a model with a projector loaded.
function messageImages(m) {
  return (m.attachments || []).filter((a) => a.isImage && a.dataUrl);
}

function currentModelHasVision() {
  const p = S.server.modelPath || $('composer-model').value;
  const m = S.models.find((x) => x.path === p);
  return !!(m && m.vision);
}

function apiContent(m, budgetChars) {
  const budget = budgetChars || Math.max(4000, ((S.settings && S.settings.contextSize) || 4096) * 2);
  const blocks = [];
  if (m.search && m.search.results && m.search.results.length) {
    let ctx = buildSearchContext(m.search);
    const cap = Math.floor(budget * 0.62);
    if (ctx.length > cap) ctx = ctx.slice(0, cap) + '\n[... search results trimmed to fit memory ...]';
    blocks.push(ctx);
  }
  const textFiles = (m.attachments || []).filter((a) => !a.isImage);
  if (textFiles.length) {
    const per = Math.floor((budget * 0.35) / textFiles.length);
    for (const a of textFiles) {
      let t = a.text || '';
      if (t.length > per) t = t.slice(0, per) + '\n[... file trimmed to fit memory ...]';
      blocks.push(`[Attached file: ${a.name}]\n\`\`\`\n${t}\n\`\`\``);
    }
  }
  if (!blocks.length) return m.content;
  return blocks.join('\n\n') + (m.content ? '\n\n' + m.content : '');
}

// Older turns keep only a one-line trace. Re-sending whole web pages every turn was
// eating the entire context window and wiping the model's memory of the conversation.
function compactContent(m) {
  const notes = [];
  if (m.search && m.search.results && m.search.results.length) {
    const hosts = [...new Set(m.search.results.map((r) => {
      try { return new URL(r.url).hostname.replace(/^www\./, ''); } catch { return ''; }
    }).filter(Boolean))].slice(0, 4);
    notes.push(`[web search earlier: "${m.search.query}" — sources: ${hosts.join(', ')}]`);
  }
  if (m.attachments && m.attachments.length) {
    notes.push(`[files attached earlier: ${m.attachments.map((a) => a.name).join(', ')}]`);
  }
  if (!notes.length) return m.content;
  return notes.join(' ') + (m.content ? '\n' + m.content : '');
}

// A small, accurate description of this app, given to the model only when the user
// asks what it can do — otherwise it guesses, or answers from irrelevant web pages.
const APP_FACTS = [
  'Facts about the app you are running in (use these when asked what you can do):',
  '- You are a local model running inside Portico, a Windows desktop app. You run entirely on the user\'s own PC via llama.cpp; no cloud service is involved.',
  '- Portico can search the web when the user enables the globe toggle. Sources available: Brave (needs a key), Marginalia, DuckDuckGo, Wikipedia, Google News, GDELT, Stack Overflow, Hacker News, arXiv, Polymarket, live flight tracking, and shopping-site lookup. The user chooses which are on.',
  '- The Polymarket source returns BOTH open and closed markets with their live prices and volume; each result says whether it is open or CLOSED.',
  '- Live flights come from OpenSky and only cover aircraft airborne right now; Portico cannot price or book flights, and cannot read live shop prices.',
  '- You can read files the user attaches (PDF, text, code). You cannot see images, browse interactively, log into accounts, buy anything or place any bet or trade.',
  '- Your memory of the conversation is limited by the "Context size" setting; older messages are dropped when it fills.',
].join('\n');

function needsAppFacts(text) {
  return RE_ABOUT_AI.test(String(text || '')) || RE_META_CONVO.test(String(text || ''));
}

// Design direction for anything that will be looked at rather than read.
//
// Left alone, a model reaches for the middle of its training data — Arial, #333,
// padding: 20px — because nothing asked otherwise. Naming what NOT to do matters
// as much as the positives: those defaults are strong attractors, and small models
// fall back to them unless they are ruled out explicitly.
const DESIGN_GUIDANCE = [
  'When you produce a web page, interface or anything visual, design it deliberately:',
  '- Do NOT use Arial, Times, #333 text, default blue links, or a bare white page. Those are the defaults you fall back on; avoid them.',
  '- Type: one modern sans (system-ui, Inter, Segoe UI). Set a clear scale — large heading, smaller body — and use weight, not colour, for emphasis.',
  '- Space: be generous. Padding around sections, a max-width near 70ch on text so lines stay readable, and real gaps between blocks. Cramped layouts are the commonest mistake.',
  '- Colour: pick ONE accent and a few neutrals. Colour should carry meaning; do not decorate with it. Aim for near-black on off-white rather than pure #000 on #fff.',
  '- Remove rather than add: no unnecessary borders, boxes or shadows. If a line carries no information, drop it.',
  '- Finish it: hover states on anything clickable, a consistent corner radius, and a layout that still works narrow.',
  'Write complete, self-contained code. Do not explain the design unless asked.',
].join('\n');

// Only for requests that will actually be looked at — the guidance costs context,
// and is noise on an ordinary question.
const RE_VISUAL_TASK = new RegExp(
  '\\b(web ?page|web ?site|landing page|html|css|tailwind|front-?end|ui|interface|'
  + 'dashboard|layout|design|style ?sheet|component|form|button|navbar|hero section|'
  + 'portfolio|blog|svg|chart|graph|plot|diagram|infographic|poster|slide)\\b', 'i');
const RE_BUILD_VERB = /\b(make|build|create|design|write|generate|code|draw|show|give me|need|want)\b/i;
// "design" is both a thing to ask for and a thing to ask about, so it matches itself
// in a sentence like "the design of the Eiffel Tower". Questions about a subject are
// not requests to build one.
const RE_ASKING_ABOUT = new RegExp(
  '\\b(what do you think|what.s your (opinion|take)|thoughts on|opinion (on|about)|'
  + 'how (does|did|do)|why (is|are|do|did)|tell me about|what (is|are|was|were)|'
  + 'explain|history of|who (designed|made|built|created))\\b', 'i');

// Some nouns are only ever asked for, not asked about — "a dashboard of my
// expenses" is a request even with no verb in sight.
const RE_STRONG_VISUAL = /\b(web ?page|web ?site|landing page|dashboard|chart|graph|plot|infographic|poster|slide deck)\b/i;

function needsDesignGuidance(text) {
  const t = String(text || '');
  if (RE_ASKING_ABOUT.test(t)) return false;
  if (RE_STRONG_VISUAL.test(t)) return true;
  return RE_VISUAL_TASK.test(t) && RE_BUILD_VERB.test(t);
}

// A chat's project contributes standing instructions plus its reference files.
// Local models have small context windows, so the files get a fixed slice of the
// budget and are trimmed rather than allowed to crowd out the conversation.
function projectContext(budgetChars) {
  const chat = S.chat;
  if (!chat || !chat.projectId) return '';
  const p = S.projects.find((x) => x.id === chat.projectId);
  if (!p) return '';
  const parts = [];
  if (p.systemPrompt && p.systemPrompt.trim()) {
    parts.push(`Project "${p.name}" — standing instructions:\n${p.systemPrompt.trim()}`);
  }
  const files = p.files || [];
  if (files.length) {
    const share = Math.floor((budgetChars * 0.3) / files.length);
    const chunks = files.map((f) => {
      let t = f.text || '';
      const trimmed = t.length > share;
      if (trimmed) t = t.slice(0, share);
      return `[Project file: ${f.name}${trimmed ? ' — excerpt' : ''}]\n${t}`;
    });
    parts.push('Reference material for this project:\n\n' + chunks.join('\n\n'));
  }
  return parts.join('\n\n');
}

// Assemble the prompt within the model's real context window, newest first.
function buildApiMessages(history) {
  const s = S.settings;
  const ctx = s.contextSize || 4096;
  // reserve room for the reply at the CURRENT effort — Deep needs more, and the
  // history budget has to shrink to match or the reply gets truncated
  const reply = effortMaxTokens();
  const budgetChars = Math.max(1500, Math.floor((ctx - reply - 300) * CHARS_PER_TOKEN));

  const out = [];
  const lastIdx = history.length - 1;
  const lastMsg = history[lastIdx];

  // Build the whole system block up front — project instructions and reference files
  // are part of the budget, or the history loop would overfill the context window.
  const sys = (s.systemPrompt || '').trim();
  const extra = lastMsg && needsAppFacts(lastMsg.content) ? APP_FACTS : '';
  const design = lastMsg && needsDesignGuidance(lastMsg.content) ? DESIGN_GUIDANCE : '';
  const effortSys = currentEffort().system;
  const systemText = [projectContext(budgetChars), sys, effortSys, design, extra].filter(Boolean).join('\n\n');
  let used = systemText.length;
  const lastContent = lastMsg ? apiContent(lastMsg, budgetChars) : '';
  used += lastContent.length;

  let trimmed = 0;
  for (let i = lastIdx - 1; i >= 0; i--) {
    const c = compactContent(history[i]);
    if (used + c.length > budgetChars) { trimmed = i + 1; break; }
    used += c.length;
    out.unshift({ role: history[i].role, content: c });
  }
  if (systemText) out.unshift({ role: 'system', content: systemText });
  if (lastMsg) {
    const imgs = messageImages(lastMsg);
    if (imgs.length && currentModelHasVision()) {
      // OpenAI-style multimodal payload: llama-server reads this when --mmproj is loaded
      out.push({
        role: lastMsg.role,
        content: [
          ...imgs.map((a) => ({ type: 'image_url', image_url: { url: a.dataUrl } })),
          { type: 'text', text: lastContent || 'Describe this image.' },
        ],
      });
    } else {
      out.push({ role: lastMsg.role, content: lastContent });
    }
  }

  return { messages: out, used, budgetChars, trimmed };
}

/* ---------- effort ---------- */

// Effort has to change the request or it is just a label. Quick asks for brevity
// and caps the reply; Deep asks for reasoning first and allows room for it.
// Models that already think natively (R1, Qwen3) need no instruction — the tags
// they emit are rendered as a collapsible block either way.
const EFFORT = {
  quick: {
    label: 'Quick',
    hint: 'Short, direct answers. Fastest.',
    system: 'Answer directly and concisely. Do not show your working unless asked.',
    tokenScale: 0.5,
  },
  balanced: {
    label: 'Balanced',
    hint: 'The normal setting.',
    system: '',
    tokenScale: 1,
  },
  deep: {
    label: 'Deep',
    hint: 'Reasons step by step first. Slower, uses more of the context window.',
    system: 'Think through the problem step by step before giving your final answer. '
      + 'Work carefully, and state your reasoning before the conclusion.',
    tokenScale: 2,
  },
};

function currentEffort() {
  return EFFORT[(S.settings && S.settings.effort) || 'balanced'] || EFFORT.balanced;
}

// Max reply length for this request, after effort scaling. Kept below half the
// context window so the reply can never crowd out the conversation itself.
function effortMaxTokens() {
  const s = S.settings || {};   // the strip can render before settings load
  const base = s.maxTokens > 0 ? s.maxTokens : 2048;
  const ctx = s.contextSize || 4096;
  return Math.max(128, Math.min(Math.round(base * currentEffort().tokenScale), Math.floor(ctx / 2)));
}

function updateContextMeter(built) {
  S.lastBuild = built;   // the token panel reports on the most recent request
  // Kept up to date but not shown: the status strip's ring displays the same figure,
  // and having both meant "18%" appeared twice side by side.
  const el = $('ctx-meter');
  if (el) {
    const pct = Math.min(100, Math.round((built.used / built.budgetChars) * 100));
    el.textContent = `memory ${pct}%` + (built.trimmed ? ` · ${built.trimmed} older msg${built.trimmed > 1 ? 's' : ''} dropped` : '');
    el.className = 'muted' + (pct > 85 ? ' ctx-hot' : '');
  }
  renderStatusStrip();
}

/* ---------- status strip ---------- */

const tok = (chars) => Math.round(chars / CHARS_PER_TOKEN);

// What the next request would look like, without sending it — so the strip is
// accurate before you have said anything, not only after a reply.
function contextSnapshot() {
  const s = S.settings || {};
  const ctx = s.contextSize || 4096;
  const reserved = effortMaxTokens();
  const built = S.lastBuild;
  const usedTok = built ? tok(built.used) : 0;
  const budgetTok = built ? tok(built.budgetChars) : Math.max(1, ctx - reserved - 300);
  return {
    ctx,
    reserved,
    usedTok,
    budgetTok,
    trimmed: built ? built.trimmed : 0,
    pct: Math.min(100, Math.round((usedTok / Math.max(1, budgetTok)) * 100)),
  };
}

function renderStatusStrip() {
  const strip = $('status-strip');
  if (!strip) return;
  const sel = $('composer-model');
  const path = S.server && S.server.state === 'ready' && S.server.modelPath
    ? S.server.modelPath
    : (sel && sel.value && sel.value !== '__none' ? sel.value : '');
  const modelSeg = $('st-model');
  modelSeg.querySelector('.st-val').textContent = path ? shortModelName(path) : 'No model';
  modelSeg.title = path ? baseName(path) : 'No model loaded';   // full filename on hover

  $('st-effort').querySelector('.st-val').textContent = currentEffort().label;

  const snap = contextSnapshot();
  const seg = $('st-tokens');
  $('st-ring').style.setProperty('--pct', snap.pct);
  $('st-tokens-val').textContent = snap.pct + '%';
  seg.classList.toggle('hot', snap.pct > 85 || snap.trimmed > 0);
  seg.title = `${snap.usedTok.toLocaleString()} of ~${snap.budgetTok.toLocaleString()} tokens of conversation room used`
    + (snap.trimmed ? ` · ${snap.trimmed} older message(s) dropped` : '');
}

function wireStatusStrip() {
  $('st-model').addEventListener('click', (e) => {
    const sel = $('composer-model');
    const opts = [...sel.options].filter((o) => o.value && o.value !== '__none');
    if (!opts.length) { toast('No models installed — open Models to download one'); showView('models'); return; }
    openRowMenu(e.currentTarget, opts.map((o) => ({
      label: o.textContent,
      run: () => { sel.value = o.value; loadModelFromUi(o.value); renderStatusStrip(); },
    })), 'up');
  });

  $('st-effort').addEventListener('click', (e) => {
    openRowMenu(e.currentTarget, Object.entries(EFFORT).map(([key, v]) => ({
      label: v.label,
      run: async () => {
        S.settings = await api.saveSettings({ effort: key });
        renderStatusStrip();
        toast(v.label + ' — ' + v.hint);
      },
    })), 'up');
  });

  $('st-tokens').addEventListener('click', (e) => openTokenPanel(e.currentTarget));
}

// Where the context window is actually going, plus the two dials that control it.
function openTokenPanel(anchor) {
  document.querySelectorAll('.row-menu').forEach((m) => m.remove());
  const s = S.settings;
  const snap = contextSnapshot();
  const b = S.lastBuild;

  // split the used chars into system block / older turns / this message
  const sysChars = b && b.messages && b.messages[0] && b.messages[0].role === 'system' ? b.messages[0].content.length : 0;
  const lastM = b && b.messages ? b.messages[b.messages.length - 1] : null;
  const nowChars = lastM ? (typeof lastM.content === 'string' ? lastM.content.length : 600) : 0;
  const histChars = Math.max(0, (b ? b.used : 0) - sysChars - nowChars);
  const total = Math.max(1, b ? b.used : 1);
  const w = (n) => (b ? (n / total) * Math.min(100, snap.pct) : 0);

  const el = document.createElement('div');
  el.className = 'row-menu tok-panel';
  el.innerHTML = `
    <div class="tok-row"><span>Context window</span><b>${snap.ctx.toLocaleString()} tokens</b></div>
    <div class="tok-row"><span>Reserved for the reply</span><b>${snap.reserved.toLocaleString()}</b></div>
    <div class="tok-row"><span>Room for conversation</span><b>${snap.budgetTok.toLocaleString()}</b></div>
    <div class="tok-bar">
      <span class="b-sys" style="width:${w(sysChars)}%"></span>
      <span class="b-hist" style="width:${w(histChars)}%"></span>
      <span class="b-now" style="width:${w(nowChars)}%"></span>
    </div>
    <div class="tok-key">
      <span><i class="b-sys" style="background:var(--accent)"></i>Instructions ${tok(sysChars)}</span>
      <span><i class="b-hist" style="background:var(--ok)"></i>History ${tok(histChars)}</span>
      <span><i class="b-now" style="background:var(--warn)"></i>This turn ${tok(nowChars)}</span>
    </div>
    <div class="tok-row"><span>Used</span><b>${snap.usedTok.toLocaleString()} / ${snap.budgetTok.toLocaleString()} (${snap.pct}%)</b></div>
    ${snap.trimmed ? `<div class="tok-row"><span style="color:var(--warn)">Dropped from memory</span><b style="color:var(--warn)">${snap.trimmed} message${snap.trimmed > 1 ? 's' : ''}</b></div>` : ''}
    <div class="tok-sep"></div>
    <label for="tok-ctx">Context size</label>
    <select id="tok-ctx">
      ${[2048, 4096, 8192, 16384, 32768, 65536].map((v) => `<option value="${v}" ${s.contextSize === v ? 'selected' : ''}>${v.toLocaleString()} tokens</option>`).join('')}
    </select>
    <label for="tok-max">Longest reply</label>
    <select id="tok-max">
      ${[256, 512, 1024, 2048, 4096].map((v) => `<option value="${v}" ${s.maxTokens === v ? 'selected' : ''}>${v.toLocaleString()} tokens</option>`).join('')}
    </select>
    <div class="tok-note">Bigger context remembers more but uses more memory on your
      graphics card, and takes effect the next time the model loads.</div>`;

  document.body.appendChild(el);
  const r = anchor.getBoundingClientRect();
  // Right-align to the composer column rather than to the button: anchored left it
  // opens across the conversation, which is what made it feel like it was in the way.
  const col = ($('composer-wrap') || anchor).getBoundingClientRect();
  const left = Math.max(8, Math.min(col.right - el.offsetWidth, window.innerWidth - el.offsetWidth - 8));
  el.style.left = left + 'px';
  el.style.top = Math.max(8, r.top - el.offsetHeight - 6) + 'px';
  void el.offsetWidth;               // rAF never fires while occluded — flush, then show
  el.classList.add('open');

  el.addEventListener('click', (ev) => ev.stopPropagation());
  el.querySelector('#tok-ctx').addEventListener('change', async (ev) => {
    S.settings = await api.saveSettings({ contextSize: parseInt(ev.target.value, 10) });
    renderStatusStrip();
    toast('Context size saved — reload the model to apply it');
  });
  el.querySelector('#tok-max').addEventListener('change', async (ev) => {
    S.settings = await api.saveSettings({ maxTokens: parseInt(ev.target.value, 10) });
    renderStatusStrip();
  });

  const close = () => { el.remove(); document.removeEventListener('click', close); window.removeEventListener('keydown', onKey, true); };
  const onKey = (ev) => { if (ev.key === 'Escape') close(); };
  setTimeout(() => document.addEventListener('click', close), 0);
  window.addEventListener('keydown', onKey, true);
}

/* ---------- when is a web search actually worth it? ---------- */

const RE_CHITCHAT = /^(hi|hello|hey|yo|hola|buenas|thanks|thank you|gracias|ty|ok|okay|k|cool|nice|great|lol|haha|jaja|yes|yeah|yep|no|nope|sure|bye|adios|good (morning|night|evening|afternoon))\b/i;
// Questions about the assistant or the app itself — the web cannot answer these.
const RE_ABOUT_AI = /\b(are you|are u|how are you|who are you|what are you|your name|do you (feel|think|like|have|know|remember)|can you (feel|think|see|read|remember|access|search|browse|do)|you as an ai|as an ai|your (memory|training|knowledge|context|sources|engines))\b/i;
// Questions about this conversation — answered from history, never from the web.
const RE_META_CONVO = /\b(first|last|previous|earlier|second|third) (message|question|prompt|thing)\b|\bwhat (did|have) (i|we) (say|said|ask|asked|talk)\b|\b(this|our) (conversation|chat|thread)\b|\bsummari[sz]e (this|our|the) (chat|conversation|thread)\b/i;
// Bare acknowledgements only — "and on who will win the election" is a NEW question.
// "tell me more" and "tell me more about him" both lean on the previous answer.
const RE_PURE_FOLLOWUP = /^(tell me more|more|another|why|how so|explain|elaborate|go on|continue|what else|expand|details|otra|más|mas)\b(\s+(about|on|of)\s+(it|this|that|him|her|them|these|those|those two))?\s*\??$|^(and|so)\s*\??$/i;
// "and X", "what about X" — continues the topic but adds new content.
const RE_CONTINUATION = /^(and|also|plus|what about|how about|y|además|and what about)\b[,:]?\s*/i;
const STOPWORDS = new Set(['the', 'a', 'an', 'of', 'on', 'in', 'to', 'for', 'is', 'are', 'was', 'were', 'be', 'will', 'who', 'what', 'when', 'where', 'how', 'why', 'do', 'does', 'did', 'me', 'my', 'you', 'your', 'it', 'that', 'this', 'and', 'or', 'about', 'give', 'tell', 'find']);
const RE_MATHONLY = /^[\d\s().,+\-*/^%]+$/;

// A writing task is only search-free when the CONTENT is invented or supplied.
// "write a poem" needs no web; "write a report about the 2nd Trump term" absolutely does.
const RE_FICTION = /^(write|compose|create|make( up)?|invent|generate|draft)\s+(me\s+)?(a|an|some|the)?\s*(poem|story|song|joke|haiku|rap|lyric|fiction|novel|script|screenplay|tale|limerick)\b/i;
const RE_CODE_TASK = /^(code|program|refactor|debug|fix|implement)\b|\b(function|method|class|regex|sql query|component|script|snippet|bug in)\b/i;
const RE_TRANSFORM = /^(translate|rewrite|rephrase|proofread|correct|shorten|reformat|convert)\b/i;

// Messages that point back at the conversation instead of naming a new topic.
// Anything pointing back at the conversation — including pronouns, which stand in for
// a subject named earlier. Searching "who is he" literally returns nonsense.
const RE_REFERENTIAL = /\b(this|that|it|these|those|he|him|his|she|her|hers|they|them|their|the topic|same topic|again|your (answer|response|reply)|you (said|wrote|told)|above)\b/i;
const RE_EXPLICIT_SEARCH = /\b(search|look (it )?up|google|find out|check (online|again|it)|verify|fact.?check|browse|source it)\b/i;
const RE_CORRECTION = /\b(wrong|incorrect|not (true|right|correct)|fake|hallucinat\w*|made (that )?up|mistaken?|false|outdated|invented)\b/i;

// The subject of an earlier turn, used when the current message only says "this"/"the topic".
function previousTopic(chat) {
  if (!chat || !chat.messages) return '';
  const users = chat.messages.filter((m) => m.role === 'user');
  for (let i = users.length - 2; i >= 0; i--) { // -2 skips the message just sent
    const t = String(users[i].content || '').trim();
    if (t.split(/\s+/).length >= 3) return t;
  }
  return '';
}

// Decide whether to search AND what to search for — they are separate questions.
function searchPlan(text, chat) {
  const t = String(text || '').trim();
  const plan = { search: false, query: t, reason: '' };
  if (!S.settings.webSearch) return plan;

  const words = t.split(/\s+/).length;
  const referential = RE_REFERENTIAL.test(t) || RE_PURE_FOLLOWUP.test(t);
  const asksToSearch = RE_EXPLICIT_SEARCH.test(t) || RE_CORRECTION.test(t);

  // Never send the web a question about this chat or about the assistant itself.
  if (RE_META_CONVO.test(t)) { plan.reason = 'question about this conversation'; return plan; }
  if (RE_ABOUT_AI.test(t) && !asksToSearch) { plan.reason = 'question about the assistant'; return plan; }

  // "this is wrong, search the topic" must search the TOPIC, not that sentence.
  if (referential && words <= 20) {
    const topic = previousTopic(chat);
    if (topic) { plan.query = topic; plan.reason = 'follow-up → searched the earlier topic'; }
  }

  // "and on who will win the election" / "and 2027" continue the subject but ask
  // something new — they must search, using their own content plus the earlier topic.
  if (RE_CONTINUATION.test(t) && !RE_PURE_FOLLOWUP.test(t)) {
    const rest = t.replace(RE_CONTINUATION, '').trim();
    const meat = rest.split(/\s+/).filter((w) => w.length > 2 && !STOPWORDS.has(w.toLowerCase()));
    if (rest) {
      plan.query = meat.length >= 3 ? rest : `${previousTopic(chat)} ${rest}`.trim();
      plan.search = true;
      plan.reason = 'continues the previous topic';
      if (S.settings.searchMode === 'always') return plan;
      return plan;
    }
  }

  if (S.settings.searchMode === 'always') { plan.search = true; return plan; }

  // An explicit request to check or a correction always searches.
  if (asksToSearch && t.length >= 3) { plan.search = true; plan.reason = plan.reason || 'you asked it to check'; return plan; }

  if (t.length < 3) return plan;
  if (RE_MATHONLY.test(t)) return plan;
  if (RE_CHITCHAT.test(t)) return plan;
  if (RE_ABOUT_AI.test(t)) return plan;
  if (RE_FICTION.test(t)) return plan;      // invented content
  if (RE_CODE_TASK.test(t)) return plan;    // code, not facts
  // "translate this", "summarise the attached file" act on text we already have
  const lastMsg = chat && chat.messages && chat.messages[chat.messages.length - 1];
  const hasFiles = !!(lastMsg && lastMsg.attachments && lastMsg.attachments.length);
  if (RE_TRANSFORM.test(t) && (referential || hasFiles || words > 25)) return plan;
  if (RE_PURE_FOLLOWUP.test(t) && !asksToSearch) return plan; // memory is enough
  if (words <= 2 && !t.includes('?')) return plan;

  plan.search = true;
  return plan;
}

/* ---------- sidebar navigation ---------- */

// The search field is revealed by the magnifier rather than sitting open, and
// Chats / Projects switch what the list below is filtered to.
function wireSidebarNav() {
  const box = $('sb-search-box') || document.querySelector('.sb-search');
  const input = $('search');

  $('btn-search-toggle').addEventListener('click', () => {
    const showing = box.hidden;
    box.hidden = !showing;
    if (showing) input.focus();
    else if (input.value) { input.value = ''; renderChatList(); } // clearing it must restore the list
    $('btn-search-toggle').classList.toggle('active', showing);
  });

  $('nav-chats').addEventListener('click', () => {
    S.activeProjectId = null;          // "Chats" means all of them, no project filter
    renderProjectList();
    renderChatList();
    if (S.view !== 'chat') showView('chat');
    updateSidebarNav();
  });

  $('nav-projects').addEventListener('click', () => {
    const box2 = document.querySelector('.sb-projects');
    box2.hidden = !box2.hidden;
    updateSidebarNav();
  });

  updateSidebarNav();
}

function updateSidebarNav() {
  const projOpen = !document.querySelector('.sb-projects').hidden;
  $('nav-projects').classList.toggle('active', projOpen);
  $('nav-chats').classList.toggle('active', !projOpen && !S.activeProjectId);
}

/* ---------- boot ---------- */

async function init() {
  // icons
  $('btn-collapse').innerHTML = ICONS.sidebar;
  $('btn-expand').innerHTML = ICONS.sidebar;
  $('btn-settings').innerHTML = ICONS.gear;
  $('btn-panel').innerHTML = ICONS.sliders;
  $('btn-send').innerHTML = ICONS.up;
  $('btn-search-toggle').innerHTML = ICONS.search;
  $('btn-new-chat').querySelector('.sb-ico').innerHTML = ICONS.plus;
  $('nav-chats').querySelector('.sb-ico').innerHTML = ICONS.chats;
  $('nav-projects').querySelector('.sb-ico').innerHTML = ICONS.projects;
  wireSidebarNav();
  wireStatusStrip();
  trackWindowControls();

  S.settings = await api.getSettings();
  // Needed before the first paint: the composer's privacy line depends on knowing
  // whether the chosen provider is off this machine. Loading it lazily would show
  // "nothing leaves your PC" on launch while a hosted model was selected.
  S.providers = await api.listProviders();
  applyTheme(S.settings.theme || 'dark');   // the stored theme wins over the cached one
  S.server = await api.serverStatus();
  S.chats = await api.listChats();
  S.catalog = await api.getCatalog();
  S.projects = await api.listProjects();
  S.assistants = await api.listAssistants();
  renderProjectList();
  renderAssistantPicker();
  // one-shot entrance for the chat list; dropped so later re-renders don't replay it
  $('chat-list').classList.add('intro');
  setTimeout(() => $('chat-list').classList.remove('intro'), 700);
  await refreshModels();
  refreshRemoteStatus();
  updatePill();
  renderStatusStrip();
  renderChatList();
  initPanel();
  newChat();

  // auto-load last used model
  if (S.settings.lastModelPath && S.models.some((m) => m.path === S.settings.lastModelPath) && S.server.state === 'stopped') {
    loadModelFromUi(S.settings.lastModelPath);
  }

  // events
  $('btn-new-chat').addEventListener('click', newChat);
  $('search').addEventListener('input', renderChatList);

  // projects
  $('btn-new-project').addEventListener('click', createProject);
  $('proj-add-files').addEventListener('click', async () => {
    const p = S.projects.find((x) => x.id === S.editingProjectId);
    if (!p) return;
    const picked = await api.pickProjectFiles();
    p.files = p.files || [];
    for (const f of picked) {
      if (f.error) { toast(`${f.name}: ${f.error}`); continue; }
      p.files.push(f);
    }
    renderProjectFiles(p.files);
  });
  $('proj-save').addEventListener('click', async () => {
    const p = S.projects.find((x) => x.id === S.editingProjectId);
    if (!p) return;
    p.name = $('proj-name').value.trim() || p.name;
    p.systemPrompt = $('proj-prompt').value;
    S.projects = await api.saveProject(p);
    renderProjectList();
    $('proj-title').textContent = p.name;
    toast('Project saved');
  });
  $('proj-delete').addEventListener('click', async () => {
    const p = S.projects.find((x) => x.id === S.editingProjectId);
    if (!p || !confirm(`Delete project "${p.name}"? Its chats are kept, just ungrouped.`)) return;
    S.projects = await api.deleteProject(p.id);
    if (S.activeProjectId === p.id) S.activeProjectId = null;
    S.chats = await api.listChats();
    renderProjectList();
    renderChatList();
    showView('chat');
    toast('Project deleted');
  });

  // assistants
  $('p-assistant').addEventListener('change', async (e) => {
    const a = S.assistants.find((x) => x.id === e.target.value);
    if (S.chat) { S.chat.assistantId = a ? a.id : null; await saveCurrentChat(); }
    applyAssistant(a);
    $('p-assistant-hint').textContent = a
      ? `Using "${a.name}". Editing the fields below changes this chat only.`
      : 'A saved persona: instructions plus generation settings.';
  });
  $('p-save-assistant').addEventListener('click', saveCurrentAsAssistant);
  $('p-manage-assistants').addEventListener('click', manageAssistants);

  // artifacts
  $('ap-tab-preview').addEventListener('click', () => showArtifactTab('preview'));
  $('ap-tab-code').addEventListener('click', () => showArtifactTab('code'));
  $('ap-close').addEventListener('click', closeArtifact);
  // a way out that cannot be covered by anything
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('artifact-panel').classList.contains('closed')) closeArtifact();
  });
  $('ap-open').addEventListener('click', () => S.artifact && api.openArtifactExternally(S.artifact.path));
  $('ap-save').addEventListener('click', async () => {
    if (!S.artifact) return;
    const saved = await api.saveFile({ suggestedName: 'artifact.html', content: S.artifact.code });
    if (saved) toast('Saved: ' + saved);
  });
  $('btn-settings').addEventListener('click', () => showView(S.view === 'settings' ? 'chat' : 'settings'));
  $('model-pill').addEventListener('click', () => showView(S.view === 'models' ? 'chat' : 'models'));
  $('btn-panel').addEventListener('click', () => {
    const p = $('panel');
    p.classList.toggle('closed');
    $('btn-panel').classList.toggle('on', !p.classList.contains('closed'));
  });
  $('btn-collapse').addEventListener('click', () => {
    $('sidebar').classList.add('collapsed');
    $('btn-expand').hidden = false;
  });
  $('btn-expand').addEventListener('click', () => {
    $('sidebar').classList.remove('collapsed');
    $('btn-expand').hidden = true;
  });
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
    S.tab = t.dataset.tab;
    renderModelsView();
  }));
  $('btn-attach').innerHTML = ICONS.clip;
  $('btn-attach').addEventListener('click', attachFiles);
  $('btn-mic').innerHTML = ICONS.mic;
  $('btn-mic').addEventListener('click', toggleMic);
  $('btn-image').innerHTML = ICONS.image;
  $('btn-image').addEventListener('click', () => {
    const input = $('input');
    if (!RE_IMAGE_CMD.test(input.value)) input.value = '/image ' + input.value.replace(/^\/(image|img|draw)\s*/i, '');
    input.focus();
    autoGrow(input);
  });
  wireUpdateEvents();
  api.onImageProgress((p) => { if (S.imageHooks) S.imageHooks.progress(p); });
  api.onImageStage((s) => { if (S.imageHooks) S.imageHooks.stage(s); });
  $('messages').addEventListener('click', (e) => {
    const open = e.target.closest('.img-open');
    if (open) { api.showImage(open.dataset.path); return; }
    const again = e.target.closest('.img-again');
    if (again && !S.generating) { runImageGeneration(again.dataset.prompt); return; }
    if (e.target.closest('.img-cancel')) { api.cancelImage(); toast('Stopping image generation…'); }
  });
  $('btn-search').innerHTML = ICONS.globe + '<span>Search</span>';
  $('btn-search').addEventListener('click', async () => { await toggleSearch(); if (!$('search-menu').hidden) renderSearchMenu(); });
  $('search-wrap').addEventListener('mouseenter', showSearchMenu);
  $('search-wrap').addEventListener('mouseleave', () => hideSearchMenu());
  updateSearchButton();
  $('btn-send').addEventListener('click', send);
  $('input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });
  $('input').addEventListener('input', () => autoGrow($('input')));
  $('composer-model').addEventListener('change', (e) => {
    const v = e.target.value;
    if (v && v !== '__none' && v !== S.server.modelPath) loadModelFromUi(v);
  });
  $('btn-error-retry').addEventListener('click', () => {
    $('error-banner').hidden = true;
    const p = S.server.modelPath || S.settings.lastModelPath || $('composer-model').value;
    if (p && p !== '__none') loadModelFromUi(p);
  });
  $('btn-error-dismiss').addEventListener('click', () => { $('error-banner').hidden = true; });

  // source chips and any link in a reply open in the real browser, never in-app
  $('messages').addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="http"]');
    if (a) { e.preventDefault(); api.openExternal(a.getAttribute('href')); }
  });

  // copy / download buttons inside rendered markdown (event delegation)
  $('messages').addEventListener('click', (e) => {
    const copyBtn = e.target.closest('.cb-copy');
    if (copyBtn) {
      const code = copyBtn.closest('.codeblock').querySelector('code');
      navigator.clipboard.writeText(code.textContent);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
      return;
    }
    const dlBtn = e.target.closest('.cb-dl');
    if (dlBtn) { downloadCode(dlBtn.closest('.codeblock')); return; }
    const runBtn = e.target.closest('.cb-run');
    if (runBtn) {
      if (S.generating) { toast('Wait for the current reply to finish'); return; }
      runPythonBlock(runBtn.closest('.codeblock').querySelector('code').textContent);
      return;
    }
    const artBtn = e.target.closest('.cb-art');
    if (artBtn) {
      const block = artBtn.closest('.codeblock');
      openArtifact(block.querySelector('code').textContent, (block.dataset.lang || 'html').toUpperCase() + ' artifact');
    }
  });
}

// Paint the saved theme immediately — settings arrive from disk a moment later.
try { applyTheme(localStorage.getItem('portico-theme') || 'dark'); } catch {}

// Send front-end failures to the log file too, so a bug report has both halves.
window.addEventListener('error', (e) => {
  try {
    api.logClientError({
      message: e.message,
      source: `${e.filename}:${e.lineno}:${e.colno}`,
      stack: e.error && e.error.stack ? String(e.error.stack).slice(0, 2000) : '',
    });
  } catch {}
});
window.addEventListener('unhandledrejection', (e) => {
  try {
    const r = e.reason;
    api.logClientError({ message: 'unhandled rejection: ' + (r && r.message ? r.message : String(r)), stack: r && r.stack ? String(r.stack).slice(0, 2000) : '' });
  } catch {}
});

init();

// tiny hook for automated E2E tests (drives the same code paths as the UI)
window.__test = { addAttachments };
