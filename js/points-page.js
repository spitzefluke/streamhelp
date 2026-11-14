// Seite „Kanalpunkte“: alle Belohnungen von StreamHelp auf einen Blick (Liste links, Einstellungen rechts).
// Kosten, Abklingzeit und an/aus bleiben dort gespeichert, wo sie hingehören (Glücksrad, Ärgern, Vorlesen,
// Karten, Emote-Regen, Chat-Kommandos) – diese Seite schreibt über deren Funktionen. Neu dazu
// (…_points_center.sql): Limits pro Stream/Zuschauer, „Alle pausieren“ und die Einlösungen der letzten 7 Tage.
import { h } from './extras-core.js';
import { extrasApi } from './extras.js';
import { noAffiliate } from './affiliate.js';

const GROUPS = [
  { id: 'games', label: 'Glücksrad & Spiele' },
  { id: 'prank', label: 'Ärgern & Sounds' },
  { id: 'extras', label: 'Stream-Extras' },
  { id: 'cmd', label: 'Chat-Kommandos', action: 'Kommandos verwalten' },
];
const PRESETS = [100, 500, 1000, 2500, 5000, 10000];
const PAUSES = [
  { label: '15 Minuten', minutes: 15, icon: 'ph-timer' },
  { label: '1 Stunde', minutes: 60, icon: 'ph-hourglass-medium' },
  { label: 'Bis ich fortsetze', minutes: null, icon: 'ph-infinity' },
];
// Twitch: 10 Punkte je 5 Minuten Zuschauen, dazu die Bonus-Truhe (50 Punkte) alle 15 Minuten
const POINTS_PER_HOUR = 320;
const WEEKDAY = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

const fmt = (n) => Number(n || 0).toLocaleString('de-DE');
const sum = (a) => a.reduce((x, y) => x + y, 0);
const clampInt = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number(v) || 0)));
// Titel von Twitch tragen oft schon ein Emoji – das Symbol steht daneben
const plain = (text) => String(text ?? '').replace(/^[\p{Extended_Pictographic}️\s]+/u, '');

const P = {
  ctx: null, rows: [], srv: null, srvError: '', sel: null, filter: 'alle', q: '', drafts: {}, menu: false,
  busy: false, timer: 0, wired: false,
};

export function setupPoints(ctx) {
  P.ctx = ctx;
}

