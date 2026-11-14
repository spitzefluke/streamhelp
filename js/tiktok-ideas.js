// Content-Ideen für TikTok LIVE (Seite „Content-Ideen“, Abschnitt „TikTok LIVE“).
// TikTok hat keine offizielle Schnittstelle für Chat, Geschenke und Likes eines LIVEs – StreamHelp liest dort also
// nichts mit. Die Ideen sind deshalb so gebaut, dass du (oder deine Mods) sie mit Werkzeugen steuern, die ohne
// Twitch-Daten laufen: Zähler (+1/−1), Spiel-Rad, Timer, Pause-Bildschirm und das Overlay im Hochformat (fmt=v).
// Eingebunden von js/app.js (renderTikTokIdeas). Reine Anzeige – nichts wird gespeichert außer dem gewählten
// Bereich und ob der Abschnitt offen ist (nur in diesem Browser).
import { h } from './extras-core.js';

export const TT_CATS = [
  { id: 'gifts', label: 'Geschenke & Ziele', icon: '🎁' },
  { id: 'battle', label: 'Battles & Match', icon: '⚔️' },
  { id: 'likes', label: 'Like- & Chat-Spiele', icon: '❤️' },
  { id: 'formats', label: 'Formate & Serien', icon: '📺' },
];

// Werkzeuge in StreamHelp, die ohne TikTok-Daten funktionieren (Knopf im Detail)
const TOOLS = {
  counter: { label: 'Zähler öffnen', icon: '🔢', hint: 'Mit +1/−1 im Dashboard zählen – das Overlay zeigt den Stand.' },
  gamewheel: { label: 'Spiel-Rad öffnen', icon: '🎡', hint: 'Aufgaben eintragen und im Dashboard drehen – das Ergebnis erscheint im Overlay.' },
  subathon: { label: 'Timer öffnen', icon: '⏱️', hint: 'Zeit von Hand dazugeben – der Timer läuft im Overlay.' },
  pause: { label: 'Pause-Bildschirm', icon: '⏸️', hint: 'Für Pausen: ein Bildschirm mit Countdown im Overlay.' },
  obs: { label: 'Overlay im Hochformat', icon: '📱', hint: 'Im OBS-Editor „Hochformat · TikTok“ wählen und als Link-Quelle in TikTok LIVE Studio einfügen.' },
};

