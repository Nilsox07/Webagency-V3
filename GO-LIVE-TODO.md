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

## Suchmaschinen / KI
- [ ] robots.txt: `[DOMAIN]` in der Sitemap-Zeile ersetzen.
- [ ] Bing Webmaster Tools + IndexNow einrichten.
- [ ] Google Search Console einrichten + Sitemap einreichen.

## Strukturierte Daten (erst mit echter Adresse)
- [ ] LocalBusiness/ProfessionalService-Schema mit echter NAP ergänzen + Organization um `address` erweitern.
- [ ] Organization `sameAs` mit den echten Social-URLs füllen.
