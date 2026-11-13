// Animationen und Effekte des Emote-Editors (js/emotes-page.js) – nach dem Entwurf „Emote Editor“ aus Claude Design.
// Bewegungen (pose), eigene Keyframe-Animationen (interpKeys) und Effekt-Ebenen (drawExtras). Alles hängt nur von
// t ∈ [0, 1) ab – so schließt die Schleife nahtlos. Twitch: animierte Emotes als GIF, höchstens 60 Bilder und 1 MB.
// „Tippen“ und „Welle“ (Gruppe „Nur für Text“) zeichnet der Editor selbst Buchstabe für Buchstabe.

const TAU = Math.PI * 2;
const easeOut = (x) => 1 - (1 - x) ** 3;
const easeIn = (x) => x ** 3;
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
const backOut = (x) => { const c = 1.70158; return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2; };
const rnd = (n) => { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };

export const ANIM_GROUPS = [
  ['Bewegung', [['shake', 'Wackeln'], ['bounce', 'Hüpfen'], ['spin', 'Drehen'], ['wobble', 'Gummi'], ['float', 'Schweben'], ['flip', 'Wenden'], ['jitter', 'Zittern'], ['sway', 'Schaukeln'], ['swing', 'Pendel'], ['orbit', 'Kreisen'], ['dance', 'Tanzen'], ['nod', 'Nicken'], ['squish', 'Quetschen'], ['shakex', 'Kopfschütteln'], ['wave', 'Winken'], ['excite', 'Aufgeregt'], ['figure8', 'Achterbahn', 1], ['wiggle', 'Zappeln', 1], ['skate', 'Gleiten', 1], ['zigzag', 'Zickzack', 1], ['bob', 'Wippen', 1]]],
  ['Sprünge & Tricks', [['hop', 'Seitenhüpfer', 1], ['jump', 'Großer Sprung', 1], ['tumble', 'Purzelbaum', 1], ['pirouette', 'Pirouette', 1], ['headbang', 'Headbangen', 1], ['quake', 'Erdbeben', 1]]],
  ['Rein & raus', [['slide', 'Rutschen'], ['peek', 'Gucken'], ['pop', 'Ploppen'], ['drop', 'Fallen'], ['zoom', 'Ranzoomen'], ['roll', 'Rollen'], ['rocket', 'Abheben'], ['fade', 'Einblenden']]],
  ['Betonung', [['pulse', 'Pulsieren'], ['heart', 'Herzschlag'], ['rave', 'Disco'], ['tada', 'Tada'], ['blink', 'Blinken'], ['glitch', 'Glitch'], ['breathe', 'Atmen'], ['stretch', 'Strecken'], ['rainbow', 'Regenbogen']]],
  ['Nur für Text', [['type', 'Tippen'], ['wavetext', 'Welle']]],
];
export const ANIM_LABEL = { none: 'Keine Animation', custom: 'Eigene Animation' };
ANIM_GROUPS.forEach(([, items]) => items.forEach(([k, l]) => { ANIM_LABEL[k] = l; }));
export const EXTRAS = [['hearts', 'Herzen'], ['sparkle', 'Funkeln'], ['tears', 'Tränen'], ['zzz', 'Zzz'], ['confetti', 'Konfetti'], ['notes', 'Musik'], ['fire', 'Feuer'], ['speed', 'Speed'], ['bang', 'Ausruf'], ['question', 'Fragen'], ['snow', 'Schnee'], ['dizzy', 'Schwindlig'], ['anger', 'Wut', 1], ['sweat', 'Schwitzen', 1], ['bubbles', 'Blasen', 1], ['lightning', 'Blitze', 1], ['coins', 'Münzen', 1], ['rings', 'Schockwelle', 1]];
export const EXTRA_LABEL = Object.fromEntries(EXTRAS.map(([k, l]) => [k, l]));
export const ROOM = { shake: 0.9, bounce: 0.8, spin: 0.9, wobble: 0.9, float: 0.86, jitter: 0.9, rave: 0.94, sway: 0.9, swing: 0.8, orbit: 0.84, dance: 0.86, glitch: 0.92, tada: 0.9, nod: 0.92, shakex: 0.88, wave: 0.8, excite: 0.9, breathe: 0.92, stretch: 0.78, hop: 0.82, figure8: 0.84, wiggle: 0.9, headbang: 0.85, pirouette: 0.92, skate: 0.84, zigzag: 0.86, jump: 0.74, quake: 0.86, tumble: 0.8, bob: 0.94 };
export const SPEEDS = { slow: 40, normal: 30, fast: 20 };

