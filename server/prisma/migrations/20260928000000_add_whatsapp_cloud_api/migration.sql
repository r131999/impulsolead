-- AlterTable
ALTER TABLE "ConfigAgente" ADD COLUMN "canalWhatsapp" TEXT NOT NULL DEFAULT 'baileys';
ALTER TABLE "ConfigAgente" ADD COLUMN "fraseOrigemAnuncio" TEXT;

-- CreateTable
CREATE TABLE "WhatsappCloudApiInstancia" (
    "id" TEXT NOT NULL,
    "imobiliariaId" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "businessAccountId" TEXT,
    "accessToken" TEXT NOT NULL,
    "numeroExibicao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappCloudApiInstancia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappCloudApiInstancia_imobiliariaId_key" ON "WhatsappCloudApiInstancia"("imobiliariaId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappCloudApiInstancia_phoneNumberId_key" ON "WhatsappCloudApiInstancia"("phoneNumberId");

-- AddForeignKey
ALTER TABLE "WhatsappCloudApiInstancia" ADD CONSTRAINT "WhatsappCloudApiInstancia_imobiliariaId_fkey" FOREIGN KEY ("imobiliariaId") REFERENCES "Imobiliaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
