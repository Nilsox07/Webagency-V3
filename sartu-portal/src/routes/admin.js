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

  // Projekt-Detail mit Pin-Listen je Korrekturrunde (Klick öffnet Vorschau an der Stelle).
  app.get('/admin/projekt/:id', { preHandler: app.requireAdmin }, async (req, reply) => {
    const projekt = await db.one(`SELECT * FROM projekte WHERE id = $1`, [req.params.id]);
    if (!projekt) return reply.callNotFound();
    const runden = await db.many(`SELECT * FROM korrekturrunden WHERE projekt_id = $1 ORDER BY runde`, [projekt.id]);
    for (const r of runden) r.pins = await db.many(`SELECT * FROM pins WHERE runde_id = $1 ORDER BY created_at`, [r.id]);
    return reply.view('pages/admin-projekt', { title: projekt.name || 'Projekt', theme: 'admin', user: req.user, csrf: reply.csrf(), projekt, runden });
  });

  app.post('/admin/pin/:id/erledigt', { preHandler: [app.requireAdmin, app.csrfProtection] }, async (req, reply) => {
    const pin = await db.one(`SELECT p.id, k.projekt_id FROM pins p JOIN korrekturrunden k ON k.id = p.runde_id WHERE p.id = $1`, [req.params.id]);
    if (!pin) return reply.callNotFound();
    await db.query(`UPDATE pins SET status = 'erledigt' WHERE id = $1`, [pin.id]);
    return reply.redirect('/admin/projekt/' + pin.projekt_id);
  });
};
