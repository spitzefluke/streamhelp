import{$ as l,$$ as y,RARITY_LABEL as f,X as r,act as h,fill as p,h as s,isAdmin as b,makeDialog as x,onSubmit as k,openFeature as $,paintNote as T,paintTile as v,timeOf as _,toast as m}from"./extras-core.js";import{RARITY_ORDER as u}from"./extras-api.js";import{TTS_VOICES as w,speak as S,stopSpeaking as K,ttsAvailable as A}from"./tts-voice.js";import{shrinkImage as N}from"./bingo.js";function P(a){return`
  <section class="bingo-box x-reward" data-reward="${a}" data-affiliate="Kanalpunkte">
    <h3 class="prank-h3">Kanalpunkte <small data-reward-state></small></h3>
    <form class="x-form" data-reward-form>
      <div class="x-grid2">
        <label class="field"><span>Kosten</span><input type="number" name="cost" min="1" max="1000000"></label>
        <label class="field"><span>Pause (Sekunden)</span><input type="number" name="cooldown" min="0" max="604800"></label>
      </div>
      <label class="toggle"><input type="checkbox" name="enabled"><span class="toggle-ui" aria-hidden="true"></span>Belohnung an</label>
      <button class="btn btn--outline btn--sm" type="submit">Speichern &amp; zu Twitch übernehmen</button>
    </form>
    <p class="form-hint">Legt die Belohnung im Twitch-Kanal an (nur Affiliates und Partner). Vor dem Starttermin der Kachel bleibt sie aus.</p>
  </section>`}async function E(a,t){const i=l(`[data-reward="${t}"]`,a),c=d=>{if(!d)return;const n=l("[data-reward-form]",i);n.contains(document.activeElement)||(n.cost.value=d.cost,n.cooldown.value=d.cooldown,n.enabled.checked=d.enabled),l("[data-reward-state]",i).textContent=d.error?`· ⚠ ${d.error}`:d.reward_id?"· ✓ bei Twitch angelegt":"· noch nicht bei Twitch"};return k(l("[data-reward-form]",i),async d=>{const n=await r.api.rewards.set(t,{cost:Number(d.cost.value),cooldown:Number(d.cooldown.value),enabled:d.enabled.checked});c(n);try{await r.api.rewards.sync(t),m("Bei Twitch übernommen.","ok")}catch(e){m(`Gespeichert, aber nicht bei Twitch: ${r.ctx.germanError(e)}`,"error",8e3)}c((await r.api.rewards.list().catch(()=>[])).find(e=>e.key===t))}),async()=>{i.hidden=!b(),i.hidden||c((await r.api.rewards.list().catch(()=>[])).find(d=>d.key===t))}}export const tts={kind:"tts",icon:"🔊",cta:"Zum Vorlesen →",on:!1,error:"",settings:null,state:null,messages:[],subscribed:!1,dialog:null,paintReward:null,setup(){this.dialog=x({id:"x-tts",cls:"x-tts",eyebrow:"Kanalpunkte · im Stream vorgelesen",title:"Vorlesen lassen",body:`
      <div class="x-layout">
        <div class="x-main">
          <div class="x-hero tt-hero">
            <b>So geht’s</b>
            <ol class="tt-steps">
              <li>Im Twitch-Chat auf die Kanalpunkte klicken.</li>
              <li><b>„🔊 Nachricht vorlesen“</b> einlösen und die Nachricht eintippen.</li>
              <li>Andere Stimme? Schreib sie an den Anfang, z. B. <code>oma: Hallo Kinder!</code></li>
            </ol>
            <p class="form-hint" data-rules></p>
          </div>
          <h3 class="prank-h3">Stimmen zum Anhören</h3>
          <div class="tt-voices" data-voices></div>
          <p class="form-hint" data-no-tts hidden>Dein Browser kann nicht vorlesen – im Stream klappt es trotzdem.</p>
        </div>
        <div class="x-side" data-admin hidden>
          <section class="bingo-box">
            <h3 class="prank-h3">Warten auf Freigabe <small data-pending-count></small></h3>
            <ul class="x-list" data-pending></ul>
            <div class="x-row">
              <button class="btn btn--ghost btn--sm" type="button" data-skip>⏭ Aktuelle abbrechen</button>
              <label class="toggle"><input type="checkbox" data-mute><span class="toggle-ui" aria-hidden="true"></span>Stumm (Overlay liest nichts)</label>
            </div>
            <button class="btn btn--ghost btn--sm" type="button" data-simulate hidden>🧪 Probe-Einlösung (Demo)</button>
          </section>
          <section class="bingo-box">
            <h3 class="prank-h3">Selbst vorlesen lassen</h3>
            <form class="x-form" data-web>
              <label class="field"><span>Text</span><input type="text" name="text" maxlength="500" required></label>
              <div class="x-inline">
                <select name="voice" aria-label="Stimme">${w.map(t=>`<option value="${t.id}">${t.name}</option>`).join("")}</select>
                <button class="btn btn--primary btn--sm" type="submit">🔊 Im Stream vorlesen</button>
              </div>
            </form>
          </section>
          <section class="bingo-box">
            <h3 class="prank-h3">Zuletzt</h3>
            <ul class="x-list x-list--compact" data-recent></ul>
          </section>
          <section class="bingo-box">
            <h3 class="prank-h3">Regeln</h3>
            <form class="x-form" data-settings>
              <label class="toggle"><input type="checkbox" name="approval"><span class="toggle-ui" aria-hidden="true"></span>Erst nach Freigabe vorlesen</label>
              <label class="field"><span>Höchstens Zeichen</span><input type="number" name="max" min="20" max="500"></label>
              <label class="field"><span>Gesperrte Wörter (eins pro Zeile)</span><textarea name="blocked" rows="4" maxlength="4000"></textarea></label>
              <p class="form-hint">Links werden nie vorgelesen. Abgelehnte Nachrichten bekommen ihre Kanalpunkte zurück.</p>
              <button class="btn btn--outline btn--sm" type="submit">Speichern</button>
            </form>
          </section>
          ${P("tts")}
        </div>
      </div>`});const a=this.dialog;l("[data-voices]",a).replaceChildren(...w.map(t=>s("button",{class:"btn btn--ghost btn--sm",type:"button",onclick:()=>{K(),S(`Hallo, ich bin die Stimme ${t.name}.`,t.id)}},`▶ ${t.name}`))),l("[data-no-tts]",a).hidden=A(),l("[data-skip]",a).addEventListener("click",t=>h(t.currentTarget,async()=>{this.state=await r.api.tts.skip()},"Abgebrochen.")),l("[data-mute]",a).addEventListener("change",t=>h(null,async()=>{this.state=await r.api.tts.skip(t.target.checked)})),l("[data-simulate]",a).addEventListener("click",()=>r.api.tts.simulate?.("NightOwl_Mia","Hallo zusammen, das ist eine Probe!","oma").then(()=>this.reload())),k(l("[data-web]",a),async t=>{await r.api.tts.web(t.text.value,t.voice.value),t.text.value="",m("Wird im Stream vorgelesen.","ok"),this.reload()}),k(l("[data-settings]",a),async t=>{this.settings=await r.api.tts.save({approval:t.approval.checked,max:Number(t.max.value),blocked:t.blocked.value.split(`
`)}),m("Gespeichert.","ok"),this.render()}),E(a,"tts").then(t=>{this.paintReward=t})},async load(){try{this.state=await r.api.tts.state(),this.on=!!this.state,b()&&([this.settings,this.messages]=await Promise.all([r.api.tts.settings(),r.api.tts.messages()]))}catch(a){Object.assign(this,{on:!1,error:a.message})}this.on&&!this.subscribed&&b()&&(this.subscribed=!0,r.api.on("tts_messages",()=>this.reload())),v(this)},async reload(){b()&&(this.messages=await r.api.tts.messages().catch(()=>this.messages),v(this),this.dialog.open&&this.render())},render(){const a=this.dialog;T(a,this);const t=b()&&this.on;if(l("[data-admin]",a).hidden=!t,a.classList.toggle("has-side",t),l("[data-rules]",a).textContent=`Stimmen: ${w.map(e=>e.name).join(", ")}. Keine Links, keine Beleidigungen – sonst gibt es die Punkte zurück und nichts wird vorgelesen.`,!t)return;l("[data-simulate]",a).hidden=!r.api.demo,l("[data-mute]",a).checked=!!this.state?.muted;const i=this.messages.filter(e=>e.status==="pending");l("[data-pending-count]",a).textContent=i.length?`· ${i.length}`:"";const c=e=>w.find(o=>o.id===e)?.name??e;p(l("[data-pending]",a),i,e=>s("li",{class:"x-item tt-msg"},s("span",{class:"x-item-main"},s("b",{},`${e.who} · ${c(e.voice)}`),s("span",{class:"tt-text"},e.text)),s("span",{class:"x-item-actions"},s("button",{class:"btn btn--ghost btn--sm",type:"button",title:"Hier anhören",onclick:()=>{K(),S(e.text,e.voice)}},"👂"),s("button",{class:"btn btn--primary btn--sm",type:"button",onclick:o=>h(o.currentTarget,async()=>{await r.api.tts.review(e.id,"approve"),this.reload()})},"✅"),s("button",{class:"btn btn--ghost btn--sm",type:"button",onclick:o=>h(o.currentTarget,async()=>{await r.api.tts.review(e.id,"reject"),this.reload()})},"❌"))),"Nichts wartet.");const d=this.messages.filter(e=>e.status!=="pending").slice(0,10);p(l("[data-recent]",a),d,e=>s("li",{class:"x-item"},s("span",{class:"x-item-main"},s("b",{},`${e.status==="approved"?"🔊":"🚫"} ${e.who}`),s("small",{class:"tt-text"},e.text)),e.status==="approved"?s("button",{class:"btn btn--ghost btn--sm",type:"button",title:"Nochmal vorlesen",onclick:o=>h(o.currentTarget,async()=>{await r.api.tts.review(e.id,"replay")})},"🔁"):null),"Noch nichts vorgelesen.");const n=l("[data-settings]",a);this.settings&&!n.contains(document.activeElement)&&(n.approval.checked=this.settings.need_approval,n.max.value=this.settings.max_chars,n.blocked.value=(this.settings.blocked_words??[]).join(`
`)),this.paintReward?.()},tileStatus(){const a=b()?this.messages.filter(t=>t.status==="pending").length:0;return a?`📝 ${a} warten auf Freigabe`:"🔊 Deine Nachricht im Stream"},async open(){$(this)&&(this.render(),await this.load(),this.render())}},cards={kind:"cards",icon:"🃏",cta:"Zu den Karten →",on:!1,error:"",defs:[],me:null,settings:null,board:[],trades:[],view:null,tab:"packs",editing:null,subscribed:!1,dialog:null,paintReward:null,setup(){this.dialog=x({id:"x-cards",cls:"x-cards",eyebrow:"Jeden Tag ein Gratis-Pack · Packs auch per Kanalpunkte",title:"Sammelkarten",body:`
      <div class="cd-tabs" role="tablist">
        <button type="button" role="tab" data-tab="packs">📦 Packs</button>
        <button type="button" role="tab" data-tab="collection">📖 Sammlung</button>
        <button type="button" role="tab" data-tab="board">🏆 Rangliste</button>
        <button type="button" role="tab" data-tab="trades">🔁 Tauschen <span data-trade-badge></span></button>
        <button type="button" role="tab" data-tab="admin" hidden>⚙️ Karten</button>
      </div>
      <div class="cd-pane" data-pane="packs">
        <div class="cd-packs">
          <button class="btn btn--primary btn--lg" type="button" data-daily>🎁 Gratis-Pack für heute holen</button>
          <p class="form-hint" data-daily-hint></p>
          <button class="btn btn--ghost btn--sm" type="button" data-grant hidden>🧪 Pack wie per Kanalpunkte (Demo)</button>
          <ul class="cd-pack-list" data-packs></ul>
        </div>
        <div class="cd-reveal" data-reveal hidden></div>
      </div>
      <div class="cd-pane" data-pane="collection" hidden>
        <p class="cd-progress" data-progress></p>
        <div class="cd-grid" data-collection></div>
      </div>
      <div class="cd-pane" data-pane="board" hidden>
        <ol class="x-rank cd-board" data-board></ol>
        <div class="cd-view" data-view hidden>
          <h3 class="prank-h3" data-view-title></h3>
          <p class="form-hint">Karte anklicken, die du haben möchtest – dann wählst du, was du dafür gibst.</p>
          <div class="cd-grid cd-grid--small" data-view-grid></div>
        </div>
      </div>
      <div class="cd-pane" data-pane="trades" hidden>
        <h3 class="prank-h3">An dich</h3>
        <ul class="x-list" data-incoming></ul>
        <h3 class="prank-h3">Von dir</h3>
        <ul class="x-list" data-outgoing></ul>
      </div>
      <div class="cd-pane" data-pane="admin" hidden>
        <div class="x-layout has-side-fixed">
          <div class="x-main">
            <ul class="x-list cd-admin-list" data-defs></ul>
          </div>
          <div class="x-side">
            <section class="bingo-box">
              <h3 class="prank-h3" data-edit-title>Neue Karte</h3>
              <form class="x-form" data-card-form>
                <label class="field"><span>Name</span><input type="text" name="name" maxlength="40" required></label>
                <div class="x-grid2">
                  <label class="field"><span>Seltenheit</span><select name="rarity">${u.map(t=>`<option value="${t}">${f[t]}</option>`).join("")}</select></label>
                  <label class="field"><span>Emoji</span><input type="text" name="emoji" maxlength="8" placeholder="🃏"></label>
                </div>
                <label class="field"><span>Text</span><input type="text" name="description" maxlength="120"></label>
                <label class="field"><span>Bild (optional, statt Emoji)</span><input type="file" name="image" accept="image/png,image/jpeg,image/webp,image/gif"></label>
                <label class="toggle"><input type="checkbox" name="active" checked><span class="toggle-ui" aria-hidden="true"></span>Kann gezogen werden</label>
                <div class="x-row">
                  <button class="btn btn--outline btn--sm" type="submit">Speichern</button>
                  <button class="btn btn--ghost btn--sm" type="button" data-edit-cancel hidden>Abbrechen</button>
                </div>
              </form>
            </section>
            <section class="bingo-box">
              <h3 class="prank-h3">Packs</h3>
              <form class="x-form" data-settings>
                <div class="x-grid2">
                  <label class="field"><span>Karten pro Pack</span><input type="number" name="size" min="1" max="10"></label>
                  <label class="toggle"><input type="checkbox" name="daily"><span class="toggle-ui" aria-hidden="true"></span>Gratis-Pack jeden Tag</label>
                </div>
                <p class="form-hint">Wie oft kommt welche Seltenheit? (Gewichte)</p>
                <div class="cd-weights">${u.map((t,i)=>`<label class="field"><span>${f[t]}</span><input type="number" name="w${i}" min="0" max="1000"></label>`).join("")}</div>
                <button class="btn btn--outline btn--sm" type="submit">Speichern</button>
              </form>
            </section>
            ${P("cards")}
          </div>
        </div>
      </div>`});const a=this.dialog;y(".cd-tabs [data-tab]",a).forEach(t=>t.addEventListener("click",()=>{this.tab=t.dataset.tab,this.render()})),l("[data-daily]",a).addEventListener("click",t=>h(t.currentTarget,async()=>{const i=await r.api.cards.claimDaily();await this.loadMe(),await this.openPack(i)})),l("[data-grant]",a).addEventListener("click",()=>r.api.cards.grant?.().then(()=>this.loadMe()).then(()=>this.render())),k(l("[data-card-form]",a),async t=>{let i=this.editing?.image_path??null;const c=t.image.files[0];c&&(i=await r.api.cards.upload(await N(c,320))),await r.api.cards.save({id:this.editing?.id,name:t.name.value,rarity:t.rarity.value,emoji:t.emoji.value,image:i,description:t.description.value,active:t.active.checked}),m("Karte gespeichert.","ok"),this.edit(null),this.defs=await r.api.cards.defs(),this.render()}),l("[data-edit-cancel]",a).addEventListener("click",()=>this.edit(null)),k(l("[data-settings]",a),async t=>{this.settings=await r.api.cards.saveSettings({size:Number(t.size.value),daily:t.daily.checked,weights:u.map((i,c)=>Number(t[`w${c}`].value))}),m("Gespeichert.","ok")}),E(a,"cards").then(t=>{this.paintReward=t})},async load(){try{this.defs=await r.api.cards.defs(),this.on=!0,await Promise.all([r.ctx.state.user?this.loadMe():null,r.api.cards.settings().then(a=>{this.settings=a}).catch(()=>{})])}catch(a){Object.assign(this,{on:!1,error:a.message})}this.on&&!this.subscribed&&r.ctx.state.user&&(this.subscribed=!0,r.api.on("card_trades",()=>this.loadTrades().then(()=>this.dialog.open&&this.render()))),v(this)},async loadMe(){this.me=await r.api.cards.me().catch(()=>null),await this.loadTrades(),v(this)},async loadTrades(){this.trades=await r.api.cards.trades().catch(()=>[])},def(a){return this.defs.find(t=>t.id===a)},cardEl(a,{count:t=0,known:i=!0,isNew:c=!1,small:d=!1,onclick:n=null}={}){const e=a.image_path?s("img",{src:r.api.cards.imageUrl(a.image_path),alt:"",loading:"lazy"}):s("span",{class:"xc-emoji"},a.emoji);return s(n?"button":"div",{class:`xcard r-${a.rarity}${i?"":" is-unknown"}${d?" is-small":""}`,type:n?"button":null,onclick:n,title:i?`${a.name} · ${f[a.rarity]}`:"???"},s("span",{class:"xc-art"},i?e:s("span",{class:"xc-emoji"},"❔")),s("b",{class:"xc-name"},i?a.name:"???"),s("small",{class:"xc-rarity"},f[a.rarity]),t>1?s("span",{class:"xc-count"},`×${t}`):null,c?s("span",{class:"xc-new"},"NEU"):null)},async openPack(a){const t=this.dialog,i=await r.api.cards.open(a),c=l("[data-reveal]",t);c.hidden=!1;const d=i.map(e=>{const o=s("div",{class:"xc-back"},"🃏"),g=this.cardEl(e,{isNew:e.new});return s("div",{class:`cd-flip r-${e.rarity}`},s("div",{class:"cd-flip-inner"},o,g))});c.replaceChildren(s("p",{class:"cd-reveal-title"},"Klick auf die Karten!"),s("div",{class:"cd-reveal-row"},d),s("button",{class:"btn btn--ghost btn--sm",type:"button",onclick:()=>{c.hidden=!0,this.render()}},"Fertig")),d.forEach((e,o)=>{const g=()=>e.classList.add("is-open");e.addEventListener("click",g),setTimeout(g,900+o*700)}),await this.loadMe(),this.renderPacks();const n=i.find(e=>e.rarity==="legendary")??i.find(e=>e.rarity==="epic");n&&setTimeout(()=>m(`✨ ${f[n.rarity]}: ${n.name}!`,"ok"),900+i.indexOf(n)*700)},edit(a){this.editing=a;const t=l("[data-card-form]",this.dialog);t.reset(),a&&(t.name.value=a.name,t.rarity.value=a.rarity,t.emoji.value=a.emoji,t.description.value=a.description??"",t.active.checked=a.active,t.name.focus()),l("[data-edit-title]",this.dialog).textContent=a?`„${a.name}“ bearbeiten`:"Neue Karte",l("[data-edit-cancel]",this.dialog).hidden=!a},ownedMap(){return new Map((this.me?.owned??[]).map(a=>[a.card_id,a.count]))},renderPacks(){const a=this.dialog,t=this.me,i=l("[data-daily]",a);i.disabled=!t?.daily,l("[data-daily-hint]",a).textContent=r.ctx.state.user?t?.daily?"Einmal pro Tag gratis – hol es dir!":"Dein Gratis-Pack für heute hast du schon. Morgen gibt es ein neues.":"Zum Sammeln anmelden.",l("[data-grant]",a).hidden=!r.api.demo;const c={daily:"🎁 Gratis-Pack",twitch:"💜 Kanalpunkte",admin:"🎉 Geschenk"};p(l("[data-packs]",a),t?.packs??[],d=>s("li",{class:"cd-pack"},s("span",{class:"cd-pack-art"},"📦"),s("span",{},s("b",{},c[d.source]??"Pack"),s("small",{},_(d.created_at))),s("button",{class:"btn btn--primary btn--sm",type:"button",onclick:n=>h(n.currentTarget,()=>this.openPack(d.id))},"Öffnen")),"Keine ungeöffneten Packs. Per Kanalpunkte im Twitch-Chat gibt es mehr (mit Twitch anmelden, damit sie hier ankommen).")},render(){const a=this.dialog;T(a,this);const t=b()&&this.on;l('.cd-tabs [data-tab="admin"]',a).hidden=!t,this.tab==="admin"&&!t&&(this.tab="packs"),y(".cd-tabs [data-tab]",a).forEach(d=>d.setAttribute("aria-selected",String(d.dataset.tab===this.tab))),y(".cd-pane",a).forEach(d=>{d.hidden=d.dataset.pane!==this.tab||!this.on});const i=this.trades.filter(d=>d.to_key===this.me?.key);if(l("[data-trade-badge]",a).textContent=i.length?`(${i.length})`:"",!this.on)return;const c=this.ownedMap();if(this.tab==="packs"&&this.renderPacks(),this.tab==="collection"){const d=[...this.defs].sort((n,e)=>u.indexOf(n.rarity)-u.indexOf(e.rarity));l("[data-progress]",a).textContent=`${c.size} von ${this.defs.length} Karten · ${[...c.values()].reduce((n,e)=>n+e,0)} insgesamt`,l("[data-collection]",a).replaceChildren(...d.map(n=>this.cardEl(n,{count:c.get(n.id)??0,known:c.has(n.id)})))}this.tab==="board"&&this.renderBoard(),this.tab==="trades"&&this.renderTrades(),this.tab==="admin"&&this.renderAdmin()},async renderBoard(){const a=this.dialog;this.board=await r.api.cards.leaderboard().catch(()=>[]),p(l("[data-board]",a),this.board,t=>s("li",{},s("button",{class:"cd-board-btn",type:"button",onclick:()=>this.showPlayer(t)},s("b",{},t.name||"Anonym"),s("span",{},`${t.uniq} / ${this.defs.length} · ${t.total} Karten`))),"Noch sammelt niemand.")},async showPlayer(a){const t=this.dialog,i=l("[data-view]",t);i.hidden=!1,l("[data-view-title]",t).textContent=`Sammlung von ${a.name||"Anonym"}`;const c=await r.api.cards.collection(a.player_key),d=this.ownedMap();l("[data-view-grid]",t).replaceChildren(...c.map(n=>{const e=this.def(n.card_id);return e?this.cardEl(e,{count:n.count,small:!0,onclick:a.player_key===this.me?.key?null:()=>this.offer(a,e,d)}):null}).filter(Boolean)),i.scrollIntoView({behavior:"smooth",block:"nearest"})},offer(a,t,i){const c=this.dialog,d=[...i].map(([e,o])=>({c:this.def(e),count:o})).filter(e=>e.c);if(!d.length){m("Du hast noch keine Karten zum Tauschen.","info");return}l("[data-view-grid]",c).replaceChildren(s("p",{class:"cd-offer-title"},`Du möchtest „${t.name}“. Welche Karte gibst du dafür?`),...d.map(({c:e,count:o})=>this.cardEl(e,{count:o,small:!0,onclick:g=>h(g.currentTarget,async()=>{await r.api.cards.offer(a.player_key,e.id,t.id),m("Angebot geschickt! Sobald es angenommen wird, tauscht ihr.","ok"),await this.loadTrades(),this.showPlayer(a)})})),s("button",{class:"btn btn--ghost btn--sm",type:"button",onclick:()=>this.showPlayer(a)},"Zurück"))},renderTrades(){const a=this.dialog,t=n=>this.def(n)?.name??"?",i=this.trades.filter(n=>n.to_key===this.me?.key),c=this.trades.filter(n=>n.from_key===this.me?.key),d=async()=>{await this.loadMe(),this.render()};p(l("[data-incoming]",a),i,n=>s("li",{class:"x-item"},s("span",{class:"x-item-main"},s("b",{},`${n.from_name||"Jemand"} bietet „${t(n.give_card)}“`),s("small",{},`für deine „${t(n.want_card)}“`)),s("span",{class:"x-item-actions"},s("button",{class:"btn btn--primary btn--sm",type:"button",onclick:e=>h(e.currentTarget,async()=>{const o=await r.api.cards.answer(n.id,!0);m(o.status==="accepted"?"Getauscht!":"Geht nicht mehr – eine der Karten ist weg.",o.status==="accepted"?"ok":"info"),await d()})},"✅ Tauschen"),s("button",{class:"btn btn--ghost btn--sm",type:"button",onclick:e=>h(e.currentTarget,async()=>{await r.api.cards.answer(n.id,!1),await d()})},"❌"))),"Keine Angebote an dich."),p(l("[data-outgoing]",a),c,n=>s("li",{class:"x-item"},s("span",{class:"x-item-main"},s("b",{},`„${t(n.give_card)}“ gegen „${t(n.want_card)}“`),s("small",{},`an ${n.to_name||"jemand"} · wartet`)),s("button",{class:"btn btn--ghost btn--sm",type:"button",onclick:e=>h(e.currentTarget,async()=>{await r.api.cards.answer(n.id,!1),await d()})},"Zurückziehen")),"Keine offenen Angebote. Tauschen geht über die Rangliste: Namen anklicken.")},renderAdmin(){const a=this.dialog;p(l("[data-defs]",a),[...this.defs].sort((i,c)=>u.indexOf(i.rarity)-u.indexOf(c.rarity)),i=>s("li",{class:`x-item${i.active?"":" is-off"}`},this.cardEl(i,{small:!0}),s("span",{class:"x-item-main"},s("b",{},i.name),s("small",{},`${f[i.rarity]}${i.active?"":" · wird nicht gezogen"}`)),s("span",{class:"x-item-actions"},s("button",{class:"btn btn--ghost btn--sm",type:"button",onclick:()=>this.edit(i)},"✏️"),s("button",{class:"btn btn--ghost btn--sm",type:"button",title:"Löschen",onclick:c=>{confirm(`„${i.name}“ löschen? Sie verschwindet aus allen Sammlungen. (Lieber „Kann gezogen werden“ ausschalten.)`)&&h(c.currentTarget,async()=>{await r.api.cards.remove(i),this.defs=this.defs.filter(d=>d.id!==i.id),this.render()})}},"🗑"))),"Noch keine Karten.");const t=l("[data-settings]",a);this.settings&&!t.contains(document.activeElement)&&(t.size.value=this.settings.pack_size,t.daily.checked=this.settings.daily,this.settings.weights.forEach((i,c)=>{t[`w${c}`].value=i})),this.paintReward?.()},tileStatus(){if(!this.on)return"🃏 Sammle sie alle";const a=this.me?.packs?.length??0;if(a)return`📦 ${a} ${a===1?"Pack wartet":"Packs warten"}!`;if(this.me?.daily)return"🎁 Gratis-Pack abholen!";const t=this.ownedMap().size;return t?`🃏 ${t} / ${this.defs.length} gesammelt`:"🃏 Sammle sie alle"},async open(){$(this)&&(l("[data-reveal]",this.dialog).hidden=!0,l("[data-view]",this.dialog).hidden=!0,this.render(),await this.load(),(this.me?.packs?.length||this.me?.daily)&&(this.tab="packs"),this.render())}};
