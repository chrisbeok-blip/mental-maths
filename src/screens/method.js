import { h, icon } from '../ui.js';
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
    actions.push(h('button', { class: 'btn btn-primary btn-wide', onclick: () => ctx.back() }, 'Back to the questions'));
  } else if (unlocked) {
    if (!started || first) {
      actions.push(h('button', { class: 'btn btn-primary btn-wide', onclick: () => { ctx.setState(markVisited(state, rungId, Date.now())); ctx.startSession({ rungId, mode: 'warmup' }); } }, 'Start the warm-up'));
    } else {
      actions.push(h('button', { class: 'btn btn-primary btn-wide', onclick: () => ctx.startSession({ rungId, mode: 'learn' }) }, 'Practise'));
      if (isMastered(state, rungId)) actions.push(h('button', { class: 'btn btn-ghost btn-wide', onclick: () => ctx.startSession({ rungId, mode: 'speed' }) }, icon('bolt'), 'Speed round'));
    }
  } else {
    const need = r.requires.filter((p) => !isMastered(state, p)).map((p) => RUNGS[p].title).join(' and ');
    actions.push(h('p', { class: 'hint' }, `Unlocks after ${need}.`));
  }

  root.append(
    h('section', { class: 'screen method' },
      h('header', { class: 'topbar' },
        h('button', { class: 'btn icon-btn', 'aria-label': 'Back', onclick: () => ctx.back() }, icon('back')),
        h('h1', {}, r.title),
        h('span'),
      ),
      h('article', { class: 'card' },
        h('ul', { class: 'method-steps' }, ...r.method.lines.map((l) => h('li', {}, l))),
        h('h2', {}, 'Try these'),
        h('div', { class: 'examples' }, ...r.method.examples.map((e) => h('div', { class: 'example' }, h('span', { class: 'q' }, e.q), h('span', { class: 'a' }, e.a)))),
      ),
      h('div', { class: 'actions' }, ...actions),
    ),
  );
}
