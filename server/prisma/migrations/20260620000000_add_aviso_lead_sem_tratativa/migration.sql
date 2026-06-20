-- AlterTable: alerta escalonado de leads sem tratativa (configurável por imobiliária)
ALTER TABLE "Imobiliaria" ADD COLUMN "avisoLeadAtivo"            BOOLEAN  NOT NULL DEFAULT true;
ALTER TABLE "Imobiliaria" ADD COLUMN "avisoLeadCorretorHoras"    INTEGER  NOT NULL DEFAULT 4;
ALTER TABLE "Imobiliaria" ADD COLUMN "avisoLeadGestorHoras"      INTEGER  NOT NULL DEFAULT 6;
ALTER TABLE "Imobiliaria" ADD COLUMN "telefoneNotificacoes"      TEXT;
ALTER TABLE "Imobiliaria" ADD COLUMN "ultimoAlertaSemCorretorEm" TIMESTAMP(3);

-- AlterTable: controle de idempotência dos avisos por lead
ALTER TABLE "Lead" ADD COLUMN "avisoCorretorEm" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN "avisoGestorEm"   TIMESTAMP(3);
