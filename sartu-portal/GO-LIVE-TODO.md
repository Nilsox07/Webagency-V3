# Sartu Portal — GO-LIVE-TODO (bewusst vorbereitet, nicht scharf)

## Externe Verträge / Anbieter
- [ ] **Mollie-Zahlungen**: Meilenstein-Status wird derzeit manuell im Admin gepflegt. Mollie-Webhook
      → `meilensteine.status` automatisieren. Schnittstelle (Status offen/bezahlt) steht.
- [ ] **lexoffice-Rechnungen**: aktuell PDF-Upload. Später API-Anbindung (Rechnungs-Sync).
- [ ] **KI-Assistent-Verbrauchszähler**: Anbieter offen → Tab versteckt. EU-Inferenz-Anbieter
      (DSGVO/CLOUD-Act) festlegen, dann Zähler + Tab aktivieren.
- [ ] **Shopify-Excel-Import**: vorbereitet, nicht gebaut (kein aktiver Shop-Kunde).
- [ ] **Besucher-Statistik**: monatlicher Report = PDF-Upload. Automatik (Plausible/Matomo) später.

## Infrastruktur
- [ ] **SMTP scharf schalten**: `nodemailer`-Anbindung an mailbox.org (.env steht). Dev: nur mail_outbox+Konsole.
- [ ] **Argon2**: aktiv (native build erfolgreich). Auf Produktions-Image verifizieren.
- [ ] **Docker im Sandbox nicht verfügbar** → Tests laufen über pg-mem. CI gegen echtes Postgres aufsetzen.

## Sicherheit / Recht (Kanzlei)
- [ ] AVV-Dokument finalisieren (Platzhalter in /docs).
- [ ] AGB-Version, Geld-zurück-Wortlaut, Runden-Klausel, Care/SEO-Laufzeiten juristisch prüfen.
- [ ] `COOKIE_SECRET` + `ENC_KEY` in Produktion zufällig & geheim setzen.

(weitere Einträge folgen pro Etappe)
