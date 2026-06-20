-- AlterTable: alerta de leads sem tratativa passa a ser opt-in (default false).
-- Linhas existentes já estão false; não precisa de UPDATE retroativo.
ALTER TABLE "Imobiliaria" ALTER COLUMN "avisoLeadAtivo" SET DEFAULT false;
