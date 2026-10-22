// SQL playground: a tiny SQL engine in plain JS with sample tables.
import { el, render, store, copy } from '../../lib/ui.js';

const TABLES = {
  customers: {
    cols: ['id', 'name', 'country', 'age', 'signup_year'],
    rows: [
      [1, 'Alice Martin', 'France', 34, 2019], [2, 'Bob Chen', 'Canada', 27, 2021], [3, 'Carla Rossi', 'Italy', 45, 2018],
      [4, 'Dan Novak', 'Czechia', 31, 2022], [5, 'Emma Walsh', 'Ireland', 52, 2017], [6, 'Farid Haddad', 'Lebanon', 29, 2023],
      [7, 'Grace Kim', 'Korea', 38, 2020], [8, 'Hugo Silva', 'Brazil', 23, 2023], [9, 'Ines Garcia', 'Spain', 41, 2019],
      [10, 'Jonas Berg', 'Sweden', 36, 2021], [11, 'Keiko Tanaka', 'Japan', 48, 2016], [12, 'Liam Brown', 'Canada', 30, 2022],
    ],
  },
  products: {
    cols: ['id', 'name', 'category', 'price', 'stock'],
    rows: [
      [1, 'Laptop', 'Electronics', 999.0, 12], [2, 'Headphones', 'Electronics', 149.5, 40], [3, 'Coffee Maker', 'Kitchen', 79.9, 25],
      [4, 'Desk Lamp', 'Home', 34.0, 60], [5, 'Notebook', 'Stationery', 4.5, 300], [6, 'Pen Set', 'Stationery', 12.0, 150],
      [7, 'Blender', 'Kitchen', 59.0, 18], [8, 'Monitor', 'Electronics', 289.0, 9], [9, 'Chair', 'Home', 189.0, 7],
      [10, 'Backpack', 'Accessories', 65.0, 33],
    ],
  },
  orders: {
    cols: ['id', 'customer_id', 'product_id', 'quantity', 'order_date', 'status'],
    rows: [
      [1, 1, 1, 1, '2024-01-05', 'shipped'], [2, 2, 5, 10, '2024-01-07', 'shipped'], [3, 3, 3, 1, '2024-01-12', 'delivered'],
      [4, 1, 2, 2, '2024-02-01', 'delivered'], [5, 5, 9, 1, '2024-02-03', 'cancelled'], [6, 7, 8, 2, '2024-02-14', 'shipped'],
      [7, 4, 6, 3, '2024-02-20', 'delivered'], [8, 9, 4, 4, '2024-03-02', 'pending'], [9, 2, 10, 1, '2024-03-09', 'delivered'],
      [10, 11, 1, 1, '2024-03-15', 'pending'], [11, 8, 7, 1, '2024-03-21', 'shipped'], [12, 3, 2, 1, '2024-04-01', 'delivered'],
      [13, 10, 5, 25, '2024-04-04', 'shipped'], [14, 6, 3, 2, '2024-04-10', 'pending'], [15, 12, 8, 1, '2024-04-18', 'delivered'],
      [16, 1, 10, 1, '2024-05-02', 'shipped'], [17, 7, 9, 2, '2024-05-06', 'cancelled'], [18, 9, 1, 1, '2024-05-11', 'delivered'],
      [19, 5, 6, 5, '2024-05-20', 'delivered'], [20, 2, 4, 2, '2024-06-01', 'pending'],
    ],
  },
};

const EXAMPLES = [
  ['All customers', 'SELECT * FROM customers'],
  ['Filter and sort', "SELECT name, age FROM customers WHERE age > 30 AND country <> 'Canada' ORDER BY age DESC"],
  ['LIKE pattern', "SELECT name, category FROM products WHERE name LIKE '%a%' ORDER BY name"],
  ['Limit', 'SELECT name, price FROM products ORDER BY price DESC LIMIT 3'],
  ['Group and count', 'SELECT country, COUNT(*) AS n FROM customers GROUP BY country ORDER BY n DESC'],
  ['Aggregates', 'SELECT category, AVG(price) AS avg_price, MIN(price), MAX(price), SUM(stock) FROM products GROUP BY category'],
  ['Inner join', 'SELECT customers.name, products.name AS product, orders.quantity FROM orders INNER JOIN customers ON orders.customer_id = customers.id INNER JOIN products ON orders.product_id = products.id ORDER BY orders.id'],
  ['Join + group', "SELECT customers.name, SUM(orders.quantity * products.price) AS total FROM orders JOIN customers ON orders.customer_id = customers.id JOIN products ON orders.product_id = products.id WHERE orders.status <> 'cancelled' GROUP BY customers.name ORDER BY total DESC LIMIT 5"],
];

