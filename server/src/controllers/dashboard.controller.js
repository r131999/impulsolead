const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function inicioDia(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function fimDia(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

async function getDashboard(req, res) {
  const imobiliariaId = req.imobiliariaId;
  const agora = new Date();

  const hojeInicio = inicioDia(agora);
  const hojeToday = fimDia(agora);

  const ontem = new Date(agora);
  ontem.setDate(ontem.getDate() - 1);
  const ontemInicio = inicioDia(ontem);
  const ontemFim = fimDia(ontem);

  const mesInicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const mesPassadoInicio = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
  const mesPassadoFim = new Date(agora.getFullYear(), agora.getMonth(), 0, 23, 59, 59, 999);

  const [
    leadsHoje,
    leadsOntem,
    emAtendimento,
    visitasAgendadas,
    fechadosMes,
    fechadosMesPassado,
    totalLeadsMes,
    totalLeadsMesPassado,
    corretoresAtivos,
    leadsNaFila,
    ultimosLeads,
    leadsComHistorico,
  ] = await prisma.$transaction([
    prisma.lead.count({ where: { imobiliariaId, criadoEm: { gte: hojeInicio, lte: hojeToday } } }),
    prisma.lead.count({ where: { imobiliariaId, criadoEm: { gte: ontemInicio, lte: ontemFim } } }),
    prisma.lead.count({ where: { imobiliariaId, status: 'atendimento' } }),
    prisma.lead.count({ where: { imobiliariaId, status: 'agendamento' } }),
    prisma.lead.count({ where: { imobiliariaId, status: 'venda', criadoEm: { gte: mesInicio } } }),
    prisma.lead.count({ where: { imobiliariaId, status: 'venda', criadoEm: { gte: mesPassadoInicio, lte: mesPassadoFim } } }),
    prisma.lead.count({ where: { imobiliariaId, status: { not: 'perdido' }, criadoEm: { gte: mesInicio } } }),
    prisma.lead.count({ where: { imobiliariaId, status: { not: 'perdido' }, criadoEm: { gte: mesPassadoInicio, lte: mesPassadoFim } } }),
    prisma.corretor.count({ where: { imobiliariaId, ativo: true, disponivel: true } }),
    prisma.lead.count({ where: { imobiliariaId, status: 'lead', corretorId: null } }),
    prisma.lead.findMany({
      where: { imobiliariaId },
      orderBy: { criadoEm: 'desc' },
      take: 5,
      select: {
        id: true, nome: true, telefone: true, status: true,
        regiao: true, urgencia: true, criadoEm: true,
        corretor: { select: { id: true, nome: true } },
      },
    }),
    prisma.lead.findMany({
      where: {
        imobiliariaId,
        corretorId: { not: null },
        status: { not: 'lead' },
      },
      select: { criadoEm: true, atualizadoEm: true },
      take: 100,
    }),
  ]);

  // Variação leads hoje vs ontem
  const leadsHojeVariacao = leadsOntem === 0
    ? (leadsHoje > 0 ? 100 : 0)
    : Math.round(((leadsHoje - leadsOntem) / leadsOntem) * 100);

  // Taxa de conversão do mês atual
  const taxaConversao = totalLeadsMes === 0
    ? 0
    : Math.round((fechadosMes / totalLeadsMes) * 100);

  // Taxa de conversão do mês passado
  const taxaConversaoMesPassado = totalLeadsMesPassado === 0
    ? 0
    : Math.round((fechadosMesPassado / totalLeadsMesPassado) * 100);

  const taxaConversaoVariacao = taxaConversao - taxaConversaoMesPassado;

  // Tempo médio de resposta em minutos
  let tempoMedioResposta = 0;
  if (leadsComHistorico.length > 0) {
    const totalMinutos = leadsComHistorico.reduce((acc, lead) => {
      const diff = new Date(lead.atualizadoEm) - new Date(lead.criadoEm);
      return acc + diff / 60000;
    }, 0);
    tempoMedioResposta = Math.round(totalMinutos / leadsComHistorico.length);
  }

  res.json({
    leadsHoje,
    leadsHojeVariacao,
    emAtendimento,
    visitasAgendadas,
    fechadosMes,
    taxaConversao,
    taxaConversaoVariacao,
    tempoMedioResposta,
    corretoresAtivos,
    leadsNaFila,
    ultimosLeads,
  });
}

async function getDashboardCorretor(req, res) {
  const corretorId = req.corretorId;
  const imobiliariaId = req.imobiliariaId;
  const agora = new Date();
  const mesInicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const hojeInicio = inicioDia(agora);
  const hojeFim = fimDia(agora);

  const [
    leadsAtribuidos,
    leadsHoje,
    emAtendimento,
    visitasAgendadas,
    fechadosMes,
    totalAtivos,
    ultimosLeads,
    corretor,
  ] = await prisma.$transaction([
    prisma.lead.count({ where: { imobiliariaId, corretorId } }),
    prisma.lead.count({ where: { imobiliariaId, corretorId, criadoEm: { gte: hojeInicio, lte: hojeFim } } }),
    prisma.lead.count({ where: { imobiliariaId, corretorId, status: 'atendimento' } }),
    prisma.lead.count({ where: { imobiliariaId, corretorId, status: 'agendamento' } }),
    prisma.lead.count({ where: { imobiliariaId, corretorId, status: 'venda', criadoEm: { gte: mesInicio } } }),
    prisma.lead.count({ where: { imobiliariaId, corretorId, status: { not: 'perdido' } } }),
    prisma.lead.findMany({
      where: { imobiliariaId, corretorId },
      orderBy: { criadoEm: 'desc' },
      take: 5,
      select: { id: true, nome: true, telefone: true, status: true, regiao: true, urgencia: true, criadoEm: true },
    }),
    prisma.corretor.findUnique({
      where: { id: corretorId },
      select: { posicaoFila: true, equipe: { select: { id: true, nome: true } } },
    }),
  ]);

  const taxaConversaoPessoal = totalAtivos === 0 ? 0 : Math.round((fechadosMes / totalAtivos) * 100);

  const corretoresAFrente = await prisma.corretor.count({
    where: { imobiliariaId, ativo: true, disponivel: true, posicaoFila: { lt: corretor.posicaoFila } },
  });
  const posicaoNaFila = corretoresAFrente + 1;

  res.json({
    leadsAtribuidos,
    leadsHoje,
    emAtendimento,
    visitasAgendadas,
    fechadosMes,
    taxaConversaoPessoal,
    posicaoNaFila,
    ultimosLeads,
    equipe: corretor?.equipe || null,
  });
}

async function getDashboardGerente(req, res) {
  const equipeId = req.equipeId;
  const imobiliariaId = req.imobiliariaId;

  if (!equipeId) {
    return res.status(400).json({ error: 'Gerente não possui equipe vinculada' });
  }

  const agora = new Date();
  const mesInicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const hojeInicio = inicioDia(agora);
  const hojeFim = fimDia(agora);

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
  const whereEquipe = { imobiliariaId, corretorId: { in: corretorIds } };

  const [
    leadsHoje,
    emAtendimento,
    visitasAgendadas,
    fechadosMes,
    totalLeadsMes,
    ultimosLeads,
    leadsDoMes,
  ] = await prisma.$transaction([
    prisma.lead.count({ where: { ...whereEquipe, criadoEm: { gte: hojeInicio, lte: hojeFim } } }),
    prisma.lead.count({ where: { ...whereEquipe, status: 'atendimento' } }),
    prisma.lead.count({ where: { ...whereEquipe, status: 'agendamento' } }),
    prisma.lead.count({ where: { ...whereEquipe, status: 'venda', criadoEm: { gte: mesInicio } } }),
    prisma.lead.count({ where: { ...whereEquipe, status: { not: 'perdido' } } }),
    prisma.lead.findMany({
      where: whereEquipe,
      orderBy: { criadoEm: 'desc' },
      take: 5,
      select: {
        id: true, nome: true, telefone: true, status: true,
        regiao: true, urgencia: true, criadoEm: true,
        corretor: { select: { id: true, nome: true } },
      },
    }),
    prisma.lead.findMany({
      where: { ...whereEquipe, criadoEm: { gte: mesInicio } },
      select: { id: true, status: true, corretorId: true },
    }),
  ]);

  const taxaConversaoEquipe = totalLeadsMes === 0 ? 0 : Math.round((fechadosMes / totalLeadsMes) * 100);

  const rankingCorretores = equipe.corretores.map((c) => {
    const leadsC = leadsDoMes.filter((l) => l.corretorId === c.id);
    return {
      nome: c.nome,
      leads: leadsC.length,
      fechamentos: leadsC.filter((l) => l.status === 'venda').length,
    };
  }).sort((a, b) => b.fechamentos - a.fechamentos || b.leads - a.leads);

  res.json({
    nomeEquipe: equipe.nome,
    totalCorretores: equipe.corretores.length,
    leadsHoje,
    emAtendimento,
    visitasAgendadas,
    fechadosMes,
    taxaConversaoEquipe,
    rankingCorretores,
    ultimosLeads,
  });
}

async function getFunil(req, res) {
  const imobiliariaId = req.imobiliariaId;

  const contagens = await prisma.lead.groupBy({
    by: ['status'],
    where: { imobiliariaId },
    _count: { id: true },
  });

  const mapa = {};
  for (const c of contagens) mapa[c.status] = c._count.id;

  const etapas = ['lead', 'atendimento', 'agendamento', 'visita', 'proposta', 'venda'];
  const funil = etapas.map((s) => ({ status: s, total: mapa[s] || 0 }));

  res.json({ funil, perdidos: mapa['perdido'] || 0 });
}

module.exports = { getDashboard, getDashboardCorretor, getDashboardGerente, getFunil };
