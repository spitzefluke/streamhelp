// Console (Entwurf) – Werbungs-Builder (admin.html → Console → Reiter „Werbung“).
// Aus Baukasten, Preis und Tastenbelegung entstehen: Shop-Text, Social-Media-Posts, Twitch-Panel und Chat-Werbung
// (jeweils zum Kopieren) sowie Werbegrafiken in Social-Formaten (Canvas → PNG). Einstellungen liegen in kit.ads.
import { h } from './extras-core.js';
import { kitBoxSpec, kitTotals, option } from './dash-console-kit.js';
import { downloadText } from './dash-console-manual.js';

export const AD_FIELDS = [
  ['name', 'Produktname', 'StreamHelp Console', 60],
  ['slogan', 'Slogan', 'Dein Stream auf Knopfdruck.', 80],
  ['price', 'Preis in € (leer = aus dem Baukasten)', '', 10],
  ['link', 'Link', 'streamhelp.de/pad.html', 120],
  ['code', 'Rabattcode (optional)', '', 24],
];
const TONES = [['casual', 'Locker (du)'], ['plain', 'Sachlich']];
const FORMATS = [
  ['square', 'Feed 1:1', 1080, 1080],
  ['story', 'Story / Reel 9:16', 1080, 1920],
  ['wide', 'Querformat 16:9', 1920, 1080],
  ['panel', 'Twitch-Panel', 640, 320],
];
const ui = { format: 'square' }; // bleibt beim Neuzeichnen des Baukastens erhalten

const euro = (n) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);

// Was die gewählte Ausführung kann – kurz und werbetauglich, nur was die Bauteile hergeben
export function adFacts(kit) {
  const p = kit.parts;
  const capture = { c1080: 'Aufnahme in 1080p60', c4k30: 'Aufnahme bis 4K · 1440p60 · 1080p120', c4k60: 'Aufnahme in 4K60 HDR' }[p.capture];
  const through = { p4k60: 'Ohne Verzögerung zocken: 4K60 HDR zum TV', p4k120: '4K120 mit VRR zum TV durchgeschleift' }[p.passthrough];
  const audio = { mix: 'Kopfhörer und Party-Chat direkt anschließen', mixer: 'Mixer mit 2 Reglern und getrennten Tonspuren', hdmi: p.capture !== 'none' ? 'Spielton über HDMI mit drin' : null }[p.audio];
  const keys = `9 frei belegbare Tasten${p.keys === 'mech' ? ' mit RGB-Licht' : p.keys === 'lcdkeys' ? ' mit Mini-Display' : ''}`;
  const facts = [capture, through, keys, 'Display mit Live-Anzeige: Alerts, Ziele, Szene', p.bulb === 'encoder' ? 'Ideen-Drehregler für Content-Ideen' : 'Ideen-Knopf für Content-Ideen', audio,
    p.capture !== 'none' ? 'Treiberlos an Windows, macOS und Linux' : 'Einfach per USB-C an den PC'].filter(Boolean);
  return { facts, capture: p.capture !== 'none', kind: p.capture !== 'none' ? 'Capture Card mit Tastenpult' : 'Tastenpult für deinen Stream' };
}

export function adSettings(kit) {
  const a = kit.ads ?? {};
  const t = kitTotals(kit);
  const price = Number(String(a.price ?? '').replace(',', '.'));
  return {
    name: a.name || 'StreamHelp Console',
    slogan: a.slogan || 'Dein Stream auf Knopfdruck.',
    price: Number.isFinite(price) && price > 0 ? price : t.price,
    link: a.link || 'streamhelp.de/pad.html',
    code: a.code || '',
    tone: TONES.some(([v]) => v === a.tone) ? a.tone : 'casual',
  };
}

