'use strict';
// Langram network core (no Electron dependency).
// UDP broadcast = discovery, TCP = messages/files, JSON outbox on disk = offline queue.
const dgram = require('dgram'), netm = require('net'), os = require('os'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { EventEmitter, once } = require('events');

const DISC = 45464, TCP0 = 45465, TTL = 10000;
const uid = () => crypto.randomUUID();
const frame = (o) => { const j = Buffer.from(JSON.stringify(o)); const l = Buffer.alloc(4); l.writeUInt32BE(j.length); return Buffer.concat([l, j]); };

class Reader {
  constructor(s) {
    this.s = s; this.q = []; this.w = null; this.done = false; this.err = null;
    s.on('data', (d) => { this.q.push(d); s.pause(); this.wake(); });
    const fin = (e) => { this.done = true; if (e) this.err = e; this.wake(); };
    s.on('end', () => fin()); s.on('close', () => fin()); s.on('error', fin);
  }
  wake() { const w = this.w; if (w) { this.w = null; w(); } }
  async some(max) {
    while (!this.q.length) {
      if (this.done) throw this.err || new Error('closed');
      await new Promise((r) => { this.w = r; this.s.resume(); });
    }
    let b = this.q[0];
    if (b.length > max) { this.q[0] = b.subarray(max); b = b.subarray(0, max); } else this.q.shift();
    return b;
  }
  async exact(n) {
    const parts = []; let left = n;
    while (left > 0) { const b = await this.some(left); parts.push(b); left -= b.length; }
    return Buffer.concat(parts);
  }
}
async function readFrame(r) {
  const n = (await r.exact(4)).readUInt32BE(0);
  if (n > 2e6) throw new Error('frame too big');
  return JSON.parse((await r.exact(n)).toString());
}
function safeName(n) {
  n = path.basename(String(n || 'file')).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim();
  return n || 'file';
}
function uniquePath(p) {
  if (!fs.existsSync(p)) return p;
  const { dir, name, ext } = path.parse(p);
  for (let i = 1; ; i++) { const q = path.join(dir, `${name} (${i})${ext}`); if (!fs.existsSync(q)) return q; }
}
function ifaces() {
  const out = [];
  for (const L of Object.values(os.networkInterfaces()))
    for (const i of L || []) if (i.family === 'IPv4' && !i.internal && !i.address.startsWith('169.254')) out.push(i);
  return out;
}
function bcast(i) {
  const a = i.address.split('.').map(Number), m = i.netmask.split('.').map(Number);
  return a.map((x, k) => (x | (~m[k] & 255))).join('.');
}

class Net extends EventEmitter {
  constructor(store, dirs) {
    super();
    this.s = store; this.d = store.d; this.dirs = dirs;
    this.seen = new Map(); this.busy = new Set(); this.fetching = new Set(); this.onl = new Set(); this.port = 0;
    this.idx = new Map(this.d.msgs.map((m) => [m.id, m]));
    const m = this.d.me;
    if (!m.id) m.id = uid();
    if (m.name == null) m.name = os.hostname();
    for (const k of ['username', 'bio', 'avatar']) if (m[k] == null) m[k] = '';
    this.bumpPv();
  }
  get me() { return this.d.me; }
  bumpPv() { const m = this.d.me; m.pv = crypto.createHash('md5').update([m.name, m.username, m.bio, m.avatar].join('|')).digest('hex').slice(0, 10); }

  async start() {
    await new Promise((res) => {
      const srv = netm.createServer((s) => this.handle(s));
      let p = TCP0;
      const onErr = (e) => { if (e.code === 'EADDRINUSE' && p < TCP0 + 50) { p++; go(); } else throw e; };
      const go = () => srv.listen(p, () => { this.port = p; srv.off('error', onErr); srv.on('error', () => {}); res(); });
      srv.on('error', onErr); go(); this.srv = srv;
    });
    const u = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    u.on('message', (b, r) => { try { const m = JSON.parse(b); if (m.app === 'langram' && m.id !== this.me.id) this.heard(m, r.address); } catch {} });
    u.on('error', () => {}); u.bind(DISC); this.u = u;
    setInterval(() => this.announce(), 3000); this.announce();
    setInterval(() => this.tick(), 1000);
  }

  announce() {
    const pkt = Buffer.from(JSON.stringify({ app: 'langram', id: this.me.id, name: this.me.name, port: this.port, pv: this.me.pv }));
    for (const i of ifaces()) {
      try {
        const s = dgram.createSocket('udp4');
        s.on('error', () => { try { s.close(); } catch {} });
        s.bind(0, i.address, () => {
          try { s.setBroadcast(true); } catch {}
          for (const dst of new Set(['255.255.255.255', bcast(i)])) s.send(pkt, DISC, dst, () => {});
          setTimeout(() => { try { s.close(); } catch {} }, 300);
        });
      } catch {}
    }
  }

  online(id) { const v = this.seen.get(id); return !!v && Date.now() - v.t < TTL; }
  refreshPresence() {
    const now = new Set([...this.seen.keys()].filter((id) => this.online(id)));
    const same = now.size === this.onl.size && [...now].every((x) => this.onl.has(x));
    if (!same) { this.onl = now; this.s.save(); this.emit('presence', [...now]); }
  }
  peerView(id) { return { ...this.d.peers[id], online: this.online(id) }; }

  heard(m, ip) {
    const id = m.id, was = this.online(id);
    this.seen.set(id, { ip, port: m.port, t: Date.now() });
    let p = this.d.peers[id]; const isNew = !p;
    if (!p) p = this.d.peers[id] = { id, name: m.name, username: '', bio: '', avatar: '', pv: '' };
    p.seen = Date.now();
    if (p.pv !== m.pv) { p.name = m.name || p.name; this.fetchProfile(id); }
    if (isNew) { this.s.save(); this.emit('peer', this.peerView(id)); }
    if (!was) this.refreshPresence();
  }
  async fetchProfile(id) {
    if (this.fetching.has(id)) return;
    this.fetching.add(id);
    try {
      const r = await this.rpc(id, { t: 'profile?' });
      if (r.t === 'profile') {
        const p = this.d.peers[id];
        Object.assign(p, { name: r.name, username: r.username || '', bio: r.bio || '', avatar: r.avatar || '', pv: r.pv });
        this.s.save(); this.emit('peer', this.peerView(id));
      }
    } catch {} finally { setTimeout(() => this.fetching.delete(id), 3000); }
  }

  // ---- one request/response over TCP (optionally followed by raw file bytes)
  async rpc(pid, hdr, file, onp) {
    const p = this.seen.get(pid);
    if (!p || !this.online(pid)) throw new Error('offline');
    const s = netm.connect({ host: p.ip, port: p.port });
    s.setNoDelay(true); s.on('error', () => {});
    s.setTimeout(30000); s.on('timeout', () => s.destroy(new Error('timeout')));
    const to = setTimeout(() => s.destroy(new Error('connect timeout')), 4000);
    try {
      await once(s, 'connect'); clearTimeout(to);
      const r = new Reader(s);
      s.write(frame(hdr));
      if (file) {
        let sent = 0;
        for await (const c of fs.createReadStream(file, { highWaterMark: 262144 })) {
          if (!s.write(c)) await once(s, 'drain');
          sent += c.length; if (onp) onp(sent / (hdr.size || 1));
        }
      }
      return await readFrame(r);
    } finally { clearTimeout(to); s.destroy(); }
  }

  // ---- incoming
  async handle(s) {
    s.setTimeout(30000); s.on('timeout', () => s.destroy()); s.on('error', () => {});
    const r = new Reader(s);
    try {
      const h = await readFrame(r);
      if (h.t === 'profile?') { const m = this.me; s.write(frame({ t: 'profile', name: m.name, username: m.username, bio: m.bio, avatar: m.avatar, pv: m.pv })); }
      else if (h.t === 'msg') await this.recvMsg(r, h, s);
      else if (h.t === 'ctrl') { this.applyCtrl(h); s.write(frame({ t: 'ack' })); }
      else if (h.t === 'typing') { this.emit('typing', { from: h.from, name: h.name, chat: h.chat }); s.write(frame({ t: 'ack' })); }
    } catch {} finally { s.end(); setTimeout(() => s.destroy(), 1500); }
  }
  async recvMsg(r, h, s) {
    let file = null;
    if (h.size > 0) {
      const dir = ['sticker', 'gif', 'voice'].includes(h.kind) ? this.dirs.received : this.dirs.downloads;
      fs.mkdirSync(dir, { recursive: true });
      file = uniquePath(path.join(dir, safeName(h.fname)));
      const ws = fs.createWriteStream(file); let left = h.size, ok = false;
      try {
        while (left > 0) { const b = await r.some(Math.min(262144, left)); left -= b.length; if (!ws.write(b)) await once(ws, 'drain'); }
        ok = true;
      } finally { await new Promise((res) => ws.end(res)); if (!ok) { try { fs.unlinkSync(file); } catch {} } }
    }
    if (this.idx.has(h.id)) { if (file) try { fs.unlinkSync(file); } catch {} s.write(frame({ t: 'ack' })); return; }
    if (!this.d.peers[h.from]) { this.d.peers[h.from] = { id: h.from, name: h.name, username: '', bio: '', avatar: '', pv: '' }; this.emit('peer', this.peerView(h.from)); }
    const m = {
      id: h.id, chat: h.chat === 'group' ? 'everyone' : h.from, sender: h.from, kind: h.kind, text: h.text || '', caption: h.caption || '',
      name: h.fname || null, file, size: h.size || 0, w: h.w || 0, h: h.h || 0, dur: h.dur || 0, wave: h.wave || null,
      reply: h.reply || null, fwd: h.fwd || null, ts: Date.now(), mine: false, status: 'received', unread: true, reactions: {}, edited: false
    };
    this.d.msgs.push(m); this.idx.set(m.id, m); this.s.save();
    s.write(frame({ t: 'ack' }));
    this.emit('msg', m, { incoming: true });
  }
  applyCtrl(h) {
    const m = this.idx.get(h.id);
    if (h.op === 'read') {
      for (const id of h.ids || []) { const x = this.idx.get(id); if (x && x.mine && x.status !== 'read') { x.status = 'read'; this.emit('msg', x); } }
      this.s.save(); return;
    }
    if (!m) return;
    if (h.op === 'edit' && m.sender === h.from) { if (m.kind === 'text') m.text = h.text; else m.caption = h.text; m.edited = true; this.emit('msg', m); }
    else if (h.op === 'delete' && m.sender === h.from) { this.remove(m.id); this.emit('del', m.id); }
    else if (h.op === 'react') {
      const a = (m.reactions[h.emoji] = (m.reactions[h.emoji] || []).filter((x) => x !== h.from));
      if (h.add) a.push(h.from);
      if (!a.length) delete m.reactions[h.emoji];
      this.emit('msg', m);
    }
    this.s.save();
  }
  remove(id) {
    const i = this.d.msgs.findIndex((m) => m.id === id);
    if (i >= 0) this.d.msgs.splice(i, 1);
    this.idx.delete(id);
    this.d.outbox = this.d.outbox.filter((o) => o.mid !== id);
  }

  // ---- outgoing
  targets(chat) { return chat === 'saved' ? [] : chat === 'everyone' ? Object.keys(this.d.peers) : [chat]; }
  queueMsg(o) {
    const me = this.me;
    const m = {
      id: uid(), chat: o.chat, sender: me.id, kind: o.kind || 'text', text: o.text || '', caption: o.caption || '', name: o.name || null,
      file: o.path || null, size: 0, w: o.w || 0, h: o.h || 0, dur: o.dur || 0, wave: o.wave || null, reply: o.reply || null,
      fwd: o.fwd || null, ts: Date.now(), mine: true, status: 'queued', unread: false, reactions: {}, edited: false
    };
    if (m.file) { m.size = fs.statSync(m.file).size; m.name = m.name || path.basename(m.file); }
    const t = this.targets(m.chat);
    if (m.chat === 'saved') m.status = 'saved';
    else if (!t.length) m.status = 'sent';
    else t.forEach((p) => this.d.outbox.push({ id: uid(), peer: p, mid: m.id, ts: m.ts }));
    this.d.msgs.push(m); this.idx.set(m.id, m); this.s.save(); this.emit('msg', m);
    return m;
  }
  ctrl(chat, data) {
    for (const p of this.targets(chat)) this.d.outbox.push({ id: uid(), peer: p, ctrl: { t: 'ctrl', from: this.me.id, ...data }, ts: Date.now() });
    this.s.save();
  }
  deleteMsg(id, everyone) {
    const m = this.idx.get(id); if (!m) return;
    if (everyone && m.mine) this.ctrl(m.chat, { op: 'delete', id });
    this.remove(id); this.s.save(); this.emit('del', id);
  }
  editMsg(id, text) {
    const m = this.idx.get(id); if (!m || !m.mine) return;
    if (m.kind === 'text') m.text = text; else m.caption = text;
    m.edited = true; this.ctrl(m.chat, { op: 'edit', id, text }); this.s.save(); this.emit('msg', m);
  }
  react(id, emoji) {
    const m = this.idx.get(id); if (!m) return;
    const me = this.me.id, a = m.reactions[emoji] || [], add = !a.includes(me);
    m.reactions[emoji] = a.filter((x) => x !== me); if (add) m.reactions[emoji].push(me);
    if (!m.reactions[emoji].length) delete m.reactions[emoji];
    this.ctrl(m.chat, { op: 'react', id, emoji, add }); this.s.save(); this.emit('msg', m);
  }
  forward(id, chat) {
    const m = this.idx.get(id); if (!m) return null;
    const from = m.mine ? this.me.name : (this.d.peers[m.sender] || {}).name || 'Unknown';
    return this.queueMsg({ chat, kind: m.kind, text: m.text, caption: m.caption, path: m.file && fs.existsSync(m.file) ? m.file : null, name: m.name, w: m.w, h: m.h, dur: m.dur, wave: m.wave, fwd: m.fwd || from });
  }
  markRead(chat) {
    const ids = [];
    for (const m of this.d.msgs) if (m.chat === chat && !m.mine && m.unread) { m.unread = false; ids.push(m.id); }
    if (ids.length) { if (chat !== 'everyone' && chat !== 'saved') this.ctrl(chat, { op: 'read', ids }); this.s.save(); }
  }
  typing(chat) {
    for (const p of this.targets(chat)) if (this.online(p))
      this.rpc(p, { t: 'typing', from: this.me.id, name: this.me.name, chat: chat === 'everyone' ? 'group' : 'dm' }).catch(() => {});
  }
  clearChat(chat) {
    const ids = this.d.msgs.filter((m) => m.chat === chat).map((m) => m.id);
    ids.forEach((i) => this.remove(i)); this.s.save(); this.emit('cleared', chat);
  }
  updateMe(patch) {
    for (const k of ['name', 'username', 'bio', 'avatar']) if (patch[k] != null) this.me[k] = patch[k];
    this.bumpPv(); this.s.save(); this.announce();
  }

  tick() {
    this.refreshPresence();
    for (const p of new Set(this.d.outbox.map((o) => o.peer)))
      if (this.online(p) && !this.busy.has(p)) { this.busy.add(p); this.drain(p).catch(() => {}).finally(() => this.busy.delete(p)); }
  }
  async drain(p) {
    for (;;) {
      const o = this.d.outbox.filter((x) => x.peer === p).sort((a, b) => a.ts - b.ts)[0];
      if (!o || !this.online(p)) return;
      if (!(await this.deliver(o))) return;
    }
  }
  async deliver(o) {
    const rm = () => { const i = this.d.outbox.indexOf(o); if (i >= 0) this.d.outbox.splice(i, 1); this.s.save(); };
    if (o.ctrl) { try { const r = await this.rpc(o.peer, o.ctrl); if (r.t === 'ack') { rm(); return true; } } catch {} return false; }
    const m = this.idx.get(o.mid);
    if (!m) { rm(); return true; }
    const hdr = { t: 'msg', id: m.id, chat: m.chat === 'everyone' ? 'group' : 'dm', from: this.me.id, name: this.me.name, kind: m.kind, text: m.text, caption: m.caption, fname: m.name, size: 0, w: m.w, h: m.h, dur: m.dur, wave: m.wave, reply: m.reply, fwd: m.fwd };
    let file = null;
    if (m.file) {
      try { hdr.size = fs.statSync(m.file).size; file = m.file; }
      catch { rm(); m.status = 'failed'; this.emit('msg', m); return true; }
    }
    try { const r = await this.rpc(o.peer, hdr, file, (p) => this.emit('progress', { id: m.id, p })); if (r.t !== 'ack') return false; } catch { return false; }
    rm();
    if (this.idx.has(m.id) && !this.d.outbox.some((x) => x.mid === m.id) && m.status !== 'read') { m.status = 'delivered'; this.s.save(); this.emit('msg', m); }
    return true;
  }
}
module.exports = { Net, uid, safeName, uniquePath };
