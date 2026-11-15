import{h as i}from"./extras-core.js";import{DESIGN as x,FEATURES as V,KIT_PARTS as H,MORE_QUESTIONS as K,PACK as k,PACK_DEFAULT as w,REAR as S,RELEASE_CHECKS as v,eur as s,kitBoxSpec as _,kitPorts as N,kitTotals as M,option as E,packOpt as R,rearOpt as y}from"./dash-console-kit.js";import{TIPS as A}from"./dash-console-tips.js";const n=a=>String(a??"").replace(/[&<>"']/g,o=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[o]),G={none:"frei",scene:"Szene wechseln",spin:"Glücksrad drehen",sound:"Sound abspielen",alert:"Test-Alert",guard:"Raid-Schutz an/aus",page:"Dashboard-Seite öffnen"},Q={v1:"Version 1",later:"Später",no:"Nicht geplant",open:"Offen"},W={left:"links",back:"hinten",front:"vorn"},b=(a,o)=>`<table><thead><tr>${a.map(d=>`<th>${n(d)}</th>`).join("")}</tr></thead><tbody>${o.map(d=>`<tr>${d.map(m=>`<td>${m}</td>`).join("")}</tr>`).join("")}</tbody></table>`,r=a=>a.length?`<ul>${a.map(o=>`<li>${o}</li>`).join("")}</ul>`:'<p class="muted">–</p>';export function buildSpecHtml({kit:a,keys:o,by:d,at:m}){const c=M(a),l=_(a,o),p=new Date().toLocaleDateString("de-DE",{day:"2-digit",month:"long",year:"numeric"}),z=e=>e.options.find(([t])=>t===a.answers[e.id])?.[1],h=[],D=r(["<b>Capture Card mit Tastenpult</b>: nimmt Bild und Ton per HDMI auf (USB zum PC) und steuert den Stream mit 9 Tasten, Display und Ideen-Knopf.",...K.map(e=>{const t=z(e);return t||h.push(`Frage offen: ${n(e.name)}`),`${n(e.name)} <b>${n(t??"offen")}</b>`}),...a.answers.note?[`Notiz: ${n(a.answers.note)}`]:[]]),T=V.flatMap(e=>e.items.map(t=>{const u=a.features[t.id]??"open";return u==="open"&&h.push(`Funktion nicht entschieden: ${n(t.name)}`),[n(e.group),n(t.name)+(t.note?`<br><small>${n(t.note)}</small>`:""),`<span class="st st-${u}">${Q[u]}</span>`]})),P=H.map(e=>{const t=E(e.id,a.parts[e.id]),u=a.prices[`${e.id}.${t.id}`]??t.eur;return[n(e.name),n(t.name),s(u),t.tool?s(t.tool):"–"]}),f=[...x.map(e=>{const t=e.options.find(u=>u.id===a.design[e.id]);return t?.eur?[`Design: ${n(e.name)}`,n(t.name),s(t.eur),"–"]:null}),...S.map(e=>{const t=y(e.id,a.rear[e.id]);return t?.eur?[`Rückseite: ${n(e.name)}`,n(t.name),s(t.eur),"–"]:null}),...k.map(e=>{const t=R(e.id,a.pack[e.id]??w[e.id]);return t?.eur?[`Verpackung: ${n(e.name)}`,n(t.name),s(t.eur),"–"]:null})].filter(Boolean);a.design.combojack&&f.push(["Anschlüsse","Eine Headset-Buchse statt zwei Klinken",s(-.4),"–"]);const L=N(a).map(e=>`${n(e.label||(e.kind==="power"?"Ein-/Aus-Taste":"Status-LED"))}${e.recessed?" (versenkt)":""} – ${W[e.side??"left"]}`),j=S.map(e=>{const t=y(e.id,a.rear[e.id]);return t||h.push(`Rückseite offen: ${n(e.name)}`),`${n(e.name)}: <b>${n(t?.name??"offen (wie im Entwurf)")}</b>`}),B=x.map(e=>`${n(e.name)}: <b>${n(e.options.find(t=>t.id===a.design[e.id])?.name??"–")}</b>`),U=(o??[]).map((e,t)=>[String(t+1),n(`${e.icon??""} ${e.label??""}`.trim()||"–"),n(G[e.action]??e.action),e.color?`<span class="sw" style="background:${/^#[0-9a-f]{6}$/i.test(e.color)?e.color:"#888"}"></span> ${n(e.color)}`:"–"]),C=[`Karton: <b>${n(E("box",a.parts.box)?.name)}</b>`,...k.map(e=>`${n(e.name)}: <b>${n(R(e.id,a.pack[e.id]??w[e.id])?.name)}</b>`),`Inhalt: ${n(l.contents.join(", "))}`],g=e=>`${n(e.title)}${e.est?` <small>(${e.est>0?"spart":"kostet"} ca. ${s(Math.abs(e.est))} je Gerät${e.est>0?"":" mehr"})</small>`:""}`,F=A.filter(e=>a.tips[e.id]==="yes").map(g),$=A.filter(e=>a.tips[e.id]==="check").map(g);for(const e of $)h.push(`Vorschlag prüfen: ${e}`);const I=v.map(([e,t])=>`${a.checks[e]?"☑":"☐"} ${n(t)}`);for(const[e,t]of v)a.checks[e]||h.push(`Release-Check: ${n(t)}`);const O=a.ideas.filter(e=>e.status==="planned"||e.status==="new").map(e=>`${n(e.text)} <small>(${e.status==="planned"?"geplant":"neu"}${e.by?`, ${n(e.by)}`:""})</small>`);return`<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Lastenheft StreamHelp Console – ${n(p)}</title>
<style>
  :root { --ink: #16171d; --muted: #5d6170; --line: #dfe1e8; --acc: #7c3aed; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #f4f4f7; color: var(--ink); font: 14px/1.5 Inter, system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 860px; margin: 24px auto; background: #fff; padding: 40px 48px; border-radius: 12px; box-shadow: 0 2px 20px rgba(0,0,0,.06); }
  header { border-bottom: 3px solid var(--acc); padding-bottom: 14px; margin-bottom: 8px; }
  h1 { margin: 0; font-size: 26px; } h2 { font-size: 17px; margin: 28px 0 8px; color: var(--acc); }
  .meta, .muted, small { color: var(--muted); } .meta { margin: 6px 0 0; }
  .conf { display: inline-block; margin-top: 8px; padding: 2px 10px; border: 1px solid var(--acc); color: var(--acc); border-radius: 999px; font-size: 12px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0; } th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
  th { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
  ul { margin: 6px 0; padding-left: 20px; } li { margin: 3px 0; }
  .sum { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 8px; }
  .sum div { border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; } .sum b { display: block; font-size: 16px; }
  .st { font-size: 12px; padding: 1px 8px; border-radius: 999px; background: #eee; white-space: nowrap; } .st-v1 { background: #ede4ff; color: #5b21b6; } .st-open { background: #fff4d6; color: #8a5a00; }
  .sw { display: inline-block; width: 12px; height: 12px; border-radius: 3px; vertical-align: -1px; border: 1px solid rgba(0,0,0,.15); }
  .note { margin-top: 28px; font-size: 12px; color: var(--muted); border-top: 1px solid var(--line); padding-top: 10px; }
  @media print { body { background: #fff; } main { margin: 0; box-shadow: none; padding: 0; max-width: none; } h2 { break-after: avoid; } tr { break-inside: avoid; } }
</style></head>
<body><main>
<header>
  <h1>Lastenheft: StreamHelp Console</h1>
  <p class="meta">Stand ${n(p)}${m?` · zuletzt geändert ${n(new Date(m).toLocaleString("de-DE"))}${d?` von ${n(d)}`:""}`:""}</p>
  <span class="conf">Vertraulich – Entwurf</span>
</header>

<h2>1. Produkt</h2>${D}

<h2>2. Funktionsumfang</h2>${b(["Bereich","Funktion","Entscheidung"],T)}

<h2>3. Bauteile (Schätzpreise je Stück)</h2>${b(["Bereich","Auswahl","Preis je Stück","Einmalig"],[...P,...f])}

<h2>4. Anschlüsse und Rückseite</h2>${r(L)}${r(j)}

<h2>5. Design und Tastenbelegung</h2>${r(B)}${b(["Taste","Beschriftung","Aktion","Farbe"],U)}

<h2>6. Verpackung</h2>${r(C)}

<h2>7. Menge, Kosten und Preis</h2>
<div class="sum">
  <div>Erste Serie<b>${n(a.qty)} Stück</b></div>
  <div>Bauteile je Gerät<b>${s(c.unit)}</b></div>
  <div>Prüfungen (einmalig, Schätzung)<b>${s(c.tests)}</b></div>
  <div>Werkzeug (einmalig)<b>${s(c.tool)}</b></div>
  <div>Kosten je Gerät<b>${s(c.perDevice)}</b></div>
  <div>Endpreis-Vorschlag (× ${n(String(a.factor).replace(".",","))}, inkl. 19 % USt)<b>${s(c.price)}</b></div>
</div>

<h2>8. Normen und Pflichten für den Verkauf</h2>${r(c.duties.map(e=>n(e.text)))}

<h2>9. Vorschläge</h2>
<p><b>Übernommen</b></p>${r(F)}
<p><b>Später prüfen</b></p>${r($)}

<h2>10. Release-Check</h2>${r(I)}

<h2>11. Ideen (neu und geplant)</h2>${r(O)}

<h2>12. Offene Punkte</h2>${r(h)}

<p class="note">Alle Preise sind Schätzwerte zum Start und ersetzen keine Angebote. Die Pflichten sind ein Überblick ohne Gewähr und keine Rechtsberatung.
Erstellt mit dem Technik-Baukasten von StreamHelp.</p>
</main></body></html>`}export function renderSpecCard(a){const o=()=>new Blob([buildSpecHtml(a)],{type:"text/html;charset=utf-8"}),d=`lastenheft-streamhelp-console-${new Date().toISOString().slice(0,10)}.html`,m=()=>{const l=URL.createObjectURL(o());window.open(l,"_blank")||a.toast?.("Der Browser hat das neue Fenster blockiert – „Herunterladen“ geht immer.","info"),setTimeout(()=>URL.revokeObjectURL(l),6e4)},c=()=>{const l=URL.createObjectURL(o()),p=i("a",{href:l,download:d});document.body.append(p),p.click(),p.remove(),setTimeout(()=>URL.revokeObjectURL(l),1e4)};return i("section",{class:"dash-card dash-card--wide ck-card ck-spec"},i("header",{class:"cs-head"},i("div",{},i("h2",{},"Lastenheft"),i("p",{class:"dash-status"},"Alles aus Baukasten, Abfragen und Vorschlägen in einem Dokument – für Angebote bei Herstellern und Platinen-Fertigern.")),i("div",{class:"cs-head-btns"},i("button",{class:"btn btn--ghost btn--sm",type:"button",id:"ck-spec-open",onclick:m},"Ansehen / drucken"),i("button",{class:"btn btn--primary btn--sm",type:"button",id:"ck-spec-download",onclick:c},"Herunterladen (.html)"))),i("p",{class:"form-hint"},"Enthält Funktionsumfang, Bauteile mit Schätzpreisen, Anschlüsse, Rückseite, Design, Tastenbelegung, Verpackung, Kosten, Pflichten, Release-Check und alle offenen Punkte. Als PDF: im neuen Tab drucken und „Als PDF speichern“ wählen. Vertraulich – nicht öffentlich teilen."))}
