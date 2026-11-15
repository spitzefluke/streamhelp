import{$ as n,X as i,act as l,h as d,isAdmin as o,makeDialog as h,onSubmit as c,openFeature as p,paintTile as u,toast as a}from"./extras-core.js";const m=[["action_50",50],["action_100",100],["action_250",250],["action_500",500]],r=["💜","🎉","😂","🔥","✨","👑","🐸","💥"];export const emoterain={kind:"emoterain",icon:"🌧️",cta:"So geht’s →",on:!0,dialog:null,setup(){this.dialog=h({id:"x-emoterain",cls:"x-emoterain",eyebrow:"Chat · Overlay",title:"Emote-Regen",body:`
      <div class="x-layout">
        <div class="x-main">
          <div class="x-hero er-hero">
            <div class="er-sky" data-sky aria-hidden="true"></div>
            <b class="pl-q">Emotes regnen übers ganze Bild</b>
            <ul class="er-how">
              <li><b>!regen</b> im Chat – gern mit Emotes dahinter: <i>!regen Kappa PogChamp</i>. Ohne Emote regnen die zuletzt benutzten.</li>
              <li><b>Emote-Combo:</b> Schreibt der Chat dasselbe Emote oft hintereinander, regnet es von selbst.</li>
              <li>Streamer und Mods dürfen immer, alle anderen nach einer kurzen Pause.</li>
              <li><b>Kaufen:</b> Wenn der Streamer es einschaltet, mit Kanalpunkten („🌧️ Emote-Regen“) oder mit Bits im Twitch-Panel – dann regnet es extra kräftig.</li>
              <li><b>Eigene Emotes</b> ohne Twitch-Upload: im <a href="emotes.html">Emote-Editor</a> unter „Exportieren → Im Stream benutzen“ mit Code-Wort freigeben – dann z. B. <i>!regen ggstempel</i>. Klappt auch, wenn der Bot das schreibt.</li>
            </ul>
            <button class="btn btn--ghost btn--sm" type="button" data-rain>🌧️ Hier mal regnen lassen</button>
          </div>
        </div>
        <div class="x-side" data-admin hidden>
          <section class="bingo-box">
            <h3 class="prank-h3">Einrichten</h3>
            <p>Im OBS-Editor die Ebene <b>„Emote-Regen“</b> (unter „Bei Aktion“) einschalten. Dort stellst du den Befehl, wer darf, die Pause, die Combo-Länge und die Größe ein.</p>
            <button class="btn btn--primary btn--sm" type="button" data-open-obs>OBS-Editor öffnen</button>
            <p class="form-hint">Das Overlay liest den Twitch-Chat nur mit – kein Bot und keine Freigabe nötig. Im Testmodus des Overlays regnet es alle paar Sekunden zur Probe.</p>
          </section>
          <section class="bingo-box er-shop">
            <h3 class="prank-h3">Kaufen lassen</h3>
            <p class="er-live" data-shop-live></p>
            <form class="er-shop-form" data-shop-form>
              <label class="toggle"><input type="checkbox" name="points"><span class="toggle-ui" aria-hidden="true"></span>Mit Kanalpunkten („🌧️ Emote-Regen“)</label>
              <div class="x-row">
                <label class="field"><span>Kosten (Punkte)</span><input type="number" name="cost" min="1" max="1000000" step="1" inputmode="numeric" required></label>
                <label class="field"><span>Pause (Sekunden)</span><input type="number" name="cooldown" min="0" max="604800" step="1" inputmode="numeric" required></label>
              </div>
              <label class="toggle"><input type="checkbox" name="bits"><span class="toggle-ui" aria-hidden="true"></span>Mit Bits im Twitch-Panel</label>
              <label class="field"><span>Preis</span><select name="sku">${m.map(([e,t])=>`<option value="${e}">${t} Bits</option>`).join("")}</select></label>
              <div class="x-row">
                <button class="btn btn--primary btn--sm" type="submit">💾 Speichern</button>
                <button class="btn btn--ghost btn--sm" type="button" data-shop-test>🌧️ Probe-Regen im Overlay</button>
              </div>
            </form>
            <p class="form-hint" data-shop-state></p>
            <p class="form-hint" data-shop-note hidden>Einmal nötig: supabase/migrations/20270103000000_emote_rain_shop.sql im SQL Editor ausführen.</p>
            <p class="form-hint">Gekaufter Regen fällt extra kräftig, mit dem Namen oben im Bild. Ohne laufendes Overlay mit „Emote-Regen“ ist die Belohnung auf Twitch pausiert, Kanalpunkte gibt es zurück und das Panel bietet nichts an.</p>
          </section>
        </div>
      </div>`}),n("[data-rain]",this.dialog).addEventListener("click",()=>this.rain()),c(n("[data-shop-form]",this.dialog),e=>this.saveShop(e)),n("[data-shop-test]",this.dialog).addEventListener("click",e=>l(e.currentTarget,async()=>{const t=await i.api.rainShop.test();t?.reason==="cooldown"?a("Kurz warten – der letzte Probe-Regen läuft noch.","info"):a(t?.live?"Probe-Regen ist unterwegs.":"Probe-Regen geschickt – im Moment läuft aber kein Overlay mit „Emote-Regen“.",t?.live?"ok":"info")}))},shop:null,async loadShop(){if(o()){try{this.shop=await i.api.rainShop.get()}catch{this.shop=null}this.paintShop()}},paintShop(){const e=this.shop,t=n("[data-shop-form]",this.dialog);if(n("[data-shop-note]",this.dialog).hidden=!!e,t.hidden=!e,n("[data-shop-live]",this.dialog).textContent=e?e.live?"🟢 Ein Overlay mit Emote-Regen läuft – kaufen geht.":"⚪ Gerade läuft kein Overlay mit Emote-Regen – kaufen ist gesperrt.":"",!e){n("[data-shop-state]",this.dialog).textContent="";return}t.points.checked=!!e.points,t.cost.value=e.points_cost,t.cooldown.value=e.points_cooldown,t.bits.checked=!!e.bits,t.sku.value=e.bits_sku,n("[data-shop-state]",this.dialog).textContent=e.error?`⚠️ Twitch: ${e.error}`:e.reward_id&&e.points?"✓ Belohnung ist auf Twitch angelegt.":""},async saveShop(e){const t=await i.api.rainShop.set({points:e.points.checked,cost:Number(e.cost.value),cooldown:Number(e.cooldown.value),bits:e.bits.checked,sku:e.sku.value});if(this.shop=t,t.points||t.reward_id)if(!i.ctx.state.twitch?.connected)a("Gespeichert. Für Kanalpunkte zuerst Twitch verbinden.","info");else try{await i.api.rainShop.sync(),this.shop=await i.api.rainShop.get(),a(t.points?"Gespeichert – die Belohnung ist auf Twitch.":"Gespeichert – die Belohnung ist auf Twitch aus.","ok")}catch(s){this.shop=await i.api.rainShop.get().catch(()=>t),a(i.ctx.germanError(s),"error")}else a("Gespeichert.","ok");this.paintShop()},rain(){const e=n("[data-sky]",this.dialog);if(!matchMedia("(prefers-reduced-motion: reduce)").matches)for(let t=0;t<24;t++){const s=d("span",{class:"er-preview-drop",style:{left:`${Math.random()*94}%`,animationDelay:`${Math.random()*1.4}s`,animationDuration:`${1.8+Math.random()*1.4}s`}},r[t%r.length]);s.addEventListener("animationend",()=>s.remove(),{once:!0}),e.append(s)}},async load(){u(this)},render(){const e=o();n("[data-admin]",this.dialog).hidden=!e,this.dialog.classList.toggle("has-side",e),n("[data-note]",this.dialog).hidden=!0},tileStatus(){return"🌧️ !regen im Chat"},async open(){p(this)&&(this.render(),this.rain(),this.loadShop())}};
