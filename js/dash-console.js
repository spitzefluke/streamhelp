// Console (Entwurf) – admin.html → „Console“ (früher im Dashboard), nur für Plattform-Admins (Migration …_console.sql).
// 9 Tasten lösen bestehende Aktionen aus (Szene, Glücksrad, Sound, Test-Alert, Raid-Schutz, Bereich öffnen),
// der Ideen-Knopf schlägt Content-Ideen vor, die Anzeige zeigt Live-Daten. Belegung je Kanal in
// core.console_config (console_get / console_save).
import { h } from './extras-core.js';
import { BOARD } from './prank-fx.js';
import { ALERT_KINDS, alertText } from './alerts.js';
import { colorKeys, console3dActive, exportConsolePng, mountConsole3d, paintConsoleScreen, setBoxMode, setConsoleBox, setConsoleGlow, setConsoleLeds, setConsoleLook, setConsolePorts, setConsoleSpin, showConsoleSide, showConsoleView } from './dash-console-3d.js';
import { EVENT_SECONDS, EVENT_STYLES, EVENT_TARGETS, KEY_MODES, LIGHT_EFFECTS, LIGHT_EVENTS, eventForAlert, lightFrame, normalizeLight, startEvent } from './console-light.js';
import { drawTouchScreen } from './console-touch-draw.js';
import { linkTopic, shareLink } from './console-link.js';
import { normalizeTouch } from './console-touch.js';
import { kitBoxSpec, kitLook, kitPorts, kitRearOpts, normalizeKit, renderKit } from './dash-console-kit.js';
import { renderRear } from './dash-console-rear.js';
import { renderSpecCard } from './dash-console-spec.js';
import { renderManualCard } from './dash-console-manual.js';
import { renderAdsCard } from './dash-console-ads.js';
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

// Was eine Taste kann. args = Ziele zur Auswahl, input = Ziel frei eintippen (wenn keine Liste da ist),
// text = Textfeld (Chat-Nachricht, Umfrage), url = Webhook-Adresse. via: wo die Aktion läuft
// (bridge = Bridge am PC mit OBS/Streamer.bot, server = Edge Function mit der gespeicherten Taste).
const GROUPS = ['StreamHelp', 'OBS (Bridge am PC)', 'Twitch', 'Streamer.bot (auch Spotify & Co.)', 'Andere Apps', 'Mehrere Schritte'];
const AD_LENGTHS = [30, 60, 90, 120, 150, 180].map((n) => [String(n), `${n} Sekunden`]);
const POLL_SECS = [60, 120, 180, 300, 600].map((n) => [String(n), n < 120 ? `${n} Sekunden` : `${n / 60} Minuten`]);
const MACRO_MAX = 8;
let bridgeState = null; // letzter Zustand der Bridge (Szenen, Audioquellen, Streamer.bot-Aktionen)
let link = null;

function actions() {
  const variants = ctx.variants() ?? [];
  const b = bridgeState;
  const list = (arr) => (arr?.length ? arr : null);
  return {
    none: { name: 'Nichts', group: '', args: null },
    scene: { name: 'Overlay-Szene wechseln', group: 'StreamHelp', args: SCENES },
    spin: { name: 'Glücksrad drehen', group: 'StreamHelp', args: [['', 'gerade gewählte Variante'], ...variants.map((v) => [String(v.id), v.name])] },
    sound: { name: 'Sound abspielen', group: 'StreamHelp', args: BOARD.map((x) => [x.id, `${x.emoji} ${x.name}`]) },
    alert: { name: 'Test-Alert', group: 'StreamHelp', args: ALERT_KINDS.map((k) => [k.kind, k.label]) },
    guard: { name: 'Raid-Schutz an/aus', group: 'StreamHelp', args: null },
    page: { name: 'Bereich öffnen', group: 'StreamHelp', args: PAGES },
    obs_scene: { name: 'OBS: Szene wechseln', group: 'OBS (Bridge am PC)', via: 'bridge', args: list(b?.scenes?.map((n) => [n, n])), input: 'Name der Szene in OBS' },
    obs_mute: { name: 'OBS: Ton stumm/an', group: 'OBS (Bridge am PC)', via: 'bridge', args: list(b?.inputs?.map((i) => [i.name, i.name])), input: 'Name der Audioquelle in OBS' },
    obs_stream: { name: 'OBS: Stream starten/stoppen', group: 'OBS (Bridge am PC)', via: 'bridge', args: null },
    obs_record: { name: 'OBS: Aufnahme starten/stoppen', group: 'OBS (Bridge am PC)', via: 'bridge', args: null },
    obs_replay: { name: 'OBS: Replay speichern', group: 'OBS (Bridge am PC)', via: 'bridge', args: null },
    twitch_marker: { name: 'Twitch: Marker setzen', group: 'Twitch', via: 'server', args: null, input: 'Beschreibung (freiwillig)' },
    twitch_clip: { name: 'Twitch: Clip erstellen', group: 'Twitch', via: 'server', args: null },
    twitch_chat: { name: 'Twitch: Chat-Nachricht (Bot)', group: 'Twitch', via: 'server', args: null, text: { label: 'Nachricht', placeholder: 'z. B. Danke fürs Zuschauen! 💜' } },
    twitch_ad: { name: 'Twitch: Werbung starten', group: 'Twitch', via: 'server', args: AD_LENGTHS },
    twitch_poll: { name: 'Twitch: Umfrage starten', group: 'Twitch', via: 'server', args: POLL_SECS, text: { label: 'Frage | Antwort 1 | Antwort 2 …', placeholder: 'Was spielen wir als Nächstes? | Minecraft | Fortnite' } },
    sb_action: { name: 'Streamer.bot-Aktion starten', group: 'Streamer.bot (auch Spotify & Co.)', via: 'bridge',
      args: list(b?.sb?.actions?.map((a) => [a.id, a.group ? `${a.group}: ${a.name}` : a.name])), input: 'Aktions-ID aus Streamer.bot' },
    webhook: { name: 'Webhook aufrufen', group: 'Andere Apps', via: 'server', args: null, url: true, text: { label: 'Text, der mitgeschickt wird (freiwillig)', placeholder: 'z. B. Szene: Pause' } },
    macro: { name: 'Makro: mehrere Aktionen nacheinander', group: 'Mehrere Schritte', args: null },
  };
}
const argName = (k) => actions()[k.action]?.args?.find(([v]) => v === (k.arg ?? ''))?.[1] ?? '';

