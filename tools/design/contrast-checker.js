// Contrast checker: WCAG ratio for two colours, AA/AAA for normal and large text, sample text, nearest passing shades.
import { el, render, field, copy, store } from '../../lib/ui.js';

const hexOk = h => /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(h.trim());
function norm(h) { h = h.trim().replace(/^#?/, ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return '#' + h.toLowerCase(); }
function rgb(h) { const n = parseInt(norm(h).slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function lum([r, g, b]) { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); }
function ratio(a, b) { const la = lum(rgb(a)), lb = lum(rgb(b)); return (Math.max(la, lb) + .05) / (Math.min(la, lb) + .05); }
function toHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2;
  if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; }
  return [h, s, l];
}
function fromHsl([h, s, l]) {
  const k = n => (n + h * 12) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return '#' + [f(0), f(8), f(4)].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
}
/** Nearest shade of `color` (changing lightness only) that reaches `target` against `other`. */
function suggest(color, other, target) {
  if (ratio(color, other) >= target) return color;
  const [h, s, l] = toHsl(rgb(color));
  let best = null;
  for (let d = 1; d <= 100; d++) {
    for (const dir of [1, -1]) {
      const nl = l + dir * d / 100; if (nl < 0 || nl > 1) continue;
      const c = fromHsl([h, s, nl]);
      if (ratio(c, other) >= target) { best = c; break; }
    }
    if (best) break;
  }
  return best;
}

export default function (root) {
  const s = store('contrast-checker');
  const fgPick = el('input', { type: 'color', value: s.get('fg', '#1b1f24') }), fgHex = el('input', { class: 'input mono', value: s.get('fg', '#1b1f24'), style: { width: '100px' } });
  const bgPick = el('input', { type: 'color', value: s.get('bg', '#f6f7f9') }), bgHex = el('input', { class: 'input mono', value: s.get('bg', '#f6f7f9'), style: { width: '100px' } });
  const big = el('div', { class: 'huge', style: { textAlign: 'center' } });
  const grade = el('div', { class: 'row', style: { justifyContent: 'center' } });
  const results = el('div');
  const sample = el('div', { class: 'panel', style: { padding: '20px', borderRadius: '10px' } });
  const fixes = el('div', { class: 'row' });

  const badge = ok => el('span', { class: 'badge ' + (ok ? 'ok' : 'danger') }, ok ? 'Pass' : 'Fail');
  function row(label, need, r) { return el('tr', {}, el('td', {}, label), el('td', { class: 'mono' }, need + ':1'), el('td', {}, badge(r >= need))); }
  function fixBtn(label, c, isFg) {
    if (!c) return el('span', { class: 'badge warn' }, `${label}: no shade reaches it`);
    return el('button', { class: 'btn small', style: { display: 'flex', gap: '6px', alignItems: 'center' }, onclick: () => { (isFg ? fgPick : bgPick).value = c; (isFg ? fgHex : bgHex).value = c; update(); } },
      el('span', { style: { width: '16px', height: '16px', borderRadius: '4px', background: c, border: '1px solid var(--line)', display: 'inline-block' } }), `${label}: ${c}`);
  }
  function update() {
    if (!hexOk(fgHex.value) || !hexOk(bgHex.value)) { big.textContent = '—'; render(grade, el('span', { class: 'badge warn' }, 'Enter valid hex colours')); return; }
    const fg = norm(fgHex.value), bg = norm(bgHex.value);
    fgPick.value = fg; bgPick.value = bg; s.set('fg', fg); s.set('bg', bg);
    const r = ratio(fg, bg);
    big.textContent = r.toFixed(2) + ':1';
    render(grade, r >= 7 ? el('span', { class: 'badge ok' }, 'AAA') : r >= 4.5 ? el('span', { class: 'badge ok' }, 'AA') : r >= 3 ? el('span', { class: 'badge warn' }, 'AA large text only') : el('span', { class: 'badge danger' }, 'Fails WCAG'));
    render(results, el('table', { class: 'table' },
      el('thead', {}, el('tr', {}, el('th', {}, 'Criterion'), el('th', {}, 'Needs'), el('th', {}, 'Result'))),
      el('tbody', {}, row('AA normal text (under 18pt / 14pt bold)', 4.5, r), row('AA large text (18pt+ or 14pt bold)', 3, r), row('AAA normal text', 7, r), row('AAA large text', 4.5, r), row('AA UI components and graphics', 3, r))));
    sample.style.background = bg; sample.style.color = fg; sample.style.borderColor = fg;
    render(sample,
      el('div', { style: { fontSize: '14px' } }, 'Normal text 14px: The quick brown fox jumps over the lazy dog.'),
      el('div', { style: { fontSize: '18px', margin: '8px 0' } }, 'Body text 18px: Sphinx of black quartz, judge my vow.'),
      el('div', { style: { fontSize: '24px', fontWeight: 700 } }, 'Large bold heading 24px'),
      el('div', { style: { marginTop: '10px' } }, el('span', { style: { display: 'inline-block', padding: '6px 14px', border: `2px solid ${fg}`, borderRadius: '8px' } }, 'Button outline')));
    render(fixes,
      r >= 7 ? el('span', { class: 'muted small' }, 'Already passes AAA. Nothing to fix.') : [
        el('span', { class: 'small muted' }, 'Nearest passing shades (click to apply):'),
        r < 4.5 ? fixBtn('Text for AA', suggest(fg, bg, 4.5), true) : null,
        fixBtn('Text for AAA', suggest(fg, bg, 7), true),
        r < 4.5 ? fixBtn('Background for AA', suggest(bg, fg, 4.5), false) : null,
        fixBtn('Background for AAA', suggest(bg, fg, 7), false)]);
  }
  fgPick.addEventListener('input', () => { fgHex.value = fgPick.value; update(); });
  bgPick.addEventListener('input', () => { bgHex.value = bgPick.value; update(); });
  fgHex.addEventListener('input', update); bgHex.addEventListener('input', update);
  render(root,
    el('div', { class: 'row', style: { justifyContent: 'center' } },
      field('Text colour', el('div', { class: 'row', style: { margin: 0 } }, fgPick, fgHex)),
      el('button', { class: 'btn ghost', title: 'Swap', onclick: () => { const t = fgHex.value; fgHex.value = bgHex.value; bgHex.value = t; update(); } }, '⇄'),
      field('Background', el('div', { class: 'row', style: { margin: 0 } }, bgPick, bgHex))),
    big, grade, results, sample, fixes,
    el('div', { class: 'row' }, el('button', { class: 'btn', onclick: () => hexOk(fgHex.value) && hexOk(bgHex.value) && copy(`color: ${norm(fgHex.value)};\nbackground: ${norm(bgHex.value)};\n/* contrast ${ratio(fgHex.value, bgHex.value).toFixed(2)}:1 */`) }, 'Copy CSS')));
  update();
}
