// console.html: eigene App für die StreamHelp Console (Entwurf, nur Plattform-Admins) – installierbar als PWA
// (console.webmanifest). Bündelt Tasten-Belegung, 3D-Ansicht, Touch-Bildschirm, die Verbindung zu OBS
// (Bridge am PC) und den Technik-Baukasten. Gleiche Bausteine wie im Admin-Bereich (js/dash-console.js,
// js/dash-console-touch.js). Anmeldung wie console-touch.html: einmal admin.html öffnen und „Webseite als Admin“.
// Kanal per ?c=<login>, sonst der Standard-Kanal.
import { createApi, germanError } from './api.js';
import { channelFromUrl, setChannel } from './channel.js';
import { createExtrasApi } from './extras-api.js';
import { h } from './extras-core.js';
import { renderConsole } from './dash-console.js';
import { renderTouchAdmin } from './dash-console-touch.js';

const $ = (s) => document.querySelector(s);
const TABS = [
  ['keys', '🎛️', 'Tasten'],
  ['touch', '📱', 'Touch'],
  ['obs', '🔌', 'OBS & Geräte'],
  ['view3d', '🧊', '3D'],
  ['kit', '🔧', 'Baukasten'],
];
const TAB_KEY = 'zd_console_app_tab';
const PAGE_NAME = { ideas: 'Content-Ideen', bot: 'Bot & Chat', overlay: 'Overlay & OBS', guard: 'Raid-Schutz', raids: 'Raid-Netzwerk', stats: 'Statistik' };

const state = { api: null, extras: null, channel: null, guard: null, variants: [], tiles: [], tab: 'keys', consoleDone: false, touchDone: false };
let installPrompt = null;

function toast(text, type = 'info', ms = 4000) {
  const el = h('div', { class: `toast toast--${type}` }, text);
  $('#toasts').append(el);
  setTimeout(() => { el.classList.add('is-leaving'); setTimeout(() => el.remove(), 260); }, ms);
}

function block(text, login = false) {
  $('#ca-gate-text').textContent = text;
  $('#ca-gate-link').hidden = !login;
  $('#ca-gate').hidden = false;
  $('#ca-app').hidden = true;
}

const guardOn = () => { const g = state.guard; return !!g?.viewer_pause && (!g.until || Date.parse(g.until) > Date.now()); };
const withChannel = (page) => { const c = channelFromUrl(); return c ? `${page}?c=${encodeURIComponent(c)}` : page; };

function readTab() {
  const fromHash = location.hash.slice(1);
  if (TABS.some(([id]) => id === fromHash)) return fromHash;
  try { const t = localStorage.getItem(TAB_KEY); if (TABS.some(([id]) => id === t)) return t; } catch { /* kein Speicher */ }
  return 'keys';
}

function setTab(tab, { push = true } = {}) {
  state.tab = tab;
  document.querySelectorAll('[data-ca-tab]').forEach((b) => {
    const on = b.dataset.caTab === tab;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
  });
  // Belegung, 3D und Baukasten teilen sich eine Fläche (Umschalten per data-tab wie im Admin-Bereich)
  const consoleTab = ['keys', 'view3d', 'kit'].includes(tab);
  $('#ca-console').hidden = !consoleTab;
  $('#ca-console').dataset.tab = consoleTab ? tab : 'keys';
  $('#ca-touch').hidden = tab !== 'touch';
  $('#ca-obs').hidden = tab !== 'obs';
  try { localStorage.setItem(TAB_KEY, tab); } catch { /* kein Speicher */ }
  if (push && location.hash.slice(1) !== tab) history.replaceState(null, '', `#${tab}`);
  if (consoleTab && !state.consoleDone) openConsole();
  if (tab === 'touch' && !state.touchDone) openTouch();
}

function tabBar() {
  const bar = $('#ca-tabs');
  bar.replaceChildren(...TABS.map(([id, ico, name]) => h('button', {
    class: 'adm-tab ca-tab', type: 'button', role: 'tab', 'data-ca-tab': id, 'aria-selected': 'false', 'aria-controls': id === 'touch' ? 'ca-touch' : id === 'obs' ? 'ca-obs' : 'ca-console',
    onclick: () => setTab(id),
  }, h('span', { class: 'ca-tab-ico', 'aria-hidden': 'true' }, ico), h('span', { class: 'ca-tab-name' }, name))));
  // Pfeiltasten wechseln den Reiter
  bar.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const i = TABS.findIndex(([id]) => id === state.tab);
    const n = e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
    setTab(TABS[n][0]);
    bar.querySelector(`[data-ca-tab="${TABS[n][0]}"]`)?.focus();
    e.preventDefault();
  });
}

async function openConsole() {
  state.consoleDone = true;
  [state.variants, state.tiles, state.guard] = await Promise.all([
    state.api.getVariants().catch(() => []),
    state.api.getTiles().catch(() => []),
    state.extras.guard.get().catch(() => null),
  ]);
  const ch = state.channel;
  await renderConsole($('#ca-console'), {
    api: state.api, toast, germanError,
    streamer: () => (ch ? ch.display_name || ch.login : 'StreamHelp'),
    me: () => 'StreamHelp-Admin',
    variants: () => state.variants,
    currentVariant: () => state.variants[0],
    tiles: () => state.tiles,
    openTile: (tile) => toast(`💡 ${tile.title} – öffnen im Streamer-Dashboard.`, 'info'),
    setPage: (p) => toast(`„${PAGE_NAME[p] ?? p}“ öffnet sich im Streamer-Dashboard.`, 'info'),
    guardActive: guardOn,
    guardSet: async (on) => { state.guard = await state.extras.guard.set(on, 0); return guardOn(); },
    show3d: () => setTab('view3d'),
    channel: () => state.channel, // Bridge am PC (OBS, Streamer.bot) für diesen Kanal
  });
}

