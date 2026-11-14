// Admin-Bereich → Console → „Touch-Bildschirm“: Oberfläche des Touch-Displays einstellen und im Simulator
// ausprobieren (js/console-touch.js). Gespeichert in core.console_config.display.touch über console_save –
// die Tasten-Belegung (keys) und die übrigen Display-Werte bleiben dabei unverändert.
// OBS und Ton im Simulator: über die Bridge am PC (console-bridge.html), wie auf dem echten Gerät.
import { h } from './extras-core.js';
import { linkTopic, shareLink } from './console-link.js';
import {
  TOUCH_COLORS, TOUCH_DEFAULT, TOUCH_IDLE, TOUCH_PAGES, TOUCH_SIZES, cleanTile, createTouchRunner, mountTouch,
  normalizeTouch, obsOnline, touchActions, touchMaxTiles,
} from './console-touch.js';

let ctx = null;    // { api, extras, toast, germanError, channel }
let raw = null;    // Antwort von console_get
let saved = null;  // gespeicherte Touch-Einstellungen (normalisiert)
let draft = null;  // Entwurf beim Bearbeiten
let sim = null;    // Simulator (mountTouch)
let runner = null;
let real = false;  // Simulator löst wirklich aus
let timer = 0;
let root = null;
let form = null;
let head = null;
let link = null;   // Verbindung zur Bridge (js/console-link.js)
let bridgeBox = null;

const missing = (err) => /console_get|console_save|console_config/.test(err?.message ?? '');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const goalOf = (d) => { const g = Number(d?.goal); return Number.isFinite(g) && g >= 1 && g <= 999 ? Math.round(g) : 10; };

export async function renderTouchAdmin(slot, deps) {
  ctx = deps;
  root = slot;
  clearInterval(timer);
  sim?.destroy();
  sim = null;
  link?.close();
  link = null;
  slot.replaceChildren(h('p', { class: 'muted' }, 'Lädt …'));
  try {
    raw = await ctx.api.consoleGet();
  } catch (err) {
    slot.replaceChildren(h('section', { class: 'dash-card dash-card--wide' },
      h('h2', {}, 'Touch-Bildschirm'),
      h('p', { class: 'field-hint' }, missing(err)
        ? 'Die Console ist noch nicht eingerichtet: Migration supabase/migrations/20261221000000_console.sql im SQL Editor ausführen.'
        : ctx.germanError(err))));
    return;
  }
  saved = normalizeTouch(raw.display?.touch);
  draft = structuredClone(saved);
  link = shareLink(ctx.api, await linkTopic(ctx.api, ctx.channel?.()?.id ?? null));
  runner = createTouchRunner({ api: ctx.api, extras: ctx.extras, dry: () => !real, link });
  await runner.loadStatic();
  bridgeBox = h('div', { class: 'tch-adm-bridge', 'aria-live': 'polite' });
  link.onStatus(() => paintBridge());

  head = h('header', { class: 'tch-adm-head' });
  const host = h('div', { class: 'tch-adm-host' });
  form = h('div', { class: 'tch-adm-form' });
  slot.replaceChildren(
    h('section', { class: 'dash-card dash-card--wide tch-adm' },
      head,
      h('div', { class: 'tch-adm-grid' },
        h('div', { class: 'tch-adm-sim' },
          host,
          h('div', { class: 'tch-adm-simbar' },
            h('label', { class: 'toggle' },
              h('input', { type: 'checkbox', id: 'tch-real', onchange: (e) => { real = e.target.checked; paintHead(); } }),
              h('span', { class: 'toggle-ui', 'aria-hidden': 'true' }), 'Echt auslösen'),
            h('button', { type: 'button', class: 'btn btn--ghost btn--sm', onclick: () => sim?.sleep() }, '🌙 Bildschirmschoner zeigen')),
          h('p', { class: 'field-hint' }, 'Wischen oder unten auf die Reiter tippen. Ohne „Echt auslösen“ zeigt der Simulator nur an, was passieren würde.')),
        form)),
    deviceCard(),
  );
  sim = mountTouch(host, { cfg: draft, goal: goalOf(raw.display), runner, onError: (err) => console.warn('Touch-Simulator:', err) });
  paintHead();
  paintForm();
  refresh();
  paintBridge();
  // OBS-Zustand: Bridge-Anzeige aktualisieren; Szenen/Quellen für die Kachel-Ziele erst übernehmen, wenn sich die Namen ändern
  let names = '';
  runner.onObs((o) => {
    paintBridge();
    const next = JSON.stringify([o.scenes ?? [], (o.inputs ?? []).map((i) => i.name)]);
    if (next !== names) { names = next; if (!form.contains(document.activeElement)) paintForm(); }
  });
  timer = setInterval(() => {
    if (!root?.isConnected || root.closest('.adm-view')?.hidden) { clearInterval(timer); link?.close(); link = null; return; }
    refresh();
    paintBridge();
    runner.hello();
  }, 15000);
}

