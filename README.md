# Mental Maths

Phone-first mental arithmetic trainer: times tables, division, fractions of amounts, percentages.
Mastery first, then speed. No accounts; progress lives on the phone (export a backup code from Progress).

Live: https://chrisbeok-blip.github.io/mental-maths/

## Develop
- `npm test` runs the engine tests (Node 24, no dependencies).
- `npm run serve` serves on http://localhost:8080.
- Pushing to `main` deploys to GitHub Pages. The service worker is network-first, so phones pick up a new deploy on their next online open; no cache bump needed. Bump `APP_VERSION` in `src/version.js` so the Progress screen shows which build a phone is on.

Design: `docs/superpowers/specs/2026-10-16-mental-maths-design.md`. Plan: `docs/superpowers/plans/2026-10-16-mental-maths.md`.
