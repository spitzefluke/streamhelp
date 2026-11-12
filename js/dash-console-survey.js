// Console (Entwurf) – Abfrage „Anschlüsse, Design und mehr“ (nur Plattform-Admins, js/dash-console.js).
// Anschlüsse: je Buchse behalten, zusammenlegen oder weglassen – ändert Bauteile, Kosten und die 3D-Ansicht.
// Design: Farben, Licht, Tastenkappen, Logo (kit.design) – sofort im 3D-Modell sichtbar.
// Mehr: Zielgruppe, Wunschpreis (mit Abgleich zum Endpreis-Vorschlag), Plattformen, Software, Garantie, Notiz (kit.answers).
import { h } from './extras-core.js';
import { DESIGN, MORE_QUESTIONS, PACK, PACK_DEFAULT, eur, kitTotals } from './dash-console-kit.js';

const hasMix = (k) => ['mix', 'mixer'].includes(k.parts.audio);
const hasHdmi = (k) => k.parts.capture !== 'none' || k.parts.passthrough !== 'none';

const PORTS = [
  { id: 'hdmiin', name: 'HDMI IN', when: hasHdmi, fixed: 'Pflicht für die Aufnahme – bleibt.' },
  { id: 'usbc', name: 'USB-C zum PC', fixed: 'Pflicht – Strom, Daten, Bild und Ton zum PC über ein Kabel.' },
  { id: 'hdmiout', name: 'HDMI OUT zum Fernseher', when: hasHdmi,
    hint: 'Ohne HDMI OUT spielt man über die OBS-Vorschau mit Verzögerung oder braucht einen Splitter – für Konsolen-Streamer ein großer Nachteil.',
    value: (k) => (k.parts.passthrough === 'none' ? 'drop' : 'keep'),
    choices: [
      ['keep', 'Behalten', (k) => { if (k.parts.passthrough === 'none') k.parts.passthrough = 'p4k60'; }],
      ['drop', 'Weglassen', (k) => { k.parts.passthrough = 'none'; }],
    ] },
  { id: 'audio', name: 'Kopfhörer und Mikro/Party-Chat (3,5 mm)',
    hint: 'Die meisten Headsets haben einen 4-poligen Stecker; für zwei getrennte Stecker gibt es Adapter für wenige Euro.',
    value: (k) => (!hasMix(k) ? 'drop' : k.design.combojack ? 'combine' : 'keep'),
    choices: [
      ['keep', 'Zwei Buchsen', (k) => { if (!hasMix(k)) k.parts.audio = 'mix'; k.design.combojack = false; }],
      ['combine', 'Eine Headset-Buchse (4-polig)', (k) => { if (!hasMix(k)) k.parts.audio = 'mix'; k.design.combojack = true; }],
      ['drop', 'Weglassen – nur Ton über HDMI', (k) => { k.parts.audio = 'hdmi'; k.design.combojack = false; }],
    ] },
  { id: 'sd', name: 'microSD-Steckplatz', when: (k) => k.parts.capture !== 'none',
    hint: 'Nur nötig, wenn ohne PC aufgenommen werden soll – das braucht einen eigenen Encoder-Chip.',
    value: (k) => (k.features.sdrec === 'v1' ? 'keep' : 'drop'),
    choices: [
      ['keep', 'Einbauen (Version 1)', (k) => { k.features.sdrec = 'v1'; }],
      ['drop', 'Weglassen', (k) => { if (k.features.sdrec === 'v1') k.features.sdrec = 'later'; }],
    ] },
  { id: 'power', name: 'Netzteil-Buchse', when: (k) => k.parts.power !== 'usbc',
    hint: 'Strom über USB-C reicht meist – spart Netzteil, Buchse und die Sicherheitsprüfung.',
    value: () => 'keep',
    choices: [
      ['keep', 'Behalten', () => {}],
      ['drop', 'Weglassen – Strom über USB-C', (k) => { k.parts.power = 'usbc'; }],
    ] },
];

const signed = (n) => `${n > 0 ? '+' : '−'}${eur(Math.abs(n))}`;
// Kosten je Gerät, wenn man die Wahl übernimmt (gegenüber jetzt)
function delta(kit, fn) {
  const after = structuredClone(kit);
  fn(after);
  return kitTotals(after).perDevice - kitTotals(kit).perDevice;
}

