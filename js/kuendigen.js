// „Verträge hier kündigen“ (kuendigen.html, § 312k BGB) – ohne Anmeldung. Bis zum Start (js/launch.js: pro) bleibt
// das Formular gesperrt. Danach geht es an die Edge Function billing (action "cancel"): Sie speichert die Kündigung
// mit Eingangszeit, kündigt bei Stripe zum Laufzeitende (wenn die Angaben eindeutig passen) und bestätigt per E-Mail.
// Die Bestätigung erscheint zusätzlich hier zum Drucken oder Speichern.
import { PRO_BOOKABLE } from './pro.js';

const $ = (sel) => document.querySelector(sel);
const form = $('#kd-form');

document.querySelectorAll('[data-vor-start]').forEach((el) => { el.hidden = PRO_BOOKABLE; });

if (PRO_BOOKABLE) {
  form.querySelectorAll('fieldset, button[type=submit]').forEach((el) => { el.disabled = false; });
  const reason = form.elements.reason;
  const syncKind = () => {
    const extra = form.elements.kind.value === 'extraordinary';
    reason.required = extra;
    reason.closest('label').hidden = !extra;
  };
  form.addEventListener('change', syncKind);
  syncKind();
  form.addEventListener('submit', submit);
  $('#kd-print').addEventListener('click', () => window.print());
}

function fail(text) {
  const msg = $('#kd-msg');
  msg.textContent = text;
  msg.hidden = !text;
  if (text) msg.focus?.();
}

async function submit(e) {
  e.preventDefault();
  fail('');
  if (!form.reportValidity()) return;
  const f = form.elements;
  const body = {
    action: 'cancel', kind: f.kind.value, name: f.name.value, email: f.email.value, channel: f.channel.value,
    reason: f.reason.value, confirm_email: f.confirm_email.value, website2: f.website2.value,
  };
  const btn = form.querySelector('button[type=submit]');
  btn.disabled = true;
  btn.textContent = 'Wird gesendet …';
  try {
    const { createApi, germanError } = await import('./api.js');
    const api = await createApi();
    if (api.demo) throw new Error('Im Demo-Modus wird nichts gekündigt.');
    let res;
    try {
      res = await api.raw.invoke('billing', body);
    } catch (err) {
      throw new Error(germanError(err));
    }
    const when = new Date(res.received_at).toLocaleString('de-DE', { dateStyle: 'long', timeStyle: 'short' });
    $('#kd-done-lead').textContent = res.mailed
      ? `Eingegangen am ${when} Uhr. Die Bestätigung haben wir an ${body.confirm_email} geschickt – hier ist sie noch einmal:`
      : `Eingegangen am ${when} Uhr. Die Bestätigungs-Mail konnten wir gerade nicht verschicken; wir holen das nach. Bitte speichere diese Bestätigung:`;
    $('#kd-text').textContent = res.text ?? '';
    $('#kd-done').hidden = false;
    form.hidden = true;
    $('#kd-done').scrollIntoView({ block: 'start' });
  } catch (err) {
    fail(`${err.message} – du kannst auch per E-Mail an spitzefluke@gmail.com kündigen.`);
    btn.disabled = false;
    btn.textContent = 'jetzt kündigen';
  }
}
