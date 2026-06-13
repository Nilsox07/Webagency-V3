'use strict';
const db = require('../db');

module.exports = async function (app) {
  app.get('/admin', { preHandler: app.requireAdmin }, async (req, reply) => {
    const kunden = await db.many(
      `SELECT k.*, (SELECT count(*) FROM projekte p WHERE p.kunde_id = k.id) AS projekte
         FROM kunden k WHERE geloescht_am IS NULL ORDER BY created_at`
    );
    return reply.view('pages/admin-dashboard', { title: 'Admin', theme: 'admin', user: req.user, csrf: reply.csrf(), kunden });
  });

  app.get('/admin/kunde/:id', { preHandler: app.requireAdmin }, async (req, reply) => {
    const kunde = await db.one(`SELECT * FROM kunden WHERE id = $1`, [req.params.id]);
    if (!kunde) return reply.callNotFound();
    const projekte = await db.many(`SELECT * FROM projekte WHERE kunde_id = $1 ORDER BY created_at`, [req.params.id]);
    return reply.view('pages/admin-kunde', { title: kunde.firma || kunde.email, theme: 'admin', user: req.user, csrf: reply.csrf(), kunde, projekte });
  });
};
