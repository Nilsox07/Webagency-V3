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
| 3 — Vorschau+Pins+Runden+Abnahme | ✅ | _git log `Etappe 3:`_ | 26 grün (gesamt) | Vorschau-Hosting (nur Besitzer) mit injiziertem Pin-Overlay; Pin-Sammelkorb je Runde; „Runde einreichen" (verbraucht++, Status korrektur_N, read-only danach, audit_log); Admin-Pin-Liste + „erledigt"; Abnahme-Screen (annehmen → live; Geld-zurück-Garantie nur 1. Entwurf → Ticket, keine Zahlung). **Screenshot: Playwright nicht installiert → DOM-Snippet-Fallback (GO-LIVE-TODO).** |
| 4 — Care/Störung/Kostenschätzung | ✅ | _git log `Etappe 4:`_ | 33 grün (gesamt) | Care-Tab (Minuten-Balken je Sprachversion, Verfallshinweis, Historie, Betriebs-Status), Störung/Änderung getrennt → Tickets, Kostenschätzung (€ = 150/Std auto) mit Pflicht-Freigabe vor Buchung, Admin-Buchungsmaske (5er-Takt-Validierung), Ticket-Liste mit Typ-Filter. |
| 5 — SEO/Upsell/Übergabe | ✅ | _git log `Etappe 5:`_ | 40 grün (gesamt) | SEO-Tab (Stufe/Preis, Monats-Kontingent x/y + Verfallsdatum, Dokumente, Stufenwechsel/Kündigung als Anfrage-Ticket), Extras-Katalog aus prices.js → Anfrage-Ticket (keine Zahlung), Datei-Übergabe-Tab, Postfach-Anfrage. prices.js == Website-Preise (Diff-Test). |
| 6 — Anfragen/Nachfass/DSGVO | ✅ | _git log `Etappe 6:`_ | 47 grün (gesamt) | /api/anfragen (Token, echtes Lumi-Payload) + Admin-Inbox Ein-Klick Kunde+Projekt; Nachfass-Cron (7-Tage-Erinnerung max 2 + Admin-Hinweis, 5-Tage-Schätzung); DSGVO Export-ZIP (eigener Store-ZIP via zlib.crc32, keine Lib) + Löschung (Antrag→Ticket→Admin-Lösch-Routine inkl. Dateien, CASCADE); Audit-Log-Ansicht; AVV-Platzhalter. |
| 7 — Bau-Prompt-Generator | ✅ | _git log `Etappe 7:`_ | 51 grün (gesamt) | Admin „Bau-Prompt" je Projekt aus editierbaren Bausteinen (`prompt_bausteine`, 12 ausformulierte Standard-Bausteine geseedet) mit Platzhaltern; zieht Paket/Seiten/Funktionen/Stil/Farben/Branche/Ziele/Termin/SEO/Sprachen/Redesign + Stichpunkte je Seite; Monospace-Box + Kopier-Button + Vollständigkeits-Warnung mit `[FEHLT: …]`. Demo: `docs/demo-prompt.txt`. |

## Abnahme-Belege (laufend)
- **#1 Mandanten-Trennung**: `test/tenant-isolation.test.js` — Kunde A → 404 auf alle Routen von B; eigene Ressourcen 200; ohne Login 302→/login. ✅
- **#2 Magic-Link-Lebenszyklus**: `test/auth.test.js` — gültig→302, abgelaufen→400, benutzt→400, nur Hash gespeichert. ✅
- **#3 Timeline+Blocker+Countdown**: `test/projektlogik.test.js` + `test/etappe2.test.js` — Countdown startet erst bei Vollständigkeit. ✅
- **#4 audit_log (4/4)**: `angebot_angenommen`, `inhalte_vollstaendig`, `runde_eingereicht`, `abnahme_angenommen` (+Logins, Freigaben, Löschung). ✅
- **#5 Pin-Lebenszyklus**: `test/etappe3.test.js` — Pin anlegen → einreichen → Runde zaehlt hoch → Pins read-only (409); Admin-Pin-Liste / Vorschau-Link. audit_log `runde_eingereicht`, `abnahme_angenommen`, `abnahme_garantie` → #4 komplett (4/4). ✅
- **#6 Care**: `test/care.test.js` + `test/etappe4.test.js` — 5er-Takt (7→400, 10→ok), Sprachversions-Zeilen, Schätzungs-Freigabe-Pflicht vor Buchung (offen→409, freigegeben→ok), audit_log `schaetzung_freigegeben`. ✅
- **#7 SEO**: `test/etappe5.test.js` — Kontingent x/y, Verfallsdatum (Monatsende), Dokumente; Kündigung/Wechsel = Anfrage-Ticket. ✅
- **#8 prices.js == Website**: `test/prices-diff.test.js` — Pakete, Care, Extraseite, Extras + SEO (inkl. KI 990+79) identisch zu Webagency-V3/pricing.js. ✅
- **#9 /api/anfragen**: `test/etappe6.test.js` — echtes Lumi-Fixture, Token-Pflicht, Ein-Klick Kunde+Projekt. ✅
- **#10 Nachfass-Cron**: Zeitraffer — 7-Tage-Erinnerung (max 2 → Admin-Hinweis), 5-Tage-Schätzung (einmalig). ✅
- **#11 Export-ZIP**: gültiges ZIP (PK), export.json + Kundendaten enthalten. ✅
- **#12 Verbotene Wörter**: `test/verbotene-woerter.test.js` — keine Treffer in src/public. ✅
- **#13 .env.example**: vollständig; README-Deploy (Coolify) vorhanden. ✅
- **#14 Bau-Prompt-Generator**: `test/etappe7.test.js` — Snapshot (jeder Baustein 1×, alle Platzhalter ersetzt, keine Lücken), `[FEHLT: …]` nur bei fehlenden Daten, Bausteine in DB editierbar (DB gewinnt), Kopier-Button + Box (DOM). Demo-Prompt: `docs/demo-prompt.txt`. ✅
- **#15 MORGEN-REPORT.md**: dieses Dokument (7 Etappen-Zeilen + TODOs + Startanleitung). ✅

**Gesamt: 7/7 Etappen ✅ · 51 Tests grün · `npm test` Exit 0.**

## Offene ⚠ / Blocker
- **Keine harten Blocker.** Einzige Umgebungs-Einschränkung: Docker-Daemon im Sandbox nicht verfügbar →
  Tests laufen über pg-mem statt echtem Postgres (Produktionspfad unberührt; Reparatur = CI gegen Postgres,
  in GO-LIVE-TODO). Playwright-Screenshots für Pins = DOM-Snippet-Fallback (GO-LIVE-TODO).

## GO-LIVE-TODOs (Kurzliste, Details in GO-LIVE-TODO.md)
Mollie (Meilenstein-Status), lexoffice (Rechnungen), KI-Zähler (Anbieter), Shopify-Import,
Statistik-Automatik, SMTP scharf (nodemailer), Playwright-Screenshots, Live-Submit von briefing.js
auf `/api/anfragen`, CI gegen echtes Postgres, Kanzlei (AVV/AGB-Version/Geld-zurück-Wortlaut),
COOKIE_SECRET/ENC_KEY in Produktion geheim setzen.

## So startest du das Portal lokal (Kurz)
1. `cd sartu-portal && cp .env.example .env` — `ENC_KEY` via `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. `docker compose up -d db`  (oder eigenes Postgres, `DATABASE_URL` anpassen)
3. `npm install`
4. `npm run migrate && npm run seed`
5. `npm start` → http://localhost:3000  ·  Admin `/admin/login` (admin@sartu.de / portal-admin-dev)
