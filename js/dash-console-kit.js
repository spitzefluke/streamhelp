// Console (Entwurf) – Technik-Baukasten (nur Plattform-Admins, js/dash-console.js).
// Capture Card (Bild und Ton per HDMI) mit Tastenpult: Bauteile wählen (Preise anpassbar) → Kosten je Gerät
// und Preisvorschlag, Pflichten für den Verkauf in DE/EU, Abfrage zum Funktionsumfang (was in Version 1 kommt),
// Release-Check für die Shops und eine Ideen-Abfrage. Gespeichert in core.console_config.kit
// (console_kit_save). Alle Preise sind Schätzwerte zum Start und werden durch echte Angebote ersetzt.
import { h } from './extras-core.js';

// Bauteile je Bereich: Stückpreis in Euro (Schätzung), einmalige Kosten (tool) und was das für Pflichten auslöst (flags)
export const KIT_PARTS = [
  { id: 'mcu', name: 'Steuerung', options: [
    { id: 'rp2040', name: 'RP2040 (USB)', eur: 1.8 },
    { id: 'esp32s3', name: 'ESP32-S3 (USB, WLAN, Bluetooth)', eur: 3.5, flags: ['radio'] },
    { id: 'stm32', name: 'STM32 (USB)', eur: 3.0 },
  ] },
  { id: 'keys', name: '9 Tasten', options: [
    { id: 'mech', name: 'Mechanische Taster mit RGB-LED', eur: 8.1 },
    { id: 'lcdkeys', name: 'Taster mit Mini-Display je Taste', eur: 40.5 },
    { id: 'membrane', name: 'Folientasten', eur: 2.5 },
  ] },
  { id: 'display', name: 'Display', options: [
    { id: 'ips24', name: '2,4-Zoll-IPS', eur: 4.5 },
    { id: 'ips35', name: '3,5-Zoll-IPS', eur: 7.5 },
    { id: 'eink', name: '2,9-Zoll-E-Ink', eur: 9 },
  ] },
  { id: 'bulb', name: 'Ideen-Knopf', options: [
    { id: 'button', name: 'Taster mit LED', eur: 0.6 },
    { id: 'rgb', name: 'Taster mit RGB-LED (Farbe und Effekte einstellbar)', eur: 0.9 },
    { id: 'encoder', name: 'Drehregler mit Druckfunktion', eur: 1.8 },
  ] },
  { id: 'power', name: 'Strom', options: [
    { id: 'usbc', name: 'USB-C (5 V vom PC)', eur: 0.6 },
    { id: 'extpsu', name: 'Externes Steckernetzteil', eur: 5.5, flags: ['extpsu'] },
    { id: 'mains', name: 'Netzteil im Gehäuse (Kaltgeräte-Buchse)', eur: 7, flags: ['mains'] },
  ] },
  { id: 'capture', name: 'Capture (Aufnahme per USB)', options: [
    { id: 'c1080', name: '1080p60, USB 3.0, treiberlos (UVC/UAC)', eur: 28, flags: ['hdmi'] },
    { id: 'c4k30', name: '4K30 · 1440p60 · 1080p120, USB 3.2', eur: 45, flags: ['hdmi'] },
    { id: 'c4k60', name: '4K60 HDR, USB 3.2 Gen 2', eur: 85, flags: ['hdmi'] },
    { id: 'none', name: 'Keine Aufnahme (nur Tastenpult)', eur: 0 },
  ] },
  { id: 'passthrough', name: 'HDMI-Durchschleifen (zum TV)', options: [
    { id: 'p4k60', name: '4K60 HDR, ohne Verzögerung', eur: 9, flags: ['hdmi'] },
    { id: 'p4k120', name: '4K120 · 1440p120 mit VRR (HDMI 2.1)', eur: 22, flags: ['hdmi'] },
    { id: 'none', name: 'Kein Durchschleifen', eur: 0 },
  ] },
  { id: 'audio', name: 'Ton', options: [
    { id: 'hdmi', name: 'Spielton über HDMI (Stereo)', eur: 0.8 },
    { id: 'mix', name: 'Spielton + Kopfhörer-Ausgang + Mikro/Party-Chat (3,5 mm)', eur: 4.5 },
    { id: 'mixer', name: 'Wie oben + Mixer mit 2 Drehreglern, getrennte Spuren', eur: 9 },
  ] },
  { id: 'pcb', name: 'Platine', options: [
    { id: 'hs', name: '6 Lagen für HDMI und USB 3, bestückt, Kleinserie', eur: 24 },
    { id: 'hsl', name: '6 Lagen für HDMI und USB 3, ab 1.000 Stück', eur: 12 },
    { id: 'small', name: 'Bestückt, Kleinserie', eur: 8 },
    { id: 'large', name: 'Bestückt, ab 1.000 Stück', eur: 4 },
  ] },
  { id: 'case', name: 'Gehäuse', options: [
    { id: 'print', name: '3D-Druck (Kleinserie)', eur: 9 },
    { id: 'mold', name: 'Spritzguss', eur: 3.2, tool: 15000 },
    { id: 'alu', name: 'Aluminium, gefräst', eur: 28 },
  ] },
  { id: 'box', name: 'Verpackung', options: [
    { id: 'basic', name: 'Schwarzer Stülpkarton, Schaum-Einleger, Kabel, Schnellstart', eur: 4.5 },
    { id: 'premium', name: 'Vollfarb-Druck innen und außen, Einleger, Kabel, Sticker', eur: 8.5 },
  ] },
];
export const KIT_DEFAULT = { parts: { mcu: 'rp2040', keys: 'mech', display: 'ips24', bulb: 'button', power: 'usbc', capture: 'c4k30', passthrough: 'p4k60', audio: 'mix', pcb: 'hs', case: 'print', box: 'basic' }, prices: {}, qty: 200, factor: 3, checks: {}, features: {}, tips: {}, design: {}, answers: {}, rear: {}, pack: {}, ideas: [] }; // design: Vorgaben in DESIGN_DEFAULT (normalizeKit)

