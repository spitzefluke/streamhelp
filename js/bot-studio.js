// Dashboard → Bot & Chat als Editor (Entwurf „Bot Editor“ aus Claude Design):
//   oben     „Was der Bot gerade tut“: Bot-Konto, Nachrichten der letzten 24 Std, Regeln an, nächste Auto-Nachricht,
//            die letzten Nachrichten aus dem Bot-Protokoll
//   links    die Liste mit Suche und Filter (Alle / An / Aus)
//   Mitte    eine Regel als Ablauf: Wenn (Befehl bzw. Zeitplan) → Und nur wenn (Bedingungen) → Dann (Antwort)
//            Eigene Befehle und Auto-Nachrichten werden hier bearbeitet (Speichern / Verwerfen / Löschen,
//            Rückgängig/Wiederholen); alles andere (Bot-Konto, Protokoll, Begrüßung, Moderation, Songs …) sind die
//            bekannten Karten als Bereiche in der Mitte.
//   rechts   Vorschau (Simulation, „Testen als“), Variablen zum Einfügen und Verlauf (Schritte und Versionen dieser Sitzung)
// Schmal werden Liste, Regel und Vorschau zu Reitern. Die Vorschau ist nur eine Simulation in diesem Browser.
// Eingebunden von js/app.js (renderBotPanel).
import { h } from './extras-core.js';
import { botSettings, timerGapForm } from './bot-plus.js';

let ctx = null;          // { state, api, toast, cmdError, cleanCommand, streamerName }
let cmds = [];
let timers = [];
let loadError = '';
let sel = null;          // { kind: 'cmd' | 'timer' | 'pane', id }
let draft = null;        // was gerade im Editor steht (Befehl oder Auto-Nachricht)
let base = null;         // gespeicherter Stand dazu (für „ungespeichert“ und Verwerfen)
let past = [];           // Rückgängig-Schritte (Entwürfe)
let future = [];
let lastKey = '';        // Tippen im selben Feld fasst Schritte zusammen
let lastAt = 0;
let testLog = [];
let ready = false;
let cmdLimit = null;     // Höchstzahl eigener Befehle (max_limits, …_max_features.sql): null = unbegrenzt
let isMax = false;
let filter = 'all';
let sideTab = 'preview';
let role = 0;            // Testen als: 0 Zuschauer, 1 Abo, 3 Mod
let logData = null;      // Bot-Protokoll (bot_log_list): { items, day: { sent, failed, avg_ms } }
let tick = 0;
let caret = null;        // letzte Schreibmarke in der Antwort (für Variablen)
let condSig = '';        // welche Bedingungen gerade als Zeilen stehen (Tippen baut sie nicht neu)
const versions = new Map(); // „cmd:12“ → [{ at, what, snap }] – nur diese Sitzung

const $ = (s) => document.querySelector(s);
const clamp = (v, min, max, def) => Math.max(min, Math.min(max, Math.round(Number.isFinite(Number(v)) && v !== '' ? Number(v) : def)));
const clone = (x) => JSON.parse(JSON.stringify(x));
const PERMS = { everyone: 'Alle', sub: 'Abonnent', vip: 'VIP', mod: 'Mod', streamer: 'Streamer' };
const RANK = { everyone: 0, sub: 1, vip: 2, mod: 3, streamer: 4 };
const editing = () => sel?.kind === 'cmd' || sel?.kind === 'timer';
const keyOf = (s) => `${s.kind}:${s.id ?? 'neu'}`;
const time = (iso) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

// Bereiche aus den bestehenden Karten (data-pane in index.html)
const PANES = {
  account: { icon: 'ph-plug', name: 'Bot-Konto', sub: () => (ctx.state.twitch?.bot_connected ? `${botName()} · verbunden` : 'nicht verbunden'), on: () => !!ctx.state.twitch?.bot_connected },
  log: { icon: 'ph-list-checks', name: 'Bot-Protokoll', sub: () => (logData?.day ? `${logData.day.sent ?? 0} gesendet · ${logData.day.failed ?? 0} blockiert` : 'Kommen die Nachrichten an?') },
  greet: { icon: 'ph-hand-waving', name: 'Begrüßung & Danke', sub: (s) => ({ off: 'Begrüßung aus', new: 'Nur neue Zuschauer', stream: 'Jeden einmal pro Stream' }[s?.greet_mode] ?? 'Begrüßen und bedanken'), on: (s) => s && (s.greet_mode !== 'off' || s.thank_follow || s.thank_sub || s.thank_bits || s.thank_raid || s.live_on) },
  mod: { icon: 'ph-shield-check', name: 'Moderation', sub: (s) => (s?.mod_on ? [s.mod_links && 'Links', s.mod_caps && 'Caps', s.mod_spam && 'Spam', s.mod_words?.length && 'Wörter'].filter(Boolean).join(' · ') || 'an' : 'aus'), on: (s) => s?.mod_on },
  songs: { icon: 'ph-music-notes', name: 'Song-Requests', sub: () => '!sr mit Player', on: (s) => s?.song_on },
  faq: { icon: 'ph-chat-teardrop-text', name: 'Stichwort-Antworten', sub: () => 'Antwort auf Fragen im Chat', on: (s) => s?.faq_on },
  notices: { icon: 'ph-megaphone', name: 'Ansagen', sub: () => 'Werbung, Hype-Train, Ziele', on: (s) => s && (s.ads_on || s.hype_on || s.goal_on) },
  clips: { icon: 'ph-film-strip', name: 'Clips & Statistik', sub: () => '!clip, !stats, !topchatter', on: (s) => s && (s.clip_on || s.stats_on) },
  info: { icon: 'ph-info', name: 'Stream-Infos', sub: () => '!uptime, !game, !so …', on: (s) => s?.info_on },
  watch: { icon: 'ph-hourglass', name: 'Watchtime', sub: () => '!watchtime und Rangliste' },
  builtin: { icon: 'ph-list-bullets', name: 'Eingebaute Befehle', sub: () => '!befehle, !join, !sr …' },
};
const GROUPS = [
  { id: 'konto', label: 'Konto', panes: ['account', 'log'] },
  { id: 'cmd', label: 'Eigene Befehle', add: 'Neuer Befehl' },
  { id: 'timer', label: 'Auto-Nachrichten', add: 'Neue Auto-Nachricht' },
  { id: 'auto', label: 'Automatik', panes: ['greet', 'mod', 'songs', 'faq', 'notices', 'clips', 'info'] },
  { id: 'more', label: 'Mehr', panes: ['watch', 'builtin'] },
];

