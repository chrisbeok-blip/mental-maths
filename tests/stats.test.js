import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, FAST_AVG_MS, SESSION_LEN } from '../src/scheduler.js';
import { dayKey, recordSession, secondsThisWeek, secondsAllTime, currentStreak } from '../src/stats.js';

const day = (d, h = 12) => new Date(2026, 9, d, h).getTime();

test('dayKey is local YYYY-MM-DD', () => {
  assert.equal(dayKey(day(16)), '2026-10-16');
  assert.equal(dayKey(new Date(2026, 9, 16, 23, 59).getTime()), '2026-10-16');
});

test('recordSession appends (cap 100) and maintains the daily streak', () => {
  let s = emptyState();
  s = recordSession(s, { ts: day(14), rung: 'M1', score: 7, seconds: 60, speed: false });
  assert.equal(s.streak.count, 1);
  s = recordSession(s, { ts: day(14, 18), rung: 'M1', score: 8, seconds: 55, speed: false });
  assert.equal(s.streak.count, 1, 'same day does not add');
  s = recordSession(s, { ts: day(15), rung: 'M1', score: 9, seconds: 50, speed: false });
  assert.equal(s.streak.count, 2);
  s = recordSession(s, { ts: day(17), rung: 'M1', score: 9, seconds: 50, speed: false });
  assert.equal(s.streak.count, 1, 'a missed day resets');
  for (let i = 0; i < 120; i++) s = recordSession(s, { ts: day(17) + i, rung: 'M1', score: 5, seconds: 10, speed: false });
  assert.equal(s.sessions.length, 100);
});

test('currentStreak is 0 once a day has been skipped', () => {
  let s = recordSession(emptyState(), { ts: day(14), rung: 'M1', score: 7, seconds: 60, speed: false });
  assert.equal(currentStreak(s, day(14)), 1);
  assert.equal(currentStreak(s, day(15)), 1, 'still alive the next day');
  assert.equal(currentStreak(s, day(16)), 0);
});

test('speed sessions set PB on 10/10 and fast_at when averaging under 3s', () => {
  let s = emptyState();
  s.rungs.M3 = { answers: [], total: 0, visited: true, mastered_at: 1, fast_at: null, speed_pb: null, last_practised: 1 };
  s = recordSession(s, { ts: day(16), rung: 'M3', score: 9, seconds: 20, speed: true });
  assert.equal(s.rungs.M3.speed_pb, null, 'needs 10/10');
  s = recordSession(s, { ts: day(16), rung: 'M3', score: SESSION_LEN, seconds: 40, speed: true });
  assert.equal(s.rungs.M3.speed_pb, 40);
  assert.equal(s.rungs.M3.fast_at, null);
  s = recordSession(s, { ts: day(16), rung: 'M3', score: SESSION_LEN, seconds: 45, speed: true });
  assert.equal(s.rungs.M3.speed_pb, 40, 'PB only improves');
  s = recordSession(s, { ts: day(16), rung: 'M3', score: SESSION_LEN, seconds: (FAST_AVG_MS / 1000) * SESSION_LEN, speed: true });
  assert.equal(s.rungs.M3.speed_pb, 30);
  assert.equal(s.rungs.M3.fast_at, day(16));
});

test('time totals', () => {
  let s = emptyState();
  s = recordSession(s, { ts: day(1), rung: 'M1', score: 5, seconds: 100, speed: false });
  s = recordSession(s, { ts: day(15), rung: 'M1', score: 5, seconds: 60, speed: false });
  s = recordSession(s, { ts: day(16), rung: 'M1', score: 5, seconds: 30, speed: false });
  assert.equal(secondsAllTime(s), 190);
  assert.equal(secondsThisWeek(s, day(16)), 90);
});