// Design-Abfrage: Optionen mit Mehrkosten je Gerät (eur) und Aussehen in der 3D-Ansicht
export const DESIGN = [
  { id: 'body', name: 'Gehäusefarbe', options: [
    { id: 'black', name: 'Schwarz matt', eur: 0, look: ['#2c2f37', '#1d1f25'] },
    { id: 'grey', name: 'Space-Grau', eur: 0.3, look: ['#565a64', '#363940'] },
    { id: 'white', name: 'Weiß', eur: 0.4, look: ['#e6e7ec', '#cfd1d8'] },
    { id: 'purple', name: 'StreamHelp-Lila', eur: 0.4, look: ['#5b2bb5', '#2a1650'] },
  ] },
  { id: 'bulb', name: 'Ideen-Knopf', options: [
    { id: 'gold', name: 'Gold', eur: 0, look: '#ffd75e' },
    { id: 'purple', name: 'Lila', eur: 0, look: '#b18cff' },
    { id: 'white', name: 'Weiß', eur: 0, look: '#f2f2f2' },
    { id: 'red', name: 'Rot', eur: 0, look: '#ff5a4e' },
  ] },
  { id: 'glow', name: 'Lichtschein unter dem Gerät', options: [
    { id: 'off', name: 'Aus', eur: 0, look: '' },
    { id: 'purple', name: 'Lila (RGB, einstellbar)', eur: 1.5, look: 'rgba(145,70,255,.85)' },
    { id: 'pink', name: 'Pink (RGB, einstellbar)', eur: 1.5, look: 'rgba(255,90,168,.8)' },
  ] },
  { id: 'caps', name: 'Tastenkappen', options: [
    { id: 'matt', name: 'Matt, griffig', eur: 0, look: 'matt' },
    { id: 'gloss', name: 'Glänzend, durchscheinend', eur: 0.9, look: 'gloss' },
  ] },
  { id: 'logo', name: 'Logo auf dem Gerät', options: [
    { id: 'print', name: 'Aufdruck', eur: 0.2 },
    { id: 'engrave', name: 'Lasergravur', eur: 0.6 },
    { id: 'none', name: 'Ohne Logo', eur: 0 },
  ] },
];
export const DESIGN_DEFAULT = { body: 'black', bulb: 'gold', glow: 'off', caps: 'matt', logo: 'print', combojack: false };
const designOpt = (id, v) => DESIGN.find((d) => d.id === id)?.options.find((o) => o.id === v);
export const kitLook = (kit) => Object.fromEntries(DESIGN.filter((d) => d.id !== 'logo').map((d) => [d.id, designOpt(d.id, kit.design[d.id])?.look]));

// Rückseiten-Abfrage: Optionen mit Mehrkosten je Gerät; rec = Vorschlag, why = Begründung.
// Sobald eine Frage beantwortet ist, zeigt die 3D-Ansicht die eigene Rückseite statt der Modell-Buchsen.
export const REAR = [
  { id: 'place', name: 'Wo sitzen die Anschlüsse?', rec: 'split',
    why: 'HDMI und USB-C werden einmal eingesteckt und bleiben – hinten verschwinden die Kabel. Das Headset wird oft umgesteckt und gehört an die Seite.',
    options: [
      { id: 'split', name: 'HDMI und USB hinten, Headset links', eur: 0 },
      { id: 'back', name: 'Alles hinten', eur: 0 },
      { id: 'left', name: 'Alles links an der Seite', eur: 0 },
    ] },
  { id: 'power', name: 'Ein-/Aus-Taste', rec: 'none',
    why: 'Capture Cards schalten sich mit dem PC ein. Ohne Taste gibt es eine Fehlerquelle weniger („Bild schwarz – Taste vergessen“) und ein Bauteil weniger.',
    options: [
      { id: 'button', name: 'Taste hinten (wie im Entwurf)', eur: 0 },
      { id: 'recessed', name: 'Versenkt – kein versehentliches Ausschalten', eur: 0.1 },
      { id: 'none', name: 'Ohne – an, sobald USB-C steckt', eur: -0.3 },
    ] },
  { id: 'led', name: 'Status-LED (der Lichtleiter)', rec: 'front',
    why: 'Hinten sieht niemand die LED. Vorne zeigt sie, ob Bild ankommt oder aufgenommen wird – mit derselben LED.',
    options: [
      { id: 'keep', name: 'Hinten (wie im Entwurf)', eur: 0 },
      { id: 'front', name: 'Vorne sichtbar (Bild / Aufnahme)', eur: 0.1 },
      { id: 'none', name: 'Ohne LED – Status auf dem Display', eur: -0.1 },
    ] },
  { id: 'usb', name: 'USB-Buchsen', rec: 'c1',
    why: 'Für Capture braucht es USB 3 – mit einem USB-C-Kabel laufen Strom, Bild, Ton und Tasten. Zwei USB-A-Buchsen sind veraltet und verwirren („welche ist die richtige?“).',
    options: [
      { id: 'model', name: '2× USB-A (wie im Entwurf)', eur: 0.5 },
      { id: 'c1', name: '1× USB-C zum PC', eur: 0 },
      { id: 'c1hub', name: 'USB-C zum PC + USB-A für Zubehör', eur: 1.2 },
      { id: 'c2', name: 'USB-C zum PC + USB-C nur für Strom', eur: 0.8 },
    ] },
  { id: 'spacing', name: 'Abstand zwischen den Buchsen', rec: 'wide',
    why: 'Dicke HDMI-Stecker und Winkelstecker blockieren sich sonst gegenseitig.',
    options: [
      { id: 'std', name: 'Eng (wie im Entwurf)', eur: 0 },
      { id: 'wide', name: 'Mehr Platz zwischen den Steckern', eur: 0 },
    ] },
  { id: 'labels', name: 'Beschriftung', rec: 'top',
    why: 'Eingesteckt wird meist von oben, ohne die Rückseite zu sehen. Eine Beschriftung oben auf dem Rand ist dann lesbar.',
    options: [
      { id: 'print', name: 'Weißer Aufdruck an der Buchse', eur: 0 },
      { id: 'raised', name: 'Erhaben im Gehäuse (ohne Druck)', eur: -0.05 },
      { id: 'top', name: 'Oben auf dem Rand, von vorn lesbar', eur: 0.1 },
      { id: 'light', name: 'Beleuchtet', eur: 0.6 },
    ] },
  { id: 'extra', name: 'Extra hinten', rec: 'clip',
    why: 'Eine Zugentlastung hält HDMI- und USB-Kabel fest – ein Ruck am Kabel unterbricht sonst Bild und Stream.',
    options: [
      { id: 'none', name: 'Nichts', eur: 0 },
      { id: 'clip', name: 'Kabelclip / Zugentlastung', eur: 0.2 },
      { id: 'lock', name: 'Schlitz für ein Kensington-Schloss', eur: 0.3 },
    ] },
];
export const rearOpt = (id, v) => REAR.find((q) => q.id === id)?.options.find((o) => o.id === v);
// Darstellung der Rückseite in 3D (js/dash-console-3d.js → setConsolePorts)
export const kitRearOpts = (kit) => ({ custom: Object.keys(kit.rear ?? {}).length > 0, labels: kit.rear?.labels ?? 'print', wide: kit.rear?.spacing === 'wide' });

