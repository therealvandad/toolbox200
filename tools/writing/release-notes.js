import { el, render, store, today, copy, download } from '../../lib/ui.js';

const TAGS = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security'];
const RULES = [
  [/^(?:security|vuln|cve)/i, 'Security'], [/^(?:add|added|adds|new|introduce|introduced|feat|feature|support)\b/i, 'Added'],
  [/^(?:fix|fixed|fixes|bug|bugfix|resolve|resolved|patch|correct|corrected)\b/i, 'Fixed'], [/^(?:remove|removed|removes|delete|deleted|drop|dropped)\b/i, 'Removed'],
  [/^(?:deprecate|deprecated)\b/i, 'Deprecated'], [/^(?:change|changed|update|updated|improve|improved|refactor|rename|renamed|bump|bumped|upgrade|upgraded|tweak|optimi[sz]e)/i, 'Changed'],
];
const guess = line => { for (const [r, t] of RULES) if (r.test(line)) return t; return 'Changed'; };
const clean = line => line.replace(/^\s*(?:[-*+•]|\d+[.)])\s*/, '').replace(/^(?:security|add|added|adds|fix|fixed|fixes|feat|feature|remove|removed|changed?|update|updated|deprecated?|bugfix)\s*:\s*/i, '').trim();

export default function (root) {
  const s = store('release-notes');
  const ta = el('textarea', { class: 'textarea', rows: 9, placeholder: 'One change per line, e.g.\nAdd dark mode\nFix crash when saving empty file\nRemove legacy export', value: s.get('text', '') });
  const ver = el('input', { class: 'input', value: s.get('ver', '1.0.0'), style: { width: '120px' } });
  const date = el('input', { class: 'input', type: 'date', value: s.get('date', today()) });
  const hdr = el('input', { type: 'checkbox', checked: s.get('hdr', false) });
  const link = el('input', { class: 'input', placeholder: 'Compare URL (optional)', value: s.get('link', ''), style: { minWidth: '200px' } });
  let manual = s.get('manual', {}); // line text -> tag
  const rows = el('div', { class: 'col' });
  const out = el('pre', { class: 'out', style: { minHeight: '120px' } });
  let md = '';

  const entries = () => ta.value.split('\n').map(r => ({ r: r.replace(/^\s*(?:[-*+•]|\d+[.)])\s*/, ''), l: clean(r) })).filter(e => e.l);
  function update() {
    s.set('text', ta.value); s.set('ver', ver.value); s.set('date', date.value); s.set('hdr', hdr.checked); s.set('link', link.value); s.set('manual', manual);
    const es = entries();
    render(rows, es.length ? es.map(({ r, l }) => {
      const tag = manual[l] || guess(r);
      const sel = el('select', { class: 'select', style: { width: '120px', flex: 'none' } }, TAGS.map(t => el('option', { value: t, selected: t === tag }, t)));
      sel.addEventListener('change', () => { manual[l] = sel.value; update(); });
      return el('div', { class: 'row', style: { margin: 0, flexWrap: 'nowrap' } }, sel, el('span', { class: 'grow', style: { minWidth: 0, overflowWrap: 'anywhere' } }, l));
    }) : el('div', { class: 'muted small' }, 'Tagged lines appear here. Tags are guessed from the first word; override with the dropdown.'));

    const by = {};
    es.forEach(({ r, l }) => { const tag = manual[l] || guess(r); (by[tag] ??= []).push(l[0].toUpperCase() + l.slice(1)); });
    const v = ver.value.trim() || 'Unreleased';
    const out_ = [];
    if (hdr.checked) out_.push('# Changelog', '', 'All notable changes to this project will be documented in this file.', '', 'The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),', 'and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).', '');
    out_.push(`## [${v}]${v === 'Unreleased' || !date.value ? '' : ' - ' + date.value}`, '');
    for (const t of TAGS) if (by[t]) out_.push(`### ${t}`, '', ...by[t].map(x => `- ${x}`), '');
    if (!es.length) out_.push('_No changes listed yet._', '');
    if (link.value.trim()) out_.push(`[${v}]: ${link.value.trim()}`, '');
    md = out_.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
    out.textContent = md;
  }
  [ta, ver, date, hdr, link].forEach(c => c.addEventListener(c === hdr || c === date ? 'change' : 'input', update));

  render(root,
    el('div', { class: 'row' }, el('label', { class: 'inline' }, 'Version', ver), el('label', { class: 'inline' }, 'Date', date), link, el('label', { class: 'inline' }, hdr, 'Include file header')),
    el('div', { class: 'grid2' },
      el('div', { class: 'col' }, el('h3', { style: { margin: 0 } }, 'Changes'), ta, rows),
      el('div', {}, el('h3', { style: { marginTop: 0 } }, 'Markdown'), out,
        el('div', { class: 'row' },
          el('button', { class: 'btn primary', onclick: () => copy(md) }, 'Copy Markdown'),
          el('button', { class: 'btn', onclick: () => download('CHANGELOG.md', md, 'text/markdown') }, 'Download CHANGELOG.md'),
          el('button', { class: 'btn ghost', onclick: () => { ta.value = ''; manual = {}; update(); } }, 'Clear')))));
  update();
}
