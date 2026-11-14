// Emote-Regen (Overlay-Ebene „Emote-Regen“, erain=1): Emotes aus dem Twitch-Chat regnen übers ganze Bild.
// Liest den Chat anonym mit (js/twitch-chat.js) – keine Datenbank, kein Bot nötig.
//   !regen (Befehl einstellbar)   lässt die Emotes aus der Nachricht regnen – ohne Emote die zuletzt
//                                 benutzten. Abklingzeit für alle; Streamer und Mods dürfen immer.
//   Emote-Combo                   schreibt der Chat dasselbe Emote oft genug in kurzer Zeit, regnet es von selbst.
//   Jedes Emote                   auf Wunsch fällt zu jedem Emote im Chat ein einzelnes herunter.
//   Eigene Emotes                 aus dem Emote-Editor („Im Stream benutzen“, Migration …_channel_emotes.sql): Ihr
//                                 Code-Wort zählt wie ein Twitch-Emote – „!regen ggstempel“ (auch vom Bot), Combo,
//                                 einzelne Tropfen. Sie müssen nicht bei Twitch hochgeladen sein.
//   Gekauft                       mit Kanalpunkten („🌧️ Emote-Regen“) oder Bits im Twitch-Panel (…_emote_rain_shop.sql):
//                                 kommt über core.emote_rain_events (Realtime, zur Sicherheit alle 15 s nachgesehen)
//                                 und regnet extra kräftig, mit Namen oben. Ohne gewähltes Emote: die eigenen Emotes
//                                 des Kanals und die zuletzt im Chat benutzten.
// Parameter: ercmd=regen  erwho=all|subs|mods  ercool=30 (s)  ercombo=5 (0 = aus)  erall=1  ermax=40  ersize=100
// Testmodus (test=1): alle paar Sekunden ein Probe-Regen.
import { EMOTE_URL, connectTwitchChat } from './twitch-chat.js';
import { CONFIG } from './config.js';
import { channelHeaders, rtSpec } from './channel.js';

const COMBO_WINDOW_MS = 8000;
const COMBO_COOLDOWN_MS = 20_000;
const MAX_ON_SCREEN = 160;
const RECENT = 12;
// Für den Testmodus: bekannte globale Twitch-Emotes (Kappa, <3, HeyGuys, LUL) – fällt ein Bild aus, kommt ein Emoji
const TEST_EMOTES = [{ id: '25', name: 'Kappa' }, { id: '9', name: '<3' }, { id: '30259', name: 'HeyGuys' }, { id: '425618', name: 'LUL' }];
const FALLBACK = ['💜', '✨', '🎉', '⭐'];
const CUSTOM_REFRESH_MS = 120_000;
const BOUGHT_POLL_MS = 15_000;
const BOUGHT_MAX_AGE_MS = 90_000; // ältere Käufe (Overlay war aus) nicht nachholen

// Eigene Emotes des Kanals: code → Bild-Adresse (Demo-Modus: aus dem Browser-Speicher des Editors)
async function loadCustomEmotes() {
  const url = (u) => (typeof u === 'string' && (/^https:\/\//.test(u) || /^data:image\/(gif|png);base64,/.test(u)) ? u : null);
  if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) {
    try { return (JSON.parse(localStorage.getItem('zd_channel_emotes')) ?? []).map((e) => ({ code: e.code, url: url(e.url) })).filter((e) => e.url); } catch { return []; }
  }
  const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/rpc/channel_emotes`, {
    method: 'POST',
    headers: { apikey: CONFIG.SUPABASE_ANON_KEY, Authorization: `Bearer ${CONFIG.SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json', ...channelHeaders() },
    body: '{}',
    cache: 'no-store',
  });
  if (!res.ok) return []; // Migration fehlt oder Kanal unbekannt: dann eben nur Twitch-Emotes
  const list = await res.json();
  return (Array.isArray(list) ? list : []).filter((e) => /^[a-z0-9]{2,25}$/.test(e?.code ?? '') && typeof e.path === 'string')
    .map((e) => ({ code: e.code, url: `${CONFIG.SUPABASE_URL}/storage/v1/object/public/channel-emotes/${e.path.split('/').map(encodeURIComponent).join('/')}?v=${Date.parse(e.updated_at) || 0}` }));
}

