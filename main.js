'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, Notification, Tray, Menu, nativeImage, session, clipboard } = require('electron');
const path = require('path'), fs = require('fs'), { spawn } = require('child_process'), crypto = require('crypto');
const { Store } = require('./store'), { Net, uid, safeName, uniquePath } = require('./net');

let FF = null;
try { FF = require('ffmpeg-static'); if (FF) FF = FF.replace('app.asar', 'app.asar.unpacked'); } catch {}

const ICON = path.join(__dirname, 'build', 'icon.png');
let win = null, tray = null, quitting = false, store, net;
const log = (...a) => { try { fs.appendFileSync(path.join(app.getPath('userData'), 'langram.log'), new Date().toISOString() + ' ' + a.map((x) => (x && x.stack) || String(x)).join(' ') + '\n'); } catch {} };
process.on('uncaughtException', (e) => { log('uncaught', e); try { dialog.showErrorBox('Langram error', String((e && e.stack) || e)); } catch {} });
app.disableHardwareAcceleration(); // avoids blank windows on PCs/VMs with problematic GPU drivers

if (!app.requestSingleInstanceLock()) { app.quit(); } else start();

function start() {
  app.setAppUserModelId('app.langram.desktop');
  app.on('second-instance', () => showWin());
  app.whenReady().then(async () => {
    const data = app.getPath('userData');
    const media = path.join(data, 'media');
    const DEFAULT_DL = path.join(app.getPath('downloads'), 'Langram');
    for (const d of ['stickers', 'gifs', 'received', 'sent']) fs.mkdirSync(path.join(media, d), { recursive: true });
    store = new Store(data);
    const DL = store.d.settings.downloadDir || DEFAULT_DL;
    net = new Net(store, { downloads: DL, received: path.join(media, 'received') });
    const send = (ch, ...a) => { if (win && !win.isDestroyed()) win.webContents.send(ch, ...a); };

    session.defaultSession.setPermissionRequestHandler((_wc, perm, cb) => cb(['media', 'clipboard-read', 'clipboard-sanitized-write'].includes(perm)));
    Menu.setApplicationMenu(null);

    net.on('msg', (m, o) => { send('msg', m); if (o && o.incoming) notify(m); updateTray(); });
    net.on('del', (id) => send('del', id));
    net.on('cleared', (c) => send('cleared', c));
    net.on('peer', (p) => send('peer', p));
    net.on('presence', (ids) => send('presence', ids));
    net.on('progress', (p) => send('progress', p));
    net.on('typing', (t) => send('typing', t));

    const notify = (m) => {
      if (store.d.settings.notify === false) return;
      if (win && win.isVisible() && win.isFocused() && !win.isMinimized()) return;
      const name = m.chat === 'everyone' ? 'Everyone' : (store.d.peers[m.sender] || {}).name || 'Langram';
      const who = m.chat === 'everyone' ? ((store.d.peers[m.sender] || {}).name || '?') + ': ' : '';
      const body = who + ({ text: m.text, image: '🖼 Photo', video: '🎬 Video', gif: 'GIF', sticker: 'Sticker', voice: '🎤 Voice message', audio: '🎵 ' + m.name }[m.kind] || '📎 ' + m.name);
      const n = new Notification({ title: name, body: body.slice(0, 140), icon: ICON, silent: store.d.settings.sound !== false });
      n.on('click', () => { showWin(); send('open-chat', m.chat); });
      n.show();
    };
    const updateTray = () => {
      if (!tray) return;
      const un = store.d.msgs.filter((m) => !m.mine && m.unread).length;
      tray.setToolTip(un ? `Langram - ${un} unread` : 'Langram');
    };

    // ---------------- IPC
    const H = (ch, fn) => ipcMain.handle(ch, (_e, ...a) => fn(...a));
    H('init', () => {
      const peers = {};
      for (const id in store.d.peers) peers[id] = net.peerView(id);
      return { me: net.me, settings: store.d.settings, peers, msgs: store.d.msgs, stickers: store.d.stickers, gifs: store.d.gifs, online: [...net.onl], version: app.getVersion(), dirs: { downloads: net.dirs.downloads, data, media } };
    });
    H('send', (o) => { if (o.path && !fs.existsSync(o.path)) throw new Error('missing file'); net.queueMsg(o); return true; });
    H('edit', (id, text) => net.editMsg(id, text));
    H('delete', (id, everyone) => net.deleteMsg(id, everyone));
    H('react', (id, e) => net.react(id, e));
    H('forward', (id, chat) => { net.forward(id, chat); return true; });
    H('read', (chat) => { net.markRead(chat); updateTray(); });
    H('typing', (chat) => net.typing(chat));
    H('clear', (chat) => net.clearChat(chat));
    H('me:set', (p) => { net.updateMe(p); return net.me; });
    H('settings:set', (p) => {
      Object.assign(store.d.settings, p); store.save();
      if ('autostart' in p) app.setLoginItemSettings({ openAtLogin: !!p.autostart });
      return store.d.settings;
    });
    H('win', (a) => {
      if (!win) return;
      if (a === 'min') win.minimize();
      else if (a === 'max') win.isMaximized() ? win.unmaximize() : win.maximize();
      else if (a === 'close') win.close();
    });
    H('dir:pick', async () => {
      const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'], defaultPath: net.dirs.downloads });
      if (r.canceled || !r.filePaths[0]) return null;
      net.dirs.downloads = r.filePaths[0]; store.d.settings.downloadDir = r.filePaths[0]; store.save();
      return r.filePaths[0];
    });
    H('dir:reset', () => { net.dirs.downloads = DEFAULT_DL; delete store.d.settings.downloadDir; store.save(); return DEFAULT_DL; });
    H('pick', async (o = {}) => {
      const r = await dialog.showOpenDialog(win, { properties: ['openFile', ...(o.multi ? ['multiSelections'] : [])], filters: o.filters });
      return r.canceled ? [] : r.filePaths;
    });
    H('saveAs', async (src, name) => {
      const r = await dialog.showSaveDialog(win, { defaultPath: name || path.basename(src) });
      if (!r.canceled && r.filePath) { fs.copyFileSync(src, r.filePath); return true; }
      return false;
    });
    H('open', (p) => shell.openPath(p));
    H('showInFolder', (p) => shell.showItemInFolder(p));
    H('openFolder', (p) => { fs.mkdirSync(p, { recursive: true }); return shell.openPath(p); });
    H('openExternal', (u) => { if (/^https?:\/\//i.test(u)) shell.openExternal(u); });
    H('copy', (t) => clipboard.writeText(String(t)));
    H('saveBlob', (buf, ext) => {
      const p = path.join(media, 'sent', `${Date.now()}_${crypto.randomBytes(3).toString('hex')}.${String(ext).replace(/[^a-z0-9]/gi, '')}`);
      fs.writeFileSync(p, Buffer.from(buf)); return p;
    });
    const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp', jfif: 'image/jpeg' };
    H('dataUrl', (p) => `data:${MIME[path.extname(p).slice(1).toLowerCase()] || 'image/png'};base64,${fs.readFileSync(p).toString('base64')}`);
    H('wall:pick', async () => {
      const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] }] });
      if (r.canceled) return null;
      const dst = path.join(media, `wall_${Date.now()}${path.extname(r.filePaths[0])}`);
      fs.copyFileSync(r.filePaths[0], dst); return dst;
    });

    // stickers & gifs library
    const lib = (kind, file, extra) => { const e = { id: uid(), file, ...extra }; store.d[kind].unshift(e); store.save(); return store.d[kind]; };
    H('sticker:add', (dataUrl, w, h) => {
      const f = path.join(media, 'stickers', uid() + '.png');
      fs.writeFileSync(f, Buffer.from(dataUrl.split(',')[1], 'base64')); return lib('stickers', f, { w, h });
    });
    H('lib:addFile', (kind, src, w, h, dur) => {
      const dst = path.join(media, kind, uid() + path.extname(src)); fs.copyFileSync(src, dst); return lib(kind, dst, { w, h, dur });
    });
    H('lib:remove', (kind, id) => {
      const e = store.d[kind].find((x) => x.id === id);
      store.d[kind] = store.d[kind].filter((x) => x.id !== id); store.save();
      if (e) try { fs.unlinkSync(e.file); } catch {}
      return store.d[kind];
    });

    // video -> trimmed / muted mp4 (precise, re-encoded) using bundled ffmpeg
    H('video:make', ({ src, start: ss, end, mute, gif, w, h }) => new Promise((resolve, reject) => {
      if (!FF) return reject(new Error('ffmpeg missing'));
      const out = path.join(media, gif ? 'gifs' : 'sent', `${gif ? 'gif' : 'vid'}_${Date.now()}.mp4`);
      const dur = Math.max(0.1, end - ss);
      const vf = gif ? "scale='min(480,iw)':-2" : 'scale=trunc(iw/2)*2:trunc(ih/2)*2';
      const args = ['-y', '-ss', String(ss), '-i', src, '-t', String(dur), '-map', '0:v:0', ...(mute ? ['-an'] : ['-map', '0:a:0?', '-c:a', 'aac', '-b:a', '128k']),
        '-vf', vf, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', gif ? '26' : '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out];
      const p = spawn(FF, args, { windowsHide: true }); let err = '';
      p.stderr.on('data', (d) => { err = (err + d).slice(-600); });
      p.on('error', reject);
      p.on('close', (code) => {
        if (code !== 0 || !fs.existsSync(out)) return reject(new Error('ffmpeg failed: ' + err));
        const res = { path: out, dur };
        if (gif) {
          const e = { id: uid(), file: out, w, h, dur }; store.d.gifs.unshift(e); store.save(); res.gifs = store.d.gifs;
        }
        resolve(res);
      });
    }));
    // ---------------- window (created AFTER all IPC handlers exist)
    createWindow();
    try {
      tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 }));
      tray.setContextMenu(Menu.buildFromTemplate([{ label: 'Open Langram', click: showWin }, { type: 'separator' }, { label: 'Quit', click: () => { quitting = true; app.quit(); } }]));
      tray.on('click', showWin); updateTray();
    } catch (e) { log('tray failed', e); }
    try { app.setLoginItemSettings({ openAtLogin: !!store.d.settings.autostart }); } catch {}
    try { await net.start(); } catch (e) { log('network start failed', e); dialog.showErrorBox('Langram network error', String(e && e.message || e)); }
  });
  app.on('before-quit', () => { quitting = true; if (store) store.flush(); });
  app.on('window-all-closed', () => {});
}

