/* ============================================================
   Sartu · ZENTRALE PREISDATEN  (entspricht später /lib/pricing)
   ------------------------------------------------------------
   >>> EINZIGE Pflegestelle. Werte 1:1 aus der Leistungsbeschreibung
       (Sartu — Leistungsbeschreibung, Version 2.0, Stand Juni 2026). <<<
   Speist Konfigurator-Karten UND Live-Berechnung.

   Pakete:   Basis 1.290 € (1 Seite), Pro 2.990 € (8), Platin 5.990 € (20),
             Enterprise ab 9.990 € (individuell)
   Care:     Care S 49, Care M 99, Care L 249 €/Mon (bei Jahreszahlung) — PFLICHT
   Extraseite: 199 € pro Seite
   Add-ons / Funktionen: siehe unten (aus der Leistungsbeschreibung)
   ============================================================ */
(function (root, factory) {
  var api = factory();
  root.SARTU_PRICING = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  return {
    currency: '€',
    taxNote: 'Alle Preise netto zzgl. gesetzl. MwSt. · Stand Juni 2026',

    /* ---- Extraseite (Variante A): Inklusiv-Kontingent + Festpreis je weiterer Seite ---- */
    extraPage: { price: 199, label: 'Zusätzliche Seite' }, // Leistungsbeschreibung: 199 €/Seite

    /* ---- Pakete (einmalig) ---- */
    packages: [
      { id: 'basis', name: 'Basis', price: 1290, scope: 'One-Pager', includedPages: 1,
        configurable: true, maintenanceFloor: 'care-s', popular: false,
        perks: ['Alles Wichtige auf einer Seite', 'Sieht auf Handy, Tablet & PC gut aus · Datenschutz inklusive', '2 Korrekturrunden'] },
      { id: 'pro', name: 'Pro', price: 2990, scope: 'bis 8 Seiten', includedPages: 8,
        configurable: true, maintenanceFloor: 'care-m', popular: false,
        perks: ['Bis 8 Unterseiten, individuell gestaltet', 'Alle Seiten für Google optimiert', '3 Korrekturrunden'] },
      { id: 'platin', name: 'Platin', price: 5990, scope: 'bis 20 Seiten', includedPages: 20,
        configurable: true, maintenanceFloor: 'care-l', popular: true,
        perks: ['Bis 20 Seiten', 'Lokal bei Google gefunden werden, inkl. Google-Profil', '4 Korrekturrunden'] },
      // Enterprise = Abzweig, KEIN durchkonfigurierbarer Fixpreis (price: null).
      // priceFrom ist NUR Anzeige ("ab 9.990 €" wie auf Leistungs-/Preise-Seite) und
      // fließt bewusst NICHT in die Live-Berechnung ein.
      { id: 'enterprise', name: 'Enterprise', price: null, priceFrom: 9990, scope: 'individuell', includedPages: null,
        configurable: false, maintenanceFloor: 'care-l', popular: false,
        perks: ['Seitenanzahl ganz nach Bedarf', 'Sonderfunktionen & Anbindung an andere Programme', 'Persönlicher Projektplan'] },
    ],

    /* ---- Sartu Care — Hosting, Sicherheit & Wartung (monatlich, PFLICHT) ----
       Preise gelten bei Jahreszahlung. Pro Paket gilt ein Mindest-Care, Upgrade nach oben möglich. */
    maintenance: [
      { id: 'care-s', name: 'Care S', price: 49,
        perks: ['Speicherplatz auf Servern in Deutschland · sichere Verbindung (Schloss-Symbol)', 'Jede Nacht eine Sicherheitskopie · 30 Tage gespeichert', 'Technische Sicherheits-Updates', 'Rund-um-die-Uhr-Überwachung (alle 5 Minuten)'] },
      { id: 'care-m', name: 'Care M', price: 99, recommended: true,
        perks: ['Alles aus Care S', 'Impressum & Datenschutz bleiben automatisch aktuell', '30 Minuten Änderungen pro Monat inklusive', 'Antwort innerhalb von 1 Werktag'] },
      { id: 'care-l', name: 'Care L', price: 249,
        perks: ['Alles aus Care M', '90 Minuten Änderungen pro Monat inklusive', 'Updates werden vorab auf einer Testseite geprüft', 'Alle 3 Monate Tempo-Check (Ladegeschwindigkeit)'] },
    ],
    maintenanceOrder: ['care-s', 'care-m', 'care-l'],
    mandatoryNote: 'Hosting & Pflege (Sartu Care) ist bei jeder Website Pflicht. Preise bei Jahreszahlung.',

    /* ---- Add-ons / Funktionen (aus der Leistungsbeschreibung) ----
       group  = Varianten-Gruppe: wird im Konfigurator als Karten NEBENEINANDER
                gerendert (wie Pakete/Wartung), nur EINE Variante gleichzeitig wählbar.
       short  = Kurzname für die Variante-Karte (Zusammenfassung nutzt den vollen Namen).
       monthly= Kombi-Add-on: zusätzlich zum Einmalpreis feste monatliche Kosten. */
    addons: [
      /* — Einmalig — */
      /* Texterstellung (Leistungsseite Texte): eine Variante wählen */
      { id: 'texte',        name: 'Texterstellung pro Seite', short: 'Einzelseite', price: 120, type: 'once', common: true, group: 'texte',
        qty: { min: 1, max: 10, default: 1, unit: 'pro Seite' }, desc: 'Wir schreiben 300–500 Wörter pro Seite, 2 Korrekturrunden, dazu der Google-Anzeigetext (Titel + Beschreibung).' },
      { id: 'texte-paket',  name: 'Texte-Paket (5 Seiten)', short: '5er-Paket', price: 490, type: 'once', common: true, group: 'texte',
        desc: 'Texte für 5 Seiten – ca. 98 €/Seite.' },
      { id: 'texte-paket10',name: 'Texte-Paket (10 Seiten)', short: '10er-Paket', price: 890, type: 'once', group: 'texte',
        desc: 'Texte für 10 Seiten – ca. 89 €/Seite.' },
      { id: 'texte-seo',    name: 'SEO-Option für Texte', price: 30, type: 'once',
        qty: { min: 1, max: 10, default: 1, unit: 'pro Seite' },
        desc: 'Wir suchen die passenden Suchbegriffe (1 Haupt- + bis 3 Nebenbegriffe) und bauen sie gezielt in Überschrift und Text ein – damit Google dich besser findet.' },
      /* Branding-Stufen (Leistungsseite Logo): eine Stufe wählen */
      { id: 'logo-lite',    name: 'Logo Lite', price: 490, type: 'once', common: true, group: 'branding',
        desc: '3 Entwürfe, 2 Korrekturrunden, alle Dateiformate zum Drucken und fürs Web, kleiner Style-Leitfaden, alle Rechte gehören dir.' },
      { id: 'branding-pro', name: 'Branding Pro', price: 990, type: 'once', common: true, group: 'branding',
        desc: 'Logo (3 Entwürfe, 3 Runden), Visitenkarte, Briefpapier, E-Mail-Signatur und ein Style-Leitfaden.' },
      { id: 'corporate',    name: 'Corporate Design', price: 1890, type: 'once', group: 'branding',
        desc: 'Komplettes Marken-Paket: einheitliches Design, gesamte Geschäftsausstattung, bis 5 Vorlagen für Social Media, Style-Leitfaden (15+ Seiten).' },
      { id: 'terminbuchung',name: 'Online-Terminbuchung', price: 290, type: 'once', from: true, common: true,
        desc: 'Deine Kunden buchen Termine selbst online. Einrichtung eines Buchungssystems, 1 Kalender pro Mitarbeiter, automatische Bestätigungs- und Erinnerungs-E-Mail.' },
      { id: 'google-profil',name: 'Google-Profil-Setup', price: 290, type: 'once', common: true,
        desc: 'Wir richten dein Google-Unternehmensprofil ein und bestätigen es, wählen Haupt- und bis 9 Zusatzkategorien, schreiben die Beschreibung (bis 750 Zeichen), laden bis 10 Fotos hoch und prüfen, dass Name, Adresse und Telefon überall gleich sind.' },
      /* Kombi-Add-on: Einrichtung einmalig + Betrieb monatlich in EINER Option */
      { id: 'chatbot',      name: 'KI-Chatbot', price: 490, type: 'once', monthly: 49,
        desc: 'Ein Chat-Helfer, der häufige Fragen deiner Kunden automatisch beantwortet (Server in der EU, DSGVO). Mit bis zu 20 Dokumenten angelernt. 490 € Einrichtung + 49 €/Monat Betrieb (ca. 500 Gespräche/Monat inklusive).' },
      { id: 'newsletter',   name: 'Newsletter-Anbindung', price: 290, type: 'once',
        desc: 'Anmeldeformular für deinen Newsletter mit doppelter Bestätigung per E-Mail (rechtssicher), verbunden mit deinem Newsletter-Programm (EU, DSGVO).' },
      { id: 'analytics',    name: 'Besucher-Statistik (Analytics)', price: 190, type: 'once',
        desc: 'Du siehst, wie viele Menschen deine Website besuchen und was sie anklicken. Einrichtung von Google Analytics oder Matomo + Google Search Console, datenschutzkonform an die Cookie-Abfrage gekoppelt, bis zu 3 Ziele (z. B. Anfragen) messbar.' },
      { id: 'social-feed',  name: 'Bewertungs-/Social-Feed', price: 90, type: 'once', from: true,
        desc: 'Zeigt deine Google-Bewertungen ODER deinen Instagram-/Facebook-Verlauf direkt auf der Website (datenschutzkonform), einmalig passend ins Design eingebaut.' },
      { id: 'migration',    name: 'Domain-Umzug', price: 190, type: 'once', from: true,
        desc: 'Wir holen deine Internet-Adresse (Domain) zu unserem Speicherplatz, richten die technische Weiterleitung und das Schloss-Symbol (sichere Verbindung) ein, leiten deine bisherigen Seiten-Adressen weiter und übernehmen bis zu 3 E-Mail-Postfächer.' },
      { id: 'korrektur',    name: 'Zusätzliche Korrekturrunde', price: 140, type: 'once',
        qty: { min: 1, max: 5, default: 1, unit: 'pro Runde' }, desc: 'Eine zusätzliche Runde Änderungswünsche: Du schickst gebündelt dein Feedback, wir setzen es einmal um.' },
      { id: 'mehrsprachig', name: 'Mehrsprachigkeit', price: null, type: 'percent', pct: 40,
        qty: { min: 1, max: 5, default: 1, unit: 'pro Sprache' },
        desc: '+40 % je Sprache: deine Website in weiteren Sprachen, mit Sprach-Umschalter und sauberer Technik, damit Google jede Sprachversion findet. Die Übersetzung lieferst du.' },
      { id: 'express',      name: 'Express-Lieferung', price: null, type: 'percent', pct: 50, min: 390,
        desc: 'Deine Website kommt mit Vorrang dran: One-Pager in 5, einzelne Seite/Text in 2 Werktagen, sobald alle Inhalte da sind (+50 %, mindestens 390 €).' },

      /* — Wiederkehrend (monatlich) — */
      /* SEO-Betreuung als Retainer (Leistungsseite SEO): eine Stufe wählen */
      { id: 'seo-lite',     name: 'SEO-Betreuung Lite', short: 'Lite', price: 149, type: 'month', group: 'seo-betreuung',
        desc: 'Laufende Optimierung für Google: bis 5 Hauptseiten, Beobachtung von bis zu 10 Suchbegriffen, Grundpflege deines Google-Profils, monatlicher Bericht. 3 Monate Mindestlaufzeit.' },
      { id: 'seo-pro',      name: 'SEO-Betreuung Pro', short: 'Pro', price: 390, type: 'month', group: 'seo-betreuung',
        desc: 'Alles aus Lite + Optimierung aller Seiten, ausführliche Suchbegriff-Recherche, 2 neue Zielseiten pro Quartal, Beobachtung von bis zu 30 Suchbegriffen.' },
      { id: 'seo-premium',  name: 'SEO-Betreuung Premium', short: 'Premium', price: 790, type: 'month', group: 'seo-betreuung',
        desc: 'Alles aus Pro + Themen-Plan für deine Inhalte, bis 2 Empfehlungslinks von anderen Seiten pro Monat, Optimierung für die KI-Suche (z. B. ChatGPT), Beobachtung von bis zu 50 Suchbegriffen.' },
      /* Google-Profil-Pflege (Leistungsseite Lokales SEO): eine Stufe wählen */
      { id: 'profil-basic', name: 'Google-Profil-Pflege Basic', short: 'Basic', price: 79, type: 'month', group: 'profil-pflege',
        desc: 'Wir antworten auf alle Bewertungen (innerhalb von 2 Werktagen), halten Öffnungszeiten und Infos aktuell und behalten dein Profil im Blick.' },
      { id: 'profil-pro',   name: 'Google-Profil-Pflege Pro', short: 'Pro', price: 149, type: 'month', group: 'profil-pflege',
        desc: 'Alles aus Basic + 2–4 Beiträge pro Monat, bis 4 Fotos, Beantwortung von Fragen im Profil, monatlicher Bericht.' },
    ],

    /* ---- Varianten-Gruppen: Überschrift + Hinweis für die Nebeneinander-Darstellung ---- */
    addonGroups: {
      'texte':         { label: 'Texterstellung',                  hint: 'eine Variante – erneut klicken zum Abwählen' },
      'branding':      { label: 'Logo & Marken-Auftritt',          hint: 'eine Stufe – erneut klicken zum Abwählen' },
      'seo-betreuung': { label: 'SEO-Betreuung (monatlich)',       hint: 'eine Stufe – erneut klicken zum Abwählen' },
      'profil-pflege': { label: 'Google-Profil-Pflege (monatlich)',hint: 'eine Stufe – erneut klicken zum Abwählen' },
    },

    /* ---- Enterprise-Abzweig: Optionen für die strukturierte Anfrage ---- */
    enterpriseOptions: {
      sonderfunktionen: [
        { value: 'shop',         label: 'Shop / Bezahlung' },
        { value: 'login',        label: 'Geschützter Bereich mit Anmeldung' },
        { value: 'buchung',      label: 'Buchungssystem' },
        { value: 'schnittstelle',label: 'Anbindung an andere Programme (z. B. CRM)' },
        { value: 'mehrsprachig', label: 'Mehrsprachigkeit' },
        { value: 'portal',       label: 'Portal / Community-Bereich' },
      ],
      seitenzahl: [
        { value: 'bis20', label: 'bis 20 Seiten' },
        { value: '20-50', label: '20–50 Seiten' },
        { value: '50plus', label: '50+ Seiten' },
        { value: 'unklar', label: 'Weiß ich noch nicht' },
      ],
      shopGroesse: [
        { value: 'bis50', label: 'bis 50 Produkte' },
        { value: '50-500', label: '50–500 Produkte' },
        { value: '500plus', label: '500+ Produkte' },
        { value: 'unklar', label: 'Weiß ich noch nicht' },
      ],
      zeithorizont: [
        { value: 'asap', label: 'So schnell wie möglich' },
        { value: '1-3m', label: 'In 1–3 Monaten' },
        { value: '3-6m', label: 'In 3–6 Monaten' },
        { value: 'flex', label: 'Flexibel' },
      ],
    },
    enterpriseTriggerFeatures: ['shop', 'login'],
  };
});
