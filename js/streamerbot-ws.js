// Streamer.bot über seinen WebSocket-Server auf diesem PC (Streamer.bot: Servers/Clients → WebSocket Server,
// Standard ws://127.0.0.1:8080/). Nur, was die Console braucht: Aktionen auflisten und eine Aktion starten.
// Mit Passwort meldet Streamer.bot sich mit challenge und salt; die Antwort ist
// base64(sha256(base64(sha256(Passwort + salt)) + challenge)). Das Passwort verlässt diesen PC nie.
// Spotify, Musik, Lichter usw. steuert man über Streamer.bot-Aktionen (Streamer.bot hat dafür eigene Unterbefehle).

const TIMEOUT_MS = 5000;
const MAX_ACTIONS = 150;

async function sha256b64(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

export class StreamerbotSocket {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.pending = new Map();
    this.onClose = null;
    this.seq = 0;
  }

  connect({ port = 8080, password = '' } = {}) {
    this.close();
    const p = Math.round(Number(port));
    const url = `ws://127.0.0.1:${p >= 1 && p <= 65535 ? p : 8080}/`;
    return new Promise((resolve, reject) => {
      let done = false;
      const fail = (err) => { if (done) return; done = true; clearTimeout(timer); this.close(); reject(err); };
      const timer = setTimeout(() => fail(new Error('Streamer.bot antwortet nicht – läuft dort der WebSocket-Server (Servers/Clients → WebSocket Server, „Auto Start“)?')), TIMEOUT_MS);
      let ws;
      try {
        ws = new WebSocket(url);
      } catch (err) {
        fail(new Error(`Keine Verbindung zu Streamer.bot: ${err.message}`));
        return;
      }
      this.ws = ws;
      ws.onclose = () => {
        const was = this.connected;
        this.connected = false;
        for (const { reject: rej, timer: t } of this.pending.values()) { clearTimeout(t); rej(new Error('Streamer.bot getrennt.')); }
        this.pending.clear();
        if (!done) fail(new Error(`Keine Verbindung zu Streamer.bot (${url}) – Port richtig und WebSocket-Server an?`));
        else if (was) this.onClose?.();
      };
      ws.onmessage = async (e) => {
        let m;
        try { m = JSON.parse(e.data); } catch { return; }
        if (m?.request === 'Hello') {
          try {
            if (m.authentication) {
              if (!password) throw new Error('Streamer.bot verlangt ein Passwort (WebSocket Server → Authentication).');
              const secret = await sha256b64(password + m.authentication.salt);
              const auth = await sha256b64(secret + m.authentication.challenge);
              await this.request('Authenticate', { authentication: auth });
            }
            this.connected = true;
            done = true;
            clearTimeout(timer);
            resolve(m.info ?? {});
          } catch (err) {
            fail(/auth|invalid|denied/i.test(err.message) ? new Error('Streamer.bot: Passwort falsch.') : err);
          }
          return;
        }
        const wait = m?.id ? this.pending.get(m.id) : null;
        if (!wait) return;
        this.pending.delete(m.id);
        clearTimeout(wait.timer);
        if (m.status && m.status !== 'ok') wait.reject(new Error(m.error ? `Streamer.bot: ${m.error}` : 'Streamer.bot hat abgelehnt.'));
        else wait.resolve(m);
      };
    });
  }

  request(type, data = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return Promise.reject(new Error('Streamer.bot ist nicht verbunden.'));
    const id = `sh${Date.now().toString(36)}${++this.seq}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('Streamer.bot antwortet nicht.')); }, TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer });
      this.ws.send(JSON.stringify({ request: type, id, ...data }));
    });
  }

  // Aktive Aktionen: [{ id, name, group }]
  async getActions() {
    const r = await this.request('GetActions');
    return (r.actions ?? []).filter((a) => a?.id && a.enabled !== false).slice(0, MAX_ACTIONS)
      .map((a) => ({ id: String(a.id).slice(0, 64), name: String(a.name ?? '').slice(0, 60), group: String(a.group ?? '').slice(0, 40) }));
  }

  doAction(id, name = '') {
    return this.request('DoAction', { action: { id, name }, args: { source: 'streamhelp-console' } });
  }

  close() {
    const ws = this.ws;
    this.ws = null;
    this.connected = false;
    if (ws) { ws.onclose = null; ws.onmessage = null; try { ws.close(); } catch { /* schon zu */ } }
    for (const { reject, timer } of this.pending.values()) { clearTimeout(timer); reject(new Error('Streamer.bot getrennt.')); }
    this.pending.clear();
  }
}

// Demo-Streamer.bot (nur Demo-Modus): ein paar Beispiel-Aktionen, u. a. für Spotify
export function createDemoStreamerbot() {
  const actions = [
    { id: '11111111-1111-4111-8111-111111111111', name: 'Spotify: Pause/Weiter', group: 'Musik' },
    { id: '22222222-2222-4222-8222-222222222222', name: 'Spotify: Nächster Song', group: 'Musik' },
    { id: '33333333-3333-4333-8333-333333333333', name: 'Hue: Lichter Lila', group: 'Licht' },
    { id: '44444444-4444-4444-8444-444444444444', name: 'Hydrate-Erinnerung', group: 'Chat' },
  ];
  return {
    connected: true,
    demo: true,
    async getActions() { return actions; },
    async doAction(id) { if (!actions.some((a) => a.id === id)) throw new Error('Aktion fehlt'); return { status: 'ok' }; },
    close() {},
  };
}
