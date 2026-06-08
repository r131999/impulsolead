const prisma = require('../lib/prisma');

const QUALIFICADOS_STATUS = ['agendamento', 'visita', 'venda'];
const VISITA_STATUS = ['visita', 'venda'];

function parseDateParam(str) {
  if (!str || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const d = new Date(str + 'T00:00:00.000Z');
  return isNaN(d.getTime()) ? null : d;
}

async function getDesempenhoAnuncios(req, res) {
  const imobiliariaId = req.imobiliariaId;

  let dataInicio, dataFim;

  if (req.query.desde || req.query.ate) {
    dataInicio = parseDateParam(req.query.desde);
    dataFim = parseDateParam(req.query.ate);
    if (!dataInicio || !dataFim) {
      return res.status(400).json({ error: 'Datas inválidas. Use o formato YYYY-MM-DD para "desde" e "ate".' });
    }
    if (dataFim < dataInicio) {
      return res.status(400).json({ error: 'A data "ate" deve ser maior ou igual a "desde".' });
    }
  } else {
    const dias = Math.min(Math.max(parseInt(req.query.dias) || 30, 1), 365);
    dataFim = new Date();
    dataFim.setUTCHours(0, 0, 0, 0);
    dataInicio = new Date(dataFim);
    dataInicio.setDate(dataInicio.getDate() - dias);
  }

  // Lead.criadoEm upper bound: start of the day AFTER dataFim
  const dataFimExclusivo = new Date(dataFim);
  dataFimExclusivo.setDate(dataFimExclusivo.getDate() + 1);

  const [spendPorAd, adNames, leadsNoPeriodo, adStatuses] = await Promise.all([
    prisma.adSpend.groupBy({
      by: ['adId'],
      where: { imobiliariaId, date: { gte: dataInicio, lte: dataFim } },
      _sum: { spend: true },
    }),
    prisma.adSpend.findMany({
      where: { imobiliariaId, date: { gte: dataInicio, lte: dataFim }, adName: { not: null } },
      select: { adId: true, adName: true },
      distinct: ['adId'],
    }),
    prisma.lead.findMany({
      where: {
        imobiliariaId,
        adId: { not: null },
        criadoEm: { gte: dataInicio, lt: dataFimExclusivo },
      },
      select: { adId: true, status: true, valorVenda: true, anuncioName: true },
    }),
    prisma.adStatus.findMany({
      where: { imobiliariaId },
      select: { adId: true, effectiveStatus: true },
    }),
  ]);

  // adId → effectiveStatus map
  const statusMap = new Map(adStatuses.map((s) => [s.adId, s.effectiveStatus]));

  // adId → adName map (from AdSpend)
  const adNameMap = new Map(adNames.map((r) => [r.adId, r.adName]));

  // adId → gasto map
  const spendMap = new Map(
    spendPorAd.map((r) => [r.adId, Number(r._sum.spend) || 0])
  );

  // adId → aggregated lead data
  const leadsMap = new Map();
  for (const lead of leadsNoPeriodo) {
    if (!lead.adId) continue;
    if (!leadsMap.has(lead.adId)) {
      leadsMap.set(lead.adId, {
        leads: 0, qualificados: 0, visitas: 0, vendas: 0,
        valorVendido: 0, anuncioName: lead.anuncioName || null,
      });
    }
    const e = leadsMap.get(lead.adId);
    e.leads++;
    if (QUALIFICADOS_STATUS.includes(lead.status)) e.qualificados++;
    if (VISITA_STATUS.includes(lead.status)) e.visitas++;
    if (lead.status === 'venda') {
      e.vendas++;
      e.valorVendido += Number(lead.valorVenda) || 0;
    }
  }

  // Union of all adIds from both sources
  const todosAdIds = new Set([...spendMap.keys(), ...leadsMap.keys()]);

  const anuncios = [];
  for (const adId of todosAdIds) {
    const leadsData = leadsMap.get(adId);
    anuncios.push({
      adId,
      adName: adNameMap.get(adId) || leadsData?.anuncioName || null,
      gasto: spendMap.get(adId) ?? 0,
      leads: leadsData?.leads ?? 0,
      qualificados: leadsData?.qualificados ?? 0,
      visitas: leadsData?.visitas ?? 0,
      vendas: leadsData?.vendas ?? 0,
      valorVendido: leadsData?.valorVendido ?? 0,
      ativo: statusMap.get(adId) === 'ACTIVE',
    });
  }

  anuncios.sort((a, b) => b.gasto - a.gasto);

  const totais = anuncios.reduce(
    (acc, a) => ({
      gasto: acc.gasto + a.gasto,
      leads: acc.leads + a.leads,
      qualificados: acc.qualificados + a.qualificados,
      visitas: acc.visitas + a.visitas,
      vendas: acc.vendas + a.vendas,
      valorVendido: acc.valorVendido + a.valorVendido,
    }),
    { gasto: 0, leads: 0, qualificados: 0, visitas: 0, vendas: 0, valorVendido: 0 }
  );

  res.json({
    anuncios,
    totais,
    periodo: {
      desde: dataInicio.toISOString().slice(0, 10),
      ate: dataFim.toISOString().slice(0, 10),
    },
  });
}

module.exports = { getDesempenhoAnuncios };
