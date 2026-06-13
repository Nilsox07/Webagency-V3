-- Etappe 6: Lumi-Anfragen-Eingang + Nachfass-Felder.
CREATE TABLE IF NOT EXISTS anfragen (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payload    JSONB NOT NULL,
  kontakt_email TEXT,
  kontakt_name  TEXT,
  status     TEXT NOT NULL DEFAULT 'neu',   -- neu|angelegt|verworfen
  angelegt_kunde UUID REFERENCES kunden(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE projekte ADD COLUMN IF NOT EXISTS nachfass_inhalte INT NOT NULL DEFAULT 0;
ALTER TABLE kostenschaetzungen ADD COLUMN IF NOT EXISTS nachfass_am TIMESTAMPTZ;
