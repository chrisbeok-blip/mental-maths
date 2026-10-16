import { int, pick } from '../rng.js';

/** One-line method for a × b, keyed on the table b. */
export function tableMethod(a, b) {
  const p = a * b;
  switch (b) {
    case 2: return `Double ${a} = ${p}`;
    case 10: return `Shift ${a} up one place = ${p}`;
    case 5: return `${a} × 10 = ${a * 10}, halve it = ${p}`;
    case 4: return `Double ${a} = ${a * 2}, double again = ${p}`;
    case 3: return `Double ${a} = ${a * 2}, add one more ${a} = ${p}`;
    case 6: return `${a} × 3 = ${a * 3}, double it = ${p}`;
    case 9: return `${a} × 10 = ${a * 10}, take away ${a} = ${p}`;
    case 8: return `${a} × 4 = ${a * 4}, double it = ${p}`;
    case 7: return `${a} × 5 = ${a * 5}, ${a} × 2 = ${a * 2}, add = ${p}`;
    case 11: return `${a} × 10 = ${a * 10}, add ${a} = ${p}`;
    case 12: return `${a} × 10 = ${a * 10}, ${a} × 2 = ${a * 2}, add = ${p}`;
    default: return `${a} × ${b} = ${p}`;
  }
}

function forward(rungId, rng, tables) {
  const b = pick(rng, tables);
  const a = int(rng, 2, 12);
  return {
    factId: `mul:${a}x${b}`, rungId, prompt: `${a} × ${b}`, answer: String(a * b),
    prefix: '', suffix: '', methodLine: tableMethod(a, b),
  };
}

function reverse(rungId, rng) {
  const b = int(rng, 2, 12);
  const a = int(rng, 2, 12);
  const prod = a * b;
  // anchor on a neighbouring fact so the method shows a single step
  const anchor = a > 2 ? a - 1 : a + 1;
  const step = anchor < a ? `one more ${b} is ${prod}` : `one less ${b} is ${prod}`;
  return {
    factId: `rev:${a}x${b}`, rungId, prompt: `? × ${b} = ${prod}`, answer: String(a),
    prefix: '', suffix: '', methodLine: `${anchor} × ${b} = ${anchor * b}, ${step}, so ${a}`,
  };
}

export const genM1 = (rng) => forward('M1', rng, [2, 5, 10]);
export const genM2 = (rng) => forward('M2', rng, [4, 3, 6]);
export const genM3 = (rng) => forward('M3', rng, [9, 8]);
export const genM4 = (rng) => forward('M4', rng, [7, 11, 12]);
export const genM5 = (rng) => (rng() < 0.35 ? reverse('M5', rng) : forward('M5', rng, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]));
