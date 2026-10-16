import { int, pick } from '../rng.js';

const q = (factId, rungId, prompt, answer, methodLine) =>
  ({ factId, rungId, prompt, answer: String(answer), prefix: '', suffix: '', methodLine });

export function genM6(rng) {
  if (rng() < 0.5) {
    const a = int(rng, 3, 99);
    const b = pick(rng, [10, 100, 1000]);
    const places = String(b).length - 1;
    return q(`tens:${a}x${b}`, 'M6', `${a} × ${b}`, a * b, `Shift ${a} up ${places} place${places > 1 ? 's' : ''} = ${a * b}`);
  }
  const a = int(rng, 2, 9);
  const k = int(rng, 2, 9);
  const b = k * pick(rng, [10, 10, 100]);
  return q(`tens:${a}x${b}`, 'M6', `${a} × ${b}`, a * b, `${a} × ${k} = ${a * k}, then × ${b / k} = ${a * b}`);
}

export function genM7(rng) {
  let a = int(rng, 12, 39);
  if (a % 10 === 0) a += 1;
  const b = int(rng, 3, 9);
  const tens = Math.floor(a / 10) * 10, units = a % 10;
  return q(`split:${a}x${b}`, 'M7', `${a} × ${b}`, a * b,
    `${tens} × ${b} = ${tens * b}, ${units} × ${b} = ${units * b}, add = ${a * b}`);
}

export function genM8(rng) {
  const kind = pick(rng, ['11', '25', 'sq']);
  if (kind === '11') {
    let a;
    do { a = int(rng, 12, 81); } while (Math.floor(a / 10) + (a % 10) > 9);
    const t = Math.floor(a / 10), u = a % 10;
    return q(`trick11:${a}`, 'M8', `${a} × 11`, a * 11, `Digits ${t} and ${u}: put ${t} + ${u} = ${t + u} in the middle → ${a * 11}`);
  }
  if (kind === '25') {
    const a = 2 * int(rng, 2, 20);
    const quarter = a / 4;
    return q(`trick25:${a}`, 'M8', `${a} × 25`, a * 25, `${a} ÷ 4 = ${quarter}, × 100 = ${a * 25}`);
  }
  const n = pick(rng, [10, 15, 20, 25, 30, 40, 50]);
  const d = int(rng, 1, 3);
  const a = n - d, b = n + d;
  return q(`sq:${a}x${b}`, 'M8', `${a} × ${b}`, a * b, `${n}² − ${d}² = ${n * n} − ${d * d} = ${a * b}`);
}
