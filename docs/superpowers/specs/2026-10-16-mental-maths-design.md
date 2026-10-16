# Mental Maths — Design

**Date:** 2026-10-16
**Status:** Approved design, awaiting implementation plan

## Purpose

A phone-first web app to help a 16-year-old studying GCSE maths fill gaps in
basic arithmetic (times tables, division, percentages, simple fractions) and
then build speed at doing them in his head. He missed early-years foundations
due to speech delays but learns quickly once shown a method, so the content
starts at primary level and accelerates to GCSE non-calculator level.

Design priorities, in order:

1. **Fill the gaps.** Mastery before speed. The app remembers exactly which
   facts he gets wrong and keeps bringing them back until they stick.
2. **Then speed.** Timed drills unlock per skill only after mastery, so being
   slow never blocks learning.
3. **Feels built for a 16-year-old.** Clean, adult tone. Looks like a fitness
   tracker, not a kids' app. No cartoons, mascots, sounds or confetti.
4. **Zero friction.** Sessions under two minutes. One tap to start. Installable
   to the home screen, works offline, no accounts, free to host.

## Non-goals

- No backend, accounts or cross-device sync. Progress lives in the phone's
  browser storage with an export/import code as backup.
- No native app. A home-screen web app is sufficient.
- No leaderboards, badges collections, or full game layer.
- Not a general GCSE revision tool. Scope is mental arithmetic only.

## Curriculum: the skill ladder

The app is a set of **tracks**, each a ladder of **rungs** (skills). A rung is
unlocked by mastering its prerequisites. Every rung has a one-screen **method
card** with two worked examples.

### Multiplication track

| # | Rung | Method card gist |
|---|------|------------------|
| M1 | x2, x5, x10 | Double; count in fives / half then x10; add a zero |
| M2 | x4, x3, x6 | x4 = double twice; x3 = double + one more; x6 = x3 then double |
| M3 | x9, x8 | x9 = x10 minus one lot; x8 = double x4 |
| M4 | x7, x11, x12 | x7 = x5 + x2; x11 = x10 + one lot; x12 = x10 + x2 |
| M5 | Mixed tables + reverse | All tables 2-12 in random order, incl. "? x 7 = 56". Method card teaches the reverse strategy explicitly: start from a known fact (7 x 7 = 49) and step up/down |
| M6 | x10, x100, x1000 and multiples of ten | Shift digits; 6 x 40 = 6 x 4 then x10 |
| M7 | Two-digit x one-digit by splitting | 23 x 4 = 20x4 + 3x4 = 80 + 12 = 92 |
| M8 | Two-digit tricks (bonus) | x11 (digit sum trick), x25 (quarter then x100), near-square pairs e.g. 19 x 21 = 400 - 1. Optional: nothing depends on it and it is shown last, marked "bonus" |

Prerequisites: each rung requires the previous one. M5 requires M1-M4.

### Division track

Halving (D3) unlocks early because percentages need it; the rest waits for
full table mastery, since division is the inverse of multiplication.

| # | Rung | Method card gist |
|---|------|------------------|
| D1 | Halving and quartering | 46 ÷ 2 = 23; 68 ÷ 4 = halve twice; odd numbers give .5 |
| D2 | Reverse tables | 56 ÷ 7: "what times 7 is 56?" |
| D3 | ÷10, ÷100, ÷1000 | Shift digits left; 450 ÷ 10 = 45; 7 ÷ 10 = 0.7 |
| D4 | Simple remainders | 23 ÷ 5 = 4 r 3 |

Prerequisites: D1 requires M1; D2 requires M5; D3 requires D2 and M6;
D4 requires D2.

### Fractions track

Unlocks when D1 (halving) is mastered. Deliberately small: fractions *of
amounts* only, because that is the mental skill percentages are built on.
Fraction arithmetic (adding, multiplying fractions) is out of scope.

| # | Rung | Method card gist |
|---|------|------------------|
| F1 | Unit fractions of amounts | 1/4 of 60: divide by 4 = 15; 1/5 of 40 = 8; 1/8 = halve three times |
| F2 | Non-unit fractions of amounts | 3/5 of 40: find 1/5 (8), then x3 = 24 |

Prerequisites: F1 requires D1 and M3; F2 requires F1 and M5.

### Percentage track

Unlocks when M3 and D1 are mastered (needs x10 and halving).

| # | Rung | Method card gist |
|---|------|------------------|
| P1 | 50%, 25%, 10%, 1% of a number | Halve; halve twice; ÷10; ÷100 |
| P2 | Build any percentage from blocks | 30% = 3 x 10%; 5% = half of 10%; 15% = 10% + 5%; 17.5% = 10% + 5% + 2.5%; 20% = 2 x 10% |
| P3 | Fractions as percentages | 1/2, 1/4, 3/4, 1/5, 2/5…, 1/10, 1/8 = 12.5%, 3/8 = 37.5%; "3/8 of 80" = "37.5% of 80" (requires F2) |
| P4 | Percentage increase and decrease | £40 up 20%: find 20% (£8), add on (£48) |
| P5 | Multipliers (GCSE style) | Up 20% = x1.2; down 15% = x0.85; apply to friendly numbers |
| P6 | Reverse percentages | Sale price £60 after 25% off: £60 is 75%, so 1% = £0.80, original = £80 |
| P7 | One number as a percentage of another | 18 out of 40: scale to /100 (x2.5) → 45%; or 18/40 = 9/20 = 45% |

