# Aufräum-Bericht — Sartu Website

> **Status:** Reine Analyse. **Es wurde nichts geändert, gelöscht, umbenannt oder verschoben.**
> Jede Empfehlung ist ein *Vorschlag zum Prüfen*, keine Handlungsanweisung.
> Erstellt auf Basis des aktuellen Standes (Branch `main`, Commit `f779401`).
>
> **Methodik / Grenzen:** Referenzen wurden per `grep`/Textsuche über alle `*.html`, `*.js`, `*.css`, `*.txt` ermittelt.
> Bei „ungenutzten" CSS-Klassen ist das eine **Heuristik** — Klassen, die dynamisch in JS zusammengesetzt
> oder als Teil von Kombi-Selektoren genutzt werden, können fälschlich als ungenutzt erscheinen.
> **Vor jeder Entfernung bitte einzeln gegenchecken.**

---

## 0. Prioritäten-Schnellübersicht

| Prio | Thema | Punkt |
|------|-------|-------|
| 🔴 Vor Go-Live zwingend | `[DOMAIN]` (143×), `[OG-IMAGE]` (31×), NAP/Kontaktdaten, Social-URLs, `[JAHR]` | 4 |
| 🔴 Vor Go-Live zwingend | `cleanUrls` ↔ `.html` in Canonicals/Sitemap/Links entscheiden | 8 |
| 🟠 Wartungsrisiko | Preise an 4 Stellen doppelt gepflegt (Drift-Gefahr) | 2 / 3 |
| 🟠 Wartungsrisiko | Header/Footer in 18 Dateien dupliziert | 2 |
| 🟡 Aufräumen | Tote CSS-Blöcke (alte „Lumi-Chat"- & „References"-UI) | 5 |
| 🟡 Aufräumen | `onboarding-stage2.js` geladen aber inaktiv; uneinheitliche `?v=` | 1 / 6 |
| 🟢 Optional | Flache Ordnerstruktur, Dev-Dateien im Web-Root | 7 |

---

## 1. Tote / ungenutzte Dateien

> **Hinweis:** Es gibt **keine** komplett verwaisten HTML/CSS/Bild-Dateien — alle 18 HTML-Seiten sind über
> Navigation + `sitemap.xml` verlinkt, `assets/logo.png` wird 36× referenziert, und jede `.js` ist mindestens
> auf einer Seite eingebunden. Die folgenden Punkte sind „eingebunden-aber-inaktiv" bzw. Dev-Dateien.

| Datei | Befund | Bewertung |
|-------|--------|-----------|
| `onboarding-stage2.js` | In `briefing.html` per `<script>` geladen, aber die einzige Funktion `initStage2()` wird **nirgends aufgerufen** (kein Treffer in `briefing.js`). Enthält nur ein `TODO` (Zeile 34) + ein leeres Schema. | **Löschkandidat / Einbindung entfernen (prüfen):** wird an Nutzer ausgeliefert, tut aber nichts. Alternativ als bewusster „Stufe-2-Platzhalter" behalten und dokumentieren. |
| `generate_image.py` | OpenAI-Bildgenerierungs-Script (liest `OPENAI_API_KEY`). In **0** HTML referenziert — reines Dev-Werkzeug. Liegt im Web-Root → würde von Vercel öffentlich ausgeliefert (`/generate_image.py` herunterladbar). | **Kandidat (prüfen):** nicht löschen (funktionsfähiges Tool), aber nach `/tools` verschieben oder vom Deploy ausschließen. |
| `__pycache__/generate_image.cpython-311.pyc` | Kompilierter Python-Cache. Durch `.gitignore` (`__pycache__/`) bereits **nicht** im Repo getrackt, liegt aber physisch im Verzeichnis. | **Reine Ablage-Clutter (prüfen):** kann lokal weg, hat keinen Repo-Effekt. |
| `pricing.test.js` | Node-Test (`node pricing.test.js`), in **0** HTML eingebunden. Sinnvoll & funktionierend (19 Assertions). Liegt aber im Web-Root → öffentlich abrufbar. | **Behalten**, ggf. nach `/tests` verschieben (Punkt 7). |

**Aktiv & korrekt eingebunden** (kein Handlungsbedarf): `script.js`, `cookies.js`, `fab.js` (je 18×); `pricing.js`, `pricing-calc.js`, `payment-terms.js`, `briefing-schema.js`, `briefing.js`, `color-mockup.js` (nur `briefing.html`); `ratgeber.js` (nur `ratgeber.html`).

