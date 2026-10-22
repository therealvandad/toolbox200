// Pong where your webcam moves the paddle: frame differencing in the left/right halves of the camera image,
// vertical centroid of the changed pixels drives the paddle. Mouse / touch / keyboard fallback, AI opponent.
import { el, render, store, loop, toast } from '../../lib/ui.js';

const W = 640, H = 400, PW = 12, PH = 80, BR = 7, CW = 96, CH = 72, TO = 5;

export default function (root) {
  const s = store('cam-pong');
  const canvas = el('canvas', { width: W, height: H, style: { maxWidth: '100%', height: 'auto', touchAction: 'none', borderRadius: '6px' } });
  const ctx = canvas.getContext('2d');
  const video = el('video', { autoplay: true, playsinline: true, muted: true, style: { display: 'none' } });
  const cam = el('canvas', { width: CW, height: CH, style: { width: '192px', height: '144px', borderRadius: '6px', border: '1px solid var(--line)', background: '#111' } });
  const cctx = cam.getContext('2d', { willReadFrequently: true });
  const css = n => getComputedStyle(root).getPropertyValue(n).trim() || '#888';

  let stream = null, prev = null, camOn = false, motion = [null, null];     // per-side {y, amount}
  let sens = s.get('sens', 1.5), thresh = s.get('thresh', 40), twoPlayer = false;
  let p1 = H / 2, p2 = H / 2, p1t = H / 2, p2t = H / 2, ball, score = [0, 0], rally = 0, running = false, over = false, serveTimer = 0;
  let stats = s.get('stats', { wins: 0, losses: 0, bestRally: 0 });
  const keys = {};
  const hud = el('div', { class: 'row small muted' });
  const camMsg = el('span', { class: 'small muted' }, 'Camera off — mouse, touch or keys move the paddle.');

  function resetBall(dir) { ball = { x: W / 2, y: H / 2, vx: 260 * dir, vy: (Math.random() - 0.5) * 240 }; rally = 0; serveTimer = 0.8; }
  function start() { score = [0, 0]; over = false; running = true; resetBall(Math.random() < 0.5 ? 1 : -1); showHud(); }
  function endGame() {
    running = false; over = true;
    if (!twoPlayer) { if (score[0] > score[1]) stats.wins++; else stats.losses++; }
    s.set('stats', stats); showHud();
    toast(score[0] > score[1] ? 'Left player wins!' : 'Right player wins!');
  }
  function showHud() {
    render(hud, el('span', { class: 'big mono' }, `${score[0]} : ${score[1]}`), el('span', {}, ` first to ${TO} · rally ${rally}`),
      el('span', {}, ` · record vs AI: ${stats.wins} W / ${stats.losses} L · best rally ${stats.bestRally}`));
  }

  // ---- camera ----
  async function startCam() {
    if (!navigator.mediaDevices?.getUserMedia) { camMsg.textContent = 'This browser cannot access a camera (needs HTTPS or localhost).'; return; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user' }, audio: false });
      video.srcObject = stream; await video.play().catch(() => {});
      camOn = true; prev = null; camBtn.textContent = 'Stop camera';
      camMsg.textContent = twoPlayer ? 'Wave in the left half of the picture to move the left paddle, right half for the right paddle.' : 'Wave in the left half of the picture to move your paddle.';
    } catch (e) { camMsg.textContent = 'Camera unavailable: ' + (e.message || e.name); }
  }
  function stopCam() {
    camOn = false; if (stream) stream.getTracks().forEach(t => t.stop()); stream = null;
    video.pause(); video.srcObject = null; prev = null; motion = [null, null]; camBtn.textContent = 'Start camera';
    cctx.fillStyle = '#111'; cctx.fillRect(0, 0, CW, CH); camMsg.textContent = 'Camera off — mouse, touch or keys move the paddle.';
  }
  function processCam() {
    if (!camOn || video.readyState < 2) return;
    cctx.save(); cctx.translate(CW, 0); cctx.scale(-1, 1); cctx.drawImage(video, 0, 0, CW, CH); cctx.restore();   // mirrored like a selfie
    const img = cctx.getImageData(0, 0, CW, CH), d = img.data;
    const gray = new Uint8ClampedArray(CW * CH);
    for (let i = 0, j = 0; i < d.length; i += 4, j++) gray[j] = (d[i] * 3 + d[i + 1] * 6 + d[i + 2]) / 10;
    const half = CW / 2, acc = [[0, 0], [0, 0]];   // [sumY, count] per side
    if (prev) {
      for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
        const j = y * CW + x, diff = Math.abs(gray[j] - prev[j]), side = x < half ? 0 : 1;
        if (diff > thresh) { acc[side][0] += y; acc[side][1]++; d[j * 4] = 255; d[j * 4 + 1] = 80; d[j * 4 + 2] = 80; }
        else { const v = gray[j] * 0.6; d[j * 4] = v; d[j * 4 + 1] = v; d[j * 4 + 2] = v; }
      }
    }
    prev = gray;
    cctx.putImageData(img, 0, 0);
    for (let k = 0; k < 2; k++) {
      if (acc[k][1] >= 6) {
        const cy = acc[k][0] / acc[k][1] / CH;                           // 0..1 within the camera frame
        motion[k] = { y: H / 2 + (cy - 0.5) * H * sens, amount: acc[k][1] };
        cctx.strokeStyle = '#ffd34d'; cctx.lineWidth = 2; cctx.beginPath(); cctx.moveTo(k * half, cy * CH); cctx.lineTo((k + 1) * half, cy * CH); cctx.stroke();
      }
    }
    cctx.strokeStyle = 'rgba(255,255,255,.5)'; cctx.lineWidth = 1; cctx.beginPath(); cctx.moveTo(half, 0); cctx.lineTo(half, CH); cctx.stroke();
  }

  // ---- game ----
  function step(dt) {
    processCam();
    // left paddle target
    const k1 = (keys.w || (keys.ArrowUp && !twoPlayer) ? -1 : 0) + (keys.s || (keys.ArrowDown && !twoPlayer) ? 1 : 0);
    if (k1) { p1 += k1 * 420 * dt; p1t = p1; }
    else { if (camOn && motion[0]) p1t = motion[0].y; p1 += (p1t - p1) * Math.min(1, dt * 14); }
    // right paddle: second player (camera right half / arrow keys) or AI
    if (twoPlayer) {
      const k2 = (keys.ArrowUp ? -1 : 0) + (keys.ArrowDown ? 1 : 0);
      if (k2) { p2 += k2 * 420 * dt; p2t = p2; }
      else { if (camOn && motion[1]) p2t = motion[1].y; p2 += (p2t - p2) * Math.min(1, dt * 14); }
    } else if (ball) {
      const aim = ball.vx > 0 ? ball.y + ball.vy * 0.08 : H / 2;
      const speed = 220 + Math.min(200, rally * 15);
      p2 += Math.max(-speed * dt, Math.min(speed * dt, aim - p2));
    }
    p1 = Math.max(PH / 2, Math.min(H - PH / 2, p1)); p2 = Math.max(PH / 2, Math.min(H - PH / 2, p2));
    if (running && ball) {
      if (serveTimer > 0) serveTimer -= dt;
      else {
        ball.x += ball.vx * dt; ball.y += ball.vy * dt;
        if (ball.y < BR) { ball.y = BR; ball.vy = Math.abs(ball.vy); } if (ball.y > H - BR) { ball.y = H - BR; ball.vy = -Math.abs(ball.vy); }
        const hit = (px, py, dir) => {
          if (Math.abs(ball.x - px) < PW / 2 + BR && Math.abs(ball.y - py) < PH / 2 + BR && Math.sign(ball.vx) === -dir) {
            const rel = (ball.y - py) / (PH / 2); const sp = Math.min(760, Math.hypot(ball.vx, ball.vy) * 1.05 + 10);
            const ang = rel * Math.PI / 3.2; ball.vx = Math.cos(ang) * sp * dir; ball.vy = Math.sin(ang) * sp;
            ball.x = px + dir * (PW / 2 + BR + 1); rally++; if (rally > stats.bestRally) { stats.bestRally = rally; s.set('stats', stats); } showHud();
          }
        };
        hit(24, p1, 1); hit(W - 24, p2, -1);
        if (ball.x < -BR) { score[1]++; if (score[1] >= TO) endGame(); else resetBall(1); showHud(); }
        if (ball.x > W + BR) { score[0]++; if (score[0] >= TO) endGame(); else resetBall(-1); showHud(); }
      }
    }
    draw();
  }
  function draw() {
    ctx.fillStyle = css('--bg'); ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = css('--line'); ctx.setLineDash([8, 10]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = css('--accent'); ctx.fillRect(24 - PW / 2, p1 - PH / 2, PW, PH);
    ctx.fillStyle = css('--danger'); ctx.fillRect(W - 24 - PW / 2, p2 - PH / 2, PW, PH);
    if (ball) { ctx.fillStyle = css('--text'); ctx.beginPath(); ctx.arc(ball.x, ball.y, BR, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = css('--text'); ctx.font = 'bold 40px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(score[0], W / 2 - 50, 50); ctx.fillText(score[1], W / 2 + 50, 50);
    ctx.font = '16px system-ui, sans-serif'; ctx.fillStyle = css('--muted');
    if (!running) ctx.fillText(over ? (score[0] > score[1] ? 'Left wins! Click or press Space to play again' : 'Right wins! Click or press Space to play again') : 'Click, tap or press Space to start', W / 2, H / 2 + 40);
    ctx.textAlign = 'left';
  }

  // ---- input ----
  const pointer = e => { const r = canvas.getBoundingClientRect(); const y = (e.clientY - r.top) * H / r.height; const x = (e.clientX - r.left) * W / r.width; if (twoPlayer && x > W / 2) p2t = y; else p1t = y; };
  canvas.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' || e.buttons) pointer(e); });
  canvas.addEventListener('pointerdown', e => { pointer(e); if (!running) start(); });
  const onKey = e => {
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const down = e.type === 'keydown';
    if (['ArrowUp', 'ArrowDown', 'w', 's', 'W', 'S'].includes(e.key)) { keys[e.key.toLowerCase().startsWith('arrow') ? e.key : e.key.toLowerCase()] = down; e.preventDefault(); }
    if (down && e.key === ' ') { e.preventDefault(); if (!running) start(); }
  };
  window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey);

  const camBtn = el('button', { class: 'btn primary', onclick: () => (camOn ? stopCam() : startCam()) }, 'Start camera');
  const sensIn = el('input', { type: 'range', min: 0.5, max: 3, step: 0.1, value: sens, oninput: () => { sens = +sensIn.value; sensLbl.textContent = sens.toFixed(1) + '×'; s.set('sens', sens); } });
  const sensLbl = el('span', { class: 'mono small' }, sens.toFixed(1) + '×');
  const thrIn = el('input', { type: 'range', min: 10, max: 100, step: 5, value: thresh, oninput: () => { thresh = +thrIn.value; thrLbl.textContent = thresh; s.set('thresh', thresh); } });
  const thrLbl = el('span', { class: 'mono small' }, thresh);
  const modeSel = el('select', { class: 'select', onchange: () => { twoPlayer = modeSel.value === '2p'; running = false; over = false; score = [0, 0]; ball = null; showHud(); } },
    el('option', { value: 'ai' }, 'vs computer'), el('option', { value: '2p' }, '2 players (camera halves / keys)'));

  render(root,
    el('div', { class: 'row' }, camBtn, el('label', { class: 'inline' }, 'Mode ', modeSel),
      el('label', { class: 'inline' }, 'Sensitivity ', sensIn, sensLbl), el('label', { class: 'inline' }, 'Motion threshold ', thrIn, thrLbl)),
    el('div', { class: 'row' }, camMsg),
    hud,
    el('div', { class: 'row', style: { alignItems: 'flex-start' } },
      el('div', { class: 'canvas-wrap grow' }, canvas),
      el('div', { class: 'col', style: { gap: '6px' } }, cam, el('span', { class: 'small muted' }, 'Red = movement, yellow line = paddle height'))),
    el('div', { class: 'small muted' }, 'Left paddle: camera (left half of the picture), mouse/touch, or ', el('span', { class: 'kbd' }, 'W'), '/', el('span', { class: 'kbd' }, 'S'), '. Right paddle in 2-player mode: right half of the picture or ', el('span', { class: 'kbd' }, '↑'), '/', el('span', { class: 'kbd' }, '↓'), '. Processing stays in your browser; nothing is uploaded.'),
    video);
  showHud();
  const stop = loop(step);
  return () => { stop(); stopCam(); window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); };
}
