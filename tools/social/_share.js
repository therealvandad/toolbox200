// Shared helpers for the social group: share links (JSON -> base64url in ?s= before the hash, like rsvp/potluck) and small utils.
import { el } from '../../lib/ui.js';

export function enc(o) { const b = new TextEncoder().encode(JSON.stringify(o)); let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
export function dec(t) { const s = atob(String(t).trim().replace(/-/g, '+').replace(/_/g, '/')); const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return JSON.parse(new TextDecoder().decode(b)); }
export function shareUrl(tool, data) { return location.origin + location.pathname + '?s=' + enc({ t: tool, ...data }) + '#/tool/' + tool; }
export function sharedData(tool) { try { const q = new URLSearchParams(location.search).get('s'); if (!q) return null; const d = dec(q); return d.t === tool ? d : null; } catch { return null; } }
/** Button that drops the ?s= data and reopens the organizer page. */
export function leaveShared() {
  return el('button', { class: 'btn ghost small', onclick: () => { history.replaceState(null, '', location.pathname + location.hash); dispatchEvent(new HashChangeEvent('hashchange')); } }, 'I am the organizer: open my own page');
}
export const h3 = t => el('h3', { style: { margin: '16px 0 6px' } }, t);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const safeUrl = u => { u = String(u || '').trim(); if (/^https?:\/\//i.test(u)) return u; if (/^[\w-]+(\.[\w-]+)+(\/|$)/.test(u)) return 'https://' + u; return ''; };
export const toISO = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const parseISO = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const csvCell = v => { v = String(v ?? ''); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
