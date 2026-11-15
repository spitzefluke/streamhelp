// Streamy, das Maskottchen von StreamHelp (Neon-Wolf) – zum Drehen. Sechs Ansichten (assets/streamy/*.webp:
// vorne, links, hinten, rechts, oben, 3/4) werden je nach Blickwinkel überblendet und leicht gestaucht, dazu
// ein sanftes Wippen. Ohne 3D-Bibliothek: ein <canvas> mit 2D-Zeichnung, läuft nur, solange Streamy sichtbar ist.
//   mountStreamy(host, { size, interactive, auto, pose, label }) → { hop(), setPose(name), destroy() }
//     interactive – Ziehen dreht (waagerecht), nach unten ziehen zeigt ihn von oben; Doppelklick hüpft
//     auto        – dreht sich langsam von selbst (bei „Bewegung reduzieren“ nie)
//     pose        – feste Ansicht ('three' = 3/4-Pose) statt Drehung, bis jemand zieht
// Die Grafiken stammen aus der Vorlage „Neon-Wolf 3D Drehansicht“.

const META = {
  front: { w: 340, h: 439, px: 160 }, left: { w: 310, h: 446, px: 173 }, back: { w: 312, h: 423, px: 132 },
  right: { w: 301, h: 435, px: 161 }, three: { w: 370, h: 408, px: 190 }, top: { w: 317, h: 374, px: 162 },
};
const SIDES = ['front', 'left', 'back', 'right'];
const NAMES = [...SIDES, 'top', 'three'];
const MAX_H = 446;
const TAU = Math.PI * 2;