// how = Ablauf, tip = was es besser macht. Bewusst kurz: Man liest es kurz vor dem LIVE.
export const TT_IDEAS = [
  // ---------- Geschenke & Ziele ----------
  { id: 'gift-goal', cat: 'gifts', icon: '🎯', title: 'Geschenke-Ziel mit Belohnung', effort: 'leicht', time: 'ganzer LIVE',
    pitch: 'Ein klares Ziel für den Abend – und eine Belohnung, auf die alle hinfiebern.',
    how: ['Vor dem LIVE ein Ziel festlegen (z. B. 5 000 Münzen) und in TikTok als LIVE-Ziel einstellen.', 'Die Belohnung laut ansagen: Haare färben, Gruselspiel, Karaoke …', 'Zwischenstände mit dem Zähler im Overlay zeigen (z. B. in 500er-Schritten).', 'Bei 50 % und 90 % kurz feiern – das holt Nachzügler ab.'],
    tools: ['counter', 'obs'], tip: 'Die Belohnung muss zum Kanal passen und im selben LIVE stattfinden – sonst glaubt beim nächsten Mal niemand mehr dran.' },
  { id: 'gift-tasks', cat: 'gifts', icon: '🎁', title: 'Jedes Geschenk = eine Aufgabe', effort: 'mittel', time: '30–60 Min',
    pitch: 'Eine kleine „Speisekarte“: Welches Geschenk löst was aus?',
    how: ['Drei bis fünf Geschenke auswählen und je eine Aufgabe festlegen (Rose = Grimasse, Finger-Herz = 10 Kniebeugen …).', 'Die Liste ins Laufband im Overlay schreiben, damit Neue sie sofort sehen.', 'Größere Geschenke = das Spiel-Rad drehen: Zufall macht es spannender.', 'Aufgaben sofort erledigen – Wartezeit killt die Stimmung.'],
    tools: ['gamewheel', 'obs'], tip: 'Lieber lustige als peinliche Aufgaben – und nichts, was gegen TikToks Richtlinien geht.' },
  { id: 'rose-count', cat: 'gifts', icon: '🌹', title: 'Rosen-Zähler', effort: 'leicht', time: 'ganzer LIVE',
    pitch: 'Ein Zähler für kleine Geschenke – jede Rose zählt sichtbar mit.',
    how: ['Einen Zähler „Rosen“ anlegen und im Overlay zeigen.', 'Ein Mod klickt bei jeder Rose +1 – oder du zählst in Runden nach.', 'Bei runden Zahlen (50, 100, 200) passiert etwas: Song wünschen, Frage beantworten, Outfit wechseln.'],
    tools: ['counter'], tip: 'Kleine Geschenke sichtbar zu machen, lohnt sich: Viele Zuschauer können nur eine Rose geben.' },
  { id: 'gift-marathon', cat: 'gifts', icon: '⏱️', title: 'Geschenke-Marathon', effort: 'aufwendig', time: 'mehrere Stunden',
    pitch: 'Der LIVE läuft so lange, wie Geschenke kommen – mit Timer im Bild.',
    how: ['Startzeit festlegen (z. B. 60 Minuten) und den Timer im Overlay zeigen.', 'Regel ansagen: z. B. jede Rose +10 Sek., Finger-Herz +1 Min.', 'Ein Mod gibt die Zeit im Dashboard von Hand dazu.', 'Eine Höchstdauer festlegen – und Pausen mit dem Pause-Bildschirm.'],
    tools: ['subathon', 'pause'], tip: 'Ohne Obergrenze wird es schnell zu viel – plane Schlaf, Essen und Pausen ein.' },
  { id: 'gifter-thanks', cat: 'gifts', icon: '🏆', title: 'Danke-Runde für die Gifter', effort: 'leicht', time: '5–10 Min',
    pitch: 'Am Ende jedes LIVEs: die Unterstützer des Abends namentlich feiern.',
    how: ['Während des LIVEs die Top-Gifter notieren (TikTok zeigt die Rangliste im LIVE).', 'Kurz vor Schluss jeden Namen nennen und sich persönlich bedanken.', 'Die Namen fürs nächste LIVE ins Laufband schreiben: „Danke an …“.'],
    tools: ['obs'], tip: 'Auch kleine Unterstützer erwähnen – das bindet mehr als nur die größten Geschenke.' },

  // ---------- Battles & Match ----------
  { id: 'match-punish', cat: 'battle', icon: '⚔️', title: 'Match mit Strafe', effort: 'leicht', time: '5 Min je Match',
    pitch: 'Ein LIVE-Match gegen andere Creator – und das Spiel-Rad entscheidet die Strafe für den Verlierer.',
    how: ['Strafen ins Spiel-Rad eintragen (Zitrone essen, 1 Minute Akzent, Tanz …).', 'Vor dem Match mit dem Gegenüber absprechen, dass das Rad gilt.', 'Nach dem Match für den Verlierer drehen – live im Bild.'],
    tools: ['gamewheel'], tip: 'Die Strafe für beide Seiten vorher zeigen: Das motiviert die Zuschauer beider Kanäle.' },
  { id: 'match-series', cat: 'battle', icon: '🥊', title: 'Best of 5', effort: 'mittel', time: '30–45 Min',
    pitch: 'Statt einzelner Matches eine Serie – mit Spielstand im Overlay.',
    how: ['Zwei Zähler anlegen: „Siege“ und „Niederlagen“.', 'Fünf Matches nacheinander, nach jedem den Stand anpassen.', 'Vor dem Entscheidungs-Match die Spannung aufbauen: Ziel ansagen, Chat anfeuern lassen.'],
    tools: ['counter'], tip: 'Gegen ähnlich große Kanäle antreten – zu große Unterschiede machen keinen Spaß.' },
  { id: 'team-duel', cat: 'battle', icon: '🔴', title: 'Team-Duell im Chat', effort: 'leicht', time: '10–20 Min',
    pitch: 'Der Chat teilt sich in zwei Teams – wer ist lauter?',
    how: ['Zwei Teams ausrufen, z. B. „Team Pizza“ gegen „Team Burger“.', 'Kommentare zählen: Ein Mod drückt bei jedem Team-Kommentar +1 auf dem passenden Zähler.', 'Nach 5 Minuten Gewinner ausrufen – das Gewinnerteam bestimmt das nächste Thema.'],
    tools: ['counter'], tip: 'Kurze Runden, schnelle Ergebnisse: lieber dreimal 5 Minuten als einmal 15.' },
  { id: 'guest-night', cat: 'battle', icon: '🎙️', title: 'Gast-Abend', effort: 'mittel', time: '45–60 Min',
    pitch: 'Andere Creator als Gäste im LIVE – Interview, Spiel oder Duell.',
    how: ['Zwei bis drei Gäste vorher einladen und Uhrzeiten absprechen.', 'Für jeden Gast eine Rubrik: drei Fragen, ein Mini-Spiel, eine Challenge.', 'Gäste im Laufband ankündigen: „Gleich zu Gast: …“.'],
    tools: ['gamewheel', 'obs'], tip: 'Gäste aus deiner Nische bringen Zuschauer, die wirklich bleiben.' },

  // ---------- Like- & Chat-Spiele ----------
  { id: 'like-goal', cat: 'likes', icon: '❤️', title: 'Like-Ziel (Tap-Tap-Challenge)', effort: 'leicht', time: 'ganzer LIVE',
    pitch: 'Likes kosten nichts – ein Ziel macht sie zum Gemeinschafts-Spiel.',
    how: ['Ein Like-Ziel ansagen (z. B. 10 000) und was dann passiert.', 'Den Stand alle paar Minuten im Zähler nachziehen (in 1 000er-Schritten).', 'Kurz vor dem Ziel zum Endspurt aufrufen.'],
    tools: ['counter'], tip: 'Mehrere kleine Ziele hintereinander halten die Spannung länger als ein riesiges.' },
  { id: 'comment-vote', cat: 'likes', icon: '🗳️', title: 'Abstimmung per Kommentar', effort: 'leicht', time: '2–5 Min je Runde',
    pitch: '„Schreib 1 oder 2“ – der Chat entscheidet, was als Nächstes passiert.',
    how: ['Zwei Möglichkeiten ansagen (Spiel A oder B, Outfit 1 oder 2 …).', 'Zwei Zähler anlegen, ein Mod zählt die Kommentare mit.', 'Nach 2 Minuten auswerten und das Ergebnis sofort umsetzen.'],
    tools: ['counter'], tip: 'Nur abstimmen lassen, was du auch wirklich machst – sonst fühlt sich der Chat veräppelt.' },
  { id: 'guess-round', cat: 'likes', icon: '🔍', title: 'Rate-Runde', effort: 'mittel', time: '15–30 Min',
    pitch: 'Emoji-Rätsel, Song-Intro oder Promi-Raten: Wer zuerst richtig kommentiert, gewinnt.',
    how: ['Zehn Rätsel vorbereiten (Emojis, Geräusche, verpixelte Bilder).', 'Rätsel zeigen, die erste richtige Antwort im Kommentar gewinnt einen Shoutout.', 'Punkte der Gewinner mit dem Zähler zählen – am Ende gibt es einen Sieger.'],
    tools: ['counter', 'gamewheel'], tip: 'Mischung aus leicht und schwer: Erfolgserlebnisse halten neue Zuschauer da.' },
  { id: 'qa-wheel', cat: 'likes', icon: '❓', title: 'Q&A mit Fragen-Rad', effort: 'leicht', time: '20–40 Min',
    pitch: 'Fragerunde mit Zufall: Das Rad wählt das Thema, der Chat stellt die Fragen.',
    how: ['Themen ins Spiel-Rad schreiben (Kindheit, Peinlich, Zukunft, Lieblingsessen …).', 'Rad drehen, dann Fragen zum Thema aus den Kommentaren beantworten.', 'Jede fünfte Frage eine „Ehrlich-Frage“ – das sorgt für die besten Momente.'],
    tools: ['gamewheel'], tip: 'Fragen laut vorlesen, bevor du antwortest – Neue im LIVE wissen sonst nicht, worum es geht.' },
  { id: 'forbidden-word', cat: 'likes', icon: '🚫', title: 'Verbotenes Wort', effort: 'leicht', time: '15–30 Min',
    pitch: 'Der Chat versucht, dich ein bestimmtes Wort sagen zu lassen.',
    how: ['Ein Wort festlegen, das du nicht sagen darfst (z. B. „ja“).', 'Jedes Mal, wenn es dir rausrutscht, zählt ein Mod +1.', 'Bei 5 Fehlern dreht das Spiel-Rad eine Strafe.'],
    tools: ['counter', 'gamewheel'], tip: 'Wenn der Chat dich mit Fragen löchert, ist das Ziel erreicht – mitspielen lohnt sich.' },

  // ---------- Formate & Serien ----------
  { id: 'grwm', cat: 'formats', icon: '💄', title: 'Get Ready With Me', effort: 'leicht', time: '30–45 Min',
    pitch: 'Fertigmachen fürs Wochenende – der Chat bestimmt Outfit, Make-up oder Frisur mit.',
    how: ['Optionen ins Spiel-Rad eintragen (Farben, Looks, Accessoires).', 'Bei jedem Schritt drehen oder per Kommentar abstimmen lassen.', 'Zum Schluss das Ergebnis zeigen – Vorher-Nachher wirkt besonders gut.'],
    tools: ['gamewheel', 'obs'], tip: 'Kamera auf Augenhöhe und gutes Licht – im Hochformat sieht man jedes Detail.' },
  { id: 'cook-live', cat: 'formats', icon: '🍳', title: 'Kochen nach Chat-Wahl', effort: 'mittel', time: '45–60 Min',
    pitch: 'Ein Gericht, aber der Chat wählt die Zutaten – mit Timer im Bild.',
    how: ['Ein paar Zutaten bereitlegen und ins Spiel-Rad schreiben.', 'Zweimal drehen: Diese Zutaten müssen rein.', 'Den Timer mit der Kochzeit starten – und am Ende ehrlich probieren.'],
    tools: ['gamewheel', 'subathon'], tip: 'Handy-Halterung über der Arbeitsfläche: Im Hochformat passen Gesicht und Pfanne zusammen ins Bild.' },
  { id: 'art-challenge', cat: 'formats', icon: '🎨', title: 'Zeichnen nach Kommentaren', effort: 'mittel', time: '30–60 Min',
    pitch: 'Der Chat gibt das Motiv vor – du hast 10 Minuten.',
    how: ['Motive aus den Kommentaren sammeln und ins Spiel-Rad schreiben.', 'Drehen, Timer auf 10 Minuten stellen, loslegen.', 'Das fertige Bild zeigen und den Ideengeber erwähnen.'],
    tools: ['gamewheel', 'subathon'], tip: 'Den Prozess erklären, während du zeichnest – Zuschauer bleiben für das „Wie“.' },
  { id: 'vertical-gaming', cat: 'formats', icon: '🎮', title: 'Gaming im Hochformat', effort: 'mittel', time: 'ganzer LIVE',
    pitch: 'Spielszene in der Mitte, Kamera oben, Overlay drumherum – gemacht fürs Handy.',
    how: ['In OBS eine Leinwand 1080 × 1920 anlegen (oder TikTok LIVE Studio nutzen).', 'Spiel mittig zuschneiden, Kamera darüber, unten Platz für TikToks Kommentare lassen.', 'Das StreamHelp-Overlay im Hochformat einfügen – Karten weichen TikToks Bedienelementen aus.'],
    tools: ['obs', 'counter'], tip: 'Kleine Schrift im Spiel ist im Hochformat kaum lesbar: Spiele mit großen, klaren Bildern wirken besser.' },
  { id: 'study-with-me', cat: 'formats', icon: '📚', title: 'Lernen / Arbeiten mit mir', effort: 'leicht', time: '1–3 Std',
    pitch: 'Ruhiger LIVE im Pomodoro-Takt: 25 Minuten Fokus, 5 Minuten Pause und Chat.',
    how: ['Timer auf 25 Minuten stellen, Fokus-Phase ansagen.', 'In der Pause den Pause-Bildschirm zeigen und mit dem Chat reden.', 'Ziele für die Session am Anfang nennen und am Ende abhaken.'],
    tools: ['subathon', 'pause'], tip: 'Ruhige Musik ohne Urheberrechtsprobleme – TikTok schaltet LIVEs sonst stumm.' },
];

