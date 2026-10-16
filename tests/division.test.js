import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../src/rng.js';
import { genD1, genD2, genD3, genD4 } from '../src/generators/division.js';

const DIV = /^(\d+) ÷ (\d+)$/;
const parts = (q) => { const m = q.prompt.match(DIV); assert.ok(m, q.prompt); return [Number(m[1]), Number(m[2])]; };

test('D1: halves (incl. odd → .5) and quarters', () => {
  const rng = mulberry32(11);
  let odd = 0, quarters = 0;
  for (let i = 0; i < 400; i++) {
    const q = genD1(rng);
    const [n, d] = parts(q);
    assert.ok(d === 2 || d === 4);
    assert.ok(Math.abs(Number(q.answer) - n / d) < 1e-9);
    if (d === 2) { assert.ok(n >= 11 && n <= 99); if (n % 2) { odd++; assert.ok(q.answer.endsWith('.5')); } assert.equal(q.factId, `half:${n}`); }
    else { quarters++; assert.equal(n % 4, 0); assert.ok(n >= 12 && n <= 100); assert.equal(q.factId, `quarter:${n}`); }
  }
  assert.ok(odd > 50 && quarters > 80);
});

test('D2: exact division from tables 2-12', () => {
  const rng = mulberry32(12);
  for (let i = 0; i < 400; i++) {
    const q = genD2(rng);
    const [n, d] = parts(q);
    assert.ok(d >= 2 && d <= 12);
    assert.equal(n % d, 0);
    assert.ok(n / d >= 2 && n / d <= 12);
    assert.equal(Number(q.answer), n / d);
    assert.equal(q.factId, `div:${n}/${d}`);
  }
});

test('D3: ÷10/100/1000 with at most 3 decimal places', () => {
  const rng = mulberry32(13);
  let decimals = 0;
  for (let i = 0; i < 400; i++) {
    const q = genD3(rng);
    const [n, d] = parts(q);
    assert.ok([10, 100, 1000].includes(d));
    assert.ok(Math.abs(Number(q.answer) - n / d) < 1e-9, `${q.prompt} -> ${q.answer}`);
    assert.ok(!/e/i.test(q.answer));
    if (q.answer.includes('.')) { decimals++; assert.ok(q.answer.split('.')[1].length <= 3); }
    assert.equal(q.factId, `div10:${n}/${d}`);
  }
  assert.ok(decimals > 100);
});

test('D4: remainders are non-zero and canonical "q r r"', () => {
  const rng = mulberry32(14);
  for (let i = 0; i < 400; i++) {
    const q = genD4(rng);
    const [n, d] = parts(q);
    const m = q.answer.match(/^(\d+) r (\d+)$/);
    assert.ok(m, q.answer);
    const [quot, rem] = [Number(m[1]), Number(m[2])];
    assert.equal(quot * d + rem, n);
    assert.ok(rem >= 1 && rem < d);
    assert.ok(d >= 2 && d <= 9 && quot >= 2 && quot <= 12);
    assert.equal(q.factId, `rem:${n}/${d}`);
  }
});