// Verpackungs-Abfrage: Optionen mit Mehrkosten je Gerät; rec = Vorschlag. Wirkt auf die 3D-Verpackung.
export const PACK = [
  { id: 'insert', name: 'Einleger', rec: 'pulp',
    why: 'Die EU-Verpackungsverordnung verlangt ab 2030 recyclingfähige Verpackungen. Formfaser aus Altpapier hält genauso gut und kommt einfach ins Altpapier.',
    options: [
      { id: 'foam', name: 'Schaumstoff, schwarz', eur: 0 },
      { id: 'pulp', name: 'Formfaser aus Recyclingpapier', eur: 0.2 },
      { id: 'card', name: 'Karton-Einlage', eur: -0.3 },
    ] },
  { id: 'ribbon', name: 'Lift-Band zum Herausheben', rec: 'yes',
    why: 'Die Console sitzt passgenau – mit dem Band lässt sie sich ohne Fummeln herausheben. Kostet fast nichts, wirkt hochwertig.',
    options: [{ id: 'yes', name: 'Ja', eur: 0.1 }, { id: 'no', name: 'Nein', eur: 0 }] },
  { id: 'film', name: 'Displayschutzfolie mit Lasche', rec: 'yes',
    why: 'Schützt das Display auf dem Transportweg; die Lasche macht das Abziehen zum kleinen Unboxing-Moment.',
    options: [{ id: 'yes', name: 'Ja', eur: 0.15 }, { id: 'no', name: 'Nein', eur: 0 }] },
  { id: 'card', name: 'Dankeskarte mit QR-Code zur Einrichtung', rec: 'yes',
    why: 'Der QR-Code führt direkt zur Einrichtung in StreamHelp – weniger Support-Anfragen, mehr Leute, die die Console wirklich nutzen.',
    options: [{ id: 'yes', name: 'Ja', eur: 0.1 }, { id: 'no', name: 'Nein', eur: 0 }] },
  { id: 'sleeve', name: 'Banderole um den Karton', rec: 'no',
    why: 'Sieht im Regal gut aus, landet aber sofort im Müll. Ein starker Deckel-Druck reicht – die Banderole eher für eine Sonderedition.',
    options: [{ id: 'no', name: 'Ohne', eur: 0 }, { id: 'yes', name: 'Banderole in Akzentfarbe', eur: 0.6 }] },
];
export const PACK_DEFAULT = { insert: 'foam', ribbon: 'yes', film: 'yes', card: 'yes', sleeve: 'no' };
export const packOpt = (id, v) => PACK.find((q) => q.id === id)?.options.find((o) => o.id === v);

// Weitere Fragen (ohne Einfluss auf die Kosten)
export const MORE_QUESTIONS = [
  { id: 'audience', name: 'Für wen ist die Console vor allem?', options: [['new', 'Einsteiger'], ['mid', 'Fortgeschrittene'], ['pro', 'Profis'], ['all', 'Alle']] },
  { id: 'price', name: 'Welcher Endpreis ist das Ziel?', options: [['149', 'bis 149 €'], ['249', '150–249 €'], ['349', '250–349 €'], ['999', '350 € und mehr']] },
  { id: 'platforms', name: 'Welche Plattformen zuerst?', options: [['twitch', 'Twitch'], ['tw_yt', 'Twitch und YouTube'], ['all', 'Alle (auch TikTok, Kick)']] },
  { id: 'software', name: 'Welche Software steuert sie?', options: [['sh', 'Nur StreamHelp'], ['sh_obs', 'StreamHelp und OBS direkt'], ['open', 'Offen für andere Programme']] },
  { id: 'warranty', name: 'Garantie', options: [['2', '2 Jahre (gesetzliche Gewährleistung)'], ['3', '3 Jahre Herstellergarantie'], ['5', '5 Jahre Herstellergarantie']] },
];

