/**
 * Marca como possível duplicata os 9 leads criados em 18/10/2026 pela reentrega da Meta de
 * leads de 11/08/2026 (originais criados antes da captura do leadgenId, por isso sem conflito
 * na constraint única). Só marcação de tela: não apaga, não redistribui, não notifica ninguém.
 * Rodar dentro do container, depois da migração 20261018100000_add_lead_possivel_duplicata:
 *
 *   node src/scripts/marcarDuplicatasReentregaMeta.js            # simulação: só lista os pares
 *   node src/scripts/marcarDuplicatasReentregaMeta.js --aplicar  # grava a marcação e o histórico
 *
 * Para cada lead de 18/10 (imobiliária, campanha e formId abaixo, ainda sem marcação), procura o
 * lead de 11/08 com mesmo telefone + formId na mesma imobiliária e grava possivelDuplicataDeId +
 * uma entrada no HistoricoLead. Pode ser rodado de novo: leads já marcados são ignorados.
 * Se o total encontrado não for 9, ou algum lead ficar sem original, não grava nada.
 */
const prisma = require('../lib/prisma');

const IMOBILIARIA_ID = 'd9cafd24-8878-4f66-a42b-6c98de8dbc82';
const FORM_ID = '4515122145439983';
const CAMPANHA = 'VENDAS/CONNECT/10-08';
const TOTAL_ESPERADO = 9;

// Dias inteiros no horário de Brasília (UTC-3)
const DIA_DUPLICATAS = { gte: new Date('2026-10-18T03:00:00Z'), lt: new Date('2026-10-19T03:00:00Z') };
const DIA_ORIGINAIS = { gte: new Date('2026-08-11T03:00:00Z'), lt: new Date('2026-08-12T03:00:00Z') };

const APLICAR = process.argv.includes('--aplicar');

const fmt = (d) => d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

async function run() {
  const duplicatas = await prisma.lead.findMany({
    where: {
      imobiliariaId: IMOBILIARIA_ID,
      formId: FORM_ID,
      campanha: CAMPANHA,
      criadoEm: DIA_DUPLICATAS,
      possivelDuplicataDeId: null,
    },
    orderBy: { criadoEm: 'asc' },
    select: { id: true, nome: true, telefone: true, leadgenId: true, criadoEm: true, atualizadoEm: true },
  });

  console.log(`\n${duplicatas.length} lead(s) de 18/10 ainda sem marcação (esperado: ${TOTAL_ESPERADO})\n`);
  if (duplicatas.length === 0) return;

  const pares = [];
  const semOriginal = [];
  for (const dup of duplicatas) {
    const originais = await prisma.lead.findMany({
      where: {
        imobiliariaId: IMOBILIARIA_ID,
        formId: FORM_ID,
        telefone: dup.telefone,
        criadoEm: DIA_ORIGINAIS,
        id: { not: dup.id },
      },
      orderBy: { criadoEm: 'asc' },
      select: { id: true, nome: true, criadoEm: true, leadgenId: true },
    });

    if (originais.length === 0) {
      semOriginal.push(dup);
      console.log(`  ✗ ${dup.nome} (${dup.telefone}) — ${dup.id}: nenhum original de 11/08 encontrado`);
      continue;
    }
    const original = originais[0];
    pares.push({ dup, original });
    console.log(`  ✓ ${dup.nome} (${dup.telefone})`);
    console.log(`      duplicata: ${dup.id} — criado ${fmt(dup.criadoEm)} — leadgenId ${dup.leadgenId}`);
    console.log(`      original:  ${original.id} — criado ${fmt(original.criadoEm)} — leadgenId ${original.leadgenId ?? 'nulo'}`
      + (originais.length > 1 ? ` (${originais.length} originais no dia; usando o mais antigo)` : ''));
  }

  if (duplicatas.length !== TOTAL_ESPERADO || semOriginal.length > 0) {
    console.error(`\nABORTADO: esperado ${TOTAL_ESPERADO} leads, todos com original; `
      + `encontrados ${duplicatas.length}, ${semOriginal.length} sem original. Nada foi gravado.`);
    process.exitCode = 1;
    return;
  }

  if (!APLICAR) {
    console.log('\nSimulação: nada foi gravado. Rode com --aplicar para marcar.');
    return;
  }

  // Só escrita no banco — nenhuma chamada de notificação, push, WhatsApp ou redistribuição.
  // atualizadoEm é preservado explicitamente: ele entra no tempo de resposta (dashboard/relatórios)
  // e no aviso de lead parado do cron, e a marcação não é uma tratativa do lead.
  await prisma.$transaction(async (tx) => {
    for (const { dup, original } of pares) {
      await tx.lead.update({
        where: { id: dup.id },
        data: { possivelDuplicataDeId: original.id, atualizadoEm: dup.atualizadoEm },
      });
      await tx.historicoLead.create({
        data: {
          leadId: dup.id,
          acao: 'Possível duplicata — mesmo telefone e mesmo formulário de um lead anterior',
          detalhes: `Lead anterior: ${original.nome} (id ${original.id}), criado em ${fmt(original.criadoEm)}. `
            + 'Marcado retroativamente: reentrega pela Meta, em 18/10/2026, de um lead de 11/08/2026.',
        },
      });
    }
  });

  console.log(`\n${pares.length} lead(s) marcados como possível duplicata.`);
}

run()
  .catch((err) => {
    console.error('Erro:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
