// Tailwind class to CSS: translate common utility classes (spacing, colours, flex, grid, text, borders, effects)
// into plain CSS, grouping responsive prefixes into media queries and state prefixes into pseudo-classes.
import { el, render, copy, download, store, field } from '../../lib/ui.js';

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const PALETTE_SRC = {
  slate: 'f8fafc f1f5f9 e2e8f0 cbd5e1 94a3b8 64748b 475569 334155 1e293b 0f172a 020617',
  gray: 'f9fafb f3f4f6 e5e7eb d1d5db 9ca3af 6b7280 4b5563 374151 1f2937 111827 030712',
  zinc: 'fafafa f4f4f5 e4e4e7 d4d4d8 a1a1aa 71717a 52525b 3f3f46 27272a 18181b 09090b',
  neutral: 'fafafa f5f5f5 e5e5e5 d4d4d4 a3a3a3 737373 525252 404040 262626 171717 0a0a0a',
  stone: 'fafaf9 f5f5f4 e7e5e4 d6d3d1 a8a29e 78716c 57534e 44403c 292524 1c1917 0c0a09',
  red: 'fef2f2 fee2e2 fecaca fca5a5 f87171 ef4444 dc2626 b91c1c 991b1b 7f1d1d 450a0a',
  orange: 'fff7ed ffedd5 fed7aa fdba74 fb923c f97316 ea580c c2410c 9a3412 7c2d12 431407',
  amber: 'fffbeb fef3c7 fde68a fcd34d fbbf24 f59e0b d97706 b45309 92400e 78350f 451a03',
  yellow: 'fefce8 fef9c3 fef08a fde047 facc15 eab308 ca8a04 a16207 854d0e 713f12 422006',
  lime: 'f7fee7 ecfccb d9f99d bef264 a3e635 84cc16 65a30d 4d7c0f 3f6212 365314 1a2e05',
  green: 'f0fdf4 dcfce7 bbf7d0 86efac 4ade80 22c55e 16a34a 15803d 166534 14532d 052e16',
  emerald: 'ecfdf5 d1fae5 a7f3d0 6ee7b7 34d399 10b981 059669 047857 065f46 064e3b 022c22',
  teal: 'f0fdfa ccfbf1 99f6e4 5eead4 2dd4bf 14b8a6 0d9488 0f766e 115e59 134e4a 042f2e',
  cyan: 'ecfeff cffafe a5f3fc 67e8f9 22d3ee 06b6d4 0891b2 0e7490 155e75 164e63 083344',
  sky: 'f0f9ff e0f2fe bae6fd 7dd3fc 38bdf8 0ea5e9 0284c7 0369a1 075985 0c4a6e 082f49',
  blue: 'eff6ff dbeafe bfdbfe 93c5fd 60a5fa 3b82f6 2563eb 1d4ed8 1e40af 1e3a8a 172554',
  indigo: 'eef2ff e0e7ff c7d2fe a5b4fc 818cf8 6366f1 4f46e5 4338ca 3730a3 312e81 1e1b4b',
  violet: 'f5f3ff ede9fe ddd6fe c4b5fd a78bfa 8b5cf6 7c3aed 6d28d9 5b21b6 4c1d95 2e1065',
  purple: 'faf5ff f3e8ff e9d5ff d8b4fe c084fc a855f7 9333ea 7e22ce 6b21a8 581c87 3b0764',
  fuchsia: 'fdf4ff fae8ff f5d0fe f0abfc e879f9 d946ef c026d3 a21caf 86198f 701a75 4a044e',
  pink: 'fdf2f8 fce7f3 fbcfe8 f9a8d4 f472b6 ec4899 db2777 be185d 9d174d 831843 500724',
  rose: 'fff1f2 ffe4e6 fecdd3 fda4af fb7185 f43f5e e11d48 be123c 9f1239 881337 4c0519',
};
const COLORS = { white: '#ffffff', black: '#000000', transparent: 'transparent', current: 'currentColor', inherit: 'inherit' };
for (const [name, list] of Object.entries(PALETTE_SRC)) list.split(' ').forEach((h, i) => { COLORS[`${name}-${SHADES[i]}`] = '#' + h; });

