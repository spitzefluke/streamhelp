// Streamy als Begleiter (js/streamy.js), unten rechts über dem Bedienungshilfen-Knopf:
//   mountLandingGuide(root) – Startseite: erscheint nach dem ersten Bildschirm, sagt zu jedem Abschnitt etwas
//     (einmal je Abschnitt) und reagiert; Antippen springt zur KI-Hilfe. Weg, solange die KI-Hilfe zu sehen ist
//     (dort sitzt Streamy schon).
//   mountDashboardGuide(app, opts) – Dashboard: begrüßt einmal je Sitzung, Antippen öffnet ein kleines Menü
//     (Einführung, Tipp, Ausblenden). Ausgeblendet bleibt er, bis die Einführung wieder geöffnet wird.
import { h } from './extras-core.js';
import { t } from './i18n.js';
import { mountStreamy } from './streamy.js';

const OFF_KEY = 'sh_streamy_off';
const SEEN_KEY = 'sh_streamy_hi';
const store = {
  get: (k, s = localStorage) => { try { return s.getItem(k); } catch { return null; } },
  set: (k, v, s = localStorage) => { try { if (v === null) s.removeItem(k); else s.setItem(k, v); } catch { /* privater Modus */ } },
};

function buildGuide(parent, { cls, label, onTap, onClose }) {
  const bubble = h('p', { class: 'sg-bubble', role: 'status', 'aria-live': 'polite', hidden: true });
  const stage = h('div', { class: 'sg-streamy' });
  const close = h('button', { class: 'sg-close', type: 'button', 'aria-label': t('Streamy ausblenden'), title: t('Ausblenden'), onclick: onClose }, '×');
  const el = h('div', { class: `sg ${cls}`, hidden: true }, bubble, h('div', { class: 'sg-body' }, stage, close));
  parent.append(el);
  let streamy = null;
  let sayTimer = 0;
  const api = {
    el,
    bubble,
    get streamy() { return streamy; },
    show(on) {
      if (on === !el.hidden) return;
      el.hidden = !on;
      if (on && !streamy) streamy = mountStreamy(stage, { label, onTap });
      if (!on) { bubble.hidden = true; clearTimeout(sayTimer); }
    },
    say(text, ms = 5200, react = null) {
      if (el.hidden) return;
      bubble.replaceChildren(...(Array.isArray(text) ? text : [text]));
      bubble.hidden = false;
      clearTimeout(sayTimer);
      if (ms) sayTimer = setTimeout(() => { bubble.hidden = true; }, ms);
      if (react) streamy?.react(react);
    },
    quiet() { bubble.hidden = true; clearTimeout(sayTimer); },
  };
  return api;
}

// ---------- Startseite ----------
const SECTIONS = [
  ['#funktionen', 'Alles in einer Browserquelle – schau dir an, was ich kann! ✨', 'wiggle'],
  ['#start', 'So startest du: in ein paar Minuten bist du mit StreamHelp live.', 'nod'],
  ['#quelle', 'Eine OBS-Quelle statt fünf Tools – praktisch, oder? 😎', 'hop'],
  ['#zahlen', 'So viel steckt schon drin – und es wird jede Woche mehr.', 'nod'],
  ['#showcase', 'Diese Streamer sind schon dabei – sag hallo! 👋', 'hop'],
  ['#preise', 'Psst: Gerade ist alles kostenlos! 💚', 'spin'],
  ['#sicherheit', 'Jeder Kanal wird von Hand geprüft. Sicher ist sicher. 🛡️', 'nod'],
  ['#faq', 'Noch Fragen? Tipp mich an, dann helfe ich dir!', 'wiggle'],
];

