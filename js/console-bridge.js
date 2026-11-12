// Bridge am PC: verbindet das Touch-Gerät (js/console-link.js) mit OBS (obs-websocket 5 auf diesem PC,
// js/obs-ws.js). Führt nur eine feste Liste von Befehlen aus und nur für Szenen und Audioquellen, die OBS
// selbst gemeldet hat. Meldet den Zustand (Szenen, Ton, Stream, Aufnahme, Replay, Leistung) ans Gerät –
// alle 3 Sekunden und sofort, wenn OBS eine Änderung meldet.
const STATE_MS = 3000;
const MAX_SCENES = 24;
const MAX_INPUTS = 12;
// obs-websocket: Ereignisse für Szenen (4), Quellen (8) und Ausgaben (64)
const EVENT_MASK = 4 | 8 | 64;
const WATCH = /^(CurrentProgramSceneChanged|SceneListChanged|SceneCreated|SceneRemoved|SceneNameChanged|InputMuteStateChanged|InputVolumeChanged|InputCreated|InputRemoved|InputNameChanged|StreamStateChanged|RecordStateChanged|ReplayBufferStateChanged|ReplayBufferSaved)$/;

export const BRIDGE_COMMANDS = {
  scene: 'Szene wechseln',
  mute: 'Ton stumm/an',
  volume: 'Lautstärke',
  stream: 'Stream starten/stoppen',
  record: 'Aufnahme starten/stoppen',
  replay: 'Replay speichern',
};

