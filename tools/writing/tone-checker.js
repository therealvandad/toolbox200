import { el, render, store, stat } from '../../lib/ui.js';

const IMPERATIVES = 'send do fix make give tell stop get let take bring call answer reply respond write change finish complete submit update check explain remember forget listen look come go move read follow use put keep pay show prepare deliver clean start sort handle resolve provide review confirm'.split(' ');
const NEGATIVE = { never: 'rarely', wrong: 'not quite right', failed: 'did not succeed', fail: 'fall short', useless: 'not helpful', stupid: 'unwise', ridiculous: 'surprising', terrible: 'disappointing', awful: 'disappointing', horrible: 'disappointing', unacceptable: 'not what we need', incompetent: 'still learning', lazy: 'busy', ignore: 'overlook', ignored: 'overlooked', ignoring: 'overlooking', blame: 'responsibility', fault: 'oversight', mistake: 'error', bad: 'not ideal', worst: 'weakest', hate: 'dislike', annoying: 'frustrating', demand: 'ask', demanding: 'asking', unprofessional: 'not ideal', careless: 'rushed', pathetic: 'disappointing', disaster: 'setback', problem: 'challenge', complaint: 'concern', refuse: 'prefer not to', refused: 'preferred not to', impossible: 'difficult', nonsense: 'unclear', waste: 'poor use', pointless: 'unproductive', obviously: '', clearly: '', 'again and again': 'repeatedly', 'as i said': 'as mentioned' };
const NEG_WORDS = Object.keys(NEGATIVE).filter(k => !k.includes(' '));
const PHRASE_NEG = ['as i said', 'as i already', 'i already told', 'once again', 'again and again', 'your fault', 'you failed', 'you never', 'you always', 'not my problem', 'i don\'t care', 'i do not care', 'what were you thinking', 'how many times', 'make sure you', 'you need to', 'you must', 'you have to', 'you should have'];
const HEDGES = ['maybe', 'perhaps', 'possibly', 'might', 'could', 'would', 'i think', 'i guess', 'i feel', 'i believe', 'sort of', 'kind of', 'a bit', 'a little', 'somewhat', 'just', 'probably', 'seems', 'seem', 'appears', 'if possible', 'if you have time', 'if that works', 'when you get a chance', 'no rush', 'hopefully', 'i was wondering', 'not sure', 'bit of'];
const APOLOGY = ['sorry', 'apologize', 'apologise', 'apologies', 'my bad', 'forgive', 'unfortunately', 'regret', 'excuse me', 'pardon', 'sorry to bother', 'i hate to'];
const POLITE = ['please', 'thank', 'thanks', 'appreciate', 'grateful', 'kindly', 'would you mind', 'happy to', 'glad', 'welcome', 'great', 'wonderful'];

