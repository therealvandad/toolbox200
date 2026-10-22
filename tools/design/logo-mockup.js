// Logo mockup: place an uploaded logo on canvas-drawn t-shirt, mug or business card; drag, scale, rotate, download.
import { el, render, download, dropZone, field, toast, loadImage } from '../../lib/ui.js';

const W = 1000, H = 800;
function shade(hex, f) { // lighten (f>0) or darken (f<0)
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const t = v => Math.max(0, Math.min(255, Math.round(f > 0 ? v + (255 - v) * f : v * (1 + f))));
  return `rgb(${t(r)},${t(g)},${t(b)})`;
}
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

const MOCKUPS = {
  tshirt: {
    label: 'T-shirt', home: { x: 500, y: 430, size: 240 },
    draw(ctx, col) {
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#e9ecf1'); g.addColorStop(1, '#c9ced6'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const cx = 500;
      const body = () => { ctx.beginPath(); ctx.moveTo(cx - 110, 170); ctx.quadraticCurveTo(cx, 250, cx + 110, 170); ctx.lineTo(cx + 250, 215); ctx.lineTo(cx + 345, 400); ctx.lineTo(cx + 235, 445); ctx.lineTo(cx + 235, 740); ctx.lineTo(cx - 235, 740); ctx.lineTo(cx - 235, 445); ctx.lineTo(cx - 345, 400); ctx.lineTo(cx - 250, 215); ctx.closePath(); };
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12; body(); ctx.fillStyle = col; ctx.fill(); ctx.restore();
      body(); ctx.strokeStyle = shade(col, -.25); ctx.lineWidth = 2; ctx.stroke();
      // sleeve seams and fabric folds
      ctx.strokeStyle = shade(col, -.18); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx - 250, 215); ctx.quadraticCurveTo(cx - 225, 330, cx - 235, 445); ctx.moveTo(cx + 250, 215); ctx.quadraticCurveTo(cx + 225, 330, cx + 235, 445); ctx.stroke();
      ctx.save(); body(); ctx.clip();
      const f = ctx.createLinearGradient(cx - 235, 0, cx + 235, 0);
      f.addColorStop(0, 'rgba(0,0,0,.12)'); f.addColorStop(.25, 'rgba(255,255,255,.06)'); f.addColorStop(.5, 'rgba(0,0,0,0)'); f.addColorStop(.8, 'rgba(255,255,255,.05)'); f.addColorStop(1, 'rgba(0,0,0,.12)');
      ctx.fillStyle = f; ctx.fillRect(0, 0, W, H); ctx.restore();
      // collar
      ctx.beginPath(); ctx.moveTo(cx - 110, 170); ctx.quadraticCurveTo(cx, 250, cx + 110, 170); ctx.quadraticCurveTo(cx, 275, cx - 110, 170);
      ctx.fillStyle = shade(col, -.12); ctx.fill(); ctx.strokeStyle = shade(col, -.3); ctx.stroke();
    },
    clip(ctx) { const cx = 500; ctx.beginPath(); ctx.moveTo(cx - 235, 260); ctx.lineTo(cx + 235, 260); ctx.lineTo(cx + 235, 740); ctx.lineTo(cx - 235, 740); ctx.closePath(); ctx.clip(); },
  },
  mug: {
    label: 'Mug', home: { x: 470, y: 450, size: 190 },
    draw(ctx, col) {
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#f3eee6'); g.addColorStop(1, '#d9d0c2'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(500, 690, 240, 40, 0, 0, Math.PI * 2); ctx.fill();
      // handle
      ctx.strokeStyle = col; ctx.lineWidth = 44; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(640, 450, 120, -Math.PI * .42, Math.PI * .42); ctx.stroke();
      ctx.strokeStyle = shade(col, -.3); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(640, 450, 142, -Math.PI * .4, Math.PI * .4); ctx.stroke();
      ctx.beginPath(); ctx.arc(640, 450, 98, -Math.PI * .38, Math.PI * .38); ctx.stroke();
      // body
      rr(ctx, 320, 250, 320, 420, 30); ctx.fillStyle = col; ctx.fill();
      ctx.save(); rr(ctx, 320, 250, 320, 420, 30); ctx.clip();
      const f = ctx.createLinearGradient(320, 0, 640, 0);
      f.addColorStop(0, 'rgba(0,0,0,.28)'); f.addColorStop(.3, 'rgba(255,255,255,.12)'); f.addColorStop(.6, 'rgba(0,0,0,0)'); f.addColorStop(1, 'rgba(0,0,0,.3)');
      ctx.fillStyle = f; ctx.fillRect(320, 250, 320, 420); ctx.restore();
      // rim
      ctx.beginPath(); ctx.ellipse(480, 250, 160, 36, 0, 0, Math.PI * 2); ctx.fillStyle = shade(col, .35); ctx.fill(); ctx.strokeStyle = shade(col, -.25); ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(480, 250, 140, 26, 0, 0, Math.PI * 2); ctx.fillStyle = shade(col, -.45); ctx.fill();
    },
    clip(ctx) { ctx.beginPath(); ctx.rect(335, 290, 290, 360); ctx.clip(); },
    after(ctx) { // cylindrical shading over the logo
      ctx.save(); ctx.beginPath(); ctx.rect(335, 290, 290, 360); ctx.clip();
      const f = ctx.createLinearGradient(320, 0, 640, 0);
      f.addColorStop(0, 'rgba(0,0,0,.25)'); f.addColorStop(.3, 'rgba(255,255,255,.08)'); f.addColorStop(.6, 'rgba(0,0,0,0)'); f.addColorStop(1, 'rgba(0,0,0,.28)');
      ctx.fillStyle = f; ctx.fillRect(320, 250, 320, 420); ctx.restore();
    },
  },
  card: {
    label: 'Business card', home: { x: 330, y: 400, size: 150 },
    rot: -6 * Math.PI / 180,
    draw(ctx, col) {
      const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#3a3f47'); g.addColorStop(1, '#1d2026'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.translate(500, 400); ctx.rotate(this.rot);
      ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 20;
      rr(ctx, -350, -200, 700, 400, 14); ctx.fillStyle = col; ctx.fill();
      ctx.shadowColor = 'transparent';
      const dark = shade(col, -.55), mid = shade(col, -.35);
      ctx.fillStyle = dark; ctx.font = '700 34px system-ui, sans-serif'; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
      ctx.fillText('Your Name', 10, -30);
      ctx.fillStyle = mid; ctx.font = '400 20px system-ui, sans-serif'; ctx.fillText('Founder & Designer', 10, 14);
      ctx.fillStyle = mid; ctx.font = '400 17px system-ui, sans-serif';
      ctx.fillText('hello@example.com', 10, 120); ctx.fillText('+1 555 010 2030', 10, 146);
      ctx.fillStyle = shade(col, -.6); ctx.fillRect(-350, 150, 700, 50);
      ctx.restore();
    },
    clip(ctx) { ctx.translate(500, 400); ctx.rotate(this.rot); rr(ctx, -350, -200, 700, 400, 14); ctx.clip(); ctx.rotate(-this.rot); ctx.translate(-500, -400); },
  },
};