const missing = (err) => /console_get|console_save|console_config/.test(err?.message ?? '');
const URL_OK = /^https:\/\/[^\s<>"]{3,292}$/;
// Felder, die zur Aktion gehören; der Rest fällt weg (Taste und Makro-Schritt)
function cleanBody(k, acts) {
  const action = Object.hasOwn(acts, k?.action) ? k.action : 'none';
  const a = acts[action];
  const out = { action, arg: String(k?.arg ?? '').slice(0, 64) };
  if (a.text) out.text = String(k?.text ?? '').slice(0, 300);
  if (a.url) { const u = String(k?.url ?? '').trim().slice(0, 300); out.url = URL_OK.test(u) ? u : ''; }
  return out;
}
function cleanStep(st, acts) {
  const out = cleanBody(st, acts);
  if (['none', 'macro'].includes(out.action)) return null;
  const w = Math.round(Number(st?.wait) || 0);
  out.wait = Math.max(0, Math.min(10000, w));
  return out;
}
const clean = (k) => {
  const acts = actions();
  const out = {
    ...cleanBody(k, acts), label: String(k?.label ?? '').slice(0, 24),
    icon: String(k?.icon ?? '').slice(0, 8), color: /^#[0-9a-fA-F]{6}$/.test(k?.color ?? '') ? k.color : '',
  };
  if (out.action === 'macro') out.steps = (Array.isArray(k?.steps) ? k.steps : []).map((st) => cleanStep(st, acts)).filter(Boolean).slice(0, MACRO_MAX);
  return out;
};
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
      light: normalizeLight(d.light), // RGB-Licht (js/console-light.js)
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
  past = [];
  future = [];
  listenOnce();
  seenAlerts = null;
  lightEv = null;
  listenAlerts();
  openBridge();
  main = h('div', { class: 'cs-main' });
  kitBox = h('div', { class: 'cs-kit' });
  slot.replaceChildren(main, model3dCard(), kitBox);
  paint();
  paintKit();
  refresh();
  startLights();
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
  // Neuer Alert seit dem letzten Abruf: Licht aufleuchten lassen (beim ersten Abruf nur merken)
  const fresh = seenAlerts ? alerts.find((a) => !seenAlerts.has(alertKey(a))) : null;
  seenAlerts ??= new Set();
  for (const a of alerts) seenAlerts.add(alertKey(a));
  if (fresh) flashLight(eventForAlert(fresh.kind));
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
            ? 'Bearbeiten: Taste antippen und unten belegen, Tasten per Ziehen tauschen – dann speichern.'
            : `Capture Card mit Tastenpult. Die Tasten lösen die Aktion wirklich aus – im Kanal ${ctx.streamer() || 'StreamHelp'}.`)),
        h('div', { class: 'cs-head-btns' }, editing
          ? [h('span', { class: 'cs-dirty', hidden: !isDirty() }, '● ungespeichert'),
            h('button', { class: 'btn btn--ghost btn--sm btn--icon', type: 'button', 'data-cs': 'undo', disabled: !past.length, onclick: undo, title: 'Rückgängig (Strg+Z)', 'aria-label': 'Rückgängig' }, h('i', { class: 'ph ph-arrow-counter-clockwise', 'aria-hidden': 'true' })),
            h('button', { class: 'btn btn--ghost btn--sm btn--icon', type: 'button', 'data-cs': 'redo', disabled: !future.length, onclick: redo, title: 'Wiederholen (Strg+Y)', 'aria-label': 'Wiederholen' }, h('i', { class: 'ph ph-arrow-clockwise', 'aria-hidden': 'true' })),
            h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: cancelEdit }, 'Abbrechen'),
            h('button', { class: 'btn btn--primary btn--sm', type: 'button', onclick: (e) => save(e.currentTarget) }, 'Speichern')]
          : h('button', { class: 'btn btn--outline btn--sm', type: 'button', onclick: startEdit }, h('i', { class: 'ph ph-pencil-simple', 'aria-hidden': 'true' }), ' Bearbeiten'))),
      h('div', { class: `cs-device${editing ? ' is-editing' : ''}`, role: 'group', 'aria-label': 'Virtuelle Console' },
        h('div', { class: 'cs-keys' }, ...c.keys.map((k, i) => keyButton(k, i))),
        h('button', { class: 'cs-bulb', type: 'button', title: 'Content-Idee vorschlagen', 'aria-label': 'Content-Idee vorschlagen', onclick: suggestIdea },
          h('i', { class: 'ph ph-lightbulb', 'aria-hidden': 'true' })),
        h('div', { class: 'cs-display', id: 'cs-display', 'aria-live': 'polite' })),
      h('p', { class: 'form-hint cs-bridge' }),
      editing ? editor() : h('p', { class: 'form-hint cs-foot' },
        cfg.updated_at ? `Zuletzt geändert von ${cfg.updated_by || 'einem Admin'} am ${new Date(cfg.updated_at).toLocaleString('de-DE')}.` : 'Noch die Standard-Belegung.')));
  paintDisplay();
  paintBridgeHint();
  colorKeys(c.keys);
}

