import { el, render, store, today, rng, pad } from '../../lib/ui.js';

export const PROMPTS = [
  'Write about a door that was never supposed to be opened.',
  'Describe the last time you felt completely at home.',
  'A stranger leaves a key on your doorstep with a note: "You will know what to do."',
  'Write a scene where two people argue politely about something enormous.',
  'Your character wakes up and everyone speaks a language they cannot understand, except one person.',
  'Describe a city that only exists at night.',
  'Write a letter to your younger self about something you wish you had known.',
  'The lighthouse keeper receives a ship that should not exist.',
  'Write a story that begins with the sentence: "Nobody noticed the clocks had stopped."',
  'Describe your favorite meal without naming the food.',
  'A character finds a diary in a second-hand coat. What does it say?',
  'Write about the smell of rain on a hot street.',
  'Two old friends meet after twenty years. One of them is lying.',
  'Write a conversation that happens entirely through text messages sent at 3 a.m.',
  'Describe a place you have never been, as though you grew up there.',
  'A scientist discovers that plants have been listening all along.',
  'Write about a promise that was kept for the wrong reason.',
  'Your protagonist can hear one lie per day. Today is a very bad day.',
  'Write the opening paragraph of a mystery set in a library.',
  'Describe a storm from the point of view of a house.',
  'The last bus of the night takes a route that is not on any map.',
  'Write about a grandparent\'s hands.',
  'A town celebrates a festival nobody can explain anymore.',
  'Write a monologue for a character who has just missed their train.',
  'You inherit a shop with one unsold item in the window. What is it?',
  'Describe the sound of silence in three different places.',
  'A robot learns to be homesick.',
  'Write a story told entirely in questions.',
  'Describe the moment right before a big decision.',
  'A child draws a picture of a place and it begins to appear in the neighborhood.',
  'Write about a recipe that has been in the family for generations and what is secretly missing from it.',
  'A character receives an apology for something they do not remember.',
  'Write a scene on a rooftop at sunrise.',
  'Describe a color to someone who has never seen it.',
  'Your character is the only one who remembers yesterday.',
  'Write about a fox that has learned to use the subway.',
  'A message in a bottle arrives, but the ocean is a hundred miles away.',
  'Write about the worst gift you ever received and why you still keep it.',
  'Describe a market in a world where memories are currency.',
  'Two strangers share an umbrella and a secret.',
  'Write a story that takes place within a single elevator ride.',
  'The moon sends a postcard. What does it say?',
  'Write about a fear you have outgrown.',
  'A violin is found in the attic. Whose is it?',
  'Describe a kitchen at midnight.',
  'A character is asked to give a speech at a funeral for someone they barely knew.',
  'Write a scene in which nobody says what they mean.',
  'An old map shows a village that has since vanished. Why?',
  'Write about the first snow of the year from three different perspectives.',
  'Your character wins a lottery but loses something precious the same day.',
  'Describe a sunrise as if it were the last one.',
  'A lighthouse, a sandwich, and a very old promise.',
  'Write about a person who collects other people\'s lost things.',
  'A garden grows overnight in the middle of a parking lot.',
  'Write a story in which the villain is entirely right.',
  'Describe the feeling of arriving somewhere new at dusk.',
  'A teacher receives a note from a student fifty years in the future.',
  'Write about a game of chess that decides the fate of a small town.',
  'Your character finds a photograph of themselves at a place they have never been.',
  'Write a lullaby for a monster.',
  'Describe a train station in the middle of nowhere.',
  'The village baker discovers that bread can carry memories.',
  'Write about what the river remembers.',
  'A character is told to leave everything behind and take only three things.',
  'Write a scene where a misunderstanding changes everything.',
  'Describe a street musician and the person who stops to listen.',
  'A ghost is bad at haunting. Tell their story.',
  'Write about the longest day of your life.',
  'Your character opens a refrigerator and finds a portal.',
  'Write a story that begins at the end and moves backward.',
  'Describe the room you wish you had.',
  'A cat and a crow become unlikely allies.',
  'Write a heartfelt thank-you note to something that cannot read it.',
  'The town clock strikes thirteen. What happens next?',
  'Write about the person you were at sixteen.',
  'A traveler arrives with only a suitcase full of keys.',
  'Describe the first five minutes of a power outage.',
  'A character learns they are the minor character in someone else\'s story.',
  'Write a story set in a place where it has never stopped raining.',
  'A letter arrives seventy years late.',
  'Write about a hobby that becomes an obsession.',
  'Describe a conversation overheard in a cafe that you cannot stop thinking about.',
  'A mountain climber hears their name echoing from the summit.',
  'Write about an ordinary object that has secretly witnessed everything.',
  'A character must choose between truth and kindness.',
  'Write a scene with no dialogue that still tells us two people are in love.',
  'The sea gives something back. What is it?',
  'Describe how it feels to wait for important news.',
  'A shopkeeper only sells things people forgot they needed.',
  'Write about a tradition you would like to start.',
  'A bridge appears overnight over a river that was never crossed before.',
  'Describe the strangest dream you can remember and then explain it away.',
  'Write about a moment of unexpected kindness from a stranger.',
  'A detective who cannot lie must solve a case among liars.',
  'Write a story in exactly one hundred words.',
  'The wind carries a conversation from a house long abandoned.',
  'Describe your hometown through the eyes of a tourist.',
  'A character wakes up with a new skill and no memory of learning it.',
  'Write about an apology that arrives too late.',
  'A fisherman reels in a very strange catch.',
  'Write the diary entry of a character on the first day of a long journey.',
  'Describe a festival where everyone wears a mask and nobody is who they seem.',
  'A character is the last person to leave a building that is about to be demolished.',
  'Write about the first time you saw the ocean, or imagine it.',
  'Your character is a baker by day and a thief by night.',
  'A child asks a question that no adult can answer.',
  'Write a scene that takes place at a bus stop in the rain.',
  'Describe an heirloom and the story it silently tells.',
  'The stars rearranged themselves last night. Who noticed?',
  'Write about two siblings who inherit a house and a secret.',
  'A character receives a phone call from a number that does not exist.',
  'Write a love story between two people who never meet.',
  'Describe your perfect rainy afternoon in vivid detail.',
  'An astronaut hears a familiar song over the radio, far from Earth.',
  'Write about a character who talks to the birds and the day they answered back.',
  'A small mistake at work spirals into an adventure.',
  'Describe the quiet after an argument.',
  'A magician forgets how the trick ends.',
  'Write a story about a library book that is always checked out by the same unknown reader.',
  'The tide goes out farther than it ever has before.',
  'Write a scene at a wedding where something goes quietly wrong.',
  'A dragon applies for a job at a bank.',
  'Describe the oldest tree in the world and what it has seen.',
  'A character finds courage in an unexpected place.',
  'Write about what happens when the last lamp in the village goes out.',
  'You find a box labeled "Open only when you are ready". Are you?',
  'Write a story where the setting is the main character.',
  'A letter carrier delivers a letter to the wrong century.',
  'Describe a moment when time seemed to slow down.',
  'The chef has lost their sense of taste. How do they cook?',
  'Write about a mysterious stranger at the edge of town.',
  'Your character wakes up on a train with no memory of boarding.',
  'Write a conversation between the sun and the moon.',
  'A child befriends a creature living under the stairs.',
  'Describe a house that changes whenever nobody is looking.',
  'A character makes a wish and immediately regrets the wording.',
  'Write about the last day of summer.',
  'Describe the view from a window you have looked out of a thousand times.',
  'An old soldier finds a letter he never sent.',
  'Write a story about forgiveness that begins with a slammed door.',
  'The town is quiet because everyone is listening to the same thing.',
  'A gardener discovers that one flower blooms only when someone tells the truth.',
  'Write about a day when everything went wonderfully right.',
  'A map maker draws a place that does not exist yet.',
  'Write a scene in which a character finally says the thing they have rehearsed for years.',
  'Describe a world where music is visible.',
  'A ferry carries passengers who are all strangers to each other, except two.',
  'Write about the loudest place you have ever been.',
  'A scarecrow decides it is time to leave the field.',
  'Describe the taste of a memory.',
  'Write a story that features a broken clock, a red umbrella, and a promise.',
  'A neighbor you have never met leaves a mysterious package at your door.',
  'Write about an expedition to find something small.',
  'A character is allowed to ask the universe one question.',
  'Describe the dawn chorus from the point of view of someone who has never heard it.',
  'Write about a time when a plan failed and something better happened.',
  'A pen that writes only the truth falls into the wrong hands.',
  'Describe an empty stadium the day after the big game.',
  'The postman delivers one letter a year to the same remote cabin.',
  'Write about a sound that always reminds you of home.',
  'A photographer captures something in the background of every picture.',
  'Write the speech a character gives when accepting an award they do not deserve.',
  'Describe a bakery at four in the morning.',
  'The sky turns a color no one has a name for.',
  'Write about a person who decides to say yes to everything for a week.',
  'A mirror shows a version of the room where one small thing is different.',
];

