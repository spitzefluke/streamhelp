// Emote-Editor (emotes.html) – ein Extra von StreamHelp MAX, nach dem Entwurf „Emote Editor“ aus Claude Design.
// Ebenen (Bild, Text, Form, Effekt) frei anordnen, jede Ebene einzeln animieren (fertige Bewegungen oder eigene
// Keyframes), Zeitleiste mit Abspielen und Springen, Export als PNG oder animiertes GIF (js/gif-encode.js) in den
// Twitch-Größen. Läuft komplett im Browser, hochgeladen wird nichts.
// Ab dem Start von MAX (js/launch.js: max) nur mit MAX; bis dahin für alle zum Ausprobieren.
import './frame-guard-auto.js'; // zuerst: nicht in fremden Seiten (Clickjacking)
import { setupConsent } from './consent.js';
import { h } from './extras-core.js';
import { MAX_ENFORCED } from './pro.js';
import { ANIM_GROUPS, ANIM_LABEL, EXTRAS, EXTRA_LABEL, ROOM, SPEEDS, pose, interpKeys, heartPath, polyStar, drawExtras } from './emote-anim.js';

setupConsent(); // Cookie-Fenster (js/consent.js)

const $ = (sel) => document.querySelector(sel);
const TAU = Math.PI * 2;
const WORK = 448;
const FRAME_MS = 40;
const SHAPES = [['circle', 'Kreis', 'ph-circle'], ['rounded', 'Quadrat', 'ph-square'], ['star', 'Stern', 'ph-star'], ['heart', 'Herz', 'ph-heart'], ['bubble', 'Blase', 'ph-chat-circle'], ['burst', 'Zacken', 'ph-seal']];
const SHAPE_LABEL = Object.fromEntries(SHAPES.map(([k, l]) => [k, l]));
// nur lokale Schriften (css/fonts.css)
const FONTS = [['bold', 'Kräftig', '700 {s}px Inter, system-ui, sans-serif'], ['poster', 'Plakat', '400 {s}px Anton, Impact, sans-serif'], ['narrow', 'Schmal', '700 {s}px "Barlow Condensed", sans-serif'], ['tech', 'Technik', '600 {s}px "Chakra Petch", monospace']];
const FONT_CSS = Object.fromEntries(FONTS.map(([k, , c]) => [k, c]));
const TYPE_ICON = { shape: 'ph ph-shapes', text: 'ph ph-text-t', image: 'ph ph-image', effect: 'ph ph-sparkle' };
const FORMATS = { emote: { sizes: [112, 56, 28], limit: 1024 * 1024 }, badge: { sizes: [72, 36, 18], limit: 25 * 1024 } };
const MATTES = { dark: [24, 24, 27], light: [255, 255, 255] };
const CAN_FILTER = typeof CanvasRenderingContext2D !== 'undefined' && 'filter' in CanvasRenderingContext2D.prototype;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Ebenen ----------
let uid = 1;
const nid = () => `L${uid++}${Math.random().toString(36).slice(2, 5)}`;
function mk(type, over = {}) {
  const base = { id: nid(), type, visible: true, x: 0.5, y: 0.5, scale: 100, rot: 0, opacity: 100, flip: false, outline: 0, outlineColor: '#ffffff', shadow: false, anim: 'none', strength: 100, offset: 0, keys: [], ease: 'smooth' };
  const byType = {
    shape: { shape: 'circle', fill: '#ffd34d', stroke: '#3a2a00', strokeW: 8 },
    text: { text: 'GG', font: 'bold', fill: '#ffffff', stroke: '#1b1b3a', strokeW: 10 },
    image: { tol: 30, bgRemoved: false },
    effect: { effect: 'sparkle' },
  };
  return { ...base, ...byType[type], ...over };
}
const TEMPLATES = [
  { label: 'GG-Stempel', icon: 'ph ph-seal-check', name: 'gg-stempel', make: () => [mk('shape', { shape: 'burst', fill: '#ffd34d', stroke: '#3a2a00', anim: 'pop' }), mk('text', { text: 'GG', anim: 'tada', offset: 15, scale: 115 }), mk('effect', { effect: 'sparkle' })] },
  { label: 'Herz-Reaktion', icon: 'ph ph-heart', name: 'herz', make: () => [mk('shape', { shape: 'heart', fill: '#ff4d6d', stroke: '#7a0f24', anim: 'heart' }), mk('effect', { effect: 'hearts' })] },
  { label: 'HYPE-Schild', icon: 'ph ph-megaphone', name: 'hype', make: () => [mk('shape', { shape: 'bubble', fill: '#4dd2ff', stroke: '#0b3a52', anim: 'shake', scale: 110 }), mk('text', { text: 'HYPE', font: 'poster', fill: '#0b1a2a', stroke: '#ffffff', strokeW: 6, y: 0.44, scale: 80, anim: 'pulse' }), mk('effect', { effect: 'confetti' })] },
  { label: 'Gute Nacht', icon: 'ph ph-moon', name: 'gutenacht', make: () => [mk('shape', { shape: 'circle', fill: '#b78bff', stroke: '#2b1a52', anim: 'float' }), mk('text', { text: 'gn8', font: 'narrow', scale: 90, anim: 'float', offset: 10 }), mk('effect', { effect: 'zzz' })] },
  { label: 'Leere Fläche', icon: 'ph ph-eraser', name: 'emote', make: () => [] },
];
function layerName(L) {
  if (L.type === 'shape') return `Form · ${SHAPE_LABEL[L.shape]}`;
  if (L.type === 'text') return `Text · „${L.text || ' '}“`;
  if (L.type === 'effect') return `Effekt · ${EXTRA_LABEL[L.effect]}`;
  return L.bgRemoved ? 'Bild · freigestellt' : 'Bild';
}
const animOf = (l) => (l.type === 'effect' && l.anim === 'none' ? `${EXTRA_LABEL[l.effect]} läuft` : ANIM_LABEL[l.anim]);

// ---------- Zustand ----------
const first = TEMPLATES[0].make();
const st = {
  layers: first, sel: first[1].id, tab: 'props', fmt: 'emote', bg: 'check', speed: 'normal',
  playing: !reduced, ct: 0, name: TEMPLATES[0].name, matte: 'dark', busy: false, exportMsg: '',
};
let t = 0;                 // Abspielposition 0 … 1
const imgs = {};           // Ebenen-ID → Bild (freigestellt oder Original)
const orig = {};           // Ebenen-ID → Originalbild
const imgKey = {};         // Ebenen-ID → Stand der Freistellung („an:Toleranz“)
let hist = [];
let fut = [];
let lastPush = 0;
let dirty = true;
let accent = '#9184d9';

const frames = () => SPEEDS[st.speed] || 30;
const selLayer = () => st.layers.find((l) => l.id === st.sel) || null;
const snapT = (x) => { const n = frames(); return (Math.round(x * n) % n) / n; };
const isBadge = () => st.fmt === 'badge';
const isAnimated = () => !isBadge() && st.layers.some((l) => l.visible && (l.anim !== 'none' || l.type === 'effect'));

// ---------- Verlauf (Rückgängig) ----------
function pushHist(merge) {
  const now = Date.now();
  if (merge && now - lastPush < 600) { lastPush = now; return; }
  lastPush = merge ? now : 0;
  hist.push(JSON.stringify(st.layers));
  if (hist.length > 100) hist.shift();
  fut = [];
}
function restore(ls) {
  lastPush = 0;
  st.layers = ls;
  if (!ls.some((l) => l.id === st.sel)) st.sel = ls[ls.length - 1]?.id ?? null;
  syncImages();
  refresh();
}
function undo() { if (!hist.length) return; fut.push(JSON.stringify(st.layers)); restore(JSON.parse(hist.pop())); }
function redo() { if (!fut.length) return; hist.push(JSON.stringify(st.layers)); restore(JSON.parse(fut.pop())); }

