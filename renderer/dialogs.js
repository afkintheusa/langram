'use strict';
function modal(content, { cls = '', onClose } = {}) {
  const ov = $('#overlay'), box = h('div', { class: 'modal ' + cls }, content);
  const back = h('div', { class: 'backdrop', onmousedown: (e) => { if (e.target === back) close(); } }, box);
  const close = () => { if (!back.isConnected) return; back.remove(); if (!ov.children.length) ov.classList.remove('on'); onClose && onClose(); };
  back.close = close; ov.append(back); ov.classList.add('on');
  return { close, box };
}
const btn = (label, fn, cls = '') => h('button', { class: 'btn ' + cls, onclick: fn }, label);
const field = (label, input) => h('label', { class: 'field' }, h('span', {}, label), input);

function confirmDialog(title, text, okLabel, fn) {
  const m = modal(h('div', {}, h('div', { class: 'mh' }, title), h('div', { class: 'mb' }, text), h('div', { class: 'mf' }, btn('Cancel', () => m.close()), btn(okLabel, () => { m.close(); fn(); }, 'danger'))));
}
function deleteDialog(m) {
  const cb = h('div', { class: 'tg on' }); let ev = true;
  const canAll = m.mine && m.chat !== 'saved', who = m.chat === 'everyone' ? 'everyone' : chatInfo(m.chat).name;
  const d = modal(h('div', {}, h('div', { class: 'mh' }, 'Delete message'), h('div', { class: 'mb' }, 'Do you want to delete this message?',
    canAll ? h('div', { class: 'sw', style: { marginTop: '14px' }, onclick: () => { ev = !ev; cb.classList.toggle('on', ev); } }, cb, 'Also delete for ' + who) : null),
    h('div', { class: 'mf' }, btn('Cancel', () => d.close()), btn('Delete', () => { d.close(); api.invoke('delete', m.id, canAll && ev); }, 'danger'))));
}
function forwardDialog(m) {
  const d = modal(h('div', {}, h('div', { class: 'mh' }, 'Forward to…', iconBtn('close', 'Close', () => d.close())),
    h('div', { class: 'mb' }, chatIds().map((id) => { const c = chatInfo(id); return h('div', { class: 'fl-row', onclick: () => { d.close(); api.invoke('forward', m.id, id); toast('Forwarded to ' + c.name); } }, avatar(c, 40), h('b', {}, c.name)); }))));
}
function openLightbox(m) {
  const src = api.fileUrl(m.file), el = m.kind === 'gif' ? h('video', { src, autoplay: true, loop: true, muted: true, controls: true }) : h('img', { src });
  const lb = h('div', { class: 'lb', onclick: () => lb.close() }, el); lb.close = () => { lb.remove(); if (!$('#overlay').children.length) $('#overlay').classList.remove('on'); };
  el.addEventListener('click', (e) => e.stopPropagation()); $('#overlay').append(lb); $('#overlay').classList.add('on');
}

// ---------- image send dialog
function imageDialog(path) {
  return new Promise((res) => {
    let dims = [0, 0];
    const img = h('img', { src: api.fileUrl(path), onload: (e) => { dims = [e.target.naturalWidth, e.target.naturalHeight]; } });
    const cap = h('input', { class: 'cap-in', placeholder: 'Add a caption…' });
    const send = async () => { m.close(); await sendFile({ kind: 'image', path, w: dims[0], h: dims[1], caption: cap.value.trim() }); };
    cap.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
    const m = modal(h('div', {}, h('div', { class: 'mh' }, 'Send image'), h('div', { class: 'mb' }, h('div', { class: 'pvbox' }, img), cap),
      h('div', { class: 'mf' }, btn('Make sticker', () => makeSticker(path)), h('div', { class: 'sp1' }), btn('Cancel', () => m.close()), btn('Send', send, 'primary'))), { onClose: res });
    setTimeout(() => cap.focus(), 50);
  });
}

