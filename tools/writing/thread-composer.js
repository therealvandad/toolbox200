import { el, render, store, copy } from '../../lib/ui.js';

const LIMIT = 280;

// Count characters like X does: URLs count as 23 characters.
const tlen = t => [...t.replace(/https?:\/\/\S+/g, 'x'.repeat(23))].length;

function units(text) {
  // Break into sentences, remembering whether a paragraph break preceded each.
  const out = [];
  const paras = text.replace(/\r/g, '').split(/\n\s*\n/);
  paras.forEach((p, pi) => {
    const sentences = p.replace(/\s*\n\s*/g, ' ').trim().match(/[^.!?]+(?:[.!?]+["')\]]*|$)\s*/g) || [];
    sentences.map(x => x.trim()).filter(Boolean).forEach((x, si) => out.push({ t: x, para: si === 0 && pi > 0 }));
  });
  return out;
}
function hardSplit(t, max) {
  const out = []; let cur = '';
  for (const w of t.split(/\s+/)) {
    if (tlen(w) > max) { // very long word: cut it
      if (cur) { out.push(cur); cur = ''; }
      let rest = w; while (rest.length > max) { out.push(rest.slice(0, max)); rest = rest.slice(max); }
      cur = rest; continue;
    }
    if (cur && tlen(cur + ' ' + w) > max) { out.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w;
  }
  if (cur) out.push(cur);
  return out;
}
export function split(text, reserve) {
  const max = LIMIT - reserve;
  const posts = []; let cur = '';
  for (const u of units(text)) {
    const sep = u.para ? '\n\n' : ' ';
    if (tlen(u.t) > max) {
      if (cur) { posts.push(cur); cur = ''; }
      const pieces = hardSplit(u.t, max);
      pieces.slice(0, -1).forEach(p => posts.push(p));
      cur = pieces[pieces.length - 1];
      continue;
    }
    if (cur && tlen(cur + sep + u.t) <= max) cur += sep + u.t;
    else { if (cur) posts.push(cur); cur = u.t; }
  }
  if (cur) posts.push(cur);
  return posts;
}
function smartSplit(text, numbered) {
  if (!numbered) return split(text, 0);
  let digits = 1, posts;
  for (let k = 0; k < 4; k++) {
    posts = split(text, 2 * digits + 2); // " " + n + "/" + m
    const d = String(posts.length).length;
    if (d <= digits) break;
    digits = d;
  }
  return posts;
}

export default function (root) {
  const s = store('thread-composer');
  let posts = s.get('posts', []);
  let numbered = s.get('numbered', true);
  const ta = el('textarea', { class: 'textarea prose', rows: 9, placeholder: 'Write or paste your long text here. It will be split into posts at sentence boundaries…', value: s.get('text', '') });
  const numChk = el('input', { type: 'checkbox', checked: numbered });
  const total = el('div', { class: 'row' });
  const listBox = el('div', { class: 'col' });
  const suffix = i => (numbered ? ` ${i + 1}/${posts.length}` : '');

  const fullText = i => posts[i] + suffix(i);
  function splitNow() {
    s.set('text', ta.value);
    posts = ta.value.trim() ? smartSplit(ta.value, numbered) : [];
    s.set('posts', posts);
    draw();
  }
  function draw() {
    s.set('posts', posts); s.set('numbered', numbered);
    const over = posts.filter((_, i) => tlen(fullText(i)) > LIMIT).length;
    render(total, posts.length ? [el('span', { class: 'badge' }, `${posts.length} post${posts.length > 1 ? 's' : ''}`), over ? el('span', { class: 'badge danger' }, `${over} over ${LIMIT}`) : el('span', { class: 'badge ok' }, 'all within 280')] : null);
    render(listBox, posts.length ? posts.map((p, i) => {
      const cnt = el('span', { class: 'small mono' });
      const upd = () => { const n = tlen(fullText(i)); cnt.textContent = `${n}/${LIMIT}`; cnt.style.color = n > LIMIT ? 'var(--danger)' : n > LIMIT - 20 ? 'var(--warn)' : 'var(--muted)'; };
      const box = el('textarea', { class: 'textarea prose', rows: Math.max(2, Math.ceil(p.length / 70)), value: p, style: { minHeight: '56px' } });
      box.addEventListener('input', () => { posts[i] = box.value; s.set('posts', posts); upd(); draw2(); });
      upd();
      return el('div', { class: 'panel' }, box,
        el('div', { class: 'row', style: { margin: '4px 0 0' } }, cnt, numbered ? el('span', { class: 'muted small' }, `+ "${suffix(i).trim()}" appended`) : null, el('span', { class: 'grow' }),
          el('button', { class: 'btn small', onclick: () => copy(fullText(i)) }, 'Copy'),
          el('button', { class: 'btn small danger ghost', onclick: () => { posts.splice(i, 1); draw(); } }, 'Remove'),
          i < posts.length - 1 ? el('button', { class: 'btn small ghost', title: 'Merge with next post', onclick: () => { posts[i] = posts[i] + ' ' + posts[i + 1]; posts.splice(i + 1, 1); draw(); } }, 'Merge down') : null));
    }) : el('div', { class: 'empty' }, 'Posts will appear here.'));
  }
  function draw2() { // update only the summary badges while typing (keeps textarea focus)
    const over = posts.filter((_, i) => tlen(fullText(i)) > LIMIT).length;
    render(total, el('span', { class: 'badge' }, `${posts.length} post${posts.length > 1 ? 's' : ''}`), over ? el('span', { class: 'badge danger' }, `${over} over ${LIMIT}`) : el('span', { class: 'badge ok' }, 'all within 280'));
  }
  numChk.addEventListener('change', () => { numbered = numChk.checked; if (ta.value.trim()) splitNow(); else draw(); });
  ta.addEventListener('input', () => { s.set('text', ta.value); });

  render(root, ta,
    el('div', { class: 'row' },
      el('button', { class: 'btn primary', onclick: splitNow }, 'Split into posts'),
      el('label', { class: 'inline' }, numChk, 'Number posts (1/n)'),
      el('span', { class: 'muted small' }, `${tlen(ta.value)} characters in source`)),
    total, listBox,
    el('div', { class: 'row' }, el('button', { class: 'btn primary', disabled: false, onclick: () => posts.length && copy(posts.map((_, i) => fullText(i)).join('\n\n')) }, 'Copy all (blank line between posts)'),
      el('button', { class: 'btn', onclick: () => posts.length && copy(posts.map((_, i) => fullText(i)).join('\n---\n')) }, 'Copy all with --- separators')));
  if (posts.length) draw(); else if (ta.value.trim()) splitNow(); else draw();
}
