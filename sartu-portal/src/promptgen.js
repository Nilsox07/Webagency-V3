'use strict';
// Bau-Prompt-Generator: erzeugt aus der kompletten Kundenkonfiguration einen kopierfertigen
// Claude-Code-Prompt. Aufbau über editierbare Bausteine (Tabelle prompt_bausteine) mit Platzhaltern.
const prices = require('./prices');
const L = require('./projektlogik');

// Standard-Bausteine, FERTIG ausformuliert (Seed) — erster echter Kunde ergibt sofort brauchbaren Prompt.
function defaultBausteine() {
  return [
    { schluessel: 'kopf', sortierung: 10, titel: 'Produktionsstandard', text:
`Du baust eine fertige, statische Website (HTML/CSS/JS, KEIN Framework, kein Build).
Sartu-Produktionsstandard: mobil zuerst, schnell (Lighthouse > 90), DSGVO-konform,
Rechtstexte als Platzhalter ([IMPRESSUM], [DATENSCHUTZ]), barrierearm, semantische Struktur,
genau EIN <h1> pro Seite, Bilder optimiert (WebP, width/height), Kontaktformular mit
Spam-Schutz + Erfolgs-/Fehlermeldung. Firma: {{firma}} · Branche: {{branche}}.` },
    { schluessel: 'briefing', sortierung: 20, titel: 'Briefing', text:
`BRIEFING
- Paket: {{paket_name}} ({{seitenbudget}} Seiten inkl., {{runden}} Korrekturrunden)
- Ziele: {{ziele}}
- Seiten: {{seitenliste}}
- Termin: {{termin}}
- Sichtbarkeit/SEO: {{seo}}` },
    { schluessel: 'funktion_kontaktformular', sortierung: 30, titel: 'Kontaktformular', text:
`FUNKTION Kontaktformular: Felder Name/E-Mail/Nachricht, DSGVO-Checkbox, serverloses Versenden
als Platzhalter ([FORM-ENDPOINT]), Erfolgs- und Fehlermeldung.` },
    { schluessel: 'funktion_terminbuchung', sortierung: 31, titel: 'Online-Terminbuchung', text:
`FUNKTION Online-Terminbuchung: Einbindung eines Buchungs-Widgets ([BOOKING-EMBED]),
Bestätigungs-/Erinnerungs-Hinweis. Platzhalter, falls Tool noch offen.` },
    { schluessel: 'funktion_galerie', sortierung: 32, titel: 'Bildergalerie', text:
`FUNKTION Bildergalerie: responsives Grid, Lightbox, Lazy-Loading, Alt-Texte aus Dateinamen.` },
    { schluessel: 'funktion_newsletter', sortierung: 33, titel: 'Newsletter', text:
`FUNKTION Newsletter: Anmeldeformular mit Double-Opt-In-Hinweis, Anbindung als Platzhalter
([NEWSLETTER-ENDPOINT]), DSGVO-konform.` },
    { schluessel: 'funktion_blog', sortierung: 34, titel: 'Neuigkeiten/Blog', text:
`FUNKTION Neuigkeiten/Blog: Übersicht + Detailseiten als statische Beiträge, je 1 H1.` },
    { schluessel: 'stil_farben', sortierung: 50, titel: 'Stil & Farben', text:
`STIL & FARBEN
- Stil: {{stil}}
- Hauptfarbe: {{hauptfarbe_hex}}
- Nebenfarbe: {{nebenfarbe_hex}}
Setze die Farben als CSS-Variablen, achte auf ausreichende Kontraste (WCAG AA).` },
    { schluessel: 'texte', sortierung: 60, titel: 'Texte', text:
`TEXTE — schreibe je Seite 300–500 Wörter aus diesen Stichpunkten (du-Form, Klartext, B1):
{{texte_block}}` },
    { schluessel: 'mehrsprachig', sortierung: 70, titel: 'Mehrsprachigkeit', text:
`MEHRSPRACHIGKEIT: {{sprachen}} Sprachversionen. Sprachumschalter, hreflang-Tags,
saubere URL-Struktur je Sprache. Rechtstexte bleiben deutsch.` },
    { schluessel: 'redesign', sortierung: 80, titel: 'Redesign', text:
`REDESIGN: Bestehende Seite {{alt_url}} auslesen, Inhalte übernehmen und neu strukturieren.
Erstelle eine Weiterleitungs-Tabelle (alte URL → neue URL).` },
    { schluessel: 'abnahme', sortierung: 90, titel: 'Abnahme-Checkliste', text:
`ABNAHME-CHECKLISTE (von dir, Claude Code, abzuarbeiten):
- responsiv bei 360 / 768 / 1280 px geprüft
- Browser-Konsole fehlerfrei
- alle internen Links funktionieren
- offene Platzhalter am Ende als Liste ausgeben` },
  ];
}

