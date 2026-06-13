'use strict';
const db = require('../db');
const L = require('../projektlogik');
const enc = require('../crypto');
const mailer = require('../mailer');
const prices = require('../prices');

// Lädt den Kontext eines Projekts (mandanten-sicher, projektId stammt bereits aus projektForKunde).
async function projektContext(projektId) {
  const seiten = await db.many(`SELECT * FROM inhalte_seiten WHERE projekt_id = $1 ORDER BY sort`, [projektId]);
  const meilensteine = await db.many(`SELECT * FROM meilensteine WHERE projekt_id = $1 ORDER BY sort`, [projektId]);
  const angebot = await db.one(`SELECT * FROM angebote WHERE projekt_id = $1 ORDER BY created_at DESC LIMIT 1`, [projektId]);
  const zugaenge = await db.one(`SELECT * FROM zugaenge WHERE projekt_id = $1`, [projektId]);
  const offeneSchaetzungen = await db.many(`SELECT * FROM kostenschaetzungen WHERE projekt_id = $1 AND status = 'offen'`, [projektId]);
  const offeneRunde = await db.one(`SELECT id FROM korrekturrunden WHERE projekt_id = $1 AND status = 'offen'`, [projektId]);
  return { seiten, meilensteine, angebot, zugaenge, offeneSchaetzungen, offeneRunde: !!offeneRunde };
}
function zugaengeVorhanden(z) { return !!(z && (z.domain_authcode_enc || z.alt_website_enc || z.google_profil_enc)); }

async function notifyAdmin(betreff, body) {
  const admin = await db.one(`SELECT email FROM admin_user ORDER BY created_at LIMIT 1`);
  await mailer.send(admin ? admin.email : (process.env.ADMIN_EMAIL || 'admin@sartu.de'), betreff, body);
}

