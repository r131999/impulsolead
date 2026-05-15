-- CreateTable
CREATE TABLE "SessaoAgente" (
    "id"            TEXT NOT NULL,
    "telefone"      TEXT NOT NULL,
    "nome"          TEXT,
    "etapaAtual"    INTEGER NOT NULL DEFAULT 0,
    "respostas"     JSONB NOT NULL DEFAULT '{}',
    "status"        TEXT NOT NULL DEFAULT 'em_andamento',
    "instancia"     TEXT NOT NULL,
    "imobiliariaId" TEXT NOT NULL,
    "criadoEm"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessaoAgente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SessaoAgente_telefone_imobiliariaId_key" ON "SessaoAgente"("telefone", "imobiliariaId");

-- AddForeignKey
ALTER TABLE "SessaoAgente" ADD CONSTRAINT "SessaoAgente_imobiliariaId_fkey"
    FOREIGN KEY ("imobiliariaId") REFERENCES "Imobiliaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
