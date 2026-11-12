// Console (Entwurf) – admin.html → „Console“ (früher im Dashboard), nur für Plattform-Admins (Migration …_console.sql).
// 9 Tasten lösen bestehende Aktionen aus (Szene, Glücksrad, Sound, Test-Alert, Raid-Schutz, Bereich öffnen),
// der Ideen-Knopf schlägt Content-Ideen vor, die Anzeige zeigt Live-Daten. Belegung je Kanal in
// core.console_config (console_get / console_save).
import { h } from './extras-core.js';
import { BOARD } from './prank-fx.js';
import { ALERT_KINDS, alertText } from './alerts.js';
import { colorKeys, console3dActive, drawConsoleDisplay, mountConsole3d, setBoxMode, setConsoleBox, setConsoleLook, setConsolePorts, setConsoleSpin, showConsoleSide } from './dash-console-3d.js';
import { kitBoxSpec, kitLook, kitPorts, kitRearOpts, normalizeKit, renderKit } from './dash-console-kit.js';
import { renderRear } from './dash-console-rear.js';
import { renderSpecCard } from './dash-console-spec.js';
import { renderSurvey } from './dash-console-survey.js';
import { renderTips } from './dash-console-tips.js';

const SCENES = [['', 'Live (kein Szenen-Bildschirm)'], ['start', 'Gleich geht’s los'], ['chat', 'Just Chatting'], ['brb', 'Bin gleich zurück'], ['end', 'Danke fürs Zuschauen']];
const PAGES = [['ideas', 'Content-Ideen'], ['bot', 'Bot & Chat'], ['overlay', 'Overlay & OBS'], ['guard', 'Raid-Schutz'], ['raids', 'Raid-Netzwerk'], ['stats', 'Statistik']];
const COLORS = ['#9146ff', '#ffb81c', '#ff5a4e', '#ff7a28', '#3ddc84', '#35c7ff', '#ff4fd8', '#8e8e9a'];
const WIDGETS = [['alert', 'Letzter Alert'], ['spin', 'Letzte Drehung'], ['guard', 'Raid-Schutz'], ['scene', 'Aktive Szene']];

export const CONSOLE_DEFAULT_KEYS = [
  { action: 'scene', arg: '', label: 'Live', icon: '🔴', color: '#ff5a4e' },
  { action: 'scene', arg: 'start', label: 'Gleich los', icon: '⏳', color: '#ffb81c' },
  { action: 'scene', arg: 'brb', label: 'Pause', icon: '☕', color: '#ff7a28' },
  { action: 'spin', arg: '', label: 'Glücksrad', icon: '🎡', color: '#9146ff' },
  { action: 'sound', arg: 'rimshot', label: 'Ba-dum-tss', icon: '🥁', color: '#35c7ff' },
  { action: 'sound', arg: 'applause', label: 'Applaus', icon: '👏', color: '#3ddc84' },
  { action: 'alert', arg: 'follow', label: 'Test-Alert', icon: '💜', color: '#ff4fd8' },
  { action: 'guard', arg: '', label: 'Raid-Schutz', icon: '🛡️', color: '#8e8e9a' },
  { action: 'page', arg: 'overlay', label: 'OBS', icon: '🎛️', color: '#8e8e9a' },
];
const DEFAULT_DISPLAY = { cards: ['alert', 'spin'], goal: 10 };
const EMPTY_KEY = { action: 'none', arg: '', label: '', icon: '', color: '' };

let ctx = null;   // { api, toast, germanError, variants, tiles, streamer, setPage, openTile, guardActive, guardSet }
let cfg = null;   // { keys, display, updated_by, updated_at }
let draft = null; // Kopie beim Bearbeiten
let editing = false;
let picked = 0;
let live = { alert: null, spin: null, scene: '', alertsToday: 0 };
let idea = null;
let timer = 0;
let root = null;
let main = null;     // Gerät + Bearbeiten (wird neu gezeichnet)
let kitBox = null;   // Technik-Baukasten
let kitTimer = 0;
let localModel = null; // lokal gewählte .obj-Datei (noch nicht gespeichert)