// Variablen, die der Bot wirklich ersetzt (…_chat_bot_commands.sql, …_chat_bot_plus.sql, _shared/bot.ts).
// Auto-Nachrichten kennen nur {streamer}.
const VARS = [
  { g: 'Zuschauer', items: [['{user}', 'Wer geschrieben hat', 'zuschauer_42'], ['{touser}', 'Erstes Wort nach dem Befehl', 'mia_plays'], ['{followage}', 'Wie lange schon gefolgt', '1 Jahr, 2 Monate'], ['{watchtime}', 'Zuschauzeit im Kanal', '12 Std 30 Min']] },
  { g: 'Stream', items: [['{uptime}', 'Wie lange schon live', '2 Std 14 Min'], ['{game}', 'Aktuelle Kategorie', 'Fortnite'], ['{title}', 'Stream-Titel', 'Late-Night-Marathon'], ['{streamer}', 'Dein Kanalname', 'dein_kanal']] },
  { g: 'Zähler & Zufall', items: [['{count}', 'Wie oft der Befehl schon lief', '1285'], ['{random}', 'Zufallszahl 1–100', '42'], ['{random:1-6}', 'Zufallszahl im Bereich', '4']] },
];
const CHIPS = { cmd: ['{user}', '{touser}', '{count}', '{random:1-6}', '{game}'], timer: ['{streamer}'] };

// Bedingungen eines Befehls – jede ist ein Feld in bot_commands
const CONDS = {
  role: { icon: 'ph-user-circle', text: 'Rolle mindestens', has: (d) => d.permission !== 'everyone', add: (d) => { d.permission = 'sub'; }, off: (d) => { d.permission = 'everyone'; } },
  ucool: { icon: 'ph-timer', text: 'Pause pro Zuschauer', has: (d) => d.user_cooldown > 0, add: (d) => { d.user_cooldown = 30; }, off: (d) => { d.user_cooldown = 0; } },
  gcool: { icon: 'ph-hourglass', text: 'Pause für alle', has: (d) => d.cooldown_seconds > 0, add: (d) => { d.cooldown_seconds = 30; }, off: (d) => { d.cooldown_seconds = 0; } },
  live: { icon: 'ph-broadcast', text: 'Stream ist live', has: (d) => !!d.live_only, add: (d) => { d.live_only = true; }, off: (d) => { d.live_only = false; } },
};

// ---------- Entwurf ----------
const toDraft = (kind, x) => (kind === 'cmd'
  ? {
    id: x?.id ?? null, command: x?.command ?? '', aliases: (x?.aliases ?? []).join(', '), text: x?.response ?? '',
    enabled: x ? !!x.enabled : true, cooldown_seconds: x ? Number(x.cooldown_seconds ?? 0) : 10, user_cooldown: Number(x?.user_cooldown ?? 0),
    permission: x?.permission ?? (x?.mod_only ? 'mod' : 'everyone'), reply_type: x?.reply_type ?? 'say', live_only: !!x?.live_only, uses: Number(x?.uses ?? 0),
  }
  : {
    id: x?.id ?? null, text: x?.text ?? '', enabled: x ? !!x.enabled : true, interval_min: Number(x?.interval_min ?? 15),
    min_lines: Number(x?.min_lines ?? 5), sent: Number(x?.sent ?? 0), last_at: x?.last_at ?? null,
  });
const row = () => (sel?.kind === 'cmd' ? cmds.find((c) => c.id === sel.id) : sel?.kind === 'timer' ? timers.find((t) => t.id === sel.id) : null) ?? null;
const isDirty = () => editing() && (!draft.id || JSON.stringify(draft) !== JSON.stringify(base));

// Änderung am Entwurf: ein Schritt zum Rückgängigmachen (Tippen im selben Feld zählt als einer)
function change(fn, key = '') {
  const now = Date.now();
  const merge = key && key === lastKey && now - lastAt < 1500;
  lastKey = key;
  lastAt = now;
  if (!merge) { past = [...past.slice(-49), clone(draft)]; future = []; }
  fn(draft);
  refresh();
}
function undo() {
  if (!past.length || !editing()) return;
  future = [clone(draft), ...future];
  draft = past.pop();
  lastKey = '';
  fillForm();
  refresh();
}
function redo() {
  if (!future.length || !editing()) return;
  past = [...past, clone(draft)];
  draft = future.shift();
  lastKey = '';
  fillForm();
  refresh();
}

// ---------- Laden ----------
export async function renderBotStudio(deps) {
  ctx = deps;
  if (!$('#bot-studio')) return;
  if (!ready) setup();
  const [c, t, m, l] = await Promise.allSettled([
    ctx.api.botCommands.list(), ctx.api.botPlus.timers.list(), ctx.api.maxLimits?.() ?? Promise.resolve(null), ctx.api.botLog?.(20) ?? Promise.resolve(null),
  ]);
  cmdLimit = m.status === 'fulfilled' ? m.value?.command_limit ?? null : null;
  isMax = m.status === 'fulfilled' && !!m.value?.max;
  logData = l.status === 'fulfilled' ? l.value : null;
  loadError = c.status === 'rejected' ? ctx.cmdError(c.reason) : '';
  if (c.status === 'fulfilled') cmds = c.value ?? [];
  if (t.status === 'fulfilled') timers = t.value ?? [];
  const gone = (sel?.kind === 'cmd' && sel.id && !cmds.some((x) => x.id === sel.id)) || (sel?.kind === 'timer' && sel.id && !timers.some((x) => x.id === sel.id));
  if (!sel || gone) {
    sel = cmds.length ? { kind: 'cmd', id: cmds[0].id } : { kind: 'pane', id: 'account' };
    startEdit();
  } else if (editing() && !isDirty()) startEdit();
  showSelection();
  paintOverview();
}

