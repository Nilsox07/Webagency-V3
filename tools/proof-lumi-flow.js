/* proof-lumi-flow.js — Abnahme-Beleg LUMI FLOW V2 · Etappe 2 (Übersicht auf Kontakt-Screen)
   Prüft: Flow endet im Kontakt (keine Zusammenfassungs-Seite) · Empfehlungs-Karte mit
   Einmal- & Monatsbetrag · Übersichts-Liste mit „ändern"-Rücksprung · DOM-Count interaktiv ·
   Logo-Zeile nur ohne Logo-Material + Summen-Update · Deep-Link-Payload · Payload-Keys · Konsole. */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const ROOT = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const JSDOM_KNOWN = /Cannot create property '(value|checked)' on string/;

function lumiDom(query) {
  const html = read('briefing.html');
  const vc = new VirtualConsole(); vc.on('jsdomError', () => {});
  const dom = new JSDOM(html, { url: 'https://example.test/briefing' + (query || ''), runScripts: 'outside-only', virtualConsole: vc, pretendToBeVisual: true });
  const w = dom.window;
  const errors = [];
  w.addEventListener('error', e => { const m = String(e.message || e.error); if (!JSDOM_KNOWN.test(m)) errors.push(m); });
  w.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  w.Element.prototype.scrollIntoView = function () {};
  w.scrollTo = function () {};
  ['name', 'email', 'telefon', 'dsgvo'].forEach((fld) => {
    Object.defineProperty(w.HTMLFormElement.prototype, fld, { configurable: true,
      get() { return this.querySelector('[name="' + fld + '"]') || (fld === 'name' ? (this.getAttribute('name') || '') : undefined); } });
  });
  const fetchCalls = [];
  w.fetch = (url, opts) => { fetchCalls.push({ url: String(url), body: opts && opts.body }); return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}), text: () => Promise.resolve('') }); };
  const srcs = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1].split('?')[0]);
  for (const s of srcs) { try { w.eval(read(s)); } catch (e) { errors.push(s + ': ' + e.message); } }
  w.document.dispatchEvent(new w.Event('DOMContentLoaded', { bubbles: true }));
  return { w, errors, fetchCalls };
}
const click = (w, el) => el && el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true, view: w }));
const q = (w, s) => w.document.querySelector(s);
const qa = (w, s) => [...w.document.querySelectorAll(s)];
const qtext = (w) => (q(w, '.lb-q') ? q(w, '.lb-q').textContent : '');
const onContact = (w) => !!q(w, '.lb-form') && !!q(w, '.lb-reccard-slim');
function next(w) { const n = q(w, '.lb-next'); if (n) { click(w, n); return; } const s = q(w, '.lb-skip'); if (s) click(w, s); }
function pickCard(w, label) { const c = qa(w, '.lb-card').find(x => x.textContent.includes(label)); if (c) click(w, c); }
function pickFunc(w, val) { const c = q(w, '.lb-func[data-val="' + val + '"]'); if (c) { const i = c.querySelector('input'); i.checked = true; i.dispatchEvent(new w.Event('change', { bubbles: true })); } }
function pickChip(w, label) { const c = qa(w, '.lb-chip').find(x => x.textContent.trim() === label); if (c) click(w, c); }

// Geführter Durchlauf bis zum Kontakt-Screen (mit gezielten Auswahlen)
function driveToContact(w, opts) {
  opts = opts || {};
  click(w, q(w, '.lb-start')); click(w, qa(w, '.lb-path-card')[0]);   // branche
  next(w);                                                            // ziele
  next(w);                                                            // umfang
  pickCard(w, 'Mehrere Seiten'); next(w);                            // funktion_aktion
  if (opts.func) pickFunc(w, opts.func);
  next(w);                                                            // funktion_inhalt
  next(w);                                                            // design
  if (q(w, '.lb-mood')) click(w, q(w, '.lb-mood'));
  if (q(w, '.lb-colortile')) click(w, q(w, '.lb-colortile'));
  next(w);                                                            // material
  if (opts.logo) pickChip(w, 'Logo');
  next(w);                                                            // seo
  next(w);                                                            // contact
}
async function fillSubmit(w, fetchCalls) {
  let guard = 0;
  while (!onContact(w) && guard++ < 12) next(w);
  const form = q(w, '.lb-form');
  if (form) {
    form.querySelector('[name="name"]').value = 'Testnutzer';
    form.querySelector('[name="email"]').value = 'test@example.de';
    form.querySelector('[name="dsgvo"]').checked = true;
    form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 0));
  }
  const post = fetchCalls.find(c => /\/rest\/v1\/briefings/.test(c.url));
  try { return post && post.body ? JSON.parse(post.body).payload : null; } catch (e) { return null; }
}
const cardOnce = (w) => { const m = (q(w, '.lb-reccard-sums') || {}).textContent || ''; const x = /Einmalig\s+([\d.]+)\s*€/.exec(m); return x ? parseInt(x[1].replace(/\./g, ''), 10) : null; };

