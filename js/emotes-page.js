// Emote-Ersteller (emotes.html) – ein Extra von StreamHelp MAX. Läuft komplett im Browser: Bild laden,
// zuschneiden, drehen, spiegeln, Hintergrund entfernen (automatisch, per Farbe oder mit dem Radierer), Rand,
// Schatten und Text dazu, Vorschau im Chat mit Prüfung der Twitch-Vorgaben, Download als ZIP.
// Formate: Emote (112, 56, 28 px, je höchstens 1 MB) und Abzeichen (72, 36, 18 px, je höchstens 25 KB).
// Hochgeladen wird nichts. Ab dem Start von MAX (js/launch.js: max) nur mit MAX; bis dahin für alle zum Ausprobieren.
import { setupConsent } from './consent.js';
import { h } from './extras-core.js';
import { MAX_ENFORCED } from './pro.js';

setupConsent(); // Cookie-Fenster (js/consent.js)

const $ = (sel) => document.querySelector(sel);
const WORK = 448;          // Arbeitsfläche (4 × 112)
const MAX_SRC = 1024;      // größere Bilder werden beim Laden verkleinert (schneller, reicht für 112 px)
const SOFT = 24;           // weicher Übergang am Rand der entfernten Farbe
const HISTORY = 40;        // Schritte für Rückgängig
const FORMATS = {
  emote: { sizes: [112, 56, 28], limit: 1024 * 1024, label: 'Emote', big: 448 },
  badge: { sizes: [72, 36, 18], limit: 25 * 1024, label: 'Abzeichen', big: 0 },
};
const FONTS = {
  bold: ['700', 'Inter'],
  poster: ['400', 'Anton'],
  narrow: ['800', 'Barlow Condensed'],
  tech: ['600', 'Chakra Petch'],
};

// Einstellungen, die „Rückgängig“ zurückholt (alles außer Bild und Dateiname)
const KEYS = ['zoom', 'x', 'y', 'rot', 'flip', 'key', 'seeds', 'tol', 'connected', 'clean', 'border', 'borderColor', 'shadow',
  'text', 'textColor', 'textStroke', 'textSize', 'textPos', 'font', 'format'];
const DEFAULTS = {
  zoom: 1, x: 0, y: 0, rot: 0, flip: false,
  key: null, seeds: [], tol: 30, connected: true, clean: 0,
  border: 0, borderColor: '#ffffff', shadow: false,
  text: '', textColor: '#ffffff', textStroke: '#000000', textSize: 30, textPos: 'bottom', font: 'bold',
  format: 'emote',
};
const st = { ...DEFAULTS, seeds: [], name: 'emote' };

// Bild im Bildraum: Original (orig), Alpha nach Farbentfernung (keyA), Pinsel (paint: 0 auto, 1 weg, 2 behalten)
let W = 0;
let H = 0;
let orig = null;
let keyA = null;
let paint = null;
let cutData = null;
const cut = document.createElement('canvas');
const cutCtx = cut.getContext('2d', { willReadFrequently: true });

const work = $('#em-canvas');
const ctx = work.getContext('2d');
let mode = 'move';         // move | erase | keep
let brush = 24;            // Pinselgröße in Arbeitsflächen-Pixeln
let hover = null;          // Pinsel-Vorschau
let picking = false;

// ---------- Zugang ----------
async function gate() {
  const lock = $('#em-lock');
  const tool = $('#em-tool');
  if (!MAX_ENFORCED) { lock.hidden = true; tool.hidden = false; $('#em-free').hidden = false; return; }
  let ok = false;
  try {
    const { createApi } = await import('./api.js');
    const api = await createApi();
    const { data } = await api.raw.sb.auth.getSession();
    if (data?.session) {
      const mine = await api.channelMine().catch(() => null);
      if (mine?.id) {
        const { rememberChannel } = await import('./channel.js');
        rememberChannel(mine.id); // eigener Kanal für die Abfrage (Header x-channel)
        ok = !!(await api.channelHasMax().catch(() => false));
      }
    }
  } catch { ok = false; }
  lock.hidden = ok;
  tool.hidden = !ok;
}

function say(text) { $('#em-note').textContent = text; }

