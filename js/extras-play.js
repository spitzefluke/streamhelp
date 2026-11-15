import{$ as s,X as o,act as p,fill as y,h as i,isAdmin as f,makeDialog as q,onSubmit as w,onTick as T,openFeature as z,paintNote as $,paintTile as k,secondsUntil as S,timeOf as x,toast as v}from"./extras-core.js";const g=["A","B","C","D"];export const quiz={kind:"quiz",icon:"🧠",cta:"Zum Quiz →",on:!1,error:"",round:null,questions:[],scores:[],my:null,myScore:null,editing:null,subscribed:!1,dialog:null,setup(){this.dialog=q({id:"x-quiz",cls:"x-quiz",eyebrow:"Antwort im Chat mit !a !b !c !d – oder hier",title:"Quiz",body:`
      <div class="x-layout">
        <div class="x-main">
          <div class="x-hero qz-hero">
            <div class="qz-top"><span class="qz-cat" data-cat></span><span class="qz-time" data-time></span></div>
            <b class="qz-question" data-question>Gerade läuft keine Frage.</b>
            <div class="qz-bar" aria-hidden="true"><i data-bar></i></div>
            <div class="qz-answers" data-answers></div>
            <p class="qz-info" data-info aria-live="polite"></p>
          </div>
          <p class="form-hint" data-me></p>
          <h3 class="prank-h3">Rangliste</h3>
          <ol class="x-rank" data-scores></ol>
        </div>
        <div class="x-side" data-admin hidden>
          <section class="bingo-box">
            <h3 class="prank-h3">Steuern</h3>
            <div class="x-inline">
              <select name="seconds" data-seconds aria-label="Zeit zum Antworten">
                <option value="15">15 Sekunden</option><option value="30" selected>30 Sekunden</option>
                <option value="45">45 Sekunden</option><option value="60">1 Minute</option><option value="120">2 Minuten</option>
              </select>
              <button class="btn btn--primary btn--sm" type="button" data-next>🎲 Nächste Frage</button>
            </div>
            <div class="x-row">
              <button class="btn btn--outline btn--sm" type="button" data-reveal>✅ Auflösen</button>
              <button class="btn btn--ghost btn--sm" type="button" data-hide>🙈 Ausblenden</button>
              <button class="btn btn--ghost btn--sm" type="button" data-reset>🗑 Rangliste leeren</button>
            </div>
          </section>
          <section class="bingo-box">
            <h3 class="prank-h3">Fragen <small data-qcount></small></h3>
            <form class="x-form qz-edit" data-edit>
              <label class="field"><span>Frage</span><input type="text" name="question" maxlength="200" required></label>
              <div class="qz-edit-answers">
                ${g.map((a,e)=>`<label class="qz-edit-answer"><input type="radio" name="correct" value="${e}" ${e===0?"checked":""} aria-label="${a} ist richtig"><input type="text" name="a${e}" maxlength="80" placeholder="Antwort ${a}${e>1?" (optional)":""}"></label>`).join("")}
              </div>
              <p class="form-hint">Den Punkt vor die richtige Antwort setzen.</p>
              <label class="field"><span>Thema</span><input type="text" name="category" maxlength="30" placeholder="Fortnite"></label>
              <div class="x-row">
                <button class="btn btn--outline btn--sm" type="submit" data-save>Frage speichern</button>
                <button class="btn btn--ghost btn--sm" type="button" data-cancel hidden>Abbrechen</button>
              </div>
            </form>
            <ul class="x-list qz-list" data-questions></ul>
          </section>
        </div>
      </div>`});const t=this.dialog;s("[data-next]",t).addEventListener("click",a=>p(a.currentTarget,async()=>this.apply(await o.api.quiz.start(null,Number(s("[data-seconds]",t).value))))),s("[data-reveal]",t).addEventListener("click",a=>p(a.currentTarget,async()=>{this.apply(await o.api.quiz.reveal()),this.loadScores()})),s("[data-hide]",t).addEventListener("click",a=>p(a.currentTarget,async()=>this.apply(await o.api.quiz.hide()))),s("[data-reset]",t).addEventListener("click",a=>{confirm("Rangliste wirklich leeren? Alle Punkte gehen auf 0.")&&p(a.currentTarget,async()=>{await o.api.quiz.resetScores(),await this.loadScores()},"Rangliste geleert.")}),s("[data-cancel]",t).addEventListener("click",()=>this.edit(null)),w(s("[data-edit]",t),async a=>{const e=g.map((c,l)=>a[`a${l}`].value),r=Number(a.correct.value),b=e.map((c,l)=>({a:c.trim(),i:l})).filter(c=>c.a),h=b.findIndex(c=>c.i===r);if(h<0)throw new Error("Die als richtig markierte Antwort ist leer.");await o.api.quiz.saveQuestion({id:this.editing?.id,question:a.question.value,answers:b.map(c=>c.a),correct:h,category:a.category.value}),v("Frage gespeichert.","ok"),this.edit(null),this.questions=await o.api.quiz.questions(),this.render()}),T(()=>{this.dialog.open&&this.round?.status==="open"&&this.paintTime()})},async load(){try{this.round=await o.api.quiz.round(),this.on=!!this.round;const[t,a]=await Promise.all([o.api.quiz.myAnswer().catch(()=>null),o.api.quiz.myScore().catch(()=>null),this.loadScores(),f()?o.api.quiz.questions().then(e=>{this.questions=e}).catch(()=>{}):null]);Object.assign(this,{my:t,myScore:a})}catch(t){Object.assign(this,{on:!1,error:t.message})}this.on&&!this.subscribed&&(this.subscribed=!0,o.api.on("quiz_round",t=>this.apply(t))),k(this)},async loadScores(){this.scores=await o.api.quiz.scores().catch(()=>[]),this.myScore=await o.api.quiz.myScore().catch(()=>null),this.dialog.open&&this.render()},apply(t){if(!t)return;const a=this.round;this.round=t,a?.n!==t.n&&(this.my=null),a?.status!=="revealed"&&t.status==="revealed"&&this.loadScores(),k(this),this.dialog.open&&this.render()},edit(t){this.editing=t;const a=s("[data-edit]",this.dialog);a.reset(),t&&(a.question.value=t.question,t.answers.forEach((e,r)=>{a[`a${r}`].value=e}),a.correct.value=String(t.correct),a.category.value=t.category,a.question.focus()),s("[data-save]",this.dialog).textContent=t?"Änderung speichern":"Frage speichern",s("[data-cancel]",this.dialog).hidden=!t},paintTime(){const t=this.round,a=this.dialog,e=t?.status==="open"?S(t.closes_at):0;s("[data-time]",a).textContent=t?.status==="open"?e?`⏱ ${e} s`:"⏱ Zeit um":t?.status==="revealed"?"Aufgelöst":"",s("[data-bar]",a).style.width=t?.status==="open"?`${e/t.seconds*100}%`:"0%",t?.status==="open"&&!e&&this.dialog.querySelectorAll(".qz-answer").forEach(r=>{r.disabled=!0})},render(){const t=this.dialog;$(t,this);const a=f()&&this.on;s("[data-admin]",t).hidden=!a,t.classList.toggle("has-side",a);const e=this.round,r=e&&e.status!=="idle";s("[data-cat]",t).textContent=r?e.category:"",s("[data-question]",t).textContent=r?e.question:"Gerade läuft keine Frage.";const b=Math.max(1,e?.answered??0),h=e?.status==="open"&&S(e.closes_at)>0;s("[data-answers]",t).replaceChildren(...r?e.answers.map((l,d)=>{const u=i("button",{class:`qz-answer${e.correct===d?" is-right":""}${e.status==="revealed"&&this.my===d&&e.correct!==d?" is-wrong":""}${this.my===d?" is-mine":""}`,type:"button",disabled:!h||this.my!==null,onclick:n=>p(n.currentTarget,async()=>{await o.api.quiz.answer(d),this.my=d,this.render(),v(`Deine Antwort: ${g[d]}`,"ok")})},i("b",{},g[d]),i("span",{},l));return e.status==="revealed"&&u.append(i("small",{class:"qz-pct"},`${Math.round(e.counts[d]/b*100)} %`)),u}):[]),this.paintTime(),s("[data-info]",t).textContent=r?e.status==="revealed"?`Richtig war ${g[e.correct]}. ${e.winners?.length?`Am schnellsten: ${e.winners.map(l=>l.name).join(", ")}`:"Niemand lag richtig."}`:`${e.answered} ${e.answered===1?"Antwort":"Antworten"} bisher.${this.my!==null?` Du hast ${g[this.my]} gewählt.`:""}`:"Sobald der Streamer eine Frage stellt, erscheint sie hier und im Stream.";const c=this.myScore;s("[data-me]",t).textContent=c?`Du: ${c.points} Punkte · ${c.correct} von ${c.answered} richtig · Platz ${c.rank}`:"Richtig = 10 Punkte, wer schnell ist, bekommt bis zu 5 extra.",y(s("[data-scores]",t),this.scores.slice(0,10),l=>i("li",{},i("b",{},l.name||"Anonym"),i("span",{},`${l.points} P · ${l.correct}/${l.answered}`)),"Noch keine Punkte."),a&&(s("[data-reveal]",t).disabled=e.status!=="open",s("[data-hide]",t).disabled=e.status==="idle",s("[data-qcount]",t).textContent=`· ${this.questions.length}`,y(s("[data-questions]",t),this.questions,l=>i("li",{class:"x-item"},i("span",{class:"x-item-main"},i("b",{},l.question),i("small",{},`${l.category} · richtig: ${g[l.correct]}) ${l.answers[l.correct]}${l.used_at?` · zuletzt ${x(l.used_at)}`:""}`)),i("span",{class:"x-item-actions"},i("button",{class:"btn btn--ghost btn--sm",type:"button",title:"Jetzt stellen",onclick:d=>p(d.currentTarget,async()=>this.apply(await o.api.quiz.start(l.id,Number(s("[data-seconds]",t).value))))},"▶"),i("button",{class:"btn btn--ghost btn--sm",type:"button",title:"Bearbeiten",onclick:()=>this.edit(l)},"✏️"),i("button",{class:"btn btn--ghost btn--sm",type:"button",title:"Löschen",onclick:d=>{confirm("Diese Frage löschen?")&&p(d.currentTarget,async()=>{await o.api.quiz.deleteQuestion(l.id),this.questions=this.questions.filter(u=>u.id!==l.id),this.render()})}},"🗑"))),"Noch keine Fragen."))},tileStatus(){const t=this.round;return!this.on||!t?"🧠 Teste dein Wissen":t.status==="open"?"🔴 Frage läuft – jetzt antworten!":t.status==="revealed"?"✅ Aufgelöst":"🧠 Teste dein Wissen"},async open(){z(this)&&(this.render(),await this.load(),this.render())}},queue={kind:"queue",icon:"🎮",cta:"Anstellen →",on:!1,error:"",settings:null,entries:[],me:null,admin:[],subscribed:!1,dialog:null,setup(){this.dialog=q({id:"x-queue",cls:"x-queue",eyebrow:"!join EpicName im Chat – oder hier",title:"Mitspielen",body:`
      <div class="x-layout">
        <div class="x-main">
          <div class="x-hero qu-hero">
            <span class="qu-open" data-open></span>
            <span class="qu-note" data-note-text></span>
          </div>
          <section class="bingo-box" data-mine>
            <h3 class="prank-h3">Du</h3>
            <p class="qu-me" data-me aria-live="polite"></p>
            <form class="x-inline" data-join>
              <input type="text" name="epic" maxlength="32" placeholder="Dein Epic-Name" aria-label="Dein Epic-Name" autocomplete="off">
              <button class="btn btn--primary btn--sm" type="submit">Anstellen</button>
            </form>
            <button class="btn btn--ghost btn--sm" type="button" data-leave hidden>Raus aus der Schlange</button>
            <p class="form-hint">Den Epic-Namen sehen nur der Streamer und die Mods.</p>
          </section>
          <h3 class="prank-h3">🎮 Gerade dran</h3>
          <ul class="x-list qu-list" data-picked></ul>
          <h3 class="prank-h3">⏳ Warteschlange <small data-count></small></h3>
          <ol class="x-list qu-list" data-waiting></ol>
        </div>
        <div class="x-side" data-admin hidden>
          <section class="bingo-box">
            <h3 class="prank-h3">Steuern</h3>
            <div class="x-row">
              <button class="btn btn--primary btn--sm" type="button" data-pick>🎲 Nächste ziehen</button>
              <button class="btn btn--ghost btn--sm" type="button" data-done-all>✔ Alle Dran-Seienden fertig</button>
              <button class="btn btn--ghost btn--sm" type="button" data-clear>🗑 Schlange leeren</button>
            </div>
            <ul class="x-list qu-admin" data-admin-list></ul>
          </section>
          <section class="bingo-box">
            <h3 class="prank-h3">Einstellungen</h3>
            <form class="x-form" data-settings>
              <label class="toggle"><input type="checkbox" name="open"><span class="toggle-ui" aria-hidden="true"></span>Warteschlange offen</label>
              <label class="toggle"><input type="checkbox" name="sub"><span class="toggle-ui" aria-hidden="true"></span>Subs zuerst</label>
              <div class="x-grid2">
                <label class="field"><span>Ziehen</span><select name="mode"><option value="order">der Reihe nach</option><option value="random">per Zufall</option></select></label>
                <label class="field"><span>Pro Runde</span><input type="number" name="squad" min="1" max="20"></label>
                <label class="field"><span>Höchstens wartend</span><input type="number" name="max" min="1" max="500"></label>
              </div>
              <label class="field"><span>Hinweis (z. B. Server, Modus)</span><input type="text" name="note" maxlength="100" placeholder="EU-Server · Null Bauen"></label>
              <button class="btn btn--outline btn--sm" type="submit">Speichern</button>
            </form>
          </section>
        </div>
      </div>`});const t=this.dialog;w(s("[data-join]",t),async e=>{const r=await o.api.queue.join(e.epic.value);v(r?.position?`Du stehst auf Platz ${r.position}.`:"Du bist dabei!","ok"),await this.load(),this.render()}),s("[data-leave]",t).addEventListener("click",e=>p(e.currentTarget,async()=>{await o.api.queue.leave(),await this.load(),this.render()})),s("[data-pick]",t).addEventListener("click",e=>p(e.currentTarget,async()=>{const r=await o.api.queue.pick(null);v(`${r.picked} ${r.picked===1?"Person ist":"Leute sind"} dran – der Bot sagt im Chat Bescheid.`,"ok"),await this.load(),this.render()}));const a=(e,r,b=null)=>p(e,async()=>{await o.api.queue.update(r,b),await this.load(),this.render()});s("[data-done-all]",t).addEventListener("click",e=>a(e.currentTarget,"done_all")),s("[data-clear]",t).addEventListener("click",e=>{confirm("Alle aus der Warteschlange nehmen?")&&a(e.currentTarget,"clear")}),this.upd=a,w(s("[data-settings]",t),async e=>{this.settings=await o.api.queue.save({open:e.open.checked,sub:e.sub.checked,mode:e.mode.value,squad:Number(e.squad.value),max:Number(e.max.value),note:e.note.value}),v(this.settings.open?"Gespeichert – die Warteschlange ist offen.":"Gespeichert.","ok"),this.render(),k(this)})},async load(){try{const[t,a]=await Promise.all([o.api.queue.settings(),o.api.queue.entries()]);Object.assign(this,{settings:t,entries:a,on:!!t}),this.me=o.ctx.state.user?await o.api.queue.me().catch(()=>null):null,f()&&(this.admin=await o.api.queue.adminList().catch(()=>[]))}catch(t){Object.assign(this,{on:!1,error:t.message})}if(this.on&&!this.subscribed){this.subscribed=!0;let t=0;const a=()=>{clearTimeout(t),t=setTimeout(async()=>{await this.load(),this.dialog.open&&this.render()},300)};o.api.on("queue_entries",a),o.api.on("queue_settings",a)}k(this)},render(){const t=this.dialog;$(t,this);const a=f()&&this.on;s("[data-admin]",t).hidden=!a,t.classList.toggle("has-side",a);const e=this.settings;if(!e)return;s("[data-open]",t).textContent=e.open?"🟢 Die Warteschlange ist offen":"🔴 Gerade geschlossen",s("[data-note-text]",t).textContent=e.note;const r=this.me,b=r?.status==="waiting"||r?.status==="picked";s("[data-me]",t).textContent=r?.status==="picked"?"🎮 Du bist dran! Schau in deine Freundschaftsanfragen bei Epic.":r?.status==="waiting"?`⏳ Du stehst auf Platz ${r.position}.`:e.open?"Du stehst noch nicht an.":"Sobald die Schlange offen ist, kannst du dich hier anstellen.";const h=s("[data-join]",t);h.hidden=b,h.querySelector("button").disabled=!e.open,r?.epic&&!h.epic.value&&document.activeElement!==h.epic&&(h.epic.value=r.epic),s("[data-leave]",t).hidden=r?.status!=="waiting";const c=this.entries.filter(n=>n.status==="picked"),l=this.entries.filter(n=>n.status==="waiting").sort((n,m)=>(e.sub_priority&&m.is_sub)-(e.sub_priority&&n.is_sub)||Date.parse(n.joined_at)-Date.parse(m.joined_at)),d=n=>i("span",{},n.name,n.is_sub?i("span",{class:"qu-sub",title:"Abonnent"}," ⭐"):null);if(y(s("[data-picked]",t),c,n=>i("li",{class:"x-item"},d(n),i("small",{},n.picked_at?`seit ${x(n.picked_at)}`:"")),"Gerade spielt niemand mit."),s("[data-count]",t).textContent=`· ${l.length}`,y(s("[data-waiting]",t),l.slice(0,50),n=>i("li",{class:"x-item"},d(n),i("small",{},x(n.joined_at))),"Niemand wartet."),!a)return;const u=s("[data-settings]",t);u.contains(document.activeElement)||(u.open.checked=e.open,u.sub.checked=e.sub_priority,u.mode.value=e.mode,u.squad.value=e.squad_size,u.max.value=e.max_size,u.note.value=e.note),s("[data-pick]",t).textContent=`🎲 Nächste ${e.squad_size} ziehen`,s("[data-pick]",t).disabled=!l.length,s("[data-done-all]",t).disabled=!c.length,y(s("[data-admin-list]",t),this.admin,n=>i("li",{class:`x-item${n.status==="picked"?" is-picked":""}`},i("span",{class:"x-item-main"},i("b",{},`${n.status==="picked"?"🎮 ":`${n.place}. `}${n.name}${n.is_sub?" ⭐":""}`),i("small",{},"Epic: ",i("code",{},n.epic_name||"–"))),i("span",{class:"x-item-actions"},n.epic_name?i("button",{class:"btn btn--ghost btn--sm",type:"button",title:"Epic-Namen kopieren",onclick:()=>navigator.clipboard?.writeText(n.epic_name).then(()=>v("Kopiert.","ok"))},"📋"):null,n.status==="picked"?[i("button",{class:"btn btn--ghost btn--sm",type:"button",title:"Hat mitgespielt",onclick:m=>this.upd(m.currentTarget,"done",n.id)},"✔"),i("button",{class:"btn btn--ghost btn--sm",type:"button",title:"Zurück in die Schlange",onclick:m=>this.upd(m.currentTarget,"back",n.id)},"↩")]:null,i("button",{class:"btn btn--ghost btn--sm",type:"button",title:"Entfernen",onclick:m=>this.upd(m.currentTarget,"remove",n.id)},"✕"))),"Niemand in der Schlange.")},tileStatus(){if(!this.on||!this.settings)return"🎮 Spiel mit!";const t=this.entries.filter(a=>a.status==="waiting").length;return this.settings.open?`🟢 Offen · ${t} warten`:"🔴 Gerade geschlossen"},async open(){z(this)&&(this.render(),await this.load(),this.render())}};
