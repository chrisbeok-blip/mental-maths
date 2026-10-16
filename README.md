# Mental Maths

Phone-first mental arithmetic trainer: times tables, division, fractions of amounts, percentages.
Mastery first, then speed. No accounts; progress lives on the phone (export a backup code from Progress).

Live: https://chrisbeok-blip.github.io/mental-maths/

## Develop
- `npm test` runs the engine tests (Node 24, no dependencies).
- `npm run serve` serves on http://localhost:8080.
- Pushing to `main` deploys to GitHub Pages. After changing any file under `src/`, `styles.css` or `index.html`, bump `CACHE` in `sw.js` so installed phones pick up the new version.

Design: `docs/superpowers/specs/2026-10-16-mental-maths-design.md`. Plan: `docs/superpowers/plans/2026-10-16-mental-maths.md`.