// ---------- tokenizer ----------
function tokenize(sql) {
  const out = []; let i = 0;
  while (i < sql.length) {
    const c = sql[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "'" ) { let j = i + 1, s = ''; while (j < sql.length) { if (sql[j] === "'") { if (sql[j + 1] === "'") { s += "'"; j += 2; continue; } break; } s += sql[j++]; } if (j >= sql.length) throw new Error('Unterminated string'); out.push({ t: 'str', v: s }); i = j + 1; continue; }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(sql[i + 1]))) { const m = sql.slice(i).match(/^\d*\.?\d+(e[+-]?\d+)?/i); out.push({ t: 'num', v: parseFloat(m[0]) }); i += m[0].length; continue; }
    if (/[A-Za-z_]/.test(c)) { const m = sql.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_*][A-Za-z0-9_]*)?/); out.push({ t: 'id', v: m[0] }); i += m[0].length; continue; }
    const two = sql.slice(i, i + 2);
    if (['<>', '!=', '<=', '>='].includes(two)) { out.push({ t: 'op', v: two === '!=' ? '<>' : two }); i += 2; continue; }
    if ('=<>*,()+-/;'.includes(c)) { out.push({ t: 'op', v: c }); i++; continue; }
    throw new Error('Unexpected character "' + c + '" at position ' + (i + 1));
  }
  return out;
}

// ---------- parser ----------
const KW = ['SELECT', 'FROM', 'WHERE', 'ORDER', 'BY', 'LIMIT', 'GROUP', 'AS', 'AND', 'OR', 'NOT', 'LIKE', 'JOIN', 'INNER', 'ON', 'ASC', 'DESC', 'DISTINCT'];
class Parser {
  constructor(tokens) { this.t = tokens; this.i = 0; }
  peek(o = 0) { return this.t[this.i + o]; }
  next() { return this.t[this.i++]; }
  isKw(w, o = 0) { const p = this.peek(o); return p && p.t === 'id' && p.v.toUpperCase() === w; }
  accept(w) { if (this.isKw(w)) { this.i++; return true; } return false; }
  expect(w) { if (!this.accept(w)) throw new Error('Expected ' + w + (this.peek() ? ' near "' + this.peek().v + '"' : ' at end of query')); }
  expectOp(o) { const p = this.next(); if (!p || p.t !== 'op' || p.v !== o) throw new Error('Expected "' + o + '"' + (p ? ' near "' + p.v + '"' : '')); }
  ident() { const p = this.next(); if (!p || p.t !== 'id' || KW.includes(p.v.toUpperCase())) throw new Error('Expected a name' + (p ? ' near "' + p.v + '"' : '')); return p.v; }