// ---------- Übersicht oben ----------
function botName() { return ctx.state.twitch?.bot_name || ctx.state.twitch?.bot_login || 'StreamHelpBot'; }

function nextTimer() {
  const on = timers.filter((t) => t.enabled);
  if (!on.length) return null;
  const due = on.map((t) => ({ t, at: t.last_at ? Date.parse(t.last_at) + t.interval_min * 60000 : 0 })).sort((a, b) => a.at - b.at)[0];
  return due;
}

function paintOverview() {
  if (!$('#bs-overview')) return;
  const tw = ctx.state.twitch ?? {};
  const connected = !!tw.bot_connected;
  $('#bs-ov-bot').textContent = connected ? `@${tw.bot_login || botName()}` : 'Kein Bot verbunden';
  $('#bs-ov-bot-sub').textContent = connected ? 'verbunden – schreibt in deinen Chat' : 'unter „Bot-Konto“ verbinden';
  $('#bs-ov-pulse').classList.toggle('is-on', connected);
  const day = logData?.day;
  $('#bs-ov-sent').textContent = day ? String(day.sent ?? 0) : '–';
  const failed = Number(day?.failed ?? 0);
  $('#bs-ov-failed').textContent = failed ? `${failed} blockiert – ansehen` : 'Protokoll ansehen';
  $('#bs-ov-failed').classList.toggle('is-warn', failed > 0);
  const all = [...cmds, ...timers];
  $('#bs-ov-on').textContent = String(all.filter((x) => x.enabled).length);
  $('#bs-ov-total').textContent = `von ${all.length}`;
  $('#bs-ov-ms').textContent = day?.avg_ms ? `Ø ${day.avg_ms} ms bis Twitch` : 'eigene Befehle und Auto-Nachrichten';
  const feed = (logData?.items ?? []).slice(0, 3);
  const SRC = { chat: 'Antwort', outbox: 'Ansage', test: 'Test', system: 'System', event: 'Automatisch', timer: 'Auto-Nachricht' };
  $('#bs-ov-feed').replaceChildren(...(feed.length ? feed.map((it) => h('button', {
    type: 'button', class: `bs-ov-row${it.status === 'sent' ? '' : ' is-bad'}`, onclick: () => pick({ kind: 'pane', id: 'log' }),
    title: it.status === 'sent' ? '' : `Nicht angekommen: ${it.reason || 'blockiert'}`,
  }, h('span', { class: 'bs-ov-t' }, time(it.created_at)), h('span', { class: 'bs-ov-src' }, SRC[it.source] ?? 'Bot'), h('span', { class: 'bs-ov-text' }, it.text)))
    : [h('p', { class: 'bs-ov-empty' }, 'Noch nichts – der Bot hat heute nichts geschrieben.')]));
  paintCountdown();
}

function paintCountdown() {
  const el = $('#bs-ov-next');
  if (!el) return;
  const due = nextTimer();
  const btn = $('#bs-ov-timer');
  btn.hidden = !due;
  if (!due) { el.textContent = 'keine aktiv'; return; }
  btn.textContent = due.t.text.length > 34 ? `${due.t.text.slice(0, 33)}…` : due.t.text;
  btn.onclick = () => pick({ kind: 'timer', id: due.t.id });
  const left = Math.round((due.at - Date.now()) / 1000);
  el.textContent = left > 0 ? `in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} Min` : 'fällig';
  el.title = left > 0 ? '' : 'Kommt, sobald im Chat genug los ist';
}

// ---------- Liste ----------
function renderList() {
  const q = ($('#bs-q').value ?? '').trim().toLowerCase();
  const hit = (...txt) => !q || txt.join(' ').toLowerCase().includes(q);
  const pass = (on) => filter === 'all' || on === null || on === undefined || (filter === 'on' ? on : !on);
  const s = botSettings();
  const live = (kind, id, x) => (sel?.kind === kind && sel.id === id && editing() ? draft : x);
  const groups = GROUPS.map((g) => {
    let items = [];
    let count = '';
    if (g.id === 'cmd') {
      count = cmdLimit ? `${cmds.length}/${cmdLimit}` : String(cmds.length);
      items = cmds.map((c) => ({ c, d: live('cmd', c.id, null) }))
        .filter(({ c, d }) => hit(c.command, c.response, ...(c.aliases ?? []), d?.text ?? '') && pass(d ? d.enabled : c.enabled))
        .map(({ c, d }) => item({ kind: 'cmd', id: c.id, icon: 'ph-terminal', name: d?.command || c.command, sub: d?.text ?? c.response, on: d ? d.enabled : c.enabled, mono: true }));
      if (sel?.kind === 'cmd' && !sel.id) items.push(item({ kind: 'cmd', id: null, icon: 'ph-terminal', name: draft?.command || 'Neuer Befehl', sub: 'noch nicht gespeichert', on: true, mono: true }));
      if (loadError) items.push(h('p', { class: 'bs-empty' }, loadError));
      else if (!cmds.length && !q && !(sel?.kind === 'cmd' && !sel.id)) items.push(h('p', { class: 'bs-empty' }, 'Noch keine eigenen Befehle – mit ＋ den ersten anlegen.'));
    } else if (g.id === 'timer') {
      count = String(timers.length);
      items = timers.map((t) => ({ t, d: live('timer', t.id, null) }))
        .filter(({ t, d }) => hit(t.text, d?.text ?? '') && pass(d ? d.enabled : t.enabled))
        .map(({ t, d }) => item({ kind: 'timer', id: t.id, icon: 'ph-clock-clockwise', name: (d ?? t).text || 'Auto-Nachricht', sub: `alle ${(d ?? t).interval_min} Min · ${t.sent ?? 0}× gesendet`, on: d ? d.enabled : t.enabled }));
      if (sel?.kind === 'timer' && !sel.id) items.push(item({ kind: 'timer', id: null, icon: 'ph-clock-clockwise', name: draft?.text || 'Neue Auto-Nachricht', sub: 'noch nicht gespeichert', on: true }));
    } else {
      items = g.panes.map((k) => [k, PANES[k]]).filter(([, p]) => hit(p.name, p.sub(s)) && pass(p.on ? !!p.on(s) : null)).map(([k, p]) => item({
        kind: 'pane', id: k, icon: p.icon, name: p.name, sub: p.sub(s), on: p.on ? !!p.on(s) : null,
      }));
    }
    if ((q || filter !== 'all') && !items.length) return null;
    return h('div', { class: 'bs-group' },
      h('div', { class: 'bs-group-head' },
        h('span', {}, g.label, count && h('small', { class: 'bs-limit', title: g.id === 'cmd' && cmdLimit ? (isMax ? 'StreamHelp MAX' : 'Mit StreamHelp MAX bis zu 250') : null }, ` ${count}`)),
        g.add && h('button', { type: 'button', class: 'bs-add', title: g.add, 'aria-label': g.add, onclick: () => pick({ kind: g.id, id: null }) }, h('i', { class: 'ph ph-plus', 'aria-hidden': 'true' }))),
      ...items);
  }).filter(Boolean);
  $('#bs-groups').replaceChildren(...(groups.length ? groups : [h('p', { class: 'bs-empty' }, q ? `Nichts gefunden für „${q}“.` : 'Nichts gefunden.')]));
}

