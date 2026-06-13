'use strict';
const db = require('../db');

// Alle Routen mandanten-gefiltert: projektForKunde/uploadForKunde erzwingen kunde_id
// aus der Session (req.user.id) — niemals aus Request-Parametern.
module.exports = async function (app) {
  app.get('/portal', { preHandler: app.requireKunde }, async (req, reply) => {
    const projekte = await db.projekteOfKunde(req.user.id);
    return reply.view('pages/portal-dashboard', { title: 'Dein Portal', theme: 'kunde', user: req.user, csrf: reply.csrf(), projekte });
  });

  app.get('/portal/projekt/:id', { preHandler: app.requireKunde }, async (req, reply) => {
    const projekt = await db.projektForKunde(req.user.id, req.params.id);
    if (!projekt) return reply.callNotFound();
    const inhalte = await db.many(`SELECT * FROM inhalte_seiten WHERE projekt_id = $1 ORDER BY sort`, [projekt.id]);
    const meilensteine = await db.many(`SELECT * FROM meilensteine WHERE projekt_id = $1 ORDER BY sort`, [projekt.id]);
    return reply.view('pages/portal-projekt', { title: projekt.name || 'Projekt', theme: 'kunde', user: req.user, csrf: reply.csrf(), projekt, inhalte, meilensteine });
  });

  app.get('/portal/projekt/:id/inhalte', { preHandler: app.requireKunde }, async (req, reply) => {
    const projekt = await db.projektForKunde(req.user.id, req.params.id);
    if (!projekt) return reply.callNotFound();
    const inhalte = await db.many(`SELECT * FROM inhalte_seiten WHERE projekt_id = $1 ORDER BY sort`, [projekt.id]);
    return reply.view('pages/portal-inhalte', { title: 'Inhalte', theme: 'kunde', user: req.user, csrf: reply.csrf(), projekt, inhalte });
  });

  // Datei-Download (mandanten-gefiltert). Etappe 1: Besitzprüfung + 404 bei Fremdzugriff.
  app.get('/portal/upload/:id', { preHandler: app.requireKunde }, async (req, reply) => {
    const up = await db.uploadForKunde(req.user.id, req.params.id);
    if (!up) return reply.callNotFound();
    return reply.send({ id: up.id, dateiname: up.dateiname, typ: up.typ }); // Streaming folgt in Etappe 2/3
  });
};
