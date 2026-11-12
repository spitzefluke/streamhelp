// Touch-Oberfläche als Bild (Canvas) – für das Display im 3D-Modell der Console (js/dash-console-3d.js).
// Zeichnet die Startseite mit den eingestellten Kacheln, Statuszeile und Reitern wie js/console-touch.js
// (gleiche Einstellungen: normalizeTouch). Gibt die Flächen der Kacheln zurück, damit ein Klick aufs
// Display im 3D-Modell die richtige Kachel trifft.
import { TOUCH_PAGES, TOUCH_SCENES, normalizeTouch } from './console-touch.js';
import { alertText } from './alerts.js';

const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
const mix = (hex, k, base = [22, 26, 35]) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${c.map((v, i) => Math.round(base[i] + (v - base[i]) * k)).join(',')})`;
};

// opts: { cfg (display.touch), live: {scene, guard, alert, alertsToday}, goal, idea, page: 'home'|'ideas', hot: Kachel-Index }
export function drawTouchScreen(g, W, H, { cfg, live = {}, goal = 10, idea = null, page = 'home', hot = -1 } = {}) {
  const c = normalizeTouch(cfg);
  const u = Math.min(W, H) / 480;
  const font = (px, w = 600) => `${w} ${Math.round(px * u)}px Inter, system-ui, sans-serif`;
  const fit = (text, max) => {
    let t = String(text ?? '');
    if (g.measureText(t).width <= max) return t;
    while (t.length > 1 && g.measureText(`${t}…`).width > max) t = t.slice(0, -1);
    return `${t}…`;
  };
  g.save();
  g.textBaseline = 'middle';
  // Hintergrund wie .tch
  const bg = g.createRadialGradient(W / 2, 0, 0, W / 2, 0, H);
  bg.addColorStop(0, mix(c.accent, 0.22, [11, 13, 18]));
  bg.addColorStop(0.7, '#0b0d12');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  // Statuszeile
  const sh = 46 * u;
  g.fillStyle = '#f1f2f6';
  g.font = font(20, 800);
  g.fillText(new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }), 16 * u, sh / 2);
  const scene = TOUCH_SCENES.find(([id]) => id === (live.scene ?? '')) ?? TOUCH_SCENES[0];
  g.font = font(14, 700);
  const pill = (text, right, fill, color, dot) => {
    const w = g.measureText(text).width + (dot ? 34 : 22) * u;
    const x = right - w;
    g.fillStyle = fill;
    rr(g, x, sh / 2 - 13 * u, w, 26 * u, 13 * u);
    g.fill();
    if (dot) { g.fillStyle = dot; g.beginPath(); g.arc(x + 13 * u, sh / 2, 4.5 * u, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = color;
    g.fillText(text, x + (dot ? 24 : 11) * u, sh / 2 + 1);
    return x - 8 * u;
  };
  let right = W - 12 * u;
  right = pill(live.guard ? '🛡️ an' : '🛡️ aus', right, live.guard ? 'rgba(61,220,132,.22)' : '#1e2330', live.guard ? '#c8f7dc' : '#a3a8b6');
  pill(scene[1], right, live.scene ? '#1e2330' : 'rgba(255,90,78,.2)', live.scene ? '#a3a8b6' : '#ffd9d6', live.scene ? '#8e8e9a' : '#ff5a4e');
  g.fillStyle = 'rgba(255,255,255,.08)';
  g.fillRect(0, sh, W, 1);

  // Reiter unten
  const pages = c.pages.slice(0, 7);
  const th = 60 * u;
  const ty = H - th;
  g.fillStyle = 'rgba(0,0,0,.35)';
  g.fillRect(0, ty, W, th);
  g.fillStyle = 'rgba(255,255,255,.08)';
  g.fillRect(0, ty, W, 1);
  const tw = W / pages.length;
  g.textAlign = 'center';
  pages.forEach((p, i) => {
    const [, name, icon] = TOUCH_PAGES.find(([id]) => id === p);
    const on = p === page;
    if (on) {
      g.fillStyle = mix(c.accent, 0.25, [11, 13, 18]);
      g.fillRect(i * tw, ty, tw, th);
      g.fillStyle = c.accent;
      g.fillRect(i * tw, ty, tw, 3 * u);
    }
    g.globalAlpha = on ? 1 : 0.6;
    g.font = font(20, 400);
    g.fillText(icon, i * tw + tw / 2, ty + 22 * u);
    g.font = font(11.5, 700);
    g.fillStyle = on ? '#fff' : '#a3a8b6';
    g.fillText(fit(name, tw - 6 * u), i * tw + tw / 2, ty + 45 * u);
    g.globalAlpha = 1;
  });

  // Inhalt
  const pad = 14 * u;
  const top = sh + pad;
  const bottom = ty - pad;
  const areas = [];
  if (page === 'ideas') {
    g.textAlign = 'left';
    g.fillStyle = '#a3a8b6';
    g.font = font(12, 700);
    g.fillText('💡 CONTENT-IDEE', pad + 6 * u, top + 20 * u);
    g.fillStyle = '#fff';
    g.font = font(28, 800);
    const words = String(idea?.title ?? 'Noch keine Content-Ideen').split(' ');
    let line = '';
    let y = top + 60 * u;
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (g.measureText(next).width > W - pad * 3 && line) { g.fillText(line, pad + 6 * u, y); line = w; y += 34 * u; } else line = next;
    }
    if (line) g.fillText(line, pad + 6 * u, y);
  } else if (!c.tiles.length) {
    g.fillStyle = '#a3a8b6';
    g.font = font(15, 500);
    g.fillText('Noch keine Kacheln', W / 2, (top + bottom) / 2);
  } else {
    const cols = W < H ? 2 : (W / u >= 760 ? 4 : 3);
    const rows = Math.ceil(c.tiles.length / cols);
    const gap = 12 * u;
    const cw = (W - pad * 2 - gap * (cols - 1)) / cols;
    const ch = Math.min((bottom - top - gap * (rows - 1)) / rows, cw * 1.05);
    c.tiles.forEach((t, i) => {
      const x = pad + (i % cols) * (cw + gap);
      const y = top + Math.floor(i / cols) * (ch + gap);
      const col = t.color || c.accent;
      const active = (t.action === 'scene' && (live.scene ?? '') === (t.arg ?? '')) || (t.action === 'guard' && live.guard);
      const grad = g.createLinearGradient(x, y, x + cw * 0.6, y + ch);
      grad.addColorStop(0, mix(col, i === hot ? 0.6 : 0.36));
      grad.addColorStop(0.75, '#161a23');
      g.fillStyle = grad;
      rr(g, x, y, cw, ch, 18 * u);
      g.fill();
      g.lineWidth = (active ? 3 : 1.2) * u;
      g.strokeStyle = active ? col : mix(col, 0.5);
      g.stroke();
      g.textAlign = 'center';
      g.font = font(Math.min(40, ch / u * 0.33), 400);
      g.fillStyle = '#fff';
      g.fillText(t.icon || '•', x + cw / 2, y + ch * 0.42);
      g.font = font(16, 700);
      g.fillText(fit(t.label, cw - 14 * u), x + cw / 2, y + ch * 0.74);
      areas.push({ x: x / W, y: y / H, w: cw / W, h: ch / H, index: i });
    });
    // Alerts heute unter den Kacheln, wenn Platz ist
    const used = top + rows * (ch + gap);
    if (bottom - used > 50 * u) {
      const a = live.alert ? alertText(live.alert) : null;
      g.textAlign = 'left';
      g.fillStyle = '#161a23';
      rr(g, pad, used, W - pad * 2, Math.min(70 * u, bottom - used), 14 * u);
      g.fill();
      g.fillStyle = '#a3a8b6';
      g.font = font(12, 700);
      g.fillText(`ALERTS HEUTE ${live.alertsToday ?? 0} / ${goal}`, pad + 14 * u, used + 20 * u);
      g.fillStyle = '#f1f2f6';
      g.font = font(16, 700);
      g.fillText(fit(a ? `${a.icon} ${live.alert.user_name || a.title}` : 'noch kein Alert', W - pad * 4), pad + 14 * u, used + 46 * u);
    }
  }
  g.restore();
  return areas;
}
