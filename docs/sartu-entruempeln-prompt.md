# Sartu — Entrümpel-Prompt (versionierter Etappen-Plan)

Dieser Plan dokumentiert den gestaffelten Umbau („Entrümpelung") der Sartu-Website.
Jede Etappe wurde einzeln freigegeben und mit Vorher/Nachher-Beweis + Konsole-Check
umgesetzt. Optik-System-Grundlage = Etappe 1 (alternierender Hintergrund-Rhythmus
weiß ↔ hell, Hero und Schluss-CTA dunkel/Navy).

Branch: `claude/sartu-lumi-rebuild-5o5pav`

---

## ETAPPE 1 = BLOCK 1+2 — STARTSEITE: 6-ABSCHNITT-GERÜST
Startseite (`index.html`) in **genau 6 `<section>`-Landmarks** bündeln, ohne den
per-Sektion-Optik-Rhythmus zu brechen. Umsetzung: 6 `home-section`-Wrapper; die
inneren Styling-Blöcke (`hero`/`stats`/`pricing`/`guarantee`/`founder`/`faq`/`cta` …)
werden zu `<div>` mit unveränderten Klassen → Hintergrund-Rhythmus 1:1 erhalten,
IDs/Anker gültig. Kernstatistik der Zahlen-Sektion: **Bitkom „50 % nutzen KI-Suche"**
als erste Karte (GEO/Zukunftsargument).

**Block-2-Feinspezifikation Startseite (in Etappe 4 nachgezogen):**
- Sektion „So läuft's" = **3-Schritte-Teaser** statt 7-Schritte-Vollversion:
  ① „Beantworte ein paar Klick-Fragen (2 Minuten, ohne Termin)"
  ② „Du bekommst Empfehlung + Festpreis — schriftlich, unverbindlich"
  ③ „Wir bauen, du gibst frei — online in 7–14 Werktagen".
  Garantie-Hinweis als Fußzeile, Link „Den ganzen Ablauf ansehen →" auf /ablauf.
  Voraussetzung: alle 7 Schritte (inkl. Live-Status, Feedback per Klick) liegen
  vollständig auf /ablauf.
- Schluss-CTA **ohne Karten-Trio**: nur Headline, 1 Satz, Primär-Button (Lumi/Briefing),
  Sekundär-Link Kontakt. Unique Trio-Aussagen als Halbsätze in die 3 Schritte integriert.

---

## ETAPPE 2 = BLOCK 3 — PREISSEITE: SAMMELSEKTION ENTZERREN
Neue Sektionsfolge, jede mit eigener H2 (Kopfmuster: Lime-Eyebrow → H2 → max. 1 Subzeile):
1. **Pakete** (4 Karten + „jede weitere Seite 199 €"-Zeile) — unverändert.
2. **„Was ist der Rundum-Schutz?"** — eigene schmale Sektion (bestehender Erklärblock, raus aus dem Paket-Grid).
3. **„Extras — nur, was du wirklich brauchst"** — NUR die 4 sichtbaren Extras-Karten + Newsletter-Ausklapper. Sonst nichts.
4. **„Spezielles"** — eigene kleine Sektion, zweispaltig, zwei Kompakt-Zeilen: „Nur das Design (990/1.990 €) → Details" und „Sonderwünsche (KI-Assistent, Kundenbereich, Schnittstellen) — Festpreis schriftlich → Lumi".
5. **„Nach dem Start: Das Gefunden-werden-Programm"** — eigene Sektion mit eigener H2 (ab 149 €/Monat, Ehrlichkeitssatz, Link /leistung-seo).
6. **Zahlung + Garantie** (bestehend).
7. **Preis-FAQ** (bestehend).

Schutzregeln: Title/Meta/H1 byte-identisch · keine Preise/Zahlen/Leistungstexte ändern,
nur umsortieren · FAQPage-Schema = sichtbarer Text · Hintergrund-Rhythmus nach Etappe-1-
Optik (weiß/grau alternierend, Schluss dunkel) · briefing.js nicht anfassen.

---

## ETAPPE 3 = BLOCK 4 — LEISTUNGSSEITEN: FESTES 5er-TEMPLATE
Alle 6 Seiten (webdesign, seo, lokales-seo, wartung, texte, logo). Einheitliche Struktur:
Hero (Chips) → „Was du bekommst" (Answer-First + Kernpunkte + „Auf einen Blick"-Karte sticky)
→ Detail-Sektion → Paket-Brücke → FAQ + CTA.

- **/leistung-webdesign:** Paketkarten-Block (Start/Wachstum/Platzhirsch/Sonderprojekte +
  Mehrsprachigkeits-Karte) ENTFERNEN (dupliziert /preise). Ersatz: Paket-Brücke = eine
  Karte/Zeile „Start 1.290 € · Wachstum 2.990 € · Platzhirsch 5.990 € — jeweils +
  Rundum-Schutz. Alle Details und Extras →" (/preise). „Nur das Design" BLEIBT hier;
  Mehrsprachigkeits-Details bleiben als kompakter Absatz (Preis-Karte wohnt auf /preise).
- **Übrige 5 Seiten:** genau EINE Paket-/Preis-Referenzzeile je Seite statt mehrfacher
  Nennungen; eigene Service-Grids bleiben als Detail-Sektion (ihr Zuhause).
- „Auf einen Blick"-Karte = einziger Faktenkasten je Seite.
- max. 6 Sektionen inkl. Hero und FAQ; „Vier Dinge" → Punkteliste in „Was du bekommst".
- Hintergrund-Rhythmus weiß/grau alternierend.

Schutzregeln: Title/Meta-Description/H1 byte-identisch · Answer-First-Absätze unverändert
und im ersten Inhaltsblock · keine Preise/Zahlen/Leistungsdefinitionen ändern · gelöschter
Volltext muss ein Zuhause haben · FAQPage-/Service-Schema = sichtbarer Text · kanonische
FAQ-Heimaten unverändert · briefing.js nicht anfassen · jede Brücke verlinkt mit
beschreibendem Anker.

---

## ETAPPE 4 = BLOCK 5+6 — OPTIK-FEINSCHLIFF + GESAMT-ABNAHME

**BLOCK 5 — OPTIK-FEINSCHLIFF (site-weit):**
Etappe-1-Optik auf alle verbliebenen Sektionen (Startseite, /preise, 6 Leistungsseiten):
Hintergrund-Rhythmus weiß ↔ #F6F7FA, Hero und Schluss-CTA dunkel (Navy) · einheitliches
Sektions-Padding (Desktop ~88px, Mobil ~56px) · eine max-width (~1100px) · Sektions-Kopf
einheitlich (Lime-Eyebrow 12px Versalien → H2 → max. 1 Subzeile) · Karten einheitlich
(weiß, 1px #E3E7EF, Radius 16px, dezenter Hover, keine Schatten-Orgien, keine
Scroll-Animationen) · max. 3 Karten/Reihe Desktop · pro Sektion höchstens 1 Button
(Lime primär, Ghost sekundär) · max. 1 Hervorhebung pro Absatz.
Abstands-Audit (leere Wrapper, doppelte Trennlinien, verwaiste Container — NUR aus HTML
entfernen, CSS-Selektoren stehen lassen) · eine Accordion-Optik überall · Header/Footer-
Abstände vereinheitlichen · Mobile-Pass 360–400px · CSS-Versionsparameter +1.

**BLOCK 6 — GESAMT-ABNAHME (Tabelle, jede Zeile ✅/❌ + Beleg):**
- Startseite: genau 6 `<section>` · kein 7-Schritte-Block · keine getrennten Problem/Lösungs-
  Sektionen · CTA ohne Karten-Trio · verschobener Inhalt mit Zieladresse belegt.
- /preise: 7 Sektionen in Soll-Reihenfolge · Extras = 4 Karten + 1 Ausklapper.
- 6 Leistungsseiten: max. 6 Sektionen · 1 Paket-/Preis-Brücke je Seite · kein Paketgrid auf
  webdesign · „Nur das Design" vorhanden · „Auf einen Blick" einziger Faktenkasten.
- Schutz: Titles/Meta-Desc/H1 byte-identisch (vs. vor Etappe 1) · Answer-First unverändert ·
  FAQPage-/Service-/HowTo-Schema = sichtbarer Text · Preis-Stichproben unverändert
  (1.290/2.990/5.990/ab 9.990/49/99/249/199/149/990/1.990/150 €/Std) · briefing.js byte-identisch.
- Alle neuen Teaser-/Brücken-Links mit bestätigtem Ziel · Browser-Konsole fehlerfrei (8 Seiten).
