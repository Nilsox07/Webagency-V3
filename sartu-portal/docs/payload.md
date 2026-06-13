# Lumi-Anfragen-Payload (Format-Vertrag)

Der Endpoint `POST /api/anfragen` (Etappe 6, Token-geschützt) nimmt das EXISTIERENDE
Lumi-Payload aus Webagency-V3/briefing.js (`collect()`) unverändert an. Vollständige
Feldbeschreibung + Beispiel-Fixture folgen in Etappe 6.

Top-Level (Stand Website): `schemaVersion, pfad, produkt_typ, seo_stufe, createdAt, briefing, konfiguration, kontakt`.
