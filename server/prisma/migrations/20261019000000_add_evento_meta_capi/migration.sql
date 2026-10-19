-- API de Conversões para CRM (Conversion Leads): etapa do kanban que conta como QualifiedLead
-- por imobiliária, e a tabela que serve de fila/idempotência/auditoria dos eventos enviados.
ALTER TABLE "MetaIntegracao" ADD COLUMN "metaEtapaQualificada" TEXT NOT NULL DEFAULT 'agendamento';
ALTER TABLE "MetaIntegracao" ADD COLUMN "metaTestEventCode" TEXT;

CREATE TABLE "EventoMetaCapi" (
    "id" TEXT NOT NULL,
    "imobiliariaId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "leadgenId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "etapa" TEXT NOT NULL,
    "eventTime" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "ultimoErro" TEXT,
    "respostaMeta" JSONB,
    "metaDatasetId" TEXT,
    "testEventCode" TEXT,
    "enviadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventoMetaCapi_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EventoMetaCapi_status_eventTime_idx" ON "EventoMetaCapi"("status", "eventTime");
CREATE INDEX "EventoMetaCapi_imobiliariaId_criadoEm_idx" ON "EventoMetaCapi"("imobiliariaId", "criadoEm");
CREATE UNIQUE INDEX "EventoMetaCapi_leadId_eventName_key" ON "EventoMetaCapi"("leadId", "eventName");