// ---------- Bild laden ----------
function load(file) {
  if (!file || !file.type.startsWith('image/')) return say('Bitte eine Bilddatei wählen (PNG, JPG, GIF oder WebP).');
  if (file.size > 15 * 1024 * 1024) return say('Das Bild ist zu groß (höchstens 15 MB).');
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const k = Math.min(1, MAX_SRC / Math.max(img.naturalWidth, img.naturalHeight));
    W = Math.max(1, Math.round(img.naturalWidth * k));
    H = Math.max(1, Math.round(img.naturalHeight * k));
    cut.width = W;
    cut.height = H;
    cutCtx.clearRect(0, 0, W, H);
    cutCtx.imageSmoothingQuality = 'high';
    cutCtx.drawImage(img, 0, 0, W, H);
    URL.revokeObjectURL(url);
    orig = cutCtx.getImageData(0, 0, W, H);
    cutData = new ImageData(new Uint8ClampedArray(orig.data), W, H);
    paint = new Uint8Array(W * H);
    Object.assign(st, { ...DEFAULTS, seeds: [], format: st.format, font: st.font, textColor: st.textColor, textStroke: st.textStroke });
    st.name = (file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '') || 'emote').slice(0, 20);
    $('#em-name').value = st.name;
    hist.list = [];
    hist.i = -1;
    computeKey();
    syncControls();
    setMode('move');
    $('#em-steps').hidden = false;
    $('#em-tools').hidden = false;
    say(file.type === 'image/gif' ? 'Bei GIFs wird nur das erste Bild verwendet.' : '');
    commit();
    draw();
  };
  img.onerror = () => { URL.revokeObjectURL(url); say('Das Bild ließ sich nicht öffnen.'); };
  img.src = url;
}

// ---------- Hintergrund entfernen (im Bildraum) ----------
function computeKey() {
  if (!orig) return;
  const d = orig.data;
  const n = W * H;
  const a = new Uint8ClampedArray(n);
  for (let i = 0; i < n; i++) a[i] = d[i * 4 + 3];
  if (st.key) {
    const [kr, kg, kb] = st.key;
    const tol = st.tol * 4.4; // 0–100 → Abstand im RGB-Raum (0–440)
    const tol2 = tol * tol;
    const d2 = (i) => { const p = i * 4; const r = d[p] - kr; const g = d[p + 1] - kg; const b = d[p + 2] - kb; return r * r + g * g + b * b; };
    const inKey = (i) => d[i * 4 + 3] < 16 || d2(i) <= tol2;
    const fade = (i) => {
      const dist = Math.sqrt(d2(i));
      if (dist <= tol) return 0;
      if (dist <= tol + SOFT) return Math.round(255 * (dist - tol) / SOFT);
      return 255;
    };
    if (!st.connected) {
      for (let i = 0; i < n; i++) a[i] = Math.min(a[i], fade(i));
    } else {
      // Füllen vom Bildrand (und von angetippten Stellen) aus: gleiche Farbe im Motiv bleibt stehen
      const gone = new Uint8Array(n);
      const stack = new Int32Array(n);
      let sp = 0;
      const push = (i) => { if (!gone[i] && inKey(i)) { gone[i] = 1; stack[sp++] = i; } };
      for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
      for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
      for (const [sx, sy] of st.seeds) if (sx >= 0 && sy >= 0 && sx < W && sy < H) push(sy * W + sx);
      while (sp) {
        const i = stack[--sp];
        const x = i % W;
        if (x > 0) push(i - 1);
        if (x < W - 1) push(i + 1);
        if (i >= W) push(i - W);
        if (i < n - W) push(i + W);
      }
      for (let i = 0; i < n; i++) {
        if (gone[i]) { a[i] = 0; continue; }
        const x = i % W;
        const edge = (x > 0 && gone[i - 1]) || (x < W - 1 && gone[i + 1]) || (i >= W && gone[i - W]) || (i < n - W && gone[i + W]);
        if (edge) a[i] = Math.min(a[i], fade(i));
      }
    }
  }
  keyA = st.clean ? erode(a, st.clean) : a;
  applyAlpha(0, 0, W, H);
}

// Kante säubern: Alpha um r Pixel nach innen ziehen (Minimum-Filter, erst waagrecht, dann senkrecht)
function erode(a, r) {
  const tmp = new Uint8ClampedArray(a.length);
  const out = new Uint8ClampedArray(a.length);
  for (let y = 0; y < H; y++) {
    const row = y * W;
    for (let x = 0; x < W; x++) {
      let m = 255;
      for (let k = Math.max(0, x - r); k <= Math.min(W - 1, x + r); k++) m = Math.min(m, a[row + k]);
      tmp[row + x] = m;
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let m = 255;
      for (let k = Math.max(0, y - r); k <= Math.min(H - 1, y + r); k++) m = Math.min(m, tmp[k * W + x]);
      out[y * W + x] = m;
    }
  }
  return out;
}

