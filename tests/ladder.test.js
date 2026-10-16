import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRACKS, RUNGS, RUNG_ORDER } from '../src/ladder.js';

test('21 rungs across 4 tracks, ids unique', () => {
  assert.equal(TRACKS.length, 4);
  assert.equal(RUNG_ORDER.length, 21);
  assert.equal(new Set(RUNG_ORDER).size, 21);
  for (const id of RUNG_ORDER) assert.equal(RUNGS[id].id, id);
});

test('prerequisites reference real rungs and match the spec', () => {
  for (const r of Object.values(RUNGS)) for (const p of r.requires) assert.ok(RUNGS[p], `${r.id} requires unknown ${p}`);
  assert.deepEqual(RUNGS.M1.requires, []);
  assert.deepEqual(RUNGS.M5.requires, ['M4']);
  assert.deepEqual(RUNGS.D1.requires, ['M1']);
  assert.deepEqual(RUNGS.D2.requires, ['M5']);
  assert.deepEqual(RUNGS.D3.requires, ['D2', 'M6']);
  assert.deepEqual(RUNGS.F1.requires, ['D1', 'M3']);
  assert.deepEqual(RUNGS.P1.requires, ['M3', 'D1']);
  assert.deepEqual(RUNGS.P3.requires, ['P2', 'F2']);
  assert.deepEqual(RUNGS.P5.requires, ['P4', 'M7']);
  assert.deepEqual(RUNGS.P7.requires, ['P6', 'D2']);
  assert.equal(RUNGS.M8.bonus, true);
});

test('every rung has a method card with 2 examples and a format', () => {
  for (const r of Object.values(RUNGS)) {
    assert.ok(r.title && r.short, r.id);
    assert.ok(r.method.lines.length >= 2 && r.method.lines.length <= 6, r.id);
    assert.equal(r.method.examples.length, 2, r.id);
    assert.ok(typeof r.format.decimals === 'boolean' && typeof r.format.remainder === 'boolean', r.id);
  }
});
