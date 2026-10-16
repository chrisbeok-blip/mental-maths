import { int, pick } from '../rng.js';

const q = (factId, rungId, prompt, answer, methodLine) =>
  ({ factId, rungId, prompt, answer: String(answer), prefix: '', suffix: '', methodLine });

export function genF1(rng) {
  const den = pick(rng, [2, 3, 4, 5, 6, 8, 10]);
  const unit = int(rng, 2, 12);
  const amt = den * unit;
  const line = den === 8
    ? `Halve three times: ${amt} → ${amt / 2} → ${amt / 4} → ${unit}`
    : den === 4 ? `Halve twice: ${amt} → ${amt / 2} → ${unit}` : `${amt} ÷ ${den} = ${unit}`;
  return q(`frac:1/${den}of${amt}`, 'F1', `1/${den} of ${amt}`, unit, line);
}

export function genF2(rng) {
  const den = pick(rng, [3, 4, 5, 6, 8, 10]);
  const num = int(rng, 2, den - 1);
  const unit = int(rng, 2, 12);
  const amt = den * unit;
  return q(`frac:${num}/${den}of${amt}`, 'F2', `${num}/${den} of ${amt}`, unit * num,
    `1/${den} of ${amt} = ${unit}, × ${num} = ${unit * num}`);
}
