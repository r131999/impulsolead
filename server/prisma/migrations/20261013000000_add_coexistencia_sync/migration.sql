-- AlterTable
ALTER TABLE "WhatsappCloudApiInstancia" ADD COLUMN "coexistenciaOnboardingEm" TIMESTAMP(3);
ALTER TABLE "WhatsappCloudApiInstancia" ADD COLUMN "syncContatosRequestId" TEXT;
ALTER TABLE "WhatsappCloudApiInstancia" ADD COLUMN "syncContatosEm" TIMESTAMP(3);
ALTER TABLE "WhatsappCloudApiInstancia" ADD COLUMN "syncHistoricoRequestId" TEXT;
ALTER TABLE "WhatsappCloudApiInstancia" ADD COLUMN "syncHistoricoEm" TIMESTAMP(3);
