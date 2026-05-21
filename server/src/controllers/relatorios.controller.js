const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const PERIODOS_VALIDOS = [7, 30, 90];
const STATUS_ORDEM = ['lead', 'atendimento', 'em_espera', 'agendamento', 'visita', 'proposta', 'venda', 'perdido'];

// Brasília = UTC-3. Midnight Brasília = 03:00 UTC.

function inicioDiaBrasilia(agora) {
  const d = new Date(agora);
  d.setUTCHours(3, 0, 0, 0);
  if (agora.getUTCHours() < 3) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return d;
}

// Converte um timestamp UTC para a string de data no calendário Brasília (YYYY-MM-DD)
function utcParaDataBrasilia(ts) {
  return new Date(new Date(ts).getTime() - 3 * 60 * 60 * 1000).toISOString().split('T')[0];
}

async function getRelatorios(req, res) {
  const periodo = parseInt(req.query.periodo) || 30;

  if (!PERIODOS_VALIDOS.includes(periodo)) {
    return res.status(400).json({ error: `Período inválido. Use: ${PERIODOS_VALIDOS.join(', ')}` });
  }

  const imobiliariaId = req.imobiliariaId;
  const agora = new Date();
  const dataInicio = new Date(inicioDiaBrasilia(agora).getTime() - periodo * 24 * 60 * 60 * 1000);
  const periodoAnteriorInicio = new Date(dataInicio.getTime() - periodo * 24 * 60 * 60 * 1000);

  const where = { imobiliariaId, criadoEm: { gte: dataInicio } };
  const whereAnterior = { imobiliariaId, criadoEm: { gte: periodoAnteriorInicio, lt: dataInicio } };

  // Busca todos os leads do período com dados necessários
  const [leads, leadsAnterior, corretores] = await prisma.$transaction([
    prisma.lead.findMany({
      where,
      select: {
        id: true, status: true, criadoEm: true, atualizadoEm: true,
        motivoPerda: true, regiao: true, faixaValor: true, urgencia: true, campanha: true,
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
  const naoPerdidos = leads.filter((l) => l.status !== 'perdido').length;
  const fechados = leads.filter((l) => l.status === 'venda').length;
  const taxaConversao = naoPerdidos === 0 ? 0 : Math.round((fechados / naoPerdidos) * 100);

  const leadsCampanha = leads.filter((l) => l.campanha).length;

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
    const fechadosCorretor = leadsCorretor.filter((l) => l.status === 'venda').length;
    const leadsCampanha = leadsCorretor.filter((l) => l.campanha).length;
    return {
      id: c.id,
      nome: c.nome,
      totalLeads: leadsCorretor.length,
      fechados: fechadosCorretor,
      taxaConversao: leadsCorretor.length === 0
        ? 0
        : Math.round((fechadosCorretor / leadsCorretor.length) * 100),
      leadsCampanha,
      percentualCampanha: leadsCorretor.length === 0
        ? 0
        : Math.round((leadsCampanha / leadsCorretor.length) * 100),
    };
  }).sort((a, b) => b.totalLeads - a.totalLeads);

  // Leads por dia (série temporal) — agrupado por data no calendário Brasília
  const leadsPorDia = {};
  leads.forEach((l) => {
    const dia = utcParaDataBrasilia(l.criadoEm);
    leadsPorDia[dia] = (leadsPorDia[dia] || 0) + 1;
  });

  // Preenche dias sem leads com 0, usando datas do calendário Brasília
  const serie = [];
  for (let i = periodo - 1; i >= 0; i--) {
    const chave = utcParaDataBrasilia(agora.getTime() - i * 24 * 60 * 60 * 1000);
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
  const leadsRespondidos = leads.filter((l) => l.status !== 'lead' && l.corretor);
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
      leadsCampanha,
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

async function getRelatoriosEquipes(req, res) {
  const periodo = parseInt(req.query.periodo) || 30;

  if (!PERIODOS_VALIDOS.includes(periodo)) {
    return res.status(400).json({ error: `Período inválido. Use: ${PERIODOS_VALIDOS.join(', ')}` });
  }

  const imobiliariaId = req.imobiliariaId;
  const agora = new Date();
  const dataInicio = new Date(inicioDiaBrasilia(agora).getTime() - periodo * 24 * 60 * 60 * 1000);

  const [equipes, leads] = await prisma.$transaction([
    prisma.equipe.findMany({
      where: { imobiliariaId, ativo: true },
      include: {
        lider: { select: { id: true, nome: true } },
        corretores: {
          where: { ativo: true },
          select: { id: true, nome: true },
        },
      },
      orderBy: { criadoEm: 'asc' },
    }),
    prisma.lead.findMany({
      where: { imobiliariaId, criadoEm: { gte: dataInicio } },
      select: { id: true, status: true, corretorId: true },
    }),
  ]);

  const leadsPorCorretor = {};
  leads.forEach((l) => {
    if (l.corretorId) {
      if (!leadsPorCorretor[l.corretorId]) leadsPorCorretor[l.corretorId] = [];
      leadsPorCorretor[l.corretorId].push(l);
    }
  });

  const result = equipes.map((equipe) => {
    const rankingCorretores = equipe.corretores.map((c) => {
      const cLeads = leadsPorCorretor[c.id] || [];
      return {
        id: c.id,
        nome: c.nome,
        leads: cLeads.length,
        fechamentos: cLeads.filter((l) => l.status === 'venda').length,
      };
    }).sort((a, b) => b.fechamentos - a.fechamentos || b.leads - a.leads);

    const totalLeads = rankingCorretores.reduce((s, c) => s + c.leads, 0);
    const fechamentos = rankingCorretores.reduce((s, c) => s + c.fechamentos, 0);
    const taxaConversao = totalLeads === 0 ? 0 : Math.round((fechamentos / totalLeads) * 100);

    return {
      id: equipe.id,
      nome: equipe.nome,
      lider: equipe.lider,
      totalLeads,
      fechamentos,
      taxaConversao,
      rankingCorretores,
    };
  }).sort((a, b) => b.totalLeads - a.totalLeads);

  const equipeMaisLeads = result.length > 0 ? result[0].nome : null;
  const equipeMaiorConversao = result.length > 0
    ? result.reduce((a, b) => (a.taxaConversao >= b.taxaConversao ? a : b)).nome
    : null;

  res.json({ periodo, equipes: result, equipeMaisLeads, equipeMaiorConversao });
}

async function getRelatoriosGerente(req, res) {
  const periodo = parseInt(req.query.periodo) || 30;

  if (!PERIODOS_VALIDOS.includes(periodo)) {
    return res.status(400).json({ error: `Período inválido. Use: ${PERIODOS_VALIDOS.join(', ')}` });
  }

  const { imobiliariaId, equipeId } = req;

  if (!equipeId) {
    return res.status(400).json({ error: 'Gerente não possui equipe vinculada' });
  }

  const agora = new Date();
  const dataInicio = new Date(inicioDiaBrasilia(agora).getTime() - periodo * 24 * 60 * 60 * 1000);
  const periodoAnteriorInicio = new Date(dataInicio.getTime() - periodo * 24 * 60 * 60 * 1000);

  const equipe = await prisma.equipe.findUnique({
    where: { id: equipeId },
    include: {
      corretores: {
        where: { ativo: true },
        select: { id: true, nome: true },
      },
    },
  });

  if (!equipe) return res.status(404).json({ error: 'Equipe não encontrada' });

  const corretorIds = equipe.corretores.map((c) => c.id);
  const where = { imobiliariaId, corretorId: { in: corretorIds }, criadoEm: { gte: dataInicio } };
  const whereAnterior = { imobiliariaId, corretorId: { in: corretorIds }, criadoEm: { gte: periodoAnteriorInicio, lt: dataInicio } };

  const [leads, totalAnterior] = await prisma.$transaction([
    prisma.lead.findMany({
      where,
      select: {
        id: true, status: true, criadoEm: true, atualizadoEm: true,
        motivoPerda: true, regiao: true, campanha: true,
        corretor: { select: { id: true, nome: true } },
      },
      orderBy: { criadoEm: 'asc' },
    }),
    prisma.lead.count({ where: whereAnterior }),
  ]);

  const total = leads.length;
  const variacaoTotal = totalAnterior === 0
    ? (total > 0 ? 100 : 0)
    : Math.round(((total - totalAnterior) / totalAnterior) * 100);

  const porStatus = STATUS_ORDEM.reduce((acc, s) => {
    acc[s] = leads.filter((l) => l.status === s).length;
    return acc;
  }, {});

  const naoPerdidos = leads.filter((l) => l.status !== 'perdido').length;
  const fechados = leads.filter((l) => l.status === 'venda').length;
  const taxaConversao = naoPerdidos === 0 ? 0 : Math.round((fechados / naoPerdidos) * 100);

  const perdidos = leads.filter((l) => l.status === 'perdido' && l.motivoPerda);
  const motivosPerda = perdidos.reduce((acc, l) => {
    const motivo = l.motivoPerda || 'Não informado';
    acc[motivo] = (acc[motivo] || 0) + 1;
    return acc;
  }, {});

  const porCorretor = equipe.corretores.map((c) => {
    const leadsC = leads.filter((l) => l.corretor?.id === c.id);
    const fechadosC = leadsC.filter((l) => l.status === 'venda').length;
    const leadsCampanha = leadsC.filter((l) => l.campanha).length;
    return {
      id: c.id,
      nome: c.nome,
      totalLeads: leadsC.length,
      fechados: fechadosC,
      taxaConversao: leadsC.length === 0 ? 0 : Math.round((fechadosC / leadsC.length) * 100),
      leadsCampanha,
      percentualCampanha: leadsC.length === 0 ? 0 : Math.round((leadsCampanha / leadsC.length) * 100),
    };
  }).sort((a, b) => b.totalLeads - a.totalLeads);

  // Leads por dia — agrupado por data no calendário Brasília
  const leadsPorDia = {};
  leads.forEach((l) => {
    const dia = utcParaDataBrasilia(l.criadoEm);
    leadsPorDia[dia] = (leadsPorDia[dia] || 0) + 1;
  });

  const serie = [];
  for (let i = periodo - 1; i >= 0; i--) {
    const chave = utcParaDataBrasilia(agora.getTime() - i * 24 * 60 * 60 * 1000);
    serie.push({ data: chave, leads: leadsPorDia[chave] || 0 });
  }

  const regioes = leads.reduce((acc, l) => {
    if (l.regiao) acc[l.regiao] = (acc[l.regiao] || 0) + 1;
    return acc;
  }, {});
  const topRegioes = Object.entries(regioes)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([regiao, total]) => ({ regiao, total }));

  res.json({
    periodo,
    nomeEquipe: equipe.nome,
    dataInicio: dataInicio.toISOString(),
    resumo: { total, totalAnterior, variacaoTotal, fechados, taxaConversao },
    funil: STATUS_ORDEM.map((s) => ({ status: s, total: porStatus[s] })),
    leadsPorDia: serie,
    porCorretor,
    motivosPerda: Object.entries(motivosPerda)
      .sort(([, a], [, b]) => b - a)
      .map(([motivo, total]) => ({ motivo, total })),
    topRegioes,
  });
}

async function getRelatoriosOrigem(req, res) {
  const periodo = parseInt(req.query.periodo) || 30;

  if (!PERIODOS_VALIDOS.includes(periodo)) {
    return res.status(400).json({ error: `Período inválido. Use: ${PERIODOS_VALIDOS.join(', ')}` });
  }

  const imobiliariaId = req.imobiliariaId;
  const agora = new Date();
  const dataInicio = new Date(inicioDiaBrasilia(agora).getTime() - periodo * 24 * 60 * 60 * 1000);

  const leads = await prisma.lead.findMany({
    where: { imobiliariaId, criadoEm: { gte: dataInicio } },
    select: { id: true, status: true, origem: true, campanha: true },
  });

  const grupos = {};
  leads.forEach((l) => {
    const key = (l.campanha || l.origem === 'Meta Ads') ? 'Meta Ads' : (l.origem || 'Não informado');
    if (!grupos[key]) grupos[key] = { total: 0, fechados: 0 };
    grupos[key].total++;
    if (l.status === 'venda') grupos[key].fechados++;
  });

  const origens = Object.entries(grupos)
    .map(([origem, { total, fechados }]) => ({
      origem,
      total,
      fechados,
      conversao: total === 0 ? 0 : Math.round((fechados / total) * 100),
    }))
    .sort((a, b) => b.total - a.total);

  const melhorOrigem = origens.length === 0
    ? null
    : origens.reduce((a, b) => (a.conversao >= b.conversao ? a : b)).origem;

  res.json({ origens, melhorOrigem, periodo });
}

module.exports = { getRelatorios, getRelatoriosEquipes, getRelatoriosGerente, getRelatoriosOrigem };
