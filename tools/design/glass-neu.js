// Glassmorphism and neumorphism generator: sliders for blur, transparency, border, depth and light direction; CSS to copy.
import { el, render, copy, store, field } from '../../lib/ui.js';

const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const rgba = (h, a) => `rgba(${hexRgb(h).join(', ')}, ${(+a).toFixed(2).replace(/\.?0+$/, '') || '0'})`;
const shade = (h, f) => '#' + hexRgb(h).map(v => Math.max(0, Math.min(255, Math.round(f > 0 ? v + (255 - v) * f : v * (1 + f))))).map(v => v.toString(16).padStart(2, '0')).join('');
const DIRS = { 'top-left': [-1, -1], 'top': [0, -1], 'top-right': [1, -1], 'left': [-1, 0], 'right': [1, 0], 'bottom-left': [-1, 1], 'bottom': [0, 1], 'bottom-right': [1, 1] };

export default function (root) {
  const s = store('glass-neu');
  const mode = el('select', { class: 'select' }, el('option', { value: 'glass' }, 'Glassmorphism'), el('option', { value: 'neu' }, 'Neumorphism'));
  mode.value = s.get('mode', 'glass');
  // glass controls
  const gBlur = el('input', { type: 'range', min: 0, max: 40, value: s.get('gBlur', 12), class: 'input' });
  const gAlpha = el('input', { type: 'range', min: 0, max: 100, value: s.get('gAlpha', 20), class: 'input' });
  const gColor = el('input', { type: 'color', value: s.get('gColor', '#ffffff') });
  const gBorder = el('input', { type: 'range', min: 0, max: 100, value: s.get('gBorder', 35), class: 'input' });
  const gSat = el('input', { type: 'range', min: 100, max: 250, value: s.get('gSat', 160), class: 'input' });
  const gRadius = el('input', { type: 'range', min: 0, max: 60, value: s.get('gRadius', 18), class: 'input' });
  const gBg1 = el('input', { type: 'color', value: s.get('gBg1', '#ff7a59') }), gBg2 = el('input', { type: 'color', value: s.get('gBg2', '#5b8dff') });
  // neu controls
  const nColor = el('input', { type: 'color', value: s.get('nColor', '#e0e5ec') });
  const nDist = el('input', { type: 'range', min: 2, max: 50, value: s.get('nDist', 10), class: 'input' });
  const nBlur = el('input', { type: 'range', min: 0, max: 100, value: s.get('nBlur', 20), class: 'input' });
  const nIntensity = el('input', { type: 'range', min: 1, max: 60, value: s.get('nIntensity', 15), class: 'input' });
  const nDir = el('select', { class: 'select' }, Object.keys(DIRS).map(d => el('option', { value: d, selected: d === s.get('nDir', 'top-left') }, d)));
  const nShape = el('select', { class: 'select' }, [['flat', 'Flat'], ['convex', 'Convex'], ['concave', 'Concave'], ['pressed', 'Pressed (inset)']].map(([v, l]) => el('option', { value: v, selected: v === s.get('nShape', 'flat') }, l)));
  const nRadius = el('input', { type: 'range', min: 0, max: 100, value: s.get('nRadius', 24), class: 'input' });

  const card = el('div', { style: { width: '260px', height: '170px', maxWidth: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px' } },
    el('div', { style: { fontWeight: 700, fontSize: '20px' } }, 'Card title'), el('div', { style: { fontSize: '13px', opacity: .8 } }, 'Some supporting text'));
  const stage = el('div', { style: { minHeight: '320px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', position: 'relative', overflow: 'hidden', border: '1px solid var(--line)' } }, card);
  const css = el('pre', { class: 'out' });
  const glassBox = el('div', { class: 'row' }, field('Blur px', gBlur), field('Tint opacity', gAlpha), field('Tint colour', gColor), field('Border opacity', gBorder), field('Saturation %', gSat), field('Radius', gRadius), field('Backdrop colours', el('div', { class: 'row', style: { margin: 0 } }, gBg1, gBg2)));
  const neuBox = el('div', { class: 'row' }, field('Base colour', nColor), field('Distance', nDist), field('Blur', nBlur), field('Intensity', nIntensity), field('Light from', nDir), field('Shape', nShape), field('Radius', nRadius));

  function update() {
    const glass = mode.value === 'glass';
    glassBox.classList.toggle('hidden', !glass); neuBox.classList.toggle('hidden', glass);
    let rules;
    if (glass) {
      rules = [
        `background: ${rgba(gColor.value, gAlpha.value / 100)};`,
        `backdrop-filter: blur(${gBlur.value}px) saturate(${gSat.value}%);`,
        `-webkit-backdrop-filter: blur(${gBlur.value}px) saturate(${gSat.value}%);`,
        `border: 1px solid ${rgba(gColor.value, gBorder.value / 100)};`,
        `border-radius: ${gRadius.value}px;`,
        `box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);`,
      ];
      stage.style.background = `linear-gradient(135deg, ${gBg1.value}, ${gBg2.value})`;
      stage.style.backgroundImage = `radial-gradient(circle at 20% 30%, ${shade(gBg1.value, .25)} 0, transparent 30%), radial-gradient(circle at 80% 70%, ${shade(gBg2.value, .2)} 0, transparent 35%), linear-gradient(135deg, ${gBg1.value}, ${gBg2.value})`;
      card.style.color = '#fff';
    } else {
      const base = nColor.value, d = +nDist.value, b = +nBlur.value, k = nIntensity.value / 100;
      const [dx, dy] = DIRS[nDir.value];
      const dark = shade(base, -k), light = shade(base, k * 1.2);
      const inset = nShape.value === 'pressed' ? 'inset ' : '';
      const shadow = `${inset}${dx * d}px ${dy * d}px ${b}px ${dark}, ${inset}${-dx * d}px ${-dy * d}px ${b}px ${light}`;
      let bg = base;
      const ang = Math.round(Math.atan2(-dx, dy) * 180 / Math.PI); // gradient runs from the lit side to the shaded side
      if (nShape.value === 'convex') bg = `linear-gradient(${ang}deg, ${shade(base, .07)}, ${shade(base, -.07)})`;
      if (nShape.value === 'concave') bg = `linear-gradient(${ang}deg, ${shade(base, -.07)}, ${shade(base, .07)})`;
      rules = [`background: ${bg};`, `border-radius: ${nRadius.value}px;`, `box-shadow: ${shadow};`];
      stage.style.backgroundImage = 'none'; stage.style.background = base;
      card.style.color = shade(base, -.6);
    }
    card.style.cssText += ';' + rules.join('');
    css.textContent = `.card {\n  ${rules.join('\n  ')}\n}`;
    s.set('mode', mode.value); s.set('gBlur', +gBlur.value); s.set('gAlpha', +gAlpha.value); s.set('gColor', gColor.value); s.set('gBorder', +gBorder.value); s.set('gSat', +gSat.value); s.set('gRadius', +gRadius.value); s.set('gBg1', gBg1.value); s.set('gBg2', gBg2.value);
    s.set('nColor', nColor.value); s.set('nDist', +nDist.value); s.set('nBlur', +nBlur.value); s.set('nIntensity', +nIntensity.value); s.set('nDir', nDir.value); s.set('nShape', nShape.value); s.set('nRadius', +nRadius.value);
  }
  function resetCard() { card.style.cssText = 'width:260px;height:170px;max-width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px'; update(); }
  for (const c of [gBlur, gAlpha, gColor, gBorder, gSat, gRadius, gBg1, gBg2, nColor, nDist, nBlur, nIntensity, nRadius]) c.addEventListener('input', resetCard);
  for (const c of [mode, nDir, nShape]) c.addEventListener('change', resetCard);
  render(root,
    el('div', { class: 'row' }, field('Style', mode)),
    glassBox, neuBox,
    stage, css,
    el('div', { class: 'row' }, el('button', { class: 'btn primary', onclick: () => copy(css.textContent) }, 'Copy CSS')),
    el('p', { class: 'muted small' }, 'Glass cards need something colourful behind them for the blur to show. Neumorphic elements should share the same background colour as their parent.'));
  resetCard();
}
