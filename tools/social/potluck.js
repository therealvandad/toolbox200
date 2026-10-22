// Potluck signup sheet with categories and slots; share link + response codes (no server).
import { el, render, store, copy, stat, field, uid, toast } from '../../lib/ui.js';

const TOOL = 'potluck';
function enc(o) { const b = new TextEncoder().encode(JSON.stringify(o)); let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function dec(t) { const s = atob(t.trim().replace(/-/g, '+').replace(/_/g, '/')); const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return JSON.parse(new TextDecoder().decode(b)); }
function shareUrl(data) { return location.origin + location.pathname + '?s=' + enc({ t: TOOL, ...data }) + '#/tool/' + TOOL; }
function sharedData() { try { const q = new URLSearchParams(location.search).get('s'); if (!q) return null; const d = dec(q); return d.t === TOOL ? d : null; } catch { return null; } }
const defaults = () => ({ title: '', date: '', cats: [['Mains', 4], ['Sides', 4], ['Desserts', 3], ['Drinks', 3]].map(([name, slots]) => ({ id: uid(), name, slots, items: [] })) });
const h3 = t => el('h3', { style: { margin: '16px 0 6px' } }, t);

export default function (root) {
  const s = store(TOOL);
  const st = s.get('state', defaults());
  const save = () => s.set('state', st);
  const shared = sharedData();
  const note = el('div', { class: 'muted small' }, 'How sharing works: no server. The sheet lives in this browser; "Copy share link" bakes it into a URL. People who open it pick a slot and send you a short code to paste under "Import responses".');
  if (shared) return guestView(root, shared, note);

  const titleIn = el('input', { class: 'input', placeholder: 'Neighbourhood potluck', value: st.title, oninput: e => { st.title = e.target.value; save(); } });
  const dateIn = el('input', { class: 'input', type: 'date', value: st.date, oninput: e => { st.date = e.target.value; save(); } });
  const stats = el('div', { class: 'row' });
  const sheet = el('div', { class: 'col' });
  const newCat = el('input', { class: 'input', placeholder: 'New category (e.g. Snacks)', onkeydown: e => { if (e.key === 'Enter') addCat(); } });
  const codesTa = el('textarea', { class: 'textarea', style: { minHeight: '80px' }, placeholder: 'Paste response codes here' });
  const importMsg = el('span', { class: 'small muted' });
  const linkOut = el('input', { class: 'input grow mono small', readOnly: true, placeholder: 'Share link appears here' });
  function addCat() { const n = newCat.value.trim(); if (!n) return; st.cats.push({ id: uid(), name: n, slots: 3, items: [] }); newCat.value = ''; save(); draw(); }

  function importCodes() {
    let ok = 0, bad = 0;
    for (const c of codesTa.value.split(/\s+/).filter(Boolean)) {
      try {
        const d = dec(c); if (d.t !== TOOL || !Array.isArray(d.r)) throw 0;
        for (const r of d.r) {
          const cat = st.cats.find(x => x.id === r.cat) || st.cats.find(x => x.name.toLowerCase() === String(r.catName || '').toLowerCase());
          if (!cat || !r.who) continue;
          if (!cat.items.some(i => i.who.toLowerCase() === r.who.toLowerCase() && i.what.toLowerCase() === String(r.what || '').toLowerCase())) cat.items.push({ id: uid(), who: String(r.who), what: String(r.what || '') });
          ok++;
        }
      } catch { bad++; }
    }
    save(); draw(); codesTa.value = ''; importMsg.textContent = `${ok} item(s) imported${bad ? `, ${bad} invalid code(s)` : ''}`;
  }

  function draw() {
    const total = st.cats.reduce((a, c) => a + c.slots, 0), filled = st.cats.reduce((a, c) => a + Math.min(c.slots, c.items.length), 0);
    const people = new Set(st.cats.flatMap(c => c.items.map(i => i.who.toLowerCase()))).size;
    render(stats, stat(filled + ' / ' + total, 'slots filled'), stat(Math.max(0, total - filled), 'still open'), stat(people, 'people signed up'));
    render(sheet, st.cats.map(cat => {
      const open = cat.slots - cat.items.length;
      const who = el('input', { class: 'input', placeholder: 'Who', style: { width: '130px' } });
      const what = el('input', { class: 'input grow', placeholder: 'Brings what', onkeydown: e => { if (e.key === 'Enter') add(); } });
      const add = () => { if (!who.value.trim()) { toast('Name needed'); return; } cat.items.push({ id: uid(), who: who.value.trim(), what: what.value.trim() }); save(); draw(); };
      return el('div', { class: 'panel', style: open > 0 ? { borderColor: 'var(--warn)' } : {} },
        el('div', { class: 'row' },
          el('input', { class: 'input', style: { fontWeight: 600, width: '160px' }, value: cat.name, oninput: e => { cat.name = e.target.value; save(); } }),
          el('label', { class: 'inline' }, 'slots', el('input', { class: 'input', type: 'number', min: 0, max: 50, style: { width: '70px' }, value: cat.slots, oninput: e => { cat.slots = Math.max(0, +e.target.value || 0); save(); }, onblur: draw })),
          el('span', { class: open > 0 ? 'badge warn' : 'badge ok' }, open > 0 ? `${open} open` : open < 0 ? `${-open} extra` : 'full'),
          el('span', { class: 'grow' }),
          el('button', { class: 'btn small ghost', onclick: () => { st.cats = st.cats.filter(x => x !== cat); save(); draw(); } }, 'Remove category')),
        el('ul', { class: 'list' },
          cat.items.map(it => el('li', {}, el('span', { style: { fontWeight: 600 } }, it.who), el('span', { class: 'grow' }, it.what || el('span', { class: 'muted' }, '(to be decided)')),
            el('button', { class: 'btn small ghost', onclick: () => { cat.items = cat.items.filter(x => x !== it); save(); draw(); } }, '✕'))),
          Array.from({ length: Math.max(0, open) }, (_, i) => el('li', { class: 'muted' }, el('span', { class: 'badge warn' }, 'open'), ` slot ${cat.items.length + i + 1}`))),
        el('div', { class: 'row' }, who, what, el('button', { class: 'btn small', onclick: add }, 'Add')));
    }));
  }

  render(root, note,
    el('div', { class: 'row' }, field('Title', titleIn), field('Date', dateIn)),
    stats, sheet,
    el('div', { class: 'row' }, newCat, el('button', { class: 'btn', onclick: addCat }, 'Add category')),
    h3('Share'),
    el('div', { class: 'row' }, el('button', { class: 'btn primary', onclick: () => { const u = shareUrl({ title: st.title, date: st.date, cats: st.cats }); linkOut.value = u; copy(u); } }, 'Copy share link'), linkOut),
    h3('Import responses'), codesTa,
    el('div', { class: 'row' }, el('button', { class: 'btn', onclick: importCodes }, 'Import codes'), importMsg, el('span', { class: 'grow' }),
      el('button', { class: 'btn ghost small', onclick: () => copy(st.cats.map(c => `${c.name} (${c.items.length}/${c.slots})\n` + c.items.map(i => `  - ${i.who}: ${i.what}`).join('\n')).join('\n')) }, 'Copy sheet as text'),
      el('button', { class: 'btn ghost small danger', onclick: () => { Object.assign(st, defaults()); save(); draw(); titleIn.value = ''; dateIn.value = ''; } }, 'Reset sheet')));
  draw();
}

function guestView(root, d, note) {
  const s = store(TOOL + '-guest');
  const prev = s.get('reply', { who: '' });
  const who = el('input', { class: 'input', placeholder: 'Your name', value: prev.who });
  const picks = []; // {cat, what}
  const list = el('div', { class: 'col' });
  const out = el('pre', { class: 'out hidden' });
  const copyBtn = el('button', { class: 'btn hidden', onclick: () => copy(out.textContent) }, 'Copy code');
  function draw() {
    render(list, (d.cats || []).map(cat => {
      const open = cat.slots - cat.items.length;
      const what = el('input', { class: 'input grow', placeholder: 'What will you bring?', onkeydown: e => { if (e.key === 'Enter') add(); } });
      const add = () => { if (!what.value.trim()) return; picks.push({ cat: cat.id, catName: cat.name, what: what.value.trim() }); what.value = ''; draw(); };
      return el('div', { class: 'panel' },
        el('div', { class: 'row' }, el('strong', {}, cat.name), el('span', { class: open > 0 ? 'badge warn' : 'badge ok' }, open > 0 ? `${open} open` : 'full')),
        el('ul', { class: 'list small' },
          cat.items.map(it => el('li', {}, el('span', { class: 'muted' }, it.who), ' — ', it.what)),
          picks.filter(p => p.cat === cat.id).map(p => el('li', {}, el('span', { class: 'badge ok' }, 'you'), ' ', p.what, el('span', { class: 'grow' }), el('button', { class: 'btn small ghost', onclick: () => { picks.splice(picks.indexOf(p), 1); draw(); } }, '✕')))),
        el('div', { class: 'row' }, what, el('button', { class: 'btn small', onclick: add }, 'Sign up')));
    }));
  }
  function gen() {
    if (!who.value.trim()) { toast('Enter your name'); who.focus(); return; }
    if (!picks.length) { toast('Sign up for at least one thing'); return; }
    s.set('reply', { who: who.value.trim() });
    out.textContent = enc({ t: TOOL, r: picks.map(p => ({ ...p, who: who.value.trim() })) }); out.classList.remove('hidden'); copyBtn.classList.remove('hidden');
  }
  draw();
  render(root, note,
    el('div', { class: 'panel', style: { margin: '10px 0' } }, el('div', { class: 'big' }, d.title || 'Potluck'), d.date ? el('div', {}, '📅 ', d.date) : null),
    field('Your name', who), list,
    el('div', { class: 'row' }, el('button', { class: 'btn primary', onclick: gen }, 'Generate response code'), copyBtn), out,
    el('div', { class: 'muted small' }, 'Send the code to the organizer; they paste it to add your dishes to the sheet.'),
    el('div', { class: 'row' }, el('button', { class: 'btn ghost small', onclick: () => { history.replaceState(null, '', location.pathname + location.hash); dispatchEvent(new HashChangeEvent('hashchange')); } }, 'I am the organizer — open my own sheet')));
}
