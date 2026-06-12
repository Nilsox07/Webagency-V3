/* proof-lumi-flow.js — Abnahme-Beleg für LUMI-FLOW-UMBAU Etappe 1
   Fährt den geführten Flow in jsdom bis zur ZUSAMMENFASSUNG und prüft:
   - Standard: sichtbare Buttons/Inputs (außerhalb geschlossener <details>) <= 7
   - alle <details> open=false
   - Klick auf ein Extra / eine SEO-Stufe aktualisiert den Festpreis-Block
   - voller Durchlauf bis Submit: Payload-Top-Level- & konfiguration-Keys */
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
  const beaconCalls = [];
  try { Object.defineProperty(w.navigator, 'sendBeacon', { configurable: true, value: (url, body) => { beaconCalls.push({ url: String(url), body }); return true; } }); } catch (e) {}
  w.__beaconCalls = beaconCalls;
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
  return { w, errors, fetchCalls, beaconCalls };
}
const click = (w, el) => el && el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true, view: w }));
const q = (w, s) => w.document.querySelector(s);
const qa = (w, s) => [...w.document.querySelectorAll(s)];

function driveToSummary(w) {
  click(w, q(w, '.lb-start'));
  click(w, qa(w, '.lb-path-card')[0]);            // Komplette Website
  let guard = 0;
  while (!q(w, '.lb-fixblock') && guard++ < 30) {
    const next = q(w, '.lb-next'), skip = q(w, '.lb-skip');
    if (next) { click(w, next); continue; }
    if (skip) { click(w, skip); continue; }
    const opt = qa(w, '#lumiStage button').find(b => !/lb-(back|skip|next|acc|pkgswitch)/.test(b.className));
    if (opt) { click(w, opt); continue; }
    break;
  }
}
async function driveToSubmit(w, fetchCalls) {
  const stage = () => q(w, '#lumiStage').textContent;
  let guard = 0;
  while (!/wohin darf Sartu dein Angebot/i.test(stage()) && guard++ < 30) {
    const next = q(w, '.lb-next'), skip = q(w, '.lb-skip');
    if (next) { click(w, next); continue; }
    if (skip) { click(w, skip); continue; }
    const opt = qa(w, '#lumiStage button').find(b => !/lb-(back|skip|next|acc|pkgswitch|addon-toggle|pkg|wish)/.test(b.className));
    if (opt) { click(w, opt); continue; }
    break;
  }
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

(async () => {
  let pass = 0, fail = 0;
  const ok = (cond, label, extra) => { console.log((cond ? '  ✓' : '  ✗') + ' ' + label + (extra ? ' — ' + extra : '')); cond ? pass++ : fail++; };

  // 1) Standard-Zustand der Zusammenfassung
  console.log('\n[1] Zusammenfassung · Standard-Zustand');
  const { w, errors } = lumiDom();
  driveToSummary(w);
  const stage = q(w, '#lumiStage');
  ok(/empfehle ich/i.test(q(w, '.lb-q').textContent), 'Lumi-Satz „empfehle ich …"', q(w, '.lb-q').textContent.slice(0, 60));
  ok(!!q(w, '.lb-reccard'), 'genau EINE Empfehlungs-Karte', String(qa(w, '.lb-reccard').length));
  ok(qa(w, '.lb-reccard').length === 1, 'nicht mehr als eine Empfehlungs-Karte');
  ok(/Alle Texte schreiben wir/.test(stage.textContent), 'Klartext-Zeile „Alle Texte schreiben wir …"');
  ok(/gehört dazu/.test(stage.textContent), 'Rundum-Schutz „gehört dazu"');
  ok(!!q(w, '.lb-fixblock'), 'Festpreis-Block sichtbar');
  const details = qa(w, '#lumiStage details');
  ok(details.length > 0 && details.every(d => !d.open), 'alle <details> geschlossen (open=false)', details.length + ' Accordions');
  const visible = qa(w, '#lumiStage button, #lumiStage input').filter(b => !b.closest('details:not([open])'));
  ok(visible.length <= 7, 'sichtbare Buttons/Inputs <= 7', visible.length + ': ' + visible.map(b => (b.className || b.type)).join(', '));
  ok(!q(w, '#lumiPriceBar') || q(w, '#lumiPriceBar').hidden, 'fixe Preisleiste ausgeblendet');
  const persistHint = q(w, '#lumiFixHint');
  ok(!!persistHint, 'persistenter Festpreis-Hinweis vorhanden im Markup');

  // 2) Festpreis aktualisiert sich bei Anpassung (Beispiel-Rechnung)
  console.log('\n[2] Festpreis-Update bei Änderung (Beispiel-Rechnung)');
  const fixText = () => q(w, '.lb-fixblock').textContent.replace(/\s+/g, ' ').trim();
  const before = fixText();
  console.log('     vorher : ' + before);
  click(w, q(w, '.lb-addon-toggle'));                // erstes Extra (Online-Terminbuchung +290 €)
  const afterExtra = fixText();
  console.log('     +Extra : ' + afterExtra);
  ok(afterExtra !== before, 'Extra-Klick verändert Festpreis');
  const seoCard = qa(w, '.lb-acc .lb-pkg').find(c => /€\/Mon/.test(c.textContent));
  click(w, seoCard);                                 // eine SEO-Stufe wählen
  const afterSeo = fixText();
  console.log('     +SEO   : ' + afterSeo);
  ok(/SEO-Betreuung/.test(afterSeo), 'SEO-Klick ergänzt SEO-Zeile im Festpreis');

  // 3) Voller Durchlauf bis Submit — Payload-Keys
  console.log('\n[3] Advisory-Pfad bis Submit · Payload-Keys');
  const d2 = lumiDom();
  const pay = await driveToSubmit(d2.w, d2.fetchCalls);
  ok(!!pay, 'Payload erfasst (Supabase-POST)');
  if (pay) {
    console.log('     top-level : ' + Object.keys(pay).sort().join(', '));
    console.log('     konfig    : ' + Object.keys(pay.konfiguration || {}).sort().join(', '));
    ok(pay.produkt_typ === 'website', 'produkt_typ=website', pay.produkt_typ);
    ok(pay.konfiguration && pay.konfiguration.modus === 'fixpreis', 'modus=fixpreis');
    ['paket', 'paket_name', 'paket_preis', 'wartung', 'addons', 'wuensche', 'summe_einmalig', 'summe_monatlich', 'seo_stufe', 'stil', 'hauptfarbe', 'nebenfarbe', 'markenfarben_hex']
      .forEach(k => ok(k in pay.konfiguration, 'konfiguration.' + k + ' vorhanden'));
  }

  console.log('\n[4] Konsole / window-errors / Tracking');
  ok(errors.length === 0 && d2.errors.length === 0, 'keine window-errors', [...errors, ...d2.errors].slice(0, 3).join(' | '));
  ok((w.__beaconCalls || []).length === 0 && (d2.w.__beaconCalls || []).length === 0, 'Schritt-Tracking ist No-op ohne Endpoint/Consent (kein Beacon)');

  // 5) Deeplinks von /preise — direkter Einstieg mit vorgewähltem Paket (Pfad A)
  console.log('\n[5] Deeplinks /briefing?paket=… → Zusammenfassung mit vorgewähltem Paket');
  const deeplink = (query, expectName, label) => {
    const d = lumiDom(query);
    const stageTxt = q(d.w, '#lumiStage').textContent;
    const qline = q(d.w, '.lb-q') ? q(d.w, '.lb-q').textContent : '';
    const hasFix = !!q(d.w, '.lb-fixblock') || /Individuelles Festpreis-Angebot/.test(stageTxt);
    ok(hasFix && new RegExp(expectName).test(qline), label, qline.slice(0, 60));
    return d;
  };
  deeplink('?paket=wachstum', 'Wachstum', 'Name „wachstum" → Zusammenfassung „Du hast Wachstum gewählt"');
  deeplink('?paket=pro', 'Wachstum', 'Technische ID „pro" → selbe Zusammenfassung');
  deeplink('?paket=platzhirsch', 'Platzhirsch', 'Name „platzhirsch" → Zusammenfassung');
  const dEnt = deeplink('?paket=sonderprojekte', 'individuelles Festpreis-Angebot', 'Name „sonderprojekte" → individuelle Anfrage');
  ok(!!q(dEnt.w, '.lb-ent') || /Sonderfunktionen/.test(q(dEnt.w, '#lumiStage').textContent), 'Sonderprojekte zeigt strukturierte Enterprise-Fragen');
  // Pfad-Marker im Payload eines Deeplink-Durchlaufs
  const dPay = lumiDom('?paket=wachstum');
  const payDL = await driveToSubmit(dPay.w, dPay.fetchCalls);
  ok(!!payDL && payDL.pfad === 'A', 'Deeplink-Payload pfad=A (Direkteinstieg)', payDL ? payDL.pfad : '—');
  ok(!!payDL && payDL.konfiguration && payDL.konfiguration.paket === 'pro', 'Deeplink-Payload paket=pro (Wachstum)', payDL && payDL.konfiguration ? payDL.konfiguration.paket : '—');

  console.log('\nPROOF: ' + pass + ' grün · ' + fail + ' rot');
  process.exit(fail ? 1 : 0);
})();