// ---------- Daten ----------
async function loadRows() {
  const { state, streamerName } = P.ctx;
  const XA = extrasApi();
  const demo = !!state.api.demo;
  const t = state.twitch ?? {};
  const [extras, rain, cmds, srv] = await Promise.all([
    XA.rewards.list().catch(() => []),
    XA.rainShop?.get().catch(() => null) ?? null,
    XA.chatcontrol?.commands().catch(() => []) ?? [],
    XA.points.state().then((r) => ({ ok: r }), (err) => ({ err })),
  ]);
  if (srv.ok) { P.srv = srv.ok; P.srvError = ''; } else {
    P.srv = { paused: false, paused_until: null, limits: {}, stats: [] };
    P.srvError = /stream_rewards_state|function .* does not exist|schema cache/i.test(srv.err?.message ?? '')
      ? 'Limits, „Alle pausieren“ und die Einlösungen kommen mit der Migration 20270105000000_points_center.sql.'
      : P.ctx.germanError(srv.err);
  }
  const live = demo || !!t.connected;
  const byKey = Object.fromEntries((extras ?? []).map((r) => [r.key, r]));
  const s = state.prank.settings ?? {};
  const who = streamerName();
  const rows = [];

  rows.push({
    key: 'wheel', group: 'games', icon: 'ph-spinner-gap', title: plain(t.reward_title ?? 'Glücksrad'),
    cost: Number(t.reward_cost ?? 10000), cooldown: null,
    on: (demo || !!t.reward_active) && !P.srv.limits.wheel?.off, canToggle: demo || !!t.reward_active,
    text: 'Zuschauer drehen das Glücksrad – das Ergebnis erscheint im Overlay und im Chat.',
    more: 'Varianten & Ergebnisse', open: P.ctx.open.wheel,
    async saveCost(cost) {
      const res = await state.api.setWheelCost(cost);
      state.twitch = { ...state.twitch, reward_cost: res.cost, reward_title: res.title ?? state.twitch.reward_title };
    },
    async setOn(on) { await setLimits('wheel', { off: !on }); },
  });
  if (state.bingo?.on) {
    rows.push({
      key: 'bingo', group: 'games', icon: 'ph-grid-nine', title: 'Bingo-Tipprunde', kind: 'prediction', on: live, canToggle: false,
      text: 'Twitch-Vorhersage: Zuschauer tippen, welche Reihe auf der Bingo-Karte zuerst voll wird.',
      more: 'Bingo öffnen', open: P.ctx.open.bingo,
    });
  }
  if (state.prank.on) {
    const prankOn = s.enabled !== false && live;
    const prank = (kind, extra) => ({
      group: 'prank', cooldown: Number(s.cooldown_seconds ?? 20), maxCooldown: 3600, on: prankOn, canToggle: live,
      shared: 'Abklingzeit und an/aus gelten für Werfen und Sounds zusammen.',
      more: kind === 'throw' ? 'Wurf-Gegenstände' : 'Soundboard', open: P.ctx.open.prank,
      async saveCost(cost, cooldown) {
        const patch = { [kind === 'throw' ? 'throw_cost' : 'sound_cost']: cost };
        if (cooldown !== null) patch.cooldown_seconds = cooldown;
        state.prank.settings = await state.api.updatePrankSettings(patch);
      },
      async setOn(on) { state.prank.settings = await state.api.updatePrankSettings({ enabled: on }); },
      sync: () => (demo ? null : state.api.syncPrankRewards()),
      ...extra,
    });
    rows.push(prank('throw', {
      key: 'throw', icon: 'ph-smiley-angry', title: `Wirf was auf ${who}`, cost: Number(s.throw_cost ?? 500),
      text: 'Zuschauer tippen ein, was fliegen soll – Tomate, Torte, Konfetti. Unbekanntes gibt die Punkte zurück.',
    }));
    rows.push(prank('sound', {
      key: 'sound', icon: 'ph-speaker-high', title: `Sound für ${who}`, cost: Number(s.sound_cost ?? 300),
      text: 'Zuschauer wählen einen Sound, das OBS-Overlay spielt ihn ab. Eigene Sound-Belohnungen zählen hier mit.',
    }));
  }
  const extra = (key, icon, fallback, text, more) => {
    const r = byKey[key];
    if (!r) return;
    rows.push({
      key, group: 'extras', icon, title: plain(r.title ?? fallback), cost: Number(r.cost ?? 500),
      cooldown: Number(r.cooldown ?? 0), maxCooldown: 604800, on: !!r.enabled && (demo || !!r.reward_id), canToggle: live,
      error: r.error || '', text, more, open: () => P.ctx.open.extra(key),
      async saveCost(cost, cooldown) {
        await XA.rewards.set(key, { cost, cooldown: cooldown ?? Number(r.cooldown ?? 0), enabled: !!r.enabled });
      },
      async setOn(on) { await XA.rewards.set(key, { cost: Number(r.cost), cooldown: Number(r.cooldown ?? 0), enabled: on }); },
      sync: () => (demo ? null : XA.rewards.sync(key)),
    });
  };
  extra('tts', 'ph-megaphone', 'Nachricht vorlesen', 'Eine Nachricht wird im Stream vorgelesen – Stimmen wie oma: oder roboter: am Anfang.', 'Stimmen & gesperrte Wörter');
  extra('cards', 'ph-cards', 'Sammelkarten-Pack', 'Zuschauer öffnen ein Pack Stream-Sammelkarten.', 'Karten & Wahrscheinlichkeiten');
  if (rain) {
    rows.push({
      key: 'rain', group: 'extras', icon: 'ph-cloud-rain', title: 'Emote-Regen', cost: Number(rain.points_cost ?? 1000),
      cooldown: Number(rain.points_cooldown ?? 60), maxCooldown: 604800, on: !!rain.points && (demo || !!rain.reward_id),
      canToggle: live, error: rain.error || '',
      text: 'Lässt die Emotes des Kanals im Stream regnen – mit dem Namen des Zuschauers.',
      more: 'Emote-Regen-Einstellungen', open: () => P.ctx.open.extra('emoterain'),
      async saveCost(cost, cooldown) {
        await XA.rainShop.set({ points: !!rain.points, cost, cooldown: cooldown ?? rain.points_cooldown, bits: rain.bits, sku: rain.bits_sku });
      },
      async setOn(on) {
        await XA.rainShop.set({ points: on, cost: rain.points_cost, cooldown: rain.points_cooldown, bits: rain.bits, sku: rain.bits_sku });
      },
      sync: () => (demo ? null : XA.rainShop.sync()),
    });
  }
  for (const c of (cmds ?? []).filter((x) => Number(x.cost) > 0)) {
    const save = (patch) => XA.chatcontrol.save({
      id: c.id, word: c.word, label: c.label, emoji: c.emoji, cooldown: c.cooldown, chat: c.chat, cost: c.cost,
      enabled: c.enabled, game: c.game ?? '', ...patch,
    });
    rows.push({
      key: `cc:${c.id}`, group: 'cmd', icon: 'ph-game-controller', title: c.label, cost: Number(c.cost),
      cooldown: Number(c.cooldown ?? 0), maxCooldown: 3600, on: !!c.enabled && (demo || !!c.reward_id), canToggle: live,
      error: c.reward_error || '', text: `Das Overlay zeigt „${c.label}“ – du führst es selbst aus. Im Chat auch mit !${c.word}${c.chat ? '' : ' (gerade aus)'}.`,
      more: 'Kommando bearbeiten', open: () => P.ctx.open.extra('chatcontrol'),
      async saveCost(cost, cooldown) { await save({ cost, ...(cooldown !== null ? { cooldown } : {}) }); },
      async setOn(on) { await save({ enabled: on }); },
      sync: () => (demo ? null : XA.chatcontrol.sync()),
    });
  }
  // Einlösungen: Index 6 = heute
  const weeks = {};
  for (const st of P.srv.stats ?? []) {
    const i = 6 - Number(st.day);
    if (!st.key || i < 0 || i > 6) continue;
    (weeks[st.key] ??= [0, 0, 0, 0, 0, 0, 0])[i] += Number(st.n) || 0;
  }
  for (const r of rows) r.week = weeks[r.key] ?? [0, 0, 0, 0, 0, 0, 0];
  P.rows = rows;
  if (!rows.some((r) => r.key === P.sel)) P.sel = rows[0]?.key ?? null;
}

