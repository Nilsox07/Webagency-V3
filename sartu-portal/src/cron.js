'use strict';
// Nachfass-Automatik (täglich). Zeit als Parameter -> Zeitraffer-testbar. Mails über mail_outbox.
const db = require('./db');
const mailer = require('./mailer');

async function adminEmail() {
  const a = await db.one(`SELECT email FROM admin_user ORDER BY created_at LIMIT 1`);
  return a ? a.email : (process.env.ADMIN_EMAIL || 'admin@sartu.de');
}

async function runNachfass(now) {
  now = now ? new Date(now) : new Date();
  const cut7 = new Date(now.getTime() - 7 * 86400000).toISOString();
  const cut5 = new Date(now.getTime() - 5 * 86400000).toISOString();
  const report = { inhalteReminders: 0, schaetzungReminders: 0, adminHinweise: 0 };

  // 1) Inhalte unvollständig seit > 7 Tagen — max 2 Erinnerungen, dann Admin-Hinweis.
  const stale = await db.many(
    `SELECT p.*, k.email FROM projekte p JOIN kunden k ON k.id = p.kunde_id
       WHERE p.status = 'inhalte' AND p.inhalte_vollstaendig_am IS NULL AND p.created_at < $1`, [cut7]);
  for (const p of stale) {
    if (p.nachfass_inhalte >= 2) {
      await mailer.send(await adminEmail(), 'Nachfass-Hinweis: Inhalte überfällig',
        'Projekt ' + (p.name || p.id) + ' (Kunde ' + p.email + ') hat seit über 7 Tagen unvollständige Inhalte — trotz 2 Erinnerungen.');
      report.adminHinweise++;
      continue;
    }
    await mailer.send(p.email, 'Erinnerung: deine Inhalte fehlen noch',
      'Hi, für deine Website fehlen noch ein paar Stichpunkte. Solange sie fehlen, verschiebt sich dein Liefertermin entsprechend. Schau gern kurz ins Portal.');
    await db.query(`UPDATE projekte SET nachfass_inhalte = nachfass_inhalte + 1 WHERE id = $1`, [p.id]);
    report.inhalteReminders++;
  }

  // 2) Offene Kostenschätzung > 5 Tage, noch nicht erinnert.
  const sch = await db.many(
    `SELECT s.*, k.email FROM kostenschaetzungen s JOIN projekte p ON p.id = s.projekt_id JOIN kunden k ON k.id = p.kunde_id
       WHERE s.status = 'offen' AND s.nachfass_am IS NULL AND s.created_at < $1`, [cut5]);
  for (const s of sch) {
    await mailer.send(s.email, 'Erinnerung: Kostenschätzung wartet auf dich',
      'Hi, eine Kostenschätzung wartet auf deine Freigabe. Erst nach deiner Freigabe legen wir los.');
    await db.query(`UPDATE kostenschaetzungen SET nachfass_am = $2 WHERE id = $1`, [s.id, now.toISOString()]);
    report.schaetzungReminders++;
  }
  return report;
}

module.exports = { runNachfass };
