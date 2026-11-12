// Console (Entwurf) – 3D-Ansicht des Modells (nur Plattform-Admins, js/dash-console.js).
// Das Modell (.obj) liegt im privaten Bucket console-private oder wird lokal gewählt; three.js
// (js/vendor/three-console.min.js) lädt erst, wenn die Ansicht gebraucht wird.
// Die 9 Tasten bekommen die Farben der Belegung, das Display zeigt die Live-Anzeige als Bild,
// ein Klick auf eine Taste im Modell löst sie aus. Die Anschlüsse (links, hinten, vorn) folgen dem Technik-Baukasten;
// sobald die Rückseiten-Abfrage beantwortet ist, ersetzt eine eigene Rückseite die Buchsen aus dem Modell.
// Dazu eine Verpackung (zu, offen, Schnitt) mit Einleger, Kabelfach und Aufdruck aus Belegung und Baukasten.

let T = null;    // three.js-Modul
let view = null; // { renderer, scene, camera, controls, keys: Map<index, {cap, face}>, canvas, texture, host, onKey, side, ports, box }

// Lage der Teile im Modell (Millimeter, z nach oben): 3 × 3 Tasten links, Ideen-Knopf, Display rechts
const KEY_X = [-66, -37, -8];
const KEY_Y = [30, 0, -30];
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const keyIndex = (c) => {
  const col = KEY_X.findIndex((x) => near(c.x, x, 4));
  const row = KEY_Y.findIndex((y) => near(c.y, y, 4));
  return col < 0 || row < 0 ? -1 : row * 3 + col;
};

export async function mountConsole3d(host, { objText, keys, onKey }) {
  T ??= await import('./vendor/three-console.min.js');
  disposeConsole3d();
  const width = host.clientWidth || 640;
  const height = Math.round(Math.min(460, Math.max(300, width * 0.62)));
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.setSize(width, height);
  renderer.outputColorSpace = T.SRGBColorSpace;
  host.replaceChildren(renderer.domElement);
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', '3D-Modell der Console – ziehen zum Drehen, Mausrad zum Zoomen, Klick auf eine Taste löst sie aus');

  const scene = new T.Scene();
  scene.add(new T.HemisphereLight(0xffffff, 0x2a2c33, 1.5));
  const sun = new T.DirectionalLight(0xffffff, 2.4);
  sun.position.set(-120, -160, 260);
  scene.add(sun);
  const rim = new T.DirectionalLight(0x9146ff, 0.9);
  rim.position.set(180, 200, 60);
  scene.add(rim);

  const obj = new T.OBJLoader().parse(objText);
  const whole = new T.Box3().setFromObject(obj);
  const keyParts = new Map();
  const look = { lid: [], base: [], bulb: [], rear: [] }; // Teile, die Design- und Rückseiten-Abfrage ändern
  let screen = null;
  const box = new T.Box3();
  const size = new T.Vector3();
  const center = new T.Vector3();
  obj.traverse((m) => {
    if (!m.isMesh) return;
    m.geometry.computeBoundingBox();
    box.copy(m.geometry.boundingBox);
    box.getSize(size);
    box.getCenter(center);
    const mat = (color, extra = {}) => new T.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.15, ...extra });
    const idx = keyIndex(center);
    if (idx >= 0 && near(size.x, 26, 2) && near(size.y, 26, 2) && center.z > 24) {
      m.material = mat(0x3a3d46);
      keyParts.set(idx, { ...keyParts.get(idx), cap: m });
    } else if (idx >= 0 && near(size.x, 15, 2) && near(size.y, 15, 2) && center.z > 30) {
      m.material = mat(0x4a4d58, { roughness: 0.4 });
      keyParts.set(idx, { ...keyParts.get(idx), face: m });
    } else if (near(center.x, 13, 2) && near(center.y, 0, 2) && center.z > 24 && size.x < 14) {
      m.material = mat(0xffd75e, { emissive: 0x664d00, emissiveIntensity: 0.6 });
      look.bulb.push(m);
    } else if (near(size.x, 59.4, 2) && near(size.y, 77.4, 2) && center.z > 25) {
      m.material = mat(0x0d0f14, { roughness: 0.2, metalness: 0 });
      screen = { mesh: m, top: box.max.z, cx: center.x, cy: center.y, w: size.x, h: size.y };
    } else if (size.z < 0.05 && center.z > 28 && near(center.x, 52, 30) && near(center.y, 0, 39)) {
      m.visible = false; // flache Display-Platzhalter: die Live-Anzeige liegt darüber
    } else if (size.x > 180 && size.y > 110) {
      m.material = center.z > 20 ? mat(0x2c2f37, { roughness: 0.55 }) : mat(0x1d1f25, { roughness: 0.7 });
      look[center.z > 20 ? 'lid' : 'base'].push(m);
    } else {
      m.material = mat(0x6b6f7a, { metalness: 0.5, roughness: 0.35 });
      if (box.min.y > 38) look.rear.push(m); // Buchsen, Ein-Taste, LED und Beschriftung der Rückseite
    }
  });
  scene.add(obj);
  // Abdeckplatte für die eigene Rückseite (deckt die Aussparungen der Modell-Buchsen ab)
  const baseBox = look.base[0] ? new T.Box3().setFromObject(look.base[0]) : whole;
  const lidTop = look.lid[0] ? new T.Box3().setFromObject(look.lid[0]).max.z : whole.max.z;
  const rearPlate = new T.Mesh(new T.BoxGeometry(whole.max.x - whole.min.x - 1, 0.4, baseBox.max.z - baseBox.min.z - 0.8),
    new T.MeshStandardMaterial({ color: 0x1d1f25, roughness: 0.7, metalness: 0.15 }));
  rearPlate.position.set((whole.min.x + whole.max.x) / 2, whole.max.y + 0.15, (baseBox.min.z + baseBox.max.z) / 2);
  rearPlate.visible = false;
  scene.add(rearPlate);

  // Live-Anzeige als Bild auf dem Display (10 px je mm)
  let canvas = null;
  let texture = null;
  if (screen) {
    canvas = document.createElement('canvas');
    canvas.width = Math.round(screen.w * 10);
    canvas.height = Math.round(screen.h * 10);
    texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    const plane = new T.Mesh(new T.PlaneGeometry(screen.w * 0.94, screen.h * 0.94), new T.MeshBasicMaterial({ map: texture }));
    plane.position.set(screen.cx, screen.cy, screen.top + 0.15);
    scene.add(plane);
  }

  const camera = new T.PerspectiveCamera(32, width / height, 1, 5000);
  camera.up.set(0, 0, 1);
  camera.position.set(-150, -250, 230);
  const controls = new T.OrbitControls(camera, renderer.domElement);
  controls.target.set(5, 0, 12);
  controls.enableDamping = true;
  controls.minDistance = 140;
  controls.maxDistance = 700;
  controls.update();

  view = { renderer, scene, camera, controls, keys: keyParts, canvas, texture, host, onKey, side: { x: whole.min.x, minX: whole.min.x, maxX: whole.max.x, minY: whole.min.y, maxY: whole.max.y, z0: whole.min.z, zc: (baseBox.min.z + baseBox.max.z) / 2, lidTop }, rearPlate, screen, ports: null, box: null, look, glow: null, capRough: 0.6 };
  colorKeys(keys);

  // Klick (ohne Ziehen) auf eine Taste löst sie aus
  const ray = new T.Raycaster();
  const ptr = new T.Vector2();
  let down = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
    if (view.box && !['off', 'open'].includes(view.box.mode)) return; // Tasten liegen in der geschlossenen Verpackung
    const r = renderer.domElement.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects([...keyParts.values()].flatMap((k) => [k.cap, k.face].filter(Boolean)))[0];
    if (!hit) return;
    const idx = [...keyParts.entries()].find(([, k]) => k.cap === hit.object || k.face === hit.object)?.[0];
    if (idx !== undefined) {
      pressAnim(idx);
      view.onKey?.(idx);
    }
  });

  renderer.setAnimationLoop(() => {
    if (!host.isConnected) { disposeConsole3d(); return; }
    stepBox();
    controls.update();
    renderer.render(scene, camera);
  });
  return true;
}

