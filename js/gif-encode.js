// Kleiner GIF-Encoder (GIF89a, Endlosschleife) für animierte Emotes – läuft komplett im Browser.
// Eine gemeinsame Farbpalette für alle Bilder (Median-Cut, 255 Farben + 1 durchsichtig), LZW-Kompression.
// GIF kennt nur „ganz durchsichtig“ oder „deckend“: Pixel unter Alpha 128 werden durchsichtig, halbdurchsichtige
// Kanten werden mit einer Hintergrundfarbe (matte, z. B. der Chatfarbe) gemischt, damit kein heller Saum entsteht.

const TRANSPARENT = 255;

// frames: ImageData[] (alle gleich groß), delayCs: Dauer je Bild in Hundertstelsekunden, matte: [r, g, b] oder null
export function encodeGif(frames, { delayCs = 4, matte = null } = {}) {
  const { width, height } = frames[0];
  const pixels = frames.map((f) => flatten(f.data, matte));
  const palette = buildPalette(pixels);
  const lookup = new Int16Array(32768).fill(-1);
  const out = new ByteWriter();
  out.str('GIF89a');
  out.u16(width); out.u16(height);
  out.u8(0xf7); out.u8(TRANSPARENT); out.u8(0); // globale Palette mit 256 Einträgen
  for (let i = 0; i < 256; i++) {
    const c = palette[i] ?? [0, 0, 0];
    out.u8(c[0]); out.u8(c[1]); out.u8(c[2]);
  }
  // Endlosschleife (NETSCAPE2.0)
  out.u8(0x21); out.u8(0xff); out.u8(11); out.str('NETSCAPE2.0'); out.u8(3); out.u8(1); out.u16(0); out.u8(0);
  for (const px of pixels) {
    // Grafiksteuerung: Bild vor dem nächsten löschen (Disposal 2), Index 255 durchsichtig
    out.u8(0x21); out.u8(0xf9); out.u8(4); out.u8((2 << 2) | 1); out.u16(Math.max(2, Math.round(delayCs))); out.u8(TRANSPARENT); out.u8(0);
    out.u8(0x2c); out.u16(0); out.u16(0); out.u16(width); out.u16(height); out.u8(0);
    const idx = new Uint8Array(width * height);
    for (let i = 0, p = 0; i < idx.length; i++, p += 4) {
      if (px[p + 3] === 0) { idx[i] = TRANSPARENT; continue; }
      const key = ((px[p] >> 3) << 10) | ((px[p + 1] >> 3) << 5) | (px[p + 2] >> 3);
      let v = lookup[key];
      if (v < 0) { v = nearest(palette, px[p], px[p + 1], px[p + 2]); lookup[key] = v; }
      idx[i] = v;
    }
    out.u8(8);
    out.blocks(lzw(idx, 8));
  }
  out.u8(0x3b);
  return new Blob([out.bytes()], { type: 'image/gif' });
}

// Alpha auf 0/255 bringen, halbdurchsichtige Pixel mit der Hintergrundfarbe mischen
function flatten(data, matte) {
  const px = new Uint8ClampedArray(data);
  for (let p = 0; p < px.length; p += 4) {
    const a = px[p + 3];
    if (a < 128) { px[p + 3] = 0; continue; }
    if (a < 255 && matte) {
      const k = a / 255;
      px[p] = px[p] * k + matte[0] * (1 - k);
      px[p + 1] = px[p + 1] * k + matte[1] * (1 - k);
      px[p + 2] = px[p + 2] * k + matte[2] * (1 - k);
    }
    px[p + 3] = 255;
  }
  return px;
}