function item({ kind, id, icon, name, sub, on, mono }) {
  const active = sel?.kind === kind && sel.id === id;
  return h('button', {
    type: 'button', class: `bs-item${mono ? ' is-mono' : ''}${on === false ? ' is-off' : ''}`, 'aria-current': active ? 'true' : null,
    onclick: () => pick({ kind, id }),
  },
  h('i', { class: `ph ${icon}`, 'aria-hidden': 'true' }),
  h('span', { class: 'bs-item-text' }, h('b', {}, name), h('small', {}, sub || (kind === 'cmd' ? 'Noch keine Antwort' : ''))),
  h('span', { class: 'bs-item-dots' },
    active && isDirty() && h('span', { class: 'bs-dot bs-dot--dirty', title: 'Ungespeichert' }),
    on !== null && on !== undefined && h('span', { class: `bs-dot${on ? ' is-on' : ''}`, title: on ? 'An' : 'Aus' })));
}

function pick(next) {
  if (sel && sel.kind === next.kind && sel.id === next.id && next.id !== null) { setView('editor'); return; }
  if (isDirty() && !confirm('Ungespeicherte Änderungen verwerfen?')) return;
  sel = next;
  startEdit();
  testLog = [];
  showSelection();
  setView('editor');
}

function startEdit() {
  past = [];
  future = [];
  lastKey = '';
  caret = null;
  if (!editing()) { draft = null; base = null; return; }
  draft = toDraft(sel.kind, row());
  base = clone(draft);
}

// ---------- Editor ----------
function showSelection() {
  const form = $('#bs-form');
  const isEdit = editing();
  form.hidden = !isEdit;
  $('#bs-head').hidden = !isEdit;
  $('#bs-foot').hidden = !isEdit;
  document.querySelectorAll('#bs-panes > [data-pane]').forEach((el) => { el.hidden = el.dataset.pane !== sel.id || isEdit; });
  if (isEdit) fillForm();
  else $('#bs-panes').scrollTop = 0;
  refresh();
}

// Felder aus dem Entwurf füllen (beim Wechseln, Rückgängig, Verwerfen)
function fillForm() {
  const form = $('#bs-form');
  const cmd = sel.kind === 'cmd';
  form.dataset.kind = sel.kind;
  form.querySelectorAll('[data-for-kind]').forEach((el) => { el.hidden = el.dataset.forKind !== sel.kind; });
  $('#bs-ico').className = `ph ${cmd ? 'ph-terminal' : 'ph-clock-clockwise'}`;
  $('#bs-text-label').textContent = cmd ? 'Antwort senden' : 'Nachricht senden';
  $('#bs-text').placeholder = cmd ? 'Was soll der Bot schreiben? z. B. Unser Discord: discord.gg/… – {user}, komm vorbei!' : 'Gefällt dir der Stream? Ein Follow hilft enorm 💜';
  form.text.value = draft.text;
  if (cmd) {
    form.command.value = draft.command;
    form.aliases.value = draft.aliases;
    form.querySelectorAll('[name="reply_type"]').forEach((r) => { r.checked = r.value === draft.reply_type; });
  } else {
    form.interval_min.value = draft.interval_min;
    form.min_lines.value = draft.min_lines;
    const gap = $('#bs-gap');
    if (!gap.firstChild) { const f = timerGapForm(); if (f) gap.append(f); }
  }
  $('#bs-chip-list').replaceChildren(...CHIPS[sel.kind].map((ph) => h('button', { type: 'button', class: 'bs-chip', onclick: () => insertVar(ph) }, ph)));
  $('#bs-cond-presets').hidden = true;
  $('#bs-cond-add').setAttribute('aria-expanded', 'false');
}

// Alles, was vom Entwurf abhängt, neu zeichnen (ohne die Eingabefelder anzufassen)
function refresh() {
  renderList();
  if (editing()) {
    paintHead();
    renderConds();
    paintFoot();
  }
  paintHistory();
  paintVars();
  renderChat();
}

function summary() {
  if (sel.kind === 'timer') {
    return `Alle ${draft.interval_min || 15} Min${draft.min_lines ? `, nach ${draft.min_lines} Chat-Nachrichten` : ''} → Nachricht senden`;
  }
  const cmd = ctx.cleanCommand(draft.command || '') || '!befehl';
  const conds = Object.entries(CONDS).filter(([, c]) => c.has(draft)).map(([k, c]) => condText(k, c));
  return `Wenn jemand ${cmd} schreibt${conds.length ? ` und ${conds.join(', ')}` : ''} → Antwort senden`;
}
function condText(k, c) {
  if (k === 'role') return `${c.text} ${PERMS[draft.permission]}`;
  if (k === 'ucool') return `${c.text} ${draft.user_cooldown} Sek.`;
  if (k === 'gcool') return `${c.text} ${draft.cooldown_seconds} Sek.`;
  return 'Stream ist live';
}

