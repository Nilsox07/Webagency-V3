'use strict';
// Lumi-Anfragen-Eingang. Nimmt das EXISTIERENDE Lumi-Payload (collect()) unverändert an.
// Token-geschützt (ANFRAGEN_TOKEN). Format-Vertrag: docs/payload.md.
const db = require('../db');

module.exports = async function (app) {
  app.post('/api/anfragen', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
    const token = req.headers['x-anfrage-token'] || (req.body && req.body.token) || req.query.token;
    const expected = process.env.ANFRAGEN_TOKEN || '';
    if (!expected || token !== expected) return reply.code(401).send({ ok: false, grund: 'Token fehlt/falsch.' });
    const payload = req.body || {};
    if (typeof payload !== 'object') return reply.code(400).send({ ok: false });
    const k = (payload.kontakt) || {};
    await db.query(`INSERT INTO anfragen (payload, kontakt_email, kontakt_name) VALUES ($1,$2,$3)`,
      [JSON.stringify(payload), k.email || null, k.name || null]);
    return reply.code(201).send({ ok: true });
  });
};
