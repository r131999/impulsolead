-- CreateTable
CREATE TABLE "ContatoPessoal" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "email" TEXT,
    "observacoes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ativo',
    "leadId" TEXT,
    "corretorId" TEXT NOT NULL,
    "imobiliariaId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContatoPessoal_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ContatoPessoal" ADD CONSTRAINT "ContatoPessoal_corretorId_fkey" FOREIGN KEY ("corretorId") REFERENCES "Corretor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContatoPessoal" ADD CONSTRAINT "ContatoPessoal_imobiliariaId_fkey" FOREIGN KEY ("imobiliariaId") REFERENCES "Imobiliaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
