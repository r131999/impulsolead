-- AlterTable Apresentacao (localização estruturada + coordenadas, aditivo)
ALTER TABLE "Apresentacao" ADD COLUMN "estado" TEXT;
ALTER TABLE "Apresentacao" ADD COLUMN "cidade" TEXT;
ALTER TABLE "Apresentacao" ADD COLUMN "bairro" TEXT;
ALTER TABLE "Apresentacao" ADD COLUMN "rua" TEXT;
ALTER TABLE "Apresentacao" ADD COLUMN "numero" TEXT;
ALTER TABLE "Apresentacao" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "Apresentacao" ADD COLUMN "longitude" DOUBLE PRECISION;
