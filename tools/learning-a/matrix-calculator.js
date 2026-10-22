// Matrix calculator: editable matrices up to 6x6, exact fraction arithmetic, add/multiply/transpose/det/inverse/RREF with row operations shown.
import { el, render, store, field, toast } from '../../lib/ui.js';

// ---------- exact fractions on BigInt ----------
const babs = (x) => (x < 0n ? -x : x);
const bgcd = (a, b) => { a = babs(a); b = babs(b); while (b) [a, b] = [b, a % b]; return a || 1n; };
class F {
  constructor(n, d = 1n) { if (d === 0n) throw new Error('division by zero'); if (d < 0n) { n = -n; d = -d; } const g = bgcd(n, d); this.n = n / g; this.d = d / g; }
  static of(x) { return x instanceof F ? x : new F(BigInt(x)); }
  static parse(str) {
    str = String(str).trim().replace(/−/g, '-'); if (!str) return new F(0n);
    let m = str.match(/^([+-]?\d+)\s*\/\s*([+-]?\d+)$/); if (m) return new F(BigInt(m[1]), BigInt(m[2]));
    m = str.match(/^([+-]?)(\d*)\.?(\d*)$/); if (m && (m[2] || m[3])) { const dec = m[3] || ''; return new F(BigInt((m[1] === '-' ? '-' : '') + ((m[2] || '0') + dec)), 10n ** BigInt(dec.length)); }
    throw new Error(`"${str}" is not a number`);
  }
  add(o) { return new F(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o) { return new F(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o) { return new F(this.n * o.n, this.d * o.d); }
  div(o) { return new F(this.n * o.d, this.d * o.n); }
  neg() { return new F(-this.n, this.d); }
  isZero() { return this.n === 0n; }
  isOne() { return this.n === 1n && this.d === 1n; }
  eq(o) { return this.n === o.n && this.d === o.d; }
  toNumber() { return Number(this.n) / Number(this.d); }
  toString(decimals = false) {
    if (decimals && this.d !== 1n) { const v = this.toNumber(); return (+v.toFixed(4)).toString(); }
    return this.d === 1n ? this.n.toString() : `${this.n}/${this.d}`;
  }
}
const ZERO = new F(0n), ONE = new F(1n);
const coef = (f) => f.isOne() ? '' : f.eq(ONE.neg()) ? '−' : (f.n < 0n ? '−' : '') + new F(babs(f.n), f.d).toString() + '·';

// ---------- matrix ops ----------
const dims = (M) => [M.length, M[0] ? M[0].length : 0];
const clone = (M) => M.map(r => r.slice());
const identity = (n) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i === j ? ONE : ZERO));
function add(A, B, sign = 1) { return A.map((r, i) => r.map((v, j) => sign > 0 ? v.add(B[i][j]) : v.sub(B[i][j]))); }
function mul(A, B) { const [n, k] = dims(A), [, m] = dims(B); return Array.from({ length: n }, (_, i) => Array.from({ length: m }, (_, j) => { let s = ZERO; for (let t = 0; t < k; t++) s = s.add(A[i][t].mul(B[t][j])); return s; })); }
const transpose = (A) => dims(A)[1] ? A[0].map((_, j) => A.map(r => r[j])) : [];

