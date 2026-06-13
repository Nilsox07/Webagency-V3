'use strict';
// DSGVO-Datenexport als ZIP (JSON + zugehörige Dateien). Verschlüsselte Zugänge werden
// NICHT im Klartext exportiert (nur als Vorhandensein vermerkt).
const fs = require('fs');
const db = require('./db');
const { zip } = require('./zip');

async function buildExport(kundeId) {
  const kunde = await db.one(`SELECT id,email,name,firma,telefon,created_at FROM kunden WHERE id = $1`, [kundeId]);
  const projekte = await db.many(`SELECT * FROM projekte WHERE kunde_id = $1`, [kundeId]);
  const uploads = await db.many(`SELECT * FROM uploads WHERE kunde_id = $1`, [kundeId]);
  const tickets = await db.many(`SELECT * FROM tickets WHERE kunde_id = $1`, [kundeId]);
  const inhalte = await db.many(`SELECT i.* FROM inhalte_seiten i JOIN projekte p ON p.id = i.projekt_id WHERE p.kunde_id = $1`, [kundeId]);
  const data = {
    exportiert_am: new Date().toISOString(),
    kunde, projekte, inhalte, tickets,
    uploads: uploads.map((u) => ({ id: u.id, typ: u.typ, dateiname: u.dateiname })),
    hinweis: 'Verschlüsselte Zugangsdaten sind aus Sicherheitsgründen nicht enthalten.',
  };
  const entries = [{ name: 'export.json', data: JSON.stringify(data, null, 2) }];
  for (const u of uploads) {
    try { if (u.pfad && fs.existsSync(u.pfad)) entries.push({ name: 'dateien/' + u.dateiname, data: fs.readFileSync(u.pfad) }); } catch (e) { /* überspringen */ }
  }
  return zip(entries);
}

module.exports = { buildExport };
