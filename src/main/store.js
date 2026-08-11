const fs = require('fs');
const path = require('path');
const secrets = require('./secrets');

// Which settings are secret. The rest of settings.json stays readable, so the app can
// still start and find your models if the OS keyring is unavailable — only these are
// worth the risk of being unreadable.
const SECRET_KEYS = ['braveApiKey', 'remoteKey', 'shareKey'];

// Settings in userData/settings.json, one JSON file per conversation in userData/chats/.
//
// Conversations and the keys above are encrypted at rest with the OS keyring. Files
// written by an older version are plaintext, are read as such, and are re-encrypted
// the next time they are saved — so upgrading needs no migration step and cannot
// strand anyone mid-way.
class Store {
  constructor(userDataDir, defaults) {
    this.settingsPath = path.join(userDataDir, 'settings.json');
    this.chatsDir = path.join(userDataDir, 'chats');
    this.projectsPath = path.join(userDataDir, 'projects.json');
    this.assistantsPath = path.join(userDataDir, 'assistants.json');
    this.artifactsDir = path.join(userDataDir, 'artifacts');
    fs.mkdirSync(this.chatsDir, { recursive: true });
    fs.mkdirSync(this.artifactsDir, { recursive: true });
    this.defaults = defaults;
    this.settings = { ...defaults, ...this.readJson(this.settingsPath) };
    // kept decrypted in memory; only the file on disk is sealed
    for (const k of SECRET_KEYS) {
      if (secrets.isSealed(this.settings[k])) this.settings[k] = secrets.open(this.settings[k]);
    }
  }

  /* ---------- projects: a name, standing instructions, and reference files ---------- */

  listProjects() {
    const d = this.readJson(this.projectsPath);
    return Array.isArray(d.projects) ? d.projects : [];
  }

  saveProject(project) {
    const all = this.listProjects();
    const i = all.findIndex((p) => p.id === project.id);
    if (i >= 0) all[i] = { ...all[i], ...project }; else all.push(project);
    fs.writeFileSync(this.projectsPath, secrets.seal(JSON.stringify({ projects: all }, null, 2)));
    return all;
  }

  deleteProject(id) {
    const all = this.listProjects().filter((p) => p.id !== id);
    fs.writeFileSync(this.projectsPath, secrets.seal(JSON.stringify({ projects: all }, null, 2)));
    // chats survive; they just fall back to "no project"
    for (const meta of this.listChats()) {
      const c = this.getChat(meta.id);
      if (c && c.projectId === id) { delete c.projectId; this.saveChat(c); }
    }
    return all;
  }

  /* ---------- assistants: reusable persona + generation settings ---------- */

  listAssistants() {
    const d = this.readJson(this.assistantsPath);
    return Array.isArray(d.assistants) ? d.assistants : [];
  }

  saveAssistant(a) {
    const all = this.listAssistants();
    const i = all.findIndex((x) => x.id === a.id);
    if (i >= 0) all[i] = { ...all[i], ...a }; else all.push(a);
    fs.writeFileSync(this.assistantsPath, secrets.seal(JSON.stringify({ assistants: all }, null, 2)));
    return all;
  }

  deleteAssistant(id) {
    const all = this.listAssistants().filter((x) => x.id !== id);
    fs.writeFileSync(this.assistantsPath, secrets.seal(JSON.stringify({ assistants: all }, null, 2)));
    return all;
  }

  // Reads both shapes: a sealed file is opened first, a plaintext one from an older
  // version parses directly and gets sealed the next time it is written.
  readJson(p) {
    try {
      const raw = fs.readFileSync(p, 'utf8');
      return JSON.parse(secrets.isSealed(raw) ? secrets.open(raw) : raw);
    } catch { return {}; }
  }

  getSettings() {
    return this.settings;
  }

  saveSettings(patch) {
    this.settings = { ...this.settings, ...patch };
    const onDisk = { ...this.settings };
    for (const k of SECRET_KEYS) if (onDisk[k]) onDisk[k] = secrets.seal(onDisk[k]);
    fs.writeFileSync(this.settingsPath, JSON.stringify(onDisk, null, 2));
    return this.settings;
  }

  listChats() {
    let files;
    try { files = fs.readdirSync(this.chatsDir).filter((f) => f.endsWith('.json')); } catch { return []; }
    const chats = [];
    for (const f of files) {
      const c = this.readJson(path.join(this.chatsDir, f));
      if (c.id) {
        chats.push({
          id: c.id,
          title: c.title || 'New chat',
          updatedAt: c.updatedAt || 0,
          createdAt: c.createdAt || 0,
          projectId: c.projectId || null,
          assistantId: c.assistantId || null,
        });
      }
    }
    return chats.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  getChat(id) {
    if (!/^[\w-]+$/.test(id)) return null;
    const c = this.readJson(path.join(this.chatsDir, id + '.json'));
    return c.id ? c : null;
  }

  saveChat(chat) {
    if (!/^[\w-]+$/.test(chat.id)) return;
    fs.writeFileSync(path.join(this.chatsDir, chat.id + '.json'),
      secrets.seal(JSON.stringify(chat)));
  }

  deleteChat(id) {
    if (!/^[\w-]+$/.test(id)) return;
    try { fs.unlinkSync(path.join(this.chatsDir, id + '.json')); } catch {}
  }
}

module.exports = Store;
