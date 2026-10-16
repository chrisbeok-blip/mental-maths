import { h, icon, ring, fmtSeconds } from '../ui.js';
import { RUNGS } from '../ladder.js';
import { formatAnswer } from '../answer.js';
import { rungState, isMastered, masteryProgress, unlocksNext } from '../scheduler.js';

function headline(sum) {
  if (sum.mode === 'warmup') return sum.score === sum.total ? 'Warmed up and ready' : 'Warm-up done';
  const r = sum.score / sum.total;
  if (r === 1) return sum.speed ? 'Clean sweep' : 'Perfect round';
  if (r >= 0.8) return 'Nearly there';
  if (r >= 0.5) return 'Getting there';
  return 'A tough one';
}

/** Average seconds of this rung's previous (non-speed) sessions, or null. */
function usualSeconds(state, rungId, speed) {
  const prev = state.sessions.filter((x) => x.rung === rungId && x.speed === speed).slice(0, -1);
  if (prev.length < 2) return null;
  return prev.reduce((n, x) => n + x.seconds, 0) / prev.length;
}

export function render(root, ctx) {
  const sum = ctx.lastSummary;
  const { state } = ctx;
  const rung = sum.mode === 'weak' ? null : RUNGS[sum.rungId];
  const title = sum.mode === 'weak' ? 'Weak spots' : sum.mode === 'warmup' ? 'Warm-up' : rung.title;
  const pb = rung ? rungState(state, sum.rungId).speed_pb : null;
  const isPB = sum.speed && sum.score === sum.total && pb === sum.seconds;
  const nudge = sum.newlyMastered && !state.flags.speedNudgeSeen.includes(sum.rungId);
  const mastered = rung && isMastered(state, sum.rungId);

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
  else if (rung && sum.mode === 'learn') {
    const usual = usualSeconds(state, sum.rungId, false);
    if (usual && sum.seconds < usual * 0.9) meta.push('faster than your usual');
  }

  let mastery = null;
  if (sum.mode === 'learn' && rung && !mastered) {
    const mp = masteryProgress(state, sum.rungId);
    const next = unlocksNext(sum.rungId).map((id) => RUNGS[id].short);
    const toGo = Math.max(0, mp.needed - mp.correct);
    const note = mp.blocking
      ? `${mp.blocking} missed fact${mp.blocking === 1 ? '' : 's'} to get right first`
      : toGo ? `${toGo} more right answer${toGo === 1 ? '' : 's'} to unlock ${next.join(' and ') || 'the next skill'}` : `Unlocks ${next.join(' and ')}`;
    mastery = h('div', { class: 'mastery' },
      h('div', { class: 'row' }, h('strong', {}, 'Mastery'), h('span', {}, `${mp.correct} of ${mp.needed}`)),
      h('div', { class: 'track-bar' }, h('i', { style: `width:${Math.round(Math.min(1, mp.correct / mp.needed) * 100)}%` })),
      h('p', { class: 'note' }, `${note}. Ten in a row unlocks it at once.`),
    );
  }

  const fraction = sum.score / sum.total;
  const ringEl = ring(fraction);
  if (fraction === 1) ringEl.querySelector('.ring-fill').classList.add('is-perfect');

  root.append(
    h('section', { class: 'screen summary' },
      h('header', { class: 'topbar' }, h('span'), h('span', { class: 'title' }, title), h('span')),
      h('div', { class: 'score-wrap' }, ringEl, h('p', { class: 'score' }, `${sum.score}`, h('small', {}, `of ${sum.total}`))),
      h('p', { class: 'headline' }, headline(sum)),
      h('p', { class: 'meta' }, meta.join(', ')),
      sum.newlyMastered && h('div', { class: 'banner' },
        h('strong', {}, icon('check'), `${rung.title} mastered`),
        nudge && h('p', {}, 'Speed round unlocked: the same questions, five seconds each.'),
        nudge && h('button', { class: 'btn btn-primary btn-wide', onclick: () => { markNudgeSeen(); ctx.startSession({ rungId: sum.rungId, mode: 'speed' }); } }, icon('bolt'), 'Try a speed round'),
      ),
      mastery,
      sum.missed.length > 0 && h('section', { class: 'missed-list' },
        h('h2', {}, sum.mode === 'warmup' ? 'Worth another look' : 'Added to weak spots'),
        h('ul', {}, ...sum.missed.map((q) => h('li', {}, h('span', { class: 'q' }, q.prompt), h('span', { class: 'a' }, formatAnswer(q.answer, q.prefix, q.suffix)), h('span')))),
      ),
      h('div', { class: 'actions' },
        h('button', { class: 'btn btn-primary btn-wide', onclick: primary }, sum.mode === 'warmup' ? 'Start practising' : 'Continue'),
        h('button', { class: 'btn btn-ghost btn-wide', onclick: again }, sum.mode === 'warmup' ? 'Another warm-up' : 'Try this set again'),
      ),
    ),
  );
}
