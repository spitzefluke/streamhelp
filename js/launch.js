// Start-Schalter: Was ist schon offen? Umgelegt wird mit node tools/launch.mjs (siehe STARTKLAR.md) – das Skript
// ändert diese Datei und entfernt auf den Rechtsseiten die Hinweise „Noch nicht in Kraft“.
//   pro         Pro buchen (pro.html), kündigen (kuendigen.html), Pro-Ideen nur noch mit Pro
//               – braucht in Supabase die Secrets für Stripe und Mail sowie BILLING_OPEN=1
//   sponsoring  Sponsoring-Börse für Firmen und Streamer – braucht das Secret SPONSORING_OPEN=1
//   waitlist    Warteliste fürs StreamHelp Pad (pad.html) – braucht nur den Mail-Versand (BREVO_API_KEY, MAIL_FROM)
export const LAUNCH = { pro: false, sponsoring: false, waitlist: false };