export function colorKeys(keys) {
  if (!view || !T) return;
  view.keys.forEach((parts, i) => {
    const k = keys?.[i];
    const c = new T.Color(k?.color || '#8e8e9a');
    const empty = !k || k.action === 'none';
    parts.cap?.material.color.copy(empty ? new T.Color(0x2a2c33) : c.clone().multiplyScalar(0.55));
    if (parts.cap) parts.cap.material.roughness = view.capRough;
    if (parts.face) {
      parts.face.material.color.copy(empty ? new T.Color(0x3a3d46) : c);
      parts.face.material.emissive = empty ? new T.Color(0) : c.clone().multiplyScalar(0.35);
    }
  });
}

function pressAnim(i) {
  const parts = view?.keys.get(i);
  if (!parts) return;
  for (const m of [parts.cap, parts.face].filter(Boolean)) m.position.z = -1.5;
  setTimeout(() => { for (const m of [parts.cap, parts.face].filter(Boolean)) m.position.z = 0; }, 160);
}

// Anzeige zeichnen: dieselben Inhalte wie die 2D-Anzeige
export function drawConsoleDisplay({ title, sub, cards, goalText, pct }) {
  if (!view?.canvas) return;
  const g = view.canvas.getContext('2d');
  const W = view.canvas.width;
  const H = view.canvas.height;
  g.fillStyle = '#0d0f14';
  g.fillRect(0, 0, W, H);
  g.textBaseline = 'middle';
  const font = (px, weight = 400) => `${weight} ${px}px Inter, system-ui, sans-serif`;
  const fit = (text, max) => {
    let t = String(text ?? '');
    while (t.length > 1 && g.measureText(t).width > max) t = t.slice(0, -1);
    return t === String(text ?? '') ? t : `${t.slice(0, -1)}…`;
  };
  const pad = 30;
  g.font = font(34, 700);
  g.fillStyle = '#eef0f4';
  g.fillText(fit(title, W - pad * 2), pad, 56);
  g.font = font(26);
  g.fillStyle = '#a7abb8';
  g.fillText(fit(sub, W - pad * 2), pad, 96);
  cards.forEach((c, i) => {
    const y = 140 + i * 190;
    g.fillStyle = c.idea ? '#2b2410' : '#1a1d25';
    g.beginPath();
    g.roundRect(pad, y, W - pad * 2, 160, 18);
    g.fill();
    g.font = font(54);
    g.fillText(c.icon, pad + 24, y + 80);
    g.font = font(30, 700);
    g.fillStyle = '#eef0f4';
    g.fillText(fit(c.title, W - pad * 2 - 130), pad + 110, y + 60);
    g.font = font(24);
    g.fillStyle = '#a7abb8';
    g.fillText(fit(c.sub, W - pad * 2 - 130), pad + 110, y + 104);
  });
  const by = H - 110;
  g.font = font(24);
  g.fillStyle = '#a7abb8';
  g.fillText(fit(goalText, W - pad * 2), pad, by);
  g.fillStyle = '#262a35';
  g.beginPath();
  g.roundRect(pad, by + 30, W - pad * 2, 22, 11);
  g.fill();
  const grad = g.createLinearGradient(pad, 0, W - pad, 0);
  grad.addColorStop(0, '#ff5a4e');
  grad.addColorStop(1, '#ffb81c');
  g.fillStyle = grad;
  g.beginPath();
  g.roundRect(pad, by + 30, Math.max(22, (W - pad * 2) * (pct / 100)), 22, 11);
  g.fill();
  view.texture.needsUpdate = true;
}

