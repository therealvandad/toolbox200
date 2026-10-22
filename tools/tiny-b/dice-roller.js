import { el, render, store, stat } from '../../lib/ui.js';

const rnd = sides => {
  if (window.crypto && crypto.getRandomValues) {
    const lim = Math.floor(0x100000000 / sides) * sides, a = new Uint32Array(1);
    do crypto.getRandomValues(a); while (a[0] >= lim);
    return (a[0] % sides) + 1;
  }
  return Math.floor(Math.random() * sides) + 1;
};

/** Parse "3d6+2", "2d8+1d4-1", "4d6kh3", "d20". Returns {terms} or {error}. */
function parse(str) {
  const t = str.toLowerCase().replace(/\s+/g, '');
  if (!t) return { error: 'Enter a dice expression such as 3d6+2.' };
  if (!/^[+-]?[\dkhld+-]+$/.test(t)) return { error: 'Unrecognised characters. Try 3d6+2 or 4d6kh3.' };
  const raw = t.match(/[+-]?[^+-]+/g);
  const terms = [];
  for (const part of raw) {
    const sign = part[0] === '-' ? -1 : 1;
    const body = part.replace(/^[+-]/, '');
    let m = /^(\d*)d(\d+)(?:(kh|kl)(\d+))?$/.exec(body);
    if (m) {
      const count = m[1] === '' ? 1 : Number(m[1]), sides = Number(m[2]);
      if (count < 1 || count > 1000) return { error: 'Use between 1 and 1000 dice per term.' };
      if (sides < 2 || sides > 10000) return { error: 'Dice need between 2 and 10000 sides.' };
      const keep = m[3] ? Number(m[4]) : null;
      if (keep !== null && (keep < 1 || keep > count)) return { error: 'Keep count must be between 1 and the number of dice.' };
      terms.push({ type: 'dice', sign, count, sides, mode: m[3] || null, keep });
    } else if (/^\d+$/.test(body)) terms.push({ type: 'const', sign, value: Number(body) });
    else return { error: `Cannot read "${part}".` };
  }
  return { terms };
}
function rollTerms(terms) {
  let total = 0; const detail = [];
  for (const t of terms) {
    if (t.type === 'const') { total += t.sign * t.value; detail.push({ text: (t.sign < 0 ? '-' : '+') + t.value, const: true }); continue; }
    const rolls = Array.from({ length: t.count }, () => rnd(t.sides));
    let kept = rolls.map(() => true);
    if (t.mode) {
      const order = rolls.map((v, i) => [v, i]).sort((a, b) => t.mode === 'kh' ? b[0] - a[0] : a[0] - b[0]);
      kept = rolls.map(() => false);
      order.slice(0, t.keep).forEach(([, i]) => (kept[i] = true));
    }
    const sum = rolls.reduce((a, v, i) => a + (kept[i] ? v : 0), 0);
    total += t.sign * sum;
    detail.push({ label: `${t.sign < 0 ? '-' : ''}${t.count}d${t.sides}${t.mode ? t.mode + t.keep : ''}`, rolls, kept, sides: t.sides, sum: t.sign * sum });
  }
  return { total, detail };
}
const fmtDetail = d => d.map(x => x.const ? x.text : `${x.label}[${x.rolls.map((v, i) => x.kept[i] ? v : `(${v})`).join(', ')}]`).join(' ');

