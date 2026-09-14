'use strict';

const prisma = require('../lib/prisma');

const EVENTOS_PAGAMENTO = ['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'];

// +1 mês a partir do vencimento atual (se ainda não venceu) ou de agora (se já
// venceu) — não empilha tempo perdido em atraso, nem perde dias já pagos.
function proximoVencimento(planoExpiraEm) {
  const base = planoExpiraEm && new Date(planoExpiraEm) > new Date()
    ? new Date(planoExpiraEm)
    : new Date();
  base.setMonth(base.getMonth() + 1);
  return base;
}

// Webhook do Asaas: reenvio é garantido ("at least once") e um erro aqui pausa
// a fila inteira de eventos pra todos os clientes — por isso SEMPRE responde
// 2xx, mesmo em erro inesperado (exceto token inválido). Idempotência é por
// payment.id (não por tipo de evento — RECEIVED e CONFIRMED são dois eventos
// do mesmo pagamento), garantida por constraint única no banco, não
// check-then-act.
async function receberWebhookAsaas(req, res) {
  try {
    const tokenRecebido = req.headers['asaas-access-token'];
    if (!tokenRecebido || tokenRecebido !== process.env.ASAAS_WEBHOOK_TOKEN) {
      return res.status(401).json({ error: 'token inválido' });
    }

    const { event, payment } = req.body || {};
    if (!EVENTOS_PAGAMENTO.includes(event) || !payment?.id || !payment?.subscription) {
      return res.sendStatus(200);
    }

    const imobiliaria = await prisma.imobiliaria.findUnique({
      where: { asaasSubscriptionId: payment.subscription },
      select: { id: true, nome: true, plano: true, planoExpiraEm: true },
    });

    if (!imobiliaria) {
      console.warn(`[asaas-webhook] subscription ${payment.subscription} sem imobiliária vinculada`);
      return res.sendStatus(200);
    }

    try {
      await prisma.$transaction([
        prisma.cobranca.create({
          data: {
            imobiliariaId: imobiliaria.id,
            tipo: 'pagamento_confirmado',
            valor: payment.value,
            plano: imobiliaria.plano,
            asaasPaymentId: payment.id,
          },
        }),
        prisma.imobiliaria.update({
          where: { id: imobiliaria.id },
          data: { planoExpiraEm: proximoVencimento(imobiliaria.planoExpiraEm) },
        }),
      ]);
      console.log(`[asaas-webhook] Pagamento ${payment.id} confirmado — plano estendido (${imobiliaria.nome})`);
    } catch (err) {
      if (err.code === 'P2002') {
        console.log(`[asaas-webhook] Pagamento ${payment.id} já processado — evento duplicado ignorado`);
      } else {
        throw err;
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('[asaas-webhook] Erro inesperado:', err.message);
    res.sendStatus(200); // nunca deixar erro pausar a fila do Asaas
  }
}

module.exports = { receberWebhookAsaas };