function color(token) {
  // token like "blue-500", "white", "blue-500/50", "[#123456]"
  let alpha = null; const m = token.match(/^(.*)\/(\d{1,3})$/); if (m) { token = m[1]; alpha = +m[2] / 100; }
  let c = token.startsWith('[') ? token.slice(1, -1).replace(/_/g, ' ') : COLORS[token];
  if (!c) return null;
  if (alpha != null && /^#[0-9a-f]{6}$/i.test(c)) { const n = parseInt(c.slice(1), 16); c = `rgb(${n >> 16} ${(n >> 8) & 255} ${n & 255} / ${alpha})`; }
  return c;
}
function space(v) {
  if (v == null) return null;
  if (v.startsWith('[')) return v.slice(1, -1);
  if (v === 'px') return '1px'; if (v === '0') return '0'; if (v === 'auto') return 'auto';
  if (v === 'full') return '100%'; if (v === 'screen') return '100vw';
  if (/^\d+\/\d+$/.test(v)) { const [a, b] = v.split('/'); return (a / b * 100).toFixed(4).replace(/\.?0+$/, '') + '%'; }
  if (/^\d+(\.\d+)?$/.test(v)) return v === '0' ? '0' : (+v * 0.25) + 'rem';
  return null;
}
function size(v, axis) {
  const named = { min: 'min-content', max: 'max-content', fit: 'fit-content', screen: axis === 'h' ? '100vh' : '100vw', svh: '100svh', dvh: '100dvh', lvh: '100lvh' };
  return named[v] || space(v);
}
const MAXW = { none: 'none', xs: '20rem', sm: '24rem', md: '28rem', lg: '32rem', xl: '36rem', '2xl': '42rem', '3xl': '48rem', '4xl': '56rem', '5xl': '64rem', '6xl': '72rem', '7xl': '80rem', full: '100%', prose: '65ch', 'screen-sm': '640px', 'screen-md': '768px', 'screen-lg': '1024px', 'screen-xl': '1280px', 'screen-2xl': '1536px', min: 'min-content', max: 'max-content', fit: 'fit-content' };
const TEXT = { xs: ['0.75rem', '1rem'], sm: ['0.875rem', '1.25rem'], base: ['1rem', '1.5rem'], lg: ['1.125rem', '1.75rem'], xl: ['1.25rem', '1.75rem'], '2xl': ['1.5rem', '2rem'], '3xl': ['1.875rem', '2.25rem'], '4xl': ['2.25rem', '2.5rem'], '5xl': ['3rem', '1'], '6xl': ['3.75rem', '1'], '7xl': ['4.5rem', '1'], '8xl': ['6rem', '1'], '9xl': ['8rem', '1'] };
const WEIGHT = { thin: 100, extralight: 200, light: 300, normal: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800, black: 900 };
const ROUND = { none: '0', sm: '0.125rem', DEFAULT: '0.25rem', md: '0.375rem', lg: '0.5rem', xl: '0.75rem', '2xl': '1rem', '3xl': '1.5rem', full: '9999px' };
const ROUND_SIDES = { t: ['top-left', 'top-right'], r: ['top-right', 'bottom-right'], b: ['bottom-right', 'bottom-left'], l: ['top-left', 'bottom-left'], tl: ['top-left'], tr: ['top-right'], br: ['bottom-right'], bl: ['bottom-left'] };
const SHADOW = { sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)', DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)', md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)', lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)', xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)', '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)', inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)', none: '0 0 #0000' };
const LEADING = { none: '1', tight: '1.25', snug: '1.375', normal: '1.5', relaxed: '1.625', loose: '2' };
const TRACKING = { tighter: '-0.05em', tight: '-0.025em', normal: '0em', wide: '0.025em', wider: '0.05em', widest: '0.1em' };
const BLUR = { none: '0', sm: '4px', DEFAULT: '8px', md: '12px', lg: '16px', xl: '24px', '2xl': '40px', '3xl': '64px' };
const SIDES = { '': [''], x: ['-left', '-right'], y: ['-top', '-bottom'], t: ['-top'], r: ['-right'], b: ['-bottom'], l: ['-left'], s: ['-inline-start'], e: ['-inline-end'] };
const STATIC = {
  block: 'display:block', 'inline-block': 'display:inline-block', inline: 'display:inline', flex: 'display:flex', 'inline-flex': 'display:inline-flex', grid: 'display:grid', 'inline-grid': 'display:inline-grid', hidden: 'display:none', 'flow-root': 'display:flow-root', contents: 'display:contents', table: 'display:table', 'table-cell': 'display:table-cell', 'table-row': 'display:table-row', 'list-item': 'display:list-item',
  static: 'position:static', fixed: 'position:fixed', absolute: 'position:absolute', relative: 'position:relative', sticky: 'position:sticky',
  'flex-row': 'flex-direction:row', 'flex-col': 'flex-direction:column', 'flex-row-reverse': 'flex-direction:row-reverse', 'flex-col-reverse': 'flex-direction:column-reverse',
  'flex-wrap': 'flex-wrap:wrap', 'flex-nowrap': 'flex-wrap:nowrap', 'flex-wrap-reverse': 'flex-wrap:wrap-reverse',
  'flex-1': 'flex:1 1 0%', 'flex-auto': 'flex:1 1 auto', 'flex-initial': 'flex:0 1 auto', 'flex-none': 'flex:none',
  grow: 'flex-grow:1', 'grow-0': 'flex-grow:0', shrink: 'flex-shrink:1', 'shrink-0': 'flex-shrink:0', 'flex-grow': 'flex-grow:1', 'flex-shrink': 'flex-shrink:1', 'flex-grow-0': 'flex-grow:0', 'flex-shrink-0': 'flex-shrink:0',
  'items-start': 'align-items:flex-start', 'items-end': 'align-items:flex-end', 'items-center': 'align-items:center', 'items-baseline': 'align-items:baseline', 'items-stretch': 'align-items:stretch',
  'justify-start': 'justify-content:flex-start', 'justify-end': 'justify-content:flex-end', 'justify-center': 'justify-content:center', 'justify-between': 'justify-content:space-between', 'justify-around': 'justify-content:space-around', 'justify-evenly': 'justify-content:space-evenly', 'justify-stretch': 'justify-content:stretch',
  'justify-items-start': 'justify-items:start', 'justify-items-end': 'justify-items:end', 'justify-items-center': 'justify-items:center', 'justify-items-stretch': 'justify-items:stretch',
  'content-start': 'align-content:flex-start', 'content-end': 'align-content:flex-end', 'content-center': 'align-content:center', 'content-between': 'align-content:space-between', 'content-around': 'align-content:space-around', 'content-evenly': 'align-content:space-evenly',
  'self-auto': 'align-self:auto', 'self-start': 'align-self:flex-start', 'self-end': 'align-self:flex-end', 'self-center': 'align-self:center', 'self-stretch': 'align-self:stretch', 'self-baseline': 'align-self:baseline',
  'place-items-center': 'place-items:center', 'place-items-start': 'place-items:start', 'place-items-end': 'place-items:end', 'place-items-stretch': 'place-items:stretch', 'place-content-center': 'place-content:center', 'place-content-between': 'place-content:space-between',
  'col-span-full': 'grid-column:1 / -1', 'row-span-full': 'grid-row:1 / -1', 'col-auto': 'grid-column:auto', 'grid-flow-row': 'grid-auto-flow:row', 'grid-flow-col': 'grid-auto-flow:column', 'grid-flow-dense': 'grid-auto-flow:dense', 'grid-cols-none': 'grid-template-columns:none', 'grid-rows-none': 'grid-template-rows:none', 'auto-cols-fr': 'grid-auto-columns:minmax(0, 1fr)', 'auto-rows-fr': 'grid-auto-rows:minmax(0, 1fr)', 'auto-cols-auto': 'grid-auto-columns:auto', 'auto-rows-auto': 'grid-auto-rows:auto',
  'text-left': 'text-align:left', 'text-center': 'text-align:center', 'text-right': 'text-align:right', 'text-justify': 'text-align:justify', 'text-start': 'text-align:start', 'text-end': 'text-align:end',
  'font-sans': 'font-family:ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"', 'font-serif': 'font-family:ui-serif, Georgia, Cambria, "Times New Roman", Times, serif', 'font-mono': 'font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  italic: 'font-style:italic', 'not-italic': 'font-style:normal', uppercase: 'text-transform:uppercase', lowercase: 'text-transform:lowercase', capitalize: 'text-transform:capitalize', 'normal-case': 'text-transform:none',
  underline: 'text-decoration-line:underline', overline: 'text-decoration-line:overline', 'line-through': 'text-decoration-line:line-through', 'no-underline': 'text-decoration-line:none',
  truncate: 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap', 'text-ellipsis': 'text-overflow:ellipsis', 'text-clip': 'text-overflow:clip', antialiased: '-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale', 'subpixel-antialiased': '-webkit-font-smoothing:auto;-moz-osx-font-smoothing:auto',
  'whitespace-normal': 'white-space:normal', 'whitespace-nowrap': 'white-space:nowrap', 'whitespace-pre': 'white-space:pre', 'whitespace-pre-line': 'white-space:pre-line', 'whitespace-pre-wrap': 'white-space:pre-wrap',
  'break-normal': 'overflow-wrap:normal;word-break:normal', 'break-words': 'overflow-wrap:break-word', 'break-all': 'word-break:break-all', 'text-wrap': 'text-wrap:wrap', 'text-nowrap': 'text-wrap:nowrap', 'text-balance': 'text-wrap:balance', 'text-pretty': 'text-wrap:pretty',
  'align-baseline': 'vertical-align:baseline', 'align-top': 'vertical-align:top', 'align-middle': 'vertical-align:middle', 'align-bottom': 'vertical-align:bottom', 'align-text-top': 'vertical-align:text-top', 'align-text-bottom': 'vertical-align:text-bottom',
  'list-none': 'list-style-type:none', 'list-disc': 'list-style-type:disc', 'list-decimal': 'list-style-type:decimal', 'list-inside': 'list-style-position:inside', 'list-outside': 'list-style-position:outside',
  border: 'border-width:1px', 'border-solid': 'border-style:solid', 'border-dashed': 'border-style:dashed', 'border-dotted': 'border-style:dotted', 'border-double': 'border-style:double', 'border-none': 'border-style:none', 'border-collapse': 'border-collapse:collapse', 'border-separate': 'border-collapse:separate',
  'outline-none': 'outline:2px solid transparent;outline-offset:2px', outline: 'outline-style:solid', 'outline-dashed': 'outline-style:dashed', 'outline-dotted': 'outline-style:dotted',
  'overflow-auto': 'overflow:auto', 'overflow-hidden': 'overflow:hidden', 'overflow-visible': 'overflow:visible', 'overflow-scroll': 'overflow:scroll', 'overflow-clip': 'overflow:clip', 'overflow-x-auto': 'overflow-x:auto', 'overflow-y-auto': 'overflow-y:auto', 'overflow-x-hidden': 'overflow-x:hidden', 'overflow-y-hidden': 'overflow-y:hidden', 'overflow-x-scroll': 'overflow-x:scroll', 'overflow-y-scroll': 'overflow-y:scroll',
  'object-contain': 'object-fit:contain', 'object-cover': 'object-fit:cover', 'object-fill': 'object-fit:fill', 'object-none': 'object-fit:none', 'object-scale-down': 'object-fit:scale-down', 'object-center': 'object-position:center', 'object-top': 'object-position:top', 'object-bottom': 'object-position:bottom', 'object-left': 'object-position:left', 'object-right': 'object-position:right',
  'aspect-auto': 'aspect-ratio:auto', 'aspect-square': 'aspect-ratio:1 / 1', 'aspect-video': 'aspect-ratio:16 / 9',
  'cursor-pointer': 'cursor:pointer', 'cursor-default': 'cursor:default', 'cursor-wait': 'cursor:wait', 'cursor-text': 'cursor:text', 'cursor-move': 'cursor:move', 'cursor-not-allowed': 'cursor:not-allowed', 'cursor-grab': 'cursor:grab', 'cursor-grabbing': 'cursor:grabbing', 'cursor-help': 'cursor:help', 'cursor-auto': 'cursor:auto', 'cursor-none': 'cursor:none', 'cursor-crosshair': 'cursor:crosshair', 'cursor-zoom-in': 'cursor:zoom-in',
  'select-none': 'user-select:none', 'select-text': 'user-select:text', 'select-all': 'user-select:all', 'select-auto': 'user-select:auto',
  'pointer-events-none': 'pointer-events:none', 'pointer-events-auto': 'pointer-events:auto', 'resize-none': 'resize:none', resize: 'resize:both', 'resize-x': 'resize:horizontal', 'resize-y': 'resize:vertical', 'appearance-none': 'appearance:none',
  visible: 'visibility:visible', invisible: 'visibility:hidden', collapse: 'visibility:collapse', 'sr-only': 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0, 0, 0, 0);white-space:nowrap;border-width:0', 'not-sr-only': 'position:static;width:auto;height:auto;padding:0;margin:0;overflow:visible;clip:auto;white-space:normal',
  'box-border': 'box-sizing:border-box', 'box-content': 'box-sizing:content-box', 'isolate': 'isolation:isolate', container: 'width:100%  /* plus max-width per breakpoint: 640/768/1024/1280/1536px */',
  'bg-cover': 'background-size:cover', 'bg-contain': 'background-size:contain', 'bg-auto': 'background-size:auto', 'bg-center': 'background-position:center', 'bg-top': 'background-position:top', 'bg-bottom': 'background-position:bottom', 'bg-left': 'background-position:left', 'bg-right': 'background-position:right', 'bg-no-repeat': 'background-repeat:no-repeat', 'bg-repeat': 'background-repeat:repeat', 'bg-repeat-x': 'background-repeat:repeat-x', 'bg-repeat-y': 'background-repeat:repeat-y', 'bg-fixed': 'background-attachment:fixed', 'bg-none': 'background-image:none',
  'bg-gradient-to-t': '--tw-dir:to top', 'bg-gradient-to-tr': '--tw-dir:to top right', 'bg-gradient-to-r': '--tw-dir:to right', 'bg-gradient-to-br': '--tw-dir:to bottom right', 'bg-gradient-to-b': '--tw-dir:to bottom', 'bg-gradient-to-bl': '--tw-dir:to bottom left', 'bg-gradient-to-l': '--tw-dir:to left', 'bg-gradient-to-tl': '--tw-dir:to top left',
  transition: 'transition-property:color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter;transition-timing-function:cubic-bezier(0.4, 0, 0.2, 1);transition-duration:150ms',
  'transition-all': 'transition-property:all;transition-timing-function:cubic-bezier(0.4, 0, 0.2, 1);transition-duration:150ms', 'transition-colors': 'transition-property:color, background-color, border-color, text-decoration-color, fill, stroke;transition-timing-function:cubic-bezier(0.4, 0, 0.2, 1);transition-duration:150ms', 'transition-opacity': 'transition-property:opacity;transition-timing-function:cubic-bezier(0.4, 0, 0.2, 1);transition-duration:150ms', 'transition-shadow': 'transition-property:box-shadow;transition-timing-function:cubic-bezier(0.4, 0, 0.2, 1);transition-duration:150ms', 'transition-transform': 'transition-property:transform;transition-timing-function:cubic-bezier(0.4, 0, 0.2, 1);transition-duration:150ms', 'transition-none': 'transition-property:none',
  'ease-linear': 'transition-timing-function:linear', 'ease-in': 'transition-timing-function:cubic-bezier(0.4, 0, 1, 1)', 'ease-out': 'transition-timing-function:cubic-bezier(0, 0, 0.2, 1)', 'ease-in-out': 'transition-timing-function:cubic-bezier(0.4, 0, 0.2, 1)',
  'animate-spin': 'animation:spin 1s linear infinite  /* @keyframes spin { to { transform: rotate(360deg) } } */', 'animate-pulse': 'animation:pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite  /* @keyframes pulse { 50% { opacity: .5 } } */', 'animate-bounce': 'animation:bounce 1s infinite', 'animate-ping': 'animation:ping 1s cubic-bezier(0, 0, 0.2, 1) infinite', 'animate-none': 'animation:none',
  'mix-blend-multiply': 'mix-blend-mode:multiply', 'mix-blend-screen': 'mix-blend-mode:screen', 'mix-blend-overlay': 'mix-blend-mode:overlay', 'mix-blend-normal': 'mix-blend-mode:normal',
  'shadow-none': 'box-shadow:0 0 #0000', 'divide-y': 'border-top-width:1px  /* on children: > * + * */', 'divide-x': 'border-left-width:1px  /* on children: > * + * */',
  'scroll-smooth': 'scroll-behavior:smooth', 'scroll-auto': 'scroll-behavior:auto', 'snap-x': 'scroll-snap-type:x var(--tw-scroll-snap-strictness, proximity)', 'snap-center': 'scroll-snap-align:center', 'snap-start': 'scroll-snap-align:start', 'touch-none': 'touch-action:none', 'will-change-transform': 'will-change:transform',
  'decoration-solid': 'text-decoration-style:solid', 'decoration-dashed': 'text-decoration-style:dashed', 'decoration-dotted': 'text-decoration-style:dotted', 'decoration-wavy': 'text-decoration-style:wavy', 'underline-offset-auto': 'text-underline-offset:auto',
  'table-auto': 'table-layout:auto', 'table-fixed': 'table-layout:fixed', 'float-left': 'float:left', 'float-right': 'float:right', 'float-none': 'float:none', 'clear-both': 'clear:both', 'clear-left': 'clear:left', 'clear-right': 'clear:right',
  'backface-hidden': 'backface-visibility:hidden', 'transform-gpu': 'transform:translate3d(0,0,0)', 'transform-none': 'transform:none',
};
const BREAKPOINTS = { sm: '640px', md: '768px', lg: '1024px', xl: '1280px', '2xl': '1536px' };
const PSEUDO = { hover: ':hover', focus: ':focus', active: ':active', visited: ':visited', disabled: ':disabled', enabled: ':enabled', checked: ':checked', first: ':first-child', last: ':last-child', odd: ':nth-child(odd)', even: ':nth-child(even)', 'focus-within': ':focus-within', 'focus-visible': ':focus-visible', empty: ':empty', required: ':required', invalid: ':invalid', placeholder: '::placeholder', before: '::before', after: '::after', 'first-letter': '::first-letter', 'first-line': '::first-line', selection: '::selection', marker: '::marker', 'read-only': ':read-only', target: ':target', open: '[open]' };

