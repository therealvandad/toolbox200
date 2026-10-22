// OpenAPI spec viewer with a minimal YAML parser and a Try-it form.
import { el, render, store, copy, toast, field, readFile, dropZone } from '../../lib/ui.js';

// ---------- minimal YAML parser (block maps/seqs, flow [] {}, scalars, | > block scalars, anchors/aliases, merge keys) ----------
export function parseYaml(src) {
  const lines = src.replace(/\r\n?/g, '\n').replace(/\t/g, '  ').split('\n');
  let i = 0; const anchors = {};
  const indentOf = l => l.match(/^ */)[0].length;
  const isBlank = l => /^\s*$/.test(l) || /^\s*#/.test(l);
  const skipBlank = () => { while (i < lines.length && (isBlank(lines[i]) || /^(---|\.\.\.)(\s|$)/.test(lines[i]))) i++; };
  function stripComment(s) {
    let q = null;
    for (let j = 0; j < s.length; j++) { const c = s[j]; if (q) { if (c === q) q = null; } else if (c === '"' || c === "'") q = c; else if (c === '#' && (j === 0 || /\s/.test(s[j - 1]))) return s.slice(0, j).trimEnd(); }
    return s.trimEnd();
  }
  const KEY_RE = /^("(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[^\s"'\-{[>|#&*!][^#]*?|-[^\s][^#]*?)\s*:(?:\s+(.*))?$/;
  const isKeyLine = b => KEY_RE.test(b) && !b.startsWith('- ');
  function parseBlock(minInd) {
    skipBlank(); if (i >= lines.length) return null;
    const line = lines[i]; const ind = indentOf(line); if (ind < minInd) return null;
    const body = stripComment(line.slice(ind));
    if (body === '-' || body.startsWith('- ')) return parseSeq(ind);
    if (isKeyLine(body)) return parseMap(ind);
    i++; return parseScalar(collectFlow(body, ind));
  }
  function collectFlow(body, ind) { // multi-line flow collections [ ... ] { ... }
    if (!/^[[{]/.test(body)) return body;
    let depth = 0, s = body;
    const count = str => { let q = null; for (const c of str) { if (q) { if (c === q) q = null; } else if (c === '"' || c === "'") q = c; else if (c === '[' || c === '{') depth++; else if (c === ']' || c === '}') depth--; } };
    count(body);
    while (depth > 0 && i < lines.length) { const l = stripComment(lines[i]).trim(); i++; s += ' ' + l; count(l); }
    return s;
  }
  function parseSeq(ind) {
    const arr = [];
    while (i < lines.length) {
      skipBlank(); if (i >= lines.length) break;
      const line = lines[i]; const li = indentOf(line); if (li !== ind) break;
      const body = stripComment(line.slice(li)); if (!(body === '-' || body.startsWith('- '))) break;
      const rest = body.slice(1).trimStart();
      if (!rest) { i++; arr.push(parseBlock(ind + 1)); }
      else { const childInd = li + body.length - rest.length; lines[i] = ' '.repeat(childInd) + rest; arr.push(parseBlock(childInd)); }
    }
    return arr;
  }
  function parseMap(ind) {
    const obj = {};
    while (i < lines.length) {
      skipBlank(); if (i >= lines.length) break;
      const line = lines[i]; const li = indentOf(line); if (li !== ind) break;
      const body = stripComment(line.slice(li)); const m = body.match(KEY_RE); if (!m || body.startsWith('- ')) break;
      let key = m[1]; if (/^["']/.test(key)) key = parseScalar(key); else key = key.trim();
      let val = m[2] == null ? '' : m[2].trim(); i++;
      let anchor = null; const am = val.match(/^&(\S+)\s*(.*)$/); if (am) { anchor = am[1]; val = am[2]; }
      let node;
      if (val === '') { skipBlank(); node = (i < lines.length && indentOf(lines[i]) > ind) ? parseBlock(ind + 1) : null; }
      else if (/^[|>]/.test(val)) node = blockScalar(val, ind);
      else if (/^\*\S+$/.test(val)) node = anchors[val.slice(1)] ?? null;
      else {
        let text = collectFlow(val, ind);
        if (!/^[[{"']/.test(val)) { while (i < lines.length && !isBlank(lines[i]) && indentOf(lines[i]) > ind) { text += ' ' + stripComment(lines[i]).trim(); i++; } }
        node = parseScalar(text);
      }
      if (anchor) anchors[anchor] = node;
      if (key === '<<') { for (const src of [].concat(node || [])) if (src && typeof src === 'object') for (const [k, v] of Object.entries(src)) if (!(k in obj)) obj[k] = v; }
      else obj[key] = node;
    }
    return obj;
  }
  function blockScalar(ind, parentInd) {
    const fold = ind[0] === '>'; const chomp = ind.includes('-') ? 'strip' : ind.includes('+') ? 'keep' : 'clip';
    const buf = []; let base = null;
    while (i < lines.length) {
      const l = lines[i];
      if (/^\s*$/.test(l)) { buf.push(''); i++; continue; }
      const li = indentOf(l); if (li <= parentInd) break;
      if (base == null) base = li; if (li < base) break;
      buf.push(l.slice(base)); i++;
    }
    while (chomp !== 'keep' && buf.length && buf[buf.length - 1] === '') buf.pop();
    let out;
    if (fold) { out = ''; for (let k = 0; k < buf.length; k++) { const l = buf[k]; if (l === '') out += '\n'; else out += (k > 0 && buf[k - 1] !== '' && !/^\s/.test(l) ? ' ' : '') + l; } }
    else out = buf.join('\n');
    return chomp === 'strip' ? out : out + '\n';
  }
  function parseScalar(s) {
    s = s.trim();
    if (s === '' || s === '~' || s === 'null' || s === 'Null' || s === 'NULL') return null;
    if (s === 'true' || s === 'True' || s === 'TRUE') return true;
    if (s === 'false' || s === 'False' || s === 'FALSE') return false;
    if (/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s) && !/^0\d/.test(s)) return Number(s);
    if (/^0x[0-9a-f]+$/i.test(s)) return parseInt(s, 16);
    if (s[0] === '"') { try { return JSON.parse(s.replace(/\n/g, '\\n')); } catch { return s.slice(1, -1); } }
    if (s[0] === "'") return s.slice(1, -1).replace(/''/g, "'");
    if (s[0] === '[' || s[0] === '{') return parseFlow(s);
    if (s[0] === '*') return anchors[s.slice(1)] ?? null;
    return s;
  }
  function parseFlow(str) {
    let p = 0;
    const ws = () => { while (p < str.length && /\s/.test(str[p])) p++; };
    function value() {
      ws();
      if (str[p] === '[') { p++; const a = []; ws(); if (str[p] === ']') { p++; return a; } for (;;) { a.push(value()); ws(); if (str[p] === ',') { p++; ws(); if (str[p] === ']') { p++; return a; } continue; } if (str[p] === ']') { p++; return a; } if (p >= str.length) return a; p++; } }
      if (str[p] === '{') { p++; const o = {}; ws(); if (str[p] === '}') { p++; return o; } for (;;) { ws(); const k = token(true); ws(); if (str[p] === ':') p++; const v = value(); o[typeof k === 'string' ? k : String(k)] = v; ws(); if (str[p] === ',') { p++; ws(); if (str[p] === '}') { p++; return o; } continue; } if (str[p] === '}') { p++; return o; } if (p >= str.length) return o; p++; } }
      return token(false);
    }
    function token(isKey) {
      ws();
      if (str[p] === '"' || str[p] === "'") { const q = str[p]; let e = p + 1; while (e < str.length && str[e] !== q) { if (q === '"' && str[e] === '\\') e++; e++; } const t = str.slice(p, e + 1); p = e + 1; return parseScalar(t); }
      let e = p; while (e < str.length && !/[,\]}]/.test(str[e]) && !(isKey && str[e] === ':' && /\s|$/.test(str[e + 1] || ''))) e++;
      const t = str.slice(p, e); p = e; return parseScalar(t);
    }
    return value();
  }
  skipBlank();
  const result = parseBlock(0);
  return result;
}

const SAMPLE = `openapi: 3.0.3
info:
  title: Pet Store
  version: 1.0.0
  description: A tiny example spec.
servers:
  - url: https://petstore3.swagger.io/api/v3
tags:
  - name: pet
    description: Everything about pets
paths:
  /pet/findByStatus:
    get:
      tags: [pet]
      summary: Finds pets by status
      operationId: findPetsByStatus
      parameters:
        - name: status
          in: query
          required: true
          schema:
            type: string
            enum: [available, pending, sold]
            default: available
      responses:
        '200':
          description: successful operation
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Pet'
        '400':
          description: Invalid status value
  /pet/{petId}:
    get:
      tags: [pet]
      summary: Find pet by ID
      parameters:
        - name: petId
          in: path
          required: true
          schema: { type: integer, format: int64 }
      responses:
        '200':
          description: successful operation
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Pet'
        '404':
          description: Pet not found
  /pet:
    post:
      tags: [pet]
      summary: Add a new pet
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Pet'
      responses:
        '200':
          description: Successful operation
components:
  schemas:
    Pet:
      type: object
      required: [name, photoUrls]
      properties:
        id: { type: integer, format: int64, example: 10 }
        name: { type: string, example: doggie }
        photoUrls:
          type: array
          items: { type: string }
        status:
          type: string
          description: pet status in the store
          enum: [available, pending, sold]
`;

const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'];
const MCOLOR = { get: 'var(--ok)', post: 'var(--accent)', put: 'var(--warn)', patch: 'var(--warn)', delete: 'var(--danger)', head: 'var(--muted)', options: 'var(--muted)', trace: 'var(--muted)' };

export default function (root) {
  const s = store('openapi-viewer');
  const input = el('textarea', { class: 'textarea', style: { minHeight: '160px' }, placeholder: 'Paste an OpenAPI 3.x spec (JSON or YAML)…', value: s.get('spec', SAMPLE) });
  const urlIn = el('input', { class: 'input grow', placeholder: 'https://…/openapi.yaml', style: { minWidth: '200px' }, onkeydown: e => { if (e.key === 'Enter') loadUrl(); } });
  const baseIn = el('input', { class: 'input grow', placeholder: 'https://api.example.com', value: s.get('base', ''), style: { minWidth: '200px' }, oninput: () => s.set('base', baseIn.value) });
  const filter = el('input', { class: 'input grow', placeholder: 'Filter paths…', style: { minWidth: '160px' }, oninput: () => drawPaths() });
  const err = el('div', { class: 'small', style: { color: 'var(--danger)' } });
  const head = el('div', {});
  const pathsOut = el('div', {});
  let spec = null, abort = null;

  function resolve(node, depth = 0) {
    if (!node || typeof node !== 'object' || depth > 30) return node;
    if (node.$ref && typeof node.$ref === 'string' && node.$ref.startsWith('#/')) {
      const target = node.$ref.slice(2).split('/').reduce((o, k) => o?.[k.replace(/~1/g, '/').replace(/~0/g, '~')], spec);
      return target ? resolve({ ...target, _refName: node.$ref.split('/').pop() }, depth + 1) : { type: 'unresolved $ref ' + node.$ref };
    }
    return node;
  }
  function schemaType(sc) {
    sc = resolve(sc); if (!sc) return 'any';
    if (sc.type === 'array') return `${schemaType(sc.items)}[]`;
    if (sc.oneOf) return sc.oneOf.map(schemaType).join(' | ');
    if (sc.anyOf) return sc.anyOf.map(schemaType).join(' | ');
    if (sc.allOf) return sc.allOf.map(schemaType).join(' & ');
    if (sc._refName && sc.type === 'object') return sc._refName;
    return (sc.type || (sc.properties ? 'object' : 'any')) + (sc.format ? `<${sc.format}>` : '') + (sc.enum ? ` (${sc.enum.join(' | ')})` : '');
  }
  function schemaView(sc, depth = 0) {
    sc = resolve(sc);
    if (!sc) return el('span', { class: 'muted' }, 'any');
    if (depth > 6) return el('span', { class: 'muted' }, '…');
    if (sc.allOf) { const merged = { type: 'object', properties: {}, required: [] }; for (const part of sc.allOf) { const p = resolve(part); Object.assign(merged.properties, p.properties || {}); merged.required.push(...(p.required || [])); } return schemaView(merged, depth); }
    if (sc.oneOf || sc.anyOf) return el('div', {}, (sc.oneOf || sc.anyOf).map((o, k) => el('div', { style: { paddingLeft: '10px' } }, el('span', { class: 'muted small' }, (k ? 'or ' : 'one of ')), schemaView(o, depth + 1))));
    if (sc.type === 'array') return el('div', {}, el('span', { class: 'mono small' }, 'array of '), schemaView(sc.items, depth + 1));
    if (sc.properties) {
      const req = new Set(sc.required || []);
      return el('div', { style: { borderLeft: '2px solid var(--line)', paddingLeft: '10px', margin: '4px 0' } },
        sc._refName ? el('div', { class: 'small muted' }, sc._refName) : null,
        Object.entries(sc.properties).map(([k, v]) => { const r = resolve(v); const nested = r && (r.properties || r.type === 'array' && resolve(r.items)?.properties || r.oneOf || r.anyOf || r.allOf); return el('div', { class: 'small' },
          el('span', { class: 'mono' }, k), req.has(k) ? el('span', { style: { color: 'var(--danger)' } }, '*') : null, ' ',
          el('span', { class: 'muted' }, schemaType(v)), r?.description ? el('span', { class: 'muted' }, ' — ' + String(r.description).trim().split('\n')[0]) : null,
          nested ? schemaView(v, depth + 1) : null); }));
    }
    return el('span', { class: 'mono small' }, schemaType(sc), sc.description ? el('span', { class: 'muted' }, ' — ' + String(sc.description).trim()) : null);
  }
  function example(sc, depth = 0) {
    sc = resolve(sc); if (!sc || depth > 8) return null;
    if (sc.example !== undefined) return sc.example;
    if (sc.default !== undefined) return sc.default;
    if (sc.enum) return sc.enum[0];
    if (sc.allOf) { const o = {}; for (const p of sc.allOf) Object.assign(o, example(p, depth + 1) || {}); return o; }
    if (sc.oneOf || sc.anyOf) return example((sc.oneOf || sc.anyOf)[0], depth + 1);
    const t = sc.type || (sc.properties ? 'object' : 'string');
    if (t === 'object') { const o = {}; for (const [k, v] of Object.entries(sc.properties || {})) o[k] = example(v, depth + 1); return o; }
    if (t === 'array') return [example(sc.items, depth + 1)];
    if (t === 'integer' || t === 'number') return 0;
    if (t === 'boolean') return true;
    if (sc.format === 'date-time') return new Date().toISOString();
    if (sc.format === 'date') return new Date().toISOString().slice(0, 10);
    if (sc.format === 'email') return 'user@example.com';
    if (sc.format === 'uuid') return '123e4567-e89b-12d3-a456-426614174000';
    return 'string';
  }

  function load() {
    err.textContent = ''; s.set('spec', input.value);
    const text = input.value.trim();
    if (!text) { spec = null; render(head); render(pathsOut); return; }
    try { spec = text[0] === '{' ? JSON.parse(text) : parseYaml(text); }
    catch (e) { err.textContent = 'Parse error: ' + e.message; return; }
    if (!spec || typeof spec !== 'object' || !spec.paths) { err.textContent = 'Parsed, but no "paths" object found. Is this an OpenAPI 3.x (or Swagger 2) document?'; spec = null; render(head); render(pathsOut); return; }
    const servers = spec.servers?.map(x => x.url) || (spec.host ? [`${(spec.schemes || ['https'])[0]}://${spec.host}${spec.basePath || ''}`] : []);
    if (!baseIn.value && servers[0]) { baseIn.value = servers[0]; s.set('base', servers[0]); }
    const ops = Object.values(spec.paths).reduce((n, p) => n + METHODS.filter(m => p && p[m]).length, 0);
    render(head,
      el('div', { class: 'row' }, el('b', { style: { fontSize: '18px' } }, spec.info?.title || 'Untitled API'), el('span', { class: 'badge' }, 'v' + (spec.info?.version || '?')), el('span', { class: 'badge' }, spec.openapi ? 'OpenAPI ' + spec.openapi : spec.swagger ? 'Swagger ' + spec.swagger : 'unknown'), el('span', { class: 'muted small' }, `${Object.keys(spec.paths).length} paths, ${ops} operations`)),
      spec.info?.description ? el('div', { class: 'muted small' }, String(spec.info.description).trim().slice(0, 400)) : null,
      servers.length ? el('div', { class: 'row small' }, el('span', { class: 'muted' }, 'Servers:'), servers.map(u => el('button', { class: 'btn small', onclick: () => { baseIn.value = u; s.set('base', u); } }, u))) : null);
    drawPaths();
  }
  function drawPaths() {
    if (!spec) return;
    const q = filter.value.trim().toLowerCase();
    const groups = {};
    for (const [path, item] of Object.entries(spec.paths)) {
      if (!item || typeof item !== 'object') continue;
      for (const m of METHODS) {
        const op = item[m]; if (!op) continue;
        if (q && !(path.toLowerCase().includes(q) || (op.summary || '').toLowerCase().includes(q) || (op.operationId || '').toLowerCase().includes(q))) continue;
        const tag = (op.tags && op.tags[0]) || 'default';
        (groups[tag] ||= []).push({ path, m, op, params: [...(item.parameters || []), ...(op.parameters || [])] });
      }
    }
    const tagDesc = Object.fromEntries((spec.tags || []).map(t => [t.name, t.description]));
    render(pathsOut, Object.keys(groups).length ? Object.entries(groups).map(([tag, ops]) => el('div', { style: { marginTop: '14px' } },
      el('div', { class: 'row' }, el('b', {}, tag), tagDesc[tag] ? el('span', { class: 'muted small' }, tagDesc[tag]) : null),
      ops.map(opView))) : el('div', { class: 'muted' }, 'No operations match.'));
  }
  function opView({ path, m, op, params }) {
    const body = el('div', { class: 'hidden', style: { padding: '8px 4px 4px' } });
    let built = false;
    const headRow = el('div', { class: 'row', style: { cursor: 'pointer', margin: '2px 0' }, onclick: () => { body.classList.toggle('hidden'); if (!built) { built = true; render(body, details()); } } },
      el('span', { class: 'badge', style: { background: MCOLOR[m], color: '#fff', borderColor: MCOLOR[m], minWidth: '62px', textAlign: 'center' } }, m.toUpperCase()),
      el('span', { class: 'mono' }, path), el('span', { class: 'muted small' }, op.summary || op.operationId || ''), op.deprecated ? el('span', { class: 'badge danger' }, 'deprecated') : null);
    function details() {
      const ps = params.map(p => resolve(p));
      const rb = resolve(op.requestBody);
      const content = rb?.content || {};
      const ctypes = Object.keys(content);
      const responses = Object.entries(op.responses || {});
      return el('div', { class: 'panel' },
        op.description ? el('div', { class: 'small', style: { marginBottom: '6px' } }, String(op.description).trim()) : null,
        ps.length ? el('div', {}, el('div', { class: 'small muted' }, 'Parameters'), el('div', { class: 'scroll-x' }, el('table', { class: 'table small' },
          el('tr', {}, el('th', {}, 'Name'), el('th', {}, 'In'), el('th', {}, 'Type'), el('th', {}, 'Req'), el('th', {}, 'Description')),
          ps.map(p => el('tr', {}, el('td', { class: 'mono' }, p.name), el('td', {}, p.in), el('td', { class: 'mono' }, schemaType(p.schema || { type: p.type })), el('td', {}, p.required ? 'yes' : ''), el('td', { class: 'muted' }, p.description || '')))))) : null,
        rb ? el('div', {}, el('div', { class: 'small muted', style: { marginTop: '6px' } }, 'Request body' + (rb.required ? ' (required)' : '') + (ctypes.length ? ' — ' + ctypes.join(', ') : '')), ctypes[0] ? schemaView(content[ctypes[0]].schema) : null) : null,
        responses.length ? el('div', {}, el('div', { class: 'small muted', style: { marginTop: '6px' } }, 'Responses'),
          responses.map(([code, r]) => { r = resolve(r); const c = r?.content || {}; const ct = Object.keys(c)[0]; return el('div', { style: { margin: '4px 0' } },
            el('span', { class: 'badge ' + (code[0] === '2' ? 'ok' : code[0] === '4' || code[0] === '5' ? 'danger' : '') }, code), ' ', el('span', { class: 'small' }, r?.description || ''), ct ? el('span', { class: 'muted small' }, ' ' + ct) : null,
            ct && c[ct].schema ? schemaView(c[ct].schema) : null); })) : null,
        tryIt({ path, m, op, params: ps, rb, ctypes, content }));
    }
    return el('div', {}, headRow, body);
  }
  function tryIt({ path, m, params, ctypes, content }) {
    const inputs = params.filter(p => ['path', 'query', 'header'].includes(p.in)).map(p => ({ p, input: el('input', { class: 'input', placeholder: schemaType(p.schema || { type: p.type }), value: example(p.schema) ?? '', style: { width: '200px' } }) }));
    const ct = ctypes[0];
    const bodyTa = ct ? el('textarea', { class: 'textarea', style: { minHeight: '90px' }, value: JSON.stringify(example(content[ct].schema), null, 2) }) : null;
    const out = el('div', {});
    const authIn = el('input', { class: 'input', placeholder: 'Authorization header (optional)', value: s.get('auth', ''), style: { width: '260px' }, oninput: () => s.set('auth', authIn.value) });
    async function send() {
      let base = baseIn.value.trim().replace(/\/$/, '');
      if (!/^https?:\/\//.test(base)) { render(out, el('div', { style: { color: 'var(--danger)' } }, 'Set a base URL starting with http(s):// first.')); return; }
      let url = path; const q = new URLSearchParams(); const headers = {};
      for (const { p, input } of inputs) {
        const v = input.value;
        if (p.in === 'path') url = url.replace(`{${p.name}}`, encodeURIComponent(v));
        else if (p.in === 'query' && v !== '') q.append(p.name, v);
        else if (p.in === 'header' && v !== '') headers[p.name] = v;
      }
      if (authIn.value) headers.Authorization = authIn.value;
      const full = base + url + (q.toString() ? '?' + q : '');
      let body;
      if (bodyTa && !['get', 'head'].includes(m) && bodyTa.value.trim()) { body = bodyTa.value; headers['Content-Type'] = ct; }
      if (abort) abort.abort(); abort = new AbortController();
      render(out, el('div', { class: 'muted small' }, 'Sending ' + m.toUpperCase() + ' ' + full + ' …'));
      const t0 = performance.now();
      try {
        const res = await fetch(full, { method: m.toUpperCase(), headers, body, signal: abort.signal });
        const text = await res.text(); let pretty = text; try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch { /* raw */ }
        render(out, el('div', { class: 'row' }, el('span', { class: 'badge ' + (res.ok ? 'ok' : 'danger') }, res.status + ' ' + res.statusText), el('span', { class: 'muted small' }, Math.round(performance.now() - t0) + ' ms'), el('span', { class: 'mono small muted' }, full), el('button', { class: 'btn small', onclick: () => copy(pretty) }, 'Copy')),
          el('pre', { class: 'out', style: { maxHeight: '300px' } }, pretty || '(empty)'));
      } catch (e) {
        if (e.name === 'AbortError') return;
        render(out, el('div', { class: 'panel', style: { borderColor: 'var(--danger)' } }, el('b', {}, 'Request failed: '), e.message, el('div', { class: 'muted small' }, 'Likely CORS (the API must send Access-Control-Allow-Origin), offline, or a wrong base URL. ' + full)));
      }
    }
    return el('details', { style: { marginTop: '8px' } }, el('summary', { style: { cursor: 'pointer' } }, 'Try it'),
      el('div', { class: 'row' }, inputs.map(({ p, input }) => field(`${p.name} (${p.in})${p.required ? ' *' : ''}`, input)), field('Auth', authIn)),
      bodyTa ? el('div', {}, el('div', { class: 'small muted' }, 'Body (' + ct + ')'), bodyTa) : null,
      el('div', { class: 'row' }, el('button', { class: 'btn primary small', onclick: send }, 'Send'), el('button', { class: 'btn small', onclick: () => { let base = baseIn.value.trim().replace(/\/$/, ''); copy(`curl -X ${m.toUpperCase()} '${base}${path}'${bodyTa && bodyTa.value.trim() ? ` -H 'Content-Type: ${ct}' --data '${bodyTa.value.replace(/'/g, "'\\''")}'` : ''}`); } }, 'Copy cURL')),
      out);
  }
  async function loadUrl() {
    const u = urlIn.value.trim(); if (!u) return;
    err.textContent = 'Loading…';
    try { const r = await fetch(u); if (!r.ok) throw new Error('HTTP ' + r.status); input.value = await r.text(); load(); }
    catch (e) { err.textContent = 'Could not load: ' + e.message + ' (the server must allow CORS, or download the file and drop it here).'; }
  }
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) load(); });

  render(root,
    el('div', { class: 'grid2' },
      el('div', {}, input, el('div', { class: 'row' }, el('button', { class: 'btn primary', onclick: load }, 'Parse spec'), el('button', { class: 'btn ghost', onclick: () => { input.value = SAMPLE; load(); } }, 'Sample'), err)),
      el('div', { class: 'col' },
        dropZone('Drop or pick an openapi.json / .yaml file', async f => { input.value = await readFile(f[0], 'text'); load(); }, '.json,.yaml,.yml,application/json', false),
        el('div', { class: 'row' }, urlIn, el('button', { class: 'btn', onclick: loadUrl }, 'Load URL')),
        el('div', { class: 'row' }, field('Base URL for Try-it', baseIn)),
        el('div', { class: 'muted small' }, 'YAML support is a built-in subset: block/flow maps and lists, quoted strings, | and > blocks, anchors and merge keys. JSON is always exact.'))),
    head, el('div', { class: 'row' }, filter), pathsOut);
  load();
  return () => { if (abort) abort.abort(); };
}
