-- Migração de dados: renomear status do funil de vendas
-- Novo funil: lead → atendimento → agendamento → visita → proposta → venda → perdido

-- "novo" → "lead"
UPDATE "Lead" SET status = 'lead' WHERE status = 'novo';

-- "qualificado" → "atendimento" (merge com antigo "atendimento")
UPDATE "Lead" SET status = 'atendimento' WHERE status = 'qualificado';

-- "visita" → "agendamento"
UPDATE "Lead" SET status = 'agendamento' WHERE status = 'visita';

-- "fechado" → "venda"
UPDATE "Lead" SET status = 'venda' WHERE status = 'fechado';

-- Atualizar o valor default da coluna
ALTER TABLE "Lead" ALTER COLUMN "status" SET DEFAULT 'lead';
