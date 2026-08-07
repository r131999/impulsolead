-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "temperatura" TEXT;

-- CreateTable
CREATE TABLE "HistoricoTemperaturaLead" (
    "id"                  TEXT NOT NULL,
    "leadId"              TEXT NOT NULL,
    "imobiliariaId"       TEXT NOT NULL,
    "temperaturaAnterior" TEXT,
    "temperaturaNova"     TEXT,
    "alteradoEm"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricoTemperaturaLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HistoricoTemperaturaLead_imobiliariaId_alteradoEm_idx" ON "HistoricoTemperaturaLead"("imobiliariaId", "alteradoEm");

-- CreateIndex
CREATE INDEX "HistoricoTemperaturaLead_leadId_idx" ON "HistoricoTemperaturaLead"("leadId");

-- AddForeignKey
ALTER TABLE "HistoricoTemperaturaLead" ADD CONSTRAINT "HistoricoTemperaturaLead_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricoTemperaturaLead" ADD CONSTRAINT "HistoricoTemperaturaLead_imobiliariaId_fkey" FOREIGN KEY ("imobiliariaId") REFERENCES "Imobiliaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