// Bilder relativ zur Seite (alle Seiten liegen im Hauptordner). Nicht über import.meta.url: Die Startseite
// bündelt dieses Modul nach js/vendor/ (landing-yami).
const BASE = new URL('assets/streamy/', document.baseURI).href;
let images = null;
function loadImages() {
  images ??= Promise.all(NAMES.map((n) => new Promise((ok) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => ok([n, img]);
    img.onerror = () => ok([n, null]);
    img.src = `${BASE}${n}.webp`;
  }))).then((list) => Object.fromEntries(list));
  return images;
}

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const wrap = (a) => { const r = a % TAU; return r < 0 ? r + TAU : r; };
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function mountStreamy(host, opts = {}) {
  const { interactive = true, label = 'Streamy, das Maskottchen von StreamHelp' } = opts;
  const still = reducedMotion();
  const auto0 = opts.auto !== false && !still;
  const canvas = document.createElement('canvas');
  canvas.className = 'streamy-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', label);
  if (interactive) canvas.title = 'Ziehen zum Drehen';
  host.classList.add('streamy');
  host.replaceChildren(canvas);
  const g = canvas.getContext('2d');

  let imgs = null;
  let yaw = opts.yaw ?? 0;
  let pitch = 0;
  let auto = auto0;
  let pose = opts.pose ?? (still ? 'three' : null);
  let drag = null;
  let resumeAt = 0;
  let hopAt = -1;
  let raf = 0;
  let shown = true;
  let alive = true;
  let last = 0;
  const alpha = Object.fromEntries(NAMES.map((n) => [n, 0]));
  const t0 = performance.now();

  function resize() {
    const r = host.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(r.width * dpr));
    const hh = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== hh) { canvas.width = w; canvas.height = hh; }
    if (still) draw(performance.now());
  }

  function weights() {
    const w = Object.fromEntries(NAMES.map((n) => [n, 0]));
    if (pose === 'top' || pose === 'three') { w[pose] = 1; return w; }
    const tp = smooth(0.35, 0.85, pitch);
    w.top = tp;
    SIDES.forEach((n, i) => {
      const d = wrap(yaw - i * Math.PI / 2 + Math.PI) - Math.PI;
      w[n] = (1 - smooth(0.3, 1.15, Math.abs(d))) * (1 - tp);
    });
    return w;
  }

  function draw(now) {
    const W = canvas.width;
    const H = canvas.height;
    g.clearRect(0, 0, W, H);
    if (!imgs) return;
    const t = (now - t0) / 1000;
    const scale = (H * 0.9) / MAX_H;
    let bob = still ? 0 : Math.sin(t * 1.6) * H * 0.012;
    if (hopAt >= 0) {
      const k = (now - hopAt) / 520;
      if (k >= 1) hopAt = -1;
      else bob += Math.sin(k * Math.PI) * H * 0.09;
    }
    const w = weights();
    const instant = still || last === 0;
    for (const n of NAMES) {
      alpha[n] = instant ? w[n] : alpha[n] + (w[n] - alpha[n]) * 0.3;
      const a = alpha[n];
      const img = imgs[n];
      if (a < 0.01 || !img) continue;
      const m = META[n];
      // Seitenansichten kippen beim Überblenden leicht weg (wie eine gedrehte Fläche)
      let sx = 1;
      if (SIDES.includes(n)) {
        const i = SIDES.indexOf(n);
        const d = wrap(yaw - i * Math.PI / 2 + Math.PI) - Math.PI;
        sx = Math.cos(d * 0.28);
      } else if (!still) sx = Math.cos(Math.sin(t * 0.8) * 0.06);
      const dw = m.w * scale;
      const dh = m.h * scale;
      const x = W / 2 - m.px * scale * sx;
      const y = H * 0.97 - dh - bob;
      g.globalAlpha = Math.min(1, a);
      g.drawImage(img, x, y, dw * sx, dh);
    }
    g.globalAlpha = 1;
  }

  function frame(now) {
    raf = 0;
    if (!alive || !host.isConnected) { destroy(); return; }
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    if (!drag && !auto && auto0 && !pose && resumeAt && now > resumeAt) { auto = true; resumeAt = 0; }
    if (auto && !drag) yaw += dt * 0.7;
    if (!drag && pitch > 0 && !still) pitch = Math.max(0, pitch - dt * 0.6);
    draw(now);
    last = now;
    if (shown && !still) raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!raf && alive && shown) raf = requestAnimationFrame(frame); };

  if (interactive) {
    canvas.style.touchAction = 'pan-y';
    canvas.addEventListener('pointerdown', (e) => {
      drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
      auto = false;
      pose = null;
      try { canvas.setPointerCapture(e.pointerId); } catch { /* egal */ }
      canvas.classList.add('is-drag');
      kick();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      yaw += (e.clientX - drag.x) * 0.012;
      pitch = Math.max(0, Math.min(1.1, pitch + (e.clientY - drag.y) * 0.008));
      drag.x = e.clientX;
      drag.y = e.clientY;
      if (still) draw(performance.now());
    });
    const up = () => {
      drag = null;
      canvas.classList.remove('is-drag');
      resumeAt = performance.now() + 2500;
      kick();
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('dblclick', () => hop());
    // Tastatur: Pfeile drehen
    canvas.tabIndex = 0;
    canvas.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      auto = false;
      pose = null;
      yaw += (e.key === 'ArrowRight' ? 1 : -1) * Math.PI / 4;
      resumeAt = performance.now() + 4000;
      if (still) draw(performance.now()); else kick();
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

  loadImages().then((m) => {
    if (!alive) return;
    imgs = m;
    resize();
    draw(performance.now());
    kick();
  });

  function hop() {
    if (still) return;
    hopAt = performance.now();
    kick();
  }
  function setPose(name) {
    pose = name === 'top' || name === 'three' ? name : null;
    if (SIDES.includes(name)) { yaw = SIDES.indexOf(name) * Math.PI / 2; auto = false; resumeAt = performance.now() + 4000; }
    if (still) draw(performance.now()); else kick();
  }
  function destroy() {
    alive = false;
    cancelAnimationFrame(raf);
    ro.disconnect();
    io.disconnect();
    document.removeEventListener('visibilitychange', onVis);
  }
  return { hop, setPose, destroy };
}
