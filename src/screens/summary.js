import { h, fmtSeconds } from '../ui.js';
import { RUNGS } from '../ladder.js';
import { formatAnswer } from '../answer.js';
import { rungState } from '../scheduler.js';

export function render(root, ctx) {
  const sum = ctx.lastSummary;
  const { state } = ctx;
  const rung = sum.mode === 'weak' ? null : RUNGS[sum.rungId];
  const title = sum.mode === 'weak' ? 'Weak spots' : sum.mode === 'warmup' ? 'Warm-up done' : rung.title;
  const pb = rung ? rungState(state, sum.rungId).speed_pb : null;
  const isPB = sum.speed && sum.score === sum.total && pb === sum.seconds;
  const nudge = sum.newlyMastered && !state.flags.speedNudgeSeen.includes(sum.rungId);

  const markNudgeSeen = () => {
    if (!nudge) return;
    const s = structuredClone(ctx.state);
    s.flags.speedNudgeSeen.push(sum.rungId);
    ctx.setState(s);
  };
  const next = () => { markNudgeSeen(); ctx.setLastSummary(null); ctx.navigate('home', {}, { replace: true }); };
  const again = () => ctx.startSession({ rungId: sum.rungId, mode: sum.mode === 'warmup' ? 'learn' : sum.mode });
  const primary = sum.mode === 'warmup'
    ? () => { ctx.setLastSummary(null); ctx.startSession({ rungId: sum.rungId, mode: 'learn' }); }
    : next;

  const meta = [fmtSeconds(sum.seconds)];
  if (sum.speed && pb != null) meta.push(isPB ? 'new best time' : `best ${fmtSeconds(pb)}`);

  root.append(
    h('section', { class: 'screen summary' },
      h('header', { class: 'topbar' }, h('span'), h('span', { class: 'title' }, title), h('span')),
      h('p', { class: 'score' }, `${sum.score}`, h('small', {}, `/${sum.total}`)),
      h('p', { class: 'meta' }, meta.join(', ')),
      sum.newlyMastered && h('div', { class: 'banner' },
        h('strong', {}, `${rung.title}: mastered.`),
        nudge && h('p', {}, 'Speed round unlocked. Same questions, five seconds each.'),
        nudge && h('button', { class: 'btn btn-primary btn-wide', onclick: () => { markNudgeSeen(); ctx.startSession({ rungId: sum.rungId, mode: 'speed' }); } }, 'Try a speed round'),
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
