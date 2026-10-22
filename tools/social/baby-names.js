// Baby name voting: two profiles like/pass names from a built-in list; matches show when both like. Share code merges likes.
import { el, render, store, copy, field, toast } from '../../lib/ui.js';
import { enc, dec, h3 } from './_share.js';

const RAW = {
  F: 'Olivia Emma Charlotte Amelia Sophia Isabella Ava Mia Evelyn Luna Harper Camila Gianna Elizabeth Eleanor Ella Abigail Sofia Scarlett Emily Aria Penelope Chloe Layla Mila Nora Hazel Madison Ellie Lily Nova Isla Grace Violet Aurora Zoey Willow Emilia Stella Zoe Victoria Hannah Addison Leah Lucy Eliana Ivy Everly Lillian Paisley Elena Naomi Maya Natalie Kinsley Delilah Claire Audrey Aaliyah Ruby Brooklyn Alice Aubrey Autumn Leilani Savannah Valentina Madelyn Josephine Bella Genesis Sophie Hailey Sadie Natalia Caroline Allison Gabriella Anna Serenity Cora Maeve Freya Iris Clara Daisy Florence Matilda Rosalie Thea Tessa Vivian Wren Esme Margot Juniper Phoebe Daphne Eloise Imogen Beatrice Adelaide Cecilia Lydia Marigold Odette Ophelia Rosemary Seraphina',
  M: 'Liam Noah Oliver James Elijah William Henry Lucas Benjamin Theodore Mateo Levi Sebastian Daniel Jack Michael Alexander Owen Asher Samuel Ethan Leo Jackson Mason Ezra John Hudson Luca Aiden Joseph David Jacob Luke Julian Gabriel Grayson Wyatt Matthew Maverick Dylan Isaac Elias Anthony Thomas Jayden Carter Santiago Ezekiel Charles Josiah Caleb Christopher Nolan Hunter Connor Eli Adrian Jonathan Nathan Andrew Angel Robert Landon Jeremiah Easton Isaiah Colton Cooper Brooks Bennett Silas Declan Finn Felix Hugo Arthur Atticus August Beau Callum Milo Oscar Rhys Soren Tobias Vincent Walter Zachary Emmett Jasper Leon Miles Otis Ronan Simon Theo Winston Xavier Kai Anders Bruno Cyrus Dominic Emmanuel Franklin Gideon Harvey Ignatius',
  N: 'Alex Avery Blake Cameron Charlie Dakota Drew Eden Elliot Emerson Finley Harley Hayden Jamie Jesse Jordan Kendall Kennedy Logan Morgan Parker Peyton Quinn Reese Riley River Robin Rory Sage Sam Sasha Shay Skyler Spencer Sydney Taylor Tatum Toby Wesley Ari Arden Ash Bailey Briar Casey Cory Devin Ellis Fern Gray Indigo Jules Lane Lennox Marlowe Noel Oakley Phoenix Reagan Remy Rowan Sawyer Sutton Tegan Winter Lark Linden Marley Kit Jody Aspen Bellamy Campbell Dallas Ember Frankie Hollis Justice Kris Lou Max Nico Pat',
};
const NAMES = []; { const seen = new Set(); for (const g of ['F', 'M', 'N']) for (const n of RAW[g].split(' ')) if (!seen.has(n)) { seen.add(n); NAMES.push({ n, g }); } }
const GLAB = { F: 'girl', M: 'boy', N: 'neutral' };
const LETTERS = [...new Set(NAMES.map(x => x.n[0]))].sort();

