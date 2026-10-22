// Map quiz: click where a feature is on a simplified world map; scored by great-circle distance.
import { el, render, store, shuffle, stat } from '../../lib/ui.js';

const NS = 'http://www.w3.org/2000/svg';
function svg(tag, attrs = {}, ...children) { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) { if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v); else if (v != null) n.setAttribute(k, v); } for (const c of children) n.append(c instanceof Node ? c : document.createTextNode(String(c))); return n; }

// Simplified landmass outlines as [lon, lat] rings.
const LAND = [
  // North America
  [[-168, 66], [-162, 70], [-140, 70], [-125, 72], [-110, 73], [-95, 72], [-85, 70], [-80, 65], [-70, 62], [-64, 60], [-60, 55], [-56, 52], [-65, 47], [-70, 43], [-74, 40], [-76, 36], [-80, 32], [-81, 27], [-80, 25], [-83, 29], [-89, 30], [-94, 29], [-97, 26], [-97, 21], [-90, 20], [-87, 21], [-88, 16], [-83, 15], [-83, 9], [-80, 8], [-78, 8], [-85, 11], [-92, 15], [-97, 16], [-105, 20], [-106, 23], [-110, 23], [-115, 30], [-117, 33], [-122, 37], [-124, 42], [-124, 48], [-128, 52], [-135, 58], [-150, 60], [-158, 57], [-165, 55], [-165, 60], [-168, 66]],
  // South America
  [[-78, 8], [-72, 11], [-62, 10], [-52, 5], [-50, 0], [-45, -2], [-38, -4], [-35, -8], [-39, -14], [-41, -22], [-48, -26], [-52, -32], [-57, -36], [-62, -39], [-65, -45], [-68, -50], [-66, -55], [-72, -54], [-75, -48], [-73, -40], [-71, -30], [-70, -20], [-76, -14], [-81, -6], [-80, -2], [-77, 2], [-78, 8]],
  // Africa
  [[-17, 15], [-17, 21], [-13, 28], [-6, 35], [0, 36], [10, 37], [20, 32], [30, 31], [34, 29], [34, 27], [38, 20], [43, 12], [51, 12], [49, 6], [42, -1], [40, -8], [36, -18], [35, -25], [32, -29], [27, -34], [18, -34], [15, -28], [12, -18], [13, -8], [9, -1], [9, 5], [4, 6], [-4, 5], [-8, 5], [-14, 8], [-17, 15]],
  // Eurasia
  [[-9, 39], [-9, 43], [-4, 48], [2, 51], [8, 54], [10, 58], [5, 61], [12, 66], [20, 70], [30, 70], [42, 68], [60, 69], [75, 73], [100, 78], [130, 72], [150, 70], [170, 69], [180, 66], [175, 62], [165, 60], [160, 54], [156, 51], [155, 59], [140, 55], [135, 48], [130, 42], [126, 34], [122, 38], [119, 35], [122, 30], [117, 23], [109, 20], [106, 16], [109, 11], [103, 8], [103, 1], [100, 6], [98, 10], [97, 16], [94, 20], [90, 22], [86, 20], [80, 15], [78, 8], [73, 15], [72, 21], [67, 24], [60, 25], [52, 24], [59, 22], [55, 17], [45, 13], [43, 16], [39, 21], [35, 28], [33, 31], [36, 36], [30, 36], [27, 37], [26, 40], [29, 41], [36, 42], [41, 42], [37, 47], [31, 46], [28, 45], [28, 42], [26, 40], [22, 40], [22, 37], [19, 41], [14, 45], [12, 44], [14, 41], [16, 40], [18, 40], [16, 38], [12, 42], [9, 44], [6, 43], [3, 43], [0, 40], [-1, 37], [-6, 36], [-9, 37], [-9, 39]],
  // Australia
  [[114, -22], [114, -34], [118, -35], [124, -33], [131, -31], [135, -35], [138, -35], [140, -38], [146, -39], [150, -37], [153, -30], [153, -25], [146, -19], [142, -11], [136, -12], [132, -11], [127, -14], [122, -18], [114, -22]],
  // Greenland
  [[-45, 60], [-55, 65], [-70, 77], [-60, 82], [-30, 83], [-20, 76], [-22, 70], [-45, 60]],
  // British Isles, Iceland, Japan, Madagascar, New Zealand, Borneo, Sumatra, New Guinea, Sri Lanka, Cuba
  [[-5, 50], [1, 51], [2, 53], [-2, 56], [-4, 58], [-6, 56], [-5, 54], [-10, 52], [-6, 51], [-5, 50]],
  [[-24, 65], [-14, 66], [-14, 64], [-22, 64], [-24, 65]],
  [[130, 31], [132, 34], [136, 34], [140, 35], [141, 41], [142, 45], [145, 44], [141, 38], [140, 35], [136, 33], [131, 31], [130, 31]],
  [[44, -25], [50, -16], [49, -12], [44, -18], [44, -25]],
  [[173, -35], [178, -38], [175, -41], [171, -43], [166, -46], [170, -46], [174, -41], [173, -35]],
  [[109, 1], [117, 7], [119, 1], [116, -4], [110, -3], [109, 1]],
  [[95, 5], [106, -6], [104, -1], [98, 4], [95, 5]],
  [[131, -1], [141, -3], [150, -10], [141, -9], [135, -4], [131, -1]],
  [[80, 10], [82, 8], [81, 6], [80, 10]],
  [[-85, 22], [-80, 23], [-75, 20], [-78, 20], [-85, 22]],
  // Antarctica
  [[-180, -65], [180, -65], [180, -90], [-180, -90], [-180, -65]],
];