export default function (root) {
  const s = store('dice-roller');
  const notation = el('input', { class: 'input mono', type: 'text', value: s.get('notation', '3d6+2'), placeholder: '3d6+2', style: { flex: 1, minWidth: '160px', fontSize: '16px' } });
  const mode = el('select', { class: 'select' }, el('option', { value: 'normal' }, 'Normal'), el('option', { value: 'adv' }, 'Advantage'), el('option', { value: 'dis' }, 'Disadvantage'));
  mode.value = s.get('mode', 'normal');
  const count = el('input', { class: 'input', type: 'number', min: 1, max: 100, value: s.get('count', 1), style: { width: '70px' } });
  const mod = el('input', { class: 'input', type: 'number', value: s.get('mod', 0), style: { width: '70px' } });
  const resultBox = el('div', { class: 'panel center', style: { minHeight: '110px' } });
  const histBox = el('div');
  const statsBox = el('div', { class: 'row' });
  let history = s.get('history', []);

  function renderResult(r) {
    if (r.error) { render(resultBox, el('div', { style: { color: 'var(--danger)' } }, r.error)); return; }
    const chips = r.runs.map((run, i) => el('div', { class: 'panel', style: { display: 'inline-block', margin: '4px', opacity: r.used !== undefined && r.used !== i ? .5 : 1, borderColor: r.used === i ? 'var(--accent)' : '' } },
      el('div', { class: 'big' }, run.total),
      el('div', { class: 'small muted mono' }, fmtDetail(run.detail))));
    render(resultBox,
      el('div', { class: 'small muted' }, r.expr + (r.mode !== 'normal' ? (r.mode === 'adv' ? ' with advantage' : ' with disadvantage') : '')),
      chips,
      r.runs.length > 1 ? el('div', {}, el('span', { class: 'huge' }, r.total), el('div', { class: 'small muted' }, 'result')) : null);
  }
  function renderHist() {
    render(histBox, history.length ? el('table', { class: 'table' },
      el('thead', {}, el('tr', {}, el('th', {}, 'Roll'), el('th', {}, 'Detail'), el('th', {}, 'Total'))),
      el('tbody', {}, history.slice().reverse().slice(0, 50).map(h => el('tr', {}, el('td', { class: 'mono' }, h.expr + (h.mode !== 'normal' ? ' ' + h.mode : '')), el('td', { class: 'mono small muted' }, h.text), el('td', {}, el('strong', {}, h.total)))))) : el('div', { class: 'muted small' }, 'No rolls yet.'));
    const tot = history.map(h => h.total);
    render(statsBox, history.length ? [stat(history.length, 'rolls'), stat(tot.reduce((a, b) => a + b, 0), 'sum of totals'), stat((tot.reduce((a, b) => a + b, 0) / tot.length).toFixed(1), 'average'), stat(Math.max(...tot), 'highest'), stat(Math.min(...tot), 'lowest')] : null);
  }
  function roll(expr) {
    const p = parse(expr);
    if (p.error) { renderResult(p); return; }
    const m = mode.value;
    const runs = [rollTerms(p.terms)];
    let used = 0;
    if (m !== 'normal') {
      runs.push(rollTerms(p.terms));
      used = (m === 'adv') === (runs[1].total > runs[0].total) ? 1 : 0;
    }
    const chosen = runs[used];
    const r = { expr: expr.trim(), mode: m, runs, used: runs.length > 1 ? used : undefined, total: chosen.total };
    renderResult(r);
    history.push({ expr: r.expr, mode: m, total: chosen.total, text: runs.map((x, i) => (runs.length > 1 && i === used ? '* ' : '') + fmtDetail(x.detail)).join('  |  ') });
    if (history.length > 200) history = history.slice(-200);
    s.set('history', history); renderHist();
  }
  function quick(sides) {
    const c = Math.max(1, Math.min(100, parseInt(count.value) || 1)), m = parseInt(mod.value) || 0;
    notation.value = `${c}d${sides}` + (m ? (m > 0 ? '+' : '') + m : '');
    saveInputs(); roll(notation.value);
  }
  function saveInputs() { s.set('notation', notation.value); s.set('mode', mode.value); s.set('count', Number(count.value)); s.set('mod', Number(mod.value)); }

  notation.addEventListener('keydown', e => { if (e.key === 'Enter') { saveInputs(); roll(notation.value); } });
  mode.addEventListener('change', saveInputs); count.addEventListener('change', saveInputs); mod.addEventListener('change', saveInputs);

  render(root,
    el('div', { class: 'row' }, [4, 6, 8, 10, 12, 20, 100].map(n => el('button', { class: 'btn', onclick: () => quick(n) }, 'd' + n))),
    el('div', { class: 'row' },
      el('label', { class: 'inline' }, 'Dice', count), el('label', { class: 'inline' }, 'Modifier', mod), mode),
    el('div', { class: 'row' }, notation,
      el('button', { class: 'btn primary', onclick: () => { saveInputs(); roll(notation.value); } }, 'Roll')),
    el('div', { class: 'small muted' }, 'Notation: 3d6+2, d20, 2d8+1d4-1, 4d6kh3 (keep highest 3), 2d20kl1 (keep lowest 1). Advantage and disadvantage roll the whole expression twice.'),
    resultBox, statsBox,
    el('div', { class: 'row' }, el('h3', { style: { margin: 0 } }, 'History'),
      el('button', { class: 'btn small ghost', onclick: () => { history = []; s.set('history', history); renderHist(); } }, 'Clear')),
    histBox);
  render(resultBox, el('div', { class: 'muted' }, 'Press a die or Roll.'));
  renderHist();
}