/** Convert one bare utility (no variants) to a list of "prop:value" strings, or null when unknown. */
function convert(cls) {
  if (STATIC[cls]) return STATIC[cls].split(';');
  let neg = false; if (cls.startsWith('-')) { neg = true; cls = cls.slice(1); }
  const N = v => neg && v && v !== '0' && v !== 'auto' ? (v.startsWith('-') ? v.slice(1) : '-' + v) : v;
  let m;
  // padding / margin
  if ((m = cls.match(/^([pm])([xytrblse]?)-(.+)$/))) {
    const v = space(m[3]); if (v == null) return null;
    const prop = m[1] === 'p' ? 'padding' : 'margin';
    if (m[2] === 'x' || m[2] === 'y') return SIDES[m[2]].map(s => `${prop}${s}:${N(v)}`);
    if (m[2] === 's' || m[2] === 'e') return [`${prop}-inline-${m[2] === 's' ? 'start' : 'end'}:${N(v)}`];
    return [`${prop}${SIDES[m[2]][0]}:${N(v)}`];
  }
  if ((m = cls.match(/^space-([xy])-(.+)$/))) { const v = space(m[2]); return v == null ? null : [`${m[1] === 'x' ? 'margin-left' : 'margin-top'}:${N(v)}  /* on children: > * + * */`]; }
  if ((m = cls.match(/^gap(-[xy])?-(.+)$/))) { const v = space(m[2]); return v == null ? null : [`${m[1] === '-x' ? 'column-gap' : m[1] === '-y' ? 'row-gap' : 'gap'}:${v}`]; }
  // sizing
  if ((m = cls.match(/^(min-|max-)?([wh])-(.+)$/))) {
    const dim = m[2] === 'w' ? 'width' : 'height';
    let v = m[1] === 'max-' && m[2] === 'w' ? (MAXW[m[3]] || size(m[3], m[2])) : size(m[3], m[2]);
    if (v == null) return null; return [`${m[1] || ''}${dim}:${v}`];
  }
  if ((m = cls.match(/^size-(.+)$/))) { const v = size(m[1], 'w'); return v == null ? null : [`width:${v}`, `height:${v}`]; }
  if ((m = cls.match(/^basis-(.+)$/))) { const v = space(m[1]); return v == null ? null : [`flex-basis:${v}`]; }
  // position offsets
  if ((m = cls.match(/^(inset|top|right|bottom|left|start|end)(-[xy])?-(.+)$/))) {
    const v = space(m[3]); if (v == null) return null;
    if (m[1] === 'inset') return m[2] === '-x' ? [`left:${N(v)}`, `right:${N(v)}`] : m[2] === '-y' ? [`top:${N(v)}`, `bottom:${N(v)}`] : [`inset:${N(v)}`];
    return [`${m[1] === 'start' ? 'inset-inline-start' : m[1] === 'end' ? 'inset-inline-end' : m[1]}:${N(v)}`];
  }
  if ((m = cls.match(/^z-(.+)$/))) return [`z-index:${N(m[1].replace(/^\[|\]$/g, ''))}`];
  if ((m = cls.match(/^order-(\d+|first|last|none)$/))) return [`order:${m[1] === 'first' ? '-9999' : m[1] === 'last' ? '9999' : m[1] === 'none' ? '0' : N(m[1])}`];
  // grid
  if ((m = cls.match(/^grid-(cols|rows)-(\d+|\[.+\])$/))) return [`grid-template-${m[1] === 'cols' ? 'columns' : 'rows'}:${m[2].startsWith('[') ? m[2].slice(1, -1).replace(/_/g, ' ') : `repeat(${m[2]}, minmax(0, 1fr))`}`];
  if ((m = cls.match(/^(col|row)-span-(\d+)$/))) return [`grid-${m[1] === 'col' ? 'column' : 'row'}:span ${m[2]} / span ${m[2]}`];
  if ((m = cls.match(/^(col|row)-(start|end)-(\d+|auto)$/))) return [`grid-${m[1] === 'col' ? 'column' : 'row'}-${m[2]}:${m[3]}`];
  // typography
  if ((m = cls.match(/^text-(xs|sm|base|lg|xl|\dxl)$/))) return [`font-size:${TEXT[m[1]][0]}`, `line-height:${TEXT[m[1]][1]}`];
  if ((m = cls.match(/^text-\[(.+)\]$/))) return /^#|^rgb|^hsl/.test(m[1]) ? [`color:${m[1]}`] : [`font-size:${m[1]}`];
  if ((m = cls.match(/^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/))) return [`font-weight:${WEIGHT[m[1]]}`];
  if ((m = cls.match(/^leading-(.+)$/))) { const v = LEADING[m[1]] || space(m[1]); return v == null ? null : [`line-height:${v}`]; }
  if ((m = cls.match(/^tracking-(.+)$/))) { const v = TRACKING[m[1]] || (m[1].startsWith('[') ? m[1].slice(1, -1) : null); return v == null ? null : [`letter-spacing:${N(v)}`]; }
  if ((m = cls.match(/^line-clamp-(\d+)$/))) return ['overflow:hidden', 'display:-webkit-box', '-webkit-box-orient:vertical', `-webkit-line-clamp:${m[1]}`];
  if ((m = cls.match(/^indent-(.+)$/))) { const v = space(m[1]); return v == null ? null : [`text-indent:${N(v)}`]; }
  if ((m = cls.match(/^(decoration|underline-offset)-(\d+|auto|from-font)$/))) return [`${m[1] === 'decoration' ? 'text-decoration-thickness' : 'text-underline-offset'}:${/^\d+$/.test(m[2]) ? m[2] + 'px' : m[2]}`];
  // colours
  if ((m = cls.match(/^(text|bg|border|fill|stroke|outline|decoration|accent|caret|ring|placeholder|divide|shadow|from|via|to)-(.+)$/))) {
    const c = color(m[2]);
    if (c) {
      const prop = { text: 'color', bg: 'background-color', border: 'border-color', fill: 'fill', stroke: 'stroke', outline: 'outline-color', decoration: 'text-decoration-color', accent: 'accent-color', caret: 'caret-color', ring: '--tw-ring-color', placeholder: 'color  /* on ::placeholder */', divide: 'border-color  /* on children: > * + * */', shadow: '--tw-shadow-color', from: '--tw-from', via: '--tw-via', to: '--tw-to' }[m[1]];
      return [`${prop}:${c}`];
    }
    if (m[1] === 'border' && (m[2] === 't' || m[2] === 'r' || m[2] === 'b' || m[2] === 'l')) return [`border${SIDES[m[2]][0]}-width:1px`];
  }
  if ((m = cls.match(/^border-([trblxy])?-?(\d+)$/)) && /^border-([trblxy]-)?\d+$/.test(cls)) return SIDES[m[1] || ''].map(s => `border${s}-width:${m[2]}px`);
  if ((m = cls.match(/^border-([xy])-(\d+)$/))) return SIDES[m[1]].map(s => `border${s}-width:${m[2]}px`);
  if ((m = cls.match(/^border-([trbl])$/))) return [`border${SIDES[m[1]][0]}-width:1px`];
  if ((m = cls.match(/^border-\[(.+)\]$/))) return [/^#|^rgb|^hsl/.test(m[1]) ? `border-color:${m[1]}` : `border-width:${m[1]}`];
  if ((m = cls.match(/^outline-(\d+)$/))) return [`outline-width:${m[1]}px`];
  if ((m = cls.match(/^outline-offset-(\d+)$/))) return [`outline-offset:${m[1]}px`];
  if ((m = cls.match(/^ring(-(\d+))?$/))) return [`box-shadow:0 0 0 ${m[2] ?? 3}px var(--tw-ring-color, rgb(59 130 246 / 0.5))`];
  // radius
  if ((m = cls.match(/^rounded(-(t|r|b|l|tl|tr|br|bl))?(-(none|sm|md|lg|xl|2xl|3xl|full|\[.+\]))?$/))) {
    const v = m[4] ? (m[4].startsWith('[') ? m[4].slice(1, -1) : ROUND[m[4]]) : ROUND.DEFAULT;
    if (!m[2]) return [`border-radius:${v}`];
    return ROUND_SIDES[m[2]].map(c => `border-${c}-radius:${v}`);
  }
  // shadow, opacity, filters
  if ((m = cls.match(/^shadow(-(sm|md|lg|xl|2xl|inner|none))?$/))) return [`box-shadow:${SHADOW[m[2] || 'DEFAULT']}`];
  if ((m = cls.match(/^opacity-(\d+)$/))) return [`opacity:${+m[1] / 100}`];
  if ((m = cls.match(/^(backdrop-)?blur(-(none|sm|md|lg|xl|2xl|3xl))?$/))) return [`${m[1] ? 'backdrop-filter' : 'filter'}:blur(${BLUR[m[3] || 'DEFAULT']})`];
  if ((m = cls.match(/^(grayscale|invert|sepia)(-0)?$/))) return [`filter:${m[1]}(${m[2] ? '0' : '100%'})`];
  if ((m = cls.match(/^(brightness|contrast|saturate)-(\d+)$/))) return [`filter:${m[1]}(${+m[2] / 100})`];
  if ((m = cls.match(/^(duration|delay)-(\d+)$/))) return [`transition-${m[1]}:${m[2]}ms`];
  // transforms
  if ((m = cls.match(/^scale(-[xy])?-(\d+)$/))) return [`transform:scale${m[1] ? m[1].slice(1).toUpperCase() : ''}(${+m[2] / 100})`];
  if ((m = cls.match(/^rotate-(\d+)$/))) return [`transform:rotate(${N(m[1] + 'deg')})`];
  if ((m = cls.match(/^translate-([xy])-(.+)$/))) { const v = space(m[2]); return v == null ? null : [`transform:translate${m[1].toUpperCase()}(${N(v)})`]; }
  if ((m = cls.match(/^skew-([xy])-(\d+)$/))) return [`transform:skew${m[1].toUpperCase()}(${N(m[2] + 'deg')})`];
  if ((m = cls.match(/^origin-(.+)$/))) return [`transform-origin:${m[1].replace(/-/g, ' ')}`];
  if ((m = cls.match(/^columns-(\d+)$/))) return [`columns:${m[1]}`];
  if ((m = cls.match(/^aspect-\[(.+)\]$/))) return [`aspect-ratio:${m[1].replace(/_/g, ' ')}`];
  if ((m = cls.match(/^(stroke|font|text)-\[(.+)\]$/))) return null;
  if ((m = cls.match(/^stroke-(\d+)$/))) return [`stroke-width:${m[1]}`];
  if ((m = cls.match(/^list-\[(.+)\]$/))) return [`list-style-type:${m[1]}`];
  if ((m = cls.match(/^content-\[(.+)\]$/))) return [`content:${m[1].replace(/_/g, ' ')}`];
  if ((m = cls.match(/^bg-\[(url\(.+\)|linear-gradient\(.+\))\]$/))) return [`background-image:${m[1].replace(/_/g, ' ')}`];
  if ((m = cls.match(/^font-\[(.+)\]$/))) return [`font-family:${m[1].replace(/_/g, ' ')}`];
  return null;
}

/** Parse a class list into { rules: [{selector, media, decls}], unknown: [] } */
function translate(classes, baseSel) {
  const groups = new Map(); const unknown = [];
  for (const raw of classes) {
    const parts = raw.split(':'); const cls = parts.pop(); const variants = parts;
    const decls = convert(cls);
    if (!decls) { unknown.push(raw); continue; }
    let media = [], sel = baseSel, extra = [];
    for (const v of variants) {
      if (BREAKPOINTS[v]) media.push(`@media (min-width: ${BREAKPOINTS[v]})`);
      else if (v.startsWith('max-') && BREAKPOINTS[v.slice(4)]) media.push(`@media (max-width: ${parseInt(BREAKPOINTS[v.slice(4)]) - 0.02}px)`);
      else if (v === 'dark') media.push('@media (prefers-color-scheme: dark)');
      else if (v === 'motion-reduce') media.push('@media (prefers-reduced-motion: reduce)');
      else if (v === 'motion-safe') media.push('@media (prefers-reduced-motion: no-preference)');
      else if (v === 'print') media.push('@media print');
      else if (v === 'group-hover') sel = '.group:hover ' + sel;
      else if (v === 'peer-focus') sel = '.peer:focus ~ ' + sel;
      else if (PSEUDO[v]) extra.push(PSEUDO[v]);
      else extra.push(`/* ${v}: */`);
    }
    sel += extra.filter(e => !e.startsWith('/*')).join('') + (extra.some(e => e.startsWith('/*')) ? '  ' + extra.filter(e => e.startsWith('/*')).join(' ') : '');
    const key = media.join(' and ') + '|' + sel;
    if (!groups.has(key)) groups.set(key, { media: media.join(' and '), sel, decls: [] });
    groups.get(key).decls.push(...decls);
  }
  // merge gradient parts
  for (const g of groups.values()) {
    const dir = g.decls.find(d => d.startsWith('--tw-dir:')), from = g.decls.find(d => d.startsWith('--tw-from:')), via = g.decls.find(d => d.startsWith('--tw-via:')), to = g.decls.find(d => d.startsWith('--tw-to:'));
    if (dir || from || to) {
      g.decls = g.decls.filter(d => !/^--tw-(dir|from|via|to):/.test(d));
      const stops = [from, via, to].filter(Boolean).map(d => d.split(':').slice(1).join(':'));
      g.decls.push(`background-image:linear-gradient(${dir ? dir.slice(9) : 'to right'}, ${stops.join(', ') || 'transparent, transparent'})`);
    }
    const transforms = g.decls.filter(d => d.startsWith('transform:') && !d.includes('none'));
    if (transforms.length > 1) { g.decls = g.decls.filter(d => !d.startsWith('transform:')); g.decls.push('transform:' + transforms.map(t => t.slice(10)).join(' ')); }
    const filters = g.decls.filter(d => d.startsWith('filter:'));
    if (filters.length > 1) { g.decls = g.decls.filter(d => !d.startsWith('filter:')); g.decls.push('filter:' + filters.map(t => t.slice(7)).join(' ')); }
  }
  return { rules: [...groups.values()], unknown };
}
function format(rules) {
  const out = []; const byMedia = new Map();
  for (const r of rules) { if (!byMedia.has(r.media)) byMedia.set(r.media, []); byMedia.get(r.media).push(r); }
  const block = (r, ind) => `${ind}${r.sel} {\n${r.decls.map(d => { const i = d.indexOf(':'); return `${ind}  ${d.slice(0, i)}: ${d.slice(i + 1)};`; }).join('\n')}\n${ind}}`;
  for (const [media, rs] of [...byMedia.entries()].sort((a, b) => (a[0] ? 1 : 0) - (b[0] ? 1 : 0))) {
    if (!media) out.push(rs.map(r => block(r, '')).join('\n\n'));
    else out.push(`${media} {\n${rs.map(r => block(r, '  ')).join('\n\n')}\n}`);
  }
  return out.join('\n\n');
}

export default function (root) {
  const s = store('tailwind-to-css');
  const input = el('textarea', { class: 'textarea', style: { minHeight: '110px' }, placeholder: 'flex items-center gap-4 p-6 md:p-8 bg-white rounded-xl shadow-lg hover:shadow-xl text-gray-800', value: s.get('classes', 'flex items-center justify-between gap-4 px-6 py-4 md:px-8 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 rounded-xl shadow-lg hover:shadow-xl transition') });
  const selector = el('input', { class: 'input mono', value: s.get('selector', '.card'), style: { width: '140px' } });
  const out = el('pre', { class: 'out', style: { minHeight: '120px' } });
  const unknownBox = el('div', { class: 'row' });
  const count = el('span', { class: 'muted small' });
  function run() {
    const classes = input.value.trim().split(/\s+/).filter(Boolean).map(c => c.replace(/^["']|["']$/g, ''));
    s.set('classes', input.value); s.set('selector', selector.value);
    const sel = selector.value.trim() || '.element';
    const { rules, unknown } = translate(classes, sel);
    out.textContent = rules.length ? format(rules) : '/* paste some Tailwind classes above */';
    count.textContent = classes.length ? `${classes.length - unknown.length} of ${classes.length} classes translated` : '';
    render(unknownBox, unknown.length ? [el('span', { class: 'small muted' }, 'Not in the built-in map:'), unknown.map(u => el('span', { class: 'badge warn' }, u))] : null);
  }
  input.addEventListener('input', run); selector.addEventListener('input', run);
  render(root,
    el('div', { class: 'row' }, field('Selector', selector), count),
    input,
    el('div', { class: 'row' },
      el('button', { class: 'btn primary', onclick: () => out.textContent && copy(out.textContent) }, 'Copy CSS'),
      el('button', { class: 'btn', onclick: () => out.textContent && download('styles.css', out.textContent, 'text/css') }, 'Download .css'),
      el('button', { class: 'btn ghost', onclick: () => { input.value = ''; run(); } }, 'Clear')),
    unknownBox, out,
    el('p', { class: 'muted small' }, 'Covers the common Tailwind v3 utilities: spacing, sizing, colours (full default palette, with /opacity), flex, grid, typography, borders, radius, shadows, filters, transforms and transitions. Responsive prefixes (sm: md: lg: xl: 2xl: max-*:) become media queries; hover:, focus: and friends become pseudo-classes; dark: becomes a prefers-color-scheme query.'));
  run();
}
