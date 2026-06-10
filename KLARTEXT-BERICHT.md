# Sartu · Klartext-Umbau — Abnahmebericht

Ziel: Die gesamte Website **und** der Lumi-Briefing-Flow/Konfigurator in
laienverständlicher Sprache (~B1) für Handwerker, Selbstständige und
Kleinunternehmer ohne Web-Wissen. Prüffrage je Satz: „Würde ein Fliesenleger
ohne Rückfrage verstehen, was er bekommt?"

## Block 5 — Konsistenz-Entscheidungen (eine Schreibweise je Begriff)

| Konzept | Festgelegte Schreibweise |
|---|---|
| Add-ons / Zusatzleistungen | **Extras** |
| Laufende monatliche Leistung | **Hosting & Pflege** (Produktname **Sartu Care** bleibt) |
| Konfigurator | **Paket-Zusammensteller** |
| Korrektur-Durchlauf | **Korrekturrunde** (verständlich: Korrektur + Runde) |
| Preis-Schreibweise | **1.290 €** (Punkt als Tausendertrennung) |
| Liefer-/Fristangabe | **7 Werktage** / „in 7 Tagen online" (1:1 wie zuvor) |
| Buttons | Behalten ihren Namen durch den ganzen Flow |

## Verbindliche Übersetzungen (Auszug, durchgängig angewandt)

Responsive → „Sieht auf Handy, Tablet und PC gleich gut aus" · Hosting →
„Speicherplatz im Internet (Server in Deutschland)" · SSL → „sichere
Verbindung – Schloss-Symbol im Browser" · Backup → „Sicherheitskopie (jede
Nacht)" · DSGVO-konform → „nach Datenschutz-Vorgaben (DSGVO)" · CMS → „Texte
und Bilder später selbst ändern – ohne Programmierkenntnisse" · Onpage-SEO →
„Optimierung direkt auf deiner Seite" · Core Web Vitals → „Lade-Tempo &
Stabilität der Seite" · Keyword → „Suchbegriff" · Meta-Description →
„Google-Anzeigetext" · Sitemap → „Inhaltsverzeichnis für Google" · NAP →
„Name, Adresse, Telefon – überall gleich" · Konfigurator → „Paket-
Zusammensteller" · Add-on → „Extra" · Staging → „Testseite, vorab geprüft" ·
Uptime-Monitoring → „Rund-um-die-Uhr-Überwachung" · Backlink →
„Empfehlungslink von anderen Webseiten" · GEO/KI-Suche → „auffindbar in
KI-Antworten (z. B. ChatGPT)" · Retainer → „monatliche Betreuung".

## „Zusätzlich übersetzt" (über die Pflichttabelle hinaus)

Staging, Go-live, KMU → „kleine und mittlere Betriebe", Meilenstein →
„Zahlungs-Schritt", Performance-Check → „Tempo-Check", Funktionsumfang,
Screenreader → „Vorlese-Programme", WCAG → „Regeln für barrierefreie
Webseiten (WCAG)", semantisches HTML → „technisch sauberer Aufbau",
European Accessibility Act → „EU-Richtlinie", Maßnahmenbeginn →
„Projektstart", Betriebsstätte → „Standort", Funktionsmehrwert → „echter
Nutzen", Q&A-Management → „Fragen & Antworten verwalten", SERP →
„Google-Trefferliste", Ranking → „Platzierung bei Google", Landingpage →
„Zielseite", Conversion → „wie viele Besucher zu Anfragen werden",
Styleguide → „Style-Leitfaden", Vektor/SVG/EPS → „Dateiformate zum Drucken
und fürs Web", Double-Opt-In → „doppelte Bestätigung per E-Mail".

## Abnahme-Checks (programmatisch geprüft)

| # | Kriterium | Status |
|---|---|---|
| 1 | `<title>`, `meta description`, `<h1>` aller Seiten Byte-identisch zur SEO-Fassung | ✅ (Baseline-Diff sauber) |
| 2 | Keyword-`<h2>` / Navigations-Keywords unverändert | ✅ |
| 3 | Alle Preise/Zahlen unverändert (Euro-Token md5-identisch) | ✅ |
| 4 | `node pricing.test.js` grün | ✅ |
| 5 | In `pricing.js`/`briefing-schema.js`/`briefing.js` kein `id`/`value`/`type`/`group`/Preis geändert (nur Anzeige-Strings) | ✅ (Struktur-Signatur identisch) |
| 6 | `collect()`-Payload & `A.*`-Felder unverändert (Supabase-Mapping sicher) | ✅ |
| 7 | JSON-LD aller Seiten parst; FAQ-Texte 1:1 mit sichtbarem Text | ✅ |
| 8 | 50 Glossar-Definitionen fachlich unverändert | ✅ |
| 9 | Glossar-Anker (`id="ssl"` …) vorhanden, jeder verlinkte Begriff auflösbar | ✅ |
| 10 | Keine Lexikon-Links in Überschriften, Navigation oder im Lumi-Flow | ✅ |
| 11 | Kein nackter Fachjargon mehr im sichtbaren Fließtext | ✅ (Rest nur in Glossar & strukturierten Daten) |

## Lumi-Durchlauf (geprüft an den Anzeige-Strings)

Begrüßung „Hi, ich bin Lumi 👋" → Pfadwahl („Ja, ich stelle mir alles selbst
zusammen" / „Nein, hilf mir wählen") → Fragen in Alltagssprache (Branche,
Ziele, Umfang, Funktionen, Look & Farben, Material, Zeit) → Paket-
Zusammensteller mit Empfehlung, **Extras** statt Add-ons, **Hosting &
Pflege** als Pflichtblock, Preisleiste „Einmalig" / „Monatlich · Pflege &
Speicherplatz" → Zahlung in Schritten („40 % bei Auftrag · 30 % wenn du das
Design freigibst · 30 % wenn deine Website online geht") → Kontakt mit
klarem Fehlertext („Bitte gib eine gültige E-Mail-Adresse ein, z. B.
name@firma.de") → Abschluss. Keine Fachbegriff-Links im Flow (Vorgabe).
