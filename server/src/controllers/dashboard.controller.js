
const prisma = require('../lib/prisma');

// Brasília = UTC-3. Midnight Brasília = 03:00 UTC.
// All day/month boundaries are calculated in UTC to avoid server timezone dependency.

function inicioDiaBrasilia(agora) {
  const d = new Date(agora);
  d.setUTCHours(3, 0, 0, 0);
  if (agora.getUTCHours() < 3) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return d;
}

function fimDiaBrasilia(agora) {
  const inicio = inicioDiaBrasilia(agora);
  return new Date(inicio.getTime() + 24 * 60 * 60 * 1000 - 1);
}

function mesInicioBrasilia(agora) {
  // Shift to Brasília calendar date, then get first of month at 03:00 UTC (= midnight Brasília)
  const br = new Date(agora.getTime() - 3 * 60 * 60 * 1000);
  return new Date(Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), 1, 3, 0, 0, 0));
}

function mesAnteriorInicioBrasilia(agora) {
  const br = new Date(agora.getTime() - 3 * 60 * 60 * 1000);
  return new Date(Date.UTC(br.getUTCFullYear(), br.getUTCMonth() - 1, 1, 3, 0, 0, 0));
}

async function getDashboard(req, res) {
  try {
    const imobiliariaId = req.imobiliariaId;
    console.log('[dashboard] imobiliariaId:', imobiliariaId);
    const agora = new Date();

    const hojeInicio = inicioDiaBrasilia(agora);
    const hojeToday = fimDiaBrasilia(agora);

    const ontemAgora = new Date(agora.getTime() - 24 * 60 * 60 * 1000);
    const ontemInicio = inicioDiaBrasilia(ontemAgora);
    const ontemFim = fimDiaBrasilia(ontemAgora);

    const mesInicio = mesInicioBrasilia(agora);
    const mesPassadoInicio = mesAnteriorInicioBrasilia(agora);
    const mesPassadoFim = new Date(mesInicio.getTime() - 1);

    const [
      leadsHoje,
      leadsOntem,
      emAtendimento,
      agendamentos,
      visitas,
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
      prisma.lead.count({ where: { imobiliariaId, status: 'visita' } }),
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
      agendamentos,
      visitas,
      fechadosMes,
      taxaConversao,
      taxaConversaoVariacao,
      tempoMedioResposta,
      corretoresAtivos,
      leadsNaFila,
      ultimosLeads,
    });
  } catch (err) {
    console.error('[dashboard] getDashboard:', err.message);
    res.status(500).json({ error: 'Erro ao buscar dados do dashboard' });
  }
}

async function getDashboardCorretor(req, res) {
  try {
    const corretorId = req.corretorId;
    const imobiliariaId = req.imobiliariaId;
    const agora = new Date();
    const mesInicio = mesInicioBrasilia(agora);
    const hojeInicio = inicioDiaBrasilia(agora);
    const hojeFim = fimDiaBrasilia(agora);

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

    if (!corretor) return res.status(404).json({ error: 'Corretor não encontrado' });

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
  } catch (err) {
    console.error('[dashboard] getDashboardCorretor:', err.message);
    res.status(500).json({ error: 'Erro ao buscar dashboard do corretor' });
  }
}

async function getDashboardGerente(req, res) {
  try {
    const equipeId = req.equipeId;
    const imobiliariaId = req.imobiliariaId;

    if (!equipeId) {
      return res.status(400).json({ error: 'Gerente não possui equipe vinculada' });
    }

    const agora = new Date();
    const mesInicio = mesInicioBrasilia(agora);
    const hojeInicio = inicioDiaBrasilia(agora);
    const hojeFim = fimDiaBrasilia(agora);

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
  } catch (err) {
    console.error('[dashboard] getDashboardGerente:', err.message);
    res.status(500).json({ error: 'Erro ao buscar dashboard do gerente' });
  }
}

async function getFunil(req, res) {
  try {
    const imobiliariaId = req.imobiliariaId;

    const contagens = await prisma.lead.groupBy({
      by: ['status'],
      where: { imobiliariaId },
      _count: { id: true },
    });

    const mapa = {};
    for (const c of contagens) mapa[c.status] = c._count.id;

    const etapas = ['lead', 'atendimento', 'em_espera', 'agendamento', 'visita', 'proposta', 'venda'];
    const funil = etapas.map((s) => ({ status: s, total: mapa[s] || 0 }));

    res.json({ funil, perdidos: mapa['perdido'] || 0 });
  } catch (err) {
    console.error('[dashboard] getFunil:', err.message);
    res.status(500).json({ error: 'Erro ao buscar funil' });
  }
}

module.exports = { getDashboard, getDashboardCorretor, getDashboardGerente, getFunil };