// [name, lat, lon, type]
const FEATURES = [
  ['Paris', 48.9, 2.3, 'city'], ['London', 51.5, -0.1, 'city'], ['New York', 40.7, -74.0, 'city'], ['Tokyo', 35.7, 139.7, 'city'], ['Sydney', -33.9, 151.2, 'city'],
  ['Cairo', 30.0, 31.2, 'city'], ['Moscow', 55.8, 37.6, 'city'], ['Rio de Janeiro', -22.9, -43.2, 'city'], ['Mexico City', 19.4, -99.1, 'city'], ['Beijing', 39.9, 116.4, 'city'],
  ['Mumbai', 19.1, 72.9, 'city'], ['Cape Town', -33.9, 18.4, 'city'], ['Nairobi', -1.3, 36.8, 'city'], ['Buenos Aires', -34.6, -58.4, 'city'], ['Los Angeles', 34.1, -118.2, 'city'],
  ['Istanbul', 41.0, 28.9, 'city'], ['Singapore', 1.3, 103.8, 'city'], ['Reykjavik', 64.1, -21.9, 'city'],
  ['Mount Everest', 28.0, 86.9, 'mountain'], ['Kilimanjaro', -3.1, 37.4, 'mountain'], ['Mont Blanc', 45.8, 6.9, 'mountain'], ['Denali', 63.1, -151.0, 'mountain'], ['Aconcagua', -32.7, -70.0, 'mountain'],
  ['The Himalayas', 28.5, 84.0, 'mountain'], ['The Andes', -20.0, -68.0, 'mountain'], ['The Rocky Mountains', 45.0, -110.0, 'mountain'], ['The Alps', 46.5, 10.0, 'mountain'], ['The Urals', 60.0, 59.0, 'mountain'],
  ['Mouth of the Amazon', 0.0, -50.0, 'river'], ['Nile delta', 31.0, 31.0, 'river'], ['Mississippi delta', 29.2, -89.5, 'river'], ['Mouth of the Yangtze', 31.5, 121.5, 'river'], ['Ganges delta', 22.5, 89.5, 'river'],
  ['Mouth of the Congo', -6.0, 12.4, 'river'], ['Danube delta', 45.2, 29.6, 'river'], ['Lake Victoria', -1.0, 33.0, 'water'], ['Lake Baikal', 53.5, 108.0, 'water'], ['Great Barrier Reef', -18.0, 147.0, 'water'],
  ['Sahara Desert', 23.0, 13.0, 'region'], ['Gobi Desert', 43.0, 105.0, 'region'], ['Panama Canal', 9.1, -79.7, 'region'], ['Suez Canal', 30.5, 32.3, 'region'],
  ['Madagascar', -19.0, 47.0, 'country'], ['New Zealand', -42.0, 172.0, 'country'], ['Japan', 36.0, 138.0, 'country'], ['Italy', 42.5, 12.5, 'country'], ['Egypt', 26.0, 30.0, 'country'],
  ['Brazil', -10.0, -55.0, 'country'], ['Canada', 60.0, -100.0, 'country'], ['Australia', -25.0, 134.0, 'country'], ['India', 22.0, 78.0, 'country'], ['Greenland', 72.0, -40.0, 'country'],
  ['Alaska', 64.0, -150.0, 'country'], ['South Africa', -29.0, 25.0, 'country'], ['Saudi Arabia', 24.0, 45.0, 'country'], ['Indonesia', -2.0, 118.0, 'country'], ['Iceland', 65.0, -18.0, 'country'],
];
const ROUND = 10;
const W = 720, H = 360;
const proj = (lat, lon) => [(lon + 180) / 360 * W, (90 - lat) / 180 * H];
const unproj = (x, y) => [90 - y / H * 180, x / W * 360 - 180];
function haversine(lat1, lon1, lat2, lon2) { const R = 6371, r = Math.PI / 180; const dLat = (lat2 - lat1) * r, dLon = (lon2 - lon1) * r; const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(a)); }
const pointsFor = km => km <= 150 ? 100 : Math.max(0, Math.round(100 * (1 - (km - 150) / 3500)));

