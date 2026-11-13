// Animationen und Effekte des Emote-Editors (js/emotes-page.js) – nach dem Entwurf „Emote Editor“ aus Claude Design.
// Bewegungen (pose), eigene Keyframe-Animationen (interpKeys) und Effekt-Ebenen (drawExtras). Alles hängt nur von
// t ∈ [0, 1) ab – so schließt die Schleife nahtlos. Twitch: animierte Emotes als GIF, höchstens 60 Bilder und 1 MB.

const TAU = Math.PI * 2;
const easeOut = (x) => 1 - (1 - x) ** 3;
const easeIn = (x) => x ** 3;
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
const backOut = (x) => { const c = 1.70158; return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2; };
const rnd = (n) => { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };

export const ANIM_GROUPS = [
  ['Bewegung', [['shake', 'Wackeln'], ['bounce', 'Hüpfen'], ['spin', 'Drehen'], ['wobble', 'Gummi'], ['float', 'Schweben'], ['flip', 'Wenden'], ['jitter', 'Zittern'], ['sway', 'Schaukeln', 1], ['swing', 'Pendel', 1], ['orbit', 'Kreisen', 1], ['dance', 'Tanzen', 1], ['nod', 'Nicken', 1], ['squish', 'Quetschen', 1]]],
  ['Rein & raus', [['slide', 'Rutschen'], ['peek', 'Gucken'], ['pop', 'Ploppen', 1], ['drop', 'Fallen', 1], ['zoom', 'Ranzoomen', 1]]],
  ['Betonung', [['pulse', 'Pulsieren'], ['heart', 'Herzschlag'], ['rave', 'Disco'], ['tada', 'Tada', 1], ['blink', 'Blinken', 1], ['glitch', 'Glitch', 1]]],
];
export const ANIM_LABEL = { none: 'Keine Animation', custom: 'Eigene Animation' };
ANIM_GROUPS.forEach(([, items]) => items.forEach(([k, l]) => { ANIM_LABEL[k] = l; }));
export const EXTRAS = [['hearts', 'Herzen'], ['sparkle', 'Funkeln'], ['tears', 'Tränen'], ['zzz', 'Zzz'], ['confetti', 'Konfetti'], ['notes', 'Musik'], ['fire', 'Feuer'], ['speed', 'Speed', 1], ['bang', 'Ausruf', 1], ['question', 'Fragen', 1], ['snow', 'Schnee', 1], ['dizzy', 'Schwindlig', 1]];
export const EXTRA_LABEL = Object.fromEntries(EXTRAS.map(([k, l]) => [k, l]));
export const ROOM = { shake: 0.9, bounce: 0.8, spin: 0.9, wobble: 0.9, float: 0.86, jitter: 0.9, rave: 0.94, sway: 0.9, swing: 0.8, orbit: 0.84, dance: 0.86, glitch: 0.92, tada: 0.9, nod: 0.92 };
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
  else if (kind === 'dizzy') each(3, (i, u) => { const x = 0.5 * S + Math.cos(TAU * u) * 0.3 * S; const y = 0.16 * S + Math.sin(TAU * u) * 0.07 * S; g.globalAlpha = 0.65 + 0.35 * Math.sin(TAU * u); g.translate(x, y); polyStar(g, 5, S * 0.06, S * 0.028); g.fillStyle = '#fff6b8'; g.strokeStyle = '#c78a00'; g.lineWidth = line; g.fill(); g.stroke(); });
  g.restore();
}
