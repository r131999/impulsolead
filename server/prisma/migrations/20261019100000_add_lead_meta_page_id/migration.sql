-- Página Meta de origem do lead (entry[].id do webhook leadgen). Anulável, sem default e sem
-- backfill: leads antigos ficam nulos e não entram na API de Conversões.
ALTER TABLE "Lead" ADD COLUMN "metaPageId" TEXT;
