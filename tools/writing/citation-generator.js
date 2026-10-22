import { el, render, store, copy, toast } from '../../lib/ui.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MLA_MONTHS = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];

function parseAuthors(text) {
  return text.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    let first, last;
    if (l.includes(',')) { const [a, ...b] = l.split(','); last = a.trim(); first = b.join(' ').trim(); }
    else { const p = l.split(/\s+/); last = p.length > 1 ? p.pop() : l; first = p.join(' '); }
    return { first, last };
  });
}
const initials = first => first.split(/[\s]+/).filter(Boolean).map(p => p.split('-').map(x => x[0].toUpperCase() + '.').join('-')).join(' ');

function apaAuthors(a) {
  const f = a.map(x => x.first ? `${x.last}, ${initials(x.first)}` : x.last);
  if (f.length === 0) return '';
  if (f.length === 1) return f[0];
  if (f.length <= 20) return f.slice(0, -1).join(', ') + ', & ' + f[f.length - 1];
  return f.slice(0, 19).join(', ') + ', . . . ' + f[f.length - 1];
}
function mlaAuthors(a) {
  if (!a.length) return '';
  const full = x => (x.first ? `${x.last}, ${x.first}` : x.last);
  if (a.length === 1) return full(a[0]);
  if (a.length === 2) return `${full(a[0])}, and ${a[1].first ? a[1].first + ' ' : ''}${a[1].last}`;
  return `${full(a[0])}, et al`;
}
const endp = t => (t = t.trim()) && (/[.?!]$/.test(t) ? t : t + '.');
const sentenceCase = t => { const l = t.toLowerCase(); return l.replace(/(^|[:?!]\s+)([a-z])/g, (m, a, b) => a + b.toUpperCase()).replace(/\bi\b/g, 'I'); };
const doiUrl = v => { v = v.trim(); return /^10\.\d{4,}/.test(v) ? 'https://doi.org/' + v : v; };
const ord = n => { n = String(n).trim(); if (!n) return ''; if (!/^\d+$/.test(n)) return n; const k = +n; const s = ['th', 'st', 'nd', 'rd'], v = k % 100; return k + (s[(v - 20) % 10] || s[v] || s[0]); };