const setLimits = async (key, patch) => {
  const cur = P.srv.limits[key] ?? {};
  P.srv = await extrasApi().points.setLimits(key, {
    perStream: patch.perStream ?? cur.max_per_stream ?? 0, perUser: patch.perUser ?? cur.max_per_user ?? 0, off: patch.off ?? null,
  });
};

const limitsOf = (key) => {
  const l = P.srv?.limits?.[key] ?? {};
  return { perStream: Number(l.max_per_stream ?? 0), perUser: Number(l.max_per_user ?? 0) };
};
const draftOf = (r) => ({
  cost: r.cost, cooldown: r.cooldown, ...limitsOf(r.key), ...(P.drafts[r.key] ?? {}),
});
const isDirty = (r) => {
  if (r.kind === 'prediction') return false;
  const d = draftOf(r);
  const base = { cost: r.cost, cooldown: r.cooldown, ...limitsOf(r.key) };
  return ['cost', 'cooldown', 'perStream', 'perUser'].some((k) => d[k] !== base[k]);
};
const locked = () => noAffiliate();
const paused = () => !!P.srv?.paused && !locked();
const canTwitch = () => !!P.ctx.state.api.demo || !!P.ctx.state.twitch?.connected;

function pauseLabel() {
  const until = P.srv?.paused_until ? Date.parse(P.srv.paused_until) : null;
  if (!until) return 'bis du fortsetzt';
  const min = Math.max(1, Math.ceil((until - Date.now()) / 60000));
  if (min >= 60) { const hrs = Math.round(min / 6) / 10; return `noch ${fmt(hrs)} ${hrs === 1 ? 'Stunde' : 'Stunden'}`; }
  return `noch ${min} ${min === 1 ? 'Minute' : 'Minuten'}`;
}

const dayLabels = () => {
  const today = new Date();
  return [...Array(7)].map((_, i) => {
    if (i === 6) return 'Heute';
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    return WEEKDAY[d.getDay()];
  });
};

// ---------- Rendern ----------
export async function renderPoints() {
  const root = document.getElementById('pt');
  if (!root || !P.ctx) return;
  if (!P.wired) wire(root);
  if (!P.rows.length) root.replaceChildren(h('p', { class: 'pt-loading' }, 'Belohnungen werden geladen …'));
  try {
    await loadRows();
  } catch (err) {
    root.replaceChildren(h('p', { class: 'form-msg' }, P.ctx.germanError(err)));
    return;
  }
  paint();
  clearInterval(P.timer);
  // Läuft eine Pause mit Ende, zählt das Banner mit
  if (P.srv?.paused_until) P.timer = setInterval(() => { if (!root.closest('[hidden]')) paintTop(); }, 30000);
}

function paint() {
  const root = document.getElementById('pt');
  root.replaceChildren(
    h('div', { class: 'pt-top', id: 'pt-top' }),
    h('div', { class: 'pt-layout' },
      h('section', { class: 'pt-list', 'aria-label': 'Belohnungen' },
        h('div', { class: 'pt-tools' },
          h('label', { class: 'pt-search' }, h('i', { class: 'ph ph-magnifying-glass', 'aria-hidden': 'true' }),
            h('input', { class: 'input', type: 'search', id: 'pt-q', placeholder: 'Belohnung suchen', 'aria-label': 'Belohnung suchen', value: P.q, maxlength: '40', autocomplete: 'off' })),
          h('div', { class: 'pt-seg', role: 'group', 'aria-label': 'Filter' },
            ...[['alle', 'Alle'], ['aktiv', 'Aktiv'], ['aus', 'Aus']].map(([id, label]) =>
              h('button', { type: 'button', 'data-pt-filter': id, 'aria-pressed': String(P.filter === id) }, label)))),
        h('p', { class: 'pt-summary', id: 'pt-summary' }),
        h('div', { class: 'pt-groups', id: 'pt-groups' })),
      h('section', { class: 'pt-detail', id: 'pt-detail', 'aria-live': 'polite' })),
  );
  paintTop();
  paintList();
  paintDetail();
}

