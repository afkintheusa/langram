'use strict';
const api = window.langram;
const S = { me: {}, settings: {}, peers: {}, online: new Set(), byId: new Map(), byChat: new Map(), chat: null, filter: 'all', stick: true, shown: 100, reply: null, edit: null, typing: {}, newBelow: 0, unreadFrom: null, stickers: [], gifs: [], panelTab: 'emoji', query: '' };
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const pad = (n) => String(n).padStart(2, '0');
const ACCENTS = ['#3390ec', '#8774e1', '#e5558d', '#2fb67c', '#f08c2e', '#e5493a', '#16a6b6'];

function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (['value', 'checked', 'disabled', 'muted'].includes(k)) e[k] = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(2)) if (c != null && c !== false) e.append(c instanceof Node ? c : String(c));
  return e;
}
const iconBtn = (name, title, fn) => h('button', { class: 'ib', title, onclick: fn }, ic(name));

// ---------- formatting
const fmtTime = (t) => { const d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
function fmtDay(t) {
  const n = new Date(); if (sameDay(t, n)) return 'Today';
  const y = new Date(n); y.setDate(n.getDate() - 1); if (sameDay(t, y)) return 'Yesterday';
  const d = new Date(t); return d.toLocaleDateString([], { day: 'numeric', month: 'long', year: d.getFullYear() === n.getFullYear() ? undefined : 'numeric' });
}
function listTime(t) {
  const n = new Date(); if (sameDay(t, n)) return fmtTime(t);
  return n - t < 6 * 864e5 ? new Date(t).toLocaleDateString([], { weekday: 'short' }) : new Date(t).toLocaleDateString([], { day: 'numeric', month: 'short' });
}
function fmtSize(n) { for (const u of ['B', 'KB', 'MB', 'GB']) { if (n < 1024) return (u === 'B' ? n : n.toFixed(1)) + ' ' + u; n /= 1024; } return n.toFixed(1) + ' TB'; }
const fmtDur = (s) => { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ':' + pad(s % 60); };
const hue = (id) => { let x = 0; for (const c of String(id)) x = (x * 31 + c.charCodeAt(0)) >>> 0; return x % 360; };
const baseName = (n) => String(n || '').replace(/\.[^.]+$/, '');
const EXT = { image: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'jfif'], video: ['mp4', 'webm', 'mov', 'm4v', 'mkv', 'avi'], audio: ['mp3', 'wav', 'ogg', 'oga', 'm4a', 'flac', 'aac', 'opus', 'wma'] };
const kindOf = (p) => { const e = String(p).split('.').pop().toLowerCase(); for (const k in EXT) if (EXT[k].includes(e)) return k; return 'file'; };

function avatar(c, size = 48) {
  const e = h('div', { class: 'avatar', style: { width: size + 'px', height: size + 'px', fontSize: size * .4 + 'px' } });
  if (c.kind === 'saved') { e.style.background = 'linear-gradient(135deg,#5eb5f7,#2a7de1)'; e.append(ic('bookmark')); }
  else if (c.kind === 'group') { e.style.background = 'linear-gradient(135deg,#7ed67e,#35a46b)'; e.append(ic('users')); }
  else if (c.avatar) e.append(h('img', { src: c.avatar, draggable: 'false' }));
  else { const a = hue(c.id); e.style.background = `linear-gradient(135deg,hsl(${a} 70% 62%),hsl(${(a + 40) % 360} 65% 48%))`; e.append((c.name || '?').trim().slice(0, 1).toUpperCase()); }
  return e;
}

// ---------- data helpers
function indexMsgs(list) {
  S.byId.clear(); S.byChat.clear();
  for (const m of list.sort((a, b) => a.ts - b.ts)) { S.byId.set(m.id, m); if (!S.byChat.has(m.chat)) S.byChat.set(m.chat, []); S.byChat.get(m.chat).push(m); }
}
const chatMsgs = (c) => S.byChat.get(c) || [];
const lastOf = (c) => { const a = chatMsgs(c); return a[a.length - 1]; };
const unreadOf = (c) => chatMsgs(c).filter((m) => !m.mine && m.unread).length;
const chatIds = () => ['saved', 'everyone', ...Object.keys(S.peers).filter((i) => i !== S.me.id)];
function chatInfo(id) {
  if (id === 'saved') return { id, name: 'Saved Messages', kind: 'saved' };
  if (id === 'everyone') return { id, name: 'Everyone', kind: 'group' };
  const p = S.peers[id] || { id, name: 'Unknown' };
  return { id, name: p.name || 'Unknown', username: p.username, bio: p.bio, avatar: p.avatar, kind: 'dm' };
}
const senderName = (id) => id === S.me.id ? S.me.name : (S.peers[id] || {}).name || 'Unknown';
const isOnline = (id) => id === 'everyone' ? S.online.size > 0 : S.online.has(id);
function preview(m) {
  switch (m.kind) {
    case 'text': return m.text;
    case 'image': return '🖼 ' + (m.caption || 'Photo');
    case 'video': return '🎬 ' + (m.caption || 'Video');
    case 'gif': return 'GIF';
    case 'sticker': return 'Sticker';
    case 'voice': return '🎤 Voice message';
    case 'audio': return '🎵 ' + (m.name || 'Audio');
    default: return '📎 ' + (m.name || 'File');
  }
}
function lastSeen(p) {
  if (!p || !p.seen) return 'last seen a long time ago';
  const d = Date.now() - p.seen;
  if (d < 6e4) return 'last seen just now';
  if (d < 36e5) return `last seen ${Math.round(d / 6e4)} min ago`;
  return sameDay(p.seen, Date.now()) ? 'last seen at ' + fmtTime(p.seen) : 'last seen ' + fmtDay(p.seen).toLowerCase() + ' at ' + fmtTime(p.seen);
}
const typingNow = (chat) => S.typing[chat] && Date.now() - S.typing[chat].t < 4000 ? S.typing[chat] : null;

