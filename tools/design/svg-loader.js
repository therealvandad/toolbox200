// Animated SVG loader builder: spinner, dots, bars and more as self-contained SMIL-animated SVG; preview, copy, download.
import { el, render, copy, download, store, field } from '../../lib/ui.js';

const STYLES = {
  ring: {
    label: 'Ring spinner',
    svg: ({ size, color, speed, stroke, track }) => {
      const r = (size - stroke) / 2, c = 2 * Math.PI * r;
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Loading">
  <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-opacity="${track}" stroke-width="${stroke}"/>
  <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${(c * 0.28).toFixed(2)} ${(c * 0.72).toFixed(2)}">
    <animateTransform attributeName="transform" type="rotate" from="0 ${size / 2} ${size / 2}" to="360 ${size / 2} ${size / 2}" dur="${speed}s" repeatCount="indefinite"/>
  </circle>
</svg>`;
    },
  },
  dash: {
    label: 'Growing dash',
    svg: ({ size, color, speed, stroke }) => {
      const r = (size - stroke) / 2, c = 2 * Math.PI * r;
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Loading">
  <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${c.toFixed(2)}">
    <animate attributeName="stroke-dashoffset" values="${c.toFixed(2)};${(c * 0.1).toFixed(2)};${c.toFixed(2)}" dur="${(speed * 1.5).toFixed(2)}s" repeatCount="indefinite"/>
    <animateTransform attributeName="transform" type="rotate" from="0 ${size / 2} ${size / 2}" to="360 ${size / 2} ${size / 2}" dur="${speed}s" repeatCount="indefinite"/>
  </circle>
</svg>`;
    },
  },
  dots: {
    label: 'Three dots',
    svg: ({ size, color, speed }) => {
      const r = size / 10, cy = size / 2, xs = [size * 0.2, size * 0.5, size * 0.8];
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Loading">
${xs.map((x, i) => `  <circle cx="${x}" cy="${cy}" r="${r}" fill="${color}">
    <animate attributeName="r" values="${r};${r * 1.8};${r}" dur="${speed}s" begin="${(i * speed / 5).toFixed(2)}s" repeatCount="indefinite"/>
    <animate attributeName="fill-opacity" values="0.4;1;0.4" dur="${speed}s" begin="${(i * speed / 5).toFixed(2)}s" repeatCount="indefinite"/>
  </circle>`).join('\n')}
</svg>`;
    },
  },
  bounce: {
    label: 'Bouncing dots',
    svg: ({ size, color, speed }) => {
      const r = size / 10, xs = [size * 0.2, size * 0.5, size * 0.8], top = size * 0.35, bot = size * 0.65;
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Loading">
${xs.map((x, i) => `  <circle cx="${x}" cy="${bot}" r="${r}" fill="${color}">
    <animate attributeName="cy" values="${bot};${top};${bot}" dur="${speed}s" begin="${(i * speed / 6).toFixed(2)}s" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1" repeatCount="indefinite"/>
  </circle>`).join('\n')}
</svg>`;
    },
  },
  bars: {
    label: 'Equalizer bars',
    svg: ({ size, color, speed }) => {
      const n = 5, gap = size * 0.06, w = (size - gap * (n - 1)) / n * 0.7, step = (size - w) / (n - 1);
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Loading">
${Array.from({ length: n }, (_, i) => `  <rect x="${(i * step).toFixed(2)}" y="${size * 0.25}" width="${w.toFixed(2)}" height="${size * 0.5}" rx="${(w / 2).toFixed(2)}" fill="${color}">
    <animate attributeName="height" values="${size * 0.3};${size * 0.9};${size * 0.3}" dur="${speed}s" begin="${(i * speed / 8).toFixed(2)}s" repeatCount="indefinite"/>
    <animate attributeName="y" values="${size * 0.35};${size * 0.05};${size * 0.35}" dur="${speed}s" begin="${(i * speed / 8).toFixed(2)}s" repeatCount="indefinite"/>
  </rect>`).join('\n')}
</svg>`;
    },
  },
  pulse: {
    label: 'Pulse rings',
    svg: ({ size, color, speed, stroke }) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Loading">
${[0, 1].map(i => `  <circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.1}" fill="none" stroke="${color}" stroke-width="${stroke}">
    <animate attributeName="r" values="${size * 0.1};${size * 0.45}" dur="${speed}s" begin="${(i * speed / 2).toFixed(2)}s" repeatCount="indefinite"/>
    <animate attributeName="stroke-opacity" values="1;0" dur="${speed}s" begin="${(i * speed / 2).toFixed(2)}s" repeatCount="indefinite"/>
  </circle>`).join('\n')}
</svg>`,
  },
  orbit: {
    label: 'Orbiting dots',
    svg: ({ size, color, speed }) => {
      const R = size * 0.38, r = size * 0.07;
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Loading">
  <g>
${[0, 1, 2, 3, 4, 5, 6, 7].map(i => { const a = i * Math.PI / 4; return `    <circle cx="${(size / 2 + R * Math.cos(a)).toFixed(2)}" cy="${(size / 2 + R * Math.sin(a)).toFixed(2)}" r="${(r * (0.4 + i * 0.09)).toFixed(2)}" fill="${color}" fill-opacity="${(0.2 + i * 0.1).toFixed(2)}"/>`; }).join('\n')}
    <animateTransform attributeName="transform" type="rotate" from="0 ${size / 2} ${size / 2}" to="360 ${size / 2} ${size / 2}" dur="${speed}s" repeatCount="indefinite"/>
  </g>
</svg>`;
    },
  },
  dual: {
    label: 'Dual ring',
    svg: ({ size, color, speed, stroke }) => {
      const r1 = (size - stroke) / 2, r2 = r1 * 0.62, c1 = 2 * Math.PI * r1, c2 = 2 * Math.PI * r2;
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Loading">
  <circle cx="${size / 2}" cy="${size / 2}" r="${r1}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${(c1 * 0.25).toFixed(2)} ${(c1 * 0.25).toFixed(2)}">
    <animateTransform attributeName="transform" type="rotate" from="0 ${size / 2} ${size / 2}" to="360 ${size / 2} ${size / 2}" dur="${speed}s" repeatCount="indefinite"/>
  </circle>
  <circle cx="${size / 2}" cy="${size / 2}" r="${r2}" fill="none" stroke="${color}" stroke-opacity="0.6" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${(c2 * 0.25).toFixed(2)} ${(c2 * 0.25).toFixed(2)}">
    <animateTransform attributeName="transform" type="rotate" from="360 ${size / 2} ${size / 2}" to="0 ${size / 2} ${size / 2}" dur="${(speed * 1.4).toFixed(2)}s" repeatCount="indefinite"/>
  </circle>
</svg>`;
    },
  },
};

