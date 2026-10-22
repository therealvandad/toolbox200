// Stretch routine timer: ~10 stretches with animated stick figures, per-stretch seconds,
// pause/skip, optional speech announcements and custom routines.
import { el, render, store, uid, toast, loop, pad } from '../../lib/ui.js';

const L = (a, b, p) => a + (b - a) * p;
const lerpArr = (A, B, p) => A.map((v, i) => L(v, B[i], p));

// Pose: tilt (torso lean, deg, + = right), ht (head tilt), tw (twist deg), dy (hip drop px),
// la/ra/ll/rl = [upper, lower] absolute segment angles (0 = down, 90 = right, 180 = up).
const REST = { tilt: 0, ht: 0, tw: 0, dy: 0, la: [-8, -8], ra: [8, 8], ll: [-4, -4], rl: [4, 4] };
const mk = (o) => ({ ...REST, ...o });

export const STRETCHES = [
  { id: 'neck', name: 'Neck side tilt', how: 'Stand tall, drop one ear toward your shoulder, then the other. Keep shoulders relaxed.',
    pose: p => mk({ ht: L(-28, 28, p), la: [-8, -8], ra: [8, 8] }) },
  { id: 'reach', name: 'Overhead reach', how: 'Interlace fingers, reach up as tall as you can and breathe slowly.',
    pose: p => mk({ la: lerpArr([-8, -8], [-172, -178], p), ra: lerpArr([8, 8], [172, 178], p) }) },
  { id: 'side', name: 'Standing side bend', how: 'Arms overhead, lean from the waist to one side, then the other. Do not twist.',
    pose: p => { const t = L(-24, 24, p); return mk({ tilt: t, la: [-168 + t, -176 + t], ra: [168 + t, 176 + t] }); } },
  { id: 'fold', name: 'Forward fold', how: 'Hinge at the hips with soft knees and let your arms and head hang heavy.',
    pose: p => mk({ tilt: L(5, 115, p), dy: L(0, 4, p), la: [L(-8, 4, p), L(-8, 4, p)], ra: [L(8, 6, p), L(8, 6, p)], ht: L(0, 25, p), ll: [L(-4, -14, p), L(-4, -6, p)], rl: [L(4, -14, p), L(4, -6, p)] }) },
  { id: 'quad', name: 'Standing quad stretch', how: 'Hold a wall if needed. Pull one heel toward your glute, knees together. Swap halfway.',
    pose: p => mk({ rl: [L(4, 2, p), L(4, -150, p)], ra: [L(8, -10, p), L(8, -150, p)], la: [-14, -14] }) },
  { id: 'lunge', name: 'Hip flexor lunge', how: 'Step into a low lunge, back leg long, tuck the pelvis and lift your chest.',
    pose: p => mk({ dy: L(0, 18, p), tilt: L(0, -6, p), ll: [L(-4, -42, p), L(-4, -70, p)], rl: [L(4, 62, p), L(4, 0, p)], la: [L(-8, -150, p), L(-8, -165, p)], ra: [L(8, 150, p), L(8, 165, p)] }) },
  { id: 'chest', name: 'Chest opener', how: 'Clasp hands behind your back or open your arms wide and squeeze the shoulder blades.',
    pose: p => mk({ la: lerpArr([-70, -80], [-135, -150], p), ra: lerpArr([70, 80], [135, 150], p) }) },
  { id: 'triceps', name: 'Triceps stretch', how: 'Raise one elbow, drop the hand behind your head and gently press the elbow with the other hand.',
    pose: p => mk({ ra: [L(150, 176, p), L(30, 12, p)], la: [L(-100, -150, p), L(-170, -172, p)], ht: L(-4, 4, p) }) },
  { id: 'twist', name: 'Standing twist', how: 'Arms out at shoulder height, rotate gently through your ribs, look over the shoulder, then switch.',
    pose: p => mk({ tw: L(-60, 60, p), la: [-90, -90], ra: [90, 90] }) },
  { id: 'calf', name: 'Calf stretch', how: 'Hands on a wall, one heel back and flat on the floor, lean in until the calf stretches.',
    pose: p => mk({ tilt: L(0, 16, p), la: [L(-8, 96, p), L(-8, 96, p)], ra: [L(8, 96, p), L(8, 96, p)], ll: [L(-4, -20, p), L(-4, -20, p)], rl: [L(4, 40, p), L(4, 0, p)] }) },
];
const byId = Object.fromEntries(STRETCHES.map(s => [s.id, s]));
const DEFAULT = { id: 'default', name: 'Full body (10 stretches)', builtin: true, items: STRETCHES.map(s => ({ sid: s.id, secs: 30 })) };

