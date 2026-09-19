#!/usr/bin/env node
'use strict';

// Ajusta agenteIA/chatLead pra `true` nas imobiliárias já existentes cujo plano
// passou a incluir essas permissões (trial, desenvolvimento, sucesso, legado) —
// mudar server/src/config/permissoes-planos.js só afeta cadastros novos e trocas
// de plano futuras; imobiliária já cadastrada tem um snapshot de `permissoes`
// gravado no banco desde o signup, que não se atualiza sozinho.
//
// Idempotente: só grava se algo realmente muda, preserva o resto de `permissoes`
// como está (não reseta pra o default do plano — evita apagar customização feita
// via admin em outras chaves). Não mexe em `construcao` nem `cancelado`.

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { PrismaClient } = require('@prisma/client');
const { PERMISSOES_POR_PLANO } = require('../src/config/permissoes-planos');

const prisma = new PrismaClient();

const PLANOS_ALVO = ['trial', 'desenvolvimento', 'sucesso', 'legado'];
const CHAVES = ['agenteIA', 'chatLead'];

async function main() {
  const imobiliarias = await prisma.imobiliaria.findMany({
    where: { plano: { in: PLANOS_ALVO } },
    select: { id: true, nome: true, plano: true, permissoes: true },
  });

  console.log(`Imobiliárias em planos alvo (${PLANOS_ALVO.join(', ')}): ${imobiliarias.length}`);

  let atualizadas = 0, jaCorretas = 0;

  for (const imob of imobiliarias) {
    const atual = (imob.permissoes && typeof imob.permissoes === 'object') ? imob.permissoes : {};
    const esperado = PERMISSOES_POR_PLANO[imob.plano]?.permissoes || {};

    const precisaAtualizar = CHAVES.some((chave) => esperado[chave] === true && atual[chave] !== true);

    if (!precisaAtualizar) {
      jaCorretas++;
      continue;
    }

    const novoPermissoes = { ...atual };
    for (const chave of CHAVES) {
      if (esperado[chave] === true) novoPermissoes[chave] = true;
    }

    await prisma.imobiliaria.update({
      where: { id: imob.id },
      data: { permissoes: novoPermissoes },
    });

    console.log(`[OK] ${imob.nome} (${imob.plano}) — agenteIA/chatLead liberados`);
    atualizadas++;
  }

  console.log(`\nAtualizadas: ${atualizadas} | Já corretas: ${jaCorretas}`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