// Endgültiges Alpha (Farbentfernung + Pinsel) in den Ausschnitt schreiben
function applyAlpha(x0, y0, w, hgt) {
  const d = cutData.data;
  const o = orig.data;
  for (let y = y0; y < y0 + hgt; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const i = y * W + x;
      const p = paint[i];
      d[i * 4 + 3] = p === 1 ? 0 : p === 2 ? o[i * 4 + 3] : keyA[i];
    }
  }
  cutCtx.putImageData(cutData, 0, 0, x0, y0, w, hgt);
}

// Häufigste Randfarbe als Hintergrund annehmen
function autoKey() {
  if (!orig) return;
  const d = orig.data;
  const bins = new Map();
  const add = (i) => {
    const p = i * 4;
    if (d[p + 3] < 16) return;
    const k = ((d[p] >> 4) << 8) | ((d[p + 1] >> 4) << 4) | (d[p + 2] >> 4);
    const b = bins.get(k) ?? [0, 0, 0, 0];
    b[0] += d[p]; b[1] += d[p + 1]; b[2] += d[p + 2]; b[3]++;
    bins.set(k, b);
  };
  for (let x = 0; x < W; x++) { add(x); add((H - 1) * W + x); }
  for (let y = 1; y < H - 1; y++) { add(y * W); add(y * W + W - 1); }
  let best = null;
  for (const b of bins.values()) if (!best || b[3] > best[3]) best = b;
  if (!best) { say('Der Rand ist schon durchsichtig – hier gibt es nichts zu entfernen.'); return; }
  st.seeds = [];
  setKey(best.slice(0, 3).map((v) => Math.round(v / best[3])));
  say('Hintergrund automatisch erkannt. Reste? Toleranz erhöhen oder mit dem Radierer nacharbeiten.');
}

function setKey(rgb, seed = null) {
  // Gleiche Farbe wie bisher: angetippte Stelle zusätzlich füllen (z. B. Lücke zwischen Arm und Körper)
  const same = st.key && Math.hypot(st.key[0] - rgb[0], st.key[1] - rgb[1], st.key[2] - rgb[2]) <= st.tol * 4.4;
  if (!same) st.seeds = [];
  if (!same) st.key = rgb;
  if (seed) st.seeds = [...st.seeds, seed].slice(-24);
  computeKey();
  syncControls();
  commit();
  draw();
}

// ---------- Anordnung (Zoom, Drehung, Spiegeln, Verschieben) ----------
const baseScale = () => Math.max(WORK / W, WORK / H);
function matrix() {
  const s = baseScale() * st.zoom;
  return new DOMMatrix().translate(WORK / 2 + st.x, WORK / 2 + st.y).rotate(st.rot).scale(st.flip ? -s : s, s).translate(-W / 2, -H / 2);
}
const toImage = (p) => matrix().inverse().transformPoint(new DOMPoint(p.x, p.y));

