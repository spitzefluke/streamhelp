// Emote-Ersteller (emotes.html) – ein Extra von StreamHelp MAX. Läuft komplett im Browser: Bild laden,
// quadratisch zuschneiden, Hintergrundfarbe entfernen, Rand und Text dazu, Vorschau im Chat, als PNG in den
// Twitch-Größen 112, 56 und 28 Pixel speichern. Hochgeladen wird nichts.
// Ab dem Start von MAX (js/launch.js: max) nur mit MAX; bis dahin für alle zum Ausprobieren.
import { setupConsent } from './consent.js';
import { h } from './extras-core.js';
import { MAX_ENFORCED } from './pro.js';

setupConsent(); // Cookie-Fenster (js/consent.js)

const $ = (sel) => document.querySelector(sel);
const WORK = 448;                 // Arbeitsfläche (4 × 112)
const SIZES = [112, 56, 28];      // Twitch: Emotes in drei Größen, PNG, transparent, je höchstens 1 MB

const st = {
  img: null, zoom: 1, x: 0, y: 0,               // Bild, Zoom, Verschiebung in Arbeitsflächen-Pixeln
  key: null, tol: 40,                            // Hintergrundfarbe zum Entfernen und Toleranz
  border: 0, borderColor: '#ffffff',
  text: '', textColor: '#ffffff', textStroke: '#000000', textSize: 30, textPos: 'bottom',
  name: 'emote',
};

const work = $('#em-canvas');
const ctx = work.getContext('2d', { willReadFrequently: true });

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

// ---------- Bild laden ----------
function load(file) {
  if (!file || !file.type.startsWith('image/')) return say('Bitte eine Bilddatei wählen (PNG, JPG, GIF oder WebP).');
  if (file.size > 15 * 1024 * 1024) return say('Das Bild ist zu groß (höchstens 15 MB).');
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    st.img = img;
    st.zoom = 1; st.x = 0; st.y = 0; st.key = null;
    st.name = (file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '') || 'emote').slice(0, 20);
    $('#em-zoom').value = '1';
    $('#em-name').value = st.name;
    $('#em-key-swatch').style.background = 'transparent';
    $('#em-steps').hidden = false;
    say('');
    draw();
  };
  img.onerror = () => say('Das Bild ließ sich nicht öffnen.');
  img.src = url;
}

function say(text) { $('#em-note').textContent = text; }

// ---------- Zeichnen ----------
// Bild „cover“ in die Arbeitsfläche, mit Zoom und Verschiebung
function drawImage(c) {
  const { img } = st;
  const base = Math.max(WORK / img.width, WORK / img.height) * st.zoom;
  const w = img.width * base;
  const hgt = img.height * base;
  c.drawImage(img, (WORK - w) / 2 + st.x, (WORK - hgt) / 2 + st.y, w, hgt);
}

function removeKey(c) {
  if (!st.key) return;
  const data = c.getImageData(0, 0, WORK, WORK);
  const d = data.data;
  const [kr, kg, kb] = st.key;
  const tol = st.tol * 4.4; // 0–100 → Abstand im RGB-Raum (0–440)
  const soft = 24;
  for (let i = 0; i < d.length; i += 4) {
    const dist = Math.hypot(d[i] - kr, d[i + 1] - kg, d[i + 2] - kb);
    if (dist <= tol) d[i + 3] = 0;
    else if (dist <= tol + soft) d[i + 3] = Math.min(d[i + 3], Math.round(255 * (dist - tol) / soft));
  }
  c.putImageData(data, 0, 0);
}

