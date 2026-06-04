-- CreateTable Apresentacao
CREATE TABLE "Apresentacao" (
    "id" TEXT NOT NULL,
    "imobiliariaId" TEXT NOT NULL,
    "corretorId" TEXT,
    "nomeImóvel" TEXT NOT NULL,
    "nomeLocal" TEXT,
    "descricao" TEXT,
    "valor" TEXT,
    "quartos" INTEGER,
    "banheiros" INTEGER,
    "vagas" INTEGER,
    "areaM2" DOUBLE PRECISION,
    "slug" TEXT NOT NULL,
    "publicado" BOOLEAN NOT NULL DEFAULT false,
    "nomeLeadPersonalizado" TEXT,
    "whatsappCorretor" TEXT,
    "nomeCorretor" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Apresentacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable FotoApresentacao
CREATE TABLE "FotoApresentacao" (
    "id" TEXT NOT NULL,
    "apresentacaoId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "ambiente" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FotoApresentacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Apresentacao_slug_key" ON "Apresentacao"("slug");

-- AddForeignKey
ALTER TABLE "Apresentacao" ADD CONSTRAINT "Apresentacao_imobiliariaId_fkey"
    FOREIGN KEY ("imobiliariaId") REFERENCES "Imobiliaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotoApresentacao" ADD CONSTRAINT "FotoApresentacao_apresentacaoId_fkey"
    FOREIGN KEY ("apresentacaoId") REFERENCES "Apresentacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