// Anschlüsse: [{ kind, label, side: 'left'|'back'|'front', recessed? }]
// opts: { custom: eigene Rückseite statt der Modell-Buchsen, labels: 'print'|'raised'|'light'|'top', wide: mehr Abstand, led: Farbe }
const PORT_SIZE = { hdmi: [15, 5.5], usbc: [9, 3.2], usba: [12, 4.5], jack: [6, 6], dc: [8, 8], mains: [20, 12], sd: [12, 2], power: [9, 9], led: [7, 2.2] };
const LABEL_COLOR = { print: '#d9dce4', raised: '#7a7f8a', light: '#c9b3ff', top: '#d9dce4' };
export function setConsolePorts(ports, opts = {}) {
  if (!view || !T) return;
  if (view.ports) {
    view.scene.remove(view.ports);
    view.ports.traverse(disposeMesh);
    view.ports = null;
  }
  const custom = !!opts.custom;
  for (const m of view.look.rear) m.visible = !custom;
  view.rearPlate.visible = custom;
  const list = (ports ?? []).filter((p) => PORT_SIZE[p.kind]);
  if (!list.length) return;
  const group = new T.Group();
  const S = view.side;
  // je Seite: Achse entlang der Fläche, Leserichtung (von außen gesehen links → rechts), feste Koordinate, Normale nach außen
  const FACES = {
    left: { along: 'y', mid: (S.minY + S.maxY) / 2, dir: -1, room: S.maxY - S.minY - 12, at: S.x, out: [-1, 0] },
    back: { along: 'x', mid: (S.minX + S.maxX) / 2, dir: -1, room: S.maxX - S.minX - 16, at: S.maxY + 0.35, out: [0, 1] },
    front: { along: 'x', mid: (S.minX + S.maxX) / 2, dir: 1, room: S.maxX - S.minX - 16, at: S.minY, out: [0, -1] },
  };
  const shell = () => new T.MeshStandardMaterial({ color: 0xb8bcc6, metalness: 0.8, roughness: 0.3 });
  const hole = () => new T.MeshStandardMaterial({ color: 0x07080b, roughness: 0.9 });
  const labelColor = LABEL_COLOR[opts.labels] ?? LABEL_COLOR.print;
  for (const [sideId, F] of Object.entries(FACES)) {
    const items = list.filter((p) => (p.side ?? 'left') === sideId);
    if (!items.length) continue;
    const widths = items.reduce((sum, p) => sum + PORT_SIZE[p.kind][0], 0);
    const base = opts.wide && sideId !== 'left' ? 14 : 9;
    const gap = items.length > 1 ? Math.max(3, Math.min(base, (F.room - widths) / (items.length - 1))) : 0;
    const scale = Math.min(1, F.room / (widths + gap * (items.length - 1)));
    const total = (widths + gap * (items.length - 1)) * scale;
    let t = 0;
    const [ox, oy] = F.out;
    // Punkt auf der Fläche: a = Lage entlang der Achse, d = Abstand nach außen, z = Höhe
    const pt = (a, d, z) => (F.along === 'y' ? [F.at + ox * d, a, z] : [a, F.at + oy * d, z]);
    for (const p of items) {
      const w = PORT_SIZE[p.kind][0] * scale;
      const hgt = PORT_SIZE[p.kind][1] * scale;
      const a = F.mid + F.dir * (-total / 2 + t + w / 2);
      t += w + gap * scale;
      const z = S.zc;
      const boxGeo = (bw, depth, bh) => (F.along === 'y' ? new T.BoxGeometry(depth, bw, bh) : new T.BoxGeometry(bw, depth, bh));
      const put = (mesh, d) => { mesh.position.set(...pt(a, d, z)); group.add(mesh); return mesh; };
      if (p.kind === 'jack' || p.kind === 'dc') {
        const turn = (m) => { if (F.along === 'y') m.rotation.z = Math.PI / 2; return m; };
        put(turn(new T.Mesh(new T.CylinderGeometry(w / 2 + 1, w / 2 + 1, 1.2, 28), shell())), 0.3);
        put(turn(new T.Mesh(new T.CylinderGeometry(w / 2 - 1.4, w / 2 - 1.4, 1.4, 24), hole())), 0.45);
      } else if (p.kind === 'power') {
        put(new T.Mesh(boxGeo(w + 2.4, 1, hgt + 2.4), new T.MeshStandardMaterial({ color: 0x111216, roughness: 0.8 })), 0.25);
        put(new T.Mesh(boxGeo(w, 1.6, hgt), new T.MeshStandardMaterial({ color: 0x4a4d58, roughness: 0.45, metalness: 0.2 })), p.recessed ? 0.2 : 1.2);
      } else if (p.kind === 'led') {
        put(new T.Mesh(boxGeo(w, 1, hgt), new T.MeshBasicMaterial({ color: opts.led ?? '#3ddc97' })), 0.35);
      } else {
        put(new T.Mesh(boxGeo(w + 1.6, 1.2, hgt + 1.6), p.kind === 'mains' ? new T.MeshStandardMaterial({ color: 0x15171c, roughness: 0.8 }) : shell()), 0.3);
        put(new T.Mesh(boxGeo(w, 1.4, hgt), hole()), 0.45);
      }
      if (!p.label) continue;
      // Beschriftung über dem Anschluss (oder oben auf dem Deckelrand, von vorn lesbar)
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 64;
      const g = c.getContext('2d');
      g.fillStyle = labelColor;
      g.font = '600 30px Inter, system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(p.label).slice(0, 14), 128, 32);
      const tex = new T.CanvasTexture(c);
      tex.colorSpace = T.SRGBColorSpace;
      const lw = Math.max(w + gap * scale - 1, 12);
      const label = new T.Mesh(new T.PlaneGeometry(lw, lw / 4), new T.MeshBasicMaterial({ map: tex, transparent: true }));
      if (opts.labels === 'top' && sideId === 'back') {
        label.position.set(a, S.maxY - 4, S.lidTop + 0.05);
      } else {
        const lz = z + hgt / 2 + 2 + lw / 8;
        label.position.set(...pt(a, 0.3, lz));
        label.up.set(0, 0, 1);
        label.lookAt(...pt(a, 100, lz));
      }
      group.add(label);
    }
  }
  view.ports = group;
  view.scene.add(group);
}

