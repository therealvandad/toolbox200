// Webhook payload inspector: parse pasted raw HTTP requests / JSON, verify HMAC-SHA256 signatures with SubtleCrypto.
import { el, render, store, copy, toast, field, uid } from '../../lib/ui.js';

const SAMPLE = `POST /webhooks/github HTTP/1.1
Host: example.com
Content-Type: application/json
X-GitHub-Event: push
X-Hub-Signature-256: sha256=5d0a3b1c7a0bd2a8e05fdc7b46d8dc6ea2e9b4b1b3f0ddc5a2a4d3e7a2e5b1c9

{"ref":"refs/heads/main","repository":{"full_name":"octo/repo"},"pusher":{"name":"octocat"}}`;

export default function (root) {
  const s = store('webhook-tester');
  let items = s.get('items', []);
  const input = el('textarea', { class: 'textarea', style: { minHeight: '200px' }, placeholder: 'Paste a raw HTTP request (request line, headers, blank line, body) or just a JSON payload…', value: s.get('input', SAMPLE) });
  const secret = el('input', { class: 'input', type: 'password', placeholder: 'webhook secret', value: s.get('secret', ''), style: { width: '220px' } });
  const sigHeader = el('input', { class: 'input', placeholder: 'X-Hub-Signature-256', value: s.get('sigHeader', 'X-Hub-Signature-256'), style: { width: '200px' } });
  const scheme = el('select', { class: 'select' },
    el('option', { value: 'plain' }, 'HMAC of body (GitHub, Shopify, generic)'),
    el('option', { value: 'stripe' }, 'Stripe: t=…,v1=… over "t.body"'),
    el('option', { value: 'slack' }, 'Slack: v0=… over "v0:ts:body"'));
  scheme.value = s.get('scheme', 'plain');
  const tsHeader = el('input', { class: 'input', placeholder: 'X-Slack-Request-Timestamp', value: s.get('tsHeader', 'X-Slack-Request-Timestamp'), style: { width: '220px' } });
  const parsedOut = el('div', {});
  const verifyOut = el('div', {});
  const listOut = el('div', { class: 'col' });
  let current = null;

  function parse(text) {
    const t = text.replace(/\r\n/g, '\n');
    const trimmed = t.trim();
    const res = { method: '', path: '', version: '', headers: [], body: '', json: null, kind: 'json' };
    if (/^[A-Z]+ \S+( HTTP\/[\d.]+)?\s*\n/.test(trimmed) || /^[A-Za-z-]+:\s*.+\n/.test(trimmed)) {
      res.kind = 'http';
      const [head, ...rest] = t.replace(/^\s+/, '').split(/\n\s*\n/);
      res.body = rest.join('\n\n').trim();
      const lines = head.split('\n');
      const first = lines[0].match(/^([A-Z]+) (\S+)(?: (HTTP\/[\d.]+))?$/);
      if (first) { res.method = first[1]; res.path = first[2]; res.version = first[3] || ''; lines.shift(); }
      for (const line of lines) {
        const i = line.indexOf(':');
        if (i > 0) res.headers.push({ k: line.slice(0, i).trim(), v: line.slice(i + 1).trim() });
      }
    } else res.body = trimmed;
    try { res.json = JSON.parse(res.body); } catch { /* not json */ }
    return res;
  }
  const hdr = (p, name) => p.headers.find(h => h.k.toLowerCase() === name.toLowerCase())?.v;

  async function hmacHex(key, msg) {
    const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg));
    const bytes = new Uint8Array(sig);
    return { hex: [...bytes].map(b => b.toString(16).padStart(2, '0')).join(''), b64: btoa(String.fromCharCode(...bytes)) };
  }

  async function verify(p) {
    render(verifyOut, el('div', { class: 'muted small' }, 'Verifying…'));
    if (!crypto?.subtle) { render(verifyOut, el('div', { class: 'badge danger' }, 'SubtleCrypto unavailable (needs https or localhost)')); return null; }
    if (!secret.value) { render(verifyOut, el('div', { class: 'muted small' }, 'Enter the secret to verify the signature.')); return null; }
    const name = sigHeader.value.trim();
    const given = hdr(p, name);
    if (!given) { render(verifyOut, el('div', { class: 'badge warn' }, `Header "${name}" not found in the request`)); return null; }
    let msg = p.body, provided = given.trim(), note = '';
    if (scheme.value === 'stripe') {
      const parts = Object.fromEntries(provided.split(',').map(x => x.split('=').map(y => y.trim())));
      if (!parts.t || !parts.v1) { render(verifyOut, el('div', { class: 'badge danger' }, 'Stripe header must look like t=123,v1=abc')); return null; }
      msg = `${parts.t}.${p.body}`; provided = parts.v1; note = `Signed payload: "${parts.t}.<body>"`;
    } else if (scheme.value === 'slack') {
      const ts = hdr(p, tsHeader.value.trim());
      if (!ts) { render(verifyOut, el('div', { class: 'badge danger' }, `Timestamp header "${tsHeader.value}" not found`)); return null; }
      msg = `v0:${ts}:${p.body}`; provided = provided.replace(/^v0=/, ''); note = `Signed payload: "v0:${ts}:<body>"`;
    } else {
      provided = provided.replace(/^(sha256=|hmac-sha256=)/i, '');
    }
    const { hex, b64 } = await hmacHex(secret.value, msg);
    const ok = provided.toLowerCase() === hex || provided === b64;
    render(verifyOut,
      el('div', { class: 'row' }, el('span', { class: 'badge ' + (ok ? 'ok' : 'danger'), style: { fontSize: '14px' } }, ok ? 'Signature valid' : 'Signature does NOT match')),
      note ? el('div', { class: 'small muted' }, note) : null,
      el('table', { class: 'table small mono' },
        el('tr', {}, el('td', {}, 'Provided'), el('td', { style: { wordBreak: 'break-all' } }, provided)),
        el('tr', {}, el('td', {}, 'Computed hex'), el('td', { style: { wordBreak: 'break-all' } }, hex)),
        el('tr', {}, el('td', {}, 'Computed base64'), el('td', { style: { wordBreak: 'break-all' } }, b64))),
      !ok ? el('div', { class: 'small muted' }, 'Mismatch tips: the body must be byte-identical to what was sent (no re-formatting, same trailing newline), the secret must be exact, and some providers hash a timestamp + body (choose the matching scheme).') : null);
    return ok;
  }

  function show(p) {
    current = p;
    const body = p.json != null ? JSON.stringify(p.json, null, 2) : p.body;
    render(parsedOut,
      p.kind === 'http' ? el('div', { class: 'row' }, el('span', { class: 'badge' }, p.method || '?'), el('span', { class: 'mono' }, p.path || ''), el('span', { class: 'muted small' }, p.version)) : el('div', { class: 'muted small' }, 'JSON payload only (no HTTP envelope)'),
      p.headers.length ? el('table', { class: 'table small' }, el('tr', {}, el('th', {}, 'Header'), el('th', {}, 'Value')), p.headers.map(h => el('tr', {}, el('td', { class: 'mono' }, h.k), el('td', { class: 'mono', style: { wordBreak: 'break-all' } }, h.v)))) : null,
      el('div', { class: 'row' }, el('b', {}, 'Body'), el('span', { class: 'muted small' }, p.body.length + ' bytes' + (p.json != null ? ', valid JSON' : p.body ? ', not JSON' : '')),
        el('button', { class: 'btn small', onclick: () => copy(body) }, 'Copy'),
        p.json != null ? el('button', { class: 'btn small', onclick: () => copy(JSON.stringify(flatten(p.json), null, 2)) }, 'Copy flattened keys') : null),
      el('pre', { class: 'out', style: { maxHeight: '320px' } }, body || '(empty)'),
      p.json != null ? el('details', {}, el('summary', { style: { cursor: 'pointer' } }, 'Key paths'), el('pre', { class: 'out small' }, Object.entries(flatten(p.json)).map(([k, v]) => `${k} = ${JSON.stringify(v)}`).join('\n'))) : null);
  }
  function flatten(o, pre = '', out = {}) {
    if (o && typeof o === 'object') { for (const [k, v] of Object.entries(o)) flatten(v, pre ? `${pre}.${k}` : k, out); if (!Object.keys(o).length) out[pre] = Array.isArray(o) ? [] : {}; }
    else out[pre] = o;
    return out;
  }

  async function inspect(save = true) {
    s.set('input', input.value); s.set('secret', secret.value); s.set('sigHeader', sigHeader.value); s.set('scheme', scheme.value); s.set('tsHeader', tsHeader.value);
    if (!input.value.trim()) { toast('Nothing to inspect'); return; }
    const p = parse(input.value);
    show(p);
    const ok = await verify(p);
    if (save) {
      const event = hdr(p, 'X-GitHub-Event') || hdr(p, 'Stripe-Signature') && 'stripe' || p.json?.type || p.json?.event || p.json?.action || '';
      items = [{ id: uid(), ts: Date.now(), raw: input.value, summary: `${p.method || 'JSON'} ${p.path || ''} ${event}`.trim(), bytes: p.body.length, ok }, ...items].slice(0, 30);
      s.set('items', items); drawList();
    }
  }
  function drawList() {
    render(listOut, items.length ? [items.map(it => el('div', { class: 'row small', style: { margin: '2px 0' } },
      el('span', { class: 'muted' }, new Date(it.ts).toLocaleString()),
      el('span', { class: 'mono grow' }, it.summary), el('span', { class: 'muted' }, it.bytes + ' B'),
      it.ok === true ? el('span', { class: 'badge ok' }, 'sig ok') : it.ok === false ? el('span', { class: 'badge danger' }, 'sig bad') : null,
      el('button', { class: 'btn small', onclick: () => { input.value = it.raw; inspect(false); } }, 'Open'),
      el('button', { class: 'btn small ghost', onclick: () => { items = items.filter(x => x.id !== it.id); s.set('items', items); drawList(); } }, '×'))),
      el('button', { class: 'btn small ghost', onclick: () => { items = []; s.set('items', []); drawList(); } }, 'Clear list')] : el('div', { class: 'muted small' }, 'Inspected payloads will be listed here.'));
  }
  async function signCurrent() {
    if (!current) { toast('Inspect a payload first'); return; }
    if (!secret.value) { toast('Enter a secret'); return; }
    const { hex } = await hmacHex(secret.value, current.body);
    copy(hex); toast('HMAC-SHA256 hex copied');
  }

  input.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) inspect(); });
  scheme.addEventListener('change', () => { tsWrap.classList.toggle('hidden', scheme.value !== 'slack'); if (current) verify(current); });
  const tsWrap = field('Timestamp header', tsHeader);
  tsWrap.classList.toggle('hidden', scheme.value !== 'slack');

  render(root,
    el('div', { class: 'muted small' }, 'This site has no backend, so it cannot receive webhooks directly. Copy the request from your provider\'s delivery log, a request-bin, or server logs and paste it here.'),
    input,
    el('div', { class: 'row' }, field('Secret', secret), field('Signature header', sigHeader), field('Scheme', scheme), tsWrap),
    el('div', { class: 'row' },
      el('button', { class: 'btn primary', onclick: () => inspect() }, 'Inspect & verify'),
      el('button', { class: 'btn', onclick: signCurrent }, 'Compute signature of body'),
      el('button', { class: 'btn ghost', onclick: () => { input.value = SAMPLE; } }, 'Sample'),
      el('button', { class: 'btn ghost', onclick: () => { input.value = ''; render(parsedOut); render(verifyOut); } }, 'Clear')),
    el('div', { class: 'grid2' }, el('div', {}, parsedOut), el('div', {}, el('div', { class: 'small muted' }, 'Signature check'), verifyOut)),
    el('div', { class: 'small muted', style: { marginTop: '12px' } }, 'Inspected payloads'), listOut);
  drawList();
}