---

## 2. Doppelter / redundanter Code

| Block | Wo | Umfang | Vorschlag |
|-------|----|--------|-----------|
| **`<header class="site-header">` inkl. Dropdown-Menü** | alle 18 HTML | ~30 Zeilen × 18 ≈ **540 Zeilen** | Per Build-Step / Server-Include / JS-Injektion zentralisieren (so wie `cookies.js` bereits den Banner injiziert). MD5-Vergleich zeigt: nahezu identisch, Unterschiede nur Aktiv-Status & Logo-`href`. |
| **`<footer>`** | 17× einfache Variante + 1× `footer-rich` (nur `index.html`) | ~20–40 Zeilen je Seite | Zentralisieren **und** auf eine Variante vereinheitlichen (siehe Punkt 3). |
| **`<head>`-Boilerplate** (preconnect, Google-Fonts, viewport, theme-color, kompletter OG/Twitter-Block) | alle 18 HTML | ~25–35 Zeilen je Seite | Gemeinsames Grundgerüst, nur Titel/Description/Canonical/JSON-LD je Seite variieren. |
| **FAQ-Akkordeon-Markup + `FAQPage`-JSON-LD** | `index`, `leistung-seo`, `preise`, `ratgeber`, `ablauf` | strukturell identisch, Inhalt unterschiedlich | Gemeinsames Snippet/Template denkbar. |
| **Preiswerte mehrfach gepflegt** | `pricing.js` (Quelle) · `preise.html` (hardcodiert) · `leistung-*.html` (in Titeln/Texten) · `KONFIGURATOR.md` (Doku-Tabelle) | 4 Orte | **Drift-Risiko** (siehe Punkt 3). Aktuell konsistent, aber jede Preisänderung muss an 4 Stellen nachgezogen werden. |

---

## 3. Inkonsistenzen zwischen Seiten

1. **Zwei verschiedene Footer.**
   `index.html` → `<footer class="site-footer footer-rich">` (mit `footer-grid`, Spalten, Adresse, Social, `[JAHR]`).
   Alle 17 anderen Seiten → `<footer class="site-footer">` (einfach: `footer-inner`, 4-Link-Nav, Social).
   → Unterschiedliche Optik **und** doppelte Pflege. (War auch die Ursache des Mobile-Overflows: der einfache Footer hat keine `flex-wrap`-Nav — inzwischen in `styles.css` gefixt, aber die zwei Varianten bestehen weiter.)

2. **Title-Muster bricht bei `leistung-seo.html`.**
   Geschwister folgen dem Muster „*Thema — Nutzen/Preis* | Sartu":
   - `leistung-logo.html` → „… ab 490 € | Sartu"
   - `leistung-texte.html` → „… ab 120 € pro Seite | Sartu"
   - `leistung-wartung.html` → „… ab 49 €/Monat | Sartu"
   - `leistung-webdesign.html` → „… ab 1.290 € | Sartu"
   - **Abweichung:** `leistung-seo.html` → „Suchmaschinenoptimierung (SEO) | Sartu" (kein Nutzen-/Preis-Hook).

3. **OG/Twitter-Vollständigkeit ungleich.**
   Inhaltsseiten: `og`=7, `twitter`=4 Tags. Rechtsseiten (`agb`, `datenschutz`, `impressum`): `og`=6, `twitter`=1.
   → Für Legal-Seiten vertretbar, aber bewusst entscheiden.

4. **Preise hartkodiert in HTML** (`preise.html`, `leistung-*.html`) **dupliziert `pricing.js`.**
   Stichprobe stimmt überein (Basis 1.290 €, Care 49/99/249 €, Extraseite 199 €) — aber manuell synchron gehalten, also fragil. `KONFIGURATOR.md` notiert selbst „stimmt mit `preise.html` überein" → bestätigt manuelle Pflege.

5. **Logo-`href` unterschiedlich** (erwartbar): `index.html` → `#top`, alle anderen → `index.html`. Kein Fehler, nur zur Kenntnis.

---

## 4. Verwaiste Platzhalter (Go-Live-Checkliste)

**Gesamt:** ~150+ Platzhalter-Vorkommen. Häufigkeiten:

