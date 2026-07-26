// Exercises the reworked sidebar in the real app: icons present, search toggle,
// Chats/Projects nav, and the new "…" row menu with Rename / Delete.
const WebSocket = require('ws');
const http = require('http');

const PORT = process.argv[2] || 9229;

function cdp(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let id = 0; const pending = new Map();
    ws.on('open', () => resolve({
      send(m, p) { return new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p })); }); },
      async eval(e) {
        const r = await this.send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true });
        if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails.exception));
        return r.result.value;
      },
      close: () => ws.close(),
    }));
    ws.on('error', reject);
    ws.on('message', (d) => {
      const m = JSON.parse(d);
      if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
    });
  });
}

let fails = 0;
const check = (ok, msg, extra = '') => { if (!ok) fails++; console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}${extra ? '\n        ' + extra : ''}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const list = await new Promise((res) => http.get(`http://127.0.0.1:${PORT}/json/list`, (x) => { let b = ''; x.on('data', (c) => { b += c; }); x.on('end', () => res(JSON.parse(b))); }));
  const page = list.find((t) => t.type === 'page' && /index\.html/.test(t.url));
  const c = await cdp(page.webSocketDebuggerUrl);
  await c.send('Runtime.enable');

  // The CDP target exists before the document is parsed and before init() paints
  // the icons — wait for the app to actually be up, or every static query "fails".
  for (let n = 0; n < 60; n++) {
    const ready = await c.eval(`document.readyState === 'complete' && !!document.querySelector('#btn-new-chat .sb-ico svg')`);
    if (ready) break;
    await wait(500);
  }

  console.log('\n============ SIDEBAR ============\n');

  const icons = await c.eval(`JSON.stringify({
    top: !!document.querySelector('.sb-top'),
    collapse: !!document.querySelector('#btn-collapse svg'),
    search: !!document.querySelector('#btn-search-toggle svg'),
    newChat: !!document.querySelector('#btn-new-chat .sb-ico svg'),
    newChatSolid: !!document.querySelector('#btn-new-chat .sb-ico.solid'),
    chats: !!document.querySelector('#nav-chats .sb-ico svg'),
    projects: !!document.querySelector('#nav-projects .sb-ico svg'),
    brandGone: !document.querySelector('.sb-brand')
  })`);
  const i = JSON.parse(icons);
  check(i.top && i.collapse && i.search, 'top row has collapse + search icons');
  check(i.newChat && i.newChatSolid, 'New chat has the solid icon tile');
  check(i.chats, 'Chats row has its icon');
  check(i.projects, 'Projects row has its icon');

  // search toggle — from a known closed state (the app instance is long-lived)
  await c.eval(`document.querySelector('.sb-search').hidden = true`);
  await c.eval(`document.querySelector('#btn-search-toggle').click()`);
  await wait(150);
  const searchOpen = await c.eval(`(() => { const b=document.querySelector('.sb-search'); return JSON.stringify({visible: !b.hidden, focused: document.activeElement && document.activeElement.id === 'search'}); })()`);
  const so = JSON.parse(searchOpen);
  check(so.visible, 'search icon reveals the field');
  check(so.focused, 'the field takes focus so you can type straight away');
  await c.eval(`document.querySelector('#btn-search-toggle').click()`);
  await wait(150);
  check(await c.eval(`document.querySelector('.sb-search').hidden`), 'clicking again hides it');

  // projects toggle — start from a known state; the app instance is long-lived and
  // an earlier run may have left the panel open
  await c.eval(`document.querySelector('.sb-projects').hidden = true`);
  await c.eval(`document.querySelector('#nav-projects').click()`);
  await wait(120);
  check(await c.eval(`!document.querySelector('.sb-projects').hidden`), 'Projects row opens the project list');
  check(await c.eval(`document.querySelector('#nav-projects').classList.contains('active')`), 'Projects row shows as active while open');
  await c.eval(`document.querySelector('#nav-projects').click()`);
  await wait(120);

  // make a chat so there is a row to act on
  await c.eval(`(async () => {
    await window.pristudio.saveChat({ id: 'ui-test-row', title: 'Row menu test', createdAt: Date.now(), updatedAt: Date.now(), messages: [{role:'user',content:'hi'}] });
  })()`);
  await c.eval(`(async () => { S_chats_reload = await window.pristudio.listChats(); })()`).catch(() => {});
  await c.eval(`(async () => { window.__t = await window.pristudio.listChats(); })()`);
  // re-render through the app's own path
  await c.eval(`(async () => { const api = window.pristudio; window.__before = (await api.listChats()).length; })()`);
  const chatCount = await c.eval(`window.__before`);
  check(chatCount > 0, 'a test chat exists on disk', chatCount + ' chats');

  // force the sidebar to redraw so the new row appears
  await c.eval(`(async () => {
    const list = await window.pristudio.listChats();
    // reach the app's state the same way the app does
    const ev = new Event('focus'); window.dispatchEvent(ev);
  })()`);

  const rowInfo = await c.eval(`(() => {
    const items = [...document.querySelectorAll('.chat-item')];
    return JSON.stringify({ count: items.length, hasMore: items.length ? !!items[0].querySelector('.a-more svg') : false, hasOldButtons: !!document.querySelector('.a-rename, .a-delete') });
  })()`);
  const ri = JSON.parse(rowInfo);
  check(ri.count > 0, 'chat rows render', ri.count + ' rows');
  check(ri.hasMore, 'each row has the "…" button');
  check(!ri.hasOldButtons, 'the old pencil/trash pair is gone');

  // open the row menu
  await c.eval(`document.querySelector('.chat-item .a-more').click()`);
  await wait(200);
  const menu = await c.eval(`(() => { const m=document.querySelector('.row-menu'); if(!m) return JSON.stringify({open:false}); return JSON.stringify({open:true, items:[...m.querySelectorAll('.row-menu-item')].map(b=>b.textContent), opened:m.classList.contains('open')}); })()`);
  const mm = JSON.parse(menu);
  check(mm.open, 'the "…" button opens a menu');
  check(mm.open && mm.items.join(',') === 'Rename,Delete', 'menu offers Rename and Delete', mm.open ? mm.items.join(' / ') : '');
  check(mm.opened, 'menu plays its open animation');

  // Escape closes it
  await c.eval(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))`);
  await wait(150);
  check(!(await c.eval(`!!document.querySelector('.row-menu')`)), 'Escape closes the menu');

  // clean up
  await c.eval(`window.pristudio.deleteChat('ui-test-row')`);

  console.log(`\n================================`);
  console.log(`RESULT: ${fails === 0 ? 'all checks passed' : fails + ' FAILED'}`);
  console.log(`================================\n`);
  c.close();
  process.exit(fails ? 1 : 0);
})();
