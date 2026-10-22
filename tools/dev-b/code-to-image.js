// Code to image: a small built-in tokenizer paints highlighted code onto a canvas with window chrome, then exports PNG.
import { el, render, store, download, toast, field } from '../../lib/ui.js';

const KW = {
  js: 'const let var function return if else for while do switch case break continue new class extends super this import export default from async await try catch finally throw typeof instanceof in of void delete yield static get set null undefined true false',
  py: 'def class return if elif else for while in not and or is None True False import from as with try except finally raise lambda yield pass break continue global nonlocal assert del async await print self',
  bash: 'if then else elif fi for while until do done case esac in function return exit echo export local readonly set unset source cd ls rm cp mv mkdir sudo true false',
  json: 'true false null',
  css: '',
  html: '',
};
const STR = /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/y;
const NUM = /0x[0-9a-fA-F]+|\b\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?\b/y;
const WORD = /[A-Za-z_$][\w$]*/y;
const WS = /\s+/y;

/** Returns array of {t: type, s: text}. Types: kw str com num id op var attr tag prop sel. */
function tokenize(code, lang) {
  if (lang === 'html') return tokenizeHtml(code);
  const kws = new Set((KW[lang] || '').split(' ').filter(Boolean));
  const rules = [];
  const push = (re, t) => rules.push([re, t]);
  if (lang === 'js' || lang === 'css') push(/\/\/.*|\/\*[\s\S]*?\*\//y, 'com');
  if (lang === 'py' || lang === 'bash') push(/#.*/y, 'com');
  if (lang === 'py') push(/"""[\s\S]*?"""|'''[\s\S]*?'''/y, 'str');
  if (lang === 'py') push(/@[\w.]+/y, 'attr');
  if (lang === 'bash') push(/\$\{[^}]*\}|\$\w+|\$[#?@*!$]/y, 'var');
  if (lang === 'json') push(/"(?:[^"\\]|\\.)*"(?=\s*:)/y, 'attr');
  if (lang === 'css') {
    push(/@[\w-]+/y, 'kw');
    push(/#[0-9a-fA-F]{3,8}\b/y, 'num');
    push(/-?\d*\.?\d+(?:px|em|rem|%|vh|vw|s|ms|deg|fr|pt)?/y, 'num');
    push(/[\w-]+(?=\s*:)/y, 'prop');
    push(/[.#][\w-]+|::?[\w-]+(?:\([^)]*\))?/y, 'sel');
    push(/![\w]+/y, 'kw');
  }
  push(STR, 'str');
  push(NUM, 'num');
  push(WORD, 'id');
  push(WS, 'ws');
  push(/[^\s\w]/y, 'op');
  const out = [];
  let i = 0;
  while (i < code.length) {
    let hit = false;
    for (const [re, t] of rules) {
      re.lastIndex = i;
      const m = re.exec(code);
      if (m && m[0].length) {
        let type = t;
        if (t === 'id' && kws.has(m[0])) type = 'kw';
        if (lang === 'js' && t === 'id' && /^[A-Z]/.test(m[0])) type = 'type';
        if (t === 'id' && !kws.has(m[0]) && code[i + m[0].length] === '(') type = 'fn';
        if (t === 'id' && lang === 'css') type = 'id';
        out.push({ t: type, s: m[0] });
        i += m[0].length; hit = true; break;
      }
    }
    if (!hit) { out.push({ t: 'op', s: code[i] }); i++; }
  }
  return out;
}

function tokenizeHtml(code) {
  const out = [];
  let i = 0;
  const TAG = /<\/?[\w:-]+|<!DOCTYPE[^>]*>/iy, COM = /<!--[\s\S]*?-->/y, ATTR = /[\w:@.-]+/y, END = /\/?>/y;
  while (i < code.length) {
    COM.lastIndex = i; let m = COM.exec(code);
    if (m) { out.push({ t: 'com', s: m[0] }); i += m[0].length; continue; }
    TAG.lastIndex = i; m = TAG.exec(code);
    if (m) {
      if (/^<!/.test(m[0])) { out.push({ t: 'com', s: m[0] }); i += m[0].length; continue; }
      out.push({ t: 'tag', s: m[0] }); i += m[0].length;
      // inside tag
      while (i < code.length) {
        END.lastIndex = i; m = END.exec(code);
        if (m) { out.push({ t: 'tag', s: m[0] }); i += m[0].length; break; }
        WS.lastIndex = i; m = WS.exec(code);
        if (m) { out.push({ t: 'ws', s: m[0] }); i += m[0].length; continue; }
        STR.lastIndex = i; m = STR.exec(code);
        if (m) { out.push({ t: 'str', s: m[0] }); i += m[0].length; continue; }
        ATTR.lastIndex = i; m = ATTR.exec(code);
        if (m) { out.push({ t: 'attr', s: m[0] }); i += m[0].length; continue; }
        out.push({ t: 'op', s: code[i] }); i++;
      }
      continue;
    }
    const j = code.indexOf('<', i + 1);
    const text = code.slice(i, j < 0 ? code.length : j);
    out.push({ t: 'id', s: text }); i += text.length;
  }
  return out;
}

const THEMES = {
  midnight: { name: 'Midnight', outer: ['#1e3c72', '#2a5298'], win: '#0f1117', text: '#e6e8ef', com: '#6b7280', str: '#9ece6a', kw: '#bb9af7', num: '#ff9e64', fn: '#7aa2f7', type: '#2ac3de', attr: '#e0af68', tag: '#f7768e', prop: '#7dcfff', sel: '#9ece6a', var: '#e0af68', op: '#89ddff', id: '#e6e8ef', ln: '#4b5263', dots: ['#ff5f56', '#ffbd2e', '#27c93f'] },
  dracula: { name: 'Dracula', outer: ['#ff79c6', '#bd93f9'], win: '#282a36', text: '#f8f8f2', com: '#6272a4', str: '#f1fa8c', kw: '#ff79c6', num: '#bd93f9', fn: '#50fa7b', type: '#8be9fd', attr: '#50fa7b', tag: '#ff79c6', prop: '#8be9fd', sel: '#50fa7b', var: '#ffb86c', op: '#ff79c6', id: '#f8f8f2', ln: '#6272a4', dots: ['#ff5f56', '#ffbd2e', '#27c93f'] },
  nord: { name: 'Nord', outer: ['#434c5e', '#5e81ac'], win: '#2e3440', text: '#d8dee9', com: '#616e88', str: '#a3be8c', kw: '#81a1c1', num: '#b48ead', fn: '#88c0d0', type: '#8fbcbb', attr: '#8fbcbb', tag: '#81a1c1', prop: '#88c0d0', sel: '#8fbcbb', var: '#d08770', op: '#81a1c1', id: '#d8dee9', ln: '#4c566a', dots: ['#bf616a', '#ebcb8b', '#a3be8c'] },
  github: { name: 'GitHub light', outer: ['#f093fb', '#f5576c'], win: '#ffffff', text: '#24292f', com: '#6e7781', str: '#0a3069', kw: '#cf222e', num: '#0550ae', fn: '#8250df', type: '#953800', attr: '#0550ae', tag: '#116329', prop: '#0550ae', sel: '#116329', var: '#953800', op: '#24292f', id: '#24292f', ln: '#8c959f', dots: ['#ff5f56', '#ffbd2e', '#27c93f'] },
  solarized: { name: 'Solarized light', outer: ['#f6d365', '#fda085'], win: '#fdf6e3', text: '#586e75', com: '#93a1a1', str: '#2aa198', kw: '#859900', num: '#d33682', fn: '#268bd2', type: '#b58900', attr: '#b58900', tag: '#268bd2', prop: '#268bd2', sel: '#b58900', var: '#cb4b16', op: '#586e75', id: '#586e75', ln: '#93a1a1', dots: ['#dc322f', '#b58900', '#859900'] },
  mono: { name: 'Monochrome', outer: ['#e9ecef', '#ced4da'], win: '#111111', text: '#f3f3f3', com: '#777', str: '#dddddd', kw: '#ffffff', num: '#dddddd', fn: '#f3f3f3', type: '#f3f3f3', attr: '#cccccc', tag: '#ffffff', prop: '#cccccc', sel: '#ffffff', var: '#cccccc', op: '#aaaaaa', id: '#f3f3f3', ln: '#555', dots: ['#555', '#777', '#999'] },
};

const SAMPLE = `// Debounce: wait until typing stops before running fn
export function debounce(fn, wait = 250) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

const search = debounce(q => console.log('search', q), 300);
search("toolbox 200");`;

export default function (root) {
  const s = store('code-to-image');
  const opt = Object.assign({ lang: 'js', theme: 'midnight', pad: 48, chrome: true, lines: true, font: 15, title: 'snippet.js', bg: true }, s.get('opt', {}));
  const ta = el('textarea', { class: 'textarea', spellcheck: false, placeholder: 'Paste code…', value: s.get('code', SAMPLE), style: { minHeight: '160px' } });
  const langSel = el('select', { class: 'select', value: opt.lang }, ...[['js', 'JavaScript / TS'], ['py', 'Python'], ['html', 'HTML'], ['css', 'CSS'], ['bash', 'Shell'], ['json', 'JSON'], ['txt', 'Plain text']].map(([v, t]) => el('option', { value: v, selected: v === opt.lang }, t)));
  const themeSel = el('select', { class: 'select' }, ...Object.entries(THEMES).map(([k, t]) => el('option', { value: k, selected: k === opt.theme }, t.name)));
  const padIn = el('input', { type: 'range', min: 0, max: 120, step: 4, value: opt.pad });
  const padLbl = el('span', { class: 'muted small mono' }, opt.pad + 'px');
  const fontIn = el('input', { type: 'range', min: 11, max: 24, step: 1, value: opt.font });
  const fontLbl = el('span', { class: 'muted small mono' }, opt.font + 'px');
  const chromeChk = el('input', { type: 'checkbox', checked: opt.chrome });
  const linesChk = el('input', { type: 'checkbox', checked: opt.lines });
  const bgChk = el('input', { type: 'checkbox', checked: opt.bg });
  const titleIn = el('input', { class: 'input', value: opt.title, placeholder: 'window title', style: { width: '160px' } });
  const canvas = el('canvas', { style: { maxWidth: '100%', borderRadius: '8px' } });
  const info = el('div', { class: 'muted small' });
  let timer = null;

  function save() {
    Object.assign(opt, { lang: langSel.value, theme: themeSel.value, pad: +padIn.value, font: +fontIn.value, chrome: chromeChk.checked, lines: linesChk.checked, bg: bgChk.checked, title: titleIn.value });
    s.set('opt', opt); s.set('code', ta.value);
  }

  function draw() {
    save();
    const th = THEMES[opt.theme];
    const code = ta.value.replace(/\t/g, '    ').replace(/\r/g, '');
    const lines = code.split('\n');
    const tokens = opt.lang === 'txt' ? [{ t: 'id', s: code }] : tokenize(code, opt.lang);
    // split tokens by line, keeping type
    const rows = [[]];
    for (const tk of tokens) {
      const parts = tk.s.split('\n');
      parts.forEach((p, i) => { if (i) rows.push([]); if (p) rows[rows.length - 1].push({ t: tk.t, s: p }); });
    }
    while (rows.length < lines.length) rows.push([]);
    const dpr = 2;
    const fs = opt.font, lh = Math.round(fs * 1.6), fontStr = `${fs}px ui-monospace, Consolas, Menlo, monospace`;
    const ctx = canvas.getContext('2d');
    ctx.font = fontStr;
    const gutter = opt.lines ? ctx.measureText(String(lines.length)).width + fs * 1.5 : 0;
    let maxW = 0;
    for (const line of lines) maxW = Math.max(maxW, ctx.measureText(line).width);
    const inner = 24, chromeH = opt.chrome ? 40 : 0;
    const winW = Math.max(320, Math.ceil(maxW + gutter + inner * 2));
    const winH = chromeH + inner * 2 + lines.length * lh;
    const pad = opt.bg ? opt.pad : 0;
    const W = winW + pad * 2, H = winH + pad * 2;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = Math.min(W, 1100) + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (opt.bg) {
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, th.outer[0]); g.addColorStop(1, th.outer[1]);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 18;
    }
    ctx.fillStyle = th.win;
    roundRect(ctx, pad, pad, winW, winH, opt.bg ? 12 : 0); ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    if (opt.chrome) {
      th.dots.forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(pad + 20 + i * 20, pad + 20, 6, 0, Math.PI * 2); ctx.fill(); });
      if (opt.title) {
        ctx.fillStyle = th.com; ctx.font = `${Math.max(11, fs - 2)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(opt.title, pad + winW / 2, pad + 20); ctx.textAlign = 'left';
      }
    }
    ctx.font = fontStr; ctx.textBaseline = 'middle';
    const x0 = pad + inner + gutter, y0 = pad + chromeH + inner;
    rows.forEach((row, i) => {
      const y = y0 + i * lh + lh / 2;
      if (opt.lines) { ctx.fillStyle = th.ln; ctx.textAlign = 'right'; ctx.fillText(String(i + 1), pad + inner + gutter - fs, y); ctx.textAlign = 'left'; }
      let x = x0;
      for (const tk of row) {
        ctx.fillStyle = th[tk.t] || th.text;
        ctx.fillText(tk.s, x, y);
        x += ctx.measureText(tk.s).width;
      }
    });
    render(info, `${W} × ${H} px (exported at 2×: ${W * 2} × ${H * 2}) · ${lines.length} lines`);
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  const schedule = () => { clearTimeout(timer); timer = setTimeout(draw, 120); };
  const nameFor = () => (opt.title || 'code').replace(/\.[^.]+$/, '') + '.png';
  const toPng = () => new Promise(res => canvas.toBlob(res, 'image/png'));
  async function copyImage() {
    try {
      const blob = await toPng();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      toast('Image copied');
    } catch { toast('Clipboard images not supported here; use Download'); }
  }

  ta.addEventListener('input', schedule);
  ta.addEventListener('keydown', e => { if (e.key === 'Tab') { e.preventDefault(); const st = ta.selectionStart; ta.setRangeText('  ', st, ta.selectionEnd, 'end'); schedule(); } });
  for (const c of [langSel, themeSel, chromeChk, linesChk, bgChk]) c.addEventListener('change', draw);
  titleIn.addEventListener('input', schedule);
  padIn.addEventListener('input', () => { padLbl.textContent = padIn.value + 'px'; schedule(); });
  fontIn.addEventListener('input', () => { fontLbl.textContent = fontIn.value + 'px'; schedule(); });

  render(root,
    ta,
    el('div', { class: 'row' },
      field('Language', langSel), field('Theme', themeSel), field('Title', titleIn),
      field('Padding', el('div', { class: 'row', style: { margin: 0 } }, padIn, padLbl)),
      field('Font size', el('div', { class: 'row', style: { margin: 0 } }, fontIn, fontLbl))),
    el('div', { class: 'row' },
      el('label', { class: 'inline' }, chromeChk, 'Window chrome'),
      el('label', { class: 'inline' }, linesChk, 'Line numbers'),
      el('label', { class: 'inline' }, bgChk, 'Background'),
      el('span', { class: 'grow' }),
      el('button', { class: 'btn primary', onclick: async () => { const b = await toPng(); if (b) download(nameFor(), b, 'image/png'); } }, 'Download PNG'),
      el('button', { class: 'btn', onclick: copyImage }, 'Copy image'),
      el('button', { class: 'btn ghost small', onclick: () => { ta.value = SAMPLE; langSel.value = 'js'; draw(); } }, 'Sample')),
    el('div', { class: 'canvas-wrap', style: { overflow: 'auto' } }, canvas),
    info);
  draw();
  return () => clearTimeout(timer);
}