  query() {
    this.expect('SELECT');
    const q = { distinct: this.accept('DISTINCT'), select: [], from: null, joins: [], where: null, group: null, order: [], limit: null };
    do {
      const p = this.peek();
      if (p && p.t === 'op' && p.v === '*') { this.next(); q.select.push({ star: true }); }
      else {
        const expr = this.expr();
        let alias = null;
        if (this.accept('AS')) alias = this.ident();
        else if (this.peek() && this.peek().t === 'id' && !KW.includes(this.peek().v.toUpperCase())) alias = this.ident();
        q.select.push({ expr, alias });
      }
    } while (this.acceptOp(','));
    this.expect('FROM');
    q.from = this.ident();
    while (this.isKw('JOIN') || this.isKw('INNER')) {
      this.accept('INNER'); this.expect('JOIN');
      const table = this.ident(); this.expect('ON');
      const on = this.expr();
      q.joins.push({ table, on });
    }
    if (this.accept('WHERE')) q.where = this.expr();
    if (this.accept('GROUP')) { this.expect('BY'); q.group = []; do q.group.push(this.expr()); while (this.acceptOp(',')); }
    if (this.accept('ORDER')) { this.expect('BY'); do { const e = this.expr(); let dir = 1; if (this.accept('DESC')) dir = -1; else this.accept('ASC'); q.order.push({ e, dir }); } while (this.acceptOp(',')); }
    if (this.accept('LIMIT')) { const n = this.next(); if (!n || n.t !== 'num') throw new Error('LIMIT needs a number'); q.limit = n.v; }
    this.acceptOp(';');
    if (this.peek()) throw new Error('Unexpected "' + this.peek().v + '"');
    return q;
  }
  acceptOp(o) { const p = this.peek(); if (p && p.t === 'op' && p.v === o) { this.i++; return true; } return false; }
  expr() { return this.or(); }
  or() { let l = this.and(); while (this.accept('OR')) l = { k: 'bin', op: 'OR', l, r: this.and() }; return l; }
  and() { let l = this.not(); while (this.accept('AND')) l = { k: 'bin', op: 'AND', l, r: this.not() }; return l; }
  not() { if (this.accept('NOT')) return { k: 'not', e: this.not() }; return this.cmp(); }
  cmp() {
    const l = this.add();
    const p = this.peek();
    if (p && p.t === 'op' && ['=', '<>', '<', '>', '<=', '>='].includes(p.v)) { this.next(); return { k: 'bin', op: p.v, l, r: this.add() }; }
    if (this.isKw('NOT') && this.isKw('LIKE', 1)) { this.i += 2; return { k: 'not', e: { k: 'bin', op: 'LIKE', l, r: this.add() } }; }
    if (this.accept('LIKE')) return { k: 'bin', op: 'LIKE', l, r: this.add() };
    return l;
  }
  add() { let l = this.mul(); for (;;) { const p = this.peek(); if (p && p.t === 'op' && (p.v === '+' || p.v === '-')) { this.next(); l = { k: 'bin', op: p.v, l, r: this.mul() }; } else return l; } }
  mul() { let l = this.unary(); for (;;) { const p = this.peek(); if (p && p.t === 'op' && (p.v === '*' || p.v === '/')) { this.next(); l = { k: 'bin', op: p.v, l, r: this.unary() }; } else return l; } }
  unary() { if (this.acceptOp('-')) return { k: 'neg', e: this.unary() }; return this.atom(); }
  atom() {
    const p = this.next();
    if (!p) throw new Error('Unexpected end of query');
    if (p.t === 'num') return { k: 'lit', v: p.v };
    if (p.t === 'str') return { k: 'lit', v: p.v };
    if (p.t === 'op' && p.v === '(') { const e = this.expr(); this.expectOp(')'); return e; }
    if (p.t === 'id') {
      const up = p.v.toUpperCase();
      if (['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'].includes(up) && this.acceptOp('(')) {
        let arg;
        if (this.acceptOp('*')) arg = { star: true }; else arg = this.expr();
        this.expectOp(')');
        return { k: 'agg', fn: up, arg, text: up + '(' + exprText(arg) + ')' };
      }
      if (KW.includes(up)) throw new Error('Unexpected keyword ' + p.v);
      return { k: 'col', name: p.v };
    }
    throw new Error('Unexpected "' + p.v + '"');
  }
}
function exprText(e) {
  if (!e) return '';
  if (e.star) return '*';
  switch (e.k) {
    case 'lit': return typeof e.v === 'string' ? "'" + e.v + "'" : String(e.v);
    case 'col': return e.name;
    case 'agg': return e.text;
    case 'neg': return '-' + exprText(e.e);
    case 'not': return 'NOT ' + exprText(e.e);
    case 'bin': return exprText(e.l) + ' ' + e.op + ' ' + exprText(e.r);
  }
  return '?';
}

