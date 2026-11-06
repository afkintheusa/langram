'use strict';
// ================= audio player (top bar slides down, hover shows previous / next)
const P = { id: null, speed: 1 };
const AU = () => $('#au');
const trackTitle = (m) => m.kind === 'voice' ? 'Voice message' : baseName(m.name) || 'Audio';
const audioList = (chat) => chatMsgs(chat).filter((m) => (m.kind === 'audio' || m.kind === 'voice') && m.file);

function playMsg(id) {
  const m = S.byId.get(id); if (!m) return; const au = AU();
  if (P.id === id) { au.paused ? au.play() : au.pause(); return; }
  P.id = id; au.src = api.fileUrl(m.file); au.playbackRate = P.speed;
  au.play().catch(() => toast('Cannot play this file'));
  renderPlayer(); syncAudioUI();
}
function seekWave(e, m) {
  const r = e.currentTarget.getBoundingClientRect(), f = clamp((e.clientX - r.left) / r.width, 0, 1), au = AU();
  if (P.id !== m.id) { playMsg(m.id); au.addEventListener('loadedmetadata', () => { au.currentTime = f * (isFinite(au.duration) ? au.duration : m.dur); }, { once: true }); }
  else au.currentTime = f * (isFinite(au.duration) ? au.duration : m.dur);
}
function stepTrack(d) {
  const m = S.byId.get(P.id); if (!m) return;
  const l = audioList(m.chat), i = l.findIndex((x) => x.id === m.id), n = l[i + d];
  if (n) playMsg(n.id);
}
function renderPlayer() {
  const bar = $('#player'), m = S.byId.get(P.id);
  if (!m) { bar.classList.remove('open'); return; }
  const l = audioList(m.chat), i = l.findIndex((x) => x.id === m.id), prev = l[i - 1], next = l[i + 1];
  const item = (t, lab) => t && h('div', { class: 'plit', onclick: () => playMsg(t.id) }, h('div', { class: 'ico' }, ic('music')), h('div', {}, h('b', {}, trackTitle(t)), h('span', {}, senderName(t.sender) + ' · ' + fmtDur(t.dur))));
  bar.classList.add('open');
  bar.replaceChildren(
    h('div', { class: 'plm' },
      h('button', { class: 'ib', title: 'Previous', disabled: !prev, onclick: () => stepTrack(-1) }, ic('prev')),
      h('button', { class: 'ib', id: 'plPlay', onclick: () => playMsg(P.id) }, ic(AU().paused ? 'play' : 'pause')),
      h('button', { class: 'ib', title: 'Next', disabled: !next, onclick: () => stepTrack(1) }, ic('next')),
      h('div', { class: 'plt' }, h('b', {}, trackTitle(m)), h('span', {}, senderName(m.sender))),
      h('span', { class: 'pltime', id: 'plTime' }, '0:00 / ' + fmtDur(m.dur)),
      h('button', { class: 'plspd', title: 'Playback speed', onclick: () => { P.speed = P.speed === 1 ? 1.5 : P.speed === 1.5 ? 2 : 1; AU().playbackRate = P.speed; renderPlayer(); } }, P.speed + 'x'),
      h('button', { class: 'ib', title: 'Close', onclick: () => { AU().pause(); AU().removeAttribute('src'); P.id = null; renderPlayer(); syncAudioUI(); } }, ic('close'))),
    h('div', { class: 'plbar', onclick: (e) => { const r = e.currentTarget.getBoundingClientRect(), au = AU(), d = isFinite(au.duration) ? au.duration : m.dur; au.currentTime = clamp((e.clientX - r.left) / r.width, 0, 1) * d; } }, h('i', { id: 'plFill' })),
    prev || next ? h('div', { class: 'plpop' }, prev ? h('div', { class: 'lab' }, 'Previous') : null, item(prev), next ? h('div', { class: 'lab' }, 'Next') : null, item(next)) : null);
  tickAudio();
}
function tickAudio() {
  const au = AU(), m = S.byId.get(P.id); if (!m) return;
  const d = isFinite(au.duration) && au.duration > 0 ? au.duration : m.dur || 0, f = d ? clamp(au.currentTime / d, 0, 1) : 0;
  const t = $('#plTime'), fl = $('#plFill'); if (t) t.textContent = fmtDur(au.currentTime) + ' / ' + fmtDur(d); if (fl) fl.style.width = f * 100 + '%';
  const el = $(`.audio[data-id="${P.id}"]`);
  if (el) { const bars = $$('.wave i', el), n = Math.floor(f * bars.length); bars.forEach((b, i) => b.classList.toggle('on', i < n)); const du = $('.adur', el); if (du) du.textContent = fmtDur(au.paused && !au.currentTime ? d : au.currentTime) ; }
}
function syncAudioUI() {
  const au = AU(), playing = !!P.id && !au.paused;
  $$('.audio').forEach((el) => {
    const on = el.dataset.id === P.id, b = $('.pbtn', el);
    b.replaceChildren(ic(on && playing ? 'pause' : 'play'));
    if (!on) { $$('.wave i', el).forEach((i) => i.classList.remove('on')); const m = S.byId.get(el.dataset.id); const du = $('.adur', el); if (m && du) du.textContent = fmtDur(m.dur); }
  });
  const pp = $('#plPlay'); if (pp) pp.replaceChildren(ic(playing ? 'pause' : 'play'));
  tickAudio();
}
document.addEventListener('DOMContentLoaded', () => {
  const au = AU();
  au.addEventListener('timeupdate', tickAudio);
  au.addEventListener('play', syncAudioUI); au.addEventListener('pause', syncAudioUI);
  au.addEventListener('loadedmetadata', tickAudio);
  au.addEventListener('ended', () => { const m = S.byId.get(P.id); if (!m) return; const l = audioList(m.chat), i = l.findIndex((x) => x.id === m.id), n = l[i + 1]; if (n) playMsg(n.id); else { au.currentTime = 0; syncAudioUI(); } });
});