function keyButton(k, i) {
  const empty = k.action === 'none';
  const title = empty ? 'Nicht belegt' : `${actions()[k.action]?.name ?? ''}${argName(k) ? `: ${argName(k)}` : ''}`;
  const btn = h('button', {
    class: `cs-key${empty ? ' is-empty' : ''}${editing && picked === i ? ' is-picked' : ''}`, type: 'button', title,
    'aria-label': `Taste ${i + 1}: ${k.label || title}`, 'data-i': String(i),
    ...(editing
      ? { onpointerdown: (e) => keyPointerDown(e, i), onpointermove: keyPointerMove, onpointerup: keyPointerUp, onpointercancel: keyPointerUp,
        onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(i); } } }
      : { onclick: (e) => press(k, e.currentTarget, i) }),
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
  // 3D-Modell: das Display zeigt die Touch-Oberfläche (Einstellungen aus „Touch-Bildschirm“)
  if (console3dActive()) {
    paintConsoleScreen((g, W, H) => drawTouchScreen(g, W, H, {
      cfg: c.display.touch, goal: c.display.goal, idea, page: idea ? 'ideas' : 'home',
      live: { scene: live.scene, guard: ctx.guardActive(), alert: live.alert, alertsToday: live.alertsToday },
    }));
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
async function press(k, btn, index = null) {
  if (k.action === 'none') return;
  btn.classList.add('is-busy');
  btn.disabled = true;
  try {
    const msg = await run(k, index);
    if (msg) ctx.toast(msg, 'ok', 3000);
  } catch (err) {
    ctx.toast(ctx.germanError(err), 'error', 6000);
  } finally {
    btn.disabled = false;
    btn.classList.remove('is-busy');
    btn.classList.add('is-hit');
    setTimeout(() => btn.classList.remove('is-hit'), 400);
    refresh();
  }
}

async function run(k, keyIndex = null, step = null) {
  const arg = k.arg ?? '';
  switch (k.action) {
    case 'scene': {
      const overlay = await ctx.api.getOverlayConfig();
      const p = new URLSearchParams(overlay?.params ?? '');
      if (arg) p.set('scene', arg);
      else p.delete('scene');
      await ctx.api.saveOverlayConfig(p.toString());
      live.scene = arg;
      flashLight('scene');
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
      if (on) flashLight('guard');
      paint();
      return on ? 'Raid-Schutz ist an' : 'Raid-Schutz ist aus';
    }
    case 'page':
      ctx.setPage(arg || 'ideas');
      return '';
    // Über die Bridge am PC (console-bridge.html): OBS und Streamer.bot
    case 'obs_scene': return bridgeCmd('scene', { name: arg });
    case 'obs_mute': return bridgeCmd('mute', { input: arg });
    case 'obs_stream': return bridgeCmd('stream');
    case 'obs_record': return bridgeCmd('record');
    case 'obs_replay': return bridgeCmd('replay');
    case 'sb_action': return bridgeCmd('sb', { id: arg });
    // Über den Server mit der gespeicherten Taste: Twitch und Webhooks
    case 'twitch_marker': case 'twitch_clip': case 'twitch_chat': case 'twitch_ad': case 'twitch_poll': case 'webhook': {
      if (keyIndex === null) throw new Error('Diese Aktion geht nur über eine gespeicherte Taste.');
      if (!ctx.api.consoleRun) throw new Error('Diese Aktion geht hier nicht.');
      const r = await ctx.api.consoleRun(keyIndex, step);
      if (r?.url) navigator.clipboard?.writeText(r.url).catch(() => {});
      return r?.url ? `${r.text} – Link kopiert` : r?.text ?? 'Erledigt';
    }
    case 'macro': {
      const steps = k.steps ?? [];
      if (!steps.length) throw new Error('Das Makro hat noch keine Schritte.');
      let done = 0;
      for (const [i, st] of steps.entries()) {
        if (st.wait) await new Promise((r) => setTimeout(r, st.wait));
        try {
          await run(st, keyIndex, i);
          done += 1;
        } catch (err) {
          throw new Error(`Makro, Schritt ${i + 1} (${actions()[st.action]?.name ?? st.action}): ${ctx.germanError(err)}`);
        }
      }
      return `▶️ Makro fertig (${done} ${done === 1 ? 'Schritt' : 'Schritte'})`;
    }
    default:
      return '';
  }
}

// ---------- Bridge am PC (js/console-link.js) ----------
async function openBridge() {
  link?.close();
  link = null;
  bridgeState = null;
  try {
    link = shareLink(ctx.api, await linkTopic(ctx.api, ctx.channel?.()?.id ?? null));
    link.on('state', (st) => {
      const had = !!bridgeState;
      bridgeState = st?.off || (!st?.obs && !st?.sb?.on) ? null : st;
      // Beim Bearbeiten: Listen (Szenen, Quellen, Streamer.bot) auffrischen, sobald die Bridge sich meldet
      if (editing && had !== !!bridgeState && !main?.querySelector('.cs-edit')?.contains(document.activeElement)) paint();
      paintBridgeHint();
    });
    Promise.resolve(link.send('hello', {})).catch(() => {});
  } catch (err) {
    console.warn('Console: Bridge nicht erreichbar', err);
  }
}
async function bridgeCmd(type, arg = {}) {
  if (!link) throw new Error('Keine Verbindung zur Bridge am PC.');
  return link.request(type, arg);
}
function paintBridgeHint() {
  const el = main?.querySelector('.cs-bridge');
  if (!el) return;
  const b = bridgeState;
  el.textContent = b
    ? `🖥️ Bridge am PC: ${b.obs ? `OBS verbunden (${b.scenes?.length ?? 0} Szenen)` : 'OBS nicht verbunden'} · ${b.sb?.on ? `Streamer.bot (${b.sb.actions.length} Aktionen)` : 'Streamer.bot aus'}`
    : '🖥️ Bridge am PC nicht gefunden – für OBS- und Streamer.bot-Tasten console-bridge.html am PC öffnen.';
  el.classList.toggle('is-ok', !!b);
}

function suggestIdea() {
  const tiles = (ctx.tiles() ?? []).filter((t) => t.title && t.id !== idea?.id);
  if (!tiles.length) { ctx.toast('Noch keine Content-Ideen.', 'info'); return; }
  idea = tiles[Math.floor(Math.random() * tiles.length)];
  flashLight('idea');
  paintDisplay();
}

// ---------- RGB-Licht (js/console-light.js) ----------
// Läuft ständig: Glühbirne und Tasten leuchten in der Vorschau und im 3D-Modell so, wie es das Gerät täte.
// Ereignisse (neuer Alert, Idee, Szene, Raid-Schutz) lassen das Licht ein paar Sekunden aufleuchten.
let lightEv = null;
let lightRaf = 0;
let lightLast = 0;
let seenAlerts = null; // Alerts, die schon da waren (null = noch nicht abgerufen)
const alertFeeds = new WeakSet(); // Live-Alerts nur einmal je Verbindung abonnieren
const alertKey = (a) => String(a?.id ?? a?.event_id ?? a?.created_at ?? '');
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const lightOf = () => (editing ? draft : cfg)?.display.light;
const frameAt = (now) => (cfg ? lightFrame(lightOf(), (editing ? draft : cfg).keys, now, lightEv, reducedMotion()) : null);

function startLights() {
  if (!lightRaf) lightRaf = requestAnimationFrame(lightLoop);
  setConsoleLeds(frameAt);
}
function lightLoop(now) {
  lightRaf = 0;
  if (!root?.isConnected) return;
  // ~30 Bilder pro Sekunde reichen; im versteckten Reiter nichts zeichnen
  if (now - lightLast > 33 && !root.closest('[hidden]')) {
    lightLast = now;
    const f = frameAt(now);
    if (f) paintLeds(f);
  }
  lightRaf = requestAnimationFrame(lightLoop);
}
function paintLeds(f) {
  main?.querySelectorAll('.cs-key').forEach((el, i) => {
    el.style.setProperty('--led', f.keys[i].color);
    el.style.setProperty('--led-a', f.keys[i].level.toFixed(3));
  });
  const b = main?.querySelector('.cs-bulb');
  if (b) {
    b.style.setProperty('--bulb', f.bulb.color);
    b.style.setProperty('--bulb-a', f.bulb.level.toFixed(3));
  }
}
function flashLight(id) {
  if (!id) return;
  const ev = startEvent(lightOf(), id);
  if (ev) lightEv = ev;
}
// Live-Alerts (Realtime): Licht sofort statt erst beim nächsten Abruf alle 15 s
function listenAlerts() {
  const api = ctx.api;
  if (!api?.onAlerts || alertFeeds.has(api)) return;
  alertFeeds.add(api);
  try {
    api.onAlerts((a) => {
      if (!root?.isConnected || !seenAlerts || seenAlerts.has(alertKey(a))) return;
      seenAlerts.add(alertKey(a));
      flashLight(eventForAlert(a.kind));
    });
  } catch (err) {
    console.warn('Live-Alerts für das Licht nicht verfügbar:', err.message);
  }
}

// Einstellungen „Licht (RGB)“ im Bearbeiten-Modus
const optList = (list, current) => list.map(([v, t]) => h('option', { value: String(v), selected: String(v) === String(current) }, t));
function lightEditor() {
  const L = draft.display.light;
  const setL = (fn) => commit((d) => { fn(d.display.light); d.display.light = normalizeLight(d.display.light); });
  const select = (name, label, list, cur, fn) => h('label', { class: 'field' }, h('span', {}, label),
    h('select', { name, onchange: (e) => setL((l) => fn(l, e.target.value)) }, ...optList(list, cur)));
  const range = (name, label, min, max, cur, unit, fn) => h('label', { class: 'field cs-range' },
    h('span', {}, label, h('output', {}, `${cur}${unit}`)),
    h('input', { type: 'range', name, min: String(min), max: String(max), value: String(cur),
      oninput: (e) => { e.target.closest('label').querySelector('output').textContent = `${e.target.value}${unit}`; },
      onchange: (e) => setL((l) => fn(l, Number(e.target.value))) }));
  const colorField = (name, label, cur, fn) => h('label', { class: 'field cs-color' }, h('span', {}, label),
    h('input', { type: 'color', name, value: cur, onchange: (e) => setL((l) => fn(l, e.target.value)) }));
  const moving = (fx) => !['static', 'off'].includes(fx);
  const bulb = L.bulb;
  const keys = L.keys;
  return h('fieldset', { class: 'cs-edit-light' },
    h('legend', {}, 'Licht (RGB)'),
    h('div', { class: 'cs-light-grid' },
      h('div', { class: 'cs-light-box' },
        h('h3', {}, '💡 Glühbirne (Ideen-Knopf)'),
        !['rainbow', 'off'].includes(bulb.effect) ? colorField('bulb-color', 'Farbe', bulb.color, (l, v) => { l.bulb.color = v; }) : null,
        select('bulb-effect', 'Effekt', LIGHT_EFFECTS.filter(([id]) => id !== 'wave'), bulb.effect, (l, v) => { l.bulb.effect = v; }),
        moving(bulb.effect) ? range('bulb-speed', 'Tempo', 1, 10, bulb.speed, '', (l, v) => { l.bulb.speed = v; }) : null,
        bulb.effect !== 'off' ? range('bulb-level', 'Helligkeit', 5, 100, bulb.level, ' %', (l, v) => { l.bulb.level = v; }) : null),
      h('div', { class: 'cs-light-box' },
        h('h3', {}, '🎛️ Tasten'),
        select('keys-mode', 'Farben', KEY_MODES, keys.mode, (l, v) => { l.keys.mode = v; }),
        keys.mode === 'same' && !['rainbow', 'off'].includes(keys.effect) ? colorField('keys-color', 'Farbe für alle', keys.color, (l, v) => { l.keys.color = v; }) : null,
        select('keys-effect', 'Effekt', LIGHT_EFFECTS, keys.effect, (l, v) => { l.keys.effect = v; }),
        moving(keys.effect) ? range('keys-speed', 'Tempo', 1, 10, keys.speed, '', (l, v) => { l.keys.speed = v; }) : null,
        keys.effect !== 'off' ? range('keys-level', 'Helligkeit', 5, 100, keys.level, ' %', (l, v) => { l.keys.level = v; }) : null),
      h('div', { class: 'cs-light-box cs-light-events' },
        h('h3', {}, '✨ Bei Ereignissen aufleuchten'),
        h('div', { class: 'cs-light-row2' },
          select('ev-target', 'Was leuchtet', EVENT_TARGETS, L.target, (l, v) => { l.target = v; }),
          select('ev-secs', 'Dauer', EVENT_SECONDS.map((n) => [n, `${n} Sekunden`]), L.secs, (l, v) => { l.secs = Number(v); })),
        h('ul', { class: 'cs-light-list' }, ...LIGHT_EVENTS.map((ev) => {
          const e = L.events[ev.id];
          return h('li', { class: e.on ? '' : 'is-off' },
            h('label', { class: 'cs-light-on' },
              h('input', { type: 'checkbox', name: `ev-${ev.id}`, checked: e.on, onchange: (x) => setL((l) => { l.events[ev.id].on = x.target.checked; }) }),
              h('span', { 'aria-hidden': 'true' }, ev.icon), h('span', {}, ev.name)),
            h('input', { type: 'color', value: e.color, 'aria-label': `${ev.name}: Farbe`, disabled: !e.on, onchange: (x) => setL((l) => { l.events[ev.id].color = x.target.value; }) }),
            h('select', { 'aria-label': `${ev.name}: Effekt`, disabled: !e.on, onchange: (x) => setL((l) => { l.events[ev.id].style = x.target.value; }) }, ...optList(EVENT_STYLES, e.style)),
            h('button', { class: 'btn btn--ghost btn--sm', type: 'button', disabled: !e.on, onclick: () => flashLight(ev.id), title: 'Aufleuchten lassen (Vorschau)' }, 'Test'));
        })))),
    h('p', { class: 'form-hint' }, 'Die Vorschau oben und das 3D-Modell leuchten wie das Gerät. Bei „Reduzierte Bewegung“ im System bleiben die Effekte stehen.'));
}

// ---------- Bearbeiten ----------
// Rückgängig/Wiederholen (Strg+Z, Strg+Y), Tasten per Ziehen tauschen (mit Strg/Alt: kopieren),
// Kopieren/Einfügen, Symbol-Auswahl, freie Farbe. Warnung bei ungespeicherten Änderungen.
const HISTORY_MAX = 60;
let past = [];
let future = [];
let copied = null;  // kopierte Taste (nur im Arbeitsspeicher)
let drag = null;    // { from, x, y, active, copy, el }
const ICONS = ['🔴', '⏳', '☕', '🎡', '🥁', '👏', '💜', '🛡️', '🎛️', '🎬', '🎤', '🔇', '🔊', '🎵', '⏯️', '⏺️',
  '📸', '🎮', '💬', '📣', '⭐', '🔥', '💡', '🎉', '😂', '👋', '❤️', '💰', '🏆', '⚡', '🚀', '👀',
  '🎥', '💾', '🤖', '📍', '✂️', '📺', '📊', '🔗', '▶️', '🎧'];
const ACTION_ICONS = { scene: '🎬', spin: '🎡', sound: '🔊', alert: '🔔', guard: '🛡️', page: '🎛️', obs_scene: '🎥', obs_mute: '🔇', obs_stream: '🔴', obs_record: '⏺️', obs_replay: '💾',
  sb_action: '🤖', twitch_marker: '📍', twitch_clip: '✂️', twitch_chat: '💬', twitch_ad: '📺', twitch_poll: '📊', webhook: '🔗', macro: '▶️' };

const snap = () => JSON.stringify({ keys: draft.keys, display: draft.display });
const isDirty = () => editing && !!draft && snap() !== JSON.stringify({ keys: cfg.keys, display: cfg.display });

// Jede Änderung am Entwurf läuft hierüber – merkt sich den Stand davor
function commit(fn, { repaint = true } = {}) {
  const before = snap();
  fn(draft);
  if (snap() === before) return;
  past.push(before);
  if (past.length > HISTORY_MAX) past.shift();
  future = [];
  if (repaint) paint(); else paintEditState();
}
function restore(state) {
  const s = JSON.parse(state);
  draft.keys = s.keys;
  draft.display = s.display;
  paint();
}
function undo() {
  if (!past.length) return;
  future.push(snap());
  restore(past.pop());
}
function redo() {
  if (!future.length) return;
  past.push(snap());
  restore(future.pop());
}
// Nur Kopfzeile auffrischen (Rückgängig-Knöpfe, „ungespeichert“), ohne das Formular neu zu bauen
function paintEditState() {
  const u = main?.querySelector('[data-cs="undo"]');
  const r = main?.querySelector('[data-cs="redo"]');
  const d = main?.querySelector('.cs-dirty');
  if (u) u.disabled = !past.length;
  if (r) r.disabled = !future.length;
  if (d) d.hidden = !isDirty();
}

function startEdit() {
  draft = structuredClone(cfg);
  editing = true;
  picked = 0;
  idea = null;
  past = [];
  future = [];
  paint();
}
function cancelEdit() {
  if (isDirty() && !confirm('Ungespeicherte Änderungen verwerfen?')) return;
  editing = false;
  draft = null;
  past = [];
  future = [];
  paint();
}
function pick(i, focus = true) {
  picked = i;
  paint();
  if (!focus) return;
  const edit = main.querySelector('.cs-edit');
  edit?.querySelector('[name="action"]')?.focus({ preventScroll: true });
  // Handy: Formular unter dem Gerät sichtbar machen
  if (edit && matchMedia('(max-width: 760px)').matches) edit.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function swapKeys(from, to, copy = false) {
  if (from === to) return;
  commit((d) => {
    if (copy) d.keys[to] = { ...d.keys[from] };
    else [d.keys[from], d.keys[to]] = [d.keys[to], d.keys[from]];
  }, { repaint: false });
  picked = to;
  paint();
  ctx.toast(copy ? `Taste ${from + 1} auf Taste ${to + 1} kopiert.` : `Taste ${from + 1} und ${to + 1} getauscht.`, 'ok', 1800);
}

// Ziehen (Maus, Stift, Finger): Taste auf eine andere ziehen tauscht sie, mit Strg/Alt wird kopiert
function keyPointerDown(e, i) {
  if (!editing || e.button > 0) return;
  // Offenes Eingabefeld zuerst übernehmen (change → neu zeichnen), dann die neue Taste nehmen
  if (document.activeElement && main.querySelector('.cs-edit')?.contains(document.activeElement)) document.activeElement.blur();
  const el = main.querySelector(`.cs-key[data-i="${i}"]`) ?? e.currentTarget;
  drag = { from: i, x: e.clientX, y: e.clientY, active: false, copy: false, el, id: e.pointerId };
  try { el.setPointerCapture(e.pointerId); } catch { /* Zeiger schon weg */ }
}
// Taste unter dem Finger/Mauszeiger – ohne die gezogene Taste selbst
function keyAt(x, y, skip) {
  const el = document.elementsFromPoint(x, y).map((e) => e.closest('.cs-key')).find((e) => e && e !== skip && main.contains(e));
  return el ? Number(el.dataset.i) : -1;
}
function keyPointerMove(e) {
  if (!drag || e.pointerId !== drag.id || e.currentTarget !== drag.el) return;
  if (!drag.active && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 8) return;
  drag.active = true;
  drag.copy = e.ctrlKey || e.altKey || e.metaKey;
  drag.el.classList.add('is-dragging');
  drag.el.style.translate = `${e.clientX - drag.x}px ${e.clientY - drag.y}px`;
  const to = keyAt(e.clientX, e.clientY, drag.el);
  main.querySelectorAll('.cs-key').forEach((k) => k.classList.toggle('is-drop', Number(k.dataset.i) === to && to !== drag.from));
}
function keyPointerUp(e) {
  if (!drag || e.pointerId !== drag.id || e.currentTarget !== drag.el) return;
  const d = drag;
  drag = null;
  d.el.classList.remove('is-dragging');
  d.el.style.translate = '';
  main.querySelectorAll('.cs-key.is-drop').forEach((k) => k.classList.remove('is-drop'));
  if (e.type === 'pointercancel') return;
  if (!d.active) { pick(d.from); return; }
  const to = keyAt(e.clientX, e.clientY, d.el);
  if (to >= 0 && to !== d.from) swapKeys(d.from, to, d.copy);
}

// Tastatur im Bearbeiten-Modus: Strg+Z / Strg+Y, Strg+C / Strg+V auf die gewählte Taste
function onKeydown(e) {
  if (!editing || !root?.isConnected || root.closest('[hidden]')) return;
  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return;
  const typing = /^(INPUT|TEXTAREA)$/.test(e.target?.tagName) && !['color', 'checkbox', 'radio'].includes(e.target.type);
  const k = e.key.toLowerCase();
  if (k === 'z' && !typing) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
  else if (k === 'y' && !typing) { e.preventDefault(); redo(); }
  else if (k === 'c' && !typing && !getSelection()?.toString()) { copyKey(); }
  else if (k === 'v' && !typing && copied) { e.preventDefault(); pasteKey(); }
}
function copyKey() {
  copied = { ...draft.keys[picked] };
  ctx.toast(`Taste ${picked + 1} kopiert.`, 'ok', 1500);
  paint();
}
function pasteKey() {
  if (!copied) return;
  commit((d) => { d.keys[picked] = clean(copied); });
  ctx.toast(`Auf Taste ${picked + 1} eingefügt.`, 'ok', 1500);
}

// Einmal pro Seite: Warnung beim Schließen mit ungespeicherten Änderungen, Tastenkürzel
let listening = false;
function listenOnce() {
  if (listening) return;
  listening = true;
  addEventListener('beforeunload', (e) => { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } });
  addEventListener('keydown', onKeydown);
}

// Aktion wählen, nach Gruppen sortiert (Makro-Schritte: ohne „Nichts“ und ohne Makro)
function actionSelect(name, current, onPick, step) {
  const acts = Object.entries(actions()).filter(([id]) => !step || !['none', 'macro'].includes(id));
  const kids = [];
  if (!step) kids.push(h('option', { value: 'none', selected: current === 'none' }, 'Nichts'));
  for (const g of GROUPS) {
    const items = acts.filter(([, a]) => a.group === g);
    if (items.length) kids.push(h('optgroup', { label: g }, ...items.map(([id, a]) => h('option', { value: id, selected: id === current }, a.name))));
  }
  return h('select', { name, 'aria-label': step ? 'Aktion des Schritts' : undefined, onchange: (e) => onPick(e.target.value) }, ...kids);
}

// Felder je Aktion: Ziel (Liste oder frei), Text, Webhook-Adresse – plus Hinweis, wo die Aktion läuft
function argFields(k, setPatch, prefix) {
  const a = actions()[k.action];
  if (!a) return [];
  const out = [];
  if (a.args) {
    // Gespeichertes Ziel, das gerade nicht in der Liste steht (z. B. OBS-Szene umbenannt): trotzdem zeigen
    const list = a.args.some(([v]) => v === (k.arg ?? '')) || !k.arg ? a.args : [[k.arg, `${k.arg} (gerade nicht gefunden)`], ...a.args];
    out.push(h('label', { class: 'field' }, h('span', {}, 'Ziel'),
      h('select', { name: `${prefix}arg`, onchange: (e) => setPatch({ arg: e.target.value }) }, ...optList(list, k.arg ?? ''))));
  } else if (a.input) {
    out.push(h('label', { class: 'field' }, h('span', {}, k.action === 'twitch_marker' ? 'Beschreibung' : 'Ziel'),
      h('input', { name: `${prefix}arg`, maxlength: '64', value: k.arg ?? '', autocomplete: 'off', placeholder: a.input, onchange: (e) => setPatch({ arg: e.target.value.trim() }) })));
  }
  if (a.url) {
    out.push(h('label', { class: 'field' }, h('span', {}, 'Webhook-Adresse (https://…)'),
      h('input', { name: `${prefix}url`, type: 'url', inputmode: 'url', maxlength: '300', value: k.url ?? '', autocomplete: 'off', placeholder: 'https://hooks.example.com/…',
        onchange: (e) => { const v = e.target.value.trim(); if (v && !URL_OK.test(v)) ctx.toast('Die Adresse muss mit https:// beginnen.', 'error'); setPatch({ url: v }); } })));
  }
  if (a.text) {
    out.push(h('label', { class: 'field' }, h('span', {}, a.text.label),
      h('textarea', { name: `${prefix}text`, maxlength: '300', rows: '2', placeholder: a.text.placeholder, onchange: (e) => setPatch({ text: e.target.value.trim() }) }, k.text ?? '')));
  }
  const hint = a.via === 'bridge'
    ? (bridgeState ? 'Läuft über die Bridge am PC.' : 'Läuft über die Bridge am PC (console-bridge.html) – die ist gerade nicht da. Ziel deshalb von Hand eintragen.')
    : a.via === 'server'
      ? `Läuft über StreamHelp mit der gespeicherten Taste – erst speichern, dann drücken.${k.action.startsWith('twitch_') ? ' Braucht ggf. neue Twitch-Rechte: Twitch einmal neu verbinden.' : ' Gesendet wird ein POST mit JSON (Taste, Name, Text, Zeit).'}`
      : '';
  if (hint) out.push(h('small', { class: 'cs-via' }, hint));
  return out;
}

// Makro: bis zu 8 Schritte nacheinander, je mit Pause davor
function macroEditor(k, set) {
  const steps = k.steps ?? [];
  const acts = actions();
  const setSteps = (fn) => { const next = structuredClone(steps); fn(next); set({ steps: next }); };
  const move = (i, d) => setSteps((x) => { [x[i], x[i + d]] = [x[i + d], x[i]]; });
  return h('div', { class: 'cs-macro' },
    h('p', { class: 'form-hint' }, 'Die Schritte laufen nacheinander. Bricht einer ab, hören die folgenden auf.'),
    steps.length ? h('ol', { class: 'cs-macro-steps' }, ...steps.map((st, i) => h('li', {},
      h('div', { class: 'cs-macro-head' },
        h('b', {}, `Schritt ${i + 1}`),
        h('button', { class: 'btn btn--ghost btn--sm btn--icon', type: 'button', disabled: i === 0, 'aria-label': `Schritt ${i + 1} nach oben`, onclick: () => move(i, -1) }, h('span', { 'aria-hidden': 'true' }, '↑')),
        h('button', { class: 'btn btn--ghost btn--sm btn--icon', type: 'button', disabled: i === steps.length - 1, 'aria-label': `Schritt ${i + 1} nach unten`, onclick: () => move(i, 1) }, h('span', { 'aria-hidden': 'true' }, '↓')),
        h('button', { class: 'btn btn--ghost btn--sm btn--icon', type: 'button', 'aria-label': `Schritt ${i + 1} löschen`, onclick: () => setSteps((x) => { x.splice(i, 1); }) }, h('i', { class: 'ph ph-trash', 'aria-hidden': 'true' }))),
      h('label', { class: 'field cs-macro-wait' }, h('span', {}, 'Pause davor'),
        h('select', { name: `s${i}wait`, onchange: (e) => setSteps((x) => { x[i].wait = Number(e.target.value); }) },
          ...optList([0, 500, 1000, 2000, 3000, 5000, 10000].map((ms) => [String(ms), ms ? `${ms / 1000} s` : 'keine']), String(st.wait ?? 0)))),
      h('label', { class: 'field' }, h('span', {}, 'Aktion'),
        actionSelect(`s${i}action`, st.action, (v) => setSteps((x) => { x[i] = { action: v, arg: acts[v]?.args?.[0]?.[0] ?? '', wait: x[i].wait ?? 0 }; }), true)),
      ...argFields(st, (patch) => setSteps((x) => { x[i] = { ...x[i], ...patch }; }), `s${i}`)))) : null,
    steps.length < MACRO_MAX
      ? h('button', { class: 'btn btn--outline btn--sm', type: 'button', onclick: () => setSteps((x) => { x.push({ action: 'obs_scene', arg: bridgeState?.scenes?.[0] ?? '', wait: 0 }); }) },
        h('i', { class: 'ph ph-plus', 'aria-hidden': 'true' }), ' Schritt hinzufügen')
      : h('small', { class: 'cs-via' }, `Höchstens ${MACRO_MAX} Schritte.`));
}

function editor() {
  const k = draft.keys[picked];
  const acts = actions();
  const opts = (list, current) => list.map(([v, t]) => h('option', { value: v, selected: v === current }, t));
  const set = (patch) => commit((d) => { d.keys[picked] = clean({ ...d.keys[picked], ...patch }); });
  const args = acts[k.action]?.args;
  // Neue Aktion: Name und Symbol vorschlagen, wenn noch leer oder noch der alte Vorschlag
  // Vorschlag für den Namen auf der Taste: ohne „OBS:“/„Twitch:“ und ohne Emoji vorn
  const nice = (t) => String(t ?? '').replace(/^(OBS|Twitch|Makro): /, '').replace(/^\p{Extended_Pictographic}\uFE0F?\s*/u, '').slice(0, 24);
  const autoLabel = () => !k.label || k.label === nice(argName(k)) || k.label === nice(acts[k.action]?.name);
  const changeAction = (action) => {
    const arg = acts[action]?.args?.[0]?.[0] ?? '';
    const label = autoLabel() ? nice(acts[action]?.args?.find(([v]) => v === arg)?.[1] ?? acts[action]?.name) : k.label;
    const icon = !k.icon || Object.values(ACTION_ICONS).includes(k.icon) ? ACTION_ICONS[action] ?? '' : k.icon;
    set(action === 'none' ? { ...EMPTY_KEY } : { action, arg, label, icon });
  };
  const changeArg = (arg) => {
    const name = args?.find(([v]) => v === arg)?.[1] ?? '';
    set({ arg, ...(autoLabel() ? { label: nice(name) } : {}) });
  };
  // Name tippen: Taste sofort mitändern (ohne das Formular neu zu bauen), gespeichert wird beim Verlassen
  const liveLabel = (e) => {
    const lab = main.querySelector(`.cs-key[data-i="${picked}"] .cs-key-label`);
    if (lab) lab.textContent = e.target.value || 'leer';
  };
  const customColor = k.color && !COLORS.includes(k.color);
  const others = draft.keys.map((x, i) => [String(i), `Taste ${i + 1}${x.label ? ` – ${x.label}` : ''}`]).filter(([i]) => Number(i) !== picked);
  return h('div', { class: 'cs-edit' },
    h('fieldset', { class: 'cs-edit-key' },
      h('legend', {}, `Taste ${picked + 1}`),
      h('div', { class: 'cs-edit-tools' },
        h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: copyKey, title: 'Strg+C' }, h('i', { class: 'ph ph-copy', 'aria-hidden': 'true' }), ' Kopieren'),
        h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: pasteKey, disabled: !copied, title: 'Strg+V' }, h('i', { class: 'ph ph-clipboard-text', 'aria-hidden': 'true' }), ' Einfügen'),
        h('label', { class: 'cs-edit-swap' }, h('span', { class: 'sr-only' }, 'Platz tauschen mit'),
          h('select', { name: 'swap', onchange: (e) => { if (e.target.value !== '') swapKeys(picked, Number(e.target.value)); } },
            h('option', { value: '' }, '⇄ Tauschen mit …'), ...opts(others, '')))),
      h('label', { class: 'field' }, h('span', {}, 'Aktion'), actionSelect('action', k.action, changeAction, false)),
      ...argFields(k, (patch) => (patch.arg !== undefined && args ? changeArg(patch.arg) : set(patch)), ''),
      k.action === 'macro' ? macroEditor(k, set) : null,
      h('label', { class: 'field' }, h('span', {}, 'Name auf der Taste'),
        h('input', { name: 'label', maxlength: '24', value: k.label, autocomplete: 'off', enterkeyhint: 'done', oninput: liveLabel, onchange: (e) => set({ label: e.target.value.trim() }) })),
      h('div', { class: 'field cs-edit-icon' }, h('span', { id: 'cs-icon-l' }, 'Symbol'),
        h('div', { class: 'cs-icons', role: 'radiogroup', 'aria-labelledby': 'cs-icon-l' },
          ...ICONS.map((ic) => h('button', {
            class: 'cs-icon', type: 'button', role: 'radio', 'aria-checked': String(k.icon === ic), 'aria-label': `Symbol ${ic}`, onclick: () => set({ icon: ic }),
          }, ic)),
          h('input', { name: 'icon', maxlength: '8', value: ICONS.includes(k.icon) ? '' : k.icon, autocomplete: 'off', placeholder: 'eigenes', 'aria-label': 'Eigenes Symbol (Emoji)', onchange: (e) => set({ icon: e.target.value.trim() }) }),
          k.icon ? h('button', { class: 'cs-icon cs-icon--none', type: 'button', 'aria-label': 'Kein Symbol', title: 'Kein Symbol', onclick: () => set({ icon: '' }) }, '✕') : null)),
      h('div', { class: 'cs-swatches', role: 'radiogroup', 'aria-label': 'Farbe der Taste' },
        ...COLORS.map((c) => h('button', {
          class: 'cs-swatch', type: 'button', role: 'radio', 'aria-checked': String(k.color === c), 'aria-label': `Farbe ${c}`,
          style: `--k:${c}`, onclick: () => set({ color: c }),
        })),
        h('label', { class: `cs-swatch cs-swatch--custom${customColor ? ' is-on' : ''}`, title: 'Eigene Farbe', style: customColor ? `--k:${k.color}` : '' },
          h('input', { type: 'color', value: k.color || '#9146ff', 'aria-label': 'Eigene Farbe wählen',
            oninput: (e) => { const b = main.querySelector(`.cs-key[data-i="${picked}"]`); b?.style.setProperty('--k', e.target.value); },
            onchange: (e) => set({ color: e.target.value.toLowerCase() }) })),
        h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: () => set({ ...EMPTY_KEY }) }, 'Taste leeren'))),
    h('fieldset', { class: 'cs-edit-display' },
      h('legend', {}, 'Display'),
      h('label', { class: 'field' }, h('span', {}, 'Karte oben'),
        h('select', { name: 'card1', onchange: (e) => commit((d) => { d.display.cards[0] = e.target.value; }) }, ...opts(WIDGETS, draft.display.cards[0]))),
      h('label', { class: 'field' }, h('span', {}, 'Karte unten'),
        h('select', { name: 'card2', onchange: (e) => commit((d) => { d.display.cards[1] = e.target.value; }) }, ...opts(WIDGETS, draft.display.cards[1]))),
      h('label', { class: 'field' }, h('span', {}, 'Tagesziel Alerts'),
        h('input', { name: 'goal', type: 'number', inputmode: 'numeric', min: '1', max: '999', value: String(draft.display.goal),
          onchange: (e) => { const n = Math.round(Number(e.target.value)); commit((d) => { d.display.goal = n >= 1 && n <= 999 ? n : DEFAULT_DISPLAY.goal; }); } })),
      h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: resetDefaults }, 'Standard-Belegung'),
      h('p', { class: 'form-hint cs-edit-help' }, 'Tipp: Tasten auf andere ziehen tauscht sie, mit Strg/Alt gedrückt wird kopiert. Strg+Z macht rückgängig.')),
    lightEditor());
}

