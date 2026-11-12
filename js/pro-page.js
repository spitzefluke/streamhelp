// Vergleichsseite Free und Pro (pro.html). Was Pro ist und kostet, steht in js/pro.js; die kostenlosen
// Content-Ideen kommen aus js/defaults.js – neue Ideen erscheinen hier also von selbst.
// Ab dem Start (js/launch.js: pro) bucht der Inhaber eines Kanals hier: Häkchen „sofort starten“ → „zahlungspflichtig
// bestellen“ → Edge Function billing → Bezahlseite von Stripe → zurück mit ?bestellt=1 bzw. ?abgebrochen=1.
import { DEFAULT_TILES } from './defaults.js';
import { setupConsent } from './consent.js';
import { h } from './extras-core.js';
import { PRO_BOOKABLE, PRO_KINDS, PRO_PRICE, PRO_SOON, isProKind } from './pro.js';

setupConsent(); // Cookie-Fenster (js/consent.js)

const $ = (sel) => document.querySelector(sel);
const icon = (cls) => h('i', { class: `ph ${cls}`, 'aria-hidden': 'true' });
const yes = () => h('span', { class: 'pr-yes', title: 'Enthalten' }, icon('ph-check'), h('span', { class: 'pr-sr' }, 'enthalten'));
const no = () => h('span', { class: 'pr-no', title: 'Nicht enthalten' }, '–', h('span', { class: 'pr-sr' }, 'nicht enthalten'));
// Ideen ohne Spiel im Namen („Fortnite-Bingo“ → „Bingo“)
const ideaName = (t) => t.title.replace(/^Fortnite-/, '');

// Alles außer den Content-Ideen ist in Free und Pro gleich
const BASICS = [
  'Chat-Bot mit eigenen Befehlen, Auto-Nachrichten und Moderation',
  'Alerts mit Alert-Designer und Probe-Alerts',
  'OBS-Overlay mit allen Ebenen, Szenen und Laufband',
  'Design-Bibliothek mit Looks, Look-Baukasten und Artist-Designs',
  'Kanalpunkte, Raid-Schutz und Mods',
  'Statistik, Profil & Zeitplan',
  'Raid-Netzwerk, Discord und Freunde werben',
  'Twitch-Erweiterung (Panel, Komponente, Overlay)',
];

const free = DEFAULT_TILES.filter((t) => !isProKind(t.kind));
const pro = Object.entries(PRO_KINDS);

const soon = $('#pr-soon');
if (soon) soon.textContent = PRO_SOON;
$('#pr-price').textContent = PRO_PRICE.month;
$('#pr-price-lead').textContent = PRO_PRICE.label;
$('#pr-order-price').textContent = PRO_PRICE.month;
$('#pr-free-list').replaceChildren(
  ...BASICS.slice(0, 4).map((t) => h('li', {}, icon('ph-check'), t)),
  h('li', {}, icon('ph-check'), `${free.length} Content-Ideen, z. B. ${free.slice(0, 4).map(ideaName).join(', ')}`));
$('#pr-pro-list').replaceChildren(
  ...pro.map(([, p]) => h('li', {}, icon('ph-star'), h('span', {}, h('b', {}, p.name), ' – ', p.desc))),
  h('li', {}, icon('ph-star'), h('span', {}, h('b', {}, 'Pro-Abzeichen'), ' im Dashboard')));

const group = (title) => h('tr', { class: 'pr-group' }, h('th', { scope: 'colgroup', colspan: 3 }, title));
const row = (name, inFree, extra) => h('tr', {}, h('th', { scope: 'row' }, name, extra ?? null), h('td', {}, inFree ? yes() : no()), h('td', {}, yes()));
$('#pr-table').append(h('tbody', {},
  group('Grundlagen'),
  ...BASICS.map((b) => row(b, true)),
  group('Content-Ideen'),
  ...free.map((t) => row(ideaName(t), true)),
  group('Nur mit Pro'),
  ...pro.map(([, p]) => row(p.name, false, h('small', {}, p.desc)))));

// ---------- Buchen (erst ab dem Start) ----------
document.querySelectorAll('[data-vor-start]').forEach((el) => { el.hidden = PRO_BOOKABLE; });
document.querySelectorAll('[data-ab-start]').forEach((el) => { el.hidden = !PRO_BOOKABLE; });

const back = new URLSearchParams(location.search);
if (back.has('bestellt') || back.has('abgebrochen')) {
  const msg = $('#pr-order-back');
  msg.hidden = false;
  msg.textContent = back.has('bestellt')
    ? '🎉 Danke für deine Bestellung! Pro wird in wenigen Sekunden für deinen Kanal freigeschaltet. Die Bestätigung mit AGB und Widerrufsbelehrung kommt per E-Mail.'
    : 'Die Bezahlung wurde abgebrochen – es ist kein Vertrag zustande gekommen und es wurde nichts berechnet.';
  history.replaceState(null, '', location.pathname + '#pr-order');
  $('#pr-order').scrollIntoView({ block: 'start' });
}

if (PRO_BOOKABLE) setupBooking();

async function setupBooking() {
  const consent = $('#pr-consent');
  const btn = $('#pr-order-btn');
  const note = $('#pr-order-note');
  const cta = $('#pr-plan-cta');
  cta.disabled = false;
  cta.textContent = 'Pro buchen';
  cta.addEventListener('click', () => $('#pr-order').scrollIntoView({ behavior: 'smooth', block: 'start' }));
  note.textContent = 'Nach dem Klick geht es weiter zu Stripe; dort gibst du die Zahlung frei.';

  const { createApi } = await import('./api.js');
  const api = await createApi();
  const say = (text, link) => note.replaceChildren(text, ...(link ? [' ', h('a', { href: link[0] }, link[1])] : []));
  if (api.demo) { say('Im Demo-Modus kann nichts gebucht werden.'); return; }
  const { data } = await api.raw.sb.auth.getSession();
  if (!data?.session) { say('Bitte melde dich zuerst an – Pro bucht der Inhaber des Kanals.', ['./#login', 'Zur Anmeldung']); return; }
  const mine = await api.channelMine().catch(() => null);
  if (!mine?.id) { say('Mit diesem Konto ist kein eigener Kanal angemeldet. Pro bucht der Inhaber des Kanals.', ['./', 'Kanal anmelden']); return; }
  $('#pr-order-channel').textContent = `den Kanal ${mine.display_name || mine.login}`;
  if (mine.status !== 'active') { say('Dein Kanal wird noch freigeschaltet – danach kannst du Pro buchen.'); return; }

  consent.disabled = false;
  const sync = () => { btn.disabled = !consent.checked; };
  consent.addEventListener('change', sync);
  sync();
  btn.addEventListener('click', async () => {
    if (!consent.checked) return;
    btn.disabled = true;
    say('Einen Moment – die Bezahlseite von Stripe wird geöffnet …');
    try {
      const res = await api.raw.invoke('billing', { action: 'checkout', consent: true });
      if (!res?.url) throw new Error('Keine Bezahlseite erhalten.');
      location.assign(res.url);
    } catch (err) {
      const { germanError } = await import('./api.js');
      say(germanError(err));
      sync();
    }
  });
}
