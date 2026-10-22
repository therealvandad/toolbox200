# How a tool is built

Toolbox 200 is a static site: plain ES modules, no build step, no backend, no framework.
Everything runs in the browser and persists only to `localStorage`.

## Files

- `index.html`, `styles.css`, `app.js` — the shell (search, sidebar, hash router). Do not edit.
- `lib/ui.js` — shared helpers. Do not edit; import from it.
- `registry.js` — imports every group index. Do not edit.
- `tools/<group>/index.js` — the group's registry entries (see `tools/_example/index.js`).
- `tools/<group>/<id>.js` — one file per tool (see `tools/_example/word-counter.js`).

## Tool contract

```js
import { el, render, store, ... } from '../../lib/ui.js';
export default function (root, ctx) {
  // build UI inside root (a <div class="tool">)
  // optionally return () => {} cleanup: clear timers/rAF, stop media streams, remove window listeners
}
```

`render` may be async. Keep each tool self-contained in its own file. Never use `document.getElementById`
for your own elements; keep references to the nodes you create. Never add global CSS; inline `style` or the
shared classes below are enough. Do not listen on `window`/`document` without removing the listener in cleanup.

## Registry entry

```js
{ num: 12, id: 'tip-splitter', category: 'tiny', title: 'Tip and bill splitter',
  desc: 'One sentence shown on the card.', keywords: 'extra search words', load: () => import('./tip-splitter.js') }
```

`id` is kebab-case and unique across the whole site. `category` is one of:
`tiny writing design media learning health home social dev games fun`.

## Helpers in lib/ui.js

| helper | use |
|---|---|
| `el(tag, attrs, ...children)` | create elements. `class`, `style` (object or string), `onclick`/`oninput`/..., `value`, `html` |
| `render(node, ...children)` | replace children |
| `store(ns)` | `.get(k, fallback)`, `.set(k, v)`, `.del(k)` namespaced localStorage |
| `download(name, contentOrBlob, mime)` | save a file |
| `copy(text)` | clipboard + toast |
| `toast(msg)` | small bottom message |
| `readFile(file, 'text'|'dataURL'|'arrayBuffer')` | promise |
| `loadImage(fileOrUrl)` | promise of `<img>` |
| `dropZone(label, onFiles, accept, multiple)` | drag-drop + click to pick |
| `fmtBytes(n)`, `uid()`, `pad(n,w)`, `shuffle(arr)`, `rng(seed)`, `today()` | misc |
| `loop(fn(dt, t))` | rAF loop, returns stop() |
| `stat(value, label)`, `field(label, control)` | small UI pieces |

## Shared CSS classes (styles.css)

Layout: `row` (flex, wraps) · `col` · `grid2` · `grow` · `center` · `hidden` · `scroll-x`
Controls: `btn` (+ `primary` `danger` `ghost` `small`) · `input` · `select` · `textarea` (+ `prose`) · `label.field` · `label.inline`
Display: `panel` · `stat` · `badge` (+ `ok` `warn` `danger`) · `table` · `list` · `bar` (div inside = fill) · `pre.out` · `kbd` · `canvas-wrap` · `cal` · `drop`
Text: `muted` · `small` · `mono` · `big` · `huge`
Colors via CSS variables: `--bg --panel --text --muted --line --accent --danger --ok --warn` (work in light and dark).

## Rules

- Real, working functionality. No "coming soon", no placeholders, no alert()/prompt()/confirm().
- No network calls unless the tool fundamentally needs one; then only to a public CORS-enabled endpoint,
  with a clear error message when it fails.
- No external libraries unless genuinely unavoidable (then load from cdnjs/jsdelivr with an exact pinned version
  via a dynamic `<script>` tag inside the tool, with a loading message).
- Works at phone width (wrap rows, `max-width:100%` on canvases).
- Works in both themes (use the CSS variables, never hard-coded white/black backgrounds).
- Keyboard-usable where it matters (Enter submits, Esc clears).
- Check your group with `node check.mjs <group>` from the project folder. It must print OK.

## Share links

The router treats everything after `#/tool/` as the tool id, so a tool that shares state through a link puts
its data in the query string before the hash, e.g. `?s=<base64url>#/tool/rsvp`, and reads `location.search` itself.
