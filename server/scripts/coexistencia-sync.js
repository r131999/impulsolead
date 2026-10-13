#!/usr/bin/env node
'use strict';

// Dispara manualmente a sincronização de contatos/histórico da Coexistência pra
// UMA imobiliária. Cada tipo só pode rodar 1x e em até 24h do onboarding — por
// isso é ação explícita, nunca automática. Sem --executar, só mostra o status.
//
// Uso:
//   node scripts/coexistencia-sync.js <imobiliariaId>                         # status (não dispara nada)
//   node scripts/coexistencia-sync.js <imobiliariaId> contatos --executar
//   node scripts/coexistencia-sync.js <imobiliariaId> historico --executar    # só depois de contatos

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const prisma = require('../src/lib/prisma');
const { verificarCamposWebhook, statusInstancia, dispararSync } = require('../src/services/whatsappCoexistencia.service');

async function main() {
  const [imobiliariaId, tipo] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const executar = process.argv.includes('--executar');

  if (!imobiliariaId) {
    console.error('Uso: node scripts/coexistencia-sync.js <imobiliariaId> [contatos|historico] [--executar]');
    process.exit(1);
  }

  const instancia = await prisma.whatsappCloudApiInstancia.findUnique({
    where: { imobiliariaId },
    include: { imobiliaria: { select: { nome: true } } },
  });
  if (!instancia) {
    console.error('Imobiliária sem instância Cloud API.');
    process.exit(1);
  }

  const st = statusInstancia(instancia);
  console.log(`Imobiliária: ${instancia.imobiliaria.nome} | phone=${instancia.phoneNumberId} | waba=${instancia.businessAccountId}`);
  console.log(`Onboarding: ${st.onboardingEm ? st.onboardingEm.toISOString() : '—'} | janela: ${st.janelaAberta ? `aberta (${st.restanteMin} min restantes)` : 'FECHADA'}`);
  console.log(`Contatos:  ${st.contatos  ? `disparado ${st.contatos.em.toISOString()} request_id=${st.contatos.requestId}`   : 'pendente'}`);
  console.log(`Histórico: ${st.historico ? `disparado ${st.historico.em.toISOString()} request_id=${st.historico.requestId}` : 'pendente'}`);

  const campos = await verificarCamposWebhook();
  console.log(`Webhook do app: ${campos.callbackUrl || '—'}`);
  console.log(`Campos assinados: ${campos.assinados.join(', ') || '—'}`);
  if (campos.faltando.length) console.warn(`FALTANDO pra Coexistência: ${campos.faltando.join(', ')}`);

  if (!tipo) return;
  if (!executar) {
    console.log(`\nSimulação. Pra disparar de verdade (1x só!): adicione --executar`);
    return;
  }

  const requestId = await dispararSync(imobiliariaId, tipo);
  console.log(`\n[OK] ${tipo} disparada — request_id=${requestId} (guarde pra suporte da Meta)`);
}

main()
  .catch((err) => { console.error(`[ERRO] ${err.message}`); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
