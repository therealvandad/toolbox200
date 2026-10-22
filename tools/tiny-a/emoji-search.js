import { el, render, store, copy } from '../../lib/ui.js';

// Format per line: emoji name|extra keywords
const RAW = `
😀 grinning face|happy smile
😃 grinning face with big eyes|happy joy
😄 grinning face with smiling eyes|happy laugh
😁 beaming face|grin teeth
😆 grinning squinting face|laugh haha
😅 grinning face with sweat|nervous relief
🤣 rolling on the floor laughing|rofl lol funny
😂 face with tears of joy|lol laugh cry funny
🙂 slightly smiling face|smile fine
🙃 upside-down face|silly sarcasm
😉 winking face|wink flirt
😊 smiling face with smiling eyes|blush happy
😇 smiling face with halo|angel innocent
🥰 smiling face with hearts|love adore
😍 smiling face with heart-eyes|love crush
🤩 star-struck|wow amazed
😘 face blowing a kiss|kiss love
😗 kissing face|kiss
😚 kissing face with closed eyes|kiss
😋 face savoring food|yum tasty delicious
😛 face with tongue|silly playful
😜 winking face with tongue|crazy joke
🤪 zany face|crazy wild goofy
😝 squinting face with tongue|silly
🤑 money-mouth face|rich dollar
🤗 hugging face|hug warm
🤭 face with hand over mouth|oops giggle
🤫 shushing face|quiet secret
🤔 thinking face|hmm think
🤐 zipper-mouth face|secret silent
🤨 face with raised eyebrow|skeptical suspicious
😐 neutral face|meh blank
😑 expressionless face|blank
😶 face without mouth|silent speechless
😏 smirking face|smug
😒 unamused face|annoyed
🙄 face with rolling eyes|eyeroll whatever
😬 grimacing face|awkward cringe
😮‍💨 face exhaling|sigh relief
🤥 lying face|pinocchio liar
😌 relieved face|calm peaceful
😔 pensive face|sad thoughtful
😪 sleepy face|tired
🤤 drooling face|hungry
😴 sleeping face|zzz sleep tired
😷 face with medical mask|sick covid
🤒 face with thermometer|sick fever ill
🤕 face with head-bandage|hurt injured
🤢 nauseated face|sick gross
🤮 face vomiting|sick throw up
🤧 sneezing face|cold achoo
🥵 hot face|heat sweating
🥶 cold face|freezing
🥴 woozy face|drunk dizzy
😵 face with crossed-out eyes|dizzy dead
🤯 exploding head|mind blown shocked
🤠 cowboy hat face|western
🥳 partying face|celebrate party birthday
😎 smiling face with sunglasses|cool
🤓 nerd face|geek smart
🧐 face with monocle|inspect curious
😕 confused face|puzzled
😟 worried face|anxious
🙁 slightly frowning face|sad
☹️ frowning face|sad
😮 face with open mouth|surprised wow
😯 hushed face|surprised
😲 astonished face|shocked
😳 flushed face|embarrassed blush
🥺 pleading face|puppy eyes please
😦 frowning face with open mouth|shocked
😧 anguished face|pain
😨 fearful face|scared
😰 anxious face with sweat|nervous
😥 sad but relieved face|disappointed
😢 crying face|sad tear
😭 loudly crying face|sob sad
😱 face screaming in fear|scared horror
😖 confounded face|frustrated
😣 persevering face|struggle
😞 disappointed face|sad
😓 downcast face with sweat|tired
😩 weary face|tired exhausted
😫 tired face|exhausted
🥱 yawning face|bored sleepy
😤 face with steam from nose|angry triumph
😡 enraged face|angry mad red
😠 angry face|mad
🤬 face with symbols on mouth|swearing cursing
😈 smiling face with horns|devil evil
👿 angry face with horns|devil
💀 skull|dead death
☠️ skull and crossbones|danger pirate poison
💩 pile of poo|poop
🤡 clown face|joker
👻 ghost|halloween spooky
👽 alien|extraterrestrial ufo
🤖 robot|bot machine
🎃 jack-o-lantern|halloween pumpkin
😺 grinning cat|cat happy
😸 grinning cat with smiling eyes|cat
😻 smiling cat with heart-eyes|cat love
🙈 see-no-evil monkey|monkey hide
🙉 hear-no-evil monkey|monkey
🙊 speak-no-evil monkey|monkey oops
💋 kiss mark|lips
💌 love letter|mail heart
❤️ red heart|love
🧡 orange heart|love
💛 yellow heart|love
💚 green heart|love
💙 blue heart|love
💜 purple heart|love
🖤 black heart|love dark
🤍 white heart|love
🤎 brown heart|love
💔 broken heart|sad breakup
❤️‍🔥 heart on fire|passion love
💕 two hearts|love
💞 revolving hearts|love
💓 beating heart|love
💗 growing heart|love
💖 sparkling heart|love
💘 heart with arrow|cupid love
💝 heart with ribbon|gift love
💯 hundred points|perfect score
💢 anger symbol|mad
💥 collision|boom explosion
💫 dizzy|star
💦 sweat droplets|water splash
💨 dashing away|wind fast
💬 speech balloon|chat comment
💭 thought balloon|think
💤 zzz|sleep
👋 waving hand|hello hi bye
🤚 raised back of hand|stop
🖐️ hand with fingers splayed|high five
✋ raised hand|stop high five
🖖 vulcan salute|spock
👌 ok hand|okay perfect
🤌 pinched fingers|italian
✌️ victory hand|peace
🤞 crossed fingers|luck hope
🤟 love-you gesture|rock
🤘 sign of the horns|rock metal
🤙 call me hand|phone shaka
👈 backhand index pointing left|left
👉 backhand index pointing right|right
👆 backhand index pointing up|up
👇 backhand index pointing down|down
☝️ index pointing up|one
👍 thumbs up|like yes good approve
👎 thumbs down|dislike no bad
✊ raised fist|power
👊 oncoming fist|punch
👏 clapping hands|applause bravo
🙌 raising hands|celebrate hooray
👐 open hands|jazz
🤲 palms up together|prayer
🤝 handshake|deal agreement
🙏 folded hands|please thanks pray
✍️ writing hand|write
💅 nail polish|beauty
🤳 selfie|phone
💪 flexed biceps|strong muscle
🦵 leg|kick
🦶 foot|step
👂 ear|listen
👃 nose|smell
🧠 brain|smart mind
🦷 tooth|dentist
👀 eyes|look watch
👁️ eye|see
👅 tongue|taste
👄 mouth|lips
👶 baby|child
🧒 child|kid
👦 boy|kid
👧 girl|kid
🧑 person|adult
👨 man|male
👩 woman|female
🧓 older person|senior
👴 old man|grandpa
👵 old woman|grandma
🙍 person frowning|sad
🙋 person raising hand|question volunteer
🤦 person facepalming|facepalm
🤷 person shrugging|shrug idk
💁 person tipping hand|information
🙆 person gesturing ok|ok
👮 police officer|cop
💂 guard|british
🕵️ detective|spy
👷 construction worker|builder
🤴 prince|royal
👸 princess|royal
🦸 superhero|hero
🧙 mage|wizard witch
🧛 vampire|dracula
🧜 merperson|mermaid
🧚 fairy|magic
🧞 genie|wish
🧟 zombie|undead
💃 woman dancing|dance
🕺 man dancing|dance
🏃 person running|run
🚶 person walking|walk
🧘 person in lotus position|yoga meditate
👪 family|parents
👣 footprints|steps
🐶 dog face|puppy pet
🐱 cat face|kitten pet
🐭 mouse face|rodent
🐹 hamster|pet
🐰 rabbit face|bunny
🦊 fox|animal
🐻 bear|animal
🐼 panda|bear
🐨 koala|australia
🐯 tiger face|animal
🦁 lion|animal king
🐮 cow face|animal
🐷 pig face|animal
🐸 frog|toad
🐵 monkey face|animal
🐔 chicken|bird
🐧 penguin|bird
🐦 bird|tweet
🐤 baby chick|bird
🦆 duck|bird
🦅 eagle|bird
🦉 owl|bird night
🦇 bat|vampire
🐺 wolf|animal
🐗 boar|pig
🐴 horse face|animal
🦄 unicorn|magic
🐝 honeybee|bug insect
🐛 bug|caterpillar insect
🦋 butterfly|insect
🐌 snail|slow
🐞 lady beetle|ladybug
🐜 ant|insect
🕷️ spider|arachnid
🦂 scorpion|arachnid
🐢 turtle|slow
🐍 snake|reptile
🦎 lizard|reptile
🦖 t-rex|dinosaur
🐙 octopus|sea
🦑 squid|sea
🦀 crab|sea
🐠 tropical fish|sea
🐟 fish|sea
🐬 dolphin|sea
🐳 spouting whale|sea
🦈 shark|sea
🐊 crocodile|reptile
🐘 elephant|animal
🦒 giraffe|animal
🦓 zebra|animal
🐪 camel|desert
🐑 sheep|animal
🐐 goat|animal
🦌 deer|animal
🐕 dog|pet
🐈 cat|pet
🐇 rabbit|bunny
🦔 hedgehog|animal
🌵 cactus|desert plant
🎄 christmas tree|holiday
🌲 evergreen tree|pine
🌳 deciduous tree|nature
🌴 palm tree|tropical beach
🌱 seedling|plant sprout
🌿 herb|plant
☘️ shamrock|clover irish
🍀 four leaf clover|luck
🍁 maple leaf|autumn canada
🍂 fallen leaf|autumn
🍄 mushroom|fungus
🌹 rose|flower love
🌷 tulip|flower
🌸 cherry blossom|flower spring
🌺 hibiscus|flower
🌻 sunflower|flower
🌼 blossom|flower
💐 bouquet|flowers
🍎 red apple|fruit
🍏 green apple|fruit
🍐 pear|fruit
🍊 tangerine|orange fruit
🍋 lemon|fruit citrus
🍌 banana|fruit
🍉 watermelon|fruit
🍇 grapes|fruit
🍓 strawberry|fruit
🫐 blueberries|fruit
🍒 cherries|fruit
🍑 peach|fruit
🥭 mango|fruit
🍍 pineapple|fruit
🥥 coconut|fruit
🥝 kiwi fruit|fruit
🍅 tomato|vegetable
🥑 avocado|fruit
🍆 eggplant|aubergine
🥕 carrot|vegetable
🌽 ear of corn|maize
🌶️ hot pepper|spicy chili
🥦 broccoli|vegetable
🥔 potato|vegetable
🧄 garlic|food
🧅 onion|food
🍞 bread|loaf toast
🥐 croissant|pastry french
🥖 baguette|bread french
🧀 cheese wedge|dairy
🥚 egg|breakfast
🍳 cooking|fried egg pan
🥞 pancakes|breakfast
🥓 bacon|breakfast
🍗 poultry leg|chicken
🍖 meat on bone|food
🌭 hot dog|food
🍔 hamburger|burger food
🍟 french fries|chips
🍕 pizza|food slice
🥪 sandwich|food
🌮 taco|mexican
🌯 burrito|mexican
🥗 green salad|healthy
🍝 spaghetti|pasta
🍜 steaming bowl|ramen noodles
🍣 sushi|japanese
🍤 fried shrimp|prawn
🍙 rice ball|japanese onigiri
🍚 cooked rice|food
🍦 soft ice cream|dessert
🍩 doughnut|donut dessert
🍪 cookie|biscuit dessert
🎂 birthday cake|party dessert
🍰 shortcake|cake dessert
🧁 cupcake|dessert
🍫 chocolate bar|candy sweet
🍬 candy|sweet
🍭 lollipop|candy sweet
🍿 popcorn|movie snack
☕ hot beverage|coffee tea
🍵 teacup without handle|green tea
🍺 beer mug|drink pub
🍻 clinking beer mugs|cheers drink
🥂 clinking glasses|cheers champagne
🍷 wine glass|drink
🍸 cocktail glass|martini drink
🍹 tropical drink|cocktail
🥤 cup with straw|soda drink
🧃 beverage box|juice
🥛 glass of milk|drink
🍼 baby bottle|milk
⚽ soccer ball|football sport
🏀 basketball|sport
🏈 american football|sport
⚾ baseball|sport
🎾 tennis|sport racket
🏐 volleyball|sport
🏉 rugby football|sport
🎱 pool 8 ball|billiards
🏓 ping pong|table tennis
🏸 badminton|sport
🥊 boxing glove|fight
⛳ flag in hole|golf
🏆 trophy|winner prize
🥇 1st place medal|gold winner
🥈 2nd place medal|silver
🥉 3rd place medal|bronze
🎮 video game|controller gaming
🕹️ joystick|arcade game
🎲 game die|dice random
🎯 bullseye|target dart
🧩 puzzle piece|jigsaw
♟️ chess pawn|game
🎨 artist palette|paint art
🎭 performing arts|theater drama
🎬 clapper board|movie film
🎤 microphone|sing karaoke
🎧 headphone|music listen
🎵 musical note|music
🎶 musical notes|music
🎹 musical keyboard|piano
🥁 drum|music
🎸 guitar|music rock
🎺 trumpet|music
🎻 violin|music
🚗 automobile|car
🚕 taxi|cab
🚌 bus|transport
🏎️ racing car|fast
🚓 police car|cop
🚑 ambulance|emergency
🚒 fire engine|firefighter
🚚 delivery truck|lorry
🚜 tractor|farm
🏍️ motorcycle|bike
🚲 bicycle|bike cycle
🛴 kick scooter|transport
🚂 locomotive|train
🚄 high-speed train|fast
🚀 rocket|space launch
🛸 flying saucer|ufo
✈️ airplane|flight travel
🚁 helicopter|flight
⛵ sailboat|boat
🚢 ship|boat cruise
⚓ anchor|ship
🚦 vertical traffic light|signal
🚧 construction|roadwork
⛽ fuel pump|gas petrol
🏠 house|home
🏡 house with garden|home
🏢 office building|work
🏥 hospital|medical
🏦 bank|money
🏫 school|education
🏰 castle|medieval
🗼 tokyo tower|japan
🗽 statue of liberty|usa new york
🗻 mount fuji|japan mountain
🏔️ snow-capped mountain|alps
⛰️ mountain|hill
🌋 volcano|eruption
🏖️ beach with umbrella|vacation
🏝️ desert island|vacation
⛺ tent|camping
🌍 globe showing europe-africa|world earth
🌎 globe showing americas|world earth
🌏 globe showing asia-australia|world earth
🌐 globe with meridians|internet web
🗺️ world map|travel
🧭 compass|navigation
🌅 sunrise|morning
🌄 sunrise over mountains|morning
🌇 sunset|evening
🌃 night with stars|city
🌉 bridge at night|city
🌈 rainbow|colorful pride
☀️ sun|sunny weather
🌤️ sun behind small cloud|weather
⛅ sun behind cloud|weather
☁️ cloud|weather
🌧️ cloud with rain|weather
⛈️ cloud with lightning and rain|storm
🌩️ cloud with lightning|storm
❄️ snowflake|cold winter
☃️ snowman|winter
⛄ snowman without snow|winter
🌨️ cloud with snow|weather
🌪️ tornado|storm
🌫️ fog|weather
💧 droplet|water
🌊 water wave|ocean sea
🔥 fire|hot flame lit
⚡ high voltage|lightning electric
⭐ star|favorite
🌟 glowing star|sparkle
✨ sparkles|shiny magic new
🌙 crescent moon|night
🌕 full moon|night
🌑 new moon|night
🌞 sun with face|sunny
🌝 full moon face|night
🪐 ringed planet|saturn space
☄️ comet|space
🎉 party popper|celebrate tada
🎊 confetti ball|celebrate
🎈 balloon|party
🎁 wrapped gift|present birthday
🎀 ribbon|bow
🎆 fireworks|celebrate
🎇 sparkler|celebrate
🎗️ reminder ribbon|awareness
🎟️ admission tickets|event
🎫 ticket|event
📱 mobile phone|smartphone
📞 telephone receiver|call
☎️ telephone|call
📺 television|tv
📷 camera|photo
📸 camera with flash|photo
📹 video camera|record
🎥 movie camera|film
💻 laptop|computer
🖥️ desktop computer|pc
⌨️ keyboard|typing
🖱️ computer mouse|pc
🖨️ printer|print
💾 floppy disk|save
💿 optical disk|cd
📀 dvd|disc
🔋 battery|power
🔌 electric plug|power
💡 light bulb|idea
🔦 flashlight|torch
🕯️ candle|light
📚 books|read library
📖 open book|read
📕 closed book|read
📝 memo|note write
✏️ pencil|write
🖊️ pen|write
🖌️ paintbrush|art
📎 paperclip|attach
📌 pushpin|pin
📍 round pushpin|location
✂️ scissors|cut
📏 straight ruler|measure
📐 triangular ruler|measure
🗑️ wastebasket|trash delete
📁 file folder|directory
📂 open file folder|directory
📅 calendar|date
📆 tear-off calendar|date
📈 chart increasing|growth up
📉 chart decreasing|decline down
📊 bar chart|stats
📋 clipboard|list
📧 e-mail|mail
✉️ envelope|mail letter
📦 package|box delivery
📮 postbox|mail
🔒 locked|secure
🔓 unlocked|open
🔑 key|password
🗝️ old key|vintage
🔨 hammer|tool build
🪓 axe|tool
⛏️ pick|tool mining
🔧 wrench|tool fix
🔩 nut and bolt|tool
⚙️ gear|settings cog
🧰 toolbox|tools
🧲 magnet|attract
🔬 microscope|science
🔭 telescope|astronomy
📡 satellite antenna|signal
💉 syringe|vaccine medical
💊 pill|medicine
🩹 adhesive bandage|plaster
🧬 dna|genetics
🧪 test tube|chemistry
⚖️ balance scale|law justice
🛒 shopping cart|buy
💰 money bag|cash rich
💵 dollar banknote|cash
💳 credit card|payment
💎 gem stone|diamond
⏰ alarm clock|time wake
⏱️ stopwatch|timer
⏳ hourglass not done|time
⌛ hourglass done|time
🕐 one o'clock|time clock
⌚ watch|time
🔔 bell|notification
🔕 bell with slash|mute
📢 loudspeaker|announce
📣 megaphone|announce
🔊 speaker high volume|sound
🔇 muted speaker|silent
🔍 magnifying glass tilted left|search find
🔎 magnifying glass tilted right|search zoom
🏷️ label|tag price
🚩 triangular flag|red flag
🏁 chequered flag|race finish
🏳️ white flag|surrender
🏴 black flag|pirate
🏳️‍🌈 rainbow flag|pride lgbt
✅ check mark button|done yes
✔️ check mark|done tick
☑️ check box with check|done
❌ cross mark|no wrong
❎ cross mark button|no
❓ question mark|help what
❗ exclamation mark|warning
⚠️ warning|caution alert
🚫 prohibited|forbidden no
⛔ no entry|stop
🛑 stop sign|halt
♻️ recycling symbol|environment
➕ plus|add
➖ minus|subtract
➗ divide|division
✖️ multiply|times
➡️ right arrow|next
⬅️ left arrow|back
⬆️ up arrow|up
⬇️ down arrow|down
↗️ up-right arrow|diagonal
🔄 counterclockwise arrows button|refresh reload
🔁 repeat button|loop
🔀 shuffle tracks button|random
▶️ play button|start
⏸️ pause button|wait
⏹️ stop button|end
⏩ fast-forward button|skip
🔝 top arrow|top
🆗 ok button|okay
🆒 cool button|cool
🆕 new button|new
🆓 free button|free
🔴 red circle|dot
🟠 orange circle|dot
🟡 yellow circle|dot
🟢 green circle|dot
🔵 blue circle|dot
🟣 purple circle|dot
⚫ black circle|dot
⚪ white circle|dot
🟥 red square|box
🟦 blue square|box
🟩 green square|box
🔶 large orange diamond|shape
🔷 large blue diamond|shape
♠️ spade suit|cards
♥️ heart suit|cards
♦️ diamond suit|cards
♣️ club suit|cards
🃏 joker|cards
🀄 mahjong red dragon|game
©️ copyright|legal
®️ registered|legal
™️ trade mark|tm
♾️ infinity|forever
👑 crown|king queen royal
🎩 top hat|fancy
🎓 graduation cap|school degree
👓 glasses|eyewear
🕶️ sunglasses|cool
👔 necktie|formal
👕 t-shirt|clothes
👖 jeans|clothes
🧣 scarf|winter
🧤 gloves|winter
🧥 coat|winter
👗 dress|clothes
👙 bikini|beach
👟 running shoe|sneaker
👠 high-heeled shoe|fashion
👢 boot|shoe
👜 handbag|purse
🎒 backpack|school bag
💼 briefcase|work
☂️ umbrella|rain
🌂 closed umbrella|rain
🛌 person in bed|sleep
🛁 bathtub|bath
🚿 shower|bath
🚽 toilet|bathroom
🧻 roll of paper|toilet
🧼 soap|clean
🧽 sponge|clean
🛋️ couch and lamp|sofa
🪑 chair|seat
🚪 door|entrance
🪞 mirror|reflection
🪟 window|glass
🧸 teddy bear|toy
🪁 kite|toy
🪄 magic wand|wizard
🔮 crystal ball|fortune
🧿 nazar amulet|evil eye
`;

