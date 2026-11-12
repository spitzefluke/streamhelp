// Sponsoring-Börse: Schalter, ob sie offen ist, und die Logos (Migration …_sponsoring.sql): Bucket sponsor-assets,
// Pfad <angebot-id>.<endung>. Genutzt von sponsoring.html, Dashboard, Admin-Bereich und Overlay. Im Demo-Modus
// liegen die Logos als data:-Adresse im Browser (zd_sponsor_logos).
import { CONFIG } from './config.js';
import { LAUNCH } from './launch.js';

// Noch geschlossen: Die Börse braucht ein angemeldetes Gewerbe. Zum Öffnen: node tools/launch.mjs --sponsoring
// (Schalter in js/launch.js) und in Supabase das Secret SPONSORING_OPEN=1 (die Edge Function lehnt Angebote sonst ab).
export const SPONSORING_OPEN = LAUNCH.sponsoring;
export const SPONSORING_SOON = 'Wir sind gerade dabei, dafür ein Gewerbe anzumelden. Sobald das erledigt ist, öffnen wir die Sponsoring-Börse.';

// Branchen (Migration …_sponsoring_launch.sql) – dieselbe Liste wie supabase/functions/_shared/sponsoring.ts
export const SPONSOR_CATEGORIES = {
  gaming: '🎮 Gaming & Spiele', hardware: '🖥️ Hardware & Zubehör', software: '💾 Software & Apps', food: '🥤 Essen & Getränke (ohne Alkohol)',
  fashion: '👕 Mode & Merch', education: '📚 Bildung & Kurse', services: '🛠️ Dienstleistungen', other: '✨ Sonstiges',
};
// Ausgeschlossen (Nutzungsbedingungen §5) – die Firma bestätigt das beim Einreichen
export const SPONSOR_EXCLUDED = 'Glücksspiel und Sportwetten, Alkohol, Tabak und E-Zigaretten, Waffen, Erotik sowie riskante Finanzprodukte (z. B. Krypto-Trading, CFDs)';
// Hinweis für die Prüfung im Admin-Bereich: Wörter, bei denen ein ausgeschlossenes Angebot dahinterstecken könnte
const RISK = [
  ['Glücksspiel/Wetten', /casino|glücksspiel|gambl|\bwett(e|en|büro|anbieter|quote)\b|sportwett|\bbet(s|ting)?\b|spielautomat|poker|roulette|lootbox|case[- ]?opening/i],
  ['Alkohol', /alkohol|alcohol|\bbier\b|beer|vodka|wodka|whisk(e)?y|\brum\b|\bgin\b|likör|wein\b|wine|schnaps|spirituose/i],
  ['Tabak/Vapes', /tabak|tobacco|zigarett|cigar|vape|e-?zig|shisha|nikotin|nicotine|snus|liquid/i],
  ['Waffen', /waffe|weapon|\bgun|munition|ammo|messer kaufen/i],
  ['Erotik', /erotik|erotic|\bsex|porn|onlyfans|\bnsfw|adult/i],
  ['Finanzen/Krypto', /krypto|crypto|bitcoin|forex|\bcfd|trading|token sale|\bnft|airdrop|rendite/i],
];
export function sponsorRisks(o) {
  const text = [o?.company, o?.title, o?.description, o?.reward, o?.overlay_text, o?.code, o?.website, o?.link].filter(Boolean).join(' ');
  return RISK.filter(([, re]) => re.test(text)).map(([label]) => label);
}

export const SPONSOR_LOGO_RE = /^[0-9a-f-]{36}\.(png|jpg|webp)$/;
const live = () => !!(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);

export function sponsorLogoUrl(path) {
  if (!SPONSOR_LOGO_RE.test(path ?? '')) return '';
  if (live()) return `${CONFIG.SUPABASE_URL}/storage/v1/object/public/sponsor-assets/${path}`;
  try {
    const logos = JSON.parse(localStorage.getItem('zd_sponsor_logos') ?? '{}');
    return typeof logos[path] === 'string' && logos[path].startsWith('data:image/') ? logos[path] : '';
  } catch {
    return '';
  }
}

// Datei → data:-Adresse (fürs Hochladen über die Edge Function); höchstens 1 MB, PNG/JPG/WebP
export function readLogo(file) {
  return new Promise((resolve, reject) => {
    if (!file) { resolve(''); return; }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { reject(new Error('Logo: bitte PNG, JPG oder WebP.')); return; }
    if (file.size > 1024 * 1024) { reject(new Error('Logo: höchstens 1 MB.')); return; }
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Logo: Datei lässt sich nicht lesen.'));
    r.readAsDataURL(file);
  });
}
