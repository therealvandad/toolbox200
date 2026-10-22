# Toolbox 200

One website, 200 small tools. Everything runs in your browser: no accounts, no server, no build step.
Data you enter stays in your browser's local storage.

## Run it

Any static file server works. From this folder:

```bash
python -m http.server 8777
```

Then open http://localhost:8777. (Opening `index.html` directly from disk does not work because the
site uses ES modules, which browsers block on `file://`.)

To put it online, upload the folder as-is to GitHub Pages, Netlify, Cloudflare Pages, or any web host.

## Using it

- Press `/` to jump to the search box. Type a word, a number, or part of a description.
- The sidebar filters by category. Every tool has a direct link, for example `#/tool/wordle`.
- The ◐ button switches between light and dark.
- Most tools keep their state when you come back. Clearing site data in the browser resets everything.

## Categories

| Category | Tools |
|---|---|
| Tiny tools | 1–30: converters, calculators, generators, testers |
| Text & writing | 31–50: editors, checkers, formatters |
| Images & design | 51–70: canvas-based image tools and CSS generators |
| Audio & video | 71–85: Web Audio instruments, recorders, converters |
| Learning | 86–105: quizzes, trainers, visualizers |
| Health & lifestyle | 106–120: trackers and timers |
| Home & money | 121–135: budgets, planners, inventories |
| Social & events | 136–150: organizers that share through links and codes |
| Developer tools | 151–170: API, lint, diff, lookup tools |
| Games | 171–190: playable classics and originals |
| Weird & fun | 191–200: toys |

## Limits worth knowing

- Social tools have no backend. Sharing works through links that carry the data and short codes people send back.
- A few developer tools call public APIs (npm registry, Cloudflare and Google DNS, crt.sh). They show a clear
  message if the browser or network blocks the call.
- The speed test uses Cloudflare's public speed endpoints.

## Adding or changing a tool

See [CONTRIBUTING.md](CONTRIBUTING.md). Each tool is one JavaScript file plus one registry entry.
Run `node check.mjs` to make sure every tool still imports cleanly.

## Layout

- `index.html`, `styles.css`, `app.js`: the shell (search, sidebar, router, theme).
- `lib/ui.js`: shared helpers every tool uses.
- `registry.js`: the list of all tools, assembled from `tools/*/index.js`.
- `tools/<group>/`: the tools themselves.
