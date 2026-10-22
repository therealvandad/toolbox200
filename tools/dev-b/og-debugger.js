// Open Graph tag debugger: extract og:/twitter:/title/description/canonical from HTML and preview share cards.
import { el, render, store, copy, toast } from '../../lib/ui.js';

const SAMPLE = `<!doctype html>
<html><head>
<title>Toolbox 200 — 200 tiny browser tools</title>
<meta name="description" content="A static site of two hundred small tools that run entirely in your browser.">
<link rel="canonical" href="https://example.com/toolbox">
<meta property="og:title" content="Toolbox 200">
<meta property="og:description" content="Two hundred small tools that run entirely in your browser. No accounts, no uploads.">
<meta property="og:image" content="https://picsum.photos/seed/toolbox/1200/630">
<meta property="og:url" content="https://example.com/toolbox">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Toolbox 200">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@example">
</head><body></body></html>`;

export function extractMeta(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const tags = [];
  doc.querySelectorAll('meta').forEach(m => {
    const key = m.getAttribute('property') || m.getAttribute('name') || m.getAttribute('itemprop');
    const content = m.getAttribute('content');
    if (key && content != null) tags.push({ key: key.trim(), value: content.trim() });
  });
  const get = k => { const t = tags.find(x => x.key.toLowerCase() === k.toLowerCase()); return t ? t.value : ''; };
  const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href') || '';
  const title = doc.querySelector('title')?.textContent.trim() || '';
  return { tags, get, title, canonical, description: get('description'),
    og: tags.filter(t => /^og:/i.test(t.key)), twitter: tags.filter(t => /^twitter:/i.test(t.key)) };
}

