-- AlterTable
ALTER TABLE "Imobiliaria" ADD COLUMN "asaasCustomerId" TEXT;
ALTER TABLE "Imobiliaria" ADD COLUMN "asaasSubscriptionId" TEXT;
CREATE UNIQUE INDEX "Imobiliaria_asaasCustomerId_key" ON "Imobiliaria"("asaasCustomerId");
CREATE UNIQUE INDEX "Imobiliaria_asaasSubscriptionId_key" ON "Imobiliaria"("asaasSubscriptionId");

-- AlterTable
ALTER TABLE "Cobranca" ADD COLUMN "tipo" TEXT NOT NULL DEFAULT 'lembrete_antes';
ALTER TABLE "Cobranca" ADD COLUMN "asaasPaymentId" TEXT;
CREATE UNIQUE INDEX "Cobranca_asaasPaymentId_key" ON "Cobranca"("asaasPaymentId");

ALTER TABLE "Cobranca" ALTER COLUMN "tipo" DROP DEFAULT;
