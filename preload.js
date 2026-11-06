const { contextBridge, ipcRenderer, webUtils } = require('electron');
contextBridge.exposeInMainWorld('langram', {
  invoke: (ch, ...a) => ipcRenderer.invoke(ch, ...a),
  on: (ch, fn) => ipcRenderer.on(ch, (_e, ...a) => fn(...a)),
  fileUrl: (p) => 'file:///' + encodeURI(String(p).replace(/\\/g, '/')).replace(/#/g, '%23').replace(/\?/g, '%3F'),
  pathForFile: (f) => { try { return webUtils.getPathForFile(f); } catch { return ''; } }
});
