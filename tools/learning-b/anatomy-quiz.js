// Anatomy labeling quiz: click the right point on a body outline.
import { el, render, store, shuffle, stat } from '../../lib/ui.js';

const NS = 'http://www.w3.org/2000/svg';
function svg(tag, attrs = {}, ...children) { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) { if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v); else if (v != null) n.setAttribute(k, v); } for (const c of children) n.append(c instanceof Node ? c : document.createTextNode(String(c))); return n; }

// Points in a 200 x 440 viewBox (front view; the person's left is on the viewer's right).
const POINTS = {
  organs: [
    ['Brain', 100, 38, 'Control centre of the nervous system, protected by the skull.'],
    ['Thyroid', 100, 86, 'Butterfly-shaped gland in the neck that regulates metabolism.'],
    ['Trachea', 100, 100, 'The windpipe carrying air from the larynx to the lungs.'],
    ['Lungs', 122, 138, 'Paired organs where oxygen enters the blood and carbon dioxide leaves it.'],
    ['Heart', 108, 152, 'Muscular pump sitting slightly left of the midline between the lungs.'],
    ['Diaphragm', 100, 172, 'Dome-shaped muscle under the lungs that drives breathing.'],
    ['Liver', 82, 186, 'Largest internal organ, on the right side under the ribs; filters blood and makes bile.'],
    ['Stomach', 114, 192, 'Muscular bag on the left where food is mixed with acid.'],
    ['Spleen', 132, 186, 'Filters blood and stores white blood cells; left side behind the stomach.'],
    ['Gallbladder', 90, 202, 'Small sac under the liver that stores bile.'],
    ['Pancreas', 104, 208, 'Makes digestive enzymes and insulin; lies behind the stomach.'],
    ['Kidney', 126, 222, 'Paired organs near the back that filter blood into urine.'],
    ['Large intestine', 72, 244, 'The colon frames the abdomen and absorbs water from waste.'],
    ['Small intestine', 100, 252, 'Long coiled tube where most nutrients are absorbed.'],
    ['Appendix', 80, 270, 'Small pouch at the start of the large intestine, lower right.'],
    ['Bladder', 100, 290, 'Stores urine in the lower pelvis.'],
    ['Esophagus', 100, 118, 'Muscular tube carrying food from the throat to the stomach.'],
    ['Aorta', 96, 162, 'The largest artery, carrying blood from the heart to the body.'],
  ],
  bones: [
    ['Skull', 100, 36, 'Cranium: protects the brain.'],
    ['Mandible', 100, 64, 'Lower jaw; the only movable skull bone.'],
    ['Cervical vertebrae', 100, 84, 'Seven neck vertebrae at the top of the spine.'],
    ['Clavicle', 78, 104, 'Collarbone, linking the sternum to the shoulder.'],
    ['Scapula', 128, 122, 'Shoulder blade, a flat triangular bone on the back.'],
    ['Sternum', 100, 136, 'Breastbone in the middle of the chest.'],
    ['Ribs', 124, 158, 'Twelve pairs forming the rib cage.'],
    ['Humerus', 54, 150, 'Upper arm bone from shoulder to elbow.'],
    ['Radius', 36, 228, 'Forearm bone on the thumb side.'],
    ['Ulna', 46, 240, 'Forearm bone on the little-finger side, forming the elbow point.'],
    ['Carpals', 38, 276, 'Eight small wrist bones.'],
    ['Phalanges', 30, 296, 'Finger (and toe) bones.'],
    ['Lumbar vertebrae', 100, 232, 'Five large lower-back vertebrae.'],
    ['Pelvis', 100, 272, 'Hip bones forming a basin that supports the trunk.'],
    ['Sacrum', 100, 294, 'Triangular bone at the base of the spine.'],
    ['Femur', 82, 332, 'Thigh bone, the longest and strongest bone.'],
    ['Patella', 82, 368, 'Kneecap.'],
    ['Tibia', 84, 398, 'Shin bone, the larger lower-leg bone.'],
    ['Fibula', 72, 400, 'Thin bone beside the tibia on the outside of the leg.'],
    ['Tarsals', 84, 424, 'Ankle bones.'],
  ],
};

