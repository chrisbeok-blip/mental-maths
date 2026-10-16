import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyState } from '../src/scheduler.js';
import { load, save, exportCode, importCode, STORAGE_KEY } from '../src/store.js';

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

test('load returns a fresh state when nothing is stored or stored data is corrupt', () => {
  const st = fakeStorage();
  assert.deepEqual(load(st), emptyState());
  st.setItem(STORAGE_KEY, '{not json');
  assert.deepEqual(load(st), emptyState());
});

test('save then load round-trips and fills missing keys', () => {
  const st = fakeStorage();
  const s = emptyState();
  s.rungs.M1 = { answers: [{ c: 1, ts: 5 }], total: 1, visited: true, mastered_at: null, fast_at: null, speed_pb: null, last_practised: 5 };
  save(st, s);
  assert.deepEqual(load(st), s);
  st.setItem(STORAGE_KEY, JSON.stringify({ version: 1, rungs: {} }));
  const loaded = load(st);
  assert.deepEqual(loaded.streak, { last_day: null, count: 0 });
  assert.deepEqual(loaded.sessions, []);
});

test('exportCode -> importCode round-trips; bad codes return null', async () => {
  const s = emptyState();
  s.missed['mul:7x9'] = { rung: 'M3', streak: 1, last_asked: 1, last_wrong_answer: '54', q: { factId: 'mul:7x9', rungId: 'M3', prompt: '7 × 9', answer: '63', prefix: '', suffix: '', methodLine: 'm' } };
  const code = await exportCode(s);
  assert.match(code, /^MM1\.[A-Za-z0-9_-]+$/);
  assert.deepEqual(await importCode(code), s);
  assert.equal(await importCode('MM1.!!!'), null);
  assert.equal(await importCode('hello'), null);
});
