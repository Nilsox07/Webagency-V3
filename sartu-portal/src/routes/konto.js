'use strict';
const db = require('../db');
const mailer = require('../mailer');
const { buildExport } = require('../export');

module.exports = async function (app) {
  const guard = { preHandler: app.requireKunde };
  const csrf = { preHandler: [app.requireKunde, app.csrfProtection] };

  app.get('/portal/konto', guard, async (req, reply) => {
    const offeneLoeschung = await db.one(`SELECT id FROM tickets WHERE kunde_id = $1 AND typ = 'loeschung' AND status = 'offen'`, [req.user.id]);
    return reply.view('pages/portal-konto', { title: 'Mein Konto', theme: 'kunde', user: req.user, csrf: reply.csrf(), offeneLoeschung: !!offeneLoeschung });
  });

  // DSGVO-Datenexport als ZIP (JSON + Dateien).
  app.get('/portal/konto/export', guard, async (req, reply) => {
    const buf = await buildExport(req.user.id);
    await db.audit('kunde', 'daten_export', null, req.ip, null, req.user.id);
    return reply.type('application/zip').header('content-disposition', 'attachment; filename="sartu-export.zip"').send(buf);
  });

  // Konto-Löschung beantragen — Ticket + 30-Tage-Hinweis; die eigentliche Löschung macht der Admin.
  app.post('/portal/konto/loeschung', csrf, async (req, reply) => {
    await db.query(`INSERT INTO tickets (kunde_id, typ, text) VALUES ($1,'loeschung',$2)`,
      [req.user.id, 'Konto-Löschung beantragt am ' + new Date().toISOString().slice(0, 10) + '.']);
    await db.audit('kunde', 'loeschung_beantragt', null, req.ip, null, req.user.id);
    const admin = await db.one(`SELECT email FROM admin_user ORDER BY created_at LIMIT 1`);
    await mailer.send(admin ? admin.email : (process.env.ADMIN_EMAIL || 'admin@sartu.de'),
      'Konto-Löschung beantragt', 'Kunde ' + req.user.kunde.email + ' hat die Löschung beantragt (30-Tage-Frist beachten; Rechnungen unterliegen der Aufbewahrungspflicht).');
    return reply.redirect('/portal/konto');
  });
};
