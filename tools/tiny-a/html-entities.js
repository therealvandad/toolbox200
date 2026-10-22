import { el, render, store, copy } from '../../lib/ui.js';

// Common named entities (character -> name). Used for encoding and decoding.
const NAMED = {
  '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot', "'": 'apos', ' ': 'nbsp',
  '©': 'copy', '®': 'reg', '™': 'trade', '€': 'euro', '£': 'pound', '¥': 'yen', '¢': 'cent', '§': 'sect', '¶': 'para',
  '°': 'deg', '±': 'plusmn', '×': 'times', '÷': 'divide', 'µ': 'micro', '·': 'middot', '¿': 'iquest', '¡': 'iexcl',
  '«': 'laquo', '»': 'raquo', '‘': 'lsquo', '’': 'rsquo', '“': 'ldquo', '”': 'rdquo', '–': 'ndash', '—': 'mdash',
  '…': 'hellip', '•': 'bull', '†': 'dagger', '‡': 'Dagger', '‰': 'permil', '′': 'prime', '″': 'Prime',
  '¼': 'frac14', '½': 'frac12', '¾': 'frac34', '¹': 'sup1', '²': 'sup2', '³': 'sup3',
  '←': 'larr', '↑': 'uarr', '→': 'rarr', '↓': 'darr', '↔': 'harr', '⇐': 'lArr', '⇒': 'rArr', '⇔': 'hArr',
  '∀': 'forall', '∂': 'part', '∃': 'exist', '∅': 'empty', '∇': 'nabla', '∈': 'isin', '∉': 'notin', '∑': 'sum', '−': 'minus',
  '√': 'radic', '∞': 'infin', '∧': 'and', '∨': 'or', '∩': 'cap', '∪': 'cup', '∫': 'int', '≈': 'asymp', '≠': 'ne', '≡': 'equiv', '≤': 'le', '≥': 'ge',
  '♠': 'spades', '♣': 'clubs', '♥': 'hearts', '♦': 'diams',
  'À': 'Agrave', 'Á': 'Aacute', 'Â': 'Acirc', 'Ã': 'Atilde', 'Ä': 'Auml', 'Å': 'Aring', 'Æ': 'AElig', 'Ç': 'Ccedil',
  'È': 'Egrave', 'É': 'Eacute', 'Ê': 'Ecirc', 'Ë': 'Euml', 'Ì': 'Igrave', 'Í': 'Iacute', 'Î': 'Icirc', 'Ï': 'Iuml',
  'Ñ': 'Ntilde', 'Ò': 'Ograve', 'Ó': 'Oacute', 'Ô': 'Ocirc', 'Õ': 'Otilde', 'Ö': 'Ouml', 'Ø': 'Oslash',
  'Ù': 'Ugrave', 'Ú': 'Uacute', 'Û': 'Ucirc', 'Ü': 'Uuml', 'Ý': 'Yacute', 'ß': 'szlig',
  'à': 'agrave', 'á': 'aacute', 'â': 'acirc', 'ã': 'atilde', 'ä': 'auml', 'å': 'aring', 'æ': 'aelig', 'ç': 'ccedil',
  'è': 'egrave', 'é': 'eacute', 'ê': 'ecirc', 'ë': 'euml', 'ì': 'igrave', 'í': 'iacute', 'î': 'icirc', 'ï': 'iuml',
  'ñ': 'ntilde', 'ò': 'ograve', 'ó': 'oacute', 'ô': 'ocirc', 'õ': 'otilde', 'ö': 'ouml', 'ø': 'oslash',
  'ù': 'ugrave', 'ú': 'uacute', 'û': 'ucirc', 'ü': 'uuml', 'ý': 'yacute', 'ÿ': 'yuml',
  'α': 'alpha', 'β': 'beta', 'γ': 'gamma', 'δ': 'delta', 'ε': 'epsilon', 'λ': 'lambda', 'μ': 'mu', 'π': 'pi', 'σ': 'sigma', 'φ': 'phi', 'ω': 'omega',
  'Δ': 'Delta', 'Σ': 'Sigma', 'Ω': 'Omega', 'Π': 'Pi',
};
const BY_NAME = Object.fromEntries(Object.entries(NAMED).map(([c, n]) => [n, c]));

