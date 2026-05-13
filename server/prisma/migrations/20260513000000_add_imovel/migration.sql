-- CreateTable
CREATE TABLE "Imovel" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "localizacao" TEXT NOT NULL,
    "valorMin" DOUBLE PRECISION,
    "valorMax" DOUBLE PRECISION,
    "quartos" INTEGER,
    "area" TEXT,
    "status" TEXT NOT NULL DEFAULT 'disponivel',
    "destaque" BOOLEAN NOT NULL DEFAULT false,
    "imobiliariaId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Imovel_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Imovel" ADD CONSTRAINT "Imovel_imobiliariaId_fkey" FOREIGN KEY ("imobiliariaId") REFERENCES "Imobiliaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
