import { checkAnswer } from './answer.js';
import { composeSession, composeSpeed, composeWarmup, composeWeakSpots, recordAnswer, isMastered } from './scheduler.js';

/**
 * mode: 'learn' | 'warmup' | 'speed' | 'weak'
 * A session is a plain object; every function returns a new one.
 */
export function createSession(state, { rungId, mode }, rng, ts) {
  let questions;
  if (mode === 'warmup') questions = composeWarmup(rungId, rng);
  else if (mode === 'speed') questions = composeSpeed(rungId, rng);
  else if (mode === 'weak') questions = composeWeakSpots(state, rng);
  else questions = composeSession(state, rungId, rng);
  return { rungId, mode, questions, index: 0, results: [], baseCount: questions.length, startedAt: ts, newlyMastered: false };
}

export const currentQuestion = (session) => session.questions[session.index];
export const isDone = (session) => session.index >= session.questions.length;

/**
 * Submit the current question. Returns { session, state, correct, repeatWrong }.
 * Wrong answers (except in speed mode) are appended to the end of the queue.
 */
export function submitAnswer(session, state, input, ts, { timeout = false } = {}) {
  const q = currentQuestion(session);
  const correct = !timeout && checkAnswer(q.answer, input);
  const prev = state.missed[q.factId];
  const repeatWrong = !correct && !timeout && !!prev && prev.last_wrong_answer === String(input) && String(input) !== '';
  const wasMastered = isMastered(state, session.rungId);

  const nextState = recordAnswer(state, { question: q, correct, input, mode: session.mode, ts });
  const next = { ...session, questions: session.questions.slice(), results: session.results.slice() };
  next.results.push({ question: q, correct, input: String(input), ts, timeout, retry: session.index >= session.baseCount });
  if (!correct && session.mode !== 'speed') next.questions.push(q);
  next.index += 1;
  if (!wasMastered && isMastered(nextState, session.rungId)) next.newlyMastered = true;
  return { session: next, state: nextState, correct, repeatWrong };
}

/** Score = correct answers among the first baseCount (first-pass) questions. */
export function summarize(session, ts) {
  const firstPass = session.results.slice(0, session.baseCount);
  const score = firstPass.filter((r) => r.correct).length;
  const seen = new Set();
  const missed = firstPass.filter((r) => !r.correct && !seen.has(r.question.factId) && seen.add(r.question.factId)).map((r) => r.question);
  return {
    rungId: session.rungId, mode: session.mode, score, total: session.baseCount,
    seconds: Math.round((ts - session.startedAt) / 1000), missed,
    newlyMastered: session.newlyMastered, speed: session.mode === 'speed',
  };
}