export function analyze(m) {
  const w = [];
  const warn = (level, text) => w.push({ level, text });
  const ogTitle = m.get('og:title'), ogDesc = m.get('og:description'), ogImg = m.get('og:image'), ogUrl = m.get('og:url'), card = m.get('twitter:card');
  if (!m.title) warn('danger', 'No <title> element.');
  if (!m.description) warn('warn', 'No meta description — crawlers fall back to page text.');
  if (!ogTitle) warn('danger', 'og:title missing — most platforms fall back to <title>, Facebook may show the URL.');
  if (!ogDesc) warn('warn', 'og:description missing — falls back to meta description where available.');
  if (!ogImg) warn('danger', 'og:image missing — the link will render without a picture.');
  if (!ogUrl) warn('warn', 'og:url missing — the canonical share URL cannot be de-duplicated.');
  if (!m.get('og:type')) warn('info', 'og:type missing — defaults to "website".');
  if (!card) warn('warn', 'twitter:card missing — X/Twitter will show a plain link or a small summary.');
  else if (!['summary', 'summary_large_image', 'app', 'player'].includes(card)) warn('danger', `twitter:card "${card}" is not a valid card type.`);
  if (ogTitle.length > 60) warn('warn', `og:title is ${ogTitle.length} chars; Facebook truncates around 60–90, X around 70.`);
  if (ogDesc.length > 200) warn('warn', `og:description is ${ogDesc.length} chars; X truncates around 200, Facebook around 300.`);
  if (ogDesc && ogDesc.length < 40) warn('info', 'og:description is very short.');
  for (const [k, v] of [['og:image', ogImg], ['twitter:image', m.get('twitter:image')], ['og:url', ogUrl], ['canonical', m.canonical]]) {
    if (v && !/^https?:\/\//i.test(v)) warn('danger', `${k} is not an absolute https URL: "${v}"`);
    else if (v && /^http:\/\//i.test(v)) warn('warn', `${k} uses http:// — some platforms refuse mixed content images.`);
  }
  if (ogImg && (!m.get('og:image:width') || !m.get('og:image:height'))) warn('info', 'og:image:width/height missing — Facebook renders the first share without an image until it has fetched it.');
  if (ogUrl && m.canonical && ogUrl !== m.canonical) warn('warn', 'og:url and canonical differ.');
  if (m.title && ogTitle && m.title === ogTitle) warn('info', 'og:title equals <title>; usually fine, but the share title can be shorter and punchier.');
  const dups = m.tags.map(t => t.key).filter((k, i, a) => a.indexOf(k) !== i && !/^og:image|^og:locale:alternate|^article:tag/.test(k));
  if (dups.length) warn('warn', 'Duplicate tags: ' + [...new Set(dups)].join(', '));
  return w;
}

export default function (root) {
  const s = store('og-debugger');
  const urlIn = el('input', { class: 'input grow', placeholder: 'https://example.com/page (try to fetch)', style: { minWidth: '220px' } });
  const fetchMsg = el('div', { class: 'muted small' });
  const ta = el('textarea', { class: 'textarea', style: { minHeight: '180px' }, placeholder: 'Paste the page HTML source here…', value: s.get('html', SAMPLE) });
  const out = el('div');

  async function tryFetch() {
    let u = urlIn.value.trim(); if (!u) return;
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    fetchMsg.textContent = 'Fetching…';
    try {
      const r = await fetch(u, { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      ta.value = await r.text(); fetchMsg.textContent = 'Loaded ' + u; update();
    } catch (e) {
      fetchMsg.textContent = `Could not fetch (${e.message}). Browsers only allow reading a cross-origin page when it sends Access-Control-Allow-Origin, which almost no site does for HTML — this is CORS, not a bug. View the page source (Ctrl+U) and paste it above instead.`;
    }
  }
  urlIn.addEventListener('keydown', e => { if (e.key === 'Enter') tryFetch(); });

  function host(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u || ''; } }
  function imgBox(src, style) {
    const box = el('div', { style: Object.assign({ background: 'var(--line)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: '12px' }, style) }, src ? 'loading image…' : 'no og:image');
    if (src && /^https?:\/\//i.test(src)) {
      const img = el('img', { src, alt: '', style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' } });
      img.onload = () => render(box, img);
      img.onerror = () => render(box, 'image could not be loaded (' + host(src) + ')');
    }
    return box;
  }
  const clip = (t, n) => t.length > n ? t.slice(0, n - 1) + '…' : t;

  function previews(m) {
    const title = m.get('og:title') || m.get('twitter:title') || m.title || '(no title)';
    const desc = m.get('og:description') || m.get('twitter:description') || m.description || '';
    const img = m.get('twitter:image') || m.get('og:image');
    const url = m.get('og:url') || m.canonical || '';
    const site = m.get('og:site_name') || host(url);
    const large = (m.get('twitter:card') || 'summary_large_image') !== 'summary';
    const card = (label, node) => el('div', { style: { maxWidth: '520px', width: '100%' } }, el('div', { class: 'muted small', style: { marginBottom: '4px' } }, label), node);
    const twitter = large
      ? el('div', { style: { border: '1px solid var(--line)', borderRadius: '16px', overflow: 'hidden', fontFamily: 'system-ui' } },
        imgBox(img, { aspectRatio: '1.91', width: '100%' }),
        el('div', { style: { padding: '10px 12px', fontSize: '14px' } }, el('div', { class: 'muted small' }, host(url)), el('div', { style: { fontWeight: 600 } }, clip(title, 70)), el('div', { class: 'muted small' }, clip(desc, 200))))
      : el('div', { style: { border: '1px solid var(--line)', borderRadius: '16px', overflow: 'hidden', display: 'flex' } },
        imgBox(img, { width: '120px', minHeight: '120px', flex: 'none' }),
        el('div', { style: { padding: '10px 12px', fontSize: '14px', minWidth: 0 } }, el('div', { class: 'muted small' }, host(url)), el('div', { style: { fontWeight: 600 } }, clip(title, 70)), el('div', { class: 'muted small' }, clip(desc, 120))));
    const fb = el('div', { style: { border: '1px solid var(--line)', background: 'var(--bg)', fontFamily: 'system-ui' } },
      imgBox(m.get('og:image'), { aspectRatio: '1.91', width: '100%' }),
      el('div', { style: { padding: '10px 12px' } }, el('div', { class: 'muted small', style: { textTransform: 'uppercase' } }, host(url)), el('div', { style: { fontWeight: 700, fontSize: '16px' } }, clip(title, 88)), el('div', { class: 'muted small' }, clip(desc, 300))));
    const slack = el('div', { style: { borderLeft: '4px solid var(--line)', paddingLeft: '12px', fontFamily: 'system-ui', fontSize: '14px' } },
      el('div', { style: { fontWeight: 700 } }, site), el('div', { style: { color: 'var(--accent)', fontWeight: 600 } }, clip(title, 100)), el('div', {}, clip(desc, 300)),
      imgBox(m.get('og:image'), { width: '100%', maxWidth: '360px', aspectRatio: '1.91', marginTop: '8px', borderRadius: '8px' }));
    return el('div', { class: 'row', style: { alignItems: 'flex-start', gap: '20px' } }, card('X / Twitter (' + (large ? 'summary_large_image' : 'summary') + ')', twitter), card('Facebook / LinkedIn', fb), card('Slack / Discord', slack));
  }

  function update() {
    const html = ta.value; s.set('html', html);
    if (!html.trim()) { render(out, el('div', { class: 'muted' }, 'Paste HTML to analyze.')); return; }
    const m = extractMeta(html);
    const warnings = analyze(m);
    const rowsBasic = [['<title>', m.title], ['description', m.description], ['canonical', m.canonical]];
    const table = (rows) => el('table', { class: 'table' }, el('tbody', {}, rows.map(([k, v]) => el('tr', {}, el('td', { class: 'mono small', style: { whiteSpace: 'nowrap' } }, k), el('td', { class: 'small', style: { wordBreak: 'break-all' } }, v || el('span', { class: 'muted' }, '— missing'), v ? el('span', { class: 'muted' }, ` (${v.length})`) : null)))));
    render(out,
      el('h3', { style: { margin: '12px 0 6px', fontSize: '16px' } }, 'Preview'),
      previews(m),
      el('h3', { style: { margin: '16px 0 6px', fontSize: '16px' } }, 'Checks'),
      warnings.length ? el('ul', { class: 'list' }, warnings.map(w => el('li', {}, el('span', { class: 'badge ' + (w.level === 'info' ? '' : w.level) }, w.level), el('span', { class: 'small' }, w.text)))) : el('div', { class: 'badge ok' }, 'All good'),
      el('h3', { style: { margin: '16px 0 6px', fontSize: '16px' } }, 'Extracted tags'),
      el('div', { class: 'scroll-x' }, table(rowsBasic)),
      el('div', { class: 'small muted', style: { marginTop: '8px' } }, 'Open Graph'),
      m.og.length ? el('div', { class: 'scroll-x' }, table(m.og.map(t => [t.key, t.value]))) : el('div', { class: 'muted small' }, 'none'),
      el('div', { class: 'small muted', style: { marginTop: '8px' } }, 'Twitter'),
      m.twitter.length ? el('div', { class: 'scroll-x' }, table(m.twitter.map(t => [t.key, t.value]))) : el('div', { class: 'muted small' }, 'none'),
      el('div', { class: 'row' }, el('button', { class: 'btn', onclick: () => copy(JSON.stringify({ title: m.title, description: m.description, canonical: m.canonical, og: Object.fromEntries(m.og.map(t => [t.key, t.value])), twitter: Object.fromEntries(m.twitter.map(t => [t.key, t.value])) }, null, 2)) }, 'Copy as JSON')));
  }
  ta.addEventListener('input', update);

  render(root,
    el('div', { class: 'row' }, urlIn, el('button', { class: 'btn', onclick: tryFetch }, 'Try fetch'), el('button', { class: 'btn ghost small', onclick: () => { ta.value = SAMPLE; update(); } }, 'Sample'), el('button', { class: 'btn ghost small', onclick: () => { ta.value = ''; update(); toast('Cleared'); } }, 'Clear')),
    fetchMsg, ta, out);
  update();
}