// ---------- video: precise trim + mute (muted = GIF)
function videoDialog(path, mode) {
  return new Promise((res) => {
    const isGif = mode === 'gif';
    let dur = 0, a = 0, b = 0, busy = false, vw = 0, vh = 0;
    const v = h('video', { src: api.fileUrl(path), preload: 'auto' });
    const track = h('div', { class: 'trk' }), rng = h('div', { class: 'rng' }), ha = h('div', { class: 'hd' }), hb = h('div', { class: 'hd' }), ph = h('div', { class: 'ph' });
    const trim = h('div', { class: 'trim' }, track, rng, ha, hb, ph);
    const ina = h('input', { type: 'number', step: '0.01', min: '0' }), inb = h('input', { type: 'number', step: '0.01', min: '0' });
    const info = h('span', { style: { color: 'var(--sub)', fontSize: '13px' } });
    const mute = h('div', { class: 'tg' + (isGif ? ' on' : '') });
    let muted = isGif;
    const cap = h('input', { class: 'cap-in', placeholder: 'Add a caption…', style: { marginTop: '10px' } });
    const pct = (t) => (dur ? (t / dur) * 100 : 0) + '%';
    const sync = () => {
      ha.style.left = pct(a); hb.style.left = pct(b); rng.style.left = pct(a); rng.style.width = dur ? ((b - a) / dur) * 100 + '%' : '0';
      ina.value = a.toFixed(2); inb.value = b.toFixed(2); info.textContent = `Length ${(b - a).toFixed(2)}s of ${dur.toFixed(2)}s`;
    };
    const tAt = (x) => { const r = track.getBoundingClientRect(); return clamp((x - r.left) / r.width, 0, 1) * dur; };
    const drag = (which) => (e) => {
      e.preventDefault(); e.stopPropagation(); v.pause();
      const mv = (ev) => { const t = tAt(ev.clientX); if (which === 'a') a = Math.min(t, b - .1); else b = Math.max(t, a + .1); sync(); v.currentTime = which === 'a' ? a : b; };
      const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
      addEventListener('pointermove', mv); addEventListener('pointerup', up);
    };
    ha.addEventListener('pointerdown', drag('a')); hb.addEventListener('pointerdown', drag('b'));
    trim.addEventListener('pointerdown', (e) => { if (e.target === track || e.target === rng) v.currentTime = clamp(tAt(e.clientX), a, b); });
    ina.onchange = () => { a = clamp(+ina.value || 0, 0, b - .1); sync(); v.currentTime = a; };
    inb.onchange = () => { b = clamp(+inb.value || dur, a + .1, dur); sync(); v.currentTime = Math.max(a, b - .5); };
    v.addEventListener('loadedmetadata', () => { dur = v.duration; vw = v.videoWidth; vh = v.videoHeight; a = 0; b = isGif ? Math.min(dur, 30) : dur; sync(); });
    v.addEventListener('timeupdate', () => { if (!v.paused && v.currentTime >= b) v.currentTime = a; ph.style.left = pct(v.currentTime); });
    v.addEventListener('click', () => (v.paused ? (v.currentTime < a || v.currentTime >= b ? (v.currentTime = a) : 0, v.play()) : v.pause()));
    v.addEventListener('error', () => { info.textContent = 'This video format cannot be previewed. You can still send it as a file.'; });
    const status = h('span', { style: { color: 'var(--sub)', fontSize: '13px' } });
    const setBusy = (t) => { busy = !!t; $$('.btn', box).forEach((x) => (x.disabled = busy)); status.textContent = t || ''; };
    const go = async () => {
      if (busy || !dur) return; v.pause(); setBusy('Processing…');
      const trimmed = a > .05 || b < dur - .05;
      try {
        if (isGif || muted) {
          const W = Math.min(480, vw || 480), H = Math.round(((vh || 270) * W) / (vw || 480));
          const r = await api.invoke('video:make', { src: path, start: a, end: b, mute: true, gif: true, w: W, h: H });
          S.gifs = r.gifs;
          if (!isGif) await sendFile({ kind: 'gif', path: r.path, w: W, h: H, dur: r.dur, caption: cap.value.trim() });
          else toast('Saved to your GIFs');
          if ($('#panel').classList.contains('open') && S.panelTab === 'gifs') renderPanel();
        } else if (trimmed) {
          const r = await api.invoke('video:make', { src: path, start: a, end: b, mute: false, gif: false, w: vw, h: vh });
          await sendFile({ kind: 'video', path: r.path, w: vw, h: vh, dur: r.dur, caption: cap.value.trim() });
        } else await sendFile({ kind: 'video', path, w: vw, h: vh, dur, caption: cap.value.trim() });
        m.close();
      } catch (e) { setBusy(''); toast('Could not process this video'); }
    };
    const { box, close } = (() => { const x = modal(h('div', {}, h('div', { class: 'mh' }, isGif ? 'Create GIF' : 'Send video', h('span', { style: { fontSize: '12px', color: 'var(--sub)', fontWeight: 400 } }, 'precise trim')),
      h('div', { class: 'mb' }, h('div', { class: 'pvbox' }, v), trim,
        h('div', { class: 'trow' }, h('label', {}, 'Start (s)', ina), h('label', {}, 'End (s)', inb),
          btn('[ Start = now', () => { a = clamp(v.currentTime, 0, b - .1); sync(); }), btn('End = now ]', () => { b = clamp(v.currentTime, a + .1, dur); sync(); })),
        h('div', { style: { margin: '6px 0' } }, info),
        isGif ? h('div', { style: { color: 'var(--sub)', fontSize: '13px' } }, 'GIFs are muted, looping and saved to your GIF tab.')
          : h('div', { class: 'sw', onclick: () => { muted = !muted; mute.classList.toggle('on', muted); } }, mute, 'Mute audio', h('span', { style: { color: 'var(--sub)', fontWeight: 400, fontSize: '13px' } }, '(muted videos are sent as GIFs and saved to your GIF tab)')),
        isGif ? null : cap),
      h('div', { class: 'mf' }, status, h('div', { class: 'sp1' }), btn('Cancel', () => m.close()),
        !isGif ? btn('Send as file', async () => { m.close(); await sendFile({ kind: 'file', path }); }) : null,
        btn(isGif ? 'Save GIF' : 'Send', go, 'primary'))), { cls: 'wide', onClose: () => { v.pause(); v.removeAttribute('src'); res(); } }); return x; })();
    const m = { close };
  });
}