// Was eine Taste kann: Name und die Ziele, aus denen man wählt
function actions() {
  const variants = ctx.variants() ?? [];
  return {
    none: { name: 'Nichts', args: null },
    scene: { name: 'Szene wechseln', args: SCENES },
    spin: { name: 'Glücksrad drehen', args: [['', 'gerade gewählte Variante'], ...variants.map((v) => [String(v.id), v.name])] },
    sound: { name: 'Sound abspielen', args: BOARD.map((b) => [b.id, `${b.emoji} ${b.name}`]) },
    alert: { name: 'Test-Alert', args: ALERT_KINDS.map((k) => [k.kind, k.label]) },
    guard: { name: 'Raid-Schutz an/aus', args: null },
    page: { name: 'Bereich öffnen', args: PAGES },
  };
}
const argName = (k) => actions()[k.action]?.args?.find(([v]) => v === (k.arg ?? ''))?.[1] ?? '';

const missing = (err) => /console_get|console_save|console_config/.test(err?.message ?? '');
const clean = (k) => ({
  action: Object.hasOwn(actions(), k?.action) ? k.action : 'none',
  arg: String(k?.arg ?? '').slice(0, 64), label: String(k?.label ?? '').slice(0, 24),
  icon: String(k?.icon ?? '').slice(0, 8), color: /^#[0-9a-fA-F]{6}$/.test(k?.color ?? '') ? k.color : '',
});
function normalize(c) {
  const keys = Array.isArray(c?.keys) && c.keys.length ? c.keys : CONSOLE_DEFAULT_KEYS;
  const nine = Array.from({ length: 9 }, (_, i) => clean(keys[i] ?? EMPTY_KEY));
  const d = c?.display ?? {};
  const cards = Array.isArray(d.cards) ? d.cards : DEFAULT_DISPLAY.cards;
  const pick = (w, fallback) => (WIDGETS.some(([id]) => id === w) ? w : fallback);
  const goal = Number(d.goal);
  return {
    keys: nine,
    display: {
      cards: [pick(cards[0], 'alert'), pick(cards[1], 'spin')], goal: Number.isFinite(goal) && goal >= 1 && goal <= 999 ? Math.round(goal) : DEFAULT_DISPLAY.goal,
      ...(d.touch && typeof d.touch === 'object' ? { touch: d.touch } : {}), // Touch-Bildschirm (js/dash-console-touch.js) unverändert mitspeichern
    },
    kit: normalizeKit(c?.kit),
    updated_by: c?.updated_by ?? '', updated_at: c?.updated_at ?? null,
  };
}

export async function renderConsole(slot, deps) {
  ctx = deps;
  root = slot;
  clearInterval(timer);
  slot.replaceChildren(h('p', { class: 'form-hint' }, 'Lädt …'));
  try {
    cfg = normalize(await ctx.api.consoleGet());
  } catch (err) {
    slot.replaceChildren(h('section', { class: 'dash-card dash-card--wide cs-error' },
      h('h2', {}, 'Console (Entwurf)'),
      h('p', { class: 'form-hint' }, missing(err)
        ? 'Die Console ist noch nicht eingerichtet: Migration supabase/migrations/20261221000000_console.sql im SQL Editor ausführen.'
        : ctx.germanError(err))));
    return;
  }
  editing = false;
  draft = null;
  main = h('div', { class: 'cs-main' });
  kitBox = h('div', { class: 'cs-kit' });
  slot.replaceChildren(main, model3dCard(), kitBox);
  paint();
  paintKit();
  refresh();
  loadSavedModel(true);
  // Display aktuell halten, solange die Seite offen ist
  timer = setInterval(() => {
    if (!root?.isConnected || root.closest('.page, .adm-view')?.hidden) { clearInterval(timer); return; }
    refresh();
  }, 15000);
}

async function refresh() {
  const today = new Date().toDateString();
  const [alerts, spins, overlay] = await Promise.all([
    ctx.api.getAlerts(50).catch(() => []),
    ctx.api.getSpins(1).catch(() => []),
    ctx.api.getOverlayConfig().catch(() => null),
  ]);
  live = {
    alert: alerts[0] ?? null,
    spin: spins[0] ?? null,
    scene: new URLSearchParams(overlay?.params ?? '').get('scene') ?? '',
    alertsToday: alerts.filter((a) => !a.test && new Date(a.created_at).toDateString() === today).length,
  };
  paintDisplay();
}