// Median-Cut über ein Histogramm mit 5 Bit je Farbkanal
function buildPalette(pixels) {
  const count = new Uint32Array(32768);
  const sum = new Float64Array(32768 * 3);
  for (const px of pixels) {
    for (let p = 0; p < px.length; p += 4) {
      if (!px[p + 3]) continue;
      const key = ((px[p] >> 3) << 10) | ((px[p + 1] >> 3) << 5) | (px[p + 2] >> 3);
      count[key]++;
      sum[key * 3] += px[p]; sum[key * 3 + 1] += px[p + 1]; sum[key * 3 + 2] += px[p + 2];
    }
  }
  const bins = [];
  for (let k = 0; k < 32768; k++) {
    if (!count[k]) continue;
    const n = count[k];
    bins.push([sum[k * 3] / n, sum[k * 3 + 1] / n, sum[k * 3 + 2] / n, n]);
  }
  if (!bins.length) return [[0, 0, 0]];
  const boxes = [bins];
  while (boxes.length < 255) {
    // Box mit der größten (Spannweite × Pixelzahl) teilen
    let best = -1; let bestScore = 0; let bestCh = 0;
    boxes.forEach((box, i) => {
      if (box.length < 2) return;
      let n = 0;
      const lo = [255, 255, 255]; const hi = [0, 0, 0];
      for (const b of box) {
        n += b[3];
        for (let c = 0; c < 3; c++) { if (b[c] < lo[c]) lo[c] = b[c]; if (b[c] > hi[c]) hi[c] = b[c]; }
      }
      const ranges = hi.map((v, c) => v - lo[c]);
      const ch = ranges.indexOf(Math.max(...ranges));
      const score = ranges[ch] * Math.sqrt(n);
      if (score > bestScore) { bestScore = score; best = i; bestCh = ch; }
    });
    if (best < 0) break;
    const box = boxes[best].sort((a, b) => a[bestCh] - b[bestCh]);
    const total = box.reduce((s, b) => s + b[3], 0);
    let acc = 0;
    let cut = 1;
    for (let i = 0; i < box.length - 1; i++) { acc += box[i][3]; if (acc >= total / 2) { cut = i + 1; break; } }
    boxes.splice(best, 1, box.slice(0, cut), box.slice(cut));
  }
  return boxes.map((box) => {
    let n = 0; let r = 0; let g = 0; let b = 0;
    for (const x of box) { n += x[3]; r += x[0] * x[3]; g += x[1] * x[3]; b += x[2] * x[3]; }
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
  });
}

function nearest(palette, r, g, b) {
  let best = 0; let bestD = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const c = palette[i];
    const d = (c[0] - r) ** 2 * 3 + (c[1] - g) ** 2 * 4 + (c[2] - b) ** 2 * 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

// LZW wie in der GIF-Spezifikation (variable Codelänge bis 12 Bit, Clear-Code bei vollem Wörterbuch)
function lzw(indices, minSize) {
  const clear = 1 << minSize;
  const eoi = clear + 1;
  let size = minSize + 1;
  let next = eoi + 1;
  let dict = new Map();
  const bytes = [];
  let cur = 0;
  let bits = 0;
  const emit = (code) => {
    cur |= code << bits;
    bits += size;
    while (bits >= 8) { bytes.push(cur & 255); cur >>>= 8; bits -= 8; }
  };
  emit(clear);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = prefix * 256 + k;
    const hit = dict.get(key);
    if (hit !== undefined) { prefix = hit; continue; }
    emit(prefix);
    if (next === 4096) {
      emit(clear);
      dict = new Map();
      size = minSize + 1;
      next = eoi + 1;
    } else {
      if (next >= (1 << size)) size++;
      dict.set(key, next++);
    }
    prefix = k;
  }
  emit(prefix);
  emit(eoi);
  if (bits > 0) bytes.push(cur & 255);
  return bytes;
}

class ByteWriter {
  constructor() { this.buf = new Uint8Array(1 << 16); this.n = 0; }
  grow(k) {
    if (this.n + k <= this.buf.length) return;
    let len = this.buf.length * 2;
    while (len < this.n + k) len *= 2;
    const b = new Uint8Array(len);
    b.set(this.buf.subarray(0, this.n));
    this.buf = b;
  }
  u8(v) { this.grow(1); this.buf[this.n++] = v & 255; }
  u16(v) { this.u8(v); this.u8(v >> 8); }
  str(s) { for (let i = 0; i < s.length; i++) this.u8(s.charCodeAt(i)); }
  // Daten in Unterblöcken zu je höchstens 255 Bytes, mit 0-Block am Ende
  blocks(data) {
    this.grow(data.length + Math.ceil(data.length / 255) + 1);
    for (let i = 0; i < data.length; i += 255) {
      const part = data.slice(i, i + 255);
      this.buf[this.n++] = part.length;
      for (const v of part) this.buf[this.n++] = v;
    }
    this.buf[this.n++] = 0;
  }
  bytes() { return this.buf.slice(0, this.n); }
}
