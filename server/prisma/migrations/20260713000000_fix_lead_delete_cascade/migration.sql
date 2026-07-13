-- DropForeignKey
ALTER TABLE "HistoricoLead" DROP CONSTRAINT "HistoricoLead_leadId_fkey";

-- AddForeignKey
ALTER TABLE "HistoricoLead" ADD CONSTRAINT "HistoricoLead_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropForeignKey
ALTER TABLE "HistoricoEtapaLead" DROP CONSTRAINT "HistoricoEtapaLead_leadId_fkey";

-- AddForeignKey
ALTER TABLE "HistoricoEtapaLead" ADD CONSTRAINT "HistoricoEtapaLead_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropForeignKey
ALTER TABLE "FollowUp" DROP CONSTRAINT "FollowUp_leadId_fkey";

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropForeignKey
ALTER TABLE "MensagemLead" DROP CONSTRAINT "MensagemLead_leadId_fkey";

-- AddForeignKey
ALTER TABLE "MensagemLead" ADD CONSTRAINT "MensagemLead_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
