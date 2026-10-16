import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../src/rng.js';
import { generate } from '../src/generators/index.js';
import { RUNG_ORDER } from '../src/ladder.js';
import {
  emptyState, rungState, isUnlocked, isMastered, rollingAccuracy, evaluateMastery, recordAnswer,
  markVisited, pickTarget, composeSession, composeWeakSpots, composeWarmup, rungLevel, continueHint, needsRefresh,
  WINDOW, KEEP, SESSION_LEN, WARMUP_LEN,
} from '../src/scheduler.js';

const T0 = 1_760_000_000_000;
const q = (rungId, factId, answer = '1') => ({ factId, rungId, prompt: 'p', answer, prefix: '', suffix: '', methodLine: 'm' });

function drill(state, rungId, correct, wrong, ts = T0) {
  let s = state;
  for (let i = 0; i < correct; i++) s = recordAnswer(s, { question: q(rungId, `${rungId}:ok${i}`), correct: true, input: '1', mode: 'learn', ts: ts + i });
  for (let i = 0; i < wrong; i++) s = recordAnswer(s, { question: q(rungId, `${rungId}:bad${i}`), correct: false, input: '0', mode: 'learn', ts: ts + correct + i });
  return s;
}
function master(state, rungId) {
  let s = drill(state, rungId, WINDOW, 0);
  assert.ok(isMastered(s, rungId), `${rungId} should be mastered`);
  return s;
}

test('fresh state: only M1 unlocked', () => {
  const s = emptyState();
  assert.equal(isUnlocked(s, 'M1'), true);
  for (const id of ['M2', 'D1', 'F1', 'P1']) assert.equal(isUnlocked(s, id), false, id);
  assert.equal(rollingAccuracy(s, 'M1'), null);
});

test('recordAnswer in learn mode updates answers, total and missed pile', () => {
  let s = emptyState();
  const fact = q('M3', 'mul:7x9', '63');
  s = recordAnswer(s, { question: fact, correct: false, input: '54', mode: 'learn', ts: T0 });
  assert.equal(rungState(s, 'M3').total, 1);
  assert.deepEqual(rungState(s, 'M3').answers, [{ c: 0, ts: T0 }]);
  assert.equal(s.missed['mul:7x9'].streak, 0);
  assert.equal(s.missed['mul:7x9'].last_wrong_answer, '54');
  assert.equal(s.missed['mul:7x9'].rung, 'M3');
  assert.deepEqual(s.missed['mul:7x9'].q, fact);
  for (let i = 1; i <= 2; i++) {
    s = recordAnswer(s, { question: fact, correct: true, input: '63', mode: 'learn', ts: T0 + i });
    assert.equal(s.missed['mul:7x9'].streak, i);
  }
  s = recordAnswer(s, { question: fact, correct: false, input: '56', mode: 'learn', ts: T0 + 3 });
  assert.equal(s.missed['mul:7x9'].streak, 0, 'wrong resets streak');
  for (let i = 4; i <= 6; i++) s = recordAnswer(s, { question: fact, correct: true, input: '63', mode: 'learn', ts: T0 + i });
  assert.equal(s.missed['mul:7x9'], undefined, 'three in a row clears');
});

test('warm-up and speed answers never touch stats or missed pile', () => {
  let s = emptyState();
  const fact = q('M1', 'mul:2x5', '10');
  s = recordAnswer(s, { question: fact, correct: false, input: '', mode: 'warmup', ts: T0 });
  assert.equal(rungState(s, 'M1').answers.length, 0);
  assert.equal(Object.keys(s.missed).length, 0);
  s = recordAnswer(s, { question: fact, correct: false, input: '', mode: 'speed', ts: T0 });
  assert.equal(rungState(s, 'M1').answers.length, 0);
  assert.equal(Object.keys(s.missed).length, 0);
  assert.equal(rungState(s, 'M1').total, 1, 'speed still counts toward total');
});

test('answers window is capped at KEEP and accuracy uses the last WINDOW', () => {
  const s = drill(emptyState(), 'M1', 10, 30);
  assert.equal(rungState(s, 'M1').answers.length, KEEP);
  assert.equal(rollingAccuracy(s, 'M1'), 0);
});

test('mastery: exactly 18/20, 20 answers minimum, blocked only by streak-0 facts', () => {
  assert.equal(evaluateMastery(drill(emptyState(), 'M1', 17, 3), 'M1'), false);
  assert.equal(evaluateMastery(drill(emptyState(), 'M1', 19, 0), 'M1'), false, 'fewer than 20 answers');
  let s = drill(emptyState(), 'M1', 2, 0);
  s = drill(s, 'M1', 18, 0, T0 + 100);
  assert.equal(evaluateMastery(s, 'M1'), true);
  let b = drill(emptyState(), 'M1', 18, 2);
  assert.equal(rollingAccuracy(b, 'M1'), 0.9);
  assert.equal(evaluateMastery(b, 'M1'), false);
  b = recordAnswer(b, { question: q('M1', 'M1:bad0'), correct: true, input: '1', mode: 'learn', ts: T0 + 50 });
  b = recordAnswer(b, { question: q('M1', 'M1:bad1'), correct: true, input: '1', mode: 'learn', ts: T0 + 51 });
  assert.equal(isMastered(b, 'M1'), true);
  assert.equal(rungState(b, 'M1').mastered_at, T0 + 51);
});

