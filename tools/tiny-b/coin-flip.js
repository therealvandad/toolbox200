import { el, render, store, stat, loop } from '../../lib/ui.js';

export default function (root) {
  const s = store('coin-flip');
  let st = s.get('state', { heads: 0, tails: 0, cur: null, curLen: 0, best: null, bestLen: 0 });
  let stopAnim = null;

  const coin = el('div', {
    style: {
      width: '140px', height: '140px', borderRadius: '50%', margin: '0 auto',
      background: 'radial-gradient(circle at 35% 30%, #ffe9a0, #e0a826 70%, #b07d12)', border: '4px solid #b07d12',
      color: '#5a3d00', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '64px', fontWeight: '800',
      boxShadow: '0 6px 14px rgba(0,0,0,.3)', userSelect: 'none', cursor: 'pointer',
    },
  }, 'H');
  const shadow = el('div', { style: { width: '100px', height: '10px', margin: '14px auto 0', borderRadius: '50%', background: 'rgba(0,0,0,.2)' } });
  const stage = el('div', { style: { height: '230px', paddingTop: '50px' } }, coin, shadow);
  const verdict = el('div', { class: 'big center', style: { minHeight: '1.3em' } });
  const seq = el('div', { class: 'mono small', style: { wordBreak: 'break-all' } });
  const stats = el('div', { class: 'row' });
  const flipBtn = el('button', { class: 'btn primary' }, 'Flip');
  const nIn = el('input', { class: 'input', type: 'number', min: 1, max: 10000, value: s.get('n', 10), style: { width: '90px' } });
  const flipN = el('button', { class: 'btn' }, 'Flip N times');

  function showStats() {
    const tot = st.heads + st.tails;
    const pct = k => tot ? ' (' + Math.round(st[k] / tot * 100) + '%)' : '';
    const nm = x => x === 'H' ? 'heads' : x === 'T' ? 'tails' : '-';
    render(stats,
      stat(st.heads + pct('heads'), 'heads'), stat(st.tails + pct('tails'), 'tails'), stat(tot, 'total flips'),
      stat(st.curLen ? `${st.curLen} ${nm(st.cur)}` : '-', 'current streak'),
      stat(st.bestLen ? `${st.bestLen} ${nm(st.best)}` : '-', 'longest streak'));
  }
  function record(face) {
    if (face === 'H') st.heads++; else st.tails++;
    if (st.cur === face) st.curLen++; else { st.cur = face; st.curLen = 1; }
    if (st.curLen > st.bestLen) { st.bestLen = st.curLen; st.best = face; }
  }
  function randFace() {
    if (window.crypto && crypto.getRandomValues) { const a = new Uint8Array(1); crypto.getRandomValues(a); return a[0] & 1 ? 'H' : 'T'; }
    return Math.random() < .5 ? 'H' : 'T';
  }
  function flip(n) {
    if (stopAnim) return;
    n = Math.max(1, Math.min(10000, n | 0));
    const faces = Array.from({ length: n }, randFace);
    const last = faces[faces.length - 1];
    flipBtn.disabled = flipN.disabled = true;
    verdict.textContent = '';
    const dur = 1.0, spins = 3 + Math.floor(Math.random() * 3);
    // animate flipping towards the final face of the last flip
    const startFace = coin.textContent;
    const totalHalfTurns = spins * 2 + (startFace === last ? 0 : 1);
    let t = 0;
    stopAnim = loop(dt => {
      t += dt;
      const p = Math.min(1, t / dur), e = 1 - Math.pow(1 - p, 2);
      const turns = totalHalfTurns * e;               // number of half turns done
      const k = Math.floor(turns + 0.5), frac = turns - k;   // frac in [-0.5, 0.5): face swaps when the coin is edge-on
      const face = k % 2 === 0 ? startFace : (startFace === 'H' ? 'T' : 'H');
      coin.textContent = face;
      coin.style.transform = `translateY(${-Math.sin(p * Math.PI) * 60}px) scaleY(${Math.max(0.05, Math.abs(Math.cos(frac * Math.PI / 1)))})`;
      shadow.style.transform = `scaleX(${1 - Math.sin(p * Math.PI) * 0.4})`;
      if (p >= 1) {
        stopAnim(); stopAnim = null;
        coin.textContent = last; coin.style.transform = ''; shadow.style.transform = '';
        flipBtn.disabled = flipN.disabled = false;
        faces.forEach(record);
        verdict.textContent = n === 1 ? (last === 'H' ? 'Heads' : 'Tails') : `${faces.filter(f => f === 'H').length} heads, ${faces.filter(f => f === 'T').length} tails`;
        seq.textContent = n === 1 ? '' : faces.slice(0, 300).join(' ') + (n > 300 ? ' …' : '');
        s.set('state', st); showStats();
      }
    });
  }

  flipBtn.addEventListener('click', () => flip(1));
  coin.addEventListener('click', () => flip(1));
  flipN.addEventListener('click', () => { s.set('n', Number(nIn.value)); flip(parseInt(nIn.value) || 1); });
  nIn.addEventListener('keydown', e => { if (e.key === 'Enter') flipN.click(); });

  render(root,
    stage, verdict,
    el('div', { class: 'row', style: { justifyContent: 'center' } }, flipBtn,
      el('label', { class: 'inline' }, nIn, 'flips'), flipN),
    seq, stats,
    el('div', { class: 'row' }, el('button', { class: 'btn ghost', onclick: () => {
      st = { heads: 0, tails: 0, cur: null, curLen: 0, best: null, bestLen: 0 }; s.set('state', st); seq.textContent = ''; verdict.textContent = ''; showStats();
    } }, 'Reset tally')));
  showStats();

  return () => { if (stopAnim) stopAnim(); stopAnim = null; };
}
