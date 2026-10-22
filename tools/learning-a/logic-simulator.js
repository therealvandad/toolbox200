// Logic gate simulator: place gates/inputs/outputs on a canvas, wire them, toggle inputs, live evaluation and truth table.
import { el, render, store, uid, toast } from '../../lib/ui.js';

const GATES = {
  INPUT: { ins: 0, fn: () => 0 }, OUTPUT: { ins: 1, fn: (a) => a },
  AND: { ins: 2, fn: (a, b) => a & b }, OR: { ins: 2, fn: (a, b) => a | b }, NOT: { ins: 1, fn: (a) => a ^ 1 },
  XOR: { ins: 2, fn: (a, b) => a ^ b }, NAND: { ins: 2, fn: (a, b) => (a & b) ^ 1 }, NOR: { ins: 2, fn: (a, b) => (a | b) ^ 1 },
};
const LW = 760, LH = 440, NW = 64, NH = 40;
const PRESETS = {
  'Half adder': { nodes: [['INPUT', 60, 120, 'A'], ['INPUT', 60, 260, 'B'], ['XOR', 300, 120], ['AND', 300, 260], ['OUTPUT', 540, 120, 'SUM'], ['OUTPUT', 540, 260, 'CARRY']], wires: [[0, 2, 0], [1, 2, 1], [0, 3, 0], [1, 3, 1], [2, 4, 0], [3, 5, 0]] },
  'Full adder': { nodes: [['INPUT', 50, 80, 'A'], ['INPUT', 50, 200, 'B'], ['INPUT', 50, 330, 'Cin'], ['XOR', 230, 120], ['AND', 230, 240], ['XOR', 420, 120], ['AND', 420, 240], ['OR', 580, 240], ['OUTPUT', 680, 120, 'SUM'], ['OUTPUT', 680, 300, 'Cout']], wires: [[0, 3, 0], [1, 3, 1], [0, 4, 0], [1, 4, 1], [3, 5, 0], [2, 5, 1], [3, 6, 0], [2, 6, 1], [4, 7, 1], [6, 7, 0], [5, 8, 0], [7, 9, 0]] },
  '2-to-1 mux': { nodes: [['INPUT', 50, 80, 'A'], ['INPUT', 50, 220, 'B'], ['INPUT', 50, 360, 'SEL'], ['NOT', 220, 320], ['AND', 380, 120], ['AND', 380, 260], ['OR', 540, 190], ['OUTPUT', 680, 190, 'Y']], wires: [[2, 3, 0], [0, 4, 0], [3, 4, 1], [1, 5, 0], [2, 5, 1], [4, 6, 0], [5, 6, 1], [6, 7, 0]] },
  'XOR from NANDs': { nodes: [['INPUT', 50, 120, 'A'], ['INPUT', 50, 300, 'B'], ['NAND', 230, 210], ['NAND', 400, 120], ['NAND', 400, 300], ['NAND', 570, 210], ['OUTPUT', 690, 210, 'Q']], wires: [[0, 2, 0], [1, 2, 1], [0, 3, 0], [2, 3, 1], [2, 4, 0], [1, 4, 1], [3, 5, 0], [4, 5, 1], [5, 6, 0]] },
};

