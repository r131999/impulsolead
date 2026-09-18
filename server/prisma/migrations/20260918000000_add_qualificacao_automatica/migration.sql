-- AlterTable
ALTER TABLE "ConfigAgente" ADD COLUMN "qualificacaoAutomatica" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "emQualificacaoAutomatica" BOOLEAN NOT NULL DEFAULT false;