export function pose(anim, t, k = 1) {
  const p = { dx: 0, dy: 0, rot: 0, sx: 1, sy: 1, hue: 0, alpha: 1 };
  switch (anim) {
    case 'shake': p.rot = Math.sin(TAU * t * 2) * 0.3 * k; break;
    case 'bounce': { const u = Math.abs(Math.sin(TAU * t)); const sq = Math.max(0, 1 - u * 5); p.dy = -u * 0.2 * k; p.sy = 1 - sq * 0.16 * k; p.sx = 1 + sq * 0.12 * k; p.dy += (1 - p.sy) * 0.4 + 0.1 * k; break; }
    case 'spin': p.rot = TAU * t; break;
    case 'pulse': { const s = 1 - 0.2 * k * (0.5 - 0.5 * Math.cos(TAU * t)); p.sx = s; p.sy = s; break; }
    case 'heart': { const beat = (c) => Math.exp(-(((t - c) / 0.045) ** 2)); const b = Math.max(beat(0.12), 0.75 * beat(0.32)); const s = 1 - 0.16 * k * (1 - b); p.sx = s; p.sy = s; break; }
    case 'wobble': { const w = Math.sin(TAU * t * 2) * 0.12 * k; p.sx = 1 + w; p.sy = 1 - w; p.dy = (1 - p.sy) * 0.5; break; }
    case 'float': p.dy = Math.sin(TAU * t) * 0.07 * k; p.rot = Math.sin(TAU * t + 1) * 0.08 * k; break;
    case 'flip': p.sx = Math.cos(TAU * t); break;
    case 'jitter': { const f = Math.round(t * 997); p.dx = (rnd(f) - 0.5) * 0.08 * k; p.dy = (rnd(f + 7) - 0.5) * 0.08 * k; p.rot = (rnd(f + 13) - 0.5) * 0.14 * k; break; }
    case 'rave': p.hue = 360 * t; p.rot = Math.sin(TAU * t * 4) * 0.08 * k; break;
    case 'slide': if (t < 0.3) p.dx = -(1 - easeOut(t / 0.3)) * 1.1; else if (t < 0.4) p.rot = Math.sin(((t - 0.3) / 0.1) * Math.PI) * -0.12 * k; break;
    case 'peek': if (t < 0.25) p.dy = (1 - easeOut(t / 0.25)) * 1.05; else if (t < 0.75) p.rot = Math.sin(((t - 0.25) / 0.5) * TAU * 2) * 0.1 * k; else p.dy = easeIn((t - 0.75) / 0.25) * 1.05; break;
    case 'sway': p.rot = Math.sin(TAU * t) * 0.25 * k; p.dx = Math.sin(TAU * t) * 0.04 * k; break;
    case 'pop': { let s = 1; if (t < 0.25) s = backOut(t / 0.25); else if (t > 0.85) s = 1 - easeIn((t - 0.85) / 0.15); p.sx = p.sy = Math.max(0.001, s); break; }
    case 'nod': { const u = Math.max(0, Math.sin(TAU * t * 2)); p.dy = u * 0.05 * k; p.rot = u * 0.1 * k; p.sy = 1 - u * 0.05 * k; break; }
    case 'tada': if (t < 0.6) { const e = Math.sin((Math.PI * t) / 0.6); p.sx = p.sy = 1 + 0.12 * k * e; p.rot = Math.sin(TAU * t * 5) * 0.12 * k * e; } break;
    case 'swing': { const r = Math.sin(TAU * t) * 0.35 * k; p.rot = r; p.dx = -0.42 * Math.sin(r); p.dy = -0.42 * (1 - Math.cos(r)); break; }
    case 'squish': { const u = 0.5 - 0.5 * Math.cos(TAU * t * 2); p.sx = 1 + 0.16 * k * u; p.sy = 1 - 0.18 * k * u; p.dy = (1 - p.sy) * 0.45; break; }
    case 'orbit': p.dx = Math.cos(TAU * t) * 0.08 * k; p.dy = Math.sin(TAU * t) * 0.08 * k; break;
    case 'blink': { const u = (t * 2) % 1; p.alpha = 1 - 0.85 * Math.exp(-(((u - 0.5) / 0.06) ** 2)); break; }
    case 'drop':
      if (t < 0.3) p.dy = -(1 - easeIn(t / 0.3)) * 1.1;
      else if (t < 0.45) { const e = Math.sin((Math.PI * (t - 0.3)) / 0.15); p.sy = 1 - 0.22 * k * e; p.sx = 1 + 0.16 * k * e; p.dy = (1 - p.sy) * 0.45; }
      else if (t > 0.85) p.dy = easeIn((t - 0.85) / 0.15) * 1.1;
      break;
    case 'glitch': { const f = Math.floor(t * 30); if (rnd(f) > 0.6) { p.dx = (rnd(f + 3) - 0.5) * 0.16 * k; p.hue = (rnd(f + 5) - 0.5) * 240; p.sx = 1 + (rnd(f + 9) - 0.5) * 0.1 * k; } break; }
    case 'zoom': if (t < 0.3) { const e = easeOut(t / 0.3); p.sx = p.sy = 2.2 - 1.2 * e; p.alpha = e; } else if (t > 0.88) { const e = (t - 0.88) / 0.12; p.alpha = 1 - e; p.sx = p.sy = 1 - 0.3 * e; } break;
    case 'dance': p.dx = Math.sin(TAU * t * 2) * 0.06 * k; p.rot = Math.sin(TAU * t * 2) * 0.15 * k; p.dy = -Math.abs(Math.sin(TAU * t * 2)) * 0.06 * k; break;
    case 'shakex': p.dx = Math.sin(TAU * t * 3) * 0.06 * k * (0.6 + 0.4 * Math.cos(TAU * t)); p.rot = Math.sin(TAU * t * 3) * 0.04 * k; break;
    case 'wave': { const r = Math.sin(TAU * t * 2) * 0.3 * k; p.rot = r; p.dx = 0.42 * Math.sin(r); p.dy = 0.42 * (1 - Math.cos(r)); break; }
    case 'excite': { const u = Math.abs(Math.sin(TAU * t * 4)); p.dy = -u * 0.06 * k; p.sx = 1 + (1 - u) * 0.05 * k; p.sy = 1 - (1 - u) * 0.05 * k; break; }
    case 'roll': if (t < 0.3) { const e = easeOut(t / 0.3); p.dx = -(1 - e) * 1.2; p.rot = -(1 - e) * TAU; } else if (t > 0.8) { const e = easeIn((t - 0.8) / 0.2); p.dx = e * 1.2; p.rot = e * TAU; } break;
    case 'rocket': if (t < 0.35) p.dy = (1 - easeOut(t / 0.35)) * 1.1; else if (t < 0.7) p.dx = Math.sin(TAU * t * 9) * 0.012 * k; else { const e = easeIn((t - 0.7) / 0.3); p.dy = -e * 1.25; p.sy = 1 + e * 0.25 * k; p.sx = 1 - e * 0.1 * k; } break;
    case 'fade': p.alpha = Math.max(0, Math.min(1, t / 0.2, (1 - t) / 0.2)); p.sx = p.sy = 0.94 + 0.06 * p.alpha; break;
    case 'breathe': { const u = 0.5 - 0.5 * Math.cos(TAU * t); p.sx = 1 + 0.05 * k * u; p.sy = 1 + 0.08 * k * u; p.dy = -0.02 * k * u; break; }
    case 'stretch': { const u = Math.max(0, Math.sin(TAU * t)); p.sy = 1 + 0.3 * k * u; p.sx = 1 - 0.12 * k * u; p.dy = -(p.sy - 1) * 0.4; break; }
    case 'rainbow': p.hue = 360 * t; break;
    case 'hop': { const a = Math.abs(Math.sin(TAU * t)); const sq = Math.max(0, 1 - a * 6); p.dx = -Math.cos(TAU * t) * 0.08 * k; p.dy = -a * 0.12 * k + sq * 0.03 * k; p.rot = Math.sin(TAU * t) * 0.12 * k; p.sy = 1 - sq * 0.12 * k; p.sx = 1 + sq * 0.08 * k; break; }
    case 'figure8': p.dx = Math.sin(TAU * t) * 0.09 * k; p.dy = Math.sin(2 * TAU * t) * 0.05 * k; p.rot = Math.cos(TAU * t) * 0.1 * k; break;
    case 'wiggle': p.rot = Math.sin(TAU * t * 6) * 0.12 * k; p.sx = 1 + Math.sin(TAU * t * 6 + 1) * 0.03 * k; break;
    case 'skate': p.dx = Math.sin(TAU * t) * 0.12 * k; p.rot = Math.cos(TAU * t) * 0.15 * k; p.dy = -Math.abs(Math.cos(TAU * t)) * 0.02 * k; break;
    case 'zigzag': { const w = (t * 2) % 1; p.dx = (1 - 4 * Math.abs(w - 0.5)) * 0.1 * k; p.dy = (1 - 4 * Math.abs(((t * 4) % 1) - 0.5)) * 0.05 * k; break; }
    case 'bob': p.dy = Math.sin(TAU * t * 2) * 0.03 * k; p.sy = 1 + Math.sin(TAU * t * 2 + Math.PI / 2) * 0.03 * k; p.sx = 2 - p.sy; break;
    case 'jump':
      if (t < 0.2) { const e = Math.sin((Math.PI * t) / 0.2); p.sy = 1 - 0.2 * k * e; p.sx = 1 + 0.12 * k * e; p.dy = (1 - p.sy) * 0.45; }
      else if (t < 0.6) { const u = (t - 0.2) / 0.4; p.dy = -Math.sin(Math.PI * u) * 0.3 * k; p.sy = 1 + 0.1 * k * (1 - Math.sin(Math.PI * u)); p.sx = 2 - p.sy; }
      else if (t < 0.75) { const e = Math.sin((Math.PI * (t - 0.6)) / 0.15); p.sy = 1 - 0.18 * k * e; p.sx = 1 + 0.1 * k * e; p.dy = (1 - p.sy) * 0.45; }
      break;
    case 'tumble':
      if (t < 0.7) { const e = t / 0.7; p.dy = -Math.sin(Math.PI * e) * 0.25 * k; p.rot = easeInOut(e) * TAU; }
      else if (t < 0.85) { const e = Math.sin((Math.PI * (t - 0.7)) / 0.15); p.sy = 1 - 0.16 * k * e; p.sx = 1 + 0.1 * k * e; p.dy = (1 - p.sy) * 0.45; }
      break;
    case 'pirouette':
      if (t < 0.6) { const e = easeInOut(t / 0.6); p.rot = e * TAU; p.sx = 1 - Math.sin(Math.PI * e) * 0.15 * k; }
      else { const u = (t - 0.6) / 0.4; p.rot = Math.sin(u * TAU * 2) * 0.05 * k * (1 - u); }
      break;
    case 'headbang': { const u = Math.max(0, Math.sin(TAU * t * 4)); p.rot = Math.sqrt(u) * 0.28 * k; p.dy = u * 0.06 * k; break; }
    case 'quake': { const f = Math.floor(t * 60); const amp = 0.4 + 0.6 * Math.abs(Math.sin(TAU * t)); p.dx = (rnd(f) - 0.5) * 0.12 * k * amp; p.dy = (rnd(f + 2) - 0.5) * 0.12 * k * amp; p.rot = (rnd(f + 4) - 0.5) * 0.1 * k * amp; break; }
    default: break;
  }
  return p;
}

