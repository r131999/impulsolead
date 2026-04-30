const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const PERIODOS_VALIDOS = [7, 30, 90];
const STATUS_ORDEM = ['novo', 'qualificado', 'atendimento', 'visita', 'proposta', 'fechado', 'perdido'];

async function getRelatorios(req, res) {
  const periodo = parseInt(req.query.periodo) || 30;

  if (!PERIODOS_VALIDOS.includes(periodo)) {
    return res.status(400).json({ error: `Período inválido. Use: ${PERIODOS_VALIDOS.join(', ')}` });
  }

  const imobiliariaId = req.imobiliariaId;
  const agora = new Date();
  const dataInicio = new Date(agora);
  dataInicio.setDate(dataInicio.getDate() - periodo);
  dataInicio.setHours(0, 0, 0, 0);

  const periodoAnteriorInicio = new Date(dataInicio);
  periodoAnteriorInicio.setDate(periodoAnteriorInicio.getDate() - periodo);

  const where = { imobiliariaId, criadoEm: { gte: dataInicio } };
  const whereAnterior = { imobiliariaId, criadoEm: { gte: periodoAnteriorInicio, lt: dataInicio } };

  // Busca todos os leads do período com dados necessários
  const [leads, leadsAnterior, corretores] = await prisma.$transaction([
    prisma.lead.findMany({
      where,
      select: {
        id: true, status: true, criadoEm: true, atualizadoEm: true,
        motivoPerda: true, regiao: true, faixaValor: true, urgencia: true,
        corretor: { select: { id: true, nome: true } },
      },
      orderBy: { criadoEm: 'asc' },
    }),
    prisma.lead.count({ where: whereAnterior }),
    prisma.corretor.findMany({
      where: { imobiliariaId, ativo: true },
      select: {
        id: true, nome: true, leadsRecebidos: true,
        _count: { select: { leads: true } },
      },
    }),
  ]);

  const total = leads.length;
  const totalAnterior = leadsAnterior;
  const variacaoTotal = totalAnterior === 0
    ? (total > 0 ? 100 : 0)
    : Math.round(((total - totalAnterior) / totalAnterior) * 100);

  // Leads por status (funil)
  const porStatus = STATUS_ORDEM.reduce((acc, s) => {
    acc[s] = leads.filter((l) => l.status === s).length;
    return acc;
  }, {});

  // Taxa de conversão
  const naoPercidos = leads.filter((l) => l.status !== 'perdido').length;
  const fechados = leads.filter((l) => l.status === 'fechado').length;
  const taxaConversao = naoPercidos === 0 ? 0 : Math.round((fechados / naoPercidos) * 100);

  // Motivos de perda
  const perdidos = leads.filter((l) => l.status === 'perdido' && l.motivoPerda);
  const motivosPerda = perdidos.reduce((acc, l) => {
    const motivo = l.motivoPerda || 'Não informado';
    acc[motivo] = (acc[motivo] || 0) + 1;
    return acc;
  }, {});

  // Leads por corretor
  const porCorretor = corretores.map((c) => {
    const leadsCorretor = leads.filter((l) => l.corretor?.id === c.id);
    const fechadosCorretor = leadsCorretor.filter((l) => l.status === 'fechado').length;
    return {
      id: c.id,
      nome: c.nome,
      totalLeads: leadsCorretor.length,
      fechados: fechadosCorretor,
      taxaConversao: leadsCorretor.length === 0
        ? 0
        : Math.round((fechadosCorretor / leadsCorretor.length) * 100),
    };
  }).sort((a, b) => b.totalLeads - a.totalLeads);

  // Leads por dia (série temporal)
  const leadsPorDia = {};
  leads.forEach((l) => {
    const dia = new Date(l.criadoEm).toISOString().split('T')[0];
    leadsPorDia[dia] = (leadsPorDia[dia] || 0) + 1;
  });

  // Preenche dias sem leads com 0
  const serie = [];
  for (let i = periodo - 1; i >= 0; i--) {
    const d = new Date(agora);
    d.setDate(d.getDate() - i);
    const chave = d.toISOString().split('T')[0];
    serie.push({ data: chave, leads: leadsPorDia[chave] || 0 });
  }

  // Top regiões
  const regioes = leads.reduce((acc, l) => {
    if (l.regiao) acc[l.regiao] = (acc[l.regiao] || 0) + 1;
    return acc;
  }, {});
  const topRegioes = Object.entries(regioes)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([regiao, total]) => ({ regiao, total }));

  // Tempo médio de resposta em minutos
  const leadsRespondidos = leads.filter((l) => l.status !== 'novo' && l.corretor);
  const tempoMedioResposta = leadsRespondidos.length === 0 ? 0 : Math.round(
    leadsRespondidos.reduce((acc, l) => {
      return acc + (new Date(l.atualizadoEm) - new Date(l.criadoEm)) / 60000;
    }, 0) / leadsRespondidos.length
  );

  res.json({
    periodo,
    dataInicio: dataInicio.toISOString(),
    resumo: {
      total,
      totalAnterior,
      variacaoTotal,
      fechados,
      taxaConversao,
      tempoMedioResposta,
    },
    funil: STATUS_ORDEM.map((s) => ({ status: s, total: porStatus[s] })),
    leadsPorDia: serie,
    porCorretor,
    motivosPerda: Object.entries(motivosPerda)
      .sort(([, a], [, b]) => b - a)
      .map(([motivo, total]) => ({ motivo, total })),
    topRegioes,
  });
}

module.exports = { getRelatorios };