const OPEN_KEY = 'sh_tt_open';
const CAT_KEY = 'sh_tt_cat';
const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k, v) => { try { localStorage.setItem(k, v); } catch { /* privates Fenster: gilt nur jetzt */ } };

let deps = null; // { openExtra, openObs, toast, first }
let cat = 'all';

// Abschnitt zeichnen. first = TikTok in der Einführung gewählt → offen und oben.
export function renderTikTokIdeas(d) {
  deps = d;
  const box = document.getElementById('tt-ideas');
  if (!box) return;
  cat = get(CAT_KEY) ?? 'all';
  if (cat !== 'all' && !TT_CATS.some((c) => c.id === cat)) cat = 'all';
  const stored = get(OPEN_KEY);
  box.open = stored === null ? !!d.first : stored === '1';
  if (!box.dataset.ready) {
    box.dataset.ready = '1';
    box.addEventListener('toggle', () => set(OPEN_KEY, box.open ? '1' : '0'));
  }
  // Wer TikTok als Plattform gewählt hat, sieht den Abschnitt über den anderen Ideen
  const section = document.querySelector('.ideas-section');
  if (d.first && section && box.nextElementSibling !== section) section.before(box);
  paint();
}

function paint() {
  const box = document.getElementById('tt-ideas');
  const list = TT_IDEAS.filter((i) => cat === 'all' || i.cat === cat);
  box.querySelector('[data-tt-chips]').replaceChildren(...[{ id: 'all', label: 'Alle', icon: '✨' }, ...TT_CATS].map((c) => h('button', {
    type: 'button', class: 'cat-chip', 'aria-pressed': String(c.id === cat),
    onclick: () => { cat = c.id; set(CAT_KEY, cat); paint(); },
  }, `${c.icon} ${c.label}`, h('span', { class: 'cat-n' }, String(c.id === 'all' ? TT_IDEAS.length : TT_IDEAS.filter((i) => i.cat === c.id).length)))));
  box.querySelector('[data-tt-grid]').replaceChildren(...list.map((idea) => h('button', {
    type: 'button', class: 'tt-card', 'data-tt': idea.id, onclick: () => openIdea(idea),
  },
  h('span', { class: 'tt-card-ico', 'aria-hidden': 'true' }, idea.icon),
  h('span', { class: 'tt-card-text' },
    h('b', {}, idea.title),
    h('small', {}, idea.pitch)),
  h('span', { class: 'tt-card-meta' },
    h('span', {}, TT_CATS.find((c) => c.id === idea.cat)?.label ?? ''),
    h('span', {}, `${idea.time} · ${idea.effort}`)))));
}

