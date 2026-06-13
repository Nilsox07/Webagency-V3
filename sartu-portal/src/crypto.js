'use strict';
// AES-256-GCM für sensible Zugangsdaten (Domain-AuthCode, Alt-Website-Login, Google-Profil).
// Schlüssel aus ENV (ENC_KEY, 32 Byte hex). Ohne Schlüssel: deterministischer Dev-Fallback
// (NUR Entwicklung/Tests — Produktion MUSS ENC_KEY setzen, siehe .env.example).
const crypto = require('crypto');
const config = require('./config');

function key() {
  if (config.encKey && /^[0-9a-fA-F]{64}$/.test(config.encKey)) return Buffer.from(config.encKey, 'hex');
  return crypto.createHash('sha256').update('sartu-dev-key|' + config.cookieSecret).digest();
}

function encrypt(plain) {
  if (plain == null || plain === '') return null;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64');
}

function decrypt(blob) {
  if (!blob) return null;
  try {
    const raw = Buffer.from(blob, 'base64');
    const iv = raw.subarray(0, 12), tag = raw.subarray(12, 28), enc = raw.subarray(28);
    const d = crypto.createDecipheriv('aes-256-gcm', key(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
  } catch (e) { return null; }
}

// Maskierte Anzeige nach dem Speichern (nie Klartext im UI nach Eingabe).
function mask(s) {
  if (!s) return '';
  const v = String(s);
  return v.length <= 4 ? '••••' : '••••' + v.slice(-4);
}

// Token-Hash (Magic-Link): nur der Hash wird gespeichert, nie das Klartext-Token.
function sha256(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }

module.exports = { encrypt, decrypt, mask, sha256 };
