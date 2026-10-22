// DNS record lookup via DNS-over-HTTPS (Cloudflare + Google), compared side by side.
import { el, render, store, copy, field } from '../../lib/ui.js';

const TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SOA', 'CAA'];
const TYPE_NUM = { 1: 'A', 28: 'AAAA', 5: 'CNAME', 15: 'MX', 16: 'TXT', 2: 'NS', 6: 'SOA', 257: 'CAA', 12: 'PTR', 33: 'SRV', 46: 'RRSIG', 43: 'DS', 48: 'DNSKEY', 65: 'HTTPS' };
const RCODE = { 0: 'NOERROR', 1: 'FORMERR', 2: 'SERVFAIL', 3: 'NXDOMAIN', 4: 'NOTIMP', 5: 'REFUSED' };

const RESOLVERS = [
  { name: 'Cloudflare 1.1.1.1', url: (h, t) => `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(h)}&type=${t}`, headers: { accept: 'application/dns-json' } },
  { name: 'Google 8.8.8.8', url: (h, t) => `https://dns.google/resolve?name=${encodeURIComponent(h)}&type=${t}`, headers: {} },
];

async function query(resolver, host, type) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 8000);
  const t0 = performance.now();
  try {
    const r = await fetch(resolver.url(host, type), { headers: resolver.headers, signal: ctrl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    return { ok: true, ms: Math.round(performance.now() - t0), status: j.Status, answers: (j.Answer || []).map(a => ({ name: a.name, type: TYPE_NUM[a.type] || a.type, ttl: a.TTL, data: String(a.data).replace(/^"|"$/g, '') })), authority: (j.Authority || []).map(a => ({ name: a.name, type: TYPE_NUM[a.type] || a.type, ttl: a.TTL, data: a.data })) };
  } catch (e) {
    return { ok: false, ms: Math.round(performance.now() - t0), error: e.name === 'AbortError' ? 'Timed out' : e.message };
  } finally { clearTimeout(to); }
}

function fmtTTL(ttl) {
  if (ttl == null) return '';
  if (ttl < 60) return ttl + 's';
  if (ttl < 3600) return Math.round(ttl / 60) + 'm';
  if (ttl < 86400) return (ttl / 3600).toFixed(1).replace(/\.0$/, '') + 'h';
  return (ttl / 86400).toFixed(1).replace(/\.0$/, '') + 'd';
}

export default function (root) {
  const s = store('dns-lookup');
  const hostIn = el('input', { class: 'input grow', placeholder: 'example.com', value: s.get('host', ''), style: { minWidth: '200px' } });
  const typeSel = el('select', { class: 'select' }, TYPES.map(t => el('option', { value: t, selected: t === s.get('type', 'A') }, t)));
  const allChk = el('input', { type: 'checkbox', checked: s.get('all', false) });
  const goBtn = el('button', { class: 'btn primary', onclick: run }, 'Lookup');
  const out = el('div');
  const msg = el('div', { class: 'muted small' });
  const recent = el('div', { class: 'row' });
  let seq = 0;

  function drawRecent() {
    const list = s.get('recent', []);
    render(recent, list.length ? [el('span', { class: 'muted small' }, 'Recent:'), list.map(h => el('button', { class: 'btn small ghost', onclick: () => { hostIn.value = h; run(); } }, h))] : null);
  }

  function cell(a) {
    return el('div', { class: 'mono small', style: { padding: '3px 0', wordBreak: 'break-all' } },
      el('span', { class: 'badge', style: { marginRight: '6px' } }, a.type),
      a.data, ' ',
      el('span', { class: 'muted' }, 'TTL ' + a.ttl + ' (' + fmtTTL(a.ttl) + ')'));
  }

  function resultPanel(res, resolver) {
    const head = el('div', { class: 'row', style: { margin: '0 0 6px' } }, el('strong', {}, resolver.name), el('span', { class: 'muted small' }, res.ms + ' ms'));
    if (!res.ok) return el('div', { class: 'panel' }, head, el('div', { style: { color: 'var(--danger)' } }, 'Request failed: ' + res.error), el('div', { class: 'muted small' }, 'The resolver may be blocked by your network or an extension.'));
    const parts = [head, el('div', { class: 'small' }, el('span', { class: 'badge ' + (res.status === 0 ? 'ok' : 'danger') }, RCODE[res.status] || 'RCODE ' + res.status))];
    if (res.answers.length) parts.push(res.answers.map(cell));
    else parts.push(el('div', { class: 'muted small', style: { marginTop: '6px' } }, 'No records of this type.'));
    if (!res.answers.length && res.authority.length) parts.push(el('details', { class: 'small' }, el('summary', { class: 'muted' }, 'Authority section'), res.authority.map(cell)));
    return el('div', { class: 'panel' }, ...parts);
  }

  function compare(a, b) {
    if (!a.ok || !b.ok) return el('span', { class: 'badge warn' }, 'cannot compare');
    const norm = r => r.answers.map(x => x.type + ' ' + x.data.toLowerCase()).sort().join('\n');
    const same = norm(a) === norm(b);
    if (same) return el('span', { class: 'badge ok' }, 'resolvers agree');
    const setA = new Set(a.answers.map(x => x.data.toLowerCase())), setB = new Set(b.answers.map(x => x.data.toLowerCase()));
    const onlyA = [...setA].filter(x => !setB.has(x)), onlyB = [...setB].filter(x => !setA.has(x));
    return el('div', {}, el('span', { class: 'badge warn' }, 'resolvers differ — propagation may be in progress'),
      el('div', { class: 'small mono', style: { marginTop: '4px' } },
        onlyA.length ? el('div', {}, 'Only Cloudflare: ' + onlyA.join(', ')) : null,
        onlyB.length ? el('div', {}, 'Only Google: ' + onlyB.join(', ')) : null));
  }

  async function lookupType(host, type) {
    const [a, b] = await Promise.all(RESOLVERS.map(r => query(r, host, type)));
    return el('div', { style: { marginBottom: '14px' } },
      el('div', { class: 'row', style: { margin: '0 0 6px' } }, el('strong', {}, type + ' records'), compare(a, b)),
      el('div', { class: 'grid2', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' } }, resultPanel(a, RESOLVERS[0]), resultPanel(b, RESOLVERS[1])));
  }

  async function run() {
    let host = hostIn.value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/\.$/, '');
    if (!host) { msg.textContent = 'Enter a host name.'; return; }
    hostIn.value = host;
    s.set('host', host); s.set('type', typeSel.value); s.set('all', allChk.checked);
    const rec = [host, ...s.get('recent', []).filter(x => x !== host)].slice(0, 6); s.set('recent', rec); drawRecent();
    const types = allChk.checked ? TYPES : [typeSel.value];
    const my = ++seq;
    goBtn.disabled = true; msg.textContent = 'Querying…'; render(out);
    try {
      const blocks = [];
      for (const t of types) { const b = await lookupType(host, t); if (my !== seq) return; blocks.push(b); render(out, blocks); }
      msg.textContent = 'Done. TTL is the remaining cache time reported by the resolver.';
    } catch (e) { msg.textContent = 'Lookup failed: ' + e.message; }
    finally { if (my === seq) goBtn.disabled = false; }
  }
  hostIn.addEventListener('keydown', e => { if (e.key === 'Enter') run(); if (e.key === 'Escape') { hostIn.value = ''; render(out); } });

  render(root,
    el('div', { class: 'row' }, hostIn, field('Type', typeSel), el('label', { class: 'inline' }, allChk, 'All types'), goBtn,
      el('button', { class: 'btn ghost', onclick: () => copy(out.innerText) }, 'Copy results')),
    recent, msg, out,
    el('p', { class: 'muted small' }, 'Queries go over DNS-over-HTTPS to Cloudflare (1.1.1.1) and Google (8.8.8.8). When the two disagree, a recent change may still be propagating; TTL tells you how long caches may hold the old value.'));
  drawRecent();
  if (hostIn.value) run();
}
