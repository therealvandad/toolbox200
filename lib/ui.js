// Shared helpers for every tool.
// import { el, render, store, download, toast, copy, readFile, loadImage, dropZone, fmtBytes, uid, pad, shuffle, rng, today, loop } from '../../lib/ui.js';

/** Create an element. el('div', {class:'row', onclick: fn, style:{color:'red'}}, child, 'text', [more]) */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'value' || k === 'checked' || k === 'selected' || k === 'disabled' || k === 'readOnly' || k === 'textContent') node[k] = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  append(node, children);
  return node;
}
function append(node, children) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(node, c);
    else node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}
/** Replace all children of node. */
export function render(node, ...children) { node.replaceChildren(); append(node, children); return node; }

/** Namespaced localStorage. const s = store('my-tool'); s.get('key', fallback); s.set('key', value); s.del('key') */
export function store(ns) {
  const p = `tb200:${ns}:`;
  return {
    get(k, fallback = null) { try { const v = localStorage.getItem(p + k); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } },
    set(k, v) { try { localStorage.setItem(p + k, JSON.stringify(v)); } catch {} },
    del(k) { try { localStorage.removeItem(p + k); } catch {} },
  };
}

/** Trigger a file download. content may be a string or Blob. */
export function download(filename, content, mime = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const a = el('a', { href: URL.createObjectURL(blob), download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function toast(msg, ms = 1800) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.hidden = false;
  clearTimeout(t._h); t._h = setTimeout(() => (t.hidden = true), ms);
}

export async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('Copied'); }
  catch { const ta = el('textarea', { value: text }); document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast('Copied'); }
}

/** Read a File as 'text' | 'dataURL' | 'arrayBuffer'. */
export function readFile(file, as = 'text') {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result); r.onerror = rej;
    if (as === 'text') r.readAsText(file); else if (as === 'dataURL') r.readAsDataURL(file); else r.readAsArrayBuffer(file);
  });
}

/** Load an <img> from a File/Blob or URL. */
export function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img); img.onerror = rej;
    img.src = src instanceof Blob ? URL.createObjectURL(src) : src;
  });
}

/** A drop zone that also opens a file picker on click. onFiles(File[]) */
export function dropZone(label, onFiles, accept = '', multiple = true) {
  const input = el('input', { type: 'file', accept, multiple, class: 'hidden', onchange: () => input.files.length && onFiles([...input.files]) });
  const zone = el('div', { class: 'drop', onclick: () => input.click() }, label, input);
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('over'));
  zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('over'); if (e.dataTransfer.files.length) onFiles([...e.dataTransfer.files]); });
  return zone;
}

export function fmtBytes(n) {
  if (n < 1024) return n + ' B';
  const u = ['KB', 'MB', 'GB', 'TB']; let i = -1;
  do { n /= 1024; i++; } while (n >= 1024 && i < u.length - 1);
  return n.toFixed(n < 10 ? 2 : 1) + ' ' + u[i];
}

export function uid() { return Math.random().toString(36).slice(2, 10); }
export function pad(n, w = 2) { return String(n).padStart(w, '0'); }

/** Shuffled copy of an array. */
export function shuffle(a) { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/** Seeded random (mulberry32). const r = rng(123); r() -> [0,1) */
export function rng(seed) { let t = seed >>> 0; return () => { t += 0x6D2B79F5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; }

/** Today as YYYY-MM-DD (local). */
export function today() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

/** requestAnimationFrame loop. fn(dtSeconds, time). Returns stop(). Call stop in your cleanup. */
export function loop(fn) {
  let on = true, last = performance.now();
  const step = t => { if (!on) return; fn(Math.min(0.1, (t - last) / 1000), t); last = t; requestAnimationFrame(step); };
  requestAnimationFrame(step);
  return () => { on = false; };
}

/** Small stat box. */
export function stat(value, label) { return el('div', { class: 'stat' }, el('div', { class: 'v' }, value), el('div', { class: 'l' }, label)); }

/** Labelled field: field('Width', el('input', {...})) */
export function field(label, control) { return el('label', { class: 'field' }, label, control); }