// ---------- Zeichnen ----------
function paint() {
  const c = editing ? draft : cfg;
  main.replaceChildren(
    h('section', { class: 'dash-card dash-card--wide cs-card' },
      h('header', { class: 'cs-head' },
        h('div', {},
          h('h2', {}, 'StreamHelp Console ', h('span', { class: 'cs-badge' }, 'Entwurf · nur Admins')),
          h('p', { class: 'dash-status' }, editing
            ? 'Bearbeiten: Taste anklicken, unten belegen, dann speichern.'
            : `Capture Card mit Tastenpult. Die Tasten lösen die Aktion wirklich aus – im Kanal ${ctx.streamer() || 'StreamHelp'}.`)),
        h('div', { class: 'cs-head-btns' }, editing
          ? [h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: cancelEdit }, 'Abbrechen'),
            h('button', { class: 'btn btn--primary btn--sm', type: 'button', onclick: (e) => save(e.currentTarget) }, 'Speichern')]
          : h('button', { class: 'btn btn--outline btn--sm', type: 'button', onclick: startEdit }, h('i', { class: 'ph ph-pencil-simple', 'aria-hidden': 'true' }), ' Bearbeiten'))),
      h('div', { class: `cs-device${editing ? ' is-editing' : ''}`, role: 'group', 'aria-label': 'Virtuelle Console' },
        h('div', { class: 'cs-keys' }, ...c.keys.map((k, i) => keyButton(k, i))),
        h('button', { class: 'cs-bulb', type: 'button', title: 'Content-Idee vorschlagen', 'aria-label': 'Content-Idee vorschlagen', onclick: suggestIdea },
          h('i', { class: 'ph ph-lightbulb', 'aria-hidden': 'true' })),
        h('div', { class: 'cs-display', id: 'cs-display', 'aria-live': 'polite' })),
      editing ? editor() : h('p', { class: 'form-hint cs-foot' },
        cfg.updated_at ? `Zuletzt geändert von ${cfg.updated_by || 'einem Admin'} am ${new Date(cfg.updated_at).toLocaleString('de-DE')}.` : 'Noch die Standard-Belegung.')));
  paintDisplay();
  colorKeys(c.keys);
}

function keyButton(k, i) {
  const empty = k.action === 'none';
  const title = empty ? 'Nicht belegt' : `${actions()[k.action]?.name ?? ''}${argName(k) ? `: ${argName(k)}` : ''}`;
  const btn = h('button', {
    class: `cs-key${empty ? ' is-empty' : ''}${editing && picked === i ? ' is-picked' : ''}`, type: 'button', title,
    'aria-label': `Taste ${i + 1}: ${k.label || title}`,
    onclick: (e) => (editing ? pick(i) : press(k, e.currentTarget)),
  }, h('span', { class: 'cs-key-ico', 'aria-hidden': 'true' }, k.icon || (empty ? '·' : '■')), h('span', { class: 'cs-key-label' }, k.label || (empty ? 'leer' : title)));
  if (k.color) btn.style.setProperty('--k', k.color);
  if (k.action === 'guard') btn.classList.toggle('is-on', !!ctx.guardActive());
  if (k.action === 'scene') btn.classList.toggle('is-on', (k.arg ?? '') === live.scene);
  return btn;
}

