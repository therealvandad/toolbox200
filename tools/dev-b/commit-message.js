// Commit message generator: parse a unified diff, guess Conventional Commit type/scope, compose subject + body.
import { el, render, store, copy, toast, field, stat } from '../../lib/ui.js';

const SAMPLE = `diff --git a/src/auth/session.js b/src/auth/session.js
index 3f1a2b4..9c8d7e6 100644
--- a/src/auth/session.js
+++ b/src/auth/session.js
@@ -10,7 +10,11 @@ export function readSession(req) {
   const raw = req.headers.cookie || '';
-  const token = raw.split('sid=')[1].split(';')[0];
-  return verify(token);
+  const match = raw.match(/(?:^|;\\s*)sid=([^;]+)/);
+  if (!match) return null;            // no cookie: anonymous request
+  try { return verify(match[1]); }
+  catch (err) { return null; }        // expired or tampered token
 }
diff --git a/src/auth/session.test.js b/src/auth/session.test.js
new file mode 100644
--- /dev/null
+++ b/src/auth/session.test.js
@@ -0,0 +1,6 @@
+import { readSession } from './session.js';
+test('missing cookie returns null', () => {
+  expect(readSession({ headers: {} })).toBe(null);
+});
`;

const TYPES = ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'];

function parseDiff(text) {
  const files = [];
  let cur = null;
  const lines = text.replace(/\r/g, '').split('\n');
  const start = (path) => { cur = { path, add: 0, del: 0, status: 'modified', from: null, addedLines: [], removedLines: [] }; files.push(cur); };
  for (const line of lines) {
    let m;
    if ((m = line.match(/^diff --git a\/(.+?) b\/(.+)$/))) { start(m[2]); continue; }
    if ((m = line.match(/^\+\+\+ (?:b\/)?(.+)$/))) {
      const p = m[1].trim();
      if (p !== '/dev/null') { if (!cur || (cur.path !== p && cur.add + cur.del > 0)) start(p); else cur.path = p; }
      else if (cur) cur.status = 'deleted';
      continue;
    }
    if ((m = line.match(/^--- (?:a\/)?(.+)$/))) {
      const p = m[1].trim();
      if (!cur || cur.add + cur.del > 0) start(p === '/dev/null' ? '?' : p);
      if (p === '/dev/null') cur.status = 'added';
      continue;
    }
    if (!cur) continue;
    if (/^new file mode/.test(line)) cur.status = 'added';
    else if (/^deleted file mode/.test(line)) cur.status = 'deleted';
    else if ((m = line.match(/^rename from (.+)$/))) { cur.status = 'renamed'; cur.from = m[1]; }
    else if ((m = line.match(/^rename to (.+)$/))) cur.path = m[1];
    else if (/^(index |@@|Binary|similarity|old mode|new mode)/.test(line)) continue;
    else if (line[0] === '+') { cur.add++; cur.addedLines.push(line.slice(1)); }
    else if (line[0] === '-') { cur.del++; cur.removedLines.push(line.slice(1)); }
  }
  return files.filter(f => f.path !== '?');
}

const isDoc = p => /\.(md|mdx|rst|txt|adoc)$/i.test(p) || /(^|\/)(docs?|documentation)\//i.test(p) || /(^|\/)(README|CHANGELOG|LICENSE|CONTRIBUTING)/i.test(p);
const isTest = p => /(^|\/)(tests?|__tests__|spec|e2e|cypress)\//i.test(p) || /\.(test|spec)\.[jt]sx?$/i.test(p) || /_test\.(go|py|rb)$/i.test(p) || /(^|\/)test_[^/]+\.py$/i.test(p);
const isCi = p => /(^|\/)\.(github|gitlab|circleci)\//i.test(p) || /(^|\/)(Jenkinsfile|\.travis\.yml|azure-pipelines\.yml)$/i.test(p);
const isBuild = p => /(^|\/)(package(-lock)?\.json|yarn\.lock|pnpm-lock\.yaml|Cargo\.(toml|lock)|go\.(mod|sum)|requirements.*\.txt|pyproject\.toml|setup\.py|pom\.xml|build\.gradle|Makefile|Dockerfile|webpack\.config\.\w+|vite\.config\.\w+|rollup\.config\.\w+|tsconfig.*\.json)$/i.test(p);
const isChore = p => /(^|\/)\.(gitignore|editorconfig|prettierrc|eslintrc.*|nvmrc|env\.example)$/i.test(p) || /(^|\/)\.[\w-]+\.(json|yml|yaml|js|cjs)$/.test(p);
const isStyle = p => /\.(css|scss|sass|less|styl)$/i.test(p);