export default function (root) {
  const s = store('logic-simulator');
  let nodes = [], wires = []; // nodes: {id,type,x,y,label,state}; wires: {from,to,port}
  let selected = null, drag = null, wiring = null, values = {};
  const canvas = el('canvas', { width: LW, height: LH, tabindex: 0, style: { width: '100%', maxWidth: LW + 'px', display: 'block', touchAction: 'none', outline: 'none', borderRadius: '8px', background: 'var(--bg)', border: '1px solid var(--line)' } });
  const ctx = canvas.getContext('2d');
  const tableBox = el('div', { class: 'scroll-x' });
  const status = el('div', { class: 'small muted' });

  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const byId = (id) => nodes.find(n => n.id === id);
  const inPort = (n, i) => [n.x - NW / 2, n.y - NH / 2 + (NH * (i + 1)) / (GATES[n.type].ins + 1)];
  const outPort = (n) => [n.x + NW / 2, n.y];

  function load(data) {
    nodes = data.nodes.map(n => ({ id: n.id || uid(), type: n.type, x: n.x, y: n.y, label: n.label || '', state: n.state || 0 }));
    wires = data.wires.filter(w => byId(w.from) && byId(w.to));
    selected = null; changed();
  }
  function loadPreset(name) {
    const p = PRESETS[name]; const ids = p.nodes.map(() => uid());
    load({ nodes: p.nodes.map(([type, x, y, label], i) => ({ id: ids[i], type, x, y, label: label || '' })), wires: p.wires.map(([f, t, port]) => ({ from: ids[f], to: ids[t], port })) });
  }
  function save() { s.set('circuit', { nodes, wires }); }
  function changed() { save(); evaluate(); draw(); drawTable(); }

  function nextLabel(type) {
    if (type === 'INPUT') { const used = new Set(nodes.filter(n => n.type === 'INPUT').map(n => n.label)); for (const ch of 'ABCDEFGHIJKLMNOP') if (!used.has(ch)) return ch; return 'I' + nodes.length; }
    if (type === 'OUTPUT') { const c = nodes.filter(n => n.type === 'OUTPUT').length; return 'Q' + (c + 1); }
    return '';
  }
  function addNode(type) {
    let x = 120 + (nodes.length % 6) * 100, y = 80 + Math.floor(nodes.length / 6) * 90;
    if (type === 'INPUT') x = 60; if (type === 'OUTPUT') x = LW - 60;
    nodes.push({ id: uid(), type, x, y, label: nextLabel(type), state: 0 });
    selected = nodes[nodes.length - 1].id; changed();
  }
  function deleteSelected() { if (!selected) return; nodes = nodes.filter(n => n.id !== selected); wires = wires.filter(w => w.from !== selected && w.to !== selected); selected = null; changed(); }

  // ----- evaluation -----
  function evalWith(inputStates) {
    const v = {}; nodes.forEach(n => { v[n.id] = n.type === 'INPUT' ? (inputStates[n.id] ?? n.state) : 0; });
    for (let pass = 0; pass < nodes.length + 2; pass++) {
      let changedAny = false;
      for (const n of nodes) {
        if (n.type === 'INPUT') continue;
        const g = GATES[n.type]; const args = [];
        for (let i = 0; i < g.ins; i++) { const w = wires.find(w => w.to === n.id && w.port === i); args.push(w ? v[w.from] : 0); }
        const out = g.fn(...args);
        if (v[n.id] !== out) { v[n.id] = out; changedAny = true; }
      }
      if (!changedAny) break;
    }
    return v;
  }
  function evaluate() { values = evalWith({}); }

  // ----- drawing -----
  function draw() {
    ctx.clearRect(0, 0, LW, LH);
    const accent = css('--accent'), muted = css('--muted'), text = css('--text'), panel = css('--panel'), ok = css('--ok'), line = css('--line');
    ctx.lineWidth = 2;
    for (const w of wires) {
      const a = byId(w.from), b = byId(w.to); if (!a || !b) continue;
      const [x1, y1] = outPort(a), [x2, y2] = inPort(b, w.port);
      ctx.strokeStyle = values[w.from] ? accent : muted; ctx.lineWidth = values[w.from] ? 3 : 2;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.bezierCurveTo(x1 + 50, y1, x2 - 50, y2, x2, y2); ctx.stroke();
    }
    if (wiring) { const a = byId(wiring.from); const [x1, y1] = outPort(a); ctx.strokeStyle = accent; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(wiring.x, wiring.y); ctx.stroke(); ctx.setLineDash([]); }
    ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const n of nodes) {
      const g = GATES[n.type]; const on = !!values[n.id];
      ctx.lineWidth = n.id === selected ? 3 : 1.5; ctx.strokeStyle = n.id === selected ? accent : muted;
      if (n.type === 'INPUT') {
        ctx.fillStyle = on ? ok : panel; roundRect(n.x - NW / 2, n.y - NH / 2, NW, NH, 8); ctx.fill(); ctx.stroke();
        ctx.fillStyle = on ? '#fff' : text; ctx.fillText(n.label + ' = ' + (on ? 1 : 0), n.x, n.y);
      } else if (n.type === 'OUTPUT') {
        ctx.fillStyle = on ? ok : panel; ctx.beginPath(); ctx.arc(n.x, n.y, NH / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = on ? '#fff' : text; ctx.fillText(on ? '1' : '0', n.x, n.y);
        ctx.fillStyle = muted; ctx.font = '11px system-ui, sans-serif'; ctx.fillText(n.label, n.x, n.y + NH / 2 + 10); ctx.font = 'bold 13px system-ui, sans-serif';
      } else {
        ctx.fillStyle = panel; roundRect(n.x - NW / 2, n.y - NH / 2, NW, NH, 8); ctx.fill(); ctx.stroke();
        ctx.fillStyle = text; ctx.fillText(n.type, n.x, n.y);
      }
      // ports
      for (let i = 0; i < g.ins; i++) { const [px, py] = inPort(n, i); const w = wires.find(w => w.to === n.id && w.port === i); ctx.fillStyle = w ? (values[w.from] ? accent : muted) : line; ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = muted; ctx.lineWidth = 1; ctx.stroke(); }
      if (n.type !== 'OUTPUT') { const [px, py] = outPort(n); ctx.fillStyle = on ? accent : line; ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = muted; ctx.lineWidth = 1; ctx.stroke(); }
    }
    status.textContent = `${nodes.length} nodes, ${wires.length} wires` + (selected ? ' · selected: ' + (byId(selected)?.label || byId(selected)?.type) + ' (Delete removes)' : '');
  }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  // ----- hit testing -----
  function pos(e) { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * LW / r.width, (e.clientY - r.top) * LH / r.height]; }
  function hit(x, y) {
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i]; const g = GATES[n.type];
      if (n.type !== 'OUTPUT') { const [px, py] = outPort(n); if (Math.hypot(px - x, py - y) <= 9) return { node: n, out: true }; }
      for (let k = 0; k < g.ins; k++) { const [px, py] = inPort(n, k); if (Math.hypot(px - x, py - y) <= 9) return { node: n, port: k }; }
      if (Math.abs(x - n.x) <= NW / 2 && Math.abs(y - n.y) <= NH / 2) return { node: n, body: true };
    }
    return null;
  }
  canvas.addEventListener('pointerdown', e => {
    canvas.focus(); canvas.setPointerCapture(e.pointerId);
    const [x, y] = pos(e); const h = hit(x, y);
    if (!h) { selected = null; draw(); return; }
    selected = h.node.id;
    if (h.out) { wiring = { from: h.node.id, x, y }; }
    else if (h.port != null) { const idx = wires.findIndex(w => w.to === h.node.id && w.port === h.port); if (idx >= 0) { const w = wires[idx]; wires.splice(idx, 1); wiring = { from: w.from, x, y }; evaluate(); } }
    else drag = { node: h.node, dx: h.node.x - x, dy: h.node.y - y, moved: false };
    draw();
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag && !wiring) return;
    const [x, y] = pos(e);
    if (drag) { const nx = Math.max(NW / 2, Math.min(LW - NW / 2, x + drag.dx)), ny = Math.max(NH / 2, Math.min(LH - NH / 2, y + drag.dy)); if (Math.hypot(nx - drag.node.x, ny - drag.node.y) > 2) drag.moved = true; drag.node.x = nx; drag.node.y = ny; draw(); }
    if (wiring) { wiring.x = x; wiring.y = y; draw(); }
  });
  const up = e => {
    if (drag) { if (!drag.moved && drag.node.type === 'INPUT') drag.node.state ^= 1; drag = null; changed(); }
    if (wiring) {
      const [x, y] = pos(e); const h = hit(x, y);
      if (h && h.port != null && h.node.id !== wiring.from) { wires = wires.filter(w => !(w.to === h.node.id && w.port === h.port)); wires.push({ from: wiring.from, to: h.node.id, port: h.port }); }
      else if (h && h.body && h.node.type !== 'INPUT' && h.node.id !== wiring.from) { // drop on a body: first free port
        const g = GATES[h.node.type]; let p = -1; for (let i = 0; i < g.ins; i++) if (!wires.some(w => w.to === h.node.id && w.port === i)) { p = i; break; }
        if (p < 0) p = 0; wires = wires.filter(w => !(w.to === h.node.id && w.port === p)); wires.push({ from: wiring.from, to: h.node.id, port: p });
      }
      wiring = null; changed();
    }
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', () => { drag = null; wiring = null; changed(); });
  canvas.addEventListener('keydown', e => { if (e.key === 'Delete' || e.key === 'Backspace') { deleteSelected(); e.preventDefault(); } });

  // ----- truth table -----
  function drawTable() {
    const ins = nodes.filter(n => n.type === 'INPUT'), outs = nodes.filter(n => n.type === 'OUTPUT');
    if (!ins.length || !outs.length) { render(tableBox, el('div', { class: 'muted small' }, 'Add at least one input and one output to see the truth table.')); return; }
    if (ins.length > 6) { render(tableBox, el('div', { class: 'muted small' }, 'Truth table shown for up to 6 inputs.')); return; }
    const rows = [];
    for (let k = 0; k < 1 << ins.length; k++) {
      const st = {}; ins.forEach((n, i) => { st[n.id] = (k >> (ins.length - 1 - i)) & 1; });
      const v = evalWith(st);
      const current = ins.every(n => st[n.id] === n.state);
      rows.push(el('tr', { style: current ? { background: 'color-mix(in srgb, var(--accent) 15%, transparent)', fontWeight: '600' } : {} },
        ins.map(n => el('td', { class: 'mono center' }, st[n.id])), outs.map(n => el('td', { class: 'mono center', style: { color: v[n.id] ? 'var(--ok)' : 'var(--muted)' } }, v[n.id]))));
    }
    render(tableBox, el('table', { class: 'table', style: { width: 'auto' } },
      el('thead', {}, el('tr', {}, ins.map(n => el('th', {}, n.label)), outs.map(n => el('th', { style: { borderLeft: '1px solid var(--line)' } }, n.label)))),
      el('tbody', {}, rows)));
  }

  const palette = el('div', { class: 'row' },
    Object.keys(GATES).map(t => el('button', { class: 'btn small' + (t === 'INPUT' || t === 'OUTPUT' ? ' primary' : ''), onclick: () => addNode(t) }, t === 'INPUT' ? '+ Input' : t === 'OUTPUT' ? '+ Output' : t)),
    el('span', { class: 'grow' }),
    el('button', { class: 'btn small danger', onclick: deleteSelected }, 'Delete selected'),
    el('button', { class: 'btn small ghost', onclick: () => { nodes = []; wires = []; selected = null; changed(); } }, 'Clear'));
  const presetSel = el('select', { class: 'select small', onchange: () => { if (presetSel.value) { loadPreset(presetSel.value); toast('Loaded ' + presetSel.value); presetSel.value = ''; } } },
    el('option', { value: '' }, 'Load example…'), Object.keys(PRESETS).map(k => el('option', { value: k }, k)));

  render(root,
    el('div', { class: 'muted small' }, 'Drag from an output dot (right) to an input dot (left) to wire. Click an input block to toggle it. Click a wired input dot to pick the wire up. Drag blocks to move them.'),
    el('div', { class: 'row' }, palette), el('div', { class: 'row' }, presetSel, status),
    canvas,
    el('div', { class: 'muted small', style: { marginTop: '10px' } }, 'Truth table (current inputs highlighted)'), tableBox);

  const savedCircuit = s.get('circuit');
  if (savedCircuit && savedCircuit.nodes && savedCircuit.nodes.length) load(savedCircuit); else loadPreset('Half adder');
}
