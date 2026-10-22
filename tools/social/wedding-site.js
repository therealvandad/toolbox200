// Wedding website builder: fill in details, preview the one-page site inside the tool, download a standalone HTML file.
import { el, render, store, download, field } from '../../lib/ui.js';
import { h3, esc, safeUrl } from './_share.js';

const THEMES = {
  Blush: { bg: '#fff7f5', ink: '#4a2c2a', accent: '#c9786b', soft: '#f6e1dc' },
  Sage: { bg: '#f6f8f3', ink: '#2f3a2c', accent: '#6f8f62', soft: '#e3ebdc' },
  Navy: { bg: '#f5f7fb', ink: '#1d2a44', accent: '#3b5b99', soft: '#dde5f3' },
  Midnight: { bg: '#1b1a24', ink: '#f1ecf6', accent: '#d9a5e8', soft: '#2a2838' },
};
const FONTS = { Serif: 'Georgia, "Times New Roman", serif', Sans: 'system-ui, -apple-system, "Segoe UI", sans-serif' };

function fmtDate(iso) { if (!iso) return ''; const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }); }
function lines(t) { return String(t || '').split('\n').map(x => x.trim()).filter(Boolean); }

export function buildHtml(w) {
  const th = THEMES[w.theme] || THEMES.Blush, font = FONTS[w.font] || FONTS.Serif;
  const names = [w.a, w.b].map(x => (x || '').trim()).filter(Boolean);
  const title = names.length === 2 ? `${esc(names[0])} &amp; ${esc(names[1])}` : esc(names[0] || 'Our wedding');
  const sched = lines(w.schedule).map(l => { const [t, ...r] = l.split('|'); return r.length ? [t.trim(), r.join('|').trim()] : ['', l]; });
  const reg = lines(w.registry).map(l => { const [lab, ...r] = l.split('|'); const u = safeUrl(r.length ? r.join('|') : lab); return u ? [r.length ? lab.trim() : u, u] : null; }).filter(Boolean);
  const story = String(w.story || '').split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
*{box-sizing:border-box}body{margin:0;background:${th.bg};color:${th.ink};font-family:${font};line-height:1.6}
.hero{text-align:center;padding:72px 20px 56px;background:${th.soft}}
.hero small{letter-spacing:.2em;text-transform:uppercase;color:${th.accent}}
.hero h1{font-size:clamp(36px,8vw,68px);margin:12px 0;font-weight:400}
.hero p{margin:4px 0;font-size:18px}
#count{margin-top:18px;font-size:15px;color:${th.accent}}
main{max-width:720px;margin:0 auto;padding:12px 20px 60px}
section{padding:28px 0;border-bottom:1px solid ${th.soft}}section:last-child{border:0}
h2{font-weight:400;color:${th.accent};font-size:26px;margin:0 0 12px}
.row{display:flex;gap:16px;padding:6px 0;border-bottom:1px dotted ${th.soft}}.row b{min-width:92px;color:${th.accent};font-weight:600}
a.btn{display:inline-block;margin:4px 8px 4px 0;padding:8px 16px;border:1px solid ${th.accent};border-radius:999px;color:${th.accent};text-decoration:none}
a.btn:hover{background:${th.accent};color:${th.bg}}
footer{text-align:center;padding:24px;color:${th.accent};font-size:14px}
</style></head><body>
<header class="hero"><small>We are getting married</small><h1>${title}</h1>
${w.date ? `<p>${esc(fmtDate(w.date))}</p>` : ''}${w.venue ? `<p>${esc(w.venue)}${w.address ? ' &middot; ' + esc(w.address) : ''}</p>` : ''}
${w.date ? `<div id="count" data-date="${esc(w.date)}"></div>` : ''}</header>
<main>
${story.length ? `<section><h2>Our story</h2>${story.map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('')}</section>` : ''}
${sched.length ? `<section><h2>Schedule</h2>${sched.map(([t, e]) => `<div class="row"><b>${esc(t)}</b><span>${esc(e)}</span></div>`).join('')}</section>` : ''}
${w.venue || w.address ? `<section><h2>Where</h2><p><b>${esc(w.venue)}</b><br>${esc(w.address)}</p>${w.address ? `<a class="btn" href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent((w.venue ? w.venue + ' ' : '') + w.address)}">Open in Maps</a>` : ''}</section>` : ''}
${w.rsvp ? `<section><h2>RSVP</h2><p>${esc(w.rsvp).replace(/\n/g, '<br>')}</p></section>` : ''}
${reg.length ? `<section><h2>Registry</h2>${reg.map(([l, u]) => `<a class="btn" href="${esc(u)}" rel="noopener">${esc(l)}</a>`).join('')}</section>` : ''}
</main>
<footer>${title}${w.date ? ' &middot; ' + esc(w.date) : ''}</footer>
<script>(function(){var c=document.getElementById('count');if(!c)return;var p=c.dataset.date.split('-');var t=new Date(+p[0],p[1]-1,+p[2]);var n=new Date();n.setHours(0,0,0,0);var d=Math.round((t-n)/864e5);c.textContent=d>0?d+' days to go':d===0?'Today is the day!':'Married '+(-d)+' days ago';})();<\/script>
</body></html>`;
}

export default function (root) {
  const s = store('wedding-site');
  const w = s.get('state', { a: '', b: '', date: '', venue: '', address: '', schedule: '4:00 pm | Ceremony\n5:00 pm | Cocktail hour\n6:30 pm | Dinner and dancing', registry: '', story: '', rsvp: '', theme: 'Blush', font: 'Serif' });
  const save = () => { s.set('state', w); };
  const frame = el('iframe', { style: { width: '100%', height: '560px', border: '1px solid var(--line)', borderRadius: '8px', background: '#fff' }, sandbox: 'allow-scripts', title: 'Wedding site preview' });
  let t = null;
  const refresh = () => { clearTimeout(t); t = setTimeout(() => { frame.srcdoc = buildHtml(w); }, 250); };
  const bind = (k, ph, type = 'text') => el('input', { class: 'input', type, placeholder: ph, value: w[k] || '', oninput: e => { w[k] = e.target.value; save(); refresh(); } });
  const area = (k, ph, h = '110px') => el('textarea', { class: 'textarea prose', style: { minHeight: h }, placeholder: ph, value: w[k] || '', oninput: e => { w[k] = e.target.value; save(); refresh(); } });
  const sel = (k, opts) => el('select', { class: 'select', onchange: e => { w[k] = e.target.value; save(); refresh(); } }, Object.keys(opts).map(o => el('option', { value: o, selected: o === w[k] }, o)));

  render(root,
    el('div', { class: 'muted small' }, 'Local tool: your details are saved in this browser only. The preview below is the finished page; download it as one HTML file with inline CSS and upload it to any web host or send it as a file.'),
    el('div', { class: 'grid2', style: { alignItems: 'start', marginTop: '10px' } },
      el('div', { class: 'col' },
        h3('Details'),
        el('div', { class: 'grid2' }, field('Partner 1', bind('a', 'Alex')), field('Partner 2', bind('b', 'Jordan'))),
        el('div', { class: 'grid2' }, field('Date', bind('date', '', 'date')), field('Venue', bind('venue', 'Willow Creek Barn'))),
        field('Address', bind('address', '12 Orchard Lane, Springfield')),
        field('Schedule (one per line: time | event)', area('schedule', '4:00 pm | Ceremony', '100px')),
        field('Registry links (one per line: label | url)', area('registry', 'Amazon | https://amazon.com/wedding/…', '80px')),
        field('Our story (blank line between paragraphs)', area('story', 'We met in…', '130px')),
        field('RSVP message', area('rsvp', 'Please reply by May 1 to alex@example.com', '70px')),
        el('div', { class: 'grid2' }, field('Colour theme', sel('theme', THEMES)), field('Font', sel('font', FONTS))),
        el('div', { class: 'row' }, el('button', { class: 'btn primary', onclick: () => download('wedding-site.html', buildHtml(w), 'text/html') }, 'Download HTML'))),
      el('div', {}, h3('Preview'), frame)));
  frame.srcdoc = buildHtml(w);
  return () => clearTimeout(t);
}