function paintTop() {
  const box = document.getElementById('pt-top');
  if (!box) return;
  const parts = [];
  if (locked()) {
    parts.push(h('section', { class: 'pt-lock' },
      h('span', { class: 'pt-lock-ico', 'aria-hidden': 'true' }, h('i', { class: 'ph ph-lock-simple' })),
      h('div', {},
        h('h2', {}, 'Kanalpunkte gibt es bei Twitch erst ab Affiliate'),
        h('p', {}, 'Sobald dein Kanal Affiliate ist, legt StreamHelp alle Belohnungen von selbst an – der nächste Gesundheitscheck merkt das. Bis dahin laufen Sounds und Chat-Befehle auch ohne Kanalpunkte.'),
        h('div', { class: 'pt-lock-actions' },
          P.ctx.state.prank.on && h('button', { type: 'button', class: 'btn btn--primary btn--sm', 'data-pt-open': 'prank' },
            h('i', { class: 'ph ph-speaker-high', 'aria-hidden': 'true' }), 'Sounds ohne Kanalpunkte einschalten'),
          h('a', { class: 'btn btn--ghost btn--sm', href: 'https://help.twitch.tv/s/article/joining-the-affiliate-program', target: '_blank', rel: 'noopener' },
            'Was ist Twitch-Affiliate?', h('i', { class: 'ph ph-arrow-up-right', 'aria-hidden': 'true' }))))));
  }
  if (paused()) {
    parts.push(h('section', { class: 'pt-paused', role: 'status' },
      h('i', { class: 'ph ph-pause-circle', 'aria-hidden': 'true' }),
      h('p', {}, h('b', {}, 'Alle Belohnungen pausiert'), h('span', {}, ` · ${pauseLabel()}. Zuschauer sehen sie auf Twitch, können aber nichts einlösen.`)),
      h('button', { type: 'button', class: 'btn btn--primary btn--sm', 'data-pt-resume': '' }, h('i', { class: 'ph ph-play', 'aria-hidden': 'true' }), 'Fortsetzen')));
  }
  if (P.srvError) parts.push(h('p', { class: 'pt-note', role: 'note' }, h('i', { class: 'ph ph-info', 'aria-hidden': 'true' }), P.srvError));
  else if (!canTwitch() && !locked()) {
    parts.push(h('p', { class: 'pt-note', role: 'note' }, h('i', { class: 'ph ph-plug', 'aria-hidden': 'true' }),
      'Twitch ist nicht verbunden – Belohnungen gibt es erst, wenn der Streamer Twitch verbindet. ',
      h('button', { type: 'button', class: 'pt-link', 'data-pt-page': 'twitch' }, 'Zur Twitch-Verbindung ›')));
  }
  parts.push(h('div', { class: 'pt-intro' },
    h('p', {}, 'Alle Belohnungen, die StreamHelp auf Twitch anlegt. Änderungen von Streamer und freigegebenen Mods gelten sofort auf Twitch.'),
    h('div', { class: 'pt-pause' },
      h('button', {
        type: 'button', class: 'btn btn--ghost btn--sm', 'data-pt-menu': '', 'aria-haspopup': 'menu', 'aria-expanded': String(P.menu),
        disabled: locked() || !!P.srvError || !canTwitch(),
      }, h('i', { class: 'ph ph-pause', 'aria-hidden': 'true' }), 'Alle pausieren', h('i', { class: 'ph ph-caret-down pt-caret', 'aria-hidden': 'true' })),
      P.menu && h('div', { class: 'pt-menu', role: 'menu' },
        h('p', {}, 'Einlösen pausieren für …'),
        ...PAUSES.map((o, i) => h('button', { type: 'button', role: 'menuitem', 'data-pt-pause': String(i) },
          h('i', { class: `ph ${o.icon}`, 'aria-hidden': 'true' }), o.label))))));
  if (!locked() && !P.srvError) {
    const all = P.rows;
    const today = sum(all.map((r) => r.week[6]));
    const yesterday = sum(all.map((r) => r.week[5]));
    const week = sum(all.map((r) => sum(r.week)));
    const days = [0, 1, 2, 3, 4, 5, 6].filter((i) => all.some((r) => r.week[i] > 0)).length;
    const spent = sum((P.srv.stats ?? []).filter((s) => s.key).map((s) => Number(s.points) || 0));
    parts.push(h('section', { class: 'pt-stats', 'aria-label': 'Einlösungen' },
      stat('Einlösungen heute', fmt(today), today >= yesterday ? `${fmt(today - yesterday)} mehr als gestern` : `${fmt(yesterday - today)} weniger als gestern`),
      stat('Einlösungen, 7 Tage', fmt(week), `an ${days} ${days === 1 ? 'Tag' : 'Tagen'}`),
      stat('Ausgegebene Punkte, 7 Tage', P.srv.demo ? '–' : fmt(spent), P.srv.demo ? 'Demo: Beispielzahlen' : 'ohne Vorhersagen')));
  }
  box.replaceChildren(...parts.filter(Boolean));
}

const stat = (label, value, sub) => h('div', { class: 'pt-stat' }, h('span', {}, label), h('b', {}, value), h('small', {}, sub));

