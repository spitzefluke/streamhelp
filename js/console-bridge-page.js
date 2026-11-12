// console-bridge.html: Bridge am PC zwischen Touch-Display der Console und OBS (nur Plattform-Admins).
// Läuft als Browser-Tab oder als Dock in OBS (Docks → Benutzerdefinierte Browser-Docks). Das OBS-Passwort
// bleibt verschlüsselt nur in diesem Browser (js/secret-store.js), es geht nie an StreamHelp.
import { createApi, germanError } from './api.js';
import { channelFromUrl, setChannel } from './channel.js';
import { h } from './extras-core.js';
import { ObsSocket } from './obs-ws.js';
import { forgetSecret, loadSecret, saveSecret } from './secret-store.js';
import { linkTopic, openLink } from './console-link.js';
import { BRIDGE_COMMANDS, createBridge, createDemoObs } from './console-bridge.js';

const SECRET = 'zd_console_bridge_obs';
const PORT_KEY = 'zd_console_bridge_port';
const $ = (s) => document.querySelector(s);
const gate = $('#brg-gate');
const app = $('#brg-app');
const logEl = $('#brg-log');
const log = [];

function block(text, login = false) {
  $('#brg-gate-text').textContent = text;
  $('#brg-gate-link').hidden = !login;
  gate.hidden = false;
  app.hidden = true;
}

function pill(el, ok, text) {
  el.textContent = text;
  el.className = `brg-pill ${ok === true ? 'is-ok' : ok === false ? 'is-bad' : ''}`;
}

function paintLog() {
  logEl.replaceChildren(...(log.length ? log : [null]).map((e) => (e
    ? h('li', { class: e.ok ? '' : 'is-bad' },
      h('time', {}, e.at.toLocaleTimeString('de-DE')),
      h('span', {}, `${BRIDGE_COMMANDS[e.type] ?? e.type}`),
      h('small', {}, e.text))
    : h('li', { class: 'brg-empty' }, 'Noch keine Befehle vom Gerät.'))));
}

async function start() {
  const api = await createApi();
  const res = await api.resolveChannel(channelFromUrl()).catch((err) => { console.warn('Kanal nicht lesbar:', err); return { platform: false, channel: null }; });
  setChannel(res.channel, res.platform);
  try {
    await api.consoleGet(); // prüft is_site_admin
  } catch (err) {
    console.warn('Console nicht lesbar:', germanError(err));
    block('Nur für Plattform-Admins. In diesem Browser (bzw. im OBS-Dock) einmal admin.html öffnen, anmelden und „Webseite als Admin“ wählen – dann diese Seite neu laden.', true);
    return;
  }
  app.hidden = false;
  $('#brg-channel').textContent = res.channel?.display_name || res.channel?.login || 'Standard-Kanal';

  const link = openLink(api, await linkTopic(api, channelFromUrl()));
  link.onStatus((s) => pill($('#brg-link'), s === 'ok' ? true : s === 'connecting' ? null : false,
    s === 'ok' ? 'StreamHelp verbunden' : s === 'connecting' ? 'StreamHelp …' : 'StreamHelp getrennt'));

  let obs = api.demo ? createDemoObs() : new ObsSocket();
  const bridge = createBridge({
    link,
    obs: { get connected() { return obs.connected; }, request: (t, d) => obs.request(t, d), get ws() { return obs.ws; }, set onEvent(fn) { obs.onEvent = fn; }, get onEvent() { return obs.onEvent; } },
    onLog: (e) => { log.unshift(e); log.length = Math.min(log.length, 25); paintLog(); },
    onState: (s, seen) => {
      pill($('#brg-obs'), !!s.obs, s.obs ? `OBS verbunden${obs.demo ? ' (Demo)' : ''}` : 'OBS nicht verbunden');
      $('#brg-summary').textContent = s.obs
        ? `${s.scenes.length} Szenen · ${s.inputs.length} Audioquellen · Szene „${s.scene}“${s.stream?.on ? ` · LIVE ${s.stream.time}` : ''}${s.record?.on ? ' · REC' : ''}`
        : (s.error ?? 'Warte auf OBS …');
      pill($('#brg-device'), seen ? Date.now() - seen < 120_000 : null, seen ? `Gerät zuletzt ${new Date(seen).toLocaleTimeString('de-DE')}` : 'Gerät noch nicht gemeldet');
    },
  });
  paintLog();
  bridge.start();

  // ---------- OBS verbinden (echter Modus) ----------
  const form = $('#brg-form');
  form.hidden = !!obs.demo;
  $('#brg-demo').hidden = !obs.demo;
  try { form.port.value = localStorage.getItem(PORT_KEY) || '4455'; } catch { form.port.value = '4455'; }
  const msg = $('#brg-msg');
  let retry = 0;

  async function connect(password, port, quiet = false) {
    clearTimeout(retry);
    try {
      await obs.connect({ password, port: Number(port) || 4455 });
      msg.textContent = '';
      obs.onClose = () => { bridge.obsChanged(); msg.textContent = 'OBS getrennt – neuer Versuch in 10 Sekunden …'; retry = setTimeout(() => connect(password, port, true), 10_000); };
      bridge.obsChanged();
      return true;
    } catch (err) {
      if (!quiet) msg.textContent = err.message;
      retry = setTimeout(() => connect(password, port, true), 10_000);
      bridge.obsChanged();
      return false;
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    const password = form.password.value;
    const port = form.port.value;
    try { localStorage.setItem(PORT_KEY, port); } catch { /* nur Komfort */ }
    const ok = await connect(password, port);
    if (ok && form.remember.checked) {
      try { await saveSecret(SECRET, password); } catch (err) { console.warn('Passwort nicht gemerkt:', err.message); }
    }
    if (ok) form.password.value = '';
    btn.disabled = false;
  });
  $('#brg-forget').addEventListener('click', async () => {
    try { await forgetSecret(SECRET); msg.textContent = 'Gespeichertes Passwort gelöscht.'; } catch (err) { msg.textContent = `Löschen ging nicht: ${err.message}`; }
  });

  if (!obs.demo) {
    let saved = '';
    try { saved = (await loadSecret(SECRET)) ?? ''; } catch (err) { console.warn('Gespeichertes Passwort nicht lesbar:', err.message); }
    connect(saved, form.port.value, true);
  } else {
    bridge.obsChanged();
    $('#brg-demo-off').addEventListener('click', () => {
      obs = { connected: false, request: async () => { throw new Error('Demo-OBS aus'); } };
      bridge.obsChanged();
    });
  }
  addEventListener('pagehide', () => bridge.stop());
}

start().catch((err) => {
  console.error(err);
  block(`Konnte nicht starten: ${germanError(err)}`);
});
