'use strict';
const db = require('../db');
const prices = require('../prices');
const seo = require('../seo');
const mailer = require('../mailer');

async function notifyAdmin(betreff, body) {
  const admin = await db.one(`SELECT email FROM admin_user ORDER BY created_at LIMIT 1`);
  await mailer.send(admin ? admin.email : (process.env.ADMIN_EMAIL || 'admin@sartu.de'), betreff, body);
}
async function ticket(projekt, kundeId, typ, text) {
  await db.query(`INSERT INTO tickets (projekt_id, kunde_id, typ, text) VALUES ($1,$2,$3,$4)`, [projekt.id, kundeId, typ, text]);
}

module.exports = async function (app) {
  const guard = { preHandler: app.requireKunde };
  const csrf = { preHandler: [app.requireKunde, app.csrfProtection] };

  // SEO-Tab (nur bei aktivem Abo): Stufe/Preis, Monats-Kontingent + Verfall, Dokumente, Wechsel/Kündigung.
  app.get('/portal/projekt/:id/seo', guard, async (req, reply) => {
    const projekt = await db.projektForKunde(req.user.id, req.params.id);
    if (!projekt) return reply.callNotFound();
    const abo = await db.one(`SELECT * FROM seo_abos WHERE projekt_id = $1 ORDER BY start DESC LIMIT 1`, [projekt.id]);
    const aktiv = seo.aboAktiv(abo);
    const mk = seo.monthKey();
    const kontingent = aktiv ? await db.one(`SELECT * FROM seo_kontingente WHERE projekt_id = $1 AND monat = $2`, [projekt.id, mk]) : null;
    const dokumente = await db.many(`SELECT * FROM seo_dokumente WHERE projekt_id = $1 ORDER BY monat DESC, created_at DESC`, [projekt.id]);
    const stufeInfo = abo ? prices.seo[abo.stufe] : null;
    return reply.view('pages/portal-seo', {
      title: 'SEO', theme: 'kunde', user: req.user, csrf: reply.csrf(),
      projekt, abo, aktiv, stufeInfo, kontingent, verfall: seo.monthEnd(mk), dokumente, seoStufen: prices.seo,
    });
  });

  app.post('/portal/projekt/:id/seo/wechsel', csrf, async (req, reply) => {
    const projekt = await db.projektForKunde(req.user.id, req.params.id);
    if (!projekt) return reply.callNotFound();
    await ticket(projekt, req.user.id, 'seo_wechsel', 'Stufen-Wechsel-Anfrage: ' + String(req.body.ziel_stufe || ''));
    await notifyAdmin('SEO-Stufen-Wechsel', 'Kunde ' + req.user.kunde.email + ' möchte wechseln zu: ' + String(req.body.ziel_stufe || ''));
    return reply.redirect('/portal/projekt/' + projekt.id + '/seo');
  });

  app.post('/portal/projekt/:id/seo/kuendigung', csrf, async (req, reply) => {
    const projekt = await db.projektForKunde(req.user.id, req.params.id);
    if (!projekt) return reply.callNotFound();
    await ticket(projekt, req.user.id, 'seo_kuendigung', 'Kündigungs-Anfrage SEO-Betreuung.');
    await notifyAdmin('SEO-Kündigung', 'Kunde ' + req.user.kunde.email + ' möchte die SEO-Betreuung kündigen (monatlich nach 3 Monaten).');
    return reply.redirect('/portal/projekt/' + projekt.id + '/seo');
  });

  // Extras nachbuchen — Katalog aus prices.js (Quelle der Wahrheit), Klick = Anfrage-Ticket (keine Zahlung).
  app.get('/portal/projekt/:id/extras', guard, async (req, reply) => {
    const projekt = await db.projektForKunde(req.user.id, req.params.id);
    if (!projekt) return reply.callNotFound();
    return reply.view('pages/portal-extras', {
      title: 'Extras', theme: 'kunde', user: req.user, csrf: reply.csrf(), projekt, extras: prices.extras, seoStufen: prices.seo,
    });
  });
  app.post('/portal/projekt/:id/extras/anfrage', csrf, async (req, reply) => {
    const projekt = await db.projektForKunde(req.user.id, req.params.id);
    if (!projekt) return reply.callNotFound();
    const key = String(req.body.key || '');
    const item = prices.extras[key] || prices.seo[key];
    if (!item) return reply.callNotFound();
    await ticket(projekt, req.user.id, 'extra_anfrage', 'Extra-Anfrage: ' + item.name + ' (' + key + ')');
    await notifyAdmin('Extra-Anfrage: ' + item.name, 'Kunde ' + req.user.kunde.email + ' interessiert sich für: ' + item.name);
    return reply.redirect('/portal/projekt/' + projekt.id + '/extras?angefragt=' + encodeURIComponent(key));
  });

  // Datei-Übergabe: finale Pakete (Logo-Formate, Styleguide, Inhalte-Export) als Downloads.
  app.get('/portal/projekt/:id/uebergabe', guard, async (req, reply) => {
    const projekt = await db.projektForKunde(req.user.id, req.params.id);
    if (!projekt) return reply.callNotFound();
    const dateien = await db.many(`SELECT * FROM uploads WHERE projekt_id = $1 AND typ IN ('logo','dokument','report') ORDER BY created_at DESC`, [projekt.id]);
    return reply.view('pages/portal-uebergabe', { title: 'Übergabe', theme: 'kunde', user: req.user, csrf: reply.csrf(), projekt, dateien });
  });

  // Postfach beantragen (max 3 inklusive, Admin-gepflegt).
  app.post('/portal/projekt/:id/postfach', csrf, async (req, reply) => {
    const projekt = await db.projektForKunde(req.user.id, req.params.id);
    if (!projekt) return reply.callNotFound();
    await ticket(projekt, req.user.id, 'postfach', 'Postfach-Anfrage: ' + String(req.body.wunsch || ''));
    await notifyAdmin('Postfach-Anfrage', 'Kunde ' + req.user.kunde.email + ': ' + String(req.body.wunsch || ''));
    return reply.redirect('/portal/projekt/' + projekt.id + '/care');
  });
};