// ---------- executor ----------
function resolve(row, name) {
  // row: { 'table.col': value, 'col': value (if unambiguous) }
  const key = name.toLowerCase();
  if (key in row.map) return row.map[key];
  if (row.ambiguous.has(key)) throw new Error('Column "' + name + '" is ambiguous; qualify it with the table name');
  throw new Error('Unknown column "' + name + '"');
}
function likeToRe(p) { return new RegExp('^' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$', 'i'); }
function cmpVal(a, b) { if (a == null && b == null) return 0; if (a == null) return -1; if (b == null) return 1; if (typeof a === 'number' && typeof b === 'number') return a - b; return String(a).localeCompare(String(b)); }
function evalExpr(e, row, aggs) {
  switch (e.k) {
    case 'lit': return e.v;
    case 'col': return resolve(row, e.name);
    case 'neg': return -evalExpr(e.e, row, aggs);
    case 'not': return !evalExpr(e.e, row, aggs);
    case 'agg': { if (!aggs) throw new Error('Aggregate ' + e.text + ' needs GROUP BY or a query with only aggregates'); return aggs[e.text]; }
    case 'bin': {
      if (e.op === 'AND') return !!(evalExpr(e.l, row, aggs) && evalExpr(e.r, row, aggs));
      if (e.op === 'OR') return !!(evalExpr(e.l, row, aggs) || evalExpr(e.r, row, aggs));
      const a = evalExpr(e.l, row, aggs), b = evalExpr(e.r, row, aggs);
      switch (e.op) {
        case '=': return a == b; // eslint-disable-line eqeqeq
        case '<>': return a != b; // eslint-disable-line eqeqeq
        case '<': return cmpVal(a, b) < 0; case '>': return cmpVal(a, b) > 0;
        case '<=': return cmpVal(a, b) <= 0; case '>=': return cmpVal(a, b) >= 0;
        case 'LIKE': return likeToRe(String(b)).test(String(a));
        case '+': return Number(a) + Number(b); case '-': return Number(a) - Number(b);
        case '*': return Number(a) * Number(b); case '/': return Number(a) / Number(b);
      }
    }
  }
  throw new Error('Cannot evaluate expression');
}
function hasAgg(e) { if (!e || e.star) return false; if (e.k === 'agg') return true; if (e.k === 'bin') return hasAgg(e.l) || hasAgg(e.r); if (e.k === 'neg' || e.k === 'not') return hasAgg(e.e); return false; }
function collectAggs(e, out) { if (!e || e.star) return; if (e.k === 'agg') out.push(e); else if (e.k === 'bin') { collectAggs(e.l, out); collectAggs(e.r, out); } else if (e.k === 'neg' || e.k === 'not') collectAggs(e.e, out); }

function makeRow(parts) {
  // parts: [{table, cols, values}]
  const map = {}, ambiguous = new Set(), order = [];
  for (const p of parts) {
    p.cols.forEach((c, i) => {
      const v = p.values[i];
      map[(p.table + '.' + c).toLowerCase()] = v;
      const k = c.toLowerCase();
      if (k in map && !order.includes(p.table + '.' + c)) { ambiguous.add(k); delete map[k]; }
      else if (!ambiguous.has(k)) map[k] = v;
      order.push(p.table + '.' + c);
    });
  }
  return { map, ambiguous, order };
}

function execute(sql) {
  const q = new Parser(tokenize(sql)).query();
  const getTable = n => { const t = TABLES[n.toLowerCase()]; if (!t) throw new Error('Unknown table "' + n + '"'); return { name: n.toLowerCase(), ...t }; };
  const base = getTable(q.from);
  let rows = base.rows.map(r => makeRow([{ table: base.name, cols: base.cols, values: r }]));
  let partsCols = [{ table: base.name, cols: base.cols }];
  for (const j of q.joins) {
    const t = getTable(j.table);
    partsCols.push({ table: t.name, cols: t.cols });
    const next = [];
    for (const r of rows) for (const tr of t.rows) {
      const parts = partsCols.map(pc => ({ table: pc.table, cols: pc.cols, values: pc.table === t.name ? tr : pc.cols.map(c => r.map[(pc.table + '.' + c).toLowerCase()]) }));
      const row = makeRow(parts);
      if (evalExpr(j.on, row)) next.push(row);
    }
    rows = next;
  }
  if (q.where) { if (hasAgg(q.where)) throw new Error('Aggregates are not allowed in WHERE'); rows = rows.filter(r => evalExpr(q.where, r)); }

  // Expand select list
  const selItems = [];
  for (const s of q.select) {
    if (s.star) { for (const r0 of [rows[0] || makeRow(partsCols.map(pc => ({ table: pc.table, cols: pc.cols, values: [] })))]) for (const full of r0.order) { const bare = full.split('.')[1]; selItems.push({ expr: { k: 'col', name: full }, label: partsCols.length > 1 ? full : bare }); } }
    else selItems.push({ expr: s.expr, label: s.alias || exprText(s.expr) });
  }
  const aggregated = q.group || selItems.some(s => hasAgg(s.expr)) || q.order.some(o => hasAgg(o.e));
  const aggExprs = []; selItems.forEach(s => collectAggs(s.expr, aggExprs)); q.order.forEach(o => collectAggs(o.e, aggExprs));

  let outRows;
  if (aggregated) {
    const groups = new Map();
    for (const r of rows) {
      const key = q.group ? JSON.stringify(q.group.map(g => evalExpr(g, r))) : '*';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    }
    if (!q.group && rows.length === 0) groups.set('*', []);
    outRows = [];
    for (const [, grp] of groups) {
      const aggs = {};
      for (const a of aggExprs) {
        const vals = a.arg.star ? grp.map(() => 1) : grp.map(r => evalExpr(a.arg, r)).filter(v => v != null);
        const nums = vals.map(Number);
        switch (a.fn) {
          case 'COUNT': aggs[a.text] = vals.length; break;
          case 'SUM': aggs[a.text] = nums.reduce((x, y) => x + y, 0); break;
          case 'AVG': aggs[a.text] = nums.length ? nums.reduce((x, y) => x + y, 0) / nums.length : null; break;
          case 'MIN': aggs[a.text] = vals.length ? vals.reduce((x, y) => cmpVal(x, y) <= 0 ? x : y) : null; break;
          case 'MAX': aggs[a.text] = vals.length ? vals.reduce((x, y) => cmpVal(x, y) >= 0 ? x : y) : null; break;
        }
      }
      const rep = grp[0] || makeRow(partsCols.map(pc => ({ table: pc.table, cols: pc.cols, values: [] })));
      const groupKeys = q.group ? q.group.map(g => exprText(g).toLowerCase()) : [];
      const guard = e => { // non-aggregate column must be in GROUP BY
        if (e.k === 'col' && !groupKeys.includes(e.name.toLowerCase()) && !groupKeys.includes(e.name.split('.').pop().toLowerCase())) throw new Error('Column "' + e.name + '" must appear in GROUP BY or inside an aggregate');
        if (e.k === 'bin') { guard(e.l); guard(e.r); } if (e.k === 'neg' || e.k === 'not') guard(e.e);
      };
      selItems.forEach(s => guard(s.expr));
      if (!q.group && grp.length === 0) outRows.push({ vals: selItems.map(s => hasAgg(s.expr) ? evalExpr(s.expr, rep, aggs) : null), src: rep, aggs });
      else outRows.push({ vals: selItems.map(s => evalExpr(s.expr, rep, aggs)), src: rep, aggs });
    }
  } else {
    outRows = rows.map(r => ({ vals: selItems.map(s => evalExpr(s.expr, r)), src: r, aggs: null }));
  }
  if (q.distinct) { const seen = new Set(); outRows = outRows.filter(r => { const k = JSON.stringify(r.vals); if (seen.has(k)) return false; seen.add(k); return true; }); }
  if (q.order.length) {
    const labels = selItems.map(s => s.label.toLowerCase());
    const keyFn = (o, r) => {
      if (o.e.k === 'col') { const i = labels.indexOf(o.e.name.toLowerCase()); if (i >= 0) return r.vals[i]; }
      if (o.e.k === 'lit' && typeof o.e.v === 'number') return r.vals[o.e.v - 1];
      return evalExpr(o.e, r.src, r.aggs);
    };
    outRows.sort((a, b) => { for (const o of q.order) { const c = cmpVal(keyFn(o, a), keyFn(o, b)); if (c) return c * o.dir; } return 0; });
  }
  if (q.limit != null) outRows = outRows.slice(0, q.limit);
  return { cols: selItems.map(s => s.label), rows: outRows.map(r => r.vals) };
}

export default function (root) {
  const s = store('sql-playground');
  const ta = el('textarea', { class: 'textarea', style: { minHeight: '110px' }, placeholder: 'SELECT * FROM customers', value: s.get('sql', EXAMPLES[0][1]) });
  const out = el('div');
  const msg = el('div', { class: 'small muted' });
  const historyBox = el('div', { class: 'col' });
  let history = s.get('history', []);

  function fmt(v) { if (v == null) return el('span', { class: 'muted' }, 'NULL'); if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, ''); return String(v); }
  function showTable(cols, rows) {
    return el('div', { class: 'scroll-x' }, el('table', { class: 'table mono' },
      el('thead', {}, el('tr', {}, cols.map(c => el('th', {}, c)))),
      el('tbody', {}, rows.map(r => el('tr', {}, r.map(v => el('td', {}, fmt(v))))))));
  }
  function run() {
    const sql = ta.value.trim(); s.set('sql', sql);
    if (!sql) { render(out); msg.textContent = ''; return; }
    const t0 = performance.now();
    try {
      const res = execute(sql);
      render(out, showTable(res.cols, res.rows));
      msg.textContent = res.rows.length + ' row' + (res.rows.length === 1 ? '' : 's') + ' in ' + (performance.now() - t0).toFixed(1) + ' ms';
      msg.style.color = '';
      history = [sql, ...history.filter(h => h !== sql)].slice(0, 8); s.set('history', history); showHistory();
    } catch (e) {
      render(out); msg.textContent = 'Error: ' + e.message; msg.style.color = 'var(--danger)';
    }
  }
  function showHistory() {
    render(historyBox, el('div', { class: 'small muted' }, 'Recent queries'), history.length ? history.map(h => el('button', { class: 'btn small ghost mono', style: { textAlign: 'left', whiteSpace: 'normal' }, onclick: () => { ta.value = h; run(); } }, h.length > 90 ? h.slice(0, 90) + '…' : h)) : el('div', { class: 'small muted' }, 'none yet'));
  }
  ta.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); } });

  const schema = el('div', { class: 'panel', style: { minWidth: '200px' } },
    el('div', { class: 'small muted', style: { marginBottom: '6px' } }, 'Schema'),
    Object.entries(TABLES).map(([name, t]) => el('div', { style: { marginBottom: '8px' } },
      el('button', { class: 'btn small', onclick: () => { ta.value = 'SELECT * FROM ' + name; run(); } }, name),
      el('span', { class: 'muted small' }, ' ' + t.rows.length + ' rows'),
      el('div', { class: 'mono small', style: { paddingLeft: '8px' } }, t.cols.map(c => el('div', {}, c, ' ', el('span', { class: 'muted' }, typeof t.rows[0][t.cols.indexOf(c)] === 'number' ? 'num' : 'text')))))));

  render(root,
    el('div', { class: 'row', style: { alignItems: 'flex-start' } },
      el('div', { class: 'grow', style: { minWidth: '260px' } },
        ta,
        el('div', { class: 'row' },
          el('button', { class: 'btn primary', onclick: run }, 'Run (Ctrl+Enter)'),
          el('button', { class: 'btn ghost', onclick: () => copy(ta.value) }, 'Copy SQL'),
          el('button', { class: 'btn ghost', onclick: () => { ta.value = ''; run(); ta.focus(); } }, 'Clear'),
          msg),
        el('div', { class: 'row' }, el('span', { class: 'small muted' }, 'Examples:'), EXAMPLES.map(([label, sql]) => el('button', { class: 'btn small', onclick: () => { ta.value = sql; run(); } }, label))),
        out,
        historyBox),
      schema),
    el('div', { class: 'muted small' }, 'Supported: SELECT [DISTINCT] columns or *, expressions with + - * /, FROM one table, [INNER] JOIN ... ON a = b (chainable), WHERE with = <> < > <= >= LIKE AND OR NOT and parentheses, GROUP BY with COUNT SUM AVG MIN MAX, ORDER BY ... ASC|DESC, LIMIT n, AS aliases. Strings use single quotes; LIKE uses % and _.'));
  showHistory(); run();
}
