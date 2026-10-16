import { h, icon, statusPill, fmtSeconds, fmtDate, pct } from '../ui.js';
import { TRACKS, RUNGS } from '../ladder.js';
import { rungState, rungLevel, rollingAccuracy, missedSorted } from '../scheduler.js';
import { currentStreak, secondsThisWeek, secondsAllTime } from '../stats.js';
import { exportCode, importCode } from '../store.js';
import { formatAnswer } from '../answer.js';
import { APP_VERSION } from '../version.js';

export function render(root, ctx) {
  const { state } = ctx;
  const pile = missedSorted(state);

  root.append(
    h('section', { class: 'screen progress' },
      h('header', { class: 'topbar' },
        h('button', { class: 'btn icon-btn', 'aria-label': 'Back', onclick: () => ctx.back() }, icon('back')),
        h('h1', {}, 'Progress'),
        h('span'),
      ),
      h('div', { class: 'stat-row' },
        stat('flame', `${currentStreak(state)}`, 'day streak'),
        stat('calendar', fmtSeconds(secondsThisWeek(state)), 'this week'),
        stat('clock', fmtSeconds(secondsAllTime(state)), 'all time'),
      ),
      ...TRACKS.map((t) => h('section', { class: 'track' },
        h('h2', { class: 'track-title' }, t.title),
        h('ul', { class: 'skill-list' }, ...t.rungs.map((id) => row(id, state))),
      )),
      h('section', { class: 'weak' },
        h('h2', {}, `Weak spots (${pile.length})`),
        pile.length === 0 ? h('p', { class: 'hint' }, 'Nothing outstanding. Facts you miss appear here until you get them right three times in a row.')
          : h('ul', {}, ...pile.map((m) => h('li', {},
            h('span', { class: 'q' }, m.q.prompt), h('span', { class: 'a' }, formatAnswer(m.q.answer, m.q.prefix, m.q.suffix)),
            h('span', { class: 'streak-dots', 'aria-label': `${m.streak} of 3 correct` }, '●'.repeat(m.streak) + '○'.repeat(3 - m.streak))))),
      ),
      backup(ctx),
      h('p', { class: 'hint version' }, `Version ${APP_VERSION}`),
    ),
  );
}

const stat = (glyph, value, label) => h('div', { class: 'stat' }, icon(glyph), h('strong', {}, value), h('span', {}, label));

function row(id, state) {
  const r = rungState(state, id), level = rungLevel(state, id);
  const label = level === 'mastered' && r.mastered_at ? fmtDate(r.mastered_at) : undefined;
  const detail = [];
  if (r.answers.length) detail.push(`${pct(rollingAccuracy(state, id))} right`);
  if (r.total) detail.push(`${r.total} answered`);
  if (r.speed_pb != null) detail.push(`best ${fmtSeconds(r.speed_pb)}`);
  return h('li', { class: `skill is-${level}` },
    h('span', { class: 'skill-name' }, RUNGS[id].short),
    statusPill(level, label),
    detail.length > 0 && h('span', { class: 'skill-detail' }, detail.join(', ')),
  );
}

function backup(ctx) {
  const out = h('textarea', { class: 'code', readonly: true, rows: 3, placeholder: 'Your backup code will appear here' });
  const inp = h('textarea', { class: 'code', rows: 3, placeholder: 'Paste a backup code' });
  const status = h('p', { class: 'hint' });
  let pending = null;
  const doExport = async () => {
    out.value = await exportCode(ctx.state);
    try { await navigator.clipboard.writeText(out.value); status.textContent = 'Copied. Paste it into Import on the other phone.'; }
    catch { status.textContent = 'Long-press the code to copy it.'; }
  };
  const confirmBtn = h('button', { class: 'btn btn-primary btn-wide hidden', onclick: () => { ctx.setState(pending); pending = null; ctx.navigate('progress', {}, { replace: true }); } }, 'Yes, replace everything on this phone');
  const doImport = async () => {
    const parsed = await importCode(inp.value);
    if (!parsed) { status.textContent = 'That code is not valid. Check it was copied in full.'; return; }
    pending = parsed;
    status.textContent = 'This will replace all progress on this phone.';
    confirmBtn.classList.remove('hidden');
  };
  return h('section', { class: 'backup' },
    h('h2', {}, 'Backup'),
    h('p', { class: 'hint' }, 'Progress is stored on this phone only. Export a code to move it to another phone.'),
    h('button', { class: 'btn btn-ghost btn-wide', onclick: doExport }, 'Export code'),
    out, inp,
    h('button', { class: 'btn btn-ghost btn-wide', onclick: doImport }, 'Import code'),
    confirmBtn, status,
  );
}
