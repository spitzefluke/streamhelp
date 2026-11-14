// RGB-Licht der Console (Entwurf): Glühbirne (Ideen-Knopf) und die 9 Tasten – Farbe, Effekt, Tempo, Helligkeit
// und kurzes Aufleuchten bei Ereignissen (Follow, Abo, Bits …). Gespeichert in core.console_config.display.light
// (console_save, keine Migration nötig). lightFrame() rechnet für einen Zeitpunkt aus, wie jede LED leuchtet –
// dieselbe Rechnung nutzen die Vorschau im Browser (js/dash-console.js), das 3D-Modell (js/dash-console-3d.js)
// und später die Firmware (Lastenheft).

export const LIGHT_EFFECTS = [
  ['static', 'Leuchten'],
  ['breathe', 'Atmen'],
  ['blink', 'Blinken'],
  ['rainbow', 'Regenbogen'],
  ['wave', 'Welle'],
  ['off', 'Aus'],
];
export const KEY_MODES = [
  ['own', 'Eigene Tastenfarben'],
  ['same', 'Alle Tasten gleich'],
];
export const EVENT_STYLES = [
  ['flash', 'Aufblitzen'],
  ['pulse', 'Pulsieren (3×)'],
  ['rainbow', 'Regenbogen'],
  ['chase', 'Lauflicht'],
];
export const EVENT_TARGETS = [
  ['all', 'Glühbirne und Tasten'],
  ['bulb', 'Nur Glühbirne'],
  ['keys', 'Nur Tasten'],
];
export const EVENT_SECONDS = [2, 3, 5, 8];

// Ereignisse: kinds = Alert-Arten aus js/alerts.js, die dieses Licht auslösen
export const LIGHT_EVENTS = [
  { id: 'follow', name: 'Follower', icon: '💜', kinds: ['follow'], color: '#9146ff', style: 'flash' },
  { id: 'sub', name: 'Abo, Resub, Geschenk-Abos', icon: '⭐', kinds: ['sub', 'resub', 'gift'], color: '#ffb81c', style: 'rainbow' },
  { id: 'bits', name: 'Bits', icon: '💎', kinds: ['bits'], color: '#35c7ff', style: 'pulse' },
  { id: 'redeem', name: 'Kanalpunkte', icon: '🎟️', kinds: ['redeem'], color: '#3ddc84', style: 'flash' },
  { id: 'tip', name: 'Trinkgeld, Spenden-Meilenstein', icon: '💶', kinds: ['tip', 'charity'], color: '#ff4fd8', style: 'chase' },
  { id: 'idea', name: 'Content-Idee (Glühbirne gedrückt)', icon: '💡', color: '#ffd75e', style: 'flash' },
  { id: 'scene', name: 'Szene gewechselt', icon: '🎬', color: '#ff5a4e', style: 'flash' },
  { id: 'guard', name: 'Raid-Schutz eingeschaltet', icon: '🛡️', color: '#8e8e9a', style: 'pulse' },
];

export const LIGHT_DEFAULT = {
  bulb: { effect: 'breathe', color: '#ffd75e', speed: 3, level: 100 },
  keys: { mode: 'own', effect: 'static', color: '#9146ff', speed: 5, level: 80 },
  target: 'all',
  secs: 3,
  events: Object.fromEntries(LIGHT_EVENTS.map((e) => [e.id, { on: true, color: e.color, style: e.style }])),
};

const HEX = /^#[0-9a-f]{6}$/i;
const pick = (v, list, fallback) => (list.some(([id]) => id === v) ? v : fallback);
const num = (v, min, max, fallback) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= min && n <= max ? n : fallback; };
const color = (v, fallback) => (HEX.test(v ?? '') ? v.toLowerCase() : fallback);

export function normalizeLight(x) {
  const d = LIGHT_DEFAULT;
  const b = x?.bulb ?? {};
  const k = x?.keys ?? {};
  return {
    bulb: { effect: pick(b.effect, LIGHT_EFFECTS.filter(([id]) => id !== 'wave'), d.bulb.effect), color: color(b.color, d.bulb.color), speed: num(b.speed, 1, 10, d.bulb.speed), level: num(b.level, 5, 100, d.bulb.level) },
    keys: { mode: pick(k.mode, KEY_MODES, d.keys.mode), effect: pick(k.effect, LIGHT_EFFECTS, d.keys.effect), color: color(k.color, d.keys.color), speed: num(k.speed, 1, 10, d.keys.speed), level: num(k.level, 5, 100, d.keys.level) },
    target: pick(x?.target, EVENT_TARGETS, d.target),
    secs: EVENT_SECONDS.includes(Number(x?.secs)) ? Number(x.secs) : d.secs,
    events: Object.fromEntries(LIGHT_EVENTS.map((e) => {
      const v = x?.events?.[e.id] ?? {};
      return [e.id, { on: v.on !== false, color: color(v.color, e.color), style: pick(v.style, EVENT_STYLES, e.style) }];
    })),
  };
}

