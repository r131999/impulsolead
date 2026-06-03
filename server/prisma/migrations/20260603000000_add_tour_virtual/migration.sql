-- CreateTable TourVirtual
CREATE TABLE "TourVirtual" (
    "id" TEXT NOT NULL,
    "imobiliariaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "slug" TEXT NOT NULL,
    "publicado" BOOLEAN NOT NULL DEFAULT false,
    "whatsappCorretor" TEXT,
    "nomeCorretor" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TourVirtual_pkey" PRIMARY KEY ("id")
);

-- CreateTable Comodo
CREATE TABLE "Comodo" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Comodo_pkey" PRIMARY KEY ("id")
);

-- CreateTable FotoComodo
CREATE TABLE "FotoComodo" (
    "id" TEXT NOT NULL,
    "comodoId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "ordem" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FotoComodo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TourVirtual_slug_key" ON "TourVirtual"("slug");

-- AddForeignKey
ALTER TABLE "TourVirtual" ADD CONSTRAINT "TourVirtual_imobiliariaId_fkey"
    FOREIGN KEY ("imobiliariaId") REFERENCES "Imobiliaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comodo" ADD CONSTRAINT "Comodo_tourId_fkey"
    FOREIGN KEY ("tourId") REFERENCES "TourVirtual"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotoComodo" ADD CONSTRAINT "FotoComodo_comodoId_fkey"
    FOREIGN KEY ("comodoId") REFERENCES "Comodo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
