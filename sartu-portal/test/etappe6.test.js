'use strict';
// Etappe 6: /api/anfragen (echtes Lumi-Payload), Anfrage→Kunde+Projekt, Nachfass-Cron (Zeitraffer),
// DSGVO Export-ZIP + Löschung.
const { test, before, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const H = require('./helpers');
const { runNachfass } = require('../src/cron');

const PAYLOAD = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'lumi-payload.json'), 'utf8'));

let app;
before(async () => { app = await H.makeApp(); });
beforeEach(async () => {
  for (const t of ['anfragen', 'audit_log', 'tickets', 'kostenschaetzungen', 'inhalte_seiten', 'uploads', 'projekte', 'kunden', 'admin_user', 'mail_outbox']) {
    await H.db.query('DELETE FROM ' + t);
  }
});

test('/api/anfragen nimmt echtes Lumi-Payload an (Token nötig)', async () => {
  const bad = await app.inject({ method: 'POST', url: '/api/anfragen', payload: PAYLOAD });
  assert.strictEqual(bad.statusCode, 401);
  const ok = await app.inject({ method: 'POST', url: '/api/anfragen', headers: { 'x-anfrage-token': 'test-anfrage-token' }, payload: PAYLOAD });
  assert.strictEqual(ok.statusCode, 201);
  const a = await H.db.one(`SELECT payload, kontakt_email FROM anfragen LIMIT 1`);
  assert.strictEqual(a.kontakt_email, 'anna@cafe-sonne.de');
  assert.strictEqual(a.payload.konfiguration.paket, 'pro');
});

test('Anfrage → Ein-Klick Kunde + Projekt anlegen (audit_log)', async () => {
  await app.inject({ method: 'POST', url: '/api/anfragen', headers: { 'x-anfrage-token': 'test-anfrage-token' }, payload: PAYLOAD });
  const a = await H.db.one(`SELECT id FROM anfragen LIMIT 1`);
  const adminCookie = await H.loginAdmin(app);
  const res = await H.postCsrf(app, '/admin/anfragen', '/admin/anfragen/' + a.id + '/anlegen', {}, adminCookie);
  assert.strictEqual(res.statusCode, 302);
  const kunde = await H.db.one(`SELECT id FROM kunden WHERE email='anna@cafe-sonne.de'`);
  assert.ok(kunde);
  const proj = await H.db.one(`SELECT paket, status FROM projekte WHERE kunde_id=$1`, [kunde.id]);
  assert.strictEqual(proj.paket, 'pro');
  assert.strictEqual(proj.status, 'angebot');
  assert.ok(await H.db.one(`SELECT id FROM audit_log WHERE aktion='anfrage_angelegt'`));
});

test('Nachfass-Cron (Zeitraffer): Erinnerung nach 7 Tagen, dann Admin-Hinweis', async () => {
  const k = await H.createKunde('slow@kunde.de', 'Sam', 'Slow');
  const old = new Date(Date.now() - 9 * 86400000).toISOString();
  const p = await H.db.one(`INSERT INTO projekte (kunde_id,name,status,created_at) VALUES ($1,'P','inhalte',$2) RETURNING *`, [k.id, old]);
  await H.db.query(`INSERT INTO admin_user (email,pass_hash) VALUES ('a@s.de','x')`);

  let r = await runNachfass();
  assert.strictEqual(r.inhalteReminders, 1);
  let pr = await H.db.one(`SELECT nachfass_inhalte FROM projekte WHERE id=$1`, [p.id]);
  assert.strictEqual(pr.nachfass_inhalte, 1);
  assert.ok(await H.db.one(`SELECT id FROM mail_outbox WHERE an='slow@kunde.de'`));

  r = await runNachfass(); assert.strictEqual(r.inhalteReminders, 1); // 2. Erinnerung
  r = await runNachfass(); // jetzt >=2 -> Admin-Hinweis
  assert.strictEqual(r.adminHinweise, 1);
  assert.strictEqual(r.inhalteReminders, 0);
});

test('Nachfass-Cron: offene Kostenschätzung nach 5 Tagen erinnert (einmalig)', async () => {
  const k = await H.createKunde('cs@kunde.de', 'Cs', 'C');
  const p = await H.db.one(`INSERT INTO projekte (kunde_id,name) VALUES ($1,'P') RETURNING id`, [k.id]);
  const old = new Date(Date.now() - 6 * 86400000).toISOString();
  await H.db.query(`INSERT INTO kostenschaetzungen (projekt_id,beschreibung,minuten_geschaetzt,betrag,status,created_at) VALUES ($1,'X',60,150,'offen',$2)`, [p.id, old]);
  const r1 = await runNachfass(); assert.strictEqual(r1.schaetzungReminders, 1);
  const r2 = await runNachfass(); assert.strictEqual(r2.schaetzungReminders, 0); // nicht doppelt
});

test('DSGVO Export-ZIP enthält JSON mit den Kundendaten', async () => {
  const k = await H.createKunde('exp@kunde.de', 'Ex', 'Export GmbH');
  const cookie = await H.loginKunde(app, k.id);
  const res = await app.inject({ method: 'GET', url: '/portal/konto/export', headers: { cookie } });
  assert.strictEqual(res.statusCode, 200);
  const buf = res.rawPayload;
  assert.strictEqual(buf.slice(0, 2).toString(), 'PK');         // gültiges ZIP
  assert.ok(buf.includes(Buffer.from('export.json')));         // Eintrag vorhanden
  assert.ok(buf.includes(Buffer.from('exp@kunde.de')));        // Store -> Inhalt im Klartext enthalten
});

test('Konto-Löschung beantragen → Ticket + audit_log; Admin löscht Kunde (CASCADE)', async () => {
  const k = await H.createKunde('del@kunde.de', 'Del', 'D');
  await H.db.query(`INSERT INTO projekte (kunde_id,name) VALUES ($1,'P')`, [k.id]);
  const cookie = await H.loginKunde(app, k.id);
  await H.postCsrf(app, '/portal/konto', '/portal/konto/loeschung', {}, cookie);
  assert.ok(await H.db.one(`SELECT id FROM tickets WHERE typ='loeschung' AND kunde_id=$1`, [k.id]));
  assert.ok(await H.db.one(`SELECT id FROM audit_log WHERE aktion='loeschung_beantragt'`));

  const adminCookie = await H.loginAdmin(app);
  const res = await H.postCsrf(app, '/admin/kunde/' + k.id, '/admin/kunde/' + k.id + '/loeschen', {}, adminCookie);
  assert.strictEqual(res.statusCode, 302);
  assert.strictEqual(await H.db.one(`SELECT id FROM kunden WHERE id=$1`, [k.id]), null);
  assert.strictEqual(await H.db.one(`SELECT id FROM projekte WHERE kunde_id=$1`, [k.id]), null); // CASCADE
  assert.ok(await H.db.one(`SELECT id FROM audit_log WHERE aktion='kunde_geloescht'`));
});
