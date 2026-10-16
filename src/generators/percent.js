import { int, pick } from '../rng.js';
import { clean } from '../num.js';

const q = (factId, rungId, prompt, answer, methodLine, prefix = '', suffix = '') =>
  ({ factId, rungId, prompt, answer: clean(answer), prefix, suffix, methodLine });

const pctOf = (b, p) => Number(clean(b * p / 100));

// ---- P1: 50 / 25 / 10 / 1 ----
export function genP1(rng) {
  const p = pick(rng, [50, 25, 10, 1]);
  let b, line;
  if (p === 50) { b = int(rng, 11, 199); line = `Half of ${b} = ${clean(b / 2)}`; }
  else if (p === 25) { b = 4 * int(rng, 3, 100); line = `Halve twice: ${b} → ${b / 2} → ${b / 4}`; }
  else if (p === 10) { b = 5 * int(rng, 2, 180); line = `${b} ÷ 10 = ${clean(b / 10)}`; }
  else { b = 50 * int(rng, 1, 18); line = `${b} ÷ 100 = ${clean(b / 100)}`; }
  return q(`pct:${p}%of${b}`, 'P1', `${p}% of ${b}`, pctOf(b, p), line);
}

// ---- P2: built from blocks, base multiple of 20 ----
export function genP2(rng) {
  const p = pick(rng, [5, 15, 20, 30, 40, 60, 70, 80, 90, 75, 2.5, 17.5]);
  const b = 20 * int(rng, 1, 20);
  const ten = b / 10, a = pctOf(b, p);
  let line;
  if (p === 5) line = `10% = ${ten}, halve → ${a}`;
  else if (p === 15) line = `10% = ${ten}, 5% = ${ten / 2}, add → ${a}`;
  else if (p === 17.5) line = `10% = ${ten}, 5% = ${ten / 2}, 2.5% = ${clean(ten / 4)}, add → ${a}`;
  else if (p === 2.5) line = `10% = ${ten}, halve → ${ten / 2}, halve → ${a}`;
  else if (p === 75) line = `50% = ${b / 2}, 25% = ${b / 4}, add → ${a}`;
  else line = `10% of ${b} = ${ten}, × ${p / 10} = ${a}`;
  return q(`pct:${p}%of${b}`, 'P2', `${p}% of ${b}`, a, line);
}

// ---- P3: fractions <-> percentages ----
const FRACS = [[1, 2, 50], [1, 4, 25], [3, 4, 75], [1, 5, 20], [2, 5, 40], [3, 5, 60], [4, 5, 80],
  [1, 10, 10], [3, 10, 30], [7, 10, 70], [9, 10, 90], [1, 8, 12.5], [3, 8, 37.5], [5, 8, 62.5], [7, 8, 87.5]];

export function genP3(rng) {
  const [n, d, p] = pick(rng, FRACS);
  if (rng() < 0.5) {
    const unitPct = clean(100 / d);
    const line = d === 8
      ? `1/8 is half of 25% = 12.5%${n > 1 ? `, × ${n} = ${p}%` : ''}`
      : n === 1 ? `1/${d} = ${unitPct}%` : `1/${d} = ${unitPct}%, × ${n} = ${p}%`;
    return q(`f2p:${n}/${d}`, 'P3', `${n}/${d} as a %`, p, line, '', '%');
  }
  const unit = int(rng, 2, 12);
  const amt = d * unit;
  return q(`pctf:${p}%of${amt}`, 'P3', `${p}% of ${amt}`, unit * n,
    `${p}% = ${n}/${d}. ${amt} ÷ ${d} = ${unit}${n > 1 ? `, × ${n} = ${unit * n}` : ''}`);
}

// ---- P4: increase / decrease in £ ----
const BASES = [20, 40, 50, 60, 80, 120, 150, 200, 240, 300, 400];
export function genP4(rng) {
  const b = pick(rng, BASES), p = pick(rng, [5, 10, 15, 20, 25, 30, 50]);
  const part = pctOf(b, p);
  if (rng() < 0.5) {
    return q(`pctinc:${b}+${p}`, 'P4', `Increase £${b} by ${p}%`, b + part, `${p}% of ${b} = ${part}. ${b} + ${part} = ${clean(b + part)}`, '£');
  }
  return q(`pctdec:${b}-${p}`, 'P4', `Reduce £${b} by ${p}%`, b - part, `${p}% of ${b} = ${part}. ${b} − ${part} = ${clean(b - part)}`, '£');
}

// ---- P5: multipliers ----
export function genP5(rng) {
  const p = pick(rng, [5, 10, 15, 20, 25, 30, 40, 50]);
  const up = rng() < 0.5;
  const k = up ? 1 + p / 100 : 1 - p / 100;
  if (rng() < 0.5) {
    const line = up ? `100% + ${p}% = ${100 + p}% → ${clean(k)}` : `100% − ${p}% = ${100 - p}% → ${clean(k)}`;
    return q(`multk:${up ? 'up' : 'down'}${p}`, 'P5', `Multiplier for a ${p}% ${up ? 'increase' : 'decrease'}`, k, line);
  }
  const b = 20 * int(rng, 1, 20);
  const part = pctOf(b, p);
  const line = up
    ? `${b} × 1 = ${b}, ${b} × ${clean(p / 100)} = ${part}, total ${clean(b + part)}`
    : `× ${clean(k)} means ${100 - p}% left: ${b} − ${part} = ${clean(b - part)}`;
  return q(`multapply:${b}x${clean(k)}`, 'P5', `£${b} × ${clean(k)}`, b * k, line, '£');
}

// ---- P6: reverse percentages ----
export function genP6(rng) {
  const p = pick(rng, [10, 20, 25, 30, 40, 50]);
  const orig = 20 * int(rng, 1, 20);
  const off = rng() < 0.65;
  const r = off ? 100 - p : 100 + p;
  const sale = Number(clean(orig * r / 100));
  const prompt = off ? `£${sale} after ${p}% off. Original price?` : `£${sale} after a ${p}% rise. Original price?`;
  return q(`revpct:${sale}@${r}`, 'P6', prompt, orig, `£${sale} is ${r}%. 1% = ${clean(sale / r)}. 100% = £${orig}`, '£');
}

// ---- P7: n out of d as a % ----
export function genP7(rng) {
  const d = pick(rng, [5, 10, 20, 25, 40, 50, 200]);
  const n = int(rng, 1, d - 1);
  const a = n / d * 100;
  const line = d === 200 ? `200 → 100 is ÷ 2. ${n} ÷ 2 = ${clean(a)}%` : `${d} → 100 is × ${clean(100 / d)}. ${n} × ${clean(100 / d)} = ${clean(a)}%`;
  return q(`outof:${n}/${d}`, 'P7', `${n} out of ${d} as a %`, a, line, '', '%');
}