function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function promptFor(date, n = 0) { return PROMPTS[Math.floor(rng(hash(date + ':' + n))() * PROMPTS.length)]; }
const wc = t => (t.match(/\S+/g) || []).length;
const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export default function (root) {
  const s = store('writing-prompt');
  let date = today();
  let n = s.get('alt:' + date, 0);
  const MIN = 10; // words needed for a day to count toward the streak
  const promptBox = el('div', { class: 'big', style: { fontSize: '22px', lineHeight: '1.4', fontWeight: '600', margin: '4px 0' } });
  const dateIn = el('input', { class: 'input', type: 'date', value: date });
  const ta = el('textarea', { class: 'textarea prose', rows: 12, placeholder: 'Start writing…', style: { minHeight: '260px' } });
  const info = el('div', { class: 'row' });
  let timer = null;

  function written() { return s.get('written', {}); }
  function streak() {
    const w = written(); const d = new Date();
    if ((w[keyOf(d)] || 0) < MIN) d.setDate(d.getDate() - 1);
    let c = 0; while ((w[keyOf(d)] || 0) >= MIN) { c++; d.setDate(d.getDate() - 1); }
    return c;
  }
  function updateInfo() {
    const words = wc(ta.value), st = streak();
    render(info,
      el('span', { class: 'badge' }, `${words} words`),
      el('span', { class: 'badge ' + (words >= MIN ? 'ok' : '') }, words >= MIN ? 'counts for today\'s streak' : `${MIN - words} more words to count`),
      el('span', { class: 'badge' }, `Streak: ${st} day${st === 1 ? '' : 's'}`));
  }
  function showDate() {
    n = s.get('alt:' + date, 0);
    promptBox.textContent = promptFor(date, n);
    ta.value = s.get('text:' + date, '');
    updateInfo();
  }
  function persist() {
    s.set('text:' + date, ta.value);
    const w = written(); w[date] = wc(ta.value); s.set('written', w);
    updateInfo();
  }
  ta.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(persist, 400); updateInfo(); });
  dateIn.addEventListener('change', () => { if (!dateIn.value) return; persist(); date = dateIn.value; showDate(); });

  render(root,
    el('div', { class: 'row' }, el('span', { class: 'muted' }, 'Prompt for'), dateIn,
      el('button', { class: 'btn small', onclick: () => { date = today(); dateIn.value = date; showDate(); } }, 'Today')),
    el('div', { class: 'panel' }, promptBox,
      el('div', { class: 'row', style: { marginBottom: 0 } },
        el('button', { class: 'btn', onclick: () => { n++; s.set('alt:' + date, n); promptBox.textContent = promptFor(date, n); } }, 'Another prompt'),
        n ? el('span', {}) : null,
        el('button', { class: 'btn ghost small', onclick: () => { n = 0; s.set('alt:' + date, 0); promptBox.textContent = promptFor(date, 0); } }, 'Back to the daily prompt'),
        el('span', { class: 'muted small' }, `${PROMPTS.length} prompts built in`))),
    ta, info);
  showDate();
  return () => { clearTimeout(timer); persist(); };
}
