-- CreateTable
CREATE TABLE "HistoricoDistribuicao" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "leadNome" TEXT NOT NULL,
    "leadTelefone" TEXT NOT NULL,
    "corretorId" TEXT NOT NULL,
    "corretorNome" TEXT NOT NULL,
    "distribuidoPor" TEXT NOT NULL,
    "distribuidoPorNome" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "imobiliariaId" TEXT NOT NULL,

    CONSTRAINT "HistoricoDistribuicao_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "HistoricoDistribuicao" ADD CONSTRAINT "HistoricoDistribuicao_imobiliariaId_fkey" FOREIGN KEY ("imobiliariaId") REFERENCES "Imobiliaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