export default function (root) {
  const s = store('stretch-routine');
  const cv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888';
  let custom = s.get('custom', []);                 // [{id,name,items:[{sid,secs}]}]
  let curId = s.get('current', 'default');
  let voice = !!s.get('voice', false);
  let idx = 0, remaining = 0, running = false, paused = false, done = false, tick = null, edit = false;

  const all = () => [DEFAULT, ...custom];
  const routine = () => all().find(r => r.id === curId) || DEFAULT;
  const saveCustom = () => s.set('custom', custom);

  const hasSpeech = typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';
  function say(t) {
    if (!voice || !hasSpeech) return;
    try { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(t)); } catch {}
  }

  const cv1 = el('canvas', { width: 320, height: 320, style: { width: '100%', maxWidth: '320px' } });
  const title = el('div', { class: 'big', style: { fontSize: '22px' } });
  const how = el('div', { class: 'muted small' });
  const timeBox = el('div', { class: 'huge', style: { fontSize: '48px' } });
  const progress = el('div', { class: 'bar' }, el('div', { style: { width: '0%' } }));
  const status = el('div', { class: 'muted small' });
  const startBtn = el('button', { class: 'btn primary', onclick: () => startOrToggle() });
  const skipBtn = el('button', { class: 'btn', onclick: () => skip(1) }, 'Skip ▶');
  const prevBtn = el('button', { class: 'btn', onclick: () => skip(-1) }, '◀ Back');
  const stopBtn = el('button', { class: 'btn ghost', onclick: () => stop(true) }, 'Reset');
  const voiceCk = el('input', { type: 'checkbox', checked: voice, onchange: () => { voice = voiceCk.checked; s.set('voice', voice); if (!voice && hasSpeech) speechSynthesis.cancel(); } });
  const sel = el('select', { class: 'select', onchange: () => { curId = sel.value; s.set('current', curId); stop(true); edit = false; refresh(); } });
  const listBox = el('div', { class: 'col' });
  const editBox = el('div', { class: 'col' });

  function items() { return routine().items.filter(i => byId[i.sid]); }

  function enter(i, announce = true) {
    const it = items(); idx = Math.max(0, Math.min(it.length - 1, i));
    remaining = it[idx].secs;
    if (announce) say(`${byId[it[idx].sid].name}. ${remaining} seconds.`);
    updateText();
  }
  function startOrToggle() {
    if (!items().length) { toast('This routine has no stretches'); return; }
    if (done) { stop(true); }
    if (!running) { running = true; paused = false; done = false; enter(idx); startTick(); }
    else { paused = !paused; if (paused && hasSpeech) speechSynthesis.cancel(); }
    updateText();
  }
  function startTick() {
    clearInterval(tick);
    tick = setInterval(() => {
      if (!running || paused) return;
      remaining--;
      if (remaining === Math.floor(items()[idx].secs / 2) && items()[idx].secs >= 20) say('Halfway');
      if (remaining <= 0) skip(1, true);
      updateText();
    }, 1000);
  }
  function skip(d, auto) {
    const it = items();
    if (!running) { enter(idx + d, false); return; }
    const n = idx + d;
    if (n >= it.length) {
      running = false; done = true; paused = false; clearInterval(tick); remaining = 0;
      say('Routine complete. Well done.'); toast('Routine complete'); updateText(); return;
    }
    enter(Math.max(0, n));
  }
  function stop(silent) {
    running = false; paused = false; done = false; clearInterval(tick); idx = 0;
    if (hasSpeech) { try { speechSynthesis.cancel(); } catch {} }
    const it = items(); remaining = it.length ? it[0].secs : 0;
    updateText();
  }

  function updateText() {
    const it = items(), cur = it[idx], st = cur && byId[cur.sid];
    if (done) { title.textContent = 'Routine complete'; how.textContent = 'Nice work. Press Start to go again.'; }
    else if (st) { title.textContent = `${idx + 1}/${it.length}  ${st.name}`; how.textContent = st.how; }
    else { title.textContent = 'Empty routine'; how.textContent = 'Add stretches with Edit routine.'; }
    const m = Math.floor(Math.max(0, remaining) / 60);
    timeBox.textContent = done ? '✓' : `${pad(m)}:${pad(Math.max(0, remaining) % 60)}`;
    const total = it.reduce((a, b) => a + b.secs, 0);
    let elapsed = 0; for (let i = 0; i < idx; i++) elapsed += it[i].secs;
    if (cur) elapsed += cur.secs - Math.max(0, remaining);
    progress.firstChild.style.width = done ? '100%' : (total ? Math.min(100, (running || idx > 0 ? elapsed : 0) / total * 100) : 0) + '%';
    startBtn.textContent = done ? 'Restart' : !running ? 'Start' : paused ? 'Resume' : 'Pause';
    skipBtn.disabled = !items().length; prevBtn.disabled = !items().length;
    status.textContent = `${it.length} stretches, ${Math.round(total / 60 * 10) / 10} min total${hasSpeech ? '' : '. Speech not supported in this browser'}`;
  }

  // ---- stick figure ----
  function drawFigure(t) {
    const c = cv1.getContext('2d'), W = cv1.width, H = cv1.height;
    c.clearRect(0, 0, W, H);
    const it = items(), cur = it[idx], st = cur ? byId[cur.sid] : null;
    const period = 4, phase = (t / 1000 / period) % 1;
    const p = (running && paused) ? 0.5 : (1 - Math.cos(phase * Math.PI * 2)) / 2;
    const pose = st ? st.pose(p) : mk({});
    const sc = 1, hipX = W / 2, hipY = H * 0.54 + pose.dy;
    const torso = 62 * sc, up = 48, lo = 46, th = 52, sh = 48;
    const pt = (x, y, a, len, wx = 1) => [x + Math.sin(a * Math.PI / 180) * len * wx, y + Math.cos(a * Math.PI / 180) * len];
    const neckA = 180 - pose.tilt;
    const [nx, ny] = pt(hipX, hipY, neckA, torso);
    const cw = Math.cos(pose.tw * Math.PI / 180), swx = Math.sin(pose.tw * Math.PI / 180);
    const shoulderHalf = 15 * cw;
    const sL = [nx - shoulderHalf, ny + (swx > 0 ? 0 : 0)], sR = [nx + shoulderHalf, ny];
    const hd = pt(nx, ny, 180 - pose.tilt + pose.ht, 20);
    const stroke = cv('--text'), acc = cv('--accent');
    c.lineCap = 'round'; c.lineJoin = 'round';
    // floor
    c.strokeStyle = cv('--line'); c.lineWidth = 3; c.beginPath(); c.moveTo(20, H * 0.54 + 46 + 52 + 4); c.lineTo(W - 20, H * 0.54 + 46 + 52 + 4); c.stroke();
    const seg = (a, b, col, w) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); };
    const limb = (from, ang, l1, l2, col, wx = 1) => {
      const m = pt(from[0], from[1], ang[0], l1, wx), e = pt(m[0], m[1], ang[1], l2, wx);
      seg(from, m, col, 6); seg(m, e, col, 6);
      c.fillStyle = col; c.beginPath(); c.arc(e[0], e[1], 3.5, 0, 7); c.fill();
    };
    const hipL = [hipX - 7, hipY], hipR = [hipX + 7, hipY];
    limb(hipL, pose.ll, th, th, stroke); limb(hipR, pose.rl, th, th, stroke);
    seg([hipX, hipY], [nx, ny], stroke, 7);
    seg(sL, sR, stroke, 6);
    limb(sL, pose.la, up, lo, acc, Math.abs(cw) < 0.2 ? 0.2 : cw); limb(sR, pose.ra, up, lo, acc, Math.abs(cw) < 0.2 ? 0.2 : cw);
    c.strokeStyle = stroke; c.lineWidth = 4; c.fillStyle = cv('--panel');
    c.beginPath(); c.arc(hd[0], hd[1] - 0, 14, 0, Math.PI * 2); c.fill(); c.stroke();
    if (!st) return;
    c.fillStyle = cv('--muted'); c.font = '12px system-ui, sans-serif'; c.textAlign = 'center';
    c.fillText(st.name, W / 2, 18);
  }
  const stopLoop = loop((dt, t) => drawFigure(t));

  // ---- routine list + editor ----
  function refresh() {
    render(sel, all().map(r => el('option', { value: r.id, selected: r.id === curId }, r.name)));
    const r = routine();
    render(listBox, el('ol', { style: { margin: 0, paddingLeft: '20px' } }, items().map((it, i) => {
      const cur = running && i === idx;
      return el('li', { style: { fontWeight: cur ? '700' : '400', color: cur ? 'var(--accent)' : 'var(--text)' } }, `${byId[it.sid].name} (${it.secs}s)`);
    })));
    renderEdit();
    if (!running) { idx = 0; const it = items(); remaining = it.length ? it[0].secs : 0; }
    updateText();
  }

  function renderEdit() {
    const r = routine();
    if (!edit) {
      render(editBox, el('div', { class: 'row' },
        el('button', { class: 'btn small', onclick: () => { newRoutine(false); } }, 'New routine'),
        el('button', { class: 'btn small', onclick: () => newRoutine(true) }, 'Duplicate'),
        !r.builtin && el('button', { class: 'btn small', onclick: () => { edit = true; renderEdit(); } }, 'Edit routine'),
        !r.builtin && el('button', { class: 'btn small danger', onclick: delRoutine }, 'Delete')));
      return;
    }
    const nameIn = el('input', { class: 'input', value: r.name, oninput: () => { r.name = nameIn.value || 'My routine'; saveCustom(); } });
    const addSel = el('select', { class: 'select' }, STRETCHES.map(x => el('option', { value: x.id }, x.name)));
    const secIn = el('input', { class: 'input', type: 'number', min: 5, max: 300, value: 30, style: { width: '80px' } });
    const rows = r.items.map((it, i) => el('li', {},
      el('span', { class: 'grow' }, byId[it.sid] ? byId[it.sid].name : it.sid),
      el('input', { class: 'input', type: 'number', min: 5, max: 300, value: it.secs, style: { width: '72px' }, onchange: e => { it.secs = Math.max(5, Math.min(300, +e.target.value || 30)); saveCustom(); refresh(); } }),
      el('span', { class: 'muted small' }, 's'),
      el('button', { class: 'btn small ghost', onclick: () => { if (i > 0) { [r.items[i - 1], r.items[i]] = [r.items[i], r.items[i - 1]]; saveCustom(); refresh(); } } }, '↑'),
      el('button', { class: 'btn small ghost', onclick: () => { if (i < r.items.length - 1) { [r.items[i + 1], r.items[i]] = [r.items[i], r.items[i + 1]]; saveCustom(); refresh(); } } }, '↓'),
      el('button', { class: 'btn small ghost', onclick: () => { r.items.splice(i, 1); saveCustom(); refresh(); } }, '✕')));
    render(editBox, el('div', { class: 'panel col' },
      el('div', { class: 'row' }, el('span', { class: 'muted small' }, 'Name'), nameIn),
      el('ul', { class: 'list' }, rows.length ? rows : el('li', { class: 'muted' }, 'Add a stretch below.')),
      el('div', { class: 'row' }, addSel, secIn, el('button', { class: 'btn small primary', onclick: () => { r.items.push({ sid: addSel.value, secs: Math.max(5, Math.min(300, +secIn.value || 30)) }); saveCustom(); refresh(); } }, 'Add')),
      el('div', { class: 'row' }, el('button', { class: 'btn small', onclick: () => { edit = false; refresh(); } }, 'Done'))));
  }
  function newRoutine(dup) {
    stop(true);
    const base = dup ? routine() : null;
    const r = { id: uid(), name: dup ? base.name + ' (copy)' : 'My routine', items: dup ? base.items.map(i => ({ ...i })) : [{ sid: 'reach', secs: 30 }] };
    custom.push(r); saveCustom(); curId = r.id; s.set('current', curId); edit = true; refresh();
  }
  function delRoutine() {
    const r = routine(); if (r.builtin) return;
    stop(true); custom = custom.filter(x => x.id !== r.id); saveCustom(); curId = 'default'; s.set('current', curId); edit = false; refresh();
  }

  render(root,
    el('div', { class: 'grid2' },
      el('div', { class: 'col' }, el('div', { class: 'canvas-wrap' }, cv1)),
      el('div', { class: 'col' },
        el('div', { class: 'row' }, el('span', { class: 'muted small' }, 'Routine'), sel),
        title, how, timeBox, progress,
        el('div', { class: 'row' }, prevBtn, startBtn, skipBtn, stopBtn),
        el('label', { class: 'inline' }, voiceCk, 'Announce stretches with speech'),
        status)),
    el('h3', {}, 'In this routine'), listBox,
    editBox,
    el('p', { class: 'muted small' }, 'Gentle stretching only. Stop if anything hurts. Routines are saved in this browser only.'));
  refresh();

  return () => { stopLoop(); clearInterval(tick); if (hasSpeech) { try { speechSynthesis.cancel(); } catch {} } };
}
