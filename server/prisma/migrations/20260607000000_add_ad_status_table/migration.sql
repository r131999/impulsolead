-- CreateTable
CREATE TABLE "AdStatus" (
    "id" TEXT NOT NULL,
    "imobiliariaId" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "effectiveStatus" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdStatus_imobiliariaId_adId_key" ON "AdStatus"("imobiliariaId", "adId");

-- AddForeignKey
ALTER TABLE "AdStatus" ADD CONSTRAINT "AdStatus_imobiliariaId_fkey" FOREIGN KEY ("imobiliariaId") REFERENCES "Imobiliaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
