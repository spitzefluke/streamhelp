// Console (Entwurf) – Vorschläge „besser und günstiger“ mit Abfrage (nur Plattform-Admins, js/dash-console.js).
// Jeder Vorschlag passt zur aktuellen Auswahl im Technik-Baukasten (when). Mit apply lässt er sich direkt
// übernehmen; die Ersparnis rechnet kitTotals vorher/nachher aus. Vorschläge ohne apply sind Prüfaufträge mit
// geschätzter Wirkung (est, € je Gerät; negativ = kostet mehr). Entscheidungen liegen in kit.tips.
import { h } from './extras-core.js';
import { eur, featureClashes, kitTotals, option } from './dash-console-kit.js';

const CAP_HI = ['c4k30', 'c4k60'];

export const TIPS = [
  // ---------- günstiger ----------
  { id: 'cap1080', kind: 'save', title: 'Aufnahme in 1080p60, Bild trotzdem in 4K60 zum Fernseher',
    why: 'Twitch sendet bei den meisten Kanälen höchstens 1080p60. Der Capture-Chip für 1080p ist deutlich günstiger, das Spiel läuft trotzdem in 4K60 HDR verzögerungsfrei auf den Fernseher.',
    when: (k) => CAP_HI.includes(k.parts.capture),
    apply: (k) => { k.parts.capture = 'c1080'; if (k.parts.passthrough === 'none') k.parts.passthrough = 'p4k60'; } },
  { id: 'pt60', kind: 'save', title: 'Durchschleifen mit 4K60 statt 4K120/VRR',
    why: '120 Hz mit VRR braucht HDMI-2.1-Chips und teurere Buchsen. Zum Start reicht 4K60 HDR; 120 Hz kann eine „Pro“-Version bringen.',
    when: (k) => k.parts.passthrough === 'p4k120',
    apply: (k) => { k.parts.passthrough = 'p4k60'; } },
  { id: 'noradio', kind: 'save', title: 'Ohne WLAN und Bluetooth',
    why: 'Die Console hängt ohnehin per USB am PC. Ohne Funk entfallen die Funkprüfung (ca. 5.000 €) und die Cybersicherheits-Pflichten der Funkanlagen-Richtlinie.',
    when: (k) => k.parts.mcu === 'esp32s3',
    apply: (k) => { k.parts.mcu = 'rp2040'; } },
  { id: 'usbpower', kind: 'save', title: 'Strom über USB-C statt Netzteil',
    why: 'Kein Netzteil im Karton und keine Sicherheitsprüfung nach Niederspannungsrichtlinie. Bei 4K-Aufnahme mit Durchschleifen die Stromaufnahme messen – notfalls USB-C mit Power Delivery.',
    when: (k) => k.parts.power !== 'usbc',
    apply: (k) => { k.parts.power = 'usbc'; } },
  { id: 'keysmech', kind: 'save', title: 'Mechanische Taster statt Mini-Display je Taste',
    why: 'Das große Display zeigt die Belegung schon an. RGB-LEDs in den Tasten reichen als Farbcode.',
    when: (k) => k.parts.keys === 'lcdkeys',
    apply: (k) => { k.parts.keys = 'mech'; } },
  { id: 'mixersoft', kind: 'save', title: 'Lautstärken per Taste und Software statt Drehregler',
    why: 'Spiel- und Chat-Lautstärke lassen sich über zwei Tasten und das Display regeln. Spart Drehregler, Mischchip und Platz auf der Platine.',
    when: (k) => k.parts.audio === 'mixer',
    apply: (k) => { k.parts.audio = 'mix'; } },
  { id: 'caseprint', kind: 'save', title: 'Gehäuse erst im 3D-Druck, Spritzguss ab ca. 1.000 Stück',
    why: 'Das Spritzguss-Werkzeug kostet einmalig ca. 15.000 € und lohnt sich erst bei größeren Stückzahlen. Der Druck erlaubt zudem Änderungen nach dem Test mit Streamern.',
    when: (k) => k.parts.case === 'mold' && k.qty < 1000,
    apply: (k) => { k.parts.case = 'print'; } },
  { id: 'casemold', kind: 'save', title: 'Ab 1.000 Stück auf Spritzguss wechseln',
    why: 'Bei dieser Stückzahl verteilt sich das Werkzeug gut, und jedes Gehäuse wird günstiger und gleichmäßiger.',
    when: (k) => k.parts.case === 'print' && k.qty >= 1000,
    apply: (k) => { k.parts.case = 'mold'; } },
  { id: 'casealu', kind: 'save', title: 'Aluminium nur als limitierte Sonderedition',
    why: 'Gefrästes Aluminium sieht edel aus, kostet aber ein Vielfaches. Als nummerierte Edition zu einem höheren Preis anbieten, die Standard-Console im Kunststoffgehäuse.',
    when: (k) => k.parts.case === 'alu',
    apply: (k) => { k.parts.case = k.qty >= 1000 ? 'mold' : 'print'; } },
  { id: 'pcbvolume', kind: 'save', title: 'Platinen ab 1.000 Stück bestellen',
    why: 'Bestückte Platinen werden in größeren Mengen deutlich günstiger.',
    when: (k) => (k.parts.pcb === 'hs' && k.qty >= 1000) || (k.parts.pcb === 'small' && k.qty >= 1000),
    apply: (k) => { k.parts.pcb = k.parts.pcb === 'hs' ? 'hsl' : 'large'; } },
  { id: 'boxbasic', kind: 'save', title: 'Schlichte Verpackung, Sticker als Bonus',
    why: 'Vollfarbdruck innen und außen kostet mehr als das Doppelte. Ein schwarzer Karton mit weißem Druck wirkt hochwertig; Sticker z. B. nur für Vorbesteller.',
    when: (k) => k.parts.box === 'premium',
    apply: (k) => { k.parts.box = 'basic'; } },
  { id: 'qty500', kind: 'save', title: 'Erste Serie mit 500 statt weniger Stück',
    why: 'Prüfungen und Werkzeug sind Einmalkosten und verteilen sich auf mehr Geräte. Dafür steckt mehr Geld im Lager – erst nach Vorbestellungen oder Crowdfunding sinnvoll.',
    when: (k) => k.qty < 500,
    apply: (k) => { k.qty = 500; } },
  { id: 'nohdmicable', kind: 'save', title: 'Ohne HDMI-Kabel im Karton', est: 1.5,
    why: 'Fast alle haben schon ein HDMI-Kabel an der Konsole. Spart Kosten, Gewicht und Verpackung – im Shop deutlich dazuschreiben.',
    when: (k) => k.parts.capture !== 'none' || k.parts.passthrough !== 'none' },
  { id: 'mcuincap', kind: 'save', title: 'Tasten über den Capture-Chip auslesen', est: 2.5,
    why: 'Viele Capture-Chips haben einen eigenen kleinen Prozessor mit freien Anschlüssen. Wenn die Tasten und das Display dort laufen, entfällt der eigene Mikrocontroller. Beim Chip-Hersteller nach SDK und freien Pins fragen.',
    when: (k) => k.parts.capture !== 'none' },
  { id: 'certmodule', kind: 'save', title: 'Fertiges Capture-Modul statt eigener HDMI-Platine', est: 8,
    why: 'Ein zugekauftes, schon geprüftes Modul spart die teure 6-Lagen-Platine und senkt das Risiko bei der EMV-Prüfung. Dafür weniger Freiheit bei Form und Anschlüssen.',
    when: (k) => k.parts.capture !== 'none' && ['hs', 'hsl'].includes(k.parts.pcb) },
  // ---------- besser ----------
  { id: 'webhid', kind: 'better', title: 'Belegen und Updaten direkt im Browser', est: 0,
    why: 'Tasten, Display und Firmware-Updates über die StreamHelp-Seite (WebHID/WebUSB) – keine Extra-App zum Installieren. Spart Entwicklungszeit für Windows- und Mac-Programme.' },
  { id: 'profiles', kind: 'better', title: 'Tasten-Profile je Spiel und Szene', est: 0,
    why: 'Die Belegung wechselt automatisch mit der OBS-Szene oder dem Spiel. Reine Software, keine Mehrkosten.' },
  { id: 'chatdisplay', kind: 'better', title: 'Chat, Raids und Spenden auf dem Display', est: 0,
    why: 'Wichtige Ereignisse ohne zweiten Bildschirm sehen. Nutzt das vorhandene Display.' },
  { id: 'mutebtn', kind: 'better', title: 'Mikro-Stummschalter mit roter LED', est: -0.8,
    why: 'Ein Hardware-Schalter, der immer funktioniert – auch wenn die Software hängt. Sehr gefragt bei Streamern.',
    when: (k) => ['mix', 'mixer'].includes(k.parts.audio) },
  { id: 'isolation', kind: 'better', title: 'Massetrennung gegen Brummen im Ton', est: -0.6,
    why: 'Wenn Konsole, PC und Fernseher an verschiedenen Steckdosen hängen, brummt es sonst oft im Ton. Kleines Bauteil, große Wirkung bei Bewertungen.',
    when: (k) => k.parts.capture !== 'none' },
  { id: 'stand', kind: 'better', title: 'Magnetischer, neigbarer Standfuß', est: -1.2,
    why: 'Display und Tasten im besseren Winkel; abnehmbar, damit der Karton flach bleibt.' },
  { id: 'kensington', kind: 'better', title: 'USB-C mit Schraubsicherung', est: -0.3,
    why: 'Das Kabel rutscht beim Streamen nicht heraus – ein häufiger Grund für Bildausfälle.' },
];

