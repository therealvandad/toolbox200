// Wordle: built-in 5-letter answer list + extra allowed guesses, daily (by date) and random modes,
// on-screen keyboard, custom pasted word list, emoji share grid, stats kept in localStorage.
import { el, render, store, copy, toast, rng, today, stat } from '../../lib/ui.js';

const ANSWERS_RAW = `abbey abide about above abuse actor acute adapt admit adopt adult after again agent agile agree ahead alarm album alert alike alive allow alone along aloud alpha alter amber amuse angel anger angle angry ankle apart apple apply april apron arena argue arise armor array arrow aside asset atlas attic audio audit avoid awake award aware awful bacon badge badly baker basic basin basis batch beach beard beast began begin being belly below bench berry birth black blade blame bland blank blast blaze bleed blend bless blind blink block blood bloom blown blues blunt blush board boast bonus boost booth bound brain brake brand brass brave bread break breed brick bride brief bring brisk broad broke brook broom brown brush buddy build built bunch burst buyer cabin cable camel candy canoe cargo carry carve catch cause cease chain chair chalk champ chaos charm chart chase cheap cheat check cheek cheer chess chest chief child chill china choir chord chose chunk cider cigar civic civil claim clamp clash class clean clear clerk click cliff climb cling clock close cloth cloud clown coach coast cocoa colon color comet comic coral couch could count court cover crack craft crane crash crawl crazy cream creek crept crime crisp cross crowd crown crude cruel crush crust curly curve cycle daily dairy daisy dance dated dealt death debut decay decor delay delta dense depth derby devil diary dirty disco ditch diver dizzy dodge donor doubt dough dozen draft drain drama drank drawn dream dress dried drift drill drink drive drone drove drown dwarf dwell eager eagle early earth eight elbow elder elect elite email ember empty enemy enjoy enter entry equal equip erase error essay ethic event every exact exist extra fable faint fairy faith false fancy fatal fault favor feast fence ferry fetch fever fiber field fifth fifty fight final first flame flash fleet flesh flint float flock flood floor flour fluid flush focus foggy force forge forth forty forum found frame frank fraud fresh front frost fruit fudge fully funny gauge ghost giant given glare glass glide globe gloom glory glove going grace grade grain grand grant grape graph grasp grass grave great greed green greet grief grill grind groan groom gross group grove grown guard guess guest guide guilt habit happy harsh haste hatch haven heart heavy hedge hello honey honor horse hotel house hover human humor hurry ideal image imply index inner input irony issue ivory jelly jewel joint joker judge juice juicy jumbo kayak knack kneel knife knock known label labor large laser latch later laugh layer learn lease least leave legal lemon level light limit linen liver lobby local lodge logic loose lover lower loyal lucky lunar lunch lying magic major maker mango manor maple march marry match mayor medal media mercy merge merit merry metal meter midst might minor minus mixer model moist money month moral motor mount mouse mouth movie music naive nasty naval nerve never newly night ninja noble noise north notch novel nurse oasis occur ocean offer often olive onion onset opera orbit order organ other ought ounce outer owner oxide ozone paint panel panic paper party pasta patch pause peace peach pearl pedal penny perch phase phone photo piano piece pilot pinch pitch pixel pizza place plain plane plant plate plaza plead pluck plumb plump point polar porch pound power press price pride prime print prior prize probe proof proud prove proxy pulse punch pupil puppy purse queen query quest quick quiet quilt quite quota quote radar radio raise rally ranch range rapid ratio reach react ready realm rebel refer reign relax relay reply rider ridge rifle right rigid rinse risky rival river roast robin robot rocky roman rough round route royal rugby ruler rumor rural sadly saint salad salon salsa sandy sauce scale scare scarf scene scent scoop scope score scout scrap screw seize sense serve seven shade shaft shake shall shame shape share shark sharp sheep sheet shelf shell shift shine shiny shirt shock shoot shore short shout shown shrug sight silly since siren sixth sixty skate skill skirt skull slate sleep slice slide slope small smart smell smile smoke snack snake sneak solar solid solve sonic sorry sound south space spare spark speak speed spell spend spice spike spill spine spoke spoon sport spray squad stack staff stage stain stair stake stamp stand stare start state steak steal steam steel steep steer stick stiff still sting stock stole stone stood stool store storm story stove strap straw stray strip stuck study stuff style sugar suite sunny super surge swamp swear sweat sweep sweet swept swift swing sword table taste teach teeth tempo tenth thank theft their theme there thick thief thing think third thorn those three threw throw thumb tiger tight timer title toast today token tooth topic torch total touch tough tower toxic trace track trade trail train trait trash treat trend trial tribe trick tried troop truck truly trunk trust truth tulip tumor twice twist ultra uncle under union unite until upper upset urban usage usher usual vague valid value valve vapor vault vegan venue verse video vigor villa vinyl viola viral virus visit vital vivid vocal voice vowel wagon waist waste watch water weary weave wedge weigh weird whale wheat wheel where which while white whole whose widen width witch woman world worry worse worst worth would wound wrist write wrong yacht yield young youth zebra`;