function rowSub(r) {
  const cost = r.kind === 'prediction' ? 'Eigener Einsatz' : `${fmt(draftOf(r).cost)} Punkte`;
  const tail = locked() ? 'gesperrt' : r.error ? 'Fehler' : !r.on ? 'aus' : paused() ? 'pausiert' : `${r.week[6]} heute`;
  return `${cost} · ${tail}`;
}

function sw(on, { small = false, disabled = false, label = 'An oder aus', attrs = {} } = {}) {
  return h('button', {
    type: 'button', role: 'switch', class: `pt-switch${small ? ' pt-switch--sm' : ''}${on ? ' is-on' : ''}`,
    'aria-checked': String(on), 'aria-label': label, disabled, ...attrs,
  }, h('span', { 'aria-hidden': 'true' }));
}

function paintList() {
  const wrap = document.getElementById('pt-groups');
  if (!wrap) return;
  const q = P.q.trim().toLowerCase();
  const visible = P.rows.filter((r) => (P.filter === 'alle' || (P.filter === 'aktiv' ? r.on : !r.on)) && (!q || r.title.toLowerCase().includes(q)));
  const active = P.rows.filter((r) => r.on).length;
  document.getElementById('pt-summary').textContent = locked()
    ? `${P.rows.length} Belohnungen – werden ab Affiliate angelegt`
    : `${active} von ${P.rows.length} aktiv auf Twitch`;
  const groups = GROUPS.map((g) => {
    const items = visible.filter((r) => r.group === g.id);
    if (!items.length) return null;
    return h('div', { class: 'pt-group' },
      h('div', { class: 'pt-group-head' }, h('h3', {}, g.label),
        g.action && h('button', { type: 'button', class: 'pt-link', 'data-pt-open': 'chatcontrol' }, `${g.action} ›`)),
      ...items.map((r) => {
        const live = r.on && !locked();
        return h('div', {
          class: `pt-row${r.key === P.sel ? ' is-sel' : ''}${live ? ' is-live' : ''}`, role: 'button', tabindex: '0',
          'data-pt-sel': r.key, 'aria-pressed': String(r.key === P.sel),
        },
        h('span', { class: 'pt-tile', 'aria-hidden': 'true' }, h('i', { class: `ph ${r.icon}` })),
        h('span', { class: 'pt-row-text' }, h('span', { class: 'pt-row-title' }, r.title), h('span', { class: 'pt-row-sub', 'data-pt-sub': r.key }, rowSub(r))),
        r.canToggle ? sw(r.on && !locked(), { small: true, disabled: locked() || P.busy, label: `${r.title}: an oder aus`, attrs: { 'data-pt-toggle': r.key } })
          : h('span', { class: 'pt-row-fixed' }, r.kind === 'prediction' ? 'Vorhersage' : ''));
      }));
  }).filter(Boolean);
  wrap.replaceChildren(...(groups.length ? groups : [h('p', { class: 'pt-empty' }, 'Keine Belohnung gefunden.')]));
}

