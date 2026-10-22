// Hangman: five categories with 20+ words each, gallows drawn on canvas, physical + on-screen keyboard, wins/losses kept.
import { el, render, store, stat, toast } from '../../lib/ui.js';

const WORDS = {
  animals: 'elephant giraffe kangaroo penguin dolphin octopus crocodile hedgehog flamingo cheetah gorilla leopard panther squirrel tortoise walrus zebra ostrich raccoon porcupine chameleon platypus jellyfish armadillo buffalo hamster meerkat pelican rhinoceros'.split(' '),
  countries: 'argentina australia belgium brazil canada denmark egypt finland france germany greece iceland india ireland italy japan kenya mexico morocco netherlands norway peru poland portugal spain sweden switzerland thailand turkey vietnam'.split(' '),
  movies: ['jurassic park', 'the matrix', 'star wars', 'inception', 'titanic', 'toy story', 'finding nemo', 'the godfather', 'pulp fiction', 'forrest gump', 'back to the future', 'the lion king', 'frozen', 'gladiator', 'interstellar', 'jaws', 'casablanca', 'the dark knight', 'home alone', 'ghostbusters', 'shrek', 'avatar', 'rocky', 'alien', 'coco', 'up', 'the avengers', 'spirited away', 'mad max', 'parasite'],
  food: 'spaghetti pancake croissant burrito lasagna avocado pineapple sandwich pretzel waffle mushroom broccoli cinnamon chocolate omelette dumpling noodles biscuit cucumber pepperoni strawberry raspberry macaroni meatball popcorn yogurt tortilla sushi hummus quesadilla'.split(' '),
  tech: 'keyboard algorithm database compiler internet processor firmware bluetooth javascript python encryption bandwidth router terminal pixel kernel protocol browser firewall semiconductor transistor microchip software hardware bytecode debugger ethernet wireless server podcast'.split(' '),
};
const MAX_WRONG = 7;
const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

