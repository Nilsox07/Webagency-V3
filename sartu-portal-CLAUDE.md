# CLAUDE.md — sartu-portal (Kunden- & Admin-Portal)

> Wird automatisch in jede Session geladen. **Nur aufgabenrelevante Dateien lesen, Repo nicht von selbst erkunden.**

## Was das ist
Kunden- und Admin-Portal, das die **Sartu-Leistungsbeschreibung technisch durchsetzt** (Timeline, Inhalte-Strecke, Pin-Korrekturrunden, Care-Minuten, SEO-Tab, Bau-Prompt-Generator). Eigenständig, getrennt von der Website.
**Stack (bewusst langweilig, wartungsarm):** Node 22 + Fastify 5, EJS (Server-Side Rendering, minimal Browser-JS), PostgreSQL (Tests: pg-mem), Argon2, AES-256-GCM. KEIN React/Next, KEIN Build-System. Ziel-Hosting: Hetzner + Coolify.

## Eiserne Regeln (Sicherheit = nicht verhandelbar)
1. **Mandanten-Trennung ist heilig.** Jede Query nach `kunde_id` aus der **Session** filtern — NIE aus Request-Parametern. Kunde A darf nie Daten von Kunde B sehen. Der Test `test/tenant-isolation.test.js` ist unantastbar — NIE löschen/abschwächen, um grün zu werden.
2. **Keine Geheimnisse/echten Daten committen.** Nur `.env.example` + Demo-Seeds. `ENC_KEY`, `COOKIE_SECRET` etc. nur aus `.env`.
3. **CSRF-Token auf jedem POST, Rate-Limit auf Auth-Routen, Sessions httpOnly+secure, Magic-Link-Tokens gehasht + 15 Min + einmalig, Upload-Pfade als UUID** (nie ratbar).
4. **Audit-Log** bei: Angebot-Annahme, Abnahme, Geld-zurück, Freigaben, Runden-Einreichung, Löschung.
5. **Preise NUR aus `prices.js`** — muss identisch zur Website-`pricing.js` bleiben (`test/prices-diff.test.js`).
6. **Sartu-Optik** (Kunde dunkel wie Lumi / Admin hell), Klartext, du-Form, keine verbotenen Wörter (siehe Test `verbotene-woerter`).

## Vertrag zur Website
`/api/anfragen` nimmt das **unveränderte Lumi-Payload-Format** an (Token-geschützt). Format steht in `docs/payload.md` — diese Datei ist der gemeinsame Vertrag mit dem Webagency-Repo. Ändert sich das Lumi-Formular, hier den Endpoint NUR nach aktualisiertem payload.md anpassen.

## Datei-Landkarte
- Routen/Controller → `src/routes/` · Views → `src/views/` (EJS) · DB-Schema/Migrationen → `migrations/` · Seeds → `seed/` · Verschlüsselung/Auth-Helfer → `src/lib/`
- **Bau-Prompt-Bausteine** → DB-Tabelle `prompt_bausteine` (im Admin editierbar, DB gewinnt über Code-Defaults), Generator-Logik im Admin-Bereich
- Preise → `prices.js` · Tests → `test/` (pro Etappe eine Datei + Querschnitt) · Doku → `docs/`, `GO-LIVE-TODO.md`, `MORGEN-REPORT.md`

## Standard-Kommandos
- `npm test` — komplette Suite, IMMER vor Commit grün (inkl. ALLER Vor-Etappen-Tests)
- `npm run migrate && npm run seed` · `npm start` → localhost:3000 · Admin `/admin/login`

## GO-LIVE offen (Details: GO-LIVE-TODO.md)
Mollie, lexoffice, KI-Verbrauchszähler (Anbieter), Shopify-Import, Statistik-Automatik, SMTP scharf, Playwright-Screenshots (statt DOM-Fallback), Live-Submit der Website auf `/api/anfragen`, **CI gegen echtes Postgres** (Tests laufen aktuell auf pg-mem!), Kanzlei (AVV/AGB/Geld-zurück-Wortlaut), Produktions-Secrets setzen.

## Arbeitsweise mit mir (Jens)
- Etappen mit Beweispflicht (Commit-Hash, Testanzahl). Scope nicht erweitern, keine neuen Bibliotheken außer genehmigten.
- Eine Etappe ohne grüne Tests gilt NICHT als fertig.