function paintDetail() {
  const box = document.getElementById('pt-detail');
  if (!box) return;
  const r = P.rows.find((x) => x.key === P.sel);
  if (!r) { box.replaceChildren(h('p', { class: 'pt-empty' }, 'Noch keine Belohnung.')); return; }
  const d = draftOf(r);
  const live = r.on && !locked();
  const off = locked() || P.busy;
  const tag = locked() ? 'Gesperrt – kein Affiliate' : r.error ? 'Fehler bei Twitch' : !r.on ? 'Aus' : paused() ? 'Pausiert' : 'Aktiv auf Twitch';
  const head = h('div', { class: 'pt-d-head' },
    h('span', { class: `pt-tile pt-tile--lg${live ? ' is-live' : ''}`, 'aria-hidden': 'true' }, h('i', { class: `ph ${r.icon}` })),
    h('div', { class: 'pt-d-title' },
      h('div', {}, h('h2', {}, r.title), h('span', { class: `pt-tag${live && !paused() && !r.error ? ' is-on' : ''}` }, tag)),
      h('p', {}, r.text),
      r.error && h('p', { class: 'pt-error' }, h('i', { class: 'ph ph-warning-circle', 'aria-hidden': 'true' }), r.error)),
    r.canToggle && h('label', { class: 'pt-d-switch' }, 'Auf Twitch aktiv',
      sw(r.on && !locked(), { disabled: off, label: 'Auf Twitch aktiv', attrs: { 'data-pt-toggle': r.key } })));

  const parts = [head];
  if (r.kind === 'prediction') {
    parts.push(h('div', { class: 'pt-info' }, h('i', { class: 'ph ph-info', 'aria-hidden': 'true' }),
      h('p', {}, 'Die Tipprunde läuft als Twitch-Vorhersage: Zuschauer setzen eigene Punkte auf eine Bingo-Reihe, die Gewinner teilen sich die Punkte der anderen. Feste Kosten und Limits gibt es dafür nicht.')));
  } else {
    const cd = r.cooldown !== null && r.cooldown !== undefined;
    const limitsOff = off || !!P.srvError;
    parts.push(h('div', { class: `pt-form${locked() ? ' is-locked' : ''}` },
      h('div', { class: 'pt-block' },
        h('span', { class: 'pt-label' }, 'Kosten pro Einlösung'),
        h('div', { class: 'pt-cost' },
          h('button', { type: 'button', class: 'btn btn--ghost pt-step', 'data-pt-step': '-1', 'aria-label': 'Weniger', disabled: off }, h('i', { class: 'ph ph-minus', 'aria-hidden': 'true' })),
          h('label', { class: 'pt-cost-input' },
            h('input', { class: 'input', type: 'number', inputmode: 'numeric', min: '1', max: '1000000', step: '50', value: String(d.cost), 'data-pt-field': 'cost', 'aria-label': 'Kosten in Kanalpunkten', disabled: off }),
            h('span', { 'aria-hidden': 'true' }, 'Punkte')),
          h('button', { type: 'button', class: 'btn btn--ghost pt-step', 'data-pt-step': '1', 'aria-label': 'Mehr', disabled: off }, h('i', { class: 'ph ph-plus', 'aria-hidden': 'true' })),
          h('div', { class: 'pt-presets', id: 'pt-presets' },
            ...PRESETS.map((v) => h('button', { type: 'button', 'data-pt-preset': String(v), 'aria-pressed': String(d.cost === v), disabled: off }, fmt(v))))),
        h('p', { class: 'pt-hint' }, h('i', { class: 'ph ph-clock', 'aria-hidden': 'true' }), h('span', { id: 'pt-watch' }, watchHint(d.cost)),
          h('span', { class: 'pt-hint-dim' }, ` (ca. ${POINTS_PER_HOUR} Punkte pro Stunde mit Bonus-Truhen)`))),
      h('div', { class: 'pt-block' },
        h('span', { class: 'pt-label' }, 'Abklingzeit & Limits ', h('span', { class: 'pt-hint-dim' }, '· 0 = keine Grenze')),
        h('div', { class: 'pt-limits' },
          cd && limitField('Abklingzeit für alle', 'Min.', 'cooldown', +(d.cooldown / 60).toFixed(2), cooldownHint(d.cooldown, r), off, '0.5'),
          limitField('Max. pro Stream', 'mal', 'perStream', d.perStream, 'Für den ganzen Chat', limitsOff),
          limitField('Max. pro Zuschauer', 'mal', 'perUser', d.perUser, 'Pro Person und Stream', limitsOff)),
        !cd && h('p', { class: 'pt-hint' }, 'Eine Abklingzeit gibt es hier nicht – das Rad dreht ohnehin nacheinander.'))));
  }
  const max = Math.max(1, ...r.week);
  const labels = dayLabels();
  const points = r.kind === 'prediction' ? 'Punkte setzen die Zuschauer' : P.srv.demo ? 'Demo: Beispielzahlen'
    : `${fmt(sum((P.srv.stats ?? []).filter((s) => s.key === r.key).map((s) => Number(s.points) || 0)))} Punkte`;
  parts.push(h('div', { class: 'pt-block' },
    h('div', { class: 'pt-chart-head' }, h('span', { class: 'pt-label' }, 'Einlösungen, letzte 7 Tage'),
      h('span', {}, h('b', {}, fmt(r.week[6])), ' heute · ', h('b', {}, fmt(sum(r.week))), ` gesamt · ${points}`)),
    h('div', { class: 'pt-chart', role: 'img', 'aria-label': `Einlösungen: ${r.week.map((n, i) => `${labels[i]} ${n}`).join(', ')}` },
      ...r.week.map((n, i) => {
        const bar = h('span', { class: `pt-bar${i === 6 ? ' is-today' : ''}${n ? '' : ' is-zero'}` });
        bar.style.height = `${Math.round((n / max) * 100)}%`;
        return h('div', { class: 'pt-col' }, h('span', { class: 'pt-col-n' }, n || '–'), h('span', { class: 'pt-col-track' }, bar), h('span', { class: 'pt-col-l' }, labels[i]));
      }))));

  const dirty = isDirty(r) && !locked();
  parts.push(h('div', { class: 'pt-foot', id: 'pt-foot' },
    h('button', { type: 'button', class: 'btn btn--ghost btn--sm', 'data-pt-more': '' }, h('i', { class: 'ph ph-sliders-horizontal', 'aria-hidden': 'true' }), `${r.more} ›`),
    footState(r, dirty)));
  if (r.shared) parts.splice(2, 0, h('p', { class: 'pt-hint pt-shared' }, h('i', { class: 'ph ph-info', 'aria-hidden': 'true' }), r.shared));
  box.replaceChildren(...parts.filter(Boolean));
}