function paintDisplay() {
  const box = root?.querySelector('#cs-display');
  if (!box) return;
  const c = editing ? draft : cfg;
  const sceneName = SCENES.find(([id]) => id === live.scene)?.[1] ?? 'Live';
  const card = (w) => {
    if (w === 'alert') {
      if (!live.alert) return dcard('🔔', 'Letzter Alert', 'noch keiner');
      const t = alertText(live.alert);
      return dcard(t.icon, live.alert.user_name || t.title, `${t.title}${live.alert.test ? ' · Probe' : ''}`);
    }
    if (w === 'spin') return live.spin ? dcard('🎡', live.spin.result ?? 'Glücksrad', `${live.spin.variant_name ?? 'Glücksrad'} · ${live.spin.requested_by ?? ''}`) : dcard('🎡', 'Letzte Drehung', 'noch keine');
    if (w === 'guard') return ctx.guardActive() ? dcard('🛡️', 'Raid-Schutz an', 'Zuschauer-Aktionen pausiert') : dcard('🛡️', 'Raid-Schutz aus', 'alles läuft normal');
    return dcard('🎬', 'Szene', sceneName);
  };
  const goal = c.display.goal;
  const pct = Math.min(100, Math.round((live.alertsToday / goal) * 100));
  if (console3dActive()) {
    const data = (w) => {
      if (w === 'alert') {
        if (!live.alert) return { icon: '🔔', title: 'Letzter Alert', sub: 'noch keiner' };
        const t = alertText(live.alert);
        return { icon: t.icon, title: live.alert.user_name || t.title, sub: t.title };
      }
      if (w === 'spin') return live.spin ? { icon: '🎡', title: live.spin.result ?? 'Glücksrad', sub: live.spin.variant_name ?? 'Glücksrad' } : { icon: '🎡', title: 'Letzte Drehung', sub: 'noch keine' };
      if (w === 'guard') return ctx.guardActive() ? { icon: '🛡️', title: 'Raid-Schutz an', sub: 'Aktionen pausiert' } : { icon: '🛡️', title: 'Raid-Schutz aus', sub: 'alles normal' };
      return { icon: '🎬', title: 'Szene', sub: sceneName };
    };
    drawConsoleDisplay({
      title: ctx.streamer() || 'Kanal', sub: sceneName,
      cards: [idea ? { icon: '💡', title: idea.title || 'Content-Idee', sub: 'Vorschlag', idea: true } : data(c.display.cards[0]), data(c.display.cards[1])],
      goalText: `Alerts heute ${live.alertsToday} / ${c.display.goal}`, pct: Math.min(100, Math.round((live.alertsToday / c.display.goal) * 100)),
    });
  }
  box.replaceChildren(
    h('p', { class: 'cs-d-title' }, h('b', {}, ctx.streamer() || 'Kanal'), h('span', {}, ` · ${sceneName}`)),
    idea ? ideaCard() : card(c.display.cards[0]),
    card(c.display.cards[1]),
    h('div', { class: 'cs-d-goal' },
      h('span', {}, `Alerts heute ${live.alertsToday} / ${goal}`),
      h('span', { class: 'cs-d-bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(goal), 'aria-valuenow': String(live.alertsToday), 'aria-label': 'Alerts heute' },
        h('span', { style: `width:${pct}%` }))));
}
const dcard = (ico, title, sub) => h('div', { class: 'cs-d-card' },
  h('span', { class: 'cs-d-ico', 'aria-hidden': 'true' }, ico),
  h('span', { class: 'cs-d-text' }, h('b', {}, title), h('small', {}, sub)));
const ideaCard = () => h('div', { class: 'cs-d-card is-idea' },
  h('span', { class: 'cs-d-ico', 'aria-hidden': 'true' }, '💡'),
  h('span', { class: 'cs-d-text' }, h('b', {}, idea.title || 'Content-Idee'), h('small', {}, 'Vorschlag – nochmal 💡 für die nächste')),
  h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: () => ctx.openTile(idea) }, 'Öffnen'));

// ---------- Tasten auslösen ----------
async function press(k, btn) {
  if (k.action === 'none') return;
  btn.classList.add('is-busy');
  btn.disabled = true;
  try {
    const msg = await run(k);
    if (msg) ctx.toast(msg, 'ok', 2500);
  } catch (err) {
    ctx.toast(ctx.germanError(err), 'error');
  } finally {
    btn.disabled = false;
    btn.classList.remove('is-busy');
    btn.classList.add('is-hit');
    setTimeout(() => btn.classList.remove('is-hit'), 400);
    refresh();
  }
}

async function run(k) {
  const arg = k.arg ?? '';
  switch (k.action) {
    case 'scene': {
      const overlay = await ctx.api.getOverlayConfig();
      const p = new URLSearchParams(overlay?.params ?? '');
      if (arg) p.set('scene', arg);
      else p.delete('scene');
      await ctx.api.saveOverlayConfig(p.toString());
      live.scene = arg;
      paint();
      return `Szene: ${SCENES.find(([id]) => id === arg)?.[1] ?? 'Live'}`;
    }
    case 'spin': {
      const variants = ctx.variants() ?? [];
      const v = variants.find((x) => String(x.id) === arg) ?? ctx.currentVariant() ?? variants[0];
      if (!v) throw new Error('Es gibt noch keine Glücksrad-Variante.');
      const r = await ctx.api.spin(v.id, true);
      return `🎡 ${r?.spin?.result ?? 'Gedreht'}`;
    }
    case 'sound':
      await ctx.api.sendPrank('sound', arg || BOARD[0].id);
      return `🔊 ${BOARD.find((b) => b.id === arg)?.name ?? 'Sound'}`;
    case 'alert':
      await ctx.api.testAlert(arg || 'follow');
      return 'Test-Alert geschickt';
    case 'guard': {
      const on = await ctx.guardSet(!ctx.guardActive());
      paint();
      return on ? 'Raid-Schutz ist an' : 'Raid-Schutz ist aus';
    }
    case 'page':
      ctx.setPage(arg || 'ideas');
      return '';
    default:
      return '';
  }
}

