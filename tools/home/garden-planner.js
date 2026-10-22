import { el, render, store, uid, today } from '../../lib/ui.js';
import { pd, iso, addDays, exportBar, input, sel } from './_h.js';

// Windows are in weeks relative to the last spring frost (negative = before).
// [name, kind, indoor, sow, transplant, daysToMaturity, harvestSpanDays]
const VEG = [
  ['Tomato', 'warm', [-8, -6], null, [1, 3], 70, 60], ['Pepper', 'warm', [-10, -8], null, [2, 4], 70, 50], ['Eggplant', 'warm', [-10, -8], null, [2, 4], 75, 45],
  ['Cucumber', 'warm', [-4, -3], [1, 3], [1, 3], 55, 40], ['Zucchini', 'warm', [-3, -2], [1, 4], null, 50, 50], ['Pumpkin', 'warm', null, [1, 3], null, 100, 20],
  ['Winter squash', 'warm', null, [1, 3], null, 90, 20], ['Melon', 'warm', [-4, -3], [2, 3], [2, 3], 85, 25], ['Bush beans', 'warm', null, [1, 10], null, 55, 25],
  ['Pole beans', 'warm', null, [1, 8], null, 65, 35], ['Sweet corn', 'warm', null, [0, 8], null, 75, 14], ['Okra', 'warm', null, [2, 6], null, 55, 60],
  ['Sweet potato', 'warm', null, null, [2, 4], 100, 21], ['Basil', 'warm', [-6, -4], null, [1, 3], 30, 80],
  ['Lettuce', 'cool', [-6, -4], [-4, 6], [-2, 2], 50, 30], ['Spinach', 'cool', null, [-6, -2], null, 40, 21], ['Kale', 'cool', [-6, -4], [-4, 0], [-3, 0], 55, 60],
  ['Broccoli', 'cool', [-8, -6], null, [-3, 0], 65, 21], ['Cauliflower', 'cool', [-8, -6], null, [-2, 0], 70, 14], ['Cabbage', 'cool', [-8, -6], null, [-3, 0], 70, 21],
  ['Brussels sprouts', 'cool', [-10, -8], null, [-2, 2], 100, 40], ['Carrot', 'cool', null, [-4, 4], null, 70, 30], ['Beet', 'cool', null, [-4, 6], null, 55, 30],
  ['Radish', 'cool', null, [-4, 8], null, 28, 14], ['Turnip', 'cool', null, [-4, 2], null, 50, 21], ['Peas', 'cool', null, [-6, -2], null, 65, 21],
  ['Onion', 'cool', [-12, -10], null, [-4, -2], 100, 21], ['Leek', 'cool', [-12, -10], null, [-2, 0], 100, 40], ['Potato', 'cool', null, [-4, 0], null, 90, 21],
  ['Swiss chard', 'cool', null, [-3, 6], null, 55, 70], ['Arugula', 'cool', null, [-4, 8], null, 30, 21], ['Cilantro', 'cool', null, [-2, 6], null, 45, 20],
  ['Parsley', 'cool', [-10, -8], null, [-2, 0], 70, 90], ['Dill', 'cool', null, [-2, 6], null, 45, 30],
];
// zone -> [last spring frost MM-DD, first fall frost MM-DD] (rough averages)
const ZONES = {
  3: ['05-15', '09-10'], 4: ['05-10', '09-20'], 5: ['04-30', '10-10'], 6: ['04-15', '10-20'],
  7: ['04-05', '10-28'], 8: ['03-20', '11-10'], 9: ['02-25', '12-01'], 10: ['01-30', '12-20'],
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const KIND = { I: ['Sow indoors', '#8e5bd9'], S: ['Sow outdoors', '#1f9d55'], T: ['Transplant', '#d98c0b'], H: ['Harvest', '#d64545'] };
const md = d => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export default function (root) {
  const s = store('garden-planner');
  const yr = new Date().getFullYear();
  const D = Object.assign({ zone: '6', last: `${yr}-${ZONES[6][0]}`, first: `${yr}-${ZONES[6][1]}`, mine: [], onlyMine: false }, s.get('d', {}));
  const save = () => s.set('d', D);
  const out = el('div');

  const zoneSel = sel([['', 'Custom dates'], ...Object.keys(ZONES).map(z => [z, 'Zone ' + z])], D.zone, {
    onchange: () => {
      D.zone = zoneSel.value;
      if (D.zone) { const y = new Date().getFullYear(); D.last = `${y}-${ZONES[D.zone][0]}`; D.first = `${y}-${ZONES[D.zone][1]}`; lastIn.value = D.last; firstIn.value = D.first; }
      save(); draw();
    },
  });
  const lastIn = input({ type: 'date', value: D.last, onchange: () => { D.last = lastIn.value; D.zone = ''; zoneSel.value = ''; save(); draw(); } });
  const firstIn = input({ type: 'date', value: D.first, onchange: () => { D.first = firstIn.value; D.zone = ''; zoneSel.value = ''; save(); draw(); } });
  const onlyChk = el('input', { type: 'checkbox', checked: D.onlyMine, onchange: () => { D.onlyMine = onlyChk.checked; save(); draw(); } });

  function windows(v, LF, FF) {
    const [, kind, indoor, sow, trans, dtm, span] = v;
    const rng = w => w ? [addDays(LF, w[0] * 7), addDays(LF, w[1] * 7)] : null;
    const base = rng(trans) || rng(sow);
    let harvest = null;
    if (base) {
      const cap = addDays(FF, kind === 'cool' ? 21 : 0);
      const hs = addDays(base[0], dtm), he0 = addDays(base[1], dtm + span);
      const he = he0 > cap ? cap : he0;
      if (hs <= he) harvest = [hs, he];
    }
    return { I: rng(indoor), S: rng(sow), T: rng(trans), H: harvest };
  }
  const overlap = (w, y, m) => w && w[0] <= new Date(y, m + 1, 0) && w[1] >= new Date(y, m, 1);

  function draw() {
    const LF = pd(D.last), FF = pd(D.first);
    if (!LF || !FF) { render(out, el('div', { class: 'empty' }, 'Pick your last spring frost date and first fall frost date.')); return; }
    const y = LF.getFullYear();
    const all = VEG.map(v => ({ v, w: windows(v, LF, FF) }));
    const shown = all.filter(x => !D.onlyMine || D.mine.includes(x.v[0]));
    const nowM = new Date().getMonth();
    const todo = { I: [], S: [], T: [], H: [] };
    all.forEach(x => { if (D.mine.includes(x.v[0]) || !D.mine.length) for (const k of 'ISTH') if (overlap(x.w[k], y, nowM)) todo[k].push(x.v[0]); });
    const mine = all.filter(x => D.mine.includes(x.v[0]));
    render(out,
      el('div', { class: 'panel' }, el('b', {}, `This month (${MONTHS[nowM]})`), ' ', el('span', { class: 'small muted' }, D.mine.length ? 'for your plant list' : 'all vegetables (pick plants to narrow this down)'),
        el('div', { class: 'col', style: { marginTop: '6px' } }, 'ISTH'.split('').map(k => el('div', { class: 'small' }, el('span', { class: 'badge', style: { background: KIND[k][1], color: '#fff', borderColor: KIND[k][1] } }, KIND[k][0]), ' ', todo[k].length ? todo[k].join(', ') : el('span', { class: 'muted' }, 'nothing'))))),
      el('h3', {}, 'Calendar'),
      el('div', { class: 'row small' }, 'ISTH'.split('').map(k => el('span', { class: 'badge', style: { background: KIND[k][1], color: '#fff', borderColor: KIND[k][1] } }, k + ' = ' + KIND[k][0])),
        el('label', { class: 'inline' }, onlyChk, 'Show only my list')),
      el('div', { class: 'scroll-x' }, el('table', { class: 'table', style: { minWidth: '720px' } },
        el('thead', {}, el('tr', {}, el('th', {}, 'Mine'), el('th', {}, 'Plant'), MONTHS.map(m => el('th', { style: { textAlign: 'center', padding: '6px 2px' } }, m)))),
        el('tbody', {}, shown.map(x => el('tr', {},
          el('td', {}, el('input', { type: 'checkbox', checked: D.mine.includes(x.v[0]), onchange: e => { D.mine = e.target.checked ? [...D.mine, x.v[0]] : D.mine.filter(n => n !== x.v[0]); save(); draw(); } })),
          el('td', {}, x.v[0]),
          MONTHS.map((_, m) => el('td', { style: { padding: '3px 1px', textAlign: 'center', outline: m === nowM ? '1px solid var(--accent)' : 'none' } },
            el('div', { style: { display: 'flex', gap: '1px', justifyContent: 'center', flexWrap: 'wrap' } },
              'ISTH'.split('').filter(k => overlap(x.w[k], y, m)).map(k => el('span', { title: KIND[k][0], style: { background: KIND[k][1], color: '#fff', fontSize: '10px', fontWeight: '700', borderRadius: '3px', padding: '0 4px', lineHeight: '15px' } }, k)))))))))),
      el('h3', {}, 'Your plant list'),
      mine.length ? el('div', { class: 'scroll-x' }, el('table', { class: 'table' },
        el('thead', {}, el('tr', {}, ['Plant', 'Sow indoors', 'Sow outdoors', 'Transplant', 'Harvest'].map(h => el('th', {}, h)))),
        el('tbody', {}, mine.map(x => el('tr', {}, el('td', {}, el('b', {}, x.v[0])),
          'ISTH'.split('').map(k => el('td', {}, x.w[k] ? `${md(x.w[k][0])} - ${md(x.w[k][1])}` : el('span', { class: 'muted' }, k === 'H' ? 'season too short' : '-')))))))) : el('div', { class: 'muted small' }, 'Tick plants in the calendar to build your list.'),
      exportBar('garden-plan',
        () => [['Plant', 'Sow indoors', 'Sow outdoors', 'Transplant', 'Harvest'], ...(mine.length ? mine : all).map(x => [x.v[0], ...'ISTH'.split('').map(k => x.w[k] ? `${iso(x.w[k][0])} to ${iso(x.w[k][1])}` : '')])],
        () => ({ lastFrost: D.last, firstFrost: D.first, plants: D.mine })),
      el('div', { class: 'small muted' }, 'Dates are estimates based on average frost dates; local conditions vary. Check your local extension service.'));
  }
  render(root,
    el('div', { class: 'row' }, el('label', { class: 'field' }, 'Hardiness zone (approx.)', zoneSel), el('label', { class: 'field' }, 'Last spring frost', lastIn), el('label', { class: 'field' }, 'First fall frost', firstIn)),
    out);
  draw();
}
