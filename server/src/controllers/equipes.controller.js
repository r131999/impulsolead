const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function listar(req, res) {
  const imobiliariaId = req.imobiliariaId;
  const agora = new Date();
  const mesInicio = new Date(agora.getFullYear(), agora.getMonth(), 1);

  const [equipes, leadsDoMes] = await prisma.$transaction([
    prisma.equipe.findMany({
      where: { imobiliariaId, ativo: true },
      include: {
        lider: { select: { id: true, nome: true } },
        corretores: {
          where: { ativo: true },
          select: { id: true, nome: true, leadsRecebidos: true },
        },
      },
      orderBy: { criadoEm: 'asc' },
    }),
    prisma.lead.findMany({
      where: { imobiliariaId, criadoEm: { gte: mesInicio } },
      select: { id: true, status: true, corretorId: true },
    }),
  ]);

  const leadsPorCorretor = {};
  leadsDoMes.forEach((l) => {
    if (l.corretorId) {
      if (!leadsPorCorretor[l.corretorId]) leadsPorCorretor[l.corretorId] = [];
      leadsPorCorretor[l.corretorId].push(l);
    }
  });

  const result = equipes.map((equipe) => {
    const corretoresComMetricas = equipe.corretores.map((c) => {
      const leads = leadsPorCorretor[c.id] || [];
      const fechamentos = leads.filter((l) => l.status === 'venda').length;
      return {
        id: c.id,
        nome: c.nome,
        leadsRecebidos: c.leadsRecebidos,
        leads: leads.length,
        emAtendimento: leads.filter((l) => l.status === 'atendimento').length,
        visitasAgendadas: leads.filter((l) => l.status === 'agendamento').length,
        fechamentos,
        taxaConversao: leads.length === 0 ? 0 : Math.round((fechamentos / leads.length) * 100),
      };
    });

    const todosLeads = equipe.corretores.flatMap((c) => leadsPorCorretor[c.id] || []);
    const totalLeads = todosLeads.length;
    const fechamentos = todosLeads.filter((l) => l.status === 'venda').length;
    const naoPercidos = todosLeads.filter((l) => l.status !== 'perdido').length;

    return {
      id: equipe.id,
      nome: equipe.nome,
      descricao: equipe.descricao,
      lider: equipe.lider,
      totalCorretores: equipe.corretores.length,
      corretores: corretoresComMetricas,
      metricas: {
        totalLeads,
        emAtendimento: todosLeads.filter((l) => l.status === 'atendimento').length,
        fechamentos,
        taxaConversao: naoPercidos === 0 ? 0 : Math.round((fechamentos / naoPercidos) * 100),
      },
    };
  });

  res.json({ equipes: result });
}

async function criar(req, res) {
  const { nome, liderId, descricao } = req.body;

  if (!nome) return res.status(400).json({ error: 'Campo obrigatório: nome' });

  if (liderId) {
    const lider = await prisma.corretor.findFirst({
      where: { id: liderId, imobiliariaId: req.imobiliariaId, ativo: true },
    });
    if (!lider) return res.status(400).json({ error: 'Líder não encontrado' });
  }

  const equipe = await prisma.equipe.create({
    data: {
      nome,
      descricao: descricao || null,
      liderId: liderId || null,
      imobiliariaId: req.imobiliariaId,
    },
    include: { lider: { select: { id: true, nome: true } } },
  });

  res.status(201).json({ equipe });
}

async function atualizar(req, res) {
  const { id } = req.params;
  const { nome, liderId, descricao } = req.body;

  const equipe = await prisma.equipe.findFirst({
    where: { id, imobiliariaId: req.imobiliariaId },
  });
  if (!equipe) return res.status(404).json({ error: 'Equipe não encontrada' });

  if (liderId) {
    const lider = await prisma.corretor.findFirst({
      where: { id: liderId, imobiliariaId: req.imobiliariaId, ativo: true },
    });
    if (!lider) return res.status(400).json({ error: 'Líder não encontrado' });
  }

  const atualizada = await prisma.equipe.update({
    where: { id },
    data: {
      ...(nome && { nome }),
      ...(descricao !== undefined && { descricao }),
      ...(liderId !== undefined && { liderId: liderId || null }),
    },
    include: { lider: { select: { id: true, nome: true } } },
  });

  res.json({ equipe: atualizada });
}

async function remover(req, res) {
  const { id } = req.params;

  const equipe = await prisma.equipe.findFirst({
    where: { id, imobiliariaId: req.imobiliariaId },
  });
  if (!equipe) return res.status(404).json({ error: 'Equipe não encontrada' });

  await prisma.$transaction([
    prisma.corretor.updateMany({ where: { equipeId: id }, data: { equipeId: null } }),
    prisma.equipe.update({ where: { id }, data: { ativo: false } }),
  ]);

  res.json({ message: 'Equipe removida' });
}

async function adicionarCorretor(req, res) {
  const { id } = req.params;
  const { corretorId } = req.body;

  if (!corretorId) return res.status(400).json({ error: 'Campo obrigatório: corretorId' });

  const equipe = await prisma.equipe.findFirst({
    where: { id, imobiliariaId: req.imobiliariaId, ativo: true },
  });
  if (!equipe) return res.status(404).json({ error: 'Equipe não encontrada' });

  const corretor = await prisma.corretor.findFirst({
    where: { id: corretorId, imobiliariaId: req.imobiliariaId, ativo: true },
  });
  if (!corretor) return res.status(404).json({ error: 'Corretor não encontrado' });

  await prisma.corretor.update({ where: { id: corretorId }, data: { equipeId: id } });

  res.json({ message: 'Corretor adicionado à equipe' });
}

async function removerCorretor(req, res) {
  const { id, corretorId } = req.params;

  const equipe = await prisma.equipe.findFirst({
    where: { id, imobiliariaId: req.imobiliariaId },
  });
  if (!equipe) return res.status(404).json({ error: 'Equipe não encontrada' });

  const corretor = await prisma.corretor.findFirst({
    where: { id: corretorId, imobiliariaId: req.imobiliariaId, equipeId: id },
  });
  if (!corretor) return res.status(404).json({ error: 'Corretor não encontrado na equipe' });

  await prisma.corretor.update({ where: { id: corretorId }, data: { equipeId: null } });

  res.json({ message: 'Corretor removido da equipe' });
}

module.exports = { listar, criar, atualizar, remover, adicionarCorretor, removerCorretor };
