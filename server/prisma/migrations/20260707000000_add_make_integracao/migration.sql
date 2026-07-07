-- CreateTable MakeIntegracao (integração alternativa via Make, independente do MetaIntegracao)
CREATE TABLE "MakeIntegracao" (
  "id"            TEXT NOT NULL,
  "imobiliariaId" TEXT NOT NULL,
  "token"         TEXT NOT NULL,
  "ativo"         BOOLEAN NOT NULL DEFAULT true,
  "ultimoUsoEm"   TIMESTAMP(3),
  "criadoEm"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MakeIntegracao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MakeIntegracao_imobiliariaId_key" ON "MakeIntegracao"("imobiliariaId");
CREATE UNIQUE INDEX "MakeIntegracao_token_key" ON "MakeIntegracao"("token");

-- AddForeignKey MakeIntegracao → Imobiliaria
ALTER TABLE "MakeIntegracao" ADD CONSTRAINT "MakeIntegracao_imobiliariaId_fkey"
  FOREIGN KEY ("imobiliariaId") REFERENCES "Imobiliaria"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
