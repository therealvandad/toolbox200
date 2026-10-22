// Calorie estimator: built-in food list (approximate values), search, portion multiplier, daily log, 7-day chart.
import { el, render, store, uid, today, toast, stat, field, pad } from '../../lib/ui.js';

// name | serving | kcal | protein g | carbs g | fat g   (typical values, approximate)
const RAW = `
Apple|1 medium (180 g)|95|0.5|25|0.3
Banana|1 medium (118 g)|105|1.3|27|0.4
Orange|1 medium (130 g)|62|1.2|15|0.2
Strawberries|1 cup (150 g)|49|1|12|0.5
Blueberries|1 cup (148 g)|84|1.1|21|0.5
Grapes|1 cup (150 g)|104|1|27|0.2
Watermelon|1 cup (150 g)|46|0.9|11.5|0.2
Pineapple|1 cup (165 g)|82|0.9|22|0.2
Mango|1 cup (165 g)|99|1.4|25|0.6
Pear|1 medium (178 g)|101|0.6|27|0.2
Peach|1 medium (150 g)|59|1.4|14|0.4
Kiwi|1 fruit (69 g)|42|0.8|10|0.4
Avocado|half (100 g)|160|2|9|15
Raisins|small box (43 g)|129|1.3|34|0.2
Dates (Medjool)|1 date (24 g)|66|0.4|18|0
Broccoli, cooked|1 cup (156 g)|55|3.7|11|0.6
Carrot, raw|1 medium (61 g)|25|0.6|6|0.1
Cucumber|1 cup (104 g)|16|0.7|3.8|0.1
Tomato|1 medium (123 g)|22|1.1|4.8|0.2
Spinach, raw|2 cups (60 g)|14|1.7|2.2|0.2
Lettuce, romaine|2 cups (94 g)|16|1.2|3|0.2
Bell pepper|1 medium (119 g)|31|1.2|7.2|0.4
Onion|1 medium (110 g)|44|1.2|10|0.1
Mushrooms, raw|1 cup (70 g)|15|2.2|2.3|0.2
Zucchini|1 cup (124 g)|21|1.5|3.9|0.4
Cauliflower, cooked|1 cup (124 g)|29|2.3|5.1|0.6
Green beans, cooked|1 cup (125 g)|44|2.4|9.9|0.4
Sweet potato, baked|1 medium (114 g)|103|2.3|24|0.2
Potato, baked|1 medium (173 g)|161|4.3|37|0.2
French fries|medium (117 g)|365|4|48|17
Corn, cooked|1 cup (164 g)|143|5|31|2.2
Peas, cooked|1 cup (160 g)|134|8.6|25|0.4
Coleslaw|1 cup (120 g)|150|1|14|10
White rice, cooked|1 cup (158 g)|205|4.3|45|0.4
Brown rice, cooked|1 cup (195 g)|216|5|45|1.8
Pasta, cooked|1 cup (140 g)|220|8|43|1.3
Quinoa, cooked|1 cup (185 g)|222|8.1|39|3.6
Oatmeal, cooked|1 cup (234 g)|166|5.9|28|3.6
Rolled oats, dry|half cup (40 g)|150|5|27|2.5
Cornflakes|1 cup (28 g)|100|2|24|0.2
Granola|half cup (61 g)|270|6|40|10
Muesli|half cup (55 g)|200|5|38|3
White bread|1 slice (25 g)|67|2|12.7|0.8
Whole wheat bread|1 slice (28 g)|81|4|14|1.1
Bagel|1 medium (105 g)|270|10|53|1.6
Tortilla, flour|1 medium (49 g)|146|3.8|24.6|3.6
Pita bread|1 piece (60 g)|165|5.5|33|0.7
Croissant|1 medium (57 g)|231|4.7|26|12
Pancake|1 medium (38 g)|86|2.4|11|3.7
Waffle|1 round (75 g)|218|6|25|11
Pizza, cheese|1 slice (107 g)|285|12|36|10
Burger, cheeseburger|1 sandwich (119 g)|303|15|30|13
Hot dog with bun|1 (98 g)|290|10|24|17
Chicken breast, grilled|100 g|165|31|0|3.6
Chicken thigh, roasted|100 g|209|26|0|11
Chicken nuggets|6 pieces (96 g)|270|14|16|17
Turkey breast, roasted|100 g|135|30|0|1
Beef steak, sirloin|100 g|206|29|0|9
Ground beef, 85% lean|100 g|250|26|0|15
Pork chop, grilled|100 g|231|27|0|13
Bacon, cooked|2 slices (16 g)|86|6|0.2|6.7
Ham, sliced|2 slices (56 g)|60|10|1|1.8
Sausage, pork|1 link (68 g)|220|10|1|19
Salmon, baked|100 g|206|22|0|12
Tuna, canned in water|1 can (142 g)|130|28|0|1
Shrimp, cooked|100 g|99|24|0.2|0.3
Cod, baked|100 g|105|23|0|0.9
Egg, boiled|1 large (50 g)|78|6.3|0.6|5.3
Egg, fried|1 large (46 g)|90|6.3|0.4|7
Scrambled eggs|2 eggs (122 g)|204|13.6|2.4|15
Tofu, firm|100 g|144|17|3|9
Tempeh|100 g|193|20|9|11
Lentils, cooked|1 cup (198 g)|230|18|40|0.8
Chickpeas, cooked|1 cup (164 g)|269|14.5|45|4.3
Black beans, cooked|1 cup (172 g)|227|15|41|0.9
Kidney beans, cooked|1 cup (177 g)|225|15|40|0.9
Hummus|2 tbsp (30 g)|70|2|4|5
Peanut butter|2 tbsp (32 g)|190|7|7|16
Almonds|small handful (28 g)|164|6|6|14
Walnuts|small handful (28 g)|185|4.3|3.9|18.5
Cashews|small handful (28 g)|157|5.2|8.6|12.4
Peanuts|small handful (28 g)|161|7.3|4.6|14
Sunflower seeds|1 oz (28 g)|165|5.5|6.8|14
Chia seeds|1 tbsp (12 g)|58|2|5|3.7
Milk, whole|1 cup (244 g)|149|7.7|11.7|7.9
Milk, skim|1 cup (245 g)|83|8.3|12.2|0.2
Almond milk, unsweetened|1 cup (240 ml)|30|1|1|2.5
Oat milk|1 cup (240 ml)|120|3|16|5
Soy milk|1 cup (243 ml)|105|6.3|12|3.6
Yogurt, plain low fat|1 cup (245 g)|154|13|17|3.8
Greek yogurt, nonfat|170 g|100|17|6|0.7
Cottage cheese|half cup (113 g)|90|12|5|2.5
Cheddar cheese|1 slice (28 g)|113|7|0.4|9.3
Mozzarella|1 oz (28 g)|85|6.3|0.6|6.3
Parmesan|1 tbsp (5 g)|22|2|0.2|1.5
Cream cheese|2 tbsp (29 g)|99|1.7|1.6|9.8
Butter|1 tbsp (14 g)|102|0.1|0|11.5
Olive oil|1 tbsp (14 g)|119|0|0|13.5
Mayonnaise|1 tbsp (14 g)|94|0.1|0.1|10
Ketchup|1 tbsp (17 g)|17|0.2|4.6|0
Honey|1 tbsp (21 g)|64|0.1|17|0
Sugar|1 tsp (4 g)|16|0|4|0
Jam|1 tbsp (20 g)|56|0.1|14|0
Maple syrup|1 tbsp (20 g)|52|0|13|0
Chocolate, dark|1 square (10 g)|60|0.8|4.6|4.3
Chocolate, milk|1 bar (43 g)|226|3|25|14
Chocolate chip cookie|1 medium (30 g)|140|1.5|19|6.5
Brownie|1 piece (56 g)|227|2.7|36|9
Donut, glazed|1 (60 g)|260|3|31|14
Ice cream, vanilla|half cup (66 g)|137|2.3|16|7.3
Cake, chocolate|1 slice (95 g)|352|5|50|14
Muffin, blueberry|1 medium (113 g)|377|5|54|15
Potato chips|1 oz (28 g)|152|2|15|10
Popcorn, air-popped|3 cups (24 g)|93|3|19|1.1
Pretzels|1 oz (28 g)|108|2.6|22.5|0.8
Granola bar|1 bar (24 g)|100|2|16|3.5
Protein bar|1 bar (60 g)|220|20|22|7
Crackers|5 crackers (16 g)|70|1.4|10.5|2.5
Rice cake|1 cake (9 g)|35|0.7|7.3|0.3
Cola|1 can (355 ml)|140|0|39|0
Orange juice|1 cup (248 ml)|112|1.7|26|0.5
Apple juice|1 cup (248 ml)|114|0.2|28|0.3
Coffee, black|1 cup (240 ml)|2|0.3|0|0
Latte|medium (350 ml)|190|13|19|7
Cappuccino|medium (240 ml)|110|6|9|6
Tea, unsweetened|1 cup (240 ml)|2|0|0.7|0
Beer|1 can (355 ml)|153|1.6|13|0
Red wine|1 glass (150 ml)|125|0.1|3.8|0
Spirits, 40%|1 shot (44 ml)|97|0|0|0
Energy drink|1 can (250 ml)|110|0|28|0
Sports drink|1 bottle (500 ml)|130|0|32|0
Smoothie, fruit|1 cup (240 ml)|160|2|38|0.5
Protein shake|1 scoop in water|120|24|3|1.5
Chicken soup|1 cup (248 g)|75|4|9|2.5
Tomato soup|1 cup (248 g)|74|2|17|0.7
Lentil soup|1 cup (248 g)|140|9|22|2
Caesar salad|1.5 cups (150 g)|180|5|8|15
Garden salad, no dressing|2 cups (150 g)|35|2|7|0.3
Salad dressing, ranch|2 tbsp (30 g)|129|0.4|1.8|13
Sandwich, turkey|1 sandwich (200 g)|330|22|36|10
Sandwich, PB and jelly|1 sandwich (100 g)|370|11|47|16
Grilled cheese|1 sandwich (120 g)|366|14|28|22
Burrito, bean and cheese|1 burrito (200 g)|380|14|55|11
Taco, beef|1 taco (102 g)|210|9|20|10
Quesadilla, cheese|1 (140 g)|480|22|35|27
Sushi roll, California|6 pieces (170 g)|255|9|38|7
Fried rice|1 cup (198 g)|238|6|34|9
Pad thai|1 cup (200 g)|350|13|40|15
Lasagna|1 piece (250 g)|380|22|36|16
Spaghetti with meat sauce|1.5 cups (300 g)|380|19|50|11
Mac and cheese|1 cup (200 g)|380|14|44|17
Chili con carne|1 cup (253 g)|256|22|22|9
Curry, chicken|1 cup (240 g)|300|24|12|17
Falafel|3 pieces (51 g)|170|6.6|16|9
Dumplings, steamed|4 pieces (120 g)|240|10|32|8
Hash browns|1 patty (56 g)|150|1.4|16|9
Omelette, cheese|2 eggs (130 g)|270|18|2|21
Oatmeal cookie|1 medium (25 g)|113|1.5|17|4.7
Rice pudding|half cup (130 g)|160|4|28|3.5
Frozen yogurt|half cup (72 g)|110|3|19|3
`;

