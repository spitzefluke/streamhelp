// StreamHelp Pro: was Pro ist, was es kostet und ob es schon gilt (Vergleichsseite pro.html, Dashboard, Admin).
// Ob ein Kanal Pro hat, sagt die Datenbank: channel_has_pro() (Migration …_pro_features.sql, für alle lesbar)
// bzw. pro_status() fürs Team (mit Ablaufdatum). Pro gibt es per Admin-Vergabe (pro_grant) oder als bezahltes Abo
// (Stripe, Edge Function billing, Migration …_billing.sql).
import { LAUNCH } from './launch.js';

// Pro lässt sich erst buchen, wenn das Gewerbe angemeldet ist (Schalter in js/launch.js). Bis dahin tragen die
// Pro-Ideen nur das Abzeichen und bleiben für alle nutzbar; ab dem Start sind sie ohne Pro gesperrt.
export const PRO_ENFORCED = LAUNCH.pro;

// Kann man Pro schon kaufen? Erst mit Gewerbe und Zahlungsanbieter. Bis dahin sind Bestell-Knopf (pro.html)
// und das Formular unter „Verträge hier kündigen“ (kuendigen.html) gesperrt; AGB und Widerrufsbelehrung stehen bereit.
export const PRO_BOOKABLE = LAUNCH.pro;

export const PRO_PRICE = { month: '2,99 €', label: '2,99 € im Monat' };
export const PRO_SOON = 'Pro ist bald buchbar – wir melden dafür gerade ein Gewerbe an. Bis dahin kannst du alles kostenlos nutzen.';

// Content-Ideen (Kachel-Art → Name und kurze Beschreibung), die es nur mit Pro gibt
export const PRO_KINDS = {
  pet: { name: 'Stream-Dino', desc: 'Das Haustier des Streams: füttern, klettern, Figur im Overlay.' },
  cup: { name: 'Cup', desc: 'Turnier mit Rangliste und Anzeige im OBS-Overlay.' },
  heart: { name: 'Herzfrequenz', desc: 'Dein Puls live im Overlay.' },
  tts: { name: 'Vorlesen lassen', desc: 'Nachrichten per Kanalpunkte vorlesen – mit Stimmen wie Oma, Roboter, Monster.' },
};

export const isProKind = (kind) => Object.hasOwn(PRO_KINDS, kind);

// Gesperrt? Nur wenn Pro schon gilt, die Idee Pro ist und der Kanal kein Pro hat
export const proLocked = (kind, hasPro) => PRO_ENFORCED && isProKind(kind) && !hasPro;
