# Sartu Portal

Kunden- & Admin-Portal, das die Sartu-Leistungsbeschreibung technisch durchsetzt.
Stack: Node.js + Fastify, serverseitig gerendertes EJS, PostgreSQL, Datei-Uploads auf Volume.
Kein Build-Schritt, kein React.

## Lokal starten (5 Schritte)
1. `cp .env.example .env` und `ENC_KEY` setzen: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. Postgres starten: `docker compose up -d db` (oder eigenes Postgres, `DATABASE_URL` anpassen)
3. `npm install`
4. `npm run migrate && npm run seed` (legt Admin + 2 Demo-Kunden an)
5. `npm start` → http://localhost:3000 (Kunde: `/login`, Admin: `/admin/login`)

Demo-Login Admin: `admin@sartu.de` / `portal-admin-dev` (aus `.env`).
Kunden-Login: E-Mail z. B. `anna@cafe-sonne.de` → Magic-Link erscheint im Dev-Modus in der Konsole + Tabelle `mail_outbox`.

## Tests
`npm test` (Node-Test-Runner). Hermetisch über **pg-mem** (kein Docker/Postgres nötig).
Pflicht-Suite: Mandanten-Trennung (unantastbar) + Auth-Lebenszyklus + CSRF.

## Deployment (Coolify auf Hetzner)
- Repo enthält `Dockerfile` + `docker-compose.yml`.
- In Coolify: neues Projekt aus diesem Verzeichnis, Postgres-Service + App-Service, `.env` setzen
  (`DATABASE_URL`, `ENC_KEY`, `COOKIE_SECRET`, SMTP, `BASE_URL`, `ANFRAGEN_TOKEN`).
- Volume für `/data` (Uploads + Vorschau) mounten — Backup einrichten.
- `node src/server.js` migriert beim Start automatisch.

> Hinweis: Dieses Portal liegt aktuell als Unterordner im Webagency-V3-Repo (Session-Scope erlaubte
> kein separates Repo). Es ist eigenständig (eigenes package.json) und per `git mv`/filter leicht
> in ein eigenes Repo `sartu-portal` zu überführen.
