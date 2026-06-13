'use strict';
const db = require('../db');
const care = require('../care');

module.exports = async function (app) {
  const acsrf = { preHandler: [app.requireAdmin, app.csrfProtection] };
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

  app.post('/admin/pin/:id/erledigt', acsrf, async (req, reply) => {
    const pin = await db.one(`SELECT p.id, k.projekt_id FROM pins p JOIN korrekturrunden k ON k.id = p.runde_id WHERE p.id = $1`, [req.params.id]);
    if (!pin) return reply.callNotFound();
    await db.query(`UPDATE pins SET status = 'erledigt' WHERE id = $1`, [pin.id]);
    return reply.redirect('/admin/projekt/' + pin.projekt_id);
  });

  // Care-Buchung: Minuten NUR in 5er-Schritten. Referenziert optional eine Kostenschätzung,
  // die dann FREIGEGEBEN sein muss (Pflicht-Freigabe vor Buchung).
  app.post('/admin/projekt/:id/buchung', acsrf, async (req, reply) => {
    const projekt = await db.one(`SELECT id FROM projekte WHERE id = $1`, [req.params.id]);
    if (!projekt) return reply.callNotFound();
    const minuten = parseInt(req.body.minuten, 10);
    if (!care.valid5er(minuten)) return reply.code(400).send({ ok: false, grund: 'Minuten nur in 5er-Schritten (> 0).' });
    if (req.body.schaetzung_id) {
      const s = await db.one(`SELECT status FROM kostenschaetzungen WHERE id = $1 AND projekt_id = $2`, [req.body.schaetzung_id, projekt.id]);
      if (!s || s.status !== 'freigegeben') return reply.code(409).send({ ok: false, grund: 'Diese Arbeit braucht erst die Freigabe der Kostenschätzung.' });
    }
    const sprach = Math.max(1, parseInt(req.body.sprachversion || '1', 10));
    const typ = req.body.typ === 'stoerung' ? 'stoerung' : 'aenderung';
    await db.query(`INSERT INTO care_buchungen (projekt_id, minuten, beschreibung, sprachversion, typ) VALUES ($1,$2,$3,$4,$5)`,
      [projekt.id, minuten, String(req.body.beschreibung || ''), sprach, typ]);
    return reply.redirect('/admin/projekt/' + projekt.id);
  });

  // Kostenschätzung anlegen: €-Betrag = 150 €/Std anteilig, automatisch aus den Minuten.
  app.post('/admin/projekt/:id/schaetzung', acsrf, async (req, reply) => {
    const projekt = await db.one(`SELECT id FROM projekte WHERE id = $1`, [req.params.id]);
    if (!projekt) return reply.callNotFound();
    const minuten = parseInt(req.body.minuten_geschaetzt, 10) || 0;
    await db.query(`INSERT INTO kostenschaetzungen (projekt_id, beschreibung, minuten_geschaetzt, betrag) VALUES ($1,$2,$3,$4)`,
      [projekt.id, String(req.body.beschreibung || ''), minuten, care.estimateEuro(minuten)]);
    return reply.redirect('/admin/projekt/' + projekt.id);
  });

  app.get('/admin/tickets', { preHandler: app.requireAdmin }, async (req, reply) => {
    const typ = req.query.typ || '';
    const tickets = typ
      ? await db.many(`SELECT t.*, k.email FROM tickets t JOIN kunden k ON k.id = t.kunde_id WHERE t.typ = $1 ORDER BY t.created_at DESC`, [typ])
      : await db.many(`SELECT t.*, k.email FROM tickets t JOIN kunden k ON k.id = t.kunde_id ORDER BY t.created_at DESC`);
    return reply.view('pages/admin-tickets', { title: 'Tickets', theme: 'admin', user: req.user, csrf: reply.csrf(), tickets, typ });
  });
};
