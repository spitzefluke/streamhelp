// Admin-Bereich → „Bilanz (EÜR)“: Einnahmen-Überschuss-Rechnung mit Bilanz, T-Konten und eigenen Buchungssätzen.
// Alles bleibt nur in diesem Browser (localStorage zd_admin_bilanz) – nichts geht an StreamHelp oder Supabase.
// Orientierungshilfe, keine Steuerberatung.
const KEY = 'zd_admin_bilanz';
const CI = ['Umsatzerlöse', 'Sonstige Einnahmen'];
const CO = ['Wareneinkauf', 'Büro & Software', 'Marketing', 'Reisekosten', 'Versicherungen', 'Miete & Nebenkosten', 'Telefon & Internet', 'Gebühren & Beiträge', 'Sonstige Ausgaben'];
// Kontenart: A = Aktiv, P = Passiv, E = Ertrag, X = Aufwand
const TY = {};
['Bank', 'Kasse', 'Forderungen', 'Vorsteuer', 'Anlagevermögen', 'Vorräte'].forEach((k) => { TY[k] = 'A'; });
['Eigenkapital', 'Darlehen', 'Verbindlichkeiten', 'Umsatzsteuer'].forEach((k) => { TY[k] = 'P'; });
CI.forEach((k) => { TY[k] = 'E'; });
CO.forEach((k) => { TY[k] = 'X'; });
const KINDS = {
  AA: 'Aktivtausch', PP: 'Passivtausch', AP: 'Aktiv-Passiv-Mehrung (Bilanzverlängerung)', PA: 'Aktiv-Passiv-Minderung (Bilanzverkürzung)',
  AE: 'Aktiv-Passiv-Mehrung (erfolgswirksam)', XA: 'Aktiv-Passiv-Minderung (erfolgswirksam)', XP: 'Passivtausch (erfolgswirksam)', PE: 'Passivtausch (erfolgswirksam)',
};

const eur = (n) => n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sum = (l) => l.reduce((s, x) => s + x[1], 0);
const f2 = (n) => n.toFixed(2).replace('.', ',');
const qt = (s) => `"${String(s).split('"').join('""')}"`;
const dm = (s) => s.split('-').reverse().join('.').slice(0, 6);
const dmy = (s) => s.split('-').reverse().join('.');
const kind = (a, b) => KINDS[TY[a] + TY[b]] || 'Erfolgsbuchung';
const tacc = (n, A, B, hd) => ({ t: 'T', n, s: A, h: B, ss: sum(A), sh: sum(B), hd: hd || ['Soll', 'Haben'] });

function load() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY) ?? 'null'); } catch { /* leer oder kaputt */ }
  s = s && typeof s === 'object' ? s : {};
  return { kl: s.kl ? 1 : 0, rp: Number.isFinite(+s.rp) ? +s.rp : 25, e: Array.isArray(s.e) ? s.e : [], bu: Array.isArray(s.bu) ? s.bu : [],
    snaps: Array.isArray(s.snaps) ? s.snaps : [], q: s.q && typeof s.q === 'object' ? s.q : {}, ab: s.ab ?? '', bm: s.bm === 'q' ? 'q' : 'b' };
}

