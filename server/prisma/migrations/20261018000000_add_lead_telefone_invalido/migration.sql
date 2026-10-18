-- Lead do Meta Lead Ads que chegou com telefone fora do padrão (10–15 dígitos):
-- criado com o número exatamente como veio e bloqueado para envios até correção manual.
ALTER TABLE "Lead" ADD COLUMN "telefoneInvalido" BOOLEAN NOT NULL DEFAULT false;