export default function (root) {
  const s = store('anatomy-quiz');
  let mode = s.get('mode', 'organs'); if (!POINTS[mode]) mode = 'organs';
  let best = s.get('best', {});
  let queue = [], target = null, score = 0, asked = 0, answered = false, study = false;

  const outline = '90,68 90,80 62,96 48,110 34,190 26,270 22,300 36,304 44,272 54,196 62,130 66,220 62,290 70,300 64,370 66,420 70,432 90,432 94,420 92,370 100,310 108,370 106,420 110,432 130,432 134,420 136,370 130,300 138,290 134,220 138,130 146,196 156,272 164,304 178,300 174,270 166,190 152,110 138,96 110,80 110,68';
  const board = svg('svg', { viewBox: '0 0 200 440', style: 'width:100%;max-width:300px;height:auto;display:block;margin:auto;touch-action:manipulation' });
  const layer = svg('g'); board.append(svg('ellipse', { cx: 100, cy: 40, rx: 24, ry: 30, fill: 'none', stroke: 'var(--muted)', 'stroke-width': '1.5' }), svg('polygon', { points: outline, fill: 'none', stroke: 'var(--muted)', 'stroke-width': '1.5', 'stroke-linejoin': 'round' }), svg('line', { x1: 100, y1: 70, x2: 100, y2: 300, stroke: 'var(--line)', 'stroke-dasharray': '3 3' }), layer);
  const prompt = el('div', { class: 'big', style: { fontSize: '24px', minHeight: '40px' } });
  const feedback = el('div', { style: { minHeight: '48px' } });
  const stats = el('div', { class: 'row' });
  const tabs = el('div', { class: 'row' });

  function pts() { return POINTS[mode]; }
  function drawPoints() {
    render(layer);
    for (const p of pts()) {
      const [name, x, y] = p;
      const g = svg('g', { style: 'cursor:pointer', onclick: () => pick(p) });
      g.append(svg('circle', { cx: x, cy: y, r: 7, fill: 'transparent' }));
      const dot = svg('circle', { cx: x, cy: y, r: 4, fill: answered && p === target ? 'var(--ok)' : 'var(--accent)', stroke: 'var(--panel)', 'stroke-width': '1.5' });
      g.append(dot);
      if (study || (answered && p === target)) g.append(svg('text', { x: x + (x < 100 ? -8 : 8), y: y + 3, 'font-size': '8', 'text-anchor': x < 100 ? 'end' : 'start', fill: 'var(--text)', style: 'font-family:system-ui,sans-serif' }, name));
      layer.append(g);
    }
  }
  function updateStats() { render(stats, stat(score, 'score'), stat(asked ? Math.round(100 * score / (asked * 10)) + '%' : '–', 'accuracy'), stat(queue.length, 'left'), stat(best[mode] != null ? best[mode] : '–', 'best (' + mode + ')')); }
  function next() {
    answered = false;
    if (!queue.length) { target = null; render(prompt, 'Round complete: ' + score + ' / ' + (pts().length * 10)); if (best[mode] == null || score > best[mode]) { best[mode] = score; s.set('best', best); } render(feedback, el('button', { class: 'btn primary', onclick: start }, 'Play again')); drawPoints(); updateStats(); return; }
    target = queue.shift(); render(prompt, 'Click the ', el('b', {}, target[0].toLowerCase())); render(feedback, ''); drawPoints(); updateStats();
  }
  function pick(p) {
    if (study) { render(feedback, el('b', {}, p[0]), el('div', { class: 'small muted' }, p[3])); return; }
    if (!target || answered) return;
    answered = true; asked++;
    if (p === target) { score += 10; render(feedback, el('span', { style: { color: 'var(--ok)', fontWeight: 600 } }, 'Correct! '), el('span', { class: 'small muted' }, target[3])); }
    else { render(feedback, el('span', { style: { color: 'var(--danger)', fontWeight: 600 } }, 'That was the ' + p[0].toLowerCase() + '. '), el('span', { class: 'small muted' }, 'The ' + target[0].toLowerCase() + ' is now highlighted. ' + target[3])); }
    drawPoints(); updateStats();
    feedback.append(el('div', {}, el('button', { class: 'btn small', style: { marginTop: '6px' }, onclick: next }, 'Next ›')));
  }
  function start() { study = false; queue = shuffle(pts()); score = 0; asked = 0; renderTabs(); next(); }
  function startStudy() { study = true; target = null; queue = []; render(prompt, 'Study mode: click any point'); render(feedback, ''); renderTabs(); drawPoints(); updateStats(); }
  function renderTabs() {
    render(tabs,
      ['organs', 'bones'].map(m => el('button', { class: 'btn ' + (mode === m && !study ? 'primary' : ''), onclick: () => { mode = m; s.set('mode', m); start(); } }, m[0].toUpperCase() + m.slice(1) + ' quiz')),
      el('button', { class: 'btn ' + (study ? 'primary' : ''), onclick: () => { if (study) start(); else startStudy(); } }, study ? 'Back to quiz' : 'Study labels'),
      study ? el('span', { class: 'row', style: { margin: 0 } }, ['organs', 'bones'].map(m => el('button', { class: 'btn small ' + (mode === m ? 'primary' : ''), onclick: () => { mode = m; s.set('mode', m); startStudy(); } }, m))) : null,
      el('button', { class: 'btn ghost', onclick: start }, 'Restart round'));
  }
  const onKey = e => { if (e.key === 'Enter' && answered && !study) next(); };
  window.addEventListener('keydown', onKey);
  render(root, tabs,
    el('div', { class: 'row', style: { alignItems: 'flex-start' } },
      el('div', { class: 'panel', style: { flex: '0 1 320px', width: '100%' } }, board),
      el('div', { class: 'grow', style: { minWidth: '220px' } }, prompt, feedback, stats,
        el('div', { class: 'muted small' }, 'Each round asks for every point once; 10 points per correct click. Front view: the person\'s left side is on your right, which is why the heart and stomach sit right of the dashed midline. Enter advances after an answer.'))));
  start();
  return () => window.removeEventListener('keydown', onKey);
}
