// Schutz gegen Clickjacking: Die Webseite und der Admin-Bereich dürfen nicht in einer
// fremden Seite (iframe) stecken – sonst könnte jemand unsichtbar Klicks „unterschieben“.
// GitHub Pages kann dafür keinen Header (X-Frame-Options) setzen, deshalb hier im Skript.
// Eingebettet in die eigene Seite (z. B. die OBS-Vorschau) ist erlaubt.
export function guardFrame() {
  if (window.top === window.self) return true;
  let sameOrigin = false;
  try { sameOrigin = window.top.location.origin === location.origin; } catch { /* fremde Seite */ }
  if (sameOrigin) return true;
  // Ohne innerHTML: die Adresse kommt als Text/Attribut in die Seite, nie als HTML
  const body = document.createElement('body');
  body.style.cssText = 'font:16px system-ui;padding:24px;background:#07090f;color:#eef1f7';
  const link = document.createElement('a');
  link.style.color = '#ffb81c';
  link.target = '_top';
  link.rel = 'noopener';
  link.href = location.href;
  link.textContent = 'Direkt öffnen';
  body.append('Diese Seite darf nicht eingebettet werden. ', link);
  document.documentElement.replaceChildren(document.createElement('head'), body);
  return false;
}
