import { el, render } from '../../lib/ui.js';
import { confetti } from './_fx.js';

export default function (root) {
  root.style.position = 'relative';
  root.style.overflow = 'hidden';
  const style = el('style', {}, '@keyframes iif-pop{0%{transform:scale(.6) rotate(-4deg);opacity:0}60%{transform:scale(1.08) rotate(2deg)}100%{transform:scale(1) rotate(0);opacity:1}} @keyframes iif-wiggle{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2deg)}}');
  const answer = el('div', { style: { fontSize: 'clamp(90px,28vw,280px)', fontWeight: 900, lineHeight: 1, textAlign: 'center', letterSpacing: '-0.03em', margin: '10px 0', cursor: 'pointer', userSelect: 'none' } });
  const small = el('div', { class: 'muted center', style: { fontSize: '12px', opacity: 0.7, minHeight: '1.4em' } });
  const dayLine = el('div', { class: 'center muted small' });
  const canvas = el('canvas', { style: { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none' } });
  render(root, style, dayLine, answer, small, canvas);

  const fx = confetti(canvas);
  let last = null, bt = null;
  const sync = () => { if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) { canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight; } };

  function update() {
    sync();
    const now = new Date(), dow = now.getDay(), yes = dow === 5;
    const key = now.toDateString() + yes;
    if (key === last) return; last = key;
    answer.textContent = yes ? 'YES' : 'NO';
    answer.style.color = yes ? 'var(--ok)' : 'var(--danger)';
    answer.style.animation = 'iif-pop .6s cubic-bezier(.2,1.4,.4,1) both' + (yes ? ', iif-wiggle 2s .6s infinite ease-in-out' : '');
    dayLine.textContent = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    const n = (5 - dow + 7) % 7;
    small.textContent = yes ? '' : `come back in ${n} day${n === 1 ? '' : 's'}`;
    if (yes) { fx.rain(true); clearTimeout(bt); bt = setTimeout(() => fx.burst(150), 300); } else fx.rain(false);
  }
  update();
  const iv = setInterval(update, 1000);
  const onClick = e => { if (new Date().getDay() === 5) { const r = canvas.getBoundingClientRect(); fx.burst(70, e.clientX - r.left, e.clientY - r.top); } };
  root.addEventListener('click', onClick);
  return () => { clearInterval(iv); clearTimeout(bt); fx.stop(); root.removeEventListener('click', onClick); };
}
