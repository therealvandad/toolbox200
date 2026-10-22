import { el, render, store, stat } from '../../lib/ui.js';

const TIPS = [0, 10, 15, 18, 20, 25];
const money = n => (Number.isFinite(n) ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00');

export default function (root) {
  const s = store('tip-splitter');
  const st = Object.assign({ bill: '', tip: 18, people: 2, roundUp: false }, s.get('state', {}));

  const bill = el('input', { class: 'input', type: 'number', min: 0, step: '0.01', placeholder: '0.00', value: st.bill });
  const tipIn = el('input', { class: 'input', type: 'number', min: 0, step: '0.5', value: st.tip, style: { width: '90px' } });
  const people = el('input', { class: 'input', type: 'number', min: 1, step: 1, value: st.people, style: { width: '90px' } });
  const round = el('input', { type: 'checkbox', checked: st.roundUp });
  const tipBtns = el('div', { class: 'row' });
  const out = el('div', { class: 'col' });

  function calc() {
    st.bill = bill.value;
    const b = Math.max(0, parseFloat(bill.value) || 0);
    const t = Math.max(0, parseFloat(tipIn.value) || 0);
    const n = Math.max(1, Math.floor(parseFloat(people.value) || 1));
    st.tip = t; st.people = n; st.roundUp = round.checked;
    const tip = b * t / 100;
    const total = b + tip;
    let per = total / n;
    let perTotal = total;
    let extra = 0;
    if (st.roundUp) { per = Math.ceil(per - 1e-9); perTotal = per * n; extra = perTotal - total; }
    const finalTip = tip + extra;
    render(tipBtns, TIPS.map(p => el('button', { class: 'btn small' + (t === p ? ' primary' : ''), onclick: () => { tipIn.value = p; calc(); } }, p + '%')));
    render(out,
      el('div', { class: 'row' }, stat(money(per), 'per person'), stat(money(finalTip), 'tip total'), stat(money(perTotal), 'grand total')),
      el('div', { class: 'panel' },
        el('div', { class: 'small' }, `Bill ${money(b)} + tip ${money(tip)} (${t}%) = ${money(total)}`),
        st.roundUp ? el('div', { class: 'small' }, `Rounded up to whole amounts per person: extra ${money(extra)} goes to the tip (effective tip ${b ? (finalTip / b * 100).toFixed(1) : '0.0'}%).`) : null,
        n > 1 ? el('div', { class: 'small muted' }, `Tip per person: ${money(finalTip / n)}`) : null));
    s.set('state', st);
  }
  [bill, tipIn, people].forEach(i => i.addEventListener('input', calc));
  round.addEventListener('change', calc);

  const step = d => { people.value = Math.max(1, (parseInt(people.value, 10) || 1) + d); calc(); };
  render(root,
    el('div', { class: 'row' }, el('label', { class: 'field' }, 'Bill amount', bill)),
    el('div', { class: 'row' }, el('span', { class: 'small muted' }, 'Tip'), tipBtns, el('label', { class: 'field' }, 'Custom %', tipIn)),
    el('div', { class: 'row' },
      el('label', { class: 'field' }, 'People', people),
      el('button', { class: 'btn', style: { alignSelf: 'flex-end' }, onclick: () => step(-1) }, '-'),
      el('button', { class: 'btn', style: { alignSelf: 'flex-end' }, onclick: () => step(1) }, '+'),
      el('label', { class: 'inline', style: { alignSelf: 'flex-end' } }, round, 'Round up each share')),
    out);
  calc();
}
