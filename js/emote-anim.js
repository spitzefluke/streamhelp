// Animationen für den Emote-Ersteller (js/emotes-page.js): Bewegungen (Wackeln, Hüpfen, Drehen …) und Extras
// (Herzen, Funkeln, Tränen …). Alles hängt nur von t ∈ [0, 1) ab – so schließt die Schleife nahtlos.
// Twitch: animierte Emotes als GIF, höchstens 60 Bilder und 1 MB.

const TAU = Math.PI * 2;
const easeOut = (x) => 1 - (1 - x) ** 3;
const easeIn = (x) => x ** 3;
// fester Zufall je Zahl (für Zittern und Extras)
const rnd = (n) => { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };

export const ANIMS = [
  ['none', 'Keine'], ['shake', 'Wackeln'], ['bounce', 'Hüpfen'], ['spin', 'Drehen'], ['pulse', 'Pulsieren'],
  ['heart', 'Herzschlag'], ['wobble', 'Gummi'], ['float', 'Schweben'], ['flip', 'Wenden'], ['jitter', 'Zittern'],
  ['rave', 'Disco'], ['slide', 'Reinrutschen'], ['peek', 'Gucken'],
];
export const EXTRAS = [
  ['none', 'Keine'], ['hearts', 'Herzen'], ['sparkle', 'Funkeln'], ['tears', 'Tränen'], ['zzz', 'Zzz'],
  ['confetti', 'Konfetti'], ['notes', 'Musik'], ['fire', 'Feuer'],
];
// Etwas kleiner zeichnen, damit Bewegung nicht am Rand abgeschnitten wird (Anteil bei Stärke 100 %)
const ROOM = { shake: 0.9, bounce: 0.8, spin: 0.9, wobble: 0.9, float: 0.86, jitter: 0.9, rave: 0.94 };
export const SPEEDS = { slow: 40, normal: 30, fast: 20 }; // Bilder je Durchlauf (je 40 ms)
export const FRAME_CS = 4;

// Lage des Emotes zum Zeitpunkt t (Verschiebung in Anteilen der Größe, Drehung in Bogenmaß, Skalierung, Farbton)
export function pose(anim, t, k = 1) {
  const p = { dx: 0, dy: 0, rot: 0, sx: 1, sy: 1, hue: 0, hide: false };
  switch (anim) {
    case 'shake': p.rot = Math.sin(TAU * t * 2) * 0.3 * k; break;
    case 'bounce': {
      const u = Math.abs(Math.sin(TAU * t)); // zwei Sprünge je Durchlauf
      const squash = Math.max(0, 1 - u * 5);
      p.dy = -u * 0.2 * k;
      p.sy = 1 - squash * 0.16 * k;
      p.sx = 1 + squash * 0.12 * k;
      p.dy += (1 - p.sy) * 0.4 + 0.1 * k; // steht unten auf, springt nach oben
      break;
    }
    case 'spin': p.rot = TAU * t; break;
    case 'pulse': { const s = 1 - 0.2 * k * (0.5 - 0.5 * Math.cos(TAU * t)); p.sx = s; p.sy = s; break; }
    case 'heart': {
      const beat = (c) => Math.exp(-(((t - c) / 0.045) ** 2));
      const b = Math.max(beat(0.12), 0.75 * beat(0.32));
      const s = 1 - 0.16 * k * (1 - b);
      p.sx = s; p.sy = s;
      break;
    }
    case 'wobble': {
      const w = Math.sin(TAU * t * 2) * 0.12 * k;
      p.sx = 1 + w; p.sy = 1 - w;
      p.dy = (1 - p.sy) * 0.5;
      break;
    }
    case 'float': p.dy = Math.sin(TAU * t) * 0.07 * k; p.rot = Math.sin(TAU * t + 1) * 0.08 * k; break;
    case 'flip': p.sx = Math.cos(TAU * t); break;
    case 'jitter': {
      const f = Math.round(t * 997);
      p.dx = (rnd(f) - 0.5) * 0.08 * k;
      p.dy = (rnd(f + 7) - 0.5) * 0.08 * k;
      p.rot = (rnd(f + 13) - 0.5) * 0.14 * k;
      break;
    }
    case 'rave': p.hue = 360 * t; p.rot = Math.sin(TAU * t * 4) * 0.08 * k; break;
    case 'slide':
      if (t < 0.3) p.dx = -(1 - easeOut(t / 0.3)) * 1.1;
      else if (t < 0.4) p.rot = Math.sin(((t - 0.3) / 0.1) * Math.PI) * -0.12 * k;
      break;
    case 'peek':
      if (t < 0.25) p.dy = (1 - easeOut(t / 0.25)) * 1.05;
      else if (t < 0.75) p.rot = Math.sin(((t - 0.25) / 0.5) * TAU * 2) * 0.1 * k;
      else p.dy = easeIn((t - 0.75) / 0.25) * 1.05;
      break;
    default: break;
  }
  return p;
}

