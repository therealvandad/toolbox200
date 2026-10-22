// REFERENCE GROUP INDEX. Each real group's tools/<group>/index.js looks exactly like this.
export default [
  {
    num: 1,
    id: 'word-counter',
    category: 'tiny',
    title: 'Word counter',
    desc: 'Words, characters, sentences and reading time.',
    keywords: 'text count length',
    load: () => import('./word-counter.js'),
  },
];
