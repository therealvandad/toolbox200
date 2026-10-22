// Box shadow and border radius playground: layered shadows, per-corner radius, live preview and CSS to copy.
import { el, render, copy, store, field } from '../../lib/ui.js';

const PRESETS = {
  'Soft card': [{ x: 0, y: 4, blur: 12, spread: 0, color: '#000000', alpha: 10, inset: false }, { x: 0, y: 1, blur: 2, spread: 0, color: '#000000', alpha: 6, inset: false }],
  'Floating': [{ x: 0, y: 20, blur: 40, spread: -8, color: '#000000', alpha: 25, inset: false }, { x: 0, y: 2, blur: 6, spread: 0, color: '#000000', alpha: 8, inset: false }],
  'Hard offset': [{ x: 8, y: 8, blur: 0, spread: 0, color: '#1b1f24', alpha: 100, inset: false }],
  'Inset well': [{ x: 0, y: 2, blur: 6, spread: 0, color: '#000000', alpha: 20, inset: true }, { x: 0, y: 1, blur: 0, spread: 0, color: '#ffffff', alpha: 60, inset: false }],
  'Glow': [{ x: 0, y: 0, blur: 24, spread: 2, color: '#2f6fed', alpha: 45, inset: false }],
  'Layered smooth': [{ x: 0, y: 1, blur: 1, spread: 0, color: '#000000', alpha: 4, inset: false }, { x: 0, y: 2, blur: 2, spread: 0, color: '#000000', alpha: 4, inset: false }, { x: 0, y: 4, blur: 4, spread: 0, color: '#000000', alpha: 4, inset: false }, { x: 0, y: 8, blur: 8, spread: 0, color: '#000000', alpha: 4, inset: false }, { x: 0, y: 16, blur: 16, spread: 0, color: '#000000', alpha: 4, inset: false }],
};
const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${(a / 100).toFixed(2).replace(/\.?0+$/, '') || '0'})`; };

export default function (root) {
  const s = store('shadow-radius');
  let layers = s.get('layers', PRESETS['Soft card']);
  let radius = s.get('radius', { tl: 16, tr: 16, br: 16, bl: 16 });
  const linked = el('input', { type: 'checkbox', checked: s.get('linked', true) });
  const boxColor = el('input', { type: 'color', value: s.get('box', '#ffffff') });
  const bgColor = el('input', { type: 'color', value: s.get('bg', '#eef1f5') });
  const boxW = el('input', { type: 'range', min: 80, max: 400, value: s.get('w', 220), class: 'input' });
  const boxH = el('input', { type: 'range', min: 60, max: 300, value: s.get('h', 140), class: 'input' });
  const box = el('div', {}, el('span', { class: 'muted small' }, 'preview'));
  const stage = el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '340px', borderRadius: '10px', border: '1px solid var(--line)', padding: '20px', overflow: 'hidden' } }, box);
  const layerList = el('div', { class: 'col' });
  const radiusRow = el('div', { class: 'row' });
  const css = el('pre', { class: 'out' });
  const presetSel = el('select', { class: 'select' }, el('option', { value: '' }, 'Presets…'), Object.keys(PRESETS).map(k => el('option', { value: k }, k)));

  const shadowCss = () => layers.map(l => `${l.inset ? 'inset ' : ''}${l.x}px ${l.y}px ${l.blur}px ${l.spread}px ${hexA(l.color, l.alpha)}`).join(',\n    ');
  const radiusCss = () => { const { tl, tr, br, bl } = radius; return tl === tr && tr === br && br === bl ? `${tl}px` : `${tl}px ${tr}px ${br}px ${bl}px`; };
  function update() {
    const sh = layers.length ? shadowCss() : 'none';
    box.style.cssText = `width:${boxW.value}px;height:${boxH.value}px;max-width:100%;background:${boxColor.value};border-radius:${radiusCss()};box-shadow:${sh};display:flex;align-items:center;justify-content:center`;
    stage.style.background = bgColor.value;
    css.textContent = `border-radius: ${radiusCss()};\nbox-shadow: ${sh};`;
    s.set('layers', layers); s.set('radius', radius); s.set('linked', linked.checked); s.set('box', boxColor.value); s.set('bg', bgColor.value); s.set('w', +boxW.value); s.set('h', +boxH.value);
  }
  function num(obj, key, min, max, onchange) {
    const i = el('input', { type: 'number', class: 'input', min, max, value: obj[key], style: { width: '64px' }, oninput: () => { obj[key] = +i.value || 0; onchange(); } });
    return i;
  }
  function showLayers() {
    render(layerList, layers.map((l, i) => el('div', { class: 'row panel', style: { padding: '8px', gap: '8px' } },
      el('span', { class: 'muted small', style: { width: '18px' } }, i + 1),
      field('X', num(l, 'x', -100, 100, update)), field('Y', num(l, 'y', -100, 100, update)), field('Blur', num(l, 'blur', 0, 200, update)), field('Spread', num(l, 'spread', -100, 100, update)),
      field('Colour', el('input', { type: 'color', value: l.color, oninput: e => { l.color = e.target.value; update(); } })),
      field('Opacity %', num(l, 'alpha', 0, 100, update)),
      el('label', { class: 'inline' }, el('input', { type: 'checkbox', checked: l.inset, onchange: e => { l.inset = e.target.checked; update(); } }), 'Inset'),
      el('button', { class: 'btn small ghost', title: 'Duplicate', onclick: () => { layers.splice(i + 1, 0, { ...l }); showLayers(); update(); } }, '⧉'),
      el('button', { class: 'btn small ghost', title: 'Remove', onclick: () => { layers.splice(i, 1); showLayers(); update(); } }, '✕'))),
      el('div', { class: 'row', style: { margin: 0 } },
        el('button', { class: 'btn small', onclick: () => { layers.push({ x: 0, y: 4, blur: 12, spread: 0, color: '#000000', alpha: 15, inset: false }); showLayers(); update(); } }, '+ Add layer'),
        presetSel));
  }
  function showRadius() {
    const mk = (key, label) => field(label, el('input', { type: 'range', min: 0, max: 150, value: radius[key], class: 'input', oninput: e => { const v = +e.target.value; if (linked.checked) radius = { tl: v, tr: v, br: v, bl: v }; else radius[key] = v; if (linked.checked) showRadius(); update(); } }));
    render(radiusRow, mk('tl', 'Top left'), mk('tr', 'Top right'), mk('br', 'Bottom right'), mk('bl', 'Bottom left'), el('label', { class: 'inline' }, linked, 'Link corners'));
  }
  presetSel.addEventListener('change', () => { if (!presetSel.value) return; layers = PRESETS[presetSel.value].map(l => ({ ...l })); presetSel.value = ''; showLayers(); update(); });
  linked.addEventListener('change', () => { if (linked.checked) { radius = { tl: radius.tl, tr: radius.tl, br: radius.tl, bl: radius.tl }; showRadius(); } update(); });
  for (const c of [boxColor, bgColor, boxW, boxH]) c.addEventListener('input', update);
  render(root,
    el('div', { class: 'grid2' },
      el('div', {}, el('h3', { style: { margin: '0 0 6px', fontSize: '15px' } }, 'Shadow layers'), layerList,
        el('h3', { style: { margin: '14px 0 6px', fontSize: '15px' } }, 'Corner radius'), radiusRow,
        el('div', { class: 'row' }, field('Box colour', boxColor), field('Backdrop', bgColor), field('Width', boxW), field('Height', boxH))),
      el('div', {}, stage, css, el('div', { class: 'row' }, el('button', { class: 'btn primary', onclick: () => copy(css.textContent) }, 'Copy CSS')))));
  showLayers(); showRadius(); update();
}