// Prüfungen (einmalig, Schätzung) und Pflichten je Merkmal
const TESTS = { base: 4000, mains: 6000, radio: 5000, hdmi: 0 };
const DUTIES = [
  { id: 'emv', always: true, text: 'CE: EMV-Richtlinie 2014/30/EU – EMV-Prüfung, Konformitätserklärung, technische Unterlagen' },
  { id: 'rohs', always: true, text: 'RoHS 2011/65/EU – Nachweise der Bauteil-Lieferanten' },
  { id: 'weee', always: true, text: 'ElektroG: Registrierung bei der Stiftung EAR vor dem ersten Verkauf, WEEE-Nummer, Rücknahme' },
  { id: 'lucid', always: true, text: 'Verpackungsgesetz: Registrierung im LUCID-Register, Systembeteiligung' },
  { id: 'gpsr', always: true, text: 'Produktsicherheit (GPSR, EU 2023/988): Hersteller-Anschrift am Gerät oder auf der Verpackung, Anleitung und Sicherheitshinweise auf Deutsch' },
  { id: 'sale', always: true, text: '2 Jahre Gewährleistung, Widerrufsrecht im Online-Verkauf, Preisangabe mit Umsatzsteuer' },
  { id: 'lvd', flag: 'mains', text: 'Niederspannungsrichtlinie 2014/35/EU – Sicherheitsprüfung wegen Netzteil im Gehäuse' },
  { id: 'psu', flag: 'extpsu', text: 'Externes Netzteil nur mit eigener CE-Kennzeichnung und Ökodesign-Nachweis (EU 2019/1782) einkaufen' },
  { id: 'red', flag: 'radio', text: 'Funkanlagen-Richtlinie 2014/53/EU inkl. Cybersicherheit (delegierte VO (EU) 2022/30) – Funkprüfung; ein zertifiziertes Funkmodul senkt den Aufwand' },
  { id: 'hdmi', flag: 'hdmi', text: 'HDMI-Adopter-Vertrag für Buchsen, Logo und das Wort „HDMI“ (Jahres- und Stückgebühr)' },
  { id: 'hdcp', flag: 'hdmi', text: 'Kopierschutz (HDCP) darf nicht umgangen werden: geschützte Inhalte (Filme, Streaming-Apps) nicht aufnehmen; Spiele auf der PS5 nur mit HDCP-Schalter in der Konsole – so in Anleitung und Shop-Text erklären' },
];
export const RELEASE_CHECKS = [
  ['proto', 'Prototyp gebaut und mit Streamern 4 Wochen getestet'],
  ['firmware', 'Firmware fertig, mit Update-Funktion'],
  ['sources', 'Capture getestet mit PS5, Xbox, Switch, Steam Deck und PC – Bild, Ton und Durchschleifen'],
  ['obs', 'In OBS, Streamlabs und Twitch Studio als Video- und Audioquelle getestet (Windows und macOS)'],
  ['hdmilic', 'HDMI-Adopter-Vertrag abgeschlossen'],
  ['emv', 'EMV-Prüfung bestanden (und ggf. Sicherheits-/Funkprüfung)'],
  ['ce', 'CE-Konformitätserklärung und technische Unterlagen'],
  ['gewerbe', 'Gewerbe angemeldet, Umsatzsteuer geklärt'],
  ['ear', 'WEEE-Registrierung bei der Stiftung EAR'],
  ['lucid', 'Verpackungsregister LUCID'],
  ['insurance', 'Produkthaftpflicht-Versicherung'],
  ['label', 'Typenschild mit Hersteller-Anschrift, CE und WEEE-Symbol'],
  ['manual', 'Anleitung und Sicherheitshinweise auf Deutsch'],
  ['legal', 'AGB und Widerrufsbelehrung für Hardware'],
  ['shop', 'Shop-Texte, Fotos und Endpreis'],
  ['support', 'Support, Garantie- und Rücknahme-Ablauf'],
];
const IDEA_TOPICS = [['feature', 'Funktion'], ['hardware', 'Hardware'], ['accessory', 'Zubehör'], ['shop', 'Shop & Marketing'], ['other', 'Sonstiges']];
const IDEA_STATUS = [['new', 'Neu'], ['planned', 'Geplant'], ['done', 'Erledigt'], ['dropped', 'Verworfen']];
// Fragen für die Ideen-Abfrage – eine Frage anklicken übernimmt sie als Thema
const IDEA_PROMPTS = [
  ['feature', 'Welche Aktion fehlt auf den Tasten?'],
  ['feature', 'Was soll das Display noch zeigen?'],
  ['feature', 'Welche Konsole oder Kamera muss unbedingt funktionieren?'],
  ['hardware', 'Welcher Anschluss fehlt dir an heutigen Capture Cards?'],
  ['hardware', 'Was nervt an heutigen Stream-Controllern?'],
  ['accessory', 'Welches Zubehör würden Streamer dazukaufen?'],
  ['shop', 'Welcher Preis fühlt sich fair an?'],
  ['shop', 'Worauf würdest du verzichten, wenn die Console 50 € günstiger wäre?'],
];

