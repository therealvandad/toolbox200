import { el, render, store, copy, stat } from '../../lib/ui.js';

const JARGON = {
  'utilize': ['use'], 'utilise': ['use'], 'utilization': ['use'], 'leverage': ['use'], 'commence': ['start', 'begin'], 'commencing': ['starting'], 'terminate': ['end', 'stop'], 'endeavor': ['try'], 'endeavour': ['try'],
  'facilitate': ['help', 'make easier'], 'implement': ['carry out', 'put in place'], 'subsequently': ['later', 'then'], 'prior to': ['before'], 'in order to': ['to'], 'due to the fact that': ['because'],
  'in the event that': ['if'], 'with regard to': ['about'], 'with respect to': ['about'], 'pertaining to': ['about'], 'in addition': ['also'], 'additionally': ['also'], 'furthermore': ['also', 'and'],
  'nevertheless': ['but', 'still'], 'consequently': ['so'], 'therefore': ['so'], 'approximately': ['about'], 'demonstrate': ['show'], 'indicate': ['show', 'say'], 'obtain': ['get'], 'acquire': ['get', 'buy'],
  'purchase': ['buy'], 'assist': ['help'], 'assistance': ['help'], 'require': ['need'], 'requirement': ['need'], 'sufficient': ['enough'], 'insufficient': ['not enough'], 'numerous': ['many'], 'a number of': ['some', 'several'],
  'attempt': ['try'], 'inform': ['tell'], 'notify': ['tell'], 'regarding': ['about'], 'concerning': ['about'], 'ascertain': ['find out'], 'determine': ['decide', 'find out'], 'endeavour to': ['try to'],
  'optimal': ['best'], 'optimize': ['improve'], 'optimise': ['improve'], 'maximize': ['increase'], 'minimize': ['reduce'], 'modify': ['change'], 'alteration': ['change'], 'enhance': ['improve'], 'enhancement': ['improvement'],
  'comprehend': ['understand'], 'component': ['part'], 'individual': ['person'], 'individuals': ['people'], 'residence': ['home'], 'reside': ['live'], 'purchaser': ['buyer'], 'remuneration': ['pay'],
  'disseminate': ['share', 'spread'], 'finalize': ['finish', 'complete'], 'finalise': ['finish', 'complete'], 'initiate': ['start'], 'proceed': ['go ahead', 'continue'], 'ameliorate': ['improve'], 'expedite': ['speed up'],
  'elucidate': ['explain'], 'cognizant': ['aware'], 'endeavors': ['tries'], 'methodology': ['method'], 'functionality': ['features'], 'paradigm': ['model'], 'synergy': ['teamwork'], 'stakeholder': ['interested party'],
  'stakeholders': ['people involved'], 'bandwidth': ['time', 'capacity'], 'actionable': ['practical'], 'deliverable': ['result', 'product'], 'deliverables': ['results'], 'granular': ['detailed'], 'robust': ['strong'],
  'scalable': ['able to grow'], 'seamless': ['smooth'], 'holistic': ['complete', 'whole'], 'proactive': ['forward-looking'], 'ideate': ['brainstorm'], 'onboard': ['bring in', 'welcome'], 'circle back': ['return to'],
  'touch base': ['talk', 'check in'], 'going forward': ['from now on'], 'at this point in time': ['now'], 'at the present time': ['now'], 'in the near future': ['soon'], 'for the purpose of': ['for', 'to'],
  'has the ability to': ['can'], 'is able to': ['can'], 'in spite of the fact that': ['although'], 'on a daily basis': ['daily'], 'in close proximity to': ['near'], 'proximity': ['nearness'], 'adjacent to': ['next to'],
  'pursuant to': ['under'], 'aforementioned': ['this', 'that'], 'herein': ['here'], 'thereof': ['of it'], 'notwithstanding': ['despite'], 'whereas': ['while'], 'heretofore': ['until now'], 'shall': ['must', 'will'],
  'ensure': ['make sure'], 'subsequent': ['later', 'next'], 'preceding': ['earlier', 'previous'], 'discontinue': ['stop'], 'accomplish': ['do', 'achieve'], 'accordingly': ['so'], 'commencement': ['start'], 'cessation': ['end'],
  'magnitude': ['size'], 'thus': ['so'], 'hence': ['so'], 'whilst': ['while'], 'amongst': ['among'], 'endeavouring': ['trying'], 'utilizing': ['using'], 'facilitating': ['helping'], 'implementing': ['carrying out'],
};
const keys = Object.keys(JARGON).sort((a, b) => b.length - a.length);
const JARGON_RX = new RegExp('(?<![A-Za-z])(' + keys.map(k => k.replace(/ /g, '\\s+')).join('|') + ')(?![A-Za-z])', 'gi');
const IRREG = 'been|done|made|given|taken|seen|written|known|shown|found|built|held|kept|left|lost|paid|sent|sold|set|told|thought|brought|bought|caught|taught|won|run|begun|broken|chosen|driven|eaten|fallen|forgotten|gotten|hidden|ridden|risen|spoken|stolen|thrown|worn|put|cut|hit|read|shut|struck|torn|drawn|grown|flown|sung|swum|understood|heard|met|led|fed|said|got|had|sold';
const PASSIVE_RX = new RegExp('\\b(?:am|is|are|was|were|be|been|being)\\s+(?:(?:not|also|already|often|always|never|being|just|still|very|really|quickly|recently)\\s+)*(?:[a-z]{3,}ed|' + IRREG + ')\\b(?:\\s+by\\b)?', 'gi');
const NOT_PASSIVE = /\b(?:is|are|was|were|be|been|am)\s+(?:tired|bored|excited|interested|worried|scared|married|finished|ready|prepared|supposed|used|concerned|pleased|surprised|located|based|named|called|done|gone|led)\b/i;

