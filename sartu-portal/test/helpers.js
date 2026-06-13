'use strict';
// Hermetischer Test-Harness: pg-mem statt echtem Postgres (Docker im Sandbox nicht verfügbar).
// Fallback ist im MORGEN-REPORT/GO-LIVE dokumentiert; gegen echtes Postgres testet CI später.
process.env.NODE_ENV = 'test';
process.env.ENC_KEY = process.env.ENC_KEY || '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';
process.env.COOKIE_SECRET = process.env.COOKIE_SECRET || 'test-cookie-secret-0123456789-0123456789';
process.env.BASE_URL = 'http://localhost';

const crypto = require('crypto');
const { newDb, DataType } = require('pg-mem');
const db = require('../src/db');
const auth = require('../src/auth');
const { migrate } = require('../src/migrate');
const { buildApp } = require('../src/app');

async function makeApp() {
  const mem = newDb({ autoCreateForeignKeyIndices: true });
  mem.public.registerFunction({ name: 'gen_random_uuid', returns: DataType.uuid, implementation: () => crypto.randomUUID(), impure: true });
  const { Pool } = mem.adapters.createPg();
  db.setPool(new Pool());
  await migrate();
  const app = await buildApp({ logger: false });
  await app.ready();
  return app;
}

async function createKunde(email, name = 'Test', firma = 'Firma') {
  return db.one(`INSERT INTO kunden (email,name,firma) VALUES ($1,$2,$3) RETURNING *`, [email, name, firma]);
}
async function createProjekt(kundeId, name = 'Projekt') {
  return db.one(`INSERT INTO projekte (kunde_id,name) VALUES ($1,$2) RETURNING *`, [kundeId, name]);
}
async function createUpload(kundeId, projektId) {
  return db.one(`INSERT INTO uploads (kunde_id,projekt_id,typ,dateiname,pfad) VALUES ($1,$2,'dokument','x.pdf','/data/x.pdf') RETURNING *`, [kundeId, projektId]);
}
async function createInhalt(projektId, name = 'Startseite') {
  return db.one(`INSERT INTO inhalte_seiten (projekt_id,seitenname) VALUES ($1,$2) RETURNING *`, [projektId, name]);
}

function getCookie(res, name) { const c = (res.cookies || []).find((c) => c.name === name); return c ? c.value : null; }

// Kunde über den echten Magic-Link-Flow einloggen → signiertes sid-Cookie zurück.
async function loginKunde(app, kundeId) {
  const token = await auth.createMagicLink(kundeId);
  const res = await app.inject({ method: 'GET', url: '/auth/' + token });
  return 'sid=' + getCookie(res, 'sid');
}

// POST mit gültigem CSRF-Token (holt Token + _csrf-Cookie von einer GET-Formularseite).
async function postCsrf(app, formUrl, postUrl, fields, cookie) {
  const g = await app.inject({ method: 'GET', url: formUrl, headers: cookie ? { cookie } : {} });
  const csrfCookie = getCookie(g, '_csrf');
  const m = /name="_csrf" value="([^"]+)"/.exec(g.body || '');
  const token = m ? m[1] : '';
  const cookies = [csrfCookie ? '_csrf=' + csrfCookie : '', cookie || ''].filter(Boolean).join('; ');
  return app.inject({
    method: 'POST', url: postUrl,
    headers: { cookie: cookies, 'content-type': 'application/x-www-form-urlencoded' },
    payload: new URLSearchParams(Object.assign({}, fields, { _csrf: token })).toString(),
  });
}

module.exports = { makeApp, createKunde, createProjekt, createUpload, createInhalt, loginKunde, postCsrf, getCookie, db, auth };
