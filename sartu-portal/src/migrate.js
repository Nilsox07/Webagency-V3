'use strict';
// Führt Migrationen aus migrations/*.sql aus (einmalig, idempotent via schema_migrations).
// Statement-für-Statement, damit es auf echtem Postgres UND pg-mem (Tests) läuft.
const fs = require('fs');
const path = require('path');
const db = require('./db');

function splitStatements(sql) {
  return sql
    .split('\n').map(l => { const i = l.indexOf('--'); return i >= 0 ? l.slice(0, i) : l; }).join('\n') // Kommentare (auch inline) raus
    .split(';')
    .map(s => s.trim())
    .filter(Boolean);
}

async function migrate() {
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  const dir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  for (const f of files) {
    const done = await db.one(`SELECT name FROM schema_migrations WHERE name = $1`, [f]);
    if (done) continue;
    const stmts = splitStatements(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const s of stmts) await db.query(s);
    await db.query(`INSERT INTO schema_migrations (name) VALUES ($1)`, [f]);
    if (require.main === module) console.log('migriert:', f, '(' + stmts.length + ' Statements)');
  }
}

if (require.main === module) {
  migrate()
    .then(() => { console.log('Migrationen fertig.'); process.exit(0); })
    .catch((e) => { console.error('Migration fehlgeschlagen:', e.message); process.exit(1); });
}
module.exports = { migrate, splitStatements };