Prerequisites: P1 requires M3 and D1 (halving); each subsequent rung requires
the previous one; P3 also requires F2; P5 requires P4 and M7; P7 requires P6
and D2.

### Number ranges

Generators use "friendly" numbers chosen so the answer is reachable mentally:
percentage base amounts are multiples of 10 or 20 up to 400 (plus 25, 50, 75
etc. where the percentage makes it clean); two-digit multiplication uses
operands up to 30 x 9 for M7; prices are in whole pounds or .50 and shown with
a £ sign.

## Practice mechanics

### Session

- A session is **10 questions**, intended to take under two minutes.
- Started by **Continue** (app picks the target rung, see Scheduler), by
  tapping a specific unlocked rung tile, or by **Weak spots** (a session drawn
  entirely from the missed pile; shown on Home only when the pile has 3+
  facts). Weak spots gives him direct control over attacking known gaps.
- Question mix in a normal session: ~6 from the target rung, ~2 from the
  **missed pile**, ~2 from already-mastered rungs for retention. If the missed
  pile is empty or no rungs are mastered, those slots revert to the target.

### First visit to a rung

1. Method card shown full-screen. "Start" button.
2. **Warm-up**: 6 untimed questions from that rung only, no hints under the
   question (removed after first test). Warm-up answers do not count toward
   mastery stats.
3. Normal sessions thereafter.

### Answering

- On-screen numeric keypad (0-9, decimal point where the rung can produce
  decimals, backspace, submit). Phone keyboard never used.
- "r" key appears only in D4 for remainders (answer format `4 r 3`).
- A £ prefix is displayed (not typed) for money questions.
- Submit with the Go key. (Auto-submit on digit count was built and then
  removed after Chris's first test: it made Go look pointless and leaked the
  number of digits in the answer.)
- A small **method** icon in the drill header opens the rung's method card at
  any time, not only after a wrong answer. The scaffold is always available;
  using it is never penalised.

### Wrong answer

- Show correct answer and the one-line method for that specific fact, e.g.
  "9 x 7: 10 x 7 = 70, take away 7 = 63".
- If the same fact was missed before with the same wrong answer, say so:
  "You put 54 last time too. 9 x 7 = 63." Breaking a repeated error pattern
  needs the learner to notice it.
- Button: **Got it**. Optional link: **Show method card**.
- The fact enters the **missed pile** (see below). It is re-asked at least once
  more in the same session (appended to the end).

### Missed pile

A **fact** is a specific question identity, e.g. `mul:9x7`, `pct:17.5%of80`
(for generated rungs, the fact is the generator parameters that produced it).

- A wrong answer adds the fact with `streak = 0`.
- A correct answer increments `streak`. At `streak = 3` the fact leaves the
  pile.
- A wrong answer on a fact already in the pile resets `streak = 0`.
- The scheduler draws missed-pile facts preferentially by lowest streak, then
  oldest last-asked.

### Mastery

A rung is **mastered** when, over its last 20 non-warm-up answers:

- accuracy ≥ 90% (18/20), and
- at least 20 answers exist, and
- no fact belonging to that rung sits in the missed pile with `streak = 0`
  (facts already being cleared, streak 1-2, do not block mastery; they keep
  resurfacing through the missed-pile slots until cleared).

A window of 20 at ~6 target questions per session means a rung can be
mastered in 3-4 sessions. The streak-0 rule stops one stubborn fact from
freezing an otherwise mastered rung.