function tickEl(m) {
  if (m.mine && m.status === 'saved') return null;
  const map = { queued: 'clock', sent: 'check', delivered: 'check', read: 'check2' };
  if (m.status === 'failed') return h('span', { class: 'tick failed', title: 'File not found' }, '!');
  return h('span', { class: 'tick ' + m.status, title: m.status }, ic(map[m.status] || 'check'));
}

// ---------- theme / wallpaper
function resolveTheme() { const t = S.settings.theme || 'dark'; return t === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : t; }
function applyTheme() {
  const th = resolveTheme(); document.documentElement.dataset.theme = th;
  document.documentElement.style.setProperty('--accent', S.settings.accent || ACCENTS[0]);
  document.documentElement.style.setProperty('--fs', (S.settings.fontSize || 15) + 'px');
  applyWall();
}
function applyWall() {
  const w = S.settings.wall || {}, th = resolveTheme(), bg = $('#wallbg'), pat = $('#wallpat');
  let dark = th === 'dark';
  bg.style.cssText = ''; bg.style.position = 'absolute'; bg.style.inset = '0';
  if (w.kind === 'image' && w.path) {
    bg.style.background = `center/cover no-repeat url("${api.fileUrl(w.path)}")`;
    bg.style.filter = `blur(${w.blur || 0}px) brightness(${1 - (w.dim || 0) / 100})`;
    bg.style.transform = w.blur ? 'scale(1.1)' : '';
  } else {
    const p = WALLS.find((x) => x.id === w.id) || WALLS.find((x) => x.id === (th === 'dark' ? 'aurora' : 'mint'));
    bg.style.background = p.css; dark = p.dark;
  }
  const ink = dark ? '#ffffff' : '#12301f';
  pat.style.backgroundImage = S.settings.wallPat === false ? 'none' : `url("data:image/svg+xml,${encodeURIComponent(patternSvg(ink))}")`;
  pat.style.opacity = dark ? .075 : .13;
  $('#scroller').classList.toggle('wall-dark', dark);
}
async function setSetting(patch) { Object.assign(S.settings, patch); await api.invoke('settings:set', patch); applyTheme(); renderRail(); }

