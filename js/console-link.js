// Verbindung zwischen Touch-Gerät (console-touch.html, Simulator im Admin-Bereich) und Bridge am PC
// (console-bridge.html mit OBS). Live: privater Realtime-Kanal console:<Kanal-ID> – lesen und senden dürfen
// nur Plattform-Admins (Migration …_console_bridge.sql). Demo-Modus: BroadcastChannel zwischen Tabs desselben
// Browsers plus direkte Zustellung innerhalb der Seite. Es bleibt nichts gespeichert.
//
// Nachrichten: cmd {id, type, arg} (Gerät → Bridge), ack {id, ok, text} und state {...} (Bridge → Gerät),
// hello {} (Gerät bittet um den aktuellen Zustand).
const EVENTS = ['cmd', 'ack', 'state', 'hello'];
const local = new Map(); // Thema → Set der Verbindungen in dieser Seite

// Thema für einen Kanal (null = Standard-Kanal) – alle Seiten lösen es gleich auf
export async function linkTopic(api, key = null) {
  const res = await api.resolveChannel(key).catch(() => ({ channel: null }));
  return `console:${res.channel?.id ?? 'default'}`;
}

export function openLink(api, topic) {
  const listeners = new Map(EVENTS.map((e) => [e, new Set()]));
  const emit = (event, payload) => { for (const cb of listeners.get(event) ?? []) cb(payload ?? {}); };
  let status = 'connecting';
  const statusCbs = new Set();
  const setStatus = (s) => { status = s; for (const cb of statusCbs) cb(s); };
  let send;
  let close;

  if (api.demo) {
    const bc = 'BroadcastChannel' in window ? new BroadcastChannel(`sh-${topic}`) : null;
    const self = { emit };
    if (!local.has(topic)) local.set(topic, new Set());
    local.get(topic).add(self);
    if (bc) bc.onmessage = (e) => { if (EVENTS.includes(e.data?.event)) emit(e.data.event, e.data.payload); };
    send = async (event, payload) => {
      bc?.postMessage({ event, payload });
      for (const other of local.get(topic) ?? []) if (other !== self) setTimeout(() => other.emit(event, payload), 0);
      return 'ok';
    };
    close = () => { bc?.close(); local.get(topic)?.delete(self); };
    setTimeout(() => setStatus('ok'), 0);
  } else {
    const sb = api.raw.sb;
    const ch = sb.channel(topic, { config: { private: true, broadcast: { self: false } } });
    for (const event of EVENTS) ch.on('broadcast', { event }, (m) => emit(event, m.payload));
    ch.subscribe((s) => {
      if (s === 'SUBSCRIBED') setStatus('ok');
      else if (s === 'CHANNEL_ERROR') { setStatus('error'); console.warn('Console-Verbindung: Kanal abgelehnt – Migration …_console_bridge.sql ausgeführt und als Admin angemeldet?'); }
      else if (s === 'TIMED_OUT' || s === 'CLOSED') setStatus('offline');
    });
    send = (event, payload) => ch.send({ type: 'broadcast', event, payload });
    close = () => { sb.removeChannel(ch); };
  }

  return {
    topic,
    get status() { return status; },
    onStatus(cb) { statusCbs.add(cb); cb(status); return () => statusCbs.delete(cb); },
    on(event, cb) { listeners.get(event)?.add(cb); return () => listeners.get(event)?.delete(cb); },
    send,
    // Befehl an die Bridge schicken und auf die Antwort warten
    request(type, arg = {}, timeout = 6000) {
      const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      return new Promise((resolve, reject) => {
        const off = this.on('ack', (a) => {
          if (a.id !== id) return;
          off();
          clearTimeout(t);
          if (a.ok) resolve(a.text ?? '');
          else reject(new Error(a.text || 'OBS hat den Befehl abgelehnt.'));
        });
        const t = setTimeout(() => { off(); reject(new Error('Die Bridge am PC antwortet nicht – läuft console-bridge.html?')); }, timeout);
        Promise.resolve(send('cmd', { id, type, arg })).catch((err) => { off(); clearTimeout(t); reject(err); });
      });
    },
    close() { close(); for (const s of listeners.values()) s.clear(); statusCbs.clear(); },
  };
}