// ---------- cropper (stickers & avatars)
function shapePath(c, r, shape) {
  if (shape === 'circle') { c.moveTo(r.x + r.w, r.y + r.h / 2); c.ellipse(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, r.h / 2, 0, 0, Math.PI * 2); }
  else if (shape === 'round') c.roundRect(r.x, r.y, r.w, r.h, Math.min(r.w, r.h) * .2);
  else c.rect(r.x, r.y, r.w, r.h);
}
function openCropper({ src, mode = 'sticker' }) {
  return new Promise((res) => {
    const img = new Image(); let done = false;
    const finish = (v) => { if (!done) { done = true; res(v); } };
    img.onload = () => {
      const CW = 480, CH = 360, sc = Math.min(CW / img.width, CH / img.height, 1), dw = Math.round(img.width * sc), dh = Math.round(img.height * sc);
      const cv = h('canvas', { width: dw, height: dh, class: 'crop-cv' }), ctx = cv.getContext('2d');
      let shape = mode === 'avatar' ? 'circle' : 'rect', square = mode === 'avatar';
      const s0 = Math.min(dw, dh) * .8; let r = square ? { x: (dw - s0) / 2, y: (dh - s0) / 2, w: s0, h: s0 } : { x: dw * .1, y: dh * .1, w: dw * .8, h: dh * .8 };
      const draw = () => {
        ctx.clearRect(0, 0, dw, dh); ctx.drawImage(img, 0, 0, dw, dh);
        ctx.fillStyle = 'rgba(0,0,0,.58)'; ctx.beginPath(); ctx.rect(0, 0, dw, dh); shapePath(ctx, r, shape); ctx.fill('evenodd');
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(r.x, r.y, r.w, r.h); ctx.fillStyle = '#fff';
        for (const [x, y] of corners()) ctx.fillRect(x - 5, y - 5, 10, 10);
      };
      const corners = () => [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h]];
      let drag = null;
      const pos = (e) => { const b = cv.getBoundingClientRect(); return [(e.clientX - b.left) * (dw / b.width), (e.clientY - b.top) * (dh / b.height)]; };
      const setFrom = (ax, ay, px, py) => {
        px = clamp(px, 0, dw); py = clamp(py, 0, dh); let w = px - ax, hh = py - ay;
        if (square) { const s = Math.min(Math.abs(w), Math.abs(hh)); w = Math.sign(w || 1) * s; hh = Math.sign(hh || 1) * s; }
        r = { x: Math.min(ax, ax + w), y: Math.min(ay, ay + hh), w: Math.max(8, Math.abs(w)), h: Math.max(8, Math.abs(hh)) };
      };
      cv.addEventListener('pointerdown', (e) => {
        const [x, y] = pos(e); cv.setPointerCapture(e.pointerId);
        const ci = corners().findIndex(([cx, cy]) => Math.abs(cx - x) < 14 && Math.abs(cy - y) < 14);
        if (ci >= 0) { const o = corners()[3 - ci]; drag = { t: 'rs', ax: o[0], ay: o[1] }; }
        else if (x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) drag = { t: 'mv', x, y };
        else drag = { t: 'rs', ax: x, ay: y };
      });
      cv.addEventListener('pointermove', (e) => {
        if (!drag) return; const [x, y] = pos(e);
        if (drag.t === 'mv') { r.x = clamp(r.x + x - drag.x, 0, dw - r.w); r.y = clamp(r.y + y - drag.y, 0, dh - r.h); drag.x = x; drag.y = y; } else setFrom(drag.ax, drag.ay, x, y);
        draw();
      });
      cv.addEventListener('pointerup', () => { drag = null; });
      const chips = h('div', { style: { display: 'flex', gap: '8px', marginTop: '6px', alignItems: 'center' } });
      const mk = () => {
        chips.replaceChildren(...(mode === 'avatar' ? [] : [['rect', 'Rectangle'], ['round', 'Rounded'], ['circle', 'Circle']].map(([k, l]) => h('button', { class: 'chip' + (shape === k ? ' on' : ''), onclick: () => { shape = k; mk(); draw(); } }, l))),
          ...(mode === 'avatar' ? [] : [h('button', { class: 'chip' + (square ? ' on' : ''), onclick: () => { square = !square; if (square) { const s = Math.min(r.w, r.h); r = { x: r.x, y: r.y, w: s, h: s }; } mk(); draw(); } }, 'Square')]));
      };
      mk(); draw();
      const out = () => {
        const k = 1 / sc, sx = r.x * k, sy = r.y * k, sw = r.w * k, sh = r.h * k, max = mode === 'avatar' ? 256 : 512, s = Math.min(1, max / Math.max(sw, sh));
        const W = Math.round(sw * s), H = Math.round(sh * s), c = document.createElement('canvas'); c.width = W; c.height = H;
        const x = c.getContext('2d'); x.save(); x.beginPath(); shapePath(x, { x: 0, y: 0, w: W, h: H }, mode === 'avatar' ? 'rect' : shape); x.clip(); x.drawImage(img, sx, sy, sw, sh, 0, 0, W, H); x.restore();
        return { dataUrl: mode === 'avatar' ? c.toDataURL('image/jpeg', .88) : c.toDataURL('image/png'), w: W, h: H };
      };
      const m = modal(h('div', {}, h('div', { class: 'mh' }, mode === 'avatar' ? 'Crop profile photo' : 'Make a sticker'),
        h('div', { class: 'mb' }, h('div', { class: 'crop-wrap' }, cv), chips, h('div', { style: { color: 'var(--sub)', fontSize: '12.5px', marginTop: '8px' } }, 'Drag to move · drag corners to resize · drag outside to start a new selection')),
        h('div', { class: 'mf' }, btn('Cancel', () => m.close()), btn(mode === 'avatar' ? 'Set photo' : 'Save sticker', () => { const o = out(); finish(o); m.close(); }, 'primary'))), { cls: 'wide', onClose: () => finish(null) });
    };
    img.onerror = () => { toast('Cannot open this image'); finish(null); };
    img.src = src;
  });
}
async function makeSticker(path) {
  const r = await openCropper({ src: await api.invoke('dataUrl', path), mode: 'sticker' });
  if (!r) return;
  S.stickers = await api.invoke('sticker:add', r.dataUrl, r.w, r.h); toast('Sticker saved');
  if ($('#panel').classList.contains('open') && S.panelTab === 'stickers') renderPanel();
}

