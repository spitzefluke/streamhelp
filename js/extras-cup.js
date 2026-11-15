import{$ as s,X as c,act as u,fill as x,h as r,isAdmin as g,makeDialog as z,onSubmit as v,openFeature as S,paintTile as w,toast as p}from"./extras-core.js";const y=10,k={1:"🥇",2:"🥈",3:"🥉"};export const cup={kind:"cup",icon:"🏆",cta:"Zur Rangliste →",on:!1,error:"",b:null,code:"",subscribed:!1,dialog:null,editing:!1,setup(){this.dialog=z({id:"x-cup",cls:"x-cup",eyebrow:"Chat: !cup join · Rangliste mit Preisgeld",title:"Cup",body:`
      <div class="x-layout">
        <div class="x-main">
          <div class="x-hero cup-hero">
            <span class="cup-state" data-state aria-live="polite"></span>
            <b class="cup-title" data-title></b>
            <p class="cup-sub" data-sub></p>
            <p class="cup-me" data-me hidden></p>
          </div>
          <section data-rules-box hidden>
            <h3 class="prank-h3">📜 Regeln</h3>
            <p class="cup-rules" data-rules></p>
          </section>
          <section>
            <h3 class="prank-h3">🏆 Rangliste <small data-count></small></h3>
            <ol class="x-list cup-board" data-board></ol>
          </section>
        </div>
        <div class="x-side" data-admin hidden>
          <section class="bingo-box">
            <h3 class="prank-h3">Steuern</h3>
            <div class="x-row">
              <button class="btn btn--primary btn--sm" type="button" data-open></button>
              <button class="btn btn--ghost btn--sm" type="button" data-send="rules">📜 Regeln in den Chat</button>
              <button class="btn btn--ghost btn--sm" type="button" data-send="code">🔑 Spielcode in den Chat</button>
            </div>
            <button class="btn btn--outline btn--sm" type="button" data-test hidden>➕ 6 Test-Spieler (Demo)</button>
            <p class="form-hint" data-admin-hint></p>
            <p class="form-hint">📺 Im Stream zeigen: 🎛️ OBS → Ebene <b>Cup</b> einschalten – Rangliste mit Punkten und Preisgeldern, live.</p>
          </section>
          <section class="bingo-box">
            <h3 class="prank-h3">Spieler hinzufügen</h3>
            <form class="x-row cup-add" data-add autocomplete="off">
              <label class="field" style="flex:1 1 160px"><span class="sr-only">Name</span><input type="text" name="name" maxlength="40" required placeholder="Name, z. B. NightOwl_Mia"></label>
              <button class="btn btn--primary btn--sm" type="submit">➕ Hinzufügen</button>
            </form>
            <p class="form-hint">Für Spieler ohne Chat. Jeder Name nur einmal. Punkte vergibst du direkt in der Rangliste.</p>
          </section>
          <section class="bingo-box">
            <h3 class="prank-h3">Einstellungen</h3>
            <form class="x-form" data-save autocomplete="off">
              <label class="field"><span>Name des Cups</span><input type="text" name="title" maxlength="60" placeholder="z. B. Fortnite Zero Build Cup"></label>
              <label class="field"><span>Regeln <small data-rules-len></small></span><textarea name="rules" rows="4" maxlength="450" placeholder="z. B. Nur Zero Build · Solo · 3 Runden · Punkte: Sieg 10, Top 5 = 5, je Kill 1"></textarea></label>
              <label class="field"><span>Spielcode <small>(nur für dich und deine Mods, bis du ihn verschickst)</small></span>
                <span class="cup-code-row"><input type="password" name="code" maxlength="60" placeholder="z. B. Matchmaking-Schlüssel" autocomplete="off"><button class="btn btn--ghost btn--sm" type="button" data-show-code>Zeigen</button></span>
              </label>
              <fieldset class="cup-prizes">
                <legend>Preisgelder je Platz <small>(optional)</small></legend>
                <div class="cup-prize-list" data-prizes></div>
                <button class="btn btn--ghost btn--sm" type="button" data-more-prize>＋ Platz</button>
              </fieldset>
              <label class="toggle"><input type="checkbox" name="open"><span class="toggle-ui" aria-hidden="true"></span>Anmeldung offen (!cup join im Chat)</label>
              <button class="btn btn--primary btn--sm" type="submit">💾 Speichern</button>
              <p class="form-hint">Die Regeln gehen als eine Chat-Nachricht raus (höchstens 450 Zeichen, Zeilen werden zu „·“). Zuschauer fragen sie mit !cup regeln ab.</p>
            </form>
          </section>
          <section class="bingo-box">
            <h3 class="prank-h3">Neuer Cup</h3>
            <div class="x-row">
              <button class="btn btn--ghost btn--sm" type="button" data-reset="keep">↺ Punkte auf 0 (Spieler bleiben)</button>
              <button class="btn btn--ghost btn--sm" type="button" data-reset="clear">🗑 Alle Spieler entfernen</button>
            </div>
            <p class="form-hint">Beides leert auch den Spielcode. Regeln und Preisgelder bleiben.</p>
          </section>
        </div>
      </div>`});const t=this.dialog,i=async()=>{await this.load(),this.render()},o=s("[data-save]",t);o.addEventListener("input",()=>{this.editing=!0,this.paintRulesLen()}),s("[data-more-prize]",t).addEventListener("click",()=>{const e=this.prizeValues();e.length<y&&this.setPrizes([...e,""],e.length)}),s("[data-show-code]",t).addEventListener("click",e=>{const a=o.code;a.type=a.type==="password"?"text":"password",e.currentTarget.textContent=a.type==="password"?"Zeigen":"Verbergen"}),v(o,async()=>{await c.api.cup.save({title:o.title.value,rules:o.rules.value,prizes:this.prizeValues(),open:o.open.checked,code:o.code.value}),this.editing=!1,p("Cup gespeichert.","ok"),await i()}),v(s("[data-add]",t),async e=>{const a=e.elements.name.value.replace(/^\s*@+/,"").trim();a&&(this.b=await c.api.cup.add(a),e.elements.name.value="",p(`${a} ist im Cup.`,"ok"),this.render(),e.elements.name.focus())}),s("[data-open]",t).addEventListener("click",e=>u(e.currentTarget,async()=>{const a=!this.b?.open;await c.api.cup.setOpen(a),p(a?"Anmeldung offen – der Bot sagt im Chat Bescheid.":"Anmeldung geschlossen.","ok"),await i()}));for(const e of t.querySelectorAll("[data-send]"))e.addEventListener("click",a=>u(a.currentTarget,async()=>{const l=a.currentTarget.dataset.send;this.editing&&!confirm("Es gibt ungespeicherte Änderungen. Trotzdem den gespeicherten Stand verschicken?")||l==="code"&&!confirm("Spielcode jetzt in den Chat schicken? Danach kann ihn jeder im Chat lesen.")||(await c.api.cup.announce(l),p(c.ctx.state.api.demo?"Im Demo-Modus geht nichts in den Chat – live schickt es der Bot.":l==="code"?"Spielcode ist im Chat.":"Regeln sind im Chat.","ok"),await i())}));s("[data-test]",t).addEventListener("click",e=>u(e.currentTarget,async()=>{this.b=await c.api.cup.addTest(6),this.render()}));for(const e of t.querySelectorAll("[data-reset]"))e.addEventListener("click",a=>u(a.currentTarget,async()=>{const l=a.currentTarget.dataset.reset==="keep";confirm(l?"Alle Punkte auf 0 setzen und den Spielcode leeren?":"Alle Spieler entfernen und den Spielcode leeren?")&&(await c.api.cup.reset(l),p(l?"Punkte zurückgesetzt.":"Alle Spieler entfernt.","ok"),await i())}))},prizeValues(){return[...this.dialog.querySelectorAll("[data-prizes] input")].map(t=>t.value)},setPrizes(t,i=-1){const o=t.length?t:["","",""],e=s("[data-prizes]",this.dialog);e.replaceChildren(...o.map((a,l)=>r("label",{class:"field cup-prize"},r("span",{},`${k[l+1]??""} Platz ${l+1}`),r("input",{type:"text",maxlength:"40",value:a,placeholder:l===0?"z. B. 50 €":l===1?"z. B. 25 €":l===2?"z. B. 10 €":""})))),s("[data-more-prize]",this.dialog).hidden=o.length>=y,i>=0&&e.querySelectorAll("input")[i]?.focus()},paintRulesLen(){const t=s("[data-save]",this.dialog).rules.value.replace(/[\r\n]+/g," · ").trim().length;s("[data-rules-len]",this.dialog).textContent=`${t}/450`},async load(){try{const t=await c.api.cup.get(),i=g()?(await c.api.cup.admin().catch(()=>null))?.code??"":"";Object.assign(this,{b:t,code:i,on:!0,error:""})}catch(t){Object.assign(this,{on:!1,error:t.message})}if(this.on&&!this.subscribed){this.subscribed=!0;let t=0;c.api.on("cup",()=>{clearTimeout(t),t=setTimeout(async()=>{await this.load(),this.dialog.open&&this.render()},300)})}w(this)},async points(t,i,o,e=null){await u(t,async()=>{this.b=await c.api.cup.points(i.id,o,e),this.render()})},render(){const t=this.dialog,i=g()&&this.on;s("[data-admin]",t).hidden=!i,t.classList.toggle("has-side",i);const o=s("[data-note]",t);if(o.hidden=this.on,!this.on){o.textContent=g()?`Einmal nötig: In Supabase im SQL Editor die Datei supabase/migrations/20261115000000_cup.sql ausführen.${this.error?` (${this.error})`:""}`:"Der Cup ist noch nicht eingerichtet. Schau später noch mal vorbei.";return}const e=this.b,a=e.prizes??[];s("[data-state]",t).textContent=e.open?"🟢 Anmeldung offen":"🔒 Anmeldung geschlossen",s("[data-title]",t).textContent=e.title,s("[data-sub]",t).textContent=`${e.count} ${e.count===1,"Spieler"}${e.open?" · im Chat: !cup join":""}${a[0]?` · 1. Platz: ${a[0]}`:""}`;const l=s("[data-me]",t);if(l.hidden=!e.me,e.me&&(l.textContent=`Du bist auf Platz ${e.me.place} mit ${e.me.points} Punkten${e.me.points>0&&a[e.me.place-1]?` – Preisgeld: ${a[e.me.place-1]}`:""}.`),s("[data-rules-box]",t).hidden=!e.rules,s("[data-rules]",t).textContent=e.rules,s("[data-count]",t).textContent=e.count>(e.players?.length??0)?`(Top ${e.players.length} von ${e.count})`:"",x(s("[data-board]",t),e.players??[],n=>{const b=n.points>0,f=b?a[n.place-1]:"",h=r("li",{class:`x-item cup-row${b&&n.place<=3?` is-top is-top-${n.place}`:""}${e.me?.id===n.id?" is-me":""}`},r("span",{class:"cup-place","aria-label":`Platz ${n.place}`},b&&k[n.place]||`${n.place}.`),r("span",{class:"cup-name"},r("b",{},n.name),f?r("small",{class:"cup-prize-tag"},`💰 ${f}`):null));if(!i)return h.append(r("span",{class:"cup-points"},`${n.points}`,r("small",{}," Pkt."))),h;const m=r("input",{type:"number",class:"cup-points-input",value:String(n.points),min:"-99999",max:"99999",step:"1","aria-label":`Punkte von ${n.name}`});return m.addEventListener("change",()=>{const d=Math.round(Number(m.value));Number.isFinite(d)&&d!==n.points&&this.points(m,n,null,d)}),h.append(r("span",{class:"cup-edit"},r("button",{class:"btn btn--ghost btn--sm",type:"button","aria-label":`${n.name} einen Punkt abziehen`,onclick:d=>this.points(d.currentTarget,n,-1)},"−"),m,r("button",{class:"btn btn--ghost btn--sm",type:"button","aria-label":`${n.name} einen Punkt geben`,onclick:d=>this.points(d.currentTarget,n,1)},"+"),r("button",{class:"btn btn--ghost btn--sm gw-kick",type:"button",title:"Aus dem Cup entfernen","aria-label":`${n.name} entfernen`,onclick:d=>{confirm(`${n.name} aus dem Cup entfernen?`)&&u(d.currentTarget,async()=>{this.b=await c.api.cup.remove(n.id),this.render()})}},"✕"))),h},e.open?"Noch niemand dabei – im Chat mit !cup join beitreten.":"Noch niemand dabei."),!!i&&(s("[data-open]",t).textContent=e.open?"🔒 Anmeldung schließen":"🟢 Anmeldung öffnen",s("[data-test]",t).hidden=!(c.ctx.state.api.demo&&e.open),s("[data-admin-hint]",t).textContent=e.code_sent_at?`Spielcode verschickt um ${new Date(e.code_sent_at).toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"})} Uhr.`:this.code?"Spielcode gespeichert, noch nicht verschickt.":"Noch kein Spielcode eingetragen.",!this.editing)){const n=s("[data-save]",t);n.title.value=e.title,n.rules.value=e.rules,n.code.value=this.code,n.open.checked=!!e.open,this.setPrizes(a),this.paintRulesLen()}},tileStatus(){const t=this.b;if(!this.on||!t)return"🏆 Turnier mit der Community";if(t.open)return`🟢 !cup join · ${t.count} dabei`;const i=t.players?.[0];return i&&i.points>0?`🥇 ${i.name} führt (${i.points})`:`🏆 ${t.count} Spieler`},async open(){S(this)&&(this.editing=!1,this.render(),await this.load(),this.render())}};