// ---------- rail + list
function renderRail() {
  const rail = $('#rail'); rail.replaceChildren();
  const un = chatIds().reduce((n, c) => n + unreadOf(c), 0);
  const b = (id, icon, label, cnt) => h('button', { class: 'rbtn' + (S.filter === id ? ' on' : ''), onclick: () => { S.filter = id; renderRail(); renderList(); } }, ic(icon), label, cnt ? h('span', { class: 'cnt' }, cnt > 99 ? '99+' : cnt) : null);
  rail.append(
    h('div', { class: 'rme', onclick: () => openSettings('profile'), style: { cursor: 'pointer' }, title: 'Profile & settings' }, avatar({ id: S.me.id, name: S.me.name, avatar: S.me.avatar, kind: 'dm' }, 44)),
    b('all', 'chats', 'All chats'), b('unread', 'unread', 'Unread', un), b('online', 'wifi', 'Online'),
    h('div', { class: 'sp' }),
    h('button', { class: 'rbtn', onclick: () => setSetting({ theme: resolveTheme() === 'dark' ? 'light' : 'dark' }) }, ic(resolveTheme() === 'dark' ? 'sun' : 'moon'), resolveTheme() === 'dark' ? 'Light' : 'Dark'),
    h('button', { class: 'rbtn', onclick: () => openSettings('appearance') }, ic('gear'), 'Settings'));
}
let listQueued = false;
function renderList() {
  if (listQueued) return; listQueued = true;
  requestAnimationFrame(() => { listQueued = false; drawList(); });
}
function drawList() {
  const box = $('#list'), q = S.query.trim().toLowerCase(); box.replaceChildren();
  if (q) {
    const chats = chatIds().map(chatInfo).filter((c) => c.name.toLowerCase().includes(q) || (c.username || '').toLowerCase().includes(q));
    if (chats.length) { box.append(h('div', { class: 'sec' }, 'Chats')); chats.forEach((c) => box.append(rowEl(c.id))); }
    const hits = [];
    for (const m of S.byId.values()) if (m.kind === 'text' && m.text.toLowerCase().includes(q)) hits.push(m);
    hits.sort((a, b) => b.ts - a.ts);
    if (hits.length) {
      box.append(h('div', { class: 'sec' }, 'Messages'));
      hits.slice(0, 40).forEach((m) => box.append(h('div', { class: 'rc', onclick: () => { openChat(m.chat); setTimeout(() => jumpTo(m.id), 50); } },
        avatar(chatInfo(m.chat), 42), h('div', { class: 'ci' }, h('div', { class: 'r1' }, h('span', { class: 'nm' }, chatInfo(m.chat).name), h('span', { class: 'tm' }, listTime(m.ts))), h('div', { class: 'pv' }, (m.mine ? 'You: ' : '') + m.text)))));
    }
    if (!chats.length && !hits.length) box.append(h('div', { class: 'pempty' }, 'Nothing found'));
    return;
  }
  let ids = chatIds();
  if (S.filter === 'unread') ids = ids.filter((c) => unreadOf(c) > 0);
  if (S.filter === 'online') ids = ids.filter((c) => c !== 'saved' && isOnline(c));
  const pin = (c) => S.filter !== 'all' ? 0 : c === 'saved' ? 2 : c === 'everyone' ? 1 : 0;
  ids.sort((a, b) => pin(b) - pin(a) || ((lastOf(b) || {}).ts || 0) - ((lastOf(a) || {}).ts || 0) || chatInfo(a).name.localeCompare(chatInfo(b).name));
  ids.forEach((c) => box.append(rowEl(c)));
  if (!ids.length) box.append(h('div', { class: 'pempty' }, S.filter === 'unread' ? 'No unread chats 🎉' : 'Nobody is online right now'));
}
function rowEl(id) {
  const c = chatInfo(id), last = lastOf(id), un = unreadOf(id), ty = typingNow(id);
  let pv = ty ? (id === 'everyone' ? ty.name + ' is typing…' : 'typing…') : last ? ((last.mine ? 'You: ' : id === 'everyone' ? senderName(last.sender) + ': ' : '') + preview(last).replace(/\n/g, ' ')) : (id === 'saved' ? 'Notes, files & forwarded messages' : id === 'everyone' ? 'Chat with everyone on the network' : 'No messages yet');
  return h('div', { class: 'rc' + (id === S.chat ? ' sel' : ''), onclick: () => openChat(id), 'data-chat': id },
    h('div', { class: 'avw' }, avatar(c, 52), isOnline(id) && id !== 'saved' && id !== 'everyone' ? h('i', { class: 'dot' }) : null),
    h('div', { class: 'ci' },
      h('div', { class: 'r1' }, h('span', { class: 'nm' }, c.name), last ? h('span', { class: 'tm' }, last.mine ? tickEl(last) : null, listTime(last.ts)) : null),
      h('div', { class: 'r2' }, h('span', { class: 'pv' + (ty ? ' typing' : '') }, pv), un ? h('span', { class: 'badge' }, un) : null)));
}

// ---------- header
function statusText(c) {
  const ty = typingNow(c.id); if (ty) return { t: c.id === 'everyone' ? ty.name + ' is typing…' : 'typing…', cls: 'typing' };
  if (c.kind === 'saved') return { t: 'Notes to self', cls: '' };
  if (c.kind === 'group') return { t: S.online.size ? `${S.online.size} online` : 'nobody else online', cls: S.online.size ? 'on' : '' };
  return S.online.has(c.id) ? { t: 'online', cls: 'on' } : { t: lastSeen(S.peers[c.id]), cls: '' };
}
function renderHeader() {
  const c = chatInfo(S.chat), hd = $('#head');
  hd.replaceChildren(
    h('div', { class: 'hl', onclick: () => c.kind === 'dm' && openProfile(c.id) }, avatar(c, 42), h('div', {}, h('div', { class: 'hn' }, c.name), h('div', { class: 'hs', id: 'hstat' }))),
    h('div', { class: 'hr' }, iconBtn('search', 'Search messages', () => $('#q').focus()), iconBtn('more', 'More', (e) => chatMenu(e))));
  updateStatus();
}
function updateStatus() {
  const el = $('#hstat'); if (!el) return; const s = statusText(chatInfo(S.chat));
  el.textContent = s.t; el.className = 'hs ' + s.cls;
}

// ---------- message rendering
const URL_RE = /https?:\/\/[^\s<>"']+/gi;
function textNodes(t) {
  const out = []; let last = 0;
  for (const mt of t.matchAll(URL_RE)) { out.push(t.slice(last, mt.index)); out.push(h('a', { href: mt[0], class: 'lnk' }, mt[0])); last = mt.index + mt[0].length; }
  out.push(t.slice(last)); return out;
}
const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\u200d|\ufe0f|\s)+$/u;
const isJumbo = (t) => t && t.length <= 16 && EMOJI_ONLY.test(t) && [...new Intl.Segmenter().segment(t.trim())].length <= 3;
function fit(w, hh, mw, mh) {
  if (!w || !hh) { w = mw * .8; hh = mh * .55; }
  const k = Math.min(1, mw / w, mh / hh); return [Math.round(w * k), Math.round(hh * k)];
}
const grouped = (a, b) => a && b && a.sender === b.sender && b.ts - a.ts < 300000 && sameDay(a.ts, b.ts);
const daySep = (ts) => h('div', { class: 'day' }, fmtDay(ts));

