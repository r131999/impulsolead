-- AddColumn: planoExpiraEm
ALTER TABLE "Imobiliaria" ADD COLUMN "planoExpiraEm" TIMESTAMP(3);

-- AddColumn: planoBloqueadoEm
ALTER TABLE "Imobiliaria" ADD COLUMN "planoBloqueadoEm" TIMESTAMP(3);

-- AddColumn: notificacaoVencimento
ALTER TABLE "Imobiliaria" ADD COLUMN "notificacaoVencimento" BOOLEAN NOT NULL DEFAULT false;

-- Imobiliárias existentes recebem plano 'legado' para não serem impactadas
UPDATE "Imobiliaria" SET "plano" = 'legado';