export default function (root) {
  const s = store('map-quiz');
  let best = s.get('best', 0), played = s.get('played', 0), filter = s.get('filter', 'all');
  let queue = [], target = null, score = 0, answered = false, results = [];

  const map = svg('svg', { viewBox: `0 0 ${W} ${H}`, style: 'width:100%;height:auto;display:block;background:var(--bg);border-radius:8px;cursor:crosshair;touch-action:manipulation' });
  const landG = svg('g'); const marks = svg('g');
  for (const ring of LAND) landG.append(svg('polygon', { points: ring.map(([lon, lat]) => proj(lat, lon).map(v => v.toFixed(1)).join(',')).join(' '), fill: 'var(--line)', stroke: 'var(--muted)', 'stroke-width': '0.8', 'stroke-linejoin': 'round' }));
  const grid = svg('g', { stroke: 'var(--line)', 'stroke-width': '0.5', 'stroke-dasharray': '2 3' });
  for (let lon = -150; lon < 180; lon += 30) { const [x] = proj(0, lon); grid.append(svg('line', { x1: x, y1: 0, x2: x, y2: H })); }
  for (let lat = -60; lat <= 60; lat += 30) { const [, y] = proj(lat, 0); grid.append(svg('line', { x1: 0, y1: y, x2: W, y2: y, 'stroke-dasharray': lat === 0 ? '0' : '2 3' })); }
  map.append(grid, landG, marks);
  const prompt = el('div', { class: 'big', style: { fontSize: '24px', minHeight: '40px' } });
  const feedback = el('div', { style: { minHeight: '44px' } });
  const stats = el('div', { class: 'row' });
  const table = el('div');

  function pool() { return filter === 'all' ? FEATURES : FEATURES.filter(f => f[3] === filter); }
  function updateStats() { render(stats, stat(score, 'score'), stat(results.length + '/' + Math.min(ROUND, pool().length), 'question'), stat(results.length ? Math.round(results.reduce((a, r) => a + r.km, 0) / results.length) + ' km' : '–', 'avg. error'), stat(best, 'best round')); }
  function next() {
    answered = false; render(marks);
    if (!queue.length) { target = null; render(prompt, 'Round over: ' + score + ' / ' + results.length * 100); if (score > best) { best = score; s.set('best', best); } played++; s.set('played', played); render(feedback, el('button', { class: 'btn primary', onclick: start }, 'Play again')); updateStats(); showTable(); return; }
    target = queue.shift(); render(prompt, 'Where is ', el('b', {}, target[0]), '?'); render(feedback, el('span', { class: 'muted small' }, 'Click the map')); updateStats();
  }
  function showTable() { render(table, results.length ? el('table', { class: 'table' }, el('thead', {}, el('tr', {}, el('th', {}, 'Feature'), el('th', {}, 'Error'), el('th', {}, 'Points'))), el('tbody', {}, results.map(r => el('tr', {}, el('td', {}, r.name), el('td', {}, r.km + ' km'), el('td', {}, r.pts))))) : ''); }
  map.addEventListener('click', e => {
    if (!target || answered) return; answered = true;
    const pt = map.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const p = pt.matrixTransform(map.getScreenCTM().inverse());
    const [lat, lon] = unproj(p.x, p.y); const km = Math.round(haversine(lat, lon, target[1], target[2])); const pts = pointsFor(km);
    score += pts; results.push({ name: target[0], km, pts });
    const [tx, ty] = proj(target[1], target[2]);
    marks.append(svg('line', { x1: p.x, y1: p.y, x2: tx, y2: ty, stroke: 'var(--danger)', 'stroke-width': '1.5', 'stroke-dasharray': '4 3' }),
      svg('circle', { cx: p.x, cy: p.y, r: 5, fill: 'none', stroke: 'var(--danger)', 'stroke-width': '2' }),
      svg('circle', { cx: tx, cy: ty, r: 5, fill: 'var(--ok)', stroke: 'var(--panel)', 'stroke-width': '1.5' }),
      svg('text', { x: tx + 8, y: ty + 4, 'font-size': '11', fill: 'var(--text)', style: 'font-family:system-ui,sans-serif;font-weight:600' }, target[0]));
    render(feedback, el('span', { style: { color: pts >= 70 ? 'var(--ok)' : pts > 0 ? 'var(--warn)' : 'var(--danger)', fontWeight: 600 } }, km + ' km away · +' + pts + ' points'), ' ', el('button', { class: 'btn small', onclick: next }, 'Next ›'));
    updateStats(); showTable();
  });
  function start() { queue = shuffle(pool()).slice(0, ROUND); score = 0; results = []; render(table); next(); }
  const filterSel = el('select', { class: 'select', onchange: () => { filter = filterSel.value; s.set('filter', filter); start(); } }, [['all', 'All features'], ['city', 'Cities'], ['country', 'Countries & regions'], ['mountain', 'Mountains'], ['river', 'Rivers'], ['water', 'Lakes & seas'], ['region', 'Deserts & canals']].map(([v, l]) => el('option', { value: v }, l)));
  filterSel.value = filter;
  const onKey = e => { if (e.key === 'Enter' && answered) next(); };
  window.addEventListener('keydown', onKey);
  render(root,
    el('div', { class: 'row' }, filterSel, el('button', { class: 'btn ghost', onclick: start }, 'New round'), prompt),
    map, feedback, stats, table,
    el('div', { class: 'muted small' }, 'Equirectangular map with simplified coastlines. Scoring: 100 points within 150 km of the target, dropping to 0 at about 3,650 km, measured with the haversine formula on a sphere of radius 6,371 km. Enter advances after an answer.'));
  start();
  return () => window.removeEventListener('keydown', onKey);
}