function openIdea(idea) {
  const dlg = document.getElementById('tt-dialog');
  const c = TT_CATS.find((x) => x.id === idea.cat);
  dlg.querySelector('[data-tt-body]').replaceChildren(
    h('header', { class: 'tt-dlg-head' },
      h('span', { class: 'tt-dlg-ico', 'aria-hidden': 'true' }, idea.icon),
      h('div', {},
        h('p', { class: 'tt-eyebrow' }, `TikTok LIVE · ${c?.label ?? ''}`),
        h('h2', { id: 'tt-dialog-title' }, idea.title),
        h('p', { class: 'tt-pitch' }, idea.pitch))),
    h('p', { class: 'tt-meta' }, h('span', {}, `⏱ ${idea.time}`), h('span', {}, `💪 ${idea.effort}`)),
    h('h3', { class: 'tt-h' }, 'So läuft’s'),
    h('ol', { class: 'tt-steps' }, ...idea.how.map((s) => h('li', {}, s))),
    h('h3', { class: 'tt-h' }, 'Mit StreamHelp'),
    h('div', { class: 'tt-tools' }, ...idea.tools.map((k) => {
      const t = TOOLS[k];
      return h('button', { type: 'button', class: 'tt-tool', onclick: () => useTool(k) },
        h('span', { class: 'tt-tool-ico', 'aria-hidden': 'true' }, t.icon),
        h('span', {}, h('b', {}, t.label), h('small', {}, t.hint)));
    })),
    h('p', { class: 'tt-tip' }, h('b', {}, '💡 Tipp: '), idea.tip),
    h('p', { class: 'form-hint' }, 'Chat, Geschenke und Likes aus TikTok kommen nicht automatisch bei StreamHelp an – du oder deine Mods zählen und drehen von Hand.'));
  if (!dlg.open) dlg.showModal();
}

function useTool(k) {
  const dlg = document.getElementById('tt-dialog');
  dlg.close();
  if (k === 'obs') { deps.openObs(); return; }
  deps.openExtra(k);
}