**Fast track (added after Chris's first test):** 10 correct in a row on a
rung masters it immediately, provided no streak-0 facts block it. Someone who
already knows a skill moves on after one perfect session instead of grinding
to 20 answers. The summary screen states what is still needed ("14 of your
last 20 right. 18 of 20 unlocks ×4 ×3 ×6 and Halve. A perfect 10 in a row
unlocks it straight away.").

Mastery unlocks dependent rungs and the rung's **speed mode**. Mastered rungs
keep contributing retention questions. If a mastered rung's rolling accuracy
drops below 80% it is flagged "needs a refresh" on Home (not re-locked).

### Speed mode

- Available per rung after mastery, toggled on the drill screen.
- Same generators. Per-question countdown shown as a shrinking bar with a
  fixed limit of **5 s**. No adaptive tightening: the personal best already
  provides progression, and a fixed bar is easier to read. Timeout counts as
  wrong but does **not** add to the missed pile (speed mode never pollutes the
  gap-filling data).
- Personal best per rung = fewest total seconds for a 10/10 session.
- The session summary after a rung is first mastered nudges once: "Speed mode
  unlocked for x9, x8. Try it?" with a button.

### Streaks and levels

- **Daily streak**: consecutive calendar days with at least one completed
  session (local time). Shown on Home.
- **Rung level**: locked → learning → mastered → fast (fast = a 10/10 speed
  session averaging ≤ 3 s per question).
- Feedback is a clean tick/cross and a subtle colour change. No sound.

### Scheduler: choosing the target rung for Continue

1. If any unlocked, unmastered rung has been started, pick the one with the
   lowest rolling accuracy (ties → least recently practised).
2. Else pick the lowest-numbered unlocked, unstarted rung (first visit flow).
3. Else (everything mastered) pick the mastered rung with the oldest
   last-practised date, in speed mode if available.

## Screens

All screens are one tap from Home. Portrait, one-handed phone use.

1. **Home.** Large **Continue** button with a one-line hint that says what is
   needed ("x9, x8 — 16/20 so far, 2 facts to clear"). **Weak spots** button
   when the missed pile has 3+ facts. Daily streak. Four track rows of rung
   tiles (grey locked, blue learning, green mastered, gold fast; M8 marked
   bonus). Tap a tile to practise it or view its method card. Small link to
   Progress.
2. **Method card.** Rung title, 3-5 line method, two worked examples, **Start**
   (or **Back** if opened from elsewhere).
3. **Drill.** Question large at top; 10 progress dots; keypad at bottom; speed
   bar under the question in speed mode. Wrong-answer panel slides up with
   correct answer + method line + **Got it**.
4. **Session summary.** Score x/10, time taken, list of missed facts this
   session, mastery/unlock notice if triggered, personal best if speed mode.
   Buttons: **Again**, **Next** (returns to Home with Continue re-targeted).
5. **Progress.** Per rung: status, rolling accuracy, total answered, date
   mastered, speed PB. Current missed pile as a readable list titled "Weak
   spots" ("9 x 7", "17.5% of 80"). This doubles as the parent view, but the
   UI never says "parent": it is his data, presented to him. Time practised
   this week and all time.
   **Export** (shows a code to copy) and **Import** (paste a code; confirms
   before overwriting).

Visual tone: follows the phone's light/dark setting; single accent colour;
large type; no illustrations. App title "Mental Maths" (changeable in the
manifest).

## Technical shape

- **Static site**, plain HTML/CSS/JS, ES modules, no framework, no build step.
- **Files** (each small, single purpose):
  - `index.html`, `styles.css`
  - `src/ladder.js` — track/rung definitions (4 tracks, 21 rungs),
    prerequisites, method card text (data only)
  - `src/generators/*.js` — one module per rung family returning
    `{ factId, prompt, answer, format, methodLine }`
  - `src/scheduler.js` — pure functions: session composition, target-rung
    choice, missed-pile updates, mastery evaluation
  - `src/store.js` — load/save the single JSON record to `localStorage`,
    export/import codes (JSON → deflate → base64url)
  - `src/screens/*.js` — one module per screen, DOM only, calls into the above
  - `manifest.webmanifest`, `sw.js` — installable, offline cache of all assets
- **State record** (single JSON object): `rungs[id] = { answers: [last 30
  {correct, ts}], total, mastered_at, speed_limit, speed_pb }`,
  `missed[factId] = { rung, streak, last_asked, last_wrong_answer }`,
  `streak = { last_day, count }`, `sessions = [{ ts, rung, score, seconds,
  speed }]` (capped at 100, enough for "this week" totals), `version`.
- **Testing**: Node's built-in `node:test`. Generators: every rung produces
  valid questions across many random draws and the answer is arithmetically
  correct (recomputed independently). Scheduler: mastery triggers exactly at
  the threshold, missed-pile streak logic, session composition counts,
  Continue targeting rules. Store: export → import round-trips. Screens are
  verified by hand on a phone.
- **Hosting**: GitHub repo under Chris's account, deployed via GitHub Pages
  from `main`. He opens the URL once and adds it to the home screen.
- **Target device**: Android phone, Chrome. The app listens for Chrome's
  `beforeinstallprompt` and shows a one-time "Install" button on Home; it
  falls back to a Share → Add to Home Screen hint on iOS if ever opened there.
  Primary test width 390 px.
- **Location**: `/home/chris/mental-maths/`.

## Open items for the implementation plan

- Exact method-card wording per rung (to be written in `ladder.js`).
- Friendly-number tables per generator.
- Whether to show the £ prefix on P4-P6 only or on all percentage questions
  (recommendation: money questions only on P4-P6; plain numbers elsewhere).

## Review log

2026-10-16: spec reviewed by Gemini 2.5 Pro, GPT-4o and Grok 3 via the consult
skill. Adopted: fractions-of-amounts track; halving moved to the front of the
division track with the rest gated on full tables; explicit reverse-tables
method; M8 marked bonus; Weak spots session; always-available method icon;
repeated-wrong-answer callout; mastery window 30 → 20 with streak-0 rule;
fixed 5 s speed limit instead of adaptive tightening; speed-mode nudge on
first mastery; Progress wording de-parented. Rejected: 8/10-of-last-10
mastery (too noisy), 3-of-4 missed-pile clearing (3 in a row across sessions
is the point), cutting export/import and rung badges (Chris chose them),
cutting M8 entirely (he is GCSE level), 8-question sessions, theme
customisation, achievements, adaptive warm-up, "try again before reveal".
