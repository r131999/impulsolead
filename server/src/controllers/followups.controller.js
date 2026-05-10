const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const INCLUDE_FOLLOWUP = {
  lead: { select: { id: true, nome: true, telefone: true, status: true } },
  corretor: { select: { id: true, nome: true } },
};

async function criar(req, res) {
  const { id: leadId } = req.params;
  const { dataHora, observacao } = req.body;

  if (!dataHora) return res.status(400).json({ error: 'dataHora é obrigatória' });

  const lead = await prisma.lead.findFirst({ where: { id: leadId, imobiliariaId: req.imobiliariaId } });
  if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

  let corretorId;
  if (req.role === 'corretor' || req.role === 'gerente') {
    corretorId = req.corretorId;
  } else {
    corretorId = req.body.corretorId || lead.corretorId;
    if (!corretorId) {
      return res.status(400).json({ error: 'corretorId é obrigatório pois o lead não tem corretor atribuído' });
    }
  }

  const followUp = await prisma.followUp.create({
    data: {
      leadId,
      corretorId,
      dataHora: new Date(dataHora),
      observacao: observacao?.trim() || null,
      status: 'pendente',
    },
    include: INCLUDE_FOLLOWUP,
  });

  res.status(201).json({ followUp });
}

async function atualizar(req, res) {
  const { id } = req.params;
  const { status, dataHora, observacao } = req.body;

  const followUp = await prisma.followUp.findFirst({
    where: { id },
    include: { lead: { select: { imobiliariaId: true } } },
  });
  if (!followUp) return res.status(404).json({ error: 'Follow-up não encontrado' });
  if (followUp.lead.imobiliariaId !== req.imobiliariaId) {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  if ((req.role === 'corretor' || req.role === 'gerente') && followUp.corretorId !== req.corretorId) {
    return res.status(403).json({ error: 'Sem permissão para editar este follow-up' });
  }

  const data = {};
  if (status && ['pendente', 'realizado'].includes(status)) data.status = status;
  if (dataHora) data.dataHora = new Date(dataHora);
  if (observacao !== undefined) data.observacao = observacao?.trim() || null;

  const atualizado = await prisma.followUp.update({
    where: { id },
    data,
    include: INCLUDE_FOLLOWUP,
  });

  res.json({ followUp: atualizado });
}

async function remover(req, res) {
  const { id } = req.params;

  const followUp = await prisma.followUp.findFirst({
    where: { id },
    include: { lead: { select: { imobiliariaId: true } } },
  });
  if (!followUp) return res.status(404).json({ error: 'Follow-up não encontrado' });
  if (followUp.lead.imobiliariaId !== req.imobiliariaId) {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  if ((req.role === 'corretor' || req.role === 'gerente') && followUp.corretorId !== req.corretorId) {
    return res.status(403).json({ error: 'Sem permissão para remover este follow-up' });
  }

  await prisma.followUp.delete({ where: { id } });
  res.json({ ok: true });
}

async function pendentes(req, res) {
  const where = { status: 'pendente' };

  if (req.role === 'corretor' || req.role === 'gerente') {
    where.corretorId = req.corretorId;
  } else {
    where.lead = { imobiliariaId: req.imobiliariaId };
  }

  const followUps = await prisma.followUp.findMany({
    where,
    orderBy: { dataHora: 'asc' },
    include: INCLUDE_FOLLOWUP,
  });

  res.json({ followUps });
}

module.exports = { criar, atualizar, remover, pendentes };
