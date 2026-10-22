// robots.txt and sitemap tester: parse groups, test a path with the longest-match rule, validate sitemaps.
import { el, render, store, toast, field, stat } from '../../lib/ui.js';

const SAMPLE = `User-agent: *
Disallow: /admin/
Disallow: /tmp/
Allow: /admin/public/
Disallow: /*.pdf$

User-agent: Googlebot
Allow: /
Disallow: /private/

User-agent: BadBot
Disallow: /

Sitemap: https://example.com/sitemap.xml
`;

const SAMPLE_SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc><lastmod>2026-01-05</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>
  <url><loc>https://example.com/about</loc><lastmod>2025-11-30T10:00:00+00:00</lastmod><priority>0.8</priority></url>
  <url><loc>https://example.com/blog</loc><lastmod>05/01/2026</lastmod><changefreq>often</changefreq><priority>1.5</priority></url>
</urlset>`;

export function parseRobots(text) {
  const groups = []; const sitemaps = []; const errors = [];
  let cur = null, lastWasUA = false;
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) return;
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) { errors.push(`Line ${i + 1}: cannot parse "${raw.trim()}"`); return; }
    const key = m[1].toLowerCase(), val = m[2].trim();
    if (key === 'user-agent') {
      if (!lastWasUA || !cur) { cur = { agents: [], rules: [], line: i + 1 }; groups.push(cur); }
      cur.agents.push(val.toLowerCase());
      lastWasUA = true; return;
    }
    lastWasUA = false;
    if (key === 'sitemap') { sitemaps.push(val); return; }
    if (key === 'allow' || key === 'disallow') {
      if (!cur) { errors.push(`Line ${i + 1}: ${key} before any User-agent (ignored)`); return; }
      if (val && !val.startsWith('/') && !val.startsWith('*')) errors.push(`Line ${i + 1}: path "${val}" should start with /`);
      cur.rules.push({ allow: key === 'allow', path: val, line: i + 1 });
      return;
    }
    if (key === 'crawl-delay' || key === 'host' || key === 'clean-param') { if (cur) cur[key] = val; return; }
    errors.push(`Line ${i + 1}: unknown directive "${m[1]}"`);
  });
  return { groups, sitemaps, errors };
}

function patternToRegex(p) {
  let re = '^';
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === '*') re += '.*';
    else if (c === '$' && i === p.length - 1) re += '$';
    else re += c.replace(/[.+?^${}()|[\]\\/]/g, '\\$&');
  }
  return new RegExp(re);
}

export function pickGroup(groups, agent) {
  const a = agent.toLowerCase();
  let best = null, bestLen = -1;
  for (const g of groups) for (const ua of g.agents) {
    if (ua !== '*' && a.includes(ua) && ua.length > bestLen) { best = g; bestLen = ua.length; }
  }
  if (best) return best;
  return groups.find(g => g.agents.includes('*')) || null;
}

export function testPath(groups, agent, path) {
  const g = pickGroup(groups, agent);
  if (!g) return { allowed: true, reason: 'no matching group — everything allowed', group: null };
  let winner = null;
  for (const r of g.rules) {
    if (!r.path) continue; // empty Disallow = allow all; empty Allow is a no-op
    if (!patternToRegex(r.path).test(path)) continue;
    const len = r.path.length;
    if (!winner || len > winner.len || (len === winner.len && r.allow && !winner.rule.allow)) winner = { rule: r, len };
  }
  if (!winner) return { allowed: true, reason: 'no rule matches — allowed by default', group: g };
  return { allowed: winner.rule.allow, reason: `${winner.rule.allow ? 'Allow' : 'Disallow'}: ${winner.rule.path} (line ${winner.rule.line}, longest match)`, group: g, rule: winner.rule };
}

export function parseSitemap(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const perr = doc.querySelector('parsererror');
  if (perr) return { error: 'XML parse error: ' + perr.textContent.split('\n')[0].slice(0, 200) };
  const rootName = doc.documentElement.localName;
  const txt = (n, tag) => { const c = [...n.children].find(x => x.localName === tag); return c ? c.textContent.trim() : ''; };
  const W3C = /^\d{4}(-\d{2}(-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?)?)?$/;
  const FREQ = ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'];
  if (rootName === 'sitemapindex') {
    const items = [...doc.documentElement.children].filter(x => x.localName === 'sitemap').map(n => {
      const issues = [];
      const loc = txt(n, 'loc'), lastmod = txt(n, 'lastmod');
      if (!loc) issues.push('missing <loc>');
      if (lastmod && !W3C.test(lastmod)) issues.push('lastmod not W3C datetime');
      return { loc, lastmod, issues };
    });
    return { kind: 'sitemapindex', items };
  }
  if (rootName !== 'urlset') return { error: `Root element is <${rootName}>, expected <urlset> or <sitemapindex>` };
  const items = [...doc.documentElement.children].filter(x => x.localName === 'url').map(n => {
    const issues = [];
    const loc = txt(n, 'loc'), lastmod = txt(n, 'lastmod'), changefreq = txt(n, 'changefreq'), priority = txt(n, 'priority');
    if (!loc) issues.push('missing <loc>');
    else { try { const u = new URL(loc); if (!/^https?:$/.test(u.protocol)) issues.push('loc is not http(s)'); } catch { issues.push('loc is not an absolute URL'); } if (loc.length > 2048) issues.push('loc longer than 2048 chars'); }
    if (lastmod && !W3C.test(lastmod)) issues.push(`lastmod "${lastmod}" is not W3C datetime (YYYY-MM-DD or ISO 8601)`);
    if (lastmod && W3C.test(lastmod) && new Date(lastmod) > new Date(Date.now() + 86400000)) issues.push('lastmod is in the future');
    if (changefreq && !FREQ.includes(changefreq.toLowerCase())) issues.push(`changefreq "${changefreq}" invalid`);
    if (priority) { const p = Number(priority); if (!Number.isFinite(p) || p < 0 || p > 1) issues.push(`priority "${priority}" must be 0.0–1.0`); }
    return { loc, lastmod, changefreq, priority, issues };
  });
  const locs = items.map(i => i.loc); const dup = locs.filter((l, i) => l && locs.indexOf(l) !== i);
  const global = [];
  if (items.length > 50000) global.push(`${items.length} URLs — a sitemap may contain at most 50,000`);
  if (xml.length > 50 * 1024 * 1024) global.push('sitemap larger than 50 MB uncompressed');
  if (dup.length) global.push(`${new Set(dup).size} duplicate URL(s)`);
  const hosts = new Set(locs.map(l => { try { return new URL(l).host; } catch { return ''; } }).filter(Boolean));
  if (hosts.size > 1) global.push('URLs span multiple hosts: ' + [...hosts].join(', '));
  return { kind: 'urlset', items, global };
}

export default function (root) {
  const s = store('robots-tester');
  const ta = el('textarea', { class: 'textarea', style: { minHeight: '200px' }, placeholder: 'Paste robots.txt here…', value: s.get('robots', SAMPLE) });
  const urlIn = el('input', { class: 'input grow', placeholder: 'https://example.com (fetch /robots.txt)', style: { minWidth: '200px' } });
  const fetchMsg = el('span', { class: 'muted small' });
  const pathIn = el('input', { class: 'input grow', placeholder: '/admin/public/page.html', value: s.get('path', '/admin/public/index.html'), style: { minWidth: '180px' } });
  const uaSel = el('select', { class: 'select' });
  const uaCustom = el('input', { class: 'input', placeholder: 'custom user agent', style: { width: '160px' } });
  const result = el('div');
  const parsed = el('div');
  const smTa = el('textarea', { class: 'textarea', style: { minHeight: '160px' }, placeholder: 'Paste sitemap XML here…', value: s.get('sitemap', SAMPLE_SITEMAP) });
  const smOut = el('div');

  const AGENTS = ['*', 'Googlebot', 'Googlebot-Image', 'Bingbot', 'DuckDuckBot', 'Baiduspider', 'YandexBot', 'facebookexternalhit', 'Twitterbot', 'GPTBot', 'ClaudeBot', 'CCBot', 'AhrefsBot', 'SemrushBot'];
  render(uaSel, AGENTS.map(a => el('option', { value: a, selected: a === s.get('ua', 'Googlebot') }, a)), el('option', { value: '__custom' }, 'Custom…'));

  function currentUA() { return uaSel.value === '__custom' ? (uaCustom.value.trim() || '*') : uaSel.value; }

  function update() {
    const text = ta.value; s.set('robots', text); s.set('path', pathIn.value); s.set('ua', uaSel.value);
    const r = parseRobots(text);
    const ua = currentUA();
    let path = pathIn.value.trim() || '/';
    if (/^https?:\/\//i.test(path)) { try { const u = new URL(path); path = u.pathname + u.search; } catch {} }
    if (!path.startsWith('/')) path = '/' + path;
    const t = testPath(r.groups, ua, path);
    render(result, el('div', { class: 'panel' },
      el('div', { class: 'row', style: { margin: 0 } },
        el('span', { class: 'badge ' + (t.allowed ? 'ok' : 'danger'), style: { fontSize: '14px' } }, t.allowed ? 'ALLOWED' : 'BLOCKED'),
        el('span', { class: 'mono' }, path), el('span', { class: 'muted small' }, 'for ' + ua)),
      el('div', { class: 'small', style: { marginTop: '6px' } }, 'Decided by: ' + t.reason),
      t.group ? el('div', { class: 'muted small' }, `Group used: User-agent ${t.group.agents.join(', ')} (line ${t.group.line})`) : null));
    render(parsed,
      el('div', { class: 'row' }, stat(r.groups.length, 'groups'), stat(r.groups.reduce((a, g) => a + g.rules.length, 0), 'rules'), stat(r.sitemaps.length, 'sitemaps'), stat(r.errors.length, 'warnings')),
      r.errors.length ? el('div', { class: 'panel small', style: { color: 'var(--warn)' } }, r.errors.map(e => el('div', {}, e))) : null,
      r.groups.map(g => el('div', { class: 'panel', style: { marginTop: '8px', borderColor: g === t.group ? 'var(--accent)' : undefined } },
        el('div', {}, el('strong', {}, 'User-agent: ' + g.agents.join(', ')), g === t.group ? el('span', { class: 'badge', style: { marginLeft: '8px' } }, 'applies') : null,
          g['crawl-delay'] ? el('span', { class: 'muted small' }, ' · crawl-delay ' + g['crawl-delay']) : null),
        g.rules.length ? el('div', { class: 'mono small', style: { marginTop: '4px' } }, g.rules.map(rule => el('div', { style: { color: rule === t.rule ? 'var(--accent)' : rule.allow ? 'var(--ok)' : 'var(--danger)' } }, (rule.allow ? 'Allow: ' : 'Disallow: ') + (rule.path || '(empty — allow all)'))))
          : el('div', { class: 'muted small' }, 'no rules — everything allowed'))),
      r.sitemaps.length ? el('div', { class: 'small', style: { marginTop: '8px' } }, el('strong', {}, 'Sitemaps: '), r.sitemaps.map(u => el('div', { class: 'mono' }, u))) : null);
  }

  async function fetchRobots() {
    let u = urlIn.value.trim(); if (!u) return;
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    let origin; try { origin = new URL(u).origin; } catch { fetchMsg.textContent = 'Invalid URL'; return; }
    fetchMsg.textContent = 'Fetching…';
    try {
      const r = await fetch(origin + '/robots.txt', { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      ta.value = await r.text(); fetchMsg.textContent = 'Loaded ' + origin + '/robots.txt'; update();
    } catch (e) {
      fetchMsg.textContent = `Could not fetch (${e.message}). Most sites do not send CORS headers for robots.txt, so the browser blocks the read — open ${origin}/robots.txt in a tab and paste it here.`;
    }
  }
  urlIn.addEventListener('keydown', e => { if (e.key === 'Enter') fetchRobots(); });

  function updateSitemap() {
    const xml = smTa.value; s.set('sitemap', xml);
    if (!xml.trim()) { render(smOut); return; }
    const r = parseSitemap(xml);
    if (r.error) { render(smOut, el('div', { class: 'panel', style: { color: 'var(--danger)' } }, r.error)); return; }
    const bad = r.items.filter(i => i.issues.length).length;
    render(smOut,
      el('div', { class: 'row' }, stat(r.items.length, r.kind === 'sitemapindex' ? 'child sitemaps' : 'URLs'), stat(bad, 'with issues'), stat(r.items.filter(i => i.lastmod).length, 'with lastmod')),
      r.global?.length ? el('div', { class: 'panel small', style: { color: 'var(--warn)' } }, r.global.map(g => el('div', {}, g))) : null,
      el('div', { class: 'scroll-x' }, el('table', { class: 'table' },
        el('thead', {}, el('tr', {}, el('th', {}, 'URL'), el('th', {}, 'lastmod'), r.kind === 'urlset' ? [el('th', {}, 'changefreq'), el('th', {}, 'priority')] : null, el('th', {}, 'issues'))),
        el('tbody', {}, r.items.slice(0, 500).map(i => el('tr', {},
          el('td', { class: 'mono small', style: { wordBreak: 'break-all' } }, i.loc || el('span', { class: 'muted' }, '(none)')),
          el('td', { class: 'mono small' }, i.lastmod || ''),
          r.kind === 'urlset' ? [el('td', { class: 'small' }, i.changefreq || ''), el('td', { class: 'small' }, i.priority || '')] : null,
          el('td', { class: 'small' }, i.issues.length ? el('span', { style: { color: 'var(--danger)' } }, i.issues.join('; ')) : el('span', { class: 'badge ok' }, 'ok'))))))),
      r.items.length > 500 ? el('div', { class: 'muted small' }, `Showing first 500 of ${r.items.length}.`) : null);
  }

  ta.addEventListener('input', update);
  pathIn.addEventListener('input', update);
  pathIn.addEventListener('keydown', e => { if (e.key === 'Escape') { pathIn.value = '/'; update(); } });
  uaSel.addEventListener('change', () => { uaCustom.classList.toggle('hidden', uaSel.value !== '__custom'); update(); });
  uaCustom.addEventListener('input', update);
  uaCustom.classList.toggle('hidden', uaSel.value !== '__custom');
  smTa.addEventListener('input', updateSitemap);

  render(root,
    el('div', { class: 'row' }, urlIn, el('button', { class: 'btn', onclick: fetchRobots }, 'Fetch robots.txt'), el('button', { class: 'btn ghost small', onclick: () => { ta.value = SAMPLE; update(); } }, 'Load sample')),
    fetchMsg,
    ta,
    el('div', { class: 'row' }, field('Path to test', pathIn), field('User agent', el('div', { class: 'row', style: { margin: 0 } }, uaSel, uaCustom))),
    result,
    parsed,
    el('p', { class: 'muted small' }, 'Matching follows RFC 9309: the group whose user-agent token is the longest substring of the agent name applies (else *); among matching Allow/Disallow rules the longest path pattern wins, Allow wins ties. Patterns support * and a trailing $.'),
    el('h3', { style: { margin: '18px 0 6px', fontSize: '16px' } }, 'Sitemap validator'),
    el('div', { class: 'row' }, el('button', { class: 'btn ghost small', onclick: () => { smTa.value = SAMPLE_SITEMAP; updateSitemap(); } }, 'Load sample'), el('button', { class: 'btn ghost small', onclick: () => { smTa.value = ''; updateSitemap(); toast('Cleared'); } }, 'Clear')),
    smTa, smOut);
  update(); updateSitemap();
}
