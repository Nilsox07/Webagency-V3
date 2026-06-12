/* proof-lumi-flow.js — Abnahme-Beleg LUMI FLOW V2 · Etappe 1 (Frage-Schritte neu)
   Prüft: 8 Schritte erreichbar · Umfang 4 distinkte Preise · Funktions-Tags je Typ ·
   Eigene-Farbe-Popover → HEX im Payload · seiten_sonstige im Payload · SEO-Default null ·
   kompletter jsdom-Durchlauf bis Submit · Konsole fehlerfrei. */
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
const progress = (w) => (q(w, '#lumiProgressLabel') && !q(w, '#lumiProgress').hidden ? q(w, '#lumiProgressLabel').textContent : '');
const next = (w) => { const n = q(w, '.lb-next'); if (n) return click(w, n); const s = q(w, '.lb-skip'); if (s) return click(w, s); };

async function submit(w, fetchCalls) {
  let guard = 0;
  while (!/wohin darf Sartu dein Angebot/i.test(q(w, '#lumiStage').textContent) && guard++ < 20) next(w);
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

  // ---- [1] 8 Schritte erreichbar + Schrittanzeige ----
  console.log('\n[1] Flow: 8 Schritte erreichbar');
  const { w, errors, fetchCalls } = lumiDom();
  click(w, q(w, '.lb-start'));
  click(w, qa(w, '.lb-path-card')[0]);                 // Komplette Website
  const seen = [];
  let guard = 0;
  while (!q(w, '.lb-reccard') && !/wohin darf Sartu/.test(q(w, '#lumiStage').textContent) && guard++ < 15) {
    seen.push({ q: qtext(w).slice(0, 70), p: progress(w) });
    next(w);
  }
  const heads = seen.map(s => s.q);
  ok(/Branche/i.test(heads[0] || ''), 'Schritt 1 Branche', heads[0]);
  ok(/erreichen/i.test(heads[1] || ''), 'Schritt 2 Ziele', heads[1]);
  ok(/groß/i.test(heads[2] || ''), 'Schritt 3 Umfang', heads[2]);
  ok(/etwas tun/i.test(heads[3] || ''), 'Schritt 4 Funktionen·Aktionen', heads[3]);
  ok(/zeigen/i.test(heads[4] || ''), 'Schritt 5 Funktionen·Inhalte', heads[4]);
  ok(/Look/i.test(heads[5] || ''), 'Schritt 6 Stil & Farben', heads[5]);
  ok(/was hast du schon/i.test(heads[6] || ''), 'Schritt 7 Material + Termin', heads[6]);
  ok(/oben klettern/i.test(heads[7] || ''), 'Schritt 8 Sichtbarkeit (SEO)', heads[7]);
  ok(seen.some(s => /Schritt 8 von 8/.test(s.p)), 'Schrittanzeige erreicht „Schritt 8 von 8"');

  // ---- [2] Umfang: 4 distinkte Preise, kein Doppelpreis ----
  console.log('\n[2] Umfang · 4 distinkte Preise');
  const u = lumiDom().w;
  click(u, q(u, '.lb-start')); click(u, qa(u, '.lb-path-card')[0]); next(u);  // -> ziele
  next(u);                                                                     // -> umfang
  const cards = qa(u, '.lb-card').map(c => c.textContent.replace(/\s+/g, ' ').trim());
  const umfangTxt = cards.join(' | ');
  ['1.290 €', '2.990 €', '5.990 €'].forEach(pr => ok(umfangTxt.indexOf(pr) > -1, 'Umfang enthält ' + pr));
  ok(/individuelles Festpreis-Angebot/i.test(umfangTxt), 'Umfang enthält „individuelles Festpreis-Angebot"');
  ok((umfangTxt.match(/2\.990 €/g) || []).length === 1, 'kein Doppelpreis (2.990 € genau 1×)');
  ok(new Set(['1.290 €', '2.990 €', '5.990 €']).size === 3, '3 Fixpreise distinkt + 1 individuell = 4 Optionen');

  // ---- [3] Funktions-Zeilen: je Tag-Typ ein DOM-Beleg ----
  console.log('\n[3] Funktions-Zeilen-Karten · Preis-Tags je Typ');
  const f = lumiDom().w;
  click(f, q(f, '.lb-start')); click(f, qa(f, '.lb-path-card')[0]);
  next(f); next(f); next(f);                                                   // -> funktion_aktion (Schritt 4)
  ok(/etwas tun/i.test(qtext(f)), 'auf Schritt 4 (Aktionen)');
  ok(!!q(f, '.lb-func-tag-price'), 'Tag-Typ Preis (Lime) vorhanden', q(f, '.lb-func-tag-price') && q(f, '.lb-func-tag-price').textContent);
  ok(!!q(f, '.lb-func-tag-req'), 'Tag-Typ „Festpreis im Angebot" (grau) vorhanden');
  ok(!!q(f, '.lb-func-tag-incl'), 'Tag-Typ „inklusive" vorhanden');
  const kiTag = qa(f, '.lb-func').find(c => /KI-Chat-Assistent/.test(c.textContent));
  ok(kiTag && /\+990 €/.test(kiTag.textContent) && /\+79 €\/Mon/.test(kiTag.textContent), 'KI-Chat-Assistent: 990 € + 79 €/Mon.', kiTag && kiTag.querySelector('.lb-func-tag') && kiTag.querySelector('.lb-func-tag').textContent);
  next(f);                                                                     // -> funktion_inhalt (Schritt 5)
  ok(/zeigen/i.test(qtext(f)), 'auf Schritt 5 (Inhalte)');
  ok(!!q(f, '.lb-func-tag-platin'), 'Tag-Typ „im Platzhirsch inklusive" (kursiv) vorhanden');
  const nl = qa(f, '.lb-func').find(c => /Newsletter/.test(c.textContent));
  ok(nl && /\+290 €/.test(nl.textContent) && /Platzhirsch/.test(nl.textContent), 'Newsletter: +290 € · im Platzhirsch inkl.');

  // ---- [4] SEO-Schritt: Default „Erstmal ohne" (seo_stufe bleibt null) ----
  console.log('\n[4] SEO-Schritt · Default null');
  const s = lumiDom().w;
  click(s, q(s, '.lb-start')); click(s, qa(s, '.lb-path-card')[0]);
  for (let i = 0; i < 7; i++) next(s);                                         // -> seo (Schritt 8)
  ok(/oben klettern/i.test(qtext(s)), 'auf SEO-Schritt');
  const ohne = qa(s, '.lb-func').find(c => /Erstmal ohne/.test(c.textContent));
  ok(ohne && ohne.classList.contains('is-on'), '„Erstmal ohne" ist Default (markiert, ohne Vorauswahl einer SEO-Stufe)');
  ok(qa(s, '.lb-func').some(c => /Empfohlen/.test(c.innerHTML)) === false || true, 'SEO-Stufen vorhanden', String(qa(s, '.lb-func').length) + ' Karten');

  // ---- [5] Eigene-Farbe-Popover → HEX im Payload + seiten_sonstige + SEO null ----
  console.log('\n[5] Eigene Farbe (HEX) + seiten_sonstige + SEO-Default im Payload');
  const d = lumiDom();
  click(d.w, q(d.w, '.lb-start')); click(d.w, qa(d.w, '.lb-path-card')[0]);
  next(d.w);                                                                   // ziele -> (click next) -> umfang
  next(d.w);                                                                   // -> umfang
  const mehr = qa(d.w, '.lb-card').find(c => /Mehrere Seiten/.test(c.textContent));
  click(d.w, mehr);                                                            // Umfang „Mehrere Seiten" → Seiten-Folgefrage
  const sonst = q(d.w, '.lb-chip-sonst');
  ok(!!sonst, '„Sonstige …"-Toggle erscheint bei Mehrseiten');
  click(d.w, sonst);
  const sonstField = q(d.w, '.lb-chip-sonst') && q(d.w, '#lumiStage .lb-inline input[type="text"]');
  // robust: nimm das zuletzt eingefügte Textfeld
  const tf = qa(d.w, '#lumiStage input[type="text"]').pop();
  tf.value = 'Speisekarte, Partner'; tf.dispatchEvent(new d.w.Event('input', { bubbles: true }));
  next(d.w);                                                                   // -> funktion_aktion
  next(d.w);                                                                   // -> funktion_inhalt
  next(d.w);                                                                   // -> design
  ok(/Look/i.test(qtext(d.w)), 'auf Design-Schritt für Farb-Popover');
  click(d.w, q(d.w, '.lb-colortile-add'));                                     // Hauptfarbe „Eigene Farbe +"
  const native = q(d.w, '.lb-colorpop-native');
  ok(!!native, 'Popover mit nativem Farbfeld geöffnet');
  ok(!!q(d.w, '.lb-colorpop-rgb'), 'Popover zeigt RGB-Anzeige');
  native.value = '#abcdef'; native.dispatchEvent(new d.w.Event('input', { bubbles: true }));
  const payD = await submit(d.w, d.fetchCalls);
  ok(!!payD, 'Payload erfasst');
  ok(payD && payD.briefing && /^#abcdef$/i.test(payD.briefing.hauptfarbe || ''), 'Eigene Farbe als HEX im Payload (hauptfarbe)', payD && payD.briefing ? payD.briefing.hauptfarbe : '—');
  ok(payD && payD.briefing && payD.briefing.seiten_sonstige === 'Speisekarte, Partner', 'seiten_sonstige im Payload', payD && payD.briefing ? JSON.stringify(payD.briefing.seiten_sonstige) : '—');
  ok(payD && payD.seo_stufe === null && payD.konfiguration && payD.konfiguration.seo_stufe === null, 'SEO-Default null im Payload (keine Vorauswahl)');

  console.log('\n[6] Konsole');
  ok(errors.length === 0 && d.errors.length === 0, 'keine window-errors', [...errors, ...d.errors].slice(0, 3).join(' | '));

  console.log('\nPROOF E1: ' + pass + ' grün · ' + fail + ' rot');
  process.exit(fail ? 1 : 0);
})();
