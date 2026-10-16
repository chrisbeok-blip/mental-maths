import { SESSION_LEN, FAST_AVG_MS } from './scheduler.js';

const SESSIONS_CAP = 100;
const DAY_MS = 86_400_000;

export function dayKey(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function daysBetween(keyA, keyB) {
  const [a, b] = [keyA, keyB].map((k) => { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y, m - 1, d); });
  return Math.round((b - a) / DAY_MS);
}

/** Streak as of `now`: alive if last session was today or yesterday. */
export function currentStreak(state, now = Date.now()) {
  const { last_day, count } = state.streak;
  if (!last_day) return 0;
  return daysBetween(last_day, dayKey(now)) <= 1 ? count : 0;
}

/** Append a completed session, update streak, speed PB and fast level. Returns new state. */
export function recordSession(state, { ts, rung, score, seconds, speed }) {
  const s = structuredClone(state);
  s.sessions.push({ ts, rung, score, seconds, speed: !!speed });
  if (s.sessions.length > SESSIONS_CAP) s.sessions.splice(0, s.sessions.length - SESSIONS_CAP);

  const today = dayKey(ts);
  if (s.streak.last_day !== today) {
    const gap = s.streak.last_day ? daysBetween(s.streak.last_day, today) : Infinity;
    s.streak.count = gap === 1 ? s.streak.count + 1 : 1;
    s.streak.last_day = today;
  }

  if (speed && score === SESSION_LEN) {
    const r = s.rungs[rung];
    if (r) {
      if (r.speed_pb == null || seconds < r.speed_pb) r.speed_pb = seconds;
      if (r.fast_at == null && seconds / SESSION_LEN <= FAST_AVG_MS / 1000) r.fast_at = ts;
    }
  }
  return s;
}

export const secondsAllTime = (state) => state.sessions.reduce((n, x) => n + x.seconds, 0);

export const secondsThisWeek = (state, now = Date.now()) =>
  state.sessions.filter((x) => now - x.ts < 7 * DAY_MS).reduce((n, x) => n + x.seconds, 0);
