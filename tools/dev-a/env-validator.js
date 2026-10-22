// Env file validator: compare .env with .env.example, find missing/extra/empty/duplicate keys and quoting problems.
import { el, render, store, copy, download } from '../../lib/ui.js';

const SAMPLE_EXAMPLE = `# App
APP_NAME=my-app
APP_ENV=development
PORT=3000
DATABASE_URL=
REDIS_URL=redis://localhost:6379
SECRET_KEY=
API_BASE_URL=https://api.example.com
FEATURE_FLAGS=
LOG_LEVEL=info
`;
const SAMPLE_ENV = `APP_NAME=my-app
APP_ENV = production
PORT=3000
DATABASE_URL=postgres://user:pa ss@localhost:5432/app
SECRET_KEY="s3cr3t
SMTP_HOST=smtp.example.com
LOG_LEVEL=debug
LOG_LEVEL=info
API_BASE_URL=https://api.example.com # prod
export FEATURE_FLAGS='a,b
`;

const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Parse dotenv text into { entries: [{key,value,raw,line,quote,issues}], byKey: Map(key -> entry[]), lineIssues: [{line,msg,sev}] } */
export function parseEnv(text) {
  const entries = [], byKey = new Map(), issues = [];
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  let openMulti = null;
  lines.forEach((rawLine, idx) => {
    const line = idx + 1;
    if (openMulti) {
      openMulti.value += '\n' + rawLine;
      if (rawLine.trimEnd().endsWith(openMulti.quote)) { openMulti.value = openMulti.value.slice(0, -1); openMulti = null; }
      return;
    }
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    let body = trimmed;
    let exported = false;
    if (/^export\s+/.test(body)) { body = body.replace(/^export\s+/, ''); exported = true; }
    const eq = body.indexOf('=');
    if (eq < 0) { issues.push({ line, sev: 'error', msg: `No "=" on this line: ${trimmed.slice(0, 40)}` }); return; }
    const keyRaw = body.slice(0, eq);
    const key = keyRaw.trim();
    let value = body.slice(eq + 1);
    const e = { key, line, raw: rawLine, value: '', quote: '', issues: [], exported };
    if (!key) e.issues.push({ sev: 'error', msg: 'Empty key before "="' });
    else if (!KEY_RE.test(key)) e.issues.push({ sev: 'error', msg: `Invalid key name "${key}" (use letters, digits and _)` });
    else if (key !== key.toUpperCase()) e.issues.push({ sev: 'info', msg: 'Key is not UPPER_CASE (convention)' });
    if (keyRaw !== key || /^\s/.test(value)) e.issues.push({ sev: 'warn', msg: 'Spaces around "=": some parsers keep them as part of the key or value' });
    value = value.replace(/^\s+/, '');
    if (value.startsWith('"') || value.startsWith("'")) {
      const q = value[0];
      const end = value.indexOf(q, 1);
      if (end < 0) {
        e.quote = q; e.value = value.slice(1);
        // A genuine multi-line value closes with the same quote before the next KEY= line; otherwise it is just unbalanced.
        let closes = false;
        for (let j = idx + 1; j < lines.length; j++) {
          if (/^\s*(export\s+)?[A-Za-z_][A-Za-z0-9_]*\s*=/.test(lines[j])) break;
          if (lines[j].trimEnd().endsWith(q)) { closes = true; break; }
        }
        if (closes) openMulti = e;
        else e.issues.push({ sev: 'error', msg: `Unbalanced ${q === '"' ? 'double' : 'single'} quote` });
      } else {
        e.quote = q; e.value = value.slice(1, end);
        const rest = value.slice(end + 1).trim();
        if (rest && !rest.startsWith('#')) e.issues.push({ sev: 'warn', msg: `Text after closing quote is ignored: ${rest.slice(0, 30)}` });
        if (q === "'" && /\\n/.test(e.value)) e.issues.push({ sev: 'info', msg: 'Single quotes keep \\n literal; use double quotes for escapes' });
      }
    } else {
      const hash = value.search(/\s#/);
      let v = hash >= 0 ? value.slice(0, hash) : value;
      if (hash >= 0) e.issues.push({ sev: 'warn', msg: 'Unquoted " #" starts a comment in most parsers; quote the value if the # is part of it' });
      else if (value.includes('#')) e.issues.push({ sev: 'info', msg: 'Contains "#": fine for most parsers, but quote it to be safe' });
      v = v.trimEnd();
      if (v !== (hash >= 0 ? value.slice(0, hash) : value)) e.issues.push({ sev: 'info', msg: 'Trailing whitespace' });
      if (/\s/.test(v)) e.issues.push({ sev: 'warn', msg: 'Unquoted value contains whitespace; wrap it in quotes' });
      if (/["']/.test(v)) e.issues.push({ sev: 'warn', msg: 'Stray quote inside an unquoted value' });
      e.value = v;
    }
    if (e.value === '') e.empty = true;
    entries.push(e);
    if (key) { if (!byKey.has(key)) byKey.set(key, []); byKey.get(key).push(e); }
  });
  for (const [key, list] of byKey) if (list.length > 1) list.forEach(e => e.issues.push({ sev: 'warn', msg: `Duplicate key (lines ${list.map(x => x.line).join(', ')}); the last one usually wins` }));
  return { entries, byKey, issues };
}

function looksSecret(v) { return v.length >= 24 && /[a-z]/i.test(v) && /\d/.test(v) && !/\s/.test(v) && !/^https?:\/\//.test(v); }

export default function (root) {
  const s = store('env-validator');
  const envTa = el('textarea', { class: 'textarea', placeholder: 'Paste your .env here', value: s.get('env', ''), style: { minHeight: '220px' } });
  const exTa = el('textarea', { class: 'textarea', placeholder: 'Paste your .env.example here', value: s.get('example', ''), style: { minHeight: '220px' } });
  const summary = el('div', { class: 'row' });
  const out = el('div', {});
  const diffOut = el('div', { class: 'scroll-x' });
  const problems = el('div', {});

  const badge = (text, cls) => el('span', { class: 'badge ' + cls }, text);
  const sevBadge = sev => badge(sev, sev === 'error' ? 'danger' : sev === 'warn' ? 'warn' : '');

  function update() {
    s.set('env', envTa.value); s.set('example', exTa.value);
    const env = parseEnv(envTa.value), ex = parseEnv(exTa.value);
    const hasEnv = envTa.value.trim().length > 0, hasEx = exTa.value.trim().length > 0;
    if (!hasEnv && !hasEx) { render(summary); render(out, el('div', { class: 'muted' }, 'Paste one or both files. Comparison needs both; validation works on either alone.')); render(diffOut); render(problems); return; }

    const missing = [...ex.byKey.keys()].filter(k => !env.byKey.has(k));
    const extra = [...env.byKey.keys()].filter(k => !ex.byKey.has(k));
    const empty = [...env.byKey.values()].map(l => l[l.length - 1]).filter(e => e.empty);
    const dups = [...env.byKey.values()].filter(l => l.length > 1).length + [...ex.byKey.values()].filter(l => l.length > 1).length;
    const allIssues = [];
    const collect = (file, p) => {
      p.issues.forEach(i => allIssues.push({ file, line: i.line, sev: i.sev, key: '', msg: i.msg }));
      p.entries.forEach(e => e.issues.forEach(i => allIssues.push({ file, line: e.line, sev: i.sev, key: e.key, msg: i.msg })));
    };
    collect('.env', env); collect('.env.example', ex);
    ex.entries.forEach(e => { if (!e.empty && looksSecret(e.value)) allIssues.push({ file: '.env.example', line: e.line, sev: 'warn', key: e.key, msg: 'Example value looks like a real secret; replace it with a placeholder' }); });
    const sevOrder = { error: 0, warn: 1, info: 2 };
    allIssues.sort((a, b) => sevOrder[a.sev] - sevOrder[b.sev] || a.file.localeCompare(b.file) || a.line - b.line);
    const errors = allIssues.filter(i => i.sev === 'error').length, warns = allIssues.filter(i => i.sev === 'warn').length;

    render(summary,
      hasEx && hasEnv ? badge(`${missing.length} missing`, missing.length ? 'danger' : 'ok') : null,
      hasEx && hasEnv ? badge(`${extra.length} extra`, extra.length ? 'warn' : 'ok') : null,
      hasEnv ? badge(`${empty.length} empty`, empty.length ? 'warn' : 'ok') : null,
      badge(`${dups} duplicate${dups === 1 ? '' : 's'}`, dups ? 'warn' : 'ok'),
      badge(`${errors} error${errors === 1 ? '' : 's'}`, errors ? 'danger' : 'ok'),
      badge(`${warns} warning${warns === 1 ? '' : 's'}`, warns ? 'warn' : 'ok'),
      el('span', { class: 'muted small' }, `${env.entries.length} keys in .env · ${ex.entries.length} in .env.example`));

    render(out,
      hasEx && hasEnv && missing.length ? el('div', { class: 'panel', style: { marginBottom: '8px' } },
        el('div', { class: 'row', style: { margin: 0 } }, el('b', {}, 'Missing from .env'), el('span', { class: 'grow' }),
          el('button', { class: 'btn small', onclick: () => copy(missing.map(k => `${k}=`).join('\n')) }, 'Copy as KEY= lines'),
          el('button', { class: 'btn small', onclick: () => { envTa.value = envTa.value.replace(/\s*$/, '\n') + missing.map(k => `${k}=`).join('\n') + '\n'; update(); } }, 'Append to .env')),
        el('div', { class: 'mono small' }, missing.join(', '))) : null,
      hasEx && hasEnv && extra.length ? el('div', { class: 'panel', style: { marginBottom: '8px' } },
        el('div', { class: 'row', style: { margin: 0 } }, el('b', {}, 'In .env but not in .env.example'), el('span', { class: 'grow' }),
          el('button', { class: 'btn small', onclick: () => { exTa.value = exTa.value.replace(/\s*$/, '\n') + extra.map(k => `${k}=`).join('\n') + '\n'; update(); } }, 'Append to .env.example')),
        el('div', { class: 'mono small' }, extra.join(', '))) : null);

    // side-by-side diff
    const keys = [];
    const seen = new Set();
    for (const k of [...ex.byKey.keys(), ...env.byKey.keys()]) if (!seen.has(k)) { seen.add(k); keys.push(k); }
    const last = (p, k) => { const l = p.byKey.get(k); return l ? l[l.length - 1] : null; };
    const show = e => e ? (e.quote ? `${e.quote}${e.value}${e.quote}` : e.value) : '';
    const mask = v => v.length > 60 ? v.slice(0, 57) + '…' : v;
    render(diffOut, keys.length ? el('table', { class: 'table' },
      el('thead', {}, el('tr', {}, el('th', {}, 'Key'), el('th', {}, '.env.example'), el('th', {}, '.env'), el('th', {}, 'Status'))),
      el('tbody', {}, keys.map(k => {
        const a = last(ex, k), b = last(env, k);
        let status, cls = '';
        if (hasEx && hasEnv && !b) { status = 'missing'; cls = 'danger'; }
        else if (hasEx && hasEnv && !a) { status = 'extra'; cls = 'warn'; }
        else if (b && b.empty) { status = 'empty'; cls = 'warn'; }
        else if (b && b.issues.some(i => i.sev === 'error')) { status = 'error'; cls = 'danger'; }
        else if (b && b.issues.some(i => i.sev === 'warn')) { status = 'check'; cls = 'warn'; }
        else if (a && b && a.value && a.value === b.value && looksSecret(a.value)) { status = 'same as example'; cls = 'warn'; }
        else { status = 'ok'; cls = 'ok'; }
        const dup = (env.byKey.get(k) || []).length > 1 || (ex.byKey.get(k) || []).length > 1;
        return el('tr', {},
          el('td', { class: 'mono' }, k, dup ? el('span', { class: 'badge warn', style: { marginLeft: '6px' } }, 'dup') : null),
          el('td', { class: 'mono small', style: { color: a ? '' : 'var(--muted)' } }, a ? mask(show(a)) || el('i', { class: 'muted' }, 'empty') : '—'),
          el('td', { class: 'mono small', style: { color: b ? '' : 'var(--muted)' } }, b ? mask(show(b)) || el('i', { class: 'muted' }, 'empty') : '—'),
          el('td', {}, badge(status, cls)));
      }))) : null);

    render(problems, allIssues.length ? el('div', {},
      el('div', { class: 'small muted', style: { margin: '12px 0 4px' } }, 'Line-by-line findings'),
      el('ul', { class: 'list' }, allIssues.map(i => el('li', {},
        sevBadge(i.sev),
        el('span', { class: 'mono small muted', style: { minWidth: '120px' } }, `${i.file}:${i.line}`),
        el('span', { class: 'grow' }, i.key ? el('span', { class: 'mono' }, i.key + ' ') : null, i.msg))))) : el('div', { class: 'muted small', style: { marginTop: '12px' } }, 'No syntax or quoting problems found.'));
  }

  function makeExample() {
    const p = parseEnv(envTa.value);
    const seen = new Set();
    const lines = [];
    for (const e of p.entries) { if (!e.key || seen.has(e.key)) continue; seen.add(e.key); lines.push(`${e.key}=`); }
    exTa.value = lines.join('\n') + '\n'; update();
  }

  envTa.addEventListener('input', update); exTa.addEventListener('input', update);
  render(root,
    el('div', { class: 'grid2' },
      el('div', {}, el('div', { class: 'row', style: { margin: '0 0 4px' } }, el('b', {}, '.env'), el('span', { class: 'grow' }),
        el('button', { class: 'btn small ghost', onclick: () => { envTa.value = SAMPLE_ENV; update(); } }, 'Sample')), envTa),
      el('div', {}, el('div', { class: 'row', style: { margin: '0 0 4px' } }, el('b', {}, '.env.example'), el('span', { class: 'grow' }),
        el('button', { class: 'btn small ghost', onclick: () => { exTa.value = SAMPLE_EXAMPLE; update(); } }, 'Sample'),
        el('button', { class: 'btn small ghost', title: 'Build .env.example from the keys in .env', onclick: makeExample }, 'Generate from .env')), exTa)),
    el('div', { class: 'row' },
      el('button', { class: 'btn', onclick: () => download('.env.example', exTa.value) }, 'Download .env.example'),
      el('button', { class: 'btn ghost', onclick: () => { envTa.value = ''; exTa.value = ''; update(); } }, 'Clear both'),
      el('span', { class: 'muted small' }, 'Nothing leaves your browser. Values are kept in localStorage only on this device.')),
    summary, out, diffOut, problems);
  update();
}