const EMOJI = RAW.trim().split('\n').map(line => {
  const [head, kw = ''] = line.split('|');
  const sp = head.indexOf(' ');
  const o = { e: head.slice(0, sp), name: head.slice(sp + 1).trim(), kw: kw.trim() };
  o.hay = (o.name + ' ' + o.kw).toLowerCase();
  return o;
});

export default function (root) {
  const s = store('emoji-search');
  let recent = s.get('recent', []);
  const search = el('input', { class: 'input grow', type: 'search', placeholder: 'Search ' + EMOJI.length + ' emoji (e.g. heart, cat, party)…', style: { minWidth: '200px' } });
  const grid = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(52px,1fr))', gap: '6px' } });
  const info = el('div', { class: 'small muted' });
  const recentBox = el('div', { class: 'row' });
  const preview = el('div', { class: 'small muted' }, 'Click an emoji to copy it.');

  function pick(o) {
    copy(o.e);
    recent = [o.e, ...recent.filter(x => x !== o.e)].slice(0, 24);
    s.set('recent', recent);
    render(preview, el('span', { style: { fontSize: '28px', marginRight: '8px' } }, o.e), o.name);
    drawRecent();
  }
  function cell(o) {
    return el('button', { class: 'btn ghost', title: o.name, style: { fontSize: '26px', padding: '6px 0', lineHeight: '1.1' }, onclick: () => pick(o) }, o.e);
  }
  function drawRecent() {
    const items = recent.map(e => EMOJI.find(o => o.e === e)).filter(Boolean);
    render(recentBox,
      el('strong', { class: 'small' }, 'Recent:'),
      items.length ? items.map(o => el('button', { class: 'btn ghost', title: o.name, style: { fontSize: '22px', padding: '2px 6px' }, onclick: () => pick(o) }, o.e)) : el('span', { class: 'small muted' }, 'nothing yet'),
      items.length ? el('button', { class: 'btn small ghost', onclick: () => { recent = []; s.set('recent', recent); drawRecent(); } }, 'Clear') : null);
  }
  function update() {
    const terms = search.value.toLowerCase().split(/\s+/).filter(Boolean);
    const found = terms.length ? EMOJI.filter(o => terms.every(t => o.hay.includes(t))) : EMOJI;
    render(grid, found.map(cell));
    render(info, found.length ? `${found.length} emoji${terms.length ? ' match' : ''}` : 'No emoji match your search.');
  }
  search.addEventListener('input', update);
  search.addEventListener('keydown', e => { if (e.key === 'Escape') { search.value = ''; update(); } });

  render(root, el('div', { class: 'row' }, search), recentBox, el('div', { class: 'panel' }, preview), info, grid);
  drawRecent();
  update();
}
