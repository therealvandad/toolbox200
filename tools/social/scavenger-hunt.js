// Scavenger hunt builder: clues with answer + hint, one QR per clue that encodes the NEXT clue, play mode, printable sheet.
import { el, render, store, download, field, uid, toast } from '../../lib/ui.js';
import { h3, esc } from './_share.js';
import { qrCanvas, qrSvg, utf8, QR_MAX_BYTES } from './_qr.js';

const norm = t => String(t || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const matches = (guess, answer) => { const g = norm(guess); return !!g && String(answer).split('|').some(a => norm(a) === g); };

export default function (root) {
  const s = store('scavenger-hunt');
  const st = s.get('state', { title: 'Treasure hunt', finish: 'You found the treasure! Congratulations!', clues: [{ id: uid(), text: 'Start here: I have keys but open no locks. Where am I?', answer: 'piano|keyboard', hint: 'You can play me.' }] });
  const save = () => s.set('state', st);
  let mode = 'build', step = s.get('step', 0), hintShown = false, msg = '', msgOk = false;
  const body = el('div');

  // text a QR at clue i reveals (the next clue, or the finish message)
  const qrText = i => i + 1 < st.clues.length ? `Clue ${i + 2}: ${st.clues[i + 1].text}` : st.finish;
  const bytes = t => utf8(t).length;

  function addClue() { st.clues.push({ id: uid(), text: '', answer: '', hint: '' }); save(); drawBuild(); }
  function move(i, d) { const j = i + d; if (j < 0 || j >= st.clues.length) return; [st.clues[i], st.clues[j]] = [st.clues[j], st.clues[i]]; save(); drawBuild(); }

  function qrNode(text, px = 4) {
    try { const c = qrCanvas(text, px); c.style.imageRendering = 'pixelated'; return c; }
    catch (e) { return el('div', { class: 'badge danger' }, e.message); }
  }

  function drawBuild() {
    const items = st.clues.map((c, i) => {
      const nt = qrText(i), over = bytes(nt) > QR_MAX_BYTES;
      return el('div', { class: 'panel', style: { margin: '8px 0' } },
        el('div', { class: 'row', style: { margin: '0 0 6px' } }, el('b', {}, 'Clue ' + (i + 1)), el('span', { class: 'grow' }),
          el('button', { class: 'btn small ghost', onclick: () => move(i, -1) }, '↑'), el('button', { class: 'btn small ghost', onclick: () => move(i, 1) }, '↓'),
          el('button', { class: 'btn small ghost', onclick: () => { st.clues = st.clues.filter(x => x !== c); save(); drawBuild(); } }, 'Delete')),
        el('div', { class: 'row', style: { alignItems: 'flex-start', flexWrap: 'nowrap' } },
          el('div', { class: 'col grow' },
            field('Clue text (shown to players)', el('textarea', { class: 'textarea prose', style: { minHeight: '56px' }, value: c.text, oninput: e => { c.text = e.target.value; save(); drawQrs(); } })),
            el('div', { class: 'grid2' },
              field('Answer (use | for alternatives; this is also where clue ' + (i + 2) + ' is hidden)', el('input', { class: 'input', value: c.answer, oninput: e => { c.answer = e.target.value; save(); } })),
              field('Hint', el('input', { class: 'input', value: c.hint, oninput: e => { c.hint = e.target.value; save(); } })))),
          el('div', { class: 'col', style: { alignItems: 'center', flex: 'none' } }, el('div', { 'data-qr': i }, qrNode(nt, 3)),
            el('div', { class: 'small ' + (over ? '' : 'muted'), style: over ? { color: 'var(--danger)' } : {} }, `${bytes(nt)}/${QR_MAX_BYTES} bytes`),
            el('div', { class: 'small muted' }, i + 1 < st.clues.length ? 'QR reveals clue ' + (i + 2) : 'QR reveals finish'))));
    });
    render(body,
      el('div', { class: 'muted small' }, 'Local tool: the hunt is saved in this browser. Print the sheet (or download it) and hide each QR at the place named by that clue\'s answer. Scanning it shows the NEXT clue.'),
      el('div', { class: 'grid2' }, field('Hunt title', el('input', { class: 'input', value: st.title, oninput: e => { st.title = e.target.value; save(); } })),
        field('Finish message (QR on the last clue)', el('input', { class: 'input', value: st.finish, oninput: e => { st.finish = e.target.value; save(); drawQrs(); } }))),
      items,
      el('div', { class: 'row' }, el('button', { class: 'btn primary', onclick: addClue }, 'Add clue'),
        el('button', { class: 'btn', onclick: () => printable(false) }, 'Download printable sheet'),
        el('button', { class: 'btn', onclick: () => printable(true) }, 'Open print view')));
  }
  // re-render only the QRs while typing so inputs keep focus
  function drawQrs() {
    st.clues.forEach((_, i) => {
      const host = body.querySelector(`[data-qr="${i}"]`); if (!host) return;
      const nt = qrText(i); render(host, qrNode(nt, 3));
      const lab = host.nextSibling; if (lab) { const over = bytes(nt) > QR_MAX_BYTES; lab.textContent = `${bytes(nt)}/${QR_MAX_BYTES} bytes`; lab.style.color = over ? 'var(--danger)' : ''; }
    });
  }

  function printable(openNow) {
    const bad = st.clues.findIndex((_, i) => bytes(qrText(i)) > QR_MAX_BYTES);
    if (bad >= 0) { toast('Clue text is too long for a QR code (clue ' + (bad + 1) + ')'); return; }
    if (!st.clues.length) { toast('Add a clue first'); return; }
    const first = st.clues[0];
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(st.title)}</title><style>
body{font-family:system-ui,sans-serif;margin:24px;color:#111}h1{margin:0 0 4px}.sub{color:#555;margin-bottom:18px}
.card{display:flex;gap:16px;align-items:center;border:2px dashed #888;border-radius:10px;padding:12px;margin:10px 0;break-inside:avoid}.card svg{flex:none;width:170px;height:170px}
.start{border-style:solid;background:#f3f3f3}.k{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#666}</style></head><body>
<h1>${esc(st.title)}</h1><div class="sub">Organizer sheet. Cut out each card and hide it where the answer says. Players scan the QR to read the next clue.</div>
<div class="card start"><div><div class="k">Give players this first clue (no QR)</div><div style="font-size:20px"><b>Clue 1:</b> ${esc(first.text)}</div></div></div>
${st.clues.map((c, i) => `<div class="card">${qrSvg(qrText(i), 3)}<div><div class="k">Hide this card at: ${esc(c.answer.split('|')[0] || '(set an answer)')}</div><div><b>Solves clue ${i + 1}:</b> ${esc(c.text)}</div><div class="k" style="margin-top:6px">Reveals: ${i + 1 < st.clues.length ? 'Clue ' + (i + 2) : 'finish message'}${c.hint ? ' &middot; Hint: ' + esc(c.hint) : ''}</div></div></div>`).join('')}
${openNow ? '<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script>' : ''}</body></html>`;
    if (!openNow) { download('scavenger-hunt-sheet.html', html, 'text/html'); return; }
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const w = window.open(url, '_blank'); if (!w) toast('Pop-up blocked: use Download printable sheet instead');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  // ---------- play ----------
  const guessIn = el('input', { class: 'input grow', placeholder: 'Your answer (Enter)', onkeydown: e => { if (e.key === 'Enter') check(); } });
  function check() {
    const c = st.clues[step]; if (!c) return;
    if (matches(guessIn.value, c.answer)) { step++; s.set('step', step); hintShown = false; msg = step >= st.clues.length ? '' : 'Correct!'; msgOk = true; guessIn.value = ''; }
    else { msg = 'Not quite. Try again.'; msgOk = false; }
    drawPlay();
  }
  function drawPlay() {
    if (!st.clues.length) { render(body, el('div', { class: 'muted' }, 'Add clues in Build mode first.')); return; }
    if (step >= st.clues.length) {
      render(body, el('div', { class: 'panel center', style: { padding: '30px' } }, el('div', { class: 'huge' }, '🎉'), el('div', { class: 'big' }, st.finish),
        el('div', { class: 'row', style: { justifyContent: 'center' } }, el('button', { class: 'btn', onclick: () => { step = 0; s.set('step', 0); msg = ''; drawPlay(); } }, 'Play again')))); return;
    }
    const c = st.clues[step];
    render(body,
      el('div', { class: 'row' }, el('span', { class: 'badge' }, `Clue ${step + 1} of ${st.clues.length}`), el('div', { class: 'bar grow' }, el('div', { style: { width: (step / st.clues.length * 100) + '%' } }))),
      el('div', { class: 'panel', style: { fontSize: '20px', padding: '20px' } }, c.text || '(this clue is empty)'),
      el('div', { class: 'row' }, guessIn, el('button', { class: 'btn primary', onclick: check }, 'Check')),
      msg ? el('div', { class: 'badge ' + (msgOk ? 'ok' : 'danger') }, msg) : null,
      el('div', { class: 'row' }, el('button', { class: 'btn small', disabled: !c.hint, onclick: () => { hintShown = !hintShown; drawPlay(); } }, hintShown ? 'Hide hint' : c.hint ? 'Show hint' : 'No hint'),
        el('button', { class: 'btn small ghost', onclick: () => { step = Math.max(0, step - 1); s.set('step', step); msg = ''; hintShown = false; drawPlay(); } }, 'Previous clue')),
      hintShown && c.hint ? el('div', { class: 'muted' }, '💡 ' + c.hint) : null);
    guessIn.focus();
  }

  const modeBtns = el('div', { class: 'row' });
  function setMode(m) {
    mode = m; if (step > st.clues.length) step = 0; msg = '';
    render(modeBtns, ['build', 'play'].map(x => el('button', { class: 'btn' + (mode === x ? ' primary' : ''), onclick: () => setMode(x) }, x === 'build' ? 'Build' : 'Play mode')));
    mode === 'build' ? drawBuild() : drawPlay();
  }
  render(root, modeBtns, body);
  setMode('build');
}