function joinLabels(arr) { return (arr && arr.length) ? arr.join(', ') : ''; }

// Flacher Kontext aus Projekt-Briefing + Inhalten.
function buildContext(projekt, inhalte, firma) {
  const payload = projekt.briefing || {};
  const bri = payload.briefing || {};
  const kon = payload.konfiguration || {};
  const paket = kon.paket || projekt.paket || 'pro';
  const pk = prices.packages[paket] || {};
  const seiten = (bri.seiten || []).slice();
  if (bri.seiten_sonstige) seiten.push(bri.seiten_sonstige);
  const redesign = payload.produkt_typ === 'redesign' || projekt.is_redesign;

  const texteBlock = (inhalte || []).map((s) => {
    const lines = L.stichpunkteLines(s.stichpunkte);
    if (lines.length < L.MIN_LINES) return '• ' + s.seitenname + ': [FEHLT: Stichpunkte unvollständig]';
    return '• ' + s.seitenname + ':\n  - ' + lines.join('\n  - ');
  }).join('\n');

  return {
    _features: bri.features || [],
    _sprachen: Math.max(1, projekt.sprachversionen || 1),
    _redesign: redesign,
    firma: firma || '',
    branche: bri.branche || '',
    ziele: joinLabels(bri.ziele),
    paket_name: kon.paket_name || pk.name || '',
    seitenbudget: pk.includedPages || '',
    runden: pk.rundenMax || projekt.runden_max || '',
    seitenliste: joinLabels(seiten),
    termin: bri.zeitrahmen || '',
    seo: payload.seo_stufe || 'erstmal ohne',
    stil: bri.stil || '',
    hauptfarbe_hex: bri.hauptfarbe || '',
    nebenfarbe_hex: bri.nebenfarbe || '',
    sprachen: Math.max(1, projekt.sprachversionen || 1),
    alt_url: projekt.alt_url || '',
    texte_block: texteBlock || '[FEHLT: keine Inhalte-Seiten]',
  };
}

// Welche Bausteine gelten? Immer Kopf/Briefing/Stil/Texte/Abnahme; je Funktion ihr Baustein.
function selectKeys(ctx) {
  const keys = ['kopf', 'briefing', 'stil_farben', 'texte', 'abnahme'];
  const funkMap = { kontaktformular: 'funktion_kontaktformular', terminbuchung: 'funktion_terminbuchung', galerie: 'funktion_galerie', newsletter: 'funktion_newsletter', blog: 'funktion_blog' };
  for (const f of ctx._features) if (funkMap[f]) keys.push(funkMap[f]);
  if (ctx._sprachen > 1 || ctx._features.indexOf('mehrsprachig') > -1) keys.push('mehrsprachig');
  if (ctx._redesign) keys.push('redesign');
  return keys;
}

// Platzhalter ersetzen; fehlende Pflichtdaten → [FEHLT: key].
function fill(text, ctx, fehlend) {
  return text.replace(/\{\{(\w+)\}\}/g, (m, key) => {
    const v = ctx[key];
    if (v === undefined || v === null || String(v).trim() === '') { fehlend.push(key); return '[FEHLT: ' + key + ']'; }
    return String(v);
  });
}

function generate(projekt, inhalte, bausteine, firma) {
  const ctx = buildContext(projekt, inhalte, firma);
  const wanted = selectKeys(ctx);
  const byKey = {};
  (bausteine && bausteine.length ? bausteine : defaultBausteine()).forEach((b) => { byKey[b.schluessel] = b; });
  const chosen = wanted.filter((k) => byKey[k]).map((k) => byKey[k]).sort((a, b) => a.sortierung - b.sortierung);
  const fehlend = [];
  const parts = chosen.map((b) => '## ' + b.titel + '\n' + fill(b.text, ctx, fehlend));
  const text = parts.join('\n\n');
  // Stichpunkt-Lücken aus dem Texte-Block ebenfalls als fehlend werten.
  const stichLuecken = (text.match(/\[FEHLT: Stichpunkte/g) || []).length;
  const vollstaendig = fehlend.length === 0 && stichLuecken === 0 && !/\[FEHLT:/.test(text);
  return { text, vollstaendig, fehlend: [...new Set(fehlend)], bausteinKeys: chosen.map((c) => c.schluessel) };
}

// Standard-Bausteine in die DB seeden, falls leer (idempotent).
async function ensureBausteine(db) {
  const c = await db.one(`SELECT count(*)::int AS c FROM prompt_bausteine`);
  if (Number(c.c) > 0) return;
  for (const b of defaultBausteine()) {
    await db.query(`INSERT INTO prompt_bausteine (schluessel,titel,text,sortierung) VALUES ($1,$2,$3,$4)`,
      [b.schluessel, b.titel, b.text, b.sortierung]);
  }
}

module.exports = { defaultBausteine, buildContext, selectKeys, generate, ensureBausteine };
