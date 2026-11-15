// Streamy, das Maskottchen von StreamHelp (Neon-Wolf) – zum Drehen. Vier Seitenansichten (assets/streamy:
// vorne, Profil, hinten, Profil gespiegelt) werden je nach Blickwinkel überblendet und dabei gestaucht wie eine
// Figur, die sich dreht; dazu oben (nach unten ziehen), die 3/4-Pose (sitzend) und ein sanftes Wippen.
// Ohne 3D-Bibliothek: ein <canvas> mit 2D-Zeichnung, läuft nur, solange Streamy sichtbar ist.
//   mountStreamy(host, { interactive, auto, pose, label, onTap }) → { react(kind), hop(), setPose(name), destroy() }
//     interactive – Ziehen dreht (mit Schwung), nach unten ziehen zeigt ihn von oben, Antippen hüpft (bzw. onTap)
//     auto        – dreht sich langsam von selbst (bei „Bewegung reduzieren“ nie)
//     pose        – 'three' (3/4-Pose, sitzend) oder 'top' statt Drehung, bis jemand zieht
//     react(kind) – 'hop' (hüpfen), 'wiggle' (hin und her schauen), 'nod' (nicken), 'spin' (einmal ganz herum)
// Schärfe: bei großer Anzeige auf hochauflösenden Bildschirmen lädt er die geschärften @2x-Bilder nach.
// Die Grafiken stammen aus der Vorlage „Neon-Wolf 3D Drehansicht“.

const META = {
  front: { w: 340, h: 439, px: 160 }, left: { w: 310, h: 446, px: 173 }, back: { w: 312, h: 423, px: 132 },
  right: { w: 301, h: 435, px: 161 }, three: { w: 370, h: 408, px: 190 }, top: { w: 317, h: 374, px: 162 },
};
// Die beiden Profil-Bilder schauen in dieselbe Richtung – „right“ wird gespiegelt, damit er sich ganz herumdreht
const SIDES = [
  { n: 'front', flip: false }, { n: 'left', flip: false }, { n: 'back', flip: false }, { n: 'right', flip: true },
];
const NAMES = ['front', 'left', 'back', 'right', 'top', 'three'];
const MAX_H = 446;
const TAU = Math.PI * 2;
const QUARTER = Math.PI / 2;

