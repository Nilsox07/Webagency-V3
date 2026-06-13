'use strict';
const db = require('../db');
const auth = require('../auth');
const mailer = require('../mailer');
const cfg = require('../config');

module.exports = async function (app) {
  const strict = { rateLimit: { max: 6, timeWindow: '15 minutes' } };

  app.get('/login', async (req, reply) => {
    if (req.user && req.user.type === 'kunde') return reply.redirect('/portal');
    return reply.view('pages/login', { title: 'Anmelden', theme: 'kunde', user: null, csrf: reply.csrf(), sent: false, error: null });
  });

  app.post('/login', { config: strict, preHandler: app.csrfProtection }, async (req, reply) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const kunde = email ? await db.one(`SELECT id, email FROM kunden WHERE lower(email) = $1 AND geloescht_am IS NULL`, [email]) : null;
    if (kunde) {
      const token = await auth.createMagicLink(kunde.id);
      const link = cfg.baseUrl + '/auth/' + token;
      await mailer.send(kunde.email, 'Dein Anmelde-Link fürs Sartu-Portal',
        'Hi,\n\nmit diesem Link kommst du ins Portal (15 Minuten gültig, einmalig):\n' + link + '\n\nWenn du das nicht warst, ignorier die Mail einfach.');
    }
    // Datenschutz: IMMER dieselbe Bestätigung, egal ob die E-Mail existiert.
    return reply.view('pages/login', { title: 'Anmelden', theme: 'kunde', user: null, csrf: '', sent: true, error: null });
  });

  app.get('/auth/:token', { config: strict }, async (req, reply) => {
    const kundeId = await auth.consumeMagicLink(req.params.token);
    if (!kundeId) {
      return reply.code(400).view('pages/info', { title: 'Link ungültig', theme: 'kunde', user: null, csrf: '',
        heading: 'Link ungültig oder abgelaufen', text: 'Anmelde-Links gelten 15 Minuten und nur einmal. Fordere einfach einen neuen an.', cta: { href: '/login', label: 'Neuen Link anfordern' } });
    }
    const sid = await auth.createSession('kunde', kundeId);
    app.setSession(reply, sid);
    await db.audit('kunde', 'login_magic', null, req.ip, null, kundeId);
    return reply.redirect('/portal');
  });

  app.get('/admin/login', async (req, reply) => {
    if (req.user && req.user.type === 'admin') return reply.redirect('/admin');
    return reply.view('pages/admin-login', { title: 'Admin-Anmeldung', theme: 'admin', user: null, csrf: reply.csrf(), error: null });
  });

  app.post('/admin/login', { config: strict, preHandler: app.csrfProtection }, async (req, reply) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const pw = String(req.body.passwort || '');
    const admin = await db.one(`SELECT id, pass_hash FROM admin_user WHERE lower(email) = $1`, [email]);
    const ok = admin && await auth.verifyPassword(admin.pass_hash, pw);
    if (!ok) {
      return reply.code(401).view('pages/admin-login', { title: 'Admin-Anmeldung', theme: 'admin', user: null, csrf: reply.csrf(), error: 'E-Mail oder Passwort falsch.' });
    }
    const sid = await auth.createSession('admin', admin.id);
    app.setSession(reply, sid);
    await db.audit('admin', 'login_admin', null, req.ip, null, null);
    return reply.redirect('/admin');
  });

  app.post('/logout', { preHandler: app.csrfProtection }, async (req, reply) => {
    if (req.user) await auth.destroySession(req.user.sessionId);
    app.clearSession(reply);
    return reply.redirect('/login');
  });
};