function resetDefaults() {
  const def = normalize({ keys: CONSOLE_DEFAULT_KEYS, display: { ...DEFAULT_DISPLAY, touch: cfg.display.touch } });
  commit((d) => { d.keys = def.keys; d.display = { ...def.display, light: d.display.light }; }); // Licht bleibt
}

async function save(btn) {
  btn.disabled = true;
  try {
    const kit = cfg.kit;
    cfg = normalize(await ctx.api.consoleSave(draft.keys, draft.display));
    cfg.kit = kit;
    editing = false;
    draft = null;
    past = [];
    future = [];
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
          h('option', { value: 'top' }, 'Gerät: von oben'),
          h('option', { value: 'hero' }, 'Gerät: flach (Produktfoto)'),
          h('option', { value: 'right' }, 'Gerät: rechte Seite'),
          h('option', { value: 'left' }, 'Gerät: linke Seite'),
          h('option', { value: 'back' }, 'Gerät: Rückseite'),
          h('option', { value: 'closed' }, 'Verpackung: zu'),
          h('option', { value: 'open' }, 'Verpackung: offen'),
          h('option', { value: 'cut' }, 'Verpackung: Innenansicht')),
        h('label', { class: 'toggle' }, h('input', { type: 'checkbox', id: 'cs-3d-glow', checked: true, onchange: (e) => setConsoleGlow(e.target.checked) }), h('span', { class: 'toggle-ui', 'aria-hidden': 'true' }), 'Leuchten'),
        h('button', { class: 'btn btn--outline btn--sm', type: 'button', id: 'cs-3d-png', onclick: savePng, title: 'Aktuelle Ansicht als PNG mit durchsichtigem Hintergrund' }, h('i', { class: 'ph ph-camera', 'aria-hidden': 'true' }), ' Bild (PNG)'),
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
  } else if (['top', 'hero', 'right'].includes(v)) {
    setBoxMode('off');
    showConsoleView(v);
  } else setBoxMode(v);
}

