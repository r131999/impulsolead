'use strict';

/**
 * Migra arquivos sem empreendimentoId para um empreendimento "Arquivos antigos"
 * por imobiliária. Mapeamento de tipo legado para categoria nova:
 *   foto  → foto
 *   video → video
 *   pdf   → book
 *
 * Idempotente: rodar duas vezes não duplica dados.
 * Rodar dentro do container: node src/scripts/migrarArquivosAntigos.js
 */

const prisma = require('../lib/prisma');

async function run() {
  console.log('[migrarArquivosAntigos] Iniciando...');

  const imobiliarias = await prisma.arquivoImovel.findMany({
    where: { empreendimentoId: null },
    select: { imobiliariaId: true },
    distinct: ['imobiliariaId'],
  });

  if (imobiliarias.length === 0) {
    console.log('[migrarArquivosAntigos] Nenhum arquivo órfão encontrado. Nada a fazer.');
    return;
  }

  console.log(`[migrarArquivosAntigos] ${imobiliarias.length} imobiliária(s) com arquivos órfãos.`);

  for (const { imobiliariaId } of imobiliarias) {
    let emp = await prisma.empreendimento.findFirst({
      where: { imobiliariaId, nome: 'Arquivos antigos' },
    });

    if (!emp) {
      const usuario = await prisma.usuario.findFirst({
        where: { imobiliariaId },
        select: { id: true },
      });

      emp = await prisma.empreendimento.create({
        data: {
          nome: 'Arquivos antigos',
          descricao: 'Arquivos cadastrados antes da organização por empreendimentos.',
          imobiliariaId,
          criadoPorId: usuario?.id || 'system',
        },
      });
      console.log(`  [${imobiliariaId}] Criado "Arquivos antigos" (id=${emp.id})`);
    } else {
      console.log(`  [${imobiliariaId}] "Arquivos antigos" já existe (id=${emp.id})`);
    }

    const mapa = { foto: 'foto', video: 'video', pdf: 'book' };
    for (const [tipo, categoria] of Object.entries(mapa)) {
      const r = await prisma.arquivoImovel.updateMany({
        where: { imobiliariaId, empreendimentoId: null, tipo },
        data: { empreendimentoId: emp.id, categoria },
      });
      if (r.count > 0) {
        console.log(`    tipo="${tipo}" → categoria="${categoria}": ${r.count} arquivo(s)`);
      }
    }

    // Captura qualquer tipo inesperado que não estava no mapa
    const resto = await prisma.arquivoImovel.updateMany({
      where: { imobiliariaId, empreendimentoId: null },
      data: { empreendimentoId: emp.id, categoria: 'book' },
    });
    if (resto.count > 0) {
      console.log(`    tipo desconhecido → categoria="book": ${resto.count} arquivo(s)`);
    }
  }

  console.log('[migrarArquivosAntigos] Concluído.');
}

run()
  .catch((e) => {
    console.error('[migrarArquivosAntigos] Erro:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
