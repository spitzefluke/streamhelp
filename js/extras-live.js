import{$ as e,X as n,act as h,clock as v,fill as x,h as i,isAdmin as g,makeDialog as k,onSubmit as p,onTick as S,openFeature as _,paintNote as $,paintTile as b,secondsUntil as C,span as f,timeOf as z,toast as y}from"./extras-core.js";export const forbidden={kind:"forbidden",icon:"🤐",cta:"Zum Wort →",on:!1,error:"",data:null,reports:[],subscribed:!1,dialog:null,setup(){this.dialog=k({id:"x-forbidden",cls:"x-forbidden",eyebrow:"Live im Stream · !erwischt im Chat",title:"Verbotenes Wort",body:`
      <div class="x-layout">
        <div class="x-main">
          <div class="x-hero fw-hero">
            <span class="fw-label">Das verbotene Wort</span>
            <b class="fw-word" data-word>–</b>
            <div class="fw-stats">
              <span><b data-count>0</b> Verstöße</span>
              <span class="fw-penalty" data-penalty></span>
            </div>
          </div>
          <button class="btn btn--primary btn--lg btn--block" type="button" data-report>🚨 Erwischt! Er hat es gesagt</button>
          <p class="form-hint" data-how></p>
        </div>
        <div class="x-side" data-admin hidden>
          <section class="bingo-box">
            <h3 class="prank-h3">Steuern</h3>
            <div class="x-row">
              <button class="btn btn--outline btn--sm" type="button" data-draw>🎲 Neues Wort ziehen</button>
              <button class="btn btn--ghost btn--sm" type="button" data-stop>⏹ Beenden</button>
            </div>
            <form class="x-inline" data-own-form>
              <input type="text" name="word" maxlength="40" placeholder="Eigenes Wort …" aria-label="Eigenes Wort">
              <button class="btn btn--ghost btn--sm" type="submit">Nehmen</button>
            </form>
            <div class="x-row">
              <button class="btn btn--ghost btn--sm" type="button" data-add="1">＋1 Verstoß</button>
              <button class="btn btn--ghost btn--sm" type="button" data-add="-1">−1</button>
            </div>
          </section>
          <section class="bingo-box">
            <h3 class="prank-h3">Meldungen <small data-pending-count></small></h3>
            <ul class="x-list" data-reports></ul>
          </section>
          <section class="bingo-box">
            <h3 class="prank-h3">Einstellungen</h3>
            <form class="x-form" data-settings>
              <label class="field"><span>Wörter zum Ziehen (eins pro Zeile)</span><textarea name="words" rows="5" maxlength="4000"></textarea></label>
              <div class="x-grid2">
                <label class="field"><span>Strafe je Verstoß</span><input type="number" name="each" min="0" max="1000"></label>
                <label class="field"><span>Was?</span><input type="text" name="what" maxlength="40" placeholder="Liegestütze"></label>
              </div>
              <label class="field"><span>Chat-Befehl</span><input type="text" name="command" maxlength="21" placeholder="!erwischt"></label>
              <button class="btn btn--outline btn--sm" type="submit">Speichern</button>
            </form>
          </section>
        </div>
      </div>`});const t=this.dialog;e("[data-report]",t).addEventListener("click",a=>h(a.currentTarget,async()=>{const s=await n.api.forbidden.report();y(s?.ok===!1?"Du hast gerade erst gemeldet – kurz warten.":"Gemeldet! Ein Mod prüft es gleich.",s?.ok===!1?"info":"ok")})),e("[data-draw]",t).addEventListener("click",a=>h(a.currentTarget,async()=>this.apply(await n.api.forbidden.draw()))),e("[data-stop]",t).addEventListener("click",a=>h(a.currentTarget,async()=>this.apply(await n.api.forbidden.stop()))),t.querySelectorAll("[data-add]").forEach(a=>a.addEventListener("click",()=>h(a,async()=>this.apply(await n.api.forbidden.add(Number(a.dataset.add)))))),p(e("[data-own-form]",t),async a=>{const s=a.word.value.trim();s&&(this.apply(await n.api.forbidden.draw(s)),a.reset())}),p(e("[data-settings]",t),async a=>{this.apply(await n.api.forbidden.save({words:a.words.value.split(`
`),each:Number(a.each.value),what:a.what.value,command:a.command.value})),y("Gespeichert.","ok")})},async load(){try{this.data=await n.api.forbidden.get(),this.on=!!this.data,g()&&(this.reports=await n.api.forbidden.reports().catch(()=>[]))}catch(t){Object.assign(this,{on:!1,error:t.message})}this.on&&!this.subscribed&&(this.subscribed=!0,n.api.on("forbidden_word",t=>this.apply(t)),n.api.on("forbidden_reports",async()=>{g()&&(this.reports=await n.api.forbidden.reports().catch(()=>[]),this.render())})),b(this)},apply(t){if(!t)return;const a=this.data;if(this.data=t,b(this),this.dialog.open&&this.render(),a&&t.last_event?.n!==a.last_event?.n&&t.last_event?.type==="hit"&&this.dialog.open){const s=e(".fw-hero",this.dialog);s.classList.remove("is-hit"),s.offsetWidth,s.classList.add("is-hit")}g()&&t.pending!==this.reports.length&&n.api.forbidden.reports().then(s=>{this.reports=s,this.render()}).catch(()=>{})},penaltyText(t){return t.penalty_each?`${t.count?`${t.count} × ${t.penalty_each} = ${t.count*t.penalty_each}`:`${t.penalty_each} je Verstoß`} ${t.penalty_what}`:""},render(){const t=this.dialog;$(t,this);const a=this.data,s=g()&&this.on;if(e("[data-admin]",t).hidden=!s,t.classList.toggle("has-side",s),e("[data-word]",t).textContent=a?.running?a.word:"Gerade kein Wort",e("[data-count]",t).textContent=a?.count??0,e("[data-penalty]",t).textContent=a?this.penaltyText(a):"",e("[data-report]",t).disabled=!a?.running,e("[data-how]",t).textContent=a?.running?`Hat der Streamer „${a.word}“ gesagt? Drück den Knopf oder schreib ${a.report_command} in den Chat. Ein Mod bestätigt – dann zählt es.`:"Sobald ein Wort gezogen ist, kannst du hier und im Chat melden.",!s)return;e("[data-stop]",t).disabled=!a.running,e("[data-pending-count]",t).textContent=this.reports.length?`· ${this.reports.length} offen`:"",x(e("[data-reports]",t),this.reports,l=>i("li",{class:"x-item"},i("span",{class:"x-item-main"},i("b",{},l.reporters.slice(0,4).join(", ")+(l.reporters.length>4?` +${l.reporters.length-4}`:"")),i("small",{},`um ${z(l.created_at)} · ${l.reporters.length} ${l.reporters.length===1?"Meldung":"Meldungen"}`)),i("span",{class:"x-item-actions"},i("button",{class:"btn btn--primary btn--sm",type:"button",onclick:u=>h(u.currentTarget,async()=>this.apply(await n.api.forbidden.judge(l.id,!0)))},"✅ Zählt"),i("button",{class:"btn btn--ghost btn--sm",type:"button",onclick:u=>h(u.currentTarget,async()=>this.apply(await n.api.forbidden.judge(l.id,!1)))},"❌"))),"Keine offenen Meldungen.");const d=e("[data-settings]",t);d.contains(document.activeElement)||(d.words.value=a.words.join(`
`),d.each.value=a.penalty_each,d.what.value=a.penalty_what,d.command.value=a.report_command)},tileStatus(){return this.on?this.data?.running?`🤐 Läuft · ${this.data.count} ${this.data.count===1?"Verstoß":"Verstöße"}`:"🤐 Gerade kein Wort":"🤐 Pssst …"},async open(){_(this)&&(this.render(),await this.load(),this.render())}},subathon={kind:"subathon",icon:"⏱️",cta:"Zum Timer →",on:!1,error:"",data:null,log:[],subscribed:!1,dialog:null,setup(){this.dialog=k({id:"x-subathon",cls:"x-subathon",eyebrow:"Follows, Abos und Bits verlängern den Stream",title:"Subathon",body:`
      <div class="x-layout">
        <div class="x-main">
          <div class="x-hero sa-hero">
            <span class="sa-status" data-status></span>
            <b class="sa-clock" data-clock>0:00:00</b>
            <span class="sa-added" data-added></span>
          </div>
          <div class="sa-rates" data-rates></div>
          <h3 class="prank-h3">Am meisten Zeit geschenkt</h3>
          <ol class="x-rank" data-top></ol>
          <h3 class="prank-h3">Zuletzt</h3>
          <ul class="x-list x-list--compact" data-log></ul>
        </div>
        <div class="x-side" data-admin hidden>
          <section class="bingo-box">
            <h3 class="prank-h3">Steuern</h3>
            <form class="x-inline" data-start-form>
              <input type="number" name="minutes" min="1" max="10080" aria-label="Startzeit in Minuten">
              <button class="btn btn--primary btn--sm" type="submit">▶ Starten (Minuten)</button>
            </form>
            <div class="x-row">
              <button class="btn btn--outline btn--sm" type="button" data-pause>⏸ Pause</button>
              <button class="btn btn--ghost btn--sm" type="button" data-end>⏹ Beenden</button>
              <button class="btn btn--ghost btn--sm" type="button" data-reset>🔄 Zurücksetzen</button>
            </div>
            <div class="x-row">
              <button class="btn btn--ghost btn--sm" type="button" data-plus="60">＋1 Min</button>
              <button class="btn btn--ghost btn--sm" type="button" data-plus="300">＋5 Min</button>
              <button class="btn btn--ghost btn--sm" type="button" data-plus="1800">＋30 Min</button>
              <button class="btn btn--ghost btn--sm" type="button" data-plus="-60">−1 Min</button>
            </div>
          </section>
          <section class="bingo-box">
            <h3 class="prank-h3">So viel Zeit gibt es</h3>
            <form class="x-form" data-settings>
              <div class="x-grid2">
                <label class="field"><span>Start (Minuten)</span><input type="number" name="start" min="1" max="10080"></label>
                <label class="field"><span>Höchstens (Stunden, 0 = offen)</span><input type="number" name="cap" min="0" max="720"></label>
                <label class="field"><span>Follow (Sekunden)</span><input type="number" name="follow" min="0" max="86400"></label>
                <label class="field"><span>Abo (Sekunden)</span><input type="number" name="sub" min="0" max="86400"></label>
                <label class="field"><span>100 Bits (Sekunden)</span><input type="number" name="bits" min="0" max="86400"></label>
              </div>
              <p class="form-hint">Abo Stufe 2 zählt doppelt, Stufe 3 fünffach. Verschenkte Abos zählen je Abo. Test-Alerts zählen nicht.</p>
              <button class="btn btn--outline btn--sm" type="submit">Speichern</button>
            </form>
          </section>
        </div>
      </div>`});const t=this.dialog,a=(s,d,l)=>h(s,async()=>this.apply(await n.api.subathon.control(d,l)));p(e("[data-start-form]",t),async s=>this.apply(await n.api.subathon.control("start",Number(s.minutes.value)||null))),e("[data-pause]",t).addEventListener("click",s=>a(s.currentTarget,this.data?.status==="paused"?"resume":"pause")),e("[data-end]",t).addEventListener("click",s=>{confirm("Subathon beenden? Der Timer bleibt bei 0 stehen.")&&a(s.currentTarget,"end")}),e("[data-reset]",t).addEventListener("click",s=>{confirm("Zurücksetzen? Verlauf und Zeit gehen auf Anfang.")&&a(s.currentTarget,"reset")}),t.querySelectorAll("[data-plus]").forEach(s=>s.addEventListener("click",()=>a(s,"add",Number(s.dataset.plus)))),p(e("[data-settings]",t),async s=>{this.apply(await n.api.subathon.save({start:Number(s.start.value),cap:Number(s.cap.value),follow:Number(s.follow.value),sub:Number(s.sub.value),bits:Number(s.bits.value)})),y("Gespeichert.","ok")}),S(()=>{this.dialog.open&&this.paintClock(),this.data?.status==="running"&&b(this)})},left(){const t=this.data;return t?t.status==="running"?C(t.ends_at):t.status==="ended"?0:t.remaining:0},async load(){try{this.data=await n.api.subathon.get(),this.on=!!this.data,this.log=await n.api.subathon.log().catch(()=>[])}catch(t){Object.assign(this,{on:!1,error:t.message})}this.on&&!this.subscribed&&(this.subscribed=!0,n.api.on("subathon",t=>{this.apply(t),n.api.subathon.log().then(a=>{this.log=a,this.dialog.open&&this.render()}).catch(()=>{})})),b(this)},apply(t){t&&(this.data=t,b(this),this.dialog.open&&this.render())},paintClock(){const t=this.dialog,a=this.data;e("[data-clock]",t).textContent=v(this.left());const s=a?.status==="running"&&this.left()===0;e("[data-status]",t).textContent=a?s||a.status==="ended"?"🏁 Vorbei":{ready:"Bereit",running:"🔴 Läuft",paused:"⏸ Pausiert"}[a.status]:""},render(){const t=this.dialog;$(t,this);const a=this.data,s=g()&&this.on;e("[data-admin]",t).hidden=!s,t.classList.toggle("has-side",s),this.paintClock(),e("[data-added]",t).textContent=a?.added?`${a.added>0?"+":"−"}${f(a.added)} dazugekommen`:"",e("[data-rates]",t).replaceChildren(...a?[i("span",{},`💜 Follow +${f(a.sec_follow)}`),i("span",{},`⭐ Abo +${f(a.sec_sub)}`),i("span",{},`💎 100 Bits +${f(a.sec_bits)}`),a.cap_hours?i("span",{},`⛔ höchstens ${a.cap_hours} Std`):null]:[]);const d=new Map;for(const o of this.log)o.kind!=="manual"&&o.seconds>0&&d.set(o.who,(d.get(o.who)??0)+o.seconds);const l=[...d].sort((o,w)=>w[1]-o[1]).slice(0,10);x(e("[data-top]",t),l,([o,w])=>i("li",{},i("b",{},o||"Anonym"),i("span",{},`+${f(w)}`)),"Noch keine Zeit geschenkt.");const u={follow:"💜",sub:"⭐",resub:"⭐",gift:"🎁",bits:"💎",manual:"🛠️"};if(x(e("[data-log]",t),this.log.slice(0,15),o=>i("li",{class:"x-item"},i("span",{},`${u[o.kind]??"•"} ${o.who||"Anonym"}`),i("small",{},`${o.seconds>0?"+":"−"}${f(o.seconds)} · ${z(o.created_at)}`)),"Noch nichts."),!s)return;const c=["running","paused"].includes(a.status);e("[data-start-form] button",t).disabled=c,e("[data-pause]",t).disabled=!c,e("[data-pause]",t).textContent=a.status==="paused"?"▶ Weiter":"⏸ Pause",e("[data-end]",t).disabled=!c,t.querySelectorAll("[data-plus]").forEach(o=>{o.disabled=!c});const m=e("[data-start-form]",t).minutes;document.activeElement!==m&&(m.value=a.start_minutes);const r=e("[data-settings]",t);r.contains(document.activeElement)||(Object.assign(r.start,{value:a.start_minutes}),r.cap.value=a.cap_hours,r.follow.value=a.sec_follow,r.sub.value=a.sec_sub,r.bits.value=a.sec_bits)},tileStatus(){const t=this.data;return!this.on||!t?"⏱️ Jeder Sub zählt":t.status==="running"?this.left()?`🔴 Noch ${v(this.left())}`:"🏁 Vorbei":{ready:"⏱️ Startet bald",paused:`⏸ Pausiert · ${v(t.remaining)}`,ended:"🏁 Vorbei"}[t.status]??"⏱️"},async open(){_(this)&&(this.render(),await this.load(),this.render())}},pause={kind:"pause",icon:"☕",cta:"Zur Pause →",on:!1,error:"",data:null,subscribed:!1,dialog:null,setup(){this.dialog=k({id:"x-pause",cls:"x-pause",eyebrow:"Gleich zurück · Zahlenraten im Chat",title:"Kurze Pause",body:`
      <div class="x-layout">
        <div class="x-main">
          <div class="x-hero pz-hero">
            <span class="pz-state" data-state></span>
            <b class="pz-title" data-title></b>
            <span class="pz-msg" data-msg></span>
            <b class="pz-clock" data-clock hidden></b>
          </div>
          <section class="bingo-box pz-game" data-game>
            <h3 class="prank-h3">🔢 Zahlenraten <small data-round></small></h3>
            <p class="pz-range" data-range></p>
            <p class="pz-last" data-last aria-live="polite"></p>
            <form class="x-inline" data-guess>
              <input type="number" name="n" min="1" required aria-label="Deine Zahl">
              <button class="btn btn--primary btn--sm" type="submit">Raten</button>
            </form>
            <p class="form-hint" data-how></p>
            <ul class="x-list x-list--compact" data-winners></ul>
          </section>
        </div>
        <div class="x-side" data-admin hidden>
          <section class="bingo-box">
            <h3 class="prank-h3">Pause</h3>
            <form class="x-form" data-start>
              <label class="field"><span>Überschrift</span><input type="text" name="title" maxlength="60" placeholder="Gleich geht’s weiter!"></label>
              <label class="field"><span>Text darunter</span><input type="text" name="message" maxlength="140" placeholder="Kurz Kaffee holen …"></label>
              <label class="field"><span>Countdown (Minuten, 0 = ohne)</span><input type="number" name="minutes" min="0" max="600" value="5"></label>
              <label class="toggle"><input type="checkbox" name="game" checked><span class="toggle-ui" aria-hidden="true"></span>Zahlenraten im Chat</label>
              <div class="x-row">
                <button class="btn btn--primary btn--sm" type="submit" data-start-btn>☕ Pause starten</button>
                <button class="btn btn--ghost btn--sm" type="button" data-stop>⏹ Pause beenden</button>
              </div>
            </form>
            <p class="form-hint">Im OBS-Fenster die Ebene „Pausen-Bildschirm“ einschalten. Chat und Dino bleiben darüber sichtbar, wenn ihre Ebenen an sind.</p>
          </section>
          <section class="bingo-box">
            <h3 class="prank-h3">Zahlenraten</h3>
            <form class="x-form" data-settings>
              <div class="x-grid2">
                <label class="field"><span>Zahl von 1 bis</span><input type="number" name="max" min="10" max="10000"></label>
                <label class="field"><span>Chat-Befehl</span><input type="text" name="command" maxlength="21"></label>
              </div>
              <button class="btn btn--outline btn--sm" type="submit">Speichern (neue Runde)</button>
            </form>
          </section>
        </div>
      </div>`});const t=this.dialog;p(e("[data-start]",t),async a=>{this.apply(await n.api.pause.start({minutes:Number(a.minutes.value)||0,title:a.title.value,message:a.message.value,game:a.game.checked})),y("Pause läuft – im Overlay ist jetzt der Pausen-Bildschirm zu sehen.","ok")}),e("[data-stop]",t).addEventListener("click",a=>h(a.currentTarget,async()=>this.apply(await n.api.pause.stop()))),p(e("[data-settings]",t),async a=>{this.apply(await n.api.pause.settings({max:Number(a.max.value),command:a.command.value})),y("Gespeichert – neue Runde.","ok")}),p(e("[data-guess]",t),async a=>{const s=await n.api.pause.guess(Number(a.n.value));y(s.hint==="hit"?`🎉 Richtig! Die Zahl war ${s.guess}.`:s.hint==="higher"?`${s.guess}? Höher!`:`${s.guess}? Tiefer!`,s.hint==="hit"?"ok":"info"),a.reset()}),S(()=>{this.dialog.open&&this.data?.ends_at&&this.paintClock()})},async load(){try{this.data=await n.api.pause.get(),this.on=!!this.data}catch(t){Object.assign(this,{on:!1,error:t.message})}this.on&&!this.subscribed&&(this.subscribed=!0,n.api.on("pause_screen",t=>this.apply(t))),b(this)},apply(t){t&&(this.data=t,b(this),this.dialog.open&&this.render())},paintClock(){const t=e("[data-clock]",this.dialog),a=this.data;t.hidden=!a?.active||!a.ends_at,t.hidden||(t.textContent=C(a.ends_at)?v(C(a.ends_at)):"gleich!")},render(){const t=this.dialog;$(t,this);const a=this.data,s=g()&&this.on;if(e("[data-admin]",t).hidden=!s,t.classList.toggle("has-side",s),!a)return;e("[data-state]",t).textContent=a.active?"☕ Gerade Pause":"Gerade keine Pause",e("[data-title]",t).textContent=a.active?a.title:"–",e("[data-msg]",t).textContent=a.active?a.message:"",this.paintClock();const d=a.active&&a.game_on;e("[data-game]",t).hidden=!d&&!s,e("[data-round]",t).textContent=`· Runde ${a.game_round}`,e("[data-range]",t).textContent=`Die Zahl liegt zwischen ${a.game_low} und ${a.game_high}.`;const l=a.game_last;e("[data-last]",t).textContent=l?.who?`${l.who}: ${l.guess} → ${l.hint==="hit"?"🎉 Treffer!":l.hint==="higher"?"höher ⬆":"tiefer ⬇"}`:"";const u=e("[data-guess]",t);if(u.n.max=a.game_max,u.querySelector("button").disabled=!d,e("[data-how]",t).textContent=d?`Oder im Chat: ${a.guess_command} ZAHL`:"Das Zahlenraten läuft nur während der Pause.",x(e("[data-winners]",t),a.game_winners??[],r=>i("li",{class:"x-item"},i("span",{},`🏆 ${r.who}`),i("small",{},`Zahl ${r.number} · ${r.guesses} Tipps`)),"Noch keine Gewinner."),!s)return;e("[data-stop]",t).disabled=!a.active,e("[data-start-btn]",t).textContent=a.active?"💾 Pause ändern":"☕ Pause starten";const c=e("[data-start]",t);c.contains(document.activeElement)||(c.title.value=a.title,c.message.value=a.message,c.game.checked=a.game_on);const m=e("[data-settings]",t);m.contains(document.activeElement)||(m.max.value=a.game_max,m.command.value=a.guess_command)},tileStatus(){return!this.on||!this.data?"☕ Gleich zurück":this.data.active?"☕ Gerade Pause · Zahlenraten!":"▶ Der Stream läuft"},async open(){_(this)&&(this.render(),await this.load(),this.render())}};
