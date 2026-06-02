-- AlterTable: registra o momento em que o lead entrou na etapa atual
ALTER TABLE "Lead" ADD COLUMN "etapaEntradaEm" TIMESTAMP(3);
