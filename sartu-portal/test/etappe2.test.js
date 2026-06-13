'use strict';
// Etappe 2: Angebot-Annahme (audit_log), Inhalte-Vollständigkeits-Gating (+audit, Countdown-Start),
// Zugänge verschlüsselt gespeichert.
const { test, before, beforeEach } = require('node:test');
const assert = require('node:assert');
const H = require('./helpers');
const L = require('../src/projektlogik');
const enc = require('../src/crypto');

let app, kunde, cookie;

before(async () => { app = await H.makeApp(); });
beforeEach(async () => {
  await H.db.query('DELETE FROM audit_log'); await H.db.query('DELETE FROM angebote');
  await H.db.query('DELETE FROM inhalte_seiten'); await H.db.query('DELETE FROM zugaenge');
  await H.db.query('DELETE FROM projekte'); await H.db.query('DELETE FROM kunden');
  kunde = await H.createKunde('e2@kunde.de', 'Eva', 'E2 GmbH');
  cookie = await H.loginKunde(app, kunde.id);
});

async function mkProjekt(fields) {
  const f = Object.assign({ name: 'P', paket: 'pro', status: 'angebot', is_redesign: false, liefertermin: '2026-08-01' }, fields);
  return H.db.one(
    `INSERT INTO projekte (kunde_id,name,paket,status,is_redesign,liefertermin) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [kunde.id, f.name, f.paket, f.status, f.is_redesign, f.liefertermin]
  );
}

test('Angebot annehmen schreibt audit_log + setzt Status angenommen', async () => {
  const p = await mkProjekt({ status: 'angebot' });
  await H.db.query(`INSERT INTO angebote (projekt_id,betrag_einmalig,betrag_monatlich,agb_version) VALUES ($1,2990,99,'v1')`, [p.id]);
  const base = '/portal/projekt/' + p.id;
  const res = await H.postCsrf(app, base + '/dokumente', base + '/angebot/annehmen', { agb: 'on' }, cookie);
  assert.strictEqual(res.statusCode, 302);
  const ang = await H.db.one('SELECT angenommen_am, angenommen_ip FROM angebote WHERE projekt_id=$1', [p.id]);
  assert.ok(ang.angenommen_am, 'angenommen_am gesetzt');
  const pr = await H.db.one('SELECT status FROM projekte WHERE id=$1', [p.id]);
  assert.strictEqual(pr.status, 'angenommen');
  const log = await H.db.one(`SELECT actor, aktion, ziel, details FROM audit_log WHERE aktion='angebot_angenommen'`);
  assert.ok(log, 'audit_log-Eintrag vorhanden');
  assert.strictEqual(log.actor, 'kunde');
});

test('Angebot annehmen OHNE AGB-Haken: kein audit_log, Status bleibt', async () => {
  const p = await mkProjekt({ status: 'angebot' });
  await H.db.query(`INSERT INTO angebote (projekt_id) VALUES ($1)`, [p.id]);
  const base = '/portal/projekt/' + p.id;
  const res = await H.postCsrf(app, base + '/dokumente', base + '/angebot/annehmen', {}, cookie);
  assert.strictEqual(res.statusCode, 302);
  assert.match(res.headers.location, /fehler=agb/);
  const pr = await H.db.one('SELECT status FROM projekte WHERE id=$1', [p.id]);
  assert.strictEqual(pr.status, 'angebot');
  const log = await H.db.one(`SELECT id FROM audit_log WHERE aktion='angebot_angenommen'`);
  assert.strictEqual(log, null);
});

test('„Alles vollständig" greift erst, wenn alle Seiten genug Stichpunkte haben; setzt audit + Countdown', async () => {
  const p = await mkProjekt({ status: 'inhalte' });
  const s1 = await H.createInhalt(p.id, 'Startseite');
  const s2 = await H.createInhalt(p.id, 'Kontakt');
  const base = '/portal/projekt/' + p.id;

  // Zu wenig Stichpunkte -> Schalter wirkt nicht (Status bleibt inhalte, Countdown null)
  const tooFew = await H.postCsrf(app, base + '/inhalte', base + '/fertig', {}, cookie);
  assert.match(tooFew.headers.location, /fehler=unvollstaendig/);
  let pr = await H.db.one('SELECT status, inhalte_vollstaendig_am, liefertermin FROM projekte WHERE id=$1', [p.id]);
  assert.strictEqual(pr.status, 'inhalte');
  assert.strictEqual(L.countdownDays(pr), null);

  // Beide Seiten füllen (>= 5 Zeilen) über die echte Route
  const fuenf = 'a\nb\nc\nd\ne';
  await H.postCsrf(app, base + '/inhalte', base + '/inhalte/' + s1.id, { stichpunkte: fuenf }, cookie);
  await H.postCsrf(app, base + '/inhalte', base + '/inhalte/' + s2.id, { stichpunkte: fuenf }, cookie);
  const seiten = await H.db.many('SELECT status FROM inhalte_seiten WHERE projekt_id=$1', [p.id]);
  assert.ok(seiten.every((s) => s.status === 'vollstaendig'));

  // Jetzt greift „Alles vollständig"
  const ok = await H.postCsrf(app, base + '/inhalte', base + '/fertig', {}, cookie);
  assert.strictEqual(ok.statusCode, 302);
  pr = await H.db.one('SELECT status, inhalte_vollstaendig_am, liefertermin FROM projekte WHERE id=$1', [p.id]);
  assert.strictEqual(pr.status, 'design');
  assert.ok(pr.inhalte_vollstaendig_am, 'inhalte_vollstaendig_am gesetzt');
  assert.notStrictEqual(L.countdownDays(pr), null);
  const log = await H.db.one(`SELECT id FROM audit_log WHERE aktion='inhalte_vollstaendig'`);
  assert.ok(log);
});

test('Zugänge werden verschlüsselt gespeichert (kein Klartext), Round-Trip + Maske', async () => {
  const p = await mkProjekt({ status: 'inhalte' });
  const base = '/portal/projekt/' + p.id;
  await H.postCsrf(app, base + '/inhalte', base + '/zugaenge', { domain_authcode: 'GEHEIM-AUTH-9999' }, cookie);
  const z = await H.db.one('SELECT domain_authcode_enc FROM zugaenge WHERE projekt_id=$1', [p.id]);
  assert.ok(z && z.domain_authcode_enc, 'verschlüsselter Wert gespeichert');
  assert.ok(!/GEHEIM-AUTH-9999/.test(z.domain_authcode_enc), 'kein Klartext in der DB');
  assert.strictEqual(enc.decrypt(z.domain_authcode_enc), 'GEHEIM-AUTH-9999');
  assert.strictEqual(enc.mask('GEHEIM-AUTH-9999'), '••••9999');
});
