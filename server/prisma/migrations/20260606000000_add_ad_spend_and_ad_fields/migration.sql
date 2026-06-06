-- Add ad tracking fields to Lead (all nullable — non-destructive)
ALTER TABLE "Lead" ADD COLUMN "adId"       TEXT;
ALTER TABLE "Lead" ADD COLUMN "adsetId"    TEXT;
ALTER TABLE "Lead" ADD COLUMN "campaignId" TEXT;
ALTER TABLE "Lead" ADD COLUMN "valorVenda" DECIMAL(12,2);

-- Add adAccountId to MetaIntegracao (nullable — non-destructive)
ALTER TABLE "MetaIntegracao" ADD COLUMN "adAccountId" TEXT;

-- CreateTable AdSpend
CREATE TABLE "AdSpend" (
    "id"            TEXT NOT NULL,
    "imobiliariaId" TEXT NOT NULL,
    "adId"          TEXT NOT NULL,
    "date"          DATE NOT NULL,
    "spend"         DECIMAL(12,2) NOT NULL,
    "currency"      TEXT NOT NULL DEFAULT 'BRL',
    "accountId"     TEXT NOT NULL,
    "criadoEm"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdSpend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdSpend_imobiliariaId_adId_date_key" ON "AdSpend"("imobiliariaId", "adId", "date");
CREATE INDEX "AdSpend_imobiliariaId_date_idx" ON "AdSpend"("imobiliariaId", "date");

-- AddForeignKey
ALTER TABLE "AdSpend" ADD CONSTRAINT "AdSpend_imobiliariaId_fkey"
    FOREIGN KEY ("imobiliariaId") REFERENCES "Imobiliaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Data: populate adAccountId for known integration
UPDATE "MetaIntegracao" SET "adAccountId" = 'act_1769017903471543' WHERE "pageId" = '102893685790333';