function encode(text, mode, scope) {
  let out = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    const basic = ch === '&' || ch === '<' || ch === '>' || ch === '"' || ch === "'";
    const nonAscii = cp > 126;
    const control = cp < 32 && ch !== '\n' && ch !== '\t' && ch !== '\r';
    if (!(basic || (scope === 'all' && (nonAscii || control)))) { out += ch; continue; }
    if (mode === 'named' && NAMED[ch] && ch !== "'") out += '&' + NAMED[ch] + ';';
    else if (mode === 'named' && ch === "'") out += '&#39;';
    else if (mode === 'hex') out += '&#x' + cp.toString(16).toUpperCase() + ';';
    else out += '&#' + cp + ';';
  }
  return out;
}

function decode(text) {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z][a-z0-9]*);/gi, (m, body) => {
    if (body[0] === '#') {
      const cp = body[1].toLowerCase() === 'x' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (!Number.isFinite(cp) || cp < 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) return m;
      return String.fromCodePoint(cp);
    }
    return Object.prototype.hasOwnProperty.call(BY_NAME, body) ? BY_NAME[body] : m;
  });
}

export default function (root) {
  const s = store('html-entities');
  const input = el('textarea', { class: 'textarea', placeholder: 'Type or paste text here…', value: s.get('text', '<p class="x">Café & “quotes” © 2024 — 5 < 6</p>') });
  const output = el('textarea', { class: 'textarea', readOnly: true, placeholder: 'Result appears here…' });
  let dir = s.get('dir', 'encode');
  let mode = s.get('mode', 'named');
  let scope = s.get('scope', 'basic');

  const dirSel = el('select', { class: 'select', onchange: () => { dir = dirSel.value; update(); } },
    el('option', { value: 'encode' }, 'Encode (text to entities)'),
    el('option', { value: 'decode' }, 'Decode (entities to text)'));
  const modeSel = el('select', { class: 'select', onchange: () => { mode = modeSel.value; update(); } },
    el('option', { value: 'named' }, 'Named (&eacute;)'),
    el('option', { value: 'dec' }, 'Numeric decimal (&#233;)'),
    el('option', { value: 'hex' }, 'Numeric hex (&#xE9;)'));
  const scopeSel = el('select', { class: 'select', onchange: () => { scope = scopeSel.value; update(); } },
    el('option', { value: 'basic' }, 'Only & < > " \''),
    el('option', { value: 'all' }, 'Also all non-ASCII characters'));
  dirSel.value = dir; modeSel.value = mode; scopeSel.value = scope;
  const encOpts = el('div', { class: 'row' }, el('label', { class: 'field' }, 'Format', modeSel), el('label', { class: 'field' }, 'Characters to encode', scopeSel));

  function update() {
    const t = input.value;
    output.value = dir === 'encode' ? encode(t, mode, scope) : decode(t);
    encOpts.classList.toggle('hidden', dir !== 'encode');
    s.set('text', t); s.set('dir', dir); s.set('mode', mode); s.set('scope', scope);
  }
  input.addEventListener('input', update);

  render(root,
    el('div', { class: 'row' }, el('label', { class: 'field' }, 'Direction', dirSel)),
    encOpts,
    el('div', { class: 'grid2' },
      el('label', { class: 'field' }, 'Input', input),
      el('label', { class: 'field' }, 'Output', output)),
    el('div', { class: 'row' },
      el('button', { class: 'btn primary', onclick: () => copy(output.value) }, 'Copy output'),
      el('button', { class: 'btn', onclick: () => { input.value = output.value; dir = dir === 'encode' ? 'decode' : 'encode'; dirSel.value = dir; update(); } }, 'Use output as input (and flip)'),
      el('button', { class: 'btn ghost', onclick: () => { input.value = ''; update(); } }, 'Clear'),
      el('span', { class: 'small muted' }, 'Decoder understands ' + Object.keys(BY_NAME).length + ' named entities plus any &#decimal; and &#xHEX; code.')));
  update();
}
