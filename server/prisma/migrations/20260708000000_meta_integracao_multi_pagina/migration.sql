-- 1. pageId passa a ser opcional (precisa vir antes do UPDATE abaixo, senão a
--    coluna ainda NOT NULL rejeita a gravação de NULL)
ALTER TABLE "MetaIntegracao" ALTER COLUMN "pageId" DROP NOT NULL;

-- 2. Neutraliza qualquer placeholder com pageId vazio (fluxo OAuth órfão que
--    gravava pageId='' antes da seleção da página — permite múltiplos NULL
--    sob o UNIQUE do passo 5, ao contrário de múltiplas strings vazias)
UPDATE "MetaIntegracao" SET "pageId" = NULL WHERE "pageId" = '';

-- 3. Remove a unicidade antiga por imobiliariaId
DROP INDEX "MetaIntegracao_imobiliariaId_key";

-- 4. imobiliariaId deixa de ser único, vira índice de busca (agora 1:N)
CREATE INDEX "MetaIntegracao_imobiliariaId_idx" ON "MetaIntegracao"("imobiliariaId");

-- 5. pageId passa a ser único globalmente (impede a mesma página em 2 imobiliárias)
CREATE UNIQUE INDEX "MetaIntegracao_pageId_key" ON "MetaIntegracao"("pageId");

-- 6. Rastreio de origem do gasto: FK opcional de AdSpend/AdStatus -> MetaIntegracao
ALTER TABLE "AdSpend"  ADD COLUMN "metaIntegracaoId" TEXT;
ALTER TABLE "AdStatus" ADD COLUMN "metaIntegracaoId" TEXT;

ALTER TABLE "AdSpend" ADD CONSTRAINT "AdSpend_metaIntegracaoId_fkey"
    FOREIGN KEY ("metaIntegracaoId") REFERENCES "MetaIntegracao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdStatus" ADD CONSTRAINT "AdStatus_metaIntegracaoId_fkey"
    FOREIGN KEY ("metaIntegracaoId") REFERENCES "MetaIntegracao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "AdSpend_metaIntegracaoId_idx"  ON "AdSpend"("metaIntegracaoId");
CREATE INDEX "AdStatus_metaIntegracaoId_idx" ON "AdStatus"("metaIntegracaoId");

-- 7. Backfill: hoje cada imobiliariaId tem no máximo 1 MetaIntegracao, então a
--    associação é inequívoca — todo gasto/status histórico é atribuído à
--    página que existia na época.
UPDATE "AdSpend" a
SET "metaIntegracaoId" = m."id"
FROM "MetaIntegracao" m
WHERE m."imobiliariaId" = a."imobiliariaId" AND a."metaIntegracaoId" IS NULL;

UPDATE "AdStatus" a
SET "metaIntegracaoId" = m."id"
FROM "MetaIntegracao" m
WHERE m."imobiliariaId" = a."imobiliariaId" AND a."metaIntegracaoId" IS NULL;
