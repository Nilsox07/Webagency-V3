'use strict';
// Etappe 7: Bau-Prompt-Generator — Snapshot (alle Funktionen), Lücken-Marker, Editierbarkeit, Kopier-Button.
const { test, before, beforeEach } = require('node:test');
const assert = require('node:assert');
const H = require('./helpers');
const promptgen = require('../src/promptgen');

const VOLL_BRIEFING = {
  produkt_typ: 'website', seo_stufe: 'lite',
  briefing: { branche: 'gastro', ziele: ['neukunden', 'termine'], seiten: ['Startseite', 'Kontakt'], seiten_sonstige: 'Speisekarte',
    features: ['kontaktformular', 'terminbuchung', 'galerie', 'newsletter', 'blog'], stil: 'warm', hauptfarbe: '#b6ff3b', nebenfarbe: 'anthrazit', zeitrahmen: '4-6w' },
  konfiguration: { paket: 'platin', paket_name: 'Platzhirsch' },
};
const FUENF = 'a\nb\nc\nd\ne';

let app;
before(async () => { app = await H.makeApp(); });
beforeEach(async () => {
  await H.db.query('DELETE FROM inhalte_seiten'); await H.db.query('DELETE FROM projekte');
  await H.db.query('DELETE FROM kunden'); await H.db.query('DELETE FROM admin_user'); await H.db.query('DELETE FROM prompt_bausteine');
});

async function mkVollProjekt(stichVoll) {
  const k = await H.createKunde('e7@kunde.de', 'Pia', 'Pizza Pia');
  const p = await H.db.one(`INSERT INTO projekte (kunde_id,name,paket,sprachversionen,briefing) VALUES ($1,'P','platin',2,$2) RETURNING *`,
    [k.id, JSON.stringify(VOLL_BRIEFING)]);
  await H.db.query(`INSERT INTO inhalte_seiten (projekt_id,seitenname,stichpunkte) VALUES ($1,'Startseite',$2),($1,'Kontakt',$3)`,
    [p.id, FUENF, stichVoll ? FUENF : 'a\nb']);
  return { k, p };
}

test('Snapshot: jeder gewählte Baustein genau einmal, alle Platzhalter ersetzt, keine Lücken', async () => {
  const { p } = await mkVollProjekt(true);
  const inhalte = await H.db.many(`SELECT * FROM inhalte_seiten WHERE projekt_id=$1`, [p.id]);
  const r = promptgen.generate(p, inhalte, null, 'Pizza Pia');
  assert.strictEqual(r.vollstaendig, true, 'vollständig erwartet, fehlend=' + r.fehlend);
  assert.ok(!/\{\{/.test(r.text), 'keine offenen Platzhalter');
  assert.ok(!/\[FEHLT:/.test(r.text), 'keine Lücken-Marker');
  // jeder Baustein genau einmal
  assert.strictEqual(r.bausteinKeys.length, new Set(r.bausteinKeys).size);
  ['kopf', 'briefing', 'funktion_terminbuchung', 'funktion_galerie', 'funktion_newsletter', 'funktion_blog', 'stil_farben', 'texte', 'mehrsprachig', 'abnahme']
    .forEach((k) => assert.ok(r.bausteinKeys.includes(k), 'Baustein fehlt: ' + k));
  // Platzhalter ersetzt
  assert.match(r.text, /Pizza Pia/);
  assert.match(r.text, /#b6ff3b/);
  assert.match(r.text, /Platzhirsch/);
  // Redesign-Block NICHT enthalten (kein Redesign)
  assert.ok(!r.bausteinKeys.includes('redesign'));
});

test('Unvollständige Stichpunkte erzeugen Lücken-Marker [FEHLT: …]', async () => {
  const { p } = await mkVollProjekt(false);
  const inhalte = await H.db.many(`SELECT * FROM inhalte_seiten WHERE projekt_id=$1`, [p.id]);
  const r = promptgen.generate(p, inhalte, null, 'Pizza Pia');
  assert.strictEqual(r.vollstaendig, false);
  assert.match(r.text, /\[FEHLT: Stichpunkte/);
});

test('Bausteine sind editierbar (DB-Version gewinnt)', async () => {
  const { p } = await mkVollProjekt(true);
  await promptgen.ensureBausteine(H.db);
  await H.db.query(`UPDATE prompt_bausteine SET text = 'KOPF-NEU {{firma}}' WHERE schluessel='kopf'`);
  const bausteine = await H.db.many(`SELECT * FROM prompt_bausteine ORDER BY sortierung`);
  const inhalte = await H.db.many(`SELECT * FROM inhalte_seiten WHERE projekt_id=$1`, [p.id]);
  const r = promptgen.generate(p, inhalte, bausteine, 'Pizza Pia');
  assert.match(r.text, /KOPF-NEU Pizza Pia/);
});

test('Prompt-Seite rendert Kopier-Button + Prompt-Box (DOM)', async () => {
  const { p } = await mkVollProjekt(true);
  const adminCookie = await H.loginAdmin(app);
  const res = await app.inject({ method: 'GET', url: '/admin/projekt/' + p.id + '/prompt', headers: { cookie: adminCookie } });
  assert.strictEqual(res.statusCode, 200);
  assert.match(res.body, /clipboard&&navigator\.clipboard\.writeText/);   // Kopier-Button
  assert.match(res.body, /id="promptbox"/);                                // kopierbare Box
  assert.match(res.body, /Pizza Pia/);                                     // generierter Inhalt
});
