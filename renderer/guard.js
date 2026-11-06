'use strict';
// Shows any startup error on screen instead of a blank window.
function showErr(t) {
  let b = document.getElementById('errbox');
  if (!b) {
    b = document.createElement('pre'); b.id = 'errbox';
    b.style.cssText = 'position:fixed;left:12px;bottom:12px;right:12px;max-height:45%;overflow:auto;z-index:9999;background:#2a0f12;color:#ffb4b4;padding:12px;border-radius:10px;font:12px Consolas,monospace;user-select:text;-webkit-user-select:text;white-space:pre-wrap';
    document.body.append(b);
  }
  b.textContent += t + '\n';
}
window.addEventListener('error', (e) => showErr('Error: ' + e.message + ' (' + String(e.filename || '').split('/').pop() + ':' + e.lineno + ')'));
window.addEventListener('unhandledrejection', (e) => showErr('Error: ' + String((e.reason && (e.reason.stack || e.reason.message)) || e.reason)));