// Abfrage zum Funktionsumfang: je Merkmal entscheiden, ob es in Version 1 kommt.
// needs: welche Bauteil-Auswahl das Merkmal voraussetzt (sonst Hinweis mit „Passend wählen“)
const FEATURE_STATUS = [['open', 'Offen'], ['v1', 'Version 1'], ['later', 'Später'], ['no', 'Nicht geplant']];
const CAP_ANY = ['c1080', 'c4k30', 'c4k60'];
export const FEATURES = [
  { group: 'Bild', items: [
    { id: 'cap1080', name: 'Aufnahme 1080p60', needs: ['capture', CAP_ANY] },
    { id: 'cap1440', name: 'Aufnahme 1440p60 und 1080p120', needs: ['capture', ['c4k30', 'c4k60']] },
    { id: 'cap4k', name: 'Aufnahme 4K60 mit HDR', needs: ['capture', ['c4k60']] },
    { id: 'pt4k60', name: 'Durchschleifen 4K60 HDR ohne Verzögerung zum TV', needs: ['passthrough', ['p4k60', 'p4k120']] },
    { id: 'pt120', name: 'Durchschleifen mit 120 Hz und VRR (PS5, Xbox Series)', needs: ['passthrough', ['p4k120']] },
    { id: 'uvc', name: 'Treiberlos an Windows, macOS und Linux (UVC/UAC)', needs: ['capture', CAP_ANY] },
    { id: 'latency', name: 'Vorschau in OBS mit wenig Verzögerung (unter 100 ms)', needs: ['capture', CAP_ANY] },
  ] },
  { group: 'Ton', items: [
    { id: 'gameaudio', name: 'Spielton über HDMI mit aufnehmen', needs: ['capture', CAP_ANY] },
    { id: 'headset', name: 'Kopfhörer-Ausgang zum Mithören ohne Verzögerung', needs: ['audio', ['mix', 'mixer']] },
    { id: 'partychat', name: 'Mikro bzw. Party-Chat per 3,5-mm-Klinke einmischen', needs: ['audio', ['mix', 'mixer']] },
    { id: 'hwmixer', name: 'Spiel- und Chat-Lautstärke per Drehregler', needs: ['audio', ['mixer']] },
    { id: 'tracks', name: 'Getrennte Tonspuren in OBS (Spiel, Chat, Mikro)', needs: ['audio', ['mixer']] },
  ] },
  { group: 'Tastenpult', items: [
    { id: 'keys', name: '9 frei belegbare Tasten (Szenen, Sounds, Alerts, Raid-Schutz)' },
    { id: 'display', name: 'Display mit Live-Anzeige (Alerts, Ziele, Szene)' },
    { id: 'ideabtn', name: 'Ideen-Knopf für Content-Ideen' },
    { id: 'obsctl', name: 'OBS direkt steuern (Szene, Aufnahme, Stream) ohne Zusatz-Software' },
    { id: 'replay', name: 'Clip der letzten 30 Sekunden per Taste' },
    { id: 'sdrec', name: 'Ohne PC auf microSD aufnehmen', note: 'braucht einen eigenen Encoder-Chip – deutlich teurer' },
  ] },
  { group: 'Quellen (muss funktionieren)', items: [
    { id: 'src_ps5', name: 'PS5 / PS5 Pro', note: 'HDCP in den PS5-Einstellungen ausschalten (System → HDMI)', needs: ['capture', CAP_ANY] },
    { id: 'src_ps4', name: 'PS4 / PS4 Pro', note: 'HDCP in den Einstellungen ausschalten', needs: ['capture', CAP_ANY] },
    { id: 'src_xbox', name: 'Xbox Series X|S', needs: ['capture', CAP_ANY] },
    { id: 'src_switch', name: 'Nintendo Switch / Switch 2 (im Dock)', needs: ['capture', CAP_ANY] },
    { id: 'src_deck', name: 'Steam Deck (Dock oder USB-C-auf-HDMI)', needs: ['capture', CAP_ANY] },
    { id: 'src_pc', name: 'Zweiter PC oder Laptop (HDMI-Ausgang)', needs: ['capture', CAP_ANY] },
    { id: 'src_cam', name: 'Kamera mit sauberem HDMI-Ausgang', needs: ['capture', CAP_ANY] },
  ] },
];
const FEATURE_IDS = FEATURES.flatMap((g) => g.items.map((f) => f.id));
// Merkmale, die in Version 1 stehen, aber nicht zu den Bauteilen passen
export const featureClashes = (kit) => FEATURES.flatMap((g) => g.items)
  .filter((f) => kit.features[f.id] === 'v1' && f.needs && !f.needs[1].includes(kit.parts[f.needs[0]]));

export const eur = (n) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: n >= 1000 ? 0 : 2 }).format(n);
export const option = (cat, id) => KIT_PARTS.find((p) => p.id === cat)?.options.find((o) => o.id === id);

export function normalizeKit(raw) {
  const k = raw && typeof raw === 'object' ? raw : {};
  const parts = {};
  for (const cat of KIT_PARTS) parts[cat.id] = option(cat.id, k.parts?.[cat.id]) ? k.parts[cat.id] : KIT_DEFAULT.parts[cat.id];
  const prices = {};
  for (const [key, v] of Object.entries(k.prices ?? {})) {
    const n = Number(v);
    if (/^[a-z0-9]+\.[a-z0-9]+$/.test(key) && Number.isFinite(n) && n >= 0 && n <= 100000) prices[key] = Math.round(n * 100) / 100;
  }
  const num = (v, lo, hi, def) => { const n = Number(v); return Number.isFinite(n) && n >= lo && n <= hi ? n : def; };
  const checks = {};
  for (const [id] of RELEASE_CHECKS) if (k.checks?.[id] === true) checks[id] = true;
  const design = { ...DESIGN_DEFAULT };
  for (const d of DESIGN) if (designOpt(d.id, k.design?.[d.id])) design[d.id] = k.design[d.id];
  design.combojack = k.design?.combojack === true;
  if (['left', 'power'].includes(k.design?.backpanel)) design.backpanel = k.design.backpanel;
  const rear = {};
  for (const q of REAR) if (rearOpt(q.id, k.rear?.[q.id])) rear[q.id] = k.rear[q.id];
  const pack = { ...PACK_DEFAULT };
  for (const q of PACK) if (packOpt(q.id, k.pack?.[q.id])) pack[q.id] = k.pack[q.id];
  const answers = {};
  for (const q of MORE_QUESTIONS) if (q.options.some(([v]) => v === k.answers?.[q.id])) answers[q.id] = k.answers[q.id];
  if (typeof k.answers?.note === 'string' && k.answers.note.trim()) answers.note = k.answers.note.trim().slice(0, 500);
  const tips = {};
  for (const [id, v] of Object.entries(k.tips ?? {})) if (/^[a-z0-9_]{1,24}$/.test(id) && ['yes', 'no', 'check'].includes(v)) tips[id] = v;
  const features = {};
  for (const id of FEATURE_IDS) {
    const v = k.features?.[id];
    if (v !== 'open' && FEATURE_STATUS.some(([s]) => s === v)) features[id] = v;
  }
  const ideas = (Array.isArray(k.ideas) ? k.ideas : []).slice(0, 80).map((x) => ({
    id: String(x?.id ?? '').slice(0, 40) || crypto.randomUUID(),
    text: String(x?.text ?? '').slice(0, 280),
    topic: IDEA_TOPICS.some(([t]) => t === x?.topic) ? x.topic : 'other',
    status: IDEA_STATUS.some(([s]) => s === x?.status) ? x.status : 'new',
    by: String(x?.by ?? '').slice(0, 40),
    at: String(x?.at ?? '').slice(0, 30),
  })).filter((x) => x.text);
  // Bedienungsanleitung (js/dash-console-manual.js) und Werbungs-Builder (js/dash-console-ads.js): kurze Texte
  const texts = (src, limits) => {
    const out = {};
    for (const [id, max] of Object.entries(limits)) {
      const v = typeof src?.[id] === 'string' ? src[id].trim().slice(0, max) : '';
      if (v) out[id] = v;
    }
    return out;
  };
  const manual = texts(k.manual, { name: 60, maker: 120, address: 200, email: 120, web: 120 });
  const ads = texts(k.ads, { name: 60, slogan: 80, price: 10, link: 120, code: 24, tone: 10 });
  return { parts, prices, qty: Math.round(num(k.qty, 1, 100000, KIT_DEFAULT.qty)), factor: num(k.factor, 1, 10, KIT_DEFAULT.factor), checks, features, tips, design, answers, rear, pack, ideas, manual, ads };
}

