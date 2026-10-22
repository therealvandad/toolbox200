import { el, render, store, pad } from '../../lib/ui.js';
import { audio } from './_fx.js';

export default function (root) {
  const s = store('fake-call');
  const A = audio();
  let timer = null, ringTimer = null, countTimer = null, callTimer = null, overlay = null, secs = 0;

  const name = el('input', { class: 'input', value: s.get('name', 'Mom'), maxlength: 40 });
  const number = el('input', { class: 'input', value: s.get('number', '+1 555 010 1234'), maxlength: 30 });
  const delay = el('input', { class: 'input', type: 'number', min: 0, max: 3600, value: s.get('delay', 10), style: { width: '90px' } });
  const status = el('div', { class: 'muted', style: { minHeight: '1.5em' } });
  const startBtn = el('button', { class: 'btn primary', onclick: schedule }, 'Start timer');
  const cancelBtn = el('button', { class: 'btn', onclick: () => cancel(), disabled: true }, 'Cancel');

  render(root,
    el('div', { class: 'row' },
      el('label', { class: 'field grow' }, 'Caller name', name),
      el('label', { class: 'field grow' }, 'Number', number),
      el('label', { class: 'field' }, 'Delay (seconds)', delay)),
    el('div', { class: 'row' }, startBtn, cancelBtn, el('button', { class: 'btn ghost', onclick: () => { save(); A.ctx(); ring(); } }, 'Ring now')),
    status,
    el('p', { class: 'small muted' }, 'Tip: tap "Start timer", put your phone down and wait. Keep this tab open for the sound. Vibration works on phones that support it.'));

  function save() { s.set('name', name.value); s.set('number', number.value); s.set('delay', +delay.value || 0); }

  function schedule() {
    save(); A.ctx(); // unlock audio inside the click
    cancel(true);
    const left = Math.max(0, Math.round(+delay.value || 0));
    startBtn.disabled = true; cancelBtn.disabled = false;
    const t0 = Date.now() + left * 1000;
    const upd = () => { const r = Math.max(0, Math.ceil((t0 - Date.now()) / 1000)); status.textContent = 'Incoming call in ' + r + 's...'; };
    upd(); countTimer = setInterval(upd, 250);
    timer = setTimeout(() => { clearInterval(countTimer); ring(); }, left * 1000);
  }
  function cancel(quiet) {
    clearTimeout(timer); clearInterval(countTimer); timer = null;
    startBtn.disabled = false; cancelBtn.disabled = true;
    if (quiet !== true) status.textContent = 'Cancelled.';
  }

  function ringOnce() {
    for (let i = 0; i < 2; i++) {
      const at = i * 0.45;
      A.tone(440, 0.35, { type: 'sine', vol: 0.18, at });
      A.tone(480, 0.35, { type: 'sine', vol: 0.18, at });
      A.tone(880, 0.35, { type: 'triangle', vol: 0.05, at });
    }
    try { navigator.vibrate && navigator.vibrate([400, 200, 400]); } catch {}
  }

  function ring() {
    startBtn.disabled = false; cancelBtn.disabled = true; status.textContent = '';
    closeOverlay();
    const nm = name.value || 'Unknown', num = number.value;
    const initial = (nm.trim()[0] || '?').toUpperCase();
    const pulse = el('div', { style: { width: '120px', height: '120px', borderRadius: '50%', background: '#4a5568', color: '#fff', fontSize: '54px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', animation: 'fc-pulse 1.4s infinite' } }, initial);
    const state = el('div', { style: { opacity: 0.7, fontSize: '16px', marginTop: '8px' } }, 'mobile');
    const btnStyle = c => ({ width: '72px', height: '72px', borderRadius: '50%', border: '0', background: c, color: '#fff', fontSize: '28px', cursor: 'pointer' });
    const decline = el('button', { style: btnStyle('#e53e3e'), 'aria-label': 'Decline', onclick: end }, '✕');
    const answer = el('button', { style: btnStyle('#38a169'), 'aria-label': 'Answer', onclick: pick }, '☎');
    const actions = el('div', { style: { display: 'flex', justifyContent: 'space-around', width: '100%', maxWidth: '320px', margin: '0 auto' } },
      el('div', { style: { textAlign: 'center' } }, decline, el('div', { style: { fontSize: '13px', marginTop: '6px' } }, 'Decline')),
      el('div', { style: { textAlign: 'center' } }, answer, el('div', { style: { fontSize: '13px', marginTop: '6px' } }, 'Answer')));
    const css = el('style', {}, '@keyframes fc-pulse{0%{box-shadow:0 0 0 0 rgba(255,255,255,.45)}100%{box-shadow:0 0 0 40px rgba(255,255,255,0)}}');
    overlay = el('div', { style: { position: 'fixed', inset: '0', zIndex: 1000, background: 'linear-gradient(#1a202c,#2d3748)', color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '12vh 20px 10vh', textAlign: 'center' } },
      css,
      el('div', {}, el('div', { style: { opacity: 0.7 } }, 'Incoming call'), el('div', { style: { fontSize: '38px', fontWeight: 600, margin: '8px 0 4px' } }, nm), el('div', { style: { opacity: 0.8 } }, num), state),
      pulse, actions);
    document.body.append(overlay);
    ringOnce(); ringTimer = setInterval(ringOnce, 2200);

    function pick() {
      clearInterval(ringTimer); ringTimer = null;
      try { navigator.vibrate && navigator.vibrate(0); } catch {}
      secs = 0;
      pulse.style.animation = 'none';
      render(actions, el('div', { style: { textAlign: 'center' } }, el('button', { style: btnStyle('#e53e3e'), onclick: end, 'aria-label': 'End call' }, '✕'), el('div', { style: { fontSize: '13px', marginTop: '6px' } }, 'End call')));
      state.style.fontSize = '24px'; state.textContent = '00:00';
      callTimer = setInterval(() => { secs++; state.textContent = pad(Math.floor(secs / 60)) + ':' + pad(secs % 60); }, 1000);
    }
    function end() {
      const was = secs;
      closeOverlay();
      status.textContent = was ? 'Call ended after ' + pad(Math.floor(was / 60)) + ':' + pad(was % 60) + '.' : 'Call declined.';
      secs = 0;
    }
  }
  function closeOverlay() {
    clearInterval(ringTimer); clearInterval(callTimer); ringTimer = callTimer = null;
    try { navigator.vibrate && navigator.vibrate(0); } catch {}
    if (overlay) { overlay.remove(); overlay = null; }
  }
  return () => { cancel(true); closeOverlay(); A.close(); };
}
