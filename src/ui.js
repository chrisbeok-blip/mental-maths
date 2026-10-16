/** h('div', { class: 'x', onclick: fn, 'data-id': 1 }, 'text', childEl, [more]) */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }

export function fmtSeconds(s) {
  s = Math.round(s);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), r = s % 60;
  if (m < 60) return r ? `${m}m ${r}s` : `${m}m`;
  const hh = Math.floor(m / 60), mm = m % 60;
  return mm ? `${hh}h ${mm}m` : `${hh}h`;
}

export const fmtDate = (ts) => new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
export const pct = (x) => (x == null ? '–' : `${Math.round(x * 100)}%`);

/** Render a question prompt with operators picked out: "7 × 9" -> 7 <span class="op">×</span> 9 */
export function promptNodes(prompt) {
  const parts = prompt.split(/([×÷=?])/);
  return parts.map((p) => (/^[×÷=?]$/.test(p) ? h('span', { class: 'op' }, p) : p));
}

/** Small inline SVG icons (stroke = currentColor). Not illustrations: single-weight glyphs. */
const ICONS = {
  flame: '<path d="M12 22c4.4 0 7-2.9 7-6.6 0-3.2-2-5.3-3.6-7.1-.3 1.6-1.1 2.7-2.1 3.3.2-3.3-1.3-6.5-4.3-8.6.2 2.6-.9 4.2-2.3 5.8C5.3 10.4 5 12.5 5 15.4 5 19.1 7.6 22 12 22z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  bolt: '<path d="M13 2L5 14h6l-1 8 9-13h-6l0-7z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  backspace: '<path d="M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7 6-7z"/><path d="M12.5 9.5l5 5M17.5 9.5l-5 5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.5V14"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  calendar: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/>',
};
export function icon(name, cls = '') {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  el.setAttribute('viewBox', '0 0 24 24'); el.setAttribute('width', '20'); el.setAttribute('height', '20');
  el.setAttribute('fill', 'none'); el.setAttribute('stroke', 'currentColor'); el.setAttribute('stroke-width', '2');
  el.setAttribute('stroke-linecap', 'round'); el.setAttribute('stroke-linejoin', 'round'); el.setAttribute('aria-hidden', 'true');
  el.setAttribute('class', `icon ${cls}`.trim());
  el.innerHTML = ICONS[name];
  return el;
}

/** Status pill used on tiles and the progress list. level: locked | learning | mastered | fast */
export function statusPill(level, text) {
  const glyph = { locked: 'lock', learning: 'target', mastered: 'check', fast: 'bolt' }[level];
  const label = text ?? level.charAt(0).toUpperCase() + level.slice(1);
  return h('span', { class: `pill is-${level}` }, icon(glyph, 'pill-icon'), label);
}

/** SVG ring showing fraction (0..1). */
export function ring(fraction, size = 150, stroke = 10) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`); svg.setAttribute('class', 'ring'); svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-track" stroke-width="${stroke}"/>` +
    `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-fill" stroke-width="${stroke}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - Math.max(0, Math.min(1, fraction)))}" transform="rotate(-90 ${size / 2} ${size / 2})"/>`;
  return svg;
}