// Bilder relativ zur Seite (alle Seiten liegen im Hauptordner). Nicht über import.meta.url: Die Startseite
// bündelt dieses Modul nach js/vendor/ (landing-yami).
const BASE = new URL('assets/streamy/', document.baseURI).href;
const sets = { 1: null, 2: null };
function loadImages(q) {
  sets[q] ??= Promise.all(NAMES.map((n) => new Promise((ok) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => ok([n, img]);
    img.onerror = () => ok([n, null]);
    img.src = `${BASE}${n}${q === 2 ? '@2x' : ''}.webp`;
  }))).then((list) => Object.fromEntries(list));
  return sets[q];
}

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const wrapPi = (a) => { let r = a % TAU; if (r < -Math.PI) r += TAU; if (r > Math.PI) r -= TAU; return r; };
const easeOut = (k) => 1 - (1 - k) ** 3;
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function mountStreamy(host, opts = {}) {
  const { interactive = true, label = 'Streamy, das Maskottchen von StreamHelp', onTap = null } = opts;
  const still = reducedMotion();
  const auto0 = opts.auto !== false && !still;
  const canvas = document.createElement('canvas');
  canvas.className = 'streamy-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', label);
  if (interactive) canvas.title = onTap ? 'Antippen oder ziehen zum Drehen' : 'Ziehen zum Drehen';
  host.classList.add('streamy');
  host.replaceChildren(canvas);
  const g = canvas.getContext('2d');

  let imgs = null;
  let quality = 1;
  let yaw = opts.yaw ?? 0;
  let vel = 0;          // Drehgeschwindigkeit nach dem Loslassen (rad/s)
  let pitch = 0;
  let auto = auto0;
  let pose = opts.pose ?? (still ? 'three' : null);
  let poseMix = pose ? 1 : 0; // weicher Wechsel zwischen Drehung und fester Pose
  let drag = null;
  let resumeAt = 0;
  let fx = null;        // laufende Reaktion { kind, at, from }
  let raf = 0;
  let shown = true;
  let alive = true;
  let last = 0;
  const t0 = performance.now();

  function resize() {
    const r = host.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 3);
    const w = Math.max(1, Math.round(r.width * dpr));
    const hh = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== hh) { canvas.width = w; canvas.height = hh; }
    // Wird er größer gezeichnet als die Bilder sind, die geschärften @2x-Bilder nachladen
    if (quality === 1 && hh * 0.9 > MAX_H * 1.15) {
      quality = 2;
      loadImages(2).then((m) => { if (alive && Object.values(m).every(Boolean)) { imgs = m; paintNow(); } });
    }
    paintNow();
  }
  const paintNow = () => { if (still || !raf) draw(performance.now()); };

  // Reaktionen: Zuschläge zu Drehung, Höhe und Stauchung
  function effects(now) {
    const out = { yaw: 0, lift: 0, squash: 0 };
    if (!fx) return out;
    const dur = { hop: 560, wiggle: 900, nod: 700, spin: 1100 }[fx.kind] ?? 600;
    const k = (now - fx.at) / dur;
    if (k >= 1) {
      if (fx.kind === 'spin') yaw = fx.from + TAU;
      fx = null;
      return out;
    }
    if (fx.kind === 'hop') { out.lift = Math.sin(k * Math.PI) * 0.1; out.squash = k < 0.15 ? -0.06 * (k / 0.15) : k > 0.85 ? -0.06 * ((1 - k) / 0.15) : 0.03; }
    if (fx.kind === 'wiggle') out.yaw = Math.sin(k * Math.PI * 4) * 0.55 * (1 - k);
    if (fx.kind === 'nod') out.squash = -Math.sin(k * Math.PI * 3) * 0.05 * (1 - k);
    if (fx.kind === 'spin') { out.yaw = fx.from + easeOut(k) * TAU - yaw; out.lift = Math.sin(k * Math.PI) * 0.05; }
    return out;
  }

  function draw(now) {
    const W = canvas.width;
    const H = canvas.height;
    g.clearRect(0, 0, W, H);
    if (!imgs) return;
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    const t = (now - t0) / 1000;
    const e = effects(now);
    const scale = (H * 0.9) / MAX_H;
    const bob = (still ? 0 : Math.sin(t * 1.6) * 0.012) + e.lift;
    const a = yaw + e.yaw;
    // Seitenansichten: höchstens zwei Nachbarn gleichzeitig, immer in derselben Reihenfolge übereinander
    // (sonst springt das Bild genau in der Mitte), jede bis zur Mitte voll deckend – kein Durchscheinen
    const tp = smooth(0.35, 0.85, pitch);
    const layers = [];
    SIDES.forEach((s, i) => {
      const d = wrapPi(a - i * QUARTER);
      const w = 1 - smooth(0.42, 1.12, Math.abs(d));
      if (w > 0.001) layers.push({ i, n: s.n, flip: s.flip, w, d });
    });
    if (layers.length === 2 && (layers[1].i + 1) % 4 === layers[0].i) layers.reverse(); // unten i, oben i+1
    const total = layers.reduce((s2, l) => s2 + l.w, 0) || 1;
    const sideAlpha = (1 - tp) * (1 - poseMix);
    const list = layers.map((l) => ({ ...l, alpha: (layers.length === 1 ? 1 : Math.min(1, (2 * l.w) / total)) * sideAlpha }));
    if (tp > 0.01) list.push({ n: 'top', flip: false, d: 0, alpha: tp * (1 - poseMix) });
    if (poseMix > 0.01) list.push({ n: pose === 'top' ? 'top' : 'three', flip: false, d: 0, alpha: poseMix });
    // Bodenschatten (wird beim Hüpfen kleiner)
    g.save();
    g.globalAlpha = 0.3 * (1 - Math.min(1, e.lift * 6));
    g.fillStyle = '#000';
    g.beginPath();
    g.ellipse(W / 2, H * 0.965, Math.max(1, W * 0.2 * (1 - e.lift * 2)), Math.max(1, H * 0.018), 0, 0, TAU);
    g.fill();
    g.restore();
    for (const l of list) {
      const img = imgs[l.n];
      if (!img || l.alpha < 0.01) continue;
      const m = META[l.n];
      // Wie eine Figur, die sich dreht: an der Übergabe (45°) schmaler; beim Hüpfen gestaucht/gestreckt
      const turn = 1 - 0.24 * Math.sin(Math.min(Math.abs(l.d), QUARTER) * 2) ** 2;
      const sx = turn * (1 - e.squash * 0.6);
      const sy = 1 + e.squash;
      const dw = m.w * scale;
      const dh = m.h * scale * sy;
      const px = l.flip ? m.w - m.px : m.px;
      const x = W / 2 - px * scale * sx;
      const y = H * 0.97 - dh - bob * H;
      g.globalAlpha = Math.min(1, l.alpha);
      if (l.flip) {
        g.save();
        g.translate(x + dw * sx, y);
        g.scale(-1, 1);
        g.drawImage(img, 0, 0, dw * sx, dh);
        g.restore();
      } else {
        g.drawImage(img, x, y, dw * sx, dh);
      }
    }
    g.globalAlpha = 1;
  }

  function frame(now) {
    raf = 0;
    if (!alive || !host.isConnected) { destroy(); return; }
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    if (!drag && !auto && auto0 && !pose && resumeAt && now > resumeAt) { auto = true; resumeAt = 0; }
    if (!drag) {
      if (Math.abs(vel) > 0.05) { yaw += vel * dt; vel *= Math.exp(-dt * 2.6); } // Schwung, läuft aus
      else vel = 0;
      if (auto && !vel) yaw += dt * 0.6;
      if (pitch > 0) pitch = Math.max(0, pitch - dt * 0.7);
    }
    poseMix += ((pose ? 1 : 0) - poseMix) * Math.min(1, dt * 8);
    draw(now);
    const busy = !still || fx || drag || vel;
    if (shown && busy) raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!raf && alive && shown) { last = 0; raf = requestAnimationFrame(frame); } };

  if (interactive) {
    canvas.style.touchAction = 'pan-y';
    let moved = 0;
    let lastX = 0;
    let lastT = 0;
    canvas.addEventListener('pointerdown', (e) => {
      drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
      moved = 0;
      lastX = e.clientX;
      lastT = performance.now();
      vel = 0;
      try { canvas.setPointerCapture(e.pointerId); } catch { /* egal */ }
      canvas.classList.add('is-drag');
      kick();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      moved += Math.abs(dx) + Math.abs(dy);
      if (moved > 6) { auto = false; pose = null; }
      yaw += dx * 0.012;
      pitch = Math.max(0, Math.min(1.1, pitch + dy * 0.008));
      const now = performance.now();
      const dtm = Math.max(1, now - lastT);
      vel = vel * 0.6 + ((e.clientX - lastX) * 0.012 / (dtm / 1000)) * 0.4;
      lastX = e.clientX;
      lastT = now;
      drag.x = e.clientX;
      drag.y = e.clientY;
      if (still) draw(now);
    });
    const up = (e) => {
      if (!drag) return;
      drag = null;
      canvas.classList.remove('is-drag');
      if (performance.now() - lastT > 80 || still) vel = 0; // losgelassen ohne Bewegung: kein Schwung
      vel = Math.max(-12, Math.min(12, vel));
      resumeAt = performance.now() + 3000;
      if (moved <= 6 && e.type === 'pointerup') { if (onTap) onTap(); else react('hop'); }
      kick();
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    // Tastatur: Pfeile drehen, Enter/Leertaste wie Antippen
    canvas.tabIndex = 0;
    canvas.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (onTap) onTap(); else react('hop'); return; }
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      auto = false;
      pose = null;
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      resumeAt = performance.now() + 4000;
      if (still) { yaw += dir * QUARTER; draw(performance.now()); } else { vel = dir * 4; kick(); }
    });
  }

  const ro = new ResizeObserver(resize);
  ro.observe(host);
  const io = new IntersectionObserver(([e]) => {
    if (!host.isConnected) { destroy(); return; } // aus der Seite entfernt
    shown = e.isIntersecting;
    if (shown) kick();
  });
  io.observe(host);
  const onVis = () => { if (document.visibilityState === 'visible') kick(); };
  document.addEventListener('visibilitychange', onVis);

  loadImages(1).then((m) => {
    if (!alive || imgs) return;
    imgs = m;
    resize();
    kick();
  });

  function react(kind = 'hop') {
    if (still || !['hop', 'wiggle', 'nod', 'spin'].includes(kind)) return;
    if (kind === 'spin') { pose = null; vel = 0; }
    fx = { kind, at: performance.now(), from: yaw };
    kick();
  }
  function setPose(name) {
    pose = name === 'top' || name === 'three' ? name : null;
    const i = SIDES.findIndex((s) => s.n === name);
    if (i >= 0) { yaw = i * QUARTER; vel = 0; auto = false; resumeAt = performance.now() + 4000; }
    if (still) { poseMix = pose ? 1 : 0; draw(performance.now()); } else kick();
  }
  function destroy() {
    alive = false;
    cancelAnimationFrame(raf);
    ro.disconnect();
    io.disconnect();
    document.removeEventListener('visibilitychange', onVis);
  }
  return { react, hop: () => react('hop'), setPose, destroy };
}
