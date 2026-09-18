-- AlterTable
-- Default '00:00'/'23:59' = 24/7, preservando o comportamento atual do agente
-- (que hoje não tem nenhuma restrição de horário) para todo cliente existente.
ALTER TABLE "ConfigAgente" ADD COLUMN "horarioAtendimentoInicio" TEXT NOT NULL DEFAULT '00:00';
ALTER TABLE "ConfigAgente" ADD COLUMN "horarioAtendimentoFim" TEXT NOT NULL DEFAULT '23:59';