const EXTRA_RAW = `abort acrid adieu aisle algae allot amass amend amiss annex antic aorta arose ascot askew atone augur avert axiom azure baggy balmy banal barge baron basal baste bathe baton bayou beady begat begun belch belle bezel bicep bigot bilge binge bison blimp bliss bloat bluff blurb bongo booze botch bough boxer brawl brine brink briny broil brood brunt budge bugle bulge bulky bully bumpy burly bushy butch cacao cadet cairn cameo canal caper carat cater caulk cedar cello chafe chaff chant chard chasm chide chime chirp chock chump churn chute cinch clang cleat cleft cloak clone clout clove coupe covet cower crank crass crate creak credo creed creep crepe crest crimp croak crock crone crony croup crumb cumin curio curry curse cynic dally debit decal decoy deity delve demon denim deter dicey digit dingo dingy dirge dodgy dogma dolly donut dowdy dowel dowry drawl dread droll drool droop dross duchy dully dummy dunce dusky dusty dutch dwelt dying eerie egret eject elope elude embed emcee enact endow ennui envoy epoch epoxy ethos evade evict evoke exalt excel exert exile expel extol exult facet famed farce fauna feign fella femur feral fetid fetus fiend filer filet filmy filth fishy fjord flack flail flair flake flaky flank flare fleck flick fling flirt flora floss flout fluff fluke flume flung flunk foamy foist folio foray foyer frail freak freer frill frisk fritz frock frond froth frown froze furor furry fussy fuzzy gaffe gaily gamer gamma gamut gassy gaudy gaunt gauze gavel gawky gecko geeky geese genie genre giddy girth gland gleam glean glint gloat gloss gnash gnome godly golem goner goody gooey goofy gorge gouge gourd graft grail grate gravy graze grime grimy gripe grope grout gruel gruff grunt guava guile guise gulch gully gumbo gummy gusto gusty gypsy hairy halve handy hardy harem harpy hasty haunt hazel heady heath heave hefty heist heron hinge hippo hippy hoard hoist homer hunch hunky husky hutch hydro hyena hyper icily icing idiom idiot idler idyll igloo imbue impel inane inbox incur inept inert infer ingot inlay inlet inter intro ionic irate islet itchy jaunt jazzy jerky jetty jiffy jolly joust juror karma kebab khaki kiosk kitty knave knead knelt knoll koala krill laden ladle lager lance lanky lapel lapse larva lasso lathe latte leach leafy leaky leant leapt ledge leech leery lefty leggy lemur leper liege lilac limbo lingo lipid lithe livid llama loamy loath lofty loopy lorry louse lousy lowly lucid lumpy lupus lurch lurid lusty lymph lynch lyric macaw macho madam madly mafia magma maize mamma manga mange mangy mania manic manly marsh mason matey mauve maxim mealy meaty mecca melee melon metro micro midge mimic mince miner minim minty mirth miser missy mocha modal modem mogul molar moldy molly moose mossy motel motif motto moult mound mourn mower mucky mucus muddy mulch mummy munch mural murky mushy musky musty myrrh nadir nanny nasal natal needy neigh newer nicer niche niece nifty ninny ninth nobly noisy nomad noose nudge nutty nylon nymph oaken obese octal oddly odder offal olden older ombre omega optic otter ovary ovate overt ovine ovoid owing paddy pagan palsy pansy papal parer parka parry parse pasty patio patsy patty payee payer peaty pecan penal pence peril perky pesky pesto petal petty phony piety piggy pinky pinto piper pique pithy pivot plaid plait plank plied plier plunk plush poesy poise poker polka polyp poppy poser posit posse pouch pouty prank prawn preen prick primo privy prong prose prowl prude prune psalm pubic pudgy puffy pulpy punky pupal puree purer purge pushy putty pygmy quack quail quake qualm quark quart quash quasi queer quell quern queue quill quirk quoth rabbi rabid racer radii radix rainy rajah ramen randy raspy raven rayon razor rearm recap recur recut reedy refit regal rehab relic remit renal renew repay repel rerun reset resin retch retro retry reuse revel revue rhino rhyme riper risen riser rivet roach rodeo roger rogue roomy roost rotor rouge rouse rover rowdy rower ruddy ruder rupee rusty safer saner sappy sassy satin satyr saucy sauna saute savor savoy savvy scald scalp scaly scamp scant scold scone scorn scour scowl scram scree scrub scrum scuba sedan seedy semen sepia serum setup sever sewer shack shady shale shalt shank shard shave shawl shear sheen sheer sheik shied shire shirk shoal shone shook shorn shove showy shrew shrub shuck shunt shush shyly siege sieve sigma silky sinew singe sissy skier skiff skimp skulk skunk slack slain slang slant slash sleek sleet slept slick slime slimy sling slink sloop slosh sloth slump slung slunk slurp slush slyly smack smash smear smelt smirk smite smith smock smoky snail snare snarl sneer snide sniff snipe snoop snore snort snout snowy snuck snuff soapy sober soggy sooth sooty sower spade spank spasm spawn spear speck spelt sperm spied spiel spiky spilt spiny spite splat split spoil spoof spook spool spout sprig spunk spurn spurt squat squib stale stalk stall stank stark stash stave stead stein stern stink stint stoic stoke stomp stony stork stout strut stump stung stunk stunt suave sulky sully sumac surer surly sushi swami swash swath swell swill swine swirl swish swoon swoop swore sworn swung synod syrup tabby tacit tacky taffy taken taker tally talon tamer tango tangy taper tapir tardy tarot tatty taunt tawny teary tease teddy tenor tense tepee tepid terse testy thigh thong thrum thyme tiara tibia tidal tilde timid tipsy titan tithe tizzy toady toddy tonal tonga tonic topaz torso torus totem towel toxin tract tramp trawl tread triad trice trite troll trope trout trove truce truer tryst tubal tuber tulle tunic turbo tutor twang tweak tweed tweet twine twirl twixt tying udder ulcer umbra uncut undid undue unfed unfit unify unlit unmet unset untie unwed unzip urine usurp utile utter valet valor vapid vaunt venom verge verve vexed vicar vigil viper visor vista vixen vodka vogue vomit vouch waive waltz warty weedy welch welsh wench whack wharf whelp whiff whine whiny whirl whisk whoop widow wield wight willy wimpy wince winch windy wiser wispy witty woken wooer woozy wordy woven wrack wrath wreak wreck wrest wring wrote wrung wryly yearn yeast yummy zesty zonal`;

