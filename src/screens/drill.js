import { h, clear, icon, promptNodes } from '../ui.js';
import { RUNGS } from '../ladder.js';
import { formatAnswer } from '../answer.js';
import { currentQuestion, submitAnswer, isDone, summarize } from '../session.js';
import { recordSession } from '../stats.js';
import { SPEED_LIMIT_MS } from '../scheduler.js';

export function render(root, ctx) {
  const view = { root, ctx, input: '', timer: null, raf: null, locked: false, display: null };
  draw(view);
}

function draw(view) {
  const { root, ctx } = view;
  const s = ctx.session;
  if (isDone(s)) return finish(view);

  const q = currentQuestion(s);
  const sessionRung = s.mode === 'weak' ? null : RUNGS[s.rungId];
  const fmt = sessionRung?.format ?? { decimals: true, remainder: true };
  const showDot = fmt.decimals || /\./.test(q.answer);
  const showR = fmt.remainder || / r /.test(q.answer);
  const title = s.mode === 'weak' ? 'Weak spots'
    : s.mode === 'warmup' ? `Warm-up: ${sessionRung.short}`
    : s.mode === 'speed' ? `Speed round: ${sessionRung.short}`
    : sessionRung.short;
  const answered = s.results.length, total = s.questions.length;

  clear(root);
  const display = h('div', { class: 'display' },
    h('span', { class: 'prefix' }, q.prefix), h('span', { class: 'value' }, view.input), h('span', { class: 'suffix' }, q.suffix));

  const key = (label, onpress, cls = '', aria) => h('button', { class: `key ${cls}`.trim(), 'aria-label': aria, onclick: () => !view.locked && onpress() }, label);
  const digit = (d) => key(String(d), () => type(view, String(d), q));

  root.append(
    h('section', { class: 'screen drill' },
      h('header', { class: 'topbar' },
        h('button', { class: 'btn icon-btn', 'aria-label': 'Quit this session', onclick: () => quit(view) }, icon('close')),
        h('span', { class: 'title' }, title),
        h('button', { class: 'btn icon-btn', 'aria-label': 'Show the method', onclick: () => { stopTimer(view); ctx.navigate('method', { rungId: q.rungId, fromDrill: true }); } }, icon('help')),
      ),
      h('div', { class: 'drill-progress' },
        h('div', { class: 'track-bar' }, h('i', { style: `width:${Math.round((answered / total) * 100)}%` })),
        h('span', { class: 'count' }, `${Math.min(answered + 1, total)} of ${total}`),
      ),
      h('div', { class: 'question' },
        h('p', { class: `prompt${q.prompt.length > 12 ? ' is-long' : ''}` }, ...promptNodes(q.prompt)),
        s.mode === 'speed' && h('div', { class: 'speedbar' }, h('i')),
      ),
      display,
      h('div', { class: 'keypad' },
        digit(1), digit(2), digit(3), key(icon('backspace'), () => { view.input = view.input.replace(/ r $/, '').slice(0, -1); refresh(view); }, 'key-action', 'Delete'),
        digit(4), digit(5), digit(6), key('.', () => type(view, '.', q), `key-action ${showDot ? '' : 'hidden'}`, 'Decimal point'),
        digit(7), digit(8), digit(9), key('r', () => type(view, ' r ', q), `key-action ${showR ? '' : 'hidden'}`, 'Remainder'),
        key('0', () => type(view, '0', q), 'key-zero'), key('Go', () => submit(view, q), 'key-go', 'Submit answer'),
      ),
    ),
  );
  view.display = display;
  if (s.mode === 'speed') startTimer(view, q);
}

function type(view, ch, q) {
  if (ch === '.' && (view.input.includes('.') || view.input.includes(' r '))) return;
  if (ch === ' r ' && (view.input.includes(' r ') || view.input === '' || view.input.includes('.'))) return;
  if (view.input.length >= 9) return;
  view.input += ch;
  refresh(view);
}

function refresh(view) { view.display.querySelector('.value').textContent = view.input; }

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

function stopTimer(view) { clearTimeout(view.timer); cancelAnimationFrame(view.raf); view.timer = view.raf = null; }

function submit(view, q, { timeout = false } = {}) {
  if (view.locked) return;
  if (!timeout && view.input.trim() === '') return;
  view.locked = true;
  stopTimer(view);
  const { ctx } = view;
  const typed = view.input;
  const res = submitAnswer(ctx.session, ctx.state, typed, Date.now(), { timeout });
  ctx.setState(res.state);
  ctx.setSession(res.session);
  view.input = '';

  if (res.correct) {
    view.display.classList.add('flash-ok');
    setTimeout(() => { view.locked = false; draw(view); }, 220);
    return;
  }
  view.display.classList.add('is-wrong');
  const answer = formatAnswer(q.answer, q.prefix, q.suffix);
  const next = () => { view.locked = false; draw(view); };
  const scrim = h('div', { class: 'scrim', onclick: next });
  const panel = h('div', { class: 'feedback', role: 'dialog', 'aria-label': 'Answer' },
    h('p', { class: 'label' }, timeout ? "Time's up" : 'Not quite'),
    h('p', { class: 'answer' }, `${q.prompt} = ${answer}`),
    !timeout && h('p', { class: 'yours' }, res.repeatWrong ? 'You put ' : 'You put ', h('s', {}, formatAnswer(typed, q.prefix, q.suffix)), res.repeatWrong ? ', same as last time.' : ''),
    h('p', { class: 'method' }, q.methodLine),
    h('div', { class: 'actions' },
      h('button', { class: 'btn btn-primary btn-wide', onclick: next }, 'Continue'),
      h('button', { class: 'btn btn-ghost btn-wide', onclick: () => ctx.navigate('method', { rungId: q.rungId, fromDrill: true }) }, 'See the full method'),
    ),
  );
  view.root.querySelector('.drill').append(scrim, panel);
  requestAnimationFrame(() => { scrim.classList.add('is-open'); panel.classList.add('is-open'); });
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
