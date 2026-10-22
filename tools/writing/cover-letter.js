import { el, render, store, copy, download } from '../../lib/ui.js';

const list = arr => arr.length <= 1 ? (arr[0] || '') : arr.length === 2 ? arr.join(' and ') : arr.slice(0, -1).join(', ') + ', and ' + arr[arr.length - 1];

const TEMPLATES = {
  formal: v => ({
    greet: v.manager ? `Dear ${v.manager},` : 'Dear Hiring Manager,',
    paras: [
      `I am writing to express my interest in the ${v.role} position at ${v.company}. With a strong background in ${v.skillsList}, I am confident that I can make a meaningful contribution to your team.`,
      v.achievement ? `A highlight of my work: ${cap(v.achievement)} This experience strengthened my ability to deliver results and to collaborate effectively with colleagues and stakeholders.` : `Throughout my career I have consistently delivered results and collaborated effectively with colleagues and stakeholders.`,
      `I am particularly drawn to ${v.company} and would welcome the opportunity to discuss how my skills align with the needs of the ${v.role} role. Thank you for your time and consideration.`,
    ],
    close: 'Sincerely,',
  }),
  friendly: v => ({
    greet: v.manager ? `Hi ${v.manager},` : 'Hello,',
    paras: [
      `I was excited to see the ${v.role} opening at ${v.company}, and I would love to be considered. I bring experience in ${v.skillsList}, and I enjoy turning those skills into work that helps people.`,
      v.achievement ? `One thing I am proud of: ${cap(v.achievement)} It taught me a lot about working well with others and getting things over the line.` : `I like working with others, learning quickly, and getting things over the line.`,
      `I would really enjoy chatting about how I could help ${v.company} as your next ${v.role}. Thanks so much for taking the time to read this!`,
    ],
    close: 'Warm regards,',
  }),
  enthusiastic: v => ({
    greet: v.manager ? `Dear ${v.manager},` : 'Dear Hiring Team,',
    paras: [
      `I am thrilled to apply for the ${v.role} role at ${v.company}! Your work genuinely inspires me, and my passion for ${v.skillsList} makes this opportunity feel like a perfect fit.`,
      v.achievement ? `Here is what I can bring: ${cap(v.achievement)} I love tackling challenges like this and I am eager to do the same for ${v.company}.` : `I love tackling new challenges and I am eager to bring that energy to ${v.company}.`,
      `I would be delighted to share more about how I can help your team succeed. Thank you for considering my application. I cannot wait to hear from you!`,
    ],
    close: 'With enthusiasm,',
  }),
  concise: v => ({
    greet: v.manager ? `Dear ${v.manager},` : 'Dear Hiring Manager,',
    paras: [
      `I am applying for the ${v.role} position at ${v.company}. My experience includes ${v.skillsList}.`,
      v.achievement ? `${cap(v.achievement)}` : '',
      `I would welcome the chance to talk further. Thank you for your time.`,
    ].filter(Boolean),
    close: 'Best regards,',
  }),
};
function lc(t) { t = t.trim(); return t ? t[0].toLowerCase() + t.slice(1).replace(/\s*$/, '') + (/[.!?]$/.test(t) ? '' : '.') : ''; }
function cap(t) { t = t.trim(); return t ? t[0].toUpperCase() + t.slice(1) + (/[.!?]$/.test(t) ? '' : '.') : ''; }

export default function (root) {
  const s = store('cover-letter');
  const d = Object.assign({ name: '', role: '', company: '', manager: '', skills: '', achievement: '', tone: 'formal' }, s.get('form', {}));
  const inputs = {};
  const mk = (key, label, ph, tag = 'input') => {
    const c = el(tag, { class: tag === 'input' ? 'input' : 'textarea', placeholder: ph, value: d[key], rows: tag === 'textarea' ? 3 : null, style: tag === 'textarea' ? { minHeight: '70px' } : {} });
    c.addEventListener('input', () => { d[key] = c.value; update(); });
    inputs[key] = c;
    return el('label', { class: 'field' }, label, c);
  };
  const toneSel = el('select', { class: 'select' }, Object.keys(TEMPLATES).map(k => el('option', { value: k, selected: k === d.tone }, k[0].toUpperCase() + k.slice(1))));
  toneSel.addEventListener('change', () => { d.tone = toneSel.value; update(); });
  const preview = el('div', { class: 'panel', style: { whiteSpace: 'pre-wrap', lineHeight: '1.65', fontFamily: 'Georgia, serif', fontSize: '15px', minHeight: '280px' } });
  let text = '';

  function update() {
    s.set('form', d);
    const skills = d.skills.split(/[,;\n]/).map(x => x.trim()).filter(Boolean);
    const v = {
      role: d.role.trim() || '[Role]', company: d.company.trim() || '[Company]', manager: d.manager.trim(),
      skillsList: skills.length ? list(skills) : '[your key skills]', achievement: d.achievement.trim(),
    };
    const t = TEMPLATES[d.tone](v);
    text = [t.greet, ...t.paras, `${t.close}\n${d.name.trim() || '[Your name]'}`].join('\n\n');
    preview.textContent = text;
  }

  render(root, el('div', { class: 'grid2' },
    el('div', { class: 'col' },
      mk('name', 'Your name', 'Jane Doe'),
      mk('role', 'Role you are applying for', 'Marketing Coordinator'),
      mk('company', 'Company', 'Acme Corp'),
      mk('manager', 'Hiring manager (optional)', 'Ms. Rivera'),
      mk('skills', 'Key skills (comma separated)', 'content strategy, SEO, project management'),
      mk('achievement', 'A key achievement', 'I grew organic traffic by 120% in six months.', 'textarea'),
      el('label', { class: 'field' }, 'Tone', toneSel)),
    el('div', { class: 'col' }, preview,
      el('div', { class: 'row' },
        el('button', { class: 'btn primary', onclick: () => copy(text) }, 'Copy'),
        el('button', { class: 'btn', onclick: () => download('cover-letter.txt', text) }, 'Download .txt')))));
  update();
}