function setLayers(ls) { st.layers = ls; dirty = true; }
function patchLayer(id, patch) { setLayers(st.layers.map((l) => (l.id === id ? { ...l, ...patch } : l))); }
function update(patch, merge = true) {
  const id = st.sel;
  if (!id) return;
  pushHist(merge);
  patchLayer(id, patch);
}
function addLayer(type, over) {
  pushHist(false);
  const L = mk(type, over);
  setLayers([...st.layers, L]);
  st.sel = L.id;
  st.tab = 'props';
  refresh();
}
function removeSel() {
  if (!st.sel) return;
  pushHist(false);
  setLayers(st.layers.filter((l) => l.id !== st.sel));
  st.sel = null;
  refresh();
}
function duplicate() {
  const L = selLayer();
  if (!L) return;
  pushHist(false);
  const c = { ...JSON.parse(JSON.stringify(L)), id: nid(), x: Math.min(0.95, L.x + 0.04), y: Math.min(0.95, L.y + 0.04) };
  if (imgs[L.id]) { imgs[c.id] = imgs[L.id]; orig[c.id] = orig[L.id]; imgKey[c.id] = imgKey[L.id]; }
  const i = st.layers.findIndex((l) => l.id === L.id);
  const n = [...st.layers];
  n.splice(i + 1, 0, c);
  setLayers(n);
  st.sel = c.id;
  refresh();
}
function moveLayer(id, d) {
  const i = st.layers.findIndex((l) => l.id === id);
  const j = i + d;
  if (j < 0 || j >= st.layers.length) return;
  pushHist(false);
  const n = [...st.layers];
  [n[i], n[j]] = [n[j], n[i]];
  setLayers(n);
  refresh();
}

// ---------- Bilder ----------
function loadFile(f) {
  if (!f || !f.type.startsWith('image/')) { note('Bitte eine Bilddatei wählen (PNG, JPG, GIF oder WebP).'); return; }
  if (f.size > 15 * 1024 * 1024) { note('Das Bild ist zu groß (höchstens 15 MB).'); return; }
  const url = URL.createObjectURL(f);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    // große Bilder verkleinern (reicht für 448 px bei 200 % Größe)
    const k = Math.min(1, 896 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * k));
    c.height = Math.max(1, Math.round(img.naturalHeight * k));
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, c.width, c.height);
    const L = mk('image');
    imgs[L.id] = c;
    orig[L.id] = c;
    imgKey[L.id] = 'aus';
    pushHist(false);
    setLayers([...st.layers, L]);
    st.sel = L.id;
    st.tab = 'props';
    if (st.name === 'emote' || TEMPLATES.some((tp) => tp.name === st.name)) st.name = (f.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '') || 'emote').slice(0, 20);
    note(f.type === 'image/gif' ? 'Bei GIFs wird nur das erste Bild verwendet.' : '');
    refresh();
  };
  img.onerror = () => { URL.revokeObjectURL(url); note('Das Bild ließ sich nicht öffnen.'); };
  img.src = url;
}

// Hintergrund entfernen: häufigste Randfarbe, Fläche vom Rand aus füllen (gleiche Farbe im Motiv bleibt), weiche Kante
function cutout(src, tol) {
  const w = src.width;
  const hgt = src.height;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = hgt;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(src, 0, 0);
  const im = g.getImageData(0, 0, w, hgt);
  const d = im.data;
  const n = w * hgt;
  const bins = new Map();
  const add = (i) => {
    const p = i * 4;
    if (d[p + 3] < 16) return;
    const k = ((d[p] >> 4) << 8) | ((d[p + 1] >> 4) << 4) | (d[p + 2] >> 4);
    const b = bins.get(k) ?? [0, 0, 0, 0];
    b[0] += d[p]; b[1] += d[p + 1]; b[2] += d[p + 2]; b[3]++;
    bins.set(k, b);
  };
  for (let x = 0; x < w; x++) { add(x); add((hgt - 1) * w + x); }
  for (let y = 1; y < hgt - 1; y++) { add(y * w); add(y * w + w - 1); }
  let best = null;
  for (const b of bins.values()) if (!best || b[3] > best[3]) best = b;
  if (!best) return c; // Rand schon durchsichtig
  const key = best.slice(0, 3).map((v) => v / best[3]);
  const th = (tol / 100) * 190 + 6;
  const soft = 22;
  const dist = (i) => { const p = i * 4; return Math.hypot(d[p] - key[0], d[p + 1] - key[1], d[p + 2] - key[2]); };
  const gone = new Uint8Array(n);
  const stack = new Int32Array(n);
  let sp = 0;
  const push = (i) => { if (!gone[i] && (d[i * 4 + 3] < 16 || dist(i) < th)) { gone[i] = 1; stack[sp++] = i; } };
  for (let x = 0; x < w; x++) { push(x); push((hgt - 1) * w + x); }
  for (let y = 0; y < hgt; y++) { push(y * w); push(y * w + w - 1); }
  while (sp) {
    const i = stack[--sp];
    const x = i % w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (i >= w) push(i - w);
    if (i < n - w) push(i + w);
  }
  for (let i = 0; i < n; i++) {
    if (gone[i]) { d[i * 4 + 3] = 0; continue; }
    const x = i % w;
    const edge = (x > 0 && gone[i - 1]) || (x < w - 1 && gone[i + 1]) || (i >= w && gone[i - w]) || (i < n - w && gone[i + w]);
    if (edge) { const e = dist(i); if (e < th + soft) d[i * 4 + 3] = Math.min(d[i * 4 + 3], Math.round((255 * (e - th)) / soft)); }
  }
  g.putImageData(im, 0, 0);
  return c;
}
function applyCutout(L) {
  const want = L.bgRemoved ? `an:${L.tol}` : 'aus';
  if (imgKey[L.id] === want || !orig[L.id]) return;
  imgs[L.id] = L.bgRemoved ? cutout(orig[L.id], L.tol) : orig[L.id];
  imgKey[L.id] = want;
  dirty = true;
}
function syncImages() { for (const L of st.layers) if (L.type === 'image') applyCutout(L); }

