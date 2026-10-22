import { el, render, store, copy } from '../../lib/ui.js';

const DICE = [
  { key: 'character', label: 'Character', icon: '🧑', items: ['a retired lighthouse keeper', 'a nervous young detective', 'a clumsy dragon', 'a runaway circus acrobat', 'a lonely robot', 'a cheerful gravedigger', 'a pirate who gets seasick', 'a disgraced chef', 'a time-traveling postman', 'a stubborn grandmother', 'a ghost who is afraid of the dark', 'a street musician with a secret', 'a shy wizard', 'a dishonest librarian', 'a rookie astronaut', 'an exiled queen', 'a talking cat', 'a night-shift nurse', 'a retired spy', 'a village blacksmith', 'a curious fox', 'a bounty hunter with a conscience', 'a twelve-year-old inventor', 'a fortune teller who is always wrong', 'a lost explorer', 'a mermaid working in a harbor cafe', 'a knight who hates fighting', 'a train conductor', 'a beekeeper', 'an amnesiac traveler'] },
  { key: 'setting', label: 'Setting', icon: '🏰', items: ['an abandoned lighthouse', 'a floating market', 'a snowed-in mountain inn', 'a city where it never stops raining', 'an underwater research station', 'a crumbling castle', 'a desert train station', 'a village at the edge of the map', 'a midnight carnival', 'a library with no exits', 'a space station orbiting a dying star', 'a haunted greenhouse', 'a bustling harbor at dawn', 'a forest of glass trees', 'a tiny island with one house', 'a night bus that never stops', 'a buried city', 'a rooftop garden', 'a walled monastery', 'a ship stuck in ice', 'a cozy bookshop at closing time', 'a lighthouse on a cloud', 'a mining town after the ore ran out', 'a hotel where every room is different', 'a bridge between two kingdoms', 'a crowded wedding', 'a drifting hot-air balloon', 'a quiet suburb with a secret', 'an old theater', 'a swamp at twilight'] },
  { key: 'object', label: 'Object', icon: '🗝️', items: ['a cracked pocket watch', 'a locked wooden box', 'a map with one missing corner', 'a glowing seed', 'a letter that was never sent', 'a broken compass', 'a silver key', 'a music box', 'an enormous egg', 'a mirror that shows tomorrow', 'a faded photograph', 'a jar of lightning', 'a worn leather diary', 'a ring that whispers', 'a lantern that never goes out', 'a stolen painting', 'a clay mask', 'a telescope pointed the wrong way', 'a bottle of ink that writes memories', 'a coin from a country that does not exist', 'a hand-drawn treasure map', 'a violin with a missing string', 'a dusty globe', 'a heavy suitcase', 'a feather that never falls', 'a tea set for twelve', 'a cracked crystal ball', 'a paper crown', 'a rusty bicycle', 'a golden thimble'] },
  { key: 'verb', label: 'Action', icon: '⚡', items: ['must find', 'must hide', 'must deliver', 'must destroy', 'must protect', 'must steal back', 'must decode', 'must repair', 'must bury', 'must trade away', 'must return', 'must smuggle', 'must forgive someone for losing', 'must keep a secret about', 'must follow clues to', 'must guard', 'must sell', 'must wake up with', 'must outrun the owner of', 'must learn to use', 'must borrow', 'must rescue', 'must investigate', 'must carry', 'must lie about', 'must bargain for', 'must dig up', 'must pretend to ignore', 'must share', 'must unwrap'] },
  { key: 'twist', label: 'Twist', icon: '🌀', items: ['but the narrator is lying', 'but it was all a rehearsal', 'but their best friend is the culprit', 'but time keeps repeating', 'but nobody believes them', 'but they are already a ghost', 'but the object is alive', 'but the setting is a dream', 'but they must do it before sunrise', 'but they have lost their voice', 'but the villain is their future self', 'but the rules change every hour', 'but the map was drawn by an enemy', 'but kindness is the only way to win', 'but they only have three words to say', 'but everyone speaks in rhyme', 'but a storm is closing in', 'but the one they trust has been replaced', 'but the whole town is watching', 'but the reward is a trap', 'but they cannot leave the room', 'but the object keeps changing shape', 'but a stranger knows their name', 'but they do not know what day it is', 'but the real danger is something small', 'but it is their last chance', 'but a child is the only witness', 'but they are secretly the one being hunted', 'but gravity starts to fail', 'but a promise from long ago comes due'] },
];

