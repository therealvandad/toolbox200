// Git command trainer: a simulated repository drawn on canvas plus guided challenges.
import { el, render, store, toast } from '../../lib/ui.js';

const COLORS = ['#2f6fed', '#1f9d55', '#d98c0b', '#d64545', '#8e44ad', '#16a085', '#e67e22', '#2c3e50'];

// ---------- simulated repo ----------
function newRepo() {
  const r = { commits: {}, order: [], branches: {}, head: { branch: 'main', detached: null }, seq: 0 };
  commit(r, 'Initial commit');
  return r;
}
function shortId(r) { r.seq++; return ('c' + r.seq); }
function headCommit(r) { return r.head.detached || r.branches[r.head.branch]; }
function commit(r, msg, extraParent) {
  const id = shortId(r);
  const parents = []; const h = headCommit(r); if (h) parents.push(h); if (extraParent) parents.push(extraParent);
  r.commits[id] = { id, parents, msg, t: r.order.length };
  r.order.push(id);
  if (r.head.detached) r.head.detached = id; else r.branches[r.head.branch] = id;
  return id;
}
function ancestors(r, id) { const seen = new Set(); const st = [id]; while (st.length) { const c = st.pop(); if (!c || seen.has(c)) continue; seen.add(c); st.push(...r.commits[c].parents); } return seen; }
function resolveRef(r, ref) {
  if (!ref || ref === 'HEAD') return headCommit(r);
  const m = ref.match(/^(.*?)(~(\d*)|\^)$/);
  if (m) { let c = resolveRef(r, m[1] || 'HEAD'); const n = m[2] === '^' ? 1 : (m[3] === '' ? 1 : +m[3]); for (let i = 0; i < n && c; i++) c = r.commits[c].parents[0]; return c || null; }
  if (r.branches[ref] !== undefined) return r.branches[ref];
  if (r.commits[ref]) return ref;
  return null;
}
function run(r, line) {
  const out = []; const say = s => out.push(s);
  const args = (line.match(/"[^"]*"|'[^']*'|\S+/g) || []).map(a => a.replace(/^["']|["']$/g, ''));
  if (args[0] !== 'git') { say('Commands start with "git". Try: git help'); return out; }
  const cmd = args[1];
  const branchName = n => { if (!n || !/^[A-Za-z0-9._\/-]+$/.test(n) || n === 'HEAD') { throw new Error("'" + (n ?? '') + "' is not a valid branch name"); } };
  try {
    switch (cmd) {
      case 'help': case undefined:
        say('Supported commands:'); say('  git commit -m "msg"       git log            git status'); say('  git branch [name]         git branch -d name'); say('  git checkout <branch|id>  git checkout -b name'); say('  git switch <branch>       git switch -c name'); say('  git merge <branch>        git reset --hard <ref>   (refs: HEAD~1, main, c3 ...)'); break;
      case 'status': say('On branch ' + (r.head.detached ? '(detached HEAD at ' + r.head.detached + ')' : r.head.branch)); say('nothing to commit, working tree clean'); break;
      case 'commit': {
        let msg = null; const mi = args.indexOf('-m'); if (mi > 0) msg = args[mi + 1]; if (args.includes('-am')) msg = args[args.indexOf('-am') + 1];
        if (!msg) throw new Error('Please supply a message: git commit -m "message"');
        const id = commit(r, msg); say('[' + (r.head.detached ? 'detached HEAD' : r.head.branch) + ' ' + id + '] ' + msg); break;
      }
      case 'log': {
        let c = headCommit(r); const seen = new Set(); const queue = [c];
        while (queue.length) { const id = queue.shift(); if (!id || seen.has(id)) continue; seen.add(id); const k = r.commits[id]; const refs = Object.entries(r.branches).filter(([, v]) => v === id).map(([b]) => (r.head.branch === b && !r.head.detached ? 'HEAD -> ' : '') + b); say(id + (refs.length ? ' (' + refs.join(', ') + ')' : '') + (k.parents.length > 1 ? ' [merge]' : '') + '  ' + k.msg); queue.push(...k.parents); }
        break;
      }
      case 'branch': {
        if (args[2] === '-d' || args[2] === '-D') { const n = args[3]; if (!r.branches[n]) throw new Error("branch '" + n + "' not found"); if (n === r.head.branch && !r.head.detached) throw new Error("Cannot delete branch '" + n + "' checked out"); delete r.branches[n]; say('Deleted branch ' + n); break; }
        if (!args[2]) { Object.keys(r.branches).sort().forEach(b => say((b === r.head.branch && !r.head.detached ? '* ' : '  ') + b)); break; }
        branchName(args[2]); if (r.branches[args[2]] !== undefined) throw new Error("a branch named '" + args[2] + "' already exists");
        r.branches[args[2]] = resolveRef(r, args[3]) || headCommit(r); say('Created branch ' + args[2]); break;
      }
      case 'checkout': case 'switch': {
        let target = args[2];
        if ((cmd === 'checkout' && target === '-b') || (cmd === 'switch' && target === '-c')) {
          const n = args[3]; branchName(n); if (r.branches[n] !== undefined) throw new Error("a branch named '" + n + "' already exists");
          r.branches[n] = resolveRef(r, args[4]) || headCommit(r); r.head = { branch: n, detached: null }; say("Switched to a new branch '" + n + "'"); break;
        }
        if (!target) throw new Error('Specify a branch');
        if (r.branches[target] !== undefined) { r.head = { branch: target, detached: null }; say("Switched to branch '" + target + "'"); break; }
        if (cmd === 'switch') throw new Error("invalid reference: " + target + ' (use --detach or checkout for commits)');
        const c = resolveRef(r, target); if (!c) throw new Error("pathspec '" + target + "' did not match any branch or commit");
        r.head = { branch: null, detached: c }; say('Note: switching to ' + c + '. You are in detached HEAD state.'); break;
      }
      case 'merge': {
        const n = args[2]; if (!n) throw new Error('Specify a branch to merge');
        const theirs = resolveRef(r, n); if (!theirs) throw new Error("merge: " + n + " - not something we can merge");
        const ours = headCommit(r);
        if (ours === theirs || ancestors(r, ours).has(theirs)) { say('Already up to date.'); break; }
        if (ancestors(r, theirs).has(ours)) { if (r.head.detached) r.head.detached = theirs; else r.branches[r.head.branch] = theirs; say('Updating ' + ours + '..' + theirs); say('Fast-forward'); break; }
        const id = commit(r, "Merge branch '" + n + "'" + (r.head.branch ? ' into ' + r.head.branch : ''), theirs);
        say("Merge made by the 'ort' strategy. [" + id + ']'); break;
      }
      case 'reset': {
        const hard = args.includes('--hard'); const ref = args.filter(a => !a.startsWith('-')).slice(2)[0] || 'HEAD';
        if (!hard) throw new Error('Only --hard resets are simulated here (there is no index or working tree)');
        const c = resolveRef(r, ref); if (!c) throw new Error("unknown revision '" + ref + "'");
        if (r.head.detached) r.head.detached = c; else r.branches[r.head.branch] = c; say('HEAD is now at ' + c + ' ' + r.commits[c].msg); break;
      }
      default: throw new Error("'" + cmd + "' is not a supported git command. Try: git help");
    }
  } catch (e) { say('error: ' + e.message); }
  return out;
}