// ---------- Zeichnen ----------
const offs = {};
function off(S, k) {
  const id = `${S}_${k}`;
  if (!offs[id]) { const c = document.createElement('canvas'); c.width = c.height = S; offs[id] = c; }
  return offs[id];
}
function bounds(L, S, g) {
  const r = S * 0.36;
  if (L.type === 'shape') return { hw: r * 1.04, hh: r * 1.04 };
  if (L.type === 'effect') return { hw: S / 2, hh: S / 2 };
  if (L.type === 'text') {
    const fs = S * 0.3;
    g.save();
    g.font = FONT_CSS[L.font].replace('{s}', fs);
    const w = g.measureText(L.text || ' ').width;
    g.restore();
    return { hw: w / 2 + fs * 0.12, hh: fs * 0.62 };
  }
  const im = imgs[L.id];
  if (!im) return { hw: r, hh: r };
  const m = (S * 0.84) / Math.max(im.width, im.height);
  return { hw: (im.width * m) / 2, hh: (im.height * m) / 2 };
}
function content(o, L, S, tt) {
  const u = S / WORK;
  const r = S * 0.36;
  o.lineJoin = 'round';
  o.lineCap = 'round';
  if (L.type === 'shape') {
    o.beginPath();
    if (L.shape === 'circle') o.arc(0, 0, r, 0, TAU);
    else if (L.shape === 'rounded') o.roundRect(-r, -r, 2 * r, 2 * r, r * 0.3);
    else if (L.shape === 'star') polyStar(o, 5, r * 1.08, r * 0.5);
    else if (L.shape === 'burst') polyStar(o, 14, r * 1.04, r * 0.8);
    else if (L.shape === 'heart') heartPath(o, 0, r * 0.25, r * 1.35);
    else if (L.shape === 'bubble') { o.roundRect(-r, -r * 0.82, 2 * r, r * 1.45, r * 0.38); o.moveTo(-r * 0.4, r * 0.6); o.lineTo(-r * 0.6, r * 1.0); o.lineTo(-r * 0.02, r * 0.6); }
    o.fillStyle = L.fill;
    o.fill('nonzero');
    if (L.strokeW > 0) {
      o.lineWidth = L.strokeW * u;
      o.strokeStyle = L.stroke;
      o.stroke();
      if (L.shape === 'bubble') { o.beginPath(); o.moveTo(-r * 0.37, r * 0.6 - L.strokeW * u); o.lineTo(-r * 0.56, r * 0.93); o.lineTo(-r * 0.06, r * 0.6 - L.strokeW * u); o.fill(); }
    }
  } else if (L.type === 'text') {
    const fs = S * 0.3;
    o.font = FONT_CSS[L.font].replace('{s}', fs);
    o.textAlign = 'center';
    o.textBaseline = 'middle';
    if (L.strokeW > 0) { o.lineWidth = L.strokeW * u * 1.6; o.strokeStyle = L.stroke; o.strokeText(L.text, 0, fs * 0.04); }
    o.fillStyle = L.fill;
    o.fillText(L.text, 0, fs * 0.04);
  } else if (L.type === 'image') {
    const im = imgs[L.id];
    if (!im) return;
    const m = (S * 0.84) / Math.max(im.width, im.height);
    o.imageSmoothingQuality = 'high';
    o.drawImage(im, (-im.width * m) / 2, (-im.height * m) / 2, im.width * m, im.height * m);
  } else if (L.type === 'effect') {
    o.translate(-S / 2, -S / 2);
    drawExtras(o, S, L.effect, tt);
  }
}
function layerPose(L, time) {
  if (isBadge()) return { p: pose('none', 0), room: 1, tt: 0.3 };
  const tt = (((time + L.offset / 100) % 1) + 1) % 1;
  if (L.anim === 'custom') {
    const v = interpKeys(L.keys, tt, L.ease);
    return { p: { dx: v.dx / 100, dy: v.dy / 100, rot: (v.rot * Math.PI) / 180, sx: v.s / 100, sy: v.s / 100, hue: 0, alpha: 1 }, room: 1, tt };
  }
  const k = L.strength / 100;
  return { p: pose(L.anim, tt, k), room: 1 - (1 - (ROOM[L.anim] ?? 1)) * Math.min(1.5, k), tt };
}
// Farbton drehen ohne ctx.filter (z. B. ältere Safari-Versionen)
function hueRotate(c, deg) {
  const g = c.getContext('2d', { willReadFrequently: true });
  const im = g.getImageData(0, 0, c.width, c.height);
  const d = im.data;
  const a = (deg * Math.PI) / 180;
  const co = Math.cos(a);
  const si = Math.sin(a);
  const m = [0.213 + co * 0.787 - si * 0.213, 0.715 - co * 0.715 - si * 0.715, 0.072 - co * 0.072 + si * 0.928,
    0.213 - co * 0.213 + si * 0.143, 0.715 + co * 0.285 + si * 0.14, 0.072 - co * 0.072 - si * 0.283,
    0.213 - co * 0.213 - si * 0.787, 0.715 - co * 0.715 + si * 0.715, 0.072 + co * 0.928 + si * 0.072];
  for (let p = 0; p < d.length; p += 4) {
    if (!d[p + 3]) continue;
    const r = d[p]; const gg = d[p + 1]; const b = d[p + 2];
    d[p] = m[0] * r + m[1] * gg + m[2] * b;
    d[p + 1] = m[3] * r + m[4] * gg + m[5] * b;
    d[p + 2] = m[6] * r + m[7] * gg + m[8] * b;
  }
  g.putImageData(im, 0, 0);
}
function drawLayer(g, L, S, time) {
  const { p, room, tt } = layerPose(L, time);
  const a = off(S, 'a');
  const o = a.getContext('2d');
  o.setTransform(1, 0, 0, 1, 0, 0);
  o.clearRect(0, 0, S, S);
  o.save();
  o.translate(L.x * S + p.dx * S, L.y * S + p.dy * S);
  o.rotate((L.rot * Math.PI) / 180 + p.rot);
  const sc = (L.scale / 100) * room;
  o.scale(sc * p.sx * (L.flip ? -1 : 1), sc * p.sy);
  content(o, L, S, tt);
  o.restore();
  let src = a;
  if (L.outline > 0) {
    const b = off(S, 'b');
    const ob = b.getContext('2d');
    ob.globalCompositeOperation = 'source-over';
    ob.clearRect(0, 0, S, S);
    ob.drawImage(a, 0, 0);
    ob.globalCompositeOperation = 'source-in';
    ob.fillStyle = L.outlineColor;
    ob.fillRect(0, 0, S, S);
    ob.globalCompositeOperation = 'source-over';
    const c = off(S, 'c');
    const oc = c.getContext('2d');
    oc.clearRect(0, 0, S, S);
    const w = (L.outline * S) / WORK;
    for (let i = 0; i < 16; i++) { const an = (i / 16) * TAU; oc.drawImage(b, Math.cos(an) * w, Math.sin(an) * w); }
    oc.drawImage(a, 0, 0);
    src = c;
  }
  if (p.hue && !CAN_FILTER) hueRotate(src, p.hue);
  g.save();
  g.globalAlpha = (L.opacity / 100) * p.alpha;
  if (p.hue && CAN_FILTER) g.filter = `hue-rotate(${p.hue}deg)`;
  if (L.shadow) { g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = S * 0.03; g.shadowOffsetY = S * 0.025; }
  g.drawImage(src, 0, 0);
  g.restore();
}
function render(g, S, time) {
  g.clearRect(0, 0, S, S);
  for (const L of st.layers) if (L.visible) drawLayer(g, L, S, time);
}

// ---------- DOM ----------
const canvas = $('#ee-canvas');
const ctx = canvas.getContext('2d');
const over = $('#ee-over');
const octx = over.getContext('2d');
const right = $('#ee-right');
let noteTimer = 0;
function note(text) {
  $('#ee-note').textContent = text;
  $('#ee-note').hidden = !text;
  clearTimeout(noteTimer);
  if (text) noteTimer = setTimeout(() => { $('#ee-note').hidden = true; }, 6000);
}

const chk = () => ({ check: 'repeating-conic-gradient(var(--color-neutral-800) 0 25%, var(--color-neutral-900) 0 50%) 0 0 / 24px 24px', dark: '#18181b', light: '#ffffff' })[st.bg];

function renderHead() {
  $('#ee-undo').disabled = !hist.length;
  $('#ee-redo').disabled = !fut.length;
  document.querySelectorAll('[name="ee-fmt"]').forEach((r) => { r.checked = r.value === st.fmt; });
  if (document.activeElement !== $('#ee-name')) $('#ee-name').value = st.name;
}

function renderLayers() {
  const box = $('#ee-layers');
  const ordered = [...st.layers].reverse();
  $('#ee-layers-empty').hidden = st.layers.length > 0;
  box.replaceChildren(...ordered.map((l) => {
    const i = st.layers.indexOf(l);
    return h('div', { class: `ee-layer${l.id === st.sel ? ' is-sel' : ''}${l.visible ? '' : ' is-off'}`, 'data-pick': l.id },
      h('button', { type: 'button', class: 'ee-ic', title: 'Ein-/ausblenden', 'aria-label': `${layerName(l)} ein- oder ausblenden`, 'data-toggle': l.id }, h('i', { class: l.visible ? 'ph ph-eye' : 'ph ph-eye-slash', 'aria-hidden': 'true' })),
      h('i', { class: `${TYPE_ICON[l.type]} ee-ltype`, 'aria-hidden': 'true' }),
      h('button', { type: 'button', class: 'ee-lname', 'data-pick': l.id, 'aria-pressed': String(l.id === st.sel) },
        h('span', {}, layerName(l)), h('small', {}, animOf(l))),
      h('span', { class: 'ee-updown' },
        h('button', { type: 'button', class: 'ee-ic', title: 'Nach vorne', 'aria-label': 'Nach vorne', 'data-move': `${l.id}:1`, disabled: i >= st.layers.length - 1 }, h('i', { class: 'ph ph-caret-up', 'aria-hidden': 'true' })),
        h('button', { type: 'button', class: 'ee-ic', title: 'Nach hinten', 'aria-label': 'Nach hinten', 'data-move': `${l.id}:-1`, disabled: i <= 0 }, h('i', { class: 'ph ph-caret-down', 'aria-hidden': 'true' }))));
  }));
}

