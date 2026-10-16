import { RUNGS, RUNG_ORDER } from './ladder.js';
import { generate } from './generators/index.js';
import { pick, shuffle } from './rng.js';

export const WINDOW = 20;          // answers considered for accuracy
export const MASTERY = 0.9;        // 18/20
export const KEEP = 30;            // answers stored per rung
export const MISSED_CLEAR = 3;     // correct-in-a-row to leave the pile
export const FAST_TRACK = 10;      // this many correct in a row masters a rung at once
export const REFRESH_BELOW = 0.8;
export const SESSION_LEN = 10;
export const WARMUP_LEN = 6;
export const SPEED_LIMIT_MS = 5000;
export const FAST_AVG_MS = 3000;
export const WEAK_SPOTS_MIN = 3;

export function emptyState() {
  return {
    version: 1, rungs: {}, missed: {},
    streak: { last_day: null, count: 0 }, sessions: [],
    flags: { installHintSeen: false, speedNudgeSeen: [] },
  };
}

const freshRung = () => ({ answers: [], total: 0, visited: false, mastered_at: null, fast_at: null, speed_pb: null, last_practised: null });

export function rungState(state, id) {
  return state.rungs[id] ?? freshRung();
}

function ensure(state, id) {
  if (!state.rungs[id]) state.rungs[id] = freshRung();
  return state.rungs[id];
}

export const isMastered = (state, id) => rungState(state, id).mastered_at != null;
export const isUnlocked = (state, id) => RUNGS[id].requires.every((p) => isMastered(state, p));
export const isStarted = (state, id) => rungState(state, id).visited || rungState(state, id).answers.length > 0;

export function rollingAccuracy(state, id) {
  const a = rungState(state, id).answers.slice(-WINDOW);
  if (a.length === 0) return null;
  return a.reduce((n, x) => n + x.c, 0) / a.length;
}

/** Facts of this rung in the pile that have not yet been answered correctly since being missed. */
export function blockingFacts(state, id) {
  return Object.values(state.missed).filter((m) => m.rung === id && m.streak === 0);
}

export function evaluateMastery(state, id) {
  if (blockingFacts(state, id).length > 0) return false;
  const a = rungState(state, id).answers.slice(-WINDOW);
  const recent = a.slice(-FAST_TRACK);
  if (recent.length >= FAST_TRACK && recent.every((x) => x.c === 1)) return true;
  if (a.length < WINDOW) return false;
  const acc = a.reduce((n, x) => n + x.c, 0) / a.length;
  return acc >= MASTERY;
}

/** What still stands between this rung and mastery, for the summary screen. */
export function masteryProgress(state, id) {
  const a = rungState(state, id).answers.slice(-WINDOW);
  const correct = a.reduce((n, x) => n + x.c, 0);
  let run = 0;
  for (let i = a.length - 1; i >= 0 && a[i].c === 1; i--) run++;
  return { correct, count: a.length, window: WINDOW, needed: Math.round(WINDOW * MASTERY), run, fastTrack: FAST_TRACK, blocking: blockingFacts(state, id).length };
}

/** Rungs that this rung directly unlocks. */
export const unlocksNext = (id) => RUNG_ORDER.filter((r) => RUNGS[r].requires.includes(id));

export function needsRefresh(state, id) {
  if (!isMastered(state, id)) return false;
  const a = rungState(state, id).answers;
  if (a.length < 10) return false;
  return rollingAccuracy(state, id) < REFRESH_BELOW;
}

export function markVisited(state, id, ts) {
  const s = structuredClone(state);
  const r = ensure(s, id);
  r.visited = true;
  r.last_practised = ts;
  return s;
}

/**
 * Record one answer. mode: 'learn' | 'weak' | 'warmup' | 'speed'.
 * warmup: no effect. speed: total + last_practised only. learn/weak: full stats + missed pile + mastery check.
 */
export function recordAnswer(state, { question, correct, input, mode, ts }) {
  if (mode === 'warmup') return state;
  const s = structuredClone(state);
  const r = ensure(s, question.rungId);
  r.total += 1;
  r.last_practised = ts;
  if (mode === 'speed') return s;

  r.answers.push({ c: correct ? 1 : 0, ts });
  if (r.answers.length > KEEP) r.answers.splice(0, r.answers.length - KEEP);

  const m = s.missed[question.factId];
  if (!correct) {
    s.missed[question.factId] = { rung: question.rungId, streak: 0, last_asked: ts, last_wrong_answer: String(input ?? ''), q: question };
  } else if (m) {
    m.streak += 1;
    m.last_asked = ts;
    if (m.streak >= MISSED_CLEAR) delete s.missed[question.factId];
  }

  if (r.mastered_at == null && evaluateMastery(s, question.rungId)) r.mastered_at = ts;
  return s;
}

