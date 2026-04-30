const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function getConfigAgente(req, res) {
  const config = await prisma.configAgente.findUnique({
    where: { imobiliariaId: req.imobiliariaId },
  });

  if (!config) {
    return res.status(404).json({ error: 'Configuração do agente não encontrada' });
  }

  res.json({ config });
}

async function atualizarConfigAgente(req, res) {
  const { mensagemBoasVindas, perguntas, nomeAgente, tomAgente, ativo } = req.body;

  if (perguntas !== undefined) {
    if (!Array.isArray(perguntas) || perguntas.length === 0) {
      return res.status(400).json({ error: 'perguntas deve ser um array não vazio' });
    }
    if (perguntas.some((p) => typeof p !== 'string' || !p.trim())) {
      return res.status(400).json({ error: 'Todas as perguntas devem ser strings não vazias' });
    }
  }

  const config = await prisma.configAgente.upsert({
    where: { imobiliariaId: req.imobiliariaId },
    update: {
      ...(mensagemBoasVindas !== undefined && { mensagemBoasVindas }),
      ...(perguntas !== undefined && { perguntas }),
      ...(nomeAgente !== undefined && { nomeAgente }),
      ...(tomAgente !== undefined && { tomAgente }),
      ...(ativo !== undefined && { ativo }),
    },
    create: {
      imobiliariaId: req.imobiliariaId,
      mensagemBoasVindas: mensagemBoasVindas || 'Olá! Tudo bem? Aqui é a Lia, assistente virtual. Que bom que você entrou em contato! Como posso te chamar?',
      perguntas: perguntas || [],
      nomeAgente: nomeAgente || 'Lia',
      tomAgente: tomAgente || 'profissional mas leve',
      ativo: ativo !== undefined ? ativo : true,
    },
  });

  res.json({ config });
}

module.exports = { getConfigAgente, atualizarConfigAgente };