function renderStage() {
  $('#ee-stage').style.background = chk();
  $('#ee-empty').hidden = st.layers.length > 0;
  over.style.cursor = selLayer() ? 'move' : 'default';
  document.querySelectorAll('[name="ee-bg"]').forEach((r) => { r.checked = r.value === st.bg; });
  const sizes = FORMATS[st.fmt].sizes;
  const chatPx = isBadge() ? 36 : 56;
  const mini = (px, disp = px) => h('canvas', { 'data-mini': '', width: px, height: px, style: { width: `${disp}px`, height: `${disp}px`, borderRadius: '4px', background: chk() } });
  $('#ee-stage-sizes').replaceChildren(...sizes.slice(1).map((px) => h('figure', {}, mini(px), h('figcaption', {}, `${px} px`))));
  const chatImg = () => h('canvas', { 'data-mini': '', width: chatPx, height: chatPx, class: 'ee-chat-img' });
  $('#ee-chats').replaceChildren(
    h('div', { class: 'ee-chat is-dark' }, h('b', {}, 'spitzefluke:'), ' das war knapp ', chatImg(), ' ', chatImg()),
    h('div', { class: 'ee-chat is-light' }, h('b', {}, 'zuschauer42:'), ' ', chatImg(), ' lol'),
  );
}

// Bausteine für das rechte Feld
const cap = (text) => h('div', { class: 'ee-cap' }, text);
const rangeEl = (label, value, unit, attrs) => h('label', { class: 'ee-range' },
  h('span', { class: 'ee-rl' }, h('span', {}, label), h('span', { class: 'ee-rv' }, `${value}${unit}`)),
  h('input', { type: 'range', value, 'data-unit': unit, ...attrs }));
const field = (L, label, key, min, max, unit = '', step = 1) => rangeEl(label, L[key], unit, { min, max, step, 'data-k': key, 'data-t': 'num' });
const colorEl = (L, label, key) => h('label', { class: 'ee-color' }, h('input', { type: 'color', value: L[key], 'data-k': key, 'data-t': 'str' }), label);
const checkEl = (L, label, key) => h('label', { class: 'ee-check' }, h('input', { type: 'checkbox', checked: !!L[key], 'data-k': key, 'data-t': 'bool' }), label);
const chip = (on, attrs, ...kids) => h('button', { type: 'button', class: `ee-chip${on ? ' is-on' : ''}`, 'aria-pressed': String(on), ...attrs }, ...kids);
const tile = (on, attrs, ...kids) => h('button', { type: 'button', class: `ee-tile${on ? ' is-on' : ''}`, 'aria-pressed': String(on), ...attrs }, ...kids);
const newMark = () => h('span', { class: 'ee-new' }, 'neu');

function renderRight() {
  const L = selLayer();
  if (!L) {
    right.replaceChildren(h('div', { class: 'ee-nosel' },
      h('i', { class: 'ph ph-cursor-click', 'aria-hidden': 'true' }),
      h('div', { class: 'ee-nosel-t' }, 'Nichts ausgewählt'),
      h('p', {}, 'Klicke auf der Fläche oder in der Ebenen-Liste auf ein Element, um es zu bearbeiten und zu animieren.')));
    return;
  }
  const scroll = right.querySelector('.ee-props')?.scrollTop ?? 0;
  const head = h('div', { class: 'ee-selhead' },
    h('i', { class: TYPE_ICON[L.type], 'aria-hidden': 'true' }),
    h('span', { class: 'ee-selname', id: 'ee-selname' }, layerName(L)),
    h('button', { type: 'button', class: 'btn btn-secondary btn-icon ee-sm', title: 'Duplizieren (Strg+D)', 'aria-label': 'Duplizieren', 'data-act': 'dup' }, h('i', { class: 'ph ph-copy', 'aria-hidden': 'true' })),
    h('button', { type: 'button', class: 'btn btn-secondary btn-icon ee-sm', title: 'Löschen (Entf)', 'aria-label': 'Löschen', 'data-act': 'del' }, h('i', { class: 'ph ph-trash', 'aria-hidden': 'true' })));
  const tabs = h('div', { class: 'ee-tabs', role: 'tablist' },
    h('button', { type: 'button', role: 'tab', class: 'ee-tab', 'aria-selected': String(st.tab === 'props'), 'data-tab': 'props' }, h('i', { class: 'ph ph-sliders-horizontal', 'aria-hidden': 'true' }), 'Aussehen'),
    h('button', { type: 'button', role: 'tab', class: 'ee-tab', 'aria-selected': String(st.tab === 'anim'), 'data-tab': 'anim' }, h('i', { class: 'ph ph-film-strip', 'aria-hidden': 'true' }), 'Animation'));
  const body = h('div', { class: 'ee-props', role: 'tabpanel' }, ...(st.tab === 'props' ? propsTab(L) : animTab(L)));
  right.replaceChildren(head, tabs, body);
  body.scrollTop = scroll;
}

function propsTab(L) {
  const out = [];
  if (L.type === 'text') {
    out.push(h('section', { class: 'ee-sec' }, cap('Text'),
      h('input', { class: 'input', maxlength: 14, value: L.text, 'data-k': 'text', 'data-t': 'str', placeholder: 'z. B. GG, HYPE, LOL', 'aria-label': 'Text' }),
      h('div', { class: 'ee-chips' }, ...FONTS.map(([k, l]) => chip(L.font === k, { 'data-set': `font:${k}` }, l)))));
  }
  if (L.type === 'shape') {
    out.push(h('section', { class: 'ee-sec' }, cap('Form'),
      h('div', { class: 'ee-grid3' }, ...SHAPES.map(([k, l, ic]) => chip(L.shape === k, { 'data-set': `shape:${k}` }, h('i', { class: `ph ${ic}`, 'aria-hidden': 'true' }), l)))));
  }
  if (L.type === 'effect') {
    out.push(h('section', { class: 'ee-sec' }, cap('Effekt'),
      h('div', { class: 'ee-grid4' }, ...EXTRAS.map(([k, l, nw]) => tile(L.effect === k, { 'data-set': `effect:${k}`, title: l },
        h('canvas', { 'data-fx': k, width: 80, height: 80 }), h('span', {}, l), nw ? newMark() : null)))));
  }
  if (L.type === 'image') {
    out.push(h('section', { class: 'ee-sec' }, cap('Hintergrund entfernen'),
      h('div', { class: 'ee-chips' },
        h('button', { type: 'button', class: 'btn btn-primary', 'data-act': 'cut' }, h('i', { class: 'ph ph-magic-wand', 'aria-hidden': 'true' }), 'Automatisch'),
        L.bgRemoved ? h('button', { type: 'button', class: 'btn btn-ghost', 'data-act': 'uncut' }, 'Original') : null),
      field(L, 'Toleranz', 'tol', 0, 100),
      h('p', { class: 'ee-hint' }, 'Entfernt die Fläche am Rand in der häufigsten Randfarbe. Gleiche Farben im Motiv bleiben erhalten.')));
  }
  const hasFill = L.type === 'text' || L.type === 'shape';
  out.push(h('section', { class: 'ee-sec' }, cap('Farben'),
    h('div', { class: 'ee-colors' },
      hasFill ? colorEl(L, 'Füllung', 'fill') : null,
      hasFill ? colorEl(L, 'Kontur', 'stroke') : null,
      colorEl(L, 'Rand', 'outlineColor')),
    hasFill ? field(L, 'Konturstärke', 'strokeW', 0, 24) : null,
    field(L, 'Rand außen', 'outline', 0, 24),
    checkEl(L, 'Schatten darunter', 'shadow')));
  out.push(h('section', { class: 'ee-sec' },
    h('div', { class: 'ee-caprow' }, cap('Lage'), h('button', { type: 'button', class: 'btn btn-ghost ee-xs', 'data-act': 'center' }, 'Zentrieren')),
    h('div', { class: 'ee-grid2' },
      field(L, 'Größe', 'scale', 10, 300, ' %'),
      field(L, 'Drehen', 'rot', -180, 180, '°'),
      field(L, 'Deckkraft', 'opacity', 0, 100, ' %'),
      checkEl(L, 'Spiegeln', 'flip'))));
  return out;
}

