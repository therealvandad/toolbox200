// Package version diff: compare two package.json manifests (pasted or fetched from the npm registry).
import { el, render, store, copy, toast, field, stat } from '../../lib/ui.js';

const SECTIONS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
const META = ['name', 'version', 'license', 'main', 'module', 'types', 'type', 'engines', 'packageManager'];

const SAMPLE_A = JSON.stringify({ name: 'my-app', version: '1.4.2', license: 'MIT', scripts: { dev: 'vite', build: 'vite build', test: 'jest', lint: 'eslint src' }, dependencies: { react: '^17.0.2', 'react-dom': '^17.0.2', axios: '~0.27.2', lodash: '^4.17.21', moment: '^2.29.4' }, devDependencies: { vite: '^3.2.0', jest: '^28.1.0', eslint: '^8.20.0', typescript: '^4.8.4' }, engines: { node: '>=14' } }, null, 2);
const SAMPLE_B = JSON.stringify({ name: 'my-app', version: '2.0.0', license: 'MIT', scripts: { dev: 'vite', build: 'tsc && vite build', test: 'vitest run', lint: 'eslint src', typecheck: 'tsc --noEmit' }, dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0', axios: '^1.6.2', lodash: '^4.17.21', dayjs: '^1.11.10' }, devDependencies: { vite: '^3.2.5', vitest: '^0.34.6', eslint: '^8.55.0', typescript: '^5.3.2' }, engines: { node: '>=18' } }, null, 2);

function semver(str) {
  const m = String(str).match(/(\d+)\.(\d+)(?:\.(\d+))?(?:-([\w.]+))?/);
  if (!m) return null;
  return { major: +m[1], minor: +m[2], patch: +(m[3] || 0), pre: m[4] || '', prefix: String(str).slice(0, m.index).trim() };
}
/** Classify the change between two version strings. */
function classify(a, b) {
  if (a === b) return 'same';
  const va = semver(a), vb = semver(b);
  if (!va || !vb) return 'changed';
  const cmp = va.major - vb.major || va.minor - vb.minor || va.patch - vb.patch;
  const down = cmp > 0;
  let kind;
  if (va.major !== vb.major) kind = 'major';
  else if (va.minor !== vb.minor) kind = 'minor';
  else if (va.patch !== vb.patch) kind = 'patch';
  else if (va.pre !== vb.pre) kind = 'prerelease';
  else return 'range';
  return down ? kind + ' ↓' : kind;
}
const badgeClass = k => /major/.test(k) ? 'danger' : /minor/.test(k) ? 'warn' : /patch/.test(k) ? 'ok' : '';

function diffMap(a = {}, b = {}) {
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  const rows = [];
  for (const k of keys) {
    if (!(k in a)) rows.push({ name: k, kind: 'added', from: '', to: b[k] });
    else if (!(k in b)) rows.push({ name: k, kind: 'removed', from: a[k], to: '' });
    else if (String(a[k]) !== String(b[k])) rows.push({ name: k, kind: classify(String(a[k]), String(b[k])), from: a[k], to: b[k] });
  }
  return rows;
}

export default function (root) {
  const s = store('version-diff');
  const saved = s.get('sides', { a: SAMPLE_A, b: SAMPLE_B });
  const msg = el('div', { class: 'small', style: { minHeight: '1.4em' } });
  const out = el('div');
  let t = null, lastReport = '';

  function side(key, label) {
    const ta = el('textarea', { class: 'textarea', spellcheck: false, placeholder: `Paste package.json ${label}…`, value: saved[key] || '', style: { minHeight: '180px' } });
    const nameIn = el('input', { class: 'input', placeholder: 'package name', style: { flex: '1', minWidth: '120px' } });
    const verIn = el('input', { class: 'input', placeholder: 'version or tag', value: 'latest', style: { width: '110px' } });
    const btn = el('button', { class: 'btn small', onclick: fetchIt }, 'Fetch from npm');
    async function fetchIt() {
      const name = nameIn.value.trim(), ver = verIn.value.trim() || 'latest';
      if (!name) return toast('Enter a package name');
      btn.disabled = true; render(msg, el('span', { class: 'muted' }, `Fetching ${name}@${ver}…`));
      try {
        const r = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name).replace('%40', '@')}/${encodeURIComponent(ver)}`);
        if (!r.ok) throw new Error(r.status === 404 ? 'not found (check name and version)' : 'HTTP ' + r.status);
        const j = await r.json();
        const keep = {};
        for (const k of [...META, 'description', 'scripts', ...SECTIONS]) if (k in j) keep[k] = j[k];
        ta.value = JSON.stringify(keep, null, 2);
        render(msg, el('span', { class: 'muted' }, `Loaded ${j.name}@${j.version}`));
        update();
      } catch (e) { render(msg, el('span', { style: { color: 'var(--danger)' } }, `Fetch failed: ${e.message}. The registry needs a network connection; you can also paste the manifest.`)); }
      btn.disabled = false;
    }
    for (const i of [nameIn, verIn]) i.addEventListener('keydown', e => { if (e.key === 'Enter') fetchIt(); });
    ta.addEventListener('input', () => { clearTimeout(t); t = setTimeout(update, 250); });
    const box = el('div', { class: 'col' },
      el('div', { class: 'row', style: { margin: 0 } }, el('strong', {}, label), el('span', { class: 'grow' }), nameIn, verIn, btn),
      ta);
    return { ta, box };
  }
  const A = side('a', 'Before (A)'), B = side('b', 'After (B)');

  function parse(txt) {
    if (!txt.trim()) return { err: 'empty' };
    try { const j = JSON.parse(txt); if (!j || typeof j !== 'object') throw 0; return { j }; } catch { return { err: 'invalid JSON' }; }
  }
  function table(rows, cols, label) {
    if (!rows.length) return el('p', { class: 'muted small' }, `No changes in ${label}.`);
    return el('div', { class: 'scroll-x' }, el('table', { class: 'table' },
      el('thead', {}, el('tr', {}, ...cols.map(c => el('th', {}, c)))),
      el('tbody', {}, ...rows.map(r => el('tr', {},
        el('td', { class: 'mono' }, r.name),
        el('td', { class: 'mono small', style: { color: r.kind === 'added' ? 'var(--muted)' : '' } }, r.from === '' ? '—' : String(r.from)),
        el('td', { class: 'mono small' }, r.to === '' ? '—' : String(r.to)),
        el('td', {}, el('span', { class: 'badge ' + (r.kind === 'added' ? 'ok' : r.kind === 'removed' ? 'danger' : badgeClass(r.kind)) }, r.kind)))))));
  }

  function update() {
    s.set('sides', { a: A.ta.value, b: B.ta.value });
    const pa = parse(A.ta.value), pb = parse(B.ta.value);
    if (pa.err || pb.err) {
      render(out, el('p', { class: 'muted' }, pa.err && pb.err ? 'Paste or fetch two manifests to compare.' : `Side ${pa.err ? 'A' : 'B'} is ${pa.err || pb.err}.`));
      lastReport = ''; return;
    }
    const a = pa.j, b = pb.j;
    const meta = diffMap(Object.fromEntries(META.filter(k => k in a).map(k => [k, JSON.stringify(a[k])])), Object.fromEntries(META.filter(k => k in b).map(k => [k, JSON.stringify(b[k])])))
      .map(r => ({ ...r, from: r.from === '' ? '' : r.from.replace(/^"|"$/g, ''), to: r.to === '' ? '' : r.to.replace(/^"|"$/g, ''), kind: r.name === 'version' && r.from && r.to ? classify(r.from, r.to) : r.kind }));
    const sections = SECTIONS.map(k => ({ k, rows: diffMap(a[k], b[k]) })).filter(x => a[x.k] || b[x.k] || x.rows.length);
    const scripts = diffMap(a.scripts, b.scripts).map(r => ({ ...r, kind: r.kind === 'added' || r.kind === 'removed' ? r.kind : 'changed' }));
    const all = sections.flatMap(x => x.rows);
    const count = re => all.filter(r => re.test(r.kind)).length;
    const md = [`# ${a.name || 'A'}@${a.version || '?'} → ${b.name || 'B'}@${b.version || '?'}`, ''];
    const mdTable = (rows, hdr) => { md.push(`| ${hdr} | before | after | change |`, '|---|---|---|---|'); rows.forEach(r => md.push(`| ${r.name} | ${r.from || '—'} | ${r.to || '—'} | ${r.kind} |`)); md.push(''); };
    if (meta.length) { md.push('## Package fields'); mdTable(meta, 'field'); }
    for (const x of sections) if (x.rows.length) { md.push(`## ${x.k}`); mdTable(x.rows, 'package'); }
    if (scripts.length) { md.push('## scripts'); mdTable(scripts, 'script'); }
    lastReport = md.join('\n');
    render(out,
      el('div', { class: 'row' }, stat(count(/added/), 'added'), stat(count(/removed/), 'removed'), stat(count(/major/), 'major bumps'), stat(count(/minor/), 'minor bumps'), stat(count(/patch/), 'patch bumps'), stat(scripts.length, 'script changes')),
      el('h3', { style: { margin: '14px 0 4px', fontSize: '15px' } }, 'Package fields'),
      table(meta, ['Field', 'Before', 'After', 'Change'], 'package fields'),
      ...sections.flatMap(x => [el('h3', { style: { margin: '14px 0 4px', fontSize: '15px' } }, x.k), table(x.rows, ['Package', 'Before', 'After', 'Change'], x.k)]),
      el('h3', { style: { margin: '14px 0 4px', fontSize: '15px' } }, 'scripts'),
      table(scripts, ['Script', 'Before', 'After', 'Change'], 'scripts'),
      el('p', { class: 'muted small' }, 'Classification compares the first x.y.z found in each range: a different major is "major", etc. "range" means the same version with a different operator (^ vs ~). "↓" marks a downgrade. Non-semver specs (git URLs, workspace:*, tags) are just "changed".'));
  }

  render(root,
    el('div', { class: 'grid2' }, A.box, B.box),
    el('div', { class: 'row' }, msg, el('span', { class: 'grow' }),
      el('button', { class: 'btn primary', onclick: () => lastReport ? copy(lastReport) : toast('Nothing to copy yet') }, 'Copy Markdown report'),
      el('button', { class: 'btn ghost small', onclick: () => { A.ta.value = SAMPLE_A; B.ta.value = SAMPLE_B; update(); } }, 'Sample'),
      el('button', { class: 'btn ghost small', onclick: () => { [A.ta, B.ta].forEach(x => x.value = ''); update(); } }, 'Clear')),
    out);
  update();
  return () => clearTimeout(t);
}
