// Console (Entwurf) – Lastenheft (nur Plattform-Admins, js/dash-console.js).
// Fasst Baukasten, Abfragen, Vorschläge, Kosten und Pflichten zu einem eigenständigen HTML-Dokument zusammen
// (ohne Skripte, nur eingebettetes CSS) – zum Ansehen/Drucken in einem neuen Tab oder zum Herunterladen,
// z. B. für Angebote bei Herstellern. Alle Texte aus Eingaben werden maskiert.
import { h } from './extras-core.js';
import {
  DESIGN, FEATURES, KIT_PARTS, MORE_QUESTIONS, PACK, PACK_DEFAULT, REAR, RELEASE_CHECKS,
  eur, kitBoxSpec, kitPorts, kitTotals, option, packOpt, rearOpt,
} from './dash-console-kit.js';
import { TIPS } from './dash-console-tips.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ACTION_NAMES = { none: 'frei', scene: 'Szene wechseln', spin: 'Glücksrad drehen', sound: 'Sound abspielen', alert: 'Test-Alert', guard: 'Raid-Schutz an/aus', page: 'Dashboard-Seite öffnen' };
const FEATURE_NAMES = { v1: 'Version 1', later: 'Später', no: 'Nicht geplant', open: 'Offen' };
const SIDE_NAMES = { left: 'links', back: 'hinten', front: 'vorn' };

