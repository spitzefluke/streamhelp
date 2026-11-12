// Console (Entwurf) – Abfrage „Rückseite“ mit Vorschlägen (nur Plattform-Admins, js/dash-console.js).
// Ausgangslage im Modell: Ein-Taste, Status-LED (Lichtleiter), 2× USB-A, 2× HDMI. Jede Frage hat einen Vorschlag
// mit Begründung; die Antworten (kit.rear) ändern Kosten und die Rückseite in der 3D-Ansicht.
import { h } from './extras-core.js';
import { REAR, eur, kitTotals, rearOpt } from './dash-console-kit.js';

const signed = (n) => `${n > 0 ? '+' : '−'}${eur(Math.abs(n))}`;

// ctx: { kit, onChange(kit), onShow() – Rückseite in 3D zeigen }
export function renderRear(ctx) {
  const { kit } = ctx;
  const change = (fn) => { fn(kit); ctx.onChange(kit); };
  const answered = REAR.filter((q) => kit.rear[q.id]).length;
  const followed = REAR.filter((q) => kit.rear[q.id] === q.rec).length;
  const extra = REAR.reduce((sum, q) => sum + (rearOpt(q.id, kit.rear[q.id])?.eur ?? 0), 0);
  const withRecs = structuredClone(kit);
  for (const q of REAR) withRecs.rear[q.id] = q.rec;
  const recDelta = kitTotals(withRecs).perDevice - kitTotals(kit).perDevice;

  const rows = REAR.map((q) => {
    const cur = kit.rear[q.id] ?? '';
    const rec = rearOpt(q.id, q.rec);
    return h('li', { class: cur === q.rec ? 'is-rec' : '' },
      h('div', { class: 'ck-scope-text' },
        h('span', {}, q.name),
        cur === q.rec
          ? h('small', { class: 'is-good' }, `✓ Vorschlag gewählt – ${q.why}`)
          : h('small', {}, h('b', {}, `Vorschlag: ${rec.name}. `), q.why)),
      h('select', { 'data-rear': q.id, 'aria-label': q.name, onchange: (e) => change((k) => { if (e.target.value) k.rear[q.id] = e.target.value; else delete k.rear[q.id]; }) },
        h('option', { value: '', selected: !cur }, 'Offen (wie im Entwurf)'),
        ...q.options.map((o) => h('option', { value: o.id, selected: o.id === cur },
          `${o.name}${o.eur ? ` (${signed(o.eur)})` : ''}${o.id === q.rec ? ' – Vorschlag' : ''}`))));
  });

  return h('section', { class: 'dash-card dash-card--wide ck-card ck-rear' },
    h('header', { class: 'cs-head' },
      h('div', {},
        h('h2', {}, 'Abfrage: Rückseite'),
        h('p', { class: 'dash-status' }, `${answered} von ${REAR.length} beantwortet · ${followed} Vorschläge übernommen · Rückseite ${extra ? signed(extra) : '±0 €'} je Gerät`)),
      h('div', { class: 'cs-head-btns' },
        h('button', { class: 'btn btn--ghost btn--sm', type: 'button', id: 'ck-rear-show', onclick: () => ctx.onShow() }, 'In 3D zeigen'),
        answered ? h('button', { class: 'btn btn--ghost btn--sm', type: 'button', id: 'ck-rear-reset', onclick: () => change((k) => { k.rear = {}; }) }, 'Wie im Entwurf') : null,
        followed < REAR.length
          ? h('button', { class: 'btn btn--primary btn--sm', type: 'button', id: 'ck-rear-all', onclick: () => change((k) => { for (const q of REAR) k.rear[q.id] = q.rec; }) },
            `Alle Vorschläge übernehmen (${Math.abs(recDelta) >= 0.005 ? signed(recDelta) : '±0 €'})`)
          : null)),
    h('p', { class: 'form-hint' }, 'Im Entwurf: Ein-Taste, Status-LED (Lichtleiter), 2× USB-A und 2× HDMI. Sobald eine Frage beantwortet ist, zeigt die 3D-Ansicht deine Rückseite statt der aus dem Modell.'),
    h('ul', { class: 'ck-rear-list ck-scope-group' }, ...rows));
}
