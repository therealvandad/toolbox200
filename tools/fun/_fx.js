// Shared fun helpers for the fun group: lazy audio + confetti. Not a tool.
import { loop } from '../../lib/ui.js';

/** Lazy audio engine. Call .ctx() from inside a click handler. .close() in cleanup. */
export function audio() {
  let c = null;
  const A = {
    ctx() {
      if (!c) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; c = new C(); }
      if (c.state === 'suspended') c.resume();
      return c;
    },
    tone(freq, dur = 0.2, { type = 'sine', vol = 0.2, at = 0, slideTo = null, attack = 0.005 } = {}) {
      const x = A.ctx(); if (!x) return;
      const t = x.currentTime + at;
      const o = x.createOscillator(), g = x.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(x.destination); o.start(t); o.stop(t + dur + 0.02);
    },
    noise(dur = 0.1, { vol = 0.3, at = 0, freq = 1500, q = 0.7, type = 'bandpass', sweepTo = null } = {}) {
      const x = A.ctx(); if (!x) return;
      const t = x.currentTime + at;
      const n = Math.max(1, Math.floor(x.sampleRate * dur));
      const buf = x.createBuffer(1, n, x.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const s = x.createBufferSource(); s.buffer = buf;
      const f = x.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
      if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
      const g = x.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f).connect(g).connect(x.destination); s.start(t);
    },
    close() { try { c && c.close(); } catch {} c = null; },
  };
  return A;
}

/** Confetti on a canvas. Returns {burst(n), rain(on), stop()}. */
export function confetti(canvas) {
  const cx = canvas.getContext('2d');
  let parts = [], raining = false;
  const colors = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#ff924c'];
  const mk = (x, y, vx, vy) => parts.push({ x, y, vx, vy, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4, w: 5 + Math.random() * 7, h: 3 + Math.random() * 5, c: colors[(Math.random() * colors.length) | 0] });
  const stopLoop = loop(dt => {
    const W = canvas.width, H = canvas.height;
    cx.clearRect(0, 0, W, H);
    if (raining && parts.length < 160) for (let i = 0; i < 2; i++) mk(Math.random() * W, -10, (Math.random() - 0.5) * 60, 60 + Math.random() * 120);
    for (const p of parts) {
      p.vy += 380 * dt; p.vx *= 0.995; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr;
      cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r); cx.fillStyle = p.c; cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); cx.restore();
    }
    parts = parts.filter(p => p.y < H + 20);
  });
  return {
    burst(n = 80, x = canvas.width / 2, y = canvas.height / 2) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = 150 + Math.random() * 400; mk(x, y, Math.cos(a) * s, Math.sin(a) * s - 250); } },
    rain(on) { raining = on; },
    stop() { stopLoop(); },
  };
}
