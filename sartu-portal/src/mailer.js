'use strict';
// Entwicklungsmodus: jede Mail landet in mail_outbox + Konsole. Echter SMTP-Versand
// (mailbox.org via .env) ist GO-LIVE-TODO (nodemailer-Anbindung), Schnittstelle steht.
const db = require('./db');
const config = require('./config');

async function send(an, betreff, body) {
  const live = !!config.smtp.host;
  await db.query(
    `INSERT INTO mail_outbox (an, betreff, body, status, sent_at) VALUES ($1,$2,$3,$4,$5)`,
    [an, betreff, body, live ? 'gesendet' : 'offen', live ? new Date().toISOString() : null]
  );
  if (!live && config.env !== 'test') console.log(`\n[MAIL → ${an}] ${betreff}\n${body}\n`);
}

module.exports = { send };
