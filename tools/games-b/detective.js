// Detective mystery: a branching text case (state graph) with suspects, locations, clues, a notebook and an accusation screen.
import { el, render, store, toast } from '../../lib/ui.js';

const CLUES = {
  latch: 'The library window latch was forced from the INSIDE: the scratches are on the inner plate.',
  mud: 'Fresh mud on the conservatory floor, but the prints stop two steps in and never reach the library.',
  ash: 'Cigar ash in the study ashtray. Only Colonel Ashby smokes cigars.',
  combo: 'The safe shows no sign of forcing. Whoever opened it knew the combination.',
  glove: 'A grey wool thread caught on the safe hinge.',
  insurance: 'Letter on the study desk: the emerald\'s insurance was raised to £12,000 a fortnight ago.',
  debts: 'Butler\'s ledger: tradesmen unpaid for three months. Harrowgate Hall is close to ruin.',
  kitchen: 'Cook swears Peel the butler never left the kitchen between nine and ten.',
  gate: 'The garden gate is locked and the gardener holds the only key. Nobody left the grounds.',
  notebook: 'Miss Finch\'s notebook lists the safe combination among household notes.',
  gloves: 'Miss Finch\'s grey gloves: both present, undamaged.',
  ladygloves: 'Lady Beatrice\'s grey cashmere gloves: the left fingertip is torn.',
  loupe: 'Dr. Vale carries a jeweller\'s loupe in his medical bag.',
  paste: 'Dr. Vale admits it: he examined the emerald last month and it is PASTE. The real stone was sold long ago.',
  colonel: 'The Colonel smoked in the study at eight o\'clock with Lady Beatrice, before dinner. He has not been back.',
  alibi: 'Miss Finch played the piano in the drawing room during the theft; three guests confirm it.',
  nervous: 'Lady Beatrice insisted on fetching the police herself and took twenty minutes to make a two-minute call.',
};
const KEY = ['insurance', 'latch', 'ladygloves', 'paste'];
const SUSPECTS = [
  { id: 'beatrice', name: 'Lady Beatrice Harrow', role: 'the hostess, owner of the emerald', node: 'beatrice' },
  { id: 'vale', name: 'Dr. Edmund Vale', role: 'family physician', node: 'vale' },
  { id: 'clara', name: 'Miss Clara Finch', role: 'her ladyship\'s secretary', node: 'clara' },
  { id: 'ashby', name: 'Colonel Reginald Ashby', role: 'old friend, keen card player', node: 'ashby' },
  { id: 'peel', name: 'Mr. Thomas Peel', role: 'the butler', node: 'peel' },
];
// Options: t = label, to = node, give = clue(s) found, need = clue(s) required to show the option.
const NODES = {
  intro: { title: 'The Harrowgate Emerald', text: 'Harrowgate Hall, a wet October night. At ten o\'clock Lady Beatrice Harrow screamed: the famous Harrowgate Emerald is gone from the study safe, the library window stands open to the rain. Five people were in the house. The inspector is an hour away and has asked you, the guest with a reputation, to look around before anyone touches anything.', opts: [{ t: 'Begin in the front hall', to: 'hall' }] },
  hall: { title: 'Front hall', text: 'The great hall. Doors lead to the library, the study, the drawing room, the conservatory and the kitchen passage. The stairs climb to the bedrooms and the cloakroom. The guests wait, pale, in the drawing room.', opts: [
    { t: 'Library', to: 'library' }, { t: 'Study', to: 'study' }, { t: 'Drawing room', to: 'drawing' }, { t: 'Conservatory', to: 'conservatory' },
    { t: 'Kitchen', to: 'kitchen' }, { t: 'Garden', to: 'garden' }, { t: 'Upstairs', to: 'upstairs' }] },
  library: { title: 'Library', text: 'Rain blows in through the open sash window. Books line three walls; a reading lamp still burns. The floor beneath the window is wet, but the rug is not muddy.', opts: [
    { t: 'Examine the window', to: 'library-window' }, { t: 'Look at the floor and rug', to: 'library-floor' }, { t: 'Back to the hall', to: 'hall' }] },
  'library-window': { title: 'The window', text: 'The latch is broken off. You turn the plate over in your fingers: every scratch is on the inner face, where a tool was levered from inside the room. A burglar outside could not have made them.', opts: [{ t: 'Note it', to: 'library', give: 'latch' }] },
  'library-floor': { title: 'The rug', text: 'Rainwater has pooled on the boards under the window, but the rug between the window and the door is spotless. Nobody wet walked across it.', opts: [{ t: 'Back', to: 'library' }] },
  study: { title: 'Study', text: 'A small panelled room. The wall safe stands open and empty. Papers cover the desk; a brass ashtray sits on the side table.', opts: [
    { t: 'Examine the safe', to: 'study-safe' }, { t: 'Go through the desk', to: 'study-desk' }, { t: 'The ashtray', to: 'study-ash' }, { t: 'Back to the hall', to: 'hall' }] },
  'study-safe': { title: 'The safe', text: 'The door is unmarked; the dial turns smoothly. No crowbar, no drill. It was simply opened by someone who knew the numbers.', opts: [
    { t: 'Note it', to: 'study-safe2', give: 'combo' }] },
  'study-safe2': { title: 'The safe', text: 'Looking closer, a few fibres are snagged on the hinge: grey wool, fine, the kind of a lady\'s glove.', opts: [{ t: 'Take the thread', to: 'study', give: 'glove' }] },
  'study-desk': { title: 'The desk', text: 'Bills, mostly. Then a letter from Faraday & Sons, insurers: "We confirm the increase in cover for the Harrowgate Emerald to £12,000, effective the 3rd." It is dated two weeks ago.', opts: [{ t: 'Pocket the letter', to: 'study', give: 'insurance' }] },
  'study-ash': { title: 'The ashtray', text: 'Fresh cigar ash and a chewed stub. Only one person at Harrowgate smokes cigars: Colonel Ashby, who told everyone at dinner he had "never set foot" in the study.', opts: [{ t: 'Note it', to: 'study', give: 'ash' }] },
  drawing: { title: 'Drawing room', text: 'The guests sit by the fire. A piano stands open; sheet music lies on the stand. Everyone agrees Miss Finch was playing when the scream came.', opts: [
    { t: 'Ask the guests about the piano', to: 'drawing-piano' }, { t: 'Question a suspect', to: 'suspects' }, { t: 'Back to the hall', to: 'hall' }] },
  'drawing-piano': { title: 'The guests', text: 'Three guests, independently: Miss Finch played Chopin from half past nine until the scream, without a break. "Rather well, too," the vicar adds.', opts: [{ t: 'Note it', to: 'drawing', give: 'alibi' }] },
  conservatory: { title: 'Conservatory', text: 'Ferns, damp warmth and the garden door, unlocked. Mud has been tracked in from the path.', opts: [
    { t: 'Follow the footprints', to: 'conservatory-prints' }, { t: 'Back to the hall', to: 'hall' }] },
  'conservatory-prints': { title: 'Footprints', text: 'Two muddy prints, then nothing. They stop a yard inside the door, as if someone stepped in, turned around and went back out. They do not go anywhere near the library.', opts: [{ t: 'Note it', to: 'conservatory', give: 'mud' }] },
  kitchen: { title: 'Kitchen', text: 'Cook is furious about her ruined souffle. Peel, the butler, polishes glasses with great concentration. A ledger lies open on the dresser.', opts: [
    { t: 'Talk to Cook', to: 'kitchen-cook' }, { t: 'Read the ledger', to: 'kitchen-ledger' }, { t: 'Question Peel', to: 'peel' }, { t: 'Back to the hall', to: 'hall' }] },
  'kitchen-cook': { title: 'Cook', text: '"Mr. Peel? He was in here from nine until the scream, drying up, because the girl is off sick. I\'ll swear it on my mother\'s grave."', opts: [{ t: 'Note it', to: 'kitchen', give: 'kitchen' }] },
  'kitchen-ledger': { title: 'The household ledger', text: 'Column after column of unpaid accounts: the butcher, the coal merchant, the wine merchant. Nothing has been settled in three months. Pencilled at the bottom in Peel\'s hand: "Her ladyship says the money is coming."', opts: [{ t: 'Note it', to: 'kitchen', give: 'debts' }] },
  garden: { title: 'Garden', text: 'Rain hammers the lawn. The path from the conservatory runs to a tall iron gate in the wall.', opts: [
    { t: 'Check the gate', to: 'garden-gate' }, { t: 'Back to the hall', to: 'hall' }] },
  'garden-gate': { title: 'The gate', text: 'Locked, and the lock is rusted stiff. The gardener, roused from his cottage, has the only key on a string round his neck. Nobody left the grounds tonight.', opts: [{ t: 'Note it', to: 'garden', give: 'gate' }] },
  upstairs: { title: 'Upstairs', text: 'A long corridor of bedrooms and, at the end, the cloakroom where the guests left their coats and bags.', opts: [
    { t: 'Lady Beatrice\'s room', to: 'room-beatrice' }, { t: 'Miss Finch\'s room', to: 'room-clara' }, { t: 'Cloakroom', to: 'cloakroom' }, { t: 'Downstairs', to: 'hall' }] },
  'room-beatrice': { title: 'Lady Beatrice\'s room', text: 'Silk, perfume and an unmade bed. On the dressing table lies a pair of grey cashmere gloves. The left fingertip is torn and a few threads are missing.', opts: [{ t: 'Take the gloves', to: 'upstairs', give: 'ladygloves' }] },
  'room-clara': { title: 'Miss Finch\'s room', text: 'Spartan and tidy. A notebook on the desk; a pair of grey wool gloves folded on the chair.', opts: [
    { t: 'Read the notebook', to: 'room-clara-book' }, { t: 'Examine the gloves', to: 'room-clara-gloves' }, { t: 'Back', to: 'upstairs' }] },
  'room-clara-book': { title: 'The notebook', text: 'Lists: menus, laundry, letters to answer. And, between the florist\'s number and the coal order, "Safe: 14 L, 32 R, 7 L".', opts: [{ t: 'Note it', to: 'room-clara', give: 'notebook' }] },
  'room-clara-gloves': { title: 'Her gloves', text: 'Plain grey wool, darned once at the wrist, otherwise whole. Not a thread out of place.', opts: [{ t: 'Note it', to: 'room-clara', give: 'gloves' }] },
  cloakroom: { title: 'Cloakroom', text: 'Coats drip on their hooks. The doctor\'s battered bag sits on the bench.', opts: [
    { t: 'Open the doctor\'s bag', to: 'cloakroom-bag' }, { t: 'Back', to: 'upstairs' }] },
  'cloakroom-bag': { title: 'The doctor\'s bag', text: 'Stethoscope, bandages, a bottle of laudanum, and, in the side pocket, a jeweller\'s loupe. An odd instrument for a physician.', opts: [{ t: 'Note it', to: 'cloakroom', give: 'loupe' }] },
  suspects: { title: 'The suspects', text: 'Who will you question?', opts: SUSPECTS.map(s => ({ t: s.name, to: s.node })).concat({ t: 'Back', to: 'drawing' }) },
  beatrice: { title: 'Lady Beatrice Harrow', text: '"It was my grandmother\'s. Some ruffian came through the window while we were at dinner, that is perfectly obvious. Must you really poke about?" Her hands are shaking.', opts: [
    { t: 'Where were you at ten?', to: 'beatrice-time' },
    { t: 'Ask about the unpaid bills', to: 'beatrice-debts', need: 'debts' },
    { t: 'Ask about the insurance letter', to: 'beatrice-insurance', need: 'insurance' },
    { t: 'Show her the torn glove', to: 'beatrice-glove', need: ['glove', 'ladygloves'] },
    { t: 'Someone else', to: 'suspects' }] },
  'beatrice-time': { title: 'Lady Beatrice', text: '"In the study, telephoning the police, naturally, the moment I saw the safe." Peel murmurs that her ladyship was gone twenty minutes before the exchange put the call through. "The line was dreadful," she says.', opts: [{ t: 'Note it', to: 'beatrice', give: 'nervous' }] },
  'beatrice-debts': { title: 'Lady Beatrice', text: '"Every great house has debts. The emerald would have covered them ten times over, which is exactly why I would never..." She stops. "It was insured, of course."', opts: [{ t: 'Back', to: 'beatrice' }] },
  'beatrice-insurance': { title: 'Lady Beatrice', text: '"Faraday\'s advised it. Values rise." Twelve thousand pounds, you observe, for a stone she had not had valued in twenty years. "Dr. Vale looked at it," she says, and then looks as if she wishes she had not.', opts: [{ t: 'Back', to: 'beatrice' }] },
  'beatrice-glove': { title: 'Lady Beatrice', text: 'You lay the grey thread beside the torn cashmere fingertip. The colour, the twist, the weight: identical. "I... must have brushed the hinge this morning," she says. Her voice has gone very small.', opts: [{ t: 'Back', to: 'beatrice' }] },
  vale: { title: 'Dr. Edmund Vale', text: 'A tired man with careful hands. "I was in the drawing room with the others, listening to Miss Finch. Ask anyone."', opts: [
    { t: 'Ask about the loupe in his bag', to: 'vale-loupe', need: 'loupe' },
    { t: 'Ask what he thinks happened', to: 'vale-opinion' },
    { t: 'Someone else', to: 'suspects' }] },
  'vale-loupe': { title: 'Dr. Vale', text: 'He sighs. "Very well. Beatrice asked me, a month ago, to look at the stone. I collect minerals; I know glass when I see it. The Harrowgate Emerald is paste. A good copy, but paste. The real one must have been sold years ago. I told her so. She begged me to say nothing."', opts: [{ t: 'Note it', to: 'vale', give: 'paste' }] },
  'vale-opinion': { title: 'Dr. Vale', text: '"A burglar, I suppose. Although it is a strange burglar who climbs in through a window in a downpour and leaves no mud on the rug."', opts: [{ t: 'Back', to: 'vale' }] },
  clara: { title: 'Miss Clara Finch', text: 'Composed, grey-eyed, ink on her fingers. "I was at the piano. I have told the Colonel so three times."', opts: [
    { t: 'Ask about the combination in her notebook', to: 'clara-notebook', need: 'notebook' },
    { t: 'Ask about her ladyship\'s mood', to: 'clara-mood' },
    { t: 'Someone else', to: 'suspects' }] },
  'clara-notebook': { title: 'Miss Finch', text: '"Of course I have the combination. I keep her ladyship\'s papers; I open that safe twice a week. If I wanted to rob her I would hardly need to break a window." She has a point.', opts: [{ t: 'Back', to: 'clara' }] },
  'clara-mood': { title: 'Miss Finch', text: '"Her ladyship has been... brittle. The bank wrote again on Tuesday. She burned the letter." A pause. "She did ask me, last week, which window in the library sticks."', opts: [{ t: 'Back', to: 'clara' }] },
  ashby: { title: 'Colonel Reginald Ashby', text: 'Red-faced and booming. "Never set foot in the study, sir! Cards in the drawing room all evening. Lost four pounds to the vicar."', opts: [
    { t: 'Ask about the cigar ash in the study', to: 'ashby-ash', need: 'ash' },
    { t: 'Ask about the cards', to: 'ashby-cards' },
    { t: 'Someone else', to: 'suspects' }] },
  'ashby-ash': { title: 'Colonel Ashby', text: 'He deflates. "Oh, very well. I was in there at eight, before dinner, with Beatrice. She wanted to talk about a loan. I smoked, she refused, we went in to dinner. Haven\'t been back since, and that is the truth."', opts: [{ t: 'Note it', to: 'ashby', give: 'colonel' }] },
  'ashby-cards': { title: 'Colonel Ashby', text: '"Whist. The vicar, Mrs. Pargeter, young Finch at the piano behind us. Nobody left the table until the scream, except..." He frowns. "Except Beatrice, who went to fetch her shawl at about a quarter to ten."', opts: [{ t: 'Back', to: 'ashby' }] },
  peel: { title: 'Mr. Thomas Peel', text: 'The butler stands very straight. "I was in the kitchen, sir. Cook will tell you."', opts: [
    { t: 'Ask about the ledger', to: 'peel-ledger', need: 'debts' },
    { t: 'Ask who knows the safe combination', to: 'peel-safe' },
    { t: 'Someone else', to: 'suspects' }] },
  'peel-ledger': { title: 'Peel', text: '"It is not my place to say, sir. But the wages have not been paid since August, and her ladyship has been very particular, lately, about which jewels are insured."', opts: [{ t: 'Back', to: 'peel' }] },
  'peel-safe': { title: 'Peel', text: '"Her ladyship, Miss Finch and, I believe, the late master\'s solicitor. Not myself, sir. I have never cared to know."', opts: [{ t: 'Back', to: 'peel' }] },
};