const table = (head, rows) => `<table><thead><tr>${head.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${
  rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
const list = (items) => (items.length ? `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>` : '<p class="muted">–</p>');

// ctx: { kit, keys, by, at }
export function buildSpecHtml({ kit, keys, by, at }) {
  const t = kitTotals(kit);
  const box = kitBoxSpec(kit, keys);
  const date = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
  const answer = (q) => q.options.find(([v]) => v === kit.answers[q.id])?.[1];
  const open = [];

  // 1. Produkt
  const product = list([
    '<b>Capture Card mit Tastenpult</b>: nimmt Bild und Ton per HDMI auf (USB zum PC) und steuert den Stream mit 9 Tasten, Display und Ideen-Knopf.',
    ...MORE_QUESTIONS.map((q) => {
      const a = answer(q);
      if (!a) open.push(`Frage offen: ${esc(q.name)}`);
      return `${esc(q.name)} <b>${esc(a ?? 'offen')}</b>`;
    }),
    ...(kit.answers.note ? [`Notiz: ${esc(kit.answers.note)}`] : []),
  ]);

  // 2. Funktionsumfang
  const featRows = FEATURES.flatMap((g) => g.items.map((f) => {
    const st = kit.features[f.id] ?? 'open';
    if (st === 'open') open.push(`Funktion nicht entschieden: ${esc(f.name)}`);
    return [esc(g.group), esc(f.name) + (f.note ? `<br><small>${esc(f.note)}</small>` : ''), `<span class="st st-${st}">${FEATURE_NAMES[st]}</span>`];
  }));

  // 3. Bauteile
  const partRows = KIT_PARTS.map((cat) => {
    const o = option(cat.id, kit.parts[cat.id]);
    const price = kit.prices[`${cat.id}.${o.id}`] ?? o.eur;
    return [esc(cat.name), esc(o.name), eur(price), o.tool ? eur(o.tool) : '–'];
  });
  const extraRows = [
    ...DESIGN.map((d) => { const o = d.options.find((x) => x.id === kit.design[d.id]); return o?.eur ? [`Design: ${esc(d.name)}`, esc(o.name), eur(o.eur), '–'] : null; }),
    ...REAR.map((q) => { const o = rearOpt(q.id, kit.rear[q.id]); return o?.eur ? [`Rückseite: ${esc(q.name)}`, esc(o.name), eur(o.eur), '–'] : null; }),
    ...PACK.map((q) => { const o = packOpt(q.id, kit.pack[q.id] ?? PACK_DEFAULT[q.id]); return o?.eur ? [`Verpackung: ${esc(q.name)}`, esc(o.name), eur(o.eur), '–'] : null; }),
  ].filter(Boolean);
  if (kit.design.combojack) extraRows.push(['Anschlüsse', 'Eine Headset-Buchse statt zwei Klinken', eur(-0.4), '–']);

  // 4. Anschlüsse und Rückseite
  const ports = kitPorts(kit).map((p) => `${esc(p.label || (p.kind === 'power' ? 'Ein-/Aus-Taste' : 'Status-LED'))}${p.recessed ? ' (versenkt)' : ''} – ${SIDE_NAMES[p.side ?? 'left']}`);
  const rear = REAR.map((q) => {
    const o = rearOpt(q.id, kit.rear[q.id]);
    if (!o) open.push(`Rückseite offen: ${esc(q.name)}`);
    return `${esc(q.name)}: <b>${esc(o?.name ?? 'offen (wie im Entwurf)')}</b>`;
  });

  // 5. Design, Tasten, Verpackung
  const design = DESIGN.map((d) => `${esc(d.name)}: <b>${esc(d.options.find((x) => x.id === kit.design[d.id])?.name ?? '–')}</b>`);
  const keyRows = (keys ?? []).map((k, i) => [String(i + 1), esc(`${k.icon ?? ''} ${k.label ?? ''}`.trim() || '–'), esc(ACTION_NAMES[k.action] ?? k.action), k.color ? `<span class="sw" style="background:${/^#[0-9a-f]{6}$/i.test(k.color) ? k.color : '#888'}"></span> ${esc(k.color)}` : '–']);
  const pack = [
    `Karton: <b>${esc(option('box', kit.parts.box)?.name)}</b>`,
    ...PACK.map((q) => `${esc(q.name)}: <b>${esc(packOpt(q.id, kit.pack[q.id] ?? PACK_DEFAULT[q.id])?.name)}</b>`),
    `Inhalt: ${esc(box.contents.join(', '))}`,
  ];

  // 6. Vorschläge
  const tipLine = (tp) => `${esc(tp.title)}${tp.est ? ` <small>(${tp.est > 0 ? 'spart' : 'kostet'} ca. ${eur(Math.abs(tp.est))} je Gerät${tp.est > 0 ? '' : ' mehr'})</small>` : ''}`;
  const taken = TIPS.filter((tp) => kit.tips[tp.id] === 'yes').map(tipLine);
  const check = TIPS.filter((tp) => kit.tips[tp.id] === 'check').map(tipLine);
  for (const c of check) open.push(`Vorschlag prüfen: ${c}`);

  // 7. Release-Check
  const rel = RELEASE_CHECKS.map(([id, text]) => `${kit.checks[id] ? '☑' : '☐'} ${esc(text)}`);
  for (const [id, text] of RELEASE_CHECKS) if (!kit.checks[id]) open.push(`Release-Check: ${esc(text)}`);
  const ideas = kit.ideas.filter((i) => i.status === 'planned' || i.status === 'new')
    .map((i) => `${esc(i.text)} <small>(${i.status === 'planned' ? 'geplant' : 'neu'}${i.by ? `, ${esc(i.by)}` : ''})</small>`);

  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Lastenheft StreamHelp Console – ${esc(date)}</title>
<style>
  :root { --ink: #16171d; --muted: #5d6170; --line: #dfe1e8; --acc: #7c3aed; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #f4f4f7; color: var(--ink); font: 14px/1.5 Inter, system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 860px; margin: 24px auto; background: #fff; padding: 40px 48px; border-radius: 12px; box-shadow: 0 2px 20px rgba(0,0,0,.06); }
  header { border-bottom: 3px solid var(--acc); padding-bottom: 14px; margin-bottom: 8px; }
  h1 { margin: 0; font-size: 26px; } h2 { font-size: 17px; margin: 28px 0 8px; color: var(--acc); }
  .meta, .muted, small { color: var(--muted); } .meta { margin: 6px 0 0; }
  .conf { display: inline-block; margin-top: 8px; padding: 2px 10px; border: 1px solid var(--acc); color: var(--acc); border-radius: 999px; font-size: 12px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0; } th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
  th { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
  ul { margin: 6px 0; padding-left: 20px; } li { margin: 3px 0; }
  .sum { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 8px; }
  .sum div { border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; } .sum b { display: block; font-size: 16px; }
  .st { font-size: 12px; padding: 1px 8px; border-radius: 999px; background: #eee; white-space: nowrap; } .st-v1 { background: #ede4ff; color: #5b21b6; } .st-open { background: #fff4d6; color: #8a5a00; }
  .sw { display: inline-block; width: 12px; height: 12px; border-radius: 3px; vertical-align: -1px; border: 1px solid rgba(0,0,0,.15); }
  .note { margin-top: 28px; font-size: 12px; color: var(--muted); border-top: 1px solid var(--line); padding-top: 10px; }
  @media print { body { background: #fff; } main { margin: 0; box-shadow: none; padding: 0; max-width: none; } h2 { break-after: avoid; } tr { break-inside: avoid; } }
</style></head>
<body><main>
<header>
  <h1>Lastenheft: StreamHelp Console</h1>
  <p class="meta">Stand ${esc(date)}${at ? ` · zuletzt geändert ${esc(new Date(at).toLocaleString('de-DE'))}${by ? ` von ${esc(by)}` : ''}` : ''}</p>
  <span class="conf">Vertraulich – Entwurf</span>
</header>

<h2>1. Produkt</h2>${product}

<h2>2. Funktionsumfang</h2>${table(['Bereich', 'Funktion', 'Entscheidung'], featRows)}

<h2>3. Bauteile (Schätzpreise je Stück)</h2>${table(['Bereich', 'Auswahl', 'Preis je Stück', 'Einmalig'], [...partRows, ...extraRows])}

<h2>4. Anschlüsse und Rückseite</h2>${list(ports)}${list(rear)}

<h2>5. Design und Tastenbelegung</h2>${list(design)}${table(['Taste', 'Beschriftung', 'Aktion', 'Farbe'], keyRows)}

<h2>6. Verpackung</h2>${list(pack)}

<h2>7. Menge, Kosten und Preis</h2>
<div class="sum">
  <div>Erste Serie<b>${esc(kit.qty)} Stück</b></div>
  <div>Bauteile je Gerät<b>${eur(t.unit)}</b></div>
  <div>Prüfungen (einmalig, Schätzung)<b>${eur(t.tests)}</b></div>
  <div>Werkzeug (einmalig)<b>${eur(t.tool)}</b></div>
  <div>Kosten je Gerät<b>${eur(t.perDevice)}</b></div>
  <div>Endpreis-Vorschlag (× ${esc(String(kit.factor).replace('.', ','))}, inkl. 19 % USt)<b>${eur(t.price)}</b></div>
</div>

<h2>8. Normen und Pflichten für den Verkauf</h2>${list(t.duties.map((d) => esc(d.text)))}

<h2>9. Vorschläge</h2>
<p><b>Übernommen</b></p>${list(taken)}
<p><b>Später prüfen</b></p>${list(check)}

<h2>10. Release-Check</h2>${list(rel)}

<h2>11. Ideen (neu und geplant)</h2>${list(ideas)}

<h2>12. Offene Punkte</h2>${list(open)}

<p class="note">Alle Preise sind Schätzwerte zum Start und ersetzen keine Angebote. Die Pflichten sind ein Überblick ohne Gewähr und keine Rechtsberatung.
Erstellt mit dem Technik-Baukasten von StreamHelp.</p>
</main></body></html>`;
}

