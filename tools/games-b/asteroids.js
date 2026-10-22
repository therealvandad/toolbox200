// Asteroids: vector ship, splitting rocks, wrap-around, touch buttons on small screens.
import { el, render, store, loop } from '../../lib/ui.js';

const W = 560, H = 420;

export default function (root) {
  const s = store('asteroids');
  let best = s.get('best', 0);
  const canvas = el('canvas', { width: W, height: H, style: { maxWidth: '100%', width: '100%', aspectRatio: `${W}/${H}`, background: '#0b0d12', borderRadius: '8px', display: 'block', touchAction: 'none' } });
  const ctx = canvas.getContext('2d');
  const hud = el('div', { class: 'row small muted' });

  let ship, rocks, bullets, parts, score, lives, level, running = false, dead = 0, invuln = 0, shootCd = 0, msg = 'Press Enter or tap Fire to start';
  const input = { left: false, right: false, thrust: false, fire: false };

  function wrap(o) { if (o.x < 0) o.x += W; if (o.x > W) o.x -= W; if (o.y < 0) o.y += H; if (o.y > H) o.y -= H; }
  function makeRock(x, y, size) {
    const n = 8 + Math.floor(Math.random() * 5), pts = [];
    for (let i = 0; i < n; i++) pts.push(0.7 + Math.random() * 0.4);
    const a = Math.random() * Math.PI * 2, sp = 30 + Math.random() * 40 + level * 6;
    return { x, y, size, r: size === 3 ? 42 : size === 2 ? 24 : 12, pts, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rot: 0, rs: (Math.random() - 0.5) * 2 };
  }
  function spawnWave() {
    rocks = [];
    for (let i = 0; i < 3 + level; i++) {
      let x, y; do { x = Math.random() * W; y = Math.random() * H; } while (Math.hypot(x - W / 2, y - H / 2) < 120);
      rocks.push(makeRock(x, y, 3));
    }
  }
  function resetShip() { ship = { x: W / 2, y: H / 2, vx: 0, vy: 0, a: -Math.PI / 2 }; invuln = 2.5; }
  function start() { score = 0; lives = 3; level = 1; bullets = []; parts = []; running = true; dead = 0; msg = ''; resetShip(); spawnWave(); hudUpdate(); }
  function hudUpdate() { render(hud, el('span', {}, 'Score ', el('b', {}, score)), el('span', {}, 'Lives ', el('b', {}, lives)), el('span', {}, 'Wave ', el('b', {}, level)), el('span', {}, 'Best ', el('b', {}, best))); }
  function explode(x, y, n, col) { for (let i = 0; i < n; i++) { const a = Math.random() * 7, sp = 30 + Math.random() * 120; parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0.6 + Math.random() * 0.5, col }); } }
  function gameOver() { running = false; msg = 'Game over — score ' + score + '. Enter / Fire to restart'; if (score > best) { best = score; s.set('best', best); msg = 'New high score ' + score + '! Enter / Fire to restart'; } hudUpdate(); }

  function step(dt) {
    if (running) {
      if (dead > 0) { dead -= dt; if (dead <= 0) { if (lives <= 0) gameOver(); else resetShip(); } }
      else {
        if (input.left) ship.a -= 4 * dt; if (input.right) ship.a += 4 * dt;
        if (input.thrust) { ship.vx += Math.cos(ship.a) * 260 * dt; ship.vy += Math.sin(ship.a) * 260 * dt; if (Math.random() < 0.5) parts.push({ x: ship.x - Math.cos(ship.a) * 12, y: ship.y - Math.sin(ship.a) * 12, vx: -Math.cos(ship.a) * 80 + (Math.random() - 0.5) * 40, vy: -Math.sin(ship.a) * 80 + (Math.random() - 0.5) * 40, t: 0.3, col: '#ff9a3c' }); }
        ship.vx *= Math.pow(0.4, dt); ship.vy *= Math.pow(0.4, dt);
        ship.x += ship.vx * dt; ship.y += ship.vy * dt; wrap(ship);
        shootCd -= dt;
        if (input.fire && shootCd <= 0 && bullets.length < 6) { shootCd = 0.22; bullets.push({ x: ship.x + Math.cos(ship.a) * 14, y: ship.y + Math.sin(ship.a) * 14, vx: Math.cos(ship.a) * 420 + ship.vx, vy: Math.sin(ship.a) * 420 + ship.vy, t: 1.1 }); }
        if (invuln > 0) invuln -= dt;
      }
      for (const b of bullets) { b.x += b.vx * dt; b.y += b.vy * dt; b.t -= dt; wrap(b); }
      bullets = bullets.filter(b => b.t > 0);
      for (const r of rocks) { r.x += r.vx * dt; r.y += r.vy * dt; r.rot += r.rs * dt; wrap(r); }
      // collisions
      for (let i = rocks.length - 1; i >= 0; i--) {
        const r = rocks[i];
        let hit = -1;
        for (let j = 0; j < bullets.length; j++) if (Math.hypot(bullets[j].x - r.x, bullets[j].y - r.y) < r.r) { hit = j; break; }
        if (hit >= 0) {
          bullets.splice(hit, 1); rocks.splice(i, 1); score += r.size === 3 ? 20 : r.size === 2 ? 50 : 100;
          explode(r.x, r.y, 10, '#aab');
          if (r.size > 1) rocks.push(makeRock(r.x, r.y, r.size - 1), makeRock(r.x, r.y, r.size - 1));
          hudUpdate(); continue;
        }
        if (dead <= 0 && invuln <= 0 && Math.hypot(ship.x - r.x, ship.y - r.y) < r.r + 8) {
          explode(ship.x, ship.y, 25, '#5b8dff'); lives--; dead = 1.5; hudUpdate();
        }
      }
      if (!rocks.length) { level++; spawnWave(); invuln = 2; hudUpdate(); }
    }
    for (const p of parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.t -= dt; }
    parts = parts.filter(p => p.t > 0);
    draw();
  }

  function draw() {
    ctx.fillStyle = '#0b0d12'; ctx.fillRect(0, 0, W, H);
    ctx.lineWidth = 1.5; ctx.strokeStyle = '#cfd6e4';
    for (const r of rocks || []) {
      ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.rot); ctx.beginPath();
      r.pts.forEach((p, i) => { const a = i / r.pts.length * Math.PI * 2; const x = Math.cos(a) * r.r * p, y = Math.sin(a) * r.r * p; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.closePath(); ctx.stroke(); ctx.restore();
    }
    ctx.fillStyle = '#fff'; for (const b of bullets || []) ctx.fillRect(b.x - 1.5, b.y - 1.5, 3, 3);
    for (const p of parts) { ctx.globalAlpha = Math.min(1, p.t * 2); ctx.fillStyle = p.col; ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3); } ctx.globalAlpha = 1;
    if (running && dead <= 0 && ship) {
      if (invuln <= 0 || Math.floor(invuln * 10) % 2 === 0) {
        ctx.save(); ctx.translate(ship.x, ship.y); ctx.rotate(ship.a); ctx.strokeStyle = '#5b8dff'; ctx.beginPath();
        ctx.moveTo(14, 0); ctx.lineTo(-10, 9); ctx.lineTo(-6, 0); ctx.lineTo(-10, -9); ctx.closePath(); ctx.stroke(); ctx.restore();
      }
    }
    if (msg) { ctx.fillStyle = '#e6e8ec'; ctx.font = '18px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(msg, W / 2, H / 2); }
  }

  // keyboard
  const map = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'thrust', w: 'thrust', ' ': 'fire' };
  const onKey = e => {
    const k = map[e.key]; if (!k && e.key !== 'Enter') return;
    e.preventDefault();
    if (e.key === 'Enter') { if (e.type === 'keydown' && !running) start(); return; }
    input[k] = e.type === 'keydown';
    if (k === 'fire' && e.type === 'keydown' && !running) start();
  };
  window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey);

  // touch buttons
  const tbtn = (label, k) => {
    const b = el('button', { class: 'btn', style: { fontSize: '20px', padding: '14px 18px', touchAction: 'none', userSelect: 'none', minWidth: '64px' } }, label);
    const on = e => { e.preventDefault(); input[k] = true; if (k === 'fire' && !running) start(); };
    const off = e => { e.preventDefault(); input[k] = false; };
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
    b.addEventListener('contextmenu', e => e.preventDefault());
    return b;
  };
  const touchBar = el('div', { class: 'row', style: { justifyContent: 'space-between' } },
    el('div', { class: 'row', style: { margin: 0 } }, tbtn('⟲', 'left'), tbtn('⟳', 'right')),
    el('div', { class: 'row', style: { margin: 0 } }, tbtn('▲', 'thrust'), tbtn('●', 'fire')));
  const mq = window.matchMedia('(max-width: 700px), (pointer: coarse)');
  const applyMq = () => { touchBar.style.display = mq.matches ? '' : 'none'; };
  applyMq(); mq.addEventListener && mq.addEventListener('change', applyMq);

  render(root,
    el('div', { class: 'row' },
      el('button', { class: 'btn primary', onclick: start }, 'Start'),
      el('span', { class: 'small muted' }, el('span', { class: 'kbd' }, '← →'), ' rotate, ', el('span', { class: 'kbd' }, '↑'), ' thrust, ', el('span', { class: 'kbd' }, 'Space'), ' fire. Big rocks split into smaller ones.'),
      el('button', { class: 'btn ghost small', onclick: () => { touchBar.style.display = touchBar.style.display === 'none' ? '' : 'none'; } }, 'Toggle touch buttons')),
    hud, el('div', { class: 'canvas-wrap' }, canvas), touchBar);
  rocks = []; bullets = []; parts = []; score = 0; lives = 3; level = 1; hudUpdate();
  for (let i = 0; i < 4; i++) rocks.push(makeRock(Math.random() * W, Math.random() * H, 3));
  const stop = loop(step);
  return () => { stop(); window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); mq.removeEventListener && mq.removeEventListener('change', applyMq); };
}