const re = (words) => new RegExp('(?:^|[^a-z])(' + words.map(w => w.replace(/[.*+?^${}()|[\]\\']/g, '\\$&').replace(/ /g, '\\s+')).join('|') + ')(?![a-z])', 'gi');
const R = { phraseNeg: re(PHRASE_NEG), neg: re(NEG_WORDS), hedge: re(HEDGES), apology: re(APOLOGY), polite: re(POLITE) };
const count = (rx, t) => { rx.lastIndex = 0; return [...t.matchAll(rx)].map(m => m[1].toLowerCase()); };

function splitSentences(text) {
  return (text.match(/[^.!?\n]+(?:[.!?]+["')]*|\n|$)/g) || []).map(x => x.trim()).filter(Boolean);
}

function analyzeSentence(t) {
  const lower = t.toLowerCase();
  const words = t.match(/[A-Za-z']+/g) || [];
  const first = (words[0] || '').toLowerCase();
  const hasPolite = count(R.polite, t);
  const imperative = IMPERATIVES.includes(first) && !hasPolite.includes('please');
  const caps = words.filter(w => w.length >= 3 && w === w.toUpperCase() && !/^(?:USA|CEO|FAQ|ASAP|PDF|API|URL|UK|EU|CTO|CFO|FYI|ETA|HR|IT)$/.test(w));
  const asap = /\basap\b/i.test(t);
  const excl = (t.match(/!/g) || []).length;
  const qmarks = (t.match(/\?{2,}|!\?|\?!/g) || []).length;
  const neg = count(R.neg, t), pneg = count(R.phraseNeg, t);
  const hedges = count(R.hedge, t), apol = count(R.apology, t);
  let harsh = 0;
  if (imperative) harsh += 2;
  harsh += caps.length * 2.5 + (asap ? 1.5 : 0) + Math.min(excl, 3) * 1.2 + qmarks * 1.5 + neg.length * 1.8 + pneg.length * 2.5;
  if (/\byou\b/i.test(t) && (neg.length || pneg.length)) harsh += 1;
  let soft = hedges.length * 1.2 + apol.length * 2 + hasPolite.length * 1.2;
  if (/\b(?:could|would|can) you\b/i.test(t)) soft += 1.5;
  const sug = [];
  if (imperative) sug.push(`Starts with a command ("${words[0]}"). Try "Could you ${first}..." or add "please".`);
  if (caps.length) sug.push(`Avoid ALL CAPS (${[...new Set(caps)].slice(0, 3).join(', ')}); it reads as shouting. Use italics or plain case.`);
  if (excl > 1 || (excl && harsh > 3)) sug.push('Swap exclamation marks for full stops to sound calmer.');
  if (asap) sug.push('Replace "ASAP" with a concrete time, such as "by Thursday if possible".');
  if (qmarks) sug.push('Use a single question mark.');
  for (const n of [...new Set(neg)]) { const alt = NEGATIVE[n]; sug.push(alt ? `Soften "${n}", for example "${alt}".` : `Consider dropping "${n}".`); }
  for (const p of [...new Set(pneg)]) sug.push(`"${p}" can sound accusing. Describe the situation instead of the person.`);
  if (hedges.length >= 3) sug.push(`Many hedges (${[...new Set(hedges)].join(', ')}). State your point more directly.`);
  if (apol.length >= 2) sug.push('Repeated apologies can weaken your message. One is enough.');
  if (hedges.includes('just')) sug.push('"just" often minimizes your request. Consider removing it.');
  return { t, harsh, soft, sug, level: harsh >= 4 ? 'danger' : harsh >= 2 ? 'warn' : soft >= 4 ? 'soft' : 'ok' };
}

export function analyzeTone(text) {
  const sentences = splitSentences(text).map(analyzeSentence);
  if (!sentences.length) return null;
  const n = sentences.length;
  const h = sentences.reduce((a, x) => a + x.harsh, 0), so = sentences.reduce((a, x) => a + x.soft, 0);
  const harshScore = Math.min(100, Math.round(100 * (1 - Math.exp(-h / (n * 1.5 + 2)))));
  const softScore = Math.min(100, Math.round(100 * (1 - Math.exp(-so / (n * 1.5 + 2)))));
  return { sentences, harshScore, softScore };
}

export default function (root) {
  const s = store('tone-checker');
  const ta = el('textarea', { class: 'textarea prose', rows: 8, placeholder: 'Paste your email draft here…', value: s.get('text', '') });
  const scores = el('div', { class: 'row' });
  const verdict = el('div', { class: 'row' });
  const list = el('div', { class: 'col' });

  const bar = (v, color) => el('div', { class: 'bar', style: { minWidth: '140px', flex: '1' } }, el('div', { style: { width: v + '%', background: color } }));
  function update() {
    s.set('text', ta.value);
    const a = analyzeTone(ta.value);
    if (!a) { render(scores); render(verdict); render(list, el('div', { class: 'empty' }, 'Paste an email to check its tone.')); return; }
    const { harshScore: H, softScore: S } = a;
    let label, cls;
    if (H >= 50) [label, cls] = ['Comes across as harsh', 'danger'];
    else if (H >= 25) [label, cls] = ['Quite direct, could feel blunt', 'warn'];
    else if (S >= 60) [label, cls] = ['Very soft, maybe over-cautious', 'warn'];
    else [label, cls] = ['Balanced and professional', 'ok'];
    render(verdict, el('span', { class: 'badge ' + cls }, label));
    render(scores,
      el('div', { class: 'stat', style: { flex: 1 } }, el('div', { class: 'v' }, H), el('div', { class: 'l' }, 'Harshness (0-100)'), bar(H, 'var(--danger)')),
      el('div', { class: 'stat', style: { flex: 1 } }, el('div', { class: 'v' }, S), el('div', { class: 'l' }, 'Softness (0-100)'), bar(S, 'var(--accent)')),
      stat(a.sentences.length, 'sentences'));
    render(list, a.sentences.map(x => {
      const colour = x.level === 'danger' ? 'var(--danger)' : x.level === 'warn' ? 'var(--warn)' : x.level === 'soft' ? 'var(--accent)' : 'var(--ok)';
      return el('div', { class: 'panel', style: { borderLeft: `4px solid ${colour}` } },
        el('div', {}, x.t),
        el('div', { class: 'row', style: { margin: '4px 0 0' } },
          el('span', { class: 'badge' }, 'harsh ' + x.harsh.toFixed(1)), el('span', { class: 'badge' }, 'soft ' + x.soft.toFixed(1))),
        x.sug.length ? el('ul', { class: 'small', style: { margin: '6px 0 0', paddingLeft: '20px' } }, x.sug.map(g => el('li', {}, g))) : el('div', { class: 'small muted' }, 'No issues found.'));
    }));
  }
  ta.addEventListener('input', update);
  render(root, ta, el('div', { class: 'row' }, el('button', { class: 'btn ghost small', onclick: () => { ta.value = ''; update(); } }, 'Clear')), verdict, scores, list,
    el('p', { class: 'muted small' }, 'This is a keyword-based heuristic, so use it as a prompt for your own judgment.'));
  update();
}
