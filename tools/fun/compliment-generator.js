import { el, render, download, toast, copy } from '../../lib/ui.js';

const OPEN = ['You have', 'Honestly, you have', 'Everyone notices that you have', 'It is true: you have', 'Somehow you have', 'Today you are showing', 'The world is lucky to have', 'Never forget that you have'];
const ADJ = ['an unstoppable', 'a quietly brilliant', 'a wonderfully weird', 'a rare and generous', 'an effortlessly warm', 'a razor-sharp', 'a gloriously stubborn', 'a contagious', 'a deeply kind', 'a fearless', 'an inspiring', 'a delightfully curious'];
const NOUN = ['sense of humor', 'way of seeing things', 'kind of energy', 'talent for making people feel at home', 'creative spark', 'work ethic', 'sense of style', 'laugh', 'instinct for doing the right thing', 'knack for solving problems', 'heart', 'imagination'];
const END = ['and it shows.', 'and it makes the room better.', 'and people remember it.', 'and that is no small thing.', 'and the day is better for it.', 'and nobody else has quite that.', 'and it is your superpower.', 'and we are all better for it.'];
const SOLO = [
  'You are the human equivalent of a warm blanket fresh from the dryer.',
  'If you were a font, you would be perfectly kerned.',
  'Your ideas deserve a standing ovation, or at least a very enthusiastic nod.',
  'You make hard things look like a pleasant afternoon stroll.',
  'Plants lean toward you. That is not a coincidence.',
  'You are proof that good things come in unexpected packages.',
  'Your presence is a software update that only fixes bugs.',
  'Somewhere, a dog is proud of you right now.',
  'You are like a good cup of tea: comforting, and better than anyone expected.',
  'You have main character energy, and you share the spotlight generously.',
];
const PALETTES = [['#ff9a9e', '#fad0c4', '#a18cd1'], ['#4facfe', '#00f2fe', '#43e97b'], ['#f6d365', '#fda085', '#f093fb'], ['#667eea', '#764ba2', '#f093fb'], ['#11998e', '#38ef7d', '#a8ff78'], ['#fc5c7d', '#6a82fb', '#fbc2eb'], ['#ff758c', '#ff7eb3', '#ffd194'], ['#0f2027', '#2c5364', '#43cea2'], ['#ee9ca7', '#ffdde1', '#c2e9fb'], ['#f12711', '#f5af19', '#fff1eb']];
const pick = a => a[Math.floor(Math.random() * a.length)];

export default function (root) {
  const textEl = el('div', { style: { fontSize: 'clamp(20px,4vw,30px)', fontWeight: 700, textAlign: 'center', padding: '28px 12px', transition: 'opacity .25s, transform .25s', minHeight: '5em', display: 'flex', alignItems: 'center', justifyContent: 'center' } });
  const canvas = el('canvas', { width: 1080, height: 1080, style: { width: '100%', maxWidth: '420px', borderRadius: '10px', boxShadow: 'var(--shadow)' } });
  const count = el('span', { class: 'small muted' });
  const to = el('input', { class: 'input', placeholder: 'Name (optional)', maxlength: 30, oninput: () => draw() });
  let current = '', pal = PALETTES[0], angle = 0.8, n = 0;

  function make() {
    return Math.random() < 0.15 ? pick(SOLO) : `${pick(OPEN)} ${pick(ADJ)} ${pick(NOUN)} ${pick(END)}`;
  }
  function another() {
    textEl.style.opacity = 0; textEl.style.transform = 'translateY(8px)';
    setTimeout(() => {
      current = make(); pal = pick(PALETTES); angle = Math.random() * Math.PI * 2; n++;
      textEl.textContent = current; textEl.style.opacity = 1; textEl.style.transform = 'none';
      count.textContent = `#${n} of ${(OPEN.length * ADJ.length * NOUN.length * END.length + SOLO.length).toLocaleString()} possible`;
      draw();
    }, 150);
  }

  function wrap(cx, text, maxW) {
    const words = text.split(' '), lines = []; let line = '';
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (cx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
    }
    if (line) lines.push(line);
    return lines;
  }
  function draw() {
    if (!current) return;
    const cx = canvas.getContext('2d'), S = 1080;
    const dx = Math.cos(angle) * S / 2, dy = Math.sin(angle) * S / 2;
    const g = cx.createLinearGradient(S / 2 - dx, S / 2 - dy, S / 2 + dx, S / 2 + dy);
    pal.forEach((c, i) => g.addColorStop(i / (pal.length - 1), c));
    cx.fillStyle = g; cx.fillRect(0, 0, S, S);
    // soft circles
    cx.globalAlpha = 0.14; cx.fillStyle = '#fff';
    for (let i = 0; i < 6; i++) { cx.beginPath(); cx.arc((i * 337 + n * 71) % S, (i * 521 + n * 113) % S, 80 + (i * 47) % 160, 0, 6.28); cx.fill(); }
    cx.globalAlpha = 1;
    cx.fillStyle = 'rgba(0,0,0,.22)'; cx.fillRect(70, 70, S - 140, S - 140);
    cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillStyle = '#fff';
    let size = 80, lines;
    for (;;) {
      cx.font = `800 ${size}px system-ui, "Segoe UI", Arial, sans-serif`; lines = wrap(cx, current, S - 280);
      if (lines.length * size * 1.3 <= S - 420 || size <= 28) break;
      size -= 4;
    }
    const lh = size * 1.3;
    const top = S / 2 - (lines.length - 1) * lh / 2 - (to.value ? 30 : 0);
    cx.shadowColor = 'rgba(0,0,0,.35)'; cx.shadowBlur = 12;
    lines.forEach((l, i) => cx.fillText(l, S / 2, top + i * lh));
    cx.shadowBlur = 0;
    if (to.value.trim()) { cx.font = '600 44px system-ui, Arial, sans-serif'; cx.fillText('- for ' + to.value.trim(), S / 2, S - 150); }
    cx.font = '28px system-ui, Arial, sans-serif'; cx.globalAlpha = 0.7; cx.fillText('Toolbox 200', S / 2, S - 100); cx.globalAlpha = 1;
  }

  const onKey = e => { if (e.key === ' ' && document.activeElement === root) { e.preventDefault(); another(); } };
  root.tabIndex = 0; root.addEventListener('keydown', onKey);

  render(root,
    textEl,
    el('div', { class: 'row', style: { justifyContent: 'center' } },
      el('button', { class: 'btn primary', onclick: another }, 'Another one'),
      el('button', { class: 'btn', onclick: () => copy(current) }, 'Copy text'),
      el('button', { class: 'btn', onclick: () => canvas.toBlob(b => { download('compliment.png', b, 'image/png'); toast('Saved'); }, 'image/png') }, 'Download card')),
    el('div', { class: 'row', style: { justifyContent: 'center' } }, to, count),
    el('div', { class: 'row', style: { justifyContent: 'center' } }, canvas));
  another();
  return () => { root.removeEventListener('keydown', onKey); };
}