// Karte im Baukasten: ansehen (neuer Tab, dort drucken oder als PDF speichern) oder herunterladen
export function renderSpecCard(ctx) {
  const make = () => new Blob([buildSpecHtml(ctx)], { type: 'text/html;charset=utf-8' });
  const file = `lastenheft-streamhelp-console-${new Date().toISOString().slice(0, 10)}.html`;
  const open = () => {
    const url = URL.createObjectURL(make());
    const win = window.open(url, '_blank'); // ohne „noopener“: sonst liefert open() immer null
    if (!win) ctx.toast?.('Der Browser hat das neue Fenster blockiert – „Herunterladen“ geht immer.', 'info');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };
  const download = () => {
    const url = URL.createObjectURL(make());
    const a = h('a', { href: url, download: file });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };
  return h('section', { class: 'dash-card dash-card--wide ck-card ck-spec' },
    h('header', { class: 'cs-head' },
      h('div', {},
        h('h2', {}, 'Lastenheft'),
        h('p', { class: 'dash-status' }, 'Alles aus Baukasten, Abfragen und Vorschlägen in einem Dokument – für Angebote bei Herstellern und Platinen-Fertigern.')),
      h('div', { class: 'cs-head-btns' },
        h('button', { class: 'btn btn--ghost btn--sm', type: 'button', id: 'ck-spec-open', onclick: open }, 'Ansehen / drucken'),
        h('button', { class: 'btn btn--primary btn--sm', type: 'button', id: 'ck-spec-download', onclick: download }, 'Herunterladen (.html)'))),
    h('p', { class: 'form-hint' }, 'Enthält Funktionsumfang, Bauteile mit Schätzpreisen, Anschlüsse, Rückseite, Design, Tastenbelegung, Verpackung, Kosten, Pflichten, Release-Check und alle offenen Punkte. Als PDF: im neuen Tab drucken und „Als PDF speichern“ wählen. Vertraulich – nicht öffentlich teilen.'));
}