function mediaEl(m) {
  const src = api.fileUrl(m.file);
  if (m.kind === 'sticker') { const [w, hh] = fit(m.w, m.h, 200, 200); return h('img', { class: 'stk-img', src, style: { width: w + 'px', height: hh + 'px' }, draggable: 'false' }); }
  const [w, hh] = fit(m.w, m.h, 360, 400), st = { width: w + 'px', height: hh + 'px' };
  if (m.kind === 'image') return h('img', { class: 'media', src, style: st, draggable: 'false', onclick: () => openLightbox(m) });
  if (m.kind === 'gif') return h('div', { class: 'gifw' }, h('video', { class: 'media', src, style: st, autoplay: true, loop: true, muted: true, playsinline: true, onclick: () => openLightbox(m) }), h('span', { class: 'tag' }, 'GIF'));
  return h('video', { class: 'media', src, style: st, controls: true, preload: 'metadata' });
}
function seeded(id, n) { let s = 0; for (const c of id) s = (s * 31 + c.charCodeAt(0)) >>> 0; return Array.from({ length: n }, () => { s = (s * 1103515245 + 12345) >>> 0; return .25 + (s / 4294967296) * .75; }); }
function resample(a, n) { return Array.from({ length: n }, (_, i) => { const s = Math.floor(i * a.length / n), e = Math.max(s + 1, Math.floor((i + 1) * a.length / n)); return Math.max(.15, Math.max(...a.slice(s, e))); }); }
function audioEl(m) {
  const bars = m.wave && m.wave.length ? resample(m.wave, 42) : seeded(m.id, 42);
  const wave = h('div', { class: 'wave', onclick: (e) => seekWave(e, m) }, bars.map((v) => h('i', { style: { height: (4 + v * 22) + 'px' } })));
  return h('div', { class: 'audio', 'data-id': m.id }, h('button', { class: 'pbtn', onclick: () => playMsg(m.id) }, ic('play')),
    h('div', { class: 'ab' }, wave, h('div', { class: 'ameta' }, h('span', { class: 'adur' }, fmtDur(m.dur)), m.kind === 'audio' ? h('span', { class: 'aname' }, m.name) : null)));
}
function fileEl(m) {
  const waiting = m.mine && m.status === 'queued';
  return h('div', { class: 'file', onclick: () => m.file && api.invoke('open', m.file) },
    h('div', { class: 'fic' }, ic(waiting ? 'upload' : 'file')),
    h('div', {}, h('div', { class: 'fn' }, m.name), h('div', { class: 'fs' }, fmtSize(m.size) + (waiting ? ' · waiting to send' : '')), waiting ? h('div', { class: 'prog' }, h('i')) : null));
}

function msgRow(m, prev, next) {
  const mine = m.mine, group = S.chat === 'everyone';
  const isMedia = ['image', 'video', 'gif'].includes(m.kind), stk = m.kind === 'sticker';
  const bub = h('div', { class: 'bub' + (isMedia ? ' has-media' : '') + (stk ? ' stk' : '') });
  if (group && !mine && !grouped(prev, m)) bub.append(h('div', { class: 'sname', style: { color: `hsl(${hue(m.sender)} 75% 65%)` } }, senderName(m.sender)));
  if (m.fwd) bub.append(h('div', { class: 'fwd' }, 'Forwarded from ' + m.fwd));
  if (m.reply) bub.append(h('div', { class: 'reply', onclick: () => jumpTo(m.reply.id) }, h('b', {}, m.reply.name), h('span', {}, String(m.reply.text || '').slice(0, 100))));
  if (['image', 'video', 'gif', 'sticker'].includes(m.kind)) bub.append(mediaEl(m));
  else if (m.kind === 'voice' || m.kind === 'audio') bub.append(audioEl(m));
  else if (m.kind === 'file') bub.append(fileEl(m));
  const body = m.kind === 'text' ? m.text : m.caption;
  if (body) bub.append(h('div', { class: 'txt' + (m.kind === 'text' && isJumbo(body) ? ' jumbo' : '') }, textNodes(body)));
  const rs = Object.entries(m.reactions || {});
  if (rs.length) bub.append(h('div', { class: 'reacts' }, rs.map(([e, u]) => h('span', { class: 'react' + (u.includes(S.me.id) ? ' mine' : ''), onclick: () => api.invoke('react', m.id, e) }, e, u.length > 1 ? h('small', {}, u.length) : null))));
  bub.append(h('span', { class: 'meta' }, m.edited ? 'edited ' : '', fmtTime(m.ts), mine ? tickEl(m) : null));
  const row = h('div', { class: `row ${mine ? 'out' : 'in'}${grouped(prev, m) ? '' : ' gf'}${grouped(m, next) ? '' : ' gl'}`, 'data-id': m.id }, bub);
  return row;
}

