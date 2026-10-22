// Class reunion page: event info, attendees with then/now photos (compressed), memory wall, countdown, downloadable HTML.
import { el, render, store, download, field, uid, toast, loadImage } from '../../lib/ui.js';
import { h3, esc } from './_share.js';

const SIZE = 140;
async function compress(file) {
  const img = await loadImage(file);
  const c = document.createElement('canvas'); c.width = c.height = SIZE; const g = c.getContext('2d');
  const side = Math.min(img.naturalWidth, img.naturalHeight), sx = (img.naturalWidth - side) / 2, sy = (img.naturalHeight - side) / 2;
  g.drawImage(img, sx, sy, side, side, 0, 0, SIZE, SIZE);
  return c.toDataURL('image/jpeg', 0.7);
}
const when = ev => ev.date ? new Date(ev.date + 'T' + (ev.time || '00:00')) : null;
function countdownText(ev) {
  const d = when(ev); if (!d || isNaN(d)) return 'Set a date to start the countdown';
  let ms = d - Date.now(); if (ms <= 0) return 'The reunion has started. Enjoy!';
  const day = Math.floor(ms / 864e5); ms -= day * 864e5; const h = Math.floor(ms / 36e5); ms -= h * 36e5; const m = Math.floor(ms / 6e4); const sec = Math.floor((ms - m * 6e4) / 1000);
  return `${day} days ${h} hours ${m} min ${sec} s to go`;
}
function buildHtml(st) {
  const ev = st.event, d = when(ev);
  const date = d && !isNaN(d) ? d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + (ev.time ? ', ' + ev.time : '') : '';
  const photo = (src, label) => src ? `<figure><img src="${src}" alt="${esc(label)}"><figcaption>${label}</figcaption></figure>` : `<figure class="ph"><span>${label}</span></figure>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(ev.title || 'Class reunion')}</title>
<style>*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#f4f1ea;color:#2b2a28;line-height:1.5}
header{background:#2f4858;color:#fff;text-align:center;padding:56px 20px}header h1{margin:0;font-size:clamp(30px,7vw,54px)}header p{margin:6px 0;opacity:.9}#cd{margin-top:16px;font-size:18px;color:#ffd166}
main{max-width:900px;margin:0 auto;padding:20px}section{margin:28px 0}h2{border-bottom:2px solid #2f4858;padding-bottom:4px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px}.card{background:#fff;border-radius:10px;padding:10px;box-shadow:0 1px 4px rgba(0,0,0,.1);text-align:center}
.pair{display:flex;gap:6px;justify-content:center}figure{margin:0;flex:1}figure img,.ph{width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;display:block}.ph{background:#e6e1d6;display:flex;align-items:center;justify-content:center;color:#8a8579;font-size:12px}
figcaption{font-size:11px;color:#777}.post{background:#fff;border-left:4px solid #ffd166;padding:10px 14px;margin:10px 0;border-radius:6px}.post small{color:#777}</style></head><body>
<header><h1>${esc(ev.title || 'Class reunion')}</h1>${ev.school ? `<p>${esc(ev.school)}${ev.year ? ' &middot; Class of ' + esc(ev.year) : ''}</p>` : ''}${date ? `<p>${esc(date)}</p>` : ''}${ev.venue ? `<p>${esc(ev.venue)}</p>` : ''}<div id="cd" data-t="${d && !isNaN(d) ? d.getTime() : ''}"></div></header>
<main>${ev.details ? `<section><h2>Details</h2><p>${esc(ev.details).replace(/\n/g, '<br>')}</p></section>` : ''}
<section><h2>Who is coming (${st.attendees.length})</h2><div class="grid">${st.attendees.map(a => `<div class="card"><div class="pair">${photo(a.then, 'Then')}${photo(a.now, 'Now')}</div><b>${esc(a.name)}</b></div>`).join('') || '<p>No attendees listed yet.</p>'}</div></section>
<section><h2>Memory wall</h2>${st.posts.map(p => `<div class="post">${esc(p.text).replace(/\n/g, '<br>')}<br><small>${esc(p.author || 'Anonymous')}</small></div>`).join('') || '<p>No memories yet.</p>'}</section></main>
<script>(function(){var c=document.getElementById('cd'),t=+c.dataset.t;if(!t){return}function f(){var ms=t-Date.now();if(ms<=0){c.textContent='The reunion has started!';return}var d=Math.floor(ms/864e5);ms-=d*864e5;var h=Math.floor(ms/36e5);ms-=h*36e5;var m=Math.floor(ms/6e4);c.textContent=d+' days '+h+' hours '+m+' min to go'}f();setInterval(f,30000)})();<\/script></body></html>`;
}