// ---------- profile of someone else
function openProfile(id) {
  const c = chatInfo(id), on = S.online.has(id), p = S.peers[id] || {};
  const m = modal(h('div', {}, h('div', { class: 'mb', style: { textAlign: 'center', paddingTop: '22px' } }, h('div', { style: { display: 'flex', justifyContent: 'center' } }, avatar(c, 110)),
    h('div', { style: { fontSize: '22px', fontWeight: 600, marginTop: '12px' } }, c.name), h('div', { style: { color: on ? '#4cd964' : 'var(--sub)' } }, on ? 'online' : lastSeen(p)),
    p.username ? h('div', { style: { color: 'var(--accent)', marginTop: '10px' } }, '@' + p.username) : null,
    p.bio ? h('div', { style: { marginTop: '10px', userSelect: 'text' } }, p.bio) : null),
    h('div', { class: 'mf' }, btn('Close', () => m.close(), 'primary'))));
}

// ---------- settings
function openSettings(tab) {
  const root = h('div', { class: 'mb' });
  const toggle = (label, key, def = true, extra) => {
    const t = h('div', { class: 'tg' + ((S.settings[key] ?? def) ? ' on' : '') });
    return h('div', { class: 'setrow sw', onclick: () => { const v = !(S.settings[key] ?? def); t.classList.toggle('on', v); setSetting({ [key]: v }); } }, h('span', {}, label), t);
  };
  const saveMe = async (patch) => { S.me = await api.invoke('me:set', patch); renderRail(); if (S.chat) renderList(); };
  const av = h('div', { class: 'big-av', onclick: async () => {
    const [p] = await api.invoke('pick', { filters: [{ name: 'Images', extensions: EXT.image }] }); if (!p) return;
    const r = await openCropper({ src: await api.invoke('dataUrl', p), mode: 'avatar' }); if (r) { await saveMe({ avatar: r.dataUrl }); draw(); }
  } });
  const name = h('input', { value: S.me.name || '', maxlength: 30 }), user = h('input', { value: S.me.username || '', maxlength: 24, placeholder: 'username' }), bio = h('textarea', { rows: 2, maxlength: 120, placeholder: 'A few words about you' });
  bio.value = S.me.bio || '';
  name.onchange = () => name.value.trim() && saveMe({ name: name.value.trim() });
  user.onchange = () => { user.value = user.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase(); saveMe({ username: user.value }); };
  bio.onchange = () => saveMe({ bio: bio.value.trim() });
  const seg = (opts, cur, fn) => h('div', { class: 'seg' }, opts.map(([k, l]) => h('button', { class: cur === k ? 'on' : '', onclick: (e) => { $$('button', e.currentTarget.parentNode).forEach((b) => b.classList.remove('on')); e.currentTarget.classList.add('on'); fn(k); } }, l)));
  const wallGrid = h('div', { class: 'walls' });
  const drawWalls = () => {
    const w = S.settings.wall || {}, cur = w.kind === 'image' ? 'img' : w.id || WALLS.find((x) => x.id === (resolveTheme() === 'dark' ? 'aurora' : 'mint')).id;
    wallGrid.replaceChildren(...WALLS.map((p) => h('div', { class: 'w' + (cur === p.id ? ' on' : ''), style: { background: p.css }, onclick: async () => { await setSetting({ wall: { ...w, kind: 'preset', id: p.id } }); drawWalls(); } }, h('span', {}, p.name))),
      h('div', { class: 'w up' + (cur === 'img' ? ' on' : ''), onclick: async () => { const p = await api.invoke('wall:pick'); if (p) { await setSetting({ wall: { ...w, kind: 'image', path: p } }); drawWalls(); } } }, ic('upload'), 'Your own image'));
  };
  const draw = () => {
    av.replaceChildren(avatar({ id: S.me.id, name: S.me.name, avatar: S.me.avatar, kind: 'dm' }, 84), h('div', { class: 'cam' }, ic('image')));
    root.replaceChildren(
      h('div', { class: 'prof' }, av, h('div', { style: { flex: 1 } }, h('div', { style: { color: 'var(--sub)', fontSize: '13px' } }, 'Click the photo to change it. Others on your network see your name, photo, username and bio.'))),
      field('Name', name), field('Username', user), field('Bio', bio),
      h('div', { class: 'set-sec' }, 'Appearance'),
      h('div', { class: 'setrow' }, 'Theme', seg([['dark', 'Dark'], ['light', 'Light'], ['system', 'System']], S.settings.theme || 'dark', (k) => { setSetting({ theme: k }); drawWalls(); })),
      h('div', { class: 'setrow' }, 'Accent color', h('div', { class: 'swatches' }, ACCENTS.map((c) => h('i', { class: (S.settings.accent || ACCENTS[0]) === c ? 'on' : '', style: { background: c }, onclick: (e) => { $$('i', e.currentTarget.parentNode).forEach((x) => x.classList.remove('on')); e.currentTarget.classList.add('on'); setSetting({ accent: c }); } })))),
      h('div', { class: 'setrow' }, 'Message text size', h('input', { type: 'range', min: 12, max: 20, value: S.settings.fontSize || 15, oninput: (e) => setSetting({ fontSize: +e.target.value }) })),
      h('div', { style: { margin: '10px 0 8px', fontWeight: 600 } }, 'Chat background'), wallGrid,
      toggle('Doodle pattern on background', 'wallPat', true),
      h('div', { class: 'setrow' }, 'Blur (own image)', h('input', { type: 'range', min: 0, max: 14, value: (S.settings.wall || {}).blur || 0, oninput: (e) => setSetting({ wall: { ...(S.settings.wall || {}), blur: +e.target.value } }) })),
      h('div', { class: 'setrow' }, 'Dim (own image)', h('input', { type: 'range', min: 0, max: 70, value: (S.settings.wall || {}).dim || 0, oninput: (e) => setSetting({ wall: { ...(S.settings.wall || {}), dim: +e.target.value } }) })),
      h('div', { class: 'set-sec' }, 'General'),
      toggle('Desktop notifications', 'notify'), toggle('Notification sounds', 'sound'), toggle('Keep running in tray when closed', 'closeToTray'), toggle('Start with Windows', 'autostart', false),
      h('div', { class: 'set-sec' }, 'Storage'),
      h('div', { class: 'stor' }, h('b', {}, 'Received files'), h('span', { style: { fontSize: '12px', color: 'var(--sub)' } }, 'Photos, videos, music and files people send you'), h('code', {}, S.dirs.downloads),
        h('div', { class: 'row2' }, btn('Open', () => api.invoke('openFolder', S.dirs.downloads)), btn('Change…', async () => { const p = await api.invoke('dir:pick'); if (p) { S.dirs.downloads = p; draw(); } }), btn('Reset', async () => { S.dirs.downloads = await api.invoke('dir:reset'); draw(); }))),
      h('div', { class: 'stor' }, h('b', {}, 'Langram data'), h('span', { style: { fontSize: '12px', color: 'var(--sub)' } }, 'Chat history, stickers, GIFs, voice notes and your own sent media'), h('code', {}, S.dirs.data),
        h('div', { class: 'row2' }, btn('Open data folder', () => api.invoke('openFolder', S.dirs.data)), btn('Open media folder', () => api.invoke('openFolder', S.dirs.media)))),
      h('div', { class: 'set-sec' }, 'About'),
      h('div', { style: { color: 'var(--sub)', fontSize: '13px', lineHeight: 1.6 } }, `Langram ${S.ver || ''} · works on any shared Wi-Fi or LAN, no internet needed. Messages to offline people are queued and delivered automatically.`));
    drawWalls();
  };
  draw();
  const m = modal(h('div', {}, h('div', { class: 'mh' }, 'Settings', iconBtn('close', 'Close', () => m.close())), root, h('div', { class: 'mf' }, btn('Done', () => m.close(), 'primary'))), { cls: 'big' });
  if (tab === 'appearance') setTimeout(() => $$('.set-sec', root)[0].scrollIntoView(), 30);
}
