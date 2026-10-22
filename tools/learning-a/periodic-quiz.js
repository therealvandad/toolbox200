// Periodic table quiz with all 118 elements and an interactive colour-coded table.
import { el, render, store, stat, shuffle } from '../../lib/ui.js';

// symbol:name:group:categoryCode — atomic number is the index + 1, period derived from number.
const RAW = `H:Hydrogen:1:n He:Helium:18:g Li:Lithium:1:a Be:Beryllium:2:e B:Boron:13:m C:Carbon:14:n N:Nitrogen:15:n O:Oxygen:16:n F:Fluorine:17:h Ne:Neon:18:g
Na:Sodium:1:a Mg:Magnesium:2:e Al:Aluminium:13:p Si:Silicon:14:m P:Phosphorus:15:n S:Sulfur:16:n Cl:Chlorine:17:h Ar:Argon:18:g
K:Potassium:1:a Ca:Calcium:2:e Sc:Scandium:3:t Ti:Titanium:4:t V:Vanadium:5:t Cr:Chromium:6:t Mn:Manganese:7:t Fe:Iron:8:t Co:Cobalt:9:t Ni:Nickel:10:t Cu:Copper:11:t Zn:Zinc:12:t Ga:Gallium:13:p Ge:Germanium:14:m As:Arsenic:15:m Se:Selenium:16:n Br:Bromine:17:h Kr:Krypton:18:g
Rb:Rubidium:1:a Sr:Strontium:2:e Y:Yttrium:3:t Zr:Zirconium:4:t Nb:Niobium:5:t Mo:Molybdenum:6:t Tc:Technetium:7:t Ru:Ruthenium:8:t Rh:Rhodium:9:t Pd:Palladium:10:t Ag:Silver:11:t Cd:Cadmium:12:t In:Indium:13:p Sn:Tin:14:p Sb:Antimony:15:m Te:Tellurium:16:m I:Iodine:17:h Xe:Xenon:18:g
Cs:Caesium:1:a Ba:Barium:2:e La:Lanthanum:3:l Ce:Cerium:3:l Pr:Praseodymium:3:l Nd:Neodymium:3:l Pm:Promethium:3:l Sm:Samarium:3:l Eu:Europium:3:l Gd:Gadolinium:3:l Tb:Terbium:3:l Dy:Dysprosium:3:l Ho:Holmium:3:l Er:Erbium:3:l Tm:Thulium:3:l Yb:Ytterbium:3:l Lu:Lutetium:3:l Hf:Hafnium:4:t Ta:Tantalum:5:t W:Tungsten:6:t Re:Rhenium:7:t Os:Osmium:8:t Ir:Iridium:9:t Pt:Platinum:10:t Au:Gold:11:t Hg:Mercury:12:t Tl:Thallium:13:p Pb:Lead:14:p Bi:Bismuth:15:p Po:Polonium:16:p At:Astatine:17:h Rn:Radon:18:g
Fr:Francium:1:a Ra:Radium:2:e Ac:Actinium:3:c Th:Thorium:3:c Pa:Protactinium:3:c U:Uranium:3:c Np:Neptunium:3:c Pu:Plutonium:3:c Am:Americium:3:c Cm:Curium:3:c Bk:Berkelium:3:c Cf:Californium:3:c Es:Einsteinium:3:c Fm:Fermium:3:c Md:Mendelevium:3:c No:Nobelium:3:c Lr:Lawrencium:3:c Rf:Rutherfordium:4:t Db:Dubnium:5:t Sg:Seaborgium:6:t Bh:Bohrium:7:t Hs:Hassium:8:t Mt:Meitnerium:9:u Ds:Darmstadtium:10:u Rg:Roentgenium:11:u Cn:Copernicium:12:t Nh:Nihonium:13:u Fl:Flerovium:14:u Mc:Moscovium:15:u Lv:Livermorium:16:u Ts:Tennessine:17:u Og:Oganesson:18:u`;

