# Mental Maths Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A phone-first, installable, offline mental-arithmetic trainer (tables, division, fractions of amounts, percentages) with gap-tracking, mastery gating and speed mode, deployed to GitHub Pages.

**Architecture:** A static site of ES modules with no build step. A pure "engine" (ladder data, question generators, scheduler, store) is fully unit-tested with `node:test`; thin DOM "screen" modules render it. A single JSON state record lives in `localStorage`. A service worker precaches everything for offline use.

**Tech Stack:** Plain HTML/CSS/JS (ES2022 modules), Node 24 `node:test` for tests, Python PIL (already installed) to render PNG icons once, GitHub Pages via `gh` CLI.

**Spec:** `docs/superpowers/specs/2026-10-16-mental-maths-design.md`. Read it first; this plan does not restate rationale.

**Design skill:** Before Task 15 (app shell and styles) and Tasks 17-21 (screens), the implementer MUST invoke `frontend-design:frontend-design` and follow the visual direction in Task 15.

---

## File structure

```
mental-maths/
  index.html                 app shell: <main id="app">, loads src/app.js, registers sw.js
  styles.css                 all styling, light/dark via tokens
  manifest.webmanifest       PWA manifest (relative paths)
  sw.js                      precache + cache-first service worker
  icons/icon.svg             source icon
  icons/icon-192.png         rendered from svg (Task 18)
  icons/icon-512.png
  package.json               { "type": "module", "scripts": { "test": "node --test" } }
  src/rng.js                 mulberry32 seeded RNG + pick/int helpers (pure)
  src/answer.js              checkAnswer, formatAnswer, autoSubmitLength (pure)
  src/ladder.js              TRACKS, RUNGS, method cards (data only)
  src/generators/tables.js   M1-M5
  src/generators/multiples.js M6-M8
  src/generators/division.js D1-D4
  src/generators/fractions.js F1-F2
  src/generators/percent.js  P1-P7
  src/generators/index.js    generate(rungId, rng)
  src/scheduler.js           unlock/mastery/missed pile/session composition/target (pure)
  src/stats.js               streak, sessions, time totals, levels (pure)
  src/store.js               defaultState, load, save, exportCode, importCode
  src/app.js                 router, state holder, install prompt, session runner
  src/screens/home.js
  src/screens/method.js
  src/screens/drill.js
  src/screens/summary.js
  src/screens/progress.js
  src/ui.js                  tiny DOM helpers: h(), clear(), fmtTime()
  tests/*.test.js            one test file per engine module
```

**Question object** (returned by every generator, consumed everywhere):

```js
{
  factId: 'mul:7x9',       // stable identity of this exact fact
  rungId: 'M3',
  prompt: '7 × 9',         // plain text, shown large
  answer: '63',            // canonical string; remainders as '4 r 3'; decimals as '23.5'
  prefix: '',              // '£' for money questions, else ''
  suffix: '',              // '%' for "as a percentage" questions, else ''
  methodLine: '7 × 10 = 70, take away 7 = 63',
}
```

**State record** (`store.defaultState()`):

```js
{
  version: 1,
  rungs: {},      // rungId -> { answers: [{c:1|0, ts}], total, mastered_at, fast_at, speed_pb, last_practised }
  missed: {},     // factId -> { rung, streak, last_asked, last_wrong_answer, q: Question }
  streak: { last_day: null, count: 0 },
  sessions: [],   // { ts, rung, score, seconds, speed } newest last, cap 100
  flags: { installHintSeen: false, speedNudgeSeen: [] }
}
```

Note: `missed[factId].q` stores the full question so the missed pile can re-ask a fact without a per-generator factId parser. This is the one addition to the spec's state shape.

---

### Task 1: Project scaffold and test runner

**Files:**
- Create: `package.json`, `.gitignore`, `tests/smoke.test.js`

- [ ] **Step 1: Create package.json and .gitignore**

```json
{
  "name": "mental-maths",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test \"tests/**/*.test.js\"",
    "serve": "python3 -m http.server 8080"
  }
}
```

`.gitignore`:
```
node_modules/
.DS_Store
```

- [ ] **Step 2: Write a smoke test**

`tests/smoke.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('test runner works', () => {
  assert.equal(1 + 1, 2);
});
```

- [ ] **Step 3: Run it**

Run: `cd /home/chris/mental-maths && npm test`
Expected: `# pass 1`

- [ ] **Step 4: Commit**

```bash
git add package.json .gitignore tests/smoke.test.js
git commit -m "chore: scaffold project with node:test runner"
```

---

### Task 2: Seeded RNG helpers

**Files:**
- Create: `src/rng.js`, `tests/rng.test.js`

- [ ] **Step 1: Write the failing test**

`tests/rng.test.js`:
```js
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL, cannot find module `src/rng.js`

- [ ] **Step 3: Implement**

`src/rng.js`:
```js
// Seeded PRNG (mulberry32). Generators take an rng() -> [0,1) so tests are deterministic.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const randomRng = () => Math.random();

