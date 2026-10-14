-- AlterTable
ALTER TABLE "Imobiliaria" ADD COLUMN "franquiaLeadsAgente" INTEGER;
ALTER TABLE "Imobiliaria" ADD COLUMN "valorLeadExcedente" DECIMAL(10,2);
ALTER TABLE "Imobiliaria" ADD COLUMN "diaCicloFaturamento" INTEGER;

-- Preenchimento inicial do dia do ciclo: dia de planoExpiraEm quando existir,
-- senão dia de criadoEm — ambos no fuso de Brasília (colunas gravadas em UTC).
UPDATE "Imobiliaria"
SET "diaCicloFaturamento" = EXTRACT(DAY FROM (COALESCE("planoExpiraEm", "criadoEm") AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo')::INTEGER;