function matchCase(orig, rep) {
  if (orig === orig.toUpperCase() && orig.length > 1) return rep.toUpperCase();
  if (orig[0] === orig[0].toUpperCase() && orig[0] !== orig[0].toLowerCase()) return rep[0].toUpperCase() + rep.slice(1);
  return rep;
}

export function analyze(text, limit) {
  const sentences = []; const sre = /[^.!?\n]+(?:[.!?]+["')\]]*|\n|$)/g; let m;
  while ((m = sre.exec(text))) { if (m[0].trim()) sentences.push({ start: m.index, end: m.index + m[0].length, long: false }); }
  const issues = [];
  JARGON_RX.lastIndex = 0;
  while ((m = JARGON_RX.exec(text))) {
    const key = m[1].toLowerCase().replace(/\s+/g, ' ');
    issues.push({ type: 'jargon', start: m.index + m[0].indexOf(m[1]), end: m.index + m[0].indexOf(m[1]) + m[1].length, text: m[1], alts: JARGON[key] || [] });
  }
  PASSIVE_RX.lastIndex = 0;
  while ((m = PASSIVE_RX.exec(text))) {
    if (NOT_PASSIVE.test(m[0])) continue;
    issues.push({ type: 'passive', start: m.index, end: m.index + m[0].length, text: m[0], alts: [] });
  }
  for (const sn of sentences) {
    const t = text.slice(sn.start, sn.end);
    const n = (t.match(/\S+/g) || []).length;
    if (n > limit) { sn.long = true; issues.push({ type: 'long', start: sn.start, end: sn.end, text: t.trim(), alts: [], words: n }); }
  }
  issues.sort((a, b) => a.start - b.start);
  return { sentences, issues };
}

export default function (root) {
  const s = store('plain-language');
  const ta = el('textarea', { class: 'textarea prose', rows: 8, value: s.get('text', 'We will utilize the aforementioned methodology in order to facilitate the implementation of the new policy. The report was written by the team prior to the meeting.'), placeholder: 'Paste your text here…' });
  const limitIn = el('input', { class: 'input', type: 'number', min: '10', max: '60', value: s.get('limit', 25), style: { width: '80px' } });
  const view = el('div', { class: 'panel', style: { whiteSpace: 'pre-wrap', lineHeight: '1.9', minHeight: '80px' } });
  const stats = el('div', { class: 'row' });
  const issueList = el('div', { class: 'col' });
  let current = { sentences: [], issues: [] };

  function apply(issue, rep) {
    const t = ta.value;
    ta.value = t.slice(0, issue.start) + matchCase(issue.text, rep) + t.slice(issue.end);
    update();
  }
  function applyAll() {
    const js = current.issues.filter(i => i.type === 'jargon' && i.alts.length).sort((a, b) => b.start - a.start);
    let t = ta.value;
    for (const i of js) t = t.slice(0, i.start) + matchCase(i.text, i.alts[0]) + t.slice(i.end);
    ta.value = t; update();
  }
  const hl = {
    jargon: { background: 'color-mix(in srgb, var(--warn) 35%, transparent)', cursor: 'pointer', borderRadius: '3px', borderBottom: '2px solid var(--warn)' },
    passive: { background: 'color-mix(in srgb, var(--accent) 28%, transparent)', borderRadius: '3px' },
  };
  function update() {
    s.set('text', ta.value); s.set('limit', +limitIn.value);
    const text = ta.value;
    const limit = Math.max(8, +limitIn.value || 25);
    current = analyze(text, limit);
    const { sentences, issues } = current;
    const j = issues.filter(i => i.type === 'jargon'), p = issues.filter(i => i.type === 'passive'), l = issues.filter(i => i.type === 'long');
    render(stats, stat(j.length, 'jargon / complex words'), stat(p.length, 'passive phrases'), stat(l.length, 'long sentences'));
    if (!text.trim()) { render(view, el('span', { class: 'muted' }, 'Flagged text appears here. Click a highlighted word to swap it.')); render(issueList); return; }
    // Build highlighted view
    const inline = issues.filter(i => i.type !== 'long');
    const nodes = []; let pos = 0;
    const longs = sentences.filter(x => x.long);
    const pushPlain = (a, b) => {
      // wrap pieces inside long sentences with a background
      let cur = a;
      for (const sn of longs) {
        if (sn.end <= cur || sn.start >= b) continue;
        if (sn.start > cur) nodes.push(text.slice(cur, sn.start));
        const st = Math.max(cur, sn.start), en = Math.min(b, sn.end);
        nodes.push(el('span', { style: { background: 'color-mix(in srgb, var(--danger) 16%, transparent)' }, title: 'Long sentence' }, text.slice(st, en)));
        cur = en;
      }
      if (cur < b) nodes.push(text.slice(cur, b));
    };
    for (const i of inline) {
      if (i.start < pos) continue;
      pushPlain(pos, i.start);
      const label = i.type === 'jargon' ? (i.alts.length ? `Click to replace with "${i.alts[0]}"` : 'Complex wording') : 'Passive voice: consider naming who does the action';
      const node = el('span', { style: hl[i.type], title: label }, text.slice(i.start, i.end));
      if (i.type === 'jargon' && i.alts.length) node.addEventListener('click', () => apply(i, i.alts[0]));
      nodes.push(node); pos = i.end;
    }
    pushPlain(pos, text.length);
    render(view, nodes);
    render(issueList, issues.length ? issues.map(i => {
      if (i.type === 'jargon') return el('div', { class: 'row', style: { margin: 0 } }, el('span', { class: 'badge warn' }, 'word'), el('strong', {}, i.text), el('span', { class: 'muted' }, '→'),
        i.alts.map(a => el('button', { class: 'btn small', onclick: () => apply(i, a) }, a)));
      if (i.type === 'passive') return el('div', { class: 'row', style: { margin: 0 } }, el('span', { class: 'badge' }, 'passive'), el('strong', {}, i.text.trim()), el('span', { class: 'muted small' }, 'Say who does the action: "The team wrote…"'));
      return el('div', { class: 'row', style: { margin: 0, flexWrap: 'nowrap', alignItems: 'flex-start' } }, el('span', { class: 'badge danger' }, `${i.words} words`), el('span', { class: 'small' }, i.text.length > 140 ? i.text.slice(0, 140) + '…' : i.text), el('span', { class: 'muted small' }, 'Split into shorter sentences.'));
    }) : el('div', { class: 'badge ok' }, 'Nothing flagged. Your text looks plain and clear.'));
  }
  ta.addEventListener('input', update);
  limitIn.addEventListener('input', update);
  render(root, ta,
    el('div', { class: 'row' }, el('label', { class: 'inline' }, 'Long sentence limit', limitIn, 'words'),
      el('button', { class: 'btn', onclick: applyAll }, 'Apply all word swaps'),
      el('button', { class: 'btn', onclick: () => copy(ta.value) }, 'Copy text'),
      el('button', { class: 'btn ghost', onclick: () => { ta.value = ''; update(); } }, 'Clear')),
    stats,
    el('div', { class: 'small muted' }, 'Legend: ', el('span', { style: hl.jargon }, ' complex word (click to swap) '), ' ', el('span', { style: hl.passive }, ' passive voice '), ' ', el('span', { style: { background: 'color-mix(in srgb, var(--danger) 16%, transparent)' } }, ' long sentence ')),
    view, issueList);
  update();
}
