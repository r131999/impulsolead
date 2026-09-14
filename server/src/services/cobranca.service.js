'use strict';

const prisma = require('../lib/prisma');
const { PERMISSOES_POR_PLANO } = require('../config/permissoes-planos');

const PLANOS_COBRAVEIS = ['construcao', 'desenvolvimento', 'sucesso'];

// Preço final da cobrança: valor personalizado da imobiliária (clientes antigos
// com acordo de preço diferente) sobrepõe o preço de tabela do plano.
function resolverValorCobranca(imobiliaria) {
  if (imobiliaria.valorCobrancaPersonalizado != null) {
    return Number(imobiliaria.valorCobrancaPersonalizado);
  }
  return PERMISSOES_POR_PLANO[imobiliaria.plano]?.valor ?? null;
}

// Mesma fonte de telefone do gestor usada por verificarLeadsParados,
// enviarRelatorioSemanal e o escalonamento de leads sem tratativa
// (cron.service.js). NÃO usar Imobiliaria.telefoneNotificacoes — esse campo é
// opt-in e específico do alerta de leads sem tratativa (avisoLeadAtivo), fica
// vazio pra maioria dos clientes e não representa o telefone real do gestor.
async function obterTelefoneGestorParaCobranca(imobiliariaId) {
  const gestor = await prisma.usuario.findFirst({
    where: { imobiliariaId, role: 'gestor', telefone: { not: null } },
    select: { telefone: true },
    orderBy: { criadoEm: 'asc' },
  });
  return gestor?.telefone || null;
}

// Regra de elegibilidade para cobrança — usada pelo lembrete de vencimento
// (enviarLembretesCobranca em cron.service.js) antes de buscar o PIX e disparar
// o WhatsApp.
async function elegivelParaCobranca(imobiliaria) {
  // Legado é isenção vitalícia INTENCIONAL — é o cliente responsável pela
  // criação do ImpulsoLead. Não é bug, não "esqueceram de migrar"; não cobrar
  // esse plano nunca, sem decisão explícita em contrário.
  if (imobiliaria.plano === 'legado') return false;

  // Cancelado e trial (incluindo trial expirado) nunca são cobrados.
  if (!PLANOS_COBRAVEIS.includes(imobiliaria.plano)) return false;

  const valor = resolverValorCobranca(imobiliaria);
  if (!valor) return false;

  const telefoneGestor = await obterTelefoneGestorParaCobranca(imobiliaria.id);
  if (!telefoneGestor) return false;

  // Cadastro no Asaas é manual e gradual — sem assinatura vinculada não há
  // cobrança/PIX pra buscar, então a imobiliária ainda não é elegível.
  if (!imobiliaria.asaasSubscriptionId) return false;

  return true;
}

module.exports = {
  resolverValorCobranca,
  obterTelefoneGestorParaCobranca,
  elegivelParaCobranca,
};