// Farbton drehen (wie CSS hue-rotate)
function hueRotate(d, deg) {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const m = [
    0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
    0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283,
    0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072,
  ];
  for (let p = 0; p < d.length; p += 4) {
    if (!d[p + 3]) continue;
    const r = d[p]; const g = d[p + 1]; const b = d[p + 2];
    d[p] = m[0] * r + m[1] * g + m[2] * b;
    d[p + 1] = m[3] * r + m[4] * g + m[5] * b;
    d[p + 2] = m[6] * r + m[7] * g + m[8] * b;
  }
}

// ---------- Extras ----------
function heart(g, x, y, s) {
  g.beginPath();
  g.moveTo(x, y + s * 0.35);
  g.bezierCurveTo(x - s * 0.95, y - s * 0.3, x - s * 0.4, y - s * 0.95, x, y - s * 0.38);
  g.bezierCurveTo(x + s * 0.4, y - s * 0.95, x + s * 0.95, y - s * 0.3, x, y + s * 0.35);
  g.closePath();
}
function star(g, x, y, s) {
  g.beginPath();
  g.moveTo(x, y - s);
  g.quadraticCurveTo(x, y, x + s, y);
  g.quadraticCurveTo(x, y, x, y + s);
  g.quadraticCurveTo(x, y, x - s, y);
  g.quadraticCurveTo(x, y, x, y - s);
  g.closePath();
}
function drop(g, x, y, s) {
  g.beginPath();
  g.moveTo(x, y - s);
  g.bezierCurveTo(x + s * 0.15, y - s * 0.5, x + s * 0.65, y, x + s * 0.65, y + s * 0.35);
  g.arc(x, y + s * 0.35, s * 0.65, 0, Math.PI);
  g.bezierCurveTo(x - s * 0.65, y, x - s * 0.15, y - s * 0.5, x, y - s);
  g.closePath();
}
const CONFETTI = ['#ff5a7a', '#ffd34d', '#4dd2ff', '#7cf29a', '#b78bff', '#ff9f4d'];

