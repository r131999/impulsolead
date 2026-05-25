-- CreateTable
CREATE TABLE "WhatsappInstancia" (
    "id" TEXT NOT NULL,
    "imobiliariaId" TEXT NOT NULL,
    "numero" TEXT,
    "status" TEXT NOT NULL DEFAULT 'desconectado',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappInstancia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappInstancia_imobiliariaId_key" ON "WhatsappInstancia"("imobiliariaId");

-- AddForeignKey
ALTER TABLE "WhatsappInstancia" ADD CONSTRAINT "WhatsappInstancia_imobiliariaId_fkey" FOREIGN KEY ("imobiliariaId") REFERENCES "Imobiliaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