async function refresh() {
  try {
    sim?.setLive(await runner.loadLive());
  } catch (err) {
    console.warn('Touch-Simulator: Live-Daten nicht lesbar', err);
  }
}

// ---------- Kopf: Status und Speichern ----------
function paintHead() {
  const dirty = !same(normalizeTouch(draft), saved);
  const when = raw.updated_at ? new Date(raw.updated_at).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }) : '';
  head.replaceChildren(
    h('div', {},
      h('h2', {}, 'Touch-Bildschirm'),
      h('p', { class: 'dash-status' }, dirty
        ? 'Ungespeicherte Änderungen – der Simulator zeigt schon den Entwurf.'
        : when ? `Gespeichert von ${raw.updated_by || 'unbekannt'} am ${when}.` : 'Noch nicht gespeichert – das sind die Vorgaben.'),
      real ? h('p', { class: 'tch-adm-warn' }, '⚠️ Echt auslösen ist an: Kacheln wirken im gewählten Kanal.') : null),
    h('div', { class: 'tch-adm-actions' },
      h('button', { type: 'button', class: 'btn btn--ghost btn--sm', onclick: resetDefaults }, 'Vorgaben'),
      h('button', { type: 'button', class: 'btn btn--ghost btn--sm', disabled: !dirty, onclick: discard }, 'Verwerfen'),
      h('button', { type: 'button', class: 'btn btn--primary btn--sm', disabled: !dirty, onclick: (e) => save(e.currentTarget) }, 'Speichern')),
  );
}

// Der Entwurf bleibt dasselbe Objekt (die Eingabefelder ändern es direkt); geprüft wird beim Anzeigen und Speichern
function changed(rebuild = false) {
  sim?.setConfig(draft);
  paintHead();
  if (rebuild) paintForm();
}

function discard() { draft = structuredClone(saved); changed(true); }
function resetDefaults() { draft = normalizeTouch(TOUCH_DEFAULT); changed(true); }

async function save(btn) {
  btn.disabled = true;
  try {
    // Frisch lesen, damit eine inzwischen geänderte Tasten-Belegung nicht überschrieben wird
    const fresh = await ctx.api.consoleGet();
    raw = await ctx.api.consoleSave(fresh.keys ?? [], { ...(fresh.display ?? {}), touch: normalizeTouch(draft) });
    saved = normalizeTouch(raw.display?.touch);
    draft = structuredClone(saved);
    ctx.toast('Touch-Bildschirm gespeichert – das Gerät übernimmt es innerhalb einer Minute.', 'ok');
    sim?.setGoal(goalOf(raw.display));
    changed(true);
  } catch (err) {
    ctx.toast(missing(err) ? 'Erst die Migration …_console.sql ausführen.' : ctx.germanError(err), 'error');
    btn.disabled = false;
  }
}

// ---------- Einstellungen ----------
function select(id, value, options, onchange) {
  return h('select', { id, onchange: (e) => onchange(e.target.value) },
    ...options.map(([v, name]) => h('option', { value: String(v), selected: String(v) === String(value) }, name)));
}
const field = (label, control, hint) => h('label', { class: 'field tch-adm-field' }, h('span', {}, label), control, hint ? h('small', { class: 'field-hint' }, hint) : null);

