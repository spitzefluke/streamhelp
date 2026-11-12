// Bildschirmschoner des Touch-Displays (js/console-touch.js): kleine animierte Nachtszene, Uhr und Live-Infos.
//   · Einbrennschutz: Uhr und Szene wandern langsam, nichts steht lange an derselben Stelle
//   · neuer Alert: erscheint groß auf dem schlafenden Bildschirm und verschwindet wieder
//   · Nachtmodus: zu den eingestellten Uhrzeiten stark gedimmt oder schwarz (Tippen weckt trotzdem)
import { h } from './extras-core.js';
import { alertText } from './alerts.js';

const FPS = 30;
const DRIFT_MS = 40_000;   // so oft wandert die Uhr an eine neue Stelle
const ALERT_MS = 7000;     // so lange bleibt ein Alert auf dem schlafenden Bildschirm

const minutes = (hhmm) => { const [hh, mm] = String(hhmm).split(':').map(Number); return hh * 60 + mm; };
// Liegt jetzt im Fenster from–to? (über Mitternacht: 23:00–07:00)
export function inNight(night, now = new Date()) {
  if (!night?.on) return false;
  const t = now.getHours() * 60 + now.getMinutes();
  const a = minutes(night.from);
  const b = minutes(night.to);
  return a === b ? true : a < b ? t >= a && t < b : t >= a || t < b;
}

// Kleiner fester Zufall, damit die Berge bei jedem Start gleich aussehen
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}
function ridge(rand, n, base, amp) {
  const pts = [];
  let y = base;
  for (let i = 0; i <= n; i++) {
    y += (rand() - 0.5) * amp;
    y = Math.min(base + amp, Math.max(base - amp, y));
    pts.push(y);
  }
  return pts;
}
const hexRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