export const EASES = { smooth: easeInOut, linear: (x) => x, spring: (x) => Math.min(1.12, backOut(x)) };
export function interpKeys(keys, t, ease = 'smooth') {
  if (!keys || !keys.length) return { dx: 0, dy: 0, rot: 0, s: 100 };
  const ks = [...keys].sort((a, b) => a.t - b.t);
  if (ks.length === 1) return { ...ks[0] };
  let ai = -1;
  for (let i = 0; i < ks.length; i++) if (ks[i].t <= t + 1e-6) ai = i;
  const a = ai < 0 ? ks[ks.length - 1] : ks[ai];
  const b = ai < 0 ? ks[0] : ks[(ai + 1) % ks.length];
  const span = ((b.t - a.t + 1) % 1) || 1;
  const u = (((t - a.t) % 1) + 1) % 1 / span;
  const e = (EASES[ease] || easeInOut)(Math.min(1, u));
  const L = (x, y) => x + (y - x) * e;
  return { dx: L(a.dx, b.dx), dy: L(a.dy, b.dy), rot: L(a.rot, b.rot), s: L(a.s, b.s) };
}

export function heartPath(g, x, y, s) { g.beginPath(); g.moveTo(x, y + s * 0.35); g.bezierCurveTo(x - s * 0.95, y - s * 0.3, x - s * 0.4, y - s * 0.95, x, y - s * 0.38); g.bezierCurveTo(x + s * 0.4, y - s * 0.95, x + s * 0.95, y - s * 0.3, x, y + s * 0.35); g.closePath(); }
function sparkPath(g, x, y, s) { g.beginPath(); g.moveTo(x, y - s); g.quadraticCurveTo(x, y, x + s, y); g.quadraticCurveTo(x, y, x, y + s); g.quadraticCurveTo(x, y, x - s, y); g.quadraticCurveTo(x, y, x, y - s); g.closePath(); }
function dropPath(g, x, y, s) { g.beginPath(); g.moveTo(x, y - s); g.bezierCurveTo(x + s * 0.15, y - s * 0.5, x + s * 0.65, y, x + s * 0.65, y + s * 0.35); g.arc(x, y + s * 0.35, s * 0.65, 0, Math.PI); g.bezierCurveTo(x - s * 0.65, y, x - s * 0.15, y - s * 0.5, x, y - s); g.closePath(); }
export function polyStar(g, n, ro, ri) { g.beginPath(); for (let i = 0; i < n * 2; i++) { const r = i % 2 ? ri : ro; const a = (i / (n * 2)) * TAU - Math.PI / 2; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); }
const CONFETTI = ['#ff5a7a', '#ffd34d', '#4dd2ff', '#7cf29a', '#b78bff', '#ff9f4d'];

