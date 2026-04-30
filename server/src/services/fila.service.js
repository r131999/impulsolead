const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const STATUS_VALIDOS = ['novo', 'qualificado', 'atendimento', 'visita', 'proposta', 'fechado', 'perdido'];

async function proximoCorretor(imobiliariaId) {
  return prisma.$transaction(async (tx) => {
    const corretores = await tx.corretor.findMany({
      where: { imobiliariaId, ativo: true, disponivel: true },
      orderBy: { posicaoFila: 'asc' },
    });

    if (corretores.length === 0) return null;

    const proximo = corretores[0];
    const maxPosicao = corretores[corretores.length - 1].posicaoFila;

    await tx.corretor.update({
      where: { id: proximo.id },
      data: {
        leadsRecebidos: { increment: 1 },
        posicaoFila: maxPosicao + 1,
      },
    });

    return proximo;
  });
}

async function reordenarFila(imobiliariaId) {
  const corretores = await prisma.corretor.findMany({
    where: { imobiliariaId, ativo: true },
    orderBy: { posicaoFila: 'asc' },
  });

  await prisma.$transaction(
    corretores.map((c, idx) =>
      prisma.corretor.update({ where: { id: c.id }, data: { posicaoFila: idx } })
    )
  );
}

module.exports = { proximoCorretor, reordenarFila, STATUS_VALIDOS };