function suggestIdea() {
  const tiles = (ctx.tiles() ?? []).filter((t) => t.title && t.id !== idea?.id);
  if (!tiles.length) { ctx.toast('Noch keine Content-Ideen.', 'info'); return; }
  idea = tiles[Math.floor(Math.random() * tiles.length)];
  paintDisplay();
}

// ---------- Bearbeiten ----------
function startEdit() {
  draft = structuredClone(cfg);
  editing = true;
  picked = 0;
  idea = null;
  paint();
}
function cancelEdit() {
  editing = false;
  draft = null;
  paint();
}
function pick(i) {
  picked = i;
  paint();
  main.querySelector('.cs-edit [name="action"]')?.focus();
}

function editor() {
  const k = draft.keys[picked];
  const acts = actions();
  const opts = (list, current) => list.map(([v, t]) => h('option', { value: v, selected: v === current }, t));
  const set = (patch) => { draft.keys[picked] = clean({ ...draft.keys[picked], ...patch }); paint(); };
  const args = acts[k.action]?.args;
  return h('div', { class: 'cs-edit' },
    h('fieldset', { class: 'cs-edit-key' },
      h('legend', {}, `Taste ${picked + 1}`),
      h('label', { class: 'field' }, h('span', {}, 'Aktion'),
        h('select', { name: 'action', onchange: (e) => set({ action: e.target.value, arg: acts[e.target.value]?.args?.[0]?.[0] ?? '' }) },
          ...opts(Object.entries(acts).map(([id, a]) => [id, a.name]), k.action))),
      args ? h('label', { class: 'field' }, h('span', {}, 'Ziel'),
        h('select', { name: 'arg', onchange: (e) => set({ arg: e.target.value }) }, ...opts(args, k.arg ?? ''))) : null,
      h('label', { class: 'field' }, h('span', {}, 'Name auf der Taste'),
        h('input', { name: 'label', maxlength: '24', value: k.label, autocomplete: 'off', onchange: (e) => set({ label: e.target.value.trim() }) })),
      h('label', { class: 'field cs-edit-icon' }, h('span', {}, 'Symbol'),
        h('input', { name: 'icon', maxlength: '8', value: k.icon, autocomplete: 'off', placeholder: 'z. B. 🎡', onchange: (e) => set({ icon: e.target.value.trim() }) })),
      h('div', { class: 'cs-swatches', role: 'radiogroup', 'aria-label': 'Farbe der Taste' },
        ...COLORS.map((c) => h('button', {
          class: 'cs-swatch', type: 'button', role: 'radio', 'aria-checked': String(k.color === c), 'aria-label': `Farbe ${c}`,
          style: `--k:${c}`, onclick: () => set({ color: c }),
        })),
        h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: () => set({ ...EMPTY_KEY }) }, 'Taste leeren'))),
    h('fieldset', { class: 'cs-edit-display' },
      h('legend', {}, 'Display'),
      h('label', { class: 'field' }, h('span', {}, 'Karte oben'),
        h('select', { name: 'card1', onchange: (e) => { draft.display.cards[0] = e.target.value; paintDisplay(); } }, ...opts(WIDGETS, draft.display.cards[0]))),
      h('label', { class: 'field' }, h('span', {}, 'Karte unten'),
        h('select', { name: 'card2', onchange: (e) => { draft.display.cards[1] = e.target.value; paintDisplay(); } }, ...opts(WIDGETS, draft.display.cards[1]))),
      h('label', { class: 'field' }, h('span', {}, 'Tagesziel Alerts'),
        h('input', { name: 'goal', type: 'number', min: '1', max: '999', value: String(draft.display.goal),
          onchange: (e) => { const n = Math.round(Number(e.target.value)); draft.display.goal = n >= 1 && n <= 999 ? n : DEFAULT_DISPLAY.goal; paintDisplay(); } })),
      h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: resetDefaults }, 'Standard-Belegung')));
}