// Zoom und Verschiebung so, dass das freigestellte Motiv die Fläche füllt
function fitToSubject() {
  if (!orig) return;
  const d = cutData.data;
  let x0 = W; let y0 = H; let x1 = -1; let y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (d[(y * W + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
  }
  if (x1 < 0) { say('Kein Motiv gefunden – es ist alles durchsichtig.'); return; }
  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;
  const rad = (st.rot * Math.PI) / 180;
  const ew = bw * Math.abs(Math.cos(rad)) + bh * Math.abs(Math.sin(rad));
  const eh = bw * Math.abs(Math.sin(rad)) + bh * Math.abs(Math.cos(rad));
  const pad = 0.94 - (st.border ? (st.border * 2) / WORK : 0);
  st.zoom = Math.min(8, Math.max(0.2, (WORK * pad) / (Math.max(ew, eh) * baseScale())));
  st.x = 0;
  st.y = 0;
  const c = matrix().transformPoint(new DOMPoint((x0 + x1 + 1) / 2, (y0 + y1 + 1) / 2));
  st.x = WORK / 2 - c.x;
  st.y = WORK / 2 - c.y;
  syncControls();
  commit();
  draw();
}

// ---------- Zeichnen ----------
function addBorder(src) {
  if (!st.border) return src;
  const out = document.createElement('canvas');
  out.width = out.height = WORK;
  const o = out.getContext('2d');
  const tint = document.createElement('canvas');
  tint.width = tint.height = WORK;
  const t = tint.getContext('2d');
  t.drawImage(src, 0, 0);
  t.globalCompositeOperation = 'source-in';
  t.fillStyle = st.borderColor;
  t.fillRect(0, 0, WORK, WORK);
  const r = st.border;
  for (let a = 0; a < 32; a++) {
    const ang = (a / 32) * Math.PI * 2;
    o.drawImage(tint, Math.cos(ang) * r, Math.sin(ang) * r);
  }
  o.drawImage(src, 0, 0);
  return out;
}

function drawText(c) {
  const text = st.text.trim();
  if (!text) return;
  const size = st.textSize * 2.2;
  const [weight, family] = FONTS[st.font] ?? FONTS.bold;
  c.font = `${weight} ${size}px "${family}", system-ui, sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = st.textPos === 'top' ? 'top' : st.textPos === 'middle' ? 'middle' : 'alphabetic';
  const y = st.textPos === 'top' ? 14 : st.textPos === 'middle' ? WORK / 2 : WORK - 18;
  const maxW = WORK - 24;
  c.lineJoin = 'round';
  c.lineWidth = Math.max(4, size / 5);
  c.strokeStyle = st.textStroke;
  c.strokeText(text, WORK / 2, y, maxW);
  c.fillStyle = st.textColor;
  c.fillText(text, WORK / 2, y, maxW);
}

// Fertiges Emote auf der Arbeitsfläche (ohne Karomuster – das macht CSS)
function render() {
  const layer = document.createElement('canvas');
  layer.width = layer.height = WORK;
  const l = layer.getContext('2d');
  l.imageSmoothingQuality = 'high';
  l.setTransform(matrix());
  l.drawImage(cut, 0, 0);
  const bordered = addBorder(layer);
  const out = document.createElement('canvas');
  out.width = out.height = WORK;
  const o = out.getContext('2d');
  if (st.shadow) {
    o.shadowColor = 'rgba(0,0,0,.55)';
    o.shadowBlur = 16;
    o.shadowOffsetY = 8;
  }
  o.drawImage(bordered, 0, 0);
  o.shadowColor = 'transparent';
  drawText(o);
  return out;
}

function scaled(src, size) {
  // in Schritten halbieren, damit kleine Größen scharf bleiben
  let cur = src;
  while (cur.width / 2 >= size * 1.5) {
    const half = document.createElement('canvas');
    half.width = half.height = Math.round(cur.width / 2);
    const hc = half.getContext('2d');
    hc.imageSmoothingQuality = 'high';
    hc.drawImage(cur, 0, 0, half.width, half.height);
    cur = half;
  }
  if (cur.width === size) return cur;
  const out = document.createElement('canvas');
  out.width = out.height = size;
  const oc = out.getContext('2d');
  oc.imageSmoothingQuality = 'high';
  oc.drawImage(cur, 0, 0, size, size);
  return out;
}

let result = null;
let raf = 0;
function draw() {
  if (!orig || raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    result = render();
    ctx.clearRect(0, 0, WORK, WORK);
    ctx.drawImage(result, 0, 0);
    if (hover && mode !== 'move') {
      // Pinsel-Kreis
      ctx.save();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(0,0,0,.7)';
      ctx.beginPath();
      ctx.arc(hover.x, hover.y, brush / 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = mode === 'erase' ? '#ff6b6b' : '#7cf29a';
      ctx.stroke();
      ctx.restore();
    }
    schedulePreview();
  });
}

// Vorschau der Größen, Chat und Prüfung – kurz nach der letzten Änderung (spart Rechenzeit beim Ziehen)
let previewTimer = 0;
let previewUrls = [];
function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => { updatePreview().catch((e) => say(`Vorschau fehlgeschlagen: ${e.message}`)); }, 140);
}

const toBlob = (c) => new Promise((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error('PNG ließ sich nicht erzeugen'))), 'image/png'));
const kb = (bytes) => (bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1048576).toFixed(1).replace('.0', '').replace('.', ',')} MB`);

async function buildFiles() {
  const f = FORMATS[st.format];
  const sizes = f.big ? [...f.sizes, f.big] : f.sizes;
  const out = [];
  for (const s of sizes) {
    const c = scaled(result, s);
    out.push({ size: s, canvas: c, blob: await toBlob(c), big: s === f.big });
  }
  return out;
}

async function updatePreview() {
  if (!result) return;
  const f = FORMATS[st.format];
  const files = await buildFiles();
  previewUrls.forEach((u) => URL.revokeObjectURL(u));
  previewUrls = files.map((x) => URL.createObjectURL(x.blob));
  const small = files.filter((x) => !x.big);
  $('#em-sizes').replaceChildren(...small.map((x) => {
    const url = previewUrls[files.indexOf(x)];
    const over = x.blob.size > f.limit;
    return h('figure', {},
      h('img', { src: url, alt: `${f.label} ${x.size} Pixel`, width: x.size, height: x.size }),
      h('figcaption', {}, `${x.size} px · `, h('span', { class: over ? 'em-bad' : '' }, kb(x.blob.size))),
      h('a', { class: 'em-link', href: url, download: `${st.name}_${x.size}.png` }, 'einzeln'));
  }));
  // Chat-Vorschau: Emote in der Nachricht (28 px), Abzeichen vor dem Namen (18 px)
  const tiny = previewUrls[files.indexOf(small[small.length - 1])];
  const line = (cls) => (st.format === 'badge'
    ? h('p', { class: `em-chat ${cls}` }, h('img', { src: tiny, alt: '', width: 18, height: 18 }), h('b', {}, 'Zuschauer:'), ' hallo zusammen!')
    : h('p', { class: `em-chat ${cls}` }, h('b', {}, 'Zuschauer:'), ' das war krass ', h('img', { src: tiny, alt: '', width: 28, height: 28 }), h('img', { src: tiny, alt: '', width: 28, height: 28 }), ' gg'));
  $('#em-chats').replaceChildren(line('is-dark'), line('is-light'));
  checks(small, f);
}

// Prüfung der Twitch-Vorgaben und Tipps
function checks(files, f) {
  const items = [];
  const ok = (text) => items.push(['ok', text]);
  const warn = (text) => items.push(['warn', text]);
  const biggest = files.reduce((m, x) => Math.max(m, x.blob.size), 0);
  if (biggest > f.limit) warn(`Datei zu groß: ${kb(biggest)} – Twitch erlaubt je Größe höchstens ${kb(f.limit)}.`);
  else ok(`Dateigrößen passen (größte ${kb(biggest)} von ${kb(f.limit)}).`);
  const c = files[0].canvas;
  const px = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let clear = 0;
  let x0 = c.width; let y0 = c.height; let x1 = -1; let y1 = -1;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 128) { clear++; continue; }
    const p = i / 4;
    const x = p % c.width;
    const y = (p - x) / c.width;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (!clear) warn('Der Hintergrund ist noch nicht durchsichtig – unter „2 · Hintergrund entfernen“ wegnehmen (Twitch empfiehlt Transparenz).');
  else ok('Durchsichtiger Hintergrund.');
  if (x1 >= 0) {
    const fill = Math.max(x1 - x0 + 1, y1 - y0 + 1) / c.width;
    if (fill < 0.75) warn(`Das Motiv nutzt nur ${Math.round(fill * 100)} % der Fläche – „Aufs Motiv zuschneiden“ macht es in kleinen Größen besser erkennbar.`);
    else ok('Das Motiv füllt die Fläche gut.');
  }
  const text = st.text.trim();
  if (text && (text.length > 5 || st.textSize < 36)) warn(`Text ist bei ${f.sizes[2]} px kaum lesbar – kurz halten (bis 4 Zeichen) und groß machen.`);
  $('#em-checks').replaceChildren(...items.map(([kind, text]) => h('li', { class: `is-${kind}` },
    h('i', { class: `ph ${kind === 'ok' ? 'ph-check-circle' : 'ph-warning'}`, 'aria-hidden': 'true' }), h('span', {}, text))));
}

// ---------- ZIP (ohne Kompression – PNG ist schon gepackt) ----------
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(b) {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function makeZip(files) {
  const enc = new TextEncoder();
  const now = new Date();
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const parts = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const size = f.data.length;
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(4, 20, true);
    lh.setUint16(10, time, true);
    lh.setUint16(12, date, true);
    lh.setUint32(14, crc, true);
    lh.setUint32(18, size, true);
    lh.setUint32(22, size, true);
    lh.setUint16(26, name.length, true);
    parts.push(lh, name, f.data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true);
    ch.setUint16(4, 20, true);
    ch.setUint16(6, 20, true);
    ch.setUint16(12, time, true);
    ch.setUint16(14, date, true);
    ch.setUint32(16, crc, true);
    ch.setUint32(20, size, true);
    ch.setUint32(24, size, true);
    ch.setUint16(28, name.length, true);
    ch.setUint32(42, offset, true);
    central.push(ch, name);
    offset += 30 + name.length + size;
  }
  const cdSize = central.reduce((s, p) => s + p.byteLength, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end], { type: 'application/zip' });
}