function animTab(L) {
  const n = frames();
  const ct = snapT(st.ct);
  const out = [];
  if (isBadge()) out.push(h('p', { class: 'ee-box' }, 'Abo-Abzeichen können bei Twitch nicht animiert sein. Stell oben auf ', h('b', {}, 'Emote'), ', um Animationen zu sehen.'));
  out.push(h('div', { class: 'ee-grid2' },
    chip(L.anim === 'none', { 'data-anim': 'none', class: 'ee-chip ee-chip-l' }, h('i', { class: 'ph ph-prohibit', 'aria-hidden': 'true' }), 'Keine'),
    chip(L.anim === 'custom', { 'data-anim': 'custom', class: 'ee-chip ee-chip-l' }, h('i', { class: 'ph ph-bezier-curve', 'aria-hidden': 'true' }), 'Eigene bauen')));
  for (const [g, items] of ANIM_GROUPS) {
    out.push(h('section', { class: 'ee-sec ee-sec-tight' }, cap(g),
      h('div', { class: 'ee-grid4' }, ...items.map(([k, l, nw]) => tile(L.anim === k, { 'data-anim': k, title: l },
        h('canvas', { 'data-anim-prev': k, width: 80, height: 80 }), h('span', {}, l), nw ? newMark() : null)))));
  }
  if (L.anim === 'custom') {
    const kv = interpKeys(L.keys, ct, L.ease);
    const keyHere = L.keys.findIndex((k) => Math.abs(k.t - ct) < 0.5 / n);
    const kf = (label, f, min, max, unit = '') => rangeEl(label, Math.round(kv[f]), unit, { min, max, 'data-f': f });
    out.push(h('section', { class: 'ee-sec ee-custom' },
      h('div', { class: 'ee-custom-h' }, h('i', { class: 'ph ph-bezier-curve', 'aria-hidden': 'true' }), h('span', {}, 'Eigene Animation'), h('span', { class: 'ee-frame' }, `Bild ${Math.round(ct * n) + 1}`)),
      h('p', { class: 'ee-hint' }, 'Wähle unten in der Zeitleiste ein Bild und stell die Werte ein – dort entsteht ein Keyframe ◆. Dazwischen wird automatisch weich überblendet.'),
      h('div', { class: 'ee-grid2' }, kf('Links/Rechts', 'dx', -50, 50), kf('Hoch/Runter', 'dy', -50, 50), kf('Drehung', 'rot', -180, 180, '°'), kf('Größe', 's', 10, 200, ' %')),
      h('div', { class: 'ee-chips' }, ...L.keys.map((k) => chip(Math.abs(k.t - ct) < 0.5 / n, { 'data-jump': String(k.t), class: 'ee-chip ee-chip-xs' }, `◆ Bild ${Math.round(k.t * n) + 1}`))),
      h('div', { class: 'ee-keyrow' },
        h('button', { type: 'button', class: 'btn btn-secondary ee-xs', 'data-act': 'addkey' }, h('i', { class: 'ph ph-plus', 'aria-hidden': 'true' }), 'Keyframe'),
        h('button', { type: 'button', class: 'btn btn-secondary ee-xs', 'data-act': 'delkey', disabled: keyHere < 0 }, h('i', { class: 'ph ph-minus', 'aria-hidden': 'true' }), 'Löschen'),
        h('div', { class: 'seg ee-seg-s', role: 'radiogroup', 'aria-label': 'Übergang' },
          ...[['smooth', 'Weich'], ['linear', 'Gleichmäßig'], ['spring', 'Federnd']].map(([v, l]) => h('label', { class: 'seg-opt' }, h('input', { type: 'radio', name: 'ee-ease', value: v, checked: L.ease === v }), l))))));
  }
  out.push(h('section', { class: 'ee-sec' }, cap('Feinschliff'),
    field(L, 'Stärke', 'strength', 20, 150, ' %'),
    field(L, 'Startet versetzt', 'offset', 0, 95, ' %', 5),
    h('p', { class: 'ee-hint' }, 'Versatz lässt Ebenen nacheinander loslegen – z. B. erst die Form, dann der Text.')));
  return out;
}

function renderTimeline() {
  const n = frames();
  const ordered = [...st.layers].reverse();
  const badge = isBadge();
  $('#ee-ticks').replaceChildren(...Array.from({ length: n }, (_, i) => h('div', { class: `ee-tick${i % 5 === 0 ? ' is-major' : ''}` }, i % 5 === 0 ? String(i + 1) : '')));
  $('#ee-track-labels').replaceChildren(...ordered.map((l) => h('button', { type: 'button', class: `ee-tlabel${l.id === st.sel ? ' is-sel' : ''}${l.visible ? '' : ' is-off'}`, 'data-pick': l.id },
    h('i', { class: TYPE_ICON[l.type], 'aria-hidden': 'true' }), h('span', {}, layerName(l)))));
  $('#ee-lanes').replaceChildren(...ordered.map((l) => {
    const active = (l.anim !== 'none' || l.type === 'effect') && !badge;
    return h('div', { class: `ee-lane${l.id === st.sel ? ' is-sel' : ''}${l.visible ? '' : ' is-off'}` },
      h('div', { class: `ee-bar${active ? ' is-on' : ''}`, style: { left: `${l.offset}%` } }, badge ? 'statisch' : animOf(l)),
      ...(l.anim === 'custom' && !badge ? l.keys.map((k) => h('div', { class: 'ee-key', style: { left: `${(k.t + 0.5 / n) * 100}%` } })) : []));
  }));
  $('#ee-loop').textContent = badge ? 'Abo-Abzeichen sind statisch – die Zeitleiste ist pausiert.' : `${n} Bilder · ${(n * 0.04).toFixed(1).replace('.', ',')} s Schleife · Leertaste spielt ab, Klick in die Leiste springt zu einem Bild`;
  document.querySelectorAll('[name="ee-speed"]').forEach((r) => { r.checked = r.value === st.speed; });
  const play = $('#ee-play');
  play.replaceChildren(h('i', { class: st.playing ? 'ph ph-pause' : 'ph ph-play', 'aria-hidden': 'true' }));
  play.setAttribute('aria-label', st.playing ? 'Pausieren' : 'Abspielen');
}

function checks() {
  const n = frames();
  const out = [];
  const anim = isAnimated();
  if (!st.layers.length) out.push({ w: 1, text: 'Die Fläche ist leer – füge zuerst etwas hinzu.' });
  if (isBadge()) out.push({ i: 1, text: 'Abo-Abzeichen werden als PNG gespeichert (bei Twitch nicht animierbar), je höchstens 25 KB.' });
  else if (anim) out.push({ ok: 1, text: `Animiert: ${n} Bilder à 40 ms = ${(n * 0.04).toFixed(1).replace('.', ',')} s Schleife (Twitch erlaubt höchstens 60).` });
  else out.push({ i: 1, text: 'Keine Animation – wird als PNG mit durchsichtigem Hintergrund gespeichert.' });
  if (st.layers.some((l) => l.visible && l.type === 'text' && l.scale < 70)) out.push({ w: 1, text: 'Ein Text ist sehr klein – in 28 px kaum lesbar. Größer ziehen oder kürzer schreiben.' });
  if (st.layers.some((l) => l.visible && l.type === 'image' && !l.bgRemoved)) out.push({ w: 1, text: 'Ein Bild hat noch seinen Hintergrund. Im Aussehen-Tab „Automatisch“ entfernen.' });
  if (st.layers.length && !st.layers.some((l) => l.outline > 0 || l.shadow || (l.type !== 'effect' && l.type !== 'image' && l.strokeW > 0))) out.push({ w: 1, text: 'Kein Rand oder Schatten – auf dunklem Chat geht das Emote leicht unter.' });
  else if (st.layers.length) out.push({ ok: 1, text: 'Kontur vorhanden – hebt sich in hellem und dunklem Chat ab.' });
  if (anim) out.push({ i: 1, text: 'Animierte Emotes können Affiliates und Partner hochladen.' });
  return out;
}