function resetDefaults() {
  draft = { ...normalize({ keys: CONSOLE_DEFAULT_KEYS, display: { ...DEFAULT_DISPLAY, touch: cfg.display.touch } }), kit: cfg.kit };
  paint();
}

async function save(btn) {
  btn.disabled = true;
  try {
    const kit = cfg.kit;
    cfg = normalize(await ctx.api.consoleSave(draft.keys, draft.display));
    cfg.kit = kit;
    editing = false;
    draft = null;
    ctx.toast('Console gespeichert.', 'ok');
    paint();
    setConsoleBox(kitBoxSpec(cfg.kit, cfg.keys)); // Aufdruck nutzt die Tastenfarben
  } catch (err) {
    ctx.toast(missing(err) ? 'Erst die Migration …_console.sql ausführen.' : ctx.germanError(err), 'error');
    btn.disabled = false;
  }
}

// ---------- 3D-Ansicht (js/dash-console-3d.js) ----------
function model3dCard() {
  const status = h('p', { class: 'form-hint cs-3d-status', id: 'cs-3d-status', 'aria-live': 'polite' }, 'Lädt das gespeicherte Modell …');
  const file = h('input', { type: 'file', accept: '.obj,text/plain,model/obj', class: 'sr-only', id: 'cs-3d-file', onchange: (e) => pickModel(e.target.files[0]) });
  return h('section', { class: 'dash-card dash-card--wide cs-3d-card' },
    h('header', { class: 'cs-head' },
      h('div', {}, h('h2', {}, '3D-Ansicht'),
        h('p', { class: 'dash-status' }, 'Ziehen dreht, Mausrad zoomt, ein Klick auf eine Taste löst sie aus. Tastenfarben und Display kommen aus der Belegung, Anschlüsse und Rückseite aus dem Baukasten.')),
      h('div', { class: 'cs-head-btns' },
        h('label', { class: 'toggle' }, h('input', { type: 'checkbox', id: 'cs-3d-spin', onchange: (e) => setConsoleSpin(e.target.checked) }), h('span', { class: 'toggle-ui', 'aria-hidden': 'true' }), 'Drehen'),
        h('select', { id: 'cs-3d-mode', class: 'cs-3d-mode', 'aria-label': 'Ansicht', onchange: (e) => setView(e.target.value) },
          h('option', { value: 'off' }, 'Gerät: vorne'),
          h('option', { value: 'left' }, 'Gerät: linke Seite'),
          h('option', { value: 'back' }, 'Gerät: Rückseite'),
          h('option', { value: 'closed' }, 'Verpackung: zu'),
          h('option', { value: 'open' }, 'Verpackung: offen'),
          h('option', { value: 'cut' }, 'Verpackung: Innenansicht')),
        h('label', { class: 'btn btn--outline btn--sm', for: 'cs-3d-file' }, file, 'Modell wählen (.obj)'),
        h('button', { class: 'btn btn--primary btn--sm', type: 'button', id: 'cs-3d-save', hidden: true, onclick: (e) => uploadModel(e.currentTarget) }, 'Für Admins speichern'))),
    h('div', { class: 'cs-3d-host', id: 'cs-3d-host' }),
    status);
}

// Ansicht der 3D-Karte: Gerät (vorne, links, hinten) oder Verpackung
function setView(v) {
  const sel = root?.querySelector('#cs-3d-mode');
  if (sel) sel.value = v;
  if (['left', 'back'].includes(v)) {
    setBoxMode('off');
    showConsoleSide(v);
  } else setBoxMode(v);
}

const set3dStatus = (text) => { const el = root?.querySelector('#cs-3d-status'); if (el) el.textContent = text; };

async function show3d(text, source) {
  const host = root?.querySelector('#cs-3d-host');
  if (!host) return;
  set3dStatus('Baut das Modell auf …');
  try {
    await mountConsole3d(host, { objText: text, keys: (editing ? draft : cfg).keys, onKey: on3dKey });
    root.querySelector('#cs-3d-spin').checked = false;
    setConsolePorts(kitPorts(cfg.kit), kitRearOpts(cfg.kit));
    setConsoleLook(kitLook(cfg.kit));
    setConsoleBox(kitBoxSpec(cfg.kit, cfg.keys));
    root.querySelector('#cs-3d-mode').value = 'off';
    paintDisplay();
    set3dStatus(source);
  } catch (err) {
    console.error('3D-Ansicht:', err);
    host.replaceChildren();
    set3dStatus(`Das Modell ließ sich nicht anzeigen: ${ctx.germanError(err)}`);
  }
}