function paintHead() {
  const cmd = sel.kind === 'cmd';
  const title = $('#bs-title');
  title.textContent = cmd ? (draft.command.trim() ? ctx.cleanCommand(draft.command) : 'Neuer Befehl') : (draft.id ? 'Auto-Nachricht' : 'Neue Auto-Nachricht');
  title.classList.toggle('is-mono', cmd);
  $('#bs-sub').textContent = summary();
  $('#bs-uses').textContent = !draft.id ? '' : cmd ? `${draft.uses.toLocaleString('de-DE')}× ausgelöst` : `${draft.sent.toLocaleString('de-DE')}× gesendet`;
  const on = $('#bs-on');
  on.setAttribute('aria-checked', String(!!draft.enabled));
  on.classList.toggle('is-on', !!draft.enabled);
  $('#bs-on-label').textContent = draft.enabled ? 'An' : 'Aus';
  $('#bs-del').hidden = !draft.id;
  $('#bs-count').textContent = `${draft.text.length}/400`;
  $('#bs-trig').textContent = cmd ? 'Jemand schreibt den Befehl (oder einen Alias) in den Chat' : 'Die Zeit ist um – und im Chat ist etwas los';
  for (const id of ['#bs-undo', '#bs-undo2']) $(id).disabled = !past.length;
  for (const id of ['#bs-redo', '#bs-redo2']) $(id).disabled = !future.length;
}

function paintFoot() {
  const dirty = isDirty();
  const isNew = !draft.id;
  const state = $('#bs-state');
  state.classList.remove('is-error');
  state.classList.toggle('is-dirty', dirty);
  state.querySelector('i').className = `ph ${dirty ? 'ph-circle-dashed' : 'ph-check-circle'}`;
  state.querySelector('span').textContent = isNew ? 'Noch nicht gespeichert' : dirty ? 'Ungespeicherte Änderungen' : 'Alles gespeichert';
  $('#bs-save').textContent = isNew ? 'Anlegen' : 'Speichern';
  $('#bs-save').disabled = !dirty;
  $('#bs-discard').disabled = !dirty || isNew;
}

// Bedingungen: beim Befehl die Felder aus bot_commands, bei Auto-Nachrichten fest
function renderConds() {
  const box = $('#bs-conds');
  if (sel.kind === 'timer') {
    condSig = '';
    box.replaceChildren(
      condRow({ icon: 'ph-chats-circle', text: draft.min_lines ? `Im Chat kamen seit dem letzten Mal ${draft.min_lines} neue Nachrichten` : 'Immer, auch wenn im Chat nichts los ist' }),
      condRow({ icon: 'ph-shield-check', text: 'Kein Raid-Schutz aktiv' }));
    return;
  }
  // Dieselben Bedingungen wie eben: nur Werte nachziehen (sonst verlöre das Zahlenfeld beim Tippen den Fokus)
  const sig = `${sel.kind}:${draft.id}:${Object.keys(CONDS).filter((k) => CONDS[k].has(draft)).join(',')}`;
  if (sig === condSig && box.firstChild) {
    box.querySelectorAll('[data-field]').forEach((el) => {
      if (el !== document.activeElement) el.value = String(draft[el.dataset.field]);
    });
    return;
  }
  condSig = sig;
  const rows = Object.entries(CONDS).filter(([, c]) => c.has(draft)).map(([k, c]) => {
    let input = null;
    if (k === 'role') {
      input = h('select', { class: 'bs-cond-in', 'data-field': 'permission', 'aria-label': c.text, onchange: (e) => change((d) => { d.permission = e.target.value; }) },
        ...['sub', 'vip', 'mod', 'streamer'].map((v) => h('option', { value: v, selected: draft.permission === v ? '' : null }, PERMS[v])));
    } else if (k === 'ucool' || k === 'gcool') {
      const field = k === 'ucool' ? 'user_cooldown' : 'cooldown_seconds';
      input = h('span', { class: 'bp-unit bs-cond-unit' },
        h('input', { type: 'number', min: '1', max: '3600', inputmode: 'numeric', class: 'bs-cond-in', 'data-field': field, value: String(draft[field]), 'aria-label': `${c.text} in Sekunden`,
          oninput: (e) => change((d) => { d[field] = clamp(e.target.value, 1, 3600, 1); }, `c-${k}`) }),
        h('em', {}, 'Sek.'));
    }
    return condRow({ icon: c.icon, text: c.text, input, onRemove: () => change((d) => c.off(d)) });
  });
  if (!rows.length) rows.push(h('p', { class: 'bs-none' }, 'Keine Bedingung – der Bot antwortet allen, jedes Mal.'));
  box.replaceChildren(...rows);
  const free = Object.entries(CONDS).filter(([, c]) => !c.has(draft));
  $('#bs-cond-add').hidden = !free.length;
  $('#bs-cond-presets').replaceChildren(...free.map(([, c]) => h('button', {
    type: 'button', class: 'bs-preset', onclick: () => { change((d) => c.add(d)); $('#bs-cond-presets').hidden = true; $('#bs-cond-add').setAttribute('aria-expanded', 'false'); },
  }, h('i', { class: `ph ${c.icon}`, 'aria-hidden': 'true' }), c.text)));
}
function condRow({ icon, text, input = null, onRemove = null }) {
  return h('div', { class: 'bs-cond' },
    h('i', { class: `ph ${icon}`, 'aria-hidden': 'true' }),
    h('span', {}, text),
    input,
    onRemove && h('button', { type: 'button', class: 'bs-icon-btn bs-cond-x', title: 'Entfernen', 'aria-label': `${text} entfernen`, onclick: onRemove }, h('i', { class: 'ph ph-x', 'aria-hidden': 'true' })));
}

function insertVar(ph) {
  if (!editing()) return;
  const ta = $('#bs-text');
  const at = caret ?? ta.value.length;
  const before = ta.value.slice(0, at);
  const add = (before && !/\s$/.test(before) ? ' ' : '') + ph;
  ta.value = before + add + ta.value.slice(at);
  caret = at + add.length;
  change((d) => { d.text = ta.value.slice(0, 400); });
  if (!matchMedia('(max-width: 619px)').matches || $('#bot-studio').dataset.view === 'editor') {
    ta.focus();
    ta.setSelectionRange(caret, caret);
  }
}