function renderChat(keep) {
  const sc = $('#scroller'), box = $('#msgs'), pt = sc.scrollTop, ph = sc.scrollHeight;
  box.replaceChildren();
  const arr = chatMsgs(S.chat), start = Math.max(0, arr.length - S.shown); let prev = null;
  if (!arr.length) box.append(h('div', { class: 'hint' }, S.chat === 'saved' ? 'Saved Messages\nForward messages here or write notes to yourself.' : S.chat === 'everyone' ? 'Say hi to everyone on the network 👋' : 'No messages yet.\nSend a message, a file, a sticker or a voice note.'));
  for (let i = start; i < arr.length; i++) {
    const m = arr[i];
    if (!prev || !sameDay(prev.ts, m.ts)) box.append(daySep(m.ts));
    if (S.unreadFrom === m.id) box.append(h('div', { class: 'udiv' }, 'Unread messages'));
    box.append(msgRow(m, prev, arr[i + 1])); prev = m;
  }
  if (keep) sc.scrollTop = pt + (sc.scrollHeight - ph); else { S.stick = true; sc.scrollTop = sc.scrollHeight; }
  syncAudioUI && syncAudioUI();
}
function appendRow(m) {
  const arr = chatMsgs(m.chat), i = arr.indexOf(m), prev = arr[i - 1], box = $('#msgs');
  $$('.hint', box).forEach((e) => e.remove());
  if (!prev || !sameDay(prev.ts, m.ts)) box.append(daySep(m.ts));
  if (prev && grouped(prev, m)) { const pe = $(`.row[data-id="${prev.id}"]`, box); if (pe) pe.classList.remove('gl'); }
  box.append(msgRow(m, prev, null));
  if (S.stick) scrollBottom();
}
function replaceRow(m) {
  const el = $(`.row[data-id="${m.id}"]`); if (!el) return;
  const arr = chatMsgs(m.chat), i = arr.indexOf(m);
  el.replaceWith(msgRow(m, arr[i - 1], arr[i + 1])); syncAudioUI && syncAudioUI();
}
function scrollBottom(smooth) { const s = $('#scroller'); s.scrollTo({ top: s.scrollHeight, behavior: smooth ? 'smooth' : 'auto' }); }
function updateBottomBtn() {
  const sc = $('#scroller'), far = sc.scrollHeight - sc.scrollTop - sc.clientHeight > 220, b = $('#toBottom');
  b.classList.toggle('hidden', !far && !S.newBelow);
  b.replaceChildren(ic('down'), S.newBelow ? h('span', { class: 'nb' }, S.newBelow) : null);
}
function jumpTo(id) {
  const m = S.byId.get(id); if (!m) return toast('Original message is not available');
  if (m.chat !== S.chat) openChat(m.chat);
  let el = $(`.row[data-id="${id}"]`);
  if (!el) { S.shown = 1e9; renderChat(); el = $(`.row[data-id="${id}"]`); }
  if (el) { S.stick = false; el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1500); }
}

// ---------- open chat / read state
function openChat(id) {
  S.chat = id; S.shown = 100; S.reply = null; S.edit = null; S.newBelow = 0;
  const un = chatMsgs(id).find((m) => !m.mine && m.unread); S.unreadFrom = un ? un.id : null;
  renderHeader(); renderChat(); renderCtx(); updateBottomBtn();
  if (document.hasFocus()) markRead(id);
  renderList(); renderRail();
  const ta = $('#input'); ta.value = ''; autosize(); syncAct(); ta.focus();
}
function markRead(c) {
  let any = false;
  for (const m of chatMsgs(c)) if (!m.mine && m.unread) { m.unread = false; any = true; }
  if (any) { api.invoke('read', c); renderList(); renderRail(); }
}

// ---------- incoming events
let audioCtx = null;
function beep() {
  try {
    audioCtx = audioCtx || new AudioContext(); const t = audioCtx.currentTime;
    [660, 880].forEach((f, i) => { const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.frequency.value = f; o.type = 'sine'; g.gain.setValueAtTime(.0001, t + i * .12); g.gain.exponentialRampToValueAtTime(.12, t + i * .12 + .02); g.gain.exponentialRampToValueAtTime(.0001, t + i * .12 + .22); o.connect(g).connect(audioCtx.destination); o.start(t + i * .12); o.stop(t + i * .12 + .25); });
  } catch {}
}
function onMsg(m) {
  const old = S.byId.get(m.id);
  if (old) { const arr = chatMsgs(m.chat), i = arr.indexOf(old); if (i >= 0) arr[i] = m; S.byId.set(m.id, m); }
  else { S.byId.set(m.id, m); if (!S.byChat.has(m.chat)) S.byChat.set(m.chat, []); S.byChat.get(m.chat).push(m); }
  if (m.chat === S.chat) {
    if (old) replaceRow(m); else { appendRow(m); if (!m.mine && !S.stick) S.newBelow++; }
    updateBottomBtn();
  }
  if (!old && !m.mine) {
    if (S.settings.sound !== false && !(document.hasFocus() && m.chat === S.chat)) beep();
    if (m.chat === S.chat && document.hasFocus()) markRead(m.chat);
  }
  renderList(); renderRail();
}
function onDel(id) {
  const m = S.byId.get(id); if (!m) return;
  S.byId.delete(id); const arr = chatMsgs(m.chat), i = arr.indexOf(m); if (i >= 0) arr.splice(i, 1);
  const el = $(`.row[data-id="${id}"]`); if (el) el.remove();
  if (P && P.id === id) { $('#au').pause(); P.id = null; renderPlayer(); }
  renderList(); renderRail();
}

