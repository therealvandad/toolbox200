// node check.mjs [group ...]   — imports every tool module to catch syntax/import errors,
// and validates registry entries. DOM is stubbed minimally so top-level code does not explode.
import { readdirSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

globalThis.document ??= { getElementById: () => null, createElement: () => ({ style: {}, setAttribute() {}, addEventListener() {}, append() {} }), addEventListener() {}, body: { append() {} } };
globalThis.window ??= { addEventListener() {}, matchMedia: () => ({ matches: false }) };
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.navigator ??= {};
globalThis.requestAnimationFrame ??= () => 0;

const root = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const toolsDir = path.join(root, 'tools');
const groups = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync(toolsDir).filter(g => !g.startsWith('_'));
const validCats = new Set(['tiny', 'writing', 'design', 'media', 'learning', 'health', 'home', 'social', 'dev', 'games', 'fun']);
let errors = 0, count = 0;
const ids = new Map();
const fail = (m) => { console.error('  ✗ ' + m); errors++; };

for (const g of groups) {
  const idx = path.join(toolsDir, g, 'index.js');
  console.log(`[${g}]`);
  if (!existsSync(idx)) { fail('missing index.js'); continue; }
  let entries;
  try { entries = (await import(pathToFileURL(idx).href)).default; } catch (e) { fail('index.js failed to import: ' + e.message); continue; }
  if (!Array.isArray(entries)) { fail('index.js default export is not an array'); continue; }
  for (const t of entries) {
    const tag = `#${t.num} ${t.id}`;
    if (!Number.isInteger(t.num)) fail(tag + ': num missing');
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(t.id || '')) fail(tag + ': bad id');
    if (ids.has(t.id)) fail(tag + ': duplicate id (also in ' + ids.get(t.id) + ')'); else ids.set(t.id, g);
    if (!validCats.has(t.category)) fail(tag + ': bad category ' + t.category);
    if (!t.title || !t.desc) fail(tag + ': title/desc missing');
    if (typeof t.load !== 'function') { fail(tag + ': load missing'); continue; }
    try {
      const mod = await t.load();
      if (typeof (mod.default || mod.render) !== 'function') fail(tag + ': module has no default export function');
      else count++;
    } catch (e) { fail(tag + ': ' + e.message.split('\n')[0]); }
  }
  console.log(`  ${entries.length} entries`);
}
console.log(errors ? `\n${errors} problem(s)` : `\nOK — ${count} tools import cleanly`);
process.exit(errors ? 1 : 0);
