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
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;

  root.append(
    h('section', { class: 'screen home' },
      h('header', { class: 'topbar' },
        h('h1', {}, 'Mental Maths'),
        streak > 0 && h('span', { class: 'streak' }, streak === 1 ? '1 day in a row' : `${streak} days in a row`),
      ),
      h('button', { class: 'btn btn-primary btn-wide continue', onclick: () => start(ctx, target) },
        h('span', { class: 'label' }, target.firstVisit ? 'Start' : 'Continue'),
        h('span', { class: 'hint' }, continueHint(state, target)),
      ),
      pile >= WEAK_SPOTS_MIN && h('button', { class: 'btn btn-ghost btn-wide', onclick: () => ctx.startSession({ rungId: 'weak', mode: 'weak' }) },
        'Weak spots', h('span', { class: 'hint' }, `${pile} facts to clear`)),
      ctx.canInstall && !standalone && h('button', { class: 'btn btn-ghost btn-wide', onclick: () => ctx.install() }, 'Install on this phone'),
      isIOS && !standalone && h('p', { class: 'hint' }, 'To install: tap Share, then "Add to Home Screen".'),
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
  return h('section', { class: 'track' },
    h('h2', { class: 'track-title' }, t.title),
    h('div', { class: 'tiles' }, ...t.rungs.map((id) => tile(id, ctx))),
  );
}

function tile(id, ctx) {
  const r = RUNGS[id];
  const level = rungLevel(ctx.state, id);
  const refresh = needsRefresh(ctx.state, id);
  const cls = ['tile', `is-${level}`, r.bonus && 'is-bonus', refresh && 'needs-refresh'].filter(Boolean).join(' ');
  return h('button', {
    class: cls, 'aria-label': `${r.title}, ${level}`, disabled: level === 'locked',
    onclick: () => ctx.navigate('method', { rungId: id }),
  },
    h('span', { class: 'tile-short' }, r.short),
    (r.bonus || refresh) && h('span', { class: 'tile-tag' }, refresh ? 'needs a refresh' : 'bonus'),
  );
}
