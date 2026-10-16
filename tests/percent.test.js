import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../src/rng.js';
import { genP1, genP2, genP3, genP4, genP5, genP6, genP7 } from '../src/generators/percent.js';

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, msg ?? `${a} != ${b}`);
const OF = /^([\d.]+)% of (\d+)$/;

test('P1: only 50/25/10/1 and correct', () => {
  const rng = mulberry32(31);
  const seen = new Set();
  for (let i = 0; i < 400; i++) {
    const q = genP1(rng);
    const m = q.prompt.match(OF); assert.ok(m, q.prompt);
    const [p, b] = [Number(m[1]), Number(m[2])];
    seen.add(p);
    near(Number(q.answer), b * p / 100, q.prompt);
    assert.equal(q.factId, `pct:${p}%of${b}`);
    assert.equal(q.prefix, '');
  }
  assert.deepEqual([...seen].sort((a, b) => a - b), [1, 10, 25, 50]);
});

test('P2: built percentages on multiples of 20', () => {
  const rng = mulberry32(32);
  for (let i = 0; i < 400; i++) {
    const q = genP2(rng);
    const m = q.prompt.match(OF); assert.ok(m, q.prompt);
    const [p, b] = [Number(m[1]), Number(m[2])];
    assert.ok([5, 15, 20, 30, 40, 60, 70, 80, 90, 75, 2.5, 17.5].includes(p), `p=${p}`);
    assert.equal(b % 20, 0); assert.ok(b >= 20 && b <= 400);
    near(Number(q.answer), b * p / 100, q.prompt);
    assert.ok(q.methodLine.includes('10%') || q.methodLine.includes('50%'));
  }
});

test('P3: fraction→% conversions and %-of via fractions', () => {
  const rng = mulberry32(33);
  let conv = 0;
  for (let i = 0; i < 400; i++) {
    const q = genP3(rng);
    let m;
    if ((m = q.prompt.match(/^(\d+)\/(\d+) as a %$/))) {
      conv++;
      near(Number(q.answer), Number(m[1]) / Number(m[2]) * 100);
      assert.equal(q.suffix, '%');
      assert.equal(q.factId, `f2p:${m[1]}/${m[2]}`);
    } else {
      m = q.prompt.match(OF); assert.ok(m, q.prompt);
      near(Number(q.answer), Number(m[2]) * Number(m[1]) / 100);
      assert.equal(q.suffix, '');
      assert.ok(q.methodLine.includes('/'), q.methodLine);
    }
  }
  assert.ok(conv > 120 && conv < 280);
});

test('P4: increase/decrease in pounds', () => {
  const rng = mulberry32(34);
  for (let i = 0; i < 400; i++) {
    const q = genP4(rng);
    const m = q.prompt.match(/^(Increase|Reduce) £(\d+) by (\d+)%$/); assert.ok(m, q.prompt);
    const [b, p] = [Number(m[2]), Number(m[3])];
    const expected = m[1] === 'Increase' ? b * (1 + p / 100) : b * (1 - p / 100);
    near(Number(q.answer), expected, q.prompt);
    assert.equal(q.prefix, '£');
    assert.equal(q.factId, m[1] === 'Increase' ? `pctinc:${b}+${p}` : `pctdec:${b}-${p}`);
  }
});

test('P5: multipliers as numbers and applied', () => {
  const rng = mulberry32(35);
  let k = 0, applied = 0;
  for (let i = 0; i < 400; i++) {
    const q = genP5(rng);
    let m;
    if ((m = q.prompt.match(/^Multiplier for a (\d+)% (increase|decrease)$/))) {
      k++;
      const p = Number(m[1]);
      near(Number(q.answer), m[2] === 'increase' ? 1 + p / 100 : 1 - p / 100);
      assert.equal(q.prefix, '');
    } else {
      m = q.prompt.match(/^£(\d+) × ([\d.]+)$/); assert.ok(m, q.prompt);
      applied++;
      near(Number(q.answer), Number(m[1]) * Number(m[2]), q.prompt);
      assert.equal(q.prefix, '£');
    }
  }
  assert.ok(k > 120 && applied > 120);
});

test('P6: reverse percentages recover the original', () => {
  const rng = mulberry32(36);
  for (let i = 0; i < 400; i++) {
    const q = genP6(rng);
    const m = q.prompt.match(/^£(\d+) after (?:a )?(\d+)% (off|rise)\. Original price\?$/); assert.ok(m, q.prompt);
    const [sale, p] = [Number(m[1]), Number(m[2])];
    const orig = Number(q.answer);
    near(orig * (m[3] === 'off' ? 1 - p / 100 : 1 + p / 100), sale, q.prompt);
    assert.equal(q.prefix, '£');
    assert.equal(q.factId, `revpct:${sale}@${m[3] === 'off' ? 100 - p : 100 + p}`);
  }
});

test('P7: x out of y as a %, answers are whole or .5', () => {
  const rng = mulberry32(37);
  for (let i = 0; i < 400; i++) {
    const q = genP7(rng);
    const m = q.prompt.match(/^(\d+) out of (\d+) as a %$/); assert.ok(m, q.prompt);
    const [n, d] = [Number(m[1]), Number(m[2])];
    assert.ok(n >= 1 && n < d);
    near(Number(q.answer), n / d * 100);
    assert.equal((Number(q.answer) * 2) % 1, 0, q.answer);
    assert.equal(q.suffix, '%');
    assert.equal(q.factId, `outof:${n}/${d}`);
  }
});
