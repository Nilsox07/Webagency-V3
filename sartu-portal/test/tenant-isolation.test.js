'use strict';
// UNANTASTBARER Mandanten-Trennungs-Test: Kunde A darf NIE eine Ressource von Kunde B sehen.
// Wird in jeder Etappe um neue kunden-bezogene Routen erweitert.
const { test, before } = require('node:test');
const assert = require('node:assert');
const H = require('./helpers');

let app, A, B, projA, projB, upB, inhB;

before(async () => {
  app = await H.makeApp();
  A = await H.createKunde('a@kunde.de', 'Anna', 'Firma A');
  B = await H.createKunde('b@kunde.de', 'Ben', 'Firma B');
  projA = await H.createProjekt(A.id, 'A-Projekt');
  projB = await H.createProjekt(B.id, 'B-Projekt');
  upB = await H.createUpload(B.id, projB.id);
  inhB = await H.createInhalt(projB.id);
});

// Jede kunden-bezogene GET-Route, die eine Ressourcen-ID entgegennimmt.
function scopedRoutes(idB, upBId) {
  return [
    '/portal/projekt/' + idB,
    '/portal/projekt/' + idB + '/inhalte',
    '/portal/upload/' + upBId,
  ];
}

test('Kunde A bekommt auf KEINE Route von Kunde B Zugriff (403/404)', async () => {
  const cookieA = await H.loginKunde(app, A.id);
  for (const url of scopedRoutes(projB.id, upB.id)) {
    const res = await app.inject({ method: 'GET', url, headers: { cookie: cookieA } });
    assert.ok([403, 404].includes(res.statusCode), `${url} → ${res.statusCode} (erwartet 403/404)`);
  }
});

test('Kunde A bekommt seine EIGENEN Ressourcen (200)', async () => {
  const cookieA = await H.loginKunde(app, A.id);
  const res = await app.inject({ method: 'GET', url: '/portal/projekt/' + projA.id, headers: { cookie: cookieA } });
  assert.strictEqual(res.statusCode, 200);
  assert.ok(/A-Projekt/.test(res.body));
});

test('Ohne Login: kunden-Routen leiten zur Anmeldung (kein Datenleck)', async () => {
  for (const url of scopedRoutes(projB.id, upB.id)) {
    const res = await app.inject({ method: 'GET', url });
    assert.ok([302, 401, 403].includes(res.statusCode), `${url} → ${res.statusCode}`);
    if (res.statusCode === 302) assert.match(res.headers.location, /\/login/);
  }
});

test('Kunde A darf KEINE POST-Route von Kunde B auslösen (403/404)', async () => {
  const cookieA = await H.loginKunde(app, A.id);
  const posts = [
    '/portal/projekt/' + projB.id + '/fertig',
    '/portal/projekt/' + projB.id + '/angebot/annehmen',
    '/portal/projekt/' + projB.id + '/zugaenge',
    '/portal/projekt/' + projB.id + '/inhalte/' + inhB.id,
  ];
  for (const url of posts) {
    const res = await app.inject({ method: 'POST', url, headers: { cookie: cookieA, 'content-type': 'application/x-www-form-urlencoded' }, payload: 'x=1' });
    assert.ok([403, 404].includes(res.statusCode), `${url} → ${res.statusCode} (erwartet 403/404)`);
  }
});

test('kunde_id wird NIE aus Request-Parametern übernommen (Projekt-Query bleibt gefiltert)', async () => {
  // Selbst wenn A eingeloggt ist und B's Projekt-ID rät: db-Helfer filtert auf A.id → null → 404.
  const cookieA = await H.loginKunde(app, A.id);
  const res = await app.inject({ method: 'GET', url: '/portal/projekt/' + projB.id, headers: { cookie: cookieA } });
  assert.strictEqual(res.statusCode, 404);
  assert.ok(!new RegExp(projB.name).test(res.body), 'B-Projektname darf nicht im Body auftauchen');
});
