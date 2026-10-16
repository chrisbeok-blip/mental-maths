import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32, int, pick, shuffle } from '../src/rng.js';

test('mulberry32 is deterministic and in [0,1)', () => {
  const a = mulberry32(42), b = mulberry32(42);
  for (let i = 0; i < 100; i++) {
    const x = a();
    assert.equal(x, b());
    assert.ok(x >= 0 && x < 1);
  }
});

test('int(rng, lo, hi) is inclusive both ends', () => {
  const rng = mulberry32(1);
  const seen = new Set();
  for (let i = 0; i < 2000; i++) seen.add(int(rng, 3, 5));
  assert.deepEqual([...seen].sort(), [3, 4, 5]);
});

test('pick returns an element; shuffle keeps elements', () => {
  const rng = mulberry32(7);
  assert.ok([1, 2, 3].includes(pick(rng, [1, 2, 3])));
  const s = shuffle(rng, [1, 2, 3, 4, 5]);
  assert.deepEqual([...s].sort(), [1, 2, 3, 4, 5]);
});
