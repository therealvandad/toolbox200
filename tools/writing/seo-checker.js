import { el, render, store, stat } from '../../lib/ui.js';

function parseBody(src) {
  const headings = [], links = [], images = [];
  let text = src;
  // HTML
  text = text.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (m, l, t) => { headings.push({ level: +l, text: t.replace(/<[^>]+>/g, '').trim() }); return '\n' + t + '\n'; });
  text = text.replace(/<img\b([^>]*)>/gi, (m, a) => { const alt = /\balt\s*=\s*("([^"]*)"|'([^']*)')/i.exec(a); images.push({ alt: alt ? (alt[2] ?? alt[3] ?? '').trim() : null }); return ' '; });
  text = text.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (m, a, t) => { const h = /href\s*=\s*("([^"]*)"|'([^']*)')/i.exec(a); links.push({ href: h ? (h[2] ?? h[3]) : '', text: t.replace(/<[^>]+>/g, '') }); return t; });
  // Markdown
  text = text.replace(/!\[([^\]]*)\]\(([^)]*)\)/g, (m, alt) => { images.push({ alt: alt.trim() }); return ' '; });
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, (m, t, h) => { links.push({ href: h, text: t }); return t; });
  text = text.replace(/^(#{1,6})\s+(.+?)\s*#*\s*$/gm, (m, h, t) => { headings.push({ level: h.length, text: t.trim() }); return t; });
  const plain = text.replace(/<[^>]+>/g, ' ').replace(/[*_`>~]+/g, '').replace(/&nbsp;/g, ' ');
  return { headings, links, images, plain };
}
const words = t => t.toLowerCase().match(/[a-z0-9À-ɏ]+(?:['’-][a-z0-9]+)*/g) || [];

export default function (root) {
  const s = store('seo-checker');
  const f = Object.assign({ kw: '', title: '', meta: '', slug: '', body: '' }, s.get('form', {}));
  const mk = (key, label, ph, tag = 'input', extra = {}) => {
    const c = el(tag, { class: tag === 'input' ? 'input' : 'textarea', placeholder: ph, value: f[key], ...extra });
    c.addEventListener('input', () => { f[key] = c.value; update(); });
    return el('label', { class: 'field' }, label, c);
  };
  const counter = (el_) => el_;
  const out = el('div', { class: 'col' });
  const summary = el('div', { class: 'row' });

  function check() {
    const kw = f.kw.trim().toLowerCase();
    const body = parseBody(f.body);
    const ws = words(body.plain), wc = ws.length;
    const checks = [];
    const add = (group, label, status, detail) => checks.push({ group, label, status, detail });
    const has = t => kw && t.toLowerCase().includes(kw);

    // Title
    const tl = f.title.trim().length;
    add('Title', 'Title length', !tl ? 'fail' : tl >= 30 && tl <= 60 ? 'pass' : 'warn', tl ? `${tl} characters (aim for 30-60)` : 'Add a title');
    if (kw) add('Title', 'Keyword in title', has(f.title) ? (f.title.toLowerCase().indexOf(kw) < 20 ? 'pass' : 'warn') : 'fail', has(f.title) ? (f.title.toLowerCase().indexOf(kw) < 20 ? 'Keyword appears near the start' : 'Keyword appears, but later in the title; consider moving it earlier') : 'Keyword not found in title');
    // Meta
    const ml = f.meta.trim().length;
    add('Meta description', 'Description length', !ml ? 'fail' : ml >= 120 && ml <= 160 ? 'pass' : 'warn', ml ? `${ml} characters (aim for 120-160)` : 'Add a meta description');
    if (kw) add('Meta description', 'Keyword in description', has(f.meta) ? 'pass' : 'warn', has(f.meta) ? 'Keyword present' : 'Keyword not found in description');
    // Slug
    if (f.slug.trim()) {
      const sl = f.slug.trim();
      add('URL', 'Slug is clean', /^[a-z0-9-/]+$/.test(sl.replace(/^\//, '')) && sl.length <= 75 ? 'pass' : 'warn', 'Use lowercase letters, numbers and hyphens, under 75 characters');
      if (kw) add('URL', 'Keyword in slug', sl.toLowerCase().includes(kw.replace(/\s+/g, '-')) ? 'pass' : 'warn', 'Slug should include the keyword with hyphens');
    }
    // Content
    add('Content', 'Word count', wc >= 600 ? 'pass' : wc >= 300 ? 'warn' : 'fail', `${wc} words (300+ minimum, 600+ is better for ranking)`);
    if (kw && wc) {
      const kwWords = words(kw);
      let hits = 0;
      for (let i = 0; i + kwWords.length <= ws.length; i++) if (kwWords.every((w, j) => ws[i + j] === w)) hits++;
      const dens = hits * kwWords.length / wc * 100;
      add('Content', 'Keyword density', hits === 0 ? 'fail' : dens >= 0.5 && dens <= 2.5 ? 'pass' : 'warn', `${hits} use${hits === 1 ? '' : 's'} (${dens.toFixed(2)}%); aim for about 0.5-2.5%`);
      const first = ws.slice(0, 100).join(' ');
      add('Content', 'Keyword in first 100 words', first.includes(kwWords.join(' ')) ? 'pass' : 'warn', first.includes(kwWords.join(' ')) ? 'Keyword appears in the intro' : 'Mention the keyword early in the opening paragraph');
    } else if (!kw) add('Content', 'Focus keyword', 'warn', 'Enter a focus keyword to check keyword placement');
    const sentences = body.plain.split(/[.!?]+\s/).filter(x => x.trim());
    if (sentences.length > 2) { const avg = wc / sentences.length; add('Content', 'Sentence length', avg <= 20 ? 'pass' : avg <= 25 ? 'warn' : 'fail', `Average ${avg.toFixed(1)} words per sentence (aim for under 20)`); }
    // Headings
    const h1 = body.headings.filter(h => h.level === 1).length, h2 = body.headings.filter(h => h.level === 2).length;
    add('Headings', 'Single H1', h1 === 1 ? 'pass' : h1 === 0 ? 'warn' : 'fail', h1 === 1 ? 'Exactly one H1' : h1 === 0 ? 'No H1 in the body (fine if your CMS adds the title as H1)' : `${h1} H1 headings; use only one`);
    add('Headings', 'Subheadings (H2)', h2 >= 2 ? 'pass' : h2 === 1 ? 'warn' : wc > 300 ? 'fail' : 'warn', `${h2} H2 heading${h2 === 1 ? '' : 's'}; break up long text with subheadings`);
    let skip = false; for (let i = 1; i < body.headings.length; i++) if (body.headings[i].level - body.headings[i - 1].level > 1) skip = true;
    if (body.headings.length > 1) add('Headings', 'Heading order', skip ? 'warn' : 'pass', skip ? 'A heading level is skipped (for example H2 to H4)' : 'Heading levels are in order');
    if (kw && body.headings.length) add('Headings', 'Keyword in a heading', body.headings.some(h => has(h.text)) ? 'pass' : 'warn', body.headings.some(h => has(h.text)) ? 'Keyword used in at least one heading' : 'Use the keyword (or a close variant) in a subheading');
    // Links
    const ext = body.links.filter(l => /^https?:\/\//i.test(l.href)), int = body.links.length - ext.length;
    add('Links', 'Links present', body.links.length ? 'pass' : 'warn', `${body.links.length} link${body.links.length === 1 ? '' : 's'} (${int} internal/relative, ${ext.length} external)`);
    if (body.links.some(l => !l.text.trim() || /^(click here|here|read more|link)$/i.test(l.text.trim()))) add('Links', 'Descriptive link text', 'warn', 'Avoid links that say "click here" or "read more"');
    // Images
    if (body.images.length) {
      const missing = body.images.filter(i => !i.alt).length;
      add('Images', 'Image alt text', missing ? 'fail' : 'pass', missing ? `${missing} of ${body.images.length} image${body.images.length === 1 ? '' : 's'} missing alt text` : `All ${body.images.length} image${body.images.length === 1 ? '' : 's'} have alt text`);
      if (kw && !missing) add('Images', 'Keyword in alt text', body.images.some(i => has(i.alt)) ? 'pass' : 'warn', 'Include the keyword in at least one descriptive alt text where it fits naturally');
    } else add('Images', 'Images present', 'warn', 'No images found; consider adding at least one with alt text');
    return { checks, wc };
  }

  function update() {
    s.set('form', f);
    const { checks, wc } = check();
    const pts = { pass: 1, warn: 0.5, fail: 0 };
    const score = Math.round(checks.reduce((a, c) => a + pts[c.status], 0) / checks.length * 100);
    const cnt = st => checks.filter(c => c.status === st).length;
    render(summary,
      el('div', { class: 'stat' }, el('div', { class: 'v', style: { color: score >= 80 ? 'var(--ok)' : score >= 50 ? 'var(--warn)' : 'var(--danger)' } }, score), el('div', { class: 'l' }, 'SEO score / 100')),
      stat(cnt('pass'), 'passed'), stat(cnt('warn'), 'warnings'), stat(cnt('fail'), 'failed'), stat(wc, 'words'));
    const groups = [...new Set(checks.map(c => c.group))];
    render(out, groups.map(g => el('div', {}, el('h3', { style: { margin: '10px 0 4px' } }, g),
      checks.filter(c => c.group === g).map(c => el('div', { class: 'row', style: { margin: '3px 0', flexWrap: 'nowrap', alignItems: 'flex-start' } },
        el('span', { class: 'badge ' + (c.status === 'pass' ? 'ok' : c.status === 'warn' ? 'warn' : 'danger'), style: { minWidth: '48px', textAlign: 'center' } }, c.status),
        el('div', {}, el('strong', {}, c.label), el('div', { class: 'small muted' }, c.detail)))))));
  }
  const tl = mk('title', 'SEO title', 'Best Hiking Boots for Beginners (2026 Guide)');
  const ml = mk('meta', 'Meta description', 'Learn how to choose the best hiking boots…', 'textarea', { rows: 2, style: { minHeight: '56px' } });
  const hint = (inp) => inp;
  render(root,
    el('div', { class: 'grid2' },
      el('div', { class: 'col' }, mk('kw', 'Focus keyword', 'hiking boots'), tl, ml, mk('slug', 'URL slug (optional)', 'best-hiking-boots'),
        mk('body', 'Body (Markdown or HTML)', '# Heading\n\nWrite or paste your article here…', 'textarea', { rows: 14, style: { minHeight: '260px' } })),
      el('div', {}, summary, out)));
  void counter; void hint;
  update();
}
