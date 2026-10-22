// Mock API generator: infer a schema from example JSON, generate realistic fake records, output server snippets.
import { el, render, store, copy, download, toast, field, rng } from '../../lib/ui.js';

const FIRST = ['Ava', 'Liam', 'Mia', 'Noah', 'Zoe', 'Ethan', 'Isla', 'Lucas', 'Emma', 'Omar', 'Sofia', 'Leo', 'Nina', 'Kai', 'Elena', 'Max', 'Priya', 'Jonas', 'Hana', 'Diego'];
const LAST = ['Smith', 'Garcia', 'Nguyen', 'Müller', 'Rossi', 'Kim', 'Okafor', 'Silva', 'Ivanova', 'Cohen', 'Tanaka', 'Brown', 'Dubois', 'Patel', 'Larsen', 'Novak'];
const WORDS = ['lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit', 'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'labore', 'magna', 'aliqua', 'enim', 'minim', 'veniam', 'quis'];
const CITIES = ['Berlin', 'Lisbon', 'Tokyo', 'Austin', 'Toronto', 'Nairobi', 'Oslo', 'Seoul', 'Lima', 'Dublin', 'Mumbai', 'Sydney'];
const COUNTRIES = ['DE', 'PT', 'JP', 'US', 'CA', 'KE', 'NO', 'KR', 'PE', 'IE', 'IN', 'AU'];
const STREETS = ['Main St', 'Oak Ave', 'Park Rd', 'Lake Dr', 'Hill St', 'Maple Ln', 'River Way', 'Station Rd'];
const COMPANIES = ['Acme Corp', 'Globex', 'Initech', 'Umbrella Ltd', 'Hooli', 'Vandelay Industries', 'Stark Labs', 'Wayne Tech'];
const STATUSES = ['active', 'pending', 'archived', 'draft'];
const COLORS = ['red', 'blue', 'green', 'amber', 'teal', 'violet'];
const DOMAINS = ['example.com', 'mail.test', 'company.io', 'dev.local'];

export default function (root) {
  const s = store('mock-api');
  const sample = el('textarea', { class: 'textarea', style: { minHeight: '180px' }, value: s.get('sample', JSON.stringify({ id: 1, name: 'Ava Smith', email: 'ava@example.com', age: 29, isActive: true, price: 19.99, createdAt: '2024-03-01T10:00:00Z', tags: ['a', 'b'], address: { city: 'Berlin', zip: '10115' } }, null, 2)) });
  const count = el('input', { class: 'input', type: 'number', min: 1, max: 1000, value: s.get('count', 10), style: { width: '90px' } });
  const seed = el('input', { class: 'input', type: 'number', value: s.get('seed', 42), style: { width: '100px' } });
  const route = el('input', { class: 'input', value: s.get('route', '/api/users'), style: { width: '160px' } });
  const wrap = el('select', { class: 'select' }, el('option', { value: 'array' }, 'Plain array'), el('option', { value: 'data' }, '{ data: [...] }'), el('option', { value: 'page' }, '{ data, total, page }'));
  wrap.value = s.get('wrap', 'array');
  const schemaOut = el('pre', { class: 'out', style: { maxHeight: '220px' } });
  const dataOut = el('pre', { class: 'out', style: { maxHeight: '360px' } });
  const snippetOut = el('pre', { class: 'out', style: { maxHeight: '320px' } });
  const snippetKind = el('select', { class: 'select' }, el('option', { value: 'express' }, 'Express (Node)'), el('option', { value: 'worker' }, 'Cloudflare Worker'), el('option', { value: 'deno' }, 'Deno / Bun fetch handler'));
  const err = el('div', { class: 'small', style: { color: 'var(--danger)' } });
  let records = [];

  // ---- schema inference ----
  function infer(v, key = '') {
    if (Array.isArray(v)) return { type: 'array', items: v.length ? infer(v[0], key) : { type: 'string', hint: 'word' }, len: v.length };
    if (v === null) return { type: 'null' };
    if (typeof v === 'object') { const props = {}; for (const [k, x] of Object.entries(v)) props[k] = infer(x, k); return { type: 'object', props }; }
    if (typeof v === 'boolean') return { type: 'boolean' };
    if (typeof v === 'number') return { type: 'number', int: Number.isInteger(v), hint: hintFor(key, v) };
    return { type: 'string', hint: hintFor(key, v) };
  }
  function hintFor(key, sampleVal) {
    const k = key.toLowerCase().replace(/[^a-z]/g, '');
    const sv = typeof sampleVal === 'string' ? sampleVal : '';
    if (/^(id|uuid|guid)$|id$/.test(k) && typeof sampleVal === 'string' && /^[0-9a-f-]{32,36}$/i.test(sv)) return 'uuid';
    if (/^(id|uuid|guid)$|(^|_)id$|id$/.test(k)) return 'id';
    if (/email|mail/.test(k)) return 'email';
    if (/firstname|givenname/.test(k)) return 'first';
    if (/lastname|surname|familyname/.test(k)) return 'last';
    if (/fullname|^name$|username|author|owner|customer/.test(k)) return 'name';
    if (/avatar|image|photo|picture|thumbnail|img/.test(k)) return 'image';
    if (/url|link|href|website|homepage/.test(k)) return 'url';
    if (/phone|mobile|tel/.test(k)) return 'phone';
    if (/price|amount|cost|total|balance|salary|revenue|fee/.test(k)) return 'price';
    if (/percent|rate|ratio|score/.test(k)) return 'percent';
    if (/age$/.test(k)) return 'age';
    if (/qty|quantity|count|stock|votes|likes|views/.test(k)) return 'count';
    if (/lat$|latitude/.test(k)) return 'lat';
    if (/lng$|lon$|longitude/.test(k)) return 'lng';
    if (/date|time|at$|_at|created|updated|timestamp|birthday|dob/.test(k)) return /^\d{4}-\d{2}-\d{2}$/.test(sv) ? 'date' : 'datetime';
    if (/city|town/.test(k)) return 'city';
    if (/country/.test(k)) return 'country';
    if (/zip|postal|postcode/.test(k)) return 'zip';
    if (/street|address/.test(k)) return 'street';
    if (/company|org|vendor|brand|employer/.test(k)) return 'company';
    if (/status|state/.test(k)) return 'status';
    if (/color|colour/.test(k)) return 'color';
    if (/description|bio|summary|body|content|text|comment|message/.test(k)) return 'sentence';
    if (/title|subject|headline/.test(k)) return 'title';
    if (/slug/.test(k)) return 'slug';
    if (/ip$|ipaddress/.test(k)) return 'ip';
    if (/token|hash|key|secret|password/.test(k)) return 'hex';
    if (/tag|category|label|role|type|kind/.test(k)) return 'word';
    if (/^is|^has|enabled|active|verified|deleted/.test(k)) return 'boolean';
    if (sv) {
      if (/^\S+@\S+\.\S+$/.test(sv)) return 'email';
      if (/^https?:\/\//.test(sv)) return 'url';
      if (/^\d{4}-\d{2}-\d{2}T/.test(sv)) return 'datetime';
      if (/^\d{4}-\d{2}-\d{2}$/.test(sv)) return 'date';
      if (/^[0-9a-f-]{36}$/i.test(sv)) return 'uuid';
      if (sv.split(' ').length > 4) return 'sentence';
    }
    return typeof sampleVal === 'number' ? 'number' : 'word';
  }

  // ---- generators ----
  function makeGen(r) {
    const pick = a => a[Math.floor(r() * a.length)];
    const int = (a, b) => a + Math.floor(r() * (b - a + 1));
    const hex = n => Array.from({ length: n }, () => int(0, 15).toString(16)).join('');
    const dateIn = () => new Date(Date.now() - int(0, 730) * 86400000 - int(0, 86400000));
    const gens = {
      id: i => i + 1, uuid: () => `${hex(8)}-${hex(4)}-4${hex(3)}-${pick('89ab')}${hex(3)}-${hex(12)}`,
      email: (i, ctx) => `${(ctx.first || pick(FIRST)).toLowerCase()}.${(ctx.last || pick(LAST)).toLowerCase().replace(/[^a-z]/g, '')}${int(1, 99)}@${pick(DOMAINS)}`,
      first: (i, ctx) => ctx.first || (ctx.first = pick(FIRST)), last: (i, ctx) => ctx.last || (ctx.last = pick(LAST)),
      name: (i, ctx) => `${ctx.first || (ctx.first = pick(FIRST))} ${ctx.last || (ctx.last = pick(LAST))}`,
      image: i => `https://picsum.photos/seed/${hex(6)}/200/200`, url: () => `https://${pick(DOMAINS)}/${pick(WORDS)}/${pick(WORDS)}`,
      phone: () => `+1-${int(200, 999)}-${int(200, 999)}-${int(1000, 9999)}`,
      price: () => Math.round(r() * 49900 + 99) / 100, percent: () => Math.round(r() * 1000) / 10, age: () => int(18, 80), count: () => int(0, 5000),
      lat: () => Math.round((r() * 180 - 90) * 1e5) / 1e5, lng: () => Math.round((r() * 360 - 180) * 1e5) / 1e5,
      date: () => dateIn().toISOString().slice(0, 10), datetime: () => dateIn().toISOString(),
      city: () => pick(CITIES), country: () => pick(COUNTRIES), zip: () => String(int(10000, 99999)), street: () => `${int(1, 999)} ${pick(STREETS)}`,
      company: () => pick(COMPANIES), status: () => pick(STATUSES), color: () => pick(COLORS),
      sentence: () => { const n = int(6, 14); const w = Array.from({ length: n }, () => pick(WORDS)); w[0] = w[0][0].toUpperCase() + w[0].slice(1); return w.join(' ') + '.'; },
      title: () => Array.from({ length: int(2, 5) }, () => pick(WORDS)).map(w => w[0].toUpperCase() + w.slice(1)).join(' '),
      slug: () => Array.from({ length: int(2, 4) }, () => pick(WORDS)).join('-'), ip: () => `${int(1, 254)}.${int(0, 255)}.${int(0, 255)}.${int(1, 254)}`,
      hex: () => hex(32), word: () => pick(WORDS), boolean: () => r() < 0.5, number: () => int(0, 1000),
    };
    function gen(schema, i, ctx) {
      switch (schema.type) {
        case 'array': return Array.from({ length: Math.max(1, Math.min(5, schema.len || 2)) }, () => gen(schema.items, i, ctx));
        case 'object': { const o = {}; const c = {}; for (const [k, sub] of Object.entries(schema.props)) o[k] = gen(sub, i, c); return o; }
        case 'boolean': return r() < 0.5;
        case 'null': return null;
        case 'number': { const v = (gens[schema.hint] || gens.number)(i, ctx); return typeof v === 'number' ? (schema.int ? Math.round(v) : v) : int(0, 1000); }
        default: { const v = (gens[schema.hint] || gens.word)(i, ctx); return typeof v === 'string' ? v : String(v); }
      }
    }
    return gen;
  }

  function generate() {
    err.textContent = '';
    let parsed;
    try { parsed = JSON.parse(sample.value); } catch (e) { err.textContent = 'Invalid JSON: ' + e.message; return; }
    const example = Array.isArray(parsed) ? parsed[0] : parsed;
    if (example == null || typeof example !== 'object') { err.textContent = 'Example must be an object or an array of objects.'; return; }
    const schema = infer(example);
    const n = Math.max(1, Math.min(1000, +count.value || 10));
    const gen = makeGen(rng(+seed.value || 1));
    records = Array.from({ length: n }, (_, i) => gen(schema, i, {}));
    s.set('sample', sample.value); s.set('count', n); s.set('seed', +seed.value); s.set('route', route.value); s.set('wrap', wrap.value);
    schemaOut.textContent = describe(schema, '');
    dataOut.textContent = JSON.stringify(wrapped(), null, 2);
    snippet();
  }
  function describe(sc, ind) {
    if (sc.type === 'object') return '{\n' + Object.entries(sc.props).map(([k, v]) => `${ind}  ${k}: ${describe(v, ind + '  ')}`).join('\n') + `\n${ind}}`;
    if (sc.type === 'array') return `array of ${describe(sc.items, ind)}`;
    return sc.type + (sc.hint && sc.hint !== 'word' && sc.hint !== 'number' ? ` (${sc.hint})` : '') + (sc.int ? ' int' : '');
  }
  function wrapped() {
    if (wrap.value === 'data') return { data: records };
    if (wrap.value === 'page') return { data: records, total: records.length, page: 1, perPage: records.length };
    return records;
  }
  function snippet() {
    const r = route.value.trim() || '/api/items';
    const json = JSON.stringify(wrapped(), null, 2);
    const one = `const ITEMS = ${JSON.stringify(records, null, 2)};\nconst byId = (id) => ITEMS.find(x => String(x.id) === String(id)) || null;`;
    let code;
    if (snippetKind.value === 'express') code = `// npm i express\nimport express from 'express';\nconst app = express();\n${one}\napp.use(express.json());\napp.get('${r}', (req, res) => {\n  const { page = 1, limit = ${records.length} } = req.query;\n  const start = (page - 1) * limit;\n  res.json(${wrap.value === 'array' ? 'ITEMS.slice(start, start + +limit)' : wrap.value === 'data' ? '{ data: ITEMS.slice(start, start + +limit) }' : '{ data: ITEMS.slice(start, start + +limit), total: ITEMS.length, page: +page, perPage: +limit }'});\n});\napp.get('${r}/:id', (req, res) => {\n  const item = byId(req.params.id);\n  item ? res.json(item) : res.status(404).json({ error: 'Not found' });\n});\napp.listen(3000, () => console.log('Mock API on http://localhost:3000${r}'));`;
    else if (snippetKind.value === 'worker') code = `// wrangler deploy\n${one}\nconst json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });\nexport default {\n  async fetch(request) {\n    const url = new URL(request.url);\n    if (url.pathname === '${r}') return json(${wrap.value === 'array' ? 'ITEMS' : wrap.value === 'data' ? '{ data: ITEMS }' : '{ data: ITEMS, total: ITEMS.length, page: 1, perPage: ITEMS.length }'});\n    const m = url.pathname.match(/^${r.replace(/[/]/g, '\\/')}\\/([^/]+)$/);\n    if (m) { const item = byId(m[1]); return item ? json(item) : json({ error: 'Not found' }, 404); }\n    return json({ error: 'No route' }, 404);\n  }\n};`;
    else code = `// deno run -A server.ts   |   bun run server.ts\n${one}\nconst json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });\nconst handler = (req) => {\n  const url = new URL(req.url);\n  if (url.pathname === '${r}') return json(${wrap.value === 'array' ? 'ITEMS' : wrap.value === 'data' ? '{ data: ITEMS }' : '{ data: ITEMS, total: ITEMS.length, page: 1, perPage: ITEMS.length }'});\n  const m = url.pathname.match(/^${r.replace(/[/]/g, '\\/')}\\/([^/]+)$/);\n  if (m) { const item = byId(m[1]); return item ? json(item) : json({ error: 'Not found' }, 404); }\n  return json({ error: 'No route' }, 404);\n};\n// Deno: Deno.serve(handler);   Bun: export default { fetch: handler };`;
    snippetOut.textContent = code;
    snippetOut._code = code; snippetOut._json = json;
  }

  snippetKind.addEventListener('change', () => { if (records.length) snippet(); });
  wrap.addEventListener('change', generate); route.addEventListener('input', () => { if (records.length) snippet(); });
  sample.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) generate(); });

  render(root,
    el('div', { class: 'grid2' },
      el('div', {}, el('div', { class: 'small muted' }, 'Example JSON (one object, or an array whose first item is used)'), sample, err),
      el('div', {}, el('div', { class: 'small muted' }, 'Inferred schema'), schemaOut)),
    el('div', { class: 'row' }, field('Records', count), field('Seed', seed), field('Shape', wrap), field('Route', route),
      el('button', { class: 'btn primary', onclick: generate }, 'Generate'),
      el('button', { class: 'btn', onclick: () => { seed.value = Math.floor(Math.random() * 1e6); generate(); } }, 'Random seed')),
    el('div', { class: 'row' }, el('b', {}, 'Generated data'), el('button', { class: 'btn small', onclick: () => copy(dataOut.textContent) }, 'Copy JSON'), el('button', { class: 'btn small', onclick: () => download('mock-data.json', dataOut.textContent, 'application/json') }, 'Download')),
    dataOut,
    el('div', { class: 'row' }, el('b', {}, 'Server snippet'), snippetKind, el('button', { class: 'btn small', onclick: () => copy(snippetOut.textContent) }, 'Copy snippet'), el('button', { class: 'btn small', onclick: () => download(snippetKind.value === 'express' ? 'server.mjs' : 'worker.js', snippetOut.textContent, 'text/javascript') }, 'Download')),
    snippetOut,
    el('div', { class: 'muted small' }, 'Values are chosen by key name: id, uuid, name, email, phone, url, image, price, age, count, date/…At, city, country, zip, street, company, status, color, title, description, slug, ip, token, isX/hasX. Same seed gives the same data every time. Ctrl+Enter in the editor generates.'));
  generate();
}