function renderExport() {
  const dlg = $('#ee-dialog');
  if (dlg.hidden) return;
  const sizes = FORMATS[st.fmt].sizes;
  const anim = isAnimated();
  $('#ee-ex-sizes').replaceChildren(...sizes.map((px) => h('button', { type: 'button', class: 'ee-exsize', title: 'Nur diese Größe speichern', 'data-save': px },
    h('canvas', { 'data-mini': '', width: px, height: px, style: { width: `${px}px`, height: `${px}px`, borderRadius: '4px', background: chk() } }),
    h('span', {}, `${px} px · einzeln`))));
  $('#ee-ex-checks').replaceChildren(...checks().map((c) => h('li', {},
    h('i', { class: c.ok ? 'ph ph-check-circle is-ok' : c.w ? 'ph ph-warning is-warn' : 'ph ph-info', 'aria-hidden': 'true' }), h('span', {}, c.text))));
  $('#ee-ex-matte').hidden = !anim;
  document.querySelectorAll('[name="ee-matte"]').forEach((r) => { r.checked = r.value === st.matte; });
  $('#ee-ex-msg').textContent = st.exportMsg;
  $('#ee-ex-msg').hidden = !st.exportMsg;
  $('#ee-save').disabled = st.busy || !st.layers.length;
  $('#ee-save-label').textContent = st.busy ? 'Wird erstellt …' : `Alle Größen als ${anim ? 'GIF' : 'PNG'} (ZIP)`;
}

function refresh() {
  dirty = true;
  renderHead();
  renderLayers();
  renderStage();
  renderRight();
  renderTimeline();
  renderExport();
}
// leichte Aktualisierung während Regler gezogen werden (rechtes Feld bleibt stehen, damit der Fokus bleibt)
function refreshLight() {
  dirty = true;
  renderHead();
  renderLayers();
  renderTimeline();
  const L = selLayer();
  if (L && $('#ee-selname')) $('#ee-selname').textContent = layerName(L);
}

// ---------- Abspielen ----------
let last = 0;
let lastIdx = -1;
function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min(100, now - (last || now));
  last = now;
  const n = frames();
  const badge = isBadge();
  if (st.playing && !badge) t = (t + dt / (n * FRAME_MS)) % 1;
  const ft = Math.floor(t * n) / n;
  const idx = Math.round(ft * n);
  if (!dirty && idx === lastIdx && !st.playing) return;
  const heavy = dirty || idx !== lastIdx;
  dirty = false;
  lastIdx = idx;
  if (heavy) {
    render(ctx, WORK, ft);
    drawOverlay();
    document.querySelectorAll('canvas[data-mini]').forEach((c) => {
      const x = c.getContext('2d');
      x.clearRect(0, 0, c.width, c.height);
      x.imageSmoothingQuality = 'high';
      x.drawImage(canvas, 0, 0, c.width, c.height);
    });
  }
  // kleine Vorschauen der Bewegungen und Effekte (laufen weich mit)
  const tp = st.playing ? t : 0.3;
  right.querySelectorAll('canvas[data-anim-prev]').forEach((c) => {
    const x = c.getContext('2d');
    const Wd = c.width;
    const key = c.dataset.animPrev;
    x.clearRect(0, 0, Wd, Wd);
    const p = pose(key, tp, 1);
    const room = ROOM[key] ?? 1;
    x.save();
    x.translate(Wd / 2 + p.dx * Wd * 0.6, Wd / 2 + p.dy * Wd * 0.6);
    x.rotate(p.rot);
    x.scale(p.sx * room, p.sy * room);
    x.globalAlpha = p.alpha;
    if (p.hue && CAN_FILTER) x.filter = `hue-rotate(${p.hue}deg)`;
    x.beginPath();
    x.roundRect(-Wd * 0.26, -Wd * 0.26, Wd * 0.52, Wd * 0.52, Wd * 0.12);
    x.fillStyle = accent;
    x.fill();
    x.beginPath();
    x.arc(Wd * 0.1, -Wd * 0.08, Wd * 0.06, 0, TAU);
    x.arc(-Wd * 0.1, -Wd * 0.08, Wd * 0.06, 0, TAU);
    x.fillStyle = '#161826';
    x.fill();
    x.restore();
  });
  right.querySelectorAll('canvas[data-fx]').forEach((c) => { const x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.width); drawExtras(x, c.width, c.dataset.fx, tp); });
  $('#ee-head').style.left = `${(ft + 0.5 / n) * 100}%`;
  $('#ee-frame').textContent = `${idx + 1} / ${n}`;
}
function drawOverlay() {
  octx.clearRect(0, 0, WORK, WORK);
  const L = selLayer();
  if (!L || !L.visible || L.type === 'effect') return;
  const b = bounds(L, WORK, octx);
  const s = L.scale / 100;
  const hw = b.hw * s;
  const hh = b.hh * s;
  octx.save();
  octx.translate(L.x * WORK, L.y * WORK);
  octx.rotate((L.rot * Math.PI) / 180);
  octx.strokeStyle = accent;
  octx.lineWidth = 1.5;
  octx.setLineDash([5, 4]);
  octx.strokeRect(-hw, -hh, hw * 2, hh * 2);
  octx.setLineDash([]);
  octx.beginPath();
  octx.moveTo(0, -hh);
  octx.lineTo(0, -hh - 22);
  octx.stroke();
  octx.fillStyle = '#161826';
  [[-hw, -hh], [hw, -hh], [-hw, hh], [hw, hh]].forEach(([x, y]) => { octx.beginPath(); octx.rect(x - 5, y - 5, 10, 10); octx.fill(); octx.stroke(); });
  octx.beginPath();
  octx.arc(0, -hh - 26, 6, 0, TAU);
  octx.fill();
  octx.stroke();
  octx.restore();
}
function step(d) {
  const n = frames();
  const f = (((Math.round(t * n) + d) % n) + n) % n;
  t = f / n;
  st.playing = false;
  st.ct = t;
  dirty = true;
  renderTimeline();
  if (selLayer()?.anim === 'custom') renderRight();
}
function togglePlay() {
  t = snapT(t);
  st.playing = !st.playing;
  st.ct = t;
  dirty = true;
  renderTimeline();
}

// ---------- Ziehen auf der Fläche ----------
const toLocal = (L, px, py) => {
  const a = (-L.rot * Math.PI) / 180;
  const dx = px - L.x * WORK;
  const dy = py - L.y * WORK;
  return { lx: dx * Math.cos(a) - dy * Math.sin(a), ly: dx * Math.sin(a) + dy * Math.cos(a) };
};
function hit(L, px, py, pad = 0) {
  const b = bounds(L, WORK, octx);
  const s = L.scale / 100;
  const { lx, ly } = toLocal(L, px, py);
  return Math.abs(lx) <= b.hw * s + pad && Math.abs(ly) <= b.hh * s + pad;
}
function pointer(e) {
  const r = over.getBoundingClientRect();
  return { px: ((e.clientX - r.left) / r.width) * WORK, py: ((e.clientY - r.top) / r.height) * WORK };
}
function down(e) {
  const { px, py } = pointer(e);
  let L = selLayer();
  let mode = null;
  if (L && L.visible && L.type !== 'effect') {
    const b = bounds(L, WORK, octx);
    const s = L.scale / 100;
    const { lx, ly } = toLocal(L, px, py);
    const grab = e.pointerType === 'touch' ? 20 : 12;
    if (Math.hypot(lx, ly + b.hh * s + 26) < grab + 2) mode = 'rot';
    else if (Math.abs(Math.abs(lx) - b.hw * s) < grab && Math.abs(Math.abs(ly) - b.hh * s) < grab) mode = 'scale';
    else if (hit(L, px, py)) mode = 'move';
  }
  if (!mode) {
    const found = [...st.layers].reverse().find((l) => l.visible && l.type !== 'effect' && hit(l, px, py)) || null;
    if (!found) { if (st.sel) { st.sel = null; refresh(); } return; }
    L = found;
    mode = 'move';
    if (st.sel !== L.id) { st.sel = L.id; refresh(); }
  }
  e.preventDefault();
  over.setPointerCapture(e.pointerId);
  pushHist(false);
  const start = { px, py, x: L.x, y: L.y, scale: L.scale, dist: Math.hypot(px - L.x * WORK, py - L.y * WORK) || 1 };
  const id = L.id;
  const mv = (ev) => {
    const q = pointer(ev);
    let patch;
    if (mode === 'move') patch = { x: Math.max(-0.2, Math.min(1.2, start.x + (q.px - start.px) / WORK)), y: Math.max(-0.2, Math.min(1.2, start.y + (q.py - start.py) / WORK)) };
    else if (mode === 'scale') patch = { scale: Math.round(Math.max(10, Math.min(400, (start.scale * Math.hypot(q.px - start.x * WORK, q.py - start.y * WORK)) / start.dist))) };
    else {
      let deg = (Math.atan2(q.py - start.y * WORK, q.px - start.x * WORK) * 180) / Math.PI + 90;
      if (deg > 180) deg -= 360;
      if (ev.shiftKey) deg = Math.round(deg / 15) * 15;
      patch = { rot: Math.round(deg) };
    }
    patchLayer(id, patch);
  };
  const up = () => {
    over.removeEventListener('pointermove', mv);
    over.removeEventListener('pointerup', up);
    over.removeEventListener('pointercancel', up);
    renderRight();
  };
  over.addEventListener('pointermove', mv);
  over.addEventListener('pointerup', up);
  over.addEventListener('pointercancel', up);
}
function scrub(e) {
  const el = $('#ee-track');
  const at = (ev) => {
    const r = el.getBoundingClientRect();
    const f = Math.max(0, Math.min(0.9999, (ev.clientX - r.left) / r.width));
    const n = frames();
    t = Math.floor(f * n) / n;
    st.playing = false;
    st.ct = t;
    dirty = true;
    renderTimeline();
  };
  at(e);
  el.setPointerCapture(e.pointerId);
  const up = () => {
    el.removeEventListener('pointermove', at);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', up);
    if (selLayer()?.anim === 'custom') renderRight();
  };
  el.addEventListener('pointermove', at);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
}