// ---------- reply / edit bar
const replyRef = (m) => ({ id: m.id, sender: m.sender, name: senderName(m.sender), text: preview(m), kind: m.kind });
function setReply(m) { S.edit = null; S.reply = replyRef(m); renderCtx(); $('#input').focus(); }
function startEdit(m) { S.reply = null; S.edit = m; const ta = $('#input'); ta.value = m.kind === 'text' ? m.text : m.caption; renderCtx(); autosize(); syncAct(); ta.focus(); }
function cancelCtx() { if (S.edit) { $('#input').value = ''; autosize(); syncAct(); } S.reply = null; S.edit = null; renderCtx(); }
function renderCtx() {
  const bar = $('#ctxbar'), r = S.reply, e = S.edit;
  if (!r && !e) { bar.classList.add('hidden'); return; }
  bar.classList.remove('hidden');
  bar.replaceChildren(ic(e ? 'edit' : 'reply'), h('div', { class: 'cb' }, h('b', {}, e ? 'Edit message' : 'Reply to ' + r.name), h('span', {}, e ? preview(e) : r.text)), iconBtn('close', 'Cancel', cancelCtx));
}
function takeReply() { const r = S.reply; S.reply = null; renderCtx(); return r; }

// ---------- sending
async function sendFile(o) { S.stick = true; return api.invoke('send', { chat: S.chat, reply: takeReply(), ...o }); }
async function doSend() {
  const ta = $('#input'), text = ta.value.trim(); if (!text || !S.chat) return;
  if (S.edit) { const m = S.edit; S.edit = null; renderCtx(); ta.value = ''; autosize(); syncAct(); if (text !== (m.kind === 'text' ? m.text : m.caption)) await api.invoke('edit', m.id, text); return; }
  ta.value = ''; autosize(); syncAct();
  await sendFile({ kind: 'text', text });
}
function probeDur(path) {
  return new Promise((res) => { const a = new Audio(); a.preload = 'metadata'; const done = (v) => { a.src = ''; res(v); }; a.onloadedmetadata = () => done(isFinite(a.duration) ? a.duration : 0); a.onerror = () => done(0); setTimeout(() => done(0), 3000); a.src = api.fileUrl(path); });
}
async function handlePaths(paths) {
  for (const p of paths) {
    const k = kindOf(p);
    if (k === 'image') await imageDialog(p);
    else if (k === 'video') await videoDialog(p, 'send');
    else if (k === 'audio') await sendFile({ kind: 'audio', path: p, dur: await probeDur(p) });
    else await sendFile({ kind: 'file', path: p });
  }
}
async function attachMenu(e) {
  const r = e.currentTarget.getBoundingClientRect();
  showMenu(r.left, r.top - 8, [
    { label: 'Photo or video', icon: 'image', fn: async () => handlePaths(await api.invoke('pick', { multi: true, filters: [{ name: 'Photos & videos', extensions: [...EXT.image, ...EXT.video] }] })) },
    { label: 'File', icon: 'file', fn: async () => handlePaths(await api.invoke('pick', { multi: true })) }
  ], true);
}
function autosize() { const ta = $('#input'); ta.style.height = 'auto'; ta.style.height = Math.min(180, ta.scrollHeight) + 'px'; }
function syncAct() {
  const has = $('#input').value.trim().length > 0, b = $('#actBtn');
  b.replaceChildren(ic(has ? 'send' : 'mic')); b.title = has ? 'Send' : 'Record voice message'; b.dataset.mode = has ? 'send' : 'mic';
}