const ENDINGS = {
  correct: 'You lay it out in the drawing room: the latch forced from inside, the insurance raised a fortnight before a "burglary", the torn cashmere glove, the paste stone nobody was ever supposed to examine. Lady Beatrice listens with her chin up and then, very quietly, says: "The real emerald paid for the roof in 1919. Faraday\'s would have paid for everything else." The inspector arrives to find the case already closed. CASE SOLVED.',
  weak: 'You name Lady Beatrice. She looks at you with magnificent contempt. "On what evidence?" The inspector, arriving, agrees: suspicion is not proof. The case is left open, and you are not invited back to Harrowgate. Find the physical evidence before you accuse.',
  vale: 'You accuse Dr. Vale. He produces three witnesses who had him in sight all evening and, with a tired smile, the loupe: "I collect minerals. It is not a crime." The inspector thanks you for your time. The real thief watches from the sofa.',
  clara: 'You accuse Miss Finch. The vicar, Mrs. Pargeter and the Colonel all heard her play Chopin without a pause through the theft; she has had the combination for a year and never needed a broken window. She resigns the next morning. The emerald is never "found".',
  ashby: 'You accuse Colonel Ashby. He roars, then laughs: four people kept him at the whist table from dinner until the scream, and the ash in the study was from eight o\'clock. The inspector shakes his head. Wrong man.',
  peel: 'You accuse the butler. Cook rises like a thundercloud: Peel never left her kitchen. The inspector apologises to Peel; Peel does not apologise to you. The butler did not do it.',
};

