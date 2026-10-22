import { el, render, store, copy } from '../../lib/ui.js';

const SYM = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
const VAL = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
const STRICT = /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;

function toRoman(n) {
  const parts = [];
  for (const [v, s] of SYM) while (n >= v) { parts.push([s, v]); n -= v; }
  return parts;
}
function looseParse(s) {
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const a = VAL[s[i]], b = VAL[s[i + 1]] || 0;
    total += a < b ? -a : a;
  }
  return total;
}

export default function (root) {
  const s = store('roman-numerals');
  const num = el('input', { class: 'input', type: 'text', inputmode: 'numeric', placeholder: '1994', style: { width: '100%', fontSize: '20px' } });
  const rom = el('input', { class: 'input mono', type: 'text', placeholder: 'MCMXCIV', style: { width: '100%', fontSize: '20px' }, autocapitalize: 'characters' });
  const msg = el('div', { class: 'small muted' });
  const breakdown = el('div');
  num.value = s.get('num', '1994');

  function showBreakdown(n) {
    const parts = toRoman(n);
    const chips = parts.map(([sym, v]) => el('span', { class: 'panel mono', style: { padding: '6px 10px', textAlign: 'center' } },
      el('div', { style: { fontWeight: '700', fontSize: '18px' } }, sym), el('div', { class: 'small muted' }, v)));
    render(breakdown,
      el('div', { class: 'row' }, chips),
      el('div', { class: 'small muted' }, parts.map(p => p[1]).join(' + ') + ' = ' + n));
  }
  function setMsg(text, bad) { msg.textContent = text; msg.style.color = bad ? 'var(--danger)' : ''; }

  function fromNumber() {
    const t = num.value.replace(/[\s,_]/g, '');
    s.set('num', num.value);
    if (!t) { rom.value = ''; setMsg('Enter a number from 1 to 3999.'); render(breakdown); return; }
    if (!/^\d+$/.test(t)) { setMsg('Only whole numbers are allowed.', true); render(breakdown); return; }
    const n = Number(t);
    if (n < 1 || n > 3999) { rom.value = ''; setMsg('Standard Roman numerals cover 1 to 3999 (there is no zero).', true); render(breakdown); return; }
    setMsg('Valid.');
    rom.value = toRoman(n).map(p => p[0]).join('');
    showBreakdown(n);
  }

  function fromRoman() {
    const t = rom.value.replace(/\s/g, '').toUpperCase();
    if (!t) { num.value = ''; setMsg('Enter a Roman numeral such as MCMXCIV.'); render(breakdown); return; }
    if (!/^[IVXLCDM]+$/.test(t)) {
      const bad = [...new Set(t.replace(/[IVXLCDM]/g, ''))].join(' ');
      num.value = ''; setMsg('Invalid characters: ' + bad + '. Use only I V X L C D M.', true); render(breakdown); return;
    }
    const n = looseParse(t);
    if (!STRICT.test(t)) {
      num.value = '';
      setMsg(n >= 1 && n <= 3999
        ? 'Not a standard numeral. It reads loosely as ' + n + '; the standard form is ' + toRoman(n).map(p => p[0]).join('') + '.'
        : 'Not a valid Roman numeral.', true);
      render(breakdown); return;
    }
    num.value = String(n); s.set('num', num.value);
    setMsg('Valid.');
    showBreakdown(n);
  }

  num.addEventListener('input', fromNumber);
  rom.addEventListener('input', fromRoman);
  num.addEventListener('keydown', e => { if (e.key === 'Escape') { num.value = ''; fromNumber(); } });
  rom.addEventListener('keydown', e => { if (e.key === 'Escape') { rom.value = ''; fromRoman(); } });

  const syms = SYM.slice().reverse();
  const ref = el('div', { class: 'scroll-x' }, el('table', { class: 'table mono' },
    el('thead', {}, el('tr', {}, ...syms.map(([, sy]) => el('th', {}, sy)))),
    el('tbody', {}, el('tr', {}, ...syms.map(([v]) => el('td', {}, v))))));

  render(root,
    el('div', { class: 'grid2' },
      el('label', { class: 'field' }, 'Number (1 to 3999)', num),
      el('label', { class: 'field' }, 'Roman numeral', rom)),
    el('div', { class: 'row' },
      el('button', { class: 'btn primary', onclick: () => rom.value && copy(rom.value) }, 'Copy numeral'),
      el('button', { class: 'btn', onclick: () => num.value && copy(num.value) }, 'Copy number'),
      el('button', { class: 'btn ghost', onclick: () => { num.value = String(Math.min(3999, new Date().getFullYear())); fromNumber(); } }, 'This year')),
    msg,
    el('h3', {}, 'Breakdown'), breakdown,
    el('h3', {}, 'Symbols'), ref);
  fromNumber();
}