(async () => {
  let pass = 0, fail = 0;
  const ok = (cond, label, extra) => { console.log((cond ? '  ✓' : '  ✗') + ' ' + label + (extra ? ' — ' + extra : '')); cond ? pass++ : fail++; };

  // ---- [1] Flow endet im Kontakt-Screen, KEINE Zusammenfassungs-Seite ----
  console.log('\n[1] Flow → Kontakt-Screen (keine Zusammenfassungs-Seite)');
  const a = lumiDom();
  driveToContact(a.w, { func: 'terminbuchung' });
  ok(onContact(a.w), 'Kontakt-Screen erreicht (Karte + Formular)');
  ok(qa(a.w, '#lumiStage details, #lumiStage .lb-fixblock, #lumiStage .lb-accordions').length === 0, 'keine Accordions / kein Festpreis-Block mehr');
  ok(!!q(a.w, '.lb-reccard-slim'), 'schlanke Empfehlungs-Karte vorhanden');

  // ---- [2] Karte: Einmal- UND Monatsbetrag IN der Karte ----
  console.log('\n[2] Empfehlungs-Karte · beide Beträge in der Karte');
  const sums = q(a.w, '.lb-reccard-sums') ? q(a.w, '.lb-reccard-sums').textContent : '';
  ok(/Einmalig\s+[\d.]+\s*€/.test(sums), 'Einmalbetrag in der Karte', sums.trim());
  ok(/Monatlich\s+[\d.]+\s*€\/Mon\./.test(sums) && /gehört dazu/.test(sums), 'Monatsbetrag (Rundum-Schutz) in der Karte');

  // ---- [3] Übersichts-Liste + Funktions-Preis ----
  console.log('\n[3] Übersichts-Liste (eine Zeile je Thema, „ändern")');
  const keys = qa(a.w, '.lb-overview-row .k').map(k => k.textContent);
  ['Seiten', 'Funktionen', 'Design', 'Material', 'Termin', 'Sichtbarkeit'].forEach(k => ok(keys.indexOf(k) > -1, 'Zeile „' + k + '"'));
  const funcRow = qa(a.w, '.lb-overview-row').find(r => /Funktionen/.test(r.querySelector('.k').textContent));
  ok(funcRow && /Online-Terminbuchung \+290 €/.test(funcRow.textContent), 'Funktionen-Zeile zeigt „Online-Terminbuchung +290 €"', funcRow && funcRow.querySelector('.v').textContent);
  ok(qa(a.w, '.lb-overview-row .lb-edit').length === keys.length, 'jede Zeile hat „ändern"-Link', qa(a.w, '.lb-overview-row .lb-edit').length + ' Links');

  // ---- [4] DOM-Count: interaktiv nur Formular + Submit/Zurück + ändern (+ ggf. Logo) ----
  console.log('\n[4] DOM-Count Kontakt-Screen (interaktiv)');
  const stray = qa(a.w, '#lumiStage .lb-func, #lumiStage .lb-card, #lumiStage .lb-chip, #lumiStage .lb-pkg, #lumiStage .lb-mood, #lumiStage .lb-colortile');
  ok(stray.length === 0, 'keine Frage-Widgets auf dem Kontakt-Screen', stray.length + ' Fremd-Widgets');
  const inputs = qa(a.w, '#lumiStage input').map(i => i.name || i.type);
  ok(['name', 'email', 'telefon', 'dsgvo'].every(n => inputs.indexOf(n) > -1), 'Formularfelder vorhanden', inputs.join(', '));
  const editLinks = qa(a.w, '.lb-edit').map(b => b.getAttribute('aria-label'));
  console.log('     ändern-Links: ' + editLinks.join(' · '));
  ok(!!q(a.w, '.lb-next') && !!q(a.w, '.lb-back'), 'Submit (Weiter) + Zurück vorhanden');

  // ---- [5] „ändern"-Rücksprung für 2 Themen (Design, Funktionen) ----
  console.log('\n[5] „ändern"-Rücksprung (Rücksprung-Flag)');
  const b = lumiDom(); driveToContact(b.w, {});
  const editDesign = qa(b.w, '.lb-overview-row').find(r => /Design/.test(r.querySelector('.k').textContent)).querySelector('.lb-edit');
  click(b.w, editDesign);
  ok(/Look/i.test(qtext(b.w)), 'ändern → Design-Schritt', qtext(b.w).slice(0, 30));
  next(b.w);
  ok(onContact(b.w), 'Weiter führt direkt zurück zum Kontakt (Design)');
  const editFunc = qa(b.w, '.lb-overview-row').find(r => /Funktionen/.test(r.querySelector('.k').textContent)).querySelector('.lb-edit');
  click(b.w, editFunc);
  ok(/etwas tun/i.test(qtext(b.w)), 'ändern → Funktionen-Schritt');
  next(b.w);
  ok(onContact(b.w), 'Weiter führt direkt zurück zum Kontakt (Funktionen)');

  // ---- [6] Logo-Zeile: nur ohne Logo-Material, unangehakt, Summen-Update ----
  console.log('\n[6] Logo-Empfehlungszeile + Summen-Update');
  const c = lumiDom(); driveToContact(c.w, {});                  // kein Logo-Material
  const logo = q(c.w, '.lb-logo-offer');
  ok(!!logo, 'Logo-Zeile erscheint ohne Logo-Material');
  ok(logo && !logo.querySelector('input').checked, 'Logo-Zeile ist unangehakt (keine Vorauswahl)');
  const before = cardOnce(c.w);
  if (logo) { const i = logo.querySelector('input'); i.checked = true; i.dispatchEvent(new c.w.Event('change', { bubbles: true })); }
  const after = cardOnce(c.w);
  ok(before != null && after === before + 490, 'Logo-Klick erhöht Einmalsumme um 490 € (' + before + ' → ' + after + ')');
  const cl = lumiDom(); driveToContact(cl.w, { logo: true });    // mit Logo-Material
  ok(!q(cl.w, '.lb-logo-offer'), 'Logo-Zeile fehlt, wenn Logo-Material vorhanden');

  // ---- [7] Deep-Link von /preise → Kontakt mit vorgewähltem Paket + offenen Zeilen ----
  console.log('\n[7] Deep-Link ?paket=wachstum → Kontakt');
  const d = lumiDom('?paket=wachstum');
  ok(onContact(d.w), 'Deep-Link landet direkt im Kontakt-Screen');
  ok(/Du hast „Wachstum“ gewählt/.test(qtext(d.w)), 'Karte „Du hast Wachstum gewählt"', qtext(d.w).slice(0, 40));
  ok(qa(d.w, '.lb-overview-row.is-open').length > 0, 'offene Themen zeigen „noch offen — ändern"', qa(d.w, '.lb-overview-row.is-open').length + ' offen');
  const payDL = await fillSubmit(d.w, d.fetchCalls);
  ok(payDL && payDL.pfad === 'A' && payDL.konfiguration && payDL.konfiguration.paket === 'pro', 'Deep-Link-Payload pfad=A · paket=pro', payDL ? payDL.pfad + '/' + payDL.konfiguration.paket : '—');

  // ---- [8] Submit-Payload-Keys (identisch zu vorher) + Konsole ----
  console.log('\n[8] Payload-Keys + Konsole');
  const e = lumiDom(); driveToContact(e.w, { func: 'terminbuchung' });
  const pay = await fillSubmit(e.w, e.fetchCalls);
  ok(!!pay, 'Payload erfasst');
  console.log('     top-level : ' + Object.keys(pay || {}).sort().join(', '));
  console.log('     konfig    : ' + Object.keys((pay && pay.konfiguration) || {}).sort().join(', '));
  const topExpected = ['briefing', 'createdAt', 'konfiguration', 'kontakt', 'pfad', 'produkt_typ', 'schemaVersion', 'seo_stufe'];
  ok(pay && topExpected.every(k => k in pay), 'Top-Level-Keys unverändert');
  ['paket', 'paket_name', 'paket_preis', 'wartung', 'addons', 'wuensche', 'summe_einmalig', 'summe_monatlich', 'seo_stufe', 'stil', 'hauptfarbe', 'nebenfarbe', 'markenfarben_hex']
    .forEach(k => ok(pay && pay.konfiguration && (k in pay.konfiguration), 'konfiguration.' + k));
  ok(pay && pay.briefing && ('seiten_sonstige' in pay.briefing), 'briefing.seiten_sonstige vorhanden');
  const tb = pay && pay.konfiguration && (pay.konfiguration.addons || []).some(x => x.id === 'terminbuchung');
  ok(tb, 'gewählte Funktion (terminbuchung) liegt im Festpreis (addons)');
  ok(a.errors.length === 0 && b.errors.length === 0 && c.errors.length === 0 && d.errors.length === 0 && e.errors.length === 0, 'keine window-errors');

  console.log('\nPROOF E2: ' + pass + ' grün · ' + fail + ' rot');
  process.exit(fail ? 1 : 0);
})();