export default function (root) {
  let logo = null, drag = null;
  let pos = { x: 500, y: 430 };
  const canvas = el('canvas', { style: { maxWidth: '100%', cursor: 'grab', touchAction: 'none' } });
  const which = el('select', { class: 'select' }, Object.entries(MOCKUPS).map(([k, m]) => el('option', { value: k }, m.label)));
  const color = el('input', { type: 'color', value: '#f4f1ea' });
  const scale = el('input', { type: 'range', min: 10, max: 300, value: 100, class: 'input' });
  const rot = el('input', { type: 'range', min: -45, max: 45, value: 0, class: 'input' });
  const blend = el('input', { type: 'checkbox', checked: true });
  const stage = el('div', { class: 'canvas-wrap' }, canvas);
  const swatches = el('div', { class: 'row', style: { margin: 0 } }, ['#f4f1ea', '#ffffff', '#1b1f24', '#2f6fed', '#d64545', '#1f9d55', '#d98c0b', '#6b4e9b'].map(c => el('button', { class: 'btn small', title: c, style: { background: c, width: '26px', height: '26px', padding: 0, borderRadius: '50%' }, onclick: () => { color.value = c; draw(); } })));

  function draw() {
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const m = MOCKUPS[which.value];
    m.draw(ctx, color.value);
    if (logo) {
      const size = m.home.size * scale.value / 100;
      const lw = size, lh = size * logo.naturalHeight / logo.naturalWidth;
      ctx.save(); m.clip(ctx);
      if (blend.checked) ctx.globalCompositeOperation = 'multiply';
      ctx.translate(pos.x, pos.y); ctx.rotate((m.rot || 0) + rot.value * Math.PI / 180);
      ctx.drawImage(logo, -lw / 2, -lh / 2, lw, lh);
      ctx.restore();
      if (m.after) m.after(ctx);
    } else {
      ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.font = '600 26px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = which.value === 'card' ? 'rgba(255,255,255,.7)' : 'rgba(0,0,0,.45)';
      ctx.fillText('Upload a logo to place it here', W / 2, H - 40);
    }
  }
  const pt = e => { const b = canvas.getBoundingClientRect(); return { x: (e.clientX - b.left) * W / b.width, y: (e.clientY - b.top) * H / b.height }; };
  canvas.addEventListener('pointerdown', e => { if (!logo) return; canvas.setPointerCapture(e.pointerId); const p = pt(e); drag = { dx: pos.x - p.x, dy: pos.y - p.y }; canvas.style.cursor = 'grabbing'; });
  canvas.addEventListener('pointermove', e => { if (!drag) return; const p = pt(e); pos = { x: p.x + drag.dx, y: p.y + drag.dy }; draw(); });
  const stop = () => { drag = null; canvas.style.cursor = 'grab'; };
  canvas.addEventListener('pointerup', stop); canvas.addEventListener('pointercancel', stop);
  const reset = () => { const h = MOCKUPS[which.value].home; pos = { x: h.x, y: h.y }; scale.value = 100; rot.value = 0; draw(); };
  which.addEventListener('change', () => { color.value = which.value === 'card' ? '#ffffff' : '#f4f1ea'; reset(); });
  color.addEventListener('input', draw); scale.addEventListener('input', draw); rot.addEventListener('input', draw); blend.addEventListener('change', draw);
  const zone = dropZone('Drop your logo here (PNG with transparent background works best)', async f => { try { logo = await loadImage(f[0]); draw(); } catch { toast('Could not load image'); } }, 'image/*', false);
  zone.style.padding = '14px';
  render(root,
    zone,
    el('div', { class: 'row' }, field('Mockup', which), field('Product colour', el('div', { class: 'row', style: { margin: 0 } }, color, swatches)), field('Logo size', scale), field('Rotation', rot), el('label', { class: 'inline' }, blend, 'Blend into surface'), el('button', { class: 'btn small', onclick: reset }, 'Reset position')),
    stage,
    el('div', { class: 'row' },
      el('button', { class: 'btn primary', onclick: () => canvas.toBlob(b => b && download(`mockup-${which.value}.png`, b, 'image/png'), 'image/png') }, 'Download PNG'),
      el('button', { class: 'btn', onclick: () => canvas.toBlob(b => b && download(`mockup-${which.value}.jpg`, b, 'image/jpeg'), 'image/jpeg', 0.92) }, 'Download JPEG'),
      el('span', { class: 'muted small' }, 'Drag the logo on the canvas to move it.')));
  draw();
}