export default function (root) {
  const s = store('baby-names');
  const st = s.get('state', { profiles: [{ name: 'Partner A', likes: [], skips: [] }, { name: 'Partner B', likes: [], skips: [] }], active: 0, custom: [] });
  const save = () => s.set('state', st);
  let gender = '', letter = '', history = [];
  const all = () => [...NAMES, ...st.custom.map(n => ({ n, g: 'N', c: true }))];
  const me = () => st.profiles[st.active];

  const note = el('div', { class: 'muted small' }, 'Local tool: both profiles live in this browser (hand the device over, or use the share code). "Copy my likes code" turns the active profile into a short text code; paste it on the other device under "Merge a code" to see matches. Nothing is uploaded.');
  const tabs = el('div', { class: 'row' }), card = el('div', { class: 'panel center', style: { padding: '28px 12px' } });
  const matchBox = el('div'), listBox = el('div');
  const gSel = el('select', { class: 'select', onchange: e => { gender = e.target.value; drawCard(); } }, el('option', { value: '' }, 'Any gender'), ...Object.entries(GLAB).map(([k, v]) => el('option', { value: k }, v)));
  const lSel = el('select', { class: 'select', onchange: e => { letter = e.target.value; drawCard(); } }, el('option', { value: '' }, 'Any letter'), ...LETTERS.map(l => el('option', { value: l }, l)));
  const nameIn = el('input', { class: 'input', style: { width: '170px' }, value: me().name, oninput: e => { me().name = e.target.value || 'Profile'; save(); drawTabs(); } });
  const customIn = el('input', { class: 'input', placeholder: 'Add your own name', onkeydown: e => { if (e.key === 'Enter') addCustom(); } });
  const codeOut = el('input', { class: 'input grow mono small', readOnly: true, placeholder: 'Your likes code appears here' });
  const codeIn = el('textarea', { class: 'textarea', style: { minHeight: '70px' }, placeholder: 'Paste a likes code from your partner' });
  const mergeInto = el('select', { class: 'select' });
  const mergeMsg = el('span', { class: 'small muted' });

  const idOf = x => x.n;
  function decided(p) { return new Set([...p.likes, ...p.skips]); }
  function queue() { const d = decided(me()); return all().filter(x => !d.has(idOf(x)) && (!gender || x.g === gender) && (!letter || x.n[0] === letter)); }

  function vote(kind) {
    const q = queue(); if (!q.length) return;
    const x = q[0]; (kind === 'like' ? me().likes : me().skips).push(idOf(x)); history.push({ p: st.active, id: idOf(x), kind });
    save(); drawCard(); drawMatches();
  }
  function undo() {
    const h = history.pop(); if (!h) { toast('Nothing to undo this session'); return; }
    const p = st.profiles[h.p]; p.likes = p.likes.filter(x => x !== h.id); p.skips = p.skips.filter(x => x !== h.id); save(); drawCard(); drawMatches();
  }
  function addCustom() {
    const n = customIn.value.trim(); if (!n) return;
    if (!all().some(x => x.n.toLowerCase() === n.toLowerCase())) st.custom.push(n);
    customIn.value = ''; save(); drawCard();
  }
  function drawTabs() {
    render(tabs, st.profiles.map((p, i) => el('button', { class: 'btn' + (i === st.active ? ' primary' : ''), onclick: () => { st.active = i; save(); nameIn.value = me().name; history = []; drawAll(); } }, p.name + ' (' + p.likes.length + ' liked)')));
    render(mergeInto, st.profiles.map((p, i) => el('option', { value: i, selected: i !== st.active && i === (st.active ? 0 : 1) }, p.name)));
  }
  function drawCard() {
    const q = queue();
    if (!q.length) { render(card, el('div', { class: 'big' }, 'All done here'), el('div', { class: 'muted' }, 'No undecided names match the filters for ' + me().name + '. Change a filter or review the lists below.')); return; }
    const x = q[0];
    render(card, el('div', { class: 'small muted' }, q.length + ' left · ' + GLAB[x.g]), el('div', { style: { fontSize: '48px', fontWeight: 800, margin: '8px 0 18px' } }, x.n),
      el('div', { class: 'row', style: { justifyContent: 'center' } },
        el('button', { class: 'btn', onclick: () => vote('skip') }, '← Pass'),
        el('button', { class: 'btn ghost', onclick: undo }, 'Undo'),
        el('button', { class: 'btn primary', onclick: () => vote('like') }, 'Like →')),
      el('div', { class: 'small muted' }, 'Keyboard: left arrow passes, right arrow likes, Backspace undoes'));
    drawTabs();
  }
  function drawMatches() {
    const [a, b] = st.profiles; const m = a.likes.filter(x => b.likes.includes(x));
    render(matchBox, el('div', { class: 'row' }, m.length ? m.map(n => el('span', { class: 'badge ok', style: { fontSize: '15px', padding: '4px 12px' } }, n)) : el('span', { class: 'muted small' }, `No matches yet. ${a.name} and ${b.name} both need to like a name.`)));
    const mine = me();
    render(listBox,
      el('div', { class: 'grid2' },
        el('div', {}, el('b', {}, 'Liked by ' + mine.name + ' (' + mine.likes.length + ')'), el('div', { class: 'row' }, mine.likes.map(n => el('span', { class: 'badge' }, n, ' ', el('a', { href: '#', title: 'Move back to undecided', onclick: e => { e.preventDefault(); mine.likes = mine.likes.filter(x => x !== n); save(); drawAll(); } }, '✕'))))),
        el('div', {}, el('b', {}, 'Passed (' + mine.skips.length + ')'), el('div', { class: 'row' }, mine.skips.map(n => el('span', { class: 'badge' }, n, ' ', el('a', { href: '#', title: 'Move back to undecided', onclick: e => { e.preventDefault(); mine.skips = mine.skips.filter(x => x !== n); save(); drawAll(); } }, '✕')))))));
  }
  function drawAll() { drawTabs(); drawCard(); drawMatches(); }

  function genCode() {
    const p = me(); const l = p.likes.map(n => { const i = NAMES.findIndex(y => y.n === n); return i >= 0 ? i : n; });
    const code = enc({ t: 'baby-names', p: p.name, l }); codeOut.value = code; copy(code);
  }
  function merge() {
    try {
      const d = dec(codeIn.value); if (d.t !== 'baby-names' || !Array.isArray(d.l)) throw 0;
      const p = st.profiles[+mergeInto.value]; let n = 0;
      for (const x of d.l) { const name = typeof x === 'number' ? NAMES[x]?.n : String(x); if (!name) continue; if (!p.likes.includes(name)) { p.likes.push(name); n++; } p.skips = p.skips.filter(y => y !== name); if (typeof x === 'string' && !all().some(y => y.n === name)) st.custom.push(name); }
      save(); mergeMsg.textContent = `Merged ${n} new like(s) from "${d.p || 'code'}" into ${p.name}.`; codeIn.value = ''; drawAll();
    } catch { mergeMsg.textContent = 'That code could not be read.'; }
  }

  const onKey = e => {
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return;
    if (!root.isConnected) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); vote('like'); } else if (e.key === 'ArrowLeft') { e.preventDefault(); vote('skip'); } else if (e.key === 'Backspace') { e.preventDefault(); undo(); }
  };
  window.addEventListener('keydown', onKey);

  render(root, note,
    h3('Vote'), tabs,
    el('div', { class: 'row' }, field('Profile name', nameIn), field('Gender', gSel), field('Starts with', lSel)),
    card,
    h3('Matches (both like)'), matchBox,
    h3('Lists'), listBox,
    h3('Add and share'),
    el('div', { class: 'row' }, customIn, el('button', { class: 'btn', onclick: addCustom }, 'Add name')),
    el('div', { class: 'row' }, el('button', { class: 'btn primary', onclick: genCode }, 'Copy my likes code'), codeOut),
    codeIn, el('div', { class: 'row' }, el('span', { class: 'small muted' }, 'Merge into'), mergeInto, el('button', { class: 'btn', onclick: merge }, 'Merge a code'), mergeMsg));
  drawAll();
  return () => window.removeEventListener('keydown', onKey);
}
