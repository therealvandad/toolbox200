// SSL certificate checker: certificate transparency lookup via crt.sh (when CORS allows),
// a browser-side TLS reachability probe, and copyable openssl commands for a direct check.
import { el, render, store, copy, stat } from '../../lib/ui.js';

const DAY = 86400000;

export default function (root) {
  const s = store('ssl-checker');
  const domIn = el('input', { class: 'input grow', placeholder: 'example.com', value: s.get('domain', ''), style: { minWidth: '200px' } });
  const subChk = el('input', { type: 'checkbox', checked: s.get('sub', true) });
  const goBtn = el('button', { class: 'btn primary', onclick: run }, 'Check');
  const msg = el('div', { class: 'muted small' });
  const stats = el('div', { class: 'row' });
  const probe = el('div');
  const out = el('div');
  const cmds = el('div');
  let seq = 0;

  function cleanDomain() {
    return domIn.value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/[/:?#].*$/, '').replace(/^\*\./, '');
  }

  function openssl(d) {
    return `openssl s_client -connect ${d}:443 -servername ${d} </dev/null 2>/dev/null | openssl x509 -noout -subject -issuer -dates -ext subjectAltName`;
  }
  function drawCmds(d) {
    const c1 = openssl(d);
    const c2 = `curl -vI https://${d} 2>&1 | grep -iE "expire|issuer|subject|SSL certificate"`;
    const c3 = `echo | openssl s_client -connect ${d}:443 -servername ${d} 2>/dev/null | openssl x509 -noout -enddate`;
    const block = (title, cmd) => el('div', { style: { marginBottom: '8px' } },
      el('div', { class: 'row', style: { margin: '0 0 4px' } }, el('span', { class: 'small muted' }, title), el('button', { class: 'btn small', onclick: () => copy(cmd) }, 'Copy')),
      el('pre', { class: 'out', style: { margin: 0 } }, cmd));
    render(cmds,
      el('h3', { style: { margin: '14px 0 6px', fontSize: '15px' } }, 'Direct check from a terminal'),
      el('p', { class: 'muted small', style: { margin: '0 0 8px' } }, 'Browsers do not expose the certificate of a connection to page scripts, so the live certificate can only be read outside the page. These commands print the certificate actually served right now, including its expiry date.'),
      block('Full details (subject, issuer, dates, SANs)', c1),
      block('Just the expiry date', c3),
      block('With curl', c2));
  }

  async function tlsProbe(d) {
    render(probe, el('span', { class: 'muted small' }, 'Probing https://' + d + ' from this browser…'));
    const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 8000);
    const t0 = performance.now();
    try {
      await fetch('https://' + d + '/', { mode: 'no-cors', cache: 'no-store', signal: ctrl.signal });
      render(probe, el('div', { class: 'panel' }, el('span', { class: 'badge ok' }, 'TLS OK'), ' ',
        `This browser completed an HTTPS connection to ${d} in ${Math.round(performance.now() - t0)} ms, so the certificate it served is currently valid and trusted by this browser (not expired, chain OK, name matches).`));
    } catch (e) {
      render(probe, el('div', { class: 'panel' }, el('span', { class: 'badge danger' }, e.name === 'AbortError' ? 'TIMEOUT' : 'TLS/NETWORK FAILED'), ' ',
        `This browser could not complete an HTTPS connection to ${d}. That happens for an expired, self-signed or mismatched certificate, but also for DNS failures, firewalls or a host that is simply down — the browser does not tell scripts which. Open https://${d} in a tab and click the padlock to see the exact reason.`));
    } finally { clearTimeout(to); }
  }

  async function run() {
    const d = cleanDomain();
    if (!d || !d.includes('.')) { msg.textContent = 'Enter a domain name like example.com'; return; }
    domIn.value = d; s.set('domain', d); s.set('sub', subChk.checked);
    const my = ++seq;
    goBtn.disabled = true; render(out); render(stats); drawCmds(d);
    tlsProbe(d);
    msg.textContent = 'Querying certificate transparency logs (crt.sh)…';
    const q = subChk.checked ? '%.' + d : d;
    const url = `https://crt.sh/?q=${encodeURIComponent(q)}&output=json`;
    const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 20000);
    let data;
    try {
      const r = await fetch(url, { signal: ctrl.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      data = await r.json();
    } catch (e) {
      if (my !== seq) return;
      msg.textContent = '';
      render(out, el('div', { class: 'panel' },
        el('div', { style: { color: 'var(--danger)', fontWeight: 600 } }, 'Could not load certificate transparency data from crt.sh'),
        el('div', { class: 'small' }, 'Reason: ' + (e.name === 'AbortError' ? 'timed out (crt.sh is often slow)' : e.message + ' — crt.sh may be blocking cross-origin requests or be temporarily unavailable.')),
        el('div', { class: 'small', style: { marginTop: '6px' } }, 'You can open the same query in a new tab: ', el('a', { href: `https://crt.sh/?q=${encodeURIComponent(q)}`, target: '_blank', rel: 'noopener' }, `crt.sh/?q=${q}`)),
        el('div', { class: 'small muted', style: { marginTop: '6px' } }, 'The browser probe above and the openssl command below still work for a direct check of the live certificate.')));
      goBtn.disabled = false; clearTimeout(to);
      return;
    }
    clearTimeout(to);
    if (my !== seq) return;
    goBtn.disabled = false;
    if (!Array.isArray(data) || !data.length) { msg.textContent = ''; render(out, el('div', { class: 'panel muted' }, 'crt.sh has no certificates logged for ' + q + '.')); return; }
    // de-duplicate (pre-certs and leaf certs are logged separately) by serial + not_after
    const seen = new Map();
    for (const c of data) {
      const key = (c.serial_number || c.id) + '|' + c.not_after;
      if (!seen.has(key)) seen.set(key, c);
    }
    const certs = [...seen.values()].map(c => ({
      issuer: (c.issuer_name || '').match(/O=([^,]+)/)?.[1] || c.issuer_name || '?',
      cn: c.common_name || '',
      names: String(c.name_value || '').split('\n').filter(Boolean),
      from: new Date(c.not_before), to: new Date(c.not_after),
      id: c.id, serial: c.serial_number,
    })).sort((a, b) => b.to - a.to);
    const now = Date.now();
    const active = certs.filter(c => c.to > now && c.from <= now);
    const soon = active.filter(c => c.to - now < 30 * DAY);
    const latest = certs[0];
    render(stats, stat(certs.length, 'certificates logged'), stat(active.length, 'currently valid'), stat(soon.length, 'expire within 30 days'),
      stat(latest ? Math.ceil((latest.to - now) / DAY) + ' d' : '—', 'latest cert expires in'));
    msg.textContent = `Showing ${Math.min(certs.length, 200)} of ${certs.length} unique certificates from crt.sh. Note: logs show every certificate ever issued, including rotated ones; the one actually served may be any valid entry.`;
    const row = c => {
      const days = Math.ceil((c.to - now) / DAY);
      const state = c.to <= now ? ['danger', 'expired'] : c.from > now ? ['', 'not yet valid'] : days < 30 ? ['warn', `expires in ${days} d`] : ['ok', `${days} d left`];
      return el('tr', {},
        el('td', {}, el('span', { class: 'badge ' + state[0] }, state[1])),
        el('td', { class: 'mono small' }, c.cn, c.names.length > 1 ? el('div', { class: 'muted' }, c.names.filter(n => n !== c.cn).slice(0, 6).join(', '), c.names.length > 7 ? ` +${c.names.length - 7} more` : '') : null),
        el('td', { class: 'small' }, c.issuer),
        el('td', { class: 'small mono' }, c.from.toISOString().slice(0, 10)),
        el('td', { class: 'small mono' }, c.to.toISOString().slice(0, 10)),
        el('td', {}, el('a', { class: 'small', href: 'https://crt.sh/?id=' + c.id, target: '_blank', rel: 'noopener' }, 'crt.sh')));
    };
    render(out, el('div', { class: 'scroll-x' }, el('table', { class: 'table' },
      el('thead', {}, el('tr', {}, el('th', {}, 'Status'), el('th', {}, 'Names'), el('th', {}, 'Issuer'), el('th', {}, 'Not before'), el('th', {}, 'Not after'), el('th', {}, ''))),
      el('tbody', {}, certs.slice(0, 200).map(row)))));
  }
  domIn.addEventListener('keydown', e => { if (e.key === 'Enter') run(); if (e.key === 'Escape') { domIn.value = ''; } });

  render(root,
    el('div', { class: 'row' }, domIn, el('label', { class: 'inline' }, subChk, 'include subdomains'), goBtn),
    msg, stats, probe, out, cmds,
    el('details', { class: 'small muted', style: { marginTop: '10px' } }, el('summary', {}, 'Why can a web page not read the certificate directly?'),
      el('p', {}, 'JavaScript in a page has no API for the TLS session: fetch and XHR expose headers and body but never the peer certificate. What a page can do is (1) try an HTTPS connection and see if the browser accepts it, and (2) ask public certificate transparency logs which certificates have been issued for the name. Combined with the openssl command for the authoritative answer, that covers most expiry checks.')));
  if (cleanDomain()) drawCmds(cleanDomain());
}