// ---------- context menu
function showMenu(x, y, items, up) {
  const old = $('.menu'); if (old) old.remove();
  const m = h('div', { class: 'menu' });
  for (const it of items) {
    if (it.sep) m.append(h('div', { class: 'msep' }));
    else if (it.reactions) m.append(h('div', { class: 'qr' }, ['👍', '❤️', '😂', '😮', '😢', '🙏'].map((e) => h('button', { onclick: () => { closeMenu(); api.invoke('react', it.id, e); } }, e))));
    else m.append(h('div', { class: 'mi' + (it.danger ? ' danger' : ''), onclick: () => { closeMenu(); it.fn(); } }, it.icon ? ic(it.icon) : null, it.label));
  }
  document.body.append(m);
  const w = m.offsetWidth, hh = m.offsetHeight;
  m.style.left = clamp(x, 6, innerWidth - w - 6) + 'px';
  m.style.top = clamp(up ? y - hh : y, 6, innerHeight - hh - 6) + 'px';
}
function closeMenu() { const m = $('.menu'); if (m) m.remove(); }
function msgMenu(e, m) {
  const items = [{ reactions: true, id: m.id }];
  items.push({ label: 'Reply', icon: 'reply', fn: () => setReply(m) });
  const body = m.kind === 'text' ? m.text : m.caption;
  if (body) items.push({ label: 'Copy text', icon: 'copy', fn: () => { api.invoke('copy', body); toast('Copied'); } });
  if (m.mine && body !== undefined && ['text', 'image', 'video', 'file'].includes(m.kind)) items.push({ label: 'Edit', icon: 'edit', fn: () => startEdit(m) });
  items.push({ label: 'Forward…', icon: 'fwd', fn: () => forwardDialog(m) });
  if (m.chat !== 'saved') items.push({ label: 'Save to Saved Messages', icon: 'bookmark', fn: () => { api.invoke('forward', m.id, 'saved'); toast('Saved'); } });
  if (m.file) {
    items.push({ sep: true });
    if (m.kind === 'video' || m.kind === 'gif') items.push({ label: 'Save as GIF…', icon: 'scissors', fn: () => videoDialog(m.file, 'gif') });
    if (m.kind === 'image' || m.kind === 'sticker') items.push({ label: 'Save as sticker…', icon: 'sticker', fn: () => makeSticker(m.file) });
    if (m.kind === 'sticker') items.push({ label: 'Add to my stickers', icon: 'plus', fn: async () => { S.stickers = await api.invoke('lib:addFile', 'stickers', m.file, m.w, m.h); toast('Added to stickers'); } });
    items.push({ label: 'Save as…', icon: 'dl', fn: async () => { if (await api.invoke('saveAs', m.file, m.name)) toast('Saved'); } });
    items.push({ label: 'Show in folder', icon: 'folder', fn: () => api.invoke('showInFolder', m.file) });
  }
  items.push({ sep: true }, { label: 'Delete', icon: 'trash', danger: true, fn: () => deleteDialog(m) });
  showMenu(e.clientX, e.clientY, items);
}
function chatMenu(e) {
  const r = e.currentTarget.getBoundingClientRect(), c = chatInfo(S.chat), items = [];
  if (c.kind === 'dm') items.push({ label: 'View profile', icon: 'user', fn: () => openProfile(c.id) });
  items.push({ label: 'Open received files folder', icon: 'folder', fn: () => api.invoke('openFolder', S.dirs.downloads) });
  items.push({ sep: true }, { label: 'Clear history', icon: 'trash', danger: true, fn: () => confirmDialog('Clear history', `Delete all messages in "${c.name}" on this PC? Other people keep their copies.`, 'Clear', () => api.invoke('clear', S.chat)) });
  showMenu(r.right - 220, r.bottom + 4, items);
}
let toastT;
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 2200); }

