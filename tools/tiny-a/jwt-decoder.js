import { el, render, store, copy, loop } from '../../lib/ui.js';

function b64urlToBytes(str) {
  let b = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b.length % 4) b += '=';
  const bin = atob(b);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}
function parsePart(part, name) {
  let text;
  try { text = new TextDecoder().decode(b64urlToBytes(part)); } catch { throw new Error(`The ${name} is not valid base64url.`); }
  try { return JSON.parse(text); } catch { throw new Error(`The ${name} is not valid JSON.`); }
}
const fmtDate = sec => {
  const d = new Date(sec * 1000);
  return isNaN(d) ? 'invalid date' : d.toLocaleString() + '  (' + d.toISOString() + ')';
};
function rel(ms) {
  const abs = Math.abs(ms) / 1000;
  const units = [['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]];
  const parts = [];
  let rest = Math.floor(abs);
  for (const [n, sz] of units) { const v = Math.floor(rest / sz); if (v > 0 && parts.length < 2) { parts.push(v + ' ' + n + (v > 1 ? 's' : '')); } rest %= sz; }
  return parts.join(' ') || '0 seconds';
}

const SAMPLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyNDI2MjJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

export default function (root) {
  const s = store('jwt-decoder');
  const input = el('textarea', { class: 'textarea mono', placeholder: 'Paste a JWT (header.payload.signature)…', value: s.get('token', '') });
  const out = el('div', { class: 'col' });
  let payload = null;
  let statusEl = null;

  function statusInfo() {
    if (!payload) return null;
    const now = Date.now();
    if (typeof payload.nbf === 'number' && now < payload.nbf * 1000) return { cls: 'warn', text: 'Not yet valid (nbf in ' + rel(payload.nbf * 1000 - now) + ')' };
    if (typeof payload.exp === 'number') {
      return now >= payload.exp * 1000
        ? { cls: 'danger', text: 'Expired ' + rel(now - payload.exp * 1000) + ' ago' }
        : { cls: 'ok', text: 'Valid, expires in ' + rel(payload.exp * 1000 - now) };
    }
    return { cls: '', text: 'No expiry (exp claim missing)' };
  }
  function tickStatus() {
    const st = statusInfo();
    if (statusEl && st) { statusEl.className = 'badge ' + st.cls; statusEl.textContent = st.text; }
  }

  function update() {
    const token = input.value.trim().replace(/\s+/g, '');
    s.set('token', input.value);
    payload = null; statusEl = null;
    if (!token) { render(out, el('div', { class: 'muted' }, 'Paste a token above to decode it. Nothing is sent anywhere.')); return; }
    const parts = token.split('.');
    if (parts.length < 2 || parts.length > 3 || parts.some((p, i) => i < 2 && !p)) {
      render(out, el('div', { class: 'badge danger' }, 'Not a JWT: expected 2 or 3 dot-separated parts, found ' + parts.length + '.')); return;
    }
    let header;
    try { header = parsePart(parts[0], 'header'); payload = parsePart(parts[1], 'payload'); }
    catch (e) { render(out, el('div', { class: 'badge danger' }, e.message)); return; }

    const claims = [];
    for (const [k, label] of [['iat', 'Issued at (iat)'], ['nbf', 'Not before (nbf)'], ['exp', 'Expires (exp)']]) {
      if (payload && typeof payload[k] === 'number') claims.push(el('tr', {}, el('td', {}, label), el('td', { class: 'mono' }, String(payload[k])), el('td', {}, fmtDate(payload[k]))));
    }
    const st = statusInfo();
    statusEl = el('span', { class: 'badge ' + st.cls }, st.text);
    const block = (title, obj) => el('div', { class: 'col' },
      el('div', { class: 'row', style: { margin: 0 } }, el('strong', {}, title), el('button', { class: 'btn small ghost', onclick: () => copy(JSON.stringify(obj, null, 2)) }, 'Copy')),
      el('pre', { class: 'out mono' }, JSON.stringify(obj, null, 2)));
    render(out,
      el('div', { class: 'row' }, el('strong', {}, 'Status:'), statusEl,
        header && header.alg ? el('span', { class: 'badge' }, 'alg: ' + header.alg) : null,
        el('span', { class: 'badge' }, parts[2] ? 'signed (signature not verified)' : 'unsigned')),
      el('div', { class: 'grid2' }, block('Header', header), block('Payload', payload)),
      claims.length ? el('div', { class: 'scroll-x' }, el('table', { class: 'table' },
        el('thead', {}, el('tr', {}, el('th', {}, 'Claim'), el('th', {}, 'Value'), el('th', {}, 'Date'))),
        el('tbody', {}, claims))) : null,
      parts[2] ? el('div', {}, el('strong', {}, 'Signature (base64url)'), el('pre', { class: 'out mono' }, parts[2])) : null,
      el('div', { class: 'small muted' }, 'This tool only decodes. It does not verify the signature, so never trust a token based on this view alone.'));
  }
  input.addEventListener('input', update);

  render(root,
    input,
    el('div', { class: 'row' },
      el('button', { class: 'btn', onclick: () => { input.value = SAMPLE; update(); } }, 'Load sample'),
      el('button', { class: 'btn ghost', onclick: () => { input.value = ''; update(); } }, 'Clear')),
    out);
  update();
  const stop = (() => { const id = setInterval(tickStatus, 1000); return () => clearInterval(id); })();
  return () => stop();
}