| Token | Anzahl | Wo (Auszug) |
|-------|-------:|-------------|
| `[DOMAIN]` | **143** | Canonical, `og:url`, `og:image`, JSON-LD `url`/`logo`, `sitemap.xml` (18×), `robots.txt` (Z. 34) — **alle** Seiten |
| `[OG-IMAGE]` | **31** | `og:image` / `twitter:image` auf allen Inhaltsseiten (Wert: `https://[DOMAIN]/[OG-IMAGE]`) |
| `[E-MAIL]` | 3 | `index.html` (JSON-LD Z. 37 + Footer Z. 622) |
| `[TELEFON]` | 2 | `index.html` (JSON-LD Z. 40 + Footer Z. 621) |
| `[STRASSE UND HAUSNUMMER]`, `[PLZ]`, `[ORT]` | je 2 | `index.html` (JSON-LD `PostalAddress` Z. 39 + Footer-Adresse Z. 619–620) |
| `[NACHNAME]` | 2 | `index.html` (Z. 38, Person/Inhaber im JSON-LD) |
| `[INSTAGRAM-URL]`, `[FACEBOOK-URL]`, `[LINKEDIN-URL]` | je 2 | `index.html` (JSON-LD `sameAs` Z. 41 + Footer-Social Z. 654–656) |
| `[FIRMENNAME / INHABER]` | 1 | `index.html` Footer-Adresse (Z. 618) |
| `[LOGO]` | 1 | `index.html` (JSON-LD `logo` Z. 34) |
| `[JAHR]` | 1 | `index.html` Footer-Copyright (Z. 652) |
| `[X]` | 1 | `agb.html` Z. 100 (Leerstelle im AGB-Text — Frist/Wert prüfen) |
| `[LLM_BRIEFING_ENDPOINT]` u. a. | je 1 | `briefing.js` `CONFIG` (Z. 37–41): `[LLM_BRIEFING_ENDPOINT]`, `[FORMSPREE_ODER_RESEND_ENDPOINT]`, `[SUPABASE_URL]`, `[SUPABASE_ANON_KEY]`, `[SARTU-EMAIL]` → **Backend nicht verdrahtet**, Briefing läuft aktuell im Demo-/`localStorage`-Modus. |

**Platzhalter-Anzahl pro Datei (Top):** `index.html` 35 · `sitemap.xml` 18 · `leistungen.html` 16 · `ueber-uns.html` 11 · `llms.txt` 11 · `leistung-*.html` je 10 · `ratgeber-foerderung.html` 9 · `kontakt.html` 9 · `ratgeber.html`/`preise.html`/`briefing.html`/`ablauf.html` je 8 · `briefing.js` 6 · `agb.html` 5 · `impressum.html`/`datenschutz.html` je 4 · `robots.txt` 1.

> Schwerpunkt liegt klar auf `index.html` (Org-/Person-JSON-LD + Rich-Footer-NAP) und der globalen `[DOMAIN]`/`[OG-IMAGE]`-Befüllung.

---

## 5. CSS-Aufräumpotenzial (ungenutzte Selektoren)

> ⚠️ **Heuristik — vor dem Entfernen einzeln prüfen.** Achtung: in den toten Blöcken liegen **vereinzelt noch
> genutzte Regeln** (s. Warnungen). Also **nicht** blind ganze Zeilenbereiche löschen.

### `styles.css`

| Bereich | Zeilen (ca.) | Befund |
|---------|--------------|--------|
| **Alte „References/Testimonials"-Sektion** | **505–601** | `.references`, `.references-head`, `.reference-grid`, `.reference-card`, `.ref-thumb`, `.thumb-blue/-amber/-green`, `.mini-laptop/-cap/-btn/-phone`, `.ref-stats` — auf **keiner** Seite verwendet. Größter, weitgehend **zusammenhängender** Löschkandidat (~96 Zeilen). |
| **Alte „Lumi-Chat"-UI** | **1269–1456** (+ Responsive **1939–1944**) | `.lumi-chat`, `.lumi-msg`, `.lumi-typing`, `.lumi-input-zone`, `.lumi-chips`, `.lumi-chip`, `.lumi-textform`, `.lumi-send`, `.lumi-styles`, `.lumi-style(-preview/-meta)`, `.flv-clean/-bold/-elegant/-dark`, `.lumi-swatch(es)/-dots`, `.lumi-summary-card/-row`, `.lumi-preview-grid/-shot`, `.lumi-cta-row`, `.lumi-restart`. Ersetzt durch den aktuellen `briefing.css`-Flow (`lb-*`). |
| `.hero-badges` | 271–284 | altes Hero-Element, ungenutzt |
| `.hero-stat` | 308–318 | altes Hero-Element, ungenutzt |
| Einzelne | div. | `.faq-more` (1504), `.center-left` (101), `.answer-first.on-light` (1712–1713), `.logo-mark`/`.logo-text` (116–117), `.svc-section.light-bg` (1786) — als ungenutzt geflaggt; **bitte prüfen** (z. B. `logo-mark/-text` könnte als Text-Logo-Fallback gedacht sein). |