// ---------- challenges ----------
const CHALLENGES = [
  { title: 'First commits', text: 'Make two new commits on main (any messages).', setup: newRepo, check: r => r.order.length >= 3 && !r.head.detached && r.head.branch === 'main' && r.branches.main === r.order[r.order.length - 1] },
  { title: 'Create a branch', text: 'Create a branch called "feature" and switch to it (hint: git checkout -b or git switch -c).', setup: newRepo, check: r => r.branches.feature !== undefined && r.head.branch === 'feature' },
  { title: 'Diverge', text: 'On a new branch "feature", make one commit. Then go back to main and make one commit there too, so the branches diverge.', setup: newRepo,
    check: r => { const f = r.branches.feature, m = r.branches.main; return f && m && f !== m && !ancestors(r, f).has(m) && !ancestors(r, m).has(f); } },
  { title: 'Fast-forward merge', text: 'The repo has a "feature" branch ahead of main. Merge it into main so main points at the same commit (a fast-forward).',
    setup: () => { const r = newRepo(); r.branches.feature = r.branches.main; r.head = { branch: 'feature', detached: null }; commit(r, 'Add login page'); commit(r, 'Fix typo'); r.head = { branch: 'main', detached: null }; return r; },
    check: r => r.branches.main === r.branches.feature && r.head.branch === 'main' && r.order.length === 3 },
  { title: 'Merge commit', text: 'main and "feature" have diverged. Merge feature into main; the result should be a merge commit with two parents.',
    setup: () => { const r = newRepo(); r.branches.feature = r.branches.main; r.head = { branch: 'feature', detached: null }; commit(r, 'Add search'); r.head = { branch: 'main', detached: null }; commit(r, 'Update readme'); return r; },
    check: r => { const m = r.commits[r.branches.main]; return r.head.branch === 'main' && m.parents.length === 2 && ancestors(r, r.branches.main).has(r.branches.feature); } },
  { title: 'Undo with reset', text: 'main has three commits; the last two were mistakes. Use git reset --hard to move main back to the initial commit (c1).',
    setup: () => { const r = newRepo(); commit(r, 'Oops'); commit(r, 'Oops again'); return r; },
    check: r => r.branches.main === 'c1' && r.head.branch === 'main' },
  { title: 'Detached HEAD', text: 'Check out commit c1 directly (detached HEAD), create a branch "hotfix" from there and make a commit on it.',
    setup: () => { const r = newRepo(); commit(r, 'Feature A'); commit(r, 'Feature B'); return r; },
    check: r => r.branches.hotfix && r.head.branch === 'hotfix' && r.commits[r.branches.hotfix].parents[0] === 'c1' },
  { title: 'Clean up', text: 'After merging "feature" into main (fast-forward), delete the feature branch.',
    setup: () => { const r = newRepo(); r.branches.feature = r.branches.main; r.head = { branch: 'feature', detached: null }; commit(r, 'Work'); r.head = { branch: 'main', detached: null }; return r; },
    check: r => r.branches.feature === undefined && r.branches.main === 'c2' },
  { title: 'Two features', text: 'Create branches "a" and "b" from main, make one commit on each, then merge both into main (main should contain both commits).',
    setup: newRepo,
    check: r => { if (!r.branches.a || !r.branches.b || r.head.branch !== 'main') return false; const anc = ancestors(r, r.branches.main); return anc.has(r.branches.a) && anc.has(r.branches.b) && r.branches.a !== r.branches.b && r.branches.a !== 'c1' && r.branches.b !== 'c1'; } },
];

