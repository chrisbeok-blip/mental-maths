import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../src/rng.js';
import { genM1, genM2, genM3, genM4, genM5, tableMethod } from '../src/generators/tables.js';

const FWD = /^(\d+) × (\d+)$/;
const REV = /^\? × (\d+) = (\d+)$/;

function checkForward(q, allowedTables) {
  const m = q.prompt.match(FWD);
  assert.ok(m, `bad prompt ${q.prompt}`);
  const [a, b] = [Number(m[1]), Number(m[2])];
  assert.ok(allowedTables.includes(b), `table ${b} not allowed in ${q.rungId}`);
  assert.ok(a >= 2 && a <= 12);
  assert.equal(Number(q.answer), a * b);
  assert.equal(q.factId, `mul:${a}x${b}`);
  assert.ok(q.methodLine.length > 0);
}

test('M1-M4 draw only their tables and compute correctly', () => {
  const rng = mulberry32(3);
  const cases = [[genM1, 'M1', [2, 5, 10]], [genM2, 'M2', [4, 3, 6]], [genM3, 'M3', [9, 8]], [genM4, 'M4', [7, 11, 12]]];
  for (const [gen, id, tables] of cases) {
    const seenTables = new Set();
    for (let i = 0; i < 300; i++) {
      const q = gen(rng);
      assert.equal(q.rungId, id);
      checkForward(q, tables);
      seenTables.add(Number(q.prompt.match(FWD)[2]));
    }
    assert.deepEqual([...seenTables].sort((x, y) => x - y), tables.slice().sort((x, y) => x - y));
  }
});

test('M5 mixes all tables and includes reverse questions', () => {
  const rng = mulberry32(9);
  let reverse = 0;
  for (let i = 0; i < 500; i++) {
    const q = genM5(rng);
    assert.equal(q.rungId, 'M5');
    const r = q.prompt.match(REV);
    if (r) {
      reverse++;
      const [b, prod] = [Number(r[1]), Number(r[2])];
      assert.equal(Number(q.answer) * b, prod);
      assert.equal(q.factId, `rev:${q.answer}x${b}`);
    } else {
      checkForward(q, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    }
  }
  assert.ok(reverse > 100 && reverse < 250, `reverse share ${reverse}/500`);
});

test('tableMethod gives a specific line per table', () => {
  assert.equal(tableMethod(7, 9), '7 × 10 = 70, take away 7 = 63');
  assert.equal(tableMethod(7, 4), 'Double 7 = 14, double again = 28');
  assert.equal(tableMethod(8, 7), '8 × 5 = 40, 8 × 2 = 16, add = 56');
});
