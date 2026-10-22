import { registry, categories } from './registry.js';
import { el, render } from './lib/ui.js';

const main = document.getElementById('main');
const sidebar = document.getElementById('sidebar');
const search = document.getElementById('search');
const themeBtn = document.getElementById('theme');
let cleanup = null;
let nav = 0; // bumps on every navigation so a slow async render cannot leak its cleanup

// ---- theme ----
const savedTheme = localStorage.getItem('tb200:theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
document.documentElement.dataset.theme = savedTheme;
themeBtn.onclick = () => {
  const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = t; localStorage.setItem('tb200:theme', t);
};

// ---- sidebar ----
function drawSidebar(active) {
  render(sidebar,
    el('a', { href: '#/', class: active === '' ? 'active' : '' }, 'All tools', el('span', { class: 'count' }, registry.length)),
    categories.map(c => el('a', { href: '#/cat/' + c.slug, class: active === c.slug ? 'active' : '' }, c.title,
      el('span', { class: 'count' }, registry.filter(t => t.category === c.slug).length))),
  );
}

// ---- grid ----
function catTitle(slug) { return (categories.find(c => c.slug === slug) || {}).title || slug; }
function card(t) {
  return el('a', { class: 'card-link', href: '#/tool/' + t.id },
    el('div', { class: 'num' }, '#' + t.num + ' · ' + catTitle(t.category)),
    el('h3', {}, t.title),
    el('p', {}, t.desc));
}

function showGrid(catSlug = '', q = '') {
  teardown();
  drawSidebar(catSlug);
  let list = registry;
  if (catSlug) list = list.filter(t => t.category === catSlug);
  if (q) {
    const needle = q.toLowerCase().split(/\s+/).filter(Boolean);
    list = list.filter(t => { const hay = (t.title + ' ' + t.desc + ' ' + (t.keywords || '') + ' ' + t.num).toLowerCase(); return needle.every(n => hay.includes(n)); });
  }
  if (!list.length) { render(main, el('div', { class: 'empty' }, 'Nothing matches.')); return; }
  if (catSlug || q) { render(main, el('div', { class: 'cards' }, list.map(card))); return; }
  render(main, categories.map(c => {
    const items = list.filter(t => t.category === c.slug);
    return items.length ? [el('h2', { class: 'section-title' }, c.title), el('div', { class: 'cards' }, items.map(card))] : null;
  }));
}

// ---- tool ----
async function showTool(id) {
  const t = registry.find(x => x.id === id);
  if (!t) { location.hash = '#/'; return; }
  teardown();
  const myNav = nav;
  drawSidebar(t.category);
  const root = el('div', { class: 'tool' });
  render(main,
    el('div', { class: 'tool-head' },
      el('a', { class: 'back', href: '#/cat/' + t.category }, '← ' + catTitle(t.category)),
      el('h1', {}, t.title),
      el('span', { class: 'badge' }, '#' + t.num),
      el('div', { class: 'desc' }, t.desc)),
    root);
  document.title = t.title + ' · Toolbox 200';
  try {
    const mod = await t.load();
    const fn = mod.default || mod.render;
    const result = await fn(root, { tool: t });
    if (typeof result === 'function') {
      if (myNav === nav) cleanup = result;
      else { try { result(); } catch {} } // user already left: tear down immediately
    }
  } catch (e) {
    console.error('Tool failed:', id, e);
    render(root, el('div', { class: 'empty' }, 'This tool failed to load: ' + e.message));
  }
}

function teardown() {
  nav++;
  if (cleanup) { try { cleanup(); } catch {} cleanup = null; }
  document.title = 'Toolbox 200';
}

// ---- routing ----
function route() {
  const h = location.hash.replace(/^#\/?/, '');
  if (h.startsWith('tool/')) return showTool(h.slice(5));
  if (h.startsWith('cat/')) { search.value = ''; return showGrid(h.slice(4)); }
  showGrid('', search.value.trim());
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
search.addEventListener('input', () => { if (location.hash && location.hash !== '#/') location.hash = '#/'; else showGrid('', search.value.trim()); });
document.addEventListener('keydown', e => {
  if (e.key === '/' && document.activeElement !== search && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !document.activeElement.isContentEditable) { e.preventDefault(); search.focus(); }
});
route();

// Dev aid: warn about duplicate ids.
const seen = new Set();
for (const t of registry) { if (seen.has(t.id)) console.warn('Duplicate tool id', t.id); seen.add(t.id); }
