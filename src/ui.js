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