const clampDb = (v) => Math.max(-60, Math.min(0, Math.round(Number(v) * 10) / 10));
const dur = (ms) => {
  const s = Math.floor((Number(ms) || 0) / 1000);
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

// Zustand aus OBS lesen
export async function readObsState(obs) {
  const [scenes, list, stream, record, replay, stats] = await Promise.all([
    obs.request('GetSceneList'),
    obs.request('GetInputList'),
    obs.request('GetStreamStatus').catch(() => null),
    obs.request('GetRecordStatus').catch(() => null),
    obs.request('GetReplayBufferStatus').catch(() => null), // fehlt, wenn der Replay-Puffer aus ist
    obs.request('GetStats').catch(() => null),
  ]);
  // Nur Quellen mit Ton: GetInputMute klappt bei ihnen, bei Bild-Quellen nicht
  const inputs = [];
  for (const i of list.inputs ?? []) {
    if (inputs.length >= MAX_INPUTS) break;
    try {
      const [{ inputMuted }, vol] = await Promise.all([
        obs.request('GetInputMute', { inputName: i.inputName }),
        obs.request('GetInputVolume', { inputName: i.inputName }),
      ]);
      inputs.push({ name: String(i.inputName).slice(0, 60), muted: !!inputMuted, db: clampDb(vol.inputVolumeDb ?? 0) });
    } catch {
      // keine Audioquelle – überspringen
    }
  }
  return {
    obs: true,
    // OBS liefert die Liste von unten nach oben – umgedreht wie in OBS angezeigt
    scenes: [...(scenes.scenes ?? [])].reverse().map((s) => String(s.sceneName).slice(0, 60)).slice(0, MAX_SCENES),
    scene: String(scenes.currentProgramSceneName ?? ''),
    inputs,
    stream: stream ? { on: !!stream.outputActive, time: dur(stream.outputDuration), reconnecting: !!stream.outputReconnecting } : null,
    record: record ? { on: !!record.outputActive, paused: !!record.outputPaused, time: dur(record.outputDuration) } : null,
    replay: replay ? { on: !!replay.outputActive } : null,
    stats: stats ? { cpu: Math.round(stats.cpuUsage ?? 0), fps: Math.round(stats.activeFps ?? 0), dropped: (stats.outputSkippedFrames ?? 0) + (stats.renderSkippedFrames ?? 0) } : null,
  };
}

// Einen Befehl vom Gerät ausführen; wirft bei allem, was nicht erlaubt ist
export async function runCommand(obs, state, { type, arg = {} }) {
  switch (type) {
    case 'scene': {
      const name = String(arg.name ?? '');
      if (!state.scenes?.includes(name)) throw new Error(`Die Szene „${name}“ gibt es in OBS nicht.`);
      await obs.request('SetCurrentProgramScene', { sceneName: name });
      return `🎬 ${name}`;
    }
    case 'mute': {
      const input = state.inputs?.find((i) => i.name === arg.input);
      if (!input) throw new Error(`Die Audioquelle „${arg.input ?? ''}“ gibt es in OBS nicht.`);
      const muted = typeof arg.on === 'boolean' ? arg.on : !input.muted;
      await obs.request('SetInputMute', { inputName: input.name, inputMuted: muted });
      return `${muted ? '🔇' : '🔊'} ${input.name}`;
    }
    case 'volume': {
      const input = state.inputs?.find((i) => i.name === arg.input);
      if (!input) throw new Error(`Die Audioquelle „${arg.input ?? ''}“ gibt es in OBS nicht.`);
      const db = clampDb(arg.db);
      await obs.request('SetInputVolume', { inputName: input.name, inputVolumeDb: db });
      return `🎚️ ${input.name}: ${db} dB`;
    }
    case 'stream': {
      const on = typeof arg.on === 'boolean' ? arg.on : !state.stream?.on;
      await obs.request(on ? 'StartStream' : 'StopStream');
      return on ? '🔴 Stream startet' : '⏹️ Stream beendet';
    }
    case 'record': {
      const on = typeof arg.on === 'boolean' ? arg.on : !state.record?.on;
      await obs.request(on ? 'StartRecord' : 'StopRecord');
      return on ? '⏺️ Aufnahme läuft' : '⏹️ Aufnahme gespeichert';
    }
    case 'replay': {
      if (!state.replay?.on) throw new Error('Der Replay-Puffer ist in OBS nicht an.');
      await obs.request('SaveReplayBuffer');
      return '💾 Replay gespeichert';
    }
    default:
      throw new Error('Unbekannter Befehl.');
  }
}

// Bridge starten: link = openLink(…), obs = ObsSocket (verbunden oder nicht) bzw. Demo-OBS
export function createBridge({ link, obs, onLog = () => {}, onState = () => {} }) {
  let state = { obs: false };
  let timer = 0;
  let pending = 0;
  let lastSeen = 0;

  async function refresh() {
    clearTimeout(pending);
    pending = 0;
    try {
      state = obs.connected ? await readObsState(obs) : { obs: false };
    } catch (err) {
      console.warn('Bridge: OBS-Zustand nicht lesbar', err);
      state = { obs: false, error: err.message };
    }
    onState(state, lastSeen);
    Promise.resolve(link.send('state', { ...state, at: Date.now() })).catch((err) => console.warn('Bridge: Zustand nicht gesendet', err));
  }
  const soon = () => { if (!pending) pending = setTimeout(refresh, 150); };

  const offCmd = link.on('cmd', async (c) => {
    lastSeen = Date.now();
    const type = String(c?.type ?? '');
    let ack;
    try {
      if (!Object.hasOwn(BRIDGE_COMMANDS, type)) throw new Error('Unbekannter Befehl.');
      if (!obs.connected) throw new Error('OBS ist am PC nicht verbunden.');
      const text = await runCommand(obs, state, { type, arg: c.arg ?? {} });
      ack = { id: c.id, ok: true, text };
    } catch (err) {
      ack = { id: c.id, ok: false, text: err.message };
    }
    onLog({ at: new Date(), type, arg: c.arg ?? {}, ok: ack.ok, text: ack.text });
    Promise.resolve(link.send('ack', ack)).catch((err) => console.warn('Bridge: Antwort nicht gesendet', err));
    soon();
  });
  const offHello = link.on('hello', () => { lastSeen = Date.now(); soon(); });

  function watchObs() {
    obs.onEvent = (type) => { if (WATCH.test(type)) soon(); };
    obs.ws?.send?.(JSON.stringify({ op: 3, d: { eventSubscriptions: EVENT_MASK } }));
  }

  return {
    get state() { return state; },
    get lastSeen() { return lastSeen; },
    start() {
      if (obs.connected) watchObs();
      refresh();
      clearInterval(timer);
      timer = setInterval(refresh, STATE_MS);
    },
    obsChanged() { if (obs.connected) watchObs(); refresh(); },
    stop() {
      clearInterval(timer);
      clearTimeout(pending);
      offCmd();
      offHello();
      Promise.resolve(link.send('state', { obs: false, at: Date.now(), off: true })).catch((err) => console.warn('Bridge: Abmeldung nicht gesendet', err));
    },
  };
}

// Demo-OBS (nur Demo-Modus): tut so, als liefe OBS – zum Ausprobieren ohne PC
export function createDemoObs() {
  const scenes = ['Start', 'Gameplay', 'Just Chatting', 'Pause', 'Ende'];
  const inputs = [
    { name: 'Mikrofon', muted: false, db: -4 },
    { name: 'Desktop-Audio', muted: false, db: -10 },
    { name: 'Musik', muted: false, db: -22 },
    { name: 'Discord', muted: true, db: -12 },
    { name: 'StreamHelp-Overlay', muted: false, db: -6 },
  ];
  let scene = 'Gameplay';
  let stream = 0;
  let record = 0;
  const replay = true;
  const ev = (type) => setTimeout(() => demo.onEvent?.(type, {}), 30);
  const find = (n) => { const i = inputs.find((x) => x.name === n); if (!i) throw new Error('Quelle fehlt'); return i; };
  const demo = {
    connected: true,
    demo: true,
    onEvent: null,
    ws: null,
    async request(type, d = {}) {
      switch (type) {
        case 'GetSceneList': return { currentProgramSceneName: scene, scenes: [...scenes].reverse().map((sceneName) => ({ sceneName })) };
        case 'GetInputList': return { inputs: [...inputs.map((i) => ({ inputName: i.name })), { inputName: 'Kamera' }] };
        case 'GetInputMute': return { inputMuted: find(d.inputName).muted };
        case 'GetInputVolume': return { inputVolumeDb: find(d.inputName).db };
        case 'GetStreamStatus': return { outputActive: !!stream, outputDuration: stream ? Date.now() - stream : 0 };
        case 'GetRecordStatus': return { outputActive: !!record, outputPaused: false, outputDuration: record ? Date.now() - record : 0 };
        case 'GetReplayBufferStatus': return { outputActive: replay };
        case 'GetStats': return { cpuUsage: 7 + Math.random() * 4, activeFps: 60, outputSkippedFrames: 0, renderSkippedFrames: 0 };
        case 'SetCurrentProgramScene': scene = d.sceneName; ev('CurrentProgramSceneChanged'); return {};
        case 'SetInputMute': find(d.inputName).muted = d.inputMuted; ev('InputMuteStateChanged'); return {};
        case 'SetInputVolume': find(d.inputName).db = d.inputVolumeDb; ev('InputVolumeChanged'); return {};
        case 'StartStream': stream = Date.now(); ev('StreamStateChanged'); return {};
        case 'StopStream': stream = 0; ev('StreamStateChanged'); return {};
        case 'StartRecord': record = Date.now(); ev('RecordStateChanged'); return {};
        case 'StopRecord': record = 0; ev('RecordStateChanged'); return {};
        case 'SaveReplayBuffer': ev('ReplayBufferSaved'); return {};
        default: throw new Error(`Demo-OBS kennt ${type} nicht.`);
      }
    },
  };
  return demo;
}