function createWindow() {
  const dark = store.d.settings.theme !== 'light';
  win = new BrowserWindow({
    width: 1220, height: 780, minWidth: 900, minHeight: 560, show: false, icon: ICON,
    backgroundColor: dark ? '#0e1621' : '#e6ebf0',
    titleBarStyle: 'hidden',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, spellcheck: false }
  });
  const wc = win.webContents;
  wc.on('did-fail-load', (_e, code, desc, url) => { log('did-fail-load', code, desc, url); dialog.showErrorBox('Langram could not load its window', `${desc} (${code})\n${url}`); });
  wc.on('render-process-gone', (_e, d) => log('render-process-gone', JSON.stringify(d)));
  wc.on('preload-error', (_e, p, err) => log('preload-error', p, err));
  wc.on('console-message', (_e, level, msg, line, src) => { if (level >= 2) log('console', msg, src + ':' + line); });
  wc.on('before-input-event', (_e, i) => { if (i.type === 'keyDown' && (i.key === 'F12' || (i.control && i.shift && String(i.key).toLowerCase() === 'i'))) wc.toggleDevTools(); });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html')).catch((e) => log('loadFile failed', e));
  setTimeout(() => { if (win && !win.isDestroyed() && !win.isVisible()) win.show(); }, 4000);
  win.once('ready-to-show', () => win.show());
  win.on('maximize', () => win.webContents.send('maxstate', true));
  win.on('unmaximize', () => win.webContents.send('maxstate', false));
  win.on('close', (e) => {
    if (!quitting && store.d.settings.closeToTray !== false) { e.preventDefault(); win.hide(); }
  });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:\/\//i.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
}
function showWin() { if (!win) return; if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