// ---------- Design (Abfrage „Anschlüsse, Design und mehr“) ----------
// d: { body: [lid, base] als Farbe, bulb: Farbe, glow: Farbe oder '', caps: 'matt'|'gloss' }
export function setConsoleLook(d) {
  if (!view || !T || !d) return;
  const { look } = view;
  const [lid, base] = d.body ?? ['#2c2f37', '#1d1f25'];
  for (const m of look.lid) m.material.color.set(lid);
  for (const m of look.base) m.material.color.set(base);
  view.rearPlate.material.color.set(base);
  for (const m of look.bulb) {
    m.material.color.set(d.bulb ?? '#ffd75e');
    m.material.emissive.set(d.bulb ?? '#ffd75e').multiplyScalar(0.4);
  }
  view.capRough = d.caps === 'gloss' ? 0.18 : 0.6;
  view.keys.forEach((p) => { if (p.cap) p.cap.material.roughness = view.capRough; });
  // Lichtschein unter dem Gerät
  if (view.glow) {
    view.scene.remove(view.glow);
    disposeMesh(view.glow);
    view.glow = null;
  }
  if (d.glow) {
    const tex = canvasTex(256, 256, (g, W, H) => {
      const r = g.createRadialGradient(W / 2, H / 2, W * 0.18, W / 2, H / 2, W / 2);
      r.addColorStop(0, d.glow);
      r.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = r;
      g.fillRect(0, 0, W, H);
    });
    const { x, minY, maxY, z0 } = view.side;
    const glow = new T.Mesh(new T.PlaneGeometry(-x * 2 + 70, maxY - minY + 70), new T.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.85, depthWrite: false }));
    glow.position.set(0, (minY + maxY) / 2, z0 - 0.6);
    view.glow = glow;
    view.scene.add(glow);
  }
}

// Kamera: 'front' (Standard), 'left' (Anschlüsse links) oder 'back' (Rückseite)
const SIDE_CAM = { front: [[-150, -250, 230], [5, 0, 12]], left: [[-300, -60, 110], [-40, 0, 8]], back: [[70, 300, 110], [0, 20, 10]] };
export function showConsoleSide(side) {
  if (!view) return;
  const [pos, target] = SIDE_CAM[side === true ? 'left' : side] ?? SIDE_CAM.front;
  view.camera.position.set(...pos);
  view.controls.target.set(...target);
  view.controls.update();
}

function disposeMesh(m) {
  if (!m.isMesh) return;
  m.geometry.dispose();
  for (const mat of [m.material].flat()) {
    mat.map?.dispose();
    mat.dispose();
  }
}

// ---------- Verpackung ----------
// Maße in mm rund um das Gerät (x −95…95, y −59…59, z −2…31): Unterteil mit Schaum-Einleger und Kabelfach rechts,
// Stülpdeckel mit Scharnier an der hinteren Oberkante.
const BOX = { x0: -104, x1: 154, y0: -68, y1: 68, z0: -10, z1: 34, wall: 2.5, lid: 1.5, lidZ0: 12, lidZ1: 42, foamTop: 20 };
const BOX_CAM = {
  off: [[-150, -250, 230], [5, 0, 12]],
  closed: [[-250, -360, 250], [25, 0, 10]],
  open: [[-210, -430, 420], [25, 25, 45]],
  cut: [[-80, -330, 95], [25, 0, 6]],
};

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const FONT = 'Inter, system-ui, sans-serif';
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }

