import { el, render, store, copy } from '../../lib/ui.js';

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const SCALES = ['', 'thousand', 'million', 'billion', 'trillion'];
const MAX = 10n ** 15n; // exclusive: up to 999 trillion

function under100(n) {
  if (n < 20) return ONES[n];
  const t = TENS[Math.floor(n / 10)], o = n % 10;
  return o ? t + '-' + ONES[o] : t;
}
function under1000(n, brit) {
  const h = Math.floor(n / 100), r = n % 100;
  const parts = [];
  if (h) parts.push(ONES[h] + ' hundred');
  if (r) parts.push((h && brit ? 'and ' : '') + under100(r));
  return parts.join(' ');
}
function words(n, brit) {
  if (n === 0n) return 'zero';
  const groups = [];
  let x = n;
  while (x > 0n) { groups.push(Number(x % 1000n)); x /= 1000n; }
  const out = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (!g) continue;
    let w = under1000(g, brit);
    // British: "one thousand and five", "two million and ninety"
    if (brit && i === 0 && groups.length > 1 && g < 100) w = 'and ' + w;
    out.push(w + (SCALES[i] ? ' ' + SCALES[i] : ''));
  }
  return out.join(' ');
}
function parseAmount(str) {
  const t = str.trim().replace(/[,\s_]/g, '').replace(/^[$£€¥]/, '');
  if (!t) return { empty: true };
  const m = /^(\d*)(?:\.(\d*))?$/.exec(t);
  if (!m || (!m[1] && !m[2])) return { error: 'Enter a positive amount such as 1234.56.' };
  const int = BigInt(m[1] || '0');
  const frac = ((m[2] || '') + '000').slice(0, 3);
  let cents = int * 100n + BigInt(frac.slice(0, 2)) + (frac[2] >= '5' ? 1n : 0n);
  const dollars = cents / 100n;
  if (dollars >= MAX) return { error: 'Amounts up to 999 trillion are supported.' };
  return { dollars, cents: Number(cents % 100n), rounded: (m[2] || '').length > 2 };
}
const cap = (t, mode) => mode === 'upper' ? t.toUpperCase()
  : mode === 'title' ? t.replace(/(^|[\s-])([a-z])/g, (_, a, b) => a + b.toUpperCase())
    : t.charAt(0).toUpperCase() + t.slice(1);

const PRESETS = {
  USD: ['dollar', 'dollars', 'cent', 'cents'],
  GBP: ['pound', 'pounds', 'penny', 'pence'],
  EUR: ['euro', 'euros', 'cent', 'cents'],
  CAD: ['dollar', 'dollars', 'cent', 'cents'],
  AUD: ['dollar', 'dollars', 'cent', 'cents'],
  INR: ['rupee', 'rupees', 'paisa', 'paise'],
  none: ['', '', '', ''],
  custom: null,
};