// ================= voice messages
const R = {};
async function startRec() {
  if (!S.chat) return; let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { return toast('Microphone not available'); }
  const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '';
  const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined), chunks = [], wave = [];
  const ctx = new AudioContext(), an = ctx.createAnalyser(); an.fftSize = 512; ctx.createMediaStreamSource(stream).connect(an);
  const buf = new Uint8Array(an.fftSize), t0 = Date.now();
  const iv = setInterval(() => {
    an.getByteTimeDomainData(buf); let mx = 0; for (const v of buf) mx = Math.max(mx, Math.abs(v - 128));
    const lv = Math.min(1, mx / 80); wave.push(lv);
    $('#recLevel').style.transform = `scaleX(${.08 + lv * .92})`; $('#recTime').textContent = fmtDur((Date.now() - t0) / 1000);
  }, 100);
  mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stop = () => { clearInterval(iv); stream.getTracks().forEach((t) => t.stop()); ctx.close(); $('#composer').classList.remove('rec'); R.cancel = R.send = null; };
  mr.start(); $('#composer').classList.add('rec');
  R.cancel = () => { mr.onstop = null; try { mr.stop(); } catch {} stop(); };
  R.send = () => {
    const dur = (Date.now() - t0) / 1000;
    mr.onstop = async () => {
      if (dur < .7) return;
      const b = await new Blob(chunks, { type: 'audio/webm' }).arrayBuffer(), path = await api.invoke('saveBlob', b, 'webm');
      await sendFile({ kind: 'voice', path, name: 'voice.webm', dur, wave: resample(wave.length ? wave : [.3], 48).map((v) => +v.toFixed(2)) });
    };
    mr.stop(); stop();
  };
}

