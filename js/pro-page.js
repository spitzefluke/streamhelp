// Vergleichsseite Free und Pro (pro.html). Was Pro ist und kostet, steht in js/pro.js; die kostenlosen
// Content-Ideen kommen aus js/defaults.js – neue Ideen erscheinen hier also von selbst.
// Ab dem Start (js/launch.js: pro) bucht der Inhaber eines Kanals hier: Häkchen „sofort starten“ → „zahlungspflichtig
// bestellen“ → Edge Function billing → Bezahlseite von Stripe → zurück mit ?bestellt=1 bzw. ?abgebrochen=1.
import { DEFAULT_TILES } from './defaults.js';
import { setupConsent } from './consent.js';
import { h } from './extras-core.js';
import { MAX_BOOKABLE, MAX_FEATURES, MAX_PRICE, PRO_BOOKABLE, PRO_KINDS, PRO_PRICE, PRO_SOON, isProKind } from './pro.js';

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
$('#pr-max-price').textContent = MAX_PRICE.month;
$('#pr-max-list').replaceChildren(
  ...MAX_FEATURES.map((f) => h('li', {}, icon('ph-lightning'), h('span', {}, f.href ? h('a', { href: f.href }, h('b', {}, f.name)) : h('b', {}, f.name), ' – ', f.desc))));
$('#pr-free-list').replaceChildren(
  ...BASICS.slice(0, 4).map((t) => h('li', {}, icon('ph-check'), t)),
  h('li', {}, icon('ph-check'), `${free.length} Content-Ideen, z. B. ${free.slice(0, 4).map(ideaName).join(', ')}`));
$('#pr-pro-list').replaceChildren(
  ...pro.map(([, p]) => h('li', {}, icon('ph-star'), h('span', {}, h('b', {}, p.name), ' – ', p.desc))),
  h('li', {}, icon('ph-star'), h('span', {}, h('b', {}, 'Pro-Abzeichen'), ' im Dashboard')));

const group = (title) => h('tr', { class: 'pr-group' }, h('th', { scope: 'colgroup', colspan: 4 }, title));
const row = (name, inFree, extra, inPro = true) =>
  h('tr', {}, h('th', { scope: 'row' }, name, extra ?? null), h('td', {}, inFree ? yes() : no()), h('td', {}, inPro ? yes() : no()), h('td', {}, yes()));
$('#pr-table').append(h('tbody', {},
  group('Grundlagen'),
  ...BASICS.map((b) => row(b, true)),
  group('Content-Ideen'),
  ...free.map((t) => row(ideaName(t), true)),
  group('Nur mit Pro'),
  ...pro.map(([, p]) => row(p.name, false, h('small', {}, p.desc))),
  group('Nur mit MAX'),
  ...MAX_FEATURES.map((f) => row(f.name, false, h('small', {}, f.desc), false))));

// ---------- Tarif wählen (Pro oder MAX) ----------
const PLAN_INFO = { pro: { name: 'StreamHelp Pro', short: 'Pro', price: PRO_PRICE.month }, max: { name: 'StreamHelp MAX', short: 'MAX', price: MAX_PRICE.month } };
const planInputs = [...document.querySelectorAll('#pr-pick input[name="plan"]')];
const chosenPlan = () => (planInputs.find((i) => i.checked)?.value === 'max' ? 'max' : 'pro');
function showPlan() {
  const p = PLAN_INFO[chosenPlan()];
  $('#pr-order-product').textContent = p.name;
  $('#pr-order-price').textContent = p.price;
  $('#pr-consent-plan').textContent = p.short;
  $('#pr-order-upgrade').hidden = chosenPlan() !== 'max';
  // Die Zustimmung gilt für einen Tarif – nach einem Wechsel noch einmal bestätigen
  const consent = $('#pr-consent');
  consent.checked = false;
  consent.dispatchEvent(new Event('change'));
}
const maxInput = planInputs.find((i) => i.value === 'max');
if (MAX_BOOKABLE) $('#pr-pick-max-soon').remove();
planInputs.forEach((i) => i.addEventListener('change', showPlan));

// ---------- Buchen (erst ab dem Start) ----------
document.querySelectorAll('[data-vor-start]').forEach((el) => { el.hidden = PRO_BOOKABLE; });
document.querySelectorAll('[data-ab-start]').forEach((el) => { el.hidden = !PRO_BOOKABLE; });

const back = new URLSearchParams(location.search);
if (back.has('bestellt') || back.has('abgebrochen')) {
  const msg = $('#pr-order-back');
  msg.hidden = false;
  msg.textContent = back.has('bestellt')
    ? '🎉 Danke für deine Bestellung! Dein Abo wird in wenigen Sekunden für deinen Kanal freigeschaltet. Die Bestätigung mit AGB und Widerrufsbelehrung kommt per E-Mail.'
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
  const pick = (plan) => {
    const input = planInputs.find((i) => i.value === plan);
    if (input && !input.checked) { input.checked = true; showPlan(); }
    $('#pr-order').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  cta.addEventListener('click', () => pick('pro'));
  if (MAX_BOOKABLE) {
    const maxCta = $('#pr-max-cta');
    maxCta.disabled = false;
    maxCta.textContent = 'MAX buchen';
    maxCta.addEventListener('click', () => pick('max'));
  }
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
  if (MAX_BOOKABLE) maxInput.disabled = false;
  if (new URLSearchParams(location.search).get('tarif') === 'max' && MAX_BOOKABLE) { maxInput.checked = true; showPlan(); }
  const sync = () => { btn.disabled = !consent.checked; };
  consent.addEventListener('change', sync);
  sync();
  btn.addEventListener('click', async () => {
    if (!consent.checked) return;
    btn.disabled = true;
    say('Einen Moment – die Bezahlseite von Stripe wird geöffnet …');
    try {
      const plan = chosenPlan();
      const res = await api.raw.invoke('billing', { action: 'checkout', consent: true, plan });
      if (res?.upgraded) {
        say('🎉 Erledigt – dein Abo ist jetzt MAX. Die Bestätigung kommt per E-Mail; den Unterschied für diesen Monat rechnet Stripe anteilig ab.');
        return;
      }
      if (!res?.url) throw new Error('Keine Bezahlseite erhalten.');
      location.assign(res.url);
    } catch (err) {
      const { germanError } = await import('./api.js');
      say(germanError(err));
      sync();
    }
  });
}