module.exports = async function (app) {
  const csrf = { preHandler: [app.requireKunde, app.csrfProtection] };
  const guard = { preHandler: app.requireKunde };

  app.get('/portal', guard, async (req, reply) => {
    const projekte = await db.projekteOfKunde(req.user.id);
    return reply.view('pages/portal-dashboard', { title: 'Dein Portal', theme: 'kunde', user: req.user, csrf: reply.csrf(), projekte });
  });

  // Projekt-Dashboard: Timeline + Blocker-Box + Countdown + Meilensteine.
  app.get('/portal/projekt/:id', guard, async (req, reply) => {
    const projekt = await db.projektForKunde(req.user.id, req.params.id);
    if (!projekt) return reply.callNotFound();
    const ctx = await projektContext(projekt.id);
    const offeneSeiten = ctx.seiten.filter((s) => s.status !== 'vollstaendig');
    return reply.view('pages/portal-projekt', {
      title: projekt.name || 'Projekt', theme: 'kunde', user: req.user, csrf: reply.csrf(),
      projekt, timeline: L.timeline(projekt.status),
      blockers: L.blockers(projekt, { offeneSeiten, offeneSchaetzungen: ctx.offeneSchaetzungen, offeneRunde: ctx.offeneRunde }),
      countdown: L.countdownDays(projekt), meilensteine: ctx.meilensteine, angebot: ctx.angebot,
    });
  });

  // Inhalte-Strecke (Normal: Stichpunkte je Seite; Redesign: Alt-URL + Zugänge).
  app.get('/portal/projekt/:id/inhalte', guard, async (req, reply) => {
    const projekt = await db.projektForKunde(req.user.id, req.params.id);
    if (!projekt) return reply.callNotFound();
    const ctx = await projektContext(projekt.id);
    const ready = L.inhalteReady(projekt, ctx.seiten, { zugaengeVorhanden: zugaengeVorhanden(ctx.zugaenge) });
    return reply.view('pages/portal-inhalte', {
      title: 'Inhalte', theme: 'kunde', user: req.user, csrf: reply.csrf(),
      projekt, seiten: ctx.seiten, minLines: L.MIN_LINES, ready,
      zugMaskiert: {
        domain: enc.mask(enc.decrypt(ctx.zugaenge && ctx.zugaenge.domain_authcode_enc)),
        alt: enc.mask(enc.decrypt(ctx.zugaenge && ctx.zugaenge.alt_website_enc)),
        google: enc.mask(enc.decrypt(ctx.zugaenge && ctx.zugaenge.google_profil_enc)),
      },
      fehler: req.query.fehler || null,
    });
  });

  app.post('/portal/projekt/:id/inhalte/:seiteId', csrf, async (req, reply) => {
    const projekt = await db.projektForKunde(req.user.id, req.params.id);
    if (!projekt) return reply.callNotFound();
    const seite = await db.one(`SELECT * FROM inhalte_seiten WHERE id = $1 AND projekt_id = $2`, [req.params.seiteId, projekt.id]);
    if (!seite) return reply.callNotFound();
    const stich = String(req.body.stichpunkte || '');
    const status = L.stichpunkteLines(stich).length >= L.MIN_LINES ? 'vollstaendig' : 'offen';
    await db.query(`UPDATE inhalte_seiten SET stichpunkte = $1, status = $2 WHERE id = $3`, [stich, status, seite.id]);
    return reply.redirect('/portal/projekt/' + projekt.id + '/inhalte');
  });

  app.post('/portal/projekt/:id/zugaenge', csrf, async (req, reply) => {
    const projekt = await db.projektForKunde(req.user.id, req.params.id);
    if (!projekt) return reply.callNotFound();
    const existing = await db.one(`SELECT id FROM zugaenge WHERE projekt_id = $1`, [projekt.id]);
    const d = enc.encrypt(req.body.domain_authcode), a = enc.encrypt(req.body.alt_website), g = enc.encrypt(req.body.google_profil);
    if (existing) {
      await db.query(`UPDATE zugaenge SET domain_authcode_enc = COALESCE($1, domain_authcode_enc),
        alt_website_enc = COALESCE($2, alt_website_enc), google_profil_enc = COALESCE($3, google_profil_enc), updated_at = now() WHERE id = $4`,
        [d, a, g, existing.id]);
    } else {
      await db.query(`INSERT INTO zugaenge (projekt_id, domain_authcode_enc, alt_website_enc, google_profil_enc) VALUES ($1,$2,$3,$4)`,
        [projekt.id, d, a, g]);
    }
    if (req.body.alt_website && projekt.is_redesign && !projekt.alt_url) {
      // Redesign-Kurzstrecke: Alt-URL aus dem Zugangsformular mitnehmen (falls als URL gemeint)
    }
    return reply.redirect('/portal/projekt/' + projekt.id + '/inhalte');
  });

  // „Alles vollständig" — nur wenn alle Pflichtteile da sind. Status springt, Mail an Admin, audit_log.
  app.post('/portal/projekt/:id/fertig', csrf, async (req, reply) => {
    const projekt = await db.projektForKunde(req.user.id, req.params.id);
    if (!projekt) return reply.callNotFound();
    const ctx = await projektContext(projekt.id);
    const ready = L.inhalteReady(projekt, ctx.seiten, { zugaengeVorhanden: zugaengeVorhanden(ctx.zugaenge) });
    if (!ready) return reply.redirect('/portal/projekt/' + projekt.id + '/inhalte?fehler=unvollstaendig');
    await db.query(`UPDATE projekte SET inhalte_vollstaendig_am = now(), status = 'design' WHERE id = $1 AND status = 'inhalte'`, [projekt.id]);
    await db.audit('kunde', 'inhalte_vollstaendig', projekt.id, req.ip, null, req.user.id);
    await notifyAdmin('Inhalte vollständig: ' + (projekt.name || projekt.id),
      'Kunde ' + req.user.kunde.email + ' hat die Inhalte als vollständig markiert. Der Liefertermin-Countdown läuft jetzt.');
    return reply.redirect('/portal/projekt/' + projekt.id);
  });

  // Dokumente-Tab.
  app.get('/portal/projekt/:id/dokumente', guard, async (req, reply) => {
    const projekt = await db.projektForKunde(req.user.id, req.params.id);
    if (!projekt) return reply.callNotFound();
    const ctx = await projektContext(projekt.id);
    const rechnungen = await db.many(`SELECT * FROM uploads WHERE projekt_id = $1 AND typ = 'dokument' ORDER BY created_at DESC`, [projekt.id]);
    const careName = (prices.care[projekt.care_stufe] || {}).name;
    return reply.view('pages/portal-dokumente', {
      title: 'Dokumente', theme: 'kunde', user: req.user, csrf: reply.csrf(),
      projekt, angebot: ctx.angebot, meilensteine: ctx.meilensteine, rechnungen, careName, fehler: req.query.fehler || null,
    });
  });

  app.post('/portal/projekt/:id/angebot/annehmen', csrf, async (req, reply) => {
    const projekt = await db.projektForKunde(req.user.id, req.params.id);
    if (!projekt) return reply.callNotFound();
    const angebot = await db.one(`SELECT * FROM angebote WHERE projekt_id = $1 ORDER BY created_at DESC LIMIT 1`, [projekt.id]);
    if (!angebot) return reply.callNotFound();
    if (req.body.agb !== 'on' && req.body.agb !== 'true') {
      return reply.redirect('/portal/projekt/' + projekt.id + '/dokumente?fehler=agb');
    }
    if (!angebot.angenommen_am) {
      await db.query(`UPDATE angebote SET angenommen_am = now(), angenommen_ip = $1 WHERE id = $2`, [req.ip, angebot.id]);
      await db.query(`UPDATE projekte SET status = 'angenommen' WHERE id = $1 AND status = 'angebot'`, [projekt.id]);
      await db.audit('kunde', 'angebot_angenommen', projekt.id, req.ip, { agb_version: angebot.agb_version }, req.user.id);
      await notifyAdmin('Angebot angenommen: ' + (projekt.name || projekt.id), 'Kunde ' + req.user.kunde.email + ' hat das Angebot angenommen.');
    }
    return reply.redirect('/portal/projekt/' + projekt.id + '/dokumente');
  });

  app.get('/portal/upload/:id', guard, async (req, reply) => {
    const up = await db.uploadForKunde(req.user.id, req.params.id);
    if (!up) return reply.callNotFound();
    return reply.send({ id: up.id, dateiname: up.dateiname, typ: up.typ });
  });
};