export function drawExtras(g, size, kind, t) {
  if (!kind || kind === 'none') return;
  const S = size;
  const line = Math.max(1, S / 56);
  g.save();
  g.lineJoin = 'round';
  const each = (n, fn) => { for (let i = 0; i < n; i++) fn(i, (t + i / n) % 1); };
  if (kind === 'hearts') {
    each(5, (i, u) => {
      g.globalAlpha = Math.sin(Math.PI * u);
      const x = (0.12 + 0.76 * rnd(i + 1) + Math.sin(TAU * (u + i * 0.3)) * 0.03) * S;
      heart(g, x, (1.02 - u * 1.05) * S, S * (0.1 + 0.04 * rnd(i + 5)));
      g.fillStyle = '#ff4d6d';
      g.strokeStyle = '#7a0f24';
      g.lineWidth = line;
      g.fill();
      g.stroke();
    });
  } else if (kind === 'sparkle') {
    each(6, (i, u) => {
      const a = (i / 6) * TAU + 0.5;
      const r = 0.38 + 0.06 * rnd(i);
      const sc = Math.max(0, Math.sin(Math.PI * u));
      if (sc < 0.05) return;
      star(g, (0.5 + Math.cos(a) * r) * S, (0.5 + Math.sin(a) * r) * S, S * 0.1 * sc);
      g.fillStyle = '#fff6b8';
      g.strokeStyle = '#c78a00';
      g.lineWidth = line;
      g.fill();
      g.stroke();
    });
  } else if (kind === 'tears') {
    each(4, (i, u) => {
      const side = i % 2 ? 0.68 : 0.32;
      g.globalAlpha = Math.min(1, (1 - u) * 3);
      drop(g, (side + (i % 2 ? 0.03 : -0.03) * u) * S, (0.42 + u * 0.55) * S, S * 0.06);
      g.fillStyle = '#5ec8ff';
      g.strokeStyle = '#1b5a8a';
      g.lineWidth = line;
      g.fill();
      g.stroke();
    });
  } else if (kind === 'zzz') {
    each(3, (i, u) => {
      g.globalAlpha = Math.sin(Math.PI * u);
      const fs = S * (0.1 + u * 0.1);
      g.font = `800 ${fs}px Inter, system-ui, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const x = (0.66 + u * 0.24) * S;
      const y = (0.34 - u * 0.28) * S;
      g.lineWidth = Math.max(1.5, fs / 6);
      g.strokeStyle = '#1b1b3a';
      g.strokeText('Z', x, y);
      g.fillStyle = '#ffffff';
      g.fillText('Z', x, y);
    });
  } else if (kind === 'confetti') {
    each(14, (i, u) => {
      g.save();
      g.translate((0.04 + 0.92 * rnd(i + 3)) * S, (-0.08 + u * 1.16) * S);
      g.rotate(u * TAU * 2 + i);
      g.scale(1, Math.cos(u * TAU * 3 + i));
      g.fillStyle = CONFETTI[i % CONFETTI.length];
      g.fillRect(-S * 0.025, -S * 0.04, S * 0.05, S * 0.08);
      g.restore();
    });
  } else if (kind === 'notes') {
    each(4, (i, u) => {
      g.globalAlpha = Math.sin(Math.PI * u);
      const left = i % 2 === 0;
      const fs = S * 0.16;
      g.font = `700 ${fs}px "Segoe UI Symbol", "Noto Sans Symbols 2", system-ui, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const x = (left ? 0.14 - u * 0.06 : 0.86 + u * 0.06) * S + Math.sin(TAU * u * 2) * S * 0.03;
      const y = (0.7 - u * 0.6) * S;
      const ch = i % 3 ? '♪' : '♫';
      g.lineWidth = Math.max(1.5, fs / 7);
      g.strokeStyle = '#ffffff';
      g.strokeText(ch, x, y);
      g.fillStyle = '#7a3cff';
      g.fillText(ch, x, y);
    });
  } else if (kind === 'fire') {
    each(5, (i, u) => {
      const fs = S * (0.2 + 0.06 * Math.sin(TAU * (u * 2 + i * 0.4)));
      g.globalAlpha = 0.85 + 0.15 * Math.sin(TAU * u);
      g.font = `${fs}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'bottom';
      g.fillText('🔥', (0.1 + i * 0.2) * S, (1.02 - 0.03 * Math.sin(TAU * (u + i * 0.2))) * S);
    });
  }
  g.restore();
}

// Ein Bild der Animation: src ist das fertige (stehende) Emote, möglichst ≥ 2 × size
export function renderFrame(g, size, src, opts, t) {
  g.clearRect(0, 0, size, size);
  const k = (opts.strength ?? 100) / 100;
  const p = pose(opts.anim, t, k);
  const room = 1 - (1 - (ROOM[opts.anim] ?? 1)) * Math.min(1.5, k);
  g.save();
  g.imageSmoothingQuality = 'high';
  g.translate(size / 2 + p.dx * size, size / 2 + p.dy * size);
  g.rotate(p.rot);
  g.scale(p.sx * room, p.sy * room);
  g.drawImage(src, -size / 2, -size / 2, size, size);
  g.restore();
  if (p.hue) {
    const d = g.getImageData(0, 0, size, size);
    hueRotate(d.data, p.hue);
    g.putImageData(d, 0, 0);
  }
  drawExtras(g, size, opts.extras, t);
}

// Alle Bilder einer Größe als ImageData (für den GIF-Encoder)
export function animFrames(src, size, opts) {
  const n = SPEEDS[opts.speed] ?? SPEEDS.normal;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d', { willReadFrequently: true });
  const frames = [];
  for (let i = 0; i < n; i++) {
    renderFrame(g, size, src, opts, i / n);
    frames.push(g.getImageData(0, 0, size, size));
  }
  return frames;
}
