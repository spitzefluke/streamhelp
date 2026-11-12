// Console (Entwurf) – Bedienungsanleitung für Käufer (admin.html → Console → Reiter „Anleitung“).
// Entsteht aus Baukasten (Bauteile, Anschlüsse, Rückseite, Verpackung) und Tastenbelegung als eigenständiges
// HTML-Dokument (ohne Skripte, nur eingebettetes CSS): Vorschau, Ansehen/Drucken (→ PDF) und Herunterladen.
// Herstellerangaben (Pflicht nach Produktsicherheitsverordnung) trägt das Team hier ein; sie liegen in kit.manual.
// Alle Texte aus Eingaben werden maskiert.
import { h } from './extras-core.js';
import { kitBoxSpec, kitPorts, kitTotals, option } from './dash-console-kit.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const list = (items) => `<ul>${items.filter(Boolean).map((i) => `<li>${i}</li>`).join('')}</ul>`;
const steps = (items) => `<ol>${items.filter(Boolean).map((i) => `<li>${i}</li>`).join('')}</ol>`;
const ACTION_TEXT = {
  none: 'frei', scene: 'wechselt die Szene', spin: 'dreht das Glücksrad', sound: 'spielt einen Sound',
  alert: 'schickt einen Test-Alert', guard: 'schaltet den Raid-Schutz an/aus', page: 'öffnet einen Bereich im Dashboard',
};
const SIDE = { left: 'links', back: 'hinten', front: 'vorn' };
const PORT_TEXT = {
  usbc: 'USB-C – zum PC (Strom und Daten)', usba: 'USB-A – für Zubehör', hdmi: 'HDMI',
  jack: '3,5-mm-Klinke', sd: 'microSD-Karte', dc: 'Netzteil-Buchse (12 V)', mains: 'Netzkabel (230 V)', power: 'Ein/Aus-Taste', led: 'Status-Licht',
};
export const MANUAL_FIELDS = [
  ['name', 'Produktname', 'StreamHelp Console', 60],
  ['maker', 'Hersteller (Name / Firma)', '', 120],
  ['address', 'Anschrift des Herstellers', '', 200],
  ['email', 'Support-E-Mail', '', 120],
  ['web', 'Webseite', 'streamhelp.de', 120],
];
const missing = (label) => `<mark>[${esc(label)} eintragen]</mark>`;

