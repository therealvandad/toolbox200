// Flappy clone: space / click / tap to flap. Upload an image to use as the bird sprite.
import { el, render, store, stat, loop, readFile, loadImage, toast } from '../../lib/ui.js';

const W = 400, H = 560, GRAVITY = 1500, FLAP = -420, PIPE_W = 64, GAP = 160, SPEED = 170, PIPE_EVERY = 1.55, BIRD = 40, GROUND = 70;

export default function (root) {
  const s = store('flappy');
  let best = s.get('best', 0), score = 0, state = 'ready', sprite = null;
  let bird, pipes, spawnT, groundX = 0, cloudX = 0, t = 0, deadT = 0;

  const canvas = el('canvas', { width: W, height: H, style: { maxWidth: '100%', height: 'auto', borderRadius: '8px', cursor: 'pointer', touchAction: 'manipulation', display: 'block' } });
  const ctx = canvas.getContext('2d');
  const stats = el('div', { class: 'row' });
  const fileInput = el('input', { type: 'file', accept: 'image/*', class: 'hidden', onchange: async () => {
    const f = fileInput.files[0]; if (!f) return;
    try {
      const img = await loadImage(f);
      // downscale to a small square-ish sprite before storing
      const c = document.createElement('canvas'); const sz = 96;
      const ratio = Math.min(sz / img.width, sz / img.height);
      c.width = Math.max(1, Math.round(img.width * ratio)); c.height = Math.max(1, Math.round(img.height * ratio));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const url = c.toDataURL('image/png');
      sprite = await loadImage(url); s.set('sprite', url);
      toast('Sprite set'); updateStats();
    } catch { toast('Could not read that image'); }
    fileInput.value = '';
  } });
  const spriteNote = el('span', { class: 'muted small' });

  function reset() {
    bird = { x: 90, y: H / 2 - 60, vy: 0, rot: 0 };
    pipes = []; spawnT = 0.9; score = 0; t = 0;
  }
  function flap() {
    if (state === 'ready') { state = 'playing'; bird.vy = FLAP; }
    else if (state === 'playing') bird.vy = FLAP;
    else if (state === 'dead' && t - deadT > 0.5) { reset(); state = 'ready'; }
  }
  function die() {
    state = 'dead'; deadT = t;
    if (score > best) { best = score; s.set('best', best); }
    updateStats();
  }
  function update(dt) {
    t += dt;
    if (state !== 'dead') { groundX = (groundX + SPEED * dt) % 40; cloudX = (cloudX + 18 * dt) % (W + 120); }
    if (state === 'ready') { bird.y = H / 2 - 60 + Math.sin(t * 4) * 8; return; }
    if (state === 'dead') {
      if (bird.y < H - GROUND - BIRD / 2) { bird.vy += GRAVITY * dt; bird.y = Math.min(H - GROUND - BIRD / 2, bird.y + bird.vy * dt); bird.rot = Math.min(Math.PI / 2, bird.rot + 4 * dt); }
      return;
    }
    bird.vy += GRAVITY * dt; bird.y += bird.vy * dt;
    bird.rot = Math.max(-0.45, Math.min(Math.PI / 2, bird.vy / 600));
    spawnT -= dt;
    if (spawnT <= 0) {
      spawnT = PIPE_EVERY;
      const gapY = 90 + Math.random() * (H - GROUND - 180 - GAP);
      pipes.push({ x: W + 10, gapY, passed: false });
    }
    for (const p of pipes) {
      p.x -= SPEED * dt;
      if (!p.passed && p.x + PIPE_W < bird.x) { p.passed = true; score++; updateStats(); }
    }
    pipes = pipes.filter(p => p.x > -PIPE_W - 10);
    // collisions
    const r = BIRD / 2 - 5;
    if (bird.y + r >= H - GROUND || bird.y - r <= 0) { bird.y = Math.min(bird.y, H - GROUND - BIRD / 2); die(); return; }
    for (const p of pipes) {
      if (bird.x + r > p.x && bird.x - r < p.x + PIPE_W) {
        if (bird.y - r < p.gapY || bird.y + r > p.gapY + GAP) { die(); return; }
      }
    }
  }
  function draw() {
    // sky
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#6fc3ff'); g.addColorStop(1, '#cdeeff');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // clouds
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    for (let i = 0; i < 3; i++) {
      const cx = ((i * 180 - cloudX) % (W + 120) + W + 120) % (W + 120) - 60, cy = 70 + i * 55;
      ctx.beginPath(); ctx.arc(cx, cy, 18, 0, 7); ctx.arc(cx + 22, cy - 8, 22, 0, 7); ctx.arc(cx + 48, cy, 16, 0, 7); ctx.fill();
    }
    // pipes
    for (const p of pipes) {
      ctx.fillStyle = '#4caf50'; ctx.strokeStyle = '#2e7d32'; ctx.lineWidth = 3;
      ctx.fillRect(p.x, 0, PIPE_W, p.gapY); ctx.strokeRect(p.x, -5, PIPE_W, p.gapY + 5);
      ctx.fillRect(p.x - 4, p.gapY - 24, PIPE_W + 8, 24); ctx.strokeRect(p.x - 4, p.gapY - 24, PIPE_W + 8, 24);
      const by = p.gapY + GAP;
      ctx.fillRect(p.x, by, PIPE_W, H - GROUND - by); ctx.strokeRect(p.x, by, PIPE_W, H - GROUND - by + 5);
      ctx.fillRect(p.x - 4, by, PIPE_W + 8, 24); ctx.strokeRect(p.x - 4, by, PIPE_W + 8, 24);
    }
    // ground
    ctx.fillStyle = '#ded895'; ctx.fillRect(0, H - GROUND, W, GROUND);
    ctx.fillStyle = '#8bc34a'; ctx.fillRect(0, H - GROUND, W, 14);
    ctx.fillStyle = '#7cb342';
    for (let x = -groundX; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, H - GROUND + 14); ctx.lineTo(x + 20, H - GROUND); ctx.lineTo(x + 40, H - GROUND + 14); ctx.fill(); }
    // bird
    ctx.save(); ctx.translate(bird.x, bird.y); ctx.rotate(bird.rot);
    if (sprite) {
      const ratio = Math.min(BIRD / sprite.width, BIRD / sprite.height) * 1.2;
      const w = sprite.width * ratio, h = sprite.height * ratio;
      ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
    } else {
      ctx.fillStyle = '#ffd54f'; ctx.beginPath(); ctx.arc(0, 0, BIRD / 2, 0, 7); ctx.fill();
      ctx.strokeStyle = '#c9a227'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#ffb300'; ctx.beginPath(); ctx.ellipse(-6, 4, 11, 7, 0.3, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(8, -6, 7, 0, 7); ctx.fill();
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(10, -6, 3.5, 0, 7); ctx.fill();
      ctx.fillStyle = '#ff7043'; ctx.beginPath(); ctx.moveTo(14, 2); ctx.lineTo(26, 6); ctx.lineTo(14, 10); ctx.fill();
    }
    ctx.restore();
    // HUD
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 4;
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.strokeText(score, W / 2, 70); ctx.fillText(score, W / 2, 70);
    ctx.font = 'bold 20px system-ui, sans-serif';
    if (state === 'ready') { ctx.strokeText('Space / click to flap', W / 2, H / 2 + 40); ctx.fillText('Space / click to flap', W / 2, H / 2 + 40); }
    if (state === 'dead') {
      ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(W / 2 - 130, H / 2 - 80, 260, 140);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 28px system-ui, sans-serif'; ctx.fillText('Game over', W / 2, H / 2 - 40);
      ctx.font = '18px system-ui, sans-serif'; ctx.fillText(`Score ${score}   Best ${best}`, W / 2, H / 2 - 5);
      if (t - deadT > 0.5) ctx.fillText('Press space or tap to retry', W / 2, H / 2 + 35);
    }
  }
  function updateStats() { render(stats, stat(score, 'score'), stat(best, 'best')); spriteNote.textContent = sprite ? 'Custom sprite in use' : 'Default bird'; }

  const onKey = e => {
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.code === 'Space' || e.key === 'ArrowUp') { e.preventDefault(); if (!e.repeat) flap(); }
  };
  window.addEventListener('keydown', onKey);
  canvas.addEventListener('pointerdown', e => { e.preventDefault(); flap(); });

  render(root,
    stats,
    el('div', { class: 'row' },
      el('button', { class: 'btn primary', onclick: () => { if (state === 'dead') { reset(); state = 'ready'; } else flap(); } }, 'Flap / start'),
      el('button', { class: 'btn', onclick: () => fileInput.click() }, 'Upload bird image'),
      el('button', { class: 'btn ghost', onclick: () => { sprite = null; s.del('sprite'); updateStats(); } }, 'Default bird'),
      spriteNote, fileInput),
    el('div', { class: 'canvas-wrap' }, canvas),
    el('div', { class: 'muted small' }, 'Space, Arrow Up, click or tap to flap. Your sprite is kept in this browser.'));

  reset(); updateStats();
  const savedSprite = s.get('sprite');
  if (savedSprite) loadImage(savedSprite).then(img => { sprite = img; updateStats(); }).catch(() => s.del('sprite'));

  const stop = loop(dt => { update(dt); draw(); });
  return () => { stop(); window.removeEventListener('keydown', onKey); };
}
