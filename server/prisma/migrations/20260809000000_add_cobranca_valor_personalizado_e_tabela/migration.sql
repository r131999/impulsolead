-- AlterTable
ALTER TABLE "Imobiliaria" ADD COLUMN "valorCobrancaPersonalizado" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "Cobranca" (
    "id"              TEXT NOT NULL,
    "imobiliariaId"   TEXT NOT NULL,
    "valor"           DECIMAL(10,2) NOT NULL,
    "plano"           TEXT NOT NULL,
    "whatsappMsgId"   TEXT,
    "statusEntrega"   TEXT,
    "statusEntregaEm" TIMESTAMP(3),
    "erroEntrega"     TEXT,
    "criadoEm"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cobranca_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Cobranca_imobiliariaId_criadoEm_idx" ON "Cobranca"("imobiliariaId", "criadoEm");

-- CreateIndex
CREATE INDEX "Cobranca_whatsappMsgId_idx" ON "Cobranca"("whatsappMsgId");

-- AddForeignKey
ALTER TABLE "Cobranca" ADD CONSTRAINT "Cobranca_imobiliariaId_fkey" FOREIGN KEY ("imobiliariaId") REFERENCES "Imobiliaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
