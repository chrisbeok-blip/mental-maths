import { load, save } from './store.js';
import { randomRng } from './rng.js';
import { createSession } from './session.js';
import { clear } from './ui.js';
import * as home from './screens/home.js';
import * as method from './screens/method.js';
import * as drill from './screens/drill.js';
import * as summary from './screens/summary.js';
import * as progress from './screens/progress.js';

const SCREENS = { home, method, drill, summary, progress };
const root = document.getElementById('app');

let state = load();
let session = null;      // live session object (src/session.js) or null
let lastSummary = null;  // result of summarize() for the summary screen
let installEvent = null; // deferred beforeinstallprompt

const ctx = {
  get state() { return state; },
  setState(next) { state = next; save(undefined, state); },
  get session() { return session; },
  setSession(s) { session = s; },
  get lastSummary() { return lastSummary; },
  setLastSummary(x) { lastSummary = x; },
  rng: randomRng,
  navigate,
  back() { history.back(); },
  /** Create and open a session. mode: learn | warmup | speed | weak */
  startSession({ rungId, mode }) {
    session = createSession(state, { rungId, mode }, randomRng, Date.now());
    navigate('drill', {}, { replace: mode === 'warmup' });
  },
  get canInstall() { return !!installEvent; },
  async install() {
    if (!installEvent) return;
    installEvent.prompt();
    await installEvent.userChoice.catch(() => {});
    installEvent = null;
    render(current());
  },
};

function current() { return history.state ?? { name: 'home', params: {} }; }

function navigate(name, params = {}, { replace = false } = {}) {
  const entry = { name, params };
  if (replace) history.replaceState(entry, '', location.pathname + location.search);
  else history.pushState(entry, '', location.pathname + location.search);
  render(entry);
}

function render(entry) {
  let { name, params } = entry;
  if (name === 'drill' && !session) { name = 'home'; params = {}; }
  if (name === 'summary' && !lastSummary) { name = 'home'; params = {}; }
  if (!SCREENS[name]) { name = 'home'; params = {}; }
  clear(root);
  root.dataset.screen = name;
  SCREENS[name].render(root, ctx, params);
  window.scrollTo(0, 0);
}

window.addEventListener('popstate', () => render(current()));
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; if (current().name === 'home') render(current()); });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').then((reg) => reg.update().catch(() => {})).catch(() => {}));
  // A new version activated: reload once (not mid-drill) so the page runs the new files.
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded || session) return;
    reloaded = true;
    location.reload();
  });
}

history.replaceState({ name: 'home', params: {} }, '', location.pathname + location.search);
render(current());
