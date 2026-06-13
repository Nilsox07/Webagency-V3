'use strict';
const fs = require('fs');
const path = require('path');
const db = require('../db');
const cfg = require('../config');
const mailer = require('../mailer');

async function notifyAdmin(betreff, body) {
  const admin = await db.one(`SELECT email FROM admin_user ORDER BY created_at LIMIT 1`);
  await mailer.send(admin ? admin.email : (process.env.ADMIN_EMAIL || 'admin@sartu.de'), betreff, body);
}
async function currentRunde(projektId) {
  return db.one(`SELECT * FROM korrekturrunden WHERE projekt_id = $1 AND status = 'offen' ORDER BY runde DESC LIMIT 1`, [projektId]);
}

module.exports = async function (app) {
  const guard = { preHandler: app.requireKunde };
  const csrf = { preHandler: [app.requireKunde, app.csrfProtection] };

  // Vorschau-Hosting: nur eingeloggter Besitzer; HTML bekommt das Pin-Overlay-Skript injiziert.
  app.get('/vorschau/:token/*', guard, async (req, reply) => {
    const projekt = await db.one(`SELECT * FROM projekte WHERE vorschau_token = $1 AND kunde_id = $2`, [req.params.token, req.user.id]);
    if (!projekt) return reply.callNotFound();
    const rel = (req.params['*'] || 'index.html').replace(/\.\.+/g, '');
    const base = path.join(cfg.vorschauDir, projekt.id);
    const file = path.join(base, rel);
    if (!file.startsWith(base) || !fs.existsSync(file)) return reply.callNotFound();
    if (/\.html?$/.test(file)) {
      let html = fs.readFileSync(file, 'utf8');
      const tag = `<script src="/public/pin-overlay.js" data-projekt="${projekt.id}" data-status="${projekt.status}"></script>`;
      html = html.includes('</body>') ? html.replace('</body>', tag + '</body>') : html + tag;
      return reply.type('text/html').send(html);
    }
    return reply.sendFile(rel, base);
  });

  // Vorschau-Seite im Portal (Rahmen + Runden-Status + Pin-Liste der aktuellen Runde).
  app.get('/portal/projekt/:id/vorschau', guard, async (req, reply) => {
    const projekt = await db.projektForKunde(req.user.id, req.params.id);
    if (!projekt) return reply.callNotFound();
    const runde = await currentRunde(projekt.id);
    const pins = runde ? await db.many(`SELECT * FROM pins WHERE runde_id = $1 ORDER BY created_at`, [runde.id]) : [];
    return reply.view('pages/portal-vorschau', {
      title: 'Vorschau', theme: 'kunde', user: req.user, csrf: reply.csrf(),
      projekt, runde, pins, kannEinreichen: projekt.status === 'design' && pins.length > 0,
      rundenUebrig: Math.max(0, (projekt.runden_max || 0) - (projekt.runden_verbraucht || 0)),
    });
  });

  // Pin anlegen — nur in der Design-Phase, in die aktuell offene Runde (Sammelkorb).
  app.post('/portal/projekt/:id/pins', csrf, async (req, reply) => {
    const projekt = await db.projektForKunde(req.user.id, req.params.id);
    if (!projekt) return reply.callNotFound();
    if (projekt.status !== 'design') return reply.code(409).send({ ok: false, grund: 'Pins gehen nur in der Design-Phase.' });
    let runde = await currentRunde(projekt.id);
    if (!runde) {
      runde = await db.one(`INSERT INTO korrekturrunden (projekt_id, runde, status) VALUES ($1,$2,'offen') RETURNING *`,
        [projekt.id, (projekt.runden_verbraucht || 0) + 1]);
    }
    const b = req.body || {};
    // Screenshot: Playwright im Sandbox nicht installiert -> DOM-Ausschnitt als Fallback (GO-LIVE-TODO).
    let screenshotPfad = '';
    if (b.dom_snippet) {
      try {
        const dir = path.join(cfg.uploadDir, 'pins', projekt.id);
        fs.mkdirSync(dir, { recursive: true });
        const f = path.join(dir, 'pin-' + Date.now() + '.html');
        fs.writeFileSync(f, String(b.dom_snippet));
        screenshotPfad = f;
      } catch (e) { /* Fallback ohne Datei */ }
    }
    const pin = await db.one(
      `INSERT INTO pins (runde_id, seite_pfad, css_selektor, offset_x, offset_y, viewport_breite, screenshot_pfad, text)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [runde.id, b.seite_pfad || '', b.css_selektor || '', parseInt(b.offset_x || 0, 10), parseInt(b.offset_y || 0, 10),
       parseInt(b.viewport_breite || 0, 10), screenshotPfad, b.text || '']);
    return reply.send({ ok: true, pinId: pin.id });
  });

  // Korrekturrunde einreichen — verbraucht eine Runde, Pins danach read-only, Mail + audit_log.
  app.post('/portal/projekt/:id/runde/einreichen', csrf, async (req, reply) => {
    const projekt = await db.projektForKunde(req.user.id, req.params.id);
    if (!projekt) return reply.callNotFound();
    const runde = await currentRunde(projekt.id);
    if (projekt.status !== 'design' || !runde) return reply.redirect('/portal/projekt/' + projekt.id + '/vorschau?fehler=keine_runde');
    const pins = await db.many(`SELECT id FROM pins WHERE runde_id = $1`, [runde.id]);
    if (!pins.length) return reply.redirect('/portal/projekt/' + projekt.id + '/vorschau?fehler=leer');
    if ((projekt.runden_verbraucht || 0) >= (projekt.runden_max || 0)) return reply.redirect('/portal/projekt/' + projekt.id + '/vorschau?fehler=max');
    await db.query(`UPDATE korrekturrunden SET status = 'eingereicht', eingereicht_am = now() WHERE id = $1`, [runde.id]);
    await db.query(`UPDATE projekte SET runden_verbraucht = runden_verbraucht + 1, status = $2 WHERE id = $1`, [projekt.id, 'korrektur_' + runde.runde]);
    await db.audit('kunde', 'runde_eingereicht', projekt.id, req.ip, { runde: runde.runde, pins: pins.length }, req.user.id);
    await notifyAdmin('Korrekturrunde ' + runde.runde + ' eingereicht', 'Kunde ' + req.user.kunde.email + ' hat Runde ' + runde.runde + ' mit ' + pins.length + ' Anmerkungen eingereicht.');
    return reply.redirect('/portal/projekt/' + projekt.id + '/vorschau');
  });

  // Abnahme-Screen + Aktionen.
  app.get('/portal/projekt/:id/abnahme', guard, async (req, reply) => {
    const projekt = await db.projektForKunde(req.user.id, req.params.id);
    if (!projekt) return reply.callNotFound();
    const ersterEntwurf = (projekt.runden_verbraucht || 0) === 0;
    return reply.view('pages/portal-abnahme', { title: 'Abnahme', theme: 'kunde', user: req.user, csrf: reply.csrf(), projekt, ersterEntwurf });
  });

  app.post('/portal/projekt/:id/abnahme/annehmen', csrf, async (req, reply) => {
    const projekt = await db.projektForKunde(req.user.id, req.params.id);
    if (!projekt) return reply.callNotFound();
    if (projekt.status === 'abnahme') {
      await db.query(`UPDATE projekte SET status = 'live' WHERE id = $1`, [projekt.id]);
      await db.audit('kunde', 'abnahme_angenommen', projekt.id, req.ip, null, req.user.id);
      await notifyAdmin('Abnahme erteilt', 'Kunde ' + req.user.kunde.email + ' hat den Entwurf abgenommen.');
    }
    return reply.redirect('/portal/projekt/' + projekt.id);
  });

  // Geld-zurück-Garantie nur beim 1. Entwurf — KEINE automatische Zahlung, nur Ticket + audit_log.
  app.post('/portal/projekt/:id/abnahme/garantie', csrf, async (req, reply) => {
    const projekt = await db.projektForKunde(req.user.id, req.params.id);
    if (!projekt) return reply.callNotFound();
    if (projekt.status !== 'abnahme' || (projekt.runden_verbraucht || 0) !== 0) {
      return reply.redirect('/portal/projekt/' + projekt.id + '/abnahme?fehler=nicht_moeglich');
    }
    await db.query(`INSERT INTO tickets (projekt_id, kunde_id, typ, text, status) VALUES ($1,$2,'abnahme_garantie',$3,'offen')`,
      [projekt.id, req.user.id, String(req.body.grund || 'Geld-zurück-Garantie auf den ersten Entwurf gezogen.')]);
    await db.audit('kunde', 'abnahme_garantie', projekt.id, req.ip, null, req.user.id);
    await notifyAdmin('Geld-zurück-Garantie gezogen', 'Kunde ' + req.user.kunde.email + ' hat die Garantie auf den 1. Entwurf gezogen. Bitte manuell bearbeiten (keine automatische Zahlung).');
    return reply.redirect('/portal/projekt/' + projekt.id + '/abnahme');
  });
};
