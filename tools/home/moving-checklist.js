import { el, render, store, uid, toast } from '../../lib/ui.js';
import { pd, addDays, fmtDate, exportBar, input, sel } from './_h.js';
import { drawQR, maxBytes } from './_qr.js';

const PHASES = [
  ['8 weeks before', 56], ['6 weeks before', 42], ['4 weeks before', 28], ['2 weeks before', 14],
  ['1 week before', 7], ['2 days before', 2], ['Moving day', 0], ['After the move', -7],
];
const DEFAULTS = [
  [0, 'Set a moving budget'], [0, 'Research and get quotes from moving companies'], [0, 'Declutter: sort, sell, donate'], [0, 'Check lease or closing dates and notice periods'],
  [1, 'Book movers or reserve a truck'], [1, 'Order packing supplies'], [1, 'Start packing rarely used rooms'], [1, 'Arrange school or childcare records transfer'],
  [2, 'Notify employer, bank, insurance, subscriptions of new address'], [2, 'Book time off work for moving day'], [2, 'Arrange pet and plant transport'],
  [3, 'Submit official change of address'], [3, 'Schedule utilities: stop, transfer, start'], [3, 'Back up computers and important documents'], [3, 'Pack most non-essentials'],
  [4, 'Confirm movers and parking permits'], [4, 'Defrost freezer, use up food'], [4, 'Pack an essentials bag per person'], [4, 'Label every box (room and contents)'],
  [5, 'Charge phones and devices'], [5, 'Disassemble furniture and bag the screws'], [5, 'Pack toiletries and last-minute items'],
  [6, 'Take meter readings'], [6, 'Do a final walkthrough and photograph the empty home'], [6, 'Hand over keys'], [6, 'Keep valuables and documents with you'],
  [7, 'Unpack essentials and set up beds'], [7, 'Check utilities work in new home'], [7, 'Update address on driving licence and registrations'], [7, 'Meet the neighbours'],
];
const ROOMS = ['Kitchen', 'Living room', 'Bedroom', 'Bathroom', 'Office', 'Garage', 'Kids room', 'Dining room', 'Hallway', 'Basement'];

