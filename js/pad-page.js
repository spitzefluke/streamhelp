// StreamHelp Pad (pad.html): Warteliste mit Double-Opt-in über die Edge Function waitlist.
//   #bestaetigen=<token>  Link aus der Bestätigungs-Mail → Eintrag bestätigen
//   #austragen=<token>    Link aus jeder Mail → Eintrag löschen
// Offen erst, wenn js/launch.js waitlist = true (dafür muss der Mail-Versand in Supabase eingerichtet sein).
import './frame-guard-auto.js'; // zuerst: nicht in fremden Seiten (Clickjacking)
import { setupConsent } from './consent.js';
import { LAUNCH } from './launch.js';

setupConsent(); // Cookie-Fenster (js/consent.js)

const $ = (sel) => document.querySelector(sel);
const form = $('#pad-form');
const note = $('#pad-note');

async function call(body) {
  const { createApi, germanError } = await import('./api.js');
  const api = await createApi();
  if (api.demo) throw new Error('Im Demo-Modus wird nichts gespeichert.');
  try {
    return await api.raw.invoke('waitlist', body);
  } catch (err) {
    throw new Error(germanError(err));
  }
}

function status(text, ok) {
  const el = $('#pad-status');
  el.textContent = text;
  el.className = `pad-status ${ok ? 'is-ok' : 'is-bad'}`;
  el.hidden = false;
}

// Links aus den Mails (Token nur im #-Teil – der geht beim Laden nicht an den Server)
const link = /^#(bestaetigen|austragen)=([0-9a-f]{64})$/.exec(location.hash);
if (link) {
  history.replaceState(null, '', location.pathname);
  const confirm = link[1] === 'bestaetigen';
  call({ action: confirm ? 'confirm' : 'remove', token: link[2] })
    .then(() => status(confirm ? '✅ Danke! Du stehst auf der Warteliste. Wir melden uns, sobald du das Pad vorbestellen kannst.' : '✅ Du bist ausgetragen und bekommst keine E-Mails mehr zum Pad.', true))
    .catch((err) => status(err.message, false));
}

if (LAUNCH.waitlist) {
  form.querySelectorAll('input, button').forEach((el) => { el.disabled = false; });
  note.textContent = 'Du bekommst eine E-Mail mit einem Bestätigungs-Link.';
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const btn = form.querySelector('button');
    btn.disabled = true;
    note.textContent = 'Einen Moment …';
    try {
      await call({ action: 'join', email: form.elements.email.value, consent: form.elements.consent.checked, website2: form.elements.website2.value });
      form.reset();
      note.textContent = '📬 Fast geschafft: Bitte klick auf den Link in der E-Mail, die wir dir gerade geschickt haben (auch im Spam-Ordner nachsehen).';
    } catch (err) {
      note.textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });
}