// ctx: { kit, onChange(kit) }
export function renderSurvey(ctx) {
  const { kit } = ctx;
  const change = (fn) => { fn(kit); ctx.onChange(kit); };
  const t = kitTotals(kit);
  const field = (label, control, ...extra) => h('li', {}, h('div', { class: 'ck-scope-text' }, h('span', {}, label), ...extra), control);

  // Anschlüsse
  const ports = PORTS.filter((p) => !p.when || p.when(kit)).map((p) => {
    if (p.fixed) return field(p.name, h('span', { class: 'ck-fixed' }, 'bleibt'), h('small', {}, p.fixed));
    const cur = p.value(kit);
    return field(p.name,
      h('select', { 'data-port': p.id, 'aria-label': `${p.name}: Entscheidung`, onchange: (e) => change((k) => p.choices.find(([v]) => v === e.target.value)?.[2](k)) },
        ...p.choices.map(([v, label, fn]) => {
          const d = v === cur ? 0 : delta(kit, fn);
          return h('option', { value: v, selected: v === cur }, Math.abs(d) >= 0.005 ? `${label} (${signed(d)})` : label);
        })),
      h('small', {}, p.hint));
  });

  // Design
  const design = DESIGN.map((d) => field(d.name,
    h('select', { 'data-design': d.id, 'aria-label': d.name, onchange: (e) => change((k) => { k.design[d.id] = e.target.value; }) },
      ...d.options.map((o) => h('option', { value: o.id, selected: o.id === kit.design[d.id] }, o.eur ? `${o.name} (+${eur(o.eur)})` : o.name)))));

  // Verpackung (wirkt auf die 3D-Verpackung)
  const pack = PACK.map((q) => {
    const cur = kit.pack[q.id] ?? PACK_DEFAULT[q.id];
    const rec = q.options.find((o) => o.id === q.rec);
    return field(q.name,
      h('select', { 'data-pack': q.id, 'aria-label': q.name, onchange: (e) => change((k) => { k.pack[q.id] = e.target.value; }) },
        ...q.options.map((o) => h('option', { value: o.id, selected: o.id === cur }, `${o.name}${o.eur ? ` (${signed(o.eur)})` : ''}${o.id === q.rec ? ' – Vorschlag' : ''}`))),
      cur === q.rec ? h('small', { class: 'is-good' }, `✓ Vorschlag – ${q.why}`) : h('small', {}, h('b', {}, `Vorschlag: ${rec.name}. `), q.why));
  });

  // Mehr
  const target = Number(kit.answers.price);
  const priceHint = target
    ? (t.price <= target
      ? h('small', { class: 'is-good' }, `Passt: Der Endpreis-Vorschlag liegt bei ${eur(t.price)}.`)
      : h('small', { class: 'is-warn' }, `Der Endpreis-Vorschlag (${eur(t.price)}) liegt ${eur(t.price - target)} über dem Ziel – Spar-Vorschläge nutzen oder den Aufschlag-Faktor senken.`))
    : null;
  const more = MORE_QUESTIONS.map((q) => field(q.name,
    h('select', { 'data-answer': q.id, 'aria-label': q.name, onchange: (e) => change((k) => { if (e.target.value) k.answers[q.id] = e.target.value; else delete k.answers[q.id]; }) },
      h('option', { value: '', selected: !kit.answers[q.id] }, 'Offen'),
      ...q.options.map(([v, l]) => h('option', { value: v, selected: v === kit.answers[q.id] }, l))),
    q.id === 'price' ? priceHint : null));
  const note = h('label', { class: 'field ck-survey-note' }, h('span', {}, 'Was noch? (Wünsche, Bedenken, Ideen)'),
    h('textarea', { rows: '2', maxlength: '500', 'data-answer': 'note', placeholder: 'z. B. „Tasten sollen leise sein“ oder „Kabel nach hinten führen“',
      onchange: (e) => change((k) => { const v = e.target.value.trim(); if (v) k.answers.note = v.slice(0, 500); else delete k.answers.note; }) }, kit.answers.note ?? ''));

  const answered = MORE_QUESTIONS.filter((q) => kit.answers[q.id]).length;
  const group = (title, items) => h('fieldset', { class: 'ck-scope-group' }, h('legend', {}, title), h('ul', {}, ...items));
  return h('section', { class: 'dash-card dash-card--wide ck-card ck-survey' },
    h('header', { class: 'cs-head' }, h('div', {},
      h('h2', {}, 'Abfrage: Anschlüsse, Design und mehr'),
      h('p', { class: 'dash-status' }, `${PORTS.filter((p) => !p.when || p.when(kit)).length} Anschlüsse · ${answered} von ${MORE_QUESTIONS.length} Fragen beantwortet · Änderungen am Aussehen zeigt die 3D-Ansicht sofort`))),
    h('div', { class: 'ck-scope-groups' },
      group('Anschlüsse: was bleibt?', ports),
      group('Design', design),
      group('Verpackung (zeigt die 3D-Verpackung)', pack),
      group('Mehr', more)),
    note);
}
