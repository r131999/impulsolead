const { PrismaClient } = require('@prisma/client');
const { reordenarFila } = require('../services/fila.service');

const prisma = new PrismaClient();

async function listar(req, res) {
  const { ativo, disponivel } = req.query;

  const where = { imobiliariaId: req.imobiliariaId };
  if (ativo !== undefined) where.ativo = ativo === 'true';
  if (disponivel !== undefined) where.disponivel = disponivel === 'true';

  const corretores = await prisma.corretor.findMany({
    where,
    orderBy: { posicaoFila: 'asc' },
    select: {
      id: true, nome: true, email: true, telefone: true, whatsapp: true,
      ativo: true, disponivel: true, posicaoFila: true, leadsRecebidos: true,
      criadoEm: true,
      _count: { select: { leads: true } },
    },
  });

  res.json({ corretores });
}

async function buscarFila(req, res) {
  const corretores = await prisma.corretor.findMany({
    where: { imobiliariaId: req.imobiliariaId, ativo: true },
    orderBy: { posicaoFila: 'asc' },
    select: { id: true, nome: true, disponivel: true, posicaoFila: true, leadsRecebidos: true },
  });

  const fila = corretores.map((c, idx) => ({
    posicao: idx + 1,
    corretorId: c.id,
    nome: c.nome,
    disponivel: c.disponivel,
    leadsRecebidos: c.leadsRecebidos,
  }));

  res.json({ fila });
}

async function criar(req, res) {
  const { nome, email, telefone, whatsapp } = req.body;

  if (!nome || !telefone || !whatsapp) {
    return res.status(400).json({ error: 'Campos obrigatórios: nome, telefone, whatsapp' });
  }

  const totalAtivos = await prisma.corretor.count({
    where: { imobiliariaId: req.imobiliariaId, ativo: true },
  });

  const corretor = await prisma.corretor.create({
    data: {
      nome,
      email: email || null,
      telefone,
      whatsapp,
      imobiliariaId: req.imobiliariaId,
      posicaoFila: totalAtivos,
    },
  });

  res.status(201).json({ corretor });
}

async function atualizar(req, res) {
  const { id } = req.params;
  const { nome, email, telefone, whatsapp } = req.body;

  const corretor = await prisma.corretor.findFirst({
    where: { id, imobiliariaId: req.imobiliariaId },
  });

  if (!corretor) {
    return res.status(404).json({ error: 'Corretor não encontrado' });
  }

  const atualizado = await prisma.corretor.update({
    where: { id },
    data: {
      ...(nome && { nome }),
      ...(email !== undefined && { email }),
      ...(telefone && { telefone }),
      ...(whatsapp && { whatsapp }),
    },
  });

  res.json({ corretor: atualizado });
}

async function atualizarDisponibilidade(req, res) {
  const { id } = req.params;
  const { disponivel } = req.body;

  if (disponivel === undefined) {
    return res.status(400).json({ error: 'Campo obrigatório: disponivel (boolean)' });
  }

  const corretor = await prisma.corretor.findFirst({
    where: { id, imobiliariaId: req.imobiliariaId },
  });

  if (!corretor) {
    return res.status(404).json({ error: 'Corretor não encontrado' });
  }

  const atualizado = await prisma.corretor.update({
    where: { id },
    data: { disponivel },
  });

  res.json({
    corretor: { id: atualizado.id, nome: atualizado.nome, disponivel: atualizado.disponivel },
    message: disponivel ? 'Corretor marcado como disponível' : 'Corretor marcado como indisponível',
  });
}

async function remover(req, res) {
  const { id } = req.params;

  const corretor = await prisma.corretor.findFirst({
    where: { id, imobiliariaId: req.imobiliariaId },
  });

  if (!corretor) {
    return res.status(404).json({ error: 'Corretor não encontrado' });
  }

  // Soft delete: desativa em vez de apagar
  await prisma.corretor.update({
    where: { id },
    data: { ativo: false, disponivel: false },
  });

  // Reordena a fila após remoção
  await reordenarFila(req.imobiliariaId);

  res.json({ message: 'Corretor removido da fila' });
}

module.exports = { listar, buscarFila, criar, atualizar, atualizarDisponibilidade, remover };
