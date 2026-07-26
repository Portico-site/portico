const fs = require('fs');
const path = require('path');

// Settings in userData/settings.json, one JSON file per conversation in userData/chats/.
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
    fs.writeFileSync(this.projectsPath, JSON.stringify({ projects: all }, null, 2));
    return all;
  }

  deleteProject(id) {
    const all = this.listProjects().filter((p) => p.id !== id);
    fs.writeFileSync(this.projectsPath, JSON.stringify({ projects: all }, null, 2));
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
    fs.writeFileSync(this.assistantsPath, JSON.stringify({ assistants: all }, null, 2));
    return all;
  }

  deleteAssistant(id) {
    const all = this.listAssistants().filter((x) => x.id !== id);
    fs.writeFileSync(this.assistantsPath, JSON.stringify({ assistants: all }, null, 2));
    return all;
  }

  readJson(p) {
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return {}; }
  }

  getSettings() {
    return this.settings;
  }

  saveSettings(patch) {
    this.settings = { ...this.settings, ...patch };
    fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2));
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
    fs.writeFileSync(path.join(this.chatsDir, chat.id + '.json'), JSON.stringify(chat));
  }

  deleteChat(id) {
    if (!/^[\w-]+$/.test(id)) return;
    try { fs.unlinkSync(path.join(this.chatsDir, id + '.json')); } catch {}
  }
}

module.exports = Store;
