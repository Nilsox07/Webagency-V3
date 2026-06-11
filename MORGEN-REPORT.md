# MORGEN-REPORT — Nacht-Aufräumlauf (cleanup-nacht)

Lauf vom 11./12.06.2026 · Branch **`cleanup-nacht`** (von main `8e9cc1e`) · **KEIN Merge, KEIN Push nach main erfolgt.**
Testgeschirr: `tools/smoke.js` (Node + jsdom), 993 Checks pro Lauf.

## Nulllauf (vorbestehend rot — NICHT repariert, nur überwacht)

| Check | Befund | Status |
|---|---|---|
| a | `admin.html` hat kein `<h1>` (Portal-Seite) | vorbestehend, unverändert |
| c | `/preise#wartung` (2 Links von leistung-wartung) — Ziel-`id="wartung"` fehlt in preise.html (vorhanden: `id="rundum-schutz"`) | vorbestehend, unverändert — **Empfehlung:** Anker angleichen |

Bekannte jsdom-Limitierung (kein Site-Bug, im Harness dokumentiert + gefiltert):
`HTMLFormElement` ist per HTML-Spec `[OverrideBuiltins]`; jsdom liefert für `form.name` das
name-Attribut statt des Inputs → künstlicher Throw nur in jsdom. Im Browser korrekt.

## Tranchen-Tabelle

| Commit | Kategorie | Änderungen | smoke |
|---|---|---|---|
| `b8409c0` | P0 Testgeschirr + Nulllauf | smoke.js, Baseline, _archive/, .vercelignore | grün (Baseline) |
| `1861c7a` | P1 tote/Dev-Dateien | 4 Dateien archiviert, 1 Script ausgehängt | grün |
| `614ceb1` | P3 totes CSS styles.css T1 | 30 Selektoren | grün |
| `0580cd9` | P3 styles.css T2 | 30 Selektoren | grün |
| `479eb4e` | P3 styles.css T3 | 30 Selektoren | grün |
| `217b86c` | P3 styles.css T4 | 30 Selektoren | grün |
| `e2b2298` | P3 styles.css T5 | 6 Selektoren | grün |
| `729b725` | P3 briefing.css | 26 Selektoren (Legacy-Konfigurator) | grün |
| `c29cc83` | P3 portal.css | 1 Selektor (.badge-lime) | grün |
| `5f0b216` | P5 totes JS | 1 Funktion (briefing.js `buildTierGroup`, 30 Z.) | grün (inkl. Check f) |
| `5be2177` | P3-Nachzug briefing.css | 10 Selektoren (lb-tiergroup/lb-tier nach P5) | grün |
| `a0dddcf` | P6 node_modules enttrackt + Versionsbump | 25 HTML | grün |

**Kein Revert nötig — alle Tranchen grün.**

## Archivierte Dateien (`/_archive/`, nichts gelöscht)

- `generate_image.py` — 0 Referenzen (Dev-Skript)
- `AUFRAEUM-BERICHT.md` — historischer Bericht (Notiz)
- `preise-legacy-2026-06.html` — aus altem `archive/`-Ordner übernommen (Ordner aufgelöst)
- `onboarding-stage2.js` — aus briefing.html ausgehängt; Grep-Beleg: `window.SARTU_ONBOARDING_STAGE2_SCHEMA` wird nirgends gelesen

## Entfernte CSS-Selektoren: **163**

- styles.css: 126 (u. a. Referenzen-Sektion `reference-*`/`thumb-*`/`mini-*`, CTA-Trio `cta-grid/cta-feature*`,
  Startseiten-Altbestand `stats/stat-card/ps-section/ps-block/hero-badges`, Legacy-Lumi `lumi-chat/lumi-style*/lumi-swatch*`,
  `foerder-hint-section`, `pay-badge/pay-sum/pay-alt/pay-note`, `addon-*`, `exclude-*`, `callout-link`, `pricing-notes`, `footer-inner`, `center-left`, `logo-mark/-text`)