function paintForm() {
  const d = draft;
  form.replaceChildren(
    h('fieldset', { class: 'tch-adm-set' },
      h('legend', {}, 'Bildschirm'),
      h('div', { class: 'tch-adm-row' },
        field('Größe', select('tch-size', d.size, Object.entries(TOUCH_SIZES).map(([id, s]) => [id, s.name]), (v) => { d.size = v; changed(); })),
        field('Ausrichtung', select('tch-orient', d.orient, [['land', 'Quer'], ['port', 'Hoch']], (v) => { d.orient = v; changed(); }))),
      field('Startseite', select('tch-start', d.start, TOUCH_PAGES.filter(([id]) => d.pages.includes(id)), (v) => { d.start = v; changed(); })),
      field(`Helligkeit · ${d.bright} %`, h('input', {
        type: 'range', id: 'tch-bright', min: '20', max: '100', step: '5', value: String(d.bright),
        oninput: (e) => { d.bright = Number(e.target.value); e.target.previousElementSibling.textContent = `Helligkeit · ${d.bright} %`; changed(); },
      })),
      h('div', { class: 'field tch-adm-field' }, h('span', {}, 'Akzentfarbe'), swatches(d.accent, (v) => { d.accent = v; changed(true); })),
      h('label', { class: 'toggle tch-adm-toggle' },
        h('input', { type: 'checkbox', checked: d.hold, onchange: (e) => { d.hold = e.target.checked; changed(); } }),
        h('span', { class: 'toggle-ui', 'aria-hidden': 'true' }), 'Raid-Schutz, Stream und Aufnahme nur mit langem Drücken'),
      toggle('Klick-Ton beim Tippen', d.click, (v) => { d.click = v; changed(); }),
      toggle('Vibration beim Tippen (wenn das Gerät es kann)', d.buzz, (v) => { d.buzz = v; changed(); })),
    h('fieldset', { class: 'tch-adm-set' },
      h('legend', {}, 'Bildschirmschoner'),
      h('div', { class: 'tch-adm-row' },
        field('Schlafen', select('tch-idle', d.idle, TOUCH_IDLE, (v) => { d.idle = Number(v); changed(); })),
        field('Motiv', select('tch-saver', d.saver, [['scene', 'Nachtszene (animiert)'], ['clock', 'Nur Uhr']], (v) => { d.saver = v; changed(); }))),
      toggle('Neuer Alert weckt kurz auf (groß auf dem Bildschirm)', d.alertWake, (v) => { d.alertWake = v; changed(); }),
      h('p', { class: 'field-hint' }, 'Gegen Einbrennen wandern Uhr und Szene alle 40 Sekunden an eine neue Stelle.'),
      toggle('Nachtmodus', d.night.on, (v) => { d.night.on = v; changed(true); }),
      d.night.on ? h('div', { class: 'tch-adm-row' },
        field('Von', h('input', { type: 'time', value: d.night.from, onchange: (e) => { d.night.from = e.target.value || '23:00'; changed(); } })),
        field('Bis', h('input', { type: 'time', value: d.night.to, onchange: (e) => { d.night.to = e.target.value || '07:00'; changed(); } }))) : null,
      d.night.on ? toggle('Nachts ganz schwarz (nur eine schwache Uhr)', d.night.black, (v) => { d.night.black = v; changed(); }) : null,
      d.night.on ? h('p', { class: 'field-hint' }, 'Nachts: höchstens 40 % Helligkeit, Schlafen schon nach 1 Minute. Tippen weckt trotzdem.') : null),
    h('fieldset', { class: 'tch-adm-set' },
      h('legend', {}, 'Seiten'),
      h('p', { class: 'field-hint' }, 'Reihenfolge = Reiter unten und Wisch-Richtung. „Start“ ist immer dabei.'),
      h('ol', { class: 'tch-adm-pages' }, ...pageOrder().map((id) => pageRow(id)))),
    h('fieldset', { class: 'tch-adm-set' },
      h('legend', {}, `Kacheln auf „Start“ (${d.tiles.length} / ${touchMaxTiles})`),
      d.tiles.length ? h('ol', { class: 'tch-adm-tiles' }, ...d.tiles.map((t, i) => tileRow(t, i))) : h('p', { class: 'field-hint' }, 'Noch keine Kacheln.'),
      h('div', { class: 'tch-adm-actions' },
        h('button', { type: 'button', class: 'btn btn--ghost btn--sm', disabled: d.tiles.length >= touchMaxTiles, onclick: () => { d.tiles.push(cleanTile({ action: 'none', icon: '⭐', label: 'Neu' })); changed(true); } }, '＋ Kachel'),
        h('button', { type: 'button', class: 'btn btn--ghost btn--sm', onclick: fromKeys, title: 'Die 9 Tasten der Console als Kacheln übernehmen (höchstens 8)' }, '⌨️ Von den Tasten übernehmen'))),
  );
}

function toggle(label, checked, onchange) {
  return h('label', { class: 'toggle tch-adm-toggle' },
    h('input', { type: 'checkbox', checked, onchange: (e) => onchange(e.target.checked) }),
    h('span', { class: 'toggle-ui', 'aria-hidden': 'true' }), label);
}

function swatches(value, onpick) {
  return h('div', { class: 'tch-adm-swatches', role: 'radiogroup', 'aria-label': 'Akzentfarbe' },
    ...TOUCH_COLORS.map((col) => {
      const b = h('button', { type: 'button', class: 'tch-adm-swatch', role: 'radio', 'aria-checked': String(col === value), 'aria-label': col, onclick: () => onpick(col) });
      b.style.setProperty('--c', col);
      return b;
    }));
}

