const { notificarGestorPendencia } = require('./notificacao.service');

const prisma = require('../lib/prisma');

const STATUS_VALIDOS = ['lead', 'atendimento', 'em_espera', 'agendamento', 'visita', 'proposta', 'venda', 'perdido'];
const LIMITE_PENDENCIA_MS = 24 * 60 * 60 * 1000;

async function temPendencia(corretorId) {
  const limite = new Date(Date.now() - LIMITE_PENDENCIA_MS);
  const count = await prisma.lead.count({
    where: {
      corretorId,
      atualizadoEm: { lt: limite },
      status: { notIn: ['venda', 'perdido'] },
      OR: [{ observacoes: null }, { observacoes: '' }],
    },
  });
  return count > 0;
}

async function proximoCorretor(imobiliariaId) {
  const corretores = await prisma.corretor.findMany({
    where: { imobiliariaId, ativo: true, disponivel: true },
    orderBy: { posicaoFila: 'asc' },
  });

  if (corretores.length === 0) return null;

  const gestor = await prisma.usuario.findFirst({
    where: { imobiliariaId, role: 'gestor', telefone: { not: null } },
    select: { telefone: true },
    orderBy: { criadoEm: 'asc' },
  });

  let escolhido = null;
  for (const corretor of corretores) {
    const pendente = await temPendencia(corretor.id);
    if (!pendente) {
      escolhido = corretor;
      break;
    }
    console.log(`[fila] ${corretor.nome} pulado por pendência de atendimento`);
    if (gestor?.telefone) {
      notificarGestorPendencia(gestor.telefone, corretor.nome).catch((err) => {
        console.error('[fila] Falha ao notificar gestor:', err.message);
      });
    }
  }

  // Todos com pendência: atribui ao primeiro para não travar a fila
  if (!escolhido) {
    escolhido = corretores[0];
    console.log(`[fila] Todos os corretores têm pendência — atribuindo ao primeiro (${escolhido.nome})`);
  }

  const maxPosicao = corretores[corretores.length - 1].posicaoFila;
  await prisma.corretor.update({
    where: { id: escolhido.id },
    data: {
      leadsRecebidos: { increment: 1 },
      posicaoFila: maxPosicao + 1,
    },
  });

  return escolhido;
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