function guess(files) {
  if (!files.length) return { type: 'chore', scope: '', summary: '', reasons: [] };
  const all = pred => files.every(f => pred(f.path));
  const reasons = [];
  let type;
  if (all(isDoc)) { type = 'docs'; reasons.push('only documentation files changed'); }
  else if (all(isTest)) { type = 'test'; reasons.push('only test files changed'); }
  else if (all(isCi)) { type = 'ci'; reasons.push('only CI configuration changed'); }
  else if (all(isBuild)) { type = 'build'; reasons.push('only build / dependency manifests changed'); }
  else if (all(p => isChore(p) || isBuild(p) || isCi(p))) { type = 'chore'; reasons.push('only tooling and config files changed'); }
  else if (all(isStyle)) { type = 'style'; reasons.push('only stylesheets changed'); }
  else {
    const src = files.filter(f => !isTest(f.path) && !isDoc(f.path));
    const added = src.reduce((n, f) => n + f.add, 0), removed = src.reduce((n, f) => n + f.del, 0);
    const addedText = src.flatMap(f => f.addedLines).join('\n');
    const fixWords = (addedText.match(/\b(fix|fixes|bug|crash|guard|null|undefined|NaN|fallback|catch|handle|edge case|off[- ]by[- ]one|regression|leak|race)\b/gi) || []).length;
    const newFiles = src.filter(f => f.status === 'added').length;
    const deletedFiles = src.filter(f => f.status === 'deleted').length;
    const newSymbols = src.flatMap(f => f.addedLines).filter(l => /^\s*(export\s+)?(async\s+)?(function|class|def|interface|type|enum)\s+\w+|^\s*(export\s+)?(const|let)\s+\w+\s*=\s*(async\s*)?(\(|function)/.test(l)).length;
    if (newFiles && newFiles >= src.length / 2) { type = 'feat'; reasons.push(`${newFiles} new source file(s)`); }
    else if (deletedFiles && !newFiles && removed > added * 2) { type = 'refactor'; reasons.push('mostly deletions'); }
    else if (fixWords >= 2 && added < 120) { type = 'fix'; reasons.push(`added lines mention bug-handling words (${fixWords}×)`); }
    else if (newSymbols >= 2 && added > removed * 2) { type = 'feat'; reasons.push(`${newSymbols} new function(s)/class(es), mostly additions`); }
    else if (removed && Math.abs(added - removed) <= Math.max(4, (added + removed) * 0.25)) { type = 'refactor'; reasons.push('additions roughly balance deletions'); }
    else if (added > removed) { type = 'feat'; reasons.push('mostly additions'); }
    else { type = 'fix'; reasons.push('small localized change'); }
    if (/perf|faster|cache|memo|throttle|debounce|O\(n\)/i.test(addedText) && type === 'refactor') { type = 'perf'; reasons.push('performance-related words'); }
  }
  // scope: shared directory of the changed source files, skipping generic roots
  const GENERIC = new Set(['src', 'lib', 'app', 'apps', 'packages', 'pkg', 'internal', 'cmd', 'test', 'tests', '__tests__', 'docs', 'components', 'modules']);
  const segs = files.map(f => f.path.split('/').slice(0, -1).filter(s => !GENERIC.has(s)));
  let scope = '';
  if (segs.length) {
    const first = segs[0]; let i = 0;
    while (i < first.length && segs.every(s => s[i] === first[i])) i++;
    scope = i ? first[i - 1] : '';
  }
  if (!scope && files.length === 1) scope = files[0].path.split('/').pop().replace(/\.[^.]+$/, '').replace(/\.(test|spec)$/, '');
  if (!scope && files.length > 1) {
    const tops = {}; files.forEach(f => { const t = f.path.split('/')[0]; if (f.path.includes('/') && !GENERIC.has(t)) tops[t] = (tops[t] || 0) + 1; });
    const best = Object.entries(tops).sort((a, b) => b[1] - a[1])[0];
    if (best && best[1] > files.length / 2) scope = best[0];
  }
  // summary
  const names = f => f.path.split('/').pop();
  const list = arr => arr.length <= 3 ? arr.map(names).join(', ') : `${arr.length} files`;
  const fnNames = files.flatMap(f => f.addedLines.map(l => (l.match(/^\s*(?:export\s+)?(?:async\s+)?(?:function|class|def)\s+(\w+)/) || [])[1]).filter(Boolean));
  let summary;
  const newF = files.filter(f => f.status === 'added'), delF = files.filter(f => f.status === 'deleted'), renF = files.filter(f => f.status === 'renamed');
  if (newF.length === files.length) summary = 'add ' + list(newF);
  else if (delF.length === files.length) summary = 'remove ' + list(delF);
  else if (renF.length === files.length) summary = renF.length === 1 ? `rename ${names({ path: renF[0].from })} to ${names(renF[0])}` : `rename ${renF.length} files`;
  else if (type === 'docs') summary = 'update ' + list(files);
  else if (type === 'test') summary = 'add tests for ' + list(files).replace(/\.(test|spec)/g, '');
  else if (type === 'fix') { const src = files.filter(f => !isTest(f.path)); summary = 'handle ' + (fnNames[0] ? fnNames[0] + ' edge case' : 'edge case in ' + list(src.length ? src : files)); }
  else if (fnNames.length) summary = 'add ' + fnNames.slice(0, 3).join(', ');
  else summary = 'update ' + list(files);
  return { type, scope, summary: (summary[0].toLowerCase() + summary.slice(1)).slice(0, 60), reasons };
}

export default function (root) {
  const s = store('commit-message');
  const ta = el('textarea', { class: 'textarea', placeholder: 'Paste `git diff` output here…', value: s.get('diff', ''), spellcheck: false });
  const typeSel = el('select', { class: 'select' }, ...TYPES.map(t => el('option', { value: t }, t)));
  const scopeIn = el('input', { class: 'input', placeholder: 'scope (optional)', style: { width: '150px' } });
  const sumIn = el('input', { class: 'input', placeholder: 'summary in imperative mood', style: { minWidth: '240px', flex: '1' } });
  const breaking = el('input', { type: 'checkbox' });
  const bodyTa = el('textarea', { class: 'textarea', style: { minHeight: '110px' }, placeholder: 'body (optional)' });
  const footerIn = el('input', { class: 'input', placeholder: 'footer, e.g. Closes #123', style: { flex: '1', minWidth: '200px' } });
  const out = el('pre', { class: 'out mono' });
  const lenInfo = el('span', { class: 'small muted' });
  const stats = el('div', { class: 'row' });
  const fileTbl = el('div', { class: 'scroll-x' });
  const why = el('div', { class: 'muted small' });
  let files = [];

  function compose() {
    const scope = scopeIn.value.trim();
    const subj = `${typeSel.value}${scope ? `(${scope})` : ''}${breaking.checked ? '!' : ''}: ${sumIn.value.trim()}`;
    const parts = [subj];
    if (bodyTa.value.trim()) parts.push('', bodyTa.value.trim());
    const foot = [];
    if (breaking.checked && !/BREAKING CHANGE:/.test(footerIn.value)) foot.push('BREAKING CHANGE: ' + (footerIn.value.trim() || 'describe what breaks and how to migrate'));
    else if (footerIn.value.trim()) foot.push(footerIn.value.trim());
    if (foot.length) parts.push('', ...foot);
    out.textContent = parts.join('\n');
    const n = subj.length;
    lenInfo.textContent = `subject ${n}/72 chars`;
    lenInfo.style.color = n > 72 ? 'var(--danger)' : n > 50 ? 'var(--warn)' : 'var(--muted)';
    s.set('fields', { type: typeSel.value, scope, summary: sumIn.value, body: bodyTa.value, footer: footerIn.value, breaking: breaking.checked });
  }

  function analyze(fromInput) {
    s.set('diff', ta.value);
    files = parseDiff(ta.value);
    const add = files.reduce((n, f) => n + f.add, 0), del = files.reduce((n, f) => n + f.del, 0);
    render(stats, stat(files.length, 'files'), stat('+' + add, 'added lines'), stat('−' + del, 'removed lines'));
    render(fileTbl, files.length ? el('table', { class: 'table' },
      el('thead', {}, el('tr', {}, el('th', {}, 'File'), el('th', {}, 'Status'), el('th', {}, '+'), el('th', {}, '−'))),
      el('tbody', {}, ...files.map(f => el('tr', {},
        el('td', { class: 'mono small' }, f.from ? `${f.from} → ${f.path}` : f.path),
        el('td', {}, el('span', { class: 'badge ' + ({ added: 'ok', deleted: 'danger', renamed: 'warn' }[f.status] || '') }, f.status)),
        el('td', { style: { color: 'var(--ok)' } }, f.add), el('td', { style: { color: 'var(--danger)' } }, f.del)))))
      : el('p', { class: 'muted small' }, ta.value.trim() ? 'No file headers found. Paste output of `git diff` (unified format with --- / +++ lines).' : ''));
    const g = guess(files);
    if (files.length) {
      typeSel.value = g.type; scopeIn.value = g.scope; sumIn.value = g.summary;
      bodyTa.value = files.map(f => `- ${f.path}: ${f.status === 'added' ? 'new file' : f.status === 'deleted' ? 'removed' : f.status === 'renamed' ? 'renamed from ' + f.from : 'modified'} (+${f.add} −${f.del})`).join('\n');
      render(why, 'Guessed type "' + g.type + '" because ' + g.reasons.join('; ') + (g.scope ? `; scope "${g.scope}" from the common path.` : '.'));
    } else if (!fromInput) {
      const f = s.get('fields');
      if (f) { typeSel.value = f.type; scopeIn.value = f.scope; sumIn.value = f.summary; bodyTa.value = f.body; footerIn.value = f.footer || ''; breaking.checked = !!f.breaking; }
      render(why);
    } else render(why);
    compose();
  }

  let t = null;
  ta.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => analyze(true), 200); });
  for (const c of [typeSel, scopeIn, sumIn, breaking, bodyTa, footerIn]) c.addEventListener('input', compose);
  typeSel.addEventListener('change', compose); breaking.addEventListener('change', compose);

  render(root,
    el('div', { class: 'row' }, el('span', { class: 'muted small grow' }, 'Paste a unified diff; the type, scope and summary are guessed from the file paths and content, then you edit.'),
      el('button', { class: 'btn ghost small', onclick: () => { ta.value = SAMPLE; analyze(true); } }, 'Sample'),
      el('button', { class: 'btn ghost small', onclick: () => { ta.value = ''; analyze(true); toast('Cleared'); } }, 'Clear')),
    ta, stats, fileTbl, why,
    el('h3', { style: { margin: '16px 0 6px', fontSize: '16px' } }, 'Message'),
    el('div', { class: 'row' }, field('Type', typeSel), field('Scope', scopeIn), field('Summary', sumIn), el('label', { class: 'inline', style: { paddingTop: '18px' } }, breaking, 'Breaking')),
    field('Body', bodyTa),
    field('Footer', footerIn),
    el('div', { class: 'row' }, lenInfo, el('span', { class: 'grow' }),
      el('button', { class: 'btn primary', onclick: () => copy(out.textContent) }, 'Copy message'),
      el('button', { class: 'btn', onclick: () => copy('git commit -m ' + JSON.stringify(out.textContent.split('\n\n')[0]) + out.textContent.split('\n\n').slice(1).map(p => ' -m ' + JSON.stringify(p)).join('')) }, 'Copy git command')),
    out,
    el('p', { class: 'muted small' }, 'Conventional Commits: <type>(<scope>)!: <summary> — imperative mood, no trailing period, subject ≤ 72 chars (50 is ideal). A "!" or a BREAKING CHANGE footer marks a major change.'));
  analyze(false);
  return () => clearTimeout(t);
}