export default function (root) {
  const s = store('svg-loader');
  const style = el('select', { class: 'select' }, Object.entries(STYLES).map(([k, v]) => el('option', { value: k, selected: k === s.get('style', 'ring') }, v.label)));
  const color = el('input', { type: 'color', value: s.get('color', '#2f6fed') });
  const size = el('input', { type: 'range', min: 16, max: 200, value: s.get('size', 64), class: 'input' });
  const speed = el('input', { type: 'range', min: 2, max: 40, value: s.get('speed', 10), class: 'input' });
  const stroke = el('input', { type: 'range', min: 1, max: 20, value: s.get('stroke', 6), class: 'input' });
  const track = el('input', { type: 'range', min: 0, max: 60, value: s.get('track', 15), class: 'input' });
  const bgPick = el('select', { class: 'select' }, [['var(--bg)', 'Theme'], ['#ffffff', 'White'], ['#1b1f24', 'Dark']].map(([v, l]) => el('option', { value: v }, l)));
  const preview = el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '240px', border: '1px solid var(--line)', borderRadius: '10px' } });
  const code = el('pre', { class: 'out', style: { maxHeight: '300px' } });
  const info = el('span', { class: 'muted small' });
  const gallery = el('div', { class: 'row' });
  let svg = '';

  function opts() { return { size: +size.value, color: color.value, speed: speed.value / 10, stroke: Math.min(+stroke.value, size.value / 4), track: track.value / 100 }; }
  function update() {
    svg = STYLES[style.value].svg(opts());
    preview.innerHTML = svg; preview.style.background = bgPick.value;
    code.textContent = svg;
    info.textContent = `${new Blob([svg]).size} bytes · ${(speed.value / 10).toFixed(1)}s per cycle`;
    for (const [k, v] of Object.entries({ style: style.value, color: color.value, size: +size.value, speed: +speed.value, stroke: +stroke.value, track: +track.value })) s.set(k, v);
    render(gallery, Object.entries(STYLES).map(([k, v]) => {
      const b = el('button', { class: 'btn' + (k === style.value ? ' primary' : ''), title: v.label, style: { padding: '6px' }, onclick: () => { style.value = k; update(); } });
      b.innerHTML = v.svg({ ...opts(), size: 28, stroke: 3, color: k === style.value ? '#fff' : color.value }); return b;
    }));
  }
  for (const c of [color, size, speed, stroke, track]) c.addEventListener('input', update);
  for (const c of [style, bgPick]) c.addEventListener('change', update);
  render(root,
    gallery,
    el('div', { class: 'row' }, field('Style', style), field('Colour', color), field('Size px', size), field('Cycle time', speed), field('Stroke', stroke), field('Track opacity (ring)', track), field('Preview on', bgPick)),
    preview, info, code,
    el('div', { class: 'row' },
      el('button', { class: 'btn primary', onclick: () => copy(svg) }, 'Copy SVG code'),
      el('button', { class: 'btn', onclick: () => download(`loader-${style.value}.svg`, svg, 'image/svg+xml') }, 'Download .svg'),
      el('button', { class: 'btn', onclick: () => copy(`<img src="data:image/svg+xml,${encodeURIComponent(svg)}" width="${size.value}" height="${size.value}" alt="Loading">`) }, 'Copy as <img> data URI')),
    el('p', { class: 'muted small' }, 'Animations use SMIL, so the SVG animates when inlined in HTML, used as an <img> or as a CSS background, with no JavaScript or CSS required.'));
  update();
}
