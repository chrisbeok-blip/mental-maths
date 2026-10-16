import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../src/rng.js';
import { genM6, genM7, genM8 } from '../src/generators/multiples.js';

const MUL = /^(\d+) × (\d+)$/;
const product = (q) => { const m = q.prompt.match(MUL); assert.ok(m, q.prompt); return [Number(m[1]), Number(m[2])]; };

test('M6: shifts and multiples of ten', () => {
  const rng = mulberry32(5);
  let shifts = 0, tens = 0;
  for (let i = 0; i < 400; i++) {
    const q = genM6(rng);
    const [a, b] = product(q);
    assert.equal(Number(q.answer), a * b);
    if ([10, 100, 1000].includes(b)) { shifts++; assert.ok(a >= 3 && a <= 99); assert.equal(q.factId, `tens:${a}x${b}`); }
    else { tens++; assert.ok(a >= 2 && a <= 9); assert.ok(b % 10 === 0 && b >= 20 && b <= 900); assert.equal(q.factId, `tens:${a}x${b}`); }
  }
  assert.ok(shifts > 100 && tens > 100);
});

test('M7: two-digit by one-digit, split method line', () => {
  const rng = mulberry32(6);
  for (let i = 0; i < 400; i++) {
    const q = genM7(rng);
    const [a, b] = product(q);
    assert.ok(a >= 12 && a <= 39 && a % 10 !== 0, `a=${a}`);
    assert.ok(b >= 3 && b <= 9);
    assert.equal(Number(q.answer), a * b);
    assert.equal(q.factId, `split:${a}x${b}`);
    const tens = Math.floor(a / 10) * 10, units = a % 10;
    assert.equal(q.methodLine, `${tens} × ${b} = ${tens * b}, ${units} × ${b} = ${units * b}, add = ${a * b}`);
  }
});

test('M8: x11, x25 and near-square pairs are all correct', () => {
  const rng = mulberry32(8);
  const kinds = new Set();
  for (let i = 0; i < 600; i++) {
    const q = genM8(rng);
    const [a, b] = product(q);
    assert.equal(Number(q.answer), a * b);
    kinds.add(q.factId.split(':')[0]);
    if (q.factId.startsWith('trick11:')) { assert.equal(b, 11); assert.ok(a >= 12 && a <= 81 && (Math.floor(a / 10) + a % 10) <= 9); }
    if (q.factId.startsWith('trick25:')) { assert.equal(b, 25); assert.ok(a % 2 === 0 && a >= 4 && a <= 40); }
    if (q.factId.startsWith('sq:')) { assert.equal((a + b) % 2, 0); }
  }
  assert.deepEqual([...kinds].sort(), ['sq', 'trick11', 'trick25']);
});