function openTouch() {
  state.touchDone = true;
  renderTouchAdmin($('#ca-touch'), { api: state.api, extras: state.extras, toast, germanError, channel: () => state.channel });
}

// Reiter „OBS & Geräte“: Bridge am PC, Touch-Display, App installieren
function paintObs() {
  const card = (ico, title, text, ...actions) => h('section', { class: 'dash-card ca-card' },
    h('h2', {}, h('span', { 'aria-hidden': 'true' }, `${ico} `), title),
    h('p', { class: 'dash-status' }, text),
    h('div', { class: 'ca-card-btns' }, ...actions));
  const link = (href, label, primary = false) => h('a', { class: `btn ${primary ? 'btn--primary' : 'btn--outline'} btn--sm`, href, target: '_blank', rel: 'noopener' }, label);
  const install = h('button', { class: 'btn btn--primary btn--sm', type: 'button', id: 'ca-install', hidden: !installPrompt, onclick: installApp }, h('i', { class: 'ph ph-download-simple', 'aria-hidden': 'true' }), ' App installieren');
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  $('#ca-obs').replaceChildren(
    card('🖥️', 'OBS verbinden', 'Die Bridge läuft am Streaming-PC (als Browser-Tab oder als Dock in OBS: Docks → Benutzerdefinierte Browser-Docks) und verbindet die Console über obs-websocket mit OBS – Szenen, Ton, Stream, Aufnahme und Replay. Das OBS-Passwort bleibt nur in diesem Browser.',
      link(withChannel('console-bridge.html'), 'Bridge öffnen', true),
      h('button', { class: 'btn btn--outline btn--sm', type: 'button', onclick: () => copyLink(withChannel('console-bridge.html'), 'Bridge-Adresse (für das OBS-Dock)') }, h('i', { class: 'ph ph-copy', 'aria-hidden': 'true' }), ' Adresse fürs OBS-Dock')),
    card('📱', 'Touch-Display', 'Die Oberfläche des Touch-Displays im Vollbild – auf einem Tablet oder Handy neben dem Stream. Seiten und Kacheln stellst du im Reiter „Touch“ ein.',
      link(withChannel('console-touch.html'), 'Touch-Display öffnen'),
      h('button', { class: 'btn btn--outline btn--sm', type: 'button', onclick: () => setTab('touch') }, 'Touch einstellen')),
    card('⬇️', 'Als App installieren', standalone
      ? 'Läuft schon als App. Über das Symbol auf dem Startbildschirm bzw. im Startmenü startest du die Console direkt.'
      : installPrompt
        ? 'Installiert die Console als eigene App auf diesem Gerät – mit eigenem Fenster und Symbol.'
        : 'Im Browser-Menü „App installieren“ bzw. „Zum Home-Bildschirm“ wählen (iPhone: Teilen → Zum Home-Bildschirm).',
      install),
  );
}

async function copyLink(path, what) {
  const url = new URL(path, location.href).href;
  try {
    await navigator.clipboard.writeText(url);
    toast(`${what} kopiert.`, 'ok', 2500);
  } catch {
    prompt(`${what}:`, url);
  }
}

async function installApp() {
  if (!installPrompt) return;
  installPrompt.prompt();
  const { outcome } = await installPrompt.userChoice.catch(() => ({ outcome: 'dismissed' }));
  installPrompt = null;
  if (outcome === 'accepted') toast('Console wird installiert.', 'ok');
  paintObs();
}

addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  if (!$('#ca-obs').hidden || $('#ca-install')) paintObs();
});
addEventListener('appinstalled', () => { installPrompt = null; paintObs(); });
addEventListener('hashchange', () => { const t = readTab(); if (t !== state.tab) setTab(t, { push: false }); });

async function start() {
  // Installierbar machen (sw.js) – in eingebetteten oder gesperrten Umgebungen gibt es keinen Service Worker
  try {
    if (location.protocol !== 'file:') navigator.serviceWorker?.register('sw.js').catch((err) => console.warn('Service Worker:', err));
  } catch (err) {
    console.warn('Service Worker nicht verfügbar:', err.message);
  }
  const api = await createApi();
  const res = await api.resolveChannel(channelFromUrl()).catch((err) => { console.warn('Kanal nicht lesbar:', err); return { platform: false, channel: null }; });
  setChannel(res.channel, res.platform);
  try {
    await api.consoleGet();
  } catch (err) {
    if (/console_get|console_config/.test(err?.message ?? '')) { block('Die Console ist noch nicht eingerichtet (Migration …_console.sql fehlt).'); return; }
    block('Nur für Plattform-Admins. Auf diesem Gerät einmal admin.html öffnen, anmelden und „Webseite als Admin“ wählen – dann diese Seite neu laden.', true);
    console.warn('Console nicht lesbar:', germanError(err));
    return;
  }
  state.api = api;
  state.extras = createExtrasApi(api);
  state.channel = res.channel;
  const name = res.channel?.display_name || res.channel?.login || 'Standard-Kanal';
  $('#ca-channel').textContent = name;
  document.title = `Console · ${name}`;
  $('#ca-gate').hidden = true;
  $('#ca-app').hidden = false;
  tabBar();
  paintObs();
  setTab(readTab(), { push: false });
  // Neu laden: bei ungespeicherter Belegung warnt der Browser selbst (beforeunload in js/dash-console.js)
  $('#ca-reload').addEventListener('click', () => location.reload());
}

start().catch((err) => {
  console.error(err);
  block(`Die Console ließ sich nicht laden: ${germanError(err)}`);
});