test('mastery unlocks dependants; needsRefresh when a mastered rung drops under 80%', () => {
  let s = master(emptyState(), 'M1');
  assert.equal(isUnlocked(s, 'M2'), true);
  assert.equal(isUnlocked(s, 'D1'), true);
  assert.equal(needsRefresh(s, 'M1'), false);
  s = drill(s, 'M1', 0, 10, T0 + 1000);
  assert.equal(isMastered(s, 'M1'), true, 'never re-locked');
  assert.equal(needsRefresh(s, 'M1'), true);
});

test('pickTarget follows the three rules', () => {
  let s = emptyState();
  assert.deepEqual(pickTarget(s), { rungId: 'M1', mode: 'learn', firstVisit: true });
  s = master(s, 'M1');
  assert.deepEqual(pickTarget(s), { rungId: 'M2', mode: 'learn', firstVisit: true });
  s = markVisited(s, 'M2', T0); s = markVisited(s, 'D1', T0);
  s = drill(s, 'M2', 8, 2, T0 + 10);
  s = drill(s, 'D1', 5, 5, T0 + 20);
  assert.deepEqual(pickTarget(s), { rungId: 'D1', mode: 'learn', firstVisit: false });
});

test('pickTarget: all mastered -> oldest practised, speed mode', () => {
  let s = emptyState();
  for (const id of RUNG_ORDER) s = master(s, id);
  s.rungs.M4.last_practised = T0 - 1_000_000;
  assert.deepEqual(pickTarget(s), { rungId: 'M4', mode: 'speed', firstVisit: false });
});

test('composeSession: 6 target / 2 missed / 2 retention, all target when nothing else', () => {
  const rng = mulberry32(5);
  let s = emptyState();
  let qs = composeSession(s, 'M1', rng);
  assert.equal(qs.length, SESSION_LEN);
  assert.ok(qs.every((x) => x.rungId === 'M1'));
  assert.equal(new Set(qs.map((x) => x.factId)).size, SESSION_LEN, 'target questions are distinct facts');

  s = master(s, 'M1');
  s = recordAnswer(s, { question: generate('M3', rng), correct: false, input: '0', mode: 'learn', ts: T0 });
  s = recordAnswer(s, { question: generate('M3', rng), correct: false, input: '0', mode: 'learn', ts: T0 + 1 });
  s = recordAnswer(s, { question: generate('M3', rng), correct: false, input: '0', mode: 'learn', ts: T0 + 2 });
  qs = composeSession(s, 'M2', rng);
  assert.equal(qs.filter((x) => x.rungId === 'M2').length, 6);
  assert.equal(qs.filter((x) => x.rungId === 'M3').length, 2, 'from missed pile');
  assert.equal(qs.filter((x) => x.rungId === 'M1').length, 2, 'retention from mastered');
});

test('composeWeakSpots cycles the pile lowest streak first; composeWarmup gives 6 distinct', () => {
  const rng = mulberry32(6);
  let s = emptyState();
  for (let i = 0; i < 3; i++) s = recordAnswer(s, { question: q('M2', `M2:f${i}`), correct: false, input: '0', mode: 'learn', ts: T0 + i });
  s = recordAnswer(s, { question: q('M2', 'M2:f1'), correct: true, input: '1', mode: 'learn', ts: T0 + 10 });
  const qs = composeWeakSpots(s, rng);
  assert.equal(qs.length, SESSION_LEN);
  assert.deepEqual(qs.slice(0, 3).map((x) => x.factId), ['M2:f0', 'M2:f2', 'M2:f1']);
  const w = composeWarmup('M3', rng);
  assert.equal(w.length, WARMUP_LEN);
  assert.equal(new Set(w.map((x) => x.factId)).size, WARMUP_LEN);
});

test('rungLevel and continueHint', () => {
  let s = emptyState();
  assert.equal(rungLevel(s, 'M2'), 'locked');
  assert.equal(rungLevel(s, 'M1'), 'learning');
  s = master(s, 'M1');
  assert.equal(rungLevel(s, 'M1'), 'mastered');
  s.rungs.M1.fast_at = T0;
  assert.equal(rungLevel(s, 'M1'), 'fast');
  s = drill(s, 'M2', 10, 2);
  assert.match(continueHint(s, { rungId: 'M2', mode: 'learn', firstVisit: false }), /10\/12 so far/);
  assert.match(continueHint(s, { rungId: 'M2', mode: 'learn', firstVisit: false }), /2 facts to clear/);
  assert.match(continueHint(s, { rungId: 'M3', mode: 'learn', firstVisit: true }), /New: /);
});
