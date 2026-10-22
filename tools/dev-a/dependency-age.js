// Dependency age checker: paste package.json, fetch registry.npmjs.org metadata, show latest version, majors behind and age.
import { el, render, store, copy, download, stat } from '../../lib/ui.js';

const SAMPLE = `{
  "name": "demo",
  "dependencies": {
    "express": "^4.17.1",
    "lodash": "~4.17.0",
    "react": "^17.0.2",
    "axios": "0.21.1",
    "moment": "^2.29.0"
  },
  "devDependencies": {
    "jest": "^26.6.3",
    "typescript": "^4.1.0",
    "eslint": "7.x"
  }
}`;

// ---------- minimal semver ----------
export function parseVer(v) {
  const m = String(v).trim().replace(/^[v=]/, '').match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);
  return m ? { major: +m[1], minor: +m[2], patch: +m[3], pre: m[4] || null } : null;
}
export function cmp(a, b) {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;
  if (!a.pre && !b.pre) return 0;
  if (!a.pre) return 1; if (!b.pre) return -1;
  return a.pre < b.pre ? -1 : a.pre > b.pre ? 1 : 0;
}
const mk = (M, m, p) => ({ major: M, minor: m, patch: p, pre: null });
// A partial like "1", "1.2", "1.x", "1.2.*" -> { lo, hiExclusive, parts }
function partial(str) {
  const m = str.replace(/^[v=]/, '').match(/^(\d+|x|X|\*)(?:\.(\d+|x|X|\*))?(?:\.(\d+|x|X|\*))?(?:-([0-9A-Za-z.-]+))?/);
  if (!m) return null;
  const isX = s => s == null || /^[xX*]$/.test(s);
  if (isX(m[1])) return { lo: mk(0, 0, 0), hi: null, parts: 0 };
  const M = +m[1];
  if (isX(m[2])) return { lo: mk(M, 0, 0), hi: mk(M + 1, 0, 0), parts: 1 };
  const mi = +m[2];
  if (isX(m[3])) return { lo: mk(M, mi, 0), hi: mk(M, mi + 1, 0), parts: 2 };
  return { lo: { major: M, minor: mi, patch: +m[3], pre: m[4] || null }, hi: null, parts: 3 };
}
/** Does version v satisfy range? Supports ^ ~ x-ranges, comparators, hyphen ranges and ||. Unknown ranges (tags, urls) -> null. */
export function satisfies(v, range) {
  const V = typeof v === 'string' ? parseVer(v) : v;
  if (!V) return false;
  range = String(range).trim();
  if (range === '' || range === '*' || range === 'latest') return true;
  if (/^(npm:|git|http|file:|link:|workspace:)/.test(range) || /^[a-z]/i.test(range)) return null;
  let known = true;
  const ok = range.split('||').some(alt => {
    alt = alt.trim();
    if (!alt || alt === '*') return true;
    const cmps = []; // [op, ver]
    if (/\s-\s/.test(alt)) {
      const [lo, hi] = alt.split(/\s+-\s+/);
      const a = partial(lo), b = partial(hi);
      if (!a || !b) { known = false; return false; }
      cmps.push(['>=', a.lo]);
      if (b.hi) cmps.push(['<', b.hi]); else cmps.push(['<=', b.lo]);
    } else {
      for (const tok of alt.split(/\s+/)) {
        const m = tok.match(/^(\^|~>?|>=|<=|>|<|=)?\s*(.+)$/);
        if (!m) { known = false; return false; }
        const op = m[1] || '', p = partial(m[2]);
        if (!p) { known = false; return false; }
        if (op === '^') {
          cmps.push(['>=', p.lo]);
          const l = p.lo;
          if (l.major > 0 || p.parts < 2) cmps.push(['<', mk(l.major + 1, 0, 0)]);
          else if (l.minor > 0 || p.parts < 3) cmps.push(['<', mk(0, l.minor + 1, 0)]);
          else cmps.push(['<', mk(0, 0, l.patch + 1)]);
        } else if (op.startsWith('~')) {
          cmps.push(['>=', p.lo]);
          cmps.push(['<', p.parts >= 2 ? mk(p.lo.major, p.lo.minor + 1, 0) : mk(p.lo.major + 1, 0, 0)]);
        } else if (op === '' || op === '=') {
          cmps.push(['>=', p.lo]); if (p.hi) cmps.push(['<', p.hi]); else cmps.push(['<=', p.lo]);
        } else if (op === '>' && p.hi) { cmps.push(['>=', p.hi]); }
        else if (op === '<=' && p.hi) { cmps.push(['<', p.hi]); }
        else cmps.push([op, p.lo]);
      }
    }
    return cmps.every(([op, w]) => {
      const c = cmp(V, w);
      if (V.pre && !w.pre) { // prerelease only satisfies when same major.minor.patch tuple has a prerelease comparator
        if (!(V.major === w.major && V.minor === w.minor && V.patch === w.patch)) return false;
      }
      return op === '>=' ? c >= 0 : op === '>' ? c > 0 : op === '<' ? c < 0 : op === '<=' ? c <= 0 : c === 0;
    });
  });
  return known ? ok : null;
}