const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export default function (root) {
  const s = store('moving-checklist');
  let tasks = s.get('tasks', null) || DEFAULTS.map(([p, text]) => ({ id: uid(), phase: p, text, done: false }));
  let boxes = s.get('boxes', []);
  let moveDate = s.get('date', '');
  const save = () => { s.set('tasks', tasks); s.set('boxes', boxes); s.set('date', moveDate); };

  const tasksBox = el('div'), boxesBox = el('div'), labelsBox = el('div');
  const tText = input({ placeholder: 'Add a task', class: 'input grow' });
  const tPhase = sel(PHASES.map((p, i) => [String(i), p[0]]), '0');
  const dateIn = input({ type: 'date', value: moveDate, onchange: () => { moveDate = dateIn.value; save(); drawTasks(); } });

  function addTask() {
    if (!tText.value.trim()) return;
    tasks.push({ id: uid(), phase: +tPhase.value, text: tText.value.trim(), done: false });
    tText.value = ''; save(); drawTasks();
  }
  tText.addEventListener('keydown', e => e.key === 'Enter' && addTask());

  function drawTasks() {
    const done = tasks.filter(t => t.done).length, pct = tasks.length ? done / tasks.length * 100 : 0;
    const md = pd(moveDate);
    render(tasksBox,
      el('div', { class: 'row' }, el('b', {}, `${done} / ${tasks.length} done`), el('div', { class: 'bar grow', style: { minWidth: '120px' } }, el('div', { style: { width: pct + '%', background: 'var(--ok)' } }))),
      PHASES.map(([name, offset], pi) => {
        const list = tasks.filter(t => t.phase === pi);
        if (!list.length) return null;
        const pdone = list.filter(t => t.done).length;
        return el('div', {},
          el('h3', {}, name, md ? el('span', { class: 'muted small' }, '  by ' + fmtDate(addDays(md, -offset))) : null, ' ', el('span', { class: 'badge ' + (pdone === list.length ? 'ok' : '') }, `${pdone}/${list.length}`)),
          el('ul', { class: 'list' }, list.map(t => el('li', {},
            el('input', { type: 'checkbox', checked: t.done, onchange: e => { t.done = e.target.checked; save(); drawTasks(); } }),
            el('span', { class: 'grow', style: { textDecoration: t.done ? 'line-through' : 'none', opacity: t.done ? 0.6 : 1 } }, t.text),
            el('button', { class: 'btn small ghost', onclick: () => { tasks = tasks.filter(x => x.id !== t.id); save(); drawTasks(); } }, 'x')))));
      }));
  }

  // ---- boxes ----
  const bRoom = input({ list: 'mv-rooms', placeholder: 'Room', style: { width: '140px' } });
  const dl = el('datalist', { id: 'mv-rooms' }, ROOMS.map(r => el('option', { value: r })));
  const bCont = input({ placeholder: 'Contents (e.g. plates, glasses, mugs)', class: 'input grow' });
  const bFrag = el('input', { type: 'checkbox' });
  function addBox() {
    if (!bCont.value.trim() && !bRoom.value.trim()) return;
    const num = boxes.reduce((a, b) => Math.max(a, b.num), 0) + 1;
    boxes.push({ id: uid(), num, room: bRoom.value.trim() || 'Unsorted', contents: bCont.value.trim(), fragile: bFrag.checked });
    bCont.value = ''; bFrag.checked = false; save(); drawBoxes(); bCont.focus();
  }
  bCont.addEventListener('keydown', e => e.key === 'Enter' && addBox());

  function payload(b) {
    const head = `Box ${b.num} | ${b.room}${b.fragile ? ' | FRAGILE' : ''}\n`;
    let c = b.contents, truncated = false;
    const enc = new TextEncoder();
    while (enc.encode(head + c).length > maxBytes(10)) { c = c.slice(0, -1); truncated = true; }
    return { text: head + c + (truncated ? '' : ''), truncated };
  }

  function drawBoxes() {
    render(boxesBox,
      boxes.length ? el('div', { class: 'scroll-x' }, el('table', { class: 'table' },
        el('thead', {}, el('tr', {}, ['#', 'Room', 'Contents', 'Fragile', ''].map(h => el('th', {}, h)))),
        el('tbody', {}, boxes.map(b => el('tr', {},
          el('td', {}, b.num),
          el('td', {}, input({ value: b.room, style: { width: '130px' }, onchange: e => { b.room = e.target.value.trim() || b.room; save(); drawLabels(); } })),
          el('td', {}, input({ value: b.contents, style: { width: '100%', minWidth: '180px' }, onchange: e => { b.contents = e.target.value.trim(); save(); drawLabels(); } })),
          el('td', {}, el('input', { type: 'checkbox', checked: b.fragile, onchange: e => { b.fragile = e.target.checked; save(); drawLabels(); } })),
          el('td', {}, el('button', { class: 'btn small ghost', onclick: () => { boxes = boxes.filter(x => x.id !== b.id); save(); drawBoxes(); } }, 'x')))))))
        : el('div', { class: 'muted small' }, 'No boxes yet.'));
    drawLabels();
  }

  function labelCanvas(b) {
    const c = el('canvas', { style: { width: '120px', height: '120px', imageRendering: 'pixelated' } });
    drawQR(c, payload(b).text, 4, 2);
    return c;
  }
  function drawLabels() {
    render(labelsBox,
      boxes.length ? [
        el('div', { class: 'row' },
          el('button', { class: 'btn primary', onclick: printLabels }, 'Print labels'),
          el('span', { class: 'small muted' }, 'Each QR code holds the box number, room and contents (max ~' + maxBytes(10) + ' bytes).')),
        el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', gap: '10px' } },
          boxes.map(b => el('div', { class: 'panel', style: { display: 'flex', gap: '10px', alignItems: 'center' } },
            labelCanvas(b),
            el('div', {}, el('div', { class: 'big' }, '#' + b.num), el('div', {}, el('b', {}, b.room)),
              el('div', { class: 'small' }, b.contents), b.fragile ? el('span', { class: 'badge danger' }, 'FRAGILE') : null,
              payload(b).truncated ? el('div', { class: 'small muted' }, 'QR text shortened to fit') : null))))] : null);
  }

  function printLabels() {
    const w = window.open('', '_blank');
    if (!w) { toast('Allow pop-ups to print labels'); return; }
    const cells = boxes.map(b => {
      const c = document.createElement('canvas');
      drawQR(c, payload(b).text, 6, 2);
      return `<div class="l"><img src="${c.toDataURL('image/png')}"><div><div class="n">Box ${b.num}</div><div class="r">${esc(b.room)}</div><div class="c">${esc(b.contents)}</div>${b.fragile ? '<div class="f">FRAGILE</div>' : ''}</div></div>`;
    }).join('');
    w.document.write(`<!doctype html><title>Box labels</title><style>
      body{font-family:system-ui,sans-serif;margin:12px}
      .g{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
      .l{display:flex;gap:10px;align-items:center;border:2px dashed #888;padding:8px;break-inside:avoid;height:150px}
      .l img{width:130px;height:130px;image-rendering:pixelated}
      .n{font-size:28px;font-weight:800}.r{font-size:18px;font-weight:700}.c{font-size:14px}.f{margin-top:4px;font-weight:800;color:#c00;border:2px solid #c00;display:inline-block;padding:0 6px}
      </style><div class="g">${cells}</div>`);
    w.document.close();
    setTimeout(() => { try { w.focus(); w.print(); } catch {} }, 400);
  }

  render(root,
    el('h3', {}, 'Timeline'),
    el('div', { class: 'row' }, el('label', { class: 'inline' }, 'Moving day', dateIn), el('span', { class: 'small muted' }, 'Optional: shows a due date for each stage.')),
    tasksBox,
    el('div', { class: 'row' }, tText, tPhase, el('button', { class: 'btn', onclick: addTask }, 'Add task')),
    el('h3', {}, 'Box inventory'),
    el('div', { class: 'row' }, bRoom, dl, bCont, el('label', { class: 'inline' }, bFrag, 'Fragile'), el('button', { class: 'btn primary', onclick: addBox }, 'Add box')),
    boxesBox,
    el('h3', {}, 'Labels'),
    labelsBox,
    exportBar('moving',
      () => [['Box', 'Room', 'Contents', 'Fragile'], ...boxes.map(b => [b.num, b.room, b.contents, b.fragile ? 'yes' : ''])],
      () => ({ moveDate, tasks, boxes })));
  drawTasks(); drawBoxes();
}
