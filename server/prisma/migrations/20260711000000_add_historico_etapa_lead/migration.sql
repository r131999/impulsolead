-- CreateTable
CREATE TABLE "HistoricoEtapaLead" (
    "id"             TEXT NOT NULL,
    "leadId"         TEXT NOT NULL,
    "imobiliariaId"  TEXT NOT NULL,
    "statusAnterior" TEXT NOT NULL,
    "statusNovo"     TEXT NOT NULL,
    "alteradoEm"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricoEtapaLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HistoricoEtapaLead_imobiliariaId_alteradoEm_idx" ON "HistoricoEtapaLead"("imobiliariaId", "alteradoEm");

-- CreateIndex
CREATE INDEX "HistoricoEtapaLead_leadId_idx" ON "HistoricoEtapaLead"("leadId");

-- AddForeignKey
ALTER TABLE "HistoricoEtapaLead" ADD CONSTRAINT "HistoricoEtapaLead_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricoEtapaLead" ADD CONSTRAINT "HistoricoEtapaLead_imobiliariaId_fkey" FOREIGN KEY ("imobiliariaId") REFERENCES "Imobiliaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
