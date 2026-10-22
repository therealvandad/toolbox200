// Every tool group exports an array of entries:
// { num, id, title, desc, keywords, category, load: () => import('./x.js') }
import tinyA from './tools/tiny-a/index.js';
import tinyB from './tools/tiny-b/index.js';
import writing from './tools/writing/index.js';
import design from './tools/design/index.js';
import media from './tools/media/index.js';
import learningA from './tools/learning-a/index.js';
import learningB from './tools/learning-b/index.js';
import health from './tools/health/index.js';
import home from './tools/home/index.js';
import social from './tools/social/index.js';
import devA from './tools/dev-a/index.js';
import devB from './tools/dev-b/index.js';
import gamesA from './tools/games-a/index.js';
import gamesB from './tools/games-b/index.js';
import fun from './tools/fun/index.js';

export const categories = [
  { slug: 'tiny', title: 'Tiny tools' },
  { slug: 'writing', title: 'Text & writing' },
  { slug: 'design', title: 'Images & design' },
  { slug: 'media', title: 'Audio & video' },
  { slug: 'learning', title: 'Learning' },
  { slug: 'health', title: 'Health & lifestyle' },
  { slug: 'home', title: 'Home & money' },
  { slug: 'social', title: 'Social & events' },
  { slug: 'dev', title: 'Developer tools' },
  { slug: 'games', title: 'Games' },
  { slug: 'fun', title: 'Weird & fun' },
];

export const registry = [
  ...tinyA, ...tinyB, ...writing, ...design, ...media, ...learningA, ...learningB,
  ...health, ...home, ...social, ...devA, ...devB, ...gamesA, ...gamesB, ...fun,
].sort((a, b) => a.num - b.num);