/** Row reduction with recorded steps. opts: {cols: how many columns to pivot on, full: reduced (Jordan) or just echelon, aug: index where augmentation starts} */
function reduce(M, opts) {
  const A = clone(M); const steps = []; const [rows] = dims(A); const cols = opts.cols;
  let swaps = 0, pivotRow = 0; const pivots = [];
  const snap = (desc) => steps.push({ desc, m: clone(A) });
  snap('Start');
  for (let c = 0; c < cols && pivotRow < rows; c++) {
    let p = -1;
    for (let r = pivotRow; r < rows; r++) if (!A[r][c].isZero()) { p = r; break; }
    if (p < 0) continue;
    if (p !== pivotRow) { [A[p], A[pivotRow]] = [A[pivotRow], A[p]]; swaps++; snap(`Swap R${p + 1} ↔ R${pivotRow + 1}${opts.det ? ' (determinant changes sign)' : ''}`); }
    const pv = A[pivotRow][c];
    if (opts.full && !pv.isOne()) { A[pivotRow] = A[pivotRow].map(v => v.div(pv)); snap(`R${pivotRow + 1} ← R${pivotRow + 1} ÷ (${pv})`); }
    const piv = A[pivotRow][c];
    const start = opts.full ? 0 : pivotRow + 1;
    for (let r = start; r < rows; r++) {
      if (r === pivotRow || A[r][c].isZero()) continue;
      const f = A[r][c].div(piv);
      A[r] = A[r].map((v, j) => v.sub(f.mul(A[pivotRow][j])));
      snap(`R${r + 1} ← R${r + 1} − (${f})·R${pivotRow + 1}`);
    }
    pivots.push([pivotRow, c]); pivotRow++;
  }
  return { A, steps, swaps, pivots };
}
function determinant(M) {
  const { A, steps, swaps } = reduce(M, { cols: M.length, full: false, det: true });
  let det = ONE; const diag = []; for (let i = 0; i < M.length; i++) { det = det.mul(A[i][i]); diag.push(A[i][i].toString()); }
  if (swaps % 2) det = det.neg();
  steps.push({ desc: `Upper triangular. det = ${swaps % 2 ? '−' : ''}(${diag.join(' × ')}) = ${det}`, m: null });
  return { det, steps };
}
function inverse(M) {
  const n = M.length; const aug = M.map((r, i) => r.concat(identity(n)[i]));
  const { A, steps, pivots } = reduce(aug, { cols: n, full: true });
  if (pivots.length < n) return { inv: null, steps };
  return { inv: A.map(r => r.slice(n)), steps };
}

