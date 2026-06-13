'use strict';
// Datenbank-Zugriff. Ein Pool, injizierbar (Tests nutzen pg-mem, Produktion echtes Postgres).
// SICHERHEITS-GRUNDGESETZ: kundenbezogene Lesezugriffe IMMER über die *ForKunde-Helfer,
// die kunde_id aus der Session erzwingen — niemals kunde_id aus Request-Parametern.
const config = require('./config');

let _pool = null;

function setPool(p) { _pool = p; }            // von Tests / Bootstrap gesetzt
function getPool() {
  if (!_pool) {
    const { Pool } = require('pg');
    _pool = new Pool({ connectionString: config.databaseUrl });
  }
  return _pool;
}

async function query(text, params) { return getPool().query(text, params); }
async function one(text, params) { const r = await query(text, params); return r.rows[0] || null; }
async function many(text, params) { const r = await query(text, params); return r.rows; }

async function tx(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw e;
  } finally {
    client.release();
  }
}

// Audit-Log: wer/was/wann/ip — für Angebot-Annahme, Abnahme, Freigaben, Runden, Löschungen.
async function audit(actor, aktion, ziel, ip, details, kundeId) {
  await query(
    `INSERT INTO audit_log (kunde_id, actor, aktion, ziel, ip, details) VALUES ($1,$2,$3,$4,$5,$6)`,
    [kundeId || null, actor || 'system', aktion, ziel || null, ip || null, details ? JSON.stringify(details) : null]
  );
}

/* ---- Mandanten-gefilterte Helfer (kunde_id ERZWUNGEN) ---- */
async function projektForKunde(kundeId, projektId) {
  return one(`SELECT * FROM projekte WHERE id = $1 AND kunde_id = $2`, [projektId, kundeId]);
}
async function projekteOfKunde(kundeId) {
  return many(`SELECT * FROM projekte WHERE kunde_id = $1 ORDER BY created_at`, [kundeId]);
}
async function uploadForKunde(kundeId, uploadId) {
  return one(`SELECT * FROM uploads WHERE id = $1 AND kunde_id = $2`, [uploadId, kundeId]);
}

module.exports = { setPool, getPool, query, one, many, tx, audit, projektForKunde, projekteOfKunde, uploadForKunde };
