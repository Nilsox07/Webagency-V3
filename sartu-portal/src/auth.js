'use strict';
// Auth: Magic-Link (Kunde) + Passwort (Admin, Argon2) + DB-Sessions.
// Magic-Link-Token: 32 zufällige Bytes, NUR der SHA-256-Hash wird gespeichert,
// 15 Min gültig, genau einmal verwendbar.
const crypto = require('crypto');
const argon2 = require('argon2');
const db = require('./db');
const cfg = require('./config');
const { sha256 } = require('./crypto');

async function createMagicLink(kundeId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + cfg.magicTtlMin * 60 * 1000).toISOString();
  await db.query(
    `INSERT INTO magic_links (kunde_id, token_hash, expires_at) VALUES ($1,$2,$3)`,
    [kundeId, sha256(token), expires]
  );
  return token;
}

// Liefert kunde_id bei gültigem, unbenutztem, nicht abgelaufenem Token; sonst null.
async function consumeMagicLink(token) {
  if (!token) return null;
  const row = await db.one(
    `SELECT id, kunde_id FROM magic_links
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
    [sha256(token)]
  );
  if (!row) return null;
  await db.query(`UPDATE magic_links SET used_at = now() WHERE id = $1`, [row.id]);
  return row.kunde_id;
}

async function hashPassword(pw) { return argon2.hash(pw); }
async function verifyPassword(hash, pw) {
  try { return await argon2.verify(hash, pw); } catch (e) { return false; }
}

async function createSession(subjectType, subjectId) {
  const expires = new Date(Date.now() + cfg.sessionTtlDays * 86400 * 1000).toISOString();
  const secret = crypto.randomBytes(18).toString('hex');
  const row = await db.one(
    `INSERT INTO sessions (subject_type, subject_id, csrf_secret, expires_at)
       VALUES ($1,$2,$3,$4) RETURNING id`,
    [subjectType, subjectId, secret, expires]
  );
  return row.id;
}

async function loadSession(id) {
  if (!id) return null;
  return db.one(`SELECT * FROM sessions WHERE id = $1 AND expires_at > now()`, [id]);
}

async function destroySession(id) {
  if (id) await db.query(`DELETE FROM sessions WHERE id = $1`, [id]);
}

module.exports = {
  createMagicLink, consumeMagicLink,
  hashPassword, verifyPassword,
  createSession, loadSession, destroySession,
};
