# Sartu · Konfigurator & Preise — Referenz

Stand: Juni 2026 · Geprüft & konsistent (Syntax ✓, 18 Preis-Tests ✓, Feld-/ID-Check ✓)

Dieses Dokument beschreibt **wo welche Werte gepflegt werden**, **welche Felder es gibt**
und **welche Punkte du noch bestätigen/füllen musst**. Es ersetzt keinen Blick in den Code,
fasst aber die „Single Sources of Truth" zusammen.

---

## 1. Dateien & Zuständigkeiten

| Datei | Zweck | Hier ändern, wenn … |
|---|---|---|
| **`pricing.js`** | **Zentrale Preisdaten**: Pakete, Wartung, Add-ons, Extraseite, Enterprise-Optionen | …ein Preis, ein Add-on oder ein Paket-Detail sich ändert |
| **`payment-terms.js`** | **Zahlungs-Staffelung** je Paket + Garantie-Text (nur Anzeige) | …sich die Meilenstein-Prozente/Bezeichnungen ändern |
| **`pricing-calc.js`** | **Live-Summen-Berechnung** (einmalig/monatlich). Wird von Browser **und** Tests genutzt | …sich die Rechenlogik ändert (selten) |
| **`briefing-schema.js`** | **Briefing-Fragen** (Stufe 1): Optionslisten + Slot-Definitionen. **Keine Preise!** | …eine Frage/Option im Lumi-Flow sich ändert |
| **`briefing.js`** | Flow-Engine: zwei Pfade, Konfigurator, Vorbefüllung, Enterprise-Abzweig, Versand | …sich Ablauf/Logik ändert |
| **`color-mockup.js`** | Optionales Farb-Vorschau-Mockup (Schritt 5) — leicht entfernbar | …Mockup-Optik/Stil-Layouts |
| **`onboarding-stage2.js`** | Platzhalter für Detail-Onboarding **nach Buchung** (Stufe 2) | …Stufe 2 gebaut wird |
| **`pricing.test.js`** | Tests der Summen-Logik (`node pricing.test.js`) | …neue Preis-Fälle abzusichern sind |

**Wichtig:** Preise stehen **nur** in `pricing.js`. `briefing-schema.js` enthält bewusst
keine Preise mehr (frühere `pakete`/`wartungHinweis` wurden entfernt, da sie der heutigen
Pflicht-Wartung widersprachen).

---

## 2. Pakete (einmalig) — `pricing.js → packages`

| ID | Name | Preis | Inkl. Seiten | „Beliebt" | Wartungs-Floor |
|---|---|---|---|---|---|
| `basis` | Basis | **1.290 €** | 1 (One-Pager) | – | Care S |
| `pro` | Pro | **2.990 €** | 8 | – | Care M |
| `platin` | Platin | **5.990 €** | 20 | **✓** | Care L |
| `enterprise` | Enterprise | **kein Fixpreis** (`price: null`) | – | – | Care L |

- Quelle: Leistungsbeschreibung v1.0 (Stand Juni 2026); stimmt mit `preise.html` überein.
- **Enterprise** ist ein **Abzweig**: kein Live-Fixpreis, sondern „Individuelles Angebot"
  + strukturierte Anforderungs-Abfrage (siehe Abschnitt 6).
- **„Beliebt"** sitzt auf **Platin** (Start­seite, Preise-Seite und Konfigurator lesen das
  aus dem `popular`-Flag).

---

## 3. Sartu Care — Hosting, Sicherheit & Wartung (monatlich, **PFLICHT**) — `pricing.js → maintenance`

| ID | Name | € / Monat (Jahreszahlung) | Empfohlen |
|---|---|---|---|
| `care-s` | Care S | **49 €** | – |
| `care-m` | Care M | **99 €** | **✓** |
| `care-l` | Care L | **249 €** | – |

