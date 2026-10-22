// API client: request builder with history, saved requests, collapsible JSON and cURL export.
import { el, render, store, copy, toast, field, uid } from '../../lib/ui.js';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

export default function (root) {
  const s = store('api-client');
  let history = s.get('history', []);
  let saved = s.get('saved', []);
  let headers = s.get('headers', [{ k: 'Accept', v: 'application/json', on: true }]);
  let abort = null;

  // ---- request builder ----
  const method = el('select', { class: 'select', value: s.get('method', 'GET') }, METHODS.map(m => el('option', { value: m }, m)));
  method.value = s.get('method', 'GET');
  const url = el('input', { class: 'input grow', placeholder: 'https://api.example.com/items?limit=5', value: s.get('url', 'https://httpbin.org/get'), style: { minWidth: '220px' } });
  const bodyType = el('select', { class: 'select' }, ['json', 'text', 'form', 'none'].map(t => el('option', { value: t }, t === 'json' ? 'JSON' : t === 'text' ? 'Text' : t === 'form' ? 'Form (urlencoded)' : 'No body')));
  bodyType.value = s.get('bodyType', 'json');
  const body = el('textarea', { class: 'textarea', style: { minHeight: '100px' }, placeholder: '{"name": "value"}', value: s.get('body', '') });
  const bodyWrap = el('div', {});
  const headTable = el('div', { class: 'col' });
  const sendBtn = el('button', { class: 'btn primary', onclick: send }, 'Send');
  const out = el('div', {});
  const histList = el('div', { class: 'col' });
  const savedList = el('div', { class: 'col' });

  function persist() {
    s.set('method', method.value); s.set('url', url.value); s.set('bodyType', bodyType.value); s.set('body', body.value); s.set('headers', headers);
  }
  function drawHeaders() {
    render(headTable,
      headers.map((h, i) => el('div', { class: 'row', style: { margin: '2px 0' } },
        el('input', { type: 'checkbox', checked: h.on, onchange: e => { h.on = e.target.checked; persist(); } }),
        el('input', { class: 'input', placeholder: 'Header', value: h.k, style: { width: '180px' }, oninput: e => { h.k = e.target.value; persist(); } }),
        el('input', { class: 'input grow', placeholder: 'Value', value: h.v, style: { minWidth: '140px' }, oninput: e => { h.v = e.target.value; persist(); } }),
        el('button', { class: 'btn small ghost', title: 'Remove', onclick: () => { headers.splice(i, 1); persist(); drawHeaders(); } }, '×'))),
      el('div', { class: 'row' }, el('button', { class: 'btn small', onclick: () => { headers.push({ k: '', v: '', on: true }); persist(); drawHeaders(); } }, '+ Header')));
  }
  function drawBody() {
    const t = bodyType.value;
    const noBody = t === 'none' || ['GET', 'HEAD'].includes(method.value);
    render(bodyWrap, noBody ? el('div', { class: 'muted small' }, 'No request body for this method/type.') : el('div', {},
      body,
      t === 'json' ? el('div', { class: 'row' }, el('button', { class: 'btn small', onclick: () => { try { body.value = JSON.stringify(JSON.parse(body.value || '{}'), null, 2); persist(); } catch (e) { toast('Invalid JSON: ' + e.message); } } }, 'Format JSON')) : null,
      t === 'form' ? el('div', { class: 'muted small' }, 'One key=value per line.') : null));
    body.placeholder = t === 'form' ? 'name=value\nother=value' : t === 'json' ? '{"name": "value"}' : 'plain text';
  }

  function buildRequest() {
    const u = url.value.trim();
    if (!/^https?:\/\//i.test(u)) throw new Error('URL must start with http:// or https://');
    const h = {};
    for (const x of headers) if (x.on && x.k.trim()) h[x.k.trim()] = x.v;
    const t = bodyType.value;
    let b;
    if (!['GET', 'HEAD'].includes(method.value) && t !== 'none' && body.value) {
      if (t === 'json') { JSON.parse(body.value); b = body.value; if (!Object.keys(h).some(k => k.toLowerCase() === 'content-type')) h['Content-Type'] = 'application/json'; }
      else if (t === 'form') {
        const p = new URLSearchParams();
        body.value.split(/\n/).forEach(line => { const i = line.indexOf('='); if (i > 0) p.append(line.slice(0, i).trim(), line.slice(i + 1)); });
        b = p.toString(); if (!Object.keys(h).some(k => k.toLowerCase() === 'content-type')) h['Content-Type'] = 'application/x-www-form-urlencoded';
      } else { b = body.value; if (!Object.keys(h).some(k => k.toLowerCase() === 'content-type')) h['Content-Type'] = 'text/plain'; }
    }
    return { method: method.value, url: u, headers: h, body: b };
  }

  function toCurl(r) {
    const q = v => `'${String(v).replace(/'/g, `'\\''`)}'`;
    const parts = ['curl', '-X', r.method, q(r.url)];
    for (const [k, v] of Object.entries(r.headers)) parts.push('-H', q(`${k}: ${v}`));
    if (r.body != null) parts.push('--data', q(r.body));
    return parts.join(' ');
  }

  async function send() {
    let req;
    try { req = buildRequest(); } catch (e) { render(out, el('div', { class: 'panel', style: { borderColor: 'var(--danger)' } }, 'Request error: ' + e.message)); return; }
    persist();
    if (abort) abort.abort();
    abort = new AbortController();
    sendBtn.disabled = true;
    render(out, el('div', { class: 'muted' }, 'Sending…'));
    const t0 = performance.now();
    try {
      const res = await fetch(req.url, { method: req.method, headers: req.headers, body: req.body, signal: abort.signal });
      const ms = Math.round(performance.now() - t0);
      const text = req.method === 'HEAD' ? '' : await res.text();
      const resHeaders = [...res.headers.entries()];
      const entry = { id: uid(), ts: Date.now(), req, status: res.status, statusText: res.statusText, ms, size: text.length };
      history = [entry, ...history].slice(0, 50); s.set('history', history); drawHistory();
      showResponse(res.status, res.statusText, ms, resHeaders, text, res.headers.get('content-type') || '');
    } catch (e) {
      if (e.name === 'AbortError') { render(out, el('div', { class: 'muted' }, 'Cancelled.')); return; }
      render(out, el('div', { class: 'panel', style: { borderColor: 'var(--danger)' } },
        el('b', {}, 'Request failed: '), e.message,
        el('div', { class: 'muted small', style: { marginTop: '6px' } }, 'Browsers hide the real reason for network failures. Common causes: the server does not send CORS headers (Access-Control-Allow-Origin), you are offline, the host does not exist, or a mixed-content block (http URL from an https page). The response would be visible in cURL or a server-side client.')));
    } finally { sendBtn.disabled = false; abort = null; }
  }

  function showResponse(status, statusText, ms, resHeaders, text, ctype) {
    const cls = status < 300 ? 'ok' : status < 400 ? 'warn' : 'danger';
    let parsed, isJson = false;
    try { parsed = JSON.parse(text); isJson = true; } catch { /* not json */ }
    const bodyView = el('div', {});
    const pretty = isJson ? JSON.stringify(parsed, null, 2) : text;
    const views = { tree: () => isJson ? jsonTree(parsed) : el('pre', { class: 'out' }, text || '(empty body)'), pretty: () => el('pre', { class: 'out' }, pretty || '(empty body)'), raw: () => el('pre', { class: 'out' }, text || '(empty body)') };
    const pick = v => render(bodyView, views[v]());
    pick(isJson ? 'tree' : 'pretty');
    render(out,
      el('div', { class: 'row' },
        el('span', { class: 'badge ' + cls, style: { fontSize: '14px' } }, status + ' ' + statusText),
        el('span', { class: 'muted' }, ms + ' ms'), el('span', { class: 'muted' }, text.length + ' chars'),
        ctype ? el('span', { class: 'muted small mono' }, ctype) : null),
      el('details', {}, el('summary', { style: { cursor: 'pointer' } }, `Response headers (${resHeaders.length})`),
        resHeaders.length ? el('table', { class: 'table small' }, resHeaders.map(([k, v]) => el('tr', {}, el('td', { class: 'mono' }, k), el('td', { class: 'mono', style: { wordBreak: 'break-all' } }, v))))
          : el('div', { class: 'muted small' }, 'No headers exposed. Servers must list them in Access-Control-Expose-Headers for the browser to show them.')),
      el('div', { class: 'row' },
        isJson ? el('button', { class: 'btn small', onclick: () => pick('tree') }, 'Tree') : null,
        el('button', { class: 'btn small', onclick: () => pick('pretty') }, 'Pretty'),
        el('button', { class: 'btn small', onclick: () => pick('raw') }, 'Raw'),
        el('button', { class: 'btn small', onclick: () => copy(pretty) }, 'Copy body')),
      bodyView);
  }

  function jsonTree(v, depth = 0) {
    if (v === null || typeof v !== 'object') {
      const color = typeof v === 'string' ? 'var(--ok)' : typeof v === 'number' ? 'var(--accent)' : 'var(--warn)';
      return el('span', { class: 'mono', style: { color } }, JSON.stringify(v));
    }
    const isArr = Array.isArray(v);
    const keys = Object.keys(v);
    if (!keys.length) return el('span', { class: 'mono muted' }, isArr ? '[]' : '{}');
    const d = el('details', { open: depth < 2, style: { paddingLeft: depth ? '14px' : 0 } },
      el('summary', { class: 'mono muted', style: { cursor: 'pointer' } }, (isArr ? 'Array' : 'Object') + ` (${keys.length})`),
      keys.map(k => el('div', { class: 'mono', style: { paddingLeft: '14px', fontSize: '13px' } },
        el('span', { style: { color: 'var(--text)' } }, isArr ? k : JSON.stringify(k)), ': ', jsonTree(v[k], depth + 1))));
    return d;
  }

  function loadReq(r) {
    method.value = r.method; url.value = r.url; headers = Object.entries(r.headers).map(([k, v]) => ({ k, v, on: true }));
    if (r.body != null) { body.value = r.body; const ct = Object.entries(r.headers).find(([k]) => k.toLowerCase() === 'content-type')?.[1] || ''; bodyType.value = ct.includes('json') ? 'json' : ct.includes('urlencoded') ? 'form' : 'text'; } else bodyType.value = 'none';
    persist(); drawHeaders(); drawBody(); toast('Loaded');
  }
  function drawHistory() {
    render(histList, history.length ? [history.slice(0, 15).map(h => el('div', { class: 'row small', style: { margin: '2px 0' } },
      el('span', { class: 'badge ' + (h.status < 300 ? 'ok' : h.status < 400 ? 'warn' : 'danger') }, h.status),
      el('b', {}, h.req.method), el('span', { class: 'mono grow', style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: '100px' } }, h.req.url),
      el('span', { class: 'muted' }, h.ms + ' ms'),
      el('button', { class: 'btn small', onclick: () => loadReq(h.req) }, 'Load'))),
      el('button', { class: 'btn small ghost', onclick: () => { history = []; s.set('history', []); drawHistory(); } }, 'Clear history')] : el('div', { class: 'muted small' }, 'No requests sent yet.'));
  }
  function drawSaved() {
    render(savedList, saved.length ? saved.map((x, i) => el('div', { class: 'row small', style: { margin: '2px 0' } },
      el('b', {}, x.name), el('span', { class: 'muted mono grow' }, x.req.method + ' ' + x.req.url),
      el('button', { class: 'btn small', onclick: () => loadReq(x.req) }, 'Load'),
      el('button', { class: 'btn small ghost', onclick: () => { saved.splice(i, 1); s.set('saved', saved); drawSaved(); } }, '×'))) : el('div', { class: 'muted small' }, 'Nothing saved.'));
  }
  const saveName = el('input', { class: 'input', placeholder: 'Name this request', style: { width: '200px' }, onkeydown: e => { if (e.key === 'Enter') saveCurrent(); } });
  function saveCurrent() {
    try { const req = buildRequest(); saved.push({ name: saveName.value.trim() || req.method + ' ' + new URL(req.url).pathname, req }); s.set('saved', saved); saveName.value = ''; drawSaved(); toast('Saved'); }
    catch (e) { toast(e.message); }
  }

  method.addEventListener('change', () => { persist(); drawBody(); });
  bodyType.addEventListener('change', () => { persist(); drawBody(); });
  body.addEventListener('input', persist); url.addEventListener('input', persist);
  url.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });

  render(root,
    el('div', { class: 'row' }, method, url, sendBtn, el('button', { class: 'btn ghost', onclick: () => { if (abort) abort.abort(); } }, 'Cancel')),
    el('div', { class: 'grid2' },
      el('div', {}, el('div', { class: 'small muted', style: { marginBottom: '4px' } }, 'Headers'), headTable),
      el('div', {}, el('div', { class: 'row' }, field('Body', bodyType)), bodyWrap)),
    el('div', { class: 'row' },
      el('button', { class: 'btn', onclick: () => { try { copy(toCurl(buildRequest())); } catch (e) { toast(e.message); } } }, 'Copy as cURL'),
      saveName, el('button', { class: 'btn', onclick: saveCurrent }, 'Save request')),
    el('div', { class: 'small muted', style: { margin: '14px 0 4px' } }, 'Response'), out,
    el('div', { class: 'grid2', style: { marginTop: '14px' } },
      el('div', {}, el('div', { class: 'small muted' }, 'History'), histList),
      el('div', {}, el('div', { class: 'small muted' }, 'Saved requests'), savedList)));
  drawHeaders(); drawBody(); drawHistory(); drawSaved();
  return () => { if (abort) abort.abort(); };
}
