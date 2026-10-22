import { el, render, copy } from '../../lib/ui.js';

const mq = q => { try { return window.matchMedia(q).matches; } catch { return false; } };

function collect() {
  const n = navigator, scr = screen, dpr = window.devicePixelRatio || 1;
  const conn = n.connection || n.mozConnection || n.webkitConnection;
  const ud = n.userAgentData;
  const orient = (scr.orientation && scr.orientation.type) || (window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait');
  const tz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return '-'; } })();
  return [
    ['Display', [
      ['Viewport (inner window)', `${window.innerWidth} x ${window.innerHeight} CSS px`],
      ['Browser window (outer)', `${window.outerWidth} x ${window.outerHeight} CSS px`],
      ['Screen', `${scr.width} x ${scr.height} CSS px`],
      ['Available screen', `${scr.availWidth} x ${scr.availHeight} CSS px`],
      ['Device pixel ratio', String(Math.round(dpr * 1000) / 1000)],
      ['Approx. physical resolution', `${Math.round(scr.width * dpr)} x ${Math.round(scr.height * dpr)} px`],
      ['Color depth', `${scr.colorDepth}-bit`],
      ['Orientation', orient],
      ['Color scheme preference', mq('(prefers-color-scheme: dark)') ? 'dark' : mq('(prefers-color-scheme: light)') ? 'light' : 'no preference'],
      ['Reduced motion', mq('(prefers-reduced-motion: reduce)') ? 'yes' : 'no'],
      ['HDR / wide gamut', `${mq('(dynamic-range: high)') ? 'HDR' : 'SDR'} / ${mq('(color-gamut: p3)') ? 'P3 or wider' : 'sRGB'}`],
      ['Fullscreen', document.fullscreenElement ? 'yes' : 'no'],
    ]],
    ['Browser', [
      ['User agent', n.userAgent],
      ['Platform', (ud && ud.platform) || n.platform || '-'],
      ['Browser brands', ud && ud.brands ? ud.brands.map(b => `${b.brand} ${b.version}`).join(', ') : 'not available'],
      ['Mobile', ud ? String(ud.mobile) : (/Mobi|Android|iPhone/i.test(n.userAgent) ? 'likely' : 'no')],
      ['Language', n.language || '-'],
      ['All languages', (n.languages || []).join(', ') || '-'],
      ['Time zone', tz],
      ['Cookies enabled', String(n.cookieEnabled)],
      ['Do Not Track', n.doNotTrack === '1' ? 'on' : 'off / unset'],
      ['Secure context', String(window.isSecureContext)],
    ]],
    ['Hardware and input', [
      ['Logical CPU cores', n.hardwareConcurrency ? String(n.hardwareConcurrency) : 'not available'],
      ['Device memory', n.deviceMemory ? `${n.deviceMemory} GB (approx.)` : 'not available'],
      ['Touch points', String(n.maxTouchPoints || 0)],
      ['Primary pointer', mq('(pointer: coarse)') ? 'coarse (touch)' : mq('(pointer: fine)') ? 'fine (mouse/pen)' : 'none'],
      ['Hover support', mq('(hover: hover)') ? 'yes' : 'no'],
    ]],
    ['Network', [
      ['Online', n.onLine ? 'yes' : 'no'],
      ['Connection type', conn && conn.effectiveType ? conn.effectiveType : 'not available'],
      ['Downlink', conn && conn.downlink ? conn.downlink + ' Mbps' : 'not available'],
      ['Round-trip time', conn && conn.rtt != null ? conn.rtt + ' ms' : 'not available'],
      ['Data saver', conn && conn.saveData != null ? String(conn.saveData) : 'not available'],
    ]],
  ];
}

export default function (root) {
  const body = el('div');
  let lastText = '';
  const stamp = el('div', { class: 'small muted' });

  function paint() {
    const groups = collect();
    lastText = groups.map(([g, rows]) => g + '\n' + rows.map(([k, v]) => `  ${k}: ${v}`).join('\n')).join('\n\n');
    render(body, groups.map(([g, rows]) => el('div', {},
      el('h3', { style: { margin: '16px 0 4px' } }, g),
      el('div', { class: 'scroll-x' }, el('table', { class: 'table' }, el('tbody', {}, rows.map(([k, v]) => el('tr', {},
        el('td', { class: 'muted', style: { width: '38%' } }, k), el('td', { class: 'mono', style: { wordBreak: 'break-word' } }, v)))))))));
    stamp.textContent = 'Updated ' + new Date().toLocaleTimeString();
  }

  const targets = [];
  const on = (t, ev) => { t.addEventListener(ev, paint); targets.push([t, ev]); };
  on(window, 'resize'); on(window, 'online'); on(window, 'offline'); on(window, 'orientationchange'); on(document, 'fullscreenchange');
  const conn = navigator.connection; if (conn && conn.addEventListener) on(conn, 'change');
  for (const q of ['(prefers-color-scheme: dark)', '(prefers-reduced-motion: reduce)', '(pointer: coarse)']) {
    try { on(window.matchMedia(q), 'change'); } catch {}
  }

  render(root,
    el('div', { class: 'row' },
      el('button', { class: 'btn primary', onclick: () => copy(lastText) }, 'Copy all'),
      el('button', { class: 'btn', onclick: paint }, 'Refresh'), stamp),
    body);
  paint();

  return () => { for (const [t, ev] of targets) t.removeEventListener(ev, paint); };
}