// Aufdruck und Inhalt der Verpackung für die 3D-Ansicht
const SPEC_TEXT = {
  capture: { c1080: 'Aufnahme 1080p60', c4k30: 'Aufnahme 4K30 · 1440p60', c4k60: 'Aufnahme 4K60 HDR' },
  passthrough: { p4k60: 'Durchschleifen 4K60 HDR', p4k120: '4K120 · VRR durchschleifen' },
  audio: { mix: 'Kopfhörer & Party-Chat', mixer: 'Mixer mit getrennten Spuren' },
};
export function kitBoxSpec(kit, keys) {
  const specs = ['capture', 'passthrough', 'audio'].map((c) => SPEC_TEXT[c][kit.parts[c]]).filter(Boolean);
  specs.push('9 Tasten + Display');
  const hdmi = kit.parts.capture !== 'none' || kit.parts.passthrough !== 'none';
  const hdmiCable = hdmi && kit.tips.nohdmicable !== 'yes';
  const pack = { ...PACK_DEFAULT, ...kit.pack };
  const contents = ['Console', 'USB-C-Kabel', ...(hdmiCable ? ['HDMI-Kabel'] : []), 'Schnellstart', ...(pack.card === 'yes' ? ['Dankeskarte'] : []), ...(kit.parts.box === 'premium' ? ['Sticker'] : [])];
  const keyColors = Array.from({ length: 9 }, (_, i) => (keys?.[i]?.action && keys[i].action !== 'none' && keys[i].color) || '#8e8e9a');
  return { premium: kit.parts.box === 'premium', hdmi, hdmiCable, specs, contents, keyColors, pack, accent: '#9146ff' };
}

// Anschlüsse für die 3D-Ansicht (js/dash-console-3d.js)
// side: 'left' | 'back' | 'front'. Ohne beantwortete Rückseiten-Abfrage liegt alles links (die Modell-Rückseite bleibt).
export function kitPorts(kit) {
  const r = kit.rear ?? {};
  const custom = Object.keys(r).length > 0;
  const place = custom ? (r.place ?? 'left') : 'left';
  const main = place === 'left' ? 'left' : 'back'; // HDMI, USB, Strom
  const aux = place === 'back' ? 'back' : 'left'; // Klinken, microSD
  const ports = [];
  if (custom && (r.power ?? 'button') !== 'none') ports.push({ kind: 'power', label: '', recessed: r.power === 'recessed', side: 'back' });
  if (custom && (r.led ?? 'keep') !== 'none') ports.push({ kind: 'led', label: '', side: r.led === 'front' ? 'front' : 'back' });
  const usb = r.usb ?? 'c1';
  if (usb === 'model') ports.push({ kind: 'usba', label: 'USB', side: main }, { kind: 'usba', label: 'USB', side: main });
  else {
    ports.push({ kind: 'usbc', label: kit.parts.capture === 'none' ? 'USB-C' : 'USB-C · PC', side: main });
    if (usb === 'c1hub') ports.push({ kind: 'usba', label: 'USB', side: main });
    if (usb === 'c2') ports.push({ kind: 'usbc', label: 'Strom', side: main });
  }
  if (kit.parts.capture !== 'none' || kit.parts.passthrough !== 'none') ports.push({ kind: 'hdmi', label: 'HDMI IN', side: main });
  if (kit.parts.passthrough !== 'none') ports.push({ kind: 'hdmi', label: 'HDMI OUT', side: main });
  if (['mix', 'mixer'].includes(kit.parts.audio)) {
    if (kit.design?.combojack) ports.push({ kind: 'jack', label: 'Headset', side: aux });
    else ports.push({ kind: 'jack', label: 'Kopfhörer', side: aux }, { kind: 'jack', label: 'Mikro/Chat', side: aux });
  }
  if (kit.features.sdrec === 'v1') ports.push({ kind: 'sd', label: 'microSD', side: aux });
  if (kit.parts.power === 'extpsu') ports.push({ kind: 'dc', label: 'DC 12 V', side: main });
  if (kit.parts.power === 'mains') ports.push({ kind: 'mains', label: '230 V', side: main });
  return ports;
}

