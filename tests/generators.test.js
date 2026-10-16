import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../src/rng.js';
import { RUNGS, RUNG_ORDER } from '../src/ladder.js';
import { generate } from '../src/generators/index.js';
import { checkAnswer } from '../src/answer.js';

test('every rung has a generator and obeys the question contract', () => {
  const rng = mulberry32(99);
  for (const id of RUNG_ORDER) {
    const byFact = new Map();
    for (let i = 0; i < 200; i++) {
      const q = generate(id, rng);
      assert.equal(q.rungId, id);
      for (const k of ['factId', 'prompt', 'answer', 'prefix', 'suffix', 'methodLine']) assert.equal(typeof q[k], 'string', `${id}.${k}`);
      assert.ok(q.factId.includes(':'), q.factId);
      assert.ok(checkAnswer(q.answer, q.answer), `${id}: answer not self-consistent ${q.answer}`);
      const prev = byFact.get(q.factId);
      if (prev) assert.deepEqual([prev.prompt, prev.answer], [q.prompt, q.answer], q.factId);
      byFact.set(q.factId, q);
      const f = RUNGS[id].format;
      if (/ r /.test(q.answer)) assert.ok(f.remainder, `${id} produced remainder`);
      else if (q.answer.includes('.')) assert.ok(f.decimals, `${id} produced decimal ${q.answer} (${q.prompt})`);
    }
    assert.ok(byFact.size >= 10, `${id} produced only ${byFact.size} distinct facts`);
  }
});

test('generate throws for an unknown rung', () => {
  assert.throws(() => generate('ZZ', mulberry32(1)));
});
