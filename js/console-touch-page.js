// console-touch.html: Oberfläche für das Touch-Display der Console (Entwurf) im Vollbild.
// Nur mit einer Anmeldung als Plattform-Admin (console_get prüft is_site_admin). Kanal per ?c=<login>,
// sonst der Standard-Kanal. Live-Daten alle 10 s, Einstellungen aus dem Admin-Bereich jede Minute,
// OBS und Ton über die Bridge am PC (console-bridge.html, js/console-link.js).
import { createApi, germanError } from './api.js';
import { channelFromUrl, setChannel } from './channel.js';
import { createExtrasApi } from './extras-api.js';
import { createTouchRunner, mountTouch } from './console-touch.js';
import { linkTopic, openLink } from './console-link.js';

const host = document.getElementById('tch-host');
const gate = document.getElementById('tch-gate');
const gateText = document.getElementById('tch-gate-text');
const gateLink = document.getElementById('tch-gate-link');
const fsBtn = document.getElementById('tch-fullscreen');

function block(text, { login = false } = {}) {
  gateText.textContent = text;
  gateLink.hidden = !login;
  fsBtn.hidden = true;
  gate.hidden = false;
}

const goalOf = (d) => { const g = Number(d?.goal); return Number.isFinite(g) && g >= 1 && g <= 999 ? Math.round(g) : 10; };

// Bildschirm wach halten (Wake Lock geht nur bei sichtbarer Seite, nach dem Zurückkommen neu anfordern)
async function keepAwake() {
  if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  try {
    await navigator.wakeLock.request('screen');
  } catch (err) {
    console.warn('Bildschirm bleibt nicht wach:', err.message);
  }
}

async function start() {
  const api = await createApi();
  const res = await api.resolveChannel(channelFromUrl()).catch((err) => { console.warn('Kanal nicht lesbar:', err); return { platform: false, channel: null }; });
  setChannel(res.channel, res.platform);
  let cfg;
  try {
    cfg = await api.consoleGet();
  } catch (err) {
    if (/console_get|console_config/.test(err?.message ?? '')) { block('Die Console ist noch nicht eingerichtet (Migration …_console.sql fehlt).'); return; }
    block('Nur für Plattform-Admins. Auf diesem Gerät einmal admin.html öffnen, anmelden und „Webseite als Admin“ wählen – dann diese Seite neu laden.', { login: true });
    console.warn('Console nicht lesbar:', germanError(err));
    return;
  }
  // Verbindung zur Bridge am PC (OBS, Ton) – ohne Bridge laufen alle anderen Seiten trotzdem
  const link = openLink(api, await linkTopic(api, channelFromUrl()));
  const runner = createTouchRunner({ api, extras: createExtrasApi(api), link });
  await runner.loadStatic();
  const ui = mountTouch(host, { cfg: cfg.display?.touch, goal: goalOf(cfg.display), runner, fill: true, onError: (err) => console.warn('Touch-Aktion:', err) });
  document.title = `Console · ${res.channel?.display_name || res.channel?.login || 'StreamHelp'}`;

  const live = async () => {
    try { ui.setLive(await runner.loadLive()); } catch (err) { console.warn('Live-Daten nicht lesbar:', err); }
  };
  const reload = async () => {
    try {
      cfg = await api.consoleGet();
      ui.setConfig(cfg.display?.touch);
      ui.setGoal(goalOf(cfg.display));
      await runner.loadStatic();
    } catch (err) {
      console.warn('Einstellungen nicht lesbar:', err);
    }
  };
  live();
  setInterval(live, 10000);
  setInterval(() => runner.hello(), 30000);
  setInterval(reload, 60000);
  keepAwake();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { keepAwake(); live(); } });

  // Vollbild braucht eine Berührung; im Kiosk-Modus ist die Seite schon randlos
  if (document.fullscreenEnabled && !document.fullscreenElement && !matchMedia('(display-mode: fullscreen)').matches) {
    fsBtn.hidden = false;
    fsBtn.addEventListener('click', async () => {
      try { await document.documentElement.requestFullscreen(); } catch (err) { console.warn('Vollbild nicht möglich:', err.message); }
      fsBtn.hidden = true;
    }, { once: true });
  }
}

start().catch((err) => {
  console.error(err);
  block(`Konnte nicht starten: ${germanError(err)}`);
});
