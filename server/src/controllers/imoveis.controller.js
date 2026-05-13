const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function listar(req, res) {
  const imoveis = await prisma.imovel.findMany({
    where: { imobiliariaId: req.imobiliariaId },
    orderBy: [{ destaque: 'desc' }, { criadoEm: 'desc' }],
  });
  res.json(imoveis);
}

async function criar(req, res) {
  const { nome, descricao, tipo, localizacao, valorMin, valorMax, quartos, area, status, destaque } = req.body;

  if (!nome?.trim() || !descricao?.trim() || !tipo?.trim() || !localizacao?.trim()) {
    return res.status(400).json({ error: 'Nome, descrição, tipo e localização são obrigatórios' });
  }

  const imovel = await prisma.imovel.create({
    data: {
      nome: nome.trim(),
      descricao: descricao.trim(),
      tipo: tipo.trim(),
      localizacao: localizacao.trim(),
      valorMin: valorMin != null ? parseFloat(valorMin) : null,
      valorMax: valorMax != null ? parseFloat(valorMax) : null,
      quartos: quartos != null ? parseInt(quartos) : null,
      area: area?.trim() || null,
      status: status || 'disponivel',
      destaque: destaque === true || destaque === 'true',
      imobiliariaId: req.imobiliariaId,
    },
  });
  res.status(201).json(imovel);
}

async function atualizar(req, res) {
  const { id } = req.params;

  const imovel = await prisma.imovel.findFirst({
    where: { id, imobiliariaId: req.imobiliariaId },
  });
  if (!imovel) return res.status(404).json({ error: 'Imóvel não encontrado' });

  const { nome, descricao, tipo, localizacao, valorMin, valorMax, quartos, area, status, destaque } = req.body;

  const atualizado = await prisma.imovel.update({
    where: { id },
    data: {
      ...(nome !== undefined && { nome: nome.trim() }),
      ...(descricao !== undefined && { descricao: descricao.trim() }),
      ...(tipo !== undefined && { tipo: tipo.trim() }),
      ...(localizacao !== undefined && { localizacao: localizacao.trim() }),
      ...(valorMin !== undefined && { valorMin: valorMin != null ? parseFloat(valorMin) : null }),
      ...(valorMax !== undefined && { valorMax: valorMax != null ? parseFloat(valorMax) : null }),
      ...(quartos !== undefined && { quartos: quartos != null ? parseInt(quartos) : null }),
      ...(area !== undefined && { area: area?.trim() || null }),
      ...(status !== undefined && { status }),
      ...(destaque !== undefined && { destaque: destaque === true || destaque === 'true' }),
    },
  });
  res.json(atualizado);
}

async function remover(req, res) {
  const { id } = req.params;

  const imovel = await prisma.imovel.findFirst({
    where: { id, imobiliariaId: req.imobiliariaId },
  });
  if (!imovel) return res.status(404).json({ error: 'Imóvel não encontrado' });

  await prisma.imovel.delete({ where: { id } });
  res.json({ ok: true });
}

module.exports = { listar, criar, atualizar, remover };
