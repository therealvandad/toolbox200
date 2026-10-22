// Breakout with a level editor. Canvas game; paddle via mouse / touch / arrow keys.
import { el, render, store, loop, toast } from '../../lib/ui.js';

const W = 480, H = 360, COLS = 10, ROWS = 8, BW = W / COLS, BH = 18, TOP = 40;
const COLORS = ['', '#4caf50', '#2f6fed', '#d98c0b', '#d64545'];
const BUILT_IN = [
  ['1111111111', '1111111111', '1111111111', '0000000000', '0000000000', '0000000000', '0000000000', '0000000000'],
  ['0001221000', '0012222100', '0122222210', '1222222221', '0122222210', '0012222100', '0001221000', '0000000000'],
  ['3333333333', '2222222222', '1111111111', '0000000000', '1111111111', '2222222222', '0000000000', '0000000000'],
  ['4040404040', '0303030303', '2020202020', '0101010101', '1010101010', '0202020202', '3030303030', '0404040404'],
  ['4444444444', '4000000004', '4033333304', '4030220304', '4030220304', '4033333304', '4000000004', '4444444444'],
];

export default function (root) {
  const s = store('breakout');
  const custom = s.get('levels', []);
  let best = s.get('best', 0);

  const canvas = el('canvas', { width: W, height: H, style: { maxWidth: '100%', width: '100%', aspectRatio: `${W}/${H}`, touchAction: 'none', background: 'var(--bg)', borderRadius: '8px', display: 'block' } });
  const ctx = canvas.getContext('2d');
  const hud = el('div', { class: 'row small muted' });
  const levelSel = el('select', { class: 'select' });
  function fillLevels() {
    render(levelSel, BUILT_IN.map((_, i) => el('option', { value: 'b' + i }, 'Level ' + (i + 1))), custom.map((l, i) => el('option', { value: 'c' + i }, l.name)));
  }
  fillLevels();

  // ---- game state
  let bricks = [], balls = [], drops = [], paddle = { x: W / 2, w: 80 }, score = 0, lives = 3, running = false, launched = false, wideTimer = 0, msg = 'Press Space or tap to launch';
  let levelIdx = 0, keys = {};

  function levelGrid(v) {
    if (v.startsWith('b')) return BUILT_IN[+v.slice(1)];
    const c = custom[+v.slice(1)]; return c ? c.rows : BUILT_IN[0];
  }
  function loadLevel(grid) {
    bricks = [];
    grid.forEach((row, r) => [...row].forEach((ch, c) => { const hp = +ch || 0; if (hp) bricks.push({ r, c, hp, max: hp }); }));
    balls = []; drops = []; launched = false; paddle.w = 80; wideTimer = 0;
    resetBall();
  }
  function resetBall() { balls = [{ x: paddle.x, y: H - 40, vx: 0, vy: 0, r: 6 }]; launched = false; msg = 'Press Space or tap to launch'; }
  function launch() { if (launched || !running) return; launched = true; msg = ''; balls.forEach(b => { b.vx = (Math.random() - 0.5) * 200; b.vy = -260; }); }
  function startGame(fromLevel) {
    score = 0; lives = 3; levelIdx = fromLevel; running = true;
    loadLevel(levelGrid(levelSel.value)); updateHud();
  }
  function nextLevel() {
    const opts = [...levelSel.options]; const i = opts.findIndex(o => o.value === levelSel.value);
    if (i < opts.length - 1) { levelSel.value = opts[i + 1].value; loadLevel(levelGrid(levelSel.value)); toast('Level cleared!'); }
    else { running = false; msg = 'You cleared every level! Score ' + score; saveBest(); }
  }
  function saveBest() { if (score > best) { best = score; s.set('best', best); toast('New high score: ' + best); } updateHud(); }
  function updateHud() { render(hud, el('span', {}, 'Score ', el('b', {}, score)), el('span', {}, 'Lives ', el('b', {}, lives)), el('span', {}, 'Best ', el('b', {}, best))); }

  function step(dt) {
    if (running) {
      if (keys.ArrowLeft || keys.a) paddle.x -= 420 * dt;
      if (keys.ArrowRight || keys.d) paddle.x += 420 * dt;
      paddle.x = Math.max(paddle.w / 2, Math.min(W - paddle.w / 2, paddle.x));
      if (wideTimer > 0) { wideTimer -= dt; if (wideTimer <= 0) paddle.w = 80; }
      if (!launched) balls.forEach(b => { b.x = paddle.x; b.y = H - 40; });
      for (const b of balls) {
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.x < b.r) { b.x = b.r; b.vx *= -1; } if (b.x > W - b.r) { b.x = W - b.r; b.vx *= -1; }
        if (b.y < b.r) { b.y = b.r; b.vy *= -1; }
        // paddle
        const py = H - 24;
        if (b.vy > 0 && b.y + b.r >= py && b.y + b.r <= py + 12 && Math.abs(b.x - paddle.x) <= paddle.w / 2 + b.r) {
          const rel = (b.x - paddle.x) / (paddle.w / 2);
          const sp = Math.min(520, Math.hypot(b.vx, b.vy) * 1.02);
          const ang = rel * 1.1; b.vx = Math.sin(ang) * sp; b.vy = -Math.cos(ang) * sp; b.y = py - b.r;
        }
        // bricks
        for (let i = bricks.length - 1; i >= 0; i--) {
          const br = bricks[i], x0 = br.c * BW, y0 = TOP + br.r * BH;
          if (b.x + b.r > x0 && b.x - b.r < x0 + BW && b.y + b.r > y0 && b.y - b.r < y0 + BH) {
            const ox = Math.min(b.x + b.r - x0, x0 + BW - b.x + b.r), oy = Math.min(b.y + b.r - y0, y0 + BH - b.y + b.r);
            if (ox < oy) b.vx *= -1; else b.vy *= -1;
            br.hp--; score += 10;
            if (br.hp <= 0) {
              bricks.splice(i, 1); score += 20;
              if (Math.random() < 0.15) drops.push({ x: x0 + BW / 2, y: y0 + BH / 2, t: Math.random() < 0.5 ? 'W' : 'M' });
            }
            break;
          }
        }
      }
      balls = balls.filter(b => b.y - b.r < H);
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i]; d.y += 120 * dt;
        if (d.y > H - 30 && d.y < H - 10 && Math.abs(d.x - paddle.x) < paddle.w / 2 + 8) {
          drops.splice(i, 1);
          if (d.t === 'W') { paddle.w = 130; wideTimer = 12; }
          else if (balls.length) { const b0 = balls[0]; balls.push({ ...b0, vx: b0.vx + 120 }, { ...b0, vx: b0.vx - 120 }); }
        } else if (d.y > H) drops.splice(i, 1);
      }
      if (launched && !balls.length) {
        lives--; if (lives <= 0) { running = false; msg = 'Game over — score ' + score; saveBest(); } else resetBall();
        updateHud();
      }
      if (!bricks.length && running) nextLevel();
      if (running) updateHud();
    }
    draw();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (const br of bricks) {
      ctx.fillStyle = COLORS[Math.min(4, br.hp)]; ctx.globalAlpha = 0.55 + 0.45 * br.hp / br.max;
      ctx.fillRect(br.c * BW + 1, TOP + br.r * BH + 1, BW - 2, BH - 2); ctx.globalAlpha = 1;
    }
    ctx.fillStyle = '#5b8dff'; ctx.fillRect(paddle.x - paddle.w / 2, H - 24, paddle.w, 10);
    ctx.fillStyle = '#e6e8ec'; for (const b of balls) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill(); }
    for (const d of drops) { ctx.fillStyle = d.t === 'W' ? '#1f9d55' : '#d98c0b'; ctx.beginPath(); ctx.arc(d.x, d.y, 8, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(d.t, d.x, d.y + 4); }
    if (msg) { ctx.fillStyle = getComputedStyle(canvas).color || '#888'; ctx.font = '16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(msg, W / 2, H / 2); }
  }

  // ---- input
  const toX = e => { const r = canvas.getBoundingClientRect(); const p = e.touches ? e.touches[0] : e; return (p.clientX - r.left) / r.width * W; };
  canvas.addEventListener('mousemove', e => { paddle.x = toX(e); });
  canvas.addEventListener('touchmove', e => { e.preventDefault(); paddle.x = toX(e); }, { passive: false });
  canvas.addEventListener('touchstart', e => { e.preventDefault(); paddle.x = toX(e); if (!running) startGame(0); else launch(); }, { passive: false });
  canvas.addEventListener('click', () => { if (!running) startGame(0); else launch(); });
  const onKey = e => {
    if (e.type === 'keydown') {
      if (e.key === ' ') { e.preventDefault(); if (!running) startGame(0); else launch(); }
      if (e.key.startsWith('Arrow')) e.preventDefault();
      keys[e.key] = true;
    } else keys[e.key] = false;
  };
  window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey);

  // ---- editor
  let brush = 1, painting = false;
  let grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  const cells = [];
  const editorGrid = el('div', { style: { display: 'grid', gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: '2px', maxWidth: '400px', touchAction: 'none', userSelect: 'none' } });
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const cell = el('div', { style: { aspectRatio: '2.2', border: '1px solid var(--line)', borderRadius: '3px', cursor: 'pointer' }, 'data-rc': r + ',' + c });
    cells.push(cell); editorGrid.append(cell);
  }
  function paintCell(cell) { if (!cell || !cell.dataset.rc) return; const [r, c] = cell.dataset.rc.split(',').map(Number); grid[r][c] = brush; cell.style.background = brush ? COLORS[brush] : 'transparent'; }
  function refreshEditor() { cells.forEach(cell => { const [r, c] = cell.dataset.rc.split(',').map(Number); cell.style.background = grid[r][c] ? COLORS[grid[r][c]] : 'transparent'; }); }
  editorGrid.addEventListener('pointerdown', e => { painting = true; paintCell(e.target); });
  editorGrid.addEventListener('pointerover', e => { if (painting) paintCell(e.target); });
  editorGrid.addEventListener('pointermove', e => { if (painting && e.pointerType === 'touch') paintCell(document.elementFromPoint(e.clientX, e.clientY)); });
  const stopPaint = () => { painting = false; };
  window.addEventListener('pointerup', stopPaint);
  const brushBtns = el('div', { class: 'row' }, [0, 1, 2, 3, 4].map(v => el('button', { class: 'btn small', style: v ? { background: COLORS[v], color: '#fff', borderColor: COLORS[v] } : {}, onclick: e => { brush = v; [...brushBtns.children].forEach(b => b.style.outline = ''); e.target.style.outline = '2px solid var(--accent)'; } }, v ? 'HP ' + v : 'Erase')));
  brushBtns.children[1].style.outline = '2px solid var(--accent)';
  const nameIn = el('input', { class: 'input', placeholder: 'Level name', value: 'My level ' + (custom.length + 1) });
  function saveLevel() {
    const rows = grid.map(r => r.join(''));
    if (!rows.some(r => /[1-9]/.test(r))) return toast('Paint some bricks first');
    custom.push({ name: nameIn.value.trim() || 'Custom', rows }); s.set('levels', custom); fillLevels();
    levelSel.value = 'c' + (custom.length - 1); nameIn.value = 'My level ' + (custom.length + 1); toast('Level saved');
  }
  const editor = el('div', { class: 'panel', style: { marginTop: '12px' } },
    el('b', {}, 'Level editor'), el('div', { class: 'small muted' }, 'Click or drag to paint bricks with the selected hit points. Saved levels appear in the level menu.'),
    brushBtns, editorGrid,
    el('div', { class: 'row' }, nameIn,
      el('button', { class: 'btn primary', onclick: saveLevel }, 'Save level'),
      el('button', { class: 'btn', onclick: () => { grid = levelGrid(levelSel.value).map(r => [...r].map(Number)); refreshEditor(); } }, 'Load selected into editor'),
      el('button', { class: 'btn ghost', onclick: () => { grid = grid.map(r => r.fill(0)); refreshEditor(); } }, 'Clear'),
      el('button', { class: 'btn danger small', onclick: () => { if (!levelSel.value.startsWith('c')) return toast('Built-in levels cannot be deleted'); custom.splice(+levelSel.value.slice(1), 1); s.set('levels', custom); fillLevels(); toast('Deleted'); } }, 'Delete selected custom')));

  render(root,
    el('div', { class: 'row' },
      el('label', { class: 'inline' }, 'Level ', levelSel),
      el('button', { class: 'btn primary', onclick: () => startGame(0) }, 'Start / Restart'),
      el('span', { class: 'small muted' }, el('span', { class: 'kbd' }, '← →'), ' or mouse/touch to move, ', el('span', { class: 'kbd' }, 'Space'), ' to launch. Green W = wide paddle, orange M = multi-ball.')),
    hud,
    el('div', { class: 'canvas-wrap' }, canvas),
    editor);
  updateHud(); loadLevel(BUILT_IN[0]); msg = 'Click, tap or press Space to start';
  const stop = loop(step);
  return () => { stop(); window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); window.removeEventListener('pointerup', stopPaint); };
}