// ---------- Animation einstellen ----------
function setKey(fieldName, val) {
  const L = selLayer();
  if (!L) return;
  const n = frames();
  const ft = snapT(t);
  t = ft;
  const cur = interpKeys(L.keys, ft, L.ease);
  const keys = [...L.keys];
  const i = keys.findIndex((k) => Math.abs(k.t - ft) < 0.5 / n);
  const nk = i >= 0 ? { ...keys[i] } : { t: ft, dx: Math.round(cur.dx), dy: Math.round(cur.dy), rot: Math.round(cur.rot), s: Math.round(cur.s) };
  if (fieldName) nk[fieldName] = val;
  if (i >= 0) keys[i] = nk; else keys.push(nk);
  st.playing = false;
  st.ct = ft;
  update({ keys: keys.sort((a, b) => a.t - b.t) }, !!fieldName);
}
function pickAnim(key) {
  const L = selLayer();
  if (!L) return;
  if (key === 'custom' && !L.keys.length) {
    const n = frames();
    let keys;
    if (L.anim !== 'none') {
      keys = [0, 0.25, 0.5, 0.75].map((x) => {
        const p = pose(L.anim, x, L.strength / 100);
        return { t: Math.round(x * n) / n, dx: Math.round(p.dx * 100), dy: Math.round(p.dy * 100), rot: Math.round((p.rot * 180) / Math.PI), s: Math.round(((p.sx + p.sy) / 2) * 100) };
      });
    } else keys = [{ t: 0, dx: 0, dy: 0, rot: 0, s: 100 }, { t: Math.round(n / 2) / n, dx: 0, dy: -15, rot: 0, s: 115 }];
    update({ anim: 'custom', keys }, false);
    t = 0;
    st.playing = false;
    st.ct = 0;
    refresh();
    return;
  }
  update({ anim: key }, false);
  if (!st.playing && key !== 'custom' && !reduced) st.playing = true;
  refresh();
}

