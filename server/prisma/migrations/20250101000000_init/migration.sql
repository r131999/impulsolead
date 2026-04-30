-- CreateTable
CREATE TABLE "Imobiliaria" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT,
    "logoUrl" TEXT,
    "plano" TEXT NOT NULL DEFAULT 'trial',
    "trialExpiraEm" TIMESTAMP(3),
    "apiKey" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Imobiliaria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'gestor',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "imobiliariaId" TEXT NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Corretor" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT,
    "telefone" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "disponivel" BOOLEAN NOT NULL DEFAULT true,
    "posicaoFila" INTEGER NOT NULL DEFAULT 0,
    "leadsRecebidos" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "imobiliariaId" TEXT NOT NULL,

    CONSTRAINT "Corretor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "whatsappJid" TEXT NOT NULL,
    "primeiroImovel" TEXT,
    "tipoRenda" TEXT,
    "rendaMensal" TEXT,
    "restricaoCpf" TEXT,
    "valorEntrada" TEXT,
    "urgencia" TEXT,
    "regiao" TEXT,
    "faixaValor" TEXT,
    "status" TEXT NOT NULL DEFAULT 'novo',
    "motivoPerda" TEXT,
    "observacoes" TEXT,
    "corretorId" TEXT,
    "imobiliariaId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoricoLead" (
    "id" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "detalhes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leadId" TEXT NOT NULL,

    CONSTRAINT "HistoricoLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfigAgente" (
    "id" TEXT NOT NULL,
    "mensagemBoasVindas" TEXT NOT NULL DEFAULT 'Olá! Tudo bem? Aqui é a Lia, assistente virtual. Que bom que você entrou em contato! Como posso te chamar?',
    "perguntas" JSONB NOT NULL,
    "nomeAgente" TEXT NOT NULL DEFAULT 'Lia',
    "tomAgente" TEXT NOT NULL DEFAULT 'profissional mas leve',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "imobiliariaId" TEXT NOT NULL,

    CONSTRAINT "ConfigAgente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Imobiliaria_email_key" ON "Imobiliaria"("email");
CREATE UNIQUE INDEX "Imobiliaria_apiKey_key" ON "Imobiliaria"("apiKey");
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");
CREATE UNIQUE INDEX "ConfigAgente_imobiliariaId_key" ON "ConfigAgente"("imobiliariaId");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_imobiliariaId_fkey"
    FOREIGN KEY ("imobiliariaId") REFERENCES "Imobiliaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Corretor" ADD CONSTRAINT "Corretor_imobiliariaId_fkey"
    FOREIGN KEY ("imobiliariaId") REFERENCES "Imobiliaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Lead" ADD CONSTRAINT "Lead_corretorId_fkey"
    FOREIGN KEY ("corretorId") REFERENCES "Corretor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Lead" ADD CONSTRAINT "Lead_imobiliariaId_fkey"
    FOREIGN KEY ("imobiliariaId") REFERENCES "Imobiliaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "HistoricoLead" ADD CONSTRAINT "HistoricoLead_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ConfigAgente" ADD CONSTRAINT "ConfigAgente_imobiliariaId_fkey"
    FOREIGN KEY ("imobiliariaId") REFERENCES "Imobiliaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