function monthsBetween(a, b) { return Math.max(0, (b - a) / (1000 * 60 * 60 * 24 * 30.44)); }
function fmtDate(d) { return d ? d.toISOString().slice(0, 10) : '?'; }
function ageLabel(months) { if (months == null) return '?'; if (months < 1) return '<1 mo'; if (months < 24) return Math.round(months) + ' mo'; return (months / 12).toFixed(1) + ' yr'; }

export default function (root) {
  const s = store('dependency-age');
  const ta = el('textarea', { class: 'textarea', placeholder: 'Paste package.json…', value: s.get('json', ''), style: { minHeight: '180px' } });
  const incDev = el('input', { type: 'checkbox', checked: s.get('dev', true) });
  const incPeer = el('input', { type: 'checkbox', checked: s.get('peer', false) });
  const incOpt = el('input', { type: 'checkbox', checked: s.get('opt', false) });
  const runBtn = el('button', { class: 'btn primary', onclick: run }, 'Check');
  const cancelBtn = el('button', { class: 'btn hidden', onclick: () => abort && abort.abort() }, 'Cancel');
  const progress = el('div', { class: 'bar', style: { margin: '8px 0' } }, el('div', { style: { width: '0%' } }));
  const status = el('div', { class: 'small muted' });
  const stats = el('div', { class: 'row' });
  const out = el('div', { class: 'scroll-x' });
  let abort = null;
  let rows = [];

  function deps() {
    let pkg;
    try { pkg = JSON.parse(ta.value); } catch (e) { throw new Error('Invalid JSON: ' + e.message); }
    if (!pkg || typeof pkg !== 'object') throw new Error('package.json must be a JSON object');
    const list = [];
    const take = (obj, kind) => { for (const [name, range] of Object.entries(obj || {})) list.push({ name, range: String(range), kind }); };
    take(pkg.dependencies, 'dep');
    if (incDev.checked) take(pkg.devDependencies, 'dev');
    if (incPeer.checked) take(pkg.peerDependencies, 'peer');
    if (incOpt.checked) take(pkg.optionalDependencies, 'optional');
    if (!list.length) throw new Error('No dependencies found (check the include options).');
    return list;
  }

  async function fetchMeta(name, signal) {
    const url = 'https://registry.npmjs.org/' + name.replace('/', '%2F');
    let res;
    try { res = await fetch(url, { signal, headers: { Accept: 'application/json' } }); }
    catch (e) { if (e.name === 'AbortError') throw e; throw new Error('offline'); }
    if (res.status === 404) throw new Error('not found on npm');
    if (!res.ok) throw new Error('registry HTTP ' + res.status);
    return res.json();
  }

  function analyze(row, doc) {
    const now = new Date();
    const time = doc.time || {};
    const latestTag = doc['dist-tags'] && doc['dist-tags'].latest;
    const versions = Object.keys(doc.versions || {}).map(v => ({ v, p: parseVer(v) })).filter(x => x.p);
    const latest = latestTag && parseVer(latestTag) ? { v: latestTag, p: parseVer(latestTag) } : versions.filter(x => !x.p.pre).sort((a, b) => cmp(b.p, a.p))[0];
    row.latest = latest ? latest.v : '?';
    row.latestDate = latest && time[latest.v] ? new Date(time[latest.v]) : null;
    row.deprecated = latest && doc.versions[latest.v] && !!doc.versions[latest.v].deprecated;
    // highest version that the range allows (what a fresh install gets)
    const sat = versions.filter(x => !x.p.pre && satisfies(x.p, row.range) === true).sort((a, b) => cmp(b.p, a.p));
    const unknownRange = satisfies('1.0.0', row.range) === null;
    const resolved = sat[0] || null;
    row.resolved = resolved ? resolved.v : unknownRange ? '?' : 'none';
    row.resolvedDate = resolved && time[resolved.v] ? new Date(time[resolved.v]) : null;
    row.ageMonths = row.resolvedDate ? monthsBetween(row.resolvedDate, now) : null;
    row.latestAgeMonths = row.latestDate ? monthsBetween(row.latestDate, now) : null;
    if (latest && resolved) {
      row.majorsBehind = latest.p.major - resolved.p.major;
      row.minorsBehind = row.majorsBehind === 0 ? latest.p.minor - resolved.p.minor : null;
      row.rangeCoversLatest = satisfies(latest.p, row.range) === true;
      row.upToDate = cmp(resolved.p, latest.p) >= 0;
    } else { row.majorsBehind = null; row.rangeCoversLatest = unknownRange ? null : false; row.upToDate = false; }
    row.state = row.error ? 'error' : row.deprecated ? 'deprecated' : row.upToDate ? 'current' : row.majorsBehind > 0 ? 'major' : row.resolved === 'none' ? 'unresolved' : row.majorsBehind === 0 ? 'minor' : 'unknown';
  }

  async function run() {
    let list;
    try { list = deps(); } catch (e) { render(out, el('div', { class: 'panel', style: { borderColor: 'var(--danger)' } }, e.message)); render(stats); return; }
    s.set('json', ta.value); s.set('dev', incDev.checked); s.set('peer', incPeer.checked); s.set('opt', incOpt.checked);
    if (abort) abort.abort();
    abort = new AbortController();
    const signal = abort.signal;
    rows = list.map(d => ({ ...d, loading: true }));
    runBtn.disabled = true; cancelBtn.classList.remove('hidden');
    let done = 0, offline = 0;
    const CONC = 4;
    let idx = 0;
    draw();
    const worker = async () => {
      while (idx < rows.length && !signal.aborted) {
        const row = rows[idx++];
        try { const doc = await fetchMeta(row.name, signal); analyze(row, doc); }
        catch (e) {
          if (e.name === 'AbortError') { row.error = 'cancelled'; }
          else { row.error = e.message === 'offline' ? 'Could not reach registry.npmjs.org (offline or blocked)' : e.message; if (e.message === 'offline') offline++; }
          row.state = 'error';
        }
        row.loading = false; done++;
        progress.firstChild.style.width = Math.round(done / rows.length * 100) + '%';
        status.textContent = `${done} / ${rows.length} checked`;
        draw();
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONC, rows.length) }, worker));
    runBtn.disabled = false; cancelBtn.classList.add('hidden');
    if (signal.aborted) status.textContent = 'Cancelled.';
    else if (offline === rows.length) status.textContent = 'Every request failed: you appear to be offline, or registry.npmjs.org is blocked by your network.';
    else status.textContent = `${done} / ${rows.length} checked`;
    draw(true);
  }

  const order = { error: 0, deprecated: 1, major: 2, minor: 3, unresolved: 4, unknown: 5, current: 6 };
  function badgeFor(r) {
    if (r.loading) return el('span', { class: 'badge' }, '…');
    if (r.state === 'error') return el('span', { class: 'badge danger' }, 'error');
    if (r.state === 'deprecated') return el('span', { class: 'badge danger' }, 'deprecated');
    if (r.state === 'current') return el('span', { class: 'badge ok' }, 'up to date');
    if (r.state === 'major') return el('span', { class: 'badge danger' }, `${r.majorsBehind} major${r.majorsBehind > 1 ? 's' : ''} behind`);
    if (r.state === 'minor') return el('span', { class: 'badge warn' }, r.minorsBehind > 0 ? `${r.minorsBehind} minor${r.minorsBehind > 1 ? 's' : ''} behind` : 'patch behind');
    if (r.state === 'unresolved') return el('span', { class: 'badge warn' }, 'no version matches range');
    return el('span', { class: 'badge' }, 'unknown range');
  }
  function draw(final) {
    const sorted = [...rows].sort((a, b) => (a.loading ? 9 : order[a.state]) - (b.loading ? 9 : order[b.state]) || (b.ageMonths || 0) - (a.ageMonths || 0));
    render(out, el('table', { class: 'table' },
      el('thead', {}, el('tr', {}, el('th', {}, 'Package'), el('th', {}, 'Range'), el('th', {}, 'Range resolves to'), el('th', {}, 'Latest'), el('th', {}, 'Status'), el('th', {}, 'Age'))),
      el('tbody', {}, sorted.map(r => el('tr', {},
        el('td', {}, el('a', { href: 'https://www.npmjs.com/package/' + r.name, target: '_blank', rel: 'noopener', class: 'mono' }, r.name), r.kind !== 'dep' ? el('span', { class: 'muted small' }, ' ' + r.kind) : null),
        el('td', { class: 'mono' }, r.range),
        el('td', { class: 'mono small' }, r.loading ? '…' : r.error ? '' : [r.resolved, el('div', { class: 'muted' }, fmtDate(r.resolvedDate))]),
        el('td', { class: 'mono small' }, r.loading ? '…' : r.error ? '' : [r.latest, el('div', { class: 'muted' }, fmtDate(r.latestDate))]),
        el('td', {}, badgeFor(r), r.error ? el('div', { class: 'small muted' }, r.error) : r.rangeCoversLatest === false && r.state !== 'current' && !r.loading ? el('div', { class: 'small muted' }, 'range excludes latest; bump it') : r.state === 'minor' && r.rangeCoversLatest ? el('div', { class: 'small muted' }, 'range already allows latest') : null),
        el('td', { title: 'Age of the version your range resolves to' }, r.loading || r.error ? '' : [ageLabel(r.ageMonths), r.latestAgeMonths != null && r.state !== 'current' ? el('div', { class: 'small muted' }, 'latest: ' + ageLabel(r.latestAgeMonths) + ' old') : null]))))));
    if (final) {
      const ok = rows.filter(r => !r.error);
      const ages = ok.map(r => r.ageMonths).filter(a => a != null).sort((a, b) => a - b);
      const median = ages.length ? ages[Math.floor(ages.length / 2)] : null;
      render(stats,
        stat(rows.length, 'dependencies'),
        stat(ok.filter(r => r.state === 'current').length, 'up to date'),
        stat(ok.filter(r => r.state === 'major').length, 'major behind'),
        stat(ok.filter(r => r.state === 'deprecated').length, 'deprecated'),
        stat(median == null ? '—' : ageLabel(median), 'median age'),
        el('span', { class: 'grow' }),
        el('button', { class: 'btn small', onclick: () => download('dependency-age.csv', toCsv(), 'text/csv') }, 'Download CSV'),
        el('button', { class: 'btn small', onclick: () => copy(toMarkdown()) }, 'Copy Markdown'));
    }
  }
  const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  function toCsv() { return ['package,kind,range,resolved,resolved_date,latest,latest_date,majors_behind,age_months,status,error', ...rows.map(r => [r.name, r.kind, r.range, r.resolved, fmtDate(r.resolvedDate), r.latest, fmtDate(r.latestDate), r.majorsBehind ?? '', r.ageMonths == null ? '' : r.ageMonths.toFixed(1), r.state, r.error || ''].map(q).join(','))].join('\n'); }
  function toMarkdown() { return ['| Package | Range | Resolves to | Latest | Status | Age |', '|---|---|---|---|---|---|', ...rows.map(r => `| ${r.name} | ${r.range} | ${r.resolved || ''} | ${r.latest || ''} | ${r.error ? 'error: ' + r.error : r.state} | ${ageLabel(r.ageMonths)} |`)].join('\n'); }

  ta.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) run(); });
  render(root,
    ta,
    el('div', { class: 'row' },
      runBtn, cancelBtn,
      el('button', { class: 'btn ghost', onclick: () => { ta.value = SAMPLE; } }, 'Sample'),
      el('label', { class: 'inline' }, incDev, 'devDependencies'),
      el('label', { class: 'inline' }, incPeer, 'peerDependencies'),
      el('label', { class: 'inline' }, incOpt, 'optionalDependencies'),
      el('span', { class: 'muted small' }, 'Ctrl+Enter to run. Fetches registry.npmjs.org, 4 at a time; big packages have large metadata, so give it a moment.')),
    progress, status, stats, out);
  return () => { if (abort) abort.abort(); };
}