export default function (root) {
  const s = store('number-to-words');
  const amount = el('input', { class: 'input mono', type: 'text', inputmode: 'decimal', placeholder: '1234.56', value: s.get('amount', '1234.56'), style: { width: '100%', fontSize: '18px' } });
  const style = el('select', { class: 'select' }, el('option', { value: 'us' }, 'American (no "and")'), el('option', { value: 'uk' }, 'British ("and")'));
  const preset = el('select', { class: 'select' }, Object.keys(PRESETS).map(k => el('option', { value: k }, k === 'none' ? 'No currency' : k === 'custom' ? 'Custom' : k)));
  const names = [0, 1, 2, 3].map(() => el('input', { class: 'input', type: 'text', style: { width: '100%' } }));
  const centsMode = el('select', { class: 'select' },
    el('option', { value: 'words' }, 'Cents in words'), el('option', { value: 'fraction' }, 'Cents as 56/100'), el('option', { value: 'digits' }, 'Cents in digits'));
  const capMode = el('select', { class: 'select' },
    el('option', { value: 'sentence' }, 'Sentence case'), el('option', { value: 'title' }, 'Title Case'), el('option', { value: 'upper' }, 'UPPER CASE'));
  const onlyCb = el('input', { type: 'checkbox', checked: s.get('only', false) });
  const zeroCb = el('input', { type: 'checkbox', checked: s.get('zero', true) });
  const out = el('div', { class: 'panel', style: { fontSize: '20px', minHeight: '3em', lineHeight: '1.4' } });
  const note = el('div', { class: 'small muted' });

  style.value = s.get('style', 'us'); preset.value = s.get('preset', 'USD');
  centsMode.value = s.get('centsMode', 'words'); capMode.value = s.get('capMode', 'sentence');
  const savedNames = s.get('names', null);
  const applyPreset = () => { const p = PRESETS[preset.value]; if (p) names.forEach((n, i) => (n.value = p[i])); };
  if (preset.value === 'custom' && savedNames) names.forEach((n, i) => (n.value = savedNames[i] || '')); else applyPreset();

  function update() {
    s.set('amount', amount.value); s.set('style', style.value); s.set('preset', preset.value);
    s.set('centsMode', centsMode.value); s.set('capMode', capMode.value); s.set('only', onlyCb.checked); s.set('zero', zeroCb.checked);
    s.set('names', names.map(n => n.value));
    const r = parseAmount(amount.value);
    note.textContent = '';
    if (r.empty) { out.textContent = ''; return; }
    if (r.error) { out.textContent = r.error; out.style.color = 'var(--danger)'; return; }
    out.style.color = '';
    const brit = style.value === 'uk';
    const [mS, mP, cS, cP] = names.map(n => n.value.trim());
    let txt = words(r.dollars, brit);
    if (mS || mP) txt += ' ' + (r.dollars === 1n ? mS || mP : mP || mS);
    const showCents = r.cents > 0 || (zeroCb.checked && centsMode.value !== 'words');
    if (showCents) {
      let c;
      if (centsMode.value === 'words') c = words(BigInt(r.cents), brit) + ((cS || cP) ? ' ' + (r.cents === 1 ? cS || cP : cP || cS) : '');
      else if (centsMode.value === 'fraction') c = String(r.cents).padStart(2, '0') + '/100';
      else c = String(r.cents).padStart(2, '0') + ((cS || cP) ? ' ' + (r.cents === 1 ? cS || cP : cP || cS) : '');
      txt += ' and ' + c;
    }
    if (onlyCb.checked) txt += ' only';
    out.textContent = cap(txt, capMode.value);
    if (r.rounded) note.textContent = 'Amount was rounded to the nearest cent.';
  }
  [amount, style, centsMode, capMode, onlyCb, zeroCb, ...names].forEach(c => c.addEventListener(c.tagName === 'SELECT' || c.type === 'checkbox' ? 'change' : 'input', update));
  names.forEach(n => n.addEventListener('input', () => { preset.value = 'custom'; update(); }));
  preset.addEventListener('change', () => { applyPreset(); update(); });
  amount.addEventListener('keydown', e => { if (e.key === 'Escape') { amount.value = ''; update(); } });

  render(root,
    el('label', { class: 'field' }, 'Amount', amount),
    el('div', { class: 'row' },
      el('label', { class: 'field' }, 'English style', style),
      el('label', { class: 'field' }, 'Currency', preset),
      el('label', { class: 'field' }, 'Cents', centsMode),
      el('label', { class: 'field' }, 'Capitalisation', capMode)),
    el('div', { class: 'grid2' },
      el('label', { class: 'field' }, 'Major unit (singular)', names[0]),
      el('label', { class: 'field' }, 'Major unit (plural)', names[1]),
      el('label', { class: 'field' }, 'Minor unit (singular)', names[2]),
      el('label', { class: 'field' }, 'Minor unit (plural)', names[3])),
    el('div', { class: 'row' },
      el('label', { class: 'inline' }, onlyCb, 'Add "only"'),
      el('label', { class: 'inline' }, zeroCb, 'Always show 00 cents for fraction/digits')),
    out, note,
    el('div', { class: 'row' },
      el('button', { class: 'btn primary', onclick: () => out.textContent && copy(out.textContent) }, 'Copy')));
  update();
}
