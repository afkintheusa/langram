'use strict';
// Designed chat backgrounds: layered "mesh" gradients + a doodle pattern generated as SVG.
const WALLS = [
  { id: 'aurora', name: 'Aurora', dark: true, css: 'radial-gradient(70% 55% at 12% 8%,#5b2a86 0%,transparent 65%),radial-gradient(55% 50% at 92% 18%,#0f9d8a 0%,transparent 65%),radial-gradient(70% 60% at 65% 105%,#2447c9 0%,transparent 65%),#0a1020' },
  { id: 'midnight', name: 'Midnight', dark: true, css: 'radial-gradient(80% 60% at 50% 0%,#1d2f55 0%,transparent 70%),radial-gradient(60% 50% at 100% 100%,#2f1c52 0%,transparent 70%),#0c121c' },
  { id: 'ember', name: 'Ember', dark: true, css: 'radial-gradient(70% 55% at 85% 10%,#a1362b 0%,transparent 65%),radial-gradient(60% 60% at 10% 100%,#7a2a7a 0%,transparent 65%),#1a0f16' },
  { id: 'forest', name: 'Forest', dark: true, css: 'radial-gradient(70% 60% at 20% 10%,#16603a 0%,transparent 65%),radial-gradient(60% 55% at 90% 90%,#0e5a64 0%,transparent 65%),#08140f' },
  { id: 'ocean', name: 'Ocean', dark: true, css: 'linear-gradient(160deg,#0b3a6b,#0a6a8f 55%,#12a3a0)' },
  { id: 'graphite', name: 'Graphite', dark: true, css: '#10161d' },
  { id: 'sunset', name: 'Sunset', dark: false, css: 'radial-gradient(70% 60% at 15% 10%,#ffd8a8 0%,transparent 65%),radial-gradient(60% 60% at 90% 20%,#ffb3c7 0%,transparent 65%),radial-gradient(70% 60% at 60% 105%,#b8a8ff 0%,transparent 65%),#fff1e6' },
  { id: 'mint', name: 'Mint', dark: false, css: 'radial-gradient(70% 60% at 10% 10%,#c9f2dc 0%,transparent 65%),radial-gradient(60% 60% at 95% 30%,#cfe5ff 0%,transparent 65%),radial-gradient(70% 60% at 50% 105%,#e6ffd0 0%,transparent 65%),#e8f4ee' },
  { id: 'classic', name: 'Classic', dark: false, css: 'linear-gradient(160deg,#dbddbb,#6ba587 45%,#d5d88d 75%,#88b884)' },
  { id: 'paper', name: 'Paper', dark: false, css: '#e9e5dd' }
];
const PAT = {
  plane: 'M3 11l18-8-8 18-2-8-8-2z',
  heart: 'M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.500 6c-2.500 4.500-9.500 9-9.500 9z',
  star: 'M12 3l2.800 5.700 6.200.9-4.500 4.400 1 6.200L12 17.300 6.500 20.200l1-6.200L3 9.600l6.200-.9z',
  moon: 'M20 14.500A8 8 0 1 1 9.500 4a6.500 6.500 0 0 0 10.500 10.500z',
  cloud: 'M7 18a4 4 0 0 1-.5-8A5.500 5.500 0 0 1 17 8.500 4.200 4.200 0 0 1 17 18z',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  chat: 'M4 5h16v11H9l-5 4z',
  note: 'M9 18V6l10-2v12M9 18a3 3 0 1 1-3-3M19 16a3 3 0 1 1-3-3',
  wifi: 'M2 9a15 15 0 0 1 20 0M5 12.500a10 10 0 0 1 14 0M8.500 16a5 5 0 0 1 7 0M12 19.500h.01',
  smile: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 14s1.500 2 4 2 4-2 4-2M9 9h.01M15 9h.01',
  gift: 'M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7c-2-4-6-3-5 0M12 7c2-4 6-3 5 0'
};
function patternSvg(ink) {
  const names = Object.keys(PAT), cell = 72, n = 5, size = cell * n;
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" stroke="${ink}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">`;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const nm = names[(x * 3 + y * 2 + (y % 3)) % names.length];
    const cx = x * cell + cell / 2 + (rnd() - .5) * 16, cy = y * cell + cell / 2 + (rnd() - .5) * 16;
    const rot = Math.round((rnd() - .5) * 60), sc = (0.85 + rnd() * .35).toFixed(2);
    s += `<g transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)}) rotate(${rot}) scale(${sc}) translate(-12 -12)"><path d="${PAT[nm]}"/></g>`;
    s += `<circle cx="${(x * cell + 6 + rnd() * 8).toFixed(1)}" cy="${(y * cell + 6 + rnd() * 8).toFixed(1)}" r="1.4" fill="${ink}" stroke="none"/>`;
  }
  return s + '</svg>';
}
