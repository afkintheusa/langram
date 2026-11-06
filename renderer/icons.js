'use strict';
const ICONS = {
  menu: 'M4 6h16M4 12h16M4 18h16',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.3-4.3',
  clip: 'M21 12.5l-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l9-9a3.7 3.7 0 0 1 5.2 5.2l-9 9a1.8 1.8 0 0 1-2.6-2.6l8.4-8.4',
  smile: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 14s1.5 2.5 4 2.5 4-2.5 4-2.5M9 9.5h.01M15 9.5h.01',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  send: 'M3 11.5L21 3l-6.5 18-3.2-7.8L3 11.5zM11.3 13.2L21 3',
  play: 'M7 4.5v15l13-7.5z',
  pause: 'M7 4h3.6v16H7zM13.4 4H17v16h-3.6z',
  prev: 'M6 5h2.2v14H6zM19 5v14L9.5 12z',
  next: 'M15.8 5H18v14h-2.2zM5 5v14l9.5-7z',
  close: 'M6 6l12 12M18 6L6 18',
  more: 'M12 5h.01M12 12h.01M12 19h.01',
  reply: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 6 6v3',
  copy: 'M9 9h11v11H9zM5 15V5a1 1 0 0 1 1-1h10',
  fwd: 'M15 14l5-5-5-5M20 9H10a6 6 0 0 0-6 6v3',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  bookmark: 'M6 3h12v18l-6-4-6 4z',
  dl: 'M12 4v11M7 11l5 5 5-5M5 20h14',
  folder: 'M3 6h6l2 2h10v11H3z',
  check: 'M5 12.5l4.5 4.5L19 7',
  check2: 'M2 12.5l4.5 4.5L15 8M10 15l2 2L22 7',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  plus: 'M12 5v14M5 12h14',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  file: 'M6 3h8l5 5v13H6zM14 3v5h5',
  music: 'M9 18V6l10-2v12M9 18a3 3 0 1 1-3-3M19 16a3 3 0 1 1-3-3',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9h.01',
  film: 'M4 4h16v16H4zM8 4v16M16 4v16M4 9h4M4 15h4M16 9h4M16 15h4',
  down: 'M6 9l6 6 6-6',
  sticker: 'M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v9l-6 6H5a1 1 0 0 1-1-1zM20 14h-5a1 1 0 0 0-1 1v5M8.5 9.5h.01M15.5 9.5h.01M9 13.5s1 1.5 3 1.5',
  speaker: 'M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M17 3.5a4 4 0 0 1 0 7.5M22 21a7 7 0 0 0-4-6.3',
  chats: 'M4 5h16v11H9l-5 4zM8 9h8M8 12h5',
  unread: 'M20 11v5H9l-5 4V5h10M19 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  wifi: 'M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01',
  upload: 'M12 20V9M7 13l5-5 5 5M5 4h14',
  plane: 'M3 11.5L21 3l-6.5 18-3.2-7.8L3 11.5zM11.3 13.2L21 3',
  wmin: 'M5 12h14',
  wmax: 'M6 6h12v12H6z',
  wrestore: 'M9 9h9v9H9zM6 14V6h8',
  scissors: 'M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.1 7.9L20 20M8.1 16.1L20 4'
};
const FILLED = new Set(['play', 'pause', 'prev', 'next']);
function ic(n, cls = '') {
  const t = document.createElement('template');
  const attrs = FILLED.has(n) ? 'fill="currentColor" stroke="none"' : 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
  t.innerHTML = `<svg class="ic ${cls}" viewBox="0 0 24 24" ${attrs}><path d="${ICONS[n] || ''}"/></svg>`;
  return t.content.firstChild;
}