export function readEmoteRain({ flag, number, params }) {
  if (!flag('erain', false)) return null;
  const who = params.get('erwho');
  return {
    cmd: (params.get('ercmd') ?? 'regen').toLowerCase().replace(/[^a-z0-9äöüß]/g, '').slice(0, 20) || 'regen',
    who: ['subs', 'mods'].includes(who) ? who : 'all',
    coolMs: number('ercool', 30, 0, 600) * 1000,
    combo: number('ercombo', 5, 0, 50),
    all: flag('erall', false),
    max: number('ermax', 40, 5, 120),
    size: number('ersize', 100, 50, 250) / 100,
  };
}

export function setupEmoteRain(cfg, { channel, test, client = null }) {
  const layer = document.createElement('div');
  layer.className = 'ov-erain';
  layer.setAttribute('aria-hidden', 'true');
  document.body.append(layer);

  const recent = [];                 // zuletzt benutzte Emotes (für !regen ohne Emote)
  const seen = new Map();            // Emote → Zeitpunkte (Combo)
  const comboAt = new Map();         // Emote → letzter Combo-Regen
  let lastRain = 0;
  let custom = new Map();            // eigenes Emote: code → { id, name, url }
  const refreshCustom = () => loadCustomEmotes().then((list) => {
    custom = new Map(list.map((e) => [e.code, { id: `c:${e.code}`, name: e.code, url: e.url }]));
  }, () => {});
  refreshCustom();
  const customTimer = setInterval(refreshCustom, CUSTOM_REFRESH_MS);

  function drop(emote, { delay = 0, small = false } = {}) {
    if (layer.childElementCount >= MAX_ON_SCREEN) return;
    const size = Math.round((small ? 40 : 48 + Math.random() * 40) * cfg.size);
    const el = document.createElement('span');
    el.className = 'er-drop';
    const dur = 3.2 + Math.random() * 2.6;
    el.style.cssText = `left:${Math.random() * 96}%;width:${size}px;height:${size}px;animation-duration:${dur}s;animation-delay:${delay}s;`
      + `--er-rot:${Math.round(Math.random() * 720 - 360)}deg;--er-sway:${Math.round(Math.random() * 120 - 60)}px`;
    if (emote.id) {
      const img = new Image();
      img.alt = '';
      img.decoding = 'async';
      img.src = emote.url ?? EMOTE_URL(emote.id);
      img.onerror = () => { img.replaceWith(document.createTextNode(FALLBACK[Math.floor(Math.random() * FALLBACK.length)])); };
      el.append(img);
    } else el.textContent = emote.text ?? '💜';
    el.addEventListener('animationend', () => el.remove(), { once: true });
    layer.append(el);
  }

  function rain(emotes, count = cfg.max) {
    const list = emotes.length ? emotes : recent.length ? recent.slice(-6) : [{ text: '💜' }];
    for (let i = 0; i < count; i++) drop(list[i % list.length], { delay: Math.random() * 2.2 });
  }

  const allowed = (badges) => {
    const ids = badges.map((b) => b.id);
    if (cfg.who === 'mods') return ids.includes('broadcaster') || ids.includes('moderator');
    if (cfg.who === 'subs') return ids.some((b) => ['broadcaster', 'moderator', 'vip', 'subscriber', 'founder'].includes(b));
    return true;
  };

  function onMessage(m) {
    const emotes = m.parts.filter((p) => p.emote).map((p) => ({ id: p.emote, name: p.name }));
    // eigene Emotes: Code-Wörter im Text (Groß/Klein egal, Satzzeichen drumherum zählen nicht)
    if (custom.size) {
      for (const p of m.parts) {
        if (p.emote || !p.text) continue;
        for (const w of p.text.toLowerCase().split(/\s+/)) {
          const e = custom.get(w.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ''));
          if (e) emotes.push(e);
        }
      }
    }
    const now = Date.now();
    for (const e of emotes) {
      if (!recent.some((r) => r.id === e.id)) recent.push(e);
      if (recent.length > RECENT) recent.shift();
    }
    const word = m.text.trim().toLowerCase().split(/\s+/)[0];
    if (word === `!${cfg.cmd}`) {
      const staff = m.badges.some((b) => b.id === 'broadcaster' || b.id === 'moderator');
      if (staff || (allowed(m.badges) && now - lastRain >= cfg.coolMs)) {
        lastRain = now;
        rain(emotes);
      }
      return;
    }
    if (cfg.all) emotes.slice(0, 5).forEach((e, i) => drop(e, { delay: i * 0.15, small: true }));
    // Combo: dasselbe Emote oft in kurzer Zeit
    if (!cfg.combo) return;
    for (const e of new Map(emotes.map((x) => [x.id, x])).values()) {
      const times = (seen.get(e.id) ?? []).filter((t) => now - t < COMBO_WINDOW_MS);
      times.push(now);
      seen.set(e.id, times);
      if (times.length >= cfg.combo && now - (comboAt.get(e.id) ?? 0) > COMBO_COOLDOWN_MS) {
        comboAt.set(e.id, now);
        seen.set(e.id, []);
        rain([e], Math.round(cfg.max * 0.75));
      }
    }
  }

  // ---------- Gekaufter Regen (Kanalpunkte, Bits, Probe aus dem Dashboard) ----------
  const banner = document.createElement('div');
  banner.className = 'er-buyer';
  banner.hidden = true;
  document.body.append(banner);
  let bannerTimer = 0;
  function showBuyer(ev) {
    const who = String(ev.by_name ?? '').slice(0, 40);
    banner.textContent = `🌧️ ${ev.source === 'test' ? 'Probe-Regen' : who}${ev.source === 'bits' ? ' 💎' : ''}`;
    banner.hidden = false;
    banner.classList.remove('is-in');
    void banner.offsetWidth; // Animation neu starten
    banner.classList.add('is-in');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => { banner.hidden = true; }, 4500);
  }
  const done = new Set();
  let lastId = 0;
  function bought(ev) {
    const id = Number(ev?.id);
    if (!Number.isFinite(id) || done.has(id)) return;
    done.add(id);
    lastId = Math.max(lastId, id);
    if (Date.now() - (Date.parse(ev.created_at) || Date.now()) > BOUGHT_MAX_AGE_MS) return;
    const codes = Array.isArray(ev.codes) ? ev.codes.map((c) => String(c).toLowerCase()) : [];
    let list = codes.map((c) => custom.get(c) ?? recent.find((r) => String(r.name ?? '').toLowerCase() === c)).filter(Boolean);
    if (!list.length) list = [...custom.values(), ...recent.slice(-6)];
    if (!list.length) list = TEST_EMOTES;
    rain(list, Math.min(150, Math.round(cfg.max * 1.5)));
    showBuyer(ev);
  }
  let rt = null;
  let pollTimer = 0;
  if (client) {
    const COLS = 'id, source, by_name, codes, created_at';
    // Nur, was ab jetzt gekauft wird
    let ready = false;
    client.from('emote_rain_events').select('id').order('id', { ascending: false }).limit(1)
      .then(({ data }) => { lastId = Math.max(lastId, Number(data?.[0]?.id) || 0); ready = true; }, () => { ready = true; });
    rt = client.channel('overlay-erain')
      .on('postgres_changes', rtSpec('emote_rain_events', 'INSERT'), (p) => bought(p.new))
      .subscribe((status) => { if (status === 'CHANNEL_ERROR') console.error('Overlay: Realtime-Kanal für den Emote-Regen fehlgeschlagen'); });
    pollTimer = setInterval(() => {
      if (!ready) return;
      client.from('emote_rain_events').select(COLS).gt('id', lastId).order('id').limit(5)
        .then(({ data }) => (data ?? []).forEach(bought), () => {});
    }, BOUGHT_POLL_MS);
  }

  // Demo-Modus (ohne Supabase): Probe-Regen aus dem Dashboard im selben Browser (localStorage)
  const onStorage = (e) => {
    if (e.key !== 'zd_emote_rain_events' || !e.newValue) return;
    try { (JSON.parse(e.newValue) ?? []).forEach((ev) => { if (Number(ev?.id) > lastId) bought(ev); }); } catch { /* kaputter Eintrag: überspringen */ }
  };
  if (!client && !CONFIG.SUPABASE_URL) {
    try { lastId = Math.max(0, ...(JSON.parse(localStorage.getItem('zd_emote_rain_events')) ?? []).map((ev) => Number(ev?.id) || 0)); } catch { lastId = 0; }
    window.addEventListener('storage', onStorage);
  }

  const stop = channel ? connectTwitchChat(channel, { message: onMessage }) : () => {};
  let timer = 0;
  if (test) {
    const testList = () => [...TEST_EMOTES, ...custom.values()];
    rain(testList(), Math.round(cfg.max / 2));
    timer = setInterval(() => rain(testList(), Math.round(cfg.max / 2)), 7000);
  }
  return () => {
    stop(); clearInterval(timer); clearInterval(customTimer); clearInterval(pollTimer); clearTimeout(bannerTimer);
    if (rt) client.removeChannel(rt);
    window.removeEventListener('storage', onStorage);
    layer.remove(); banner.remove();
  };
}
