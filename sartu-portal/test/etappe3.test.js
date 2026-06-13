'use strict';
// Etappe 3: Pin anlegen → Runde einreichen (zählt hoch, danach read-only) → Abnahme / Geld-zurück-Garantie.
const { test, before, beforeEach } = require('node:test');
const assert = require('node:assert');
const H = require('./helpers');

let app, kunde, cookie;
before(async () => { app = await H.makeApp(); });
beforeEach(async () => {
  await H.db.query('DELETE FROM audit_log'); await H.db.query('DELETE FROM pins');
  await H.db.query('DELETE FROM korrekturrunden'); await H.db.query('DELETE FROM tickets');
  await H.db.query('DELETE FROM projekte'); await H.db.query('DELETE FROM kunden');
  kunde = await H.createKunde('e3@kunde.de', 'Tom', 'E3 GmbH');
  cookie = await H.loginKunde(app, kunde.id);
});
async function mkProjekt(status, rundenVerbraucht) {
  return H.db.one(`INSERT INTO projekte (kunde_id,name,status,runden_max,runden_verbraucht) VALUES ($1,'P',$2,3,$3) RETURNING *`,
    [kunde.id, status, rundenVerbraucht || 0]);
}

test('Pin anlegen → einreichen: Runde zählt hoch, Pins danach read-only (409), audit_log', async () => {
  const p = await mkProjekt('design', 0);
  const base = '/portal/projekt/' + p.id;
  // Pin anlegen (öffnet Runde 1)
  const pinRes = await H.postCsrf(app, base + '/vorschau', base + '/pins', { css_selektor: '.hero h1', text: 'Bitte größer', viewport_breite: '1280' }, cookie);
  assert.strictEqual(pinRes.statusCode, 200);
  assert.strictEqual(JSON.parse(pinRes.body).ok, true);
  const runde = await H.db.one(`SELECT * FROM korrekturrunden WHERE projekt_id=$1`, [p.id]);
  assert.ok(runde && runde.status === 'offen' && runde.runde === 1);

  // Einreichen
  const sub = await H.postCsrf(app, base + '/vorschau', base + '/runde/einreichen', {}, cookie);
  assert.strictEqual(sub.statusCode, 302);
  const pr = await H.db.one(`SELECT status, runden_verbraucht FROM projekte WHERE id=$1`, [p.id]);
  assert.strictEqual(pr.runden_verbraucht, 1);
  assert.strictEqual(pr.status, 'korrektur_1');
  const r2 = await H.db.one(`SELECT status FROM korrekturrunden WHERE id=$1`, [runde.id]);
  assert.strictEqual(r2.status, 'eingereicht');
  const log = await H.db.one(`SELECT details FROM audit_log WHERE aktion='runde_eingereicht'`);
  assert.ok(log);

  // Pins jetzt read-only (Status nicht mehr 'design') → 409
  const blocked = await H.postCsrf(app, base + '/vorschau', base + '/pins', { css_selektor: 'x', text: 'noch was' }, cookie);
  assert.strictEqual(blocked.statusCode, 409);
});

test('Abnahme annehmen → Status live + audit_log', async () => {
  const p = await mkProjekt('abnahme', 1);
  const base = '/portal/projekt/' + p.id;
  const res = await H.postCsrf(app, base + '/abnahme', base + '/abnahme/annehmen', {}, cookie);
  assert.strictEqual(res.statusCode, 302);
  const pr = await H.db.one(`SELECT status FROM projekte WHERE id=$1`, [p.id]);
  assert.strictEqual(pr.status, 'live');
  assert.ok(await H.db.one(`SELECT id FROM audit_log WHERE aktion='abnahme_angenommen'`));
});

test('Geld-zurück-Garantie nur beim 1. Entwurf → Ticket + audit_log, KEINE Zahlung', async () => {
  const p = await mkProjekt('abnahme', 0); // 1. Entwurf
  const base = '/portal/projekt/' + p.id;
  const res = await H.postCsrf(app, base + '/abnahme', base + '/abnahme/garantie', { grund: 'gefällt nicht' }, cookie);
  assert.strictEqual(res.statusCode, 302);
  const ticket = await H.db.one(`SELECT typ, text FROM tickets WHERE typ='abnahme_garantie'`);
  assert.ok(ticket, 'Ticket angelegt');
  assert.ok(await H.db.one(`SELECT id FROM audit_log WHERE aktion='abnahme_garantie'`));
  // Status bleibt abnahme (keine automatische Aktion)
  const pr = await H.db.one(`SELECT status FROM projekte WHERE id=$1`, [p.id]);
  assert.strictEqual(pr.status, 'abnahme');
});

test('Garantie NICHT mehr möglich nach Runden (kein Ticket)', async () => {
  const p = await mkProjekt('abnahme', 2);
  const base = '/portal/projekt/' + p.id;
  const res = await H.postCsrf(app, base + '/abnahme', base + '/abnahme/garantie', {}, cookie);
  assert.match(res.headers.location, /nicht_moeglich/);
  assert.strictEqual(await H.db.one(`SELECT id FROM tickets WHERE typ='abnahme_garantie'`), null);
});

test('Vorschau eines fremden Projekt-Tokens → 404 (Mandanten-Schutz)', async () => {
  const other = await H.createKunde('fremd@kunde.de', 'Fremd', 'F');
  const op = await H.db.one(`INSERT INTO projekte (kunde_id,name) VALUES ($1,'F') RETURNING vorschau_token`, [other.id]);
  const res = await app.inject({ method: 'GET', url: '/vorschau/' + op.vorschau_token + '/index.html', headers: { cookie } });
  assert.strictEqual(res.statusCode, 404);
});
