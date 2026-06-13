'use strict';
// Produktions-/Dev-Start: echtes Postgres via DATABASE_URL. Migrationen + Server.
const cfg = require('./config');
const { migrate } = require('./migrate');
const { buildApp } = require('./app');

(async () => {
  await migrate();
  const app = await buildApp({ logger: true });
  await app.listen({ port: cfg.port, host: cfg.host });
  console.log(`Sartu Portal läuft auf ${cfg.baseUrl}`);
})().catch((e) => { console.error('Start fehlgeschlagen:', e); process.exit(1); });