export default function (root) {
  const s = store('story-dice');
  const state = s.get('state', null) || { faces: DICE.map(() => -1), locked: DICE.map(() => false) };
  if (!Array.isArray(state.faces) || state.faces.length !== DICE.length) { state.faces = DICE.map(() => -1); state.locked = DICE.map(() => false); }
  const save = () => s.set('state', state);
  const rand = n => Math.floor(Math.random() * n);
  let timers = [];
  let rolling = false;

  const cards = DICE.map((d, i) => {
    const face = el('div', { style: { minHeight: '84px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontWeight: '600', fontSize: '16px', padding: '8px' } });
    const lock = el('button', { class: 'btn small ghost', onclick: () => { state.locked[i] = !state.locked[i]; save(); drawCard(i); } });
    const roll1 = el('button', { class: 'btn small', onclick: () => { if (!rolling) rollOnly([i]); } }, 'Roll');
    const box = el('div', { class: 'panel', style: { flex: '1 1 160px', minWidth: '150px', textAlign: 'center' } },
      el('div', { class: 'small muted' }, d.icon + ' ' + d.label), face, el('div', { class: 'row', style: { justifyContent: 'center', margin: '4px 0 0' } }, roll1, lock));
    return { box, face, lock };
  });
  const promptBox = el('div', { class: 'panel', style: { fontSize: '18px', lineHeight: '1.5', minHeight: '70px' } });
  const rollAll = el('button', { class: 'btn primary' }, 'Roll unlocked dice');

  function drawCard(i, temp) {
    const c = cards[i], idx = temp ?? state.faces[i];
    c.face.textContent = idx >= 0 ? DICE[i].items[idx] : '?';
    c.face.style.opacity = temp != null ? '.55' : '1';
    c.lock.textContent = state.locked[i] ? '🔒 Locked' : '🔓 Lock';
    c.box.style.borderColor = state.locked[i] ? 'var(--accent)' : '';
    if (temp == null) drawPrompt();
  }
  function promptText() {
    if (state.faces.some(f => f < 0)) return '';
    const [c, se, o, v, t] = DICE.map((d, i) => d.items[state.faces[i]]);
    const cap = x => x[0].toUpperCase() + x.slice(1);
    return `${cap(c)} in ${se} ${v} ${o}, ${t}.`;
  }
  function drawPrompt() {
    const t = promptText();
    render(promptBox, t ? t : el('span', { class: 'muted' }, 'Roll the dice to build a story prompt.'));
  }
  function rollOnly(which) {
    rolling = true; rollAll.disabled = true;
    const targets = which.filter(i => !state.locked[i] || which.length === 1);
    let ticks = 0;
    const t = setInterval(() => {
      ticks++;
      targets.forEach(i => drawCard(i, rand(DICE[i].items.length)));
      if (ticks >= 9) {
        clearInterval(t); timers = timers.filter(x => x !== t);
        targets.forEach(i => { state.faces[i] = rand(DICE[i].items.length); });
        save(); DICE.forEach((_, i) => drawCard(i)); rolling = false; rollAll.disabled = false;
      }
    }, 70);
    timers.push(t);
  }
  rollAll.addEventListener('click', () => { if (!rolling) rollOnly(DICE.map((_, i) => i)); });

  render(root,
    el('div', { class: 'row' }, cards.map(c => c.box)),
    el('div', { class: 'row' }, rollAll,
      el('button', { class: 'btn', onclick: () => { state.locked = state.locked.map(() => false); save(); DICE.forEach((_, i) => drawCard(i)); } }, 'Unlock all'),
      el('button', { class: 'btn', onclick: () => { const t = promptText(); if (t) copy(t); } }, 'Copy prompt')),
    el('h3', {}, 'Your prompt'), promptBox,
    el('p', { class: 'muted small' }, 'Lock any die you like and re-roll the rest until the combination sparks something.'));
  DICE.forEach((_, i) => drawCard(i));
  if (state.faces.every(f => f < 0)) rollOnly(DICE.map((_, i) => i));
  return () => { timers.forEach(clearInterval); timers = []; };
}
