import { h, icon } from '../ui.js';
import { TRACKS, RUNGS } from '../ladder.js';
import { pickTarget, rungLevel, needsRefresh, missedSorted, masteryProgress, isMastered, WEAK_SPOTS_MIN } from '../scheduler.js';
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
        streak > 0 && h('span', { class: 'streak', 'aria-label': `${streak} day streak` }, icon('flame'), `${streak}`),
      ),
      nextCard(ctx, target),
      pile >= WEAK_SPOTS_MIN && h('button', { class: 'card-btn weak-card', onclick: () => ctx.startSession({ rungId: 'weak', mode: 'weak' }) },
        h('div', {},
          h('div', { class: 'big' }, icon('target'), 'Weak spots'),
          h('div', { class: 'sub' }, `${pile} facts to get right three times`),
        ),
        icon('chevron', 'chev'),
      ),
      ...TRACKS.map((t) => track(t, ctx)),
      h('footer', { class: 'home-footer' },
        h('button', { class: 'btn btn-ghost', onclick: () => ctx.navigate('progress') }, 'Progress'),
        ctx.canInstall && !standalone && h('button', { class: 'btn btn-quiet', onclick: () => ctx.install() }, 'Add to home screen'),
        isIOS && !standalone && h('p', { class: 'hint' }, 'Add to home screen: Share, then "Add to Home Screen".'),
      ),
    ),
  );
}

function nextCard(ctx, target) {
  const { state } = ctx;
  const rung = RUNGS[target.rungId];
  let eyebrow = 'Next up', sub = null, fraction = 0;
  if (target.mode === 'speed') { eyebrow = 'Speed round'; sub = 'Everything is mastered. Beat your best time.'; fraction = 1; }
  else if (target.firstVisit) { sub = 'New skill. Starts with a short warm-up.'; }
  else {
    const mp = masteryProgress(state, target.rungId);
    fraction = Math.min(1, mp.correct / mp.needed);
    const bits = [`${mp.correct} of ${mp.needed} needed`];
    if (mp.blocking) bits.push(`${mp.blocking} to clear`);
    sub = bits.join(', ');
  }
  return h('button', { class: 'card-btn next-card', onclick: () => start(ctx, target) },
    h('div', {},
      h('div', { class: 'eyebrow' }, eyebrow),
      h('div', { class: 'big' }, rung.title),
      sub && h('div', { class: 'sub' }, sub),
    ),
    icon('chevron', 'chev'),
    target.mode !== 'speed' && !target.firstVisit && h('div', { class: 'bar' }, h('i', { style: `width:${Math.round(fraction * 100)}%` })),
  );
}

function start(ctx, target) {
  if (target.firstVisit) ctx.navigate('method', { rungId: target.rungId, first: true });
  else ctx.startSession({ rungId: target.rungId, mode: target.mode });
}

function track(t, ctx) {
  const done = t.rungs.filter((id) => isMastered(ctx.state, id)).length;
  return h('section', { class: 'track' },
    h('h2', { class: 'track-title' }, t.title, h('small', {}, `${done} of ${t.rungs.length}`)),
    h('div', { class: 'tiles' }, ...t.rungs.map((id) => tile(id, ctx))),
  );
}

const FOOT = {
  locked: ['lock', 'Locked'], learning: ['target', 'Learning'], mastered: ['check', 'Mastered'], fast: ['bolt', 'Fast'],
};
function tile(id, ctx) {
  const r = RUNGS[id];
  const level = rungLevel(ctx.state, id);
  const refresh = needsRefresh(ctx.state, id);
  const [glyph, text] = refresh ? ['target', 'Refresh'] : FOOT[level];
  const cls = ['tile', `is-${level}`, r.bonus && 'is-bonus', refresh && 'needs-refresh'].filter(Boolean).join(' ');
  return h('button', { class: cls, 'aria-label': `${r.title}, ${text}`, disabled: level === 'locked', onclick: () => ctx.navigate('method', { rungId: id }) },
    h('span', { class: 'tile-short' }, r.short),
    h('span', { class: 'tile-foot' }, icon(glyph), r.bonus && level === 'locked' ? 'Bonus' : text),
  );
}