// Sticker-Rand: die Form in vielen Richtungen versetzt einfärben und darunterlegen
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
  c.font = `900 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
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
  const l = layer.getContext('2d', { willReadFrequently: true });
  drawImage(l);
  removeKey(l);
  const bordered = addBorder(layer);
  const out = document.createElement('canvas');
  out.width = out.height = WORK;
  const o = out.getContext('2d');
  o.drawImage(bordered, 0, 0);
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
  const out = document.createElement('canvas');
  out.width = out.height = size;
  const oc = out.getContext('2d');
  oc.imageSmoothingQuality = 'high';
  oc.drawImage(cur, 0, 0, size, size);
  return out;
}

let result = null;
function draw() {
  if (!st.img) return;
  result = render();
  ctx.clearRect(0, 0, WORK, WORK);
  ctx.drawImage(result, 0, 0);
  const urls = SIZES.map((s) => scaled(result, s).toDataURL('image/png'));
  for (const [i, s] of SIZES.entries()) {
    document.querySelectorAll(`[data-em-size="${s}"]`).forEach((img) => { img.src = urls[i]; });
  }
  document.querySelectorAll('[data-em-chat]').forEach((img) => { img.src = urls[1]; });
}

// ---------- Bedienung ----------
function setup() {
  const file = $('#em-file');
  file.addEventListener('change', () => load(file.files?.[0]));
  const drop = $('#em-drop');
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove('is-over')));
  drop.addEventListener('drop', (e) => { e.preventDefault(); load(e.dataTransfer?.files?.[0]); });
  document.addEventListener('paste', (e) => {
    const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'));
    if (item) load(item.getAsFile());
  });

  const bind = (id, key, conv = (v) => v) => {
    const el = $(id);
    el.addEventListener('input', () => { st[key] = conv(el.value); draw(); });
  };
  bind('#em-zoom', 'zoom', Number);
  bind('#em-tol', 'tol', Number);
  bind('#em-border', 'border', Number);
  bind('#em-border-color', 'borderColor');
  bind('#em-text', 'text');
  bind('#em-text-color', 'textColor');
  bind('#em-text-stroke', 'textStroke');
  bind('#em-text-size', 'textSize', Number);
  bind('#em-text-pos', 'textPos');
  $('#em-name').addEventListener('input', (e) => { st.name = e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'emote'; });

  // Verschieben mit Maus/Finger; im Modus „Farbe wählen“ nimmt ein Klick die Hintergrundfarbe
  let picking = false;
  let drag = null;
  $('#em-pick').addEventListener('click', () => {
    picking = !picking;
    $('#em-pick').classList.toggle('is-on', picking);
    work.classList.toggle('is-picking', picking);
    say(picking ? 'Tippe auf die Farbe, die verschwinden soll.' : '');
  });
  $('#em-corner').addEventListener('click', () => {
    if (!st.img) return;
    const c = document.createElement('canvas');
    c.width = c.height = WORK;
    const cc = c.getContext('2d', { willReadFrequently: true });
    drawImage(cc);
    const p = cc.getImageData(2, 2, 1, 1).data;
    setKey([p[0], p[1], p[2]]);
  });
  $('#em-key-off').addEventListener('click', () => { st.key = null; $('#em-key-swatch').style.background = 'transparent'; draw(); });
  const pos = (e) => {
    const r = work.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (WORK / r.width), y: (e.clientY - r.top) * (WORK / r.height) };
  };
  work.addEventListener('pointerdown', (e) => {
    if (!st.img) return;
    const p = pos(e);
    if (picking) {
      const c = document.createElement('canvas');
      c.width = c.height = WORK;
      const cc = c.getContext('2d', { willReadFrequently: true });
      drawImage(cc);
      const px = cc.getImageData(Math.max(0, Math.min(WORK - 1, Math.round(p.x))), Math.max(0, Math.min(WORK - 1, Math.round(p.y))), 1, 1).data;
      setKey([px[0], px[1], px[2]]);
      picking = false;
      $('#em-pick').classList.remove('is-on');
      work.classList.remove('is-picking');
      say('');
      return;
    }
    drag = { sx: p.x, sy: p.y, x: st.x, y: st.y };
    work.setPointerCapture(e.pointerId);
  });
  work.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = pos(e);
    st.x = drag.x + (p.x - drag.sx);
    st.y = drag.y + (p.y - drag.sy);
    draw();
  });
  const end = () => { drag = null; };
  work.addEventListener('pointerup', end);
  work.addEventListener('pointercancel', end);

  $('#em-download').addEventListener('click', downloadAll);
}

function setKey(rgb) {
  st.key = rgb;
  $('#em-key-swatch').style.background = `rgb(${rgb.join(',')})`;
  draw();
}

async function downloadAll() {
  if (!result) return;
  for (const s of SIZES) {
    const blob = await new Promise((r) => scaled(result, s).toBlob(r, 'image/png'));
    if (!blob) continue;
    if (blob.size > 1024 * 1024) { say(`Achtung: ${s} px ist größer als 1 MB – Twitch nimmt es so nicht an.`); }
    const a = h('a', { href: URL.createObjectURL(blob), download: `${st.name}_${s}.png` });
    document.body.append(a);
    a.click();
    a.remove();
    await new Promise((r) => setTimeout(r, 250)); // manche Browser verschlucken sonst Downloads
  }
  say('Gespeichert: drei PNG-Dateien (112, 56 und 28 Pixel). Hochladen kannst du sie im Twitch-Creator-Dashboard unter „Emotes“.');
}

setup();
gate();
