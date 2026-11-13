// Start-Schalter: Was ist schon offen? Umgelegt wird mit node tools/launch.mjs (siehe STARTKLAR.md) – das Skript
// ändert diese Datei und entfernt auf den Rechtsseiten die Hinweise „Noch nicht in Kraft“.
//   pro         Pro buchen (pro.html), kündigen (kuendigen.html), Pro-Ideen nur noch mit Pro
//               – braucht in Supabase die Secrets für Stripe und Mail sowie BILLING_OPEN=1
//   max         StreamHelp MAX buchen (pro.html, 5,99 €: Pro + Bot 2) – braucht pro, dazu in Supabase
//               STRIPE_PRICE_MAX und MAX_OPEN=1. Ab dann ist Bot 2 nur noch mit MAX wählbar.
//   sponsoring  Sponsoring-Börse für Firmen und Streamer – braucht das Secret SPONSORING_OPEN=1
//   waitlist    Warteliste fürs StreamHelp Pad (pad.html) – braucht nur den Mail-Versand (BREVO_API_KEY, MAIL_FROM)
export const LAUNCH = { pro: false, max: false, sponsoring: false, waitlist: false };