let landingGuide = null;
export function mountLandingGuide(root) {
  if (landingGuide || !root) return landingGuide;
  let off = store.get(OFF_KEY, sessionStorage) === '1';
  let helpSeen = false;
  const goHelp = () => {
    const card = root.querySelector('.nc-help');
    if (!card) return;
    card.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    setTimeout(() => root.querySelector('#help-form input')?.focus({ preventScroll: true }), 600);
  };
  const g = buildGuide(root, {
    cls: 'sg--landing',
    label: t('Streamy, das Maskottchen – antippen für die KI-Hilfe'),
    onTap: goHelp,
    onClose: () => { off = true; store.set(OFF_KEY, '1', sessionStorage); g.show(false); },
  });
  landingGuide = g;

  const update = () => {
    const past = scrollY > innerHeight * 0.65;
    g.show(!root.hidden && past && !helpSeen && !off);
  };
  let pending = 0;
  addEventListener('scroll', () => { if (!pending) pending = requestAnimationFrame(() => { pending = 0; update(); }); }, { passive: true });
  addEventListener('resize', update);

  // KI-Hilfe sichtbar: dort ist Streamy schon – der Begleiter macht Platz
  const help = root.querySelector('.nc-help');
  if (help) new IntersectionObserver(([e]) => { helpSeen = e.isIntersecting; update(); }, { threshold: 0.25 }).observe(help);

  // Zu jedem Abschnitt einmal etwas sagen (die React-Abschnitte erscheinen etwas später – darum nachsehen)
  const said = new Set();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting || said.has(e.target)) continue;
      const s = SECTIONS.find(([sel]) => e.target.matches(sel));
      if (!s || g.el.hidden) continue;
      said.add(e.target);
      g.say(t(s[1]), 5200, s[2]);
    }
  }, { threshold: 0.35 });
  const watch = () => SECTIONS.forEach(([sel]) => { const el = root.querySelector(sel); if (el && !el.dataset.sgWatch) { el.dataset.sgWatch = '1'; io.observe(el); } });
  watch();
  setTimeout(watch, 1500);
  setTimeout(watch, 5000);
  update();
  return g;
}

// ---------- Dashboard ----------
const TIPS = [
  'Ein Klick auf „OBS-Overlay“ oben zeigt dir, wie das Overlay in OBS kommt.',
  'Mit dem Raid-Schutz pausierst du bei einem Hate-Raid alle Zuschauer-Aktionen auf einmal.',
  'Unter „Bot“ legst du eigene Chat-Befehle an – auch mit Kanalpunkten.',
  'Content-Ideen mit ⭐ landen oben in deiner Liste.',
  'Mods kannst du Bereiche freigeben – sie steuern dann den Stream mit.',
  'Unter „Statistik“ siehst du, was in deinem Stream am besten ankommt.',
  'Teste Alerts jederzeit mit „Test-Alert“, bevor du live gehst.',
  'Die Einführung findest du jederzeit links – oder du tippst mich an.',
];

let dashGuide = null;
export function mountDashboardGuide(app, { userName = () => '' } = {}) {
  if (dashGuide || !app) return dashGuide;
  let tip = Math.floor(Math.random() * TIPS.length);
  const menu = () => [
    h('span', { class: 'sg-line' }, t('Wobei kann ich helfen?')),
    h('span', { class: 'sg-menu' },
      h('button', { type: 'button', class: 'sg-item', onclick: () => { g.quiet(); app.querySelector('#tour-btn')?.click(); } }, '🧭 ', t('Einführung starten')),
      h('button', { type: 'button', class: 'sg-item', onclick: () => { tip = (tip + 1) % TIPS.length; g.say([h('b', {}, '💡 '), t(TIPS[tip])], 9000, 'nod'); } }, '💡 ', t('Tipp')),
      h('button', { type: 'button', class: 'sg-item', onclick: hide }, '🙈 ', t('Ausblenden'))),
  ];
  const g = buildGuide(app, {
    cls: 'sg--dash',
    label: t('Streamy, das Maskottchen – antippen für Hilfe'),
    onTap: () => { if (!g.bubble.hidden && g.bubble.querySelector('.sg-menu')) g.quiet(); else g.say(menu(), 0, 'hop'); },
    onClose: hide,
  });
  dashGuide = g;
  function hide() {
    store.set(OFF_KEY, '1');
    g.say(t('Okay! Unter „Einführung“ links holst du mich zurück.'), 3200, 'wiggle');
    setTimeout(() => g.show(false), 3200);
  }
  // Einführung geöffnet: Streamy ist wieder da
  app.addEventListener('click', (e) => {
    if (e.target.closest('#tour-btn') && store.get(OFF_KEY) === '1') { store.set(OFF_KEY, null); g.show(true); }
    else if (e.target.closest('.sb-item') && !g.el.hidden) g.streamy?.react('nod');
  });
  g.show(store.get(OFF_KEY) !== '1');
  if (!g.el.hidden && store.get(SEEN_KEY, sessionStorage) !== '1') {
    store.set(SEEN_KEY, '1', sessionStorage);
    setTimeout(() => {
      const name = userName();
      g.say(`${name ? t('Hi {name}!').replace('{name}', name) : t('Hi!')} ${t('Ich bin Streamy. Tipp mich an, wenn du Hilfe brauchst.')}`, 6500, 'hop');
    }, 2500);
  }
  return g;
}
