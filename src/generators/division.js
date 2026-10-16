import { int, pick } from '../rng.js';
import { clean } from '../num.js';

const q = (factId, rungId, prompt, answer, methodLine) =>
  ({ factId, rungId, prompt, answer: String(answer), prefix: '', suffix: '', methodLine });

export function genD1(rng) {
  if (rng() < 0.6) {
    const n = int(rng, 11, 99);
    const tens = Math.floor(n / 10) * 10, units = n % 10;
    const half = n / 2;
    const line = n % 2 === 0
      ? `Half of ${tens} is ${tens / 2}, half of ${units} is ${units / 2}, add = ${half}`
      : `Half of ${n - 1} is ${(n - 1) / 2}, plus half of 1 = ${half}`;
    return q(`half:${n}`, 'D1', `${n} ÷ 2`, clean(half), line);
  }
  const n = 4 * int(rng, 3, 25);
  return q(`quarter:${n}`, 'D1', `${n} ÷ 4`, n / 4, `Halve twice: ${n} → ${n / 2} → ${n / 4}`);
}

export function genD2(rng) {
  const d = int(rng, 2, 12), a = int(rng, 2, 12);
  const n = a * d;
  return q(`div:${n}/${d}`, 'D2', `${n} ÷ ${d}`, a, `What × ${d} makes ${n}? ${d} × ${a} = ${n}, so ${a}`);
}

export function genD3(rng) {
  const d = pick(rng, [10, 100, 1000]);
  // keep answers to <= 3 decimal places
  const n = d === 1000 ? int(rng, 1, 9999) : int(rng, 1, 999);
  const places = String(d).length - 1;
  const ans = clean(n / d);
  return q(`div10:${n}/${d}`, 'D3', `${n} ÷ ${d}`, ans, `Shift ${n} down ${places} place${places > 1 ? 's' : ''} = ${ans}`);
}

export function genD4(rng) {
  const d = int(rng, 2, 9), quot = int(rng, 2, 12), rem = int(rng, 1, d - 1);
  const n = quot * d + rem;
  return q(`rem:${n}/${d}`, 'D4', `${n} ÷ ${d}`, `${quot} r ${rem}`,
    `${d} × ${quot} = ${quot * d} fits. ${n} − ${quot * d} = ${rem} left over → ${quot} r ${rem}`);
}
