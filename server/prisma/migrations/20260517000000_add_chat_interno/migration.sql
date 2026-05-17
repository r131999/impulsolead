-- CreateTable
CREATE TABLE "ChatConversa" (
    "id" TEXT NOT NULL,
    "participante1Id" TEXT NOT NULL,
    "participante1Tipo" TEXT NOT NULL,
    "participante2Id" TEXT NOT NULL,
    "participante2Tipo" TEXT NOT NULL,
    "imobiliariaId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatConversa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMensagem" (
    "id" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "remetenteId" TEXT NOT NULL,
    "remetenteTipo" TEXT NOT NULL,
    "remetenteNome" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "leadId" TEXT,
    "leadNome" TEXT,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMensagem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChatConversa_participante1Id_participante2Id_key" ON "ChatConversa"("participante1Id", "participante2Id");

-- AddForeignKey
ALTER TABLE "ChatMensagem" ADD CONSTRAINT "ChatMensagem_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "ChatConversa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
