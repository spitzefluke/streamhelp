// Emote-Editor: Projekte lokal im Browser speichern (IndexedDB „sh_emote_editor“). Nichts verlässt das Gerät.
// Ein Eintrag: { id, name, fmt, updated (ms), thumb (data-URL, klein), cloud (true = auch im Konto), doc }
// doc = { v: 1, name, fmt, speed, matte, layers: [...], images: { <Bild-ID>: Blob } }
const DB = 'sh_emote_editor';
const STORE = 'projects';
const LAST = 'sh_emote_last';

let dbp = null;
function db() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) { reject(new Error('Dieser Browser kann nicht lokal speichern.')); return; }
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'id' }).createIndex('updated', 'updated');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('Lokaler Speicher nicht verfügbar (privates Fenster?).'));
      req.onblocked = () => reject(new Error('Lokaler Speicher ist gerade blockiert – andere Tabs mit dem Editor schließen.'));
    });
    dbp.catch(() => { dbp = null; }); // beim nächsten Versuch neu öffnen
  }
  return dbp;
}
function run(mode, fn) {
  return db().then((d) => new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, mode);
    const st = tx.objectStore(STORE);
    let out;
    const req = fn(st);
    if (req) req.onsuccess = () => { out = req.result; };
    tx.oncomplete = () => resolve(out);
    tx.onerror = () => reject(tx.error ?? new Error('Speichern im Browser fehlgeschlagen.'));
    tx.onabort = () => reject(tx.error ?? new Error('Speichern im Browser abgebrochen (Speicher voll?).'));
  }));
}

// Liste ohne die großen Projektdaten
export async function localList() {
  const all = await run('readonly', (st) => st.getAll());
  return (all ?? []).map(({ id, name, fmt, updated, thumb, cloud }) => ({ id, name, fmt, updated, thumb, cloud: !!cloud }))
    .sort((a, b) => b.updated - a.updated);
}
export const localGet = (id) => run('readonly', (st) => st.get(id));
export const localPut = (rec) => run('readwrite', (st) => st.put(rec));
export const localDelete = (id) => run('readwrite', (st) => st.delete(id));

// zuletzt geöffnetes Projekt (nur die ID)
export function lastId() { try { return localStorage.getItem(LAST); } catch { return null; } }
export function setLastId(id) {
  try { if (id) localStorage.setItem(LAST, id); else localStorage.removeItem(LAST); } catch { /* privates Fenster: dann eben ohne */ }
}