async function downloadZip() {
  if (!orig) return;
  result = render();
  const f = FORMATS[st.format];
  const files = await buildFiles();
  const over = files.filter((x) => !x.big && x.blob.size > f.limit);
  const entries = await Promise.all(files.map(async (x) => ({
    name: `${st.name}_${x.size}${x.big ? '_gross' : ''}.png`,
    data: new Uint8Array(await x.blob.arrayBuffer()),
  })));
  const a = h('a', { href: URL.createObjectURL(makeZip(entries)), download: `${st.name}_${st.format === 'badge' ? 'abzeichen' : 'emote'}.zip` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  const list = files.map((x) => x.size).join(', ');
  say(over.length
    ? `Gespeichert (${list} px) – Achtung: ${over.map((x) => x.size).join(', ')} px ist größer als ${kb(f.limit)}, Twitch nimmt das so nicht an.`
    : st.format === 'badge'
      ? `Gespeichert: ZIP mit ${list} px. Hochladen: Creator-Dashboard → Viewer-Belohnungen → Abonnements → Abzeichen.`
      : `Gespeichert: ZIP mit ${list} px. Hochladen: Creator-Dashboard → Viewer-Belohnungen → Emotes – die 448-px-Datei passt für „Automatische Größenanpassung“.`);
}

// ---------- Rückgängig ----------
const hist = { list: [], i: -1 };
const pick = () => JSON.stringify(Object.fromEntries(KEYS.map((k) => [k, st[k]])));
function commit() {
  if (!orig) return;
  const s = pick();
  const cur = hist.list[hist.i];
  if (cur && cur.s === s && cur.paint === paint) return;
  hist.list = hist.list.slice(0, hist.i + 1);
  hist.list.push({ s, paint });
  if (hist.list.length > HISTORY) hist.list.shift();
  hist.i = hist.list.length - 1;
  syncUndo();
}
function travel(step) {
  const k = hist.i + step;
  if (k < 0 || k >= hist.list.length) return;
  hist.i = k;
  const e = hist.list[k];
  Object.assign(st, JSON.parse(e.s));
  paint = e.paint;
  computeKey();
  syncControls();
  syncUndo();
  draw();
}
function syncUndo() {
  $('#em-undo').disabled = hist.i <= 0;
  $('#em-redo').disabled = hist.i >= hist.list.length - 1;
}

// ---------- Bedienung ----------
const CONTROLS = [
  ['#em-zoom', 'zoom', Number], ['#em-rot', 'rot', Number], ['#em-tol', 'tol', Number], ['#em-clean', 'clean', Number],
  ['#em-border', 'border', Number], ['#em-border-color', 'borderColor'], ['#em-text', 'text'], ['#em-font', 'font'],
  ['#em-text-color', 'textColor'], ['#em-text-stroke', 'textStroke'], ['#em-text-size', 'textSize', Number], ['#em-text-pos', 'textPos'],
];
const NEEDS_KEY = new Set(['tol', 'clean']);

function syncControls() {
  for (const [id, key] of CONTROLS) $(id).value = String(st[key]);
  $('#em-connected').checked = st.connected;
  $('#em-shadow').checked = st.shadow;
  $('#em-flip').classList.toggle('is-on', st.flip);
  $('#em-flip').setAttribute('aria-pressed', String(st.flip));
  document.querySelectorAll('[name="em-format"]').forEach((r) => { r.checked = r.value === st.format; });
  $('#em-key-swatch').style.background = st.key ? `rgb(${st.key.join(',')})` : '';
  $('#em-key-swatch').title = st.key ? 'entfernte Farbe' : 'keine Farbe gewählt';
  $('#em-rot-val').textContent = `${st.rot}°`;
  $('#em-zoom-val').textContent = `${Math.round(st.zoom * 100)} %`;
  $('#em-download-label').textContent = st.format === 'badge' ? 'Abzeichen als ZIP speichern (72, 36, 18 px)' : 'Emote als ZIP speichern (112, 56, 28 + 448 px)';
}

function setMode(next) {
  mode = next;
  if (picking) togglePick(false);
  document.querySelectorAll('[data-em-mode]').forEach((b) => {
    const on = b.dataset.emMode === mode;
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-pressed', String(on));
  });
  $('#em-brush-wrap').hidden = mode === 'move';
  work.dataset.mode = mode;
  hover = null;
  draw();
}

function togglePick(on = !picking) {
  picking = on;
  $('#em-pick').classList.toggle('is-on', picking);
  work.classList.toggle('is-picking', picking);
  say(picking ? 'Tippe in der Vorschau auf die Farbe, die verschwinden soll.' : '');
}

// Pinselstrich im Bildraum (Kreise entlang der Strecke)
function stroke(a, b) {
  const s = baseScale() * st.zoom;
  const r = Math.max(1, brush / 2 / s);
  const val = mode === 'erase' ? 1 : 2;
  const pa = toImage(a);
  const pb = toImage(b);
  const len = Math.hypot(pb.x - pa.x, pb.y - pa.y);
  const steps = Math.max(1, Math.ceil(len / Math.max(1, r / 2)));
  let x0 = W; let y0 = H; let x1 = -1; let y1 = -1;
  for (let k = 0; k <= steps; k++) {
    const cx = pa.x + ((pb.x - pa.x) * k) / steps;
    const cy = pa.y + ((pb.y - pa.y) * k) / steps;
    const ya = Math.max(0, Math.floor(cy - r));
    const yb = Math.min(H - 1, Math.ceil(cy + r));
    const xa = Math.max(0, Math.floor(cx - r));
    const xb = Math.min(W - 1, Math.ceil(cx + r));
    for (let y = ya; y <= yb; y++) {
      for (let x = xa; x <= xb; x++) {
        if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) paint[y * W + x] = val;
      }
    }
    if (xa <= xb && ya <= yb) { x0 = Math.min(x0, xa); y0 = Math.min(y0, ya); x1 = Math.max(x1, xb); y1 = Math.max(y1, yb); }
  }
  if (x1 >= x0) applyAlpha(x0, y0, x1 - x0 + 1, y1 - y0 + 1);
}

function setup() {
  const file = $('#em-file');
  file.addEventListener('change', () => load(file.files?.[0]));
  const drop = $('#em-drop');
  const stage = $('.em-stage');
  ['dragenter', 'dragover'].forEach((ev) => stage.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach((ev) => stage.addEventListener(ev, () => drop.classList.remove('is-over')));
  stage.addEventListener('drop', (e) => { e.preventDefault(); load(e.dataTransfer?.files?.[0]); });
  document.addEventListener('paste', (e) => {
    const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'));
    if (item) load(item.getAsFile());
  });

  for (const [id, key, conv = (v) => v] of CONTROLS) {
    const el = $(id);
    el.addEventListener('input', () => {
      st[key] = conv(el.value);
      if (NEEDS_KEY.has(key)) computeKey();
      if (key === 'zoom') $('#em-zoom-val').textContent = `${Math.round(st.zoom * 100)} %`;
      if (key === 'rot') $('#em-rot-val').textContent = `${st.rot}°`;
      if (key === 'font' || key === 'text') ensureFont().then(draw, () => draw());
      draw();
    });
    el.addEventListener('change', commit);
  }
  $('#em-connected').addEventListener('change', (e) => { st.connected = e.target.checked; computeKey(); commit(); draw(); });
  $('#em-shadow').addEventListener('change', (e) => { st.shadow = e.target.checked; commit(); draw(); });
  document.querySelectorAll('[name="em-format"]').forEach((r) => r.addEventListener('change', () => {
    st.format = r.value;
    syncControls();
    commit();
    draw();
  }));
  $('#em-name').addEventListener('input', (e) => { st.name = e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'emote'; });

  $('#em-flip').addEventListener('click', () => { st.flip = !st.flip; syncControls(); commit(); draw(); });
  $('#em-fit').addEventListener('click', fitToSubject);
  $('#em-reset').addEventListener('click', () => { Object.assign(st, { zoom: 1, x: 0, y: 0, rot: 0, flip: false }); syncControls(); commit(); draw(); });
  $('#em-auto').addEventListener('click', autoKey);
  $('#em-pick').addEventListener('click', () => { setMode('move'); togglePick(); });
  $('#em-key-off').addEventListener('click', () => {
    st.key = null;
    st.seeds = [];
    paint = new Uint8Array(W * H);
    computeKey();
    syncControls();
    commit();
    draw();
  });
  document.querySelectorAll('[data-em-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.emMode)));
  $('#em-brush').addEventListener('input', (e) => { brush = Number(e.target.value); draw(); });
  $('#em-undo').addEventListener('click', () => travel(-1));
  $('#em-redo').addEventListener('click', () => travel(1));
  document.querySelectorAll('[data-em-bg]').forEach((b) => b.addEventListener('click', () => {
    $('.em-canvas-wrap').dataset.bg = b.dataset.emBg;
    document.querySelectorAll('[data-em-bg]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  }));
  document.addEventListener('keydown', (e) => {
    if (!orig || !(e.ctrlKey || e.metaKey)) return;
    if (e.target.closest?.('input[type="text"]')) return; // Rückgängig im Textfeld bleibt beim Textfeld
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); travel(-1); } else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); travel(1); }
  });

  // Ziehen: verschieben (ein Finger), zoomen (zwei Finger), malen (Radierer/Zurückholen); Farbe wählen per Tippen
  const pos = (e) => {
    const r = work.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (WORK / r.width), y: (e.clientY - r.top) * (WORK / r.height) };
  };
  const pointers = new Map();
  let drag = null;
  let pinch = null;
  work.addEventListener('pointerdown', (e) => {
    if (!orig) return;
    const p = pos(e);
    if (picking) {
      const ip = toImage(p);
      const ix = Math.floor(ip.x);
      const iy = Math.floor(ip.y);
      togglePick(false);
      if (ix < 0 || iy < 0 || ix >= W || iy >= H) { say('Das war außerhalb des Bildes.'); return; }
      const i = (iy * W + ix) * 4;
      setKey([orig.data[i], orig.data[i + 1], orig.data[i + 2]], [ix, iy]);
      return;
    }
    work.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, p);
    if (pointers.size === 2 && mode === 'move') {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: st.zoom };
      drag = null;
      return;
    }
    if (pointers.size > 1) return;
    if (mode === 'move') drag = { sx: p.x, sy: p.y, x: st.x, y: st.y };
    else {
      // vor dem ersten Strich kopieren, damit „Rückgängig“ den alten Stand behält
      if (hist.list[hist.i]?.paint === paint) paint = paint.slice();
      drag = { last: p };
      stroke(p, p);
      draw();
    }
  });
  work.addEventListener('pointermove', (e) => {
    const p = pos(e);
    if (mode !== 'move') { hover = p; if (!drag) draw(); }
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, p);
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      st.zoom = Math.min(8, Math.max(0.2, (pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / Math.max(1, pinch.d)));
      syncControls();
      draw();
      return;
    }
    if (!drag) return;
    if (mode === 'move') {
      st.x = drag.x + (p.x - drag.sx);
      st.y = drag.y + (p.y - drag.sy);
    } else {
      stroke(drag.last, p);
      drag.last = p;
    }
    draw();
  });
  const end = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!pointers.size) { drag = null; commit(); }
  };
  work.addEventListener('pointerup', end);
  work.addEventListener('pointercancel', end);
  work.addEventListener('pointerleave', () => { if (hover) { hover = null; draw(); } });
  // Mausrad: zoomen um die Stelle unter dem Zeiger
  let wheelTimer = 0;
  work.addEventListener('wheel', (e) => {
    if (!orig) return;
    e.preventDefault();
    const p = pos(e);
    const next = Math.min(8, Math.max(0.2, st.zoom * Math.exp(-e.deltaY * 0.0015)));
    const f = next / st.zoom;
    st.x = p.x - WORK / 2 - f * (p.x - WORK / 2 - st.x);
    st.y = p.y - WORK / 2 - f * (p.y - WORK / 2 - st.y);
    st.zoom = next;
    syncControls();
    draw();
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(commit, 300);
  }, { passive: false });

  $('#em-download').addEventListener('click', () => { downloadZip().catch((e) => say(`Speichern fehlgeschlagen: ${e.message}`)); });
}

// Schrift vor dem Zeichnen laden (sonst erscheint beim ersten Mal die Ersatzschrift)
function ensureFont() {
  const [weight, family] = FONTS[st.font] ?? FONTS.bold;
  return document.fonts?.load(`${weight} 40px "${family}"`, st.text || 'GG') ?? Promise.resolve();
}

setup();
gate();
