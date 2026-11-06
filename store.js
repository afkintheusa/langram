'use strict';
const fs = require('fs'), path = require('path');

class Store {
  constructor(dir) {
    this.dir = dir;
    fs.mkdirSync(dir, { recursive: true });
    this.f = path.join(dir, 'langram.json');
    this.t = null;
    let d = {};
    try { d = JSON.parse(fs.readFileSync(this.f, 'utf8')); } catch {
      try { d = JSON.parse(fs.readFileSync(this.f + '.bak', 'utf8')); } catch {}
    }
    const def = { me: {}, settings: {}, peers: {}, msgs: [], outbox: [], stickers: [], gifs: [] };
    for (const k in def) if (d[k] == null) d[k] = def[k];
    this.d = d;
  }
  save() { clearTimeout(this.t); this.t = setTimeout(() => this.flush(), 400); }
  flush() {
    clearTimeout(this.t);
    try {
      const tmp = this.f + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(this.d));
      try { fs.copyFileSync(this.f, this.f + '.bak'); } catch {}
      fs.renameSync(tmp, this.f);
    } catch (e) { console.error('save failed', e); }
  }
}
module.exports = { Store };