// ================= emoji / stickers / GIFs panel
function togglePanel(tab) {
  const p = $('#panel'), open = p.classList.contains('open');
  if (open && (!tab || tab === S.panelTab)) { p.classList.remove('open'); return; }
  if (tab) S.panelTab = tab; p.classList.add('open'); renderPanel();
}
function renderPanel() {
  const p = $('#panel'), tabs = [['emoji', 'Emoji'], ['stickers', 'Stickers'], ['gifs', 'GIFs']];
  p.replaceChildren(h('div', { class: 'ptabs' }, tabs.map(([k, l]) => h('button', { class: S.panelTab === k ? 'on' : '', onclick: () => { S.panelTab = k; renderPanel(); } }, l))), h('div', { class: 'pbody', id: 'pbody' }));
  ({ emoji: panelEmoji, stickers: panelStickers, gifs: panelGifs })[S.panelTab]();
}
function insertEmoji(e) {
  const ta = $('#input'); ta.focus(); ta.setRangeText(e, ta.selectionStart, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input'));
  const rec = [e, ...(S.settings.recents || []).filter((x) => x !== e)].slice(0, 32); S.settings.recents = rec; clearTimeout(insertEmoji.t); insertEmoji.t = setTimeout(() => api.invoke('settings:set', { recents: rec }), 800);
}
function panelEmoji() {
  const body = $('#pbody'), grid = (list) => h('div', { class: 'eg' }, list.map((e) => h('button', { onclick: () => insertEmoji(e) }, e)));
  const rec = (S.settings.recents || []).filter((x) => EMOJI_ALL.has(x));
  if (rec.length) body.append(h('div', { class: 'eh' }, 'Frequently used'), grid(rec));
  for (const c of Object.keys(EMOJI)) body.append(h('div', { class: 'eh', id: 'ec-' + c }, c), grid(emojiList(c)));
  $('#panel').append(h('div', { class: 'pnav' }, Object.entries(EMOJI_NAV).map(([c, e]) => h('button', { title: c, onclick: () => $('#ec-' + c).scrollIntoView({ behavior: 'smooth' }) }, e))));
}
function panelStickers() {
  const body = $('#pbody'), g = h('div', { class: 'sg' });
  g.append(h('div', { class: 't add', onclick: createSticker }, ic('plus'), 'Create sticker', h('span', {}, 'from any image')));
  for (const s of S.stickers) g.append(h('div', { class: 't', title: 'Click to send · right-click to remove', onclick: () => sendFile({ kind: 'sticker', path: s.file, w: s.w || 512, h: s.h || 512 }), oncontextmenu: (e) => { e.preventDefault(); showMenu(e.clientX, e.clientY, [{ label: 'Remove sticker', icon: 'trash', danger: true, fn: async () => { S.stickers = await api.invoke('lib:remove', 'stickers', s.id); renderPanel(); } }]); } }, h('img', { src: api.fileUrl(s.file), draggable: 'false' })));
  body.append(g);
  if (!S.stickers.length) body.append(h('div', { class: 'pempty' }, 'Make stickers by cropping any image. You can also right-click a picture in a chat → "Save as sticker".'));
}
function panelGifs() {
  const body = $('#pbody'), g = h('div', { class: 'sg gg' });
  g.append(h('div', { class: 't add', onclick: createGif }, ic('film'), 'Create GIF', h('span', {}, 'trim any video')));
  for (const f of S.gifs) g.append(h('div', { class: 't', title: 'Click to send · right-click to remove', onclick: () => sendFile({ kind: 'gif', path: f.file, w: f.w, h: f.h, dur: f.dur }), oncontextmenu: (e) => { e.preventDefault(); showMenu(e.clientX, e.clientY, [{ label: 'Remove GIF', icon: 'trash', danger: true, fn: async () => { S.gifs = await api.invoke('lib:remove', 'gifs', f.id); renderPanel(); } }]); } }, h('video', { src: api.fileUrl(f.file), autoplay: true, loop: true, muted: true, playsinline: true })));
  body.append(g);
  if (!S.gifs.length) body.append(h('div', { class: 'pempty' }, 'GIFs are short muted videos, made right here with no internet. Send a video muted and it lands here automatically.'));
}
async function createSticker() { const [p] = await api.invoke('pick', { filters: [{ name: 'Images', extensions: EXT.image }] }); if (p) makeSticker(p); }
async function createGif() { const [p] = await api.invoke('pick', { filters: [{ name: 'Videos', extensions: EXT.video }] }); if (p) videoDialog(p, 'gif'); }
