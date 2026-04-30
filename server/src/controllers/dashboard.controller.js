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
    prisma.lead.count({ where: { imobiliariaId, status: 'visita' } }),
    prisma.lead.count({ where: { imobiliariaId, status: 'fechado', criadoEm: { gte: mesInicio } } }),
    prisma.lead.count({ where: { imobiliariaId, status: 'fechado', criadoEm: { gte: mesPassadoInicio, lte: mesPassadoFim } } }),
    prisma.lead.count({ where: { imobiliariaId, status: { not: 'perdido' }, criadoEm: { gte: mesInicio } } }),
    prisma.lead.count({ where: { imobiliariaId, status: { not: 'perdido' }, criadoEm: { gte: mesPassadoInicio, lte: mesPassadoFim } } }),
    prisma.corretor.count({ where: { imobiliariaId, ativo: true, disponivel: true } }),
    prisma.lead.count({ where: { imobiliariaId, status: { in: ['novo', 'qualificado'] }, corretorId: null } }),
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
        status: { not: 'novo' },
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

module.exports = { getDashboard };