const DECISIONS = [['open', 'Offen'], ['yes', 'Übernehmen'], ['check', 'Später prüfen'], ['no', 'Nein']];

// Wirkung eines Vorschlags: Kosten je Gerät und einmalige Kosten (negativ = Ersparnis)
function effect(kit, tip) {
  if (!tip.apply) return { perDevice: -(tip.est ?? 0), once: 0, price: 0, clash: [] };
  const after = structuredClone(kit);
  tip.apply(after);
  const a = kitTotals(kit);
  const b = kitTotals(after);
  return { perDevice: b.perDevice - a.perDevice, once: (b.tests + b.tool) - (a.tests + a.tool), price: b.price - a.price, clash: featureClashes(after).filter((f) => !featureClashes(kit).includes(f)) };
}

const signed = (n) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${eur(Math.abs(n))}`;

// ctx: { kit, onChange(kit) }
export function renderTips(ctx) {
  const { kit } = ctx;
  const change = (fn) => { fn(kit); ctx.onChange(kit); };
  const active = TIPS.filter((t) => !t.when || t.when(kit) || kit.tips[t.id]);
  // Alle offenen Spar-Vorschläge zusammen (nacheinander angewendet, damit sich nichts doppelt zählt)
  const all = structuredClone(kit);
  let est = 0;
  for (const t of active) {
    if (t.kind !== 'save' || kit.tips[t.id] === 'no' || kit.tips[t.id] === 'yes' || (t.when && !t.when(all))) continue;
    if (t.apply) t.apply(all); else est += t.est ?? 0;
  }
  const now = kitTotals(kit);
  const best = kitTotals(all);
  const decided = active.filter((t) => kit.tips[t.id]).length;
  const takenEst = active.filter((t) => !t.apply && kit.tips[t.id] === 'yes').reduce((sum, t) => sum + (t.est ?? 0), 0);

  const row = (t) => {
    const st = kit.tips[t.id] ?? 'open';
    const applicable = !t.when || t.when(kit);
    const e = effect(kit, t);
    const fx = t.apply
      ? (applicable ? [`${signed(e.perDevice)} je Gerät`, e.once ? `${signed(e.once)} einmalig` : '', e.price ? `Endpreis ${signed(e.price)}` : ''].filter(Boolean).join(' · ') : 'umgesetzt')
      : (t.est ? `ca. ${signed(-t.est)} je Gerät (Schätzung)` : 'keine Mehrkosten (Software)');
    return h('li', { class: `ck-tip is-${st}${t.kind === 'better' ? ' is-better' : ''}`, 'data-tip': t.id },
      h('div', { class: 'ck-tip-text' },
        h('b', {}, t.title),
        h('p', {}, t.why),
        h('small', { class: `ck-tip-fx${e.perDevice < -0.005 ? ' is-good' : e.perDevice > 0.005 ? ' is-cost' : ''}` }, fx),
        e.clash.length ? h('small', { class: 'is-warn' }, `Passt dann nicht mehr zu Version 1: ${e.clash.map((f) => f.name).join(', ')}`) : null),
      h('div', { class: 'ck-tip-act' },
        t.apply && applicable && st !== 'no'
          ? h('button', { class: 'btn btn--primary btn--sm', type: 'button', 'data-apply': t.id, onclick: () => change((k) => { t.apply(k); k.tips[t.id] = 'yes'; }) }, 'Übernehmen')
          : null,
        h('select', { 'aria-label': `${t.title}: Entscheidung`, 'data-decide': t.id, onchange: (ev) => change((k) => {
          const v = ev.target.value;
          if (v === 'yes' && t.apply && (!t.when || t.when(k))) t.apply(k);
          if (v === 'open') delete k.tips[t.id]; else k.tips[t.id] = v;
        }) },
          ...DECISIONS.map(([v, l]) => h('option', { value: v, selected: v === st }, l)))));
  };
  const group = (kind, title) => {
    const list = active.filter((t) => t.kind === kind);
    return list.length ? h('div', { class: 'ck-tip-group' }, h('h3', {}, title), h('ul', { class: 'ck-tip-list' }, ...list.map(row))) : null;
  };

  return h('section', { class: 'dash-card dash-card--wide ck-card ck-tips' },
    h('header', { class: 'cs-head' }, h('div', {},
      h('h2', {}, 'Vorschläge: besser und günstiger'),
      h('p', { class: 'dash-status' }, `${decided} von ${active.length} entschieden – „Übernehmen“ ändert die Bauteile, „Später prüfen“ merkt den Vorschlag vor.`))),
    h('div', { class: 'ck-tip-sum' },
      h('div', {}, h('span', {}, 'Kosten je Gerät jetzt (Bauteile und Einmalkosten)'), h('b', {}, eur(now.perDevice))),
      h('div', {}, h('span', {}, 'mit allen offenen Spar-Vorschlägen'), h('b', {}, eur(Math.max(0, best.perDevice - est)))),
      h('div', {}, h('span', {}, 'Endpreis-Vorschlag'), h('b', {}, `${eur(now.price)} → ${eur(Math.max(0.99, Math.ceil(Math.max(0, best.perDevice - est) * kit.factor * 1.19) - 0.01))}`))),
    takenEst ? h('p', { class: 'form-hint' }, `Übernommene Schätz-Vorschläge: ${signed(-takenEst)} je Gerät – noch nicht in den Summen, bis echte Angebote vorliegen.`) : null,
    group('save', 'Günstiger'),
    group('better', 'Besser'));
}