// Alle Texte – reine Funktion, damit sie sich testen lässt
export function adTexts(kit, keys) {
  const s = adSettings(kit);
  const { facts, kind } = adFacts(kit);
  const box = kitBoxSpec(kit, keys);
  const du = s.tone === 'casual';
  const price = `${euro(s.price)} inkl. MwSt.`;
  const code = s.code ? (du ? ` Mit dem Code ${s.code} sparst du beim Start.` : ` Rabattcode: ${s.code}.`) : '';
  const top3 = facts.slice(0, 3);
  const keyNames = (keys ?? []).filter((k) => k.action !== 'none' && k.label).slice(0, 4).map((k) => `${k.icon ?? ''} ${k.label}`.trim());
  const tech = [
    ['Aufnahme', kit.parts.capture !== 'none' ? option('capture', kit.parts.capture)?.name : 'keine (nur Tastenpult)'],
    kit.parts.passthrough !== 'none' && ['Durchschleifen', option('passthrough', kit.parts.passthrough)?.name],
    ['Ton', option('audio', kit.parts.audio)?.name],
    ['Tasten', `9 × ${option('keys', kit.parts.keys)?.name}`],
    ['Display', option('display', kit.parts.display)?.name],
    ['Strom', option('power', kit.parts.power)?.name],
  ].filter(Boolean);

  const shop = [
    `${s.name} – ${kind}`,
    '',
    s.slogan,
    du
      ? `Die ${s.name} ${kit.parts.capture !== 'none' ? 'holt das Bild deiner Konsole in OBS und gibt dir' : 'gibt dir'} 9 Tasten, ein Display und einen Ideen-Knopf direkt neben die Maus. Szene wechseln, Glücksrad drehen, Sound abspielen – ein Druck, fertig.`
      : `Die ${s.name} ist eine ${kind}. ${kit.parts.capture !== 'none' ? 'Sie nimmt das Bild der Spielkonsole per HDMI auf und bietet' : 'Sie bietet'} 9 frei belegbare Tasten, ein Display und einen Ideen-Knopf zur Steuerung des Streams mit StreamHelp.`,
    '',
    'Das kann sie:',
    ...facts.map((f) => `• ${f}`),
    '',
    `Im Karton: ${box.contents.join(', ')}`,
    '',
    'Technische Daten:',
    ...tech.map(([a, b]) => `• ${a}: ${b}`),
    '',
    `Preis: ${price}${code}`,
  ].join('\n');

  const tags = '#StreamHelp #Twitch #Streaming #Streamer #CaptureCard #OBS';
  const posts = [
    ['Instagram', [
      du ? `🎛️ ${s.slogan}` : `🎛️ ${s.name}: ${s.slogan}`,
      '',
      `Die ${s.name} – ${kind}.`,
      ...top3.map((f) => `✅ ${f}`),
      '',
      `💜 ${price}${code}`,
      `👉 Link in der Bio · ${s.link}`,
      '',
      tags,
    ].join('\n')],
    ['TikTok', `${du ? 'POV: Du wechselst die Szene mit einem Knopf 🎛️' : `${s.name} im Test 🎛️`} ${top3[0] ?? ''} · ${s.slogan} ${euro(s.price)} 👉 ${s.link} #StreamHelp #Twitch #Streamer #StreamingSetup`],
    ['X / Bluesky', clip(`🎛️ ${s.name}: ${s.slogan} ${top3.slice(0, 2).join(' · ')}. ${euro(s.price)}.${s.code ? ` Code: ${s.code}` : ''} ${s.link} #Twitch #StreamHelp`, 280)],
    ['Discord', [
      `## 🎛️ ${s.name} ist da!`,
      s.slogan,
      '',
      ...facts.slice(0, 5).map((f) => `- ${f}`),
      '',
      `**${price}**${code}`,
      `<https://${s.link.replace(/^https?:\/\//, '')}>`,
    ].join('\n')],
    ['YouTube-Beschreibung', [
      `${s.name} – ${kind}. ${s.slogan}`,
      '',
      ...facts.map((f) => `▸ ${f}`),
      '',
      `Preis: ${price}${code}`,
      `Mehr: https://${s.link.replace(/^https?:\/\//, '')}`,
    ].join('\n')],
  ];

  const twitch = [
    ['Panel-Titel', clip(`🎛️ ${s.name}`, 40)],
    ['Panel-Text', [
      du ? `Ich streame mit der ${s.name}:` : `Dieser Stream nutzt die ${s.name}:`,
      ...top3.map((f) => `• ${f}`),
      keyNames.length ? `Meine Tasten: ${keyNames.join(', ')}` : '',
      '',
      `${euro(s.price)} · ${s.link}${s.code ? ` · Code ${s.code}` : ''}`,
    ].filter((x) => x !== '').join('\n')],
    ['Chat-Nachricht (Bot)', clip(`🎛️ Ihr fragt, womit ich Szenen, Sounds und das Glücksrad auslöse? Mit der ${s.name}! ${top3.slice(0, 2).join(' · ')}. ${euro(s.price)} → ${s.link}${s.code ? ` (Code ${s.code})` : ''}`, 500)],
    ['Befehl !console', clip(`${s.name}: ${s.slogan} ${euro(s.price)} → ${s.link}${s.code ? ` · Code ${s.code}` : ''}`, 400)],
  ];
  return { shop, posts, twitch, settings: s, facts };
}
function clip(text, max) {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).replace(/\s+\S*$/, '')}…`;
}

// ---------- Grafik ----------
function wrap(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(ctx, x, y, w, hgt, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + hgt, r);
  ctx.arcTo(x + w, y + hgt, x, y + hgt, r);
  ctx.arcTo(x, y + hgt, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Die Console als Grafik: 3 × 3 Tasten in den Farben der Belegung, Display rechts, Ideen-Knopf
function drawDevice(ctx, x, y, size, keys) {
  ctx.save(); // Ausrichtung, Schatten usw. gelten nur hier
  const w = size;
  const hgt = size * 0.62;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.55)';
  ctx.shadowBlur = size * 0.08;
  ctx.shadowOffsetY = size * 0.03;
  roundRect(ctx, x, y, w, hgt, size * 0.06);
  const body = ctx.createLinearGradient(0, y, 0, y + hgt);
  body.addColorStop(0, '#2e3039');
  body.addColorStop(1, '#17181d');
  ctx.fillStyle = body;
  ctx.fill();
  ctx.restore();
  const pad = size * 0.05;
  const key = (hgt - pad * 2 - size * 0.04) / 3;
  const gap = size * 0.02;
  for (let i = 0; i < 9; i++) {
    const k = keys?.[i] ?? {};
    const c = (k.action && k.action !== 'none' && k.color) || '#8e8e9a';
    const kx = x + pad + (i % 3) * (key + gap);
    const ky = y + pad + Math.floor(i / 3) * (key + gap);
    roundRect(ctx, kx, ky, key, key, key * 0.16);
    ctx.fillStyle = `${c}44`;
    ctx.fill();
    ctx.lineWidth = Math.max(2, key * 0.06);
    ctx.strokeStyle = c;
    ctx.stroke();
    if (k.icon) {
      ctx.font = `${Math.round(key * 0.42)}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.fillText(k.icon, kx + key / 2, ky + key / 2 + key * 0.03);
    }
  }
  const bx = x + pad + 3 * key + 2 * gap + size * 0.07;
  ctx.beginPath();
  ctx.arc(bx, y + hgt / 2, size * 0.045, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd36b';
  ctx.shadowColor = '#ffd36b';
  ctx.shadowBlur = size * 0.04;
  ctx.fill();
  ctx.shadowBlur = 0;
  const dx = bx + size * 0.08;
  const dw = x + w - pad - dx;
  roundRect(ctx, dx, y + pad, dw, hgt - pad * 2, size * 0.02);
  const scr = ctx.createLinearGradient(dx, 0, dx + dw, 0);
  scr.addColorStop(0, '#1a1036');
  scr.addColorStop(1, '#0b0714');
  ctx.fillStyle = scr;
  ctx.fill();
  ctx.fillStyle = 'rgba(169,112,255,.85)';
  for (let r = 0; r < 3; r++) {
    roundRect(ctx, dx + dw * 0.08, y + pad + (hgt - pad * 2) * (0.16 + r * 0.26), dw * (r === 2 ? 0.5 : 0.84), (hgt - pad * 2) * 0.14, 4);
    ctx.globalAlpha = r === 0 ? 1 : 0.45;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

export function drawAd(canvas, kit, keys, format) {
  const [, , W, H] = FORMATS.find(([id]) => id === format) ?? FORMATS[0];
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const { settings: s, facts } = adTexts(kit, keys);
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#1b0f36');
  bg.addColorStop(0.55, '#0b0714');
  bg.addColorStop(1, '#2a0b2c');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.8, H * 0.15, 0, W * 0.8, H * 0.15, Math.max(W, H) * 0.6);
  glow.addColorStop(0, 'rgba(145,70,255,.45)');
  glow.addColorStop(1, 'rgba(145,70,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const unit = Math.min(W, H) / 1080;
  const m = 72 * unit;
  const display = '"Barlow Condensed", "Arial Narrow", sans-serif';
  const body = 'Barlow, Inter, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  if (format === 'panel') {
    // Links ist nur Platz bis zum Gerät: Schrift so weit verkleinern, dass alles passt
    const room = W * 0.54;
    const fit = (text, weight, family, size) => {
      let px = size;
      ctx.font = `${weight} ${px}px ${family}`;
      while (px > 10 && ctx.measureText(text).width > room) { px -= 1; ctx.font = `${weight} ${px}px ${family}`; }
    };
    ctx.fillStyle = '#fff';
    fit(s.name.toUpperCase(), 800, display, Math.round(H * 0.2));
    ctx.fillText(s.name.toUpperCase(), W * 0.06, H * 0.36);
    ctx.fillStyle = '#e0c8ff';
    fit(s.slogan, 600, body, Math.round(H * 0.1));
    ctx.fillText(s.slogan, W * 0.06, H * 0.56);
    ctx.fillStyle = '#ffd36b';
    ctx.font = `800 ${Math.round(H * 0.13)}px ${display}`;
    ctx.fillText(euro(s.price), W * 0.06, H * 0.84);
    drawDevice(ctx, W * 0.62, H * 0.22, W * 0.34, keys);
    return;
  }

  const wide = W > H;
  const textW = wide ? W * 0.5 : W - 2 * m;
  let y = m + 40 * unit;
  ctx.fillStyle = '#a970ff';
  ctx.font = `700 ${Math.round(30 * unit)}px ${body}`;
  ctx.fillText('NEU VON STREAMHELP', m, y);
  y += 96 * unit;
  ctx.fillStyle = '#fff';
  ctx.font = `800 ${Math.round(110 * unit)}px ${display}`;
  for (const line of wrap(ctx, s.name.toUpperCase(), textW)) { ctx.fillText(line, m, y); y += 104 * unit; }
  ctx.fillStyle = '#e0c8ff';
  ctx.font = `600 ${Math.round(44 * unit)}px ${body}`;
  for (const line of wrap(ctx, s.slogan, textW)) { y += 10 * unit; ctx.fillText(line, m, y); y += 46 * unit; }

  // Quer: Text links, Gerät rechts · Quadrat: Gerät rechts neben den Vorteilen · Story: alles untereinander
  const square = format === 'square';
  const devSize = wide ? W * 0.4 : square ? W * 0.48 : W - 2 * m;
  const devX = wide || square ? W - m - devSize : m;
  const devY = wide ? H * 0.2 : y + 30 * unit;
  drawDevice(ctx, devX, devY, devSize, keys);
  y = wide ? y + 40 * unit : square ? devY + 50 * unit : devY + devSize * 0.62 + 80 * unit;
  const factW = square ? devX - m - 30 * unit : textW;

  ctx.font = `600 ${Math.round((square ? 32 : 38) * unit)}px ${body}`;
  const n = format === 'story' ? 5 : 3;
  for (const f of facts.slice(0, n)) {
    ctx.fillStyle = '#3ddc84';
    ctx.fillText('✓', m, y);
    ctx.fillStyle = '#eef1f7';
    const lines = wrap(ctx, f, factW - 52 * unit);
    for (const line of lines) { ctx.fillText(line, m + 52 * unit, y); y += 48 * unit; }
    y += 10 * unit;
  }

  const bottom = H - m;
  ctx.fillStyle = '#ffd36b';
  ctx.font = `800 ${Math.round(96 * unit)}px ${display}`;
  ctx.fillText(euro(s.price), m, bottom - 60 * unit);
  ctx.fillStyle = '#a7b0c2';
  ctx.font = `500 ${Math.round(28 * unit)}px ${body}`;
  ctx.fillText(`inkl. MwSt. · ${s.link}${s.code ? ` · Code ${s.code}` : ''}`, m, bottom);
}

// ---------- Karte ----------
const copyBtn = (text, toast) => h('button', {
  class: 'btn btn--ghost btn--sm', type: 'button',
  onclick: async () => {
    try { await navigator.clipboard.writeText(text()); toast?.('Kopiert.', 'ok', 1800); } catch { toast?.('Kopieren ging nicht – Text markieren und Strg+C.', 'error'); }
  },
}, 'Kopieren');

// ctx: { kit, keys, onChange(kit), toast }
export function renderAdsCard(ctx) {
  const { kit } = ctx;
  kit.ads ??= {};
  const boxes = [];
  const out = (title, get, rows = 6, max = 0) => {
    const area = h('textarea', { class: 'ck-ad-text', rows: String(rows), readonly: true, 'aria-label': title });
    const count = h('small', { class: 'ck-ad-count' });
    const paint = () => {
      area.value = get();
      count.textContent = `${area.value.length}${max ? ` / ${max}` : ''} Zeichen`;
      count.classList.toggle('is-warn', !!max && area.value.length > max);
    };
    boxes.push(paint);
    return h('div', { class: 'ck-ad-out' }, h('div', { class: 'ck-ad-out-head' }, h('b', {}, title), count, copyBtn(() => area.value, ctx.toast)), area);
  };
  const texts = () => adTexts(kit, ctx.keys);
  const canvas = h('canvas', { class: 'ck-ad-canvas', role: 'img', 'aria-label': 'Werbegrafik' });
  const draw = () => drawAd(canvas, kit, ctx.keys, ui.format);
  const repaint = () => { boxes.forEach((p) => p()); draw(); };

  const fields = AD_FIELDS.map(([id, label, ph, max]) => {
    const input = h('input', { maxlength: String(max), placeholder: id === 'price' ? `${euro(kitTotals(kit).price)} (Faustregel)` : ph, inputmode: id === 'price' ? 'decimal' : null });
    input.value = kit.ads[id] ?? '';
    input.addEventListener('input', () => { kit.ads[id] = input.value.trim(); repaint(); });
    input.addEventListener('change', () => ctx.onChange(kit));
    return h('label', { class: 'field' }, h('span', {}, label), input);
  });
  const tone = h('select', { 'aria-label': 'Tonfall' }, ...TONES.map(([v, t]) => h('option', { value: v }, t)));
  tone.value = adSettings(kit).tone;
  tone.addEventListener('change', () => { kit.ads.tone = tone.value; ctx.onChange(kit); });
  fields.push(h('label', { class: 'field' }, h('span', {}, 'Tonfall'), tone));

  const formats = h('div', { class: 'ck-ad-formats', role: 'group', 'aria-label': 'Format' }, ...FORMATS.map(([id, label, W, H]) => {
    const b = h('button', { type: 'button', class: 'ck-ad-format', 'aria-pressed': String(ui.format === id) }, label, h('small', {}, `${W} × ${H}`));
    b.addEventListener('click', () => {
      ui.format = id;
      formats.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      draw();
    });
    return b;
  }));
  const savePng = () => canvas.toBlob((blob) => {
    if (!blob) { ctx.toast?.('Bild konnte nicht erstellt werden.', 'error'); return; }
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: `werbung-${ui.format}-${new Date().toISOString().slice(0, 10)}.png` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }, 'image/png');

  const t0 = texts();
  const card = h('section', { class: 'dash-card dash-card--wide ck-card ck-ads' },
    h('header', { class: 'cs-head' },
      h('div', {},
        h('h2', {}, 'Werbungs-Builder'),
        h('p', { class: 'dash-status' }, 'Shop-Text, Posts, Twitch-Panel und Grafiken – aus den Bauteilen, dem Preis und der Tastenbelegung. Ändert sich der Baukasten, ändert sich die Werbung mit.'))),
    h('div', { class: 'ck-inputs' }, ...fields),
    h('h3', { class: 'ck-ad-h' }, '🖼️ Werbegrafik'),
    formats,
    h('div', { class: 'ck-ad-stage' }, canvas),
    h('div', { class: 'pf-row' },
      h('button', { class: 'btn btn--primary btn--sm', type: 'button', onclick: savePng }, 'Als PNG herunterladen'),
      h('span', { class: 'form-hint' }, 'Die Tasten zeigen Farben und Symbole aus der Belegung.')),
    h('h3', { class: 'ck-ad-h' }, '🛒 Shop-Text'),
    out('Produktseite', () => texts().shop, 14),
    h('div', { class: 'pf-row' }, h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: () => downloadText(texts().shop, 'shop-text.txt', 'text/plain;charset=utf-8') }, 'Als .txt herunterladen')),
    h('h3', { class: 'ck-ad-h' }, '📣 Social Media'),
    h('div', { class: 'ck-ad-grid' }, ...t0.posts.map(([name], i) => out(name, () => texts().posts[i][1], 8, name.startsWith('X') ? 280 : name === 'Instagram' ? 2200 : name === 'TikTok' ? 2200 : 0))),
    h('h3', { class: 'ck-ad-h' }, '🟣 Twitch'),
    h('div', { class: 'ck-ad-grid' }, ...t0.twitch.map(([name], i) => out(name, () => texts().twitch[i][1], name === 'Panel-Text' ? 7 : 3, name === 'Panel-Titel' ? 40 : name.startsWith('Chat') ? 500 : name.startsWith('Befehl') ? 400 : 0))),
    h('p', { class: 'form-hint' }, 'Werbung mit Preis: immer „inkl. MwSt.“ nennen. Streamer, die das Gerät bewerben und dafür etwas bekommen, müssen den Stream bzw. Post als Werbung kennzeichnen.'));
  repaint();
  // Schriften erst nach dem Laden zeichnen, sonst nimmt die Grafik die Ersatzschrift
  document.fonts?.load('800 40px "Barlow Condensed"').then(draw, () => {});
  return card;
}