function footState(r, dirty) {
  if (dirty) {
    return h('div', { class: 'pt-save' },
      h('span', {}, 'Nicht übernommen'),
      h('button', { type: 'button', class: 'btn btn--ghost btn--sm', 'data-pt-discard': '', disabled: P.busy }, 'Verwerfen'),
      h('button', { type: 'button', class: 'btn btn--primary btn--sm', 'data-pt-save': '', disabled: P.busy || !canTwitch() },
        h('i', { class: 'ph ph-twitch-logo', 'aria-hidden': 'true' }), P.busy ? 'Wird übernommen …' : 'Auf Twitch übernehmen'));
  }
  return h('span', { class: 'pt-synced' }, h('i', { class: 'ph ph-check-circle', 'aria-hidden': 'true' }),
    locked() ? 'Wird ab Affiliate auf Twitch angelegt' : !canTwitch() ? 'Twitch nicht verbunden' : r.error ? 'Noch nicht auf Twitch' : 'Stimmt mit Twitch überein');
}

function limitField(label, unit, field, value, hint, disabled, step = '1') {
  return h('label', { class: 'pt-limit' },
    h('span', {}, label),
    h('span', { class: 'pt-limit-in' },
      h('input', { class: 'input', type: 'number', min: '0', step, value: String(value), 'data-pt-field': field, disabled }),
      h('span', { 'aria-hidden': 'true' }, unit)),
    h('small', { 'data-pt-hint': field }, hint));
}

function watchHint(cost) {
  const hours = cost / POINTS_PER_HOUR;
  return hours < 1 ? `Etwa ${Math.max(1, Math.round(hours * 60))} Min. Zuschauen pro Einlösung` : `Etwa ${fmt(Math.round(hours * 10) / 10)} Std. Zuschauen pro Einlösung`;
}
function cooldownHint(sec, r) {
  const max = r.maxCooldown ?? 3600;
  const exact = sec % 60 ? ` · ${fmt(sec)} Sek.` : '';
  return `Pause nach jeder Einlösung${exact}${sec >= max ? ' (höchstens)' : ''}`;
}