// Alle Seiten: erst die eingeschalteten in ihrer Reihenfolge, dann die ausgeschalteten
const pageOrder = () => [...draft.pages, ...TOUCH_PAGES.map(([id]) => id).filter((id) => !draft.pages.includes(id))];
function pageRow(id) {
  const [, name, icon] = TOUCH_PAGES.find(([p]) => p === id);
  const on = draft.pages.includes(id);
  const i = draft.pages.indexOf(id);
  const move = (dir) => { const p = draft.pages; [p[i], p[i + dir]] = [p[i + dir], p[i]]; changed(true); };
  return h('li', { class: `tch-adm-page${on ? '' : ' is-off'}` },
    h('label', { class: 'tch-adm-check' },
      h('input', { type: 'checkbox', checked: on, disabled: id === 'home', onchange: (e) => {
        draft.pages = e.target.checked ? [...draft.pages, id] : draft.pages.filter((p) => p !== id);
        changed(true);
      } }),
      `${icon} ${name}`),
    h('span', { class: 'tch-adm-move' },
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': `${name} nach oben`, disabled: !on || i <= 0, onclick: () => move(-1) }, '↑'),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': `${name} nach unten`, disabled: !on || i >= draft.pages.length - 1, onclick: () => move(1) }, '↓')));
}

