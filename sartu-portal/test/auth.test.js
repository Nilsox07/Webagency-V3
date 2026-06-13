'use strict';
// Auth-Lebenszyklus: Magic-Link gültig / abgelaufen / benutzt; Admin-Login (Argon2); Logout.
const { test, before } = require('node:test');
const assert = require('node:assert');
const H = require('./helpers');

let app, kunde;

before(async () => {
  app = await H.makeApp();
  kunde = await H.createKunde('login@kunde.de', 'Lia', 'Login GmbH');
});

test('gültiger Magic-Link meldet an (302 → /portal, Session gesetzt)', async () => {
  const token = await H.auth.createMagicLink(kunde.id);
  const res = await app.inject({ method: 'GET', url: '/auth/' + token });
  assert.strictEqual(res.statusCode, 302);
  assert.match(res.headers.location, /\/portal/);
  assert.ok(H.getCookie(res, 'sid'), 'sid-Cookie muss gesetzt sein');
});

test('abgelaufener Magic-Link wird abgelehnt (400)', async () => {
  const token = await H.auth.createMagicLink(kunde.id);
  // Ablaufdatum in die Vergangenheit setzen
  const { sha256 } = require('../src/crypto');
  await H.db.query(`UPDATE magic_links SET expires_at = now() - interval '1 hour' WHERE token_hash = $1`, [sha256(token)]);
  const res = await app.inject({ method: 'GET', url: '/auth/' + token });
  assert.strictEqual(res.statusCode, 400);
  assert.match(res.body, /abgelaufen/i);
});

test('benutzter Magic-Link funktioniert kein zweites Mal (400)', async () => {
  const token = await H.auth.createMagicLink(kunde.id);
  const first = await app.inject({ method: 'GET', url: '/auth/' + token });
  assert.strictEqual(first.statusCode, 302);
  const second = await app.inject({ method: 'GET', url: '/auth/' + token });
  assert.strictEqual(second.statusCode, 400);
});

test('Magic-Link wird nur als Hash gespeichert (nie Klartext)', async () => {
  const token = await H.auth.createMagicLink(kunde.id);
  const row = await H.db.one(`SELECT token_hash FROM magic_links ORDER BY created_at DESC LIMIT 1`);
  assert.notStrictEqual(row.token_hash, token);
  assert.match(row.token_hash, /^[0-9a-f]{64}$/);
});

test('Admin-Login: richtiges Passwort → 302 /admin, falsches → 401', async () => {
  const hash = await H.auth.hashPassword('geheim-123');
  await H.db.query(`INSERT INTO admin_user (email,pass_hash) VALUES ($1,$2)`, ['admin@sartu.de', hash]);
  const ok = await H.postCsrf(app, '/admin/login', '/admin/login', { email: 'admin@sartu.de', passwort: 'geheim-123' });
  assert.strictEqual(ok.statusCode, 302);
  assert.match(ok.headers.location, /\/admin/);
  const bad = await H.postCsrf(app, '/admin/login', '/admin/login', { email: 'admin@sartu.de', passwort: 'falsch' });
  assert.strictEqual(bad.statusCode, 401);
});

test('CSRF: POST /admin/login ohne Token wird abgelehnt (403)', async () => {
  const res = await app.inject({
    method: 'POST', url: '/admin/login',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    payload: 'email=admin@sartu.de&passwort=geheim-123',
  });
  assert.strictEqual(res.statusCode, 403);
});
