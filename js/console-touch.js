// Touch-Oberfläche der Console (Entwurf, nur Plattform-Admins): läuft im Vollbild auf dem Touch-Display
// (console-touch.html) und als Simulator im Admin-Bereich (js/dash-console-touch.js → „Touch-Bildschirm“).
// Einstellungen in core.console_config.display.touch (console_get / console_save), Aktionen wie bei den Tasten.
import { h } from './extras-core.js';
import { BOARD } from './prank-fx.js';
import { ALERT_KINDS, alertText } from './alerts.js';

export const TOUCH_SIZES = {
  '3.5': { w: 480, h: 320, name: '3,5 Zoll · 480 × 320' },
  5: { w: 800, h: 480, name: '5 Zoll · 800 × 480' },
  7: { w: 1024, h: 600, name: '7 Zoll · 1024 × 600' },
};
export const TOUCH_PAGES = [
  ['home', 'Start', '🏠'],
  ['scenes', 'Szenen', '🎬'],
  ['sounds', 'Sounds', '🔊'],
  ['live', 'Live', '📈'],
  ['ideas', 'Ideen', '💡'],
];
export const TOUCH_SCENES = [['', 'Live', '🔴'], ['start', 'Gleich geht’s los', '⏳'], ['chat', 'Just Chatting', '💬'], ['brb', 'Bin gleich zurück', '☕'], ['end', 'Danke fürs Zuschauen', '👋']];
export const TOUCH_COLORS = ['#9146ff', '#ffb81c', '#ff5a4e', '#ff7a28', '#3ddc84', '#35c7ff', '#ff4fd8', '#8e8e9a'];
export const TOUCH_IDLE = [[0, 'Nie'], [1, 'nach 1 Minute'], [2, 'nach 2 Minuten'], [5, 'nach 5 Minuten'], [10, 'nach 10 Minuten']];
const MAX_TILES = 8;

export const TOUCH_DEFAULT_TILES = [
  { action: 'scene', arg: '', label: 'Live', icon: '🔴', color: '#ff5a4e' },
  { action: 'scene', arg: 'brb', label: 'Pause', icon: '☕', color: '#ff7a28' },
  { action: 'spin', arg: '', label: 'Glücksrad', icon: '🎡', color: '#9146ff' },
  { action: 'sound', arg: 'rimshot', label: 'Ba-dum-tss', icon: '🥁', color: '#35c7ff' },
  { action: 'alert', arg: 'follow', label: 'Test-Alert', icon: '💜', color: '#ff4fd8' },
  { action: 'guard', arg: '', label: 'Raid-Schutz', icon: '🛡️', color: '#8e8e9a' },
];
export const TOUCH_DEFAULT = {
  size: '5', orient: 'land', bright: 100, idle: 2, hold: true, accent: '#9146ff', start: 'home',
  pages: TOUCH_PAGES.map(([id]) => id), tiles: TOUCH_DEFAULT_TILES,
};

// Was eine Kachel kann (die Ziele hängen von den Glücksrad-Varianten ab)
export function touchActions(variants = []) {
  return {
    none: { name: 'Nichts', args: null },
    scene: { name: 'Szene wechseln', args: TOUCH_SCENES.map(([id, name]) => [id, name]) },
    spin: { name: 'Glücksrad drehen', args: [['', 'erste Variante'], ...variants.map((v) => [String(v.id), v.name])] },
    sound: { name: 'Sound abspielen', args: BOARD.map((b) => [b.id, `${b.emoji} ${b.name}`]) },
    alert: { name: 'Test-Alert', args: ALERT_KINDS.map((k) => [k.kind, k.label]) },
    guard: { name: 'Raid-Schutz an/aus', args: null },
    idea: { name: 'Content-Idee vorschlagen', args: null },
    goto: { name: 'Seite öffnen', args: TOUCH_PAGES.map(([id, name]) => [id, name]) },
  };
}
const ACTION_IDS = Object.keys(touchActions());