const FOODS = RAW.trim().split('\n').map(l => {
  const [name, serving, kcal, p, c, f] = l.split('|');
  return { name, serving, kcal: +kcal, p: +p, c: +c, f: +f };
});

export default function (root) {
  const s = store('calorie-estimator');
  const cv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888';
  let goal = +s.get('goal', 2000) || 2000;
  let log = s.get('log', {});        // date -> [{id, name, serving, mult, kcal, p, c, f}]
  let custom = s.get('custom', []);  // user-added foods
  let date = today();
  let picked = null;

  const all = () => [...custom, ...FOODS];
  const save = () => s.set('log', log);
  const keyOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const r1 = v => Math.round(v * 10) / 10;
  const totals = k => (log[k] || []).reduce((a, e) => ({ kcal: a.kcal + e.kcal, p: a.p + e.p, c: a.c + e.c, f: a.f + e.f }), { kcal: 0, p: 0, c: 0, f: 0 });

  const search = el('input', { class: 'input grow', type: 'search', placeholder: `Search ${FOODS.length}+ foods (e.g. rice, apple, pizza)`, oninput: () => showResults(),
    onkeydown: e => { if (e.key === 'Escape') { search.value = ''; showResults(); } } });
  const results = el('div', { class: 'col', style: { maxHeight: '300px', overflow: 'auto' } });
  const multIn = el('input', { class: 'input', type: 'number', min: 0.1, step: 0.25, value: 1, style: { width: '90px' }, oninput: () => showPick(),
    onkeydown: e => { if (e.key === 'Enter') addPicked(); } });
  const pickBox = el('div', { class: 'panel col hidden' });
  const dateIn = el('input', { class: 'input', type: 'date', value: date, onchange: () => { date = dateIn.value || today(); update(); } });
  const goalIn = el('input', { class: 'input', type: 'number', min: 500, step: 50, value: goal, style: { width: '100px' }, onchange: () => { goal = Math.max(500, +goalIn.value || 2000); s.set('goal', goal); update(); } });
  const stats = el('div', { class: 'row' });
  const macroBar = el('div', { class: 'row small' });
  const entries = el('div', { class: 'scroll-x' });
  const chart = el('canvas', { width: 640, height: 220, style: { width: '100%', maxWidth: '640px' } });

  function showResults() {
    const q = search.value.trim().toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);
    const list = words.length ? all().filter(f => words.every(w => f.name.toLowerCase().includes(w))) : all().slice(0, 12);
    render(results, list.length ? list.slice(0, 40).map(f => el('div', { class: 'row', style: { margin: 0, cursor: 'pointer', padding: '4px 0', borderBottom: '1px solid var(--line)' }, onclick: () => { picked = f; multIn.value = 1; showPick(); } },
      el('span', { class: 'grow' }, f.name, el('span', { class: 'muted small' }, '  ' + f.serving)),
      el('span', { class: 'badge' }, f.kcal + ' kcal'))) : el('div', { class: 'muted small' }, 'No match. Add it as a custom food below.'));
  }
  function showPick() {
    if (!picked) { pickBox.classList.add('hidden'); return; }
    const m = Math.max(0.1, +multIn.value || 1), f = picked;
    pickBox.classList.remove('hidden');
    render(pickBox,
      el('div', {}, el('b', {}, f.name), el('span', { class: 'muted small' }, `  per serving: ${f.serving}`)),
      el('div', { class: 'row' }, field('Servings', multIn),
        el('div', { class: 'big', style: { fontSize: '26px' } }, Math.round(f.kcal * m) + ' kcal'),
        el('span', { class: 'muted small' }, `P ${r1(f.p * m)} g · C ${r1(f.c * m)} g · F ${r1(f.f * m)} g`)),
      el('div', { class: 'row' }, el('button', { class: 'btn primary', onclick: addPicked }, 'Add to log'), el('button', { class: 'btn ghost', onclick: () => { picked = null; showPick(); } }, 'Cancel')));
  }
  function addPicked() {
    if (!picked) return;
    const m = Math.max(0.1, +multIn.value || 1), f = picked;
    (log[date] ||= []).push({ id: uid(), name: f.name, serving: f.serving, mult: m, kcal: Math.round(f.kcal * m), p: r1(f.p * m), c: r1(f.c * m), f: r1(f.f * m) });
    save(); toast(`Added ${f.name}`); picked = null; showPick(); update();
  }

  // custom food
  const cName = el('input', { class: 'input', placeholder: 'Food name' });
  const cKcal = el('input', { class: 'input', type: 'number', min: 0, placeholder: 'kcal', style: { width: '80px' } });
  const cP = el('input', { class: 'input', type: 'number', min: 0, placeholder: 'P g', style: { width: '70px' } });
  const cC = el('input', { class: 'input', type: 'number', min: 0, placeholder: 'C g', style: { width: '70px' } });
  const cF = el('input', { class: 'input', type: 'number', min: 0, placeholder: 'F g', style: { width: '70px' } });
  function addCustom() {
    const name = cName.value.trim(), kcal = +cKcal.value;
    if (!name || !(kcal >= 0) || cKcal.value === '') { toast('Enter a name and kcal'); return; }
    const f = { name, serving: '1 serving (custom)', kcal, p: +cP.value || 0, c: +cC.value || 0, f: +cF.value || 0 };
    custom.unshift(f); s.set('custom', custom);
    [cName, cKcal, cP, cC, cF].forEach(i => (i.value = ''));
    picked = f; multIn.value = 1; showPick(); showResults(); toast('Custom food saved');
  }

  function drawChart() {
    const c = chart.getContext('2d'), W = chart.width, H = chart.height, padL = 44, padB = 28, padT = 16;
    c.clearRect(0, 0, W, H);
    const days = []; for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(d); }
    const vals = days.map(d => Math.round(totals(keyOf(d)).kcal));
    const max = Math.max(goal * 1.2, ...vals, 1), bw = (W - padL - 10) / 7;
    const y = v => H - padB - (v / max) * (H - padB - padT);
    c.strokeStyle = cv('--line'); c.lineWidth = 1; c.beginPath(); c.moveTo(padL, y(0)); c.lineTo(W - 10, y(0)); c.stroke();
    c.setLineDash([5, 4]); c.strokeStyle = cv('--warn'); c.beginPath(); c.moveTo(padL, y(goal)); c.lineTo(W - 10, y(goal)); c.stroke(); c.setLineDash([]);
    c.fillStyle = cv('--muted'); c.font = '11px system-ui, sans-serif'; c.textAlign = 'right'; c.textBaseline = 'middle';
    c.fillText(String(goal), padL - 4, y(goal)); c.fillText('0', padL - 4, y(0));
    days.forEach((d, i) => {
      const x = padL + i * bw + bw * 0.2, w = bw * 0.6;
      c.fillStyle = vals[i] > goal * 1.1 ? cv('--danger') : vals[i] >= goal * 0.9 ? cv('--ok') : cv('--accent');
      c.fillRect(x, y(vals[i]), w, y(0) - y(vals[i]));
      c.fillStyle = keyOf(d) === date ? cv('--accent') : cv('--text'); c.textAlign = 'center'; c.textBaseline = 'top';
      c.fillText(d.toLocaleDateString(undefined, { weekday: 'short' }), x + w / 2, H - padB + 6);
      if (vals[i]) { c.fillStyle = cv('--muted'); c.textBaseline = 'bottom'; c.fillText(String(vals[i]), x + w / 2, y(vals[i]) - 2); }
    });
  }

  function update() {
    const t = totals(date), arr = log[date] || [];
    let sum7 = 0, n7 = 0; for (let i = 0; i < 7; i++) { const d = new Date(); d.setDate(d.getDate() - i); const k = totals(keyOf(d)).kcal; if (k) { sum7 += k; n7++; } }
    render(stats, stat(Math.round(t.kcal), 'kcal eaten'), stat(Math.round(goal - t.kcal), goal - t.kcal >= 0 ? 'kcal left' : 'kcal over'), stat(n7 ? Math.round(sum7 / n7) : '–', 'avg on logged days'));
    const pk = t.p * 4, ck = t.c * 4, fk = t.f * 9, tot = pk + ck + fk || 1;
    render(macroBar,
      el('span', { class: 'badge' }, `Protein ${r1(t.p)} g (${Math.round(pk / tot * 100)}%)`),
      el('span', { class: 'badge' }, `Carbs ${r1(t.c)} g (${Math.round(ck / tot * 100)}%)`),
      el('span', { class: 'badge' }, `Fat ${r1(t.f)} g (${Math.round(fk / tot * 100)}%)`));
    render(entries, arr.length ? el('table', { class: 'table' },
      el('thead', {}, el('tr', {}, ['Food', 'Servings', 'kcal', 'P', 'C', 'F', ''].map(h => el('th', {}, h)))),
      el('tbody', {}, arr.map((e, i) => el('tr', {}, el('td', {}, e.name), el('td', {}, r1(e.mult)), el('td', {}, e.kcal), el('td', {}, e.p), el('td', {}, e.c), el('td', {}, e.f),
        el('td', {}, el('button', { class: 'btn small ghost', onclick: () => { arr.splice(i, 1); if (!arr.length) delete log[date]; save(); update(); } }, '✕')))))
    ) : el('div', { class: 'muted' }, 'Nothing logged for this day yet.'));
    drawChart();
  }

  render(root,
    el('div', { class: 'row' }, field('Date', dateIn), field('Daily goal (kcal)', goalIn)),
    stats, macroBar,
    el('h3', {}, 'Add food'),
    el('div', { class: 'row' }, search),
    results, pickBox,
    el('details', {}, el('summary', { class: 'small muted' }, 'Add a custom food'),
      el('div', { class: 'row' }, cName, cKcal, cP, cC, cF, el('button', { class: 'btn small', onclick: addCustom }, 'Save'))),
    el('h3', {}, 'Log for ' + 'selected day'), entries,
    el('h3', {}, 'Last 7 days'), el('div', { class: 'canvas-wrap' }, chart),
    el('p', { class: 'muted small' }, 'Values are typical averages for the listed serving and are only estimates. Not medical advice. Your log stays in this browser only.'));
  showResults(); update();
}