export default function (root) {
  const s = store('hangman');
  let record = s.get('record', { wins: 0, losses: 0, streak: 0 });
  let category = s.get('category', 'animals');
  let word = '', guessed = new Set(), wrong = 0, state = 'playing', recent = [];

  const W = 300, H = 260;
  const canvas = el('canvas', { width: W, height: H, style: { maxWidth: '100%', height: 'auto', display: 'block' } });
  const ctx = canvas.getContext('2d');
  const wordBox = el('div', { class: 'center', style: { fontSize: '30px', letterSpacing: '4px', fontFamily: 'ui-monospace,Consolas,monospace', margin: '10px 0', lineHeight: '1.6', wordBreak: 'break-word' } });
  const msg = el('div', { class: 'center', style: { minHeight: '26px', fontWeight: '600' } });
  const stats = el('div', { class: 'row' });
  const keys = {};
  const keyboard = el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '5px', justifyContent: 'center', maxWidth: '520px', margin: '10px auto' } });
  for (const ch of LETTERS) {
    const b = el('button', { class: 'btn', style: { width: '40px', height: '42px', padding: 0, fontWeight: '700', textTransform: 'uppercase', touchAction: 'manipulation' }, onclick: () => guess(ch) }, ch);
    keys[ch] = b; keyboard.append(b);
  }
  const catSel = el('select', { class: 'select', value: category, onchange: () => { category = catSel.value; s.set('category', category); newGame(); } },
    Object.keys(WORDS).map(c => el('option', { value: c }, c[0].toUpperCase() + c.slice(1) + ` (${WORDS[c].length})`)));
  const livesBadge = el('span', { class: 'badge' });

  function cssVar(name) { return getComputedStyle(root).getPropertyValue(name).trim() || '#888'; }
  function drawGallows() {
    ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = cssVar('--muted');
    // gallows (always)
    ctx.beginPath(); ctx.moveTo(30, 240); ctx.lineTo(150, 240); // base
    ctx.moveTo(70, 240); ctx.lineTo(70, 30); // post
    ctx.lineTo(190, 30); // beam
    ctx.moveTo(70, 70); ctx.lineTo(110, 30); // brace
    ctx.stroke();
    const parts = [
      () => { ctx.moveTo(190, 30); ctx.lineTo(190, 65); }, // rope
      () => { ctx.moveTo(212, 87); ctx.arc(190, 87, 22, 0, Math.PI * 2); }, // head
      () => { ctx.moveTo(190, 109); ctx.lineTo(190, 175); }, // body
      () => { ctx.moveTo(190, 125); ctx.lineTo(155, 155); }, // left arm
      () => { ctx.moveTo(190, 125); ctx.lineTo(225, 155); }, // right arm
      () => { ctx.moveTo(190, 175); ctx.lineTo(160, 220); }, // left leg
      () => { ctx.moveTo(190, 175); ctx.lineTo(220, 220); }, // right leg
    ];
    ctx.strokeStyle = state === 'lost' ? cssVar('--danger') : cssVar('--text');
    ctx.beginPath();
    for (let i = 0; i < Math.min(wrong, parts.length); i++) parts[i]();
    ctx.stroke();
    if (wrong >= 2) {
      // face
      ctx.fillStyle = cssVar('--panel'); ctx.strokeStyle = ctx.strokeStyle; ctx.lineWidth = 2;
      ctx.beginPath();
      if (state === 'lost') { ctx.moveTo(180, 80); ctx.lineTo(188, 88); ctx.moveTo(188, 80); ctx.lineTo(180, 88); ctx.moveTo(192, 80); ctx.lineTo(200, 88); ctx.moveTo(200, 80); ctx.lineTo(192, 88); }
      else { ctx.moveTo(185, 83); ctx.arc(183, 83, 2, 0, 7); ctx.moveTo(199, 83); ctx.arc(197, 83, 2, 0, 7); }
      ctx.moveTo(182, 96);
      if (state === 'won') ctx.quadraticCurveTo(190, 104, 198, 96); else if (state === 'lost') ctx.quadraticCurveTo(190, 90, 198, 96); else ctx.lineTo(198, 96);
      ctx.stroke();
    }
  }
  function drawWord() {
    render(wordBox, [...word].map(ch => ch === ' ' ? el('span', { style: { display: 'inline-block', width: '22px' } }) :
      el('span', { style: { display: 'inline-block', minWidth: '28px', borderBottom: '3px solid ' + (state === 'lost' && !guessed.has(ch) ? 'var(--danger)' : 'var(--text)'), margin: '0 2px', color: state === 'lost' && !guessed.has(ch) ? 'var(--danger)' : '' } },
        guessed.has(ch) || state === 'lost' ? ch.toUpperCase() : ' ')));
    livesBadge.textContent = `${MAX_WRONG - wrong} lives left`;
    livesBadge.className = 'badge ' + (wrong >= MAX_WRONG - 2 ? 'danger' : wrong >= 4 ? 'warn' : 'ok');
    for (const ch of LETTERS) {
      const b = keys[ch];
      b.disabled = guessed.has(ch) || state !== 'playing';
      b.style.background = guessed.has(ch) ? (word.includes(ch) ? 'var(--ok)' : 'var(--muted)') : '';
      b.style.color = guessed.has(ch) ? '#fff' : '';
      b.style.borderColor = guessed.has(ch) ? 'transparent' : '';
    }
  }
  function updateStats() {
    const total = record.wins + record.losses;
    render(stats, stat(record.wins, 'wins'), stat(record.losses, 'losses'), stat(total ? Math.round(100 * record.wins / total) + '%' : '–', 'win rate'), stat(record.streak, 'streak'));
  }
  function pickWord() {
    const list = WORDS[category].filter(w => !recent.includes(w));
    const w = list[Math.floor(Math.random() * list.length)];
    recent.push(w); if (recent.length > 8) recent.shift();
    return w;
  }
  function newGame() {
    word = pickWord(); guessed = new Set(); wrong = 0; state = 'playing';
    msg.textContent = `Category: ${category}. Guess a letter.`;
    drawGallows(); drawWord();
  }
  function guess(ch) {
    if (state !== 'playing' || guessed.has(ch)) return;
    guessed.add(ch);
    if (!word.includes(ch)) wrong++;
    const letters = new Set([...word].filter(c => c !== ' '));
    if ([...letters].every(c => guessed.has(c))) {
      state = 'won'; record.wins++; record.streak++; msg.textContent = `You got it: ${word.toUpperCase()}. Press Enter or N for another.`;
    } else if (wrong >= MAX_WRONG) {
      state = 'lost'; record.losses++; record.streak = 0; msg.textContent = `Out of lives. It was ${word.toUpperCase()}. Press Enter or N to retry.`;
    } else msg.textContent = word.includes(ch) ? `Yes, ${ch.toUpperCase()} is in it.` : `No ${ch.toUpperCase()}. ${MAX_WRONG - wrong} lives left.`;
    if (state !== 'playing') { s.set('record', record); updateStats(); }
    drawGallows(); drawWord();
  }
  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (/^[a-zA-Z]$/.test(e.key)) { if (state === 'playing') guess(e.key.toLowerCase()); else if (e.key.toLowerCase() === 'n') newGame(); }
    else if (e.key === 'Enter' && state !== 'playing') newGame();
  }
  window.addEventListener('keydown', onKey);

  render(root,
    el('div', { class: 'row' }, catSel, el('button', { class: 'btn primary', onclick: newGame }, 'New word'), livesBadge,
      el('button', { class: 'btn ghost small', onclick: () => { record = { wins: 0, losses: 0, streak: 0 }; s.set('record', record); updateStats(); toast('Record reset'); } }, 'Reset record')),
    stats,
    el('div', { class: 'grid2', style: { alignItems: 'center' } },
      el('div', { class: 'canvas-wrap' }, canvas),
      el('div', {}, wordBox, msg)),
    keyboard,
    el('div', { class: 'muted small center' }, 'Type a letter or tap one. 7 wrong guesses and the drawing is complete.'));
  updateStats(); newGame();
  return () => window.removeEventListener('keydown', onKey);
}
