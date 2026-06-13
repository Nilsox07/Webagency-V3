# Sartu Portal — Morgen-Report (autonomer Nachtlauf)

Neues eigenständiges Projekt unter `sartu-portal/` (Unterordner des Webagency-V3-Repos —
Session-Scope erlaubte kein separates Repo; per `git mv` leicht herauslösbar).
Stack: Node 22 + Fastify 5, EJS (SSR), PostgreSQL (Produktion) / pg-mem (Tests), Argon2, AES-256-GCM.

## Rahmenbedingungen des Laufs
- **Docker-Daemon im Sandbox nicht verfügbar** → dokumentierter Fallback: Tests laufen hermetisch
  über **pg-mem** (reines JS-Postgres). Produktion nutzt echtes Postgres (docker-compose/Dockerfile vorhanden).
  GO-LIVE-TODO: CI gegen echtes Postgres. Dies betrifft KEINE Testlogik — die Queries sind identisch.
- npm-Registry erreichbar, `npm install` inkl. **argon2 (native) erfolgreich**.

## Etappen-Übersicht

| Etappe | Status | Commit | Tests | Besonderheiten |
|---|---|---|---|---|
| 1 — Fundament | ✅ | _siehe git log `Etappe 1:`_ | 11 grün | Komplettes Datenmodell (24 Tabellen), Magic-Link+Argon2-Auth, Sessions, CSRF, Rate-Limit, Sartu-Optik (Kunde dunkel / Admin hell), Seed (1 Admin + 2 Kunden). Mandanten-Trennungs-Test grün. |
| 2 — Projekt-Kern | ✅ | _git log `Etappe 2:`_ | 21 grün (gesamt) | Status-Timeline, Blocker-Box, Liefertermin-Countdown (Start erst bei Vollständigkeit), Inhalte-Strecke (Stichpunkte 5er-Minimum, Zugänge AES-verschlüsselt+maskiert, „Alles vollständig"-Gate), Redesign-Kurzstrecke, Dokumente-Tab mit Angebot-Annahme, Meilensteine read-only. |
| 3 — Vorschau+Pins+Runden+Abnahme | ⏳ offen | — | — | Pin-Overlay, Runden-Einreichung, Screenshot (Playwright/Fallback) |
| 4 — Care/Störung/Kostenschätzung | ⏳ offen | — | — | 5er-Takt, Sprachversions-Zeilen, Freigabe-Pflicht |
| 5 — SEO/Upsell/Übergabe | ⏳ offen | — | — | Kontingente, prices.js-Diff, Datei-Übergabe |
| 6 — Anfragen/Nachfass/DSGVO | ⏳ offen | — | — | /api/anfragen, Cron, Export-ZIP, Löschung |
| 7 — Bau-Prompt-Generator | ⏳ offen | — | — | prompt_bausteine, Snapshot-Test |

## Abnahme-Belege (laufend)
- **#1 Mandanten-Trennung**: `test/tenant-isolation.test.js` — Kunde A → 404 auf alle Routen von B; eigene Ressourcen 200; ohne Login 302→/login. ✅
- **#2 Magic-Link-Lebenszyklus**: `test/auth.test.js` — gültig→302, abgelaufen→400, benutzt→400, nur Hash gespeichert. ✅
- **#4 (teilw.) audit_log**: Login schreibt `audit_log` (login_magic / login_admin). Weitere Belege ab Etappe 2/3.
- **#13 .env.example**: vollständig; README-Deploy (Coolify) vorhanden. ✅ (Rest mit Folge-Etappen)

## Offene ⚠ / Blocker
- Keine harten Blocker in Etappe 1. DB-Laufzeit im Sandbox = pg-mem (s. o.), Produktionspfad unberührt.

## So startest du das Portal lokal (Kurz)
1. `cd sartu-portal && cp .env.example .env` — `ENC_KEY` via `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. `docker compose up -d db`  (oder eigenes Postgres, `DATABASE_URL` anpassen)
3. `npm install`
4. `npm run migrate && npm run seed`
5. `npm start` → http://localhost:3000  ·  Admin `/admin/login` (admin@sartu.de / portal-admin-dev)