function lidTopTex(spec) {
  return canvasTex(1032, 556, (g, W, H) => {
    if (spec.premium) {
      const bg = g.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, '#0f0a1c');
      bg.addColorStop(0.55, '#241048');
      bg.addColorStop(1, '#4c1d95');
      g.fillStyle = bg;
      g.fillRect(0, 0, W, H);
      for (const [x, y, r, c] of [[W * 0.86, H * 0.18, 260, 'rgba(255,90,168,.35)'], [W * 0.12, H * 0.95, 300, 'rgba(145,70,255,.35)']]) {
        const glow = g.createRadialGradient(x, y, 0, x, y, r);
        glow.addColorStop(0, c);
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = glow;
        g.fillRect(0, 0, W, H);
      }
    } else {
      g.fillStyle = '#0c0d11';
      g.fillRect(0, 0, W, H);
    }
    // feines Linienmuster
    g.save();
    g.strokeStyle = spec.premium ? 'rgba(255,255,255,.045)' : 'rgba(255,255,255,.035)';
    g.lineWidth = 2;
    for (let d = -H; d < W; d += 22) { g.beginPath(); g.moveTo(d, H); g.lineTo(d + H, 0); g.stroke(); }
    g.restore();
    // Console von oben als Bildmarke: Gehäuse, 3 × 3 Tasten, Ideen-Knopf, Display mit „LIVE“
    const bx = 46;
    const by = 92;
    const bw = 356;
    const bh = 352;
    g.fillStyle = spec.premium ? 'rgba(10,6,20,.75)' : '#16171d';
    roundRect(g, bx, by, bw, bh, 28);
    g.fill();
    g.strokeStyle = spec.premium ? 'rgba(201,179,255,.35)' : 'rgba(255,255,255,.55)';
    g.lineWidth = 3;
    g.stroke();
    const ks = 70;
    spec.keyColors.slice(0, 9).forEach((col, i) => {
      const x = bx + 26 + (i % 3) * (ks + 14);
      const y = by + 26 + Math.floor(i / 3) * (ks + 14);
      if (spec.premium) {
        g.shadowColor = col;
        g.shadowBlur = 24;
        g.fillStyle = col;
        roundRect(g, x, y, ks, ks, 14);
        g.fill();
      } else {
        g.shadowBlur = 0;
        g.strokeStyle = 'rgba(255,255,255,.85)';
        g.lineWidth = 3.5;
        roundRect(g, x, y, ks, ks, 14);
        g.stroke();
      }
    });
    g.shadowBlur = 0;
    g.fillStyle = '#ffd75e';
    g.beginPath();
    g.arc(bx + bw - 40, by + 140, 13, 0, Math.PI * 2);
    g.fill();
    const dy = by + 272;
    g.fillStyle = '#07080b';
    roundRect(g, bx + 26, dy, bw - 52, 58, 10);
    g.fill();
    g.fillStyle = '#ff5a4e';
    g.beginPath();
    g.arc(bx + 50, dy + 29, 7, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffffff';
    g.font = `800 24px ${FONT}`;
    g.textBaseline = 'middle';
    g.fillText('LIVE', bx + 66, dy + 30);
    g.fillStyle = 'rgba(255,255,255,.25)';
    roundRect(g, bx + 140, dy + 24, bw - 192, 10, 5);
    g.fill();
    g.fillStyle = spec.premium ? '#ff5aa8' : '#ffffff';
    roundRect(g, bx + 140, dy + 24, (bw - 192) * 0.62, 10, 5);
    g.fill();
    // Piktogramme der Anschlüsse unten rechts
    const icons = [['HDMI', (x, y) => { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 34, y); g.lineTo(x + 30, y + 14); g.lineTo(x + 4, y + 14); g.closePath(); g.stroke(); }],
      ['USB-C', (x, y) => { roundRect(g, x + 4, y + 2, 26, 11, 5.5); g.stroke(); }],
      ['Headset', (x, y) => { g.beginPath(); g.arc(x + 17, y + 12, 12, Math.PI, 0); g.stroke(); g.fillRect(x + 3, y + 10, 6, 9); g.fillRect(x + 25, y + 10, 6, 9); }]];
    g.strokeStyle = 'rgba(255,255,255,.8)';
    g.fillStyle = 'rgba(255,255,255,.8)';
    g.lineWidth = 3;
    g.font = `600 15px ${FONT}`;
    g.textAlign = 'center';
    icons.forEach(([name, draw], i) => {
      const x = 90 + i * 84;
      draw(x - 17, H - 80);
      g.fillText(name, x, H - 42);
    });
    g.textAlign = 'left';
    // Schrift
    g.textBaseline = 'alphabetic';
    g.fillStyle = '#ffffff';
    g.font = `800 66px ${FONT}`;
    g.fillText('STREAMHELP', 432, 214);
    g.fillStyle = spec.premium ? '#c9b3ff' : '#d9dce4';
    g.font = `600 44px ${FONT}`;
    g.fillText('C O N S O L E', 434, 278);
    g.fillStyle = 'rgba(255,255,255,.72)';
    g.font = `400 28px ${FONT}`;
    g.fillText('Capture Card + Tastenpult', 434, 326);
    // Merkmale als Chips
    g.font = `600 22px ${FONT}`;
    let x = 434;
    let y = 366;
    for (const t of spec.specs.slice(0, 6)) {
      const w = g.measureText(t).width + 32;
      if (x + w > W - 150) { x = 434; y += 50; } // rechts bleibt Platz für die Banderole
      g.fillStyle = spec.premium ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.06)';
      roundRect(g, x, y, w, 38, 19);
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,.25)';
      g.lineWidth = 1.5;
      g.stroke();
      g.fillStyle = '#ffffff';
      g.fillText(t, x + 16, y + 26);
      x += w + 10;
    }
  });
}

function bandTex(w, left, right, premium) {
  return canvasTex(Math.round(w * 4), 120, (g, W, H) => {
    if (premium) {
      const bg = g.createLinearGradient(0, 0, W, 0);
      bg.addColorStop(0, '#1a0f30');
      bg.addColorStop(1, '#3b1778');
      g.fillStyle = bg;
    } else g.fillStyle = '#0c0d11';
    g.fillRect(0, 0, W, H);
    g.fillStyle = premium ? '#9146ff' : '#ffffff';
    g.fillRect(0, H - 8, W, 8);
    g.fillStyle = premium ? 'rgba(255,90,168,.7)' : 'rgba(255,255,255,.25)';
    g.fillRect(0, 0, W, 3);
    g.textBaseline = 'middle';
    g.fillStyle = '#ffffff';
    g.font = `700 34px ${FONT}`;
    g.fillText(left, 28, H / 2 - 4);
    g.font = `500 24px ${FONT}`;
    g.fillStyle = 'rgba(255,255,255,.75)';
    g.textAlign = 'right';
    g.fillText(right, W - 28, H / 2 - 4);
  });
}

function lidInsideTex(spec) {
  return canvasTex(1020, 532, (g, W, H) => {
    g.fillStyle = spec.premium ? '#9146ff' : '#16171d';
    g.fillRect(0, 0, W, H);
    if (spec.premium) {
      const bg = g.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, '#9146ff');
      bg.addColorStop(1, '#ff5aa8');
      g.fillStyle = bg;
      g.fillRect(0, 0, W, H);
    }
    g.fillStyle = '#ffffff';
    g.textBaseline = 'alphabetic';
    g.font = `800 64px ${FONT}`;
    g.fillText('Bereit für deinen Stream.', 60, 140);
    g.font = `500 30px ${FONT}`;
    const steps = spec.hdmi
      ? ['1  USB-C an den PC', '2  Konsole an HDMI IN, Fernseher an HDMI OUT', '3  StreamHelp öffnen – Tasten belegen, live gehen']
      : ['1  USB-C an den PC', '2  StreamHelp öffnen und Tasten belegen', '3  Live gehen'];
    steps.forEach((t, i) => g.fillText(t, 64, 240 + i * 62));
    g.font = `600 24px ${FONT}`;
    g.fillStyle = 'rgba(255,255,255,.8)';
    g.fillText('STREAMHELP CONSOLE', 64, H - 50);
  });
}

