const { PrismaClient } = require('@prisma/client');
const { STATUS_VALIDOS } = require('../services/fila.service');

const prisma = new PrismaClient();

const CAMPOS_QUALIFICACAO = [
  'primeiroImovel', 'tipoRenda', 'rendaMensal', 'restricaoCpf',
  'valorEntrada', 'urgencia', 'regiao', 'faixaValor',
];

async function listar(req, res) {
  const { status, corretorId, dataInicio, dataFim, busca, page = 1, limit = 50 } = req.query;

  const where = { imobiliariaId: req.imobiliariaId };

  if (req.role === 'corretor') {
    where.corretorId = req.corretorId;
  } else if (req.role === 'gerente') {
    if (req.equipeId) {
      const corretoresDaEquipe = await prisma.corretor.findMany({
        where: { equipeId: req.equipeId, imobiliariaId: req.imobiliariaId },
        select: { id: true },
      });
      where.corretorId = { in: corretoresDaEquipe.map((c) => c.id) };
    } else {
      where.corretorId = req.corretorId;
    }
  } else {
    if (corretorId) where.corretorId = corretorId;
  }

  if (status) {
    const statusList = status.split(',').map((s) => s.trim());
    where.status = statusList.length === 1 ? statusList[0] : { in: statusList };
  }
  if (dataInicio || dataFim) {
    where.criadoEm = {};
    if (dataInicio) where.criadoEm.gte = new Date(dataInicio);
    if (dataFim) where.criadoEm.lte = new Date(dataFim);
  }
  if (busca) {
    const isPostgres = process.env.DATABASE_URL?.includes('postgres');
    where.OR = [
      { nome: { contains: busca, ...(isPostgres && { mode: 'insensitive' }) } },
      { telefone: { contains: busca } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [leads, total] = await prisma.$transaction([
    prisma.lead.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { criadoEm: 'desc' },
      select: {
        id: true, nome: true, nomeEditado: true, telefone: true, status: true,
        origem: true,
        primeiroImovel: true, tipoRenda: true, rendaMensal: true,
        restricaoCpf: true, valorEntrada: true,
        urgencia: true, regiao: true, faixaValor: true,
        observacoes: true, criadoEm: true, atualizadoEm: true,
        temConversa: true,
        corretor: { select: { id: true, nome: true } },
      },
    }),
    prisma.lead.count({ where }),
  ]);

  res.json({ leads, total, page: Number(page), limit: Number(limit) });
}

async function buscarPorId(req, res) {
  const { id } = req.params;

  const where = { id, imobiliariaId: req.imobiliariaId };
  if (req.role === 'corretor') {
    where.corretorId = req.corretorId;
  } else if (req.role === 'gerente') {
    if (req.equipeId) {
      const idsEquipe = await prisma.corretor.findMany({
        where: { equipeId: req.equipeId, imobiliariaId: req.imobiliariaId },
        select: { id: true },
      });
      where.corretorId = { in: idsEquipe.map((c) => c.id) };
    } else {
      where.corretorId = req.corretorId;
    }
  }

  const lead = await prisma.lead.findFirst({
    where,
    include: {
      corretor: { select: { id: true, nome: true, telefone: true, whatsapp: true } },
      historico: { orderBy: { criadoEm: 'desc' } },
    },
  });

  if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

  res.json({ lead });
}

async function criar(req, res) {
  const { nome, telefone, whatsappJid, corretorId, observacoes, ...qualificacao } = req.body;

  if (!nome || !telefone) {
    return res.status(400).json({ error: 'Campos obrigatórios: nome, telefone' });
  }

  if (corretorId) {
    const corretor = await prisma.corretor.findFirst({
      where: { id: corretorId, imobiliariaId: req.imobiliariaId, ativo: true },
    });
    if (!corretor) return res.status(400).json({ error: 'Corretor não encontrado ou inativo' });
  }

  const dadosQualificacao = {};
  CAMPOS_QUALIFICACAO.forEach((campo) => {
    if (qualificacao[campo] !== undefined) dadosQualificacao[campo] = qualificacao[campo];
  });

  const lead = await prisma.$transaction(async (tx) => {
    const novoLead = await tx.lead.create({
      data: {
        nome,
        telefone,
        whatsappJid: whatsappJid || `${telefone}@s.whatsapp.net`,
        observacoes: observacoes || null,
        corretorId: corretorId || null,
        imobiliariaId: req.imobiliariaId,
        ...dadosQualificacao,
      },
      include: { corretor: { select: { id: true, nome: true } } },
    });

    await tx.historicoLead.create({
      data: {
        leadId: novoLead.id,
        acao: 'Lead criado manualmente',
        detalhes: corretorId ? `Atribuído a ${novoLead.corretor?.nome}` : 'Sem corretor atribuído',
      },
    });

    return novoLead;
  });

  res.status(201).json({ lead });
}

async function atualizar(req, res) {
  const { id } = req.params;
  const { nome, telefone, whatsappJid, corretorId, observacoes, ...qualificacao } = req.body;

  const whereFind = { id, imobiliariaId: req.imobiliariaId };
  let idsEquipeGerente = null;

  if (req.role === 'corretor') {
    whereFind.corretorId = req.corretorId;
  } else if (req.role === 'gerente') {
    if (req.equipeId) {
      const corretoresDaEquipe = await prisma.corretor.findMany({
        where: { equipeId: req.equipeId, imobiliariaId: req.imobiliariaId },
        select: { id: true },
      });
      idsEquipeGerente = corretoresDaEquipe.map((c) => c.id);
      whereFind.corretorId = { in: idsEquipeGerente };
    } else {
      whereFind.corretorId = req.corretorId;
    }
  }

  const lead = await prisma.lead.findFirst({ where: whereFind });
  if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

  if (req.role === 'corretor') {
    const atualizado = await prisma.lead.update({
      where: { id },
      data: { ...(observacoes !== undefined && { observacoes }) },
      include: { corretor: { select: { id: true, nome: true } } },
    });
    return res.json({ lead: atualizado });
  }

  if (req.role === 'gerente') {
    if (corretorId !== undefined && corretorId !== null) {
      const ids = idsEquipeGerente || [];
      if (!ids.includes(corretorId)) {
        return res.status(403).json({ error: 'Corretor não pertence à sua equipe' });
      }
    }

    const atualizado = await prisma.$transaction(async (tx) => {
      const result = await tx.lead.update({
        where: { id },
        data: {
          ...(observacoes !== undefined && { observacoes }),
          ...(corretorId !== undefined && { corretorId }),
        },
        include: { corretor: { select: { id: true, nome: true } } },
      });

      if (corretorId !== undefined && corretorId !== lead.corretorId) {
        const nomeCorretor = result.corretor?.nome || 'nenhum';
        await tx.historicoLead.create({
          data: {
            leadId: id,
            acao: 'Corretor reatribuído',
            detalhes: `Novo corretor: ${nomeCorretor}`,
          },
        });
      }

      return result;
    });

    return res.json({ lead: atualizado });
  }

  if (corretorId && corretorId !== lead.corretorId) {
    const corretor = await prisma.corretor.findFirst({
      where: { id: corretorId, imobiliariaId: req.imobiliariaId, ativo: true },
    });
    if (!corretor) return res.status(400).json({ error: 'Corretor não encontrado ou inativo' });
  }

  const dadosQualificacao = {};
  CAMPOS_QUALIFICACAO.forEach((campo) => {
    if (qualificacao[campo] !== undefined) dadosQualificacao[campo] = qualificacao[campo];
  });

  const atualizado = await prisma.$transaction(async (tx) => {
    const result = await tx.lead.update({
      where: { id },
      data: {
        ...(nome && { nome }),
        ...(telefone && { telefone }),
        ...(whatsappJid && { whatsappJid }),
        ...(observacoes !== undefined && { observacoes }),
        ...(corretorId !== undefined && { corretorId }),
        ...dadosQualificacao,
      },
      include: { corretor: { select: { id: true, nome: true } } },
    });

    if (corretorId !== undefined && corretorId !== lead.corretorId) {
      const nomeCorretor = result.corretor?.nome || 'nenhum';
      await tx.historicoLead.create({
        data: {
          leadId: id,
          acao: 'Corretor reatribuído',
          detalhes: `Novo corretor: ${nomeCorretor}`,
        },
      });
    }

    return result;
  });

  res.json({ lead: atualizado });
}

async function mudarStatus(req, res) {
  const { id } = req.params;
  const { status, observacao, motivoPerda } = req.body;

  if (!status) return res.status(400).json({ error: 'Campo obrigatório: status' });

  if (!STATUS_VALIDOS.includes(status)) {
    return res.status(400).json({
      error: `Status inválido. Valores aceitos: ${STATUS_VALIDOS.join(', ')}`,
    });
  }

  const whereStatus = { id, imobiliariaId: req.imobiliariaId };
  if (req.role === 'corretor') {
    whereStatus.corretorId = req.corretorId;
  } else if (req.role === 'gerente') {
    if (req.equipeId) {
      const idsEquipe = await prisma.corretor.findMany({
        where: { equipeId: req.equipeId, imobiliariaId: req.imobiliariaId },
        select: { id: true },
      });
      whereStatus.corretorId = { in: idsEquipe.map((c) => c.id) };
    } else {
      whereStatus.corretorId = req.corretorId;
    }
  }

  const lead = await prisma.lead.findFirst({ where: whereStatus });
  if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

  if (status === lead.status) {
    return res.status(400).json({ error: 'Lead já está neste status' });
  }

  if (status === 'perdido' && !motivoPerda) {
    return res.status(400).json({ error: 'Campo obrigatório ao marcar como perdido: motivoPerda' });
  }

  const atualizado = await prisma.$transaction(async (tx) => {
    const result = await tx.lead.update({
      where: { id },
      data: {
        status,
        ...(status === 'perdido' && { motivoPerda }),
        ...(observacao && { observacoes: observacao }),
      },
      include: { corretor: { select: { id: true, nome: true } } },
    });

    await tx.historicoLead.create({
      data: {
        leadId: id,
        acao: `Status alterado de "${lead.status}" para "${status}"`,
        detalhes: observacao || motivoPerda || null,
      },
    });

    return result;
  });

  res.json({ lead: atualizado });
}

async function remover(req, res) {
  const { id } = req.params;

  const lead = await prisma.lead.findFirst({
    where: { id, imobiliariaId: req.imobiliariaId },
  });
  if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

  await prisma.$transaction([
    prisma.historicoLead.deleteMany({ where: { leadId: id } }),
    prisma.lead.delete({ where: { id } }),
  ]);

  res.json({ message: 'Lead removido' });
}

async function detalhes(req, res) {
  const { id } = req.params;
  const { nome, origem, observacoes } = req.body;

  const where = { id, imobiliariaId: req.imobiliariaId };
  if (req.role === 'corretor') {
    where.corretorId = req.corretorId;
  } else if (req.role === 'gerente') {
    if (req.equipeId) {
      const idsEquipe = await prisma.corretor.findMany({
        where: { equipeId: req.equipeId, imobiliariaId: req.imobiliariaId },
        select: { id: true },
      });
      where.corretorId = { in: idsEquipe.map((c) => c.id) };
    } else {
      where.corretorId = req.corretorId;
    }
  }

  const lead = await prisma.lead.findFirst({ where });
  if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

  const data = {};
  if (nome !== undefined && nome.trim()) {
    data.nome = nome.trim();
    data.nomeEditado = nome.trim();
  }
  if (origem !== undefined) data.origem = origem || null;
  if (observacoes !== undefined) data.observacoes = observacoes.trim() || null;

  const atualizado = await prisma.lead.update({
    where: { id },
    data,
    include: { corretor: { select: { id: true, nome: true } } },
  });

  return res.json({ lead: atualizado });
}

async function getHistoricoConversa(req, res) {
  const { id } = req.params;

  const where = { id, imobiliariaId: req.imobiliariaId };
  if (req.role === 'corretor') where.corretorId = req.corretorId;

  const lead = await prisma.lead.findFirst({
    where,
    select: { id: true, nome: true, historicoConversa: true, temConversa: true },
  });

  if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });
  if (!lead.temConversa || !lead.historicoConversa) {
    return res.json({ historico: null });
  }

  let historico;
  try {
    historico = JSON.parse(lead.historicoConversa);
  } catch {
    historico = [{ role: 'lia', texto: lead.historicoConversa, ts: null }];
  }

  res.json({ historico, nome: lead.nome });
}

module.exports = { listar, buscarPorId, criar, atualizar, mudarStatus, remover, detalhes, getHistoricoConversa };