export default function (root) {
  const s = store('detective');
  const fresh = () => ({ node: 'intro', clues: [], visited: ['intro'], accused: null, evidence: [] });
  let st = s.get('progress', null) || fresh();
  if (!NODES[st.node] && !['accuse', 'evidence', 'ending'].includes(st.node)) st = fresh();
  let scores = s.get('scores', { solved: 0, attempts: 0 });
  const save = () => s.set('progress', st);
  const has = c => (Array.isArray(c) ? c : [c]).every(x => st.clues.includes(x));

  const scene = el('div', { class: 'panel', style: { minHeight: '220px' } });
  const notebook = el('div', { class: 'panel' });
  const topbar = el('div', { class: 'row small muted' });

  function go(to, give) {
    if (give) for (const c of [].concat(give)) if (!st.clues.includes(c)) { st.clues.push(c); toast('Clue added to notebook'); }
    st.node = to; if (!st.visited.includes(to)) st.visited.push(to); save(); show();
  }
  function restart() { st = fresh(); save(); show(); }
  function verdict() {
    scores.attempts++;
    let key;
    if (st.accused !== 'beatrice') key = st.accused;
    else key = st.evidence.filter(c => KEY.includes(c)).length >= 2 ? 'correct' : 'weak';
    if (key === 'correct') scores.solved++;
    s.set('scores', scores); st.node = 'ending'; st.verdict = key; save(); show();
  }

  function showScene() {
    if (st.node === 'accuse') {
      return render(scene, el('h3', { style: { marginTop: 0 } }, 'Make an accusation'),
        el('p', {}, 'The inspector\'s car is on the drive. Who stole the Harrowgate Emerald? (Be sure: a wrong accusation ends the case.)'),
        el('div', { class: 'col', style: { gap: '6px' } }, SUSPECTS.map(sp => el('button', { class: 'btn', style: { textAlign: 'left' }, onclick: () => { st.accused = sp.id; st.evidence = []; st.node = 'evidence'; save(); show(); } }, el('b', {}, sp.name), el('span', { class: 'muted' }, ' — ' + sp.role)))),
        el('div', { class: 'row', style: { marginTop: '10px' } }, el('button', { class: 'btn ghost small', onclick: () => go('hall') }, 'Not yet, keep investigating')));
    }
    if (st.node === 'evidence') {
      const sp = SUSPECTS.find(x => x.id === st.accused);
      const boxes = st.clues.map(c => { const cb = el('input', { type: 'checkbox', checked: st.evidence.includes(c), onchange: () => { st.evidence = st.evidence.filter(x => x !== c); if (cb.checked) st.evidence.push(c); save(); } }); return el('label', { class: 'inline', style: { alignItems: 'flex-start' } }, cb, ' ', CLUES[c]); });
      return render(scene, el('h3', { style: { marginTop: 0 } }, 'The case against ' + sp.name),
        el('p', {}, st.clues.length ? 'Tick the evidence you will present. Pick the facts that actually prove it; padding the list does not help.' : 'You have no clues in your notebook. This will be a very short speech.'),
        el('div', { class: 'col', style: { gap: '6px' } }, boxes),
        el('div', { class: 'row', style: { marginTop: '10px' } },
          el('button', { class: 'btn primary', onclick: verdict }, 'Present the case'),
          el('button', { class: 'btn ghost small', onclick: () => { st.node = 'accuse'; save(); show(); } }, 'Choose someone else')));
    }
    if (st.node === 'ending') {
      const ok = st.verdict === 'correct';
      return render(scene, el('h3', { style: { marginTop: 0 } }, ok ? 'Case solved' : 'Case closed, unsolved'),
        el('span', { class: 'badge ' + (ok ? 'ok' : 'danger') }, ok ? 'Correct' : 'Incorrect'),
        el('p', { style: { lineHeight: 1.6 } }, ENDINGS[st.verdict]),
        el('div', { class: 'row' }, el('button', { class: 'btn primary', onclick: restart }, 'Start the case again'),
          !ok && el('button', { class: 'btn ghost small', onclick: () => { st.accused = null; go('hall'); } }, 'Rewind and keep investigating (practice)')));
    }
    const n = NODES[st.node];
    render(scene, el('h3', { style: { marginTop: 0 } }, n.title), el('p', { style: { lineHeight: 1.6 } }, n.text),
      el('div', { class: 'row' }, n.opts.filter(o => !o.need || has(o.need)).map(o => {
        const gained = o.give && has(o.give);
        return el('button', { class: 'btn' + (o.give ? ' primary' : '') + (gained ? ' ghost' : ''), onclick: () => go(o.to, o.give) }, o.t, gained ? ' ✓' : '');
      })),
      n.opts.some(o => o.need && !has(o.need)) ? el('div', { class: 'small muted', style: { marginTop: '8px' } }, 'More questions will open up as you find clues.') : null,
      st.node !== 'intro' && el('div', { class: 'row', style: { marginTop: '12px' } },
        st.node !== 'hall' && el('button', { class: 'btn small ghost', onclick: () => go('hall') }, 'Front hall'),
        el('button', { class: 'btn small ghost', onclick: () => go('suspects') }, 'Question someone'),
        el('button', { class: 'btn small danger', onclick: () => { st.node = 'accuse'; save(); show(); } }, 'Accuse')));
  }
  function showNotebook() {
    const total = Object.keys(CLUES).length;
    render(notebook, el('b', {}, `Notebook — ${st.clues.length} / ${total} clues`),
      st.clues.length ? el('ul', { class: 'list small' }, st.clues.map(c => el('li', {}, el('span', { class: 'badge' }, c), el('span', { class: 'grow' }, CLUES[c])))) : el('p', { class: 'muted small' }, 'Nothing yet. Search rooms and question people; what you find is written here.'),
      el('div', { class: 'small muted', style: { marginTop: '8px' } }, `Suspects: ${SUSPECTS.map(x => x.name).join(', ')}.`));
  }
  function show() {
    showScene(); showNotebook();
    render(topbar, el('span', {}, `Places seen: ${st.visited.length} / ${Object.keys(NODES).length}`), el('span', {}, ` · cases solved ${scores.solved} of ${scores.attempts} accusations`),
      el('span', { class: 'grow' }), el('button', { class: 'btn ghost small', onclick: restart }, 'New case'));
  }

  render(root, topbar, el('div', { class: 'grid2', style: { alignItems: 'start' } }, scene, notebook));
  show();
}