/** Integer in [lo, hi] inclusive. */
export function int(rng, lo, hi) {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

/** Returns a new shuffled array (Fisher-Yates). */
export function shuffle(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add src/rng.js tests/rng.test.js
git commit -m "feat: seeded rng helpers"
```

---

### Task 3: Answer checking

**Files:**
- Create: `src/answer.js`, `tests/answer.test.js`

- [ ] **Step 1: Write the failing test**

`tests/answer.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAnswer, formatAnswer, autoSubmitLength } from '../src/answer.js';

test('numeric answers compare numerically', () => {
  assert.equal(checkAnswer('63', '63'), true);
  assert.equal(checkAnswer('63', '36'), false);
  assert.equal(checkAnswer('23.5', '23.5'), true);
  assert.equal(checkAnswer('48.5', '48.50'), true);
  assert.equal(checkAnswer('0.7', '.7'), true);
  assert.equal(checkAnswer('63', ''), false);
  assert.equal(checkAnswer('63', '6.'), false);
});

test('remainder answers compare quotient and remainder', () => {
  assert.equal(checkAnswer('4 r 3', '4r3'), true);
  assert.equal(checkAnswer('4 r 3', '4 r 3'), true);
  assert.equal(checkAnswer('4 r 3', '4 r 2'), false);
  assert.equal(checkAnswer('4 r 3', '4'), false);
});

test('formatAnswer renders money with 2dp when fractional', () => {
  assert.equal(formatAnswer('48', '£', ''), '£48');
  assert.equal(formatAnswer('48.5', '£', ''), '£48.50');
  assert.equal(formatAnswer('37.5', '', '%'), '37.5%');
  assert.equal(formatAnswer('4 r 3', '', ''), '4 r 3');
});

test('autoSubmitLength only for plain integers', () => {
  assert.equal(autoSubmitLength('63'), 2);
  assert.equal(autoSubmitLength('23.5'), null);
  assert.equal(autoSubmitLength('4 r 3'), null);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL, cannot find module `src/answer.js`

- [ ] **Step 3: Implement**

`src/answer.js`:
```js
const REM = /^\s*(\d+)\s*r\s*(\d+)\s*$/i;

function parseNumber(s) {
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s.trim())) return null;
  if (/\.$/.test(s.trim())) return null;
  return Number(s);
}

/** answer: canonical string from a generator. input: what the user typed. */
export function checkAnswer(answer, input) {
  const rem = answer.match(REM);
  if (rem) {
    const m = String(input).match(REM);
    return !!m && m[1] === rem[1] && m[2] === rem[2];
  }
  const a = Number(answer);
  const b = parseNumber(String(input));
  return b !== null && Math.abs(a - b) < 1e-9;
}

/** Human display of a canonical answer with prefix/suffix. Money gets 2dp when fractional. */
export function formatAnswer(answer, prefix = '', suffix = '') {
  if (REM.test(answer)) return answer;
  let body = answer;
  if (prefix === '£' && !Number.isInteger(Number(answer))) body = Number(answer).toFixed(2);
  return `${prefix}${body}${suffix}`;
}

/** Length at which the keypad may auto-submit, or null when the answer is not a plain integer. */
export function autoSubmitLength(answer) {
  return /^\d+$/.test(answer) ? answer.length : null;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add src/answer.js tests/answer.test.js
git commit -m "feat: answer checking and formatting"
```

---

### Task 4: Ladder data (tracks, rungs, prerequisites, method cards)

**Files:**
- Create: `src/ladder.js`, `tests/ladder.test.js`

- [ ] **Step 1: Write the failing test**

`tests/ladder.test.js`:
```js
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL, cannot find module `src/ladder.js`

- [ ] **Step 3: Implement**

`src/ladder.js` (data only; no logic):
```js
// Tracks and rungs. `requires` lists rung ids that must be mastered first.
// `format` tells the keypad which extra keys to show. `method` is the one-screen card.

const rung = (id, track, title, short, requires, format, method, extra = {}) =>
  ({ id, track, title, short, requires, format: { decimals: false, remainder: false, ...format }, method, ...extra });

const INT = {};
const DEC = { decimals: true };

export const RUNGS = {
  // ---------- Multiplication ----------
  M1: rung('M1', 'mul', 'Times 2, 5 and 10', '×2 ×5 ×10', [], INT, {
    lines: [
      '×2 is doubling. 7 × 2: double 7 = 14.',
      '×10: every digit moves up one place. 7 × 10 = 70.',
      '×5 is half of ×10. 7 × 5: 7 × 10 = 70, halve it = 35.',
    ],
    examples: [{ q: '8 × 5', a: '8 × 10 = 80, half of 80 = 40' }, { q: '12 × 2', a: 'double 12 = 24' }],
  }),
  M2: rung('M2', 'mul', 'Times 4, 3 and 6', '×4 ×3 ×6', ['M1'], INT, {
    lines: [
      '×4 is double, then double again. 7 × 4: 14, then 28.',
      '×3 is double, then add one more. 7 × 3: 14 + 7 = 21.',
      '×6 is ×3, then double. 7 × 6: 21, doubled = 42.',
    ],
    examples: [{ q: '9 × 4', a: '18, then 36' }, { q: '8 × 6', a: '8 × 3 = 24, doubled = 48' }],
  }),
  M3: rung('M3', 'mul', 'Times 9 and 8', '×9 ×8', ['M2'], INT, {
    lines: [
      '×9 is ×10 minus one lot. 7 × 9: 70 − 7 = 63.',
      'Check: the digits of a ×9 answer add to 9 (6 + 3 = 9).',
      '×8 is ×4 doubled. 7 × 8: 28, doubled = 56.',
    ],
    examples: [{ q: '6 × 9', a: '60 − 6 = 54' }, { q: '9 × 8', a: '9 × 4 = 36, doubled = 72' }],
  }),
  M4: rung('M4', 'mul', 'Times 7, 11 and 12', '×7 ×11 ×12', ['M3'], INT, {
    lines: [
      '×7 is ×5 plus ×2. 8 × 7: 40 + 16 = 56.',
      '×11 is ×10 plus one lot. 8 × 11: 80 + 8 = 88.',
      '×12 is ×10 plus ×2. 8 × 12: 80 + 16 = 96.',
    ],
    examples: [{ q: '6 × 7', a: '30 + 12 = 42' }, { q: '7 × 12', a: '70 + 14 = 84' }],
  }),
  M5: rung('M5', 'mul', 'All tables, both ways', 'Mixed', ['M4'], INT, {
    lines: [
      'Every table from 2 to 12, in any order.',
      'Also backwards: "? × 7 = 56". Start from a 7-fact you know and step.',
      '7 × 7 = 49. One more 7 is 56. So the answer is 8.',
      'Or step down from 10: 7 × 10 = 70, 7 × 9 = 63, 7 × 8 = 56. So 56 ÷ 7 = 8.',
    ],
    examples: [{ q: '? × 6 = 42', a: '6 × 5 = 30, 36, 42 — that is 7' }, { q: '12 × 9', a: '120 − 12 = 108' }],
  }),
  M6: rung('M6', 'mul', 'Tens, hundreds, thousands', '×10 ×100', ['M5'], INT, {
    lines: [
      '×10, ×100, ×1000: the digits shift 1, 2 or 3 places. 34 × 100 = 3400.',
      'A number times a multiple of ten: do the small fact, then shift.',
      '6 × 40: 6 × 4 = 24, then × 10 = 240.',
    ],
    examples: [{ q: '7 × 300', a: '7 × 3 = 21, two zeros → 2100' }, { q: '58 × 10', a: '580' }],
  }),
  M7: rung('M7', 'mul', 'Two digits by one digit', '23 × 4', ['M6'], INT, {
    lines: [
      'Split the two-digit number into tens and units.',
      '23 × 4: 20 × 4 = 80, and 3 × 4 = 12.',
      'Add the two parts: 80 + 12 = 92.',
      'Say the tens part out loud first, then add the units part.',
    ],
    examples: [{ q: '17 × 6', a: '60 + 42 = 102' }, { q: '28 × 3', a: '60 + 24 = 84' }],
  }),
  M8: rung('M8', 'mul', 'Two-digit tricks', 'Tricks', ['M7'], INT, {
    lines: [
      '×11: spread the digits and put their sum in the middle. 23 × 11 = 2 (2+3) 3 = 253.',
      '×25: quarter the number, then × 100. 12 × 25: 12 ÷ 4 = 3, so 300.',
      'A pair either side of a round number: 19 × 21 = 20² − 1² = 400 − 1 = 399.',
    ],
    examples: [{ q: '34 × 11', a: '3 (3+4) 4 = 374' }, { q: '18 × 22', a: '400 − 4 = 396' }],
  }, { bonus: true }),

  // ---------- Division ----------
  D1: rung('D1', 'div', 'Halving and quartering', 'Halve', ['M1'], DEC, {
    lines: [
      'Halve the tens, halve the units, add. 46 ÷ 2: 20 + 3 = 23.',
      'Odd numbers end in .5: 47 ÷ 2 = 23.5.',
      'Quarter = halve twice. 68 ÷ 4: 34, then 17.',
    ],
    examples: [{ q: '86 ÷ 2', a: '40 + 3 = 43' }, { q: '52 ÷ 4', a: '26, then 13' }],
  }),
  D2: rung('D2', 'div', 'Division from tables', '56 ÷ 7', ['M5'], INT, {
    lines: [
      'Division is a times-table question in reverse.',
      '56 ÷ 7 means "what × 7 makes 56?". 7 × 8 = 56, so 8.',
      'If you are not sure, start from a fact you know and step up or down.',
    ],
    examples: [{ q: '72 ÷ 9', a: '9 × 8 = 72, so 8' }, { q: '48 ÷ 6', a: '6 × 8 = 48, so 8' }],
  }),
  D3: rung('D3', 'div', 'Dividing by 10, 100, 1000', '÷10 ÷100', ['D2', 'M6'], DEC, {
    lines: [
      'Digits move down 1, 2 or 3 places. 450 ÷ 10 = 45. 450 ÷ 100 = 4.5.',
      'A number smaller than the divisor gives a decimal: 7 ÷ 10 = 0.7.',
      '3 ÷ 100 = 0.03 — fill the gap with a zero.',
    ],
    examples: [{ q: '2300 ÷ 100', a: '23' }, { q: '85 ÷ 1000', a: '0.085' }],
  }),
  D4: rung('D4', 'div', 'Remainders', '23 ÷ 5', ['D2'], { remainder: true }, {
    lines: [
      'Find the biggest table fact that fits, then see what is left.',
      '23 ÷ 5: 5 × 4 = 20 fits. 23 − 20 = 3 left over.',
      'Answer: 4 r 3. Type 4, then r, then 3.',
    ],
    examples: [{ q: '38 ÷ 6', a: '6 × 6 = 36, 2 left → 6 r 2' }, { q: '50 ÷ 7', a: '7 × 7 = 49, 1 left → 7 r 1' }],
  }),

  // ---------- Fractions ----------
  F1: rung('F1', 'frac', 'A fraction of an amount', '1/4 of 60', ['D1', 'M3'], INT, {
    lines: [
      'A unit fraction (1 on top) means divide by the bottom number.',
      '1/4 of 60 = 60 ÷ 4 = 15. 1/5 of 40 = 40 ÷ 5 = 8.',
      '1/8: halve three times. 1/8 of 64: 32, 16, 8.',
    ],
    examples: [{ q: '1/3 of 27', a: '27 ÷ 3 = 9' }, { q: '1/10 of 90', a: '9' }],
  }),
  F2: rung('F2', 'frac', 'Several parts of an amount', '3/5 of 40', ['F1', 'M5'], INT, {
    lines: [
      'Find one part first, then multiply by the top number.',
      '3/5 of 40: 1/5 is 40 ÷ 5 = 8. Then 8 × 3 = 24.',
      'Divide by the bottom, times by the top.',
    ],
    examples: [{ q: '2/3 of 30', a: '30 ÷ 3 = 10, × 2 = 20' }, { q: '5/8 of 48', a: '48 ÷ 8 = 6, × 5 = 30' }],
  }),

  // ---------- Percentages ----------
  P1: rung('P1', 'pct', 'The four building blocks', '50% 25% 10% 1%', ['M3', 'D1'], DEC, {
    lines: [
      '50% is half. 50% of 86 = 43.',
      '25% is half of half. 25% of 60: 30, then 15.',
      '10% is ÷ 10. 10% of 80 = 8.   1% is ÷ 100. 1% of 300 = 3.',
      'Every other percentage is built from these four.',
    ],
    examples: [{ q: '25% of 120', a: '60, then 30' }, { q: '10% of 45', a: '4.5' }],
  }),
  P2: rung('P2', 'pct', 'Build any percentage', '15% 30% 17.5%', ['P1'], DEC, {
    lines: [
      'Start from 10%, then scale. 30% of 80: 10% = 8, × 3 = 24.',
      '5% is half of 10%. 15% = 10% + 5%. 15% of 80: 8 + 4 = 12.',
      '2.5% is half of 5%. 17.5% = 10% + 5% + 2.5%: 8 + 4 + 2 = 14.',
      '75% = 50% + 25%. 75% of 80: 40 + 20 = 60.',
    ],
    examples: [{ q: '40% of 60', a: '10% = 6, × 4 = 24' }, { q: '5% of 140', a: '10% = 14, halve → 7' }],
  }),
  P3: rung('P3', 'pct', 'Fractions and percentages', '3/8 = 37.5%', ['P2', 'F2'], DEC, {
    lines: [
      '1/2 = 50%, 1/4 = 25%, 3/4 = 75%, 1/5 = 20%, 1/10 = 10%.',
      '1/8 is half of 1/4, so 12.5%. 3/8 = 37.5%, 5/8 = 62.5%, 7/8 = 87.5%.',
      'Swap when it is easier: 37.5% of 80 is 3/8 of 80 = 80 ÷ 8 × 3 = 30.',
    ],
    examples: [{ q: '3/5 as a %', a: '1/5 = 20%, × 3 = 60%' }, { q: '62.5% of 40', a: '5/8 of 40 = 5 × 5 = 25' }],
  }),
  P4: rung('P4', 'pct', 'Percentage up or down', '£40 up 20%', ['P3'], DEC, {
    lines: [
      'Work out the percentage, then add it on or take it off.',
      '£40 up 20%: 20% of 40 = 8. 40 + 8 = £48.',
      '£60 down 25%: 25% of 60 = 15. 60 − 15 = £45.',
    ],
    examples: [{ q: 'Increase £80 by 15%', a: '15% = 12, so £92' }, { q: 'Reduce £120 by 10%', a: '10% = 12, so £108' }],
  }),
  P5: rung('P5', 'pct', 'Multipliers', '× 1.2', ['P4', 'M7'], DEC, {
    lines: [
      'Up 20% means 120% of the number: multiply by 1.2.',
      'Down 15% means 85% is left: multiply by 0.85.',
      '40 × 1.2: 40 × 1 = 40, 40 × 0.2 = 8, total 48.',
      'This is the way GCSE papers expect you to show it.',
    ],
    examples: [{ q: 'Multiplier for 35% off', a: '100 − 35 = 65% → 0.65' }, { q: '60 × 1.3', a: '60 + 18 = 78' }],
  }),
  P6: rung('P6', 'pct', 'Reverse percentages', 'Original price', ['P5'], DEC, {
    lines: [
      'The price you are given is NOT 100%. Work out what percent it is.',
      '£60 after 25% off: £60 is 75%.',
      '1% = 60 ÷ 75 = 0.80. 100% = £80.',
      'Or: 75% = 60, so 25% = 20, so 100% = 80.',
    ],
    examples: [{ q: '£90 after 10% off', a: '90 is 90%, 1% = 1, original £100' }, { q: '£66 after a 10% rise', a: '66 is 110%, 1% = 0.60, original £60' }],
  }),
  P7: rung('P7', 'pct', 'One number as a % of another', '18 out of 40', ['P6', 'D2'], DEC, {
    lines: [
      'Scale the bottom number to 100, and do the same to the top.',
      '18 out of 40: 40 → 100 is × 2.5. 18 × 2.5 = 45%.',
      'Out of 20: × 5. Out of 25: × 4. Out of 50: × 2. Out of 200: ÷ 2.',
    ],
    examples: [{ q: '7 out of 20', a: '× 5 → 35%' }, { q: '30 out of 200', a: '÷ 2 → 15%' }],
  }),
};

export const TRACKS = [
  { id: 'mul', title: 'Multiplication', rungs: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8'] },
  { id: 'div', title: 'Division', rungs: ['D1', 'D2', 'D3', 'D4'] },
  { id: 'frac', title: 'Fractions', rungs: ['F1', 'F2'] },
  { id: 'pct', title: 'Percentages', rungs: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'] },
];

/** Global display/scheduling order (used for "lowest-numbered unlocked rung"). */
export const RUNG_ORDER = TRACKS.flatMap((t) => t.rungs);
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add src/ladder.js tests/ladder.test.js
git commit -m "feat: ladder data with 21 rungs and method cards"
```

---

### Task 5: Tables generator (M1-M5)

**Files:**
- Create: `src/generators/tables.js`, `tests/tables.test.js`

Generator contract (all families): `export function gen<Rung>(rng) -> Question`. Every generator is pure given `rng`.

- [ ] **Step 1: Write the failing test**

`tests/tables.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../src/rng.js';
import { genM1, genM2, genM3, genM4, genM5, tableMethod } from '../src/generators/tables.js';

const FWD = /^(\d+) × (\d+)$/;
const REV = /^\? × (\d+) = (\d+)$/;

function checkForward(q, allowedTables) {
  const m = q.prompt.match(FWD);
  assert.ok(m, `bad prompt ${q.prompt}`);
  const [a, b] = [Number(m[1]), Number(m[2])];
  assert.ok(allowedTables.includes(b), `table ${b} not allowed in ${q.rungId}`);
  assert.ok(a >= 2 && a <= 12);
  assert.equal(Number(q.answer), a * b);
  assert.equal(q.factId, `mul:${a}x${b}`);
  assert.ok(q.methodLine.length > 0);
}

test('M1-M4 draw only their tables and compute correctly', () => {
  const rng = mulberry32(3);
  const cases = [[genM1, 'M1', [2, 5, 10]], [genM2, 'M2', [4, 3, 6]], [genM3, 'M3', [9, 8]], [genM4, 'M4', [7, 11, 12]]];
  for (const [gen, id, tables] of cases) {
    const seenTables = new Set();
    for (let i = 0; i < 300; i++) {
      const q = gen(rng);
      assert.equal(q.rungId, id);
      checkForward(q, tables);
      seenTables.add(Number(q.prompt.match(FWD)[2]));
    }
    assert.deepEqual([...seenTables].sort((x, y) => x - y), tables.slice().sort((x, y) => x - y));
  }
});

test('M5 mixes all tables and includes reverse questions', () => {
  const rng = mulberry32(9);
  let reverse = 0;
  for (let i = 0; i < 500; i++) {
    const q = genM5(rng);
    assert.equal(q.rungId, 'M5');
    const r = q.prompt.match(REV);
    if (r) {
      reverse++;
      const [b, prod] = [Number(r[1]), Number(r[2])];
      assert.equal(Number(q.answer) * b, prod);
      assert.equal(q.factId, `rev:${q.answer}x${b}`);
    } else {
      checkForward(q, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    }
  }
  assert.ok(reverse > 100 && reverse < 250, `reverse share ${reverse}/500`);
});

test('tableMethod gives a specific line per table', () => {
  assert.equal(tableMethod(7, 9), '7 × 10 = 70, take away 7 = 63');
  assert.equal(tableMethod(7, 4), 'Double 7 = 14, double again = 28');
  assert.equal(tableMethod(8, 7), '8 × 5 = 40, 8 × 2 = 16, add = 56');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL, cannot find module `src/generators/tables.js`

- [ ] **Step 3: Implement**

`src/generators/tables.js`:
```js
import { int, pick } from '../rng.js';

/** One-line method for a × b, keyed on the table b. */
export function tableMethod(a, b) {
  const p = a * b;
  switch (b) {
    case 2: return `Double ${a} = ${p}`;
    case 10: return `${a} × 10: shift up one place = ${p}`;
    case 5: return `${a} × 10 = ${a * 10}, halve it = ${p}`;
    case 4: return `Double ${a} = ${a * 2}, double again = ${p}`;
    case 3: return `Double ${a} = ${a * 2}, add one more ${a} = ${p}`;
    case 6: return `${a} × 3 = ${a * 3}, double it = ${p}`;
    case 9: return `${a} × 10 = ${a * 10}, take away ${a} = ${p}`;
    case 8: return `${a} × 4 = ${a * 4}, double it = ${p}`;
    case 7: return `${a} × 5 = ${a * 5}, ${a} × 2 = ${a * 2}, add = ${p}`;
    case 11: return `${a} × 10 = ${a * 10}, add ${a} = ${p}`;
    case 12: return `${a} × 10 = ${a * 10}, ${a} × 2 = ${a * 2}, add = ${p}`;
    default: return `${a} × ${b} = ${p}`;
  }
}

function forward(rungId, rng, tables) {
  const b = pick(rng, tables);
  const a = int(rng, 2, 12);
  return {
    factId: `mul:${a}x${b}`, rungId, prompt: `${a} × ${b}`, answer: String(a * b),
    prefix: '', suffix: '', methodLine: tableMethod(a, b),
  };
}

function reverse(rungId, rng) {
  const b = int(rng, 2, 12);
  const a = int(rng, 2, 12);
  const prod = a * b;
  // anchor on the nearer of a-1 or a+1 so the method shows a single step
  const anchor = a > 2 ? a - 1 : a + 1;
  const step = anchor < a ? `one more ${b} is ${prod}` : `one less ${b} is ${prod}`;
  return {
    factId: `rev:${a}x${b}`, rungId, prompt: `? × ${b} = ${prod}`, answer: String(a),
    prefix: '', suffix: '', methodLine: `${anchor} × ${b} = ${anchor * b}, ${step}, so ${a}`,
  };
}

export const genM1 = (rng) => forward('M1', rng, [2, 5, 10]);
export const genM2 = (rng) => forward('M2', rng, [4, 3, 6]);
export const genM3 = (rng) => forward('M3', rng, [9, 8]);
export const genM4 = (rng) => forward('M4', rng, [7, 11, 12]);
export const genM5 = (rng) => (rng() < 0.35 ? reverse('M5', rng) : forward('M5', rng, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]));
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add src/generators/tables.js tests/tables.test.js
git commit -m "feat: tables generators M1-M5"
```

---

### Task 6: Multiples and two-digit generators (M6-M8)

**Files:**
- Create: `src/generators/multiples.js`, `tests/multiples.test.js`

- [ ] **Step 1: Write the failing test**

`tests/multiples.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../src/rng.js';
import { genM6, genM7, genM8 } from '../src/generators/multiples.js';

const MUL = /^(\d+) × (\d+)$/;
const product = (q) => { const m = q.prompt.match(MUL); assert.ok(m, q.prompt); return [Number(m[1]), Number(m[2])]; };

test('M6: shifts and multiples of ten', () => {
  const rng = mulberry32(5);
  let shifts = 0, tens = 0;
  for (let i = 0; i < 400; i++) {
    const q = genM6(rng);
    const [a, b] = product(q);
    assert.equal(Number(q.answer), a * b);
    if ([10, 100, 1000].includes(b)) { shifts++; assert.ok(a >= 3 && a <= 99); assert.equal(q.factId, `tens:${a}x${b}`); }
    else { tens++; assert.ok(a >= 2 && a <= 9); assert.ok(b % 10 === 0 && b >= 20 && b <= 900); assert.equal(q.factId, `tens:${a}x${b}`); }
  }
  assert.ok(shifts > 100 && tens > 100);
});

test('M7: two-digit by one-digit, split method line', () => {
  const rng = mulberry32(6);
  for (let i = 0; i < 400; i++) {
    const q = genM7(rng);
    const [a, b] = product(q);
    assert.ok(a >= 12 && a <= 39 && a % 10 !== 0, `a=${a}`);
    assert.ok(b >= 3 && b <= 9);
    assert.equal(Number(q.answer), a * b);
    assert.equal(q.factId, `split:${a}x${b}`);
    const tens = Math.floor(a / 10) * 10, units = a % 10;
    assert.equal(q.methodLine, `${tens} × ${b} = ${tens * b}, ${units} × ${b} = ${units * b}, add = ${a * b}`);
  }
});

test('M8: x11, x25 and near-square pairs are all correct', () => {
  const rng = mulberry32(8);
  const kinds = new Set();
  for (let i = 0; i < 600; i++) {
    const q = genM8(rng);
    const [a, b] = product(q);
    assert.equal(Number(q.answer), a * b);
    kinds.add(q.factId.split(':')[0]);
    if (q.factId.startsWith('trick11:')) { assert.equal(b, 11); assert.ok(a >= 12 && a <= 81 && (Math.floor(a / 10) + a % 10) <= 9); }
    if (q.factId.startsWith('trick25:')) { assert.equal(b, 25); assert.ok(a % 2 === 0 && a >= 4 && a <= 40); }
    if (q.factId.startsWith('sq:')) { assert.equal((a + b) % 2, 0); }
  }
  assert.deepEqual([...kinds].sort(), ['sq', 'trick11', 'trick25']);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL, cannot find module `src/generators/multiples.js`

- [ ] **Step 3: Implement**

`src/generators/multiples.js`:
```js
import { int, pick } from '../rng.js';

const q = (factId, rungId, prompt, answer, methodLine) =>
  ({ factId, rungId, prompt, answer: String(answer), prefix: '', suffix: '', methodLine });

export function genM6(rng) {
  if (rng() < 0.5) {
    const a = int(rng, 3, 99);
    const b = pick(rng, [10, 100, 1000]);
    const places = String(b).length - 1;
    return q(`tens:${a}x${b}`, 'M6', `${a} × ${b}`, a * b, `Shift ${a} up ${places} place${places > 1 ? 's' : ''} = ${a * b}`);
  }
  const a = int(rng, 2, 9);
  const k = int(rng, 2, 9);
  const b = k * pick(rng, [10, 10, 100]);
  return q(`tens:${a}x${b}`, 'M6', `${a} × ${b}`, a * b, `${a} × ${k} = ${a * k}, then × ${b / k} = ${a * b}`);
}

export function genM7(rng) {
  let a = int(rng, 12, 39);
  if (a % 10 === 0) a += 1;
  const b = int(rng, 3, 9);
  const tens = Math.floor(a / 10) * 10, units = a % 10;
  return q(`split:${a}x${b}`, 'M7', `${a} × ${b}`, a * b,
    `${tens} × ${b} = ${tens * b}, ${units} × ${b} = ${units * b}, add = ${a * b}`);
}

export function genM8(rng) {
  const kind = pick(rng, ['11', '25', 'sq']);
  if (kind === '11') {
    let a;
    do { a = int(rng, 12, 81); } while (Math.floor(a / 10) + (a % 10) > 9);
    const t = Math.floor(a / 10), u = a % 10;
    return q(`trick11:${a}`, 'M8', `${a} × 11`, a * 11, `Digits ${t} and ${u}: put ${t} + ${u} = ${t + u} in the middle → ${a * 11}`);
  }
  if (kind === '25') {
    const a = 2 * int(rng, 2, 20);
    const quarter = a / 4;
    return q(`trick25:${a}`, 'M8', `${a} × 25`, a * 25, `${a} ÷ 4 = ${quarter}, × 100 = ${a * 25}`);
  }
  const n = pick(rng, [10, 15, 20, 25, 30, 40, 50]);
  const d = int(rng, 1, 3);
  const a = n - d, b = n + d;
  return q(`sq:${a}x${b}`, 'M8', `${a} × ${b}`, a * b, `${n}² − ${d}² = ${n * n} − ${d * d} = ${a * b}`);
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add src/generators/multiples.js tests/multiples.test.js
git commit -m "feat: multiples and two-digit generators M6-M8"
```

---

### Task 7: Division generators (D1-D4)

**Files:**
- Create: `src/generators/division.js`, `tests/division.test.js`

- [ ] **Step 1: Write the failing test**

`tests/division.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../src/rng.js';
import { genD1, genD2, genD3, genD4 } from '../src/generators/division.js';

const DIV = /^(\d+) ÷ (\d+)$/;
const parts = (q) => { const m = q.prompt.match(DIV); assert.ok(m, q.prompt); return [Number(m[1]), Number(m[2])]; };

test('D1: halves (incl. odd → .5) and quarters', () => {
  const rng = mulberry32(11);
  let odd = 0, quarters = 0;
  for (let i = 0; i < 400; i++) {
    const q = genD1(rng);
    const [n, d] = parts(q);
    assert.ok(d === 2 || d === 4);
    assert.ok(Math.abs(Number(q.answer) - n / d) < 1e-9);
    if (d === 2) { assert.ok(n >= 11 && n <= 99); if (n % 2) { odd++; assert.ok(q.answer.endsWith('.5')); } assert.equal(q.factId, `half:${n}`); }
    else { quarters++; assert.equal(n % 4, 0); assert.ok(n >= 12 && n <= 100); assert.equal(q.factId, `quarter:${n}`); }
  }
  assert.ok(odd > 50 && quarters > 80);
});

test('D2: exact division from tables 2-12', () => {
  const rng = mulberry32(12);
  for (let i = 0; i < 400; i++) {
    const q = genD2(rng);
    const [n, d] = parts(q);
    assert.ok(d >= 2 && d <= 12);
    assert.equal(n % d, 0);
    assert.ok(n / d >= 2 && n / d <= 12);
    assert.equal(Number(q.answer), n / d);
    assert.equal(q.factId, `div:${n}/${d}`);
  }
});

test('D3: ÷10/100/1000 with at most 3 decimal places', () => {
  const rng = mulberry32(13);
  let decimals = 0;
  for (let i = 0; i < 400; i++) {
    const q = genD3(rng);
    const [n, d] = parts(q);
    assert.ok([10, 100, 1000].includes(d));
    assert.ok(Math.abs(Number(q.answer) - n / d) < 1e-9, `${q.prompt} -> ${q.answer}`);
    assert.ok(!/e/i.test(q.answer));
    if (q.answer.includes('.')) { decimals++; assert.ok(q.answer.split('.')[1].length <= 3); }
    assert.equal(q.factId, `div10:${n}/${d}`);
  }
  assert.ok(decimals > 100);
});

test('D4: remainders are non-zero and canonical "q r r"', () => {
  const rng = mulberry32(14);
  for (let i = 0; i < 400; i++) {
    const q = genD4(rng);
    const [n, d] = parts(q);
    const m = q.answer.match(/^(\d+) r (\d+)$/);
    assert.ok(m, q.answer);
    const [quot, rem] = [Number(m[1]), Number(m[2])];
    assert.equal(quot * d + rem, n);
    assert.ok(rem >= 1 && rem < d);
    assert.ok(d >= 2 && d <= 9 && quot >= 2 && quot <= 12);
    assert.equal(q.factId, `rem:${n}/${d}`);
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL, cannot find module `src/generators/division.js`

- [ ] **Step 3: Implement**

`src/generators/division.js`:
```js
import { int, pick } from '../rng.js';

const q = (factId, rungId, prompt, answer, methodLine) =>
  ({ factId, rungId, prompt, answer: String(answer), prefix: '', suffix: '', methodLine });

/** Format a float without binary noise, e.g. 0.085 not 0.08499999. */
export const clean = (x) => String(Number(x.toFixed(6)));

export function genD1(rng) {
  if (rng() < 0.6) {
    const n = int(rng, 11, 99);
    const tens = Math.floor(n / 10) * 10, units = n % 10;
    const half = n / 2;
    const line = n % 2 === 0
      ? `Half of ${tens} is ${tens / 2}, half of ${units} is ${units / 2}, add = ${half}`
      : `Half of ${n - 1} is ${(n - 1) / 2}, plus half of 1 = ${half}`;
    return q(`half:${n}`, 'D1', `${n} ÷ 2`, clean(half), line);
  }
  const n = 4 * int(rng, 3, 25);
  return q(`quarter:${n}`, 'D1', `${n} ÷ 4`, n / 4, `Halve twice: ${n} → ${n / 2} → ${n / 4}`);
}

export function genD2(rng) {
  const d = int(rng, 2, 12), a = int(rng, 2, 12);
  const n = a * d;
  return q(`div:${n}/${d}`, 'D2', `${n} ÷ ${d}`, a, `What × ${d} makes ${n}? ${d} × ${a} = ${n}, so ${a}`);
}

export function genD3(rng) {
  const d = pick(rng, [10, 100, 1000]);
  // keep answers to <= 3 decimal places: for ÷1000 use whole numbers up to 9999 (3dp max)
  const n = d === 1000 ? int(rng, 1, 9999) : int(rng, 1, 999);
  const places = String(d).length - 1;
  const ans = clean(n / d);
  return q(`div10:${n}/${d}`, 'D3', `${n} ÷ ${d}`, ans, `Shift ${n} down ${places} place${places > 1 ? 's' : ''} = ${ans}`);
}

export function genD4(rng) {
  const d = int(rng, 2, 9), quot = int(rng, 2, 12), rem = int(rng, 1, d - 1);
  const n = quot * d + rem;
  return q(`rem:${n}/${d}`, 'D4', `${n} ÷ ${d}`, `${quot} r ${rem}`,
    `${d} × ${quot} = ${quot * d} fits. ${n} − ${quot * d} = ${rem} left over → ${quot} r ${rem}`);
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add src/generators/division.js tests/division.test.js
git commit -m "feat: division generators D1-D4"
```

---

### Task 8: Fractions generators (F1-F2)

**Files:**
- Create: `src/generators/fractions.js`, `tests/fractions.test.js`

- [ ] **Step 1: Write the failing test**

`tests/fractions.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../src/rng.js';
import { genF1, genF2 } from '../src/generators/fractions.js';

const FR = /^(\d+)\/(\d+) of (\d+)$/;
const parts = (q) => { const m = q.prompt.match(FR); assert.ok(m, q.prompt); return m.slice(1).map(Number); };

test('F1: unit fractions, amount divisible by denominator', () => {
  const rng = mulberry32(21);
  for (let i = 0; i < 400; i++) {
    const q = genF1(rng);
    const [num, den, amt] = parts(q);
    assert.equal(num, 1);
    assert.ok([2, 3, 4, 5, 6, 8, 10].includes(den));
    assert.equal(amt % den, 0);
    assert.ok(amt / den >= 2 && amt / den <= 12);
    assert.equal(Number(q.answer), amt / den);
    assert.equal(q.factId, `frac:1/${den}of${amt}`);
  }
});

test('F2: non-unit fractions, whole answers, method shows the unit step', () => {
  const rng = mulberry32(22);
  for (let i = 0; i < 400; i++) {
    const q = genF2(rng);
    const [num, den, amt] = parts(q);
    assert.ok(num >= 2 && num < den);
    assert.ok([3, 4, 5, 6, 8, 10].includes(den));
    assert.equal(amt % den, 0);
    assert.equal(Number(q.answer), (amt / den) * num);
    assert.equal(q.factId, `frac:${num}/${den}of${amt}`);
    assert.ok(q.methodLine.startsWith(`1/${den} of ${amt} = ${amt / den}`));
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL, cannot find module `src/generators/fractions.js`

- [ ] **Step 3: Implement**

`src/generators/fractions.js`:
```js
import { int, pick } from '../rng.js';

const q = (factId, rungId, prompt, answer, methodLine) =>
  ({ factId, rungId, prompt, answer: String(answer), prefix: '', suffix: '', methodLine });

export function genF1(rng) {
  const den = pick(rng, [2, 3, 4, 5, 6, 8, 10]);
  const unit = int(rng, 2, 12);
  const amt = den * unit;
  const line = den === 8
    ? `Halve three times: ${amt} → ${amt / 2} → ${amt / 4} → ${unit}`
    : den === 4 ? `Halve twice: ${amt} → ${amt / 2} → ${unit}` : `${amt} ÷ ${den} = ${unit}`;
  return q(`frac:1/${den}of${amt}`, 'F1', `1/${den} of ${amt}`, unit, line);
}

export function genF2(rng) {
  const den = pick(rng, [3, 4, 5, 6, 8, 10]);
  const num = int(rng, 2, den - 1);
  const unit = int(rng, 2, 12);
  const amt = den * unit;
  return q(`frac:${num}/${den}of${amt}`, 'F2', `${num}/${den} of ${amt}`, unit * num,
    `1/${den} of ${amt} = ${unit}, × ${num} = ${unit * num}`);
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add src/generators/fractions.js tests/fractions.test.js
git commit -m "feat: fractions-of-amounts generators F1-F2"
```

---

### Task 9: Percentage generators (P1-P7)

**Files:**
- Create: `src/num.js`, `src/generators/percent.js`, `tests/percent.test.js`
- Modify: `src/generators/division.js` (import `clean` from `src/num.js` instead of defining it)

- [ ] **Step 1: Move `clean` to a shared module**

`src/num.js`:
```js
/** Format a float without binary noise, e.g. 0.085 not 0.08499999. */
export const clean = (x) => String(Number(Number(x).toFixed(6)));
```

In `src/generators/division.js` replace the line `export const clean = ...` with `import { clean } from '../num.js';` (keep the other import). Run `npm test`; expected: all pass.

- [ ] **Step 2: Write the failing test**

`tests/percent.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../src/rng.js';
import { genP1, genP2, genP3, genP4, genP5, genP6, genP7 } from '../src/generators/percent.js';

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, msg ?? `${a} != ${b}`);
const OF = /^([\d.]+)% of (\d+)$/;

test('P1: only 50/25/10/1 and correct', () => {
  const rng = mulberry32(31);
  const seen = new Set();
  for (let i = 0; i < 400; i++) {
    const q = genP1(rng);
    const m = q.prompt.match(OF); assert.ok(m, q.prompt);
    const [p, b] = [Number(m[1]), Number(m[2])];
    seen.add(p);
    near(Number(q.answer), b * p / 100, q.prompt);
    assert.equal(q.factId, `pct:${p}%of${b}`);
    assert.equal(q.prefix, '');
  }
  assert.deepEqual([...seen].sort((a, b) => a - b), [1, 10, 25, 50]);
});

test('P2: built percentages on multiples of 20', () => {
  const rng = mulberry32(32);
  for (let i = 0; i < 400; i++) {
    const q = genP2(rng);
    const m = q.prompt.match(OF); assert.ok(m, q.prompt);
    const [p, b] = [Number(m[1]), Number(m[2])];
    assert.ok([5, 15, 20, 30, 40, 60, 70, 80, 90, 75, 2.5, 17.5].includes(p), `p=${p}`);
    assert.equal(b % 20, 0); assert.ok(b >= 20 && b <= 400);
    near(Number(q.answer), b * p / 100, q.prompt);
    assert.ok(q.methodLine.includes('10%') || q.methodLine.includes('50%'));
  }
});

test('P3: fraction→% conversions and %-of via fractions', () => {
  const rng = mulberry32(33);
  let conv = 0;
  for (let i = 0; i < 400; i++) {
    const q = genP3(rng);
    let m;
    if ((m = q.prompt.match(/^(\d+)\/(\d+) as a %$/))) {
      conv++;
      near(Number(q.answer), Number(m[1]) / Number(m[2]) * 100);
      assert.equal(q.suffix, '%');
      assert.equal(q.factId, `f2p:${m[1]}/${m[2]}`);
    } else {
      m = q.prompt.match(OF); assert.ok(m, q.prompt);
      near(Number(q.answer), Number(m[2]) * Number(m[1]) / 100);
      assert.equal(q.suffix, '');
      assert.ok(q.methodLine.includes('/'), q.methodLine);
    }
  }
  assert.ok(conv > 120 && conv < 280);
});

test('P4: increase/decrease in pounds', () => {
  const rng = mulberry32(34);
  for (let i = 0; i < 400; i++) {
    const q = genP4(rng);
    const m = q.prompt.match(/^(Increase|Reduce) £(\d+) by (\d+)%$/); assert.ok(m, q.prompt);
    const [b, p] = [Number(m[2]), Number(m[3])];
    const expected = m[1] === 'Increase' ? b * (1 + p / 100) : b * (1 - p / 100);
    near(Number(q.answer), expected, q.prompt);
    assert.equal(q.prefix, '£');
    assert.equal(q.factId, m[1] === 'Increase' ? `pctinc:${b}+${p}` : `pctdec:${b}-${p}`);
  }
});

test('P5: multipliers as numbers and applied', () => {
  const rng = mulberry32(35);
  let k = 0, applied = 0;
  for (let i = 0; i < 400; i++) {
    const q = genP5(rng);
    let m;
    if ((m = q.prompt.match(/^Multiplier for a (\d+)% (increase|decrease)$/))) {
      k++;
      const p = Number(m[1]);
      near(Number(q.answer), m[2] === 'increase' ? 1 + p / 100 : 1 - p / 100);
      assert.equal(q.prefix, '');
    } else {
      m = q.prompt.match(/^£(\d+) × ([\d.]+)$/); assert.ok(m, q.prompt);
      applied++;
      near(Number(q.answer), Number(m[1]) * Number(m[2]), q.prompt);
      assert.equal(q.prefix, '£');
    }
  }
  assert.ok(k > 120 && applied > 120);
});

test('P6: reverse percentages recover the original', () => {
  const rng = mulberry32(36);
  for (let i = 0; i < 400; i++) {
    const q = genP6(rng);
    const m = q.prompt.match(/^£(\d+) after (?:a )?(\d+)% (off|rise)\. Original price\?$/); assert.ok(m, q.prompt);
    const [sale, p] = [Number(m[1]), Number(m[2])];
    const orig = Number(q.answer);
    near(orig * (m[3] === 'off' ? 1 - p / 100 : 1 + p / 100), sale, q.prompt);
    assert.equal(q.prefix, '£');
    assert.equal(q.factId, `revpct:${sale}@${m[3] === 'off' ? 100 - p : 100 + p}`);
  }
});

test('P7: x out of y as a %, answers are whole or .5', () => {
  const rng = mulberry32(37);
  for (let i = 0; i < 400; i++) {
    const q = genP7(rng);
    const m = q.prompt.match(/^(\d+) out of (\d+) as a %$/); assert.ok(m, q.prompt);
    const [n, d] = [Number(m[1]), Number(m[2])];
    assert.ok(n >= 1 && n < d);
    near(Number(q.answer), n / d * 100);
    assert.equal((Number(q.answer) * 2) % 1, 0, q.answer);
    assert.equal(q.suffix, '%');
    assert.equal(q.factId, `outof:${n}/${d}`);
  }
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm test`
Expected: FAIL, cannot find module `src/generators/percent.js`

- [ ] **Step 4: Implement**

`src/generators/percent.js`:
```js
import { int, pick } from '../rng.js';
import { clean } from '../num.js';

const q = (factId, rungId, prompt, answer, methodLine, prefix = '', suffix = '') =>
  ({ factId, rungId, prompt, answer: clean(answer), prefix, suffix, methodLine });

const pctOf = (b, p) => Number(clean(b * p / 100));

// ---- P1: 50 / 25 / 10 / 1 ----
export function genP1(rng) {
  const p = pick(rng, [50, 25, 10, 1]);
  let b, line;
  if (p === 50) { b = int(rng, 11, 199); line = `Half of ${b} = ${clean(b / 2)}`; }
  else if (p === 25) { b = 4 * int(rng, 3, 100); line = `Halve twice: ${b} → ${b / 2} → ${b / 4}`; }
  else if (p === 10) { b = 5 * int(rng, 2, 180); line = `${b} ÷ 10 = ${clean(b / 10)}`; }
  else { b = 50 * int(rng, 1, 18); line = `${b} ÷ 100 = ${clean(b / 100)}`; }
  return q(`pct:${p}%of${b}`, 'P1', `${p}% of ${b}`, pctOf(b, p), line);
}

// ---- P2: built from blocks, base multiple of 20 ----
export function genP2(rng) {
  const p = pick(rng, [5, 15, 20, 30, 40, 60, 70, 80, 90, 75, 2.5, 17.5]);
  const b = 20 * int(rng, 1, 20);
  const ten = b / 10, a = pctOf(b, p);
  let line;
  if (p === 5) line = `10% = ${ten}, halve → ${a}`;
  else if (p === 15) line = `10% = ${ten}, 5% = ${ten / 2}, add → ${a}`;
  else if (p === 17.5) line = `10% = ${ten}, 5% = ${ten / 2}, 2.5% = ${clean(ten / 4)}, add → ${a}`;
  else if (p === 2.5) line = `10% = ${ten}, halve → ${ten / 2}, halve → ${a}`;
  else if (p === 75) line = `50% = ${b / 2}, 25% = ${b / 4}, add → ${a}`;
  else line = `10% of ${b} = ${ten}, × ${p / 10} = ${a}`;
  return q(`pct:${p}%of${b}`, 'P2', `${p}% of ${b}`, a, line);
}

// ---- P3: fractions <-> percentages ----
const FRACS = [[1, 2, 50], [1, 4, 25], [3, 4, 75], [1, 5, 20], [2, 5, 40], [3, 5, 60], [4, 5, 80],
  [1, 10, 10], [3, 10, 30], [7, 10, 70], [9, 10, 90], [1, 8, 12.5], [3, 8, 37.5], [5, 8, 62.5], [7, 8, 87.5]];

export function genP3(rng) {
  const [n, d, p] = pick(rng, FRACS);
  if (rng() < 0.5) {
    const unitPct = clean(100 / d);
    const line = d === 8
      ? `1/8 is half of 25% = 12.5%${n > 1 ? `, × ${n} = ${p}%` : ''}`
      : n === 1 ? `1/${d} = ${unitPct}%` : `1/${d} = ${unitPct}%, × ${n} = ${p}%`;
    return q(`f2p:${n}/${d}`, 'P3', `${n}/${d} as a %`, p, line, '', '%');
  }
  const unit = int(rng, 2, 12);
  const amt = d * unit;
  return q(`pctf:${p}%of${amt}`, 'P3', `${p}% of ${amt}`, unit * n,
    `${p}% = ${n}/${d}. ${amt} ÷ ${d} = ${unit}${n > 1 ? `, × ${n} = ${unit * n}` : ''}`);
}

// ---- P4: increase / decrease in £ ----
const BASES = [20, 40, 50, 60, 80, 120, 150, 200, 240, 300, 400];
export function genP4(rng) {
  const b = pick(rng, BASES), p = pick(rng, [5, 10, 15, 20, 25, 30, 50]);
  const part = pctOf(b, p);
  if (rng() < 0.5) {
    return q(`pctinc:${b}+${p}`, 'P4', `Increase £${b} by ${p}%`, b + part, `${p}% of ${b} = ${part}. ${b} + ${part} = ${clean(b + part)}`, '£');
  }
  return q(`pctdec:${b}-${p}`, 'P4', `Reduce £${b} by ${p}%`, b - part, `${p}% of ${b} = ${part}. ${b} − ${part} = ${clean(b - part)}`, '£');
}

// ---- P5: multipliers ----
export function genP5(rng) {
  const p = pick(rng, [5, 10, 15, 20, 25, 30, 40, 50]);
  const up = rng() < 0.5;
  const k = up ? 1 + p / 100 : 1 - p / 100;
  if (rng() < 0.5) {
    const line = up ? `100% + ${p}% = ${100 + p}% → ${clean(k)}` : `100% − ${p}% = ${100 - p}% → ${clean(k)}`;
    return q(`multk:${up ? 'up' : 'down'}${p}`, 'P5', `Multiplier for a ${p}% ${up ? 'increase' : 'decrease'}`, k, line);
  }
  const b = 20 * int(rng, 1, 20);
  const part = pctOf(b, p);
  const line = up
    ? `${b} × 1 = ${b}, ${b} × ${clean(p / 100)} = ${part}, total ${clean(b + part)}`
    : `× ${clean(k)} means ${100 - p}% left: ${b} − ${part} = ${clean(b - part)}`;
  return q(`multapply:${b}x${clean(k)}`, 'P5', `£${b} × ${clean(k)}`, b * k, line, '£');
}

// ---- P6: reverse percentages ----
export function genP6(rng) {
  const p = pick(rng, [10, 20, 25, 30, 40, 50]);
  const orig = 20 * int(rng, 1, 20);
  const off = rng() < 0.65;
  const r = off ? 100 - p : 100 + p;
  const sale = Number(clean(orig * r / 100));
  const prompt = off ? `£${sale} after ${p}% off. Original price?` : `£${sale} after a ${p}% rise. Original price?`;
  return q(`revpct:${sale}@${r}`, 'P6', prompt, orig, `£${sale} is ${r}%. 1% = ${clean(sale / r)}. 100% = £${orig}`, '£');
}

// ---- P7: n out of d as a % ----
export function genP7(rng) {
  const d = pick(rng, [5, 10, 20, 25, 40, 50, 200]);
  const n = int(rng, 1, d - 1);
  const a = n / d * 100;
  const line = d === 200 ? `200 → 100 is ÷ 2. ${n} ÷ 2 = ${clean(a)}%` : `${d} → 100 is × ${clean(100 / d)}. ${n} × ${clean(100 / d)} = ${clean(a)}%`;
  return q(`outof:${n}/${d}`, 'P7', `${n} out of ${d} as a %`, a, line, '', '%');
}
```

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add src/num.js src/generators/percent.js src/generators/division.js tests/percent.test.js
git commit -m "feat: percentage generators P1-P7"
```

---

### Task 10: Generator registry and cross-rung invariants

**Files:**
- Create: `src/generators/index.js`, `tests/generators.test.js`

- [ ] **Step 1: Write the failing test**

`tests/generators.test.js`:
```js
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
      // same fact id -> same prompt and answer
      const prev = byFact.get(q.factId);
      if (prev) assert.deepEqual([prev.prompt, prev.answer], [q.prompt, q.answer], q.factId);
      byFact.set(q.factId, q);
      // format flags on the rung must cover what the generator produces
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL, cannot find module `src/generators/index.js`

- [ ] **Step 3: Implement**

`src/generators/index.js`:
```js
import { genM1, genM2, genM3, genM4, genM5 } from './tables.js';
import { genM6, genM7, genM8 } from './multiples.js';
import { genD1, genD2, genD3, genD4 } from './division.js';
import { genF1, genF2 } from './fractions.js';
import { genP1, genP2, genP3, genP4, genP5, genP6, genP7 } from './percent.js';

const GENERATORS = {
  M1: genM1, M2: genM2, M3: genM3, M4: genM4, M5: genM5, M6: genM6, M7: genM7, M8: genM8,
  D1: genD1, D2: genD2, D3: genD3, D4: genD4,
  F1: genF1, F2: genF2,
  P1: genP1, P2: genP2, P3: genP3, P4: genP4, P5: genP5, P6: genP6, P7: genP7,
};

/** Produce one Question for a rung. rng: () => [0,1). */
export function generate(rungId, rng) {
  const g = GENERATORS[rungId];
  if (!g) throw new Error(`No generator for rung ${rungId}`);
  return g(rng);
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: all pass. If the decimals assertion fails for a rung, fix the **ladder format** for that rung (the generator is the source of truth about what it produces).

- [ ] **Step 5: Commit**

```bash
git add src/generators/index.js tests/generators.test.js
git commit -m "feat: generator registry with cross-rung contract tests"
```

---

### Task 11: Scheduler (unlocks, mastery, missed pile, session composition, target)

**Files:**
- Create: `src/scheduler.js`, `tests/scheduler.test.js`

All functions are pure: they never mutate the passed state; mutating ones return a `structuredClone`d copy.

- [ ] **Step 1: Write the failing test**

`tests/scheduler.test.js`:
```js
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

/** Record n correct then m wrong answers on rung id, each with a distinct fact. */
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
  let s = drill(emptyState(), 'M1', 2, 0);          // 2 correct first ...
  s = drill(s, 'M1', 18, 0, T0 + 100);              // ... then 18 more
  assert.equal(evaluateMastery(s, 'M1'), true);
  // 18 correct then 2 wrong: the two wrong facts are streak 0 -> blocked
  let b = drill(emptyState(), 'M1', 18, 2);
  assert.equal(rollingAccuracy(b, 'M1'), 0.9);
  assert.equal(evaluateMastery(b, 'M1'), false);
  // answer each wrong fact right once -> streak 1 -> no longer blocking (accuracy now 20/20 window anyway)
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
  s = drill(s, 'M2', 8, 2, T0 + 10);   // 80%
  s = drill(s, 'D1', 5, 5, T0 + 20);   // 50% -> weakest
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
  s = recordAnswer(s, { question: q('M2', 'M2:f1'), correct: true, input: '1', mode: 'learn', ts: T0 + 10 }); // f1 streak 1
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
```

Note: the composeSession test seeds three M3 misses with `generate`; M3 has only 22 distinct facts, so if the chosen seed happens to produce a duplicate factId the pile will have 2 entries and the test still passes (it needs at least 2). If it ever produces 1, change the seed.

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL, cannot find module `src/scheduler.js`

- [ ] **Step 3: Implement**

`src/scheduler.js`:
```js
import { RUNGS, RUNG_ORDER } from './ladder.js';
import { generate } from './generators/index.js';
import { pick, shuffle } from './rng.js';

export const WINDOW = 20;          // answers considered for accuracy
export const MASTERY = 0.9;        // 18/20
export const KEEP = 30;            // answers stored per rung
export const MISSED_CLEAR = 3;     // correct-in-a-row to leave the pile
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
  const a = rungState(state, id).answers.slice(-WINDOW);
  if (a.length < WINDOW) return false;
  const acc = a.reduce((n, x) => n + x.c, 0) / a.length;
  return acc >= MASTERY && blockingFacts(state, id).length === 0;
}

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
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add src/scheduler.js tests/scheduler.test.js
git commit -m "feat: scheduler with mastery, missed pile and session composition"
```

---

### Task 12: Stats (daily streak, sessions, speed PB, time totals)

**Files:**
- Create: `src/stats.js`, `tests/stats.test.js`

- [ ] **Step 1: Write the failing test**

`tests/stats.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, FAST_AVG_MS, SESSION_LEN } from '../src/scheduler.js';
import { dayKey, recordSession, secondsThisWeek, secondsAllTime, currentStreak } from '../src/stats.js';

const day = (d, h = 12) => new Date(2026, 9, d, h).getTime(); // October 2026, local time

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
  assert.equal(secondsThisWeek(s, day(16)), 90); // last 7 days
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL, cannot find module `src/stats.js`

- [ ] **Step 3: Implement**

`src/stats.js`:
```js
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
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add src/stats.js tests/stats.test.js
git commit -m "feat: streaks, session log, speed PB and time totals"
```

---

### Task 13: Store (localStorage, export/import codes)

**Files:**
- Create: `src/store.js`, `tests/store.test.js`

- [ ] **Step 1: Write the failing test**

`tests/store.test.js`:
```js
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL, cannot find module `src/store.js`

- [ ] **Step 3: Implement**

`src/store.js`:
```js
import { emptyState } from './scheduler.js';

export const STORAGE_KEY = 'mental-maths-v1';
const CODE_PREFIX = 'MM1.';

/** Load from a Storage-like object (defaults to window.localStorage). Always returns a complete state. */
export function load(storage = globalThis.localStorage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    return { ...emptyState(), ...parsed, streak: { ...emptyState().streak, ...(parsed.streak ?? {}) }, flags: { ...emptyState().flags, ...(parsed.flags ?? {}) } };
  } catch {
    return emptyState();
  }
}

export function save(storage = globalThis.localStorage, state) {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* quota or private mode: ignore */ }
}

// ---- export / import: JSON -> deflate-raw -> base64url, prefixed "MM1." ----
async function pipe(bytes, stream) {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

export async function exportCode(state) {
  const bytes = new TextEncoder().encode(JSON.stringify(state));
  const deflated = await pipe(bytes, new CompressionStream('deflate-raw'));
  return CODE_PREFIX + b64url(deflated);
}

/** Returns the decoded state, or null if the code is invalid. */
export async function importCode(code) {
  try {
    const s = String(code).trim();
    if (!s.startsWith(CODE_PREFIX)) return null;
    const inflated = await pipe(unb64url(s.slice(CODE_PREFIX.length)), new DecompressionStream('deflate-raw'));
    const parsed = JSON.parse(new TextDecoder().decode(inflated));
    if (!parsed || typeof parsed !== 'object' || !parsed.rungs) return null;
    return { ...emptyState(), ...parsed };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: all pass. (`CompressionStream`, `Blob`, `Response`, `btoa` are all globals in Node 24.)

- [ ] **Step 5: Commit**

```bash
git add src/store.js tests/store.test.js
git commit -m "feat: localStorage store with export/import codes"
```

---

### Task 14: Session runner (pure)

Drives one session from questions to summary without any DOM. `app.js` and the drill screen call this.

**Files:**
- Create: `src/session.js`, `tests/session.test.js`
- Modify: `src/scheduler.js` (add `composeSpeed`)

- [ ] **Step 1: Add `composeSpeed` to the scheduler**

Append to `src/scheduler.js`:
```js
/** Speed round: 10 distinct target questions, nothing else. */
export function composeSpeed(rungId, rng) {
  return distinct(rungId, rng, SESSION_LEN);
}
```

- [ ] **Step 2: Write the failing test**

`tests/session.test.js`:
```js
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
  // answer first question wrong, the rest right
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

  // bring M3 to 19 correct in the window, then one more correct inside a session -> newlyMastered
  let st = emptyState();
  for (let i = 0; i < WINDOW - 1; i++) st = recordAnswer(st, { question: { ...fact, factId: `M3:x${i}` }, correct: true, input: '1', mode: 'learn', ts: T0 + i });
  let sess = createSession(st, { rungId: 'M3', mode: 'learn' }, rng, T0 + 100);
  const q0 = currentQuestion(sess);
  const out = submitAnswer(sess, st, q0.answer, T0 + 101);
  assert.equal(isMastered(out.state, 'M3'), true);
  assert.equal(out.session.newlyMastered, true);
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm test`
Expected: FAIL, cannot find module `src/session.js`

- [ ] **Step 4: Implement**

`src/session.js`:
```js
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
```

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add src/session.js src/scheduler.js tests/session.test.js
git commit -m "feat: pure session runner"
```

---

### Task 15: App shell, design tokens and DOM helpers

**Before starting this task invoke `frontend-design:frontend-design`.** Visual direction, fixed by the spec and the brainstorm:

- Looks like a fitness or finance app, not a kids' app. No illustrations, mascots, emoji, sounds.
- One accent (blue). Status colours only on rung tiles: locked grey, learning blue, mastered green, fast gold.
- Large type with tabular numerals. The question prompt is the biggest thing on screen (clamp 2.4rem to 3.2rem). Keypad keys at least 60px tall. All tap targets ≥ 48px.
- Follows the phone's light/dark setting via `prefers-color-scheme`; tokens on `:root`, overridden in the dark block. Body always has an explicit background.
- Portrait, 390px primary width, max content width 480px centred on larger screens. Respect `env(safe-area-inset-*)`.
- Motion: a 120ms colour flash for correct, a 180ms slide-up for the wrong-answer panel. Nothing else animates except the speed bar.

**Files:**
- Create: `index.html`, `styles.css`, `src/ui.js`

- [ ] **Step 1: index.html**

```html
<!doctype html>
<html lang="en-GB">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
  <meta name="theme-color" content="#111318" media="(prefers-color-scheme: dark)">
  <meta name="theme-color" content="#f6f7f9" media="(prefers-color-scheme: light)">
  <meta name="color-scheme" content="light dark">
  <title>Mental Maths</title>
  <link rel="manifest" href="./manifest.webmanifest">
  <link rel="icon" href="./icons/icon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="./icons/icon-192.png">
  <link rel="stylesheet" href="./styles.css">
</head>
<body>
  <main id="app" aria-live="polite"></main>
  <script type="module" src="./src/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: styles.css**

Write the stylesheet following the direction above. It must define at least these class hooks, which the screens use:

```
.screen                 full-height column, padding 16px + safe areas, max-width 480px centred
.topbar                 row: back/close button left, title centre, action right
.btn, .btn-primary, .btn-ghost, .btn-wide   48px+ tall, 12px radius
.hint                   secondary text under the Continue button
.streak                 small chip
.track                  section with .track-title and .tiles (flex-wrap, 8px gap)
.tile                   min 72x56, radius 10px; modifiers .is-locked .is-learning .is-mastered .is-fast .is-bonus .needs-refresh
.card                   method card body; .card h2, .card p, .examples dl
.dots                   row of 8px dots; .dot, .dot.is-done, .dot.is-wrong, .dot.is-current, .dot.is-extra
.prompt                 the question, font-size clamp(2.4rem, 10vw, 3.2rem), tabular-nums, centred
.warmup-hint            small line under the prompt
.speedbar               4px track; .speedbar > i scales X from 1 to 0 via transform (JS sets --t)
.display                answer display row: .prefix .value .suffix, min-height 56px, big font
.keypad                 grid 4 columns, gap 8px; .key (60px+), .key-action, .key-go (accent), .key.hidden (visibility hidden)
.feedback               wrong-answer panel fixed to bottom, slides up: .feedback .answer (big), .feedback .method, .feedback .repeat
.flash-ok               120ms background flash on .display
.summary                centred score block: .score (huge), .meta, .missed-list, .banner
.progress-table         compact table; .pct cell right-aligned tabular
.code                   textarea for export/import, monospace, 100% width
```

Status colours (light / dark): locked `#9aa0a6 / #5c636b`, learning (accent) `#2f6bff / #6f93ff`, mastered `#1f9d6a / #3ccf91`, fast `#c99a1e / #ffc94d`. Backgrounds: light `#f6f7f9` page, `#ffffff` surface; dark `#111318` page, `#1a1d24` surface. Text: light `#14161a` / `#5b616b` secondary; dark `#eef0f3` / `#9aa3ad`.

- [ ] **Step 3: src/ui.js**

```js
/** h('div', { class: 'x', onclick: fn, 'data-id': 1 }, 'text', childEl, [more]) */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }

export function fmtSeconds(s) {
  s = Math.round(s);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), r = s % 60;
  if (m < 60) return r ? `${m}m ${r}s` : `${m}m`;
  const hh = Math.floor(m / 60), mm = m % 60;
  return mm ? `${hh}h ${mm}m` : `${hh}h`;
}

export const fmtDate = (ts) => new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
export const pct = (x) => (x == null ? '–' : `${Math.round(x * 100)}%`);
```

- [ ] **Step 4: Serve and eyeball the empty shell**

Run: `npm run serve` and open `http://localhost:8080` in Chrome with device toolbar at 390×844. Expected: a blank page in the right background colour, no console errors (app.js does not exist yet, so one 404 for it is fine).

- [ ] **Step 5: Commit**

```bash
git add index.html styles.css src/ui.js
git commit -m "feat: app shell, design tokens and DOM helpers"
```

---

### Task 16: App controller (state, router, install prompt)

**Files:**
- Create: `src/app.js`

Screens are modules exporting `render(root, ctx, params)`. `ctx` is the object below. Navigation is hash-free `history.pushState` so the Android back button walks back to Home.

- [ ] **Step 1: Implement**

`src/app.js`:
```js
import { load, save } from './store.js';
import { randomRng } from './rng.js';
import { createSession } from './session.js';
import { clear } from './ui.js';
import * as home from './screens/home.js';
import * as method from './screens/method.js';
import * as drill from './screens/drill.js';
import * as summary from './screens/summary.js';
import * as progress from './screens/progress.js';

const SCREENS = { home, method, drill, summary, progress };
const root = document.getElementById('app');

let state = load();
let session = null;      // live session object (src/session.js) or null
let lastSummary = null;  // result of summarize() for the summary screen
let installEvent = null; // deferred beforeinstallprompt

const ctx = {
  get state() { return state; },
  setState(next) { state = next; save(undefined, state); },
  get session() { return session; },
  setSession(s) { session = s; },
  get lastSummary() { return lastSummary; },
  setLastSummary(x) { lastSummary = x; },
  rng: randomRng,
  navigate,
  back() { history.back(); },
  /** Create and open a session. mode: learn | warmup | speed | weak */
  startSession({ rungId, mode }) {
    session = createSession(state, { rungId, mode }, randomRng, Date.now());
    navigate('drill', {}, { replace: mode === 'warmup' });
  },
  get canInstall() { return !!installEvent; },
  async install() {
    if (!installEvent) return;
    installEvent.prompt();
    await installEvent.userChoice.catch(() => {});
    installEvent = null;
    render(current());
  },
};

function current() { return history.state ?? { name: 'home', params: {} }; }

function navigate(name, params = {}, { replace = false } = {}) {
  const entry = { name, params };
  if (replace) history.replaceState(entry, '', location.pathname + location.search);
  else history.pushState(entry, '', location.pathname + location.search);
  render(entry);
}

function render(entry) {
  let { name, params } = entry;
  if (name === 'drill' && !session) { name = 'home'; params = {}; }      // reload mid-drill
  if (name === 'summary' && !lastSummary) { name = 'home'; params = {}; }
  clear(root);
  root.dataset.screen = name;
  SCREENS[name].render(root, ctx, params);
  window.scrollTo(0, 0);
}

window.addEventListener('popstate', () => render(current()));
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; if (current().name === 'home') render(current()); });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

history.replaceState({ name: 'home', params: {} }, '', location.pathname + location.search);
render(current());
```

- [ ] **Step 2: Temporary stub screens so the shell loads**

Create each of `src/screens/{home,method,drill,summary,progress}.js` with:
```js
export function render(root, ctx) { root.textContent = 'TODO'; }
```
Serve, open in Chrome at 390px: "TODO" renders, no console errors. These stubs are replaced in Tasks 17-21.

- [ ] **Step 3: Commit**

```bash
git add src/app.js src/screens
git commit -m "feat: app controller with router, state and install prompt"
```

---

### Task 17: Home screen

**Files:**
- Modify: `src/screens/home.js`

- [ ] **Step 1: Implement**

```js
import { h } from '../ui.js';
import { TRACKS, RUNGS } from '../ladder.js';
import { pickTarget, continueHint, rungLevel, needsRefresh, missedSorted, WEAK_SPOTS_MIN } from '../scheduler.js';
import { currentStreak } from '../stats.js';

export function render(root, ctx) {
  const { state } = ctx;
  const target = pickTarget(state);
  const streak = currentStreak(state);
  const pile = missedSorted(state).length;
  const isIOS = /iPhone|iPad/.test(navigator.userAgent) && !navigator.standalone;

  root.append(
    h('section', { class: 'screen home' },
      h('header', { class: 'topbar' },
        h('h1', {}, 'Mental Maths'),
        streak > 0 && h('span', { class: 'streak' }, `${streak}-day streak`),
      ),
      h('button', { class: 'btn btn-primary btn-wide continue', onclick: () => start(ctx, target) },
        h('span', { class: 'label' }, target.firstVisit ? 'Start' : 'Continue'),
        h('span', { class: 'hint' }, continueHint(state, target)),
      ),
      pile >= WEAK_SPOTS_MIN && h('button', { class: 'btn btn-ghost btn-wide', onclick: () => ctx.startSession({ rungId: 'weak', mode: 'weak' }) },
        `Weak spots`, h('span', { class: 'hint' }, `${pile} facts to clear`)),
      ctx.canInstall && !state.flags.installHintSeen && h('button', { class: 'btn btn-ghost btn-wide', onclick: () => ctx.install() }, 'Install on this phone'),
      isIOS && !state.flags.installHintSeen && h('p', { class: 'hint' }, 'Tap Share, then "Add to Home Screen" to install.'),
      ...TRACKS.map((t) => track(t, ctx)),
      h('footer', { class: 'home-footer' },
        h('button', { class: 'btn btn-ghost', onclick: () => ctx.navigate('progress') }, 'Progress'),
      ),
    ),
  );
}

function start(ctx, target) {
  if (target.firstVisit) ctx.navigate('method', { rungId: target.rungId, first: true });
  else ctx.startSession({ rungId: target.rungId, mode: target.mode });
}

function track(t, ctx) {
  const { state } = ctx;
  return h('section', { class: 'track' },
    h('h2', { class: 'track-title' }, t.title),
    h('div', { class: 'tiles' }, ...t.rungs.map((id) => tile(id, ctx))),
  );
}

function tile(id, ctx) {
  const r = RUNGS[id];
  const level = rungLevel(ctx.state, id);
  const cls = ['tile', `is-${level}`, r.bonus && 'is-bonus', needsRefresh(ctx.state, id) && 'needs-refresh'].filter(Boolean).join(' ');
  return h('button', {
    class: cls, 'aria-label': `${r.title}, ${level}`, disabled: level === 'locked',
    onclick: () => ctx.navigate('method', { rungId: id }),
  },
    h('span', { class: 'tile-short' }, r.short),
    r.bonus && h('span', { class: 'tile-tag' }, 'bonus'),
    needsRefresh(ctx.state, id) && h('span', { class: 'tile-tag' }, 'refresh'),
  );
}
```

Note: the Weak spots session passes `rungId: 'weak'`; `createSession` ignores `rungId` for mode `weak`, and `summarize` reports it as the rung label.

- [ ] **Step 2: Check in the browser**

Serve, open at 390px. Expected: title, a Start button with hint "New: Times 2, 5 and 10", four track rows, only M1 enabled, Progress link. Tapping M1 goes to a "TODO" method screen; back button returns Home.

- [ ] **Step 3: Commit**

```bash
git add src/screens/home.js
git commit -m "feat: home screen"
```

---

### Task 18: Method card screen

**Files:**
- Modify: `src/screens/method.js`

- [ ] **Step 1: Implement**

```js
import { h } from '../ui.js';
import { RUNGS } from '../ladder.js';
import { isUnlocked, isMastered, isStarted, markVisited } from '../scheduler.js';

/** params: { rungId, first?: boolean, fromDrill?: boolean } */
export function render(root, ctx, { rungId, first = false, fromDrill = false }) {
  const r = RUNGS[rungId];
  const { state } = ctx;
  const unlocked = isUnlocked(state, rungId);
  const started = isStarted(state, rungId);

  const actions = [];
  if (fromDrill) {
    actions.push(h('button', { class: 'btn btn-primary btn-wide', onclick: () => ctx.back() }, 'Back to questions'));
  } else if (unlocked) {
    if (!started || first) {
      actions.push(h('button', { class: 'btn btn-primary btn-wide', onclick: () => { ctx.setState(markVisited(state, rungId, Date.now())); ctx.startSession({ rungId, mode: 'warmup' }); } }, 'Start warm-up'));
    } else {
      actions.push(h('button', { class: 'btn btn-primary btn-wide', onclick: () => ctx.startSession({ rungId, mode: 'learn' }) }, 'Practise'));
      if (isMastered(state, rungId)) actions.push(h('button', { class: 'btn btn-ghost btn-wide', onclick: () => ctx.startSession({ rungId, mode: 'speed' }) }, 'Speed round'));
    }
  } else {
    const need = r.requires.filter((p) => !isMastered(state, p)).map((p) => RUNGS[p].short).join(', ');
    actions.push(h('p', { class: 'hint' }, `Unlocks after: ${need}`));
  }

  root.append(
    h('section', { class: 'screen method' },
      h('header', { class: 'topbar' },
        h('button', { class: 'btn btn-ghost icon', 'aria-label': 'Back', onclick: () => ctx.back() }, '‹'),
        h('h1', {}, r.title),
        h('span'),
      ),
      h('article', { class: 'card' },
        ...r.method.lines.map((l) => h('p', {}, l)),
        h('h2', {}, 'Try these'),
        h('dl', { class: 'examples' }, ...r.method.examples.flatMap((e) => [h('dt', {}, e.q), h('dd', {}, e.a)])),
      ),
      h('div', { class: 'actions' }, ...actions),
    ),
  );
}
```

- [ ] **Step 2: Check in the browser**

From Home tap M1: title, three method lines, two examples, "Start warm-up". Tap a locked tile: not clickable (disabled). Back returns Home.

- [ ] **Step 3: Commit**

```bash
git add src/screens/method.js
git commit -m "feat: method card screen"
```

---

### Task 19: Drill screen (keypad, feedback, speed bar)

**Files:**
- Modify: `src/screens/drill.js`

- [ ] **Step 1: Implement**

```js
import { h, clear } from '../ui.js';
import { RUNGS } from '../ladder.js';
import { formatAnswer, autoSubmitLength } from '../answer.js';
import { currentQuestion, submitAnswer, isDone, summarize } from '../session.js';
import { recordSession } from '../stats.js';
import { SPEED_LIMIT_MS } from '../scheduler.js';

export function render(root, ctx) {
  const view = { root, ctx, input: '', timer: null, raf: null, locked: false };
  draw(view);
}

function draw(view) {
  const { root, ctx } = view;
  const s = ctx.session;
  if (isDone(s)) return finish(view);

  const q = currentQuestion(s);
  const rung = RUNGS[q.rungId];
  const sessionRung = s.mode === 'weak' ? null : RUNGS[s.rungId];
  const fmt = sessionRung?.format ?? { decimals: true, remainder: true };
  const showDot = fmt.decimals || /\./.test(q.answer);
  const showR = fmt.remainder || / r /.test(q.answer);
  const title = s.mode === 'weak' ? 'Weak spots' : s.mode === 'warmup' ? `Warm-up · ${sessionRung.short}` : s.mode === 'speed' ? `Speed · ${sessionRung.short}` : sessionRung.short;

  clear(root);
  const display = h('div', { class: 'display' },
    h('span', { class: 'prefix' }, q.prefix), h('span', { class: 'value' }, view.input || ' '), h('span', { class: 'suffix' }, q.suffix));

  const key = (label, onpress, cls = '') => h('button', { class: `key ${cls}`.trim(), onclick: () => !view.locked && onpress() }, label);
  const digit = (d) => key(String(d), () => type(view, String(d), q));

  root.append(
    h('section', { class: 'screen drill' },
      h('header', { class: 'topbar' },
        h('button', { class: 'btn btn-ghost icon', 'aria-label': 'Quit', onclick: () => quit(view) }, '×'),
        h('span', { class: 'title' }, title),
        h('button', { class: 'btn btn-ghost icon', 'aria-label': 'Show method', onclick: () => { stopTimer(view); ctx.navigate('method', { rungId: q.rungId, fromDrill: true }); } }, '?'),
      ),
      dots(s),
      h('div', { class: 'question' },
        h('p', { class: 'prompt' }, q.prompt),
        s.mode === 'warmup' && h('p', { class: 'warmup-hint' }, rung.method.lines[0]),
        s.mode === 'speed' && h('div', { class: 'speedbar' }, h('i')),
      ),
      display,
      h('div', { class: 'keypad' },
        digit(1), digit(2), digit(3), key('⌫', () => { view.input = view.input.slice(0, -1); refresh(view); }, 'key-action'),
        digit(4), digit(5), digit(6), key('.', () => type(view, '.', q), `key-action ${showDot ? '' : 'hidden'}`),
        digit(7), digit(8), digit(9), key('r', () => type(view, ' r ', q), `key-action ${showR ? '' : 'hidden'}`),
        key('0', () => type(view, '0', q), 'key-zero'), key('Go', () => submit(view, q), 'key-go'),
      ),
    ),
  );
  view.display = display;
  if (s.mode === 'speed') startTimer(view, q);
}

function dots(s) {
  const nodes = [];
  for (let i = 0; i < s.questions.length; i++) {
    const r = s.results[i];
    const cls = ['dot', i === s.index && 'is-current', r && (r.correct ? 'is-done' : 'is-wrong'), i >= s.baseCount && 'is-extra'].filter(Boolean).join(' ');
    nodes.push(h('i', { class: cls }));
  }
  return h('div', { class: 'dots' }, ...nodes);
}

function type(view, ch, q) {
  if (ch === '.' && view.input.includes('.')) return;
  if (ch === ' r ' && (view.input.includes(' r ') || view.input === '')) return;
  if (view.input.length >= 8) return;
  view.input += ch;
  refresh(view);
  const n = autoSubmitLength(q.answer);
  if (n != null && view.input.length === n) submit(view, q);
}

function refresh(view) {
  view.display.querySelector('.value').textContent = view.input || ' ';
}

function startTimer(view, q) {
  const start = performance.now();
  const bar = view.root.querySelector('.speedbar > i');
  const tick = () => {
    const t = Math.max(0, 1 - (performance.now() - start) / SPEED_LIMIT_MS);
    if (bar) bar.style.transform = `scaleX(${t})`;
    if (t > 0) view.raf = requestAnimationFrame(tick);
  };
  view.raf = requestAnimationFrame(tick);
  view.timer = setTimeout(() => submit(view, q, { timeout: true }), SPEED_LIMIT_MS);
}

function stopTimer(view) {
  clearTimeout(view.timer); cancelAnimationFrame(view.raf);
  view.timer = view.raf = null;
}

function submit(view, q, { timeout = false } = {}) {
  if (view.locked) return;
  if (!timeout && view.input.trim() === '') return;
  view.locked = true;
  stopTimer(view);
  const { ctx } = view;
  const res = submitAnswer(ctx.session, ctx.state, view.input, Date.now(), { timeout });
  ctx.setState(res.state);
  ctx.setSession(res.session);
  view.input = '';

  if (res.correct) {
    view.display.classList.add('flash-ok');
    setTimeout(() => { view.locked = false; draw(view); }, 350);
    return;
  }
  const answer = formatAnswer(q.answer, q.prefix, q.suffix);
  const panel = h('div', { class: 'feedback' },
    h('p', { class: 'answer' }, timeout ? `Time's up · ${answer}` : answer),
    res.repeatWrong && h('p', { class: 'repeat' }, `You put ${res.session.results.at(-1).input} last time too.`),
    h('p', { class: 'method' }, `${q.prompt}: ${q.methodLine}`),
    h('div', { class: 'actions' },
      h('button', { class: 'btn btn-primary btn-wide', onclick: () => { view.locked = false; draw(view); } }, 'Got it'),
      h('button', { class: 'btn btn-ghost btn-wide', onclick: () => ctx.navigate('method', { rungId: q.rungId, fromDrill: true }) }, 'Show method'),
    ),
  );
  view.root.querySelector('.drill').append(panel);
  requestAnimationFrame(() => panel.classList.add('is-open'));
}

function finish(view) {
  const { ctx } = view;
  const s = ctx.session;
  const sum = summarize(s, Date.now());
  if (s.mode !== 'warmup') ctx.setState(recordSession(ctx.state, { ts: Date.now(), rung: s.rungId, score: sum.score, seconds: sum.seconds, speed: sum.speed }));
  ctx.setLastSummary(sum);
  ctx.setSession(null);
  ctx.navigate('summary', {}, { replace: true });
}

function quit(view) {
  stopTimer(view);
  view.ctx.setSession(null);
  view.ctx.navigate('home', {}, { replace: true });
}
```

Note: `finish` passes `'weak'` as the rung for Weak-spots sessions; `recordSession` only touches rung stats when `speed` is true, which it never is for Weak spots, so this is safe.

- [ ] **Step 2: Check in the browser**

From Home → M1 → Start warm-up: 6 dots, prompt, first method line under it, keypad without `.`/`r`. Type a two-digit correct answer: auto-submits, flashes, next question. Type a wrong one: panel slides up with the answer and method, "Got it" continues, dot count grows by one. Finish → lands on "TODO" summary.

- [ ] **Step 3: Commit**

```bash
git add src/screens/drill.js
git commit -m "feat: drill screen with keypad, feedback panel and speed bar"
```

---

### Task 20: Session summary screen

**Files:**
- Modify: `src/screens/summary.js`

- [ ] **Step 1: Implement**

```js
import { h, fmtSeconds } from '../ui.js';
import { RUNGS } from '../ladder.js';
import { formatAnswer } from '../answer.js';
import { pickTarget, rungState } from '../scheduler.js';

export function render(root, ctx) {
  const sum = ctx.lastSummary;
  const { state } = ctx;
  const rung = sum.mode === 'weak' ? null : RUNGS[sum.rungId];
  const title = sum.mode === 'weak' ? 'Weak spots' : sum.mode === 'warmup' ? `Warm-up done` : rung.title;
  const pb = rung ? rungState(state, sum.rungId).speed_pb : null;
  const isPB = sum.speed && sum.score === sum.total && pb === sum.seconds;
  const nudge = sum.newlyMastered && !state.flags.speedNudgeSeen.includes(sum.rungId);

  const next = () => {
    if (nudge) { const s = structuredClone(state); s.flags.speedNudgeSeen.push(sum.rungId); ctx.setState(s); }
    ctx.setLastSummary(null);
    ctx.navigate('home', {}, { replace: true });
  };
  const again = () => ctx.startSession({ rungId: sum.rungId, mode: sum.mode === 'warmup' ? 'learn' : sum.mode });
  // After a warm-up the primary action goes straight into a learn session on the same rung.
  const primary = sum.mode === 'warmup'
    ? () => { ctx.setLastSummary(null); ctx.startSession({ rungId: sum.rungId, mode: 'learn' }); }
    : next;

  root.append(
    h('section', { class: 'screen summary' },
      h('header', { class: 'topbar' }, h('span'), h('span', { class: 'title' }, title), h('span')),
      h('p', { class: 'score' }, `${sum.score}`, h('small', {}, `/${sum.total}`)),
      h('p', { class: 'meta' }, fmtSeconds(sum.seconds), sum.speed && pb != null && ` · best ${fmtSeconds(pb)}`, isPB && ' · new best'),
      sum.newlyMastered && h('div', { class: 'banner' },
        h('strong', {}, `${rung.title} mastered.`),
        nudge && h('p', {}, 'Speed round unlocked. Same questions, five seconds each.'),
        nudge && h('button', { class: 'btn btn-primary btn-wide', onclick: () => { const s = structuredClone(state); s.flags.speedNudgeSeen.push(sum.rungId); ctx.setState(s); ctx.startSession({ rungId: sum.rungId, mode: 'speed' }); } }, 'Try a speed round'),
      ),
      sum.missed.length > 0 && h('section', { class: 'missed-list' },
        h('h2', {}, sum.mode === 'warmup' ? 'Worth another look' : 'Added to weak spots'),
        h('ul', {}, ...sum.missed.map((q) => h('li', {}, h('span', { class: 'q' }, q.prompt), h('span', { class: 'a' }, formatAnswer(q.answer, q.prefix, q.suffix))))),
      ),
      h('div', { class: 'actions' },
        h('button', { class: 'btn btn-primary btn-wide', onclick: primary }, sum.mode === 'warmup' ? 'Start practising' : 'Next'),
        h('button', { class: 'btn btn-ghost btn-wide', onclick: again }, sum.mode === 'warmup' ? 'Another warm-up' : 'Again'),
      ),
    ),
  );
}
```

- [ ] **Step 2: Check in the browser**

Complete a warm-up: "Warm-up done", score, "Start practising" starts a 10-question learn session. Complete that: "Next" returns Home; Continue hint now shows "x/20 so far".

- [ ] **Step 3: Commit**

```bash
git add src/screens/summary.js
git commit -m "feat: session summary screen"
```

---

### Task 21: Progress screen (stats, weak spots, export/import)

**Files:**
- Modify: `src/screens/progress.js`

- [ ] **Step 1: Implement**

```js
import { h, fmtSeconds, fmtDate, pct } from '../ui.js';
import { TRACKS, RUNGS } from '../ladder.js';
import { rungState, rungLevel, rollingAccuracy, missedSorted } from '../scheduler.js';
import { currentStreak, secondsThisWeek, secondsAllTime } from '../stats.js';
import { exportCode, importCode } from '../store.js';
import { formatAnswer } from '../answer.js';

export function render(root, ctx) {
  const { state } = ctx;
  const pile = missedSorted(state);

  root.append(
    h('section', { class: 'screen progress' },
      h('header', { class: 'topbar' },
        h('button', { class: 'btn btn-ghost icon', 'aria-label': 'Back', onclick: () => ctx.back() }, '‹'),
        h('h1', {}, 'Progress'),
        h('span'),
      ),
      h('div', { class: 'stat-row' },
        stat(`${currentStreak(state)}`, 'day streak'),
        stat(fmtSeconds(secondsThisWeek(state)), 'this week'),
        stat(fmtSeconds(secondsAllTime(state)), 'all time'),
      ),
      ...TRACKS.map((t) => h('section', { class: 'track' },
        h('h2', { class: 'track-title' }, t.title),
        h('table', { class: 'progress-table' },
          h('thead', {}, h('tr', {}, h('th', {}, 'Skill'), h('th', {}, 'Status'), h('th', { class: 'pct' }, 'Acc.'), h('th', { class: 'pct' }, 'Done'), h('th', {}, 'Best'))),
          h('tbody', {}, ...t.rungs.map((id) => row(id, state))),
        ),
      )),
      h('section', { class: 'weak' },
        h('h2', {}, `Weak spots (${pile.length})`),
        pile.length === 0 ? h('p', { class: 'hint' }, 'Nothing outstanding.')
          : h('ul', {}, ...pile.map((m) => h('li', {},
            h('span', { class: 'q' }, m.q.prompt), h('span', { class: 'a' }, formatAnswer(m.q.answer, m.q.prefix, m.q.suffix)),
            h('span', { class: 'streak-dots' }, '●'.repeat(m.streak) + '○'.repeat(3 - m.streak))))),
      ),
      backup(ctx),
    ),
  );
}

const stat = (value, label) => h('div', { class: 'stat' }, h('strong', {}, value), h('span', {}, label));

function row(id, state) {
  const r = rungState(state, id), level = rungLevel(state, id);
  return h('tr', { class: `is-${level}` },
    h('td', {}, RUNGS[id].short),
    h('td', {}, level === 'mastered' && r.mastered_at ? `mastered ${fmtDate(r.mastered_at)}` : level),
    h('td', { class: 'pct' }, pct(rollingAccuracy(state, id))),
    h('td', { class: 'pct' }, String(r.total)),
    h('td', {}, r.speed_pb != null ? fmtSeconds(r.speed_pb) : '–'),
  );
}

function backup(ctx) {
  const out = h('textarea', { class: 'code', readonly: true, rows: 3, placeholder: 'Your backup code will appear here' });
  const inp = h('textarea', { class: 'code', rows: 3, placeholder: 'Paste a backup code' });
  const status = h('p', { class: 'hint' });
  let pending = null;

  const doExport = async () => {
    out.value = await exportCode(ctx.state);
    try { await navigator.clipboard.writeText(out.value); status.textContent = 'Copied to clipboard.'; }
    catch { status.textContent = 'Long-press the code to copy it.'; }
  };
  const confirmBtn = h('button', { class: 'btn btn-primary btn-wide hidden', onclick: () => { ctx.setState(pending); pending = null; status.textContent = 'Progress restored.'; ctx.navigate('progress', {}, { replace: true }); } }, 'Yes, replace everything');
  const doImport = async () => {
    const parsed = await importCode(inp.value);
    if (!parsed) { status.textContent = 'That code is not valid.'; return; }
    pending = parsed;
    status.textContent = 'This will replace all progress on this phone.';
    confirmBtn.classList.remove('hidden');
  };

  return h('section', { class: 'backup' },
    h('h2', {}, 'Backup'),
    h('p', { class: 'hint' }, 'Progress is stored on this phone. Export a code to move it to another phone.'),
    h('button', { class: 'btn btn-ghost btn-wide', onclick: doExport }, 'Export code'),
    out,
    inp,
    h('button', { class: 'btn btn-ghost btn-wide', onclick: doImport }, 'Import code'),
    confirmBtn,
    status,
  );
}
```

- [ ] **Step 2: Check in the browser**

Open Progress: three stats, four tables, weak spots list matching what you missed, Export produces a code starting `MM1.`; paste it into Import → confirm → page re-renders with the same data. Paste junk → "not valid".

- [ ] **Step 3: Commit**

```bash
git add src/screens/progress.js
git commit -m "feat: progress screen with weak spots and backup codes"
```

---

### Task 22: PWA: manifest, icons, service worker

**Files:**
- Create: `manifest.webmanifest`, `sw.js`, `icons/icon.svg`, `icons/icon-192.png`, `icons/icon-512.png`, `scripts/make-icons.py`, `.nojekyll`

- [ ] **Step 1: manifest.webmanifest**

```json
{
  "name": "Mental Maths",
  "short_name": "Maths",
  "description": "Times tables, division and percentages in your head.",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#111318",
  "theme_color": "#2f6bff",
  "icons": [
    { "src": "./icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "./icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "./icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 2: icons/icon.svg and the PNG renderer**

`icons/icon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#2f6bff"/>
  <g stroke="#ffffff" stroke-width="56" stroke-linecap="round">
    <line x1="168" y1="168" x2="344" y2="344"/>
    <line x1="344" y1="168" x2="168" y2="344"/>
  </g>
</svg>
```

`scripts/make-icons.py` (PIL is installed; draws the same mark, no SVG library needed):
```python
#!/usr/bin/env python3
"""Render icons/icon-192.png and icons/icon-512.png: blue rounded square with a white multiplication cross."""
from PIL import Image, ImageDraw

def make(size):
    s = 4  # supersample for smooth edges
    img = Image.new("RGBA", (512 * s, 512 * s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, 512 * s - 1, 512 * s - 1], radius=112 * s, fill=(47, 107, 255, 255))
    w = 56 * s
    d.line([(168 * s, 168 * s), (344 * s, 344 * s)], fill="white", width=w)
    d.line([(344 * s, 168 * s), (168 * s, 344 * s)], fill="white", width=w)
    for (x, y) in [(168, 168), (344, 344), (344, 168), (168, 344)]:
        d.ellipse([(x * s - w // 2, y * s - w // 2), (x * s + w // 2, y * s + w // 2)], fill="white")
    img.resize((size, size), Image.LANCZOS).save(f"icons/icon-{size}.png")

for n in (192, 512):
    make(n)
print("icons written")
```

Run: `python3 -I scripts/make-icons.py` from the project root. Expected: `icons written`, two PNGs exist.

- [ ] **Step 3: sw.js**

```js
// Precache everything; serve cache-first; navigations fall back to index.html.
// Bump CACHE on every deploy that changes any asset (Task 23 Step 4 explains how).
const CACHE = 'mental-maths-v1';
const ASSETS = [
  './', './index.html', './styles.css', './manifest.webmanifest',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
  './src/app.js', './src/ui.js', './src/rng.js', './src/num.js', './src/answer.js', './src/ladder.js',
  './src/scheduler.js', './src/stats.js', './src/store.js', './src/session.js',
  './src/generators/index.js', './src/generators/tables.js', './src/generators/multiples.js',
  './src/generators/division.js', './src/generators/fractions.js', './src/generators/percent.js',
  './src/screens/home.js', './src/screens/method.js', './src/screens/drill.js', './src/screens/summary.js', './src/screens/progress.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok && new URL(e.request.url).origin === location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => (e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error()))),
  );
});
```

- [ ] **Step 4: .nojekyll**

Create an empty `.nojekyll` at the project root so GitHub Pages serves files as-is.

- [ ] **Step 5: Verify installability locally**

Serve, open Chrome DevTools → Application → Manifest: no errors, icons shown. Application → Service workers: registered, activated. Network → Offline: reload; the app still loads and a drill works.

- [ ] **Step 6: Commit**

```bash
git add manifest.webmanifest sw.js icons scripts/make-icons.py .nojekyll
git commit -m "feat: installable offline PWA"
```

---

### Task 23: Deploy to GitHub Pages

**Files:**
- Create: `README.md`

- [ ] **Step 1: README.md**

```markdown
# Mental Maths

Phone-first mental arithmetic trainer: times tables, division, fractions of amounts, percentages.
Mastery first, then speed. No accounts; progress lives on the phone (export a backup code from Progress).

Live: https://chrisbeok-blip.github.io/mental-maths/

## Develop
- `npm test` runs the engine tests (Node 24, no dependencies).
- `npm run serve` serves on http://localhost:8080.
- Pushing to `main` deploys to GitHub Pages. After changing any file under `src/`, `styles.css` or `index.html`, bump `CACHE` in `sw.js` so installed phones pick up the new version.

Design: `docs/superpowers/specs/2026-10-16-mental-maths-design.md`.
```

- [ ] **Step 2: Create the repo and push**

```bash
cd /home/chris/mental-maths
git add README.md && git commit -m "docs: readme"
gh repo create chrisbeok-blip/mental-maths --public --source=. --remote=origin --push
```
Expected: repo URL printed, `main` pushed.

- [ ] **Step 3: Enable Pages from main, root**

```bash
gh api -X POST repos/chrisbeok-blip/mental-maths/pages -f build_type=legacy -f "source[branch]=main" -f "source[path]=/"
```
Expected: JSON with `"status": "building"` or similar. Then poll until built:
```bash
for i in $(seq 1 20); do s=$(gh api repos/chrisbeok-blip/mental-maths/pages --jq .status); echo "$s"; [ "$s" = "built" ] && break; sleep 15; done
curl -sI https://chrisbeok-blip.github.io/mental-maths/ | head -1
```
Expected: `HTTP/2 200`.

- [ ] **Step 4: Cache-busting rule (document, then follow)**

Every later deploy that changes an asset must bump `const CACHE = 'mental-maths-vN'` in `sw.js`, otherwise phones that installed the app keep the old files until the SW notices a byte change. Add this as a line in the README (already in Step 1).

- [ ] **Step 5: Commit nothing further; verify in a real phone browser**

Open the live URL on the Android phone in Chrome. Expected: Home renders; Chrome shows the install affordance (menu → "Install app" or the in-page "Install on this phone" button).

---

### Task 24: Manual verification on the phone

No code. Walk this checklist on the Android phone with the installed app and fix anything that fails (each fix is its own small commit, with a `sw.js` cache bump before pushing).

- [ ] Install from Chrome; the app opens full-screen with the blue × icon.
- [ ] Turn on flight mode; the app still opens and a drill runs.
- [ ] Home → Start → method card → warm-up (6 questions, hint under prompt) → summary → "Start practising" → 10-question session → summary → Next.
- [ ] Wrong answer: panel slides up, correct answer and method readable at arm's length, "Got it" continues, the fact is re-asked later in the same session.
- [ ] Miss the same fact twice with the same wrong answer: "You put … last time too." appears.
- [ ] Decimal key only appears on D1/D3/F/P rungs; `r` key only on D4; £ prefix on P4-P6 money questions; % suffix on "as a %" questions.
- [ ] Auto-submit fires on integer answers when the length matches; never fires on decimal or remainder rungs.
- [ ] Reach mastery on M1 (about 3-4 sessions): banner appears, M2 and D1 tiles unlock, speed nudge shows once.
- [ ] Speed round: bar shrinks over 5 s; timeout shows "Time's up"; 10/10 records a best time on Progress; no weak spots added from speed rounds.
- [ ] Weak spots button appears with 3+ facts and drills only those.
- [ ] Android back button: from method/drill/progress returns Home; from Home exits the app.
- [ ] Progress: export code copies; import on a second browser profile restores the same tiles.
- [ ] Dark and light themes both readable; keypad usable one-handed with the thumb.

---

## Deviations during execution (2026-10-16)

- `sw.js` returns early for cross-origin requests. Intercepting every GET broke the Chrome extension's own script injection during testing and would do the same to any extension on the phone.
- The Progress screen renders each skill as a two-line list item (name and status, then "90% right, 24 answered, best 32s") instead of a five-column table. The table overflowed at 390 px.
- `tableMethod(a, 10)` reads "Shift 7 up one place = 70" so the feedback panel's "7 × 10: …" prefix is not repeated.
- The drill layout gives the question block the free vertical space (`flex: 1`) so the answer box sits directly above the keypad.
- Visual QA was done with headless Chrome over the DevTools protocol at 390×844 in both colour schemes (driver script kept in the session scratchpad, not the repo). Task 24 (real-phone checklist) remains for Chris.