function payloadCmd() {
  const orig = row() ?? {};
  const c = {
    id: draft.id ?? undefined,
    command: ctx.cleanCommand(draft.command),
    response: draft.text.trim(),
    enabled: !!draft.enabled,
    mod_only: ['mod', 'streamer'].includes(draft.permission),
    cooldown_seconds: clamp(draft.cooldown_seconds, 0, 3600, 0),
  };
  // Mehr Einstellungen (…_chat_bot_plus.sql): nur mitschicken, wenn gesetzt oder schon vorhanden – so geht Anlegen auch ohne die Migration
  const extra = {
    permission: draft.permission,
    aliases: [...new Set(draft.aliases.split(/[\s,]+/).filter(Boolean).map(ctx.cleanCommand))].slice(0, 5),
    user_cooldown: clamp(draft.user_cooldown, 0, 3600, 0),
    reply_type: draft.reply_type,
    live_only: !!draft.live_only,
  };
  const def = { permission: 'everyone', user_cooldown: 0, reply_type: 'say', live_only: false };
  for (const [k, v] of Object.entries(extra)) {
    const isDefault = k === 'aliases' ? !v.length : v === def[k];
    if (!isDefault || k in orig) c[k] = v;
  }
  return c;
}

function payloadTimer() {
  return {
    id: draft.id ?? undefined,
    text: draft.text.trim(),
    enabled: !!draft.enabled,
    interval_min: clamp(draft.interval_min, 5, 240, 15),
    min_lines: clamp(draft.min_lines, 0, 200, 0),
  };
}

async function save(e) {
  e.preventDefault();
  if (!editing()) return;
  const btn = $('#bs-save');
  const state = $('#bs-state');
  btn.disabled = true;
  const wasNew = !draft.id;
  const before = base ? clone(base) : null;
  try {
    let saved;
    if (sel.kind === 'cmd') {
      const c = payloadCmd();
      if (c.command.length < 3 || !c.response) throw new Error('Bitte Befehl (mit !, mindestens 2 Zeichen) und Antwort eintragen.');
      saved = await ctx.api.botCommands.save(c);
      cmds = (c.id ? cmds.map((x) => (x.id === saved.id ? saved : x)) : [...cmds, saved]).sort((a, b) => a.command.localeCompare(b.command));
      ctx.toast(c.id ? `✓ ${saved.command} gespeichert.` : `✓ ${saved.command} ist angelegt – gleich im Chat ausprobieren.`, 'ok', 3000);
    } else {
      const t = payloadTimer();
      if (!t.text) throw new Error('Bitte einen Text eintragen.');
      saved = await ctx.api.botPlus.timers.save(t);
      timers = t.id ? timers.map((x) => (x.id === saved.id ? saved : x)) : [...timers, saved];
      ctx.toast('✓ Auto-Nachricht gespeichert.', 'ok', 2500);
    }
    sel = { kind: sel.kind, id: saved.id };
    draft = toDraft(sel.kind, saved);
    base = clone(draft);
    // Verlauf dieser Sitzung: der Stand davor lässt sich wiederherstellen
    const k = keyOf(sel);
    const list = versions.get(k) ?? [];
    if (before && !wasNew && !list.length) list.push({ at: null, what: 'Stand beim Öffnen', snap: before });
    list.unshift({ at: new Date().toISOString(), what: wasNew ? 'Angelegt' : 'Gespeichert', snap: clone(draft) });
    versions.set(k, list.slice(0, 10));
    fillForm();
    refresh();
    paintOverview();
  } catch (err) {
    const m = err?.message ?? '';
    state.querySelector('span').textContent = /^Bitte /.test(m) ? m
      : sel.kind === 'timer' && /check constraint|violates/i.test(m) ? 'Text 1–400 Zeichen, alle 5–240 Min, 0–200 Nachrichten.'
        : ctx.cmdError(err);
    state.classList.add('is-error');
    btn.disabled = false;
  }
}

async function remove() {
  if (!draft?.id) return;
  const label = sel.kind === 'cmd' ? ctx.cleanCommand(draft.command) || 'Befehl' : 'Auto-Nachricht';
  if (!confirm(`${label} wirklich löschen?`)) return;
  try {
    if (sel.kind === 'cmd') {
      await ctx.api.botCommands.remove(draft.id);
      cmds = cmds.filter((c) => c.id !== draft.id);
      sel = cmds.length ? { kind: 'cmd', id: cmds[0].id } : { kind: 'pane', id: 'account' };
    } else {
      await ctx.api.botPlus.timers.remove(draft.id);
      timers = timers.filter((t) => t.id !== draft.id);
      sel = timers.length ? { kind: 'timer', id: timers[0].id } : { kind: 'pane', id: 'account' };
    }
    ctx.toast(`${label} gelöscht.`, 'ok', 2500);
    startEdit();
    showSelection();
    paintOverview();
  } catch (err) {
    ctx.toast(ctx.cmdError(err), 'error');
  }
}

// ---------- Rechts: Variablen und Verlauf ----------
function paintVars() {
  const cmd = sel?.kind === 'cmd';
  const can = editing();
  $('#bs-vars-hint').textContent = !can ? 'Wähl einen Befehl oder eine Auto-Nachricht, um Variablen einzufügen.'
    : cmd ? 'Klick fügt die Variable an der Schreibmarke in die Antwort ein. Die Vorschau setzt Beispielwerte ein.'
      : 'Auto-Nachrichten kennen nur {streamer}.';
  $('#bs-vars').replaceChildren(...VARS.map((g) => h('div', { class: 'bs-var-group' },
    h('p', { class: 'bs-step-k' }, g.g),
    ...g.items.map(([name, desc, ex]) => {
      const off = !can || (!cmd && name !== '{streamer}');
      return h('button', { type: 'button', class: 'bs-var', disabled: off ? '' : null, onclick: () => { insertVar(name); ctx.toast(`${name} eingefügt`, 'ok', 1500); } },
        h('code', {}, name), h('span', {}, desc), h('i', { class: 'ph ph-plus', 'aria-hidden': 'true' }), h('span'), h('small', {}, `z. B. ${ex}`));
    }))));
}

