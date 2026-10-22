import { el, render, store, loop, rng } from '../../lib/ui.js';

const HOUR = 3600e3;
const THOUGHTS = {
  happy: ['I am so grounded right now.', 'Life is solid. Life is good.', 'I have been sitting here thinking about nothing, and it was great.', 'You are my favourite human. The others are fine too.', 'Someday I will be a mountain. Not today though.', 'Geology rocks.', 'I feel metamorphic today.', 'Nothing has happened and I loved every minute.'],
  ok: ['I wonder what the pebbles are up to.', 'Is it lunch yet? I do not eat lunch. But still.', 'I have been here for a long time. Millions of years, probably.', 'Is that a cloud or a very slow bird?', 'I am not lazy. I am stable.', 'I contain multitudes, mostly quartz.'],
  hungry: ['A tiny pebble would be nice right now.', 'I am running low on minerals.', 'Is anyone going to feed me? Asking for a rock.', 'My stomach is... wait, do I have a stomach?'],
  lonely: ['It has been quiet. Very quiet.', 'Hello? Is anyone there? I cannot go anywhere, I am a rock.', 'I miss your voice. Say anything.', 'I have been staring at the same spot for hours. Please pet me.'],
  sad: ['I am feeling a little eroded.', 'Rock bottom. Literally.', 'Please come back.', 'It is fine. I am fine. I am a rock.'],
};
const TALK_REPLIES = ['Mmm. Yes. Rocks agree.', 'That is deep. Like sediment.', 'I hear you. I have no ears, but I hear you.', 'Tell me more. I am not going anywhere.', 'Interesting. I will think about it for a few centuries.', 'You always know what to say.', '...', 'Wise words. I would nod if I had a neck.'];

