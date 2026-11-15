import{$ as o,X as r,act as u,fill as p,h as i,isAdmin as m,makeDialog as g,openFeature as f,paintTile as v,timeOf as x,toast as b}from"./extras-core.js";const k=["🥇","🥈","🥉","4","5"];export const hotwords={kind:"hotwords",icon:"🔥",cta:"Hot Words →",on:!1,error:"",hw:null,counts:[],blocks:[],subscribed:!1,dialog:null,setup(){this.dialog=g({id:"x-hotwords",cls:"x-hotwords",eyebrow:"Live aus dem Twitch-Chat",title:"Hot Words",body:`
      <div class="x-layout">
        <div class="x-main">
          <div class="x-hero hw-hero">
            <span class="hw-flame" aria-hidden="true">🔥</span>
            <ol class="hw-top" data-top aria-live="polite"></ol>
            <p class="hw-sub" data-sub></p>
          </div>
          <h3 class="prank-h3">Alle Wörter <small data-total></small></h3>
          <ul class="x-list x-list--compact hw-list" data-counts></ul>
        </div>
        <div class="x-side" data-admin hidden>
          <section class="bingo-box">
            <h3 class="prank-h3">Einstellungen</h3>
            <form class="x-form" data-settings>
              <label class="toggle"><input type="checkbox" name="enabled"><span class="toggle-ui" aria-hidden="true"></span>Wörter im Chat zählen</label>
              <label class="field"><span>Wie viele Wörter zeigen?</span><select name="max">
                <option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option>
              </select></label>
              <label class="field"><span>Wörter zählen ab</span><select name="min">
                <option value="2">2 Buchstaben</option><option value="3">3 Buchstaben</option><option value="4">4 Buchstaben</option><option value="5">5 Buchstaben</option><option value="6">6 Buchstaben</option>
              </select></label>
            </form>
            <div class="x-row">
              <button class="btn btn--ghost btn--sm" type="button" data-reset>🔄 Neu anfangen</button>
              <button class="btn btn--outline btn--sm" type="button" data-test hidden>💬 Test-Chat (Demo)</button>
            </div>
            <p class="form-hint">Gezählt wird, was im Twitch-Chat steht (der Chat-Bot muss verbunden sein). Füllwörter wie „und“ oder „ich“, Befehle, Links und @Namen zählen nicht; dasselbe Wort zählt pro Person höchstens einmal pro Minute.</p>
          </section>
          <section class="bingo-box">
            <h3 class="prank-h3">🚫 Gesperrt <small>zählen nie</small></h3>
            <form class="x-form x-row" data-block>
              <input type="text" name="word" maxlength="30" placeholder="Wort sperren …" autocomplete="off" aria-label="Wort sperren">
              <button class="btn btn--outline btn--sm" type="submit">Sperren</button>
            </form>
            <ul class="x-list x-list--compact" data-blocks></ul>
          </section>
        </div>
      </div>`});const t=this.dialog,s=async()=>{await this.load(),this.render()};o("[data-settings]",t).addEventListener("change",async a=>{const e=a.currentTarget;try{this.hw=await r.api.hotwords.settings({enabled:e.enabled.checked,maxWords:Number(e.max.value),minLength:Number(e.min.value)}),b("Gespeichert.","ok",2e3)}catch(l){b(r.ctx.germanError(l),"error")}await s()}),o("[data-reset]",t).addEventListener("click",a=>u(a.currentTarget,async()=>{confirm("Alle Zähler auf 0 setzen? Die Hot Words fangen von vorne an.")&&(this.hw=await r.api.hotwords.reset(),await s())})),o("[data-test]",t).addEventListener("click",a=>u(a.currentTarget,async()=>{await r.api.hotwords.addTest(8),await s()})),o("[data-block]",t).addEventListener("submit",a=>{a.preventDefault();const e=a.currentTarget.word,l=e.value.trim();l&&u(a.submitter,async()=>{await r.api.hotwords.block(l,!0),e.value="",await s(),b(`„${l}“ ist gesperrt.`,"ok")})})},async load(){try{const t=await r.api.hotwords.get();if(!t)throw new Error("Tabelle hotwords fehlt.");const[s,a]=await Promise.all([r.api.hotwords.counts(40).catch(()=>[]),m()?r.api.hotwords.blocks().catch(()=>[]):[]]);Object.assign(this,{hw:t,counts:s,blocks:a,on:!0,error:""})}catch(t){Object.assign(this,{on:!1,error:t.message})}if(this.on&&!this.subscribed){this.subscribed=!0;let t=0;r.api.on("hotwords",()=>{clearTimeout(t),t=setTimeout(async()=>{await this.load(),this.dialog.open&&this.render()},300)})}v(this)},async block(t,s,a){await u(t,async()=>{await r.api.hotwords.block(s,a),await this.load(),this.render(),b(a?`„${s}“ ist gesperrt und verschwindet.`:`„${s}“ zählt wieder.`,"ok")})},render(){const t=this.dialog,s=m()&&this.on;o("[data-admin]",t).hidden=!s,t.classList.toggle("has-side",s);const a=o("[data-note]",t);if(a.hidden=this.on,!this.on){a.textContent=m()?`Einmal nötig: In Supabase im SQL Editor die Datei supabase/migrations/20261026000000_hotwords.sql ausführen.${this.error?` (${this.error})`:""}`:"Hot Words sind noch nicht eingerichtet. Schau später noch mal vorbei.";return}const e=this.hw,l=e.top??[],w=Math.max(1,...l.map(n=>n.n));p(o("[data-top]",t),l,(n,h)=>i("li",{class:"hw-row",style:{"--p":(n.n/w).toFixed(3)}},i("span",{class:"hw-rank"},k[h]??String(h+1)),i("b",{class:"hw-word"},n.w),i("span",{class:"hw-n"},`${n.n}×`)),e.enabled?"Noch keine Wörter – sobald der Chat schreibt, geht’s los.":"Hot Words sind gerade aus."),o("[data-sub]",t).textContent=e.enabled?`${e.max_words===1?"Das häufigste Wort":`Die ${e.max_words} häufigsten Wörter`} im Chat seit ${x(e.started_at)} Uhr${new Date(e.started_at).toDateString()===new Date().toDateString()?"":` (${new Date(e.started_at).toLocaleDateString("de-DE",{day:"2-digit",month:"2-digit"})})`}.`:"Zählen ist ausgeschaltet.";const c=this.counts;if(o("[data-total]",t).textContent=c.length?`· ${c.length>=40?"die 40 häufigsten":c.length}`:"",p(o("[data-counts]",t),c,n=>i("li",{class:"x-item"},i("b",{},n.label),i("span",{class:"x-item-actions"},i("small",{},`${n.n}×`),s&&i("button",{type:"button",class:"btn btn--ghost btn--sm hw-block",title:`„${n.label}“ sperren`,"aria-label":`„${n.label}“ sperren`,onclick:h=>this.block(h.currentTarget,n.word,!0)},"🚫"))),"Noch nichts gezählt."),!s)return;const d=o("[data-settings]",t);d.contains(document.activeElement)||(d.enabled.checked=e.enabled,d.max.value=String(e.max_words),d.min.value=String(e.min_length)),o("[data-test]",t).hidden=!r.ctx.state.api.demo,p(o("[data-blocks]",t),this.blocks,n=>i("li",{class:"x-item is-off"},i("b",{},n.word),i("button",{type:"button",class:"btn btn--ghost btn--sm",onclick:h=>this.block(h.currentTarget,n.word,!1)},"↩ Freigeben")),"Nichts gesperrt.")},tileStatus(){const t=this.hw?.top??[];return!this.on||!this.hw?"🔥 Was schreibt der Chat am meisten?":this.hw.enabled?t.length?`🔥 ${t[0].w} · ${t[0].n}×`:"🔥 Noch keine Wörter":"🔥 Gerade aus"},async open(){f(this)&&(this.render(),await this.load(),this.render())}};
