-- Etappe 7: vollstaendiges Lumi-Briefing am Projekt (Quelle fuer den Bau-Prompt).
ALTER TABLE projekte ADD COLUMN IF NOT EXISTS briefing JSONB;
