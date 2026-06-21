-- AlterTable: adiciona notificadoEm (nullable) ao model FollowUp
-- Marca quando o lembrete de follow-up foi disparado no WhatsApp do corretor.
ALTER TABLE "FollowUp" ADD COLUMN "notificadoEm" TIMESTAMP(3);