function tileRow(t, i) {
  const acts = touchActions(runner.data.variants, runner.data.obs);
  const args = acts[t.action]?.args;
  const listId = `tch-sugg-${i}`;
  const tiles = draft.tiles;
  const move = (dir) => { [tiles[i], tiles[i + dir]] = [tiles[i + dir], tiles[i]]; changed(true); };
  return h('li', { class: 'tch-adm-tile' },
    h('input', { type: 'text', class: 'tch-adm-icon', value: t.icon, maxlength: '8', 'aria-label': `Kachel ${i + 1}: Symbol`, oninput: (e) => { t.icon = e.target.value; changed(); } }),
    h('input', { type: 'text', class: 'tch-adm-label', value: t.label, maxlength: '24', placeholder: 'Beschriftung', 'aria-label': `Kachel ${i + 1}: Beschriftung`, oninput: (e) => { t.label = e.target.value; changed(); } }),
    h('select', { 'aria-label': `Kachel ${i + 1}: Aktion`, onchange: (e) => {
      t.action = e.target.value;
      const a = acts[t.action];
      t.arg = Array.isArray(a?.args) ? a.args[0]?.[0] ?? '' : a?.args === 'text' ? a.suggest[0] ?? '' : '';
      changed(true);
    } },
      ...Object.entries(acts).map(([id, a]) => h('option', { value: id, selected: id === t.action }, a.name))),
    args === 'text'
      ? h('span', { class: 'tch-adm-arg' },
        h('input', { type: 'text', value: t.arg, maxlength: '64', list: listId, placeholder: t.action === 'obs_scene' ? 'Name der Szene in OBS' : 'Name der Audioquelle in OBS', 'aria-label': `Kachel ${i + 1}: Ziel`, oninput: (e) => { t.arg = e.target.value; changed(); } }),
        h('datalist', { id: listId }, ...acts[t.action].suggest.map((v) => h('option', { value: v }))))
      : args
        ? h('select', { 'aria-label': `Kachel ${i + 1}: Ziel`, onchange: (e) => { t.arg = e.target.value; changed(); } },
          ...args.map(([v, name]) => h('option', { value: v, selected: v === t.arg }, name)))
        : h('span', { class: 'tch-adm-noarg' }, '—'),
    h('input', { type: 'color', value: t.color || draft.accent, 'aria-label': `Kachel ${i + 1}: Farbe`, oninput: (e) => { t.color = e.target.value; changed(); } }),
    h('span', { class: 'tch-adm-move' },
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Kachel ${i + 1} nach vorne`, disabled: i === 0, onclick: () => move(-1) }, '↑'),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Kachel ${i + 1} nach hinten`, disabled: i === tiles.length - 1, onclick: () => move(1) }, '↓'),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Kachel ${i + 1} entfernen`, onclick: () => { tiles.splice(i, 1); changed(true); } }, '✕')));
}

// Tasten-Belegung übernehmen: „Bereich öffnen“ gibt es auf dem Display nicht (das Dashboard läuft am PC)
function fromKeys() {
  const keys = (raw.keys ?? []).filter((k) => k && k.action && k.action !== 'none' && k.action !== 'page');
  if (!keys.length) { ctx.toast('Die Tasten sind noch nicht belegt – unter „Console“ belegen und speichern.', 'info'); return; }
  draft.tiles = keys.slice(0, touchMaxTiles).map(cleanTile);
  changed(true);
}

// ---------- Auf dem Gerät und am PC ----------
function pageLink(file) {
  const ch = ctx.channel?.();
  const url = new URL(file, location.href);
  if (ch?.login) url.searchParams.set('c', ch.login);
  const href = url.href;
  return h('div', { class: 'tch-adm-link' },
    h('code', {}, href),
    h('button', { type: 'button', class: 'btn btn--ghost btn--sm', onclick: async () => {
      try { await navigator.clipboard.writeText(href); ctx.toast('Link kopiert.', 'ok'); } catch (err) { ctx.toast(`Kopieren ging nicht: ${err.message}`, 'error'); }
    } }, 'Kopieren'),
    h('a', { class: 'btn btn--ghost btn--sm', href, target: '_blank', rel: 'noopener' }, 'Öffnen ↗'));
}

function deviceCard() {
  const ch = ctx.channel?.();
  return h('section', { class: 'dash-card dash-card--wide tch-adm-device' },
    h('h2', {}, 'So hängt alles zusammen'),
    h('ol', { class: 'tch-adm-flow', 'aria-label': 'Aufbau' },
      h('li', {}, h('b', {}, '📱 Display'), h('span', {}, 'console-touch.html im Vollbild')),
      h('li', {}, h('b', {}, '☁️ StreamHelp'), h('span', {}, 'privater Kanal, nur Admins')),
      h('li', {}, h('b', {}, '🖥️ Bridge am PC'), h('span', {}, 'console-bridge.html, Tab oder OBS-Dock')),
      h('li', {}, h('b', {}, '🎥 OBS'), h('span', {}, 'Szenen, Ton, Stream, Aufnahme'))),
    h('p', { class: 'field-hint' }, 'Glücksrad, Sounds, Alerts, Raid-Schutz und Overlay-Szenen laufen direkt über StreamHelp. Alles, was OBS selbst betrifft (Szenen, Mikrofon & Lautstärken, Stream, Aufnahme, Replay), geht über die Bridge am PC – sie spricht mit OBS über den WebSocket-Server auf diesem PC.'),
    h('h3', { class: 'tch-adm-sub' }, 'Display'),
    h('p', { class: 'field-hint' }, 'Im Vollbild öffnen (Kiosk-Modus, z. B. Chromium mit --kiosk). Einmalig im Browser des Geräts: admin.html öffnen, anmelden und „Webseite als Admin“ wählen – danach startet die Oberfläche von selbst, hält den Bildschirm wach und holt neue Einstellungen jede Minute.'),
    pageLink('console-touch.html'),
    h('h3', { class: 'tch-adm-sub' }, 'Bridge am PC (für OBS und Ton)'),
    h('p', { class: 'field-hint' }, 'Auf dem Streaming-PC öffnen – am besten als Dock in OBS (Docks → Benutzerdefinierte Browser-Docks). In OBS unter Werkzeuge → WebSocket-Servereinstellungen den Server aktivieren; das Passwort bleibt nur in diesem Browser. Einmalig dort ebenfalls als Admin anmelden. Braucht die Migration …_console_bridge.sql.'),
    pageLink('console-bridge.html'),
    bridgeBox,
    h('p', { class: 'field-hint' }, ch ? `Kanal: ${ch.display_name || ch.login} (oben rechts gewählt).` : 'Kanal: Standard-Kanal. Einen anderen Kanal oben rechts wählen.'));
}

// Zustand der Bridge (kommt alle paar Sekunden von console-bridge.html)
function paintBridge() {
  if (!bridgeBox) return;
  const o = runner?.data.obs;
  const on = obsOnline(o);
  const dot = (ok, text) => h('span', { class: `tch-adm-dot${ok === true ? ' is-ok' : ok === false ? ' is-bad' : ''}` }, text);
  bridgeBox.replaceChildren(
    dot(link?.status === 'ok' ? true : link?.status === 'connecting' ? null : false, link?.status === 'ok' ? 'StreamHelp-Kanal verbunden' : link?.status === 'connecting' ? 'Verbinde …' : 'Kanal abgelehnt – Migration …_console_bridge.sql ausgeführt?'),
    dot(on, on ? 'Bridge läuft' : 'Bridge nicht erreichbar'),
    on ? dot(!!o.obs, o.obs ? `OBS verbunden · ${o.scenes.length} Szenen · ${o.inputs.length} Audioquellen${o.stream?.on ? ` · LIVE ${o.stream.time}` : ''}` : 'OBS am PC nicht verbunden') : null,
  );
}