export default function (root) {
  const s = store('reunion-page');
  const st = s.get('state', { event: { title: '', school: '', year: '', date: '', time: '', venue: '', details: '' }, attendees: [], posts: [] });
  let saveFailed = false;
  const save = () => { try { localStorage.setItem('tb200:reunion-page:state', JSON.stringify(st)); } catch { if (!saveFailed) { saveFailed = true; toast('Storage is full: remove some photos'); } } };
  const ev = st.event;
  const bind = (k, ph, type = 'text') => el('input', { class: 'input', type, placeholder: ph, value: ev[k] || '', oninput: e => { ev[k] = e.target.value; save(); tick(); } });
  const cd = el('div', { class: 'big' }), list = el('div'), wall = el('div', { class: 'col' });
  const nameIn = el('input', { class: 'input grow', placeholder: 'Attendee name (Enter to add)', onkeydown: e => { if (e.key === 'Enter') addAtt(); } });
  const authorIn = el('input', { class: 'input', placeholder: 'Your name (optional)', style: { width: '180px' } });
  const postIn = el('textarea', { class: 'textarea prose', style: { minHeight: '70px' }, placeholder: 'Share a memory…' });
  const tick = () => { cd.textContent = countdownText(ev); };
  const iv = setInterval(tick, 1000); tick();

  function addAtt() {
    const names = nameIn.value.split(/[,;\n]/).map(x => x.trim()).filter(Boolean);
    for (const name of names) st.attendees.push({ id: uid(), name, then: '', now: '' });
    nameIn.value = ''; save(); drawList();
  }
  async function setPhoto(a, which, file) {
    if (!file) return;
    try { a[which] = await compress(file); save(); drawList(); } catch { toast('Could not read that image'); }
  }
  function photoSlot(a, which, label) {
    const inp = el('input', { type: 'file', accept: 'image/*', class: 'hidden', onchange: () => setPhoto(a, which, inp.files[0]) });
    const box = el('div', { style: { width: '84px', height: '84px', border: '1px dashed var(--line)', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', fontSize: '12px', color: 'var(--muted)', textAlign: 'center' }, title: 'Click to choose a ' + label.toLowerCase() + ' photo', onclick: () => inp.click() },
      a[which] ? el('img', { src: a[which], style: { width: '100%', height: '100%', objectFit: 'cover' }, alt: label }) : label + ' photo', inp);
    return el('div', { class: 'col', style: { alignItems: 'center', gap: '2px' } }, box, a[which] ? el('a', { href: '#', class: 'small', onclick: e => { e.preventDefault(); a[which] = ''; save(); drawList(); } }, 'clear') : el('span', { class: 'small muted' }, label));
  }
  function drawList() {
    render(list, st.attendees.length ? el('div', { class: 'row', style: { alignItems: 'stretch' } }, st.attendees.map(a => el('div', { class: 'panel col', style: { alignItems: 'center' } },
      el('div', { class: 'row', style: { margin: 0, flexWrap: 'nowrap' } }, photoSlot(a, 'then', 'Then'), photoSlot(a, 'now', 'Now')),
      el('input', { class: 'input', style: { width: '180px' }, value: a.name, oninput: e => { a.name = e.target.value; save(); } }),
      el('button', { class: 'btn small ghost', onclick: () => { st.attendees = st.attendees.filter(x => x !== a); save(); drawList(); } }, 'Remove')))) : el('div', { class: 'muted small' }, 'No attendees yet.'));
  }
  function addPost() {
    const text = postIn.value.trim(); if (!text) return;
    st.posts.unshift({ id: uid(), author: authorIn.value.trim(), text, ts: Date.now() }); postIn.value = ''; save(); drawWall();
  }
  function drawWall() {
    render(wall, st.posts.length ? st.posts.map(p => el('div', { class: 'panel' }, el('div', { style: { whiteSpace: 'pre-wrap' } }, p.text),
      el('div', { class: 'row', style: { margin: '4px 0 0' } }, el('span', { class: 'small muted' }, (p.author || 'Anonymous') + ' · ' + new Date(p.ts).toLocaleDateString()), el('span', { class: 'grow' }),
        el('button', { class: 'btn small ghost', onclick: () => { st.posts = st.posts.filter(x => x !== p); save(); drawWall(); } }, 'Delete')))) : el('div', { class: 'muted small' }, 'No memories posted yet.'));
  }

  render(root,
    el('div', { class: 'muted small' }, 'Local tool: everything, including the compressed photos (140 px), is stored in this browser only. Use "Download page" for a standalone HTML file you can send or host.'),
    h3('Event'),
    el('div', { class: 'grid2' }, field('Reunion title', bind('title', '20-year reunion')), field('School', bind('school', 'Lincoln High')), field('Class year', bind('year', '2006')), field('Venue', bind('venue', 'The Grand Ballroom')), field('Date', bind('date', '', 'date')), field('Time', bind('time', '', 'time')),
      field('Details', el('textarea', { class: 'textarea prose', style: { minHeight: '70px' }, placeholder: 'Dress code, tickets, parking…', value: ev.details || '', oninput: e => { ev.details = e.target.value; save(); } }))),
    el('div', { class: 'panel center', style: { margin: '10px 0' } }, cd),
    h3('Attendees (then and now)'),
    el('div', { class: 'row' }, nameIn, el('button', { class: 'btn primary', onclick: addAtt }, 'Add')), list,
    h3('Memory wall'),
    el('div', { class: 'col' }, postIn, el('div', { class: 'row' }, authorIn, el('button', { class: 'btn primary', onclick: addPost }, 'Post memory'))), wall,
    el('div', { class: 'row', style: { marginTop: '18px' } }, el('button', { class: 'btn primary', onclick: () => download('reunion.html', buildHtml(st), 'text/html') }, 'Download page')));
  drawList(); drawWall();
  return () => clearInterval(iv);
}
