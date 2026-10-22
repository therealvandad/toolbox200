// Idle bakery: click to bake, buy producers with exponential costs, offline progress, prestige.
import { el, render, store, toast, loop } from '../../lib/ui.js';

const PRODUCERS = [
  { id: 'cursor', name: 'Rolling pin', base: 15, cps: 0.1, icon: '🪵' },
  { id: 'baker', name: 'Baker', base: 100, cps: 1, icon: '🧑‍🍳' },
  { id: 'oven', name: 'Oven', base: 1100, cps: 8, icon: '🔥' },
  { id: 'shop', name: 'Bakery shop', base: 12000, cps: 47, icon: '🏪' },
  { id: 'factory', name: 'Cookie factory', base: 130000, cps: 260, icon: '🏭' },
  { id: 'portal', name: 'Flour portal', base: 1.4e6, cps: 1400, icon: '🌀' },
];
const UPGRADES = [
  { id: 'u1', name: 'Stronger fingers', desc: 'Clicks are worth x2', cost: 100, click: 2 },
  { id: 'u2', name: 'Steel rolling pins', desc: 'Rolling pins x2', cost: 500, prod: 'cursor', mult: 2 },
  { id: 'u3', name: 'Baker school', desc: 'Bakers x2', cost: 2000, prod: 'baker', mult: 2 },
  { id: 'u4', name: 'Convection ovens', desc: 'Ovens x2', cost: 15000, prod: 'oven', mult: 2 },
  { id: 'u5', name: 'Golden spatula', desc: 'Clicks are worth x3', cost: 25000, click: 3 },
  { id: 'u6', name: 'Franchise', desc: 'Shops x2', cost: 150000, prod: 'shop', mult: 2 },
  { id: 'u7', name: 'Automation', desc: 'Factories x2', cost: 1.5e6, prod: 'factory', mult: 2 },
  { id: 'u8', name: 'Sugar rush', desc: 'All production x1.5', cost: 5e6, all: 1.5 },
];