// ---------- boot
async function boot() {
  const d = await api.invoke('init');
  S.me = d.me; S.settings = d.settings; S.peers = d.peers; S.online = new Set(d.online); S.stickers = d.stickers; S.gifs = d.gifs; S.ver = d.version; S.dirs = d.dirs;
  indexMsgs(d.msgs);
  $('#searchIc').append(ic('search')); $('#attachBtn').append(ic('clip')); $('#emojiBtn').append(ic('smile'));
  $('#recCancel').append(ic('trash')); $('#recSend').append(ic('send')); $('#toBottom').append(ic('down'));
  $('#wMin').append(ic('wmin')); $('#wMax').append(ic('wmax')); $('#wClose').append(ic('close'));
  $('#wMin').onclick = () => api.invoke('win', 'min'); $('#wMax').onclick = () => api.invoke('win', 'max'); $('#wClose').onclick = () => api.invoke('win', 'close');
  api.on('maxstate', (v) => $('#wMax').replaceChildren(ic(v ? 'wrestore' : 'wmax')));
  document.querySelector('#titlebar .tb-logo').style.background = 'linear-gradient(135deg,var(--accent),#7a6cf0)';

  const ta = $('#input');
  ta.addEventListener('input', () => { autosize(); syncAct(); const n = Date.now(); if (S.chat && ta.value && n - (S.lastTyping || 0) > 2500) { S.lastTyping = n; api.invoke('typing', S.chat); } });
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); doSend(); } if (e.key === 'Escape') cancelCtx(); });
  ta.addEventListener('paste', async (e) => {
    const items = [...(e.clipboardData?.items || [])];
    const img = items.find((i) => i.type.startsWith('image/'));
    const files = [...(e.clipboardData?.files || [])];
    const real = files.map((f) => api.pathForFile(f)).filter(Boolean);
    if (real.length) { e.preventDefault(); handlePaths(real); }
    else if (img) { e.preventDefault(); const b = await img.getAsFile().arrayBuffer(); const p = await api.invoke('saveBlob', b, 'png'); imageDialog(p); }
  });
  $('#actBtn').onclick = () => ($('#actBtn').dataset.mode === 'send' ? doSend() : startRec());
  $('#attachBtn').onclick = attachMenu;
  $('#emojiBtn').onclick = () => togglePanel();
  $('#recCancel').onclick = () => R.cancel && R.cancel(); $('#recSend').onclick = () => R.send && R.send();
  $('#toBottom').onclick = () => { S.newBelow = 0; scrollBottom(true); };
  $('#q').addEventListener('input', (e) => { S.query = e.target.value; renderList(); });
  $('#q').addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.target.value = ''; S.query = ''; renderList(); e.target.blur(); } });

  const sc = $('#scroller');
  sc.addEventListener('scroll', () => {
    S.stick = sc.scrollHeight - sc.scrollTop - sc.clientHeight < 60;
    if (S.stick) S.newBelow = 0;
    updateBottomBtn();
    if (sc.scrollTop < 60 && S.shown < chatMsgs(S.chat).length) { S.shown += 80; renderChat(true); }
  });
  new ResizeObserver(() => { if (S.stick) sc.scrollTop = sc.scrollHeight; }).observe($('#msgs'));
  $('#msgs').addEventListener('load', () => { if (S.stick) sc.scrollTop = sc.scrollHeight; }, true);
  $('#msgs').addEventListener('loadedmetadata', () => { if (S.stick) sc.scrollTop = sc.scrollHeight; }, true);
  $('#msgs').addEventListener('click', (e) => { const a = e.target.closest('a.lnk'); if (a) { e.preventDefault(); api.invoke('openExternal', a.href); } });
  $('#msgs').addEventListener('contextmenu', (e) => { const r = e.target.closest('.row'); if (!r) return; e.preventDefault(); const m = S.byId.get(r.dataset.id); if (m) msgMenu(e, m); });
  $('#msgs').addEventListener('dblclick', (e) => {
    const r = e.target.closest('.row'); if (!r || e.target.closest('video,audio,button,a,.wave,.react,.reply,.file')) return;
    getSelection().removeAllRanges(); const m = S.byId.get(r.dataset.id); if (m) setReply(m);
  });
  document.addEventListener('contextmenu', (e) => {
    const t = e.target; if (!(t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement)) return;
    e.preventDefault();
    showMenu(e.clientX, e.clientY, [{ label: 'Cut', fn: () => { t.focus(); document.execCommand('cut'); } }, { label: 'Copy', fn: () => { t.focus(); document.execCommand('copy'); } }, { label: 'Paste', fn: () => { t.focus(); document.execCommand('paste'); } }, { sep: true }, { label: 'Select all', fn: () => { t.focus(); t.select(); } }]);
  });
  document.addEventListener('mousedown', (e) => { if (!e.target.closest('.menu')) closeMenu(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const mod = $('#overlay').lastElementChild;
      if (mod) mod.close && mod.close(); else if ($('.menu')) closeMenu(); else if ($('#panel').classList.contains('open')) togglePanel(); else cancelCtx();
    }
    if (e.ctrlKey && e.key.toLowerCase() === 'k') { e.preventDefault(); $('#q').focus(); }
  });
  // drag & drop
  let dc = 0; const drop = $('#drop');
  addEventListener('dragenter', (e) => { if (e.dataTransfer?.types.includes('Files')) { dc++; drop.classList.remove('hidden'); } });
  addEventListener('dragleave', () => { if (--dc <= 0) { dc = 0; drop.classList.add('hidden'); } });
  addEventListener('dragover', (e) => e.preventDefault());
  addEventListener('drop', (e) => { e.preventDefault(); dc = 0; drop.classList.add('hidden'); const ps = [...(e.dataTransfer?.files || [])].map((f) => api.pathForFile(f)).filter(Boolean); if (ps.length) handlePaths(ps); });
  addEventListener('focus', () => { if (S.chat) markRead(S.chat); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if ((S.settings.theme || 'dark') === 'system') { applyTheme(); renderRail(); } });

  api.on('msg', onMsg); api.on('del', onDel);
  api.on('cleared', (c) => { for (const m of chatMsgs(c)) S.byId.delete(m.id); S.byChat.set(c, []); if (c === S.chat) renderChat(); renderList(); });
  api.on('peer', (p) => { S.peers[p.id] = p; if (p.online) S.online.add(p.id); renderList(); if (S.chat === p.id) renderHeader(); });
  api.on('presence', (ids) => { S.online = new Set(ids); renderList(); renderRail(); updateStatus(); });
  api.on('progress', ({ id, p }) => { const b = $(`.row[data-id="${id}"] .prog i`); if (b) b.style.width = Math.round(p * 100) + '%'; });
  api.on('typing', (t) => { const c = t.chat === 'group' ? 'everyone' : t.from; S.typing[c] = { t: Date.now(), name: t.name }; updateStatus(); renderList(); setTimeout(() => { updateStatus(); renderList(); }, 4100); });
  api.on('open-chat', (c) => { if (S.byChat.has(c) || c === 'everyone' || S.peers[c]) openChat(c); });
  setInterval(() => updateStatus(), 30000);

  applyTheme(); renderRail(); syncAct();
  const last = [...S.byId.values()].filter((m) => m.chat !== 'saved').sort((a, b) => b.ts - a.ts)[0];
  openChat(last ? last.chat : 'everyone');
}

document.addEventListener('DOMContentLoaded', () => boot());
