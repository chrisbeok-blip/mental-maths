import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../src/rng.js';
import { genF1, genF2 } from '../src/generators/fractions.js';

const FR = /^(\d+)\/(\d+) of (\d+)$/;
const parts = (q) => { const m = q.prompt.match(FR); assert.ok(m, q.prompt); return m.slice(1).map(Number); };

test('F1: unit fractions, amount divisible by denominator', () => {
  const rng = mulberry32(21);
  for (let i = 0; i < 400; i++) {
    const q = genF1(rng);
    const [num, den, amt] = parts(q);
    assert.equal(num, 1);
    assert.ok([2, 3, 4, 5, 6, 8, 10].includes(den));
    assert.equal(amt % den, 0);
    assert.ok(amt / den >= 2 && amt / den <= 12);
    assert.equal(Number(q.answer), amt / den);
    assert.equal(q.factId, `frac:1/${den}of${amt}`);
  }
});

test('F2: non-unit fractions, whole answers, method shows the unit step', () => {
  const rng = mulberry32(22);
  for (let i = 0; i < 400; i++) {
    const q = genF2(rng);
    const [num, den, amt] = parts(q);
    assert.ok(num >= 2 && num < den);
    assert.ok([3, 4, 5, 6, 8, 10].includes(den));
    assert.equal(amt % den, 0);
    assert.equal(Number(q.answer), (amt / den) * num);
    assert.equal(q.factId, `frac:${num}/${den}of${amt}`);
    assert.ok(q.methodLine.startsWith(`1/${den} of ${amt} = ${amt / den}`));
  }
});