export default function (root) {
  const s = store('idle-bakery');
  const def = () => ({ cookies: 0, total: 0, clicks: 0, owned: {}, upgrades: [], prestige: 0, lastSave: Date.now() });
  let g = Object.assign(def(), s.get('save', {}));

  const fmt = n => n < 1000 ? n.toFixed(n < 10 && n % 1 ? 1 : 0) : n < 1e6 ? (n / 1e3).toFixed(1) + 'k' : n < 1e9 ? (n / 1e6).toFixed(2) + 'M' : n < 1e12 ? (n / 1e9).toFixed(2) + 'B' : (n / 1e12).toFixed(2) + 'T';
  const cost = p => Math.ceil(p.base * Math.pow(1.15, g.owned[p.id] || 0));
  const prestigeMult = () => 1 + g.prestige * 0.1;
  const clickValue = () => { let v = 1; for (const u of UPGRADES) if (g.upgrades.includes(u.id) && u.click) v *= u.click; return v * prestigeMult() + cps() * 0.01; };
  function cps() {
    let total = 0;
    for (const p of PRODUCERS) {
      let m = 1; for (const u of UPGRADES) if (g.upgrades.includes(u.id) && u.prod === p.id) m *= u.mult;
      total += (g.owned[p.id] || 0) * p.cps * m;
    }
    for (const u of UPGRADES) if (g.upgrades.includes(u.id) && u.all) total *= u.all;
    return total * prestigeMult();
  }
  const prestigeGain = () => Math.floor(Math.cbrt(g.total / 1e6));

  // offline progress
  const away = (Date.now() - (g.lastSave || Date.now())) / 1000;
  if (away > 10 && cps() > 0) { const earned = cps() * Math.min(away, 8 * 3600) * 0.5; g.cookies += earned; g.total += earned; toast(`Welcome back! You earned ${fmt(earned)} cookies while away (${Math.round(away / 60)} min, 50% rate, max 8h).`, 4000); }

  const cookieBtn = el('button', { class: 'btn', style: { fontSize: '64px', lineHeight: 1, padding: '20px', borderRadius: '50%', width: '130px', height: '130px', userSelect: 'none' }, title: 'Bake (or press Space)' }, '🍪');
  const counter = el('div', { class: 'huge', style: { fontWeight: 700 } });
  const rate = el('div', { class: 'muted' });
  const shop = el('div', { class: 'col', style: { gap: '6px' } });
  const upgradeList = el('div', { class: 'row' });
  const prestigeInfo = el('div', { class: 'small muted' });
  const floaters = el('div', { style: { position: 'relative', height: '0' } });
  let prestigeBtn;

  function bake(e) {
    const v = clickValue(); g.cookies += v; g.total += v; g.clicks++;
    const f = el('span', { class: 'small', style: { position: 'absolute', left: (10 + Math.random() * 100) + 'px', top: '-20px', color: 'var(--ok)', transition: 'transform .7s, opacity .7s', pointerEvents: 'none' } }, '+' + fmt(v));
    floaters.append(f); requestAnimationFrame(() => { f.style.transform = 'translateY(-40px)'; f.style.opacity = '0'; }); setTimeout(() => f.remove(), 700);
    cookieBtn.style.transform = 'scale(0.92)'; setTimeout(() => cookieBtn.style.transform = '', 80);
    renderAll();
  }
  cookieBtn.addEventListener('click', bake);

  function buy(p, n) {
    for (let i = 0; i < n; i++) { const c = cost(p); if (g.cookies < c) break; g.cookies -= c; g.owned[p.id] = (g.owned[p.id] || 0) + 1; }
    renderAll();
  }
  function renderShop() {
    render(shop, PRODUCERS.map(p => {
      const c = cost(p), can = g.cookies >= c;
      return el('div', { class: 'row panel', style: { opacity: can ? 1 : 0.6, margin: 0, padding: '8px 10px' } },
        el('span', { style: { fontSize: '22px' } }, p.icon),
        el('div', { class: 'grow' }, el('b', {}, p.name), ' ', el('span', { class: 'badge' }, g.owned[p.id] || 0), el('div', { class: 'small muted' }, fmt(p.cps * prestigeMult()) + ' cps each · cost ' + fmt(c))),
        el('button', { class: 'btn small primary', disabled: !can, onclick: () => buy(p, 1) }, 'Buy'),
        el('button', { class: 'btn small', disabled: !can, onclick: () => buy(p, 10) }, 'x10'));
    }));
    render(upgradeList, UPGRADES.filter(u => !g.upgrades.includes(u.id)).slice(0, 4).map(u =>
      el('button', { class: 'btn small', disabled: g.cookies < u.cost, title: u.desc, onclick: () => { if (g.cookies < u.cost) return; g.cookies -= u.cost; g.upgrades.push(u.id); toast(u.name + ' bought'); renderAll(); } }, u.name, ' — ', fmt(u.cost), el('div', { class: 'small muted' }, u.desc))));
    if (!upgradeList.children.length) upgradeList.append(el('span', { class: 'small muted' }, 'All upgrades bought.'));
    const pg = prestigeGain();
    if (prestigeBtn) prestigeBtn.disabled = pg < 1;
    render(prestigeInfo, `Prestige: ${g.prestige} stars (+${Math.round((prestigeMult() - 1) * 100)}% production). Resetting now would give ${pg} star${pg === 1 ? '' : 's'} (1 per cube root of total cookies / 1M).`);
  }
  function renderAll() {
    counter.textContent = fmt(g.cookies) + ' cookies';
    rate.textContent = `${fmt(cps())} per second · ${fmt(clickValue())} per click · ${fmt(g.total)} baked all time`;
    renderShop();
  }
  let acc = 0, saveAcc = 0;
  const stop = loop(dt => {
    const v = cps() * dt; g.cookies += v; g.total += v; acc += dt; saveAcc += dt;
    counter.textContent = fmt(g.cookies) + ' cookies';
    if (acc > 0.5) { acc = 0; renderShop(); rate.textContent = `${fmt(cps())} per second · ${fmt(clickValue())} per click · ${fmt(g.total)} baked all time`; }
    if (saveAcc > 5) { saveAcc = 0; save(); }
  });
  function save() { g.lastSave = Date.now(); s.set('save', g); }
  const onKey = e => { if (e.key === ' ' && !e.repeat && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) { e.preventDefault(); bake(); } };
  window.addEventListener('keydown', onKey);
  const onVis = () => save();
  document.addEventListener('visibilitychange', onVis);

  render(root,
    el('div', { class: 'row', style: { alignItems: 'flex-start' } },
      el('div', { class: 'col center', style: { minWidth: '200px', gap: '8px' } }, cookieBtn, floaters, counter, rate,
        el('div', { class: 'small muted' }, 'Click the cookie or press ', el('span', { class: 'kbd' }, 'Space'))),
      el('div', { class: 'grow', style: { minWidth: '260px' } }, el('b', {}, 'Shop'), shop)),
    el('div', {}, el('b', {}, 'Upgrades'), upgradeList),
    el('div', { class: 'panel' }, el('b', {}, 'Prestige'), prestigeInfo,
      el('div', { class: 'row' },
        prestigeBtn = el('button', { class: 'btn', disabled: prestigeGain() < 1, onclick: () => { const pg = prestigeGain(); if (pg < 1) return toast('Bake 1M cookies first'); const p = g.prestige + pg; g = def(); g.prestige = p; save(); toast('Prestiged! +' + pg + ' stars'); renderAll(); } }, 'Prestige (reset for permanent bonus)'),
        el('button', { class: 'btn ghost small', onclick: save }, 'Save now'),
        el('button', { class: 'btn danger small', onclick: () => { g = def(); save(); renderAll(); toast('Wiped'); } }, 'Hard reset'))));
  renderAll();
  return () => { stop(); save(); window.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onVis); };
}
