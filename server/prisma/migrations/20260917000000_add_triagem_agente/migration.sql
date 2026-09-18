-- AlterTable
ALTER TABLE "ConfigAgente" ADD COLUMN "atenderNumeroDesconhecido" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SessaoAgente" ADD COLUMN "tipo" TEXT NOT NULL DEFAULT 'qualificacao';

-- Amplia a chave única para telefone+imobiliariaId+tipo, permitindo que uma
-- sessão de triagem (número ainda não é lead) e uma sessão de qualificação
-- (fluxo antigo, etapa por etapa) coexistam para o mesmo telefone sem colidir.
DROP INDEX "SessaoAgente_telefone_imobiliariaId_key";
CREATE UNIQUE INDEX "SessaoAgente_telefone_imobiliariaId_tipo_key" ON "SessaoAgente"("telefone", "imobiliariaId", "tipo");
