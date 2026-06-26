-- CreateTable Empreendimento
CREATE TABLE "Empreendimento" (
  "id"            TEXT NOT NULL,
  "nome"          TEXT NOT NULL,
  "descricao"     TEXT,
  "imobiliariaId" TEXT NOT NULL,
  "criadoPorId"   TEXT NOT NULL,
  "criadoEm"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Empreendimento_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey Empreendimento → Imobiliaria
ALTER TABLE "Empreendimento" ADD CONSTRAINT "Empreendimento_imobiliariaId_fkey"
  FOREIGN KEY ("imobiliariaId") REFERENCES "Imobiliaria"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable ArquivoImovel (aditivo — nullable, não quebra registros existentes)
ALTER TABLE "ArquivoImovel" ADD COLUMN "empreendimentoId" TEXT;
ALTER TABLE "ArquivoImovel" ADD COLUMN "categoria"        TEXT;

-- AddForeignKey ArquivoImovel → Empreendimento
ALTER TABLE "ArquivoImovel" ADD CONSTRAINT "ArquivoImovel_empreendimentoId_fkey"
  FOREIGN KEY ("empreendimentoId") REFERENCES "Empreendimento"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