- Care ist bei jeder Website **Pflicht** (keine „Keine-Wartung"-Option). Preise gelten bei
  jährlicher Vorauszahlung.
- Jedes Paket startet auf seinem `maintenanceFloor` (Basis→Care S, Pro→Care M, Platin→Care L,
  Enterprise→Care L). Der Kunde kann **nur nach oben** wechseln (niedrigere Stufen gesperrt).
- Reihenfolge: `maintenanceOrder = [care-s, care-m, care-l]`.
- Enterprise nutzt **Care XL** (individuell) — im Konfigurator nicht relevant (Abzweig).

---

## 4. Extraseiten (Variante A) — `pricing.js → extraPage`

- **199 €** pro zusätzlicher Seite über dem Inklusiv-Kontingent (ab 3 Seiten Bundle-Rabatt).
- Eigener Stepper im Konfigurator; fließt live in die Einmalsumme ein.
- So kann z. B. **Pro + 5 Extraseiten** gewählt werden, ohne zu Enterprise gezwungen zu sein.

---

## 5. Add-ons — `pricing.js → addons`

**Einmalig**

| ID | Name | Preis | Menge |
|---|---|---|---|
| `texte` | Texterstellung pro Seite | 120 € | 1–10 (pro Seite) |
| `texte-paket` | Texte-Paket (5 Seiten) | 490 € | – |
| `texte-paket10` | Texte-Paket (10 Seiten) | 890 € | – |
| `logo-lite` | Logo Lite | 490 € | – |
| `branding-pro` | Branding Pro | 990 € | – |
| `corporate` | Corporate Design | 1.890 € | – |
| `terminbuchung` | Online-Terminbuchung | ab 290 € | – |
| `google-profil` | Google-Profil-Setup | 290 € | – |
| `chatbot` | KI-Chatbot (Einrichtung) | 490 € | – |
| `newsletter` | Newsletter-Anbindung | 290 € | – |
| `analytics` | Analytics-/Tracking-Setup | 190 € | – |
| `social-feed` | Bewertungs-/Social-Feed | ab 90 € | – |
| `migration` | Domain-Umzug / Migration | ab 190 € | – |
| `korrektur` | Zusätzliche Korrekturrunde | 140 € | 1–5 (pro Runde) |
| `mehrsprachig` | Mehrsprachigkeit | **+40 % je Sprache** | 1–5 (pro Sprache) |
| `express` | Express-Lieferung | **+50 %, mind. 390 €** | – |

**Monatlich**

| ID | Name | Preis / Monat |
|---|---|---|
| `chatbot-betrieb` | KI-Chatbot (Betrieb & Pflege) | 49 € |
| `seo-lite` | SEO-Betreuung (Lite) | ab 149 € |
| `profil-basic` | Google-Profil-Pflege (Basic) | ab 79 € |

> Höhere Retainer-Stufen (SEO Pro 390 / Premium 790, Profil-Pflege Pro 149, Branding/Texte-
> Varianten) stehen auf den jeweiligen Leistungsseiten; der Konfigurator bietet die
> Einstiegsstufen als Add-on.

- Alle Werte 1:1 aus der Aufpreisliste in `preise.html`.
- `type`: `once` (einmalig) · `month` (monatlich) · `percent` (Prozent vom Paketpreis, z. B. Express).
- `from: true` = „ab"-Preis; gerechnet wird mit der Untergrenze (z. B. SEO Lite 149 €).
- UX: nur die `common`-Add-ons sind direkt sichtbar, der Rest hinter „Alle Add-ons anzeigen".


---

## 6. Enterprise-Abzweig — `pricing.js → enterpriseOptions`

Wird Enterprise gewählt (oder von Lumi empfohlen), schaltet der Konfigurator von Live-Preis
auf **„Individuelles Festpreis-Angebot"** und fragt strukturiert ab:

- **Sonderfunktionen** (Multi): Shop/Bezahlung, Login/Mitgliederbereich, Buchungssystem,
  Schnittstelle/CRM/API, Mehrsprachigkeit, Portal/Community
- **Seitenzahl** (Single): bis 20 · 20–50 · 50+ · unklar
- **Shop-Größe** (Single, nur wenn „Shop"): bis 50 · 50–500 · 500+ · unklar
- **Sprachen** (Freitext, nur wenn „Mehrsprachigkeit")
- **Schnittstellen** (Freitext, nur wenn „Schnittstelle/CRM")
- **Zeithorizont** (Single): asap · 1–3 Monate · 3–6 Monate · flexibel
- **Notiz** (Freitext, optional)

Das Paket bleibt jederzeit zu einem kleineren wechselbar (keine Sackgasse).

> Hinweis: `enterpriseTriggerFeatures` ist als Konstante vorhanden, aber aktuell **nicht aktiv
> verdrahtet** — der Abzweig wird über die Paketwahl (`configurable: false`) bzw. die
> Lumi-Empfehlung ausgelöst. Kann später als zusätzlicher Auslöser genutzt werden.

---

## 7. Zahlungs-Staffelung (nur Anzeige) — `payment-terms.js`

| Paket | Meilensteine |
|---|---|
| Basis | 50 % bei Auftrag · 50 % bei Go-live |
| Pro & Platin | 40 % bei Auftrag · 30 % bei Designfreigabe · 30 % bei Go-live |
| Enterprise | 30 % bei Auftrag · 30 % bei Designfreigabe · 20 % bei Fertigstellung · 20 % bei Go-live |

- Summe je Paket = **100 %** (getestet).
- **`preise.html` und `payment-terms.js` sind jetzt wortgleich** (zuvor stand bei Enterprise
  „Zwischen-Meilenstein" statt „Fertigstellung" — korrigiert).
- Garantie-Text: „Geld zurück, wenn die erste Design-Vorschau nicht überzeugt." (gilt nur für
  die erste Design-Vorschau, nicht für freigegebene/live-Leistung).

---

## 8. Briefing-Felder (Stufe 1) — `briefing-schema.js → slots`

Pro Schritt erfasste Slots (landen 1:1 im gespeicherten Briefing):

| Slot | Typ | Schritt |
|---|---|---|
| `branche` (+ `branche_sonstiges`) | single / text | 1 |
| `ziele` | multi | 2 |
| `umfang` (+ `seiten`, bedingt) | single / multi | 3 |
| `features` | multi | 4 |
| `stil`, `hauptfarbe`, `nebenfarbe`, `markenfarben_hex` | multi / single / single / text | 5 |
| `material` (+ `uploads`) | multi / files | 6 |
| `zeitrahmen` | single | 7 |
| `paket_empfohlen`, `paket_gewaehlt`, `kontakt` | derived / single / group | 8 |

- **Farbe:** nur **Hauptfarbe + Nebenfarbe** (je Single-Select aus `options.farben`), kein
  HEX-Zwang; optionales Markenfarben-Feld. (Das alte `farbwelt` wurde entfernt.)
- **Uploads** sind optional und nie blockierend (verpflichtende Uploads → Stufe 2).

---

## 9. Zwei Pfade & Vorbefüllung — `briefing.js`

- **Einstieg:** „Weißt du schon, welches Paket?" → **Pfad A** (direkt Konfigurator) oder
  **Pfad B** (8-Schritte-Lumi → mündet in denselben Konfigurator).
- **Direktstart von der Preise-Seite:** `briefing.html?paket=basis|pro|platin|enterprise`
  öffnet den Konfigurator mit vorausgewähltem Paket (Pfad A).
- **Pfad-B-Vorbefüllung** (aus den Briefing-Antworten):
  - Funktion „Terminbuchung" / Ziel „Termine" → Add-on `terminbuchung`
  - „Newsletter" → `newsletter`, „Mehrsprachig" → `mehrsprachig`
  - **kein** Logo im Material → `logo-lite` vorgeschlagen
  - **keine** Texte im Material → `texte-paket` (bzw. `texte` beim One-Pager)
  - „Bestehende Website" → `migration`
  - Zeitrahmen „asap" → `express`
  - Bei Enterprise-Empfehlung: Sonderfunktionen/Seitenzahl/Zeithorizont vorbelegt.

### Paket-Empfehlung (Pfad B) — `recommend()`
- Shop / Mehrsprachig / Login → **Enterprise**
- Großes Projekt → Platin (bzw. Enterprise bei Shop)
- One-Pager → Basis
- Umfangreich + Galerie/Buchung → Platin
- Kompakt / Umfangreich → Pro

---

## 10. Live-Preis & Berechnung — `pricing-calc.js`

- Zwei strikt getrennte Summen: **Einmalig** (Paket + Extraseiten + einmalige Add-ons)
  und **Monatlich** (Pflicht-Wartung + monatliche Add-ons).
- `percent`-Add-ons (Express) = `round(Paketpreis × pct / 100)`.
- Mengen werden auf `min/max` begrenzt (Clamp).
- Enterprise-Paket (`price: null`) zählt **nicht** in die Einmalsumme → es wird ohnehin
  „Individuelles Angebot" angezeigt.

**Tests:** `node pricing.test.js` (18 Zusicherungen, u. a. Extraseiten, Express-Prozent,
Mengen-Clamp, Pflicht-Wartung, Staffelung = 100 %).

---

## 11. Offene Punkte (von dir zu füllen / bestätigen)

| Punkt | Wo |
|---|---|
| `[SARTU-EMAIL]` + Versand-Endpoint (Formspree/Resend) **oder** Supabase-Keys | `briefing.js → CONFIG` |
| Optionaler LLM-Call aktivieren (nur Pfad B) | `briefing.js → CONFIG.useLLM` |
| Range-Preise (SEO Lite/Profil/Terminbuchung „ab") — Fixwert gewünscht? | `pricing.js` |
| Platzhalter `[DOMAIN]`, `[OG-IMAGE]`, `[NACHNAME]` etc. | diverse HTML-Dateien |

---

## 12. Wartung des Systems — Kurzanleitung

- **Preis ändern:** nur in `pricing.js`. Karten **und** Live-Preis ziehen automatisch nach.
- **Add-on hinzufügen:** Objekt in `pricing.js → addons` ergänzen (`id`, `name`, `type`,
  `price`, optional `qty`, `from`, `common`, `desc`). Fertig.
- **Zahlungs-Staffelung ändern:** nur in `payment-terms.js` (Summe je Paket muss 100 % sein).
- **Briefing-Frage ändern:** Optionsliste in `briefing-schema.js → options`.
- **Nach Änderungen:** `node pricing.test.js` laufen lassen und ggf. Cache-Buster in den
  betroffenen HTML-Dateien erhöhen (`?v=…`).