export default function (root) {
  const s = store('matrix-calculator');
  const saved = s.get('m', { A: { r: 2, c: 2, v: [['2', '1'], ['5', '3']] }, B: { r: 2, c: 2, v: [['1', '2'], ['3', '4']] } });
  let decimals = s.get('dec', false);
  const mats = { A: saved.A, B: saved.B };

  function save() { s.set('m', mats); s.set('dec', decimals); }

  const grids = {};
  function buildEditor(name) {
    const m = mats[name];
    const rowsSel = el('select', { class: 'select small', onchange: () => { m.r = +rowsSel.value; fixSize(m); drawGrid(name); save(); } }, [1, 2, 3, 4, 5, 6].map(n => el('option', { value: n, selected: n === m.r }, n)));
    const colsSel = el('select', { class: 'select small', onchange: () => { m.c = +colsSel.value; fixSize(m); drawGrid(name); save(); } }, [1, 2, 3, 4, 5, 6].map(n => el('option', { value: n, selected: n === m.c }, n)));
    const grid = el('div', { style: { display: 'inline-grid', gap: '4px' } });
    grids[name] = grid;
    const fill = (fn) => { m.v = Array.from({ length: m.r }, (_, i) => Array.from({ length: m.c }, (_, j) => fn(i, j))); drawGrid(name); save(); };
    return el('div', { class: 'panel col', style: { alignItems: 'flex-start' } },
      el('div', { class: 'row', style: { margin: 0 } }, el('b', {}, name), el('span', { class: 'muted small' }, 'rows'), rowsSel, el('span', { class: 'muted small' }, 'cols'), colsSel),
      el('div', { class: 'scroll-x', style: { maxWidth: '100%' } }, grid),
      el('div', { class: 'row', style: { margin: 0 } },
        el('button', { class: 'btn small ghost', onclick: () => fill((i, j) => i === j ? '1' : '0') }, 'Identity'),
        el('button', { class: 'btn small ghost', onclick: () => fill(() => String(Math.floor(Math.random() * 19) - 9)) }, 'Random'),
        el('button', { class: 'btn small ghost', onclick: () => fill(() => '0') }, 'Zero')));
  }
  function fixSize(m) { m.v = Array.from({ length: m.r }, (_, i) => Array.from({ length: m.c }, (_, j) => (m.v[i] && m.v[i][j] != null) ? m.v[i][j] : '0')); }
  function drawGrid(name) {
    const m = mats[name]; fixSize(m);
    const grid = grids[name]; grid.style.gridTemplateColumns = `repeat(${m.c}, 64px)`;
    render(grid, m.v.flatMap((row, i) => row.map((v, j) => {
      const inp = el('input', { class: 'input mono', value: v, style: { width: '64px', textAlign: 'center', padding: '6px 4px' }, oninput: () => { m.v[i][j] = inp.value; save(); } });
      inp.addEventListener('keydown', e => {
        const d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], Enter: [1, 0] }[e.key]; if (!d) return;
        const t = grid.children[(i + d[0] + m.r) % m.r * m.c + j]; if (t) { t.focus(); t.select(); e.preventDefault(); }
      });
      return inp;
    })));
  }
  function read(name) {
    const m = mats[name];
    return m.v.map((row, i) => row.map((v, j) => { try { return F.parse(v); } catch { throw new Error(`${name}[${i + 1},${j + 1}]: "${v}" is not a number`); } }));
  }

  // ----- output -----
  const out = el('div', { class: 'col' });
  function matTable(M, augAt = -1, highlight = null) {
    if (!M.length) return el('span', { class: 'muted' }, '(empty)');
    return el('table', { class: 'mono', style: { borderCollapse: 'collapse', borderLeft: '2px solid var(--text)', borderRight: '2px solid var(--text)', borderRadius: '6px', display: 'inline-table' } },
      M.map((row, i) => el('tr', {}, row.map((v, j) => el('td', { style: { padding: '3px 10px', textAlign: 'center', borderLeft: j === augAt ? '1px dashed var(--muted)' : 'none', background: highlight && highlight(i, j) ? 'color-mix(in srgb, var(--accent) 20%, transparent)' : 'transparent' } }, v.toString(decimals))))));
  }
  function showSteps(steps, augAt = -1) {
    return el('details', { open: true }, el('summary', { class: 'muted small', style: { cursor: 'pointer' } }, `${steps.length} steps`),
      el('div', { class: 'col', style: { marginTop: '6px' } }, steps.map((st, i) => el('div', { class: 'row', style: { alignItems: 'flex-start', margin: 0 } },
        el('span', { class: 'badge', style: { minWidth: '28px', textAlign: 'center' } }, i + 1), el('span', { class: 'small', style: { minWidth: '180px' } }, st.desc), st.m && matTable(st.m, augAt)))));
  }
  function show(title, ...body) { render(out, el('div', { class: 'panel col' }, el('b', {}, title), ...body)); }
  function run(fn) { try { fn(); } catch (e) { show('Error', el('span', { style: { color: 'var(--danger)' } }, e.message)); } }

  const ops = [
    ['A + B', () => { const A = read('A'), B = read('B'); if (dims(A).join() !== dims(B).join()) throw new Error('A and B must have the same size'); show('A + B', matTable(add(A, B))); }],
    ['A − B', () => { const A = read('A'), B = read('B'); if (dims(A).join() !== dims(B).join()) throw new Error('A and B must have the same size'); show('A − B', matTable(add(A, B, -1))); }],
    ['A × B', () => { const A = read('A'), B = read('B'); if (dims(A)[1] !== dims(B)[0]) throw new Error(`columns of A (${dims(A)[1]}) must equal rows of B (${dims(B)[0]})`);
      const P = mul(A, B); const [n, k] = dims(A);
      const detail = el('div', { class: 'small muted' }, `Each entry (i,j) is the dot product of row i of A with column j of B, e.g. (1,1) = ${Array.from({ length: k }, (_, t) => `${A[0][t]}×${B[t][0]}`).join(' + ')} = ${P[0][0]}`);
      show('A × B', matTable(P), detail); }],
    ['B × A', () => { const A = read('A'), B = read('B'); if (dims(B)[1] !== dims(A)[0]) throw new Error(`columns of B (${dims(B)[1]}) must equal rows of A (${dims(A)[0]})`); show('B × A', matTable(mul(B, A))); }],
    ['Aᵀ', () => show('Transpose of A', matTable(transpose(read('A'))))],
    ['Bᵀ', () => show('Transpose of B', matTable(transpose(read('B'))))],
    ['det A', () => { const A = read('A'); if (dims(A)[0] !== dims(A)[1]) throw new Error('A must be square'); const { det, steps } = determinant(A); show('det(A) = ' + det.toString(decimals), el('div', { class: 'small muted' }, 'Reduce to upper triangular form by row operations; the determinant is the product of the diagonal, with a sign flip for each row swap.'), showSteps(steps)); }],
    ['det B', () => { const B = read('B'); if (dims(B)[0] !== dims(B)[1]) throw new Error('B must be square'); const { det, steps } = determinant(B); show('det(B) = ' + det.toString(decimals), showSteps(steps)); }],
    ['A⁻¹', () => { const A = read('A'); if (dims(A)[0] !== dims(A)[1]) throw new Error('A must be square'); const { inv, steps } = inverse(A);
      show('Inverse of A', inv ? matTable(inv) : el('span', { style: { color: 'var(--danger)' } }, 'A is singular (not invertible): a row reduced to zero.'),
        el('div', { class: 'small muted' }, 'Gauss–Jordan: row-reduce [A | I] until the left side is the identity; the right side is then A⁻¹.'), showSteps(steps, A.length)); }],
    ['B⁻¹', () => { const B = read('B'); if (dims(B)[0] !== dims(B)[1]) throw new Error('B must be square'); const { inv, steps } = inverse(B); show('Inverse of B', inv ? matTable(inv) : el('span', { style: { color: 'var(--danger)' } }, 'B is singular (not invertible).'), showSteps(steps, B.length)); }],
    ['RREF A', () => { const A = read('A'); const { A: R, steps, pivots } = reduce(A, { cols: dims(A)[1], full: true }); const pset = new Set(pivots.map(p => p.join(','))); show('Reduced row echelon form of A', matTable(R, -1, (i, j) => pset.has(i + ',' + j)), el('div', { class: 'small muted' }, `rank = ${pivots.length}; pivot columns: ${pivots.map(p => p[1] + 1).join(', ') || 'none'}`), showSteps(steps)); }],
    ['RREF B', () => { const B = read('B'); const { A: R, steps, pivots } = reduce(B, { cols: dims(B)[1], full: true }); const pset = new Set(pivots.map(p => p.join(','))); show('Reduced row echelon form of B', matTable(R, -1, (i, j) => pset.has(i + ',' + j)), el('div', { class: 'small muted' }, `rank = ${pivots.length}`), showSteps(steps)); }],
    ['Solve A·x = B', () => { const A = read('A'), B = read('B'); if (dims(A)[0] !== dims(B)[0]) throw new Error('A and B need the same number of rows (B is the right-hand side)');
      const n = dims(A)[1]; const aug = A.map((r, i) => r.concat(B[i])); const { A: R, steps, pivots } = reduce(aug, { cols: n, full: true });
      const inconsistent = R.some(r => r.slice(0, n).every(v => v.isZero()) && r.slice(n).some(v => !v.isZero()));
      let verdict;
      if (inconsistent) verdict = el('span', { style: { color: 'var(--danger)' } }, 'No solution: a row reads 0 = non-zero.');
      else if (pivots.length < n) verdict = el('span', {}, `Infinitely many solutions (${n - pivots.length} free variable${n - pivots.length > 1 ? 's' : ''}): columns ${Array.from({ length: n }, (_, j) => j + 1).filter(j => !pivots.some(p => p[1] === j - 1)).join(', ')}.`);
      else verdict = el('div', { class: 'row' }, el('span', {}, 'x ='), matTable(R.slice(0, n).map(r => r.slice(n))));
      show('Solve A·x = B (augmented [A | B])', verdict, showSteps(steps, n)); }],
  ];

  const decBtn = el('label', { class: 'inline small' }, el('input', { type: 'checkbox', checked: decimals, onchange: e => { decimals = e.target.checked; save(); toast(decimals ? 'Showing decimals' : 'Showing exact fractions'); } }), 'show decimals');
  render(root,
    el('div', { class: 'muted small' }, 'Entries may be integers, decimals or fractions like 3/4. All arithmetic is exact.'),
    el('div', { class: 'row', style: { alignItems: 'flex-start' } }, buildEditor('A'), buildEditor('B')),
    field('Operation', el('div', { class: 'row', style: { margin: 0 } }, ops.map(([label, fn]) => el('button', { class: 'btn small', onclick: () => run(fn) }, label)), decBtn)),
    out);
  drawGrid('A'); drawGrid('B');
  run(ops[0][1]);
}