export default function (root) {
  const s = store('git-trainer');
  let solved = new Set(s.get('solved', []));
  let chIdx = Math.min(s.get('challenge', 0), CHALLENGES.length - 1);
  let repo = newRepo();
  let freePlay = false;

  const canvas = el('canvas', { width: 820, height: 300, style: { width: '100%', maxWidth: '820px', height: 'auto', display: 'block' } });
  const term = el('pre', { class: 'out mono small', style: { minHeight: '140px', maxHeight: '220px', overflow: 'auto', margin: 0, whiteSpace: 'pre-wrap' } });
  const input = el('input', { class: 'input mono grow', placeholder: 'git commit -m "message"', spellcheck: false, autocomplete: 'off' });
  const chBox = el('div', { class: 'panel' });
  const status = el('div', { class: 'row' });
  const hist = []; let hIdx = 0;

  function layout() {
    // Assign lanes: each commit takes the lane of its first parent unless that lane is already continued.
    const lanes = {}, used = {}; let maxLane = 0;
    for (const id of repo.order) {
      const c = repo.commits[id]; const p = c.parents[0];
      let lane;
      if (p == null) lane = 0;
      else if (!used[p]) { lane = lanes[p]; used[p] = true; }
      else { lane = 0; const taken = new Set(repo.order.filter(o => repo.commits[o].t <= c.t && repo.commits[o].t >= repo.commits[p].t).map(o => lanes[o])); while (taken.has(lane)) lane++; }
      lanes[id] = lane; maxLane = Math.max(maxLane, lane);
    }
    return { lanes, maxLane };
  }
  function draw() {
    const ctx = canvas.getContext('2d'); const W = canvas.width, H = canvas.height;
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    const cs = getComputedStyle(document.documentElement);
    const text = cs.getPropertyValue('--text').trim() || (dark ? '#eee' : '#111'); const muted = cs.getPropertyValue('--muted').trim() || '#888';
    ctx.clearRect(0, 0, W, H);
    const { lanes, maxLane } = layout();
    const n = repo.order.length; const gapX = Math.min(110, (W - 80) / Math.max(1, n - 1)); const gapY = Math.min(60, (H - 90) / Math.max(1, maxLane));
    const pos = {}; repo.order.forEach((id, i) => { pos[id] = { x: 40 + i * gapX, y: 40 + lanes[id] * gapY }; });
    ctx.lineWidth = 2;
    for (const id of repo.order) for (const p of repo.commits[id].parents) { const a = pos[p], b = pos[id]; ctx.strokeStyle = COLORS[lanes[id] % COLORS.length]; ctx.beginPath(); ctx.moveTo(a.x, a.y); if (a.y === b.y) ctx.lineTo(b.x, b.y); else ctx.bezierCurveTo(a.x + gapX / 2, a.y, b.x - gapX / 2, b.y, b.x, b.y); ctx.stroke(); }
    const head = headCommit(repo);
    for (const id of repo.order) {
      const { x, y } = pos[id];
      ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fillStyle = COLORS[lanes[id] % COLORS.length]; ctx.fill();
      if (id === head) { ctx.strokeStyle = text; ctx.lineWidth = 3; ctx.stroke(); ctx.lineWidth = 2; }
      ctx.fillStyle = text; ctx.font = 'bold 11px ui-monospace,Consolas,monospace'; ctx.textAlign = 'center'; ctx.fillText(id, x, y + 24);
      ctx.fillStyle = muted; ctx.font = '10px system-ui,sans-serif'; const m = repo.commits[id].msg; ctx.fillText(m.length > 14 ? m.slice(0, 13) + '…' : m, x, y + 36);
    }
    // branch labels
    const byCommit = {}; for (const [b, c] of Object.entries(repo.branches)) (byCommit[c] ??= []).push(b);
    ctx.font = 'bold 11px system-ui,sans-serif';
    for (const [c, bs] of Object.entries(byCommit)) {
      const { x, y } = pos[c]; let off = -18;
      for (const b of bs) {
        const label = (repo.head.branch === b && !repo.head.detached ? 'HEAD → ' : '') + b; const w = ctx.measureText(label).width + 10;
        ctx.fillStyle = repo.head.branch === b && !repo.head.detached ? COLORS[0] : (dark ? '#2a2f3a' : '#e2e5ea'); ctx.beginPath(); ctx.roundRect(x - w / 2, y + off - 11, w, 16, 4); ctx.fill();
        ctx.fillStyle = repo.head.branch === b && !repo.head.detached ? '#fff' : text; ctx.fillText(label, x, y + off + 1); off -= 18;
      }
    }
    if (repo.head.detached) { const { x, y } = pos[repo.head.detached]; const label = 'HEAD (detached)'; const w = ctx.measureText(label).width + 10; ctx.fillStyle = COLORS[3]; ctx.beginPath(); ctx.roundRect(x - w / 2, y - 29, w, 16, 4); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText(label, x, y - 17); }
  }
  function print(lines, prompt) { if (prompt) term.append('$ ' + prompt + '\n'); for (const l of lines) term.append(l + '\n'); term.scrollTop = term.scrollHeight; }
  function exec(line) {
    line = line.trim(); if (!line) return;
    hist.push(line); hIdx = hist.length;
    if (line === 'clear') { term.textContent = ''; return; }
    const out = run(repo, line); print(out, line); draw(); checkGoal();
  }
  function checkGoal() {
    if (freePlay) { render(status, el('span', { class: 'badge' }, 'Free play'), el('span', { class: 'muted small' }, repo.order.length + ' commits, ' + Object.keys(repo.branches).length + ' branches')); return; }
    const ch = CHALLENGES[chIdx]; const ok = ch.check(repo);
    if (ok && !solved.has(chIdx)) { solved.add(chIdx); s.set('solved', [...solved]); toast('Challenge solved!'); }
    render(status, el('span', { class: 'badge ' + (ok ? 'ok' : '') }, ok ? 'Goal reached' : 'Goal not reached yet'), el('span', { class: 'muted small' }, solved.size + '/' + CHALLENGES.length + ' solved'), ok && chIdx < CHALLENGES.length - 1 ? el('button', { class: 'btn small primary', onclick: () => load(chIdx + 1) }, 'Next challenge ›') : null);
  }
  function load(i, free = false) {
    freePlay = free; chIdx = i; s.set('challenge', i); repo = free ? newRepo() : CHALLENGES[i].setup();
    term.textContent = ''; print([free ? 'Free play: a fresh repo with one commit. Type git help to see the commands.' : 'Challenge ' + (i + 1) + ' loaded. Type git help to see the commands.']);
    render(chBox, free ? el('div', {}, el('b', {}, 'Free play'), el('div', { class: 'muted small' }, 'Experiment with commits, branches, merges and resets.')) :
      el('div', {}, el('div', { class: 'row', style: { margin: 0 } }, el('b', {}, 'Challenge ' + (i + 1) + ': ' + CHALLENGES[i].title), solved.has(i) ? el('span', { class: 'badge ok' }, 'solved') : null), el('div', {}, CHALLENGES[i].text)));
    draw(); checkGoal(); input.focus();
  }
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { exec(input.value); input.value = ''; }
    else if (e.key === 'ArrowUp') { if (hIdx > 0) { hIdx--; input.value = hist[hIdx]; e.preventDefault(); } }
    else if (e.key === 'ArrowDown') { if (hIdx < hist.length - 1) { hIdx++; input.value = hist[hIdx]; } else { hIdx = hist.length; input.value = ''; } }
    else if (e.key === 'Escape') input.value = '';
  });
  const picker = el('select', { class: 'select', onchange: () => picker.value === 'free' ? load(chIdx, true) : load(+picker.value) }, CHALLENGES.map((c, i) => el('option', { value: i }, (i + 1) + '. ' + c.title + (solved.has(i) ? ' ✓' : ''))), el('option', { value: 'free' }, 'Free play'));
  picker.value = String(chIdx);
  const onTheme = () => draw(); window.addEventListener('themechange', onTheme);
  const mo = new MutationObserver(draw); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  render(root,
    el('div', { class: 'row' }, picker,
      el('button', { class: 'btn', onclick: () => load(chIdx, freePlay) }, 'Reset repo'),
      el('button', { class: 'btn ghost', onclick: () => { solved = new Set(); s.set('solved', []); checkGoal(); } }, 'Clear progress')),
    chBox,
    el('div', { class: 'canvas-wrap' }, canvas),
    status,
    term,
    el('div', { class: 'row' }, el('span', { class: 'mono muted' }, '$'), input, el('button', { class: 'btn primary', onclick: () => { exec(input.value); input.value = ''; input.focus(); } }, 'Run')),
    el('div', { class: 'row' }, ['git commit -m "msg"', 'git branch feature', 'git checkout -b feature', 'git switch main', 'git merge feature', 'git reset --hard HEAD~1', 'git log'].map(c => el('button', { class: 'btn small ghost mono', onclick: () => { input.value = c; input.focus(); } }, c))),
    el('div', { class: 'muted small' }, 'Up/Down arrows recall commands. The graph shows commits left to right; branch labels sit above their commit and the HEAD commit has a ring.'));
  load(chIdx);
  return () => { window.removeEventListener('themechange', onTheme); mo.disconnect(); };
}