/** Missed-pile entries, lowest streak first, then oldest last_asked. */
export function missedSorted(state) {
  return Object.values(state.missed).sort((a, b) => a.streak - b.streak || a.last_asked - b.last_asked);
}

export function pickTarget(state) {
  const unlocked = RUNG_ORDER.filter((id) => isUnlocked(state, id));
  const inProgress = unlocked.filter((id) => !isMastered(state, id) && isStarted(state, id));
  if (inProgress.length) {
    inProgress.sort((a, b) => {
      const d = (rollingAccuracy(state, a) ?? 0) - (rollingAccuracy(state, b) ?? 0);
      return d || (rungState(state, a).last_practised ?? 0) - (rungState(state, b).last_practised ?? 0);
    });
    return { rungId: inProgress[0], mode: 'learn', firstVisit: false };
  }
  const unstarted = unlocked.find((id) => !isMastered(state, id));
  if (unstarted) return { rungId: unstarted, mode: 'learn', firstVisit: true };
  const oldest = unlocked.slice().sort((a, b) => (rungState(state, a).last_practised ?? 0) - (rungState(state, b).last_practised ?? 0))[0];
  return { rungId: oldest, mode: 'speed', firstVisit: false };
}

function distinct(rungId, rng, n, exclude = new Set()) {
  const out = [], seen = new Set(exclude);
  for (let tries = 0; out.length < n && tries < n * 30; tries++) {
    const q = generate(rungId, rng);
    if (seen.has(q.factId)) continue;
    seen.add(q.factId); out.push(q);
  }
  while (out.length < n) out.push(generate(rungId, rng)); // tiny rungs: allow repeats rather than loop forever
  return out;
}

export function composeWarmup(rungId, rng) {
  return distinct(rungId, rng, WARMUP_LEN);
}

/** Speed round: 10 distinct target questions, nothing else. */
export function composeSpeed(rungId, rng) {
  return distinct(rungId, rng, SESSION_LEN);
}

/** 6 target + 2 missed + 2 retention (shortfalls go to target), shuffled. */
export function composeSession(state, rungId, rng) {
  const missed = missedSorted(state).slice(0, 2).map((m) => m.q);
  const masteredOthers = RUNG_ORDER.filter((id) => id !== rungId && isMastered(state, id));
  const retention = [];
  for (let i = 0; i < 2 && masteredOthers.length; i++) retention.push(generate(pick(rng, masteredOthers), rng));
  const targetCount = SESSION_LEN - missed.length - retention.length;
  const target = distinct(rungId, rng, targetCount, new Set(missed.map((q) => q.factId)));
  return shuffle(rng, [...target, ...missed, ...retention]);
}

/** Whole session from the missed pile, cycling if the pile is smaller than a session. */
export function composeWeakSpots(state, rng) {
  const pile = missedSorted(state).map((m) => m.q);
  if (!pile.length) return [];
  const out = pile.slice(0, SESSION_LEN);
  while (out.length < SESSION_LEN) {
    // later passes are shuffled so repeats do not come in the same order
    for (const q of shuffle(rng, pile)) { if (out.length >= SESSION_LEN) break; out.push(q); }
  }
  return out;
}

export function rungLevel(state, id) {
  if (!isUnlocked(state, id)) return 'locked';
  const r = rungState(state, id);
  if (r.fast_at != null) return 'fast';
  if (r.mastered_at != null) return 'mastered';
  return 'learning';
}

export function continueHint(state, target) {
  const rung = RUNGS[target.rungId];
  if (target.mode === 'speed') return `${rung.short} — speed round, beat your best`;
  if (target.firstVisit) return `New: ${rung.title}`;
  const a = rungState(state, target.rungId).answers.slice(-WINDOW);
  const correct = a.reduce((n, x) => n + x.c, 0);
  const blocking = blockingFacts(state, target.rungId).length;
  const parts = [`${correct}/${a.length} so far`];
  if (blocking) parts.push(`${blocking} fact${blocking === 1 ? '' : 's'} to clear`);
  return `${rung.short} — ${parts.join(', ')}`;
}
