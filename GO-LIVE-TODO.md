# Sartu — Go-Live-Checkliste

Diese Punkte sind bewusst bis zum Go-live offen. **Reihenfolge bei Domain-Wechsel beachten.**

## Indexierung (ZUERST)
- [ ] **noindex entfernen:** `meta robots` auf allen Seiten zurück auf
      `index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1`
      + den `X-Robots-Tag`-Header aus `vercel.json` löschen.
      **OHNE DIESEN SCHRITT IST DIE SEITE FÜR GOOGLE UNSICHTBAR.**
      (Portal-Seiten login/portal/admin/auth-callback bleiben `noindex,nofollow`.)

## Domain & Platzhalter
- [ ] `[DOMAIN]` überall ersetzen (Canonical, og:url, JSON-LD, robots.txt Sitemap, sitemap.xml).
- [ ] `[OG-IMAGE]` Social-Sharing-Bild hinterlegen und Pfad eintragen.
- [ ] NAP füllen: `[FIRMENNAME / INHABER]`, `[STRASSE UND HAUSNUMMER]`, `[PLZ] [ORT]`, `[TELEFON]`, `[E-MAIL]`, `[NACHNAME]`, `[JAHR]`.
- [ ] Social-Links als echte `<a>`-Tags einsetzen (`[INSTAGRAM-URL]`, `[FACEBOOK-URL]`, `[LINKEDIN-URL]`).

## Performance / Assets
- [ ] **Favicon fehlt:** favicon.ico / SVG-Favicon + `<link rel="icon">` auf allen Seiten ergänzen.
- [ ] `assets/logo.png` (204 KB) als WebP/AVIF-Variante bereitstellen und einbinden (Logo ist das einzige Bild der Site).

## Suchmaschinen / KI
- [ ] robots.txt: `[DOMAIN]` in der Sitemap-Zeile ersetzen.
- [ ] Bing Webmaster Tools + IndexNow einrichten.
- [ ] Google Search Console einrichten + Sitemap einreichen.

## KI-Chat-Assistent (vor erstem Verkauf)
- [ ] **EU-Inferenz-Anbieter festlegen (DSGVO-/CLOUD-Act-konform) VOR dem ersten Verkauf** des
      KI-Chat-Assistenten (Datenverarbeitung in der EU, AVV, keine Übermittlung in Drittländer).
- [ ] **AGB-Klauseln durch Kanzlei prüfen:** Fair-Use (bis 500 Unterhaltungen/Monat),
      Mindestlaufzeit 12 Monate (analog Rundum-Schutz) und die Auskunfts-Abgrenzung
      („Verbindliche Auskünfte — Preise, Termine, Rechtliches — bestätigt ihr persönlich").

## Lumi-Funnel-Tracking (optional, Opt-in)
- [ ] `briefing.js` → `CONFIG.trackingEndpoint` (`[ANALYTICS_BEACON_ENDPOINT]`) auf einen echten
      Beacon-Endpoint setzen. `trackStep()` sendet dann pro Schritt nur den anonymen Schrittnamen
      (keine Antworten, keine Kontaktdaten) und feuert ausschließlich nach Statistik-Einwilligung
      (`SartuConsent.has('analytics')`). Ohne Endpoint bleibt es ein No-op.

## Strukturierte Daten (erst mit echter Adresse)
- [ ] LocalBusiness/ProfessionalService-Schema mit echter NAP ergänzen + Organization um `address` erweitern.
- [ ] Organization `sameAs` mit den echten Social-URLs füllen.

## Rechtliches / AGB (Nachtrag Extras + Mehrsprachigkeit)
- [ ] **AGB von Kanzlei prüfen lassen:** Sprachversions-Klausel („Änderungen und Kontingente
      zählen je Sprachversion") + Inklusiv-Definitionen für Texte, Umzug und Besucher-Statistik
      sowie die Mehrsprachigkeits-Definition (maschinelle Übersetzung mit menschlicher Prüfung;
      Rechtstexte bleiben deutsch, Übersetzung über Kanzlei = Drittkosten).
- [ ] Stundensatz 150 €/Std (5-Minuten-Takt, ab 30 Min. Kostenschätzung) in AGB/Angebotsvorlage spiegeln.

## Redaktionsplan / Backlog
- [ ] Ratgeber-Artikel als Nachfrage-Generator: „Lohnt sich eine polnische oder tschechische
      Website für Betriebe in der Lausitz?" (Mehrsprachigkeit Grenzregion).
