-- CreateTable
CREATE TABLE "ArquivoImovel" (
    "id"            TEXT NOT NULL,
    "nome"          TEXT NOT NULL,
    "tipo"          TEXT NOT NULL,
    "filename"      TEXT NOT NULL,
    "mimetype"      TEXT NOT NULL,
    "tamanho"       INTEGER NOT NULL,
    "criadoPorId"   TEXT NOT NULL,
    "criadoEm"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm"  TIMESTAMP(3) NOT NULL,
    "imobiliariaId" TEXT NOT NULL,

    CONSTRAINT "ArquivoImovel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MensagemLead" (
    "id"              TEXT NOT NULL,
    "remetenteTipo"   TEXT NOT NULL,
    "remetenteNome"   TEXT NOT NULL,
    "remetenteId"     TEXT,
    "conteudo"        TEXT,
    "tipoMidia"       TEXT,
    "urlMidia"        TEXT,
    "whatsappMsgId"   TEXT,
    "lida"            BOOLEAN NOT NULL DEFAULT false,
    "criadoEm"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leadId"          TEXT NOT NULL,
    "arquivoImovelId" TEXT,
    "imobiliariaId"   TEXT NOT NULL,

    CONSTRAINT "MensagemLead_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ArquivoImovel" ADD CONSTRAINT "ArquivoImovel_imobiliariaId_fkey"
    FOREIGN KEY ("imobiliariaId") REFERENCES "Imobiliaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MensagemLead" ADD CONSTRAINT "MensagemLead_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MensagemLead" ADD CONSTRAINT "MensagemLead_arquivoImovelId_fkey"
    FOREIGN KEY ("arquivoImovelId") REFERENCES "ArquivoImovel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MensagemLead" ADD CONSTRAINT "MensagemLead_imobiliariaId_fkey"
    FOREIGN KEY ("imobiliariaId") REFERENCES "Imobiliaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex (deduplicação por whatsappMsgId quando preenchido)
CREATE INDEX "MensagemLead_leadId_criadoEm_idx" ON "MensagemLead"("leadId", "criadoEm");
CREATE INDEX "MensagemLead_whatsappMsgId_idx" ON "MensagemLead"("whatsappMsgId");
