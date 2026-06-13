-- Sartu Portal — komplettes Datenmodell (Etappe 1). Lauffähig auf PostgreSQL 13+ und pg-mem.
-- Statuswerte als TEXT (in der App validiert) statt nativer ENUMs für maximale Portabilität.

CREATE TABLE IF NOT EXISTS admin_user (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT UNIQUE NOT NULL,
  pass_hash   TEXT NOT NULL,
  totp_secret TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kunden (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL DEFAULT '',
  firma      TEXT NOT NULL DEFAULT '',
  telefon    TEXT NOT NULL DEFAULT '',
  geloescht_am TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auth-Infrastruktur: Magic-Link-Tokens werden NUR gehasht gespeichert.
CREATE TABLE IF NOT EXISTS magic_links (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kunde_id   UUID NOT NULL REFERENCES kunden(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type TEXT NOT NULL,          -- 'kunde' | 'admin'
  subject_id   UUID NOT NULL,
  csrf_secret  TEXT,
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projekte (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kunde_id              UUID NOT NULL REFERENCES kunden(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL DEFAULT '',
  paket                 TEXT NOT NULL DEFAULT 'pro',     -- basis|pro|platin|enterprise
  care_stufe            TEXT NOT NULL DEFAULT 'care-m',  -- care-s|care-m|care-l
  status                TEXT NOT NULL DEFAULT 'angebot', -- angebot|angenommen|inhalte|design|korrektur_1..4|finalisierung|abnahme|live
  is_redesign           BOOLEAN NOT NULL DEFAULT false,
  alt_url               TEXT NOT NULL DEFAULT '',
  liefertermin          DATE,
  sprachversionen       INT NOT NULL DEFAULT 1,
  runden_max            INT NOT NULL DEFAULT 3,
  runden_verbraucht     INT NOT NULL DEFAULT 0,
  inhalte_vollstaendig_am TIMESTAMPTZ,
  ssl_ablauf            DATE,
  letzte_sicherung      DATE,
  updates_eingespielt   DATE,
  vorschau_token        UUID NOT NULL DEFAULT gen_random_uuid(),
  vorschau_ordner       TEXT NOT NULL DEFAULT '',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS angebote (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projekt_id       UUID NOT NULL REFERENCES projekte(id) ON DELETE CASCADE,
  pdf_pfad         TEXT NOT NULL DEFAULT '',
  betrag_einmalig  INT NOT NULL DEFAULT 0,
  betrag_monatlich INT NOT NULL DEFAULT 0,
  agb_version      TEXT NOT NULL DEFAULT 'v1',
  angenommen_am    TIMESTAMPTZ,
  angenommen_ip    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS meilensteine (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projekt_id  UUID NOT NULL REFERENCES projekte(id) ON DELETE CASCADE,
  bezeichnung TEXT NOT NULL,
  betrag      INT NOT NULL DEFAULT 0,
  faellig     DATE,
  status      TEXT NOT NULL DEFAULT 'offen',  -- offen|bezahlt (manuell gepflegt; Mollie = GO-LIVE)
  sort        INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inhalte_seiten (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projekt_id  UUID NOT NULL REFERENCES projekte(id) ON DELETE CASCADE,
  seitenname  TEXT NOT NULL,
  stichpunkte TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'offen',  -- offen|vollstaendig
  sort        INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS uploads (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kunde_id   UUID NOT NULL REFERENCES kunden(id) ON DELETE CASCADE,
  projekt_id UUID REFERENCES projekte(id) ON DELETE CASCADE,
  typ        TEXT NOT NULL,           -- logo|bild|dokument|report
  dateiname  TEXT NOT NULL,
  pfad       TEXT NOT NULL,
  groesse    INT NOT NULL DEFAULT 0,
  mime       TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS zugaenge (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projekt_id          UUID NOT NULL REFERENCES projekte(id) ON DELETE CASCADE,
  domain_authcode_enc TEXT,
  alt_website_enc     TEXT,
  google_profil_enc   TEXT,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS korrekturrunden (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projekt_id    UUID NOT NULL REFERENCES projekte(id) ON DELETE CASCADE,
  runde         INT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'offen',  -- offen|eingereicht
  eingereicht_am TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pins (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  runde_id        UUID NOT NULL REFERENCES korrekturrunden(id) ON DELETE CASCADE,
  seite_pfad      TEXT NOT NULL DEFAULT '',
  css_selektor    TEXT NOT NULL DEFAULT '',
  offset_x        INT NOT NULL DEFAULT 0,
  offset_y        INT NOT NULL DEFAULT 0,
  viewport_breite INT NOT NULL DEFAULT 0,
  screenshot_pfad TEXT NOT NULL DEFAULT '',
  text            TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'offen',  -- offen|erledigt
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS care_buchungen (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projekt_id   UUID NOT NULL REFERENCES projekte(id) ON DELETE CASCADE,
  datum        DATE NOT NULL DEFAULT CURRENT_DATE,
  minuten      INT NOT NULL DEFAULT 0,          -- nur 5er-Schritte (App-Validierung)
  beschreibung TEXT NOT NULL DEFAULT '',
  sprachversion INT NOT NULL DEFAULT 1,
  typ          TEXT NOT NULL DEFAULT 'aenderung', -- aenderung|stoerung
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kostenschaetzungen (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projekt_id        UUID NOT NULL REFERENCES projekte(id) ON DELETE CASCADE,
  beschreibung      TEXT NOT NULL DEFAULT '',
  minuten_geschaetzt INT NOT NULL DEFAULT 0,
  betrag            INT NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'offen',  -- offen|freigegeben|abgelehnt
  freigegeben_am    TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS seo_abos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projekt_id    UUID NOT NULL REFERENCES projekte(id) ON DELETE CASCADE,
  stufe         TEXT NOT NULL,                  -- seo-lite|seo-pro|seo-premium
  start         DATE NOT NULL DEFAULT CURRENT_DATE,
  kuendigung_zum DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS seo_kontingente (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projekt_id        UUID NOT NULL REFERENCES projekte(id) ON DELETE CASCADE,
  monat             TEXT NOT NULL,              -- 'YYYY-MM'
  refresh_max       INT NOT NULL DEFAULT 0,
  refresh_verbraucht INT NOT NULL DEFAULT 0,
  seiten_max        INT NOT NULL DEFAULT 0,
  seiten_verbraucht INT NOT NULL DEFAULT 0,
  tracking_max      INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS seo_dokumente (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projekt_id UUID NOT NULL REFERENCES projekte(id) ON DELETE CASCADE,
  typ        TEXT NOT NULL,                     -- report|plan
  monat      TEXT NOT NULL,
  pdf_pfad   TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tickets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projekt_id UUID REFERENCES projekte(id) ON DELETE CASCADE,
  kunde_id   UUID NOT NULL REFERENCES kunden(id) ON DELETE CASCADE,
  typ        TEXT NOT NULL,                     -- stoerung|aenderung|extra_anfrage|postfach|domain|seo_wechsel|seo_kuendigung|abnahme_garantie|loeschung
  text       TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'offen',     -- offen|in_arbeit|erledigt
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kunde_id   UUID REFERENCES kunden(id) ON DELETE SET NULL,
  actor      TEXT NOT NULL DEFAULT 'system',
  aktion     TEXT NOT NULL,
  ziel       TEXT,
  ip         TEXT,
  details    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mail_outbox (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  an         TEXT NOT NULL,
  betreff    TEXT NOT NULL,
  body       TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'offen',     -- offen|gesendet
  sent_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Etappe 7: editierbare Bau-Prompt-Bausteine.
CREATE TABLE IF NOT EXISTS prompt_bausteine (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schluessel TEXT UNIQUE NOT NULL,
  titel      TEXT NOT NULL DEFAULT '',
  text       TEXT NOT NULL DEFAULT '',
  sortierung INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_projekte_kunde ON projekte(kunde_id);
CREATE INDEX IF NOT EXISTS idx_uploads_kunde ON uploads(kunde_id);
CREATE INDEX IF NOT EXISTS idx_magic_kunde ON magic_links(kunde_id);
CREATE INDEX IF NOT EXISTS idx_inhalte_projekt ON inhalte_seiten(projekt_id);
CREATE INDEX IF NOT EXISTS idx_pins_runde ON pins(runde_id);
