// Bedienungshilfen: runder Knopf unten links (oder „Bedienungshilfen“ in der Fußzeile, data-a11y-open, oder
// Alt + Umschalt + A) öffnet ein Fenster mit Schriftgröße, hohem Kontrast, Graustufen, Animationen aus,
// unterstrichenen Links, gut lesbarer Schrift, mehr Zeilenabstand, großem Mauszeiger und deutlicher Fokus-Markierung.
// Dazu ein „Zum Inhalt springen“-Link für Tastatur und Screenreader.
//
// Bewusst ein klassisches Skript (kein Modul) im <head>: Es setzt die gespeicherten Einstellungen, bevor die Seite
// gezeichnet wird (kein Aufblitzen), und läuft auch auf den statischen Seiten ohne Module. Die Wahl liegt nur im
// Browser (localStorage sh_a11y) – kein Server, kein Tracking. Texte hat das Skript selbst (eigene kleine Liste),
// weil es vor js/i18n.js läuft. Nicht eingebunden im OBS-Overlay (overlay.html) und in den Console-Seiten.
(() => {
  'use strict';
  const KEY = 'sh_a11y';
  const SIZES = [100, 112, 125, 150];
  const FLAGS = ['contrast', 'gray', 'motion', 'links', 'font', 'spacing', 'cursor', 'focus'];
  const root = document.documentElement;

  // ---------- Einstellungen ----------
  const read = () => {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || 'null');
      return v && typeof v === 'object' ? v : {};
    } catch { return {}; }
  };
  // Nur bekannte Schlüssel und Werte übernehmen – localStorage ist Benutzereingabe
  const clean = (v) => {
    const out = { size: SIZES.includes(Number(v.size)) ? Number(v.size) : 100, hidden: v.hidden === true };
    for (const f of FLAGS) out[f] = v[f] === true;
    return out;
  };
  let prefs = clean(read());
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* privater Modus: gilt bis zum Neuladen */ }
  };

  const apply = () => {
    for (const f of FLAGS) root.classList.toggle(`a11y-${f}`, prefs[f]);
    for (const s of SIZES) root.classList.toggle(`a11y-size-${s}`, prefs.size === s && s !== 100);
    root.classList.toggle('a11y-fab-hidden', prefs.hidden);
    if (prefs.motion) document.querySelectorAll('video[autoplay]').forEach((v) => { try { v.pause(); } catch { /* egal */ } });
  };

  // „Animationen stoppen“ auch für Skripte, die selbst nach prefers-reduced-motion fragen (Partikel, Konfetti …).
  // Wirkt für Abfragen nach dem Umschalten sofort, für schon laufende Animationen nach dem Neuladen.
  const nativeMatch = window.matchMedia ? window.matchMedia.bind(window) : null;
  if (nativeMatch) {
    window.matchMedia = (query) => {
      const list = nativeMatch(query);
      if (!prefs.motion || !/prefers-reduced-motion\s*:\s*reduce/i.test(String(query))) return list;
      return new Proxy(list, {
        get(target, prop) {
          if (prop === 'matches') return true;
          const v = Reflect.get(target, prop, target);
          return typeof v === 'function' ? v.bind(target) : v;
        },
      });
    };
  }

  // ---------- Texte ----------
  const T = {
    de: ['Bedienungshilfen', 'Zum Inhalt springen', 'Schriftgröße', 'Kleiner', 'Größer', 'Hoher Kontrast', 'Graustufen', 'Animationen stoppen', 'Links unterstreichen', 'Gut lesbare Schrift', 'Mehr Zeilenabstand', 'Großer Mauszeiger', 'Deutliche Fokus-Markierung', 'Alles zurücksetzen', 'Schließen', 'Knopf ausblenden', 'Wieder öffnen mit Alt + Umschalt + A oder über „Bedienungshilfen“ in der Fußzeile. Gespeichert wird nur in diesem Browser.', 'Schriftgröße {n} %'],
    en: ['Accessibility', 'Skip to content', 'Text size', 'Smaller', 'Larger', 'High contrast', 'Grayscale', 'Stop animations', 'Underline links', 'Readable font', 'More line spacing', 'Large cursor', 'Strong focus outline', 'Reset all', 'Close', 'Hide button', 'Reopen with Alt + Shift + A or via “Accessibility” in the footer. Saved in this browser only.', 'Text size {n} %'],
    es: ['Accesibilidad', 'Saltar al contenido', 'Tamaño del texto', 'Más pequeño', 'Más grande', 'Alto contraste', 'Escala de grises', 'Detener animaciones', 'Subrayar enlaces', 'Fuente legible', 'Más interlineado', 'Cursor grande', 'Foco bien visible', 'Restablecer todo', 'Cerrar', 'Ocultar botón', 'Vuelve a abrirlo con Alt + Mayús + A o desde «Accesibilidad» en el pie de página. Solo se guarda en este navegador.', 'Tamaño del texto {n} %'],
    fr: ['Accessibilité', 'Aller au contenu', 'Taille du texte', 'Plus petit', 'Plus grand', 'Contraste élevé', 'Niveaux de gris', 'Arrêter les animations', 'Souligner les liens', 'Police lisible', 'Interligne plus grand', 'Grand curseur', 'Focus bien visible', 'Tout réinitialiser', 'Fermer', 'Masquer le bouton', 'Rouvrir avec Alt + Maj + A ou via « Accessibilité » en bas de page. Enregistré uniquement dans ce navigateur.', 'Taille du texte {n} %'],
    it: ['Accessibilità', 'Vai al contenuto', 'Dimensione testo', 'Più piccolo', 'Più grande', 'Contrasto elevato', 'Scala di grigi', 'Ferma animazioni', 'Sottolinea i link', 'Carattere leggibile', 'Interlinea maggiore', 'Cursore grande', 'Focus ben visibile', 'Ripristina tutto', 'Chiudi', 'Nascondi pulsante', 'Riaprilo con Alt + Maiusc + A o da «Accessibilità» nel piè di pagina. Salvato solo in questo browser.', 'Dimensione testo {n} %'],
    nl: ['Toegankelijkheid', 'Naar de inhoud', 'Tekstgrootte', 'Kleiner', 'Groter', 'Hoog contrast', 'Grijstinten', 'Animaties stoppen', 'Links onderstrepen', 'Goed leesbaar lettertype', 'Meer regelafstand', 'Grote muisaanwijzer', 'Duidelijke focus', 'Alles herstellen', 'Sluiten', 'Knop verbergen', 'Opnieuw openen met Alt + Shift + A of via „Toegankelijkheid” onderaan de pagina. Alleen in deze browser opgeslagen.', 'Tekstgrootte {n} %'],
    pl: ['Ułatwienia dostępu', 'Przejdź do treści', 'Rozmiar tekstu', 'Mniejszy', 'Większy', 'Wysoki kontrast', 'Skala szarości', 'Zatrzymaj animacje', 'Podkreśl linki', 'Czytelna czcionka', 'Większa interlinia', 'Duży kursor', 'Wyraźny fokus', 'Resetuj wszystko', 'Zamknij', 'Ukryj przycisk', 'Otwórz ponownie skrótem Alt + Shift + A lub przez „Ułatwienia dostępu” w stopce. Zapisywane tylko w tej przeglądarce.', 'Rozmiar tekstu {n} %'],
    pt: ['Acessibilidade', 'Pular para o conteúdo', 'Tamanho do texto', 'Menor', 'Maior', 'Alto contraste', 'Tons de cinza', 'Parar animações', 'Sublinhar links', 'Fonte legível', 'Mais espaçamento entre linhas', 'Cursor grande', 'Foco bem visível', 'Redefinir tudo', 'Fechar', 'Ocultar botão', 'Reabra com Alt + Shift + A ou em “Acessibilidade” no rodapé. Salvo apenas neste navegador.', 'Tamanho do texto {n} %'],
    tr: ['Erişilebilirlik', 'İçeriğe geç', 'Yazı boyutu', 'Küçült', 'Büyüt', 'Yüksek kontrast', 'Gri tonlama', 'Animasyonları durdur', 'Bağlantıların altını çiz', 'Okunaklı yazı tipi', 'Daha fazla satır aralığı', 'Büyük imleç', 'Belirgin odak çerçevesi', 'Tümünü sıfırla', 'Kapat', 'Düğmeyi gizle', 'Alt + Shift + A ile veya alt bilgideki “Erişilebilirlik” ile yeniden açın. Yalnızca bu tarayıcıda kaydedilir.', 'Yazı boyutu %{n}'],
    ru: ['Специальные возможности', 'Перейти к содержимому', 'Размер текста', 'Меньше', 'Больше', 'Высокий контраст', 'Оттенки серого', 'Остановить анимацию', 'Подчёркивать ссылки', 'Удобочитаемый шрифт', 'Больший межстрочный интервал', 'Крупный курсор', 'Заметная рамка фокуса', 'Сбросить всё', 'Закрыть', 'Скрыть кнопку', 'Открыть снова: Alt + Shift + A или «Специальные возможности» внизу страницы. Сохраняется только в этом браузере.', 'Размер текста {n} %'],
  };
  const pickLang = () => {
    let saved = null;
    try { saved = localStorage.getItem('sh_lang'); } catch { /* privater Modus */ }
    const wanted = [saved, ...(navigator.languages || [navigator.language])].filter(Boolean).map((l) => String(l).slice(0, 2).toLowerCase());
    return wanted.find((l) => Object.prototype.hasOwnProperty.call(T, l)) || 'de';
  };
  const words = T[pickLang()];
  const [L_TITLE, L_SKIP, L_SIZE, L_SMALLER, L_LARGER, L_CONTRAST, L_GRAY, L_MOTION, L_LINKS, L_FONT, L_SPACING, L_CURSOR, L_FOCUS, L_RESET, L_CLOSE, L_HIDE, L_HINT, L_SIZE_N] = words;

  // ---------- Styles (CSP erlaubt Styles inline; Skripte nur von der eigenen Seite) ----------
  const CURSOR = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24'%3E%3Cpath d='M4 2l15 11-6.5 1 3.8 7.2-2.7 1.4-3.8-7.3L4 19z' fill='%23000' stroke='%23fff' stroke-width='1.5' stroke-linejoin='round'/%3E%3C/svg%3E\") 6 3, auto";
  const CSS = `
html.a11y-size-112 body { zoom: 1.12; }
html.a11y-size-125 body { zoom: 1.25; }
html.a11y-size-150 body { zoom: 1.5; }
html.a11y-contrast { filter: contrast(1.35) saturate(1.15); }
html.a11y-gray { filter: grayscale(1); }
html.a11y-contrast.a11y-gray { filter: grayscale(1) contrast(1.35); }
html.a11y-motion *, html.a11y-motion *::before, html.a11y-motion *::after {
  animation-duration: .001ms !important; animation-delay: 0s !important; animation-iteration-count: 1 !important;
  transition-duration: .001ms !important; transition-delay: 0s !important; scroll-behavior: auto !important;
}
html.a11y-links a, html.a11y-links a * { text-decoration: underline !important; text-underline-offset: .18em; }
html.a11y-font body, html.a11y-font body :not(.ph):not([class^="ph-"]):not([class*=" ph-"]):not(code):not(pre):not(kbd):not(samp) {
  font-family: Verdana, Tahoma, "Segoe UI", system-ui, sans-serif !important; letter-spacing: .03em !important; word-spacing: .08em !important;
}
html.a11y-spacing body :where(p, li, dd, dt, td, th, label, small, blockquote, figcaption) { line-height: 1.85 !important; }
html.a11y-spacing body p { margin-bottom: 1em; }
html.a11y-cursor, html.a11y-cursor * { cursor: ${CURSOR} !important; }
html.a11y-focus :focus-visible { outline: 3px solid #ffd400 !important; outline-offset: 3px !important; box-shadow: 0 0 0 6px #000 !important; }
html.a11y-fab-hidden .a11y-fab { display: none; }

.a11y-skip { position: fixed; left: 12px; top: -80px; z-index: 2147483600; padding: 10px 16px; border-radius: 10px;
  background: #ffd400; color: #000; font: 600 15px/1.2 system-ui, sans-serif; text-decoration: none; box-shadow: 0 4px 18px rgba(0,0,0,.4); }
.a11y-skip:focus { top: 12px; outline: 3px solid #000; outline-offset: 2px; }
.a11y-fab { position: fixed; left: 14px; bottom: 14px; z-index: 2147482000; width: 46px; height: 46px; padding: 0; border: 2px solid #fff;
  border-radius: 50%; background: #1d4ed8; color: #fff; display: grid; place-items: center; cursor: pointer;
  box-shadow: 0 4px 16px rgba(0,0,0,.45); transition: transform .15s ease; }
.a11y-fab:hover { transform: scale(1.06); }
.a11y-fab:focus-visible { outline: 3px solid #ffd400; outline-offset: 3px; }
.a11y-fab svg { width: 28px; height: 28px; }
@media print { .a11y-fab, .a11y-skip { display: none !important; } }

.a11y-dlg { position: fixed; inset: auto auto 72px 14px; margin: 0; width: min(380px, calc(100vw - 28px)); max-height: calc(100vh - 96px);
  overflow-y: auto; padding: 0; border: 1px solid #3a4152; border-radius: 16px; background: #10141d; color: #eef1f7;
  font: 15px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; box-shadow: 0 18px 60px rgba(0,0,0,.6); text-align: left; }
.a11y-dlg::backdrop { background: rgba(0,0,0,.35); }
.a11y-dlg * { box-sizing: border-box; }
.a11y-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 14px 16px; border-bottom: 1px solid #262c3a; }
.a11y-dlg .a11y-head h2 { margin: 0; font: 700 17px/1.2 system-ui, sans-serif; color: #fff; text-transform: none; letter-spacing: normal; }
.a11y-x { width: 36px; height: 36px; border: 1px solid #3a4152; border-radius: 10px; background: transparent; color: #fff; font-size: 20px; line-height: 1; cursor: pointer; }
.a11y-body { padding: 14px 16px 16px; display: grid; gap: 12px; }
.a11y-size { display: flex; align-items: center; gap: 8px; }
.a11y-size span { flex: 1; font-weight: 600; }
.a11y-btn { min-height: 40px; padding: 8px 12px; border: 1px solid #3a4152; border-radius: 10px; background: #1a2030; color: #fff;
  font: 600 14px/1.2 system-ui, sans-serif; cursor: pointer; }
.a11y-btn:disabled { opacity: .4; cursor: not-allowed; }
.a11y-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.a11y-opt { min-height: 54px; padding: 10px; border: 2px solid #3a4152; border-radius: 12px; background: #161b27; color: #eef1f7;
  font: 600 14px/1.25 system-ui, sans-serif; text-align: left; cursor: pointer; display: flex; align-items: center; gap: 8px; }
.a11y-opt::before { content: ""; flex: none; width: 18px; height: 18px; border: 2px solid #8b93a7; border-radius: 5px; }
.a11y-opt[aria-pressed="true"] { border-color: #60a5fa; background: #1e3a8a; color: #fff; }
.a11y-opt[aria-pressed="true"]::before { border-color: #fff; background: #fff; box-shadow: inset 0 0 0 3px #1e3a8a; }
.a11y-dlg :focus-visible { outline: 3px solid #ffd400; outline-offset: 2px; }
.a11y-foot { display: flex; flex-wrap: wrap; gap: 8px; }
.a11y-hint { margin: 0; color: #aab2c5; font-size: 13px; }
@media (max-width: 380px) { .a11y-grid { grid-template-columns: 1fr; } }
`;

  const injectStyle = () => {
    if (document.getElementById('a11y-style')) return;
    const style = document.createElement('style');
    style.id = 'a11y-style';
    style.textContent = CSS;
    (document.head || root).appendChild(style);
  };

  // ---------- Oberfläche ----------
  const el = (tag, attrs, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === true) n.setAttribute(k, '');
      else if (v !== false && v != null) n.setAttribute(k, String(v));
    }
    for (const k of kids) if (k != null) n.append(k);
    return n;
  };
  const ICON = () => {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('fill', 'currentColor');
    p.setAttribute('d', 'M12 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm8.5 6.2l-5.5 1.1V13l2.3 7.4a1.1 1.1 0 0 1-2.1.7L13 15h-2l-2.2 6.1a1.1 1.1 0 0 1-2.1-.7L9 13V9.3L3.5 8.2a1.1 1.1 0 1 1 .4-2.2L9.5 7h5l5.6-1a1.1 1.1 0 1 1 .4 2.2z');
    svg.appendChild(p);
    return svg;
  };

  let dlg = null;
  let fab = null;
  let sizeLabel = null;
  let btnSmaller = null;
  let btnLarger = null;
  const optButtons = {};

  const refresh = () => {
    if (!dlg) return;
    sizeLabel.textContent = L_SIZE_N.replace('{n}', String(prefs.size));
    btnSmaller.disabled = prefs.size === SIZES[0];
    btnLarger.disabled = prefs.size === SIZES[SIZES.length - 1];
    for (const f of FLAGS) optButtons[f].setAttribute('aria-pressed', String(prefs[f]));
  };
  const change = (patch) => { prefs = clean({ ...prefs, ...patch }); save(); apply(); refresh(); };
  const step = (dir) => {
    const i = SIZES.indexOf(prefs.size) + dir;
    if (i >= 0 && i < SIZES.length) change({ size: SIZES[i] });
  };

  const build = () => {
    const labels = { contrast: L_CONTRAST, gray: L_GRAY, motion: L_MOTION, links: L_LINKS, font: L_FONT, spacing: L_SPACING, cursor: L_CURSOR, focus: L_FOCUS };
    const close = el('button', { type: 'button', class: 'a11y-x', 'aria-label': L_CLOSE }, '×');
    sizeLabel = el('span', { 'aria-live': 'polite' });
    btnSmaller = el('button', { type: 'button', class: 'a11y-btn', 'aria-label': `${L_SIZE}: ${L_SMALLER}` }, 'A−');
    btnLarger = el('button', { type: 'button', class: 'a11y-btn', 'aria-label': `${L_SIZE}: ${L_LARGER}` }, 'A+');
    const grid = el('div', { class: 'a11y-grid', role: 'group', 'aria-label': L_TITLE });
    for (const f of FLAGS) {
      const b = el('button', { type: 'button', class: 'a11y-opt', 'aria-pressed': 'false' }, labels[f]);
      b.addEventListener('click', () => change({ [f]: !prefs[f] }));
      optButtons[f] = b;
      grid.append(b);
    }
    const reset = el('button', { type: 'button', class: 'a11y-btn' }, L_RESET);
    const hide = el('button', { type: 'button', class: 'a11y-btn' }, L_HIDE);
    dlg = el('dialog', { class: 'a11y-dlg', 'aria-labelledby': 'a11y-title', translate: 'no', 'data-no-i18n': true },
      el('div', { class: 'a11y-head' }, el('h2', { id: 'a11y-title' }, L_TITLE), close),
      el('div', { class: 'a11y-body' },
        el('div', { class: 'a11y-size', role: 'group', 'aria-label': L_SIZE }, sizeLabel, btnSmaller, btnLarger),
        grid,
        el('div', { class: 'a11y-foot' }, reset, hide),
        el('p', { class: 'a11y-hint' }, L_HINT)));

    close.addEventListener('click', () => closeDialog());
    btnSmaller.addEventListener('click', () => step(-1));
    btnLarger.addEventListener('click', () => step(1));
    reset.addEventListener('click', () => change({ size: 100, hidden: false, ...Object.fromEntries(FLAGS.map((f) => [f, false])) }));
    hide.addEventListener('click', () => { change({ hidden: true }); closeDialog(); });
    // Klick auf den abgedunkelten Hintergrund schließt
    dlg.addEventListener('click', (e) => { if (e.target === dlg) closeDialog(); });
    document.body.append(dlg);
  };

  let opener = null;
  const openDialog = () => {
    if (!document.body) return;
    if (!dlg) build();
    refresh();
    if (dlg.open) return;
    opener = document.activeElement;
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    fab?.setAttribute('aria-expanded', 'true');
    optButtons[FLAGS[0]].focus();
  };
  const closeDialog = () => {
    if (!dlg?.open) return;
    if (typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open');
  };

  // „Zum Inhalt springen“: erstes sichtbares <main> (die Startseite hat mehrere, je nach Ansicht)
  const skipTarget = () => [...document.querySelectorAll('main, [role="main"]')].find((m) => !m.hidden && m.offsetParent !== null)
    || document.querySelector('main, [role="main"]');

  const mount = () => {
    injectStyle();
    if (window.top !== window.self) return; // eingebettet (Vorschau): kein eigener Knopf
    if (document.querySelector('.a11y-fab')) return;
    const skip = el('a', { class: 'a11y-skip', href: '#', translate: 'no', 'data-no-i18n': true }, L_SKIP);
    skip.addEventListener('click', (e) => {
      const target = skipTarget();
      if (!target) return;
      e.preventDefault();
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus();
      target.scrollIntoView({ block: 'start' });
    });
    fab = el('button', { type: 'button', class: 'a11y-fab', 'aria-label': L_TITLE, title: L_TITLE, 'aria-haspopup': 'dialog', 'aria-expanded': 'false', translate: 'no', 'data-no-i18n': true });
    fab.append(ICON());
    fab.addEventListener('click', openDialog);
    document.body.prepend(skip);
    document.body.append(fab);

    // Fußzeilen-Links „Bedienungshilfen“: Text in der Sprache dieses Skripts
    document.querySelectorAll('[data-a11y-open]').forEach((b) => {
      b.textContent = L_TITLE;
      b.addEventListener('click', (e) => { e.preventDefault(); openDialog(); });
    });
    if (location.hash === '#bedienungshilfen') openDialog();
    apply();
  };

  // Dialog schließt (Esc, ×, Hintergrund): Fokus zurück, wo er war
  document.addEventListener('close', (e) => {
    if (e.target !== dlg) return;
    fab?.setAttribute('aria-expanded', 'false');
    const back = opener && opener.isConnected && opener !== document.body ? opener : (prefs.hidden ? null : fab);
    back?.focus?.();
  }, true);

  // Tastenkürzel Alt + Umschalt + A – nicht während der Eingabe in ein Textfeld
  document.addEventListener('keydown', (e) => {
    if (!(e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyA')) return;
    e.preventDefault();
    if (dlg?.open) closeDialog(); else openDialog();
  });

  apply();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
  // Gleich auch im <head> einhängen, damit die gespeicherte Wahl ohne Aufblitzen greift
  injectStyle();
})();
