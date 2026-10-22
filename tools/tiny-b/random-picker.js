import { el, render, store, copy, shuffle, loop } from '../../lib/ui.js';

export default function (root) {
  const s = store('random-picker');
  const ta = el('textarea', { class: 'textarea prose', placeholder: 'One name per line…', value: s.get('names', 'Alice\nBob\nCarol\nDave\nEve\nFrank'), style: { minHeight: '200px' } });
  const removeCb = el('input', { type: 'checkbox', checked: s.get('remove', false) });
  const canvas = el('canvas', { width: 440, height: 440, style: { maxWidth: '100%' } });
  const g = canvas.getContext('2d');
  const result = el('div', { class: 'big center', style: { minHeight: '1.3em' } });
  const spinBtn = el('button', { class: 'btn primary' }, 'Spin');
  const countLbl = el('span', { class: 'small muted' });
  const teamN = el('input', { class: 'input', type: 'number', min: 2, max: 50, value: s.get('teams', 2), style: { width: '80px' } });
  const teamsOut = el('div', { class: 'grid2' });
  const history = el('div', { class: 'small muted' });
  let rot = 0, stopAnim = null, picked = s.get('picked', []);

  const names = () => ta.value.split('\n').map(x => x.trim()).filter(Boolean);
  const themeColor = v => getComputedStyle(root).getPropertyValue(v).trim() || '#888';

  function draw() {
    const list = names(), n = list.length, W = canvas.width, c = W / 2, R = c - 12;
    g.clearRect(0, 0, W, W);
    if (!n) {
      g.fillStyle = themeColor('--muted'); g.font = '18px system-ui,sans-serif'; g.textAlign = 'center';
      g.fillText('Add some names', c, c); return;
    }
    const seg = Math.PI * 2 / n;
    for (let i = 0; i < n; i++) {
      const a0 = rot + i * seg;
      g.beginPath(); g.moveTo(c, c); g.arc(c, c, R, a0, a0 + seg); g.closePath();
      g.fillStyle = `hsl(${(i * 360 / n * 1.0 + (i % 2) * 20) % 360} 65% 50%)`;
      g.fill(); g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1; g.stroke();
      if (n <= 80) {
        g.save(); g.translate(c, c); g.rotate(a0 + seg / 2);
        g.textAlign = 'right'; g.textBaseline = 'middle';
        const fs = Math.max(9, Math.min(20, R * seg * 0.45));
        g.font = `600 ${fs}px system-ui,sans-serif`;
        g.fillStyle = '#fff'; g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 3;
        let label = list[i]; const maxW = R - 36;
        while (g.measureText(label).width > maxW && label.length > 1) label = label.slice(0, -1);
        if (label !== list[i]) label += '…';
        g.fillText(label, R - 14, 0);
        g.restore();
      }
    }
    g.beginPath(); g.arc(c, c, 18, 0, Math.PI * 2); g.fillStyle = themeColor('--panel'); g.fill();
    g.strokeStyle = themeColor('--line'); g.lineWidth = 2; g.stroke();
    // pointer at the top
    g.beginPath(); g.moveTo(c - 14, 2); g.lineTo(c + 14, 2); g.lineTo(c, 34); g.closePath();
    g.fillStyle = themeColor('--text'); g.fill();
  }
  function winnerIndex(n) {
    const seg = Math.PI * 2 / n;
    let a = (-Math.PI / 2 - rot) % (Math.PI * 2);
    if (a < 0) a += Math.PI * 2;
    return Math.min(n - 1, Math.floor(a / seg));
  }
  function save() { s.set('names', ta.value); s.set('remove', removeCb.checked); s.set('teams', Number(teamN.value)); s.set('picked', picked); }
  function updCount() { countLbl.textContent = names().length + ' names'; }
  function showHistory() { render(history, picked.length ? 'Picked so far: ' + picked.join(', ') : ''); }

  function spin() {
    const list = names();
    if (!list.length || stopAnim) { if (!list.length) render(result, 'Add some names first'); return; }
    spinBtn.disabled = true; result.textContent = '…';
    const start = rot, total = (6 + Math.random() * 4) * Math.PI * 2 + Math.random() * Math.PI * 2, dur = 4.2;
    let t = 0;
    stopAnim = loop(dt => {
      t += dt;
      const p = Math.min(1, t / dur), e = 1 - Math.pow(1 - p, 4);
      rot = start + total * e; draw();
      if (p >= 1) {
        stopAnim(); stopAnim = null; spinBtn.disabled = false;
        const cur = names(), idx = winnerIndex(cur.length), w = cur[idx];
        result.textContent = w;
        picked.push(w);
        if (removeCb.checked) {
          const lines = ta.value.split('\n'); let seen = -1;
          ta.value = lines.filter(l => { if (!l.trim()) return true; seen++; return seen !== idx; }).join('\n');
          draw(); updCount();
        }
        save(); showHistory();
      }
    });
  }
  function makeTeams() {
    const list = names(); const n = Math.max(2, Math.min(50, parseInt(teamN.value) || 2));
    if (!list.length) { render(teamsOut, el('div', { class: 'muted' }, 'Add some names first')); return; }
    const teams = Array.from({ length: n }, () => []);
    shuffle(list).forEach((x, i) => teams[i % n].push(x));
    render(teamsOut, teams.map((t, i) => el('div', { class: 'panel' },
      el('strong', {}, 'Team ' + (i + 1)), el('span', { class: 'muted' }, ' (' + t.length + ')'),
      el('ul', { style: { margin: '6px 0 0', paddingLeft: '20px' } }, t.map(x => el('li', {}, x))))));
    teamsOut._text = teams.map((t, i) => `Team ${i + 1}: ${t.join(', ')}`).join('\n');
    save();
  }

  ta.addEventListener('input', () => { save(); updCount(); if (!stopAnim) draw(); });
  removeCb.addEventListener('change', save);
  teamN.addEventListener('change', save);
  spinBtn.addEventListener('click', spin);
  canvas.addEventListener('click', spin);
  canvas.style.cursor = 'pointer';

  render(root,
    el('div', { class: 'grid2' },
      el('div', { class: 'col' },
        el('label', { class: 'field' }, 'Names (one per line)', ta),
        el('div', { class: 'row' }, countLbl,
          el('button', { class: 'btn small', onclick: () => { ta.value = shuffle(names()).join('\n'); save(); draw(); } }, 'Shuffle list'),
          el('button', { class: 'btn small ghost', onclick: () => { ta.value = ''; picked = []; save(); updCount(); draw(); showHistory(); result.textContent = ''; } }, 'Clear'))),
      el('div', { class: 'col' },
        el('div', { class: 'canvas-wrap' }, canvas),
        result,
        el('div', { class: 'row', style: { justifyContent: 'center' } }, spinBtn,
          el('label', { class: 'inline' }, removeCb, 'Remove picked name'),
          el('button', { class: 'btn small ghost', onclick: () => { picked = []; save(); showHistory(); } }, 'Clear history')),
        history)),
    el('h3', {}, 'Split into teams'),
    el('div', { class: 'row' },
      el('label', { class: 'inline' }, 'Number of teams', teamN),
      el('button', { class: 'btn primary', onclick: makeTeams }, 'Make teams'),
      el('button', { class: 'btn', onclick: () => teamsOut._text && copy(teamsOut._text) }, 'Copy teams')),
    teamsOut);
  updCount(); draw(); showHistory();

  return () => { if (stopAnim) stopAnim(); stopAnim = null; };
}