function paintHistory() {
  const can = editing();
  $('#bs-hist-steps').textContent = can
    ? `${past.length} Schritt${past.length === 1 ? '' : 'e'} rückgängig machbar · Strg+Z, außerhalb der Textfelder.`
    : 'Wähl einen Befehl oder eine Auto-Nachricht.';
  for (const id of ['#bs-undo2', '#bs-redo2']) $(id).disabled = !can || !(id === '#bs-undo2' ? past.length : future.length);
  $('#bs-hist-name').textContent = can ? `Versionen dieser Sitzung · ${sel.kind === 'cmd' ? (ctx.cleanCommand(draft.command) || 'Neuer Befehl') : 'Auto-Nachricht'}` : 'Versionen';
  const list = can ? versions.get(keyOf(sel)) ?? [] : [];
  const rows = [];
  if (can && isDirty()) rows.push(versionRow({ what: 'Ungespeicherte Änderungen', when: 'Jetzt', current: false }));
  list.forEach((v, i) => rows.push(versionRow({
    what: v.what, when: v.at ? `heute, ${time(v.at)}` : 'vorher', current: i === 0 && !isDirty(),
    onRestore: i === 0 && !isDirty() ? null : () => { change((d) => Object.assign(d, clone(v.snap), { id: d.id, uses: d.uses, sent: d.sent })); fillForm(); ctx.toast('Stand wiederhergestellt – noch nicht gespeichert.', 'ok', 2500); },
  })));
  if (can && !list.length) rows.push(h('li', { class: 'bs-none' }, 'Noch nichts gespeichert in dieser Sitzung. Gespeicherte Stände erscheinen hier und lassen sich wiederherstellen.'));
  $('#bs-versions').replaceChildren(...rows);
}
function versionRow({ what, when, current, onRestore = null }) {
  return h('li', { class: `bs-version${current ? ' is-current' : ''}` },
    h('span', { class: 'bs-version-dot', 'aria-hidden': 'true' }),
    h('div', {}, h('p', {}, what), h('small', {}, when)),
    onRestore && h('button', { type: 'button', class: 'btn btn--ghost btn--sm', onclick: onRestore }, 'Wiederherstellen'));
}