export default function (root) {
  const s = store('pet-rock');
  let st = s.get('rock', null);
  const now0 = Date.now();
  let timers = [];

  function decay(r, t) {
    const h = Math.max(0, (t - r.t) / HOUR);
    r.food = Math.max(0, r.food - h * 6);       // empty in about 17h
    r.love = Math.max(0, r.love - h * 4.2);     // empty in about 24h
    r.t = t; return r;
  }
  const away = st ? (now0 - st.t) : 0;
  if (st) decay(st, now0);


  function showName() {
    render(root, el('div', { class: 'center', style: { padding: '30px 10px' } },
      el('div', { class: 'big' }, 'Adopt a pet rock'),
      el('p', { class: 'muted' }, 'Low maintenance. High loyalty. Gives you its full attention (it cannot look away).'),
      nameIn, el('div', { class: 'row', style: { justifyContent: 'center' } }, el('button', { class: 'btn primary', onclick: adopt }, 'Adopt'))));
    nameIn.focus();
  }
  const nameIn = el('input', { class: 'input', placeholder: 'Name your rock', maxlength: 24, onkeydown: e => e.key === 'Enter' && adopt() });
  function adopt() {
    const name = nameIn.value.trim() || 'Rocky';
    st = { name, born: Date.now(), t: Date.now(), food: 70, love: 70, fed: 0, petted: 0, talked: 0, seed: Math.floor(Math.random() * 1e9) };
    save(); mount();
  }
  function save() { st.t = Date.now(); s.set('rock', st); }

  // ---- main view
  const canvas = el('canvas', { width: 420, height: 340, style: { width: '100%', maxWidth: '420px' } });
  const cx = canvas.getContext('2d');
  const bubble = el('div', { class: 'panel center', style: { minHeight: '3em', maxWidth: '420px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontStyle: 'italic' } });
  const bars = {};
  const barRow = (key, label) => {
    const fill = el('div', { style: { width: '0%', transition: 'width .4s' } });
    bars[key] = { fill, val: el('span', { class: 'small muted' }) };
    return el('div', { style: { flex: '1 1 160px' } }, el('div', { class: 'small' }, label, ' ', bars[key].val), el('div', { class: 'bar' }, fill));
  };
  const info = el('div', { class: 'small muted center' });

  let wobble = 0, blink = 0, nextBlink = 2, hearts = [], crumbs = [], eat = 0, listen = 0, bubbleTimer = null;

  function mood() {
    const a = (st.food + st.love) / 2;
    if (st.food < 18 && st.food <= st.love) return 'hungry';
    if (st.love < 18) return 'lonely';
    if (a < 12) return 'sad';
    return a > 65 ? 'happy' : 'ok';
  }
  const MOOD_LABEL = { happy: 'Happy', ok: 'Content', hungry: 'Hungry', lonely: 'Lonely', sad: 'Gloomy' };

  function rockPath(c, w, h, seed) {
    const r = rng(seed), n = 12, pts = [];
    for (let i = 0; i < n; i++) { const a = i / n * 6.28; pts.push([Math.cos(a) * w * (0.9 + r() * 0.12), Math.sin(a) * h * (0.88 + r() * 0.14)]); }
    c.beginPath();
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
      if (i === 0) c.moveTo(mx, my);
      const nx = pts[(i + 1) % n], nn = pts[(i + 2) % n];
      c.quadraticCurveTo(nx[0], nx[1], (nx[0] + nn[0]) / 2, (nx[1] + nn[1]) / 2);
    }
    c.closePath();
  }

  function frame(dt, t) {
    const m = mood();
    wobble *= Math.pow(0.02, dt); eat = Math.max(0, eat - dt); listen = Math.max(0, listen - dt);
    nextBlink -= dt; if (nextBlink < 0) { blink = 0.15; nextBlink = 2 + Math.random() * 3; } blink = Math.max(0, blink - dt);
    cx.clearRect(0, 0, 420, 340);
    // ground shadow
    cx.fillStyle = 'rgba(0,0,0,.15)'; cx.beginPath(); cx.ellipse(210, 296, 130, 18, 0, 0, 6.28); cx.fill();
    const bob = Math.sin(t / 700) * (m === 'happy' ? 3 : 1);
    const sq = 1 + Math.sin(t / 90) * wobble * 0.05 + (eat > 0 ? Math.sin(t / 60) * 0.03 : 0);
    cx.save(); cx.translate(210, 195 + bob); cx.rotate(Math.sin(t / 80) * wobble * 0.08); cx.scale(1 / sq, sq);
    const g = cx.createRadialGradient(-40, -60, 20, 0, 0, 150);
    const sad = m === 'sad' || m === 'lonely';
    g.addColorStop(0, sad ? '#9aa0a8' : '#b9b5ad'); g.addColorStop(1, sad ? '#4f545b' : '#6b665e');
    rockPath(cx, 125, 95, st.seed); cx.fillStyle = g; cx.fill(); cx.strokeStyle = 'rgba(0,0,0,.35)'; cx.lineWidth = 3; cx.stroke();
    // speckles
    const r = rng(st.seed + 7); cx.fillStyle = 'rgba(0,0,0,.14)';
    for (let i = 0; i < 18; i++) { cx.beginPath(); cx.arc((r() - 0.5) * 200, (r() - 0.5) * 140, 1.5 + r() * 3, 0, 6.28); cx.fill(); }
    // face
    cx.strokeStyle = '#1d1d1d'; cx.fillStyle = '#1d1d1d'; cx.lineWidth = 5; cx.lineCap = 'round';
    const ey = -12, ex = 38;
    const closed = blink > 0;
    for (const sgn of [-1, 1]) {
      const x = sgn * ex;
      cx.beginPath();
      if (eat > 0 || (m === 'happy' && Math.sin(t / 2000) > 0.6)) { cx.arc(x, ey + 5, 11, Math.PI * 1.1, Math.PI * 1.9); cx.stroke(); }
      else if (closed) { cx.moveTo(x - 10, ey); cx.lineTo(x + 10, ey); cx.stroke(); }
      else {
        cx.fillStyle = '#fff'; cx.arc(x, ey, 13, 0, 6.28); cx.fill(); cx.lineWidth = 2.5; cx.stroke();
        cx.fillStyle = '#1d1d1d'; cx.beginPath(); cx.arc(x + (listen > 0 ? 0 : Math.sin(t / 1500) * 3), ey + (sad ? 3 : 0), 6, 0, 6.28); cx.fill(); cx.lineWidth = 5;
      }
      if (m === 'hungry' || sad) { cx.beginPath(); cx.moveTo(x - 14, ey - 22 + (sgn * 4)); cx.lineTo(x + 14, ey - 22 - (sgn * 4)); cx.stroke(); }
    }
    cx.beginPath();
    if (eat > 0) { cx.ellipse(0, 36, 10, 6 + Math.sin(t / 50) * 4, 0, 0, 6.28); cx.fill(); }
    else if (m === 'happy') { cx.arc(0, 18, 24, 0.15 * Math.PI, 0.85 * Math.PI); cx.stroke(); }
    else if (m === 'ok') { cx.moveTo(-16, 38); cx.quadraticCurveTo(0, 44, 16, 38); cx.stroke(); }
    else if (m === 'hungry') { cx.ellipse(0, 40, 9, 11, 0, 0, 6.28); cx.stroke(); }
    else { cx.arc(0, 56, 22, 1.15 * Math.PI, 1.85 * Math.PI); cx.stroke(); }
    // blush when happy
    if (m === 'happy') { cx.fillStyle = 'rgba(255,120,120,.35)'; for (const sgn of [-1, 1]) { cx.beginPath(); cx.ellipse(sgn * 66, 20, 14, 8, 0, 0, 6.28); cx.fill(); } }
    cx.restore();
    // hearts / crumbs
    hearts = hearts.filter(h => (h.life -= dt) > 0);
    for (const h of hearts) { h.y -= 40 * dt; h.x += Math.sin(h.life * 5 + h.ph) * 20 * dt; cx.globalAlpha = Math.min(1, h.life); cx.font = '26px sans-serif'; cx.textAlign = 'center'; cx.fillText('❤️', h.x, h.y); }
    cx.globalAlpha = 1;
    crumbs = crumbs.filter(c => (c.life -= dt) > 0);
    for (const c of crumbs) { c.vy += 400 * dt; c.x += c.vx * dt; c.y += c.vy * dt; cx.fillStyle = '#8a7a5c'; cx.beginPath(); cx.arc(c.x, c.y, 4, 0, 6.28); cx.fill(); }
    // tiny "z" if super low
    if (sad) { cx.fillStyle = '#888'; cx.font = '20px sans-serif'; cx.fillText('. . .', 330, 100 + Math.sin(t / 400) * 4); }
  }

  function say(text, ms = 5000) {
    bubble.textContent = '“' + text + '”';
    clearTimeout(bubbleTimer); bubbleTimer = setTimeout(() => { bubble.textContent = ''; }, ms);
  }
  function think() { const arr = THOUGHTS[mood()]; say(arr[Math.floor(Math.random() * arr.length)]); }

  function refresh() {
    decay(st, Date.now());
    bars.food.fill.style.width = st.food + '%'; bars.food.val.textContent = Math.round(st.food) + '%';
    bars.love.fill.style.width = st.love + '%'; bars.love.val.textContent = Math.round(st.love) + '%';
    bars.food.fill.style.background = st.food < 20 ? 'var(--danger)' : 'var(--ok)';
    bars.love.fill.style.background = st.love < 20 ? 'var(--danger)' : 'var(--accent)';
    const days = (Date.now() - st.born) / 864e5;
    info.textContent = `Mood: ${MOOD_LABEL[mood()]} · age ${days < 1 ? Math.floor(days * 24) + ' hours' : days.toFixed(1) + ' days'} · fed ${st.fed}× · petted ${st.petted}× · talked ${st.talked}×`;
    save();
  }

  function feed() {
    decay(st, Date.now());
    if (st.food > 96) { say('I am full. Honestly, I am just a rock.'); return; }
    st.food = Math.min(100, st.food + 30); st.fed++; eat = 1.1; wobble = 1;
    for (let i = 0; i < 8; i++) crumbs.push({ x: 210, y: 230, vx: (Math.random() - 0.5) * 160, vy: -120 - Math.random() * 100, life: 0.9 });
    say('Nom. Minerals. Delicious.', 3000); refresh();
  }
  function pet() {
    decay(st, Date.now());
    st.love = Math.min(100, st.love + 15); st.petted++; wobble = 1;
    for (let i = 0; i < 4; i++) hearts.push({ x: 150 + Math.random() * 120, y: 130 + Math.random() * 30, life: 1.4 + Math.random() * 0.8, ph: Math.random() * 6 });
    refresh();
  }
  function talk() {
    decay(st, Date.now());
    st.love = Math.min(100, st.love + 6); st.talked++; listen = 1.2; wobble = 0.4;
    say(TALK_REPLIES[Math.floor(Math.random() * TALK_REPLIES.length)]); refresh();
  }
  canvas.addEventListener('click', pet);
  canvas.style.cursor = 'pointer';

  let stopLoop = null, iv = null, thinkIv = null;
  function mount() {
    stopAll();
    render(root,
      el('div', { class: 'center' }, el('div', { class: 'big' }, st.name)),
      el('div', { class: 'row', style: { justifyContent: 'center' } }, canvas),
      bubble,
      el('div', { class: 'row', style: { marginTop: '14px' } }, barRow('food', 'Fullness'), barRow('love', 'Affection')),
      el('div', { class: 'row', style: { justifyContent: 'center' } },
        el('button', { class: 'btn primary', onclick: feed }, 'Feed'),
        el('button', { class: 'btn primary', onclick: pet }, 'Pet'),
        el('button', { class: 'btn primary', onclick: talk }, 'Talk'),
        el('button', { class: 'btn ghost', onclick: () => { s.del('rock'); st = null; stopAll(); showName(); } }, 'Release')),
      info,
      el('p', { class: 'small muted center' }, 'Stats keep changing while this page is closed. Click the rock to pet it.'));
    stopLoop = loop(frame);
    iv = setInterval(refresh, 5000);
    thinkIv = setInterval(() => { if (Math.random() < 0.6) think(); }, 12000);
    refresh();
    if (away > 10 * 60e3 && !bubbleTimer) {
      const hrs = away / HOUR;
      say(`You were gone ${hrs < 1 ? Math.round(away / 60e3) + ' minutes' : hrs.toFixed(1) + ' hours'}. ` + (mood() === 'happy' ? 'I barely noticed. (I noticed.)' : 'I counted every one.'), 7000);
    } else think();
  }
  function stopAll() {
    if (stopLoop) stopLoop(); stopLoop = null; clearInterval(iv); clearInterval(thinkIv);
  }

  if (st) mount(); else showName();
  return () => { stopAll(); clearTimeout(bubbleTimer); timers.forEach(clearTimeout); if (st) save(); };
}