const HTML = `
<section class="panel panel--wide bil">
  <div class="bil-row">
    <div class="bil-f"><label for="bil-yr">Jahr</label><select id="bil-yr"></select></div>
    <div class="bil-f bil-f--2"><label for="bil-kl">Besteuerung</label>
      <select id="bil-kl"><option value="0">Regelbesteuerung (USt)</option><option value="1">Kleinunternehmer (§ 19 UStG)</option></select></div>
    <div class="bil-f"><label for="bil-rp">Rücklage in % vom Gewinn</label><input id="bil-rp" type="number" min="0" max="100" value="25"></div>
  </div>
</section>
<section class="panel panel--wide bil"><div class="bil-grid" id="bil-sum"></div><p class="bil-hint" id="bil-note"></p></section>
<section class="panel panel--wide bil">
  <h2 class="bil-h">Buchung</h2>
  <div class="bil-grid">
    <div><label for="bil-d">Datum</label><input id="bil-d" type="date"></div>
    <div><label for="bil-t">Art</label><select id="bil-t"><option value="in">Einnahme</option><option value="out">Ausgabe</option></select></div>
    <div><label for="bil-a">Betrag brutto (€)</label><input id="bil-a" type="number" step="0.01" min="0" inputmode="decimal"></div>
    <div><label for="bil-r">USt-Satz</label><select id="bil-r"><option value="19">19 %</option><option value="7">7 %</option><option value="0">0 %</option></select></div>
    <div class="bil-wide"><label for="bil-s">Beschreibung</label><input id="bil-s" maxlength="80" placeholder="z. B. Rechnung 2026-001"></div>
    <div class="bil-wide"><label for="bil-c">Kategorie</label><select id="bil-c"></select></div>
  </div>
  <div class="bil-actions"><button class="btn btn--primary" type="button" id="bil-add">Buchung hinzufügen</button></div>
  <p class="bil-hint" id="bil-ms" role="status"></p>
</section>
<section class="panel panel--wide bil">
  <div class="bil-sc"><table class="bil-table"><thead><tr><th>Datum</th><th>Beschreibung</th><th>Kategorie</th><th class="n">Netto</th><th class="n">USt</th><th></th></tr></thead><tbody id="bil-tb"></tbody></table></div>
  <p class="bil-hint">Daten werden nur in diesem Browser gespeichert. Orientierungshilfe, keine Steuerberatung.</p>
</section>
<section class="panel panel--wide bil">
  <h2 class="bil-h">Bilanz</h2>
  <label for="bil-bm">Berechnungsart</label>
  <select id="bil-bm"><option value="b">Aus Buchungen (Buchungssätze)</option><option value="q">Schnellrechner (ohne Buchungen)</option></select>
  <div id="bil-bq" class="bil-grid bil-mt" hidden>
    <div><label for="bil-q1">Anlagevermögen (€)</label><input id="bil-q1" type="number" step="0.01" inputmode="decimal"></div>
    <div><label for="bil-q2">Vorräte / Waren (€)</label><input id="bil-q2" type="number" step="0.01" inputmode="decimal"></div>
    <div><label for="bil-q3">Forderungen (€)</label><input id="bil-q3" type="number" step="0.01" inputmode="decimal"></div>
    <div><label for="bil-q4">Bank &amp; Kasse (€)</label><input id="bil-q4" type="number" step="0.01" inputmode="decimal"></div>
    <div><label for="bil-q5">Verbindlichkeiten (€)</label><input id="bil-q5" type="number" step="0.01" inputmode="decimal"></div>
    <div><label for="bil-q6">Darlehen (€)</label><input id="bil-q6" type="number" step="0.01" inputmode="decimal"></div>
  </div>
  <div id="bil-bb" class="bil-mt"><label for="bil-ab">Anfangsbestand Bank = Eigenkapital zu Jahresbeginn (€)</label><input id="bil-ab" type="number" step="0.01" inputmode="decimal"></div>
  <div class="bil-actions">
    <button class="btn btn--primary" type="button" id="bil-bc">Berechnen</button>
    <button class="btn btn--outline" type="button" id="bil-bs">Speichern</button>
    <button class="btn btn--outline" type="button" id="bil-bd">Herunterladen (CSV)</button>
  </div>
  <div class="bil-sc bil-mt"><table class="bil-table"><tbody id="bil-br"></tbody></table></div>
  <p class="bil-hint" id="bil-bh" role="status">Vereinfachte Bilanz: Der Anfangsbestand gilt als Bankguthaben und Eigenkapital.</p>
</section>
<section class="panel panel--wide bil">
  <h2 class="bil-h">Eigener Buchungssatz (z. B. Kredit, Umbuchung, Einlage)</h2>
  <div class="bil-grid">
    <div><label for="bil-bso">Soll</label><select id="bil-bso"></select></div>
    <div><label for="bil-bha">Haben</label><select id="bil-bha"></select></div>
    <div><label for="bil-bbe">Betrag (€)</label><input id="bil-bbe" type="number" step="0.01" min="0" inputmode="decimal"></div>
  </div>
  <p class="bil-hint" id="bil-bty"></p>
  <div class="bil-actions"><button class="btn btn--primary" type="button" id="bil-bba">Buchungssatz hinzufügen</button></div>
  <p class="bil-hint">Das Datum wird oben aus dem Buchungsformular übernommen.</p>
  <div class="bil-sc bil-mt"><table class="bil-table"><tbody id="bil-bl"></tbody></table></div>
</section>
<section class="panel panel--wide bil"><h2 class="bil-h">Gespeicherte Bilanzen</h2><div class="bil-sc"><table class="bil-table"><tbody id="bil-sl"></tbody></table></div></section>
<section class="panel panel--wide bil"><h2 class="bil-h">Ausgaben nach Kategorie</h2><div class="bil-sc"><table class="bil-table"><tbody id="bil-cat"></tbody></table></div></section>`;