function buildBox(spec) {
  const B = BOX;
  const group = new T.Group();
  const cut = [];
  const mat = (color, extra = {}) => new T.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05, ...extra });
  const outerCol = spec.premium ? 0x1d1035 : 0x0e0f13;
  const innerCol = spec.premium ? 0x7c3aed : 0x22242b;
  const pack = spec.pack ?? {};
  const INSERT = { foam: [0x17181d, 0x050506], pulp: [0xb9b1a3, 0x6b6357], card: [0x9c8664, 0x4a3d2b] };
  const [insertCol, holeCol] = INSERT[pack.insert] ?? INSERT.foam;
  const foam = mat(insertCol, { roughness: 1 });
  const accent = spec.accent ?? '#9146ff';
  const add = (parent, geo, material, x, y, z, isCut = false) => {
    const m = new T.Mesh(geo, material);
    m.position.set(x, y, z);
    parent.add(m);
    if (isCut) cut.push(m);
    return m;
  };
  const box = (parent, xa, xb, ya, yb, za, zb, material, isCut) =>
    add(parent, new T.BoxGeometry(xb - xa, yb - ya, zb - za), material, (xa + xb) / 2, (ya + yb) / 2, (za + zb) / 2, isCut);
  // Materialien je Seite: [+x, −x, +y, −y, +z, −z]
  const sides = (outerIdx, outerMat) => {
    const list = Array.from({ length: 6 }, () => mat(innerCol));
    list[outerIdx] = outerMat;
    return list;
  };
  const w = B.wall;
  // Unterteil
  const trayOut = () => mat(outerCol);
  box(group, B.x0, B.x1, B.y0, B.y1, B.z0, B.z0 + w, trayOut());
  box(group, B.x0, B.x1, B.y0, B.y0 + w, B.z0, B.z1, sides(3, trayOut()), true); // vorn
  box(group, B.x0, B.x1, B.y1 - w, B.y1, B.z0, B.z1, sides(2, trayOut()));
  box(group, B.x0, B.x0 + w, B.y0 + w, B.y1 - w, B.z0, B.z1, sides(1, trayOut()));
  box(group, B.x1 - w, B.x1, B.y0 + w, B.y1 - w, B.z0, B.z1, sides(0, trayOut()));
  // Schaum-Einleger mit Aussparung für das Gerät (x −96…96, y −60…60)
  const fz = B.z0 + w;
  const ix0 = B.x0 + w;
  const iy0 = B.y0 + w;
  const iy1 = B.y1 - w;
  box(group, -96, 96, -60, 60, fz, -2.2, foam);
  box(group, ix0, -96, iy0, iy1, fz, B.foamTop, foam);
  box(group, -96, 104, iy0, -60, fz, B.foamTop, foam, true);
  box(group, -96, 104, 60, iy1, fz, B.foamTop, foam);
  box(group, 96, 104, -60, 60, fz, B.foamTop, foam);
  // Grifflöcher links und rechts neben dem Gerät
  for (const gx of [-96, 96]) {
    const grip = add(group, new T.CylinderGeometry(7, 7, 0.6, 32), mat(holeCol, { roughness: 1 }), gx, 0, B.foamTop + 0.05);
    grip.rotation.x = Math.PI / 2;
  }
  // Lift-Band: läuft unter dem Gerät durch und liegt vorn als Lasche auf dem Einleger
  if (pack.ribbon === 'yes') {
    const rib = () => mat(accent, { roughness: 0.5 });
    box(group, -66, -54, -60.4, -60, -2.2, B.foamTop, rib());
    box(group, -66, -54, -64.8, -60, B.foamTop, B.foamTop + 0.3, rib(), true);
    box(group, -64, -56, -63.2, -62.7, B.foamTop, B.foamTop + 5, rib(), true); // Schlaufe zum Greifen
  }
  // Displayschutzfolie mit Lasche
  const scr = view.screen;
  if (pack.film === 'yes' && scr) {
    const film = add(group, new T.PlaneGeometry(scr.w * 0.96, scr.h * 0.96), new T.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0, depthWrite: false }), scr.cx, scr.cy, scr.top + 0.5);
    film.renderOrder = 2;
    const tabTex = canvasTex(128, 64, (g, W, H) => {
      g.fillStyle = accent;
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#ffffff';
      g.font = `800 34px ${FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('1 ↗', W / 2, H / 2);
    });
    add(group, new T.PlaneGeometry(10, 5), new T.MeshBasicMaterial({ map: tabTex }), scr.cx + scr.w * 0.48 + 3, scr.cy + scr.h * 0.48 - 2, scr.top + 0.55);
  }
  // Kabelfach rechts (x 104…151)
  const cx = (104 + B.x1 - w) / 2;
  box(group, 104, B.x1 - w, iy0, iy1, fz, 4, foam);
  const coil = (y, color, r) => {
    add(group, new T.CylinderGeometry(r, r, 7, 40), mat(color, { roughness: 0.55 }), cx, y, 7.5).rotation.x = Math.PI / 2;
    add(group, new T.CylinderGeometry(r * 0.45, r * 0.45, 7.4, 28), foam, cx, y, 7.5).rotation.x = Math.PI / 2;
    box(group, cx - 3, cx + 3, y - r - 1, y + r + 1, 10.6, 11.6, mat(0x9146ff)); // Kabelbinder
  };
  coil(36, 0x2d2f36, 18);
  if (spec.hdmiCable ?? spec.hdmi) {
    coil(-4, 0x111216, 18);
    box(group, cx + 6, cx + 20, -9, 1, 9, 15, mat(0xb8bcc6, { metalness: 0.8, roughness: 0.3 })); // Stecker
  }
  // Schnellstart-Karte (und Sticker bei Premium)
  const cardTex = canvasTex(256, 192, (g, W, H) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#9146ff';
    g.fillRect(0, 0, W, 34);
    g.fillStyle = '#ffffff';
    g.font = `700 20px ${FONT}`;
    g.fillText('Schnellstart', 12, 24);
    g.fillStyle = '#333';
    g.font = `400 16px ${FONT}`;
    ['1 USB-C an den PC', spec.hdmi ? '2 HDMI IN / OUT' : '2 Tasten belegen', '3 Live gehen'].forEach((t, i) => g.fillText(t, 12, 70 + i * 34));
  });
  const card = add(group, new T.BoxGeometry(40, 30, 1.2), [mat(0xffffff), mat(0xffffff), mat(0xffffff), mat(0xffffff), new T.MeshStandardMaterial({ map: cardTex, roughness: 0.8 }), mat(0xffffff)], cx, -47, 5);
  card.rotation.z = 0.06;
  if (spec.premium) {
    const st = add(group, new T.BoxGeometry(36, 24, 0.8), mat(0xff5aa8, { roughness: 0.4 }), cx + 1, -44, 6.2);
    st.rotation.z = -0.12;
  }

  // Deckel mit Scharnier an der hinteren Oberkante
  const pivot = new T.Group();
  pivot.position.set(0, B.y1 + B.lid, B.lidZ1);
  const lid = new T.Group();
  lid.position.set(0, -(B.y1 + B.lid), -B.lidZ1);
  pivot.add(lid);
  group.add(pivot);
  const l = B.lid;
  const lx0 = B.x0 - l;
  const lx1 = B.x1 + l;
  const ly0 = B.y0 - l;
  const ly1 = B.y1 + l;
  const top = new T.MeshStandardMaterial({ map: lidTopTex(spec), roughness: spec.premium ? 0.35 : 0.6, metalness: 0.05 });
  box(lid, lx0, lx1, ly0, ly1, B.lidZ1 - 2.5, B.lidZ1, sides(4, top));
  // Seitenwände: Aufdruck als eigene Fläche davor (BoxGeometry legt Texturen an den Stirnseiten quer)
  const lz0 = B.lidZ0;
  const lz1 = B.lidZ1 - 2.5;
  const lzc = (lz0 + lz1) / 2;
  const band = (len, a, b, x, y, look, isCut) => {
    const m = add(lid, new T.PlaneGeometry(len, lz1 - lz0), new T.MeshStandardMaterial({ map: bandTex(len, a, b, spec.premium), roughness: 0.5 }), x, y, lzc, isCut);
    m.up.set(0, 0, 1);
    m.lookAt(x + look[0], y + look[1], lzc);
    return m;
  };
  const wallMat = () => sides(0, mat(outerCol)).map((m, i) => (i < 4 ? mat(outerCol) : m));
  box(lid, lx0, lx1, ly0, B.y0, lz0, lz1, wallMat(), true);
  box(lid, lx0, lx1, B.y1, ly1, lz0, lz1, wallMat());
  box(lid, lx0, B.x0, B.y0, B.y1, lz0, lz1, wallMat());
  box(lid, B.x1, lx1, B.y0, B.y1, lz0, lz1, wallMat());
  band(lx1 - lx0, 'STREAMHELP CONSOLE', 'Capture Card · Tastenpult', (lx0 + lx1) / 2, ly0 - 0.05, [0, -100], true);
  band(lx1 - lx0, 'Inhalt', spec.contents.join(' · '), (lx0 + lx1) / 2, ly1 + 0.05, [0, 100]);
  band(ly1 - ly0, spec.specs[0] ?? 'StreamHelp', spec.specs[1] ?? '', lx0 - 0.05, 0, [-100, 0]);
  band(ly1 - ly0, 'Bild · Ton · Tasten', 'alles in einer Box', lx1 + 0.05, 0, [100, 0]);
  const inside = new T.Mesh(new T.PlaneGeometry(B.x1 - B.x0 - 2, B.y1 - B.y0 - 2), new T.MeshStandardMaterial({ map: lidInsideTex(spec), roughness: 0.6 }));
  inside.position.set((B.x0 + B.x1) / 2, 0, B.lidZ1 - 2.6);
  inside.rotation.x = Math.PI;
  lid.add(inside);
  // Aufreißlasche vorn
  box(lid, 16, 40, ly0 - 1.6, ly0, lz0 - 4, lz0 + 3, mat(accent, { roughness: 0.5 }), true);
  const tabLabel = add(lid, new T.PlaneGeometry(22, 5.5), new T.MeshBasicMaterial({ map: canvasTex(256, 64, (g, W, H) => {
    g.fillStyle = accent;
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#ffffff';
    g.font = `700 30px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('Hier öffnen ▲', W / 2, H / 2);
  }) }), 28, ly0 - 1.65, lz0 - 0.5, true);
  tabLabel.up.set(0, 0, 1);
  tabLabel.lookAt(28, ly0 - 100, lz0 - 0.5);
  // Fach im Deckel mit Dankeskarte (QR-Code zur Einrichtung) und Stickern
  if (pack.card === 'yes' || spec.premium) {
    const pz = B.lidZ1 - 2.9;
    if (pack.card === 'yes') {
      const qrTex = canvasTex(256, 192, (g, W, H) => {
        g.fillStyle = '#ffffff';
        g.fillRect(0, 0, W, H);
        g.fillStyle = '#111';
        g.font = `800 26px ${FONT}`;
        g.fillText('Danke!', 14, 36);
        g.font = `400 15px ${FONT}`;
        g.fillText('Scannen und einrichten', 14, 62);
        // Platzhalter-Muster im Stil eines QR-Codes (der echte Code kommt mit dem Druck)
        let seed = 7;
        const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
        const q = 6;
        const ox = 150;
        const oy = 80;
        const finder = (r, c) => (r < 6 && c < 6) || (r < 6 && c > 10) || (r > 10 && c < 6);
        for (let r = 0; r < 17; r++) for (let c = 0; c < 17; c++) if (!finder(r, c) && rnd() > 0.55) g.fillRect(ox + c * q, oy + r * q, q, q);
        for (const [r, c] of [[0, 0], [0, 12], [12, 0]]) {
          g.fillStyle = '#111';
          g.fillRect(ox + c * q, oy + r * q, 5 * q, 5 * q);
          g.fillStyle = '#fff';
          g.fillRect(ox + (c + 1) * q, oy + (r + 1) * q, 3 * q, 3 * q);
          g.fillStyle = '#111';
          g.fillRect(ox + (c + 2) * q, oy + (r + 2) * q, q, q);
        }
        g.fillStyle = accent;
        g.fillRect(0, H - 10, W, 10);
      });
      // Karte: weißer Körper plus Aufdruck als Fläche, ausgerichtet wie der Deckel-Innendruck (lesbar bei offenem Deckel)
      add(lid, new T.BoxGeometry(44, 33, 0.6), mat(0xffffff, { roughness: 0.8 }), 128, -26, pz);
      const face = add(lid, new T.PlaneGeometry(43, 32), new T.MeshStandardMaterial({ map: qrTex, roughness: 0.8 }), 128, -26, pz - 0.32);
      face.rotation.x = Math.PI;
    }
    if (spec.premium) {
      const st = add(lid, new T.BoxGeometry(38, 26, 0.5), mat(0xff5aa8, { roughness: 0.4 }), 122, 18, pz + 0.05);
      st.rotation.z = -0.1;
    }
    box(lid, 100, 152, -22, -4, pz - 0.4, pz - 0.2, mat(spec.premium ? 0x4c1d95 : 0x2a2c33, { roughness: 0.6 })); // Fach hält die Karte unten (bei offenem Deckel)
  }
  // Banderole (nur bei geschlossenem Karton zu sehen)
  let sleeve = null;
  if (pack.sleeve === 'yes') {
    sleeve = new T.Group();
    const sm = () => mat(accent, { roughness: 0.45 });
    const sx0 = 130;
    const sx1 = 152;
    box(sleeve, sx0, sx1, ly0 - 0.6, ly1 + 0.6, B.lidZ1, B.lidZ1 + 0.5, sm());
    box(sleeve, sx0, sx1, ly0 - 0.6, ly0 - 0.1, B.z0 - 0.5, B.lidZ1 + 0.5, sm());
    box(sleeve, sx0, sx1, ly1 + 0.1, ly1 + 0.6, B.z0 - 0.5, B.lidZ1 + 0.5, sm());
    box(sleeve, sx0, sx1, ly0 - 0.6, ly1 + 0.6, B.z0 - 0.5, B.z0, sm());
    const sl = add(sleeve, new T.PlaneGeometry(ly1 - ly0 - 8, 16), new T.MeshBasicMaterial({ transparent: true, map: canvasTex(512, 96, (g, W, H) => {
      g.fillStyle = '#ffffff';
      g.font = `800 52px ${FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('NEU · CONSOLE', W / 2, H / 2);
    }) }), (sx0 + sx1) / 2, 0, B.lidZ1 + 0.55);
    sl.rotation.z = Math.PI / 2;
    group.add(sleeve);
  }
  return { group, pivot, cut, sleeve };
}

function applyBoxMode() {
  const b = view.box;
  b.group.visible = b.mode !== 'off';
  const target = b.mode === 'open' ? 1 : 0;
  if (target !== b.target) Object.assign(b, { from: b.t, target, start: performance.now() });
  for (const m of b.cut) m.visible = b.mode !== 'cut';
  if (b.sleeve) b.sleeve.visible = b.mode === 'closed';
}

function stepBox() {
  const b = view?.box;
  if (!b || !b.group.visible) return;
  const k = Math.min(1, (performance.now() - (b.start ?? 0)) / 900);
  b.t = (b.from ?? b.target) + (b.target - (b.from ?? b.target)) * k;
  const e = b.t * b.t * (3 - 2 * b.t);
  b.pivot.rotation.x = -1.95 * e;
}

// spec: { premium, hdmi, specs: [Text], contents: [Text], keyColors: ['#rrggbb' × 9] }
export function setConsoleBox(spec) {
  if (!view || !T) return;
  const mode = view.box?.mode ?? 'off';
  const t = view.box?.t ?? 0;
  if (view.box) {
    view.scene.remove(view.box.group);
    view.box.group.traverse(disposeMesh);
  }
  view.box = { ...buildBox(spec), mode, t, from: t, target: mode === 'open' ? 1 : 0, start: 0 };
  view.scene.add(view.box.group);
  applyBoxMode();
  stepBox();
}

// mode: 'off' (nur Gerät) | 'closed' | 'open' | 'cut' (Schnitt durch die Vorderseite)
export function setBoxMode(mode) {
  if (!view?.box || !BOX_CAM[mode]) return;
  view.box.mode = mode;
  applyBoxMode();
  const [pos, target] = BOX_CAM[mode];
  view.camera.position.set(...pos);
  view.controls.target.set(...target);
  view.controls.update();
}

export function setConsoleSpin(on) {
  if (!view) return;
  view.controls.autoRotate = !!on;
  view.controls.autoRotateSpeed = 1.2;
}
export const console3dActive = () => !!view;

export function disposeConsole3d() {
  if (!view) return;
  view.renderer.setAnimationLoop(null);
  view.controls.dispose();
  view.scene.traverse(disposeMesh);
  view.renderer.dispose();
  view = null;
}
