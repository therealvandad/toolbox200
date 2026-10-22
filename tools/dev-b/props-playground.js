// Props playground: a prop schema generates controls; a template renders live into a shadow root with those props.
import { el, render, store, copy, download, toast, field } from '../../lib/ui.js';

const TYPES = ['string', 'number', 'boolean', 'select', 'color'];
const DEFAULT_SCHEMA = [
  { name: 'label', type: 'string', default: 'Get started' },
  { name: 'variant', type: 'select', options: ['primary', 'secondary', 'danger'], default: 'primary' },
  { name: 'size', type: 'select', options: ['sm', 'md', 'lg'], default: 'md' },
  { name: 'disabled', type: 'boolean', default: false },
  { name: 'radius', type: 'number', default: 8, min: 0, max: 32, step: 1 },
  { name: 'accent', type: 'color', default: '#2f6fed' },
  { name: 'badge', type: 'number', default: 3, min: 0, max: 99, step: 1 },
];
const DEFAULT_TPL = `<style>
  .btn { --accent: {{accent}}; font: 500 15px system-ui, sans-serif; border: 0; cursor: pointer;
         display: inline-flex; gap: 8px; align-items: center; color: #fff; background: var(--accent);
         border-radius: {{radius}}px; transition: filter .15s; }
  .btn:hover { filter: brightness(1.1); }
  .btn.secondary { background: transparent; color: var(--accent); box-shadow: inset 0 0 0 2px var(--accent); }
  .btn.danger { background: #d64545; }
  .btn.sm { padding: 6px 12px; font-size: 13px; }
  .btn.md { padding: 10px 18px; }
  .btn.lg { padding: 14px 26px; font-size: 17px; }
  .btn[disabled] { opacity: .5; cursor: not-allowed; }
  .pill { background: rgba(0,0,0,.25); border-radius: 999px; padding: 0 7px; font-size: 12px; }
  .btn.secondary .pill { background: var(--accent); color: #fff; }
</style>
<button class="btn {{variant}} {{size}}" {{#if disabled}}disabled{{/if}}>
  {{label}}
  {{#if badge}}<span class="pill">{{badge}}</span>{{/if}}
</button>`;

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Tiny template language: {{prop}} (escaped), {{{prop}}} (raw), {{#if p}}…{{else}}…{{/if}}, {{#unless p}}…{{/unless}}. */
export function renderTemplate(tpl, vals) {
  let out = tpl, prev;
  const BLOCK = /\{\{#(if|unless) (\w+)\}\}((?:(?!\{\{#)[\s\S])*?)(?:\{\{else\}\}((?:(?!\{\{#)[\s\S])*?))?\{\{\/\1\}\}/g;
  const truthy = v => !(v === false || v == null || v === '' || v === 0 || v === 'false');
  do { prev = out; out = out.replace(BLOCK, (_, kind, k, a, b = '') => ((kind === 'if') === truthy(vals[k]) ? a : b)); } while (out !== prev);
  out = out.replace(/\{\{\{(\w+)\}\}\}/g, (_, k) => String(vals[k] ?? ''));
  out = out.replace(/\{\{(\w+)\}\}/g, (_, k) => esc(vals[k] ?? ''));
  return out;
}

export default function (root) {
  const s = store('props-playground');
  let schema = s.get('schema', DEFAULT_SCHEMA);
  let values = s.get('values', {});
  const tplTa = el('textarea', { class: 'textarea', spellcheck: false, value: s.get('template', DEFAULT_TPL), style: { minHeight: '260px' } });
  const controls = el('div', { class: 'col' });
  const editor = el('div', { class: 'col' });
  const host = el('div', { class: 'panel center', style: { padding: '28px 16px', minHeight: '110px', display: 'flex', alignItems: 'center', justifyContent: 'center' } });
  const shadow = host.attachShadow({ mode: 'open' });
  const htmlOut = el('pre', { class: 'out', style: { maxHeight: '260px' } });
  const errBox = el('div', { class: 'small', style: { color: 'var(--danger)' } });
  const importTa = el('textarea', { class: 'textarea', placeholder: '[{ "name": "label", "type": "string", "default": "Hi" }, …]', style: { minHeight: '90px' } });

  const coerce = (p, v) => p.type === 'number' ? (v === '' || v == null || isNaN(+v) ? (p.default ?? 0) : +v) : p.type === 'boolean' ? (v === true || v === 'true') : v == null ? (p.default ?? '') : v;
  function normalizeValues() {
    const nv = {};
    for (const p of schema) {
      if (!p.name) continue;
      let v = p.name in values ? values[p.name] : p.default;
      if (p.type === 'select' && !(p.options || []).includes(v)) v = (p.options || [])[0] ?? '';
      nv[p.name] = coerce(p, v);
    }
    values = nv;
  }
  let lastHtml = '';
  function renderPreview() {
    normalizeValues();
    s.set('values', values); s.set('template', tplTa.value);
    try {
      lastHtml = renderTemplate(tplTa.value, values);
      shadow.innerHTML = lastHtml;
      htmlOut.textContent = lastHtml.replace(/<style>[\s\S]*?<\/style>\s*/g, '').trim();
      render(errBox);
    } catch (e) { render(errBox, 'Template error: ' + e.message); }
  }

  function drawControls() {
    normalizeValues();
    const rows = schema.filter(p => p.name).map(p => {
      const set = v => { values[p.name] = coerce(p, v); renderPreview(); };
      let ctl;
      if (p.type === 'boolean') ctl = el('label', { class: 'inline' }, el('input', { type: 'checkbox', checked: !!values[p.name], onchange: e => set(e.target.checked) }), p.name);
      else if (p.type === 'select') ctl = field(p.name, el('select', { class: 'select', onchange: e => set(e.target.value) }, ...(p.options || []).map(o => el('option', { value: o, selected: o === values[p.name] }, o))));
      else if (p.type === 'number') {
        const num = el('input', { class: 'input', type: 'number', min: p.min, max: p.max, step: p.step ?? 1, value: values[p.name], style: { width: '90px' }, oninput: e => { rng.value = e.target.value; set(e.target.value); } });
        const rng = el('input', { type: 'range', min: p.min ?? 0, max: p.max ?? 100, step: p.step ?? 1, value: values[p.name], class: 'grow', oninput: e => { num.value = e.target.value; set(e.target.value); } });
        ctl = field(p.name, el('div', { class: 'row', style: { margin: 0 } }, rng, num));
      } else if (p.type === 'color') {
        const txt = el('input', { class: 'input mono', value: values[p.name], style: { width: '110px' }, oninput: e => { if (/^#[0-9a-f]{6}$/i.test(e.target.value)) pick.value = e.target.value; set(e.target.value); } });
        const pick = el('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(values[p.name]) ? values[p.name] : '#000000', oninput: e => { txt.value = e.target.value; set(e.target.value); } });
        ctl = field(p.name, el('div', { class: 'row', style: { margin: 0 } }, pick, txt));
      } else ctl = field(p.name, el('input', { class: 'input', value: values[p.name], oninput: e => set(e.target.value) }));
      return ctl;
    });
    render(controls, rows.length ? rows : el('p', { class: 'muted small' }, 'No props defined yet.'));
    renderPreview();
  }

  function saveSchema() { s.set('schema', schema); drawControls(); }
  function drawEditor() {
    render(editor,
      el('div', { class: 'row small muted', style: { margin: 0 } }, el('span', { style: { width: '120px' } }, 'name'), el('span', { style: { width: '92px' } }, 'type'), el('span', {}, 'default / options / range')),
      ...schema.map((p, i) => {
        const nameIn = el('input', { class: 'input mono', value: p.name, placeholder: 'propName', style: { width: '120px' }, oninput: e => { p.name = e.target.value.replace(/\W/g, ''); e.target.value = p.name; saveSchema(); } });
        const typeSel = el('select', { class: 'select', style: { width: '92px' }, onchange: e => { p.type = e.target.value; if (p.type === 'select' && !p.options) p.options = ['a', 'b']; if (p.type === 'boolean') p.default = false; if (p.type === 'number') p.default = +p.default || 0; if (p.type === 'color' && !/^#/.test(p.default)) p.default = '#2f6fed'; if (p.type === 'string') p.default = String(p.default ?? ''); delete values[p.name]; saveSchema(); drawEditor(); } }, ...TYPES.map(t => el('option', { value: t, selected: t === p.type }, t)));
        let extra;
        if (p.type === 'boolean') extra = el('label', { class: 'inline' }, el('input', { type: 'checkbox', checked: !!p.default, onchange: e => { p.default = e.target.checked; saveSchema(); } }), 'default on');
        else if (p.type === 'select') extra = el('input', { class: 'input', value: (p.options || []).join(', '), placeholder: 'option1, option2', style: { flex: '1', minWidth: '140px' }, oninput: e => { p.options = e.target.value.split(',').map(x => x.trim()).filter(Boolean); if (!p.options.includes(p.default)) p.default = p.options[0] ?? ''; saveSchema(); } });
        else if (p.type === 'number') extra = el('div', { class: 'row', style: { margin: 0, flex: '1' } },
          el('input', { class: 'input', type: 'number', value: p.default ?? 0, title: 'default', placeholder: 'def', style: { width: '70px' }, oninput: e => { p.default = +e.target.value || 0; saveSchema(); } }),
          el('input', { class: 'input', type: 'number', value: p.min ?? '', placeholder: 'min', style: { width: '64px' }, oninput: e => { p.min = e.target.value === '' ? undefined : +e.target.value; saveSchema(); } }),
          el('input', { class: 'input', type: 'number', value: p.max ?? '', placeholder: 'max', style: { width: '64px' }, oninput: e => { p.max = e.target.value === '' ? undefined : +e.target.value; saveSchema(); } }),
          el('input', { class: 'input', type: 'number', value: p.step ?? '', placeholder: 'step', style: { width: '64px' }, oninput: e => { p.step = e.target.value === '' ? undefined : +e.target.value; saveSchema(); } }));
        else if (p.type === 'color') extra = el('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(p.default) ? p.default : '#000000', oninput: e => { p.default = e.target.value; saveSchema(); } });
        else extra = el('input', { class: 'input', value: p.default ?? '', placeholder: 'default', style: { flex: '1', minWidth: '120px' }, oninput: e => { p.default = e.target.value; saveSchema(); } });
        return el('div', { class: 'row', style: { margin: 0 } }, nameIn, typeSel, extra,
          el('button', { class: 'btn ghost small', title: 'Remove', onclick: () => { schema.splice(i, 1); delete values[p.name]; saveSchema(); drawEditor(); } }, '✕'));
      }),
      el('div', { class: 'row', style: { margin: 0 } },
        el('button', { class: 'btn small', onclick: () => { schema.push({ name: 'prop' + (schema.length + 1), type: 'string', default: '' }); saveSchema(); drawEditor(); } }, '+ Add prop'),
        el('button', { class: 'btn ghost small', onclick: () => { schema = JSON.parse(JSON.stringify(DEFAULT_SCHEMA)); values = {}; tplTa.value = DEFAULT_TPL; saveSchema(); drawEditor(); toast('Reset to sample'); } }, 'Reset sample')));
  }

  function importSchema() {
    try {
      const j = JSON.parse(importTa.value);
      if (!Array.isArray(j)) throw new Error('expected an array of props');
      schema = j.filter(p => p && typeof p.name === 'string').map(p => ({ name: p.name.replace(/\W/g, ''), type: TYPES.includes(p.type) ? p.type : 'string', default: p.default, options: Array.isArray(p.options) ? p.options.map(String) : undefined, min: p.min, max: p.max, step: p.step }));
      values = {}; saveSchema(); drawEditor(); toast(`Imported ${schema.length} props`);
    } catch (e) { toast('Invalid schema JSON: ' + e.message); }
  }
  const schemaJson = () => JSON.stringify(schema.map(p => Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined))), null, 2);
  const fullDoc = () => `<!doctype html>\n<meta charset="utf-8">\n<title>Component</title>\n${lastHtml}\n`;

  let t = null;
  tplTa.addEventListener('input', () => { clearTimeout(t); t = setTimeout(renderPreview, 150); });
  tplTa.addEventListener('keydown', e => { if (e.key === 'Tab') { e.preventDefault(); tplTa.setRangeText('  ', tplTa.selectionStart, tplTa.selectionEnd, 'end'); } });

  render(root,
    el('div', { class: 'grid2' },
      el('div', { class: 'col' },
        el('h3', { style: { margin: '0 0 2px', fontSize: '15px' } }, 'Preview'),
        host, errBox,
        el('h3', { style: { margin: '10px 0 2px', fontSize: '15px' } }, 'Controls'),
        el('div', { class: 'panel' }, controls),
        el('div', { class: 'row', style: { margin: 0 } },
          el('button', { class: 'btn small', onclick: () => { for (const p of schema) values[p.name] = p.default; drawControls(); } }, 'Reset values'),
          el('span', { class: 'grow' }),
          el('button', { class: 'btn small', onclick: () => copy(JSON.stringify(values, null, 2)) }, 'Copy values JSON'))),
      el('div', { class: 'col' },
        el('h3', { style: { margin: '0 0 2px', fontSize: '15px' } }, 'Props schema'),
        el('div', { class: 'panel' }, editor),
        el('div', { class: 'row', style: { margin: 0 } },
          el('button', { class: 'btn small', onclick: () => copy(schemaJson()) }, 'Copy schema JSON'),
          el('button', { class: 'btn small', onclick: () => download('props-schema.json', schemaJson(), 'application/json') }, 'Download schema'),
          el('details', { style: { width: '100%' } }, el('summary', { class: 'small muted', style: { cursor: 'pointer' } }, 'Import schema JSON'),
            importTa, el('button', { class: 'btn small', style: { marginTop: '6px' }, onclick: importSchema }, 'Apply'))),
        el('h3', { style: { margin: '10px 0 2px', fontSize: '15px' } }, 'Template'),
        el('p', { class: 'muted small', style: { margin: '0 0 4px' } }, '{{prop}} inserts an escaped value, {{{prop}}} raw HTML, {{#if prop}}…{{else}}…{{/if}} and {{#unless prop}}…{{/unless}} for conditionals. A <style> block is scoped to the preview.'),
        tplTa)),
    el('h3', { style: { margin: '14px 0 4px', fontSize: '15px' } }, 'Resulting HTML'),
    el('div', { class: 'row', style: { margin: 0 } },
      el('button', { class: 'btn primary small', onclick: () => copy(lastHtml) }, 'Copy HTML (with styles)'),
      el('button', { class: 'btn small', onclick: () => copy(htmlOut.textContent) }, 'Copy markup only'),
      el('button', { class: 'btn small', onclick: () => download('component.html', fullDoc(), 'text/html') }, 'Download .html')),
    htmlOut);
  drawEditor();
  drawControls();
  return () => clearTimeout(t);
}