// Nach einer Eingabe nur die abhängigen Teile neu zeichnen – das Eingabefeld behält den Fokus
function paintDraft(r) {
  const d = draftOf(r);
  document.querySelectorAll('#pt-presets [data-pt-preset]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.ptPreset) === d.cost)));
  const w = document.getElementById('pt-watch');
  if (w) w.textContent = watchHint(d.cost);
  const ch = document.querySelector('[data-pt-hint="cooldown"]');
  if (ch && d.cooldown !== null) ch.textContent = cooldownHint(d.cooldown, r);
  const sub = document.querySelector(`[data-pt-sub="${CSS.escape(r.key)}"]`);
  if (sub) sub.textContent = rowSub(r);
  const foot = document.getElementById('pt-foot');
  if (foot) foot.lastElementChild.replaceWith(footState(r, isDirty(r) && !locked()));
}

const setDraft = (r, patch) => { P.drafts[r.key] = { ...(P.drafts[r.key] ?? {}), ...patch }; };
const selected = () => P.rows.find((x) => x.key === P.sel);

// ---------- Aktionen ----------
async function toggle(key) {
  const r = P.rows.find((x) => x.key === key);
  if (!r || !r.canToggle || locked() || P.busy) return;
  P.busy = true;
  const on = !r.on;
  try {
    await r.setOn(on);
    await syncTwitch(r, true);
    P.ctx.toast(`${r.title}: auf Twitch ${on ? 'eingeschaltet' : 'ausgeschaltet'}`, 'ok', 2600);
  } catch (err) {
    P.ctx.toast(`${r.title}: ${P.ctx.germanError(err)}`, 'error', 7000);
  } finally {
    P.busy = false;
    await refresh();
  }
}

// Erst die eigene Abgleich-Funktion (Kosten, Abklingzeit, an/aus), dann Limits und Pause (stream-tools points_apply)
async function syncTwitch(r, quiet = false) {
  if (P.ctx.state.api.demo || !P.ctx.state.twitch?.connected) return;
  await r.sync?.();
  if (!P.srvError) {
    const res = await extrasApi().points.apply(r.key);
    if (res?.errors?.length && !quiet) P.ctx.toast(`Twitch: ${res.errors[0]}`, 'error', 7000);
  }
}

async function save() {
  const r = selected();
  if (!r || P.busy || !isDirty(r)) return;
  const d = draftOf(r);
  const base = { cost: r.cost, cooldown: r.cooldown, ...limitsOf(r.key) };
  const cost = clampInt(d.cost, 1, 1000000);
  const cooldown = r.cooldown === null || r.cooldown === undefined ? null : clampInt(d.cooldown, 0, r.maxCooldown ?? 3600);
  P.busy = true;
  paintDraft(r);
  try {
    if (cost !== base.cost || (cooldown !== null && cooldown !== base.cooldown)) {
      await r.saveCost(cost, cooldown !== base.cooldown ? cooldown : null);
    }
    if (!P.srvError && (d.perStream !== base.perStream || d.perUser !== base.perUser)) {
      await setLimits(r.key, { perStream: clampInt(d.perStream, 0, 1000), perUser: clampInt(d.perUser, 0, 1000) });
    }
    delete P.drafts[r.key];
    await syncTwitch(r);
    P.ctx.toast(`${r.title}: ${P.ctx.state.api.demo ? 'gespeichert (Demo)' : 'auf Twitch übernommen'}`, 'ok', 2600);
  } catch (err) {
    P.ctx.toast(`${r.title}: ${P.ctx.germanError(err)}`, 'error', 8000);
  } finally {
    P.busy = false;
    await refresh();
  }
}

async function setPause(minutes) {
  P.menu = false;
  if (P.busy) return;
  P.busy = true;
  try {
    P.srv = minutes === undefined ? await extrasApi().points.resume() : await extrasApi().points.pause(minutes);
    if (!P.ctx.state.api.demo) await extrasApi().points.apply();
    P.ctx.toast(minutes === undefined ? 'Einlösen wieder möglich' : 'Alle Belohnungen auf Twitch pausiert', 'ok', 2600);
  } catch (err) {
    P.ctx.toast(P.ctx.germanError(err), 'error', 7000);
  } finally {
    P.busy = false;
    await refresh();
  }
}

async function refresh() {
  try { await loadRows(); } catch (err) { console.warn('Kanalpunkte:', err); }
  paint();
}

function wire(root) {
  P.wired = true;
  root.addEventListener('click', (e) => {
    const t = e.target;
    const tog = t.closest('[data-pt-toggle]');
    if (tog) { e.stopPropagation(); toggle(tog.dataset.ptToggle); return; }
    const sel = t.closest('[data-pt-sel]');
    if (sel) {
      P.sel = sel.dataset.ptSel; P.menu = false; paintList(); paintDetail();
      // Untereinander (Handy): zu den Einstellungen springen
      if (matchMedia('(max-width: 760px)').matches) document.getElementById('pt-detail')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      return;
    }
    const f = t.closest('[data-pt-filter]');
    if (f) { P.filter = f.dataset.ptFilter; root.querySelectorAll('[data-pt-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b === f))); paintList(); return; }
    if (t.closest('[data-pt-menu]')) { P.menu = !P.menu; paintTop(); return; }
    const pz = t.closest('[data-pt-pause]');
    if (pz) { setPause(PAUSES[Number(pz.dataset.ptPause)].minutes); return; }
    if (t.closest('[data-pt-resume]')) { setPause(undefined); return; }
    const op = t.closest('[data-pt-open]');
    if (op) { const k = op.dataset.ptOpen; if (k === 'prank') P.ctx.open.prank(); else P.ctx.open.extra(k); return; }
    const pg = t.closest('[data-pt-page]');
    if (pg) { P.ctx.setPage(pg.dataset.ptPage); return; }
    const r = selected();
    if (!r) return;
    const pre = t.closest('[data-pt-preset]');
    if (pre) { setDraft(r, { cost: Number(pre.dataset.ptPreset) }); const inp = root.querySelector('[data-pt-field="cost"]'); if (inp) inp.value = pre.dataset.ptPreset; paintDraft(r); return; }
    const st = t.closest('[data-pt-step]');
    if (st) {
      const c = draftOf(r).cost;
      const next = Number(st.dataset.ptStep) > 0 ? Math.min(1000000, c + (c >= 1000 ? 500 : 50)) : Math.max(1, c - (c > 1000 ? 500 : 50));
      setDraft(r, { cost: next });
      const inp = root.querySelector('[data-pt-field="cost"]');
      if (inp) inp.value = String(next);
      paintDraft(r);
      return;
    }
    if (t.closest('[data-pt-discard]')) { delete P.drafts[r.key]; paintList(); paintDetail(); return; }
    if (t.closest('[data-pt-save]')) { save(); return; }
    if (t.closest('[data-pt-more]')) r.open?.();
  });
  root.addEventListener('keydown', (e) => {
    const sel = e.target.closest?.('[data-pt-sel]');
    if (sel && (e.key === 'Enter' || e.key === ' ') && e.target === sel) { e.preventDefault(); sel.click(); }
    if (e.key === 'Escape' && P.menu) { P.menu = false; paintTop(); }
  });
  root.addEventListener('input', (e) => {
    if (e.target.id === 'pt-q') { P.q = e.target.value; paintList(); return; }
    const field = e.target.dataset?.ptField;
    const r = selected();
    if (!field || !r) return;
    const v = Number(e.target.value);
    if (!Number.isFinite(v)) return;
    if (field === 'cost') setDraft(r, { cost: clampInt(v, 1, 1000000) });
    else if (field === 'cooldown') setDraft(r, { cooldown: clampInt(v * 60, 0, r.maxCooldown ?? 3600) });
    else setDraft(r, { [field]: clampInt(v, 0, 1000) });
    paintDraft(r);
  });
  // Klick neben das Pause-Menü schließt es
  document.addEventListener('click', (e) => {
    if (P.menu && !e.target.closest('.pt-pause')) { P.menu = false; paintTop(); }
  });
}
