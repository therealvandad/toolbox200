// Fundraiser thermometer: goal, donations with messages, animated thermometer, recent-donor ticker, downloadable standalone page.
import { el, render, store, download, stat, field, uid, toast, loop } from '../../lib/ui.js';
import { h3, esc } from './_share.js';

const money = (n, cur) => cur + Number(n).toLocaleString(undefined, { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });

function thermoSvg(pct, color = '#d64545') {
  const p = Math.max(0, Math.min(100, pct)), top = 20, h = 240, fillH = h * p / 100;
  const ticks = [0, 25, 50, 75, 100].map(t => `<line x1="52" x2="62" y1="${top + h - h * t / 100}" y2="${top + h - h * t / 100}" stroke="#888"/><text x="66" y="${top + h - h * t / 100 + 4}" font-size="11" fill="#888">${t}%</text>`).join('');
  return `<svg viewBox="0 0 120 330" width="120" height="330" role="img" aria-label="${Math.round(p)} percent of goal"><rect x="20" y="${top}" width="30" height="${h + 14}" rx="15" fill="#e8e8e8" stroke="#bbb"/><circle cx="35" cy="${top + h + 34}" r="30" fill="${color}" stroke="#bbb"/><rect x="26" y="${top + h - fillH}" width="18" height="${fillH + 20}" fill="${color}"/>${ticks}</svg>`;
}
function buildHtml(st) {
  const total = st.donations.reduce((a, d) => a + d.amount, 0), pct = st.goal ? Math.min(100, total / st.goal * 100) : 0, cur = st.cur;
  const recent = [...st.donations].reverse();
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(st.title || 'Fundraiser')}</title><style>
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#fdf6ee;color:#2b2a28;line-height:1.5}
main{max-width:760px;margin:0 auto;padding:28px 18px}h1{margin:0 0 4px;font-size:clamp(28px,6vw,44px)}.story{white-space:pre-wrap;color:#555}
.top{display:flex;gap:24px;align-items:center;flex-wrap:wrap;margin:20px 0}.nums .big{font-size:42px;font-weight:800;color:#d64545}.nums .sm{color:#666}
.don{background:#fff;border-left:4px solid #d64545;border-radius:6px;padding:10px 14px;margin:8px 0;box-shadow:0 1px 3px rgba(0,0,0,.08)}.don b{color:#d64545}.don span{color:#666}
</style></head><body><main><h1>${esc(st.title || 'Fundraiser')}</h1><div class="story">${esc(st.story)}</div>
<div class="top">${thermoSvg(pct)}<div class="nums"><div class="big">${esc(money(total, cur))}</div><div class="sm">raised of ${esc(money(st.goal, cur))} goal &middot; ${Math.round(pct)}%</div><div class="sm">${st.donations.length} donation${st.donations.length === 1 ? '' : 's'}</div></div></div>
<h2>Thank you</h2>${recent.map(d => `<div class="don"><b>${esc(d.anon ? 'Anonymous' : d.name || 'Friend')}</b> gave ${esc(money(d.amount, cur))}${d.msg ? `<br><span>&ldquo;${esc(d.msg)}&rdquo;</span>` : ''}</div>`).join('') || '<p>Be the first to give.</p>'}</main></body></html>`;
}

export default function (root) {
  const s = store('fundraiser');
  const st = s.get('state', { title: '', story: '', goal: 1000, cur: '$', donations: [] });
  const save = () => s.set('state', st);
  let shown = 0, tickIdx = 0;
  const total = () => st.donations.reduce((a, d) => a + d.amount, 0);

  const thermo = el('div', { class: 'center' }), nums = el('div'), stats = el('div', { class: 'row' }), ticker = el('div', { class: 'panel center', style: { minHeight: '52px', transition: 'opacity .4s' } }), listBox = el('div', { class: 'scroll-x' });
  const nameIn = el('input', { class: 'input', placeholder: 'Donor name' }), amtIn = el('input', { class: 'input', type: 'number', min: 0, step: '0.01', placeholder: 'Amount', style: { width: '110px' } });
  const msgIn = el('input', { class: 'input grow', placeholder: 'Message (optional)' }), anonIn = el('input', { type: 'checkbox' });

  // thermometer: a fixed SVG whose fill rect is animated by rAF
  thermo.innerHTML = thermoSvg(0);
  const svg = thermo.firstChild, rects = () => svg.querySelectorAll('rect');
  const TOP = 20, H = 240;
  function paintThermo(pct) {
    const f = rects()[1]; if (!f) return; const fh = H * Math.min(100, pct) / 100;
    f.setAttribute('y', TOP + H - fh); f.setAttribute('height', fh + 20);
    svg.setAttribute('aria-label', Math.round(pct) + ' percent of goal');
  }
  const stop = loop(dt => {
    const target = st.goal ? Math.min(100, total() / st.goal * 100) : 0;
    if (Math.abs(target - shown) < 0.05) { if (shown !== target) { shown = target; paintThermo(shown); if (nums.firstChild) nums.firstChild.textContent = money(total(), st.cur); } return; }
    shown += (target - shown) * Math.min(1, dt * 4); paintThermo(shown);
    if (nums.firstChild) nums.firstChild.textContent = money(Math.round(total() * (shown / (target || 1)) * 100) / 100, st.cur);
  });

  function drawNums() {
    const t = total(), pct = st.goal ? t / st.goal * 100 : 0, big = st.donations.length ? Math.max(...st.donations.map(d => d.amount)) : 0;
    render(nums, el('div', { class: 'huge', style: { color: 'var(--danger)', fontSize: '44px' } }, money(t, st.cur)), el('div', { class: 'muted' }, `raised of ${money(st.goal, st.cur)} goal`), pct >= 100 ? el('span', { class: 'badge ok' }, 'Goal reached!') : el('span', { class: 'badge' }, Math.round(pct) + '%'));
    render(stats, stat(st.donations.length, 'donations'), stat(money(st.donations.length ? t / st.donations.length : 0, st.cur), 'average'), stat(money(big, st.cur), 'largest'), stat(money(Math.max(0, st.goal - t), st.cur), 'to go'));
  }
  function drawList() {
    render(listBox, st.donations.length ? el('table', { class: 'table' }, el('thead', {}, el('tr', {}, ['When', 'Donor', 'Amount', 'Message', ''].map(h => el('th', {}, h)))),
      el('tbody', {}, [...st.donations].reverse().map(d => el('tr', {}, el('td', { class: 'small muted' }, new Date(d.ts).toLocaleDateString()), el('td', {}, d.anon ? el('i', {}, 'Anonymous') : d.name || 'Friend'), el('td', {}, money(d.amount, st.cur)), el('td', { class: 'small' }, d.msg), el('td', {}, el('button', { class: 'btn small ghost', onclick: () => { st.donations = st.donations.filter(x => x !== d); save(); drawAll(); } }, '✕')))))) : el('div', { class: 'muted small' }, 'No donations yet.'));
  }
  function showTicker() {
    const list = [...st.donations].reverse().slice(0, 8);
    if (!list.length) { ticker.textContent = 'Recent donors will appear here'; return; }
    const d = list[tickIdx % list.length]; tickIdx++;
    ticker.style.opacity = '0';
    setTimeout(() => { ticker.replaceChildren(el('b', {}, d.anon ? 'Anonymous' : d.name || 'Friend'), ' gave ', el('b', {}, money(d.amount, st.cur)), d.msg ? el('div', { class: 'small muted' }, '“' + d.msg + '”') : null); ticker.style.opacity = '1'; }, 350);
  }
  function add() {
    const amount = Math.round((+amtIn.value || 0) * 100) / 100;
    if (!(amount > 0)) { toast('Enter an amount above 0'); return; }
    st.donations.push({ id: uid(), name: nameIn.value.trim(), amount, msg: msgIn.value.trim(), anon: anonIn.checked, ts: Date.now() });
    nameIn.value = amtIn.value = msgIn.value = ''; anonIn.checked = false; save(); tickIdx = 0; drawAll(); showTicker();
  }
  function drawAll() { drawNums(); drawList(); }
  const iv = setInterval(showTicker, 3500);

  render(root,
    el('div', { class: 'muted small' }, 'Local tool: you record donations yourself (no payments happen here). Data stays in this browser; "Download standalone page" makes a single HTML file to share or host.'),
    el('div', { class: 'grid2', style: { alignItems: 'center', marginTop: '10px' } }, thermo, el('div', {}, nums, stats)),
    ticker,
    h3('Add a donation'),
    el('div', { class: 'row' }, nameIn, amtIn, msgIn, el('label', { class: 'inline' }, anonIn, 'Anonymous'), el('button', { class: 'btn primary', onclick: add }, 'Add')),
    h3('Campaign'),
    el('div', { class: 'grid2' }, field('Title', el('input', { class: 'input', placeholder: 'Help us reach the goal', value: st.title, oninput: e => { st.title = e.target.value; save(); } })),
      el('div', { class: 'row', style: { margin: 0 } }, field('Goal', el('input', { class: 'input', type: 'number', min: 1, value: st.goal, oninput: e => { st.goal = Math.max(1, +e.target.value || 1); save(); drawNums(); } })), field('Currency symbol', el('input', { class: 'input', style: { width: '80px' }, value: st.cur, oninput: e => { st.cur = e.target.value; save(); drawAll(); } }))),
      field('Story', el('textarea', { class: 'textarea prose', style: { minHeight: '70px' }, value: st.story, oninput: e => { st.story = e.target.value; save(); } }))),
    h3('Donations'), listBox,
    el('div', { class: 'row' }, el('button', { class: 'btn primary', onclick: () => download('fundraiser.html', buildHtml(st), 'text/html') }, 'Download standalone page')));
  drawAll(); showTicker();
  return () => { stop(); clearInterval(iv); };
}
