'use strict';
const path = require('path');
const Fastify = require('fastify');
const cfg = require('./config');
const db = require('./db');
const auth = require('./auth');

// Setzt das signierte Session-Cookie.
function setSession(reply, id) {
  reply.setCookie('sid', id, {
    signed: true, httpOnly: true, sameSite: 'lax', secure: cfg.isProd, path: '/',
    maxAge: cfg.sessionTtlDays * 86400,
  });
}
function clearSession(reply) { reply.clearCookie('sid', { path: '/' }); }

async function buildApp(opts = {}) {
  const app = Fastify({ logger: opts.logger || false, trustProxy: true });

  await app.register(require('@fastify/formbody'));
  await app.register(require('@fastify/cookie'), { secret: cfg.cookieSecret });
  await app.register(require('@fastify/rate-limit'), {
    global: false, // nur explizit markierte Routen (Auth) limitieren
    max: 1000, timeWindow: '1 minute',
  });
  await app.register(require('@fastify/csrf-protection'), {
    cookieKey: '_csrf',
    cookieOpts: { path: '/', sameSite: 'lax', httpOnly: true, signed: true, secure: cfg.isProd },
    getToken: (req) => (req.body && req.body._csrf) || req.headers['csrf-token'],
  });
  await app.register(require('@fastify/view'), {
    engine: { ejs: require('ejs') },
    root: path.join(__dirname, 'views'),
    viewExt: 'ejs',
  });
  await app.register(require('@fastify/static'), {
    root: path.join(__dirname, '..', 'public'), prefix: '/public/',
  });

  // Session → req.user (kunde|admin) aus signiertem Cookie.
  app.addHook('onRequest', async (req) => {
    req.user = null;
    const raw = req.cookies && req.cookies.sid;
    if (!raw) return;
    const un = req.unsignCookie(raw);
    if (!un.valid || !un.value) return;
    const sess = await auth.loadSession(un.value);
    if (!sess) return;
    if (sess.subject_type === 'kunde') {
      const kunde = await db.one(`SELECT * FROM kunden WHERE id = $1 AND geloescht_am IS NULL`, [sess.subject_id]);
      if (kunde) req.user = { type: 'kunde', id: kunde.id, kunde, sessionId: sess.id };
    } else if (sess.subject_type === 'admin') {
      const admin = await db.one(`SELECT id, email FROM admin_user WHERE id = $1`, [sess.subject_id]);
      if (admin) req.user = { type: 'admin', id: admin.id, admin, sessionId: sess.id };
    }
  });

  // Helfer als Decorators
  app.decorate('setSession', setSession);
  app.decorate('clearSession', clearSession);
  app.decorate('requireKunde', function (req, reply, done) {
    if (!req.user || req.user.type !== 'kunde') return reply.code(302).redirect('/login');
    done();
  });
  app.decorate('requireAdmin', function (req, reply, done) {
    if (!req.user || req.user.type !== 'admin') return reply.code(302).redirect('/admin/login');
    done();
  });
  // CSRF-Token für Formulare bequem bereitstellen.
  app.decorateReply('csrf', function () { return this.generateCsrf(); });

  app.setErrorHandler((err, req, reply) => {
    if (err.statusCode === 403 || err.code === 'FST_CSRF_INVALID_TOKEN' || err.code === 'FST_CSRF_MISSING_SECRET') {
      return reply.code(403).view('pages/error', { title: 'Abgelehnt', theme: req.user && req.user.type === 'admin' ? 'admin' : 'kunde', user: req.user, csrf: '', msg: 'Sicherheits-Token ungültig. Bitte lade die Seite neu.' });
    }
    req.log && req.log.error(err);
    reply.code(err.statusCode || 500).view('pages/error', { title: 'Fehler', theme: 'kunde', user: req.user, csrf: '', msg: cfg.isProd ? 'Es ist ein Fehler aufgetreten.' : String(err.message) });
  });

  app.setNotFoundHandler((req, reply) => {
    reply.code(404).view('pages/error', { title: 'Nicht gefunden', theme: req.user && req.user.type === 'admin' ? 'admin' : 'kunde', user: req.user, csrf: '', msg: 'Diese Seite gibt es nicht (oder du hast keinen Zugriff darauf).' });
  });

  app.get('/', async (req, reply) => reply.redirect(req.user && req.user.type === 'admin' ? '/admin' : '/portal'));
  app.get('/health', async () => ({ ok: true }));

  await app.register(require('./routes/auth'));
  await app.register(require('./routes/kunde'));
  await app.register(require('./routes/feedback'));
  await app.register(require('./routes/seo'));
  await app.register(require('./routes/admin'));

  return app;
}

module.exports = { buildApp };
