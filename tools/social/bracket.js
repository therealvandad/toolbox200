// Single-elimination tournament bracket drawn as SVG; byes for non-power-of-two fields.
import { el, render, store, download, shuffle, toast, stat } from '../../lib/ui.js';

const SVG = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs = {}, ...kids) { const n = document.createElementNS(SVG, tag); for (const [k, v] of Object.entries(attrs)) { if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v); } for (const c of kids) n.append(c instanceof Node ? c : document.createTextNode(String(c))); return n; }
function seedOrder(size) { let cur = [1]; while (cur.length < size) { const k = cur.length * 2, next = []; for (const s of cur) next.push(s, k + 1 - s); cur = next; } return cur; }
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888';

export default function (root) {
  const s = store('bracket');
  const st = s.get('state', { text: 'Alice\nBob\nCarol\nDave\nEve\nFrank', order: [], results: {} });
  const save = () => s.set('state', st);
  const ta = el('textarea', { class: 'textarea', style: { minHeight: '110px' }, placeholder: 'One entrant per line, in seed order (top = #1 seed)', value: st.text, oninput: () => { st.text = ta.value; save(); } });
  const wrap = el('div', { class: 'scroll-x', style: { background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: '8px', padding: '8px' } });
  const info = el('div', { class: 'row' });
  const champ = el('div', { class: 'row' });
  let svg = null;

  function entrants() { const seen = {}; return st.text.split('\n').map(x => x.trim()).filter(Boolean).map(n => { seen[n] = (seen[n] || 0) + 1; return seen[n] > 1 ? `${n} (${seen[n]})` : n; }); }
  function build(resetOrder = true) {
    const names = entrants();
    if (names.length < 2) { toast('Need at least 2 entrants'); return; }
    if (resetOrder || st.order.length !== names.length) st.order = names;
    st.results = {}; save(); draw();
  }

  function draw() {
    const n = st.order.length;
    if (n < 2) { render(wrap, el('div', { class: 'muted small', style: { padding: '20px' } }, 'Enter entrants and click "Build bracket".')); render(info); render(champ); return; }
    let size = 1; while (size < n) size *= 2;
    const rounds = Math.log2(size);
    const seeds = seedOrder(size);
    const slots = seeds.map(sd => sd <= n ? st.order[sd - 1] : null);
    const name = (r, i) => r === 0 ? slots[i] : winner(r - 1, i);
    function winner(r, m) {
      const a = name(r, 2 * m), b = name(r, 2 * m + 1);
      if (!a && !b) return null; if (!a) return b; if (!b) return a;
      const w = st.results[`${r}-${m}`]; return w === a || w === b ? w : null;
    }
    const W = 150, H = 26, GX = 44, RH = 36;
    const totalW = (rounds + 1) * (W + GX), totalH = size * RH;
    const cText = cssVar('--text'), cLine = cssVar('--line'), cAccent = cssVar('--accent'), cPanel = cssVar('--panel'), cBg = cssVar('--bg'), cMuted = cssVar('--muted');
    svg = svgEl('svg', { xmlns: SVG, viewBox: `0 0 ${totalW} ${totalH}`, width: totalW, height: totalH, style: 'max-width:none;font:13px system-ui,sans-serif' });
    svg.append(svgEl('rect', { x: 0, y: 0, width: totalW, height: totalH, fill: cBg }));
    const roundNames = r => r === rounds - 1 ? 'Final' : r === rounds - 2 ? 'Semifinals' : r === rounds - 3 ? 'Quarterfinals' : `Round ${r + 1}`;
    for (let r = 0; r < rounds; r++) {
      const cnt = size >> r, span = RH * (1 << r);
      svg.append(svgEl('text', { x: r * (W + GX) + 4, y: 12, fill: cMuted, 'font-size': 11 }, roundNames(r)));
      for (let i = 0; i < cnt; i++) {
        const x = r * (W + GX), yc = (i + 0.5) * span + 8, y = yc - H / 2;
        const nm = name(r, i), m = i >> 1, w = winner(r, m), isW = nm && w === nm, other = name(r, i ^ 1);
        const clickable = nm && other && r < rounds;
        const g = svgEl('g', { style: clickable ? 'cursor:pointer' : '' , onclick: () => { if (!clickable) return; st.results[`${r}-${m}`] = nm; save(); draw(); } });
        g.append(svgEl('rect', { x, y, width: W, height: H, rx: 5, fill: isW ? cAccent : cPanel, stroke: isW ? cAccent : cLine }));
        g.append(svgEl('text', { x: x + 8, y: yc + 4.5, fill: isW ? '#fff' : nm ? cText : cMuted, 'font-weight': isW ? 600 : 400 }, nm ? (r === 0 ? `${seeds[i]}. ` : '') + (nm.length > 18 ? nm.slice(0, 17) + '…' : nm) : 'bye'));
        if (clickable) g.append(svgEl('title', {}, `Click to mark ${nm} as winner`));
        svg.append(g);
        // connector to next round
        const xEnd = x + W, midY = (m + 0.5) * span * 2 + 8;
        svg.append(svgEl('path', { d: `M${xEnd} ${yc} H${xEnd + GX / 2} V${midY} H${xEnd + GX}`, fill: 'none', stroke: cLine, 'stroke-width': 1.5 }));
      }
    }
    // champion box
    const cx = rounds * (W + GX), cyc = 0.5 * size * RH + 8, champName = winner(rounds - 1, 0);
    svg.append(svgEl('text', { x: cx + 4, y: 12, fill: cMuted, 'font-size': 11 }, 'Champion'));
    svg.append(svgEl('rect', { x: cx, y: cyc - H / 2, width: W, height: H, rx: 5, fill: champName ? cAccent : cPanel, stroke: champName ? cAccent : cLine, 'stroke-width': 2 }));
    svg.append(svgEl('text', { x: cx + 8, y: cyc + 4.5, fill: champName ? '#fff' : cMuted, 'font-weight': 700 }, champName ? '🏆 ' + champName : 'TBD'));
    render(wrap, svg);
    const decided = Object.keys(st.results).length, matches = n - 1;
    render(info, stat(n, 'entrants'), stat(size - n, 'byes'), stat(rounds, 'rounds'), stat(`${Math.min(decided, matches)} / ${matches}`, 'matches decided'));
    render(champ, champName ? el('span', { class: 'badge ok' }, 'Champion: ' + champName) : el('span', { class: 'muted small' }, 'Click a name to advance it. Click again on the other name to change the result.'));
  }

  async function exportPng() {
    if (!svg) { toast('Build a bracket first'); return; }
    const xml = new XMLSerializer().serializeToString(svg);
    const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const c = document.createElement('canvas'); const sc = 2;
      c.width = svg.viewBox.baseVal.width * sc; c.height = svg.viewBox.baseVal.height * sc;
      const g = c.getContext('2d'); g.scale(sc, sc); g.drawImage(img, 0, 0);
      c.toBlob(b => { download('bracket.png', b, 'image/png'); }, 'image/png');
    } catch { toast('PNG export failed'); } finally { URL.revokeObjectURL(url); }
  }

  render(root,
    el('div', { class: 'grid2' },
      el('div', { class: 'col' }, ta,
        el('div', { class: 'row' },
          el('button', { class: 'btn primary', onclick: () => build(true) }, 'Build bracket'),
          el('button', { class: 'btn', onclick: () => { if (st.order.length < 2) build(true); st.order = shuffle(st.order); st.results = {}; save(); draw(); } }, 'Shuffle seeds'),
          el('button', { class: 'btn ghost', onclick: () => { st.results = {}; save(); draw(); } }, 'Clear results'))),
      el('div', { class: 'col' }, info, champ,
        el('div', { class: 'row' },
          el('button', { class: 'btn', onclick: exportPng }, 'Export PNG'),
          el('button', { class: 'btn ghost', onclick: () => { if (!svg) return; download('bracket.svg', new XMLSerializer().serializeToString(svg), 'image/svg+xml'); } }, 'Export SVG')),
        el('div', { class: 'muted small' }, 'Seeds follow the list order (1 vs lowest seed, etc.). Byes go to the top seeds when the field is not a power of two.'))),
    wrap);
  draw();
}
