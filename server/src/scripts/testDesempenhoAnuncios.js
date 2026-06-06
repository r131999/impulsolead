/**
 * Teste manual do endpoint de desempenho por anúncio.
 * Chama a lógica do controller diretamente, sem HTTP.
 * Rodar: node src/scripts/testDesempenhoAnuncios.js
 */
const prisma = require('../lib/prisma');

const IMOBILIARIA_ID = 'd9cafd24-8878-4f66-a42b-6c98de8dbc82';
const DIAS = 30;

const QUALIFICADOS_STATUS = ['agendamento', 'visita', 'venda'];
const VISITA_STATUS = ['visita', 'venda'];

async function main() {
  const dataFim = new Date();
  dataFim.setUTCHours(0, 0, 0, 0);
  const dataInicio = new Date(dataFim);
  dataInicio.setDate(dataInicio.getDate() - DIAS);
  const dataFimExclusivo = new Date(dataFim);
  dataFimExclusivo.setDate(dataFimExclusivo.getDate() + 1);

  console.log(`=== testDesempenhoAnuncios ===`);
  console.log(`Período: ${dataInicio.toISOString().slice(0,10)} → ${dataFim.toISOString().slice(0,10)}\n`);

  const [spendPorAd, adNames, leadsNoPeriodo] = await Promise.all([
    prisma.adSpend.groupBy({
      by: ['adId'],
      where: { imobiliariaId: IMOBILIARIA_ID, date: { gte: dataInicio, lte: dataFim } },
      _sum: { spend: true },
    }),
    prisma.adSpend.findMany({
      where: { imobiliariaId: IMOBILIARIA_ID, date: { gte: dataInicio, lte: dataFim }, adName: { not: null } },
      select: { adId: true, adName: true },
      distinct: ['adId'],
    }),
    prisma.lead.findMany({
      where: {
        imobiliariaId: IMOBILIARIA_ID,
        adId: { not: null },
        criadoEm: { gte: dataInicio, lt: dataFimExclusivo },
      },
      select: { adId: true, status: true, valorVenda: true, anuncioName: true },
    }),
  ]);

  console.log(`AdSpend: ${spendPorAd.length} anúncios com gasto no período`);
  console.log(`Leads com adId: ${leadsNoPeriodo.length}\n`);

  const adNameMap = new Map(adNames.map((r) => [r.adId, r.adName]));
  const spendMap = new Map(spendPorAd.map((r) => [r.adId, Number(r._sum.spend) || 0]));

  const leadsMap = new Map();
  for (const lead of leadsNoPeriodo) {
    if (!lead.adId) continue;
    if (!leadsMap.has(lead.adId)) {
      leadsMap.set(lead.adId, { leads: 0, qualificados: 0, visitas: 0, vendas: 0, valorVendido: 0, anuncioName: lead.anuncioName || null });
    }
    const e = leadsMap.get(lead.adId);
    e.leads++;
    if (QUALIFICADOS_STATUS.includes(lead.status)) e.qualificados++;
    if (VISITA_STATUS.includes(lead.status)) e.visitas++;
    if (lead.status === 'venda') { e.vendas++; e.valorVendido += Number(lead.valorVenda) || 0; }
  }

  const todosAdIds = new Set([...spendMap.keys(), ...leadsMap.keys()]);
  const anuncios = [];
  for (const adId of todosAdIds) {
    const ld = leadsMap.get(adId);
    anuncios.push({
      adId,
      adName: adNameMap.get(adId) || ld?.anuncioName || null,
      gasto: spendMap.get(adId) ?? 0,
      leads: ld?.leads ?? 0,
      qualificados: ld?.qualificados ?? 0,
      visitas: ld?.visitas ?? 0,
      vendas: ld?.vendas ?? 0,
      valorVendido: ld?.valorVendido ?? 0,
    });
  }
  anuncios.sort((a, b) => b.gasto - a.gasto);

  const totais = anuncios.reduce(
    (acc, a) => ({ gasto: acc.gasto + a.gasto, leads: acc.leads + a.leads, qualificados: acc.qualificados + a.qualificados, visitas: acc.visitas + a.visitas, vendas: acc.vendas + a.vendas, valorVendido: acc.valorVendido + a.valorVendido }),
    { gasto: 0, leads: 0, qualificados: 0, visitas: 0, vendas: 0, valorVendido: 0 }
  );

  console.log('=== TOTAIS ===');
  console.log(JSON.stringify(totais, null, 2));

  console.log('\n=== AMOSTRA (top 8 por gasto) ===');
  console.log(JSON.stringify(anuncios.slice(0, 8), null, 2));

  console.log(`\nTotal de anúncios únicos: ${anuncios.length}`);
  await prisma.$disconnect();
}

main().catch((err) => { console.error('Erro:', err); process.exit(1); });
