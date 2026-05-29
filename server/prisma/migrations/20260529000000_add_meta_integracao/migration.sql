-- CreateTable
CREATE TABLE "MetaIntegracao" (
    "id" TEXT NOT NULL,
    "imobiliariaId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "pageToken" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaIntegracao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MetaIntegracao_imobiliariaId_key" ON "MetaIntegracao"("imobiliariaId");

-- AddForeignKey
ALTER TABLE "MetaIntegracao" ADD CONSTRAINT "MetaIntegracao_imobiliariaId_fkey" FOREIGN KEY ("imobiliariaId") REFERENCES "Imobiliaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
