import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../src/rng.js';
import { emptyState, recordAnswer, isMastered, WINDOW, SESSION_LEN, WARMUP_LEN } from '../src/scheduler.js';
import { createSession, currentQuestion, submitAnswer, isDone, summarize } from '../src/session.js';

const T0 = 1_760_000_000_000;

test('learn session: wrong answers are re-asked, score counts first pass only', () => {
  const rng = mulberry32(1);
  let state = emptyState();
  let s = createSession(state, { rungId: 'M1', mode: 'learn' }, rng, T0);
  assert.equal(s.questions.length, SESSION_LEN);
  assert.equal(s.baseCount, SESSION_LEN);
  let t = T0;
  let r = submitAnswer(s, state, 'nope', ++t);
  assert.equal(r.correct, false);
  s = r.session; state = r.state;
  assert.equal(s.questions.length, SESSION_LEN + 1, 'wrong question appended');
  while (!isDone(s)) {
    const q = currentQuestion(s);
    r = submitAnswer(s, state, q.answer, ++t);
    assert.equal(r.correct, true);
    s = r.session; state = r.state;
  }
  const sum = summarize(s, t + 5000);
  assert.equal(sum.score, SESSION_LEN - 1);
  assert.equal(sum.total, SESSION_LEN);
  assert.equal(sum.missed.length, 1);
  assert.equal(sum.seconds, Math.round((t + 5000 - T0) / 1000));
  assert.equal(sum.speed, false);
  assert.equal(state.rungs.M1.total, SESSION_LEN + 1);
});

test('speed session: timeouts count wrong, no re-ask, no missed pile', () => {
  const rng = mulberry32(2);
  let state = emptyState();
  let s = createSession(state, { rungId: 'M1', mode: 'speed' }, rng, T0);
  assert.ok(s.questions.every((q) => q.rungId === 'M1'));
  const r = submitAnswer(s, state, '', T0 + 5000, { timeout: true });
  assert.equal(r.correct, false);
  assert.equal(r.session.questions.length, SESSION_LEN);
  assert.equal(Object.keys(r.state.missed).length, 0);
});

test('warm-up session has 6 questions and leaves stats untouched', () => {
  const rng = mulberry32(3);
  const state = emptyState();
  let s = createSession(state, { rungId: 'M2', mode: 'warmup' }, rng, T0);
  assert.equal(s.questions.length, WARMUP_LEN);
  const r = submitAnswer(s, state, 'x', T0 + 1);
  assert.deepEqual(r.state, state);
  assert.equal(r.session.questions.length, WARMUP_LEN + 1, 'still re-asked in warm-up');
});

test('repeatWrong flags the same wrong answer twice; newlyMastered flips when the target crosses', () => {
  const rng = mulberry32(4);
  let state = emptyState();
  const fact = { factId: 'mul:7x9', rungId: 'M3', prompt: '7 × 9', answer: '63', prefix: '', suffix: '', methodLine: 'm' };
  state = recordAnswer(state, { question: fact, correct: false, input: '54', mode: 'learn', ts: T0 });
  let s = createSession(state, { rungId: 'M3', mode: 'learn' }, rng, T0 + 1);
  s.questions[0] = fact;
  let r = submitAnswer(s, state, '54', T0 + 2);
  assert.equal(r.repeatWrong, true);
  r = submitAnswer(s, state, '56', T0 + 2);
  assert.equal(r.repeatWrong, false);

  let st = emptyState();
  for (let i = 0; i < WINDOW - 1; i++) st = recordAnswer(st, { question: { ...fact, factId: `M3:x${i}` }, correct: true, input: '1', mode: 'learn', ts: T0 + i });
  let sess = createSession(st, { rungId: 'M3', mode: 'learn' }, rng, T0 + 100);
  const q0 = currentQuestion(sess);
  const out = submitAnswer(sess, st, q0.answer, T0 + 101);
  assert.equal(isMastered(out.state, 'M3'), true);
  assert.equal(out.session.newlyMastered, true);
});
