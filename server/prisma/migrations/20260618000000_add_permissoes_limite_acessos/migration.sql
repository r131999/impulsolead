-- AlterTable: adiciona permissoes (JSONB) e limiteAcessos (INT) ao model Imobiliaria
ALTER TABLE "Imobiliaria" ADD COLUMN "permissoes"    JSONB   NOT NULL DEFAULT '{}';
ALTER TABLE "Imobiliaria" ADD COLUMN "limiteAcessos" INTEGER NOT NULL DEFAULT 5;

-- Migração de dados: todos os clientes existentes recebem acesso total
-- (legado e clientes ativos não podem perder nenhuma funcionalidade)
UPDATE "Imobiliaria"
SET "permissoes" = '{
  "importacaoListas":          true,
  "gestaoImoveis":             true,
  "arquivosImovel":            true,
  "apresentacaoPersonalizada": true,
  "tourVirtual":               true,
  "painelCampanhas":           true,
  "relatorios":                true,
  "followUpAutomatico":        true,
  "agenteIA":                  true,
  "chatLead":                  true,
  "multiplosWhatsapp":         true
}';

-- Migração de dados: todos os clientes existentes recebem limite generoso
-- (todos são legado hoje; admin ajusta individualmente se quiser)
UPDATE "Imobiliaria" SET "limiteAcessos" = 999;
