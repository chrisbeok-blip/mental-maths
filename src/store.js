import { emptyState } from './scheduler.js';

export const STORAGE_KEY = 'mental-maths-v1';
const CODE_PREFIX = 'MM1.';

/** Load from a Storage-like object (defaults to window.localStorage). Always returns a complete state. */
export function load(storage = globalThis.localStorage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    const base = emptyState();
    return { ...base, ...parsed, streak: { ...base.streak, ...(parsed.streak ?? {}) }, flags: { ...base.flags, ...(parsed.flags ?? {}) } };
  } catch {
    return emptyState();
  }
}

export function save(storage = globalThis.localStorage, state) {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* quota or private mode: ignore */ }
}

// ---- export / import: JSON -> deflate-raw -> base64url, prefixed "MM1." ----
async function pipe(bytes, stream) {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

export async function exportCode(state) {
  const bytes = new TextEncoder().encode(JSON.stringify(state));
  const deflated = await pipe(bytes, new CompressionStream('deflate-raw'));
  return CODE_PREFIX + b64url(deflated);
}

/** Returns the decoded state, or null if the code is invalid. */
export async function importCode(code) {
  try {
    const s = String(code).trim();
    if (!s.startsWith(CODE_PREFIX)) return null;
    const inflated = await pipe(unb64url(s.slice(CODE_PREFIX.length)), new DecompressionStream('deflate-raw'));
    const parsed = JSON.parse(new TextDecoder().decode(inflated));
    if (!parsed || typeof parsed !== 'object' || !parsed.rungs) return null;
    return { ...emptyState(), ...parsed };
  } catch {
    return null;
  }
}
