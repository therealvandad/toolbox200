// Country capitals and flags quiz: 195 countries, multiple choice, region filter, streaks.
import { el, render, store, stat, shuffle } from '../../lib/ui.js';

const DATA = {
  Africa: `DZ|Algeria|Algiers;AO|Angola|Luanda;BJ|Benin|Porto-Novo;BW|Botswana|Gaborone;BF|Burkina Faso|Ouagadougou;BI|Burundi|Gitega;CV|Cabo Verde|Praia;CM|Cameroon|Yaoundé;CF|Central African Republic|Bangui;TD|Chad|N'Djamena;KM|Comoros|Moroni;CG|Republic of the Congo|Brazzaville;CD|DR Congo|Kinshasa;CI|Côte d'Ivoire|Yamoussoukro;DJ|Djibouti|Djibouti;EG|Egypt|Cairo;GQ|Equatorial Guinea|Malabo;ER|Eritrea|Asmara;SZ|Eswatini|Mbabane;ET|Ethiopia|Addis Ababa;GA|Gabon|Libreville;GM|Gambia|Banjul;GH|Ghana|Accra;GN|Guinea|Conakry;GW|Guinea-Bissau|Bissau;KE|Kenya|Nairobi;LS|Lesotho|Maseru;LR|Liberia|Monrovia;LY|Libya|Tripoli;MG|Madagascar|Antananarivo;MW|Malawi|Lilongwe;ML|Mali|Bamako;MR|Mauritania|Nouakchott;MU|Mauritius|Port Louis;MA|Morocco|Rabat;MZ|Mozambique|Maputo;NA|Namibia|Windhoek;NE|Niger|Niamey;NG|Nigeria|Abuja;RW|Rwanda|Kigali;ST|São Tomé and Príncipe|São Tomé;SN|Senegal|Dakar;SC|Seychelles|Victoria;SL|Sierra Leone|Freetown;SO|Somalia|Mogadishu;ZA|South Africa|Pretoria;SS|South Sudan|Juba;SD|Sudan|Khartoum;TZ|Tanzania|Dodoma;TG|Togo|Lomé;TN|Tunisia|Tunis;UG|Uganda|Kampala;ZM|Zambia|Lusaka;ZW|Zimbabwe|Harare`,
  Asia: `AF|Afghanistan|Kabul;AM|Armenia|Yerevan;AZ|Azerbaijan|Baku;BH|Bahrain|Manama;BD|Bangladesh|Dhaka;BT|Bhutan|Thimphu;BN|Brunei|Bandar Seri Begawan;KH|Cambodia|Phnom Penh;CN|China|Beijing;CY|Cyprus|Nicosia;GE|Georgia|Tbilisi;IN|India|New Delhi;ID|Indonesia|Jakarta;IR|Iran|Tehran;IQ|Iraq|Baghdad;IL|Israel|Jerusalem;JP|Japan|Tokyo;JO|Jordan|Amman;KZ|Kazakhstan|Astana;KW|Kuwait|Kuwait City;KG|Kyrgyzstan|Bishkek;LA|Laos|Vientiane;LB|Lebanon|Beirut;MY|Malaysia|Kuala Lumpur;MV|Maldives|Malé;MN|Mongolia|Ulaanbaatar;MM|Myanmar|Naypyidaw;NP|Nepal|Kathmandu;KP|North Korea|Pyongyang;OM|Oman|Muscat;PK|Pakistan|Islamabad;PH|Philippines|Manila;QA|Qatar|Doha;SA|Saudi Arabia|Riyadh;SG|Singapore|Singapore;KR|South Korea|Seoul;LK|Sri Lanka|Sri Jayawardenepura Kotte;SY|Syria|Damascus;TW|Taiwan|Taipei;TJ|Tajikistan|Dushanbe;TH|Thailand|Bangkok;TL|Timor-Leste|Dili;TR|Turkey|Ankara;TM|Turkmenistan|Ashgabat;AE|United Arab Emirates|Abu Dhabi;UZ|Uzbekistan|Tashkent;VN|Vietnam|Hanoi;YE|Yemen|Sana'a`,
  Europe: `AL|Albania|Tirana;AD|Andorra|Andorra la Vella;AT|Austria|Vienna;BY|Belarus|Minsk;BE|Belgium|Brussels;BA|Bosnia and Herzegovina|Sarajevo;BG|Bulgaria|Sofia;HR|Croatia|Zagreb;CZ|Czechia|Prague;DK|Denmark|Copenhagen;EE|Estonia|Tallinn;FI|Finland|Helsinki;FR|France|Paris;DE|Germany|Berlin;GR|Greece|Athens;HU|Hungary|Budapest;IS|Iceland|Reykjavík;IE|Ireland|Dublin;IT|Italy|Rome;LV|Latvia|Riga;LI|Liechtenstein|Vaduz;LT|Lithuania|Vilnius;LU|Luxembourg|Luxembourg;MT|Malta|Valletta;MD|Moldova|Chișinău;MC|Monaco|Monaco;ME|Montenegro|Podgorica;NL|Netherlands|Amsterdam;MK|North Macedonia|Skopje;NO|Norway|Oslo;PL|Poland|Warsaw;PT|Portugal|Lisbon;RO|Romania|Bucharest;RU|Russia|Moscow;SM|San Marino|San Marino;RS|Serbia|Belgrade;SK|Slovakia|Bratislava;SI|Slovenia|Ljubljana;ES|Spain|Madrid;SE|Sweden|Stockholm;CH|Switzerland|Bern;UA|Ukraine|Kyiv;GB|United Kingdom|London;VA|Vatican City|Vatican City`,
  Americas: `AG|Antigua and Barbuda|St. John's;AR|Argentina|Buenos Aires;BS|Bahamas|Nassau;BB|Barbados|Bridgetown;BZ|Belize|Belmopan;BO|Bolivia|Sucre;BR|Brazil|Brasília;CA|Canada|Ottawa;CL|Chile|Santiago;CO|Colombia|Bogotá;CR|Costa Rica|San José;CU|Cuba|Havana;DM|Dominica|Roseau;DO|Dominican Republic|Santo Domingo;EC|Ecuador|Quito;SV|El Salvador|San Salvador;GD|Grenada|St. George's;GT|Guatemala|Guatemala City;GY|Guyana|Georgetown;HT|Haiti|Port-au-Prince;HN|Honduras|Tegucigalpa;JM|Jamaica|Kingston;MX|Mexico|Mexico City;NI|Nicaragua|Managua;PA|Panama|Panama City;PY|Paraguay|Asunción;PE|Peru|Lima;KN|Saint Kitts and Nevis|Basseterre;LC|Saint Lucia|Castries;VC|Saint Vincent and the Grenadines|Kingstown;SR|Suriname|Paramaribo;TT|Trinidad and Tobago|Port of Spain;US|United States|Washington, D.C.;UY|Uruguay|Montevideo;VE|Venezuela|Caracas`,
  Oceania: `AU|Australia|Canberra;FJ|Fiji|Suva;KI|Kiribati|Tarawa;MH|Marshall Islands|Majuro;FM|Micronesia|Palikir;NR|Nauru|Yaren;NZ|New Zealand|Wellington;PW|Palau|Ngerulmud;PG|Papua New Guinea|Port Moresby;WS|Samoa|Apia;SB|Solomon Islands|Honiara;TO|Tonga|Nukuʻalofa;TV|Tuvalu|Funafuti;VU|Vanuatu|Port Vila`,
};
const flag = cc => String.fromCodePoint(...[...cc].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
const COUNTRIES = Object.entries(DATA).flatMap(([region, str]) => str.split(';').map(x => { const [cc, name, capital] = x.split('|'); return { cc, name, capital, region, flag: flag(cc) }; }));
const REGIONS = Object.keys(DATA);

export default function (root) {
  const s = store('capitals-quiz');
  const MODES = { c2cap: 'Country → Capital', cap2c: 'Capital → Country', f2c: 'Flag → Country', f2cap: 'Flag → Capital' };
  let mode = s.get('mode', 'c2cap');
  let regions = new Set(s.get('regions', REGIONS));
  let score = s.get('score', { total: 0, correct: 0, streak: 0, best: 0 });
  let missed = s.get('missed', {});
  let current = null, opts = [], locked = false, timer = null;

  const modeSel = el('select', { class: 'select', onchange: () => { mode = modeSel.value; s.set('mode', mode); ask(); } },
    Object.entries(MODES).map(([v, t]) => el('option', { value: v, selected: v === mode }, t)));
  const regionRow = el('div', { class: 'row' });
  function drawRegions() {
    render(regionRow, REGIONS.map(r => el('label', { class: 'inline' },
      el('input', { type: 'checkbox', checked: regions.has(r), onchange: e => { e.target.checked ? regions.add(r) : regions.delete(r); if (!regions.size) { regions.add(r); e.target.checked = true; } s.set('regions', [...regions]); ask(); } }), r)));
  }
  drawRegions();

  const prompt = el('div', { class: 'center', style: { padding: '14px 0' } });
  const choices = el('div', { class: 'row', style: { justifyContent: 'center' } });
  const fb = el('div', { class: 'center small', style: { minHeight: '24px' } });
  const scoreRow = el('div', { class: 'row' });
  function drawScore() {
    const acc = score.total ? Math.round(score.correct / score.total * 100) : 0;
    render(scoreRow, stat(score.correct + '/' + score.total, 'correct'), stat(acc + '%', 'accuracy'), stat(score.streak, 'streak'), stat(score.best, 'best streak'));
    s.set('score', score);
  }

  const answerKind = () => mode.endsWith('cap') ? 'capital' : 'name';
  function ask() {
    locked = false;
    const pool = COUNTRIES.filter(c => regions.has(c.region));
    const weighted = pool.flatMap(c => Array(1 + Math.min(3, missed[c.cc] || 0)).fill(c));
    current = weighted[Math.floor(Math.random() * weighted.length)];
    const sameRegion = shuffle(pool.filter(c => c !== current));
    const others = shuffle(COUNTRIES.filter(c => c !== current && !sameRegion.includes(c)));
    opts = shuffle([current, ...[...sameRegion, ...others].slice(0, 3)]);
    const kind = answerKind();
    let big, hint;
    if (mode === 'c2cap') { big = current.flag + ' ' + current.name; hint = 'What is the capital of'; }
    else if (mode === 'cap2c') { big = current.capital; hint = 'Which country has the capital'; }
    else { big = current.flag; hint = kind === 'name' ? 'Which country is this flag?' : 'What is the capital of this country?'; }
    render(prompt, el('div', { class: 'muted small' }, hint), el('div', { class: mode.startsWith('f') ? 'huge' : 'big' }, big));
    render(choices, opts.map((c, i) => el('button', { class: 'btn', style: { minWidth: '150px', fontSize: '15px' }, onclick: () => answer(i) },
      el('span', { class: 'kbd', style: { marginRight: '8px' } }, i + 1), c[kind])));
    fb.textContent = '';
    drawWeak();
  }

  function answer(i) {
    if (locked) return;
    locked = true;
    const ok = opts[i] === current;
    score.total++;
    if (ok) { score.correct++; score.streak++; score.best = Math.max(score.best, score.streak); }
    else { score.streak = 0; missed[current.cc] = (missed[current.cc] || 0) + 1; s.set('missed', missed); }
    [...choices.children].forEach((b, j) => {
      if (j === i && !ok) { b.style.borderColor = 'var(--danger)'; b.style.color = 'var(--danger)'; }
      if (opts[j] === current) { b.style.background = 'var(--ok)'; b.style.color = '#fff'; b.style.borderColor = 'var(--ok)'; }
    });
    fb.textContent = `${ok ? '✓' : '✗'} ${current.flag} ${current.name} — ${current.capital} (${current.region})`;
    fb.style.color = ok ? 'var(--ok)' : 'var(--danger)';
    drawScore();
    clearTimeout(timer); timer = setTimeout(ask, ok ? 700 : 1800);
  }
  root.tabIndex = -1;
  root.addEventListener('keydown', e => { const n = +e.key; if (n >= 1 && n <= 4 && choices.children[n - 1]) choices.children[n - 1].click(); });

  // weakest list
  const weak = el('div', { class: 'row' });
  function drawWeak() {
    const list = Object.entries(missed).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([cc, n]) => { const c = COUNTRIES.find(x => x.cc === cc); return c && el('span', { class: 'badge', title: `missed ${n}×` }, `${c.flag} ${c.name} — ${c.capital}`); });
    render(weak, list.length ? [el('span', { class: 'muted small' }, 'Most missed:'), list] : null);
  }

  // browse table
  const browse = el('div', { class: 'col hidden' });
  const search = el('input', { class: 'input', placeholder: 'Search country or capital…', oninput: drawBrowse });
  function drawBrowse() {
    const q = search.value.trim().toLowerCase();
    const rows = COUNTRIES.filter(c => !q || c.name.toLowerCase().includes(q) || c.capital.toLowerCase().includes(q));
    render(browse, search, el('div', { class: 'muted small' }, rows.length + ' countries'), el('div', { class: 'scroll-x' }, el('table', { class: 'table' },
      el('thead', {}, el('tr', {}, el('th', {}, 'Flag'), el('th', {}, 'Country'), el('th', {}, 'Capital'), el('th', {}, 'Region'))),
      el('tbody', {}, rows.map(c => el('tr', {}, el('td', { style: { fontSize: '20px' } }, c.flag), el('td', {}, c.name), el('td', {}, c.capital), el('td', { class: 'muted' }, c.region)))))));
  }
  const quizView = el('div', { class: 'col' },
    el('div', { class: 'row' }, modeSel, regionRow, el('button', { class: 'btn small ghost', onclick: () => { score = { total: 0, correct: 0, streak: 0, best: 0 }; missed = {}; s.set('missed', missed); drawScore(); drawWeak(); } }, 'Reset score')),
    prompt, choices, fb, scoreRow, weak);
  const tabQ = el('button', { class: 'btn small primary', onclick: () => show('quiz') }, 'Quiz');
  const tabB = el('button', { class: 'btn small', onclick: () => show('browse') }, 'Browse all');
  function show(w) {
    quizView.classList.toggle('hidden', w !== 'quiz'); browse.classList.toggle('hidden', w !== 'browse');
    tabQ.classList.toggle('primary', w === 'quiz'); tabB.classList.toggle('primary', w === 'browse');
    if (w === 'browse') drawBrowse();
  }
  render(root, el('div', { class: 'row' }, tabQ, tabB, el('span', { class: 'muted small' }, COUNTRIES.length + ' countries · keys 1–4 answer')), quizView, browse);
  drawScore(); ask();
  return () => clearTimeout(timer);
}