- briefing.css: 36 (Legacy-Konfigurator `lb-paket*/lb-wart*/lb-swatch*/lb-unsure` + nach P5 `lb-tiergroup/lb-tier*`)
- portal.css: 1 (`.badge-lime`)
- Vollständige Listen: in den Commit-Messages der P3-Tranchen.
- Dedup-Lauf: **0** zeichenidentische Doppelregeln gefunden.
- Dynamik-Schutz griff: `s-*`-Statusklassen (admin.html baut `'status-badge s-' + status`) wurden als lebendig erkannt und behalten.

## Entfernte console-Statements: **0**

Alle vorhandenen fallen unter die Ausnahmen: `console.warn/error` in Fehlerpfaden (briefing.js, portal-config.js),
der dokumentierte Demo-Fallback `console.info('[Lumi] Anfrage (Demo …)')`, Testausgaben in pricing.test.js.
Auskommentierte Codeblöcke: einziger Kandidat war ein erklärender Supabase/RLS-Kommentar → behalten. **Phase 2 = No-Op.**

## Entferntes JS: **1 Funktion**

- briefing.js `buildTierGroup` (30 Zeilen, verschachtelt): site-weit exakt 1 Vorkommen = nur Definition.
  Kaskaden-Rescan danach: keine weiteren Toten. Check f (Lumi-Durchlauf) nach Entfernung grün.

## UNKLAR-/Zweifelsfall-Liste (behalten — menschliche Entscheidung)

1. **pricing.test.js** — matcht Muster „Test-Datei", ist aber der in KONFIGURATOR.md dokumentierte Preis-Test (`node pricing.test.js`) → bewusst behalten.
2. **Verwaiste Anker-IDs** (kein eingehender Link gefunden, aber plausible Deep-Link-/JS-Ziele → alle behalten):
   index `#preise/#ablauf/#check` · alle leistung-* `#stufen` · preise `#rundum-schutz/#addons/#spezielles/#gefunden-werden/#zahlung` ·
   ueber-uns `#gruender` · ratgeber-foerderung `#weg` · admin `tab-*` (vermutlich dynamisch) · portal `nowCard/kuendigung` · ratgeber `glossaryGrid` (JS-Ziel)
3. **„Leere" Divs** admin `#modalBox`, login `#sentNote`, portal `#timeline` — JS-Render-Ziele, behalten; index-Mockup-Divs = Deko, behalten.
4. **portal.css-Versionen vorbestehend uneinheitlich** (v1 auf 3 Seiten / v2 auf 1) → nach Bump v2/v3, Angleichung wäre kosmetisch.
5. **supabase/functions/** — Backend, nicht Teil des Frontend-Laufs, unangetastet.

## Diff-Statistik gesamt (`git diff main --stat`, ohne tools/node_modules)

**40 Dateien · +852 / −558** (Plus fast vollständig: tools/smoke.js 207 Z. + package-Dateien + dieser Report; das eigentliche Aufräumen ist netto −558 Zeilen Produktivcode).

## Schutzlisten-Bestätigung (gegen main, per Diff/Grep)

- ✅ pricing.js · pricing-calc.js · briefing-schema.js **byte-identisch**
- ✅ robots.txt · sitemap.xml · GO-LIVE-TODO.md **byte-identisch** · vercel.json unverändert (.vercelignore = neue Datei)
- ✅ alle `<title>`/Meta-Descriptions/H1 **unverändert**
- ✅ Marker vorhanden: `[DOMAIN]` 25 Dateien · `GO-LIVE` 21 · `[JAHR]` 22 · `noindex` 28 · Preise 1.290/2.990/5.990/9.990/150 €/Std (smoke-Check g grün)
- ⚠ impressum/datenschutz/agb.html: Diff = **ausschließlich** `styles.css?v=19→20` (Cache-Buster, Pflicht aus Phase 6 — kein Inhalt angefasst)

## Versionsbumps

styles.css v19→**20** · briefing.css v10→**11** · briefing.js v18→**19** · portal.css **+1** je Seite

## Merge-Anleitung (NUR nach Sichtprüfung)

```
git checkout main
git merge cleanup-nacht
git push origin main
```

Hinweis Betriebsumgebung: Der Branch `cleanup-nacht` wurde zur Sicherung **als Branch** nach origin gepusht
(ephemerer Container — ohne Push wäre der Lauf verloren). main wurde nicht berührt.
