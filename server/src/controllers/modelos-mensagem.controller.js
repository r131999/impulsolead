const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function listar(req, res) {
  const modelos = await prisma.modeloMensagem.findMany({
    where: { imobiliariaId: req.imobiliariaId, ativo: true },
    orderBy: { criadoEm: 'asc' },
  });
  res.json(modelos);
}

async function criar(req, res) {
  const { nome, conteudo } = req.body;
  if (!nome?.trim() || !conteudo?.trim()) {
    return res.status(400).json({ error: 'Nome e conteúdo são obrigatórios' });
  }
  const modelo = await prisma.modeloMensagem.create({
    data: { nome: nome.trim(), conteudo: conteudo.trim(), imobiliariaId: req.imobiliariaId },
  });
  res.status(201).json(modelo);
}

async function atualizar(req, res) {
  const { id } = req.params;
  const { nome, conteudo, ativo } = req.body;

  const modelo = await prisma.modeloMensagem.findFirst({
    where: { id, imobiliariaId: req.imobiliariaId },
  });
  if (!modelo) return res.status(404).json({ error: 'Modelo não encontrado' });

  const atualizado = await prisma.modeloMensagem.update({
    where: { id },
    data: {
      ...(nome !== undefined && { nome: nome.trim() }),
      ...(conteudo !== undefined && { conteudo: conteudo.trim() }),
      ...(ativo !== undefined && { ativo }),
    },
  });
  res.json(atualizado);
}

async function remover(req, res) {
  const { id } = req.params;
  const modelo = await prisma.modeloMensagem.findFirst({
    where: { id, imobiliariaId: req.imobiliariaId },
  });
  if (!modelo) return res.status(404).json({ error: 'Modelo não encontrado' });

  await prisma.modeloMensagem.delete({ where: { id } });
  res.json({ ok: true });
}

module.exports = { listar, criar, atualizar, remover };