// Bild der 3D-Ansicht speichern (für Präsentationen, Hintergrund durchsichtig)
function savePng() {
  const url = exportConsolePng(2);
  if (!url) { ctx.toast('Erst ein 3D-Modell laden.', 'info'); return; }
  const a = h('a', { href: url, download: `streamhelp-console-${new Date().toISOString().slice(0, 10)}.png` });
  document.body.append(a);
  a.click();
  a.remove();
  ctx.toast('Bild gespeichert (PNG, doppelte Größe).', 'ok', 2500);
}

const set3dStatus = (text) => { const el = root?.querySelector('#cs-3d-status'); if (el) el.textContent = text; };

async function show3d(text, source) {
  const host = root?.querySelector('#cs-3d-host');
  if (!host) return;
  set3dStatus('Baut das Modell auf …');
  try {
    await mountConsole3d(host, { objText: text, keys: (editing ? draft : cfg).keys, onKey: on3dKey, onScreen: on3dScreen });
    setConsoleGlow(root.querySelector('#cs-3d-glow')?.checked ?? true);
    setConsoleLeds(frameAt); // RGB-Licht auch im 3D-Modell
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

// Klick aufs Display im 3D-Modell: Kachel der Touch-Oberfläche auslösen (wie auf dem Gerät)
async function on3dScreen(i) {
  if (idea) { idea = null; paintDisplay(); return; } // Ideen-Seite: zurück zum Start
  const t = normalizeTouch(cfg.display.touch).tiles[i];
  if (!t || t.action === 'none') return;
  if (t.action === 'idea') { suggestIdea(); return; }
  if (t.action === 'goto' || t.action.startsWith('obs_')) {
    ctx.toast(t.action === 'goto' ? 'Seiten wechseln: im Touch-Simulator (Console → Touch-Bildschirm).' : 'OBS-Kacheln laufen über die Bridge am PC – im Touch-Simulator ausprobieren.', 'info');
    return;
  }
  try {
    const msg = await run({ action: t.action, arg: t.arg });
    if (msg) ctx.toast(msg, 'ok', 2500);
  } catch (err) {
    ctx.toast(ctx.germanError(err), 'error');
  } finally {
    refresh();
  }
}

function on3dKey(i) {
  if (editing) { pick(i); return; }
  const btn = main.querySelectorAll('.cs-key')[i];
  if (btn) press(cfg.keys[i], btn, i);
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
  // Reiter „Anleitung“ und „Werbung“ im Admin-Bereich
  cards.push(renderManualCard({ kit: cfg.kit, keys: cfg.keys, onChange, toast: ctx.toast }));
  cards.push(renderAdsCard({ kit: cfg.kit, keys: cfg.keys, onChange, toast: ctx.toast }));
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
