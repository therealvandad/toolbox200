// Dockerfile linter: ~25 best-practice rules with line numbers, severity and fix suggestions.
import { el, render, store, copy, download } from '../../lib/ui.js';

const SAMPLE = `FROM node:latest
MAINTAINER someone@example.com
ENV API_KEY=sk_live_1234567890
RUN apt-get update && apt-get install curl git
RUN cd /app
ADD ./src /app/src
COPY . .
RUN npm install
RUN curl -sSL https://get.example.com | sh
EXPOSE 80000
CMD npm start
CMD node server.js
`;

const INSTRUCTIONS = new Set(['FROM', 'RUN', 'CMD', 'LABEL', 'MAINTAINER', 'EXPOSE', 'ENV', 'ADD', 'COPY', 'ENTRYPOINT', 'VOLUME', 'USER', 'WORKDIR', 'ARG', 'ONBUILD', 'STOPSIGNAL', 'HEALTHCHECK', 'SHELL']);

/** Parse a Dockerfile into instructions with start line numbers, handling continuations, comments and stages. */
export function parseDockerfile(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const ins = [];
  const problems = [];
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const t = raw.trim();
    if (!t) { i++; continue; }
    if (t.startsWith('#')) {
      const m = t.match(/^#\s*(syntax|escape)\s*=\s*(\S+)/i);
      if (m && ins.length === 0) ins.push({ name: 'DIRECTIVE', args: m[2], line: i + 1, directive: m[1].toLowerCase() });
      i++; continue;
    }
    const start = i;
    let body = raw;
    let cur = raw;
    while (/\\\s*$/.test(cur)) {
      i++;
      if (i >= lines.length) break;
      cur = lines[i];
      if (cur.trim().startsWith('#')) { cur = '\\'; continue; } // comments inside continuations are ignored
      if (!cur.trim()) problems.push({ line: i + 1, rule: 'empty-continuation', sev: 'warn', msg: 'Empty continuation line', fix: 'Remove blank lines inside a multi-line instruction; they are deprecated and will become an error.' });
      body = body.replace(/\\\s*$/, '') + '\n' + cur;
    }
    i++;
    const flat = body.split('\n').filter(l => !l.trim().startsWith('#')).join('\n');
    const m = flat.trim().match(/^(\S+)\s*([\s\S]*)$/);
    if (!m) continue;
    const name = m[1].toUpperCase();
    const args = (m[2] || '').replace(/\\\s*\n\s*/g, ' ').replace(/\n\s*/g, ' ').trim();
    const node = { name, args, line: start + 1, raw: body };
    if (!INSTRUCTIONS.has(name)) problems.push({ line: start + 1, rule: 'unknown-instruction', sev: 'error', msg: `Unknown instruction "${m[1]}"`, fix: 'Check the spelling; valid instructions are FROM, RUN, CMD, COPY, ADD, ENV, ARG, EXPOSE, WORKDIR, USER, ENTRYPOINT, HEALTHCHECK, LABEL, VOLUME, SHELL, STOPSIGNAL, ONBUILD.' });
    // flags like --from=, --chown=
    node.flags = {};
    let a = args;
    const fm = /^--([a-z-]+)(?:=(\S+))?\s+/i;
    let fmm;
    while ((fmm = a.match(fm))) { node.flags[fmm[1]] = fmm[2] ?? true; a = a.slice(fmm[0].length); }
    node.args = a;
    node.json = /^\[/.test(a);
    ins.push(node);
  }
  return { ins, problems };
}

const SECRET_RE = /(passw(or)?d|secret|token|api[_-]?key|private[_-]?key|access[_-]?key|auth|credential)/i;

function shellCmds(args) {
  // split a RUN shell string into individual commands on && ; || |
  return args.split(/\s*(?:&&|\|\||;|\|)\s*/).map(c => c.trim()).filter(Boolean);
}

export function lint(text) {
  const { ins, problems } = parseDockerfile(text);
  const out = [...problems];
  const add = (line, rule, sev, msg, fix) => out.push({ line, rule, sev, msg, fix });

  // split into stages
  const stages = [];
  let cur = null;
  const firstReal = ins.find(n => n.name !== 'DIRECTIVE');
  if (firstReal && !['FROM', 'ARG'].includes(firstReal.name)) add(firstReal.line, 'from-first', 'error', `First instruction must be FROM (found ${firstReal.name})`, 'Move the FROM instruction to the top; only ARG and comments may precede it.');
  for (const n of ins) {
    if (n.name === 'FROM') { cur = { from: n, ins: [], alias: (n.args.match(/\s+AS\s+(\S+)/i) || [])[1] }; stages.push(cur); }
    else if (cur) cur.ins.push(n);
  }
  if (!stages.length) { add(1, 'no-from', 'error', 'No FROM instruction found', 'Every Dockerfile needs at least one FROM.'); return finish(out); }
  const aliases = new Set(stages.map(s => s.alias && s.alias.toLowerCase()).filter(Boolean));

  for (const st of stages) {
    const f = st.from;
    const image = f.args.replace(/\s+AS\s+\S+$/i, '').trim();
    const base = image.split('@')[0];
    const digest = image.includes('@');
    if (!/^\$/.test(image) && !aliases.has(image.toLowerCase()) && image !== 'scratch') {
      const lastSeg = base.split('/').pop();
      const tag = lastSeg.includes(':') ? lastSeg.split(':')[1] : null;
      if (!digest) {
        if (!tag) add(f.line, 'no-tag', 'warn', `Base image "${base}" has no tag (defaults to :latest)`, `Pin a version, e.g. FROM ${base}:<version>, so builds are reproducible.`);
        else if (tag === 'latest') add(f.line, 'latest-tag', 'warn', `Base image "${base}" uses the :latest tag`, 'Pin an explicit version tag (or a digest) so the build does not change under you.');
        else if (/^\d+$/.test(tag)) add(f.line, 'loose-tag', 'info', `Tag "${tag}" is a major version only`, `Consider a more specific tag (e.g. ${lastSeg.split(':')[0]}:${tag}.x.y) or a digest for fully reproducible builds.`);
      }
    }
    if (st.ins.some(n => n.name === 'MAINTAINER')) st.ins.filter(n => n.name === 'MAINTAINER').forEach(n => add(n.line, 'maintainer', 'warn', 'MAINTAINER is deprecated', 'Use LABEL org.opencontainers.image.authors="…" instead.'));

    const cmds = st.ins.filter(n => n.name === 'CMD'), eps = st.ins.filter(n => n.name === 'ENTRYPOINT');
    if (cmds.length > 1) cmds.slice(0, -1).forEach(n => add(n.line, 'multiple-cmd', 'warn', `Multiple CMD instructions; only the last one (line ${cmds[cmds.length - 1].line}) takes effect`, 'Keep a single CMD per stage.'));
    if (eps.length > 1) eps.slice(0, -1).forEach(n => add(n.line, 'multiple-entrypoint', 'warn', `Multiple ENTRYPOINT instructions; only the last one (line ${eps[eps.length - 1].line}) takes effect`, 'Keep a single ENTRYPOINT per stage.'));
    for (const n of [...cmds, ...eps]) if (!n.json && n.args) add(n.line, 'shell-form', 'info', `${n.name} uses shell form, so the process runs under /bin/sh -c and will not receive SIGTERM directly`, `Use exec (JSON array) form: ${n.name} ["executable", "arg1"].`);

    let workdir = false;
    let runStreak = 0;
    let copiedAll = null, installedDeps = false;
    for (const n of st.ins) {
      if (n.name === 'RUN') { runStreak++; if (runStreak === 4) add(n.line, 'many-runs', 'info', 'Four or more consecutive RUN instructions', 'Chain related commands with && in one RUN to reduce layers (keep logically separate steps separate).'); }
      else runStreak = 0;

      if (n.name === 'WORKDIR') { workdir = true; if (!/^(\/|\$|[A-Za-z]:\\)/.test(n.args)) add(n.line, 'relative-workdir', 'warn', `WORKDIR "${n.args}" is relative`, 'Use an absolute path so the result does not depend on a previous WORKDIR.'); }

      if (n.name === 'RUN') {
        const a = n.json ? (() => { try { return JSON.parse(n.args).join(' '); } catch { return n.args; } })() : n.args;
        const cs = shellCmds(a);
        if (cs.some(c => /^cd\s/.test(c))) add(n.line, 'run-cd', 'warn', 'RUN cd … only affects this layer', 'Use WORKDIR to change directory, or chain the command with && in the same RUN.');
        if (/\bsudo\b/.test(a)) add(n.line, 'sudo', 'warn', 'sudo in RUN', 'Builds run as root by default; use USER to switch users instead of sudo.');
        if (/\b(curl|wget)\b[^|]*\|\s*(sudo\s+)?(ba|z|da)?sh\b/.test(a)) add(n.line, 'pipe-to-shell', 'warn', 'Piping a download straight into a shell', 'Download to a file, verify a checksum, then run it.');
        const aptInstall = cs.filter(c => /^apt(-get)?\s+install\b/.test(c));
        if (cs.some(c => /^apt\s/.test(c))) add(n.line, 'apt-cli', 'info', '"apt" has an unstable CLI in scripts', 'Use apt-get (and apt-cache) in Dockerfiles.');
        if (aptInstall.length) {
          if (!aptInstall.every(c => /(\s-[a-zA-Z]*y|--yes|--assume-yes|\s-qq\b)/.test(c))) add(n.line, 'apt-no-y', 'error', 'apt-get install without -y will hang waiting for confirmation', 'Add -y (or --no-install-recommends -y) to apt-get install.');
          if (!aptInstall.every(c => /--no-install-recommends/.test(c))) add(n.line, 'apt-recommends', 'info', 'apt-get install without --no-install-recommends', 'Add --no-install-recommends to keep the image small.');
          if (!/rm\s+-rf?\s+\/var\/lib\/apt\/lists/.test(a)) add(n.line, 'apt-cleanup', 'warn', 'apt-get install without cleaning /var/lib/apt/lists in the same RUN', 'Append && rm -rf /var/lib/apt/lists/* to the same RUN so the cache is not baked into the layer.');
          if (!/apt-get\s+update/.test(a)) add(n.line, 'apt-update', 'warn', 'apt-get install without apt-get update in the same RUN', 'Put apt-get update && apt-get install in one RUN so the package index is never stale from an earlier cached layer.');
          const pkgs = aptInstall.flatMap(c => c.replace(/^apt(-get)?\s+install\b/, '').split(/\s+/).filter(p => p && !p.startsWith('-')));
          if (pkgs.length && pkgs.some(p => !p.includes('='))) add(n.line, 'apt-unpinned', 'info', `Unpinned apt packages: ${pkgs.filter(p => !p.includes('=')).slice(0, 4).join(', ')}${pkgs.length > 4 ? '…' : ''}`, 'Pin versions with package=version for reproducible builds.');
        }
        if (cs.some(c => /^apt(-get)?\s+(dist-)?upgrade\b/.test(c))) add(n.line, 'apt-upgrade', 'warn', 'apt-get upgrade in an image build', 'Use an up-to-date base image instead of upgrading inside the Dockerfile.');
        const apk = cs.filter(c => /^apk\s+add\b/.test(c));
        if (apk.length && !apk.every(c => /--no-cache/.test(c))) add(n.line, 'apk-cache', 'info', 'apk add without --no-cache', 'Use apk add --no-cache to avoid storing the package index in the layer.');
        const yum = cs.filter(c => /^(yum|dnf|microdnf)\s+install\b/.test(c));
        if (yum.length) {
          if (!yum.every(c => /(\s-y\b|--assumeyes)/.test(c))) add(n.line, 'yum-no-y', 'error', 'yum/dnf install without -y will hang', 'Add -y to the install command.');
          if (!/(yum|dnf|microdnf)\s+clean\s+all/.test(a)) add(n.line, 'yum-cleanup', 'warn', 'yum/dnf install without clean all', 'Append && yum clean all (or dnf clean all) in the same RUN.');
        }
        const pip = cs.filter(c => /^(python[0-9.]*\s+-m\s+)?pip[0-9]*\s+install\b/.test(c));
        if (pip.length && !pip.every(c => /--no-cache-dir/.test(c))) add(n.line, 'pip-cache', 'info', 'pip install without --no-cache-dir', 'Add --no-cache-dir so the pip cache is not stored in the image.');
        if (cs.some(c => /^npm\s+install\b/.test(c) && !/\s-g\b|--global/.test(c))) add(n.line, 'npm-install', 'info', 'npm install in an image build', 'Prefer npm ci with a committed package-lock.json for reproducible installs.');
        if (/\bnpm\s+(ci|install)\b/.test(a) || /\bpip[0-9]*\s+install\b/.test(a) || /\b(yarn|pnpm)\s+(install)?\b/.test(a) || /\bbundle\s+install\b/.test(a) || /\bgo\s+mod\s+download\b/.test(a)) {
          installedDeps = true;
          if (copiedAll) add(copiedAll.line, 'copy-before-install', 'info', 'COPY . . happens before dependency install, so any source change busts the dependency cache', 'Copy the manifest files first (package.json, lockfile, requirements.txt…), install, then COPY the rest.');
        }
      }
      if (n.name === 'ADD') {
        const src = n.args.replace(/\s+\S+$/, '');
        if (/^https?:\/\//.test(src)) add(n.line, 'add-url', 'info', 'ADD with a URL', 'Use RUN curl/wget (and delete the download in the same layer) or COPY --from so you control checksums and caching.');
        else if (!/\.(tar|tgz|tar\.(gz|bz2|xz|zst))$/.test(src)) add(n.line, 'add-vs-copy', 'warn', 'ADD used for local files', 'Use COPY; ADD has surprising behaviour (auto-extracting archives, fetching URLs).');
      }
      if (n.name === 'COPY' && !n.flags.from) {
        const parts = n.args.split(/\s+/);
        if (parts.length >= 2 && parts[0] === '.' && !installedDeps) copiedAll = n;
      }
      if (n.name === 'ENV' || n.name === 'ARG') {
        const pairs = n.args.includes('=') ? [...n.args.matchAll(/([A-Za-z_][A-Za-z0-9_]*)=("[^"]*"|'[^']*'|\S*)/g)].map(m => [m[1], m[2]]) : [n.args.split(/\s+/).slice(0, 2)].filter(p => p[0]);
        if (n.name === 'ENV' && !n.args.includes('=') && n.args.trim()) add(n.line, 'env-legacy', 'info', 'Legacy ENV key value form', 'Use ENV KEY=value; the space-separated form is deprecated.');
        for (const [k, v] of pairs) {
          const val = (v || '').replace(/^["']|["']$/g, '');
          if (SECRET_RE.test(k) && val && !/^\$\{?[A-Za-z_]/.test(val)) add(n.line, 'secret-in-' + n.name.toLowerCase(), n.name === 'ENV' ? 'error' : 'warn', `${n.name} ${k} looks like a secret baked into the image`, n.name === 'ENV' ? 'Never put secrets in ENV; they stay in every layer and image history. Use runtime env vars or RUN --mount=type=secret.' : 'ARG values are visible in image history; pass secrets with RUN --mount=type=secret instead.');
        }
      }
      if (n.name === 'EXPOSE') {
        for (const p of n.args.split(/\s+/).filter(Boolean)) {
          if (/^\$/.test(p)) continue;
          if (p.includes(':') && !/\/(tcp|udp)$/.test(p) || /^\d+:\d+/.test(p)) { add(n.line, 'expose-host-port', 'error', `EXPOSE "${p}" uses host:container syntax`, 'EXPOSE takes only container ports (e.g. EXPOSE 8080); publish host ports with docker run -p.'); continue; }
          const num = parseInt(p.split('/')[0], 10);
          if (!(num >= 1 && num <= 65535)) add(n.line, 'expose-range', 'error', `EXPOSE port "${p}" is out of range 1-65535`, 'Use a valid port number.');
        }
      }
      if (n.name === 'USER' && /^(root|0)(:|$)/.test(n.args)) { /* handled below for last USER */ }
    }
    const lastUser = [...st.ins].reverse().find(n => n.name === 'USER');
    const isFinal = st === stages[stages.length - 1];
    if (isFinal) {
      if (!lastUser) add(f.line, 'missing-user', 'warn', 'No USER instruction: the container runs as root', 'Create an unprivileged user and switch with USER before CMD/ENTRYPOINT.');
      else if (/^(root|0)(:|$)/.test(lastUser.args)) add(lastUser.line, 'user-root', 'warn', 'Last USER is root', 'Switch to a non-root user as the final USER.');
      if (!st.ins.some(n => n.name === 'HEALTHCHECK') && st.ins.some(n => n.name === 'EXPOSE' || n.name === 'CMD' || n.name === 'ENTRYPOINT')) add(f.line, 'missing-healthcheck', 'info', 'No HEALTHCHECK', 'Add HEALTHCHECK CMD … so orchestrators can detect a hung container (or HEALTHCHECK NONE to be explicit).');
      const relDest = st.ins.find(n => (n.name === 'COPY' || n.name === 'ADD') && !/^(\/|\$|[A-Za-z]:\\)/.test(n.args.trim().split(/\s+/).pop() || '/'));
      if (!workdir && relDest) add(relDest.line, 'missing-workdir', 'info', `${relDest.name} to a relative destination without a WORKDIR (files land in /)`, 'Set WORKDIR /app (or similar) before copying with relative paths.');
      if (!st.ins.some(n => n.name === 'CMD' || n.name === 'ENTRYPOINT') && !f.args.match(/\s+AS\s+/i)) add(f.line, 'missing-cmd', 'warn', 'No CMD or ENTRYPOINT', 'Add a CMD or ENTRYPOINT so the image runs something by default.');
    }
  }
  return finish(out);
}
function finish(out) {
  const order = { error: 0, warn: 1, info: 2 };
  return out.sort((a, b) => a.line - b.line || order[a.sev] - order[b.sev]);
}

export default function (root) {
  const s = store('dockerfile-linter');
  const ta = el('textarea', { class: 'textarea', placeholder: 'Paste a Dockerfile…', value: s.get('text', ''), style: { minHeight: '260px' } });
  const summary = el('div', { class: 'row' });
  const out = el('div', {});
  const filter = el('select', { class: 'select' }, ['all', 'error', 'warn', 'info'].map(v => el('option', { value: v }, v === 'all' ? 'All severities' : v === 'error' ? 'Errors only' : v === 'warn' ? 'Errors + warnings' : 'Everything')));
  filter.value = s.get('filter', 'all');
  let findings = [];

  function run() {
    s.set('text', ta.value); s.set('filter', filter.value);
    if (!ta.value.trim()) { render(summary); render(out, el('div', { class: 'muted' }, 'Paste a Dockerfile to lint it.')); return; }
    try { findings = lint(ta.value); }
    catch (e) { render(summary); render(out, el('div', { class: 'panel', style: { borderColor: 'var(--danger)' } }, 'Could not parse: ' + e.message)); return; }
    const c = { error: 0, warn: 0, info: 0 };
    findings.forEach(f => c[f.sev]++);
    render(summary,
      el('span', { class: 'badge ' + (c.error ? 'danger' : 'ok') }, `${c.error} error${c.error === 1 ? '' : 's'}`),
      el('span', { class: 'badge ' + (c.warn ? 'warn' : 'ok') }, `${c.warn} warning${c.warn === 1 ? '' : 's'}`),
      el('span', { class: 'badge' }, `${c.info} info`),
      filter,
      el('span', { class: 'grow' }),
      el('button', { class: 'btn small', onclick: () => copy(asText()) }, 'Copy report'),
      el('button', { class: 'btn small', onclick: () => download('dockerfile-lint.txt', asText()) }, 'Download'));
    const lim = filter.value === 'error' ? ['error'] : filter.value === 'warn' ? ['error', 'warn'] : ['error', 'warn', 'info'];
    const shown = findings.filter(f => lim.includes(f.sev));
    render(out, shown.length ? el('table', { class: 'table' },
      el('thead', {}, el('tr', {}, el('th', {}, 'Line'), el('th', {}, 'Severity'), el('th', {}, 'Rule'), el('th', {}, 'Finding'))),
      el('tbody', {}, shown.map(f => el('tr', {},
        el('td', { class: 'mono' }, f.line),
        el('td', {}, el('span', { class: 'badge ' + (f.sev === 'error' ? 'danger' : f.sev === 'warn' ? 'warn' : '') }, f.sev)),
        el('td', { class: 'mono small muted' }, f.rule),
        el('td', {}, el('div', {}, f.msg), el('div', { class: 'small muted' }, 'Fix: ' + f.fix)))))) :
      el('div', { class: 'panel' }, findings.length ? 'No findings at this severity.' : 'No findings. Nice Dockerfile.'));
  }
  function asText() { return findings.map(f => `${f.line}: [${f.sev}] ${f.rule} - ${f.msg}\n    fix: ${f.fix}`).join('\n'); }

  let t = null;
  ta.addEventListener('input', () => { clearTimeout(t); t = setTimeout(run, 250); });
  filter.addEventListener('change', run);
  render(root,
    ta,
    el('div', { class: 'row' },
      el('button', { class: 'btn primary', onclick: run }, 'Lint'),
      el('button', { class: 'btn ghost', onclick: () => { ta.value = SAMPLE; run(); } }, 'Sample'),
      el('button', { class: 'btn ghost', onclick: () => { ta.value = ''; run(); } }, 'Clear'),
      el('span', { class: 'muted small' }, 'Rules: tags, USER, HEALTHCHECK, WORKDIR, apt/apk/yum/pip/npm hygiene, ADD vs COPY, CMD/ENTRYPOINT, secrets in ENV/ARG, EXPOSE, sudo, curl | sh, layer caching, deprecated syntax.')),
    summary, out);
  run();
  return () => clearTimeout(t);
}