export function kitTotals(kit) {
  const flags = new Set();
  let unit = 0;
  let tool = 0;
  for (const cat of KIT_PARTS) {
    const o = option(cat.id, kit.parts[cat.id]);
    if (!o) continue;
    unit += kit.prices[`${cat.id}.${o.id}`] ?? o.eur;
    tool += o.tool ?? 0;
    for (const f of o.flags ?? []) flags.add(f);
  }
  // Design-Aufpreise; eine Headset-Buchse statt zwei Klinken spart eine Buchse
  for (const d of DESIGN) unit += designOpt(d.id, kit.design?.[d.id])?.eur ?? 0;
  for (const q of REAR) unit += rearOpt(q.id, kit.rear?.[q.id])?.eur ?? 0;
  for (const q of PACK) unit += packOpt(q.id, kit.pack?.[q.id] ?? PACK_DEFAULT[q.id])?.eur ?? 0;
  if (kit.design?.combojack && ['mix', 'mixer'].includes(kit.parts.audio)) unit -= 0.4;
  const tests = TESTS.base + (flags.has('mains') ? TESTS.mains : 0) + (flags.has('radio') ? TESTS.radio : 0);
  const perDevice = unit + (tool + tests) / kit.qty;
  // Endpreis-Faustregel: Kosten je Gerät × Faktor, plus 19 % Umsatzsteuer, auf ,99 gerundet
  const gross = perDevice * kit.factor * 1.19;
  const price = Math.max(0.99, Math.ceil(gross) - 0.01);
  return { unit, tool, tests, perDevice, price, flags, duties: DUTIES.filter((d) => d.always || flags.has(d.flag)) };
}

