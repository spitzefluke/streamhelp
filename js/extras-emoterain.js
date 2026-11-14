// Emote-Regen: Kachel mit Erklärung. Das Overlay liest den Chat selbst mit (js/overlay-emoterain.js) –
// kein Bot nötig. Eigene Emotes aus dem Emote-Editor kommen aus core.channel_emotes (…_channel_emotes.sql). Eingeschaltet und eingestellt wird es im OBS-Editor (Ebene „Emote-Regen“).
// Kaufen (…_emote_rain_shop.sql): Streamer und Mods schalten hier die Kanalpunkte-Belohnung „🌧️ Emote-Regen“ und
// Bits im Twitch-Panel ein. Gekauft werden kann nur, solange ein Overlay mit der Ebene Emote-Regen läuft.
import { $, X, act, h, isAdmin, makeDialog, onSubmit, openFeature, paintTile, toast } from './extras-core.js';

const BITS = [['action_50', 50], ['action_100', 100], ['action_250', 250], ['action_500', 500]];

const DEMO_EMOTES = ['💜', '🎉', '😂', '🔥', '✨', '👑', '🐸', '💥'];

export const emoterain = {
  kind: 'emoterain', icon: '🌧️', cta: 'So geht’s →',
  on: true, dialog: null,

  setup() {
    this.dialog = makeDialog({
      id: 'x-emoterain', cls: 'x-emoterain', eyebrow: 'Chat · Overlay', title: 'Emote-Regen',
      body: `
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
              <label class="field"><span>Preis</span><select name="sku">${BITS.map(([v, n]) => `<option value="${v}">${n} Bits</option>`).join('')}</select></label>
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
      </div>`,
    });
    $('[data-rain]', this.dialog).addEventListener('click', () => this.rain());
    onSubmit($('[data-shop-form]', this.dialog), (form) => this.saveShop(form));
    $('[data-shop-test]', this.dialog).addEventListener('click', (e) => act(e.currentTarget, async () => {
      const r = await X.api.rainShop.test();
      if (r?.reason === 'cooldown') toast('Kurz warten – der letzte Probe-Regen läuft noch.', 'info');
      else toast(r?.live ? 'Probe-Regen ist unterwegs.' : 'Probe-Regen geschickt – im Moment läuft aber kein Overlay mit „Emote-Regen“.', r?.live ? 'ok' : 'info');
    }));
  },

  shop: null,

  async loadShop() {
    if (!isAdmin()) return;
    try {
      this.shop = await X.api.rainShop.get();
    } catch {
      this.shop = null; // Migration fehlt
    }
    this.paintShop();
  },

  paintShop() {
    const d = this.shop;
    const form = $('[data-shop-form]', this.dialog);
    $('[data-shop-note]', this.dialog).hidden = !!d;
    form.hidden = !d;
    $('[data-shop-live]', this.dialog).textContent = !d ? ''
      : d.live ? '🟢 Ein Overlay mit Emote-Regen läuft – kaufen geht.'
        : '⚪ Gerade läuft kein Overlay mit Emote-Regen – kaufen ist gesperrt.';
    if (!d) { $('[data-shop-state]', this.dialog).textContent = ''; return; }
    form.points.checked = !!d.points;
    form.cost.value = d.points_cost;
    form.cooldown.value = d.points_cooldown;
    form.bits.checked = !!d.bits;
    form.sku.value = d.bits_sku;
    $('[data-shop-state]', this.dialog).textContent = d.error ? `⚠️ Twitch: ${d.error}`
      : d.reward_id && d.points ? '✓ Belohnung ist auf Twitch angelegt.' : '';
  },

  async saveShop(form) {
    const next = await X.api.rainShop.set({
      points: form.points.checked, cost: Number(form.cost.value), cooldown: Number(form.cooldown.value),
      bits: form.bits.checked, sku: form.sku.value,
    });
    this.shop = next;
    // Kanalpunkte: Belohnung auf Twitch anlegen bzw. abgleichen (auch zum Ausschalten)
    if (next.points || next.reward_id) {
      if (!X.ctx.state.twitch?.connected) {
        toast('Gespeichert. Für Kanalpunkte zuerst Twitch verbinden.', 'info');
      } else {
        try {
          await X.api.rainShop.sync();
          this.shop = await X.api.rainShop.get();
          toast(next.points ? 'Gespeichert – die Belohnung ist auf Twitch.' : 'Gespeichert – die Belohnung ist auf Twitch aus.', 'ok');
        } catch (err) {
          this.shop = await X.api.rainShop.get().catch(() => next);
          toast(X.ctx.germanError(err), 'error');
        }
      }
    } else toast('Gespeichert.', 'ok');
    this.paintShop();
  },

  // Kleine Vorschau im Dialog (Emojis statt Twitch-Emotes)
  rain() {
    const sky = $('[data-sky]', this.dialog);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    for (let i = 0; i < 24; i++) {
      const drop = h('span', {
        class: 'er-preview-drop',
        style: { left: `${Math.random() * 94}%`, animationDelay: `${Math.random() * 1.4}s`, animationDuration: `${1.8 + Math.random() * 1.4}s` },
      }, DEMO_EMOTES[i % DEMO_EMOTES.length]);
      drop.addEventListener('animationend', () => drop.remove(), { once: true });
      sky.append(drop);
    }
  },

  async load() { paintTile(this); },

  render() {
    const admin = isAdmin();
    $('[data-admin]', this.dialog).hidden = !admin;
    this.dialog.classList.toggle('has-side', admin);
    $('[data-note]', this.dialog).hidden = true;
  },

  tileStatus() { return '🌧️ !regen im Chat'; },

  async open() {
    if (!openFeature(this)) return;
    this.render();
    this.rain();
    this.loadShop();
  },
};