const ANSWERS = [...new Set(ANSWERS_RAW.split(/\s+/).filter(w => w.length === 5))];
const ALLOWED = new Set([...ANSWERS, ...EXTRA_RAW.split(/\s+/).filter(w => w.length === 5)]);
const ROWS = 6, COLS = 5;
const KEYS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const COLOR = { correct: 'var(--ok)', present: 'var(--warn)', absent: 'var(--muted)' };
const EMOJI = { correct: '🟩', present: '🟨', absent: '⬛' };
const EPOCH = Date.UTC(2021, 5, 19); // day 0

function dayNumber(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Math.floor((Date.UTC(y, m - 1, d) - EPOCH) / 86400000);
}
function evaluate(guess, answer) {
  const res = Array(COLS).fill('absent'); const rem = {};
  for (let i = 0; i < COLS; i++) { if (guess[i] === answer[i]) res[i] = 'correct'; else rem[answer[i]] = (rem[answer[i]] || 0) + 1; }
  for (let i = 0; i < COLS; i++) if (res[i] !== 'correct' && rem[guess[i]] > 0) { res[i] = 'present'; rem[guess[i]]--; }
  return res;
}

export default function (root) {
  const s = store('wordle');
  let custom = s.get('custom', []);
  let source = custom.length && s.get('source') === 'custom' ? 'custom' : 'builtin';
  let mode = s.get('mode', 'daily');
  let stats = s.get('stats', { played: 0, won: 0, streak: 0, maxStreak: 0, dist: [0, 0, 0, 0, 0, 0] });
  let game = null; // { mode, source, answer, guesses: [], date, done, won }
  let current = '';

  // ---------- UI ----------
  const tiles = [];
  const grid = el('div', { style: { display: 'grid', gridTemplateRows: `repeat(${ROWS}, 1fr)`, gap: '5px', width: 'min(100%, 320px)', margin: '0 auto', userSelect: 'none' } });
  for (let r = 0; r < ROWS; r++) {
    const row = el('div', { style: { display: 'grid', gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: '5px' } });
    tiles[r] = [];
    for (let c = 0; c < COLS; c++) {
      const t = el('div', { style: { aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--line)', borderRadius: '6px', fontSize: '26px', fontWeight: '700', textTransform: 'uppercase', transition: 'background .2s, border-color .2s' } });
      tiles[r][c] = t; row.append(t);
    }
    grid.append(row);
  }
  const keyBtns = {};
  const keyboard = el('div', { class: 'col', style: { gap: '6px', alignItems: 'center', margin: '12px 0' } });
  KEYS.forEach((line, i) => {
    const row = el('div', { style: { display: 'flex', gap: '5px', justifyContent: 'center', width: '100%' } });
    if (i === 2) row.append(keyBtn('Enter', 'enter', true));
    for (const ch of line) row.append(keyBtn(ch, ch));
    if (i === 2) row.append(keyBtn('⌫', 'back', true));
    keyboard.append(row);
  });
  function keyBtn(label, key, wide) {
    const b = el('button', { class: 'btn', style: { padding: '0', height: '50px', flex: wide ? '1.6' : '1', maxWidth: wide ? '70px' : '44px', minWidth: '0', fontWeight: '700', textTransform: 'uppercase', fontSize: wide ? '12px' : '15px', touchAction: 'manipulation' }, onclick: () => press(key) }, label);
    keyBtns[key] = b; return b;
  }
  const msg = el('div', { class: 'center', style: { minHeight: '24px', fontWeight: '600' } });
  const statsBox = el('div', { class: 'row', style: { justifyContent: 'center' } });
  const distBox = el('div', { class: 'col', style: { gap: '4px' } });
  const modeSel = el('select', { class: 'select', value: mode, onchange: () => { mode = modeSel.value; s.set('mode', mode); newGame(); } },
    el('option', { value: 'daily' }, 'Daily word'), el('option', { value: 'random' }, 'Random word'));
  const sourceSel = el('select', { class: 'select', onchange: () => { source = sourceSel.value; s.set('source', source); newGame(); } },
    el('option', { value: 'builtin' }, `Built-in list (${ANSWERS.length} answers)`), el('option', { value: 'custom' }, 'Custom list'));
  const shareBtn = el('button', { class: 'btn', onclick: share }, 'Share result');
  const newBtn = el('button', { class: 'btn primary', onclick: () => newGame(true) }, 'New word');
  const revealBtn = el('button', { class: 'btn ghost', onclick: giveUp }, 'Give up');
  const customTa = el('textarea', { class: 'textarea', placeholder: 'Paste your own words, one per line or space separated. Only 5-letter words are kept; they become both answers and allowed guesses.', value: custom.join('\n'), style: { minHeight: '90px' } });
  const customNote = el('span', { class: 'muted small' });
  const customPanel = el('details', { class: 'panel' },
    el('summary', { style: { cursor: 'pointer' } }, 'Custom word list'),
    customTa,
    el('div', { class: 'row' },
      el('button', { class: 'btn', onclick: () => {
        const words = [...new Set((customTa.value.toLowerCase().match(/[a-z]+/g) || []).filter(w => w.length === 5))];
        if (!words.length) { toast('No 5-letter words found'); return; }
        custom = words; s.set('custom', custom); customTa.value = words.join('\n'); updateCustomNote();
        source = 'custom'; sourceSel.value = 'custom'; s.set('source', source); newGame(true);
        toast(`Using ${words.length} custom words`);
      } }, 'Use this list'),
      el('button', { class: 'btn ghost', onclick: () => { custom = []; s.del('custom'); customTa.value = ''; updateCustomNote(); if (source === 'custom') { source = 'builtin'; sourceSel.value = 'builtin'; s.set('source', source); newGame(true); } } }, 'Clear'),
      customNote));
  function updateCustomNote() {
    customNote.textContent = custom.length ? `${custom.length} custom words saved` : 'No custom list yet';
    sourceSel.querySelector('[value=custom]').disabled = !custom.length;
  }

  render(root,
    el('div', { class: 'row' }, modeSel, sourceSel, newBtn, shareBtn, revealBtn),
    msg, grid, keyboard,
    el('div', { class: 'muted small center' }, 'Type with your keyboard or tap the keys. Enter submits, Backspace deletes.'),
    el('div', { class: 'panel' }, el('div', { class: 'small muted' }, 'Statistics'), statsBox, distBox),
    customPanel);

  // ---------- game logic ----------
  function pool() { return source === 'custom' && custom.length ? custom : ANSWERS; }
  function isAllowed(w) { return ALLOWED.has(w) || custom.includes(w); }
  function pickAnswer() {
    const list = pool();
    if (mode === 'daily') { const r = rng(dayNumber(today()) * 7919 + (source === 'custom' ? 17 : 0)); return list[Math.floor(r() * list.length)]; }
    return list[Math.floor(Math.random() * list.length)];
  }
  function newGame(force) {
    const saved = s.get('game');
    const savedMatches = saved && saved.mode === mode && saved.source === source;
    if (mode === 'daily' && savedMatches && saved.date === today()) {
      game = saved; if (force) toast('One daily word per day — switch to Random for more');
    } else if (!force && savedMatches && mode !== 'daily' && !saved.done) {
      game = saved;
    } else {
      game = { mode, source, answer: pickAnswer(), guesses: [], date: today(), done: false, won: false };
    }
    current = ''; save(); draw(); updateStats();
  }
  function save() { s.set('game', game); }
  function press(key) {
    if (!game || game.done) return;
    if (key === 'enter') return submit();
    if (key === 'back') { current = current.slice(0, -1); draw(); return; }
    if (/^[a-z]$/.test(key) && current.length < COLS) { current += key; draw(); }
  }
  function submit() {
    if (current.length < COLS) { shake('Not enough letters'); return; }
    if (!isAllowed(current)) { shake('Not in word list'); return; }
    game.guesses.push(current);
    const won = current === game.answer;
    const r = game.guesses.length - 1;
    revealRow(r, evaluate(current, game.answer));
    current = '';
    if (won || game.guesses.length === ROWS) {
      game.done = true; game.won = won;
      stats.played++;
      if (won) { stats.won++; stats.streak++; stats.maxStreak = Math.max(stats.maxStreak, stats.streak); stats.dist[r]++; }
      else stats.streak = 0;
      s.set('stats', stats);
      setTimeout(() => { msg.textContent = won ? ['Genius!', 'Magnificent!', 'Impressive!', 'Splendid!', 'Great!', 'Phew!'][r] : `The word was ${game.answer.toUpperCase()}`; updateStats(); }, 900);
    }
    save();
  }
  function giveUp() {
    if (!game || game.done) return;
    game.done = true; game.won = false; stats.played++; stats.streak = 0; s.set('stats', stats); save();
    msg.textContent = `The word was ${game.answer.toUpperCase()}`; updateStats();
  }
  function shake(text) {
    msg.textContent = text;
    const row = tiles[game.guesses.length][0].parentNode;
    row.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(0)' }], { duration: 350 });
    setTimeout(() => { if (msg.textContent === text) msg.textContent = ''; }, 1500);
  }
  function paintTile(t, letter, state) {
    t.textContent = letter;
    if (state) { t.style.background = COLOR[state]; t.style.borderColor = COLOR[state]; t.style.color = '#fff'; }
    else { t.style.background = ''; t.style.borderColor = letter ? 'var(--muted)' : 'var(--line)'; t.style.color = ''; }
  }
  function revealRow(r, result, instant) {
    const g = game.guesses[r];
    for (let c = 0; c < COLS; c++) {
      const t = tiles[r][c];
      const apply = () => { paintTile(t, g[c], result[c]); upgradeKey(g[c], result[c]); };
      if (instant) apply();
      else { t.animate([{ transform: 'rotateX(0)' }, { transform: 'rotateX(90deg)' }, { transform: 'rotateX(0)' }], { duration: 400, delay: c * 150 }); setTimeout(apply, c * 150 + 200); }
    }
  }
  const RANK = { absent: 1, present: 2, correct: 3 };
  function upgradeKey(ch, state) {
    const b = keyBtns[ch]; if (!b) return;
    if ((RANK[b.dataset.state] || 0) >= RANK[state]) return;
    b.dataset.state = state; b.style.background = COLOR[state]; b.style.borderColor = COLOR[state]; b.style.color = '#fff';
  }
  function draw() {
    msg.textContent = '';
    for (const k in keyBtns) { const b = keyBtns[k]; delete b.dataset.state; b.style.background = ''; b.style.borderColor = ''; b.style.color = ''; }
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) paintTile(tiles[r][c], '', null);
    game.guesses.forEach((g, r) => revealRow(r, evaluate(g, game.answer), true));
    const r = game.guesses.length;
    if (r < ROWS) for (let c = 0; c < current.length; c++) paintTile(tiles[r][c], current[c], null);
    if (game.done) msg.textContent = game.won ? `Solved in ${game.guesses.length}/${ROWS}` : `The word was ${game.answer.toUpperCase()}`;
    newBtn.disabled = mode === 'daily' && !game.done;
    shareBtn.disabled = !game.done;
    revealBtn.disabled = game.done;
  }
  function updateStats() {
    const pct = stats.played ? Math.round(100 * stats.won / stats.played) : 0;
    render(statsBox, stat(stats.played, 'played'), stat(pct + '%', 'win rate'), stat(stats.streak, 'streak'), stat(stats.maxStreak, 'max streak'));
    const max = Math.max(1, ...stats.dist);
    render(distBox, stats.dist.map((n, i) => el('div', { class: 'row', style: { margin: 0, gap: '6px', flexWrap: 'nowrap' } },
      el('span', { class: 'mono small', style: { width: '14px' } }, i + 1),
      el('div', { class: 'bar grow' }, el('div', { style: { width: Math.max(4, 100 * n / max) + '%', background: game && game.done && game.won && game.guesses.length === i + 1 ? 'var(--ok)' : '' } })),
      el('span', { class: 'mono small', style: { width: '30px' } }, n))));
  }
  function share() {
    if (!game || !game.done) return;
    const head = mode === 'daily' ? `Wordle ${dayNumber(game.date)}` : 'Wordle (random)';
    const lines = game.guesses.map(g => evaluate(g, game.answer).map(x => EMOJI[x]).join(''));
    copy(`${head} ${game.won ? game.guesses.length : 'X'}/${ROWS}${source === 'custom' ? ' (custom list)' : ''}\n\n${lines.join('\n')}`);
  }

  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === 'Enter') { e.preventDefault(); press('enter'); }
    else if (e.key === 'Backspace') { e.preventDefault(); press('back'); }
    else if (e.key === 'Escape') { current = ''; draw(); }
    else if (/^[a-zA-Z]$/.test(e.key)) press(e.key.toLowerCase());
  }
  window.addEventListener('keydown', onKey);

  updateCustomNote(); sourceSel.value = source;
  newGame();
  return () => window.removeEventListener('keydown', onKey);
}