// ---------- Export ----------
const CRC = (() => {
  const tb = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tb[n] = c >>> 0;
  }
  return tb;
})();
function crc32(b) {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
// ZIP ohne Kompression (PNG und GIF sind schon gepackt)
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
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(10, time, true); lh.setUint16(12, date, true);
    lh.setUint32(14, crc, true); lh.setUint32(18, size, true); lh.setUint32(22, size, true); lh.setUint16(26, name.length, true);
    parts.push(lh, name, f.data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(12, time, true); ch.setUint16(14, date, true);
    ch.setUint32(16, crc, true); ch.setUint32(20, size, true); ch.setUint32(24, size, true); ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
    central.push(ch, name);
    offset += 30 + name.length + size;
  }
  const cdSize = central.reduce((s, p) => s + p.byteLength, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end], { type: 'application/zip' });
}
function download(blob, name) {
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const kb = (bytes) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1048576).toFixed(1).replace('.', ',')} MB`);

async function saveSizes(list) {
  st.busy = true;
  st.exportMsg = 'Wird erstellt …';
  renderExport();
  await new Promise((r) => setTimeout(r, 30)); // Meldung zeigen, bevor gerechnet wird
  try {
    const animated = isAnimated();
    const n = frames();
    const limit = FORMATS[st.fmt].limit;
    const mod = animated ? await import('./gif-encode.js') : null;
    const files = [];
    for (const size of list) {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const g = c.getContext('2d', { willReadFrequently: true });
      let blob;
      if (animated) {
        const fr = [];
        for (let i = 0; i < n; i++) { render(g, size, i / n); fr.push(g.getImageData(0, 0, size, size)); }
        blob = mod.encodeGif(fr, { delayCs: FRAME_MS / 10, matte: MATTES[st.matte] });
      } else {
        render(g, size, isBadge() ? 0.3 : 0);
        blob = await new Promise((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error('PNG ließ sich nicht erzeugen'))), 'image/png'));
      }
      files.push({ size, blob, name: `${st.name || 'emote'}_${size}.${animated ? 'gif' : 'png'}` });
    }
    if (files.length === 1) download(files[0].blob, files[0].name);
    else {
      const entries = await Promise.all(files.map(async (f) => ({ name: f.name, data: new Uint8Array(await f.blob.arrayBuffer()) })));
      download(makeZip(entries), `${st.name || 'emote'}_${isBadge() ? 'abzeichen' : animated ? 'animiert' : 'emote'}.zip`);
    }
    const max = Math.max(...files.map((f) => f.blob.size));
    const tooBig = files.filter((f) => f.blob.size > limit).map((f) => `${f.size} px`);
    st.exportMsg = `${files.length} ${files.length === 1 ? 'Datei' : 'Dateien'} gespeichert${files.length > 1 ? ' (ZIP)' : ''} · größte ${kb(max)} `
      + (tooBig.length ? `– ${tooBig.join(', ')} ist zu groß für Twitch (höchstens ${kb(limit)})${animated ? ', Tempo „schnell“ hilft' : ''}.` : `✓ unter ${kb(limit)}`);
  } catch (err) {
    st.exportMsg = `Export fehlgeschlagen: ${err.message}`;
  }
  st.busy = false;
  renderExport();
}
let lastFocus = null;
function openExport() {
  lastFocus = document.activeElement;
  st.exportMsg = '';
  $('#ee-dialog').hidden = false;
  renderExport();
  dirty = true;
  $('#ee-save').focus();
}
function closeExport() {
  $('#ee-dialog').hidden = true;
  lastFocus?.focus?.();
}

// ---------- Bedienung ----------
function setup() {
  accent = getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim() || accent;
  // Schriften vorab laden, sonst zeichnet die Fläche beim ersten Mal die Ersatzschrift
  if (document.fonts) Promise.all(FONTS.map(([, , css]) => document.fonts.load(css.replace('{s}', 40), 'GG HYPE gn8'))).then(() => { dirty = true; }, () => { dirty = true; });

  $('#ee-name').addEventListener('input', (e) => { st.name = e.target.value.replace(/[^\w\-äöüß]/gi, '').slice(0, 20); });
  $('#ee-name').addEventListener('change', (e) => { e.target.value = st.name; });
  document.querySelectorAll('[name="ee-fmt"]').forEach((r) => r.addEventListener('change', () => { st.fmt = r.value; refresh(); }));
  document.querySelectorAll('[name="ee-bg"]').forEach((r) => r.addEventListener('change', () => { st.bg = r.value; renderStage(); renderExport(); dirty = true; }));
  document.querySelectorAll('[name="ee-speed"]').forEach((r) => r.addEventListener('change', () => { st.speed = r.value; t = snapT(t); refresh(); }));
  $('#ee-undo').addEventListener('click', undo);
  $('#ee-redo').addEventListener('click', redo);
  $('#ee-export').addEventListener('click', openExport);

  // Hinzufügen
  const file = $('#ee-file');
  file.addEventListener('change', () => { loadFile(file.files?.[0]); file.value = ''; });
  document.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.add;
    if (k === 'image') file.click();
    else if (k === 'text') addLayer('text', { y: 0.74, scale: 70 });
    else addLayer(k);
  }));
  $('#ee-templates').replaceChildren(...TEMPLATES.map((tp, i) => h('button', { type: 'button', class: 'ee-tpl', 'data-tpl': i }, h('i', { class: tp.icon, 'aria-hidden': 'true' }), tp.label)));
  $('#ee-templates').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tpl]');
    if (!b) return;
    const tp = TEMPLATES[Number(b.dataset.tpl)];
    pushHist(false);
    const l = tp.make();
    setLayers(l);
    st.sel = l[l.length - 1]?.id ?? null;
    st.tab = 'props';
    st.name = tp.name;
    if (!reduced) st.playing = true;
    refresh();
  });

  // Ebenen-Liste und Spuren der Zeitleiste
  const pickers = (e) => {
    const tog = e.target.closest('[data-toggle]');
    if (tog) {
      e.stopPropagation();
      pushHist(false);
      setLayers(st.layers.map((x) => (x.id === tog.dataset.toggle ? { ...x, visible: !x.visible } : x)));
      refresh();
      return;
    }
    const mvb = e.target.closest('[data-move]');
    if (mvb) { const [id, d] = mvb.dataset.move.split(':'); moveLayer(id, Number(d)); return; }
    const p = e.target.closest('[data-pick]');
    if (p && st.sel !== p.dataset.pick) { st.sel = p.dataset.pick; refresh(); }
  };
  $('#ee-layers').addEventListener('click', pickers);
  $('#ee-track-labels').addEventListener('click', pickers);

  // Fläche
  over.addEventListener('pointerdown', down);
  const mainEl = $('#ee-main');
  mainEl.addEventListener('dragover', (e) => { e.preventDefault(); $('#ee-drop').hidden = false; });
  mainEl.addEventListener('dragleave', (e) => { if (!mainEl.contains(e.relatedTarget)) $('#ee-drop').hidden = true; });
  mainEl.addEventListener('drop', (e) => { e.preventDefault(); $('#ee-drop').hidden = true; loadFile(e.dataTransfer?.files?.[0]); });
  window.addEventListener('paste', (e) => {
    const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith('image/'));
    if (f) loadFile(f);
  });

  // Rechtes Feld
  right.addEventListener('click', (e) => {
    const L = selLayer();
    const tab = e.target.closest('[data-tab]');
    if (tab) { st.tab = tab.dataset.tab; renderRight(); return; }
    const set = e.target.closest('[data-set]');
    if (set) { const [k, v] = set.dataset.set.split(':'); update({ [k]: v }, false); refresh(); return; }
    const an = e.target.closest('[data-anim]');
    if (an) { pickAnim(an.dataset.anim); return; }
    const jump = e.target.closest('[data-jump]');
    if (jump) { t = Number(jump.dataset.jump); st.playing = false; st.ct = t; dirty = true; renderTimeline(); renderRight(); return; }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act || !L) return;
    if (act === 'dup') duplicate();
    else if (act === 'del') removeSel();
    else if (act === 'center') { update({ x: 0.5, y: 0.5 }, false); renderRight(); }
    else if (act === 'cut') { update({ bgRemoved: true }, false); applyCutout(selLayer()); refresh(); }
    else if (act === 'uncut') { update({ bgRemoved: false }, false); applyCutout(selLayer()); refresh(); }
    else if (act === 'addkey') { setKey(null); refresh(); }
    else if (act === 'delkey') {
      const n = frames();
      const ct = snapT(st.ct);
      const i = L.keys.findIndex((k) => Math.abs(k.t - ct) < 0.5 / n);
      if (i >= 0) { update({ keys: L.keys.filter((_, j) => j !== i) }, false); refresh(); }
    }
  });
  let cutRaf = 0;
  const onField = (e, final) => {
    const el = e.target;
    const L = selLayer();
    if (!L) return;
    if (el.name === 'ee-ease') { if (final) { update({ ease: el.value }, false); refresh(); } return; }
    if (el.dataset.f) {
      setKey(el.dataset.f, Number(el.value));
      el.closest('.ee-range').querySelector('.ee-rv').textContent = `${el.value}${el.dataset.unit || ''}`;
      if (final) refresh(); else refreshLight();
      return;
    }
    const k = el.dataset.k;
    if (!k) return;
    let v = el.value;
    if (el.dataset.t === 'num') v = Number(v);
    if (el.dataset.t === 'bool') v = el.checked;
    if (L[k] === v && !final) return;
    update({ [k]: v });
    const rv = el.closest('.ee-range')?.querySelector('.ee-rv');
    if (rv) rv.textContent = `${v}${el.dataset.unit || ''}`;
    if (k === 'tol' && L.bgRemoved) {
      cancelAnimationFrame(cutRaf);
      cutRaf = requestAnimationFrame(() => applyCutout(selLayer()));
    }
    if (final && (el.type === 'checkbox')) refresh(); else refreshLight();
  };
  right.addEventListener('input', (e) => onField(e, false));
  right.addEventListener('change', (e) => onField(e, true));

  // Zeitleiste
  $('#ee-track').addEventListener('pointerdown', scrub);
  $('#ee-play').addEventListener('click', togglePlay);
  $('#ee-back').addEventListener('click', () => step(-1));
  $('#ee-fwd').addEventListener('click', () => step(1));

  // Export-Dialog
  $('#ee-dialog').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeExport(); });
  $('#ee-close').addEventListener('click', closeExport);
  $('#ee-save').addEventListener('click', () => saveSizes(FORMATS[st.fmt].sizes));
  $('#ee-ex-sizes').addEventListener('click', (e) => { const b = e.target.closest('[data-save]'); if (b && !st.busy) saveSizes([Number(b.dataset.save)]); });
  document.querySelectorAll('[name="ee-matte"]').forEach((r) => r.addEventListener('change', () => { st.matte = r.value; }));

  // Tastatur
  window.addEventListener('keydown', (e) => {
    if ($('#ee').hidden) return;
    if (!$('#ee-dialog').hidden) {
      if (e.key === 'Escape') { e.preventDefault(); closeExport(); }
      return;
    }
    const tag = (e.target.tagName || '').toLowerCase();
    if ((tag === 'input' && !['range', 'checkbox', 'radio'].includes(e.target.type)) || tag === 'textarea' || tag === 'select') return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (mod && k === 'y') { e.preventDefault(); redo(); return; }
    if (mod && k === 'd') { e.preventDefault(); duplicate(); return; }
    if (mod || e.altKey) return;
    if (tag === 'input' || tag === 'button') { if (k === ' ' || k.startsWith('arrow')) return; } // Regler und Knöpfe behalten ihre Tasten
    if (k === ' ') { e.preventDefault(); togglePlay(); }
    else if (k === 'delete' || k === 'backspace') { if (st.sel) { e.preventDefault(); removeSel(); } }
    else if (k === ',') step(-1);
    else if (k === '.') step(1);
    else if (k === 't') addLayer('text', { y: 0.74, scale: 70 });
    else if (k === 'f') addLayer('shape');
    else if (k === 'e') addLayer('effect');
    else if (k.startsWith('arrow')) {
      const L = selLayer();
      if (!L) return;
      e.preventDefault();
      const s = (e.shiftKey ? 10 : 1) / WORK;
      const d = { arrowleft: [-s, 0], arrowright: [s, 0], arrowup: [0, -s], arrowdown: [0, s] }[k];
      update({ x: L.x + d[0], y: L.y + d[1] });
    }
  });
  document.addEventListener('visibilitychange', () => { last = 0; });
}

// ---------- Zugang ----------
async function gate() {
  let ok = !MAX_ENFORCED;
  if (!ok) {
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
  }
  $('#ee-lock').hidden = ok;
  $('#ee').hidden = !ok;
  $('#ee-free').hidden = MAX_ENFORCED;
  if (!ok) return;
  refresh();
  requestAnimationFrame(tick);
}

setup();
gate();
