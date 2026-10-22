// npm package size comparer: registry unpacked size + dependency count, and bundlephobia min/gzip when reachable.
import { el, render, store, copy, download, fmtBytes } from '../../lib/ui.js';

export default function (root) {
  const s = store('bundle-size');
  const input = el('textarea', { class: 'textarea', style: { minHeight: '80px' }, placeholder: 'One package per line or comma-separated, optionally with a version:\nlodash, dayjs@1.11.10, moment, date-fns', value: s.get('input', '') });
  const runBtn = el('button', { class: 'btn primary', onclick: run }, 'Compare');
  const cancelBtn = el('button', { class: 'btn hidden', onclick: () => abort && abort.abort() }, 'Cancel');
  const status = el('div', { class: 'small muted' });
  const metric = el('select', { class: 'select' }, [['gzip', 'Bars: minified + gzip'], ['min', 'Bars: minified'], ['unpacked', 'Bars: unpacked size'], ['deps', 'Bars: dependency count']].map(([v, t]) => el('option', { value: v }, t)));
  metric.value = s.get('metric', 'gzip');
  const out = el('div', { class: 'scroll-x' });
  let abort = null;
  let rows = s.get('rows', []);

  function parseInput() {
    const items = input.value.split(/[\n,]+/).map(x => x.trim()).filter(Boolean);
    const seen = new Set();
    const list = [];
    for (const it of items) {
      const m = it.match(/^(@?[^@\s]+)(?:@(.+))?$/);
      if (!m) continue;
      const key = m[1] + (m[2] ? '@' + m[2] : '');
      if (seen.has(key)) continue; seen.add(key);
      list.push({ name: m[1], version: m[2] || 'latest' });
    }
    return list;
  }

  async function getJson(url, signal) {
    let res;
    try { res = await fetch(url, { signal }); }
    catch (e) { if (e.name === 'AbortError') throw e; throw new Error('unreachable'); }
    if (res.status === 404) throw new Error('not found');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  async function check(row, signal) {
    row.loading = true; row.error = null; row.bpError = null;
    try {
      const doc = await getJson(`https://registry.npmjs.org/${row.name.replace('/', '%2F')}/${encodeURIComponent(row.version)}`, signal);
      row.resolved = doc.version;
      row.unpacked = doc.dist && doc.dist.unpackedSize || null;
      row.files = doc.dist && doc.dist.fileCount || null;
      row.deps = Object.keys(doc.dependencies || {}).length;
      row.license = typeof doc.license === 'string' ? doc.license : doc.license && doc.license.type || '';
      row.types = !!(doc.types || doc.typings);
      row.esm = !!(doc.module || doc.type === 'module' || doc.exports);
      row.description = doc.description || '';
    } catch (e) {
      if (e.name === 'AbortError') { row.error = 'cancelled'; row.loading = false; return; }
      row.error = e.message === 'unreachable' ? 'Could not reach registry.npmjs.org (offline or blocked)' : e.message === 'not found' ? `${row.name}@${row.version} not found on npm` : 'registry ' + e.message;
      row.loading = false; return;
    }
    try {
      const bp = await getJson(`https://bundlephobia.com/api/size?package=${encodeURIComponent(row.name + '@' + row.resolved)}&record=true`, signal);
      row.min = bp.size; row.gzip = bp.gzip; row.bpDeps = bp.dependencyCount; row.sideEffects = bp.hasSideEffects; row.hasJSModule = bp.hasJSModule;
    } catch (e) {
      if (e.name === 'AbortError') { row.error = 'cancelled'; row.loading = false; return; }
      row.min = row.gzip = null;
      row.bpError = e.message === 'unreachable' ? 'bundlephobia unreachable (CORS/offline)' : e.message === 'not found' ? 'bundlephobia has no build for this version' : 'bundlephobia ' + e.message;
    }
    row.loading = false;
  }

  async function run() {
    const list = parseInput();
    s.set('input', input.value);
    if (!list.length) { render(out, el('div', { class: 'panel', style: { borderColor: 'var(--danger)' } }, 'Enter at least one package name.')); return; }
    if (abort) abort.abort();
    abort = new AbortController();
    const signal = abort.signal;
    rows = list;
    runBtn.disabled = true; cancelBtn.classList.remove('hidden');
    let done = 0, idx = 0;
    status.textContent = `0 / ${rows.length}`;
    rows.forEach(r => r.loading = true);
    draw();
    const worker = async () => {
      while (idx < rows.length && !signal.aborted) {
        const r = rows[idx++];
        await check(r, signal);
        done++; status.textContent = `${done} / ${rows.length}`; draw();
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, rows.length) }, worker));
    runBtn.disabled = false; cancelBtn.classList.add('hidden');
    if (signal.aborted) status.textContent = 'Cancelled.';
    else if (rows.every(r => r.error && /reach/.test(r.error))) status.textContent = 'All requests failed: you appear to be offline, or registry.npmjs.org is blocked.';
    else status.textContent = rows.some(r => r.bpError) ? 'Done. Min/gzip missing for some packages: bundlephobia was unreachable or has no build; registry figures are still shown.' : 'Done.';
    s.set('rows', rows.map(r => ({ ...r, loading: false })));
  }

  const val = (r, m) => m === 'gzip' ? r.gzip : m === 'min' ? r.min : m === 'unpacked' ? r.unpacked : r.deps;
  function draw() {
    s.set('metric', metric.value);
    if (!rows.length) { render(out, el('div', { class: 'muted' }, 'Enter packages above and press Compare.')); return; }
    const m = metric.value;
    const max = Math.max(1, ...rows.map(r => val(r, m) || 0));
    const fmtN = n => n == null ? '—' : m === 'deps' ? String(n) : fmtBytes(n);
    const sorted = [...rows].sort((a, b) => (val(b, m) || 0) - (val(a, m) || 0));
    render(out,
      el('div', { class: 'col', style: { marginBottom: '12px' } }, sorted.map(r => {
        const v = val(r, m);
        return el('div', {},
          el('div', { class: 'row', style: { margin: '2px 0' } }, el('span', { class: 'mono' }, r.name, r.resolved ? el('span', { class: 'muted small' }, '@' + r.resolved) : null), el('span', { class: 'grow' }), el('span', { class: 'small' }, r.loading ? '…' : r.error ? el('span', { class: 'badge danger' }, 'error') : fmtN(v))),
          el('div', { class: 'bar' }, el('div', { style: { width: (v ? Math.max(1, v / max * 100) : 0) + '%' } })));
      })),
      el('table', { class: 'table' },
        el('thead', {}, el('tr', {}, el('th', {}, 'Package'), el('th', {}, 'Version'), el('th', {}, 'Minified'), el('th', {}, 'Min + gzip'), el('th', {}, 'Unpacked'), el('th', {}, 'Deps'), el('th', {}, 'Files'), el('th', {}, 'License'), el('th', {}, 'Notes'))),
        el('tbody', {}, sorted.map(r => el('tr', {},
          el('td', {}, el('a', { class: 'mono', href: 'https://www.npmjs.com/package/' + r.name, target: '_blank', rel: 'noopener' }, r.name), r.description ? el('div', { class: 'small muted', style: { maxWidth: '260px' } }, r.description.slice(0, 80)) : null),
          el('td', { class: 'mono' }, r.loading ? '…' : r.resolved || '—'),
          el('td', {}, r.min != null ? fmtBytes(r.min) : '—'),
          el('td', {}, r.gzip != null ? el('b', {}, fmtBytes(r.gzip)) : '—'),
          el('td', {}, r.unpacked != null ? fmtBytes(r.unpacked) : '—'),
          el('td', {}, r.deps != null ? [String(r.deps), r.bpDeps != null && r.bpDeps !== r.deps ? el('span', { class: 'muted small', title: 'transitive, per bundlephobia' }, ` (${r.bpDeps} total)`) : null] : '—'),
          el('td', {}, r.files != null ? String(r.files) : '—'),
          el('td', { class: 'small' }, r.license || '—'),
          el('td', { class: 'small' },
            r.error ? el('span', { style: { color: 'var(--danger)' } }, r.error) : null,
            r.bpError ? el('div', { class: 'muted' }, r.bpError) : null,
            !r.error && !r.loading ? el('div', { class: 'row', style: { margin: 0, gap: '4px' } },
              r.types ? el('span', { class: 'badge ok' }, 'types') : null,
              r.esm ? el('span', { class: 'badge' }, 'ESM') : null,
              r.sideEffects === false ? el('span', { class: 'badge' }, 'tree-shakeable') : null) : null))))));
  }
  const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const csv = () => ['package,version,minified_bytes,gzip_bytes,unpacked_bytes,dependencies,files,license,error', ...rows.map(r => [r.name, r.resolved, r.min, r.gzip, r.unpacked, r.deps, r.files, r.license, r.error || r.bpError || ''].map(q).join(','))].join('\n');

  metric.addEventListener('change', draw);
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) run(); });
  render(root,
    input,
    el('div', { class: 'row' }, runBtn, cancelBtn,
      el('button', { class: 'btn ghost', onclick: () => { input.value = 'lodash, lodash-es, dayjs, moment, date-fns, luxon'; } }, 'Sample'),
      metric,
      el('button', { class: 'btn', onclick: () => download('package-sizes.csv', csv(), 'text/csv') }, 'CSV'),
      el('button', { class: 'btn ghost', onclick: () => { rows = []; s.del('rows'); draw(); status.textContent = ''; } }, 'Clear'),
      el('span', { class: 'muted small' }, 'Ctrl+Enter runs. Unpacked size and deps come from registry.npmjs.org; minified/gzip from bundlephobia.com when it answers.')),
    status, out);
  draw();
  return () => { if (abort) abort.abort(); };
}
