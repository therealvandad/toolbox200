// Infinite runner with a daily seed: obstacles come from a seeded rng so everyone gets the same daily course.
import { el, render, store, loop, rng, today, toast } from '../../lib/ui.js';

const W = 600, H = 220, GROUND = 180;

export default function (root) {
  const s = store('infinite-runner');
  const date = today();
  const dailySeed = [...date].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  let mode = 'daily';
  const bestOf = m => m === 'daily' ? s.get('best:' + date, 0) : s.get('best:random', 0);

  const canvas = el('canvas', { width: W, height: H, style: { maxWidth: '100%', width: '100%', aspectRatio: `${W}/${H}`, background: 'var(--bg)', borderRadius: '8px', display: 'block', touchAction: 'none' } });
  const ctx = canvas.getContext('2d');
  const hud = el('div', { class: 'row small muted' });
  const modeSel = el('select', { class: 'select', onchange: () => { mode = modeSel.value; reset(); } }, el('option', { value: 'daily' }, 'Daily course ' + date), el('option', { value: 'random' }, 'Random course'));

  let r, player, obs, nextX, dist, speed, running, over, duck, msg, clouds;
  function reset() {
    r = rng(mode === 'daily' ? dailySeed : (Math.random() * 1e9) >>> 0);
    player = { y: GROUND, vy: 0 }; obs = []; nextX = W + 200; dist = 0; speed = 260; running = false; over = false; duck = false;
    clouds = Array.from({ length: 4 }, (_, i) => ({ x: i * 160 + 40, y: 30 + (i * 37) % 60 }));
    msg = 'Space / tap to start. Jump with Space or ↑, duck with ↓ or tap the lower half.';
    hudUpdate(); draw();
  }
  function hudUpdate() { render(hud, el('span', {}, 'Distance ', el('b', {}, Math.floor(dist), ' m')), el('span', {}, 'Best (' + (mode === 'daily' ? 'today' : 'random') + ') ', el('b', {}, bestOf(mode), ' m'))); }
  function spawn() {
    const t = r();
    const type = t < 0.55 ? 'cactus' : t < 0.8 ? 'tall' : 'bird';
    const w = type === 'cactus' ? 18 + Math.floor(r() * 3) * 10 : type === 'tall' ? 16 : 28;
    const h = type === 'cactus' ? 30 : type === 'tall' ? 48 : 16;
    const y = type === 'bird' ? GROUND - 38 : GROUND - h;
    obs.push({ x: nextX, y, w, h, type });
    nextX += 260 + r() * 340;
  }
  function jump() { if (over) { reset(); return; } if (!running) { running = true; msg = ''; } if (player.y >= GROUND - 0.5) { player.vy = -560; } }
  function step(dt) {
    if (running && !over) {
      dist += speed * dt / 10; speed = Math.min(560, 260 + dist * 0.6);
      player.vy += 1500 * dt; if (duck && player.vy < 0) player.vy += 2000 * dt;
      player.y = Math.min(GROUND, player.y + player.vy * dt); if (player.y === GROUND) player.vy = 0;
      while (nextX < dist * 10 + W + 100) spawn();
      const scroll = dist * 10;
      for (const c of clouds) { c.x -= speed * 0.15 * dt; if (c.x < -60) c.x += W + 100; }
      const ph = duck && player.y >= GROUND - 0.5 ? 20 : 40, pw = duck && player.y >= GROUND - 0.5 ? 40 : 24, px = 60, py = player.y - ph;
      for (const o of obs) {
        const ox = o.x - scroll;
        if (px + pw - 4 > ox && px + 4 < ox + o.w && py + ph - 2 > o.y && py + 2 < o.y + o.h) {
          over = true; running = false;
          const d = Math.floor(dist); const b = bestOf(mode);
          if (d > b) { s.set('best:' + (mode === 'daily' ? date : 'random'), d); toast('New best: ' + d + ' m'); }
          msg = 'Crashed at ' + d + ' m. Space / tap to retry.';
        }
      }
      obs = obs.filter(o => o.x - scroll > -100);
      hudUpdate();
    }
    draw();
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    const scroll = dist * 10;
    ctx.fillStyle = 'rgba(128,140,160,0.25)'; for (const c of clouds) { ctx.beginPath(); ctx.ellipse(c.x, c.y, 30, 10, 0, 0, 7); ctx.fill(); }
    ctx.strokeStyle = '#9aa3ad'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, GROUND + 1); ctx.lineTo(W, GROUND + 1); ctx.stroke();
    ctx.fillStyle = '#9aa3ad'; for (let x = -(scroll % 40); x < W; x += 40) ctx.fillRect(x, GROUND + 8, 14, 2);
    for (const o of obs) {
      const ox = o.x - scroll;
      if (o.type === 'bird') { ctx.fillStyle = '#d64545'; ctx.beginPath(); ctx.moveTo(ox, o.y + 8); ctx.lineTo(ox + 14, o.y); ctx.lineTo(ox + 28, o.y + 8); ctx.lineTo(ox + 14, o.y + 16); ctx.closePath(); ctx.fill(); }
      else { ctx.fillStyle = '#1f9d55'; ctx.fillRect(ox, o.y, o.w, o.h); if (o.type === 'cactus') ctx.fillRect(ox - 6, o.y + 8, 6, 8); }
    }
    const grounded = player.y >= GROUND - 0.5, ph = duck && grounded ? 20 : 40, pw = duck && grounded ? 40 : 24;
    ctx.fillStyle = '#2f6fed'; ctx.fillRect(60, player.y - ph, pw, ph);
    ctx.fillStyle = '#fff'; ctx.fillRect(60 + pw - 8, player.y - ph + 5, 4, 4);
    if (msg) { ctx.fillStyle = '#9aa3ad'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(msg, W / 2, 70); }
  }

  const onKey = e => {
    if (['ArrowUp', ' ', 'ArrowDown', 'w', 's'].includes(e.key)) e.preventDefault(); else return;
    if (e.type === 'keydown') { if (e.key === 'ArrowDown' || e.key === 's') duck = true; else if (!e.repeat) jump(); }
    else if (e.key === 'ArrowDown' || e.key === 's') duck = false;
  };
  window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey);
  const pointerY = e => { const rc = canvas.getBoundingClientRect(); return (e.clientY - rc.top) / rc.height; };
  canvas.addEventListener('pointerdown', e => { e.preventDefault(); if (pointerY(e) > 0.6 && running) duck = true; else jump(); });
  const pointerUp = () => { duck = false; };
  window.addEventListener('pointerup', pointerUp);

  render(root,
    el('div', { class: 'row' }, el('label', { class: 'inline' }, 'Course ', modeSel), el('button', { class: 'btn primary', onclick: () => { reset(); jump(); } }, 'Start'),
      el('span', { class: 'small muted' }, 'The daily course is generated from the date, so friends can compare distances.')),
    hud, el('div', { class: 'canvas-wrap' }, canvas));
  reset();
  const stop = loop(step);
  return () => { stop(); window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); window.removeEventListener('pointerup', pointerUp); };
}