> 🔴 **WICHTIG (nicht mitlöschen):** Innerhalb des Lumi-Blocks liegt `.lumi-disclaimer` (Z. **1451**) — die **wird** in `briefing.html` genutzt. Ebenso sind `.lumi-card`, `.lumi-topbar`, `.lumi-avatar`, `.lumi-intro`, `.lumi-section`, `.lumi-progress*` (weiter oben in der Datei) **aktiv**. Deshalb **Selektor-für-Selektor** entfernen, nicht den Bereich am Stück.
>
> 💡 Die generischen Einzelklassen `.bar`, `.dot`, `.bubble`, `.selected`, `.amber`, `.bot`, `.user` werden **ausschließlich innerhalb** der toten Lumi-Blöcke verwendet (z. B. `.lumi-typing .dot`, `.lumi-style.selected`) — sie fallen automatisch mit weg, sobald die Blöcke entfernt sind. (Wurden von der Heuristik als „evtl. genutzt" markiert, weil der bloße Wortname auch in fremden Kontexten/Texten vorkommt → daher hier separat eingeordnet.)

### `briefing.css`

| Selektoren | Zeilen (ca.) | Befund |
|-----------|--------------|--------|
| `.lb-swatches`, `.lb-swatch`, `.lb-swatch-dots` | **200–218** | 0 Treffer in `briefing.js` — ersetzt durch `.lb-colortile`/`.lb-colordot`. |
| `.lb-pakete`, `.lb-paket`, `.lb-paket-badge/-name/-price/-note/-hint` | ab **235** | 0 Treffer — ersetzt durch `.lb-pkg*`. |
| `.lb-unsure`, `.lb-wart-hint` | div. | 0 Treffer in `briefing.js`. |

> Gegenprobe bestanden: `.lb-cards-wide` **ist** genutzt (in `briefing.js`, `zeitrahmen`-Schritt) — also **nicht** entfernen (war ein Heuristik-Fehlalarm).

---

## 6. JS-Hygiene

1. **Uneinheitliche `?v=`-Cache-Buster:**
   `styles.css?v=13` · `briefing.css?v=6` · `briefing.js?v=9` · `briefing-schema.js?v=4` · `pricing.js?v=5` · `pricing-calc.js?v=4` · `payment-terms.js?v=1` · `cookies.js?v=1` · `fab.js?v=1` · `color-mockup.js?v=1` · `onboarding-stage2.js?v=1`.
   **Ganz ohne `?v=`** (kein Cache-Busting → Stale-Cache-Risiko bei Updates): `script.js`, `ratgeber.js`.
   → Einheitliches Schema empfehlenswert (z. B. überall `?v=<datum>` oder zentral).

2. **`console.*`-Reste** in `briefing.js`: Z. **1283** `console.warn`, Z. **1308** `console.info`, Z. **1332** `console.warn`.
   → Sind bewusstes Fehler-/Demo-Logging (vertretbar), aber für Produktion ggf. hinter ein Debug-Flag legen.

3. **`onboarding-stage2.js`:** enthält ein `TODO` (Z. 34) und ein `initStage2()`, das **nie aufgerufen** wird → toter Code, der trotzdem an Nutzer ausgeliefert wird (siehe Punkt 1).

4. **Sauber:** Keine doppelt eingebundenen Scripts gefunden. Keine größeren auskommentierten JS-Code-Leichen. `pricing.test.js` ist grün.

5. **Optional (Wartbarkeit):** `briefing.js` ist mit ~1.300 Zeilen / 65 KB sehr groß/monolithisch — nur als Hinweis, kein Defekt.

---

## 7. Struktur- / Benennungs-Chaos

1. **Alles flach im Root.** ~40 Dateien liegen direkt im Projektverzeichnis (nur `assets/` ist ausgelagert, für das Logo). Vorschlag (größerer Eingriff, da alle Pfade angepasst werden müssten): Gruppierung z. B. `/css`, `/js`, `/legal`, `/tools`.

2. **Dev-/Test-Dateien im Web-Root**, werden von Vercel mit ausgeliefert: `generate_image.py`, `__pycache__/`, `pricing.test.js`. Vorschlag: nach `/tools` bzw. `/tests` verschieben und/oder vom Deploy ausnehmen.

3. **Benennung sonst konsistent:** `leistung-*.html` (Singular, Unterseiten) vs. `leistungen.html` (Plural, Hub) ist klar & gewollt; `ratgeber.js` (seitenspezifisch) vs. `script.js` (global) ist nachvollziehbar.

4. **Drei „lumi"-Namensräume nebeneinander** stiften Verwirrung: lebendiges `lumi-*` (Seiten-Shell, in `styles.css`) + lebendiges `lb-*` (Flow, in `briefing.css`) + **totes** `lumi-*` (alte Chat-UI, in `styles.css`). Nach Bereinigung von Punkt 5 ist das deutlich klarer.

---

## 8. SEO / Technik

1. **`cleanUrls` ↔ `.html`-Widerspruch (wichtig).**
   `vercel.json` hat `"cleanUrls": true` → Seiten laufen ohne `.html`, und `/x.html` wird per **308 auf `/x`** umgeleitet. Aber:
   - **Canonicals** nutzen `.html` (z. B. `https://[DOMAIN]/leistung-seo.html`),
   - **interne Links** nutzen `.html` (allein `index.html`: 48 Stück),
   - **`sitemap.xml`** listet alle URLs mit `.html`.
   → Canonical & Sitemap zeigen auf **weiterleitende** URLs, jeder interne Klick löst eine Weiterleitung aus. **Eine** Form festlegen (empfohlen: überall endungslos — oder `cleanUrls:false`).

2. **`og:image` = `https://[DOMAIN]/[OG-IMAGE]`** auf jeder Seite → **kein** Social-Preview-Bild, bis gesetzt (doppelter Platzhalter, siehe Punkt 4).

3. **Alle Canonicals / `og:url` mit `[DOMAIN]`** → bis zum Domain-Eintrag technisch unwirksam.

4. **`index.html` `FAQPage`-JSON-LD sehr groß** (~22 Frage/Antwort-Paare). Google verlangt, dass jede ausgezeichnete FAQ **sichtbar** auf der Seite steht → bitte prüfen, ob alle 22 wirklich im sichtbaren Homepage-Inhalt vorkommen (sonst Risiko bzgl. Structured-Data-Richtlinien).

5. **Dev-Dateien öffentlich abrufbar:** `generate_image.py`, `pricing.test.js` liegen im Root und würden über die Domain ausgeliefert (Quellcode einsehbar). Niedriges Risiko, aber unnötig (siehe Punkt 7).

6. **Positiv / sauber:** Jede Seite hat genau **1** `<title>`, **1** Meta-Description, **1** Canonical und **JSON-LD**; sinnvolle Schema-Typen je Seitentyp (`Organization`/`WebSite`/`FAQPage` auf Start, `Service`+`BreadcrumbList` auf Leistungsseiten, `HowTo` auf Ablauf, `AboutPage` auf Über-uns, `ContactPage` auf Kontakt). `sitemap.xml` deckt alle 18 Seiten ab, `robots.txt` vorhanden. Solide Basis — es fehlen v. a. die echten Werte (Domain/Bilder/NAP).

---

## Anhang — Verifikations-Snippets (read-only)

Damit du Stichproben selbst nachvollziehen kannst:

```bash
# Alle Platzhalter mit Fundstelle
grep -rnoE "\[[A-ZÄÖÜ][A-ZÄÖÜ0-9 _/.-]*\]" *.html *.js *.txt sitemap.xml

# Wird eine CSS-Klasse irgendwo im class="..." oder JS benutzt?
grep -rn "reference-card\|lumi-chat\|lb-swatch" *.html *.js

# Footer-Variante je Seite
for f in *.html; do printf "%-26s " "$f"; grep -oE '<footer class="[^"]+"' "$f" | head -1; done

# cleanUrls vs. .html in Canonicals
grep -hoE 'rel="canonical" href="[^"]+"' *.html
```