// A citation is an array of strings and {i: 'italic text'} items.
function build(style, type, d) {
  const A = parseAuthors(d.authors);
  const parts = [];
  const push = (...x) => parts.push(...x);
  const T = d.title.trim();
  const year = d.year.trim(), month = d.month, day = d.day.trim();
  if (style === 'apa') {
    const au = apaAuthors(A);
    const date = year ? (type === 'web' && month ? `(${year}, ${MONTHS[month - 1]}${day ? ' ' + day : ''})` : `(${year})`) : '(n.d.)';
    const title = d.sentence ? sentenceCase(T) : T;
    if (type === 'book') {
      if (au) push(endp(au) + ' ' + date + '. '); else push({ i: endp(title) }, ' ' + date + '. ');
      if (au) push({ i: title });
      const ed = d.edition.trim();
      if (au && ed) push(` (${/\d/.test(ed) ? ord(ed) : ed} ed.)`);
      if (au) push('. ');
      if (d.publisher.trim()) push(endp(d.publisher));
    } else if (type === 'web') {
      if (au) push(endp(au) + ' ' + date + '. '); else push({ i: endp(title) }, ' ' + date + '. ');
      if (au) push({ i: endp(title) }, ' ');
      const site = d.container.trim();
      if (site && site.toLowerCase() !== (A.length === 1 && A[0].last.toLowerCase())) push(endp(site) + ' ');
      if (d.url.trim()) push(d.url.trim());
      if (d.accessed.trim()) push(` (Retrieved ${d.accessed.trim()})`);
    } else {
      if (au) push(endp(au) + ' ' + date + '. ');
      else push(endp(title) + ' ' + date + '. ');
      if (au) push(endp(title) + ' ');
      const vol = d.volume.trim(), iss = d.issue.trim(), pg = d.pages.trim().replace(/\s*-\s*/g, '–');
      push({ i: d.container.trim() + (vol ? ', ' + vol : '') });
      if (iss) push(`(${iss})`);
      if (pg) push(', ' + pg);
      push('. ');
      if (d.url.trim()) push(doiUrl(d.url));
    }
  } else {
    const au = mlaAuthors(A);
    const mdate = [day, month ? MLA_MONTHS[month - 1] : '', year].filter(Boolean).join(' ');
    if (au) push(endp(au) + ' ');
    if (type === 'book') {
      push({ i: endp(T) }, ' ');
      const bits = [];
      if (d.edition.trim()) bits.push(/\d/.test(d.edition) ? ord(d.edition) + ' ed.' : d.edition.trim());
      if (d.publisher.trim()) bits.push(d.publisher.trim());
      if (year) bits.push(year);
      if (bits.length) push(endp(bits.join(', ')));
    } else if (type === 'web') {
      push(`“${endp(T)}” `);
      const bits = [];
      if (d.container.trim()) bits.push(null);
      const rest = [];
      if (d.publisher.trim()) rest.push(d.publisher.trim());
      if (mdate) rest.push(mdate);
      if (d.url.trim()) rest.push(d.url.trim().replace(/^https?:\/\//, ''));
      if (d.container.trim()) { push({ i: d.container.trim() }); if (rest.length) push(', '); }
      push(rest.join(', '));
      push('.');
      if (d.accessed.trim()) push(` Accessed ${d.accessed.trim()}.`);
    } else {
      push(`“${endp(T)}” `);
      push({ i: d.container.trim() });
      const bits = [];
      if (d.volume.trim()) bits.push('vol. ' + d.volume.trim());
      if (d.issue.trim()) bits.push('no. ' + d.issue.trim());
      if (year) bits.push(year);
      if (d.pages.trim()) bits.push((/[-–]/.test(d.pages) ? 'pp. ' : 'p. ') + d.pages.trim().replace(/\s*-\s*/g, '–'));
      if (d.url.trim()) bits.push(doiUrl(d.url).replace(/^https?:\/\/(?!doi\.org)/, ''));
      if (bits.length) push(', ' + bits.join(', '));
      push('.');
    }
  }
  return parts.filter(p => p !== '');
}
const plain = parts => parts.map(p => (typeof p === 'string' ? p : p.i)).join('').replace(/\s+/g, ' ').replace(/\.\.+/g, '.').trim();
const markdown = parts => parts.map(p => (typeof p === 'string' ? p : '*' + p.i + '*')).join('').replace(/\s+/g, ' ').replace(/\.\.+/g, '.').trim();
const htmlOf = parts => parts.map(p => { const t = (typeof p === 'string' ? p : p.i).replace(/&/g, '&amp;').replace(/</g, '&lt;'); return typeof p === 'string' ? t : '<i>' + t + '</i>'; }).join('').replace(/\s+/g, ' ').trim();

const FIELDS = {
  book: ['authors', 'title', 'edition', 'publisher', 'year'],
  web: ['authors', 'title', 'container', 'publisher', 'year', 'month', 'day', 'url', 'accessed'],
  article: ['authors', 'title', 'container', 'year', 'volume', 'issue', 'pages', 'url'],
};
const LABELS = {
  authors: ['Authors (one per line: "First Last" or "Last, First")', 'textarea'], title: ['Title'], edition: ['Edition (optional, e.g. 2)'], publisher: ['Publisher (MLA web: publisher, optional)'],
  container: ['Website / journal name'], year: ['Year'], month: ['Month', 'month'], day: ['Day'], volume: ['Volume'], issue: ['Issue'], pages: ['Pages (e.g. 45-67)'], url: ['URL or DOI'], accessed: ['Accessed date (e.g. 4 Mar. 2025)'],
};

export default function (root) {
  const s = store('citation-generator');
  const d = Object.assign({ style: 'apa', type: 'book', authors: '', title: '', edition: '', publisher: '', container: '', year: '', month: '', day: '', volume: '', issue: '', pages: '', url: '', accessed: '', sentence: false }, s.get('form', {}));
  const form = el('div', { class: 'col' });
  const out = el('div', { class: 'panel', style: { fontSize: '16px', lineHeight: '1.6', paddingLeft: '2.5em', textIndent: '-2.5em', minHeight: '60px', fontFamily: 'Georgia, serif', wordBreak: 'break-word' } });
  let current = [];

  const styleSel = el('select', { class: 'select' }, el('option', { value: 'apa' }, 'APA 7'), el('option', { value: 'mla' }, 'MLA 9'));
  const typeSel = el('select', { class: 'select' }, el('option', { value: 'book' }, 'Book'), el('option', { value: 'web' }, 'Website'), el('option', { value: 'article' }, 'Journal article'));
  styleSel.value = d.style; typeSel.value = d.type;
  styleSel.addEventListener('change', () => { d.style = styleSel.value; update(); });
  typeSel.addEventListener('change', () => { d.type = typeSel.value; buildForm(); update(); });

  function buildForm() {
    render(form, FIELDS[d.type].map(k => {
      const [label, kind] = LABELS[k];
      let c;
      if (kind === 'textarea') c = el('textarea', { class: 'textarea', rows: 3, value: d[k], style: { minHeight: '64px' } });
      else if (kind === 'month') c = el('select', { class: 'select' }, el('option', { value: '' }, '—'), MONTHS.map((m, i) => el('option', { value: i + 1 }, m)));
      else c = el('input', { class: 'input', value: d[k] });
      if (kind === 'month') c.value = d[k];
      c.addEventListener(kind === 'month' ? 'change' : 'input', () => { d[k] = c.value; update(); });
      return el('label', { class: 'field' }, label, c);
    }));
  }
  function update() {
    s.set('form', d);
    if (!d.title.trim()) { current = []; render(out, el('span', { class: 'muted' }, 'Fill in the form to see your citation.')); return; }
    current = build(d.style, d.type, d);
    render(out, current.map(p => (typeof p === 'string' ? p : el('i', {}, p.i))));
  }
  async function copyRich() {
    const html = htmlOf(current), text = plain(current);
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) })]);
      toast('Copied with italics');
    } catch { copy(markdown(current)); }
  }
  const sentChk = el('input', { type: 'checkbox', checked: d.sentence });
  sentChk.addEventListener('change', () => { d.sentence = sentChk.checked; update(); });

  render(root,
    el('div', { class: 'row' }, el('label', { class: 'inline' }, 'Style', styleSel), el('label', { class: 'inline' }, 'Source type', typeSel),
      el('label', { class: 'inline' }, sentChk, 'APA: convert title to sentence case')),
    el('div', { class: 'grid2' }, form, el('div', { class: 'col' }, el('h3', { style: { margin: '0' } }, 'Citation'), out,
      el('div', { class: 'row' },
        el('button', { class: 'btn primary', onclick: () => current.length && copyRich() }, 'Copy (formatted)'),
        el('button', { class: 'btn', onclick: () => current.length && copy(plain(current)) }, 'Copy plain'),
        el('button', { class: 'btn', onclick: () => current.length && copy(markdown(current)) }, 'Copy Markdown')),
      el('p', { class: 'muted small' }, 'Double-check against the official style guide for unusual sources.'))));
  buildForm(); update();
}
