'use strict';

const prisma = require('../lib/prisma');

async function criar(req, res) {
  try {
    const { nome, descricao } = req.body;
    if (!nome?.trim()) {
      return res.status(400).json({ error: 'Nome é obrigatório' });
    }

    const empreendimento = await prisma.empreendimento.create({
      data: {
        nome: nome.trim(),
        descricao: descricao?.trim() || null,
        imobiliariaId: req.imobiliariaId,
        criadoPorId: req.corretorId || req.usuario?.id,
      },
    });

    res.status(201).json({ empreendimento });
  } catch (err) {
    console.error('[empreendimentos] criar:', err.message);
    res.status(500).json({ error: 'Erro ao criar empreendimento' });
  }
}

async function listar(req, res) {
  try {
    const empreendimentos = await prisma.empreendimento.findMany({
      where: { imobiliariaId: req.imobiliariaId },
      orderBy: { criadoEm: 'asc' },
      include: { _count: { select: { arquivos: true } } },
    });

    res.json({ empreendimentos });
  } catch (err) {
    console.error('[empreendimentos] listar:', err.message);
    res.status(500).json({ error: 'Erro ao listar empreendimentos' });
  }
}

async function editar(req, res) {
  try {
    const { id } = req.params;
    const { nome, descricao } = req.body;

    const existente = await prisma.empreendimento.findFirst({
      where: { id, imobiliariaId: req.imobiliariaId },
    });
    if (!existente) return res.status(404).json({ error: 'Empreendimento não encontrado' });

    const data = {};
    if (nome !== undefined) {
      if (!nome?.trim()) return res.status(400).json({ error: 'Nome não pode ser vazio' });
      data.nome = nome.trim();
    }
    if (descricao !== undefined) {
      data.descricao = descricao?.trim() || null;
    }

    const empreendimento = await prisma.empreendimento.update({ where: { id }, data });

    res.json({ empreendimento });
  } catch (err) {
    console.error('[empreendimentos] editar:', err.message);
    res.status(500).json({ error: 'Erro ao editar empreendimento' });
  }
}

async function excluir(req, res) {
  try {
    const { id } = req.params;

    const empreendimento = await prisma.empreendimento.findFirst({
      where: { id, imobiliariaId: req.imobiliariaId },
      include: { _count: { select: { arquivos: true } } },
    });
    if (!empreendimento) return res.status(404).json({ error: 'Empreendimento não encontrado' });

    if (empreendimento._count.arquivos > 0) {
      return res.status(400).json({
        error: 'Esvazie o empreendimento antes de excluir. Remova todos os arquivos primeiro.',
      });
    }

    await prisma.empreendimento.delete({ where: { id } });

    res.json({ message: 'Empreendimento removido' });
  } catch (err) {
    console.error('[empreendimentos] excluir:', err.message);
    res.status(500).json({ error: 'Erro ao excluir empreendimento' });
  }
}

module.exports = { criar, listar, editar, excluir };
