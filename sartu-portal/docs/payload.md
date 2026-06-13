# Lumi-Anfragen-Payload (Format-Vertrag)

Der Endpoint `POST /api/anfragen` (Etappe 6, Token-geschützt) nimmt das EXISTIERENDE
Lumi-Payload aus Webagency-V3/briefing.js (`collect()`) unverändert an. Vollständige
Feldbeschreibung + Beispiel-Fixture folgen in Etappe 6.

Top-Level (Stand Website): `schemaVersion, pfad, produkt_typ, seo_stufe, createdAt, briefing, konfiguration, kontakt`.

## Beispiel-Fixture
`test/fixtures/lumi-payload.json` ist ein vollständiges Beispiel im echten `collect()`-Format
(Pfad B, produkt_typ website, SEO lite, Funktion Terminbuchung, Kontakt). Der Endpoint
`/api/anfragen` nimmt es 1:1 an; der Admin legt daraus per Klick Kunde + Projekt an.
GO-LIVE-TODO: Live-Submit von briefing.js auf diesen Endpoint umstellen (Token in .env).
