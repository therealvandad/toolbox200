// Fraction visualizer: pie and bar models, simplification, and step-by-step add/subtract/multiply/divide.
import { el, render, store } from '../../lib/ui.js';

const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
const lcm = (a, b) => Math.abs(a * b) / gcd(a, b);
function norm(n, d) { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d); return [n / g, d / g]; }
const fs = (n, d) => d === 1 ? String(n) : `${n}/${d}`;
function mixed(n, d) {
  if (d === 1 || Math.abs(n) < d) return fs(n, d);
  const w = Math.trunc(n / d), r = Math.abs(n % d);
  return r ? `${w} ${r}/${d}` : String(w);
}

export default function (root) {
  const s = store('fraction-visualizer');
  const saved = s.get('v', { an: 1, ad: 2, bn: 1, bd: 3, op: '+' });
  const num = (v) => el('input', { class: 'input mono', type: 'number', step: 1, value: v, style: { width: '72px', textAlign: 'center', fontSize: '18px' }, oninput: update });
  const an = num(saved.an), ad = num(saved.ad), bn = num(saved.bn), bd = num(saved.bd);
  const opSel = el('select', { class: 'select', style: { fontSize: '20px' }, onchange: update },
    [['+', '+'], ['-', '−'], ['*', '×'], ['/', '÷']].map(([v, t]) => el('option', { value: v, selected: v === saved.op }, t)));
  const fracInput = (n, d) => el('div', { class: 'col', style: { gap: '2px', alignItems: 'center' } }, n, el('div', { style: { width: '72px', borderTop: '2px solid var(--text)' } }), d);

  const models = el('div', { class: 'row', style: { alignItems: 'flex-start', justifyContent: 'center', gap: '18px' } });
  const steps = el('div', { class: 'col' });
  const err = el('div', { class: 'small', style: { color: 'var(--danger)' } });

  const css = getComputedStyle(document.documentElement);
  const color = (v) => css.getPropertyValue(v).trim() || '#888';

  function pie(n, d, col, size = 110) {
    const c = el('canvas', { width: size, height: size, style: { width: size + 'px', height: size + 'px' } });
    const ctx = c.getContext('2d'); const cx = size / 2, cy = size / 2, r = size / 2 - 3;
    // draw up to 1 whole only (first whole) and note extras in label
    const filled = Math.min(Math.abs(n), d);
    for (let i = 0; i < d; i++) {
      const a0 = -Math.PI / 2 + i * 2 * Math.PI / d, a1 = a0 + 2 * Math.PI / d;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, a0, a1); ctx.closePath();
      ctx.fillStyle = i < filled ? col : color('--bg'); ctx.fill();
      ctx.strokeStyle = color('--line'); ctx.lineWidth = d > 40 ? 0.5 : 1.5; ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.strokeStyle = color('--muted'); ctx.lineWidth = 1.5; ctx.stroke();
    return c;
  }
  function bar(n, d, col, w = 220, h = 26) {
    const wholes = Math.max(1, Math.ceil(Math.abs(n) / d));
    const c = el('canvas', { width: w, height: h * wholes + 4 * (wholes - 1), style: { width: w + 'px', maxWidth: '100%' } });
    const ctx = c.getContext('2d');
    let left = Math.abs(n);
    for (let k = 0; k < wholes; k++) {
      const y = k * (h + 4);
      for (let i = 0; i < d; i++) {
        const x = (i * w) / d, cw = w / d;
        ctx.fillStyle = left > 0 ? col : color('--bg'); left--;
        ctx.fillRect(x, y, cw, h);
        ctx.strokeStyle = color('--line'); ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, cw - 1, h - 1);
      }
      ctx.strokeStyle = color('--muted'); ctx.strokeRect(0.5, y + 0.5, w - 1, h - 1);
    }
    return c;
  }
  function model(label, n, d, col) {
    const [sn, sd] = norm(n, d);
    const c = pie(n, d, col);
    return el('div', { class: 'col center', style: { alignItems: 'center', gap: '6px' } },
      el('div', { class: 'muted small' }, label),
      el('div', { class: 'big mono' }, fs(n, d)),
      c, bar(n, d, col),
      el('div', { class: 'small mono' }, (fs(sn, sd) !== fs(n, d) ? `= ${fs(sn, sd)}  ` : '') + (Math.abs(sn) >= sd && sd !== 1 ? `= ${mixed(sn, sd)}  ` : '') + `= ${(n / d).toFixed(4).replace(/\.?0+$/, '')} = ${(100 * n / d).toFixed(2).replace(/\.?0+$/, '')}%`),
      Math.abs(n) > d && el('div', { class: 'muted small' }, 'pie shows first whole only'));
  }

  const line = (html) => el('div', { class: 'mono', style: { padding: '6px 10px', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: '6px' } }, html);

  function update() {
    const A = [parseInt(an.value, 10), parseInt(ad.value, 10)], B = [parseInt(bn.value, 10), parseInt(bd.value, 10)], op = opSel.value;
    s.set('v', { an: an.value, ad: ad.value, bn: bn.value, bd: bd.value, op });
    if ([...A, ...B].some(v => !Number.isFinite(v))) { render(err, 'Enter whole numbers in every box.'); render(models); render(steps); return; }
    if (A[1] === 0 || B[1] === 0) { render(err, 'A denominator cannot be zero.'); render(models); render(steps); return; }
    if ([...A, ...B].some(v => Math.abs(v) > 999)) { render(err, 'Keep numbers between −999 and 999.'); render(models); render(steps); return; }
    render(err);
    if (A[1] < 0) { A[0] = -A[0]; A[1] = -A[1]; } if (B[1] < 0) { B[0] = -B[0]; B[1] = -B[1]; }
    const [a, b] = [A[0], A[1]], [c, d] = [B[0], B[1]];
    const out = [];
    let rn, rd;
    if (op === '+' || op === '-') {
      const sym = op === '+' ? '+' : '−';
      out.push(line(`${fs(a, b)} ${sym} ${fs(c, d)}`));
      if (b === d) { out.push(el('div', { class: 'small muted' }, 'Same denominator, so just ' + (op === '+' ? 'add' : 'subtract') + ' the numerators:')); }
      else {
        const L = lcm(b, d);
        out.push(el('div', { class: 'small muted' }, `Different denominators. The least common denominator of ${b} and ${d} is ${L}.`));
        out.push(line(`${fs(a, b)} = ${a}×${L / b} / ${b}×${L / b} = ${fs(a * L / b, L)}`));
        out.push(line(`${fs(c, d)} = ${c}×${L / d} / ${d}×${L / d} = ${fs(c * L / d, L)}`));
        out.push(el('div', { class: 'small muted' }, (op === '+' ? 'Add' : 'Subtract') + ' the numerators, keep the denominator:'));
      }
      const L = lcm(b, d), x = a * L / b, y = c * L / d;
      rn = op === '+' ? x + y : x - y; rd = L;
      out.push(line(`(${x} ${sym} ${y}) / ${L} = ${fs(rn, rd)}`));
    } else if (op === '*') {
      out.push(line(`${fs(a, b)} × ${fs(c, d)}`));
      out.push(el('div', { class: 'small muted' }, 'Multiply numerators together and denominators together:'));
      rn = a * c; rd = b * d;
      out.push(line(`(${a} × ${c}) / (${b} × ${d}) = ${fs(rn, rd)}`));
    } else {
      out.push(line(`${fs(a, b)} ÷ ${fs(c, d)}`));
      if (c === 0) { out.push(el('div', { class: 'small', style: { color: 'var(--danger)' } }, 'Cannot divide by zero.')); render(steps, out); render(models, model('A', a, b, color('--accent')), model('B', c, d, color('--warn'))); return; }
      out.push(el('div', { class: 'small muted' }, `Dividing by a fraction is multiplying by its reciprocal. Flip ${fs(c, d)} to ${fs(d, c)}:`));
      out.push(line(`${fs(a, b)} × ${fs(d, c)}`));
      rn = a * d; rd = b * c;
      out.push(line(`(${a} × ${d}) / (${b} × ${c}) = ${fs(rn, rd)}`));
    }
    const [sn, sd] = norm(rn, rd);
    if (fs(sn, sd) !== fs(rn, rd)) {
      const g = gcd(rn, rd);
      out.push(el('div', { class: 'small muted' }, `Simplify: the greatest common divisor of ${Math.abs(rn)} and ${Math.abs(rd)} is ${g}${rd < 0 ? ' (and move the sign to the top)' : ''}.`));
      out.push(line(`${fs(rn, rd)} = ${fs(sn, sd)}`));
    } else out.push(el('div', { class: 'small muted' }, 'Already in lowest terms.'));
    out.push(el('div', { class: 'row' },
      el('span', { class: 'big mono' }, '= ' + fs(sn, sd)),
      Math.abs(sn) >= sd && sd !== 1 && el('span', { class: 'badge' }, 'mixed: ' + mixed(sn, sd)),
      el('span', { class: 'badge' }, 'decimal: ' + (sn / sd).toFixed(6).replace(/\.?0+$/, '')),
      el('span', { class: 'badge' }, 'percent: ' + (100 * sn / sd).toFixed(3).replace(/\.?0+$/, '') + '%')));
    render(steps, out);
    const result = [];
    if (sd <= 60 && Math.abs(sn) / sd <= 6) result.push(model('Result', sn, sd, color('--ok')));
    else result.push(el('div', { class: 'muted small' }, 'Result model skipped (too many pieces to draw).'));
    render(models, model('A', a, b, color('--accent')), el('div', { class: 'huge', style: { paddingTop: '60px' } }, opSel.selectedOptions[0].textContent), model('B', c, d, color('--warn')), el('div', { class: 'huge', style: { paddingTop: '60px' } }, '='), result);
  }

  render(root,
    el('div', { class: 'row', style: { justifyContent: 'center', gap: '16px' } }, fracInput(an, ad), opSel, fracInput(bn, bd),
      el('button', { class: 'btn ghost small', onclick: () => { an.value = 1; ad.value = 2; bn.value = 1; bd.value = 3; update(); } }, 'Reset')),
    err, models,
    el('div', { class: 'muted small', style: { marginTop: '12px' } }, 'Steps'), steps);
  update();
}