const CATS = {
  a: ['Alkali metal', '#e8553f'], e: ['Alkaline earth metal', '#e69a2a'], t: ['Transition metal', '#d8b22a'], p: ['Post-transition metal', '#5aa469'],
  m: ['Metalloid', '#2fa5a0'], n: ['Reactive nonmetal', '#3b82d6'], h: ['Halogen', '#7c5cd6'], g: ['Noble gas', '#c05aa8'],
  l: ['Lanthanide', '#9c6b3f'], c: ['Actinide', '#6b7f99'], u: ['Unknown properties', '#8a8f98'],
};
const PERIOD_END = [2, 10, 18, 36, 54, 86, 118];
const ELEMENTS = RAW.trim().split(/\s+/).map((e, i) => {
  const [symbol, name, group, cat] = e.split(':');
  const number = i + 1;
  const period = PERIOD_END.findIndex(x => number <= x) + 1;
  return { symbol, name, number, group: +group, period, cat, category: CATS[cat][0], color: CATS[cat][1] };
});

export default function (root) {
  const s = store('periodic-quiz');
  const MODES = { s2n: 'Symbol → Name', n2s: 'Name → Symbol', z2s: 'Number → Symbol', s2z: 'Symbol → Number' };
  let mode = s.get('mode', 's2n');
  let range = s.get('range', 36); // quiz the first N elements
  let score = s.get('score', { total: 0, correct: 0, streak: 0, best: 0 });
  let current = null, locked = false, optEls = [], t = null;
  let missed = s.get('missed', {}); // number -> count

  const modeSel = el('select', { class: 'select', onchange: () => { mode = modeSel.value; s.set('mode', mode); ask(); } },
    Object.entries(MODES).map(([v, t]) => el('option', { value: v, selected: v === mode }, t)));
  const rangeSel = el('select', { class: 'select', onchange: () => { range = +rangeSel.value; s.set('range', range); ask(); } },
    [[20, 'First 20'], [36, 'First 36'], [54, 'First 54'], [86, 'First 86'], [118, 'All 118']].map(([v, t]) => el('option', { value: v, selected: v === range }, t)));

  const prompt = el('div', { class: 'center', style: { padding: '18px 0' } });
  const choices = el('div', { class: 'row', style: { justifyContent: 'center' } });
  const fb = el('div', { class: 'center small', style: { minHeight: '24px' } });
  const scoreRow = el('div', { class: 'row' });

  function drawScore() {
    const acc = score.total ? Math.round(score.correct / score.total * 100) : 0;
    render(scoreRow, stat(score.correct + '/' + score.total, 'correct'), stat(acc + '%', 'accuracy'), stat(score.streak, 'streak'), stat(score.best, 'best streak'));
    s.set('score', score);
  }

  function label(e, kind) { return kind === 'name' ? e.name : kind === 'symbol' ? e.symbol : String(e.number); }
  function pickDistractors(target, n) {
    const pool = ELEMENTS.filter(e => e !== target && e.number <= Math.max(range, 20));
    // prefer same-category / nearby elements for harder options
    const near = shuffle(pool.filter(e => e.cat === target.cat || Math.abs(e.number - target.number) <= 4));
    const rest = shuffle(pool.filter(e => !near.includes(e)));
    return [...near, ...rest].slice(0, n);
  }

  function ask() {
    locked = false;
    const pool = ELEMENTS.filter(e => e.number <= range);
    // weight missed elements higher
    const weighted = pool.flatMap(e => Array(1 + Math.min(3, missed[e.number] || 0)).fill(e));
    current = weighted[Math.floor(Math.random() * weighted.length)];
    const [from, to] = { s2n: ['symbol', 'name'], n2s: ['name', 'symbol'], z2s: ['number', 'symbol'], s2z: ['symbol', 'number'] }[mode];
    render(prompt,
      el('div', { class: 'muted small' }, mode === 's2z' ? 'What is the atomic number of' : { symbol: 'Which element has the symbol', name: 'What is the symbol of', number: 'Which element is number' }[from]),
      el('div', { class: 'huge', style: { color: current.color } }, from === 'number' ? '#' + current.number : label(current, from)));
    const opts = shuffle([current, ...pickDistractors(current, 3)]);
    optEls = opts;
    render(choices, opts.map((e, i) => el('button', { class: 'btn', style: { minWidth: '120px', fontSize: '16px' }, onclick: () => answerWith(e, i) },
      el('span', { class: 'kbd', style: { marginRight: '8px' } }, i + 1), label(e, to))));
    fb.textContent = '';
  }

  function answerWith(e, idx) {
    if (locked || !current) return;
    locked = true;
    const ok = e === current;
    score.total++;
    if (ok) { score.correct++; score.streak++; score.best = Math.max(score.best, score.streak); }
    else { score.streak = 0; missed[current.number] = (missed[current.number] || 0) + 1; s.set('missed', missed); }
    [...choices.children].forEach((b, i) => {
      if (i === idx && !ok) { b.style.borderColor = 'var(--danger)'; b.style.color = 'var(--danger)'; }
      if (optEls[i] === current) { b.style.background = 'var(--ok)'; b.style.color = '#fff'; }
    });
    fb.textContent = (ok ? '✓ ' : '✗ ') + `${current.name} (${current.symbol}), #${current.number} — ${current.category}, group ${current.group}, period ${current.period}`;
    fb.style.color = ok ? 'var(--ok)' : 'var(--danger)';
    drawScore();
    clearTimeout(t); t = setTimeout(ask, ok ? 700 : 1800);
  }

  root.addEventListener('keydown', e => {
    const n = +e.key;
    if (n >= 1 && n <= 4 && choices.children[n - 1]) { choices.children[n - 1].click(); }
  });

  // ---------- table view ----------
  const detail = el('div', { class: 'panel small' }, 'Click an element for details.');
  const tableWrap = el('div', { class: 'scroll-x' });
  function drawTable() {
    const cellSize = 40;
    const grid = el('div', { style: { display: 'grid', gridTemplateColumns: `repeat(18, ${cellSize}px)`, gap: '2px', width: 'max-content' } });
    const place = (e, col, row) => grid.append(el('div', {
      title: `${e.number} ${e.name} — ${e.category}`,
      onclick: () => render(detail, el('div', { class: 'row' },
        el('div', { class: 'big', style: { color: e.color, minWidth: '60px' } }, e.symbol),
        el('div', {}, el('strong', {}, `${e.number} ${e.name}`), el('div', { class: 'muted' }, `${e.category} · group ${e.group} · period ${e.period}`)))),
      style: { gridColumn: col, gridRow: row, height: cellSize + 'px', background: e.color, color: '#fff', borderRadius: '4px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1.05, opacity: e.number <= range ? 1 : 0.45 },
    }, el('span', { style: { fontSize: '9px' } }, e.number), el('strong', { style: { fontSize: '13px' } }, e.symbol)));
    for (const e of ELEMENTS) {
      if (e.cat === 'l') place(e, e.number - 57 + 3, 9);
      else if (e.cat === 'c') place(e, e.number - 89 + 3, 10);
      else place(e, e.group, e.period);
    }
    const legend = el('div', { class: 'row' }, Object.values(CATS).map(([name, color]) => el('span', { class: 'badge', style: { borderColor: color, background: color, color: '#fff' } }, name)));
    render(tableWrap, grid, legend);
  }

  const quizView = el('div', { class: 'col' },
    el('div', { class: 'row' }, modeSel, rangeSel, el('span', { class: 'muted small' }, 'Keys 1–4 answer'),
      el('button', { class: 'btn small ghost', onclick: () => { score = { total: 0, correct: 0, streak: 0, best: 0 }; missed = {}; s.set('missed', missed); drawScore(); } }, 'Reset score')),
    prompt, choices, fb, scoreRow);
  const tableView = el('div', { class: 'col hidden' }, detail, tableWrap);
  const tabQ = el('button', { class: 'btn small primary', onclick: () => show('quiz') }, 'Quiz');
  const tabT = el('button', { class: 'btn small', onclick: () => show('table') }, 'Table');
  function show(which) {
    quizView.classList.toggle('hidden', which !== 'quiz'); tableView.classList.toggle('hidden', which !== 'table');
    tabQ.classList.toggle('primary', which === 'quiz'); tabT.classList.toggle('primary', which === 'table');
    if (which === 'table') drawTable();
  }

  root.tabIndex = -1;
  render(root, el('div', { class: 'row' }, tabQ, tabT), quizView, tableView);
  drawScore(); ask();
  return () => clearTimeout(t);
}