async function loadSavedModel(quiet = false) {
  try {
    const text = await ctx.api.consoleModelGet();
    if (!text) {
      set3dStatus('Noch kein Modell gespeichert – „Modell wählen (.obj)“ zeigt eine Datei an, „Für Admins speichern“ legt sie im privaten Speicher ab.');
      return;
    }
    await show3d(text, 'Gespeichertes Modell (privater Speicher, nur Plattform-Admins).');
  } catch (err) {
    set3dStatus(/bucket|console-private/i.test(err?.message ?? '') ? 'Der private Speicher fehlt noch: Migration …_console_kit.sql ausführen.' : `Modell nicht geladen: ${ctx.germanError(err)}`);
    if (!quiet) ctx.toast(ctx.germanError(err), 'error');
  }
}

async function pickModel(f) {
  if (!f) return;
  if (f.size > 12 * 1024 * 1024) { ctx.toast('Das Modell ist größer als 12 MB.', 'error'); return; }
  localModel = f;
  await show3d(await f.text(), `Lokal gewählt: ${f.name} – noch nicht gespeichert.`);
  root.querySelector('#cs-3d-save').hidden = false;
}

async function uploadModel(btn) {
  if (!localModel) return;
  btn.disabled = true;
  try {
    await ctx.api.consoleModelUpload(localModel);
    set3dStatus(`${localModel.name} ist gespeichert (privater Speicher, nur Plattform-Admins).`);
    ctx.toast('Modell gespeichert.', 'ok');
    localModel = null;
    btn.hidden = true;
  } catch (err) {
    ctx.toast(/bucket/i.test(err?.message ?? '') ? 'Erst die Migration …_console_kit.sql ausführen.' : ctx.germanError(err), 'error');
  } finally {
    btn.disabled = false;
  }
}

function on3dKey(i) {
  if (editing) { pick(i); return; }
  const btn = main.querySelectorAll('.cs-key')[i];
  if (btn) press(cfg.keys[i], btn);
}

// ---------- Technik-Baukasten (js/dash-console-kit.js) ----------
function paintKit() {
  setConsolePorts(kitPorts(cfg.kit), kitRearOpts(cfg.kit));
  setConsoleLook(kitLook(cfg.kit));
  setConsoleBox(kitBoxSpec(cfg.kit, cfg.keys));
  const onChange = (kit) => {
    cfg.kit = normalizeKit(kit);
    paintKit();
    clearTimeout(kitTimer);
    kitTimer = setTimeout(saveKit, 700);
  };
  const cards = renderKit({ kit: cfg.kit, me: () => ctx.me(), onChange });
  cards.splice(2, 0, renderTips({ kit: cfg.kit, onChange })); // nach „Kosten und Preis“
  cards.splice(4, 0, renderSurvey({ kit: cfg.kit, onChange })); // nach „Was kommt in Version 1?“
  cards.splice(5, 0, renderRear({ kit: cfg.kit, onChange, onShow: showRear }));
  cards.push(renderSpecCard({ kit: cfg.kit, keys: cfg.keys, by: cfg.updated_by, at: cfg.updated_at, toast: ctx.toast }));
  kitBox.replaceChildren(...cards);
}

function showRear() {
  const card = root?.querySelector('.cs-3d-card');
  ctx.show3d?.(); // Admin-Bereich: Reiter „3D-Ansicht“ öffnen
  if (!console3dActive()) { ctx.toast('Erst ein Modell laden („Modell wählen (.obj)“).', 'info'); card?.scrollIntoView({ behavior: 'smooth' }); return; }
  setView('back');
  card?.scrollIntoView({ behavior: 'smooth' });
}

async function saveKit() {
  try {
    const res = normalize(await ctx.api.consoleKitSave(cfg.kit));
    cfg.kit = res.kit;
  } catch (err) {
    ctx.toast(/console_kit_save|kit/i.test(err?.message ?? '') && /function|column/i.test(err?.message ?? '')
      ? 'Baukasten nicht gespeichert: Migration …_console_kit.sql ausführen.' : `Baukasten nicht gespeichert: ${ctx.germanError(err)}`, 'error');
  }
}