function setSide(tab) {
  sideTab = tab;
  document.querySelectorAll('.bs-side-tabs [data-side]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.side === tab)));
  document.querySelectorAll('.bs-side [data-side-pane]').forEach((p) => { p.hidden = p.dataset.sidePane !== tab; });
}
function setView(view) {
  $('#bot-studio').dataset.view = view;
  document.querySelectorAll('#bs-tabs input').forEach((r) => { r.checked = r.value === view; });
}

// ---------- Chat-Vorschau ----------
const VIEWER = 'zuschauer_42';

function fillText(text, { user = VIEWER, args = [], count = 1 } = {}) {
  const st = ctx.state;
  return String(text ?? '')
    .replaceAll('{user}', user)
    .replaceAll('{touser}', (args[0] ?? '').replace(/^@/, '') || user)
    .replaceAll('{count}', String(count))
    .replaceAll('{watchtime}', '12 Std 30 Min')
    .replaceAll('{followage}', '1 Jahr, 2 Monate')
    .replaceAll('{uptime}', '2 Std 14 Min')
    .replaceAll('{game}', st.games?.data?.live_category || 'Fortnite')
    .replaceAll('{title}', 'Late-Night-Marathon')
    .replaceAll('{streamer}', ctx.streamerName())
    .replace(/\{random(?::(\d+)-(\d+))?\}/g, (_, a, b) => {
      const lo = a ? Number(a) : 1;
      const hi = b ? Number(b) : 100;
      return String(lo + Math.floor(Math.random() * (Math.max(hi, lo) - lo + 1)));
    });
}

// Was gerade im Editor steht, zählt in der Vorschau schon mit (auch ungespeichert)
function liveCmds() {
  const list = cmds.map((c) => ({ ...toDraft('cmd', c), command: c.command }));
  if (sel?.kind !== 'cmd' || !draft) return list;
  const d = { ...draft, command: ctx.cleanCommand(draft.command) };
  return d.id ? list.map((x) => (x.id === d.id ? d : x)) : [...list, d];
}

// Antwort des Bots auf einen Befehl, so wie der echte Chat sie bekäme
function react(c, args = []) {
  const out = [];
  if (!c.enabled) return [{ info: 'Ist aus – der Bot reagiert nicht.' }];
  if (role < RANK[c.permission ?? 'everyone']) return [{ info: `Nicht erfüllt: Rolle mindestens ${PERMS[c.permission]} – der Bot schweigt.` }];
  if (!c.text.trim()) return [{ info: 'Noch keine Antwort eingetragen.' }];
  const text = fillText(c.text, { args, count: Number(c.uses ?? 0) + 1 });
  out.push({ bot: true, text: c.reply_type === 'mention' ? `@${VIEWER} ${text}` : text, replyTo: c.reply_type === 'reply' ? VIEWER : '' });
  const notes = [c.live_only && 'nur während des Streams', c.cooldown_seconds > 0 && `dann ${c.cooldown_seconds} Sek. Pause für alle`, c.user_cooldown > 0 && `${c.user_cooldown} Sek. Pause je Zuschauer`].filter(Boolean);
  if (notes.length) out.push({ info: `Im echten Chat: ${notes.join(' · ')}.` });
  return out;
}

function renderChat() {
  const lines = [{ who: 'mia_plays', text: 'gg das war knapp 😂', cls: 'u2' }];
  if (sel?.kind === 'cmd' && draft) {
    const name = ctx.cleanCommand(draft.command || '') || '!befehl';
    const to = /\{touser\}/.test(draft.text);
    lines.push({ who: VIEWER, text: name + (to ? ' @mia_plays' : ''), cls: 'u1' });
    lines.push(...react({ ...draft, command: name }, to ? ['@mia_plays'] : []));
  } else if (sel?.kind === 'timer' && draft) {
    if (!draft.enabled) lines.push({ info: 'Ist aus – der Bot schreibt sie nicht.' });
    else {
      lines.push({ info: `Frühestens alle ${clamp(draft.interval_min, 5, 240, 15)} Min${draft.min_lines ? ` und erst nach ${clamp(draft.min_lines, 0, 200, 0)} neuen Nachrichten` : ''}:` });
      if (draft.text.trim()) lines.push({ bot: true, text: fillText(draft.text) });
    }
  } else {
    lines.push({ info: 'Schreib unten wie ein Zuschauer – zum Beispiel einen deiner Befehle.' });
  }
  $('#bs-log').replaceChildren(...[...lines, ...testLog].map(line));
  $('#bs-log').scrollTop = $('#bs-log').scrollHeight;
}

function line(l) {
  if (l.info) return h('li', { class: 'bs-msg bs-msg--info' }, h('i', { class: 'ph ph-info', 'aria-hidden': 'true' }), l.info);
  if (l.bot) {
    return h('li', { class: 'bs-msg bs-msg--bot' },
      l.replyTo && h('small', { class: 'bs-reply-to' }, h('i', { class: 'ph ph-arrow-bend-up-left', 'aria-hidden': 'true' }), ` Antwort an @${l.replyTo}`),
      h('b', {}, h('i', { class: 'ph ph-robot', 'aria-hidden': 'true' }), ` ${botName()}: `), l.text);
  }
  return h('li', { class: `bs-msg bs-msg--${l.cls ?? 'u1'}` }, h('b', {}, `${l.who}: `), l.text);
}

function test(e) {
  e.preventDefault();
  const input = e.currentTarget.msg;
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  testLog.push({ who: VIEWER, text, cls: 'u1' });
  const [word, ...args] = text.split(/\s+/);
  const w = word.toLowerCase();
  if (w.startsWith('!')) {
    const list = liveCmds().filter((c) => c.enabled && c.command);
    const hit = liveCmds().find((c) => c.command === w || c.aliases.split(/[\s,]+/).filter(Boolean).map(ctx.cleanCommand).includes(w));
    if (w === '!befehle' || w === '!commands') {
      testLog.push({ bot: true, text: `Befehle: ${list.map((c) => c.command).join(' ') || '–'}` });
    } else if (hit) {
      testLog.push(...react(hit, args));
    } else {
      testLog.push({ info: 'Kein eigener Befehl. Eingebaute wie !watchtime oder !sr antworten nur im echten Chat.' });
    }
  }
  testLog = testLog.slice(-30);
  renderChat();
}

// ---------- Einmal verdrahten ----------
function setup() {
  ready = true;
  const form = $('#bs-form');
  $('#bs-q').addEventListener('input', renderList);
  $('#bs-filter').addEventListener('change', (e) => { filter = e.target.value; renderList(); });
  form.addEventListener('submit', save);
  // Eingaben → Entwurf (ein Rückgängig-Schritt je Feld und Tipp-Pause)
  form.addEventListener('input', (e) => {
    const t = e.target;
    if (!editing() || !t.name) return;
    const v = t.value;
    if (t.name === 'text') caret = t.selectionStart;
    change((d) => {
      if (t.name === 'command') d.command = v;
      else if (t.name === 'aliases') d.aliases = v;
      else if (t.name === 'text') d.text = v;
      else if (t.name === 'interval_min') d.interval_min = v === '' ? '' : clamp(v, 0, 240, 15);
      else if (t.name === 'min_lines') d.min_lines = v === '' ? '' : clamp(v, 0, 200, 0);
      else if (t.name === 'reply_type') d.reply_type = v;
    }, t.name === 'reply_type' ? '' : `f-${t.name}`);
  });
  const text = $('#bs-text');
  for (const ev of ['click', 'keyup', 'select']) text.addEventListener(ev, () => { caret = text.selectionStart; });
  $('#bs-on').addEventListener('click', () => { if (editing()) change((d) => { d.enabled = !d.enabled; }); });
  $('#bs-cond-add').addEventListener('click', (e) => {
    const box = $('#bs-cond-presets');
    box.hidden = !box.hidden;
    e.currentTarget.setAttribute('aria-expanded', String(!box.hidden));
  });
  $('#bs-all-vars').addEventListener('click', () => { setSide('vars'); setView('side'); });
  $('#bs-discard').addEventListener('click', () => { if (!editing() || !base) return; change((d) => Object.assign(d, clone(base))); fillForm(); refresh(); });
  $('#bs-del').addEventListener('click', remove);
  for (const id of ['#bs-undo', '#bs-undo2']) $(id).addEventListener('click', undo);
  for (const id of ['#bs-redo', '#bs-redo2']) $(id).addEventListener('click', redo);
  $('#bs-test').addEventListener('submit', test);
  $('#bs-clear').addEventListener('click', () => { testLog = []; renderChat(); });
  $('#bs-role').addEventListener('change', (e) => { role = Number(e.target.value) || 0; renderChat(); });
  document.querySelector('.bs-side-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-side]'); if (b) setSide(b.dataset.side); });
  $('#bs-tabs').addEventListener('change', (e) => setView(e.target.value));
  $('#bs-ov-failed').addEventListener('click', () => pick({ kind: 'pane', id: 'log' }));
  // Strg+Z / Strg+Umschalt+Z außerhalb der Textfelder (dort gilt das Rückgängig des Browsers)
  addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z' || !editing()) return;
    if ($('#bot-studio').closest('[hidden]') || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName ?? '')) return;
    e.preventDefault();
    if (e.shiftKey) redo(); else undo();
  });
  // Countdown der nächsten Auto-Nachricht (nur, solange die Seite sichtbar ist)
  clearInterval(tick);
  tick = setInterval(() => { if (!document.hidden && !$('#bot-studio').closest('[hidden]')) paintCountdown(); }, 1000);
  addEventListener('beforeunload', (e) => { if (isDirty()) e.preventDefault(); });
  setSide(sideTab);
}
