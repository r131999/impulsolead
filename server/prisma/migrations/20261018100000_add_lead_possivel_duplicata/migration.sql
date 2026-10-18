-- Lead do Meta Lead Ads com mesmo telefone + formId de um lead já existente na imobiliária:
-- criado normalmente, mas apontando pro lead anterior como possível duplicata.
ALTER TABLE "Lead" ADD COLUMN "possivelDuplicataDeId" TEXT;