// ctx: { kit, keys }
export function buildManualHtml({ kit, keys }) {
  const m = kit.manual ?? {};
  const name = m.name || 'StreamHelp Console';
  const p = kit.parts;
  const capture = p.capture !== 'none';
  const through = p.passthrough !== 'none';
  const headset = ['mix', 'mixer'].includes(p.audio);
  const t = kitTotals(kit);
  const box = kitBoxSpec(kit, keys);
  const ports = kitPorts(kit);
  const date = new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  const bulb = p.bulb === 'encoder' ? 'Drehregler' : 'Ideen-Knopf';

  const portRows = ports.filter((x) => x.kind !== 'led').map((x) => `<tr><td>${esc(x.label || PORT_TEXT[x.kind])}</td><td>${esc(PORT_TEXT[x.kind] ?? x.kind)}</td><td>${esc(SIDE[x.side] ?? '')}</td></tr>`).join('');
  const keyRows = Array.from({ length: 9 }, (_, i) => {
    const k = keys?.[i] ?? { action: 'none' };
    const row = Math.floor(i / 3) + 1;
    const col = (i % 3) + 1;
    return `<tr><td>${row}/${col}</td><td>${esc(k.icon ?? '')} ${esc(k.label || (k.action === 'none' ? '–' : ''))}</td><td>${esc(ACTION_TEXT[k.action] ?? k.action)}</td></tr>`;
  }).join('');

  const power = p.power === 'usbc' ? 'Die Console bekommt ihren Strom über das USB-C-Kabel vom PC – ein Netzteil brauchst du nicht.'
    : p.power === 'extpsu' ? 'Stecke das mitgelieferte Netzteil in die Buchse „DC 12 V“ und in die Steckdose.'
      : 'Verbinde die Console mit dem Netzkabel (Kaltgeräte-Buchse) mit der Steckdose.';
  const resolution = { c1080: '1920 × 1080 bei 60 Bildern/s', c4k30: 'bis 3840 × 2160 bei 30 Bildern/s, 2560 × 1440 bei 60 oder 1920 × 1080 bei 120', c4k60: 'bis 3840 × 2160 bei 60 Bildern/s mit HDR' }[p.capture];

  const safety = [
    'Nur in trockenen Innenräumen benutzen. Keine Flüssigkeiten in die Nähe stellen.',
    'Lüftungsschlitze frei lassen, nicht auf weiche Unterlagen (Bett, Sofa) stellen und nicht abdecken.',
    'Das Gehäuse nicht öffnen. Bei Schäden an Gehäuse oder Kabeln nicht mehr benutzen.',
    'Kabel so verlegen, dass niemand darüber stolpert. Beim Abziehen am Stecker ziehen, nicht am Kabel.',
    p.power === 'mains' && 'Netzspannung 230 V: Nur an eine ordnungsgemäß installierte Steckdose anschließen. Vor dem Reinigen den Netzstecker ziehen.',
    p.power === 'extpsu' && 'Nur das mitgelieferte Netzteil verwenden.',
    t.flags.has('radio') && 'Das Gerät sendet per WLAN/Bluetooth. Wo Funk verboten ist (z. B. in Kliniken, Flugzeugen), Funk ausschalten.',
    headset && 'Hohe Lautstärke über Kopfhörer kann das Gehör schädigen. Beginne leise und höre nicht lange laut.',
    'Kleinteile und Verpackung von kleinen Kindern fernhalten.',
  ];

  const connect = [
    capture && 'Verbinde die Spielkonsole (oder den zweiten PC/die Kamera) per HDMI-Kabel mit <b>HDMI IN</b> der Console.',
    through && 'Verbinde <b>HDMI OUT</b> der Console mit deinem Fernseher oder Monitor. Dort spielst du wie gewohnt – ohne Verzögerung.',
    `Verbinde die Console per USB-C-Kabel mit deinem PC${capture ? ' – am besten an einem blauen USB-3-Anschluss direkt am PC, nicht an einem Hub' : ''}.`,
    power,
    headset && `Optional: Kopfhörer an <b>${kit.design?.combojack ? 'Headset' : 'Kopfhörer'}</b>${kit.design?.combojack ? '' : ', Mikrofon bzw. Party-Chat (z. B. Handy) an <b>Mikro/Chat</b>'}.`,
    'Die Console startet von selbst. Das Display zeigt kurz das StreamHelp-Logo und dann die Startansicht.',
  ];

  const obs = capture ? steps([
    'OBS Studio öffnen.',
    `Unter <b>Quellen</b> auf <b>+</b> → <b>Videoaufnahmegerät</b> → Name z. B. „Konsole“ → als Gerät <b>${esc(name)}</b> wählen.`,
    `Auflösung: „Benutzerdefiniert“ und ${esc(resolution)}.`,
    p.audio === 'hdmi' || p.audio === 'mix' || p.audio === 'mixer'
      ? `Ton: In den Eigenschaften „Audioausgabemodus“ auf <b>Desktop-Audio ausgeben (WaveOut)</b> stellen oder eine eigene <b>Audioaufnahmegerät</b>-Quelle mit ${esc(name)} anlegen.` : null,
    p.audio === 'mixer' && 'Getrennte Spuren: Spielton, Party-Chat und Mikro erscheinen als eigene Audiogeräte – so regelst du sie in OBS einzeln.',
    'Die Overlays von StreamHelp liegen als eigene Browserquelle über dem Spielbild (streamhelp.de → OBS einrichten).',
  ]) : '<p>Diese Ausführung nimmt kein Bild auf: Sie ist ein reines Tastenpult für deinen Stream.</p>';

  const consoles = capture ? list([
    '<b>PS5 / PS4:</b> In den Einstellungen unter System → HDMI die Option <b>HDCP aktivieren</b> ausschalten. Sonst bleibt das Bild in OBS schwarz.',
    '<b>Xbox Series X|S, Switch, Steam Deck, PC:</b> funktionieren ohne Einstellung.',
    'Geschützte Inhalte (Filme, Streaming-Apps) lassen sich aus rechtlichen Gründen nicht aufnehmen.',
  ]) : '';

  const trouble = list([
    capture && '<b>Kein Bild in OBS:</b> Anderen USB-3-Anschluss direkt am PC probieren, HDCP an der PS5/PS4 ausschalten, Quelle in OBS einmal deaktivieren und wieder aktivieren.',
    capture && '<b>Bild ruckelt oder ist verzögert:</b> Zum Spielen immer den Fernseher an HDMI OUT benutzen, nicht die OBS-Vorschau.',
    capture && '<b>Kein Ton:</b> Audioausgabemodus der Quelle prüfen (siehe „In OBS einrichten“) und in der Konsole die Tonausgabe auf HDMI stellen.',
    '<b>Tasten reagieren nicht:</b> In StreamHelp angemeldet und der richtige Kanal gewählt? Das Display zeigt oben den verbundenen Kanal.',
    '<b>Display bleibt dunkel:</b> USB-Kabel und Stromversorgung prüfen, das Gerät 10 Sekunden vom Strom trennen.',
  ]);

  const tech = [
    ['Aufnahme', capture ? esc(option('capture', p.capture)?.name) : 'keine (nur Tastenpult)'],
    through && ['Durchschleifen', esc(option('passthrough', p.passthrough)?.name)],
    ['Ton', esc(option('audio', p.audio)?.name)],
    ['Tasten', `9 × ${esc(option('keys', p.keys)?.name)}`],
    ['Display', esc(option('display', p.display)?.name)],
    [bulb, esc(option('bulb', p.bulb)?.name)],
    ['Strom', esc(option('power', p.power)?.name)],
    t.flags.has('radio') && ['Funk', 'WLAN 2,4 GHz, Bluetooth'],
    ['Anschluss an den PC', capture ? 'USB-C (USB 3.2), treiberlos unter Windows, macOS und Linux' : 'USB-C'],
  ].filter(Boolean).map(([a, b]) => `<tr><th>${esc(a)}</th><td>${b}</td></tr>`).join('');

  const maker = [m.maker ? esc(m.maker) : missing('Hersteller'), m.address ? esc(m.address).replace(/\n/g, '<br>') : missing('Anschrift'), m.email ? esc(m.email) : missing('Support-E-Mail')].join('<br>');

  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bedienungsanleitung · ${esc(name)}</title>
<style>
  :root { --ink: #16171d; --muted: #5d6170; --line: #dfe1e8; --acc: #7c3aed; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #f4f4f7; color: var(--ink); font: 14px/1.55 Inter, system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 800px; margin: 24px auto; background: #fff; padding: 40px 48px; border-radius: 12px; box-shadow: 0 2px 20px rgba(0,0,0,.06); }
  header { border-bottom: 3px solid var(--acc); padding-bottom: 14px; }
  h1 { margin: 0; font-size: 28px; } h2 { font-size: 18px; margin: 30px 0 8px; color: var(--acc); }
  .meta, small { color: var(--muted); } .meta { margin: 6px 0 0; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0; } th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
  thead th { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
  tbody th { width: 34%; font-weight: 600; }
  ul, ol { margin: 6px 0; padding-left: 22px; } li { margin: 4px 0; }
  .warn { border-left: 4px solid #e0a100; background: #fff8e6; padding: 10px 14px; border-radius: 6px; }
  .keys { display: grid; grid-template-columns: repeat(3, 56px); gap: 6px; margin: 10px 0; }
  .keys span { display: grid; place-items: center; height: 56px; border-radius: 10px; border: 2px solid var(--c); font-size: 22px; background: color-mix(in srgb, var(--c) 12%, #fff); }
  mark { background: #ffe58a; padding: 0 3px; }
  .bin { display: flex; gap: 14px; align-items: center; }
  .bin svg { flex: none; }
  @media print { body { background: #fff; } main { box-shadow: none; margin: 0; padding: 0 8px; max-width: none; } h2 { break-after: avoid; } table, .warn { break-inside: avoid; } }
</style></head><body><main>
<header><h1>${esc(name)}</h1><p class="meta">Bedienungsanleitung · Stand ${esc(date)}</p></header>

<p>Danke, dass du dich für die ${esc(name)} entschieden hast! ${capture ? 'Sie nimmt das Bild deiner Spielkonsole für deinen Stream auf' : 'Sie steuert deinen Stream'} und bringt 9 Tasten, ein Display und einen ${esc(bulb)} für Content-Ideen mit. Bitte lies diese Anleitung vor dem ersten Benutzen und bewahre sie auf.</p>

<h2>1. Lieferumfang</h2>${list(box.contents.map(esc))}

<h2>2. Sicherheitshinweise</h2><div class="warn">${list(safety.filter(Boolean).map(esc))}</div>

<h2>3. Das Gerät im Überblick</h2>
<div class="keys">${box.keyColors.map((c, i) => `<span style="--c:${esc(c)}">${esc(keys?.[i]?.icon ?? '')}</span>`).join('')}</div>
<p><b>9 Tasten</b> lösen Aktionen in deinem Stream aus. <b>Display:</b> zeigt Szene, letzten Alert und dein Ziel. <b>${esc(bulb)}:</b> schlägt dir eine Content-Idee aus deiner Liste vor${p.bulb === 'encoder' ? ' (drehen blättert, drücken übernimmt)' : ''}.</p>
<table><thead><tr><th>Anschluss</th><th>Wofür</th><th>Seite</th></tr></thead><tbody>${portRows}</tbody></table>

<h2>4. Anschließen</h2>${steps(connect)}

<h2>5. In OBS einrichten</h2>${obs}${consoles}

<h2>6. Tasten ab Werk</h2>
<p>Die Belegung änderst du jederzeit in StreamHelp – Farben und Symbole übernimmt die Console sofort.</p>
<table><thead><tr><th>Reihe/Spalte</th><th>Taste</th><th>Was passiert</th></tr></thead><tbody>${keyRows}</tbody></table>

<h2>7. Hilfe bei Problemen</h2>${trouble}

<h2>8. Technische Daten</h2><table><tbody>${tech}</tbody></table>

<h2>9. Pflege, Entsorgung und Gewährleistung</h2>
${list([
    'Nur mit einem trockenen, weichen Tuch reinigen. Keine Reinigungsmittel.',
    'Es gilt die gesetzliche Gewährleistung von 2 Jahren. Bei Problemen melde dich beim Support (unten).',
  ])}
<div class="bin"><svg width="34" height="40" viewBox="0 0 34 40" aria-hidden="true"><g fill="none" stroke="#16171d" stroke-width="2"><path d="M7 10h20l-2 24H9z"/><path d="M4 10h26M13 6h8v4"/><path d="M3 4l28 32M31 4L3 36"/></g><rect x="3" y="37" width="28" height="3" fill="#16171d"/></svg>
<p>Elektrogeräte gehören nicht in den Hausmüll. Gib die Console am Ende kostenlos bei einer Sammelstelle (Wertstoffhof) oder beim Händler zurück. Lösche vorher deine Daten (Werkseinstellungen).</p></div>
<p>Die Konformität mit den geltenden EU-Richtlinien (EMV, RoHS${t.flags.has('radio') ? ', Funkanlagen' : ''}${p.power === 'mains' ? ', Niederspannung' : ''}) bestätigt die CE-Kennzeichnung auf dem Typenschild.</p>

<h2>10. Hersteller und Support</h2><p>${maker}${m.web ? `<br>${esc(m.web)}` : ''}</p>
</main></body></html>`;
}

const openBlob = (html, toast) => {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  const win = window.open(url, '_blank');
  if (!win) toast?.('Der Browser hat das neue Fenster blockiert – „Herunterladen“ geht immer.', 'info');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};
export function downloadText(text, file, type = 'text/html;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h('a', { href: url, download: file });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// Karte „Bedienungsanleitung“ – ctx: { kit, keys, onChange(kit), toast }
export function renderManualCard(ctx) {
  const { kit } = ctx;
  kit.manual ??= {};
  const preview = h('iframe', { class: 'ck-manual-frame', title: 'Vorschau der Bedienungsanleitung', sandbox: '' });
  const paint = () => { preview.srcdoc = buildManualHtml(ctx); };
  const fields = MANUAL_FIELDS.map(([id, label, ph, max]) => {
    const input = h(id === 'address' ? 'textarea' : 'input', { maxlength: String(max), placeholder: ph || label, rows: id === 'address' ? '2' : null });
    input.value = kit.manual[id] ?? '';
    input.addEventListener('input', () => { kit.manual[id] = input.value.trim(); paint(); });
    input.addEventListener('change', () => ctx.onChange(kit)); // speichern erst beim Verlassen – sonst zeichnet alles neu
    return h('label', { class: 'field' }, h('span', {}, label), input);
  });
  const open = Object.values({ maker: kit.manual.maker, address: kit.manual.address, email: kit.manual.email }).filter((v) => !v).length;
  const file = () => `bedienungsanleitung-${(kit.manual.name || 'streamhelp-console').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.html`;
  const card = h('section', { class: 'dash-card dash-card--wide ck-card ck-manual' },
    h('header', { class: 'cs-head' },
      h('div', {},
        h('h2', {}, 'Bedienungsanleitung'),
        h('p', { class: 'dash-status' }, 'Für Käufer: Lieferumfang, Sicherheit, Anschließen, OBS, Tasten, Hilfe, technische Daten und Entsorgung – entsteht aus Baukasten und Belegung.')),
      h('div', { class: 'cs-head-btns' },
        h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: () => openBlob(buildManualHtml(ctx), ctx.toast) }, 'Ansehen / drucken'),
        h('button', { class: 'btn btn--primary btn--sm', type: 'button', onclick: () => downloadText(buildManualHtml(ctx), file()) }, 'Herunterladen (.html)'))),
    h('div', { class: 'ck-inputs' }, ...fields),
    open ? h('p', { class: 'ck-note is-warn' }, `Pflichtangaben fehlen noch (${open}): Hersteller, Anschrift und Kontakt müssen in der Anleitung und auf dem Gerät stehen (Produktsicherheitsverordnung). In der Vorschau gelb markiert.`) : null,
    preview,
    h('p', { class: 'form-hint' }, 'Als PDF: „Ansehen / drucken“ und im Druckfenster „Als PDF speichern“. Texte sind ein Entwurf ohne Gewähr – vor dem Verkauf prüfen lassen.'));
  paint();
  return card;
}