// Welches Licht-Ereignis gehört zu einer Alert-Art (follow, sub …)?
export const eventForAlert = (kind) => LIGHT_EVENTS.find((e) => e.kinds?.includes(kind))?.id ?? null;

// ---------- Farben ----------
function hsl(h, s = 1, l = 0.5) {
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const c = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
// Tempo 1–10 → Dauer eines Durchlaufs (1 = 6 s, 10 = 0,6 s)
const period = (speed) => 6000 / speed;
const wave01 = (t) => 0.5 - 0.5 * Math.cos(t * Math.PI * 2);
// Reihenfolge fürs Lauflicht: außen im Kreis, Mitte zuletzt
const RING = [0, 1, 2, 5, 8, 7, 6, 3, 4];

// Ein Effekt zu einem Zeitpunkt: { color, level 0..1 }. phase verschiebt den Effekt je Taste (Welle, Regenbogen).
function effect(spec, base, now, phase, still) {
  const lv = spec.level / 100;
  if (spec.effect === 'off') return { color: base, level: 0 };
  if (still || spec.effect === 'static') return { color: spec.effect === 'rainbow' ? hsl(phase * 360) : base, level: lv };
  const t = now / period(spec.speed);
  switch (spec.effect) {
    case 'breathe': return { color: base, level: lv * (0.15 + 0.85 * wave01(t)) };
    case 'blink': return { color: base, level: (t % 1) < 0.5 ? lv : lv * 0.04 };
    case 'rainbow': return { color: hsl(((t + phase) % 1) * 360), level: lv };
    case 'wave': return { color: base, level: lv * (0.1 + 0.9 * wave01(t - phase)) };
    default: return { color: base, level: lv };
  }
}

// Aufleuchten bei einem Ereignis: null = vorbei bzw. diese LED nicht betroffen
function eventLight(ev, light, now, slot, still) {
  if (!ev) return null;
  const p = (now - ev.start) / (light.secs * 1000);
  if (p < 0 || p >= 1) return null;
  const target = light.target;
  if (slot === 'bulb' ? target === 'keys' : target === 'bulb') return null;
  const c = ev.color;
  if (still) return { color: c, level: 1 };
  switch (ev.style) {
    case 'pulse': return { color: c, level: 0.1 + 0.9 * wave01(p * 3) };
    case 'rainbow': return { color: hsl(((p * 3 + (slot === 'bulb' ? 0 : slot / 9)) % 1) * 360), level: 1 };
    case 'chase': {
      if (slot === 'bulb') return { color: c, level: 0.4 + 0.6 * wave01(p * 4) };
      const pos = (p * 3 * RING.length) % RING.length;
      const d = (pos - RING.indexOf(slot) + RING.length) % RING.length;
      return { color: c, level: d < 1 ? 1 : d < 2.5 ? 0.35 : 0.05 };
    }
    default: return { color: c, level: p < 0.1 ? p / 0.1 : 1 - (p - 0.1) / 0.9 }; // flash: hell, langsam ausklingen
  }
}

// Wie leuchtet alles zu einem Zeitpunkt? keys: Tasten-Belegung (Farben bei „Eigene Tastenfarben“).
// ev: laufendes Ereignis { color, style, start } oder null. still: keine Bewegung (reduzierte Bewegung).
export function lightFrame(light, keys, now, ev = null, still = false) {
  const l = light ?? LIGHT_DEFAULT;
  const bulb = eventLight(ev, l, now, 'bulb', still) ?? effect(l.bulb, l.bulb.color, now, 0, still);
  const keyLeds = Array.from({ length: 9 }, (_, i) => {
    const k = keys?.[i];
    const empty = !k || k.action === 'none';
    const hit = eventLight(ev, l, now, i, still);
    if (hit) return hit;
    if (empty) return { color: '#000000', level: 0 };
    const base = l.keys.mode === 'same' ? l.keys.color : k.color || '#8e8e9a';
    // Welle: Spalte für Spalte von links nach rechts; Regenbogen: Farben über das Feld verteilt
    const phase = l.keys.effect === 'wave' ? (i % 3) * 0.18 + Math.floor(i / 3) * 0.06 : i / 9;
    return effect(l.keys, base, now, phase, still);
  });
  return { bulb, keys: keyLeds };
}

// Ereignis starten (für lightFrame)
export function startEvent(light, id, now = performance.now()) {
  const e = (light ?? LIGHT_DEFAULT).events?.[id];
  if (!e?.on) return null;
  return { id, color: e.color, style: e.style, start: now };
}
