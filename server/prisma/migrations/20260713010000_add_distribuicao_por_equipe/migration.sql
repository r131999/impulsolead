-- AlterTable
ALTER TABLE "ConfigAgente" ADD COLUMN "distribuicaoPorEquipeAtiva" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ConfigAgente" ADD COLUMN "distribuicaoPorEquipeManual" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "formId" TEXT;

-- CreateTable
CREATE TABLE "FormularioEquipe" (
    "id"            TEXT NOT NULL,
    "imobiliariaId" TEXT NOT NULL,
    "formId"        TEXT NOT NULL,
    "equipeId"      TEXT NOT NULL,
    "criadoEm"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormularioEquipe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FormularioEquipe_imobiliariaId_formId_key" ON "FormularioEquipe"("imobiliariaId", "formId");

-- AddForeignKey
ALTER TABLE "FormularioEquipe" ADD CONSTRAINT "FormularioEquipe_imobiliariaId_fkey" FOREIGN KEY ("imobiliariaId") REFERENCES "Imobiliaria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormularioEquipe" ADD CONSTRAINT "FormularioEquipe_equipeId_fkey" FOREIGN KEY ("equipeId") REFERENCES "Equipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
