-- AlterTable: adiciona nome da página e cache das páginas pendentes de seleção
ALTER TABLE "MetaIntegracao" ADD COLUMN "pageName" TEXT;
ALTER TABLE "MetaIntegracao" ADD COLUMN "paginasPendentes" JSONB;