export function drawExtras(g, S, kind, t) {
  if (!kind || kind === 'none') return;
  const line = Math.max(1, S / 56);
  g.save(); g.lineJoin = 'round'; g.lineCap = 'round';
  const each = (n, fn) => { for (let i = 0; i < n; i++) { g.save(); fn(i, (t + i / n) % 1); g.restore(); } };
  const mark = (ch, x, y, fs, fill, stroke, w = '800') => { g.font = `${w} ${fs}px Inter, system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = Math.max(1.5, fs / 6); g.strokeStyle = stroke; g.strokeText(ch, x, y); g.fillStyle = fill; g.fillText(ch, x, y); };
  if (kind === 'hearts') each(5, (i, u) => { g.globalAlpha = Math.sin(Math.PI * u); heartPath(g, (0.12 + 0.76 * rnd(i + 1) + Math.sin(TAU * (u + i * 0.3)) * 0.03) * S, (1.02 - u * 1.05) * S, S * (0.1 + 0.04 * rnd(i + 5))); g.fillStyle = '#ff4d6d'; g.strokeStyle = '#7a0f24'; g.lineWidth = line; g.fill(); g.stroke(); });
  else if (kind === 'sparkle') each(6, (i, u) => { const a = (i / 6) * TAU + 0.5; const r = 0.38 + 0.06 * rnd(i); const sc = Math.max(0, Math.sin(Math.PI * u)); if (sc < 0.05) return; sparkPath(g, (0.5 + Math.cos(a) * r) * S, (0.5 + Math.sin(a) * r) * S, S * 0.1 * sc); g.fillStyle = '#fff6b8'; g.strokeStyle = '#c78a00'; g.lineWidth = line; g.fill(); g.stroke(); });
  else if (kind === 'tears') each(4, (i, u) => { const side = i % 2 ? 0.68 : 0.32; g.globalAlpha = Math.min(1, (1 - u) * 3); dropPath(g, (side + (i % 2 ? 0.03 : -0.03) * u) * S, (0.42 + u * 0.55) * S, S * 0.06); g.fillStyle = '#5ec8ff'; g.strokeStyle = '#1b5a8a'; g.lineWidth = line; g.fill(); g.stroke(); });
  else if (kind === 'zzz') each(3, (i, u) => { g.globalAlpha = Math.sin(Math.PI * u); mark('Z', (0.66 + u * 0.24) * S, (0.34 - u * 0.28) * S, S * (0.1 + u * 0.1), '#ffffff', '#1b1b3a'); });
  else if (kind === 'confetti') each(14, (i, u) => { g.translate((0.04 + 0.92 * rnd(i + 3)) * S, (-0.08 + u * 1.16) * S); g.rotate(u * TAU * 2 + i); g.scale(1, Math.cos(u * TAU * 3 + i)); g.fillStyle = CONFETTI[i % CONFETTI.length]; g.fillRect(-S * 0.025, -S * 0.04, S * 0.05, S * 0.08); });
  else if (kind === 'notes') each(4, (i, u) => { g.globalAlpha = Math.sin(Math.PI * u); const left = i % 2 === 0; const fs = S * 0.16; g.font = `700 ${fs}px "Segoe UI Symbol", "Noto Sans Symbols 2", system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; const x = (left ? 0.14 - u * 0.06 : 0.86 + u * 0.06) * S + Math.sin(TAU * u * 2) * S * 0.03; const y = (0.7 - u * 0.6) * S; const ch = i % 3 ? '♪' : '♫'; g.lineWidth = Math.max(1.5, fs / 7); g.strokeStyle = '#ffffff'; g.strokeText(ch, x, y); g.fillStyle = '#7a3cff'; g.fillText(ch, x, y); });
  else if (kind === 'fire') each(5, (i, u) => { const fs = S * (0.2 + 0.06 * Math.sin(TAU * (u * 2 + i * 0.4))); g.globalAlpha = 0.85 + 0.15 * Math.sin(TAU * u); g.font = `${fs}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'bottom'; g.fillText('🔥', (0.1 + i * 0.2) * S, (1.02 - 0.03 * Math.sin(TAU * (u + i * 0.2))) * S); });
  else if (kind === 'speed') each(6, (i, u) => { const y = (0.18 + 0.64 * rnd(i + 2)) * S; const len = S * (0.18 + 0.16 * rnd(i + 4)); const x = S * (1.15 - u * 1.5); g.globalAlpha = Math.sin(Math.PI * u); g.lineWidth = line * 4; g.strokeStyle = '#1b1b3a'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y); g.stroke(); g.lineWidth = line * 2.2; g.strokeStyle = '#ffffff'; g.stroke(); });
  else if (kind === 'bang') each(2, (i, u) => { const s = u < 0.2 ? backOut(u / 0.2) : u > 0.8 ? 1 - (u - 0.8) / 0.2 : 1; if (s <= 0.02) return; mark('!', (0.8 + i * 0.1) * S, (0.2 + i * 0.06) * S, S * 0.26 * s, '#ff4d4d', '#3a0000', '900'); });
  else if (kind === 'question') each(3, (i, u) => { g.globalAlpha = Math.sin(Math.PI * u); mark('?', (0.2 + i * 0.3 + Math.sin(TAU * u) * 0.03) * S, (0.32 - u * 0.24) * S, S * (0.14 + 0.04 * u), '#ffd34d', '#3a2a00', '900'); });
  else if (kind === 'snow') each(16, (i, u) => { g.globalAlpha = 0.9; g.beginPath(); g.arc(rnd(i) * S + Math.sin(TAU * (u + i * 0.1)) * S * 0.04, (-0.05 + u * 1.1) * S, S * (0.012 + 0.014 * rnd(i + 4)), 0, TAU); g.fillStyle = '#ffffff'; g.fill(); g.lineWidth = line * 0.6; g.strokeStyle = '#8fb3d9'; g.stroke(); });
  else if (kind === 'anger') { const r = S * 0.07 * (0.85 + 0.2 * Math.abs(Math.sin(TAU * t * 2))); g.translate(S * 0.8, S * 0.2); for (let q = 0; q < 4; q++) { g.rotate(TAU / 4); g.beginPath(); g.arc(r * 0.95, r * 0.95, r * 0.75, Math.PI, Math.PI * 1.5); g.lineWidth = line * 5; g.strokeStyle = '#3a0000'; g.stroke(); g.lineWidth = line * 2.8; g.strokeStyle = '#ff3b3b'; g.stroke(); } }
  else if (kind === 'sweat') each(2, (i, u) => { g.globalAlpha = Math.min(1, (1 - u) * 2.5, u * 8); dropPath(g, (i ? 0.2 : 0.8) * S, (0.16 + u * 0.3) * S, S * 0.07); g.fillStyle = '#8fd8ff'; g.strokeStyle = '#1b5a8a'; g.lineWidth = line; g.fill(); g.stroke(); });
  else if (kind === 'bubbles') each(8, (i, u) => { const r = S * (0.025 + 0.03 * rnd(i + 3)); const x = (0.1 + 0.8 * rnd(i)) * S + Math.sin(TAU * (u * 2 + i)) * S * 0.03; const y = (1.05 - u * 1.15) * S; g.globalAlpha = Math.min(1, (1 - u) * 4); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = 'rgba(191,232,255,0.2)'; g.fill(); g.lineWidth = line; g.strokeStyle = '#bfe8ff'; g.stroke(); g.beginPath(); g.arc(x - r * 0.35, y - r * 0.35, r * 0.25, 0, TAU); g.fillStyle = '#ffffff'; g.fill(); });
  else if (kind === 'lightning') each(2, (i, u) => { if ((u * 2) % 1 > 0.18) return; const B = [[0, 0], [-0.07, 0.17], [-0.01, 0.17], [-0.06, 0.33], [0.08, 0.12], [0.02, 0.12], [0.06, 0]]; g.translate((0.18 + 0.64 * i) * S, 0.03 * S); g.beginPath(); B.forEach(([x, y]) => g.lineTo(x * S, y * S)); g.closePath(); g.fillStyle = '#ffe14d'; g.strokeStyle = '#5a3d00'; g.lineWidth = line; g.fill(); g.stroke(); });
  else if (kind === 'coins') each(7, (i, u) => { const sx = Math.abs(Math.cos(TAU * (u * 2 + i * 0.3))) + 0.08; const r = S * 0.05; g.translate((0.08 + 0.84 * rnd(i + 11)) * S, (-0.08 + u * 1.16) * S); g.beginPath(); g.ellipse(0, 0, r * sx, r, 0, 0, TAU); g.fillStyle = '#ffc93c'; g.strokeStyle = '#7a5200'; g.lineWidth = line; g.fill(); g.stroke(); g.beginPath(); g.ellipse(0, 0, r * sx * 0.6, r * 0.6, 0, 0, TAU); g.stroke(); });
  else if (kind === 'rings') each(3, (i, u) => { g.globalAlpha = 1 - u; g.beginPath(); g.arc(S / 2, S / 2, Math.max(0.1, u * 0.55 * S), 0, TAU); g.lineWidth = line * (1 + 2.5 * (1 - u)); g.strokeStyle = '#ffffff'; g.stroke(); });
  else if (kind === 'dizzy') each(3, (i, u) => { const x = 0.5 * S + Math.cos(TAU * u) * 0.3 * S; const y = 0.16 * S + Math.sin(TAU * u) * 0.07 * S; g.globalAlpha = 0.65 + 0.35 * Math.sin(TAU * u); g.translate(x, y); polyStar(g, 5, S * 0.06, S * 0.028); g.fillStyle = '#fff6b8'; g.strokeStyle = '#c78a00'; g.lineWidth = line; g.fill(); g.stroke(); });
  g.restore();
}