export function createSaver({ reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches } = {}) {
  const canvas = h('canvas', { class: 'tch-saver-scene', 'aria-hidden': 'true' });
  const clockEl = h('span', { class: 'tch-saver-clock' });
  const dateEl = h('span', { class: 'tch-saver-date' });
  const subEl = h('span', { class: 'tch-saver-sub' });
  const info = h('span', { class: 'tch-saver-info' }, clockEl, dateEl, subEl, h('span', { class: 'tch-saver-hint' }, 'Tippen zum Aufwecken'));
  const pop = h('span', { class: 'tch-saver-alert', hidden: true, role: 'status', 'aria-live': 'polite' });
  const el = h('button', { type: 'button', class: 'tch-saver', hidden: true, 'aria-label': 'Bildschirm aufwecken' }, canvas, info, pop);

  let opts = { mode: 'scene', accent: '#9146ff', night: null };
  let live = { alert: null, alertsToday: 0 };
  let raf = 0;
  let last = 0;
  let driftTimer = 0;
  let popTimer = 0;
  const rand = rng(20261112);
  const stars = Array.from({ length: 90 }, () => ({ x: rand(), y: rand() * 0.62, r: 0.4 + rand() * 1.3, p: rand() * Math.PI * 2, s: 0.6 + rand() * 1.6 }));
  const ridges = [ridge(rand, 24, 0.66, 0.08), ridge(rand, 32, 0.76, 0.06), ridge(rand, 40, 0.86, 0.04)];
  const flies = Array.from({ length: 14 }, () => ({ x: rand(), y: 0.8 + rand() * 0.16, p: rand() * 100, s: 0.2 + rand() * 0.5 }));
  let shift = { x: 0, y: 0 };

  const night = () => inNight(opts.night);

  function paintText() {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    dateEl.textContent = now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
    const a = live.alert ? alertText(live.alert) : null;
    subEl.textContent = a ? `${a.icon} ${live.alert.user_name || a.title} · Alerts heute ${live.alertsToday}` : `Alerts heute ${live.alertsToday}`;
    el.classList.toggle('is-night', night());
    el.classList.toggle('is-black', night() && !!opts.night?.black);
    el.classList.toggle('is-plain', opts.mode !== 'scene');
  }

  // Einbrennschutz: Uhrblock an eine neue Stelle, Szene leicht versetzen
  function drift() {
    const x = 32 + Math.random() * 36;
    const y = 30 + Math.random() * 34;
    info.style.left = `${x}%`;
    info.style.top = `${y}%`;
    shift = { x: (Math.random() - 0.5) * 16, y: (Math.random() - 0.5) * 10 };
  }

  function draw(t) {
    const w = canvas.clientWidth;
    const hgt = canvas.clientHeight;
    if (!w || !hgt) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(hgt * dpr); }
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, shift.x, shift.y);
    const [r, gg, b] = hexRgb(opts.accent);
    const sec = t / 1000;
    // Himmel
    const sky = g.createLinearGradient(0, 0, 0, hgt);
    sky.addColorStop(0, '#04050c');
    sky.addColorStop(0.6, `rgb(${Math.round(r * 0.12)},${Math.round(gg * 0.1)},${Math.round(b * 0.2 + 14)})`);
    sky.addColorStop(1, '#07060f');
    g.fillStyle = sky;
    g.fillRect(-20, -20, w + 40, hgt + 40);
    // Sterne funkeln
    for (const s of stars) {
      const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(s.p + sec * s.s));
      g.fillStyle = `rgba(255,255,255,${(a * 0.85).toFixed(3)})`;
      g.beginPath();
      g.arc(s.x * w, s.y * hgt, s.r, 0, Math.PI * 2);
      g.fill();
    }
    // Mond wandert in ~20 Minuten über den Himmel
    const m = ((sec / 1200) % 1);
    const mx = w * (0.12 + 0.76 * m);
    const my = hgt * (0.3 - Math.sin(m * Math.PI) * 0.16);
    const mr = Math.min(w, hgt) * 0.06;
    const halo = g.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 4);
    halo.addColorStop(0, 'rgba(255,240,210,.22)');
    halo.addColorStop(1, 'rgba(255,240,210,0)');
    g.fillStyle = halo;
    g.fillRect(mx - mr * 4, my - mr * 4, mr * 8, mr * 8);
    g.fillStyle = '#f4ead2';
    g.beginPath();
    g.arc(mx, my, mr, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(0,0,0,.08)';
    g.beginPath();
    g.arc(mx - mr * 0.3, my - mr * 0.2, mr * 0.22, 0, Math.PI * 2);
    g.arc(mx + mr * 0.35, my + mr * 0.25, mr * 0.15, 0, Math.PI * 2);
    g.fill();
    // Bergketten (hinten heller, vorn dunkler), leichte Parallaxe
    ridges.forEach((pts, i) => {
      const off = Math.sin(sec / (40 + i * 15)) * (6 + i * 6);
      g.fillStyle = i === 0 ? `rgba(${r * 0.25 + 20},${gg * 0.2 + 18},${b * 0.3 + 30},1)` : i === 1 ? '#0d0b1c' : '#060510';
      g.beginPath();
      g.moveTo(-30, hgt + 10);
      pts.forEach((y, k) => g.lineTo(-30 + (k / (pts.length - 1)) * (w + 60) + off, y * hgt));
      g.lineTo(w + 30, hgt + 10);
      g.closePath();
      g.fill();
      if (i === 0) {
        // Nebelband zwischen den Ketten
        const fog = g.createLinearGradient(0, hgt * 0.68, 0, hgt * 0.82);
        fog.addColorStop(0, 'rgba(180,170,255,0)');
        fog.addColorStop(0.5, `rgba(${r},${gg},${b},.10)`);
        fog.addColorStop(1, 'rgba(180,170,255,0)');
        g.fillStyle = fog;
        g.fillRect(-30, hgt * 0.68, w + 60, hgt * 0.14);
      }
    });
    // Glühwürmchen in der Akzentfarbe
    for (const f of flies) {
      const x = ((f.x + Math.sin((sec + f.p) * f.s * 0.3) * 0.04) % 1) * w;
      const y = (f.y + Math.cos((sec + f.p) * f.s * 0.4) * 0.025) * hgt;
      const a = 0.25 + 0.75 * Math.max(0, Math.sin((sec + f.p) * f.s * 1.3));
      const glow = g.createRadialGradient(x, y, 0, x, y, 7);
      glow.addColorStop(0, `rgba(${Math.min(255, r + 90)},${Math.min(255, gg + 120)},${Math.min(255, b + 40)},${a.toFixed(3)})`);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = glow;
      g.fillRect(x - 7, y - 7, 14, 14);
    }
  }

  function loop(t) {
    raf = requestAnimationFrame(loop);
    if (t - last < 1000 / FPS) return;
    last = t;
    draw(t);
  }
  function start() {
    cancelAnimationFrame(raf);
    if (opts.mode !== 'scene' || (night() && opts.night?.black)) return;
    if (reducedMotion) { draw(performance.now()); return; }
    raf = requestAnimationFrame(loop);
  }
  function stop() { cancelAnimationFrame(raf); raf = 0; }

  return {
    el,
    get visible() { return !el.hidden; },
    get night() { return night(); },
    configure(next) {
      opts = { ...opts, ...next };
      paintText();
      if (!el.hidden) start();
    },
    update(next) { live = { ...live, ...next }; paintText(); },
    tick() {
      paintText();
      if (!el.hidden && reducedMotion && opts.mode === 'scene') draw(performance.now());
      if (!el.hidden && raf === 0 && !(night() && opts.night?.black)) start();
    },
    show() {
      if (!el.hidden) return;
      drift();
      paintText();
      el.hidden = false;
      start();
      clearInterval(driftTimer);
      driftTimer = setInterval(drift, DRIFT_MS);
    },
    hide() {
      el.hidden = true;
      stop();
      clearInterval(driftTimer);
      pop.hidden = true;
    },
    // Neuer Alert, während der Bildschirm schläft
    alert(a) {
      if (el.hidden || !a) return;
      const t = alertText(a);
      pop.replaceChildren(
        h('span', { class: 'tch-saver-alert-ico' }, t.icon),
        h('strong', {}, a.user_name || t.title),
        h('span', {}, `${t.title}${a.test ? ' · Probe' : ''}`),
      );
      pop.hidden = false;
      pop.classList.remove('is-in');
      void pop.offsetWidth; // Animation neu starten
      pop.classList.add('is-in');
      clearTimeout(popTimer);
      popTimer = setTimeout(() => { pop.hidden = true; }, ALERT_MS);
    },
    destroy() { stop(); clearInterval(driftTimer); clearTimeout(popTimer); },
  };
}