// ---------- Zeichnen ----------
// ctx: { kit, me, onChange(kit) } – onChange speichert (mit kurzer Verzögerung) und zeichnet neu
export function renderKit(ctx) {
  const { kit } = ctx;
  const t = kitTotals(kit);
  const done = RELEASE_CHECKS.filter(([id]) => kit.checks[id]).length;
  const change = (fn) => { fn(kit); ctx.onChange(kit); };
  const card = (cls, title, sub, ...kids) => h('section', { class: `dash-card dash-card--wide ck-card ${cls}` },
    h('header', { class: 'cs-head' }, h('div', {}, h('h2', {}, title), sub ? h('p', { class: 'dash-status' }, sub) : null)), ...kids);

  const parts = card('ck-parts', 'Technik-Baukasten', 'Bauteile wählen – Preise sind Schätzwerte und lassen sich durch echte Angebote ersetzen.',
    h('div', { class: 'ck-grid' }, ...KIT_PARTS.map((cat) => {
      const o = option(cat.id, kit.parts[cat.id]);
      const key = `${cat.id}.${o.id}`;
      return h('div', { class: 'ck-part' },
        h('label', { class: 'field' }, h('span', {}, cat.name),
          h('select', { 'data-part': cat.id, onchange: (e) => change((k) => { k.parts[cat.id] = e.target.value; }) },
            ...cat.options.map((x) => h('option', { value: x.id, selected: x.id === o.id }, `${x.name} · ${eur(kit.prices[`${cat.id}.${x.id}`] ?? x.eur)}`)))),
        h('label', { class: 'ck-price' }, h('span', {}, 'Preis je Stück (€)'),
          h('input', { type: 'number', min: '0', max: '100000', step: '0.01', value: String(kit.prices[key] ?? o.eur), 'aria-label': `${cat.name}: Preis je Stück in Euro`,
            onchange: (e) => change((k) => { const n = Number(e.target.value); if (Number.isFinite(n) && n >= 0) k.prices[key] = Math.round(n * 100) / 100; else delete k.prices[key]; }) })),
        o.tool ? h('small', { class: 'ck-note' }, `einmalig ${eur(o.tool)} Werkzeug`) : null,
        (o.flags ?? []).length ? h('small', { class: 'ck-note is-warn' }, 'löst zusätzliche Prüfungen aus') : null);
    })));

  const calc = card('ck-calc', 'Kosten und Preis', 'Faustregel zum Start, keine Kalkulation – Versand, Shop-Gebühren und Rücklagen fehlen noch.',
    h('div', { class: 'ck-inputs' },
      h('label', { class: 'field' }, h('span', {}, 'Stückzahl der ersten Serie'),
        h('input', { type: 'number', min: '1', max: '100000', value: String(kit.qty), onchange: (e) => change((k) => { k.qty = Math.max(1, Math.round(Number(e.target.value) || KIT_DEFAULT.qty)); }) })),
      h('label', { class: 'field' }, h('span', {}, 'Aufschlag-Faktor'),
        h('input', { type: 'number', min: '1', max: '10', step: '0.1', value: String(kit.factor), onchange: (e) => change((k) => { const n = Number(e.target.value); k.factor = n >= 1 && n <= 10 ? n : KIT_DEFAULT.factor; }) }))),
    h('dl', { class: 'ck-sums' },
      h('div', {}, h('dt', {}, 'Bauteile je Gerät'), h('dd', {}, eur(t.unit))),
      h('div', {}, h('dt', {}, 'Einmalig: Prüfungen (Schätzung)'), h('dd', {}, eur(t.tests))),
      h('div', {}, h('dt', {}, 'Einmalig: Werkzeug'), h('dd', {}, eur(t.tool))),
      h('div', {}, h('dt', {}, `Kosten je Gerät bei ${kit.qty} Stück`), h('dd', {}, eur(t.perDevice))),
      h('div', { class: 'is-total' }, h('dt', {}, `Endpreis-Vorschlag (× ${String(kit.factor).replace('.', ',')}, inkl. 19 % USt)`), h('dd', {}, eur(t.price)))),
    t.flags.has('hdmi') ? h('p', { class: 'form-hint' }, 'Capture Card: HDMI-Lizenz (Jahres- und Stückgebühr erfragen), Firmware-Updates für den Capture-Chip und Tests mit jeder Konsole einplanen. USB-C muss mindestens USB 3 können.') : null,
    t.flags.has('hdmi') && ['small', 'large'].includes(kit.parts.pcb) ? h('p', { class: 'form-hint is-warn' }, 'Für HDMI und USB 3 reicht die einfache Platine nicht – eine 6-Lagen-Platine wählen.') : null);

  // Abfrage: was kommt in Version 1?
  const counts = Object.fromEntries(FEATURE_STATUS.map(([s]) => [s, 0]));
  let clashes = 0;
  const fits = (f) => !f.needs || f.needs[1].includes(kit.parts[f.needs[0]]);
  for (const g of FEATURES) for (const f of g.items) {
    const st = kit.features[f.id] ?? 'open';
    counts[st] += 1;
    if (st === 'v1' && !fits(f)) clashes += 1;
  }
  const scope = card('ck-scope', 'Abfrage: Was kommt in Version 1?',
    `${FEATURE_IDS.length - counts.open} von ${FEATURE_IDS.length} entschieden · ${counts.v1} in Version 1 · ${counts.later} später${clashes ? ` · ${clashes} passt nicht zu den Bauteilen` : ''}`,
    h('div', { class: 'ck-scope-groups' }, ...FEATURES.map((g) => h('fieldset', { class: 'ck-scope-group' },
      h('legend', {}, g.group),
      h('ul', {}, ...g.items.map((f) => {
        const st = kit.features[f.id] ?? 'open';
        const clash = st === 'v1' && !fits(f);
        return h('li', { class: `is-${st}${clash ? ' is-clash' : ''}` },
          h('div', { class: 'ck-scope-text' },
            h('span', {}, f.name),
            f.note ? h('small', {}, f.note) : null,
            clash ? h('small', { class: 'is-warn' }, 'Passt nicht zur Bauteil-Auswahl. ',
              h('button', { class: 'btn btn--ghost btn--sm', type: 'button', 'data-fit': f.id, onclick: () => change((k) => { k.parts[f.needs[0]] = f.needs[1][0]; }) },
                `Passend wählen: ${option(f.needs[0], f.needs[1][0])?.name ?? ''}`)) : null),
          h('select', { 'data-feature': f.id, 'aria-label': `${f.name}: Entscheidung`, onchange: (e) => change((k) => { if (e.target.value === 'open') delete k.features[f.id]; else k.features[f.id] = e.target.value; }) },
            ...FEATURE_STATUS.map(([v, l]) => h('option', { value: v, selected: v === st }, l))));
      }))))));

  const duties = card('ck-duties', 'Pflichten für den Verkauf', 'Ergibt sich aus den gewählten Bauteilen. Überblick ohne Gewähr, keine Rechtsberatung.',
    h('ul', { class: 'ck-duties-list' }, ...t.duties.map((d) => h('li', { class: d.flag ? 'is-extra' : '' }, d.text))));

  const release = card('ck-release', 'Release-Check für die Shops', `${done} von ${RELEASE_CHECKS.length} erledigt${done === RELEASE_CHECKS.length ? ' – bereit für die Shops' : ''}`,
    h('span', { class: 'cs-d-bar ck-bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(RELEASE_CHECKS.length), 'aria-valuenow': String(done), 'aria-label': 'Release-Check' },
      h('span', { style: `width:${Math.round((done / RELEASE_CHECKS.length) * 100)}%` })),
    h('ul', { class: 'ck-checks' }, ...RELEASE_CHECKS.map(([id, text]) => h('li', {},
      h('label', { class: 'ck-check' },
        h('input', { type: 'checkbox', 'data-check': id, checked: !!kit.checks[id], onchange: (e) => change((k) => { if (e.target.checked) k.checks[id] = true; else delete k.checks[id]; }) }),
        h('span', {}, text))))));

  const topicSel = h('select', { name: 'topic', 'aria-label': 'Thema' }, ...IDEA_TOPICS.map(([v, l]) => h('option', { value: v }, l)));
  const ideaInput = h('textarea', { name: 'idea', rows: '2', maxlength: '280', placeholder: 'Idee, Wunsch oder Antwort auf eine der Fragen …', 'aria-label': 'Neue Idee' });
  const addIdea = (e) => {
    e.preventDefault();
    const text = ideaInput.value.trim();
    if (!text) { ideaInput.focus(); return; }
    change((k) => { k.ideas.unshift({ id: crypto.randomUUID(), text, topic: topicSel.value, status: 'new', by: ctx.me(), at: new Date().toISOString() }); });
  };
  const ideas = card('ck-ideas', 'Ideen-Abfrage', 'Was soll die Console noch können? Sammeln, einordnen, entscheiden.',
    h('div', { class: 'ck-prompts', role: 'group', 'aria-label': 'Fragen' }, ...IDEA_PROMPTS.map(([topic, q]) => h('button', {
      class: 'obs-studio-preset', type: 'button', onclick: () => { topicSel.value = topic; ideaInput.value = `${q} `; ideaInput.focus(); },
    }, q))),
    h('form', { class: 'ck-idea-form', onsubmit: addIdea }, ideaInput, h('div', { class: 'ck-idea-row' }, topicSel, h('button', { class: 'btn btn--primary btn--sm', type: 'submit' }, 'Hinzufügen'))),
    kit.ideas.length ? h('ul', { class: 'ck-idea-list' }, ...kit.ideas.map((x) => h('li', { class: `is-${x.status}` },
      h('p', {}, x.text),
      h('div', { class: 'ck-idea-meta' },
        h('small', {}, `${IDEA_TOPICS.find(([t2]) => t2 === x.topic)?.[1] ?? ''}${x.by ? ` · ${x.by}` : ''}${x.at ? ` · ${new Date(x.at).toLocaleDateString('de-DE')}` : ''}`),
        h('select', { 'aria-label': 'Status der Idee', onchange: (e) => change((k) => { const it = k.ideas.find((y) => y.id === x.id); if (it) it.status = e.target.value; }) },
          ...IDEA_STATUS.map(([v, l]) => h('option', { value: v, selected: v === x.status }, l))),
        h('button', { class: 'btn btn--ghost btn--sm', type: 'button', 'aria-label': 'Idee löschen', onclick: () => change((k) => { k.ideas = k.ideas.filter((y) => y.id !== x.id); }) }, '✕')))))
      : h('p', { class: 'form-hint' }, 'Noch keine Ideen – eine Frage oben anklicken oder frei schreiben.'));

  return [parts, calc, scope, duties, release, ideas];
}