let mounted = null;

export function renderBilanz(slot) {
  if (mounted === slot && slot.querySelector('.bil')) return; // schon da – Stand bleibt
  mounted = slot;
  slot.innerHTML = HTML;
  const $ = (id) => slot.querySelector(`#bil-${id}`);
  const S = load();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* privater Modus */ } };
  const num = (id) => parseFloat($(id).value) || 0;
  const msg = (t) => { $('ms').textContent = t; };
  const bmsg = (t) => { $('bh').textContent = t; };
  const calc = (e) => { const k = S.kl === 1; const r = k ? 0 : e.r; const g = e.a; const n = g / (1 + r / 100); return k ? { n: g, v: 0 } : { n, v: g - n }; };

  function cats() {
    const o = $('t').value === 'in' ? CI : CO;
    $('c').innerHTML = o.map((c) => `<option>${esc(c)}</option>`).join('');
  }
  function years() {
    const y = new Date().getFullYear();
    const set = { [y]: 1 };
    S.e.concat(S.bu).forEach((e) => { set[e.d.slice(0, 4)] = 1; });
    const cur = $('yr').value || String(y);
    $('yr').innerHTML = Object.keys(set).sort().reverse().map((k) => `<option${k === cur ? ' selected' : ''}>${k}</option>`).join('');
  }

  function calcBil() {
    let rows = [];
    let t;
    let yr = null;
    if ($('bm').value === 'q') {
      const an = num('q1'); const vo = num('q2'); const fo = num('q3'); const ba = num('q4'); const vb = num('q5'); const da = num('q6');
      const sa = an + vo + fo + ba; const ek = sa - vb - da;
      rows = [['SCHLUSSBILANZ'], tacc('Schlussbilanz', [['Anlagevermögen', an], ['Vorräte / Waren', vo], ['Forderungen', fo], ['Bank & Kasse', ba]],
        [['Eigenkapital (Aktiva − Fremdkapital)', ek], ['Darlehen', da], ['Verbindlichkeiten', vb]], ['Aktiva', 'Passiva'])];
      if (sa > 0) rows.push(['Eigenkapitalquote', null, 0, `${(ek / sa * 100).toFixed(1).replace('.', ',')} %`]);
      t = 'Schnellrechner';
    } else {
      yr = $('yr').value;
      const ab = num('ab'); const AC = {}; const J = [];
      const ac = (n) => AC[n] || (AC[n] = { S: [], H: [] });
      const post = (s, h, a, d, gs, gh) => {
        if (Math.abs(a) < 0.005) return;
        ac(s).S.push([gs || h, a]);
        ac(h).H.push([gh || s, a]);
        J.push({ d, s, h, a });
      };
      post('Bank', 'Eigenkapital', ab, `${yr}-01-01`, 'EBK', 'EBK');
      S.e.concat(S.bu).filter((x) => x.d.slice(0, 4) === yr).sort((a, b) => a.d.localeCompare(b.d)).forEach((x) => {
        if (x.t === 'in') { const c = calc(x); post('Bank', x.c, c.n, x.d); post('Bank', 'Umsatzsteuer', c.v, x.d); }
        else if (x.t === 'out') { const c = calc(x); post(x.c, 'Bank', c.n, x.d); post('Vorsteuer', 'Bank', c.v, x.d); }
        else post(x.s, x.h, x.a, x.d);
      });
      const GS = []; const GH = [];
      Object.keys(AC).forEach((k) => { const d = sum(AC[k].S) - sum(AC[k].H); if (TY[k] === 'X') GS.push([k, d]); else if (TY[k] === 'E') GH.push([k, -d]); });
      const gw = sum(GH) - sum(GS); const erf = GS.length + GH.length > 0;
      if (erf && Math.abs(gw) > 0.004) {
        if (gw > 0) { GS.push(['Eigenkapital', gw]); ac('Eigenkapital').H.push(['GuV', gw]); }
        else { GH.push(['Eigenkapital', -gw]); ac('Eigenkapital').S.push(['GuV', -gw]); }
      }
      const keys = Object.keys(TY).filter((k) => AC[k]);
      const tk = (k) => {
        const a = AC[k]; const A = a.S.slice(); const B = a.H.slice(); const d = sum(A) - sum(B);
        const l = TY[k] === 'A' || TY[k] === 'P' ? 'SBK' : 'GuV';
        if (d > 0.004) B.push([l, d]); else if (d < -0.004) A.push([l, -d]);
        return tacc(k, A, B);
      };
      const AL = []; const PL = [];
      keys.forEach((k) => { const d = sum(AC[k].S) - sum(AC[k].H); if (Math.abs(d) < 0.005) return; if (TY[k] === 'A') AL.push([k, d]); else if (TY[k] === 'P') PL.push([k, -d]); });
      rows = [['BUCHUNGSSÄTZE MIT BILANZVERÄNDERUNG']];
      J.forEach((j) => rows.push([`${dm(j.d)} ${j.s} an ${j.h} · ${kind(j.s, j.h)}`, j.a]));
      if (!J.length) rows.push(['Keine Buchungen in diesem Jahr.', null, 0, '']);
      rows.push(['T-KONTEN']);
      keys.forEach((k) => rows.push(tk(k)));
      if (erf) rows.push(tacc('GuV (Gewinn- und Verlustrechnung)', GS, GH));
      rows.push([`SCHLUSSBILANZ 31.12.${yr}`]);
      rows.push(tacc('Schlussbilanz', AL, PL, ['Aktiva', 'Passiva']));
      t = `Bilanz ${yr}`;
    }
    return { t, yr, rows };
  }

  const tl = (l) => (l.length ? l.map((x) => `<div class="bil-tl"><span>${esc(x[0])}</span><span>${eur(x[1])}</span></div>`).join('') : '&nbsp;');
  function drawBil(c) {
    $('br').innerHTML = c.rows.map((r) => {
      if (r.t === 'T') {
        return `<tr><td colspan="2" class="bil-tk"><b>${esc(r.n)}</b><div class="bil-tg"><div class="bil-th">${esc(r.hd[0])}</div><div class="bil-th">${esc(r.hd[1])}</div>`
          + `<div>${tl(r.s)}</div><div>${tl(r.h)}</div><div class="bil-ts">Summe ${eur(r.ss)}</div><div class="bil-ts">Summe ${eur(r.sh)}</div></div></td></tr>`;
      }
      if (r.length === 1) return `<tr class="bil-ph"><td colspan="2">${esc(r[0])}</td></tr>`;
      const v = r[3] != null ? r[3] : eur(r[1]);
      return `<tr${r[2] ? ' class="bil-tot"' : ''}><td>${esc(r[0])}</td><td class="n">${esc(v)}</td></tr>`;
    }).join('');
  }
  function csvOf(c) {
    const o = [c.t];
    c.rows.forEach((r) => {
      if (r.t === 'T') {
        o.push('');
        o.push(`${r.n} (${r.hd[0]} | ${r.hd[1]})`);
        const n = Math.max(r.s.length, r.h.length);
        for (let i = 0; i < n; i++) {
          const a = r.s[i] || ['', '']; const b = r.h[i] || ['', ''];
          o.push([a[0], a[1] === '' ? '' : f2(a[1]), b[0], b[1] === '' ? '' : f2(b[1])].map(qt).join(';'));
        }
        o.push(['Summe', f2(r.ss), 'Summe', f2(r.sh)].map(qt).join(';'));
      } else if (r.length === 1) { o.push(''); o.push(r[0]); }
      else o.push(`${qt(r[0])};${r[3] != null ? r[3] : f2(r[1])}`);
    });
    return `﻿${o.join('\r\n')}`;
  }

  function render() {
    $('kl').value = String(S.kl);
    $('rp').value = S.rp;
    years();
    const yr = $('yr').value;
    const L = S.e.filter((e) => e.d.slice(0, 4) === yr).sort((a, b) => b.d.localeCompare(a.d));
    let ei = 0; let ea = 0; let ui = 0; let ua = 0; const bc = {};
    L.forEach((e) => { const c = calc(e); if (e.t === 'in') { ei += c.n; ui += c.v; } else { ea += c.n; ua += c.v; bc[e.c] = (bc[e.c] || 0) + c.n; } });
    const gw = ei - ea; const zl = ui - ua; const rl = Math.max(0, gw) * S.rp / 100;
    $('sum').innerHTML = [['Einnahmen', eur(ei), 'in'], ['Ausgaben', eur(ea), 'out'], ['Gewinn / Verlust', eur(gw), gw >= 0 ? 'in' : 'out'],
      ['USt-Zahllast', S.kl === 1 ? '–' : eur(zl), ''], ['Empfohlene Rücklage', eur(rl), '']]
      .map((x) => `<div><div class="bil-k">${x[0]}</div><div class="bil-v ${x[2] ? `bil-${x[2]}` : ''}">${x[1]}</div></div>`).join('');
    $('note').textContent = gw > 24500 ? 'Hinweis: Der Gewinn liegt über dem Gewerbesteuer-Freibetrag von 24.500 €.' : 'Der Gewinn liegt unter dem Gewerbesteuer-Freibetrag von 24.500 €.';
    $('tb').innerHTML = L.length
      ? L.map((e) => { const c = calc(e); return `<tr><td>${dmy(e.d)}</td><td>${esc(e.s)}</td><td>${esc(e.c)}</td><td class="n bil-${e.t}">${e.t === 'out' ? '−' : ''}${eur(c.n)}</td><td class="n">${eur(c.v)}</td><td><button class="bil-x" type="button" data-id="${e.id}" aria-label="Buchung löschen">✕</button></td></tr>`; }).join('')
      : '<tr><td colspan="6" class="bil-k">Noch keine Buchungen in diesem Jahr.</td></tr>';
    const ks = Object.keys(bc).sort((a, b) => bc[b] - bc[a]);
    $('cat').innerHTML = ks.length ? ks.map((k) => `<tr><td>${esc(k)}</td><td class="n">${eur(bc[k])}</td></tr>`).join('') : '<tr><td class="bil-k">Keine Ausgaben.</td></tr>';
    drawBil(calcBil());
  }
  function snaps() {
    $('sl').innerHTML = S.snaps.length
      ? S.snaps.map((s) => `<tr><td>${esc(s.n)}</td><td class="n"><button class="bil-x bil-x--ac" type="button" data-v="${s.id}">Anzeigen</button><button class="bil-x" type="button" data-x="${s.id}" aria-label="Gespeicherte Bilanz löschen">✕</button></td></tr>`).join('')
      : '<tr><td class="bil-k">Noch nichts gespeichert.</td></tr>';
  }
  function accOpts() {
    const o = Object.keys(TY).map((k) => `<option>${esc(k)}</option>`).join('');
    $('bso').innerHTML = o;
    $('bha').innerHTML = o;
    $('bha').selectedIndex = 6;
  }
  function preview() {
    const a = $('bso').value; const b = $('bha').value;
    $('bty').textContent = a === b ? 'Soll und Haben müssen verschieden sein.' : `${a} an ${b} → ${kind(a, b)}`;
  }
  function ownList() {
    $('bl').innerHTML = S.bu.length
      ? S.bu.slice().sort((a, b) => a.d.localeCompare(b.d)).map((b) => `<tr><td>${dmy(b.d)} ${esc(b.s)} an ${esc(b.h)}</td><td class="n">${eur(b.a)}</td><td><button class="bil-x" type="button" data-b="${b.id}" aria-label="Buchungssatz löschen">✕</button></td></tr>`).join('')
      : '<tr><td class="bil-k">Noch keine eigenen Buchungssätze.</td></tr>';
  }
  const vis = () => { const q = $('bm').value === 'q'; $('bq').hidden = !q; $('bb').hidden = q; };

  $('t').onchange = cats;
  $('kl').onchange = (e) => { S.kl = +e.target.value; save(); render(); };
  $('rp').onchange = (e) => { S.rp = Math.min(100, Math.max(0, +e.target.value || 0)); save(); render(); };
  $('yr').onchange = render;
  $('add').onclick = () => {
    const a = parseFloat($('a').value); const d = $('d').value;
    if (!d || !(a > 0)) { msg('Bitte Datum und Betrag angeben.'); return; }
    S.e.push({ id: Date.now(), d, t: $('t').value, a, r: +$('r').value, s: $('s').value || '–', c: $('c').value });
    $('a').value = '';
    $('s').value = '';
    save();
    years();
    $('yr').value = d.slice(0, 4);
    msg('Buchung hinzugefügt.');
    render();
  };
  $('tb').onclick = (ev) => {
    const id = ev.target.closest('[data-id]')?.dataset.id;
    if (!id || !confirm('Diese Buchung löschen?')) return;
    S.e = S.e.filter((e) => String(e.id) !== id);
    save();
    render();
  };
  $('bm').value = S.bm;
  vis();
  ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'ab'].forEach((id) => {
    const v = id === 'ab' ? S.ab : S.q[id];
    if (v) $(id).value = v;
    $(id).oninput = (e) => { if (id === 'ab') S.ab = e.target.value; else S.q[id] = e.target.value; save(); drawBil(calcBil()); };
  });
  $('bm').onchange = (e) => { S.bm = e.target.value; save(); vis(); drawBil(calcBil()); };
  $('bc').onclick = () => { drawBil(calcBil()); bmsg('Berechnet.'); };
  $('bs').onclick = () => {
    const c = calcBil();
    drawBil(c);
    S.snaps.unshift({ id: Date.now(), n: `${c.t} · ${new Date().toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}`, rows: c.rows });
    save();
    snaps();
    bmsg('Bilanz gespeichert.');
  };
  $('bd').onclick = () => {
    const c = calcBil();
    drawBil(c);
    const url = URL.createObjectURL(new Blob([csvOf(c)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `bilanz-${c.yr || 'schnellrechner'}.csv`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    bmsg('Datei gespeichert.');
  };
  $('sl').onclick = (ev) => {
    const v = ev.target.closest('[data-v]')?.dataset.v; const x = ev.target.closest('[data-x]')?.dataset.x;
    if (v) {
      const s = S.snaps.find((y) => String(y.id) === v);
      if (s) { drawBil({ t: s.n, rows: s.rows }); bmsg(`Gespeicherte Bilanz: ${s.n}`); $('br').scrollIntoView({ block: 'center' }); }
    }
    if (x && confirm('Diese gespeicherte Bilanz löschen?')) { S.snaps = S.snaps.filter((y) => String(y.id) !== x); save(); snaps(); }
  };
  $('bso').onchange = preview;
  $('bha').onchange = preview;
  $('bba').onclick = () => {
    const a = parseFloat($('bbe').value); const s = $('bso').value; const h = $('bha').value; const d = $('d').value;
    if (!(a > 0) || !d || s === h) { bmsg('Bitte Datum (oben), Betrag und zwei verschiedene Konten angeben.'); return; }
    S.bu.push({ id: Date.now(), d, s, h, a });
    $('bbe').value = '';
    save();
    years();
    $('yr').value = d.slice(0, 4);
    ownList();
    render();
    bmsg(`Buchungssatz hinzugefügt: ${kind(s, h)}`);
  };
  $('bl').onclick = (ev) => {
    const id = ev.target.closest('[data-b]')?.dataset.b;
    if (!id || !confirm('Diesen Buchungssatz löschen?')) return;
    S.bu = S.bu.filter((b) => String(b.id) !== id);
    save();
    ownList();
    render();
  };

  accOpts();
  preview();
  ownList();
  snaps();
  $('d').value = new Date().toISOString().slice(0, 10);
  cats();
  render();
}
