-- CreateIndex
-- Medidor de consumo do agente de IA: conta leads distintos com mensagem no
-- ciclo, filtrando por imobiliária + período (dashboard do gestor e relatório
-- de faturamento do admin, que varre todas as imobiliárias).
CREATE INDEX "MensagemLead_imobiliariaId_criadoEm_idx" ON "MensagemLead"("imobiliariaId", "criadoEm");