const str = (v, max) => String(v ?? '').slice(0, max);
const color = (v, fallback = '') => (/^#[0-9a-fA-F]{6}$/.test(v ?? '') ? v : fallback);
export function cleanTile(t) {
  return {
    action: ACTION_IDS.includes(t?.action) ? t.action : 'none',
    arg: str(t?.arg, 64), label: str(t?.label, 24), icon: str(t?.icon, 8), color: color(t?.color),
  };
}

// Gespeicherte Einstellungen prüfen und mit den Vorgaben auffüllen
export function normalizeTouch(t) {
  const d = TOUCH_DEFAULT;
  const ids = TOUCH_PAGES.map(([id]) => id);
  const pages = Array.isArray(t?.pages) ? [...new Set(t.pages.filter((p) => ids.includes(p)))] : d.pages;
  if (!pages.includes('home')) pages.unshift('home');
  const bright = Number(t?.bright);
  const idle = Number(t?.idle);
  return {
    size: Object.hasOwn(TOUCH_SIZES, t?.size) ? String(t.size) : d.size,
    orient: t?.orient === 'port' ? 'port' : 'land',
    bright: Number.isFinite(bright) ? Math.min(100, Math.max(20, Math.round(bright))) : d.bright,
    idle: TOUCH_IDLE.some(([m]) => m === idle) ? idle : d.idle,
    hold: typeof t?.hold === 'boolean' ? t.hold : d.hold,
    accent: color(t?.accent, d.accent),
    start: pages.includes(t?.start) ? t.start : 'home',
    pages,
    tiles: (Array.isArray(t?.tiles) ? t.tiles : d.tiles).slice(0, MAX_TILES).map(cleanTile),
  };
}

export const touchMaxTiles = MAX_TILES;
export const guardIsOn = (g) => !!g?.viewer_pause && (!g.until || Date.parse(g.until) > Date.now());

// Daten und Aktionen: dieselben Aufrufe wie die Tasten der Console (js/dash-console.js)
//   dry() = true → nur anzeigen, was passieren würde (Simulator im Admin-Bereich)
export function createTouchRunner({ api, extras, dry = () => false }) {
  const data = { variants: [], tiles: [] };
  return {
    data,
    async loadStatic() {
      [data.variants, data.tiles] = await Promise.all([api.getVariants().catch(() => []), api.getTiles().catch(() => [])]);
    },
    async loadLive() {
      const today = new Date().toDateString();
      const [alerts, spins, overlay, guard] = await Promise.all([
        api.getAlerts(50),
        api.getSpins(1).catch(() => []),
        api.getOverlayConfig().catch(() => null),
        extras.guard.get().catch(() => null),
      ]);
      return {
        alert: alerts[0] ?? null,
        spin: spins[0] ?? null,
        scene: new URLSearchParams(overlay?.params ?? '').get('scene') ?? '',
        alertsToday: alerts.filter((a) => !a.test && new Date(a.created_at).toDateString() === today).length,
        guard: guardIsOn(guard),
      };
    },
    // Gibt { text, live } zurück: Meldung für das Display und geänderte Live-Werte
    async run(tile, live) {
      const arg = tile.arg ?? '';
      const what = describe(tile, data.variants);
      if (dry()) {
        const patch = tile.action === 'scene' ? { scene: arg } : tile.action === 'guard' ? { guard: !live.guard } : {};
        return { text: `Probelauf: ${what}`, live: patch };
      }
      switch (tile.action) {
        case 'scene': {
          const overlay = await api.getOverlayConfig();
          const p = new URLSearchParams(overlay?.params ?? '');
          if (arg) p.set('scene', arg);
          else p.delete('scene');
          await api.saveOverlayConfig(p.toString());
          return { text: what, live: { scene: arg } };
        }
        case 'spin': {
          const v = data.variants.find((x) => String(x.id) === arg) ?? data.variants[0];
          if (!v) throw new Error('Es gibt noch keine Glücksrad-Variante.');
          const r = await api.spin(v.id, true);
          return { text: `🎡 ${r?.spin?.result ?? 'Gedreht'}`, live: {} };
        }
        case 'sound':
          await api.sendPrank('sound', arg || BOARD[0].id);
          return { text: what, live: {} };
        case 'alert':
          await api.testAlert(arg || 'follow');
          return { text: 'Test-Alert geschickt', live: {} };
        case 'guard': {
          const on = guardIsOn(await extras.guard.set(!live.guard, 0));
          return { text: on ? '🛡️ Raid-Schutz ist an' : '🛡️ Raid-Schutz ist aus', live: { guard: on } };
        }
        default:
          return { text: '', live: {} };
      }
    },
  };
}

function describe(tile, variants) {
  const arg = tile.arg ?? '';
  switch (tile.action) {
    case 'scene': return `Szene „${TOUCH_SCENES.find(([id]) => id === arg)?.[1] ?? 'Live'}“`;
    case 'spin': return `Glücksrad „${variants.find((v) => String(v.id) === arg)?.name ?? variants[0]?.name ?? 'Glücksrad'}“ drehen`;
    case 'sound': { const b = BOARD.find((x) => x.id === arg) ?? BOARD[0]; return `${b.emoji} ${b.name}`; }
    case 'alert': return `Test-Alert ${ALERT_KINDS.find((k) => k.kind === (arg || 'follow'))?.label ?? ''}`.trim();
    case 'guard': return 'Raid-Schutz umschalten';
    default: return '';
  }
}

// ---------- Oberfläche ----------
// mountTouch(host, { cfg, goal, runner, fill }) → { setConfig, setLive, setGoal, sleep, destroy }
//   fill = true: so groß wie host (Gerät); sonst feste Auflösung aus cfg.size, auf host.clientWidth skaliert
export function mountTouch(host, { cfg, goal = 10, runner, fill = false, onError = (err) => console.error(err) }) {
  let c = normalizeTouch(cfg);
  let target = goal;
  let live = { alert: null, spin: null, scene: '', alertsToday: 0, guard: false };
  let page = c.start;
  let idea = null;
  let idleTimer = 0;
  let toastTimer = 0;
  let clockTimer = 0;
  let busy = false;

  const screen = h('div', { class: 'tch', role: 'application', 'aria-roledescription': 'Touch-Display', 'aria-label': 'StreamHelp Console' });
  const status = h('div', { class: 'tch-status' });
  const track = h('div', { class: 'tch-track' });
  const tabs = h('nav', { class: 'tch-tabs', 'aria-label': 'Seiten' });
  const toastEl = h('div', { class: 'tch-toast', role: 'status', 'aria-live': 'polite' });
  const saver = h('button', { type: 'button', class: 'tch-saver', hidden: true, 'aria-label': 'Bildschirm aufwecken' });
  const dim = h('div', { class: 'tch-dim', 'aria-hidden': 'true' });
  screen.append(status, h('div', { class: 'tch-viewport' }, track), tabs, toastEl, saver, dim);
  const frame = h('div', { class: fill ? 'tch-fill' : 'tch-frame' }, screen);
  host.replaceChildren(frame);

  // Größe: Gerät = ganzer Bildschirm, Simulator = feste Auflösung, verkleinert auf die verfügbare Breite
  function layout() {
    let w;
    let hgt;
    if (fill) {
      w = host.clientWidth || innerWidth;
      hgt = host.clientHeight || innerHeight;
    } else {
      const s = TOUCH_SIZES[c.size];
      [w, hgt] = c.orient === 'port' ? [s.h, s.w] : [s.w, s.h];
      const scale = Math.min(1, (host.clientWidth || w) / w);
      frame.style.width = `${Math.round(w * scale)}px`;
      frame.style.height = `${Math.round(hgt * scale)}px`;
      screen.style.transform = scale < 1 ? `scale(${scale})` : '';
    }
    screen.style.width = `${w}px`;
    screen.style.height = `${hgt}px`;
    screen.style.setProperty('--u', String(Math.min(w, hgt) / 480));
    screen.dataset.shape = w >= hgt ? 'land' : 'port';
    const unitW = w / (Math.min(w, hgt) / 480);
    screen.style.setProperty('--cols', String(w < hgt ? 2 : unitW >= 760 ? 4 : 3));
  }
  const ro = new ResizeObserver(() => layout());
  ro.observe(host);

  function paint() {
    screen.style.setProperty('--acc', c.accent);
    dim.style.opacity = String((100 - c.bright) / 100 * 0.8);
    if (!c.pages.includes(page)) page = c.pages[0];
    paintStatus();
    track.replaceChildren(...c.pages.map((p) => h('section', { class: `tch-page tch-page--${p}`, dataset: { page: p }, 'aria-label': pageName(p) }, ...pageBody(p))));
    tabs.replaceChildren(...c.pages.map((p) => {
      const [, name, icon] = TOUCH_PAGES.find(([id]) => id === p);
      return h('button', { type: 'button', class: 'tch-tab', dataset: { tch: p }, 'aria-current': p === page ? 'page' : null, onclick: () => go(p) },
        h('span', { class: 'tch-tab-ico', 'aria-hidden': 'true' }, icon), h('span', {}, name));
    }));
    tabs.hidden = c.pages.length < 2;
    place(false);
    paintSaver();
  }
  const pageName = (p) => TOUCH_PAGES.find(([id]) => id === p)?.[1] ?? p;

  function paintStatus() {
    const scene = TOUCH_SCENES.find(([id]) => id === live.scene) ?? TOUCH_SCENES[0];
    status.replaceChildren(
      h('span', { class: 'tch-clock' }, clock()),
      h('span', { class: `tch-pill${live.scene ? '' : ' is-live'}` }, h('i', { 'aria-hidden': 'true' }), scene[1]),
      h('span', { class: `tch-shield${live.guard ? ' is-on' : ''}`, title: live.guard ? 'Raid-Schutz ist an' : 'Raid-Schutz ist aus' }, live.guard ? '🛡️ an' : '🛡️ aus'),
    );
  }
  const clock = () => new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  function pageBody(p) {
    switch (p) {
      case 'home':
        return [c.tiles.length
          ? h('div', { class: 'tch-grid' }, ...c.tiles.map((t) => tileBtn(t)))
          : h('p', { class: 'tch-empty' }, 'Noch keine Kacheln – im Admin-Bereich unter „Touch-Bildschirm“ anlegen.')];
      case 'scenes':
        return [h('div', { class: 'tch-list' }, ...TOUCH_SCENES.map(([id, name, icon]) => tileBtn(
          { action: 'scene', arg: id, label: name, icon, color: c.accent }, { active: live.scene === id, wide: true },
        )))];
      case 'sounds':
        return [h('div', { class: 'tch-grid tch-grid--sounds' }, ...BOARD.map((b, i) => tileBtn(
          { action: 'sound', arg: b.id, label: b.name, icon: b.emoji, color: TOUCH_COLORS[i % TOUCH_COLORS.length] },
        )))];
      case 'live':
        return liveCards();
      case 'ideas':
        return ideaCard();
      default:
        return [];
    }
  }

  function tileBtn(t, { active = false, wide = false } = {}) {
    const needsHold = c.hold && t.action === 'guard';
    const btn = h('button', {
      type: 'button',
      class: `tch-tile${wide ? ' tch-tile--wide' : ''}${active ? ' is-active' : ''}${needsHold ? ' is-hold' : ''}${t.action === 'none' ? ' is-off' : ''}`,
      'aria-pressed': t.action === 'guard' ? String(live.guard) : (active ? 'true' : null),
      disabled: t.action === 'none',
    },
    h('span', { class: 'tch-tile-ico', 'aria-hidden': 'true' }, t.icon || '•'),
    h('span', { class: 'tch-tile-label' }, t.label || touchActions(runner.data.variants)[t.action]?.name || ''),
    needsHold ? h('span', { class: 'tch-tile-hint' }, live.guard ? 'Halten zum Ausschalten' : 'Halten zum Einschalten') : null,
    t.action === 'guard' ? h('span', { class: 'tch-tile-state' }, live.guard ? 'AN' : 'AUS') : null);
    btn.style.setProperty('--c', t.color || c.accent);
    if (needsHold) holdToFire(btn, () => fire(t, btn));
    else btn.addEventListener('click', () => { if (!swiped) fire(t, btn); });
    return btn;
  }

  // Langes Drücken (0,8 s) für Aktionen mit Folgen; der Ring zeigt den Fortschritt
  function holdToFire(btn, done) {
    let t = 0;
    const stop = () => { clearTimeout(t); btn.classList.remove('is-holding'); };
    btn.addEventListener('pointerdown', (e) => {
      if (e.button) return;
      btn.classList.add('is-holding');
      t = setTimeout(() => { stop(); if (!swiped) done(); }, 800);
    });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(ev, stop);
    btn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); done(); } });
  }

  async function fire(t, btn) {
    if (t.action === 'goto') { go(t.arg || 'home'); return; }
    if (t.action === 'idea') { nextIdea(); go('ideas'); return; }
    if (busy) return;
    busy = true;
    btn?.classList.add('is-hit');
    try {
      const r = await runner.run(t, live);
      Object.assign(live, r.live);
      if (r.text) toast(r.text);
      paint();
    } catch (err) {
      onError(err);
      toast(`⚠️ ${err?.message || 'Hat nicht geklappt.'}`, true);
    } finally {
      busy = false;
      setTimeout(() => btn?.classList.remove('is-hit'), 350);
    }
  }

  function liveCards() {
    const pct = Math.min(100, Math.round((live.alertsToday / target) * 100));
    const a = live.alert ? alertText(live.alert) : null;
    const guardTile = { action: 'guard', arg: '', label: 'Raid-Schutz', icon: '🛡️', color: live.guard ? '#3ddc84' : '#8e8e9a' };
    return [h('div', { class: 'tch-live' },
      h('div', { class: 'tch-card tch-card--goal' },
        h('span', { class: 'tch-card-k' }, 'Alerts heute'),
        h('strong', { class: 'tch-big' }, `${live.alertsToday}`, h('small', {}, ` / ${target}`)),
        h('span', { class: 'tch-bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(target), 'aria-valuenow': String(live.alertsToday), 'aria-label': 'Alerts heute' },
          h('i', { style: { width: `${pct}%` } }))),
      h('div', { class: 'tch-card' },
        h('span', { class: 'tch-card-k' }, 'Letzter Alert'),
        h('strong', {}, a ? `${a.icon} ${live.alert.user_name || a.title}` : 'noch keiner'),
        a ? h('span', { class: 'tch-card-sub' }, `${a.title}${live.alert.test ? ' · Probe' : ''}`) : null),
      h('div', { class: 'tch-card' },
        h('span', { class: 'tch-card-k' }, 'Letzte Drehung'),
        h('strong', {}, live.spin ? `🎡 ${live.spin.result ?? 'Glücksrad'}` : 'noch keine'),
        live.spin ? h('span', { class: 'tch-card-sub' }, live.spin.variant_name ?? '') : null),
      tileBtn(guardTile, { wide: true }))];
  }

  function nextIdea() {
    const list = (runner.data.tiles ?? []).filter((t) => t.title && t.id !== idea?.id);
    idea = list.length ? list[Math.floor(Math.random() * list.length)] : idea;
  }
  function ideaCard() {
    if (!idea) nextIdea();
    return [h('div', { class: 'tch-idea' },
      h('span', { class: 'tch-card-k' }, '💡 Content-Idee'),
      h('strong', { class: 'tch-idea-title' }, idea?.title ?? 'Noch keine Content-Ideen'),
      idea?.description ? h('p', { class: 'tch-idea-text' }, idea.description) : null,
      h('button', { type: 'button', class: 'tch-btn', onclick: () => { nextIdea(); paint(); } }, '🔀 Andere Idee'))];
  }

  // ---------- Seiten wechseln: Reiter unten oder wischen ----------
  function go(p) {
    if (!c.pages.includes(p)) return;
    page = p;
    tabs.querySelectorAll('.tch-tab').forEach((b) => (b.dataset.tch === p ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
    place(true);
  }
  function place(animate) {
    const i = Math.max(0, c.pages.indexOf(page));
    track.style.transition = animate ? '' : 'none';
    track.style.transform = `translateX(${-i * 100}%)`;
    track.querySelectorAll('.tch-page').forEach((s) => { s.inert = s.dataset.page !== page; });
  }

  let swiped = false;
  let start = null;
  track.addEventListener('pointerdown', (e) => { start = { x: e.clientX, y: e.clientY }; swiped = false; });
  track.addEventListener('pointermove', (e) => {
    if (!start) return;
    const dx = e.clientX - start.x;
    if (Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(e.clientY - start.y)) swiped = true;
  });
  track.addEventListener('pointerup', (e) => {
    if (!start) return;
    const dx = e.clientX - start.x;
    const scale = screen.getBoundingClientRect().width / screen.offsetWidth || 1;
    start = null;
    if (!swiped || Math.abs(dx) < 50 * scale) return;
    const i = c.pages.indexOf(page) + (dx < 0 ? 1 : -1);
    if (i >= 0 && i < c.pages.length) go(c.pages[i]);
    setTimeout(() => { swiped = false; }, 0);
  });
  track.addEventListener('pointercancel', () => { start = null; });

  // ---------- Meldungen, Bildschirmschoner, Uhr ----------
  function toast(text, bad = false) {
    toastEl.textContent = text;
    toastEl.classList.toggle('is-bad', bad);
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 2600);
  }

  function paintSaver() {
    const a = live.alert ? alertText(live.alert) : null;
    saver.replaceChildren(
      h('span', { class: 'tch-saver-clock' }, clock()),
      h('span', { class: 'tch-saver-date' }, new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })),
      h('span', { class: 'tch-saver-sub' }, a ? `${a.icon} ${live.alert.user_name || a.title} · Alerts heute ${live.alertsToday}` : `Alerts heute ${live.alertsToday}`),
      h('span', { class: 'tch-saver-hint' }, 'Tippen zum Aufwecken'),
    );
  }
  function sleep() {
    if (saver.hidden) { paintSaver(); saver.hidden = false; }
  }
  function wake() {
    clearTimeout(idleTimer);
    if (c.idle > 0) idleTimer = setTimeout(sleep, c.idle * 60000);
  }
  saver.addEventListener('click', () => { saver.hidden = true; wake(); });
  screen.addEventListener('pointerdown', wake, { capture: true });
  screen.addEventListener('contextmenu', (e) => e.preventDefault());
  clockTimer = setInterval(() => {
    status.querySelector('.tch-clock').textContent = clock();
    if (!saver.hidden) paintSaver();
  }, 15000);

  layout();
  paint();
  wake();

  return {
    setConfig(next) {
      const prev = c;
      c = normalizeTouch(next);
      if (prev.size !== c.size || prev.orient !== c.orient) layout();
      if (prev.start !== c.start) page = c.start;
      paint();
      wake();
    },
    setLive(next) { Object.assign(live, next); if (!busy) paint(); },
    setGoal(n) { target = Math.max(1, Number(n) || 10); paint(); },
    sleep,
    destroy() {
      ro.disconnect();
      clearTimeout(idleTimer);
      clearTimeout(toastTimer);
      clearInterval(clockTimer);
      frame.remove();
    },
  };
}
