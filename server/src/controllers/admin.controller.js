'use strict';

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../lib/prisma');
const { PERMISSOES_POR_PLANO } = require('../config/permissoes-planos');
const { SELECT_CONSUMO, temAgenteIA, resolverDiaCiclo, calcularConsumo } = require('../services/consumoAgente.service');
const { ETAPAS_QUALIFICAVEIS, codigoTeste } = require('../services/metaConversionsApi.service');

const PERGUNTAS_PADRAO = [
  'É o seu primeiro imóvel?',
  'Qual é o seu tipo de renda? (CLT, autônomo, servidor público)',
  'Qual é a sua renda mensal aproximada?',
  'Você tem alguma restrição no CPF?',
  'Você tem valor de entrada disponível? Quanto aproximadamente?',
  'Você está comprando agora ou ainda pesquisando?',
  'Qual região você prefere morar?',
  'Qual faixa de valor você tem em mente para o imóvel?',
];

const VALID_PLANOS = ['trial', 'construcao', 'desenvolvimento', 'sucesso', 'legado', 'cancelado'];

function gerarApiKey() {
  return crypto.randomBytes(32).toString('hex');
}

function calcStatusPlano(plano, trialExpiraEm) {
  if (plano === 'cancelado') return 'cancelado';
  if (plano === 'legado') return 'legado';
  if (plano === 'trial') {
    return trialExpiraEm && new Date() <= new Date(trialExpiraEm)
      ? 'trial_ativo'
      : 'trial_expirado';
  }
  return plano; // construcao | desenvolvimento | sucesso
}

// ── listarClientes ────────────────────────────────────────────────────────────

async function listarClientes(req, res) {
  const { busca } = req.query;
  const where = busca ? { nome: { contains: busca, mode: 'insensitive' } } : {};

  const imobiliarias = await prisma.imobiliaria.findMany({
    where,
    select: {
      id: true,
      nome: true,
      email: true,
      plano: true,
      trialExpiraEm: true,
      planoExpiraEm: true,
      planoBloqueadoEm: true,
      limiteAcessos: true,
      permissoes: true,
      valorCobrancaPersonalizado: true,
      criadoEm: true,
      metaIntegracoes: {
        where: { ativo: true, pageId: { not: null } },
        select: {
          pageId: true, pageName: true, adAccountId: true,
          metaDatasetId: true, metaDatasetToken: true, metaEtapaQualificada: true, metaTestEventCode: true,
        },
      },
      _count: {
        select: {
          leads: true,
          usuarios: true,
          corretores: { where: { ativo: true } },
        },
      },
    },
    orderBy: { criadoEm: 'desc' },
  });

  const agora = new Date();
  const resultado = imobiliarias.map((imob) => {
    let diasRestantes = null;
    if (imob.trialExpiraEm) {
      diasRestantes = Math.max(0, Math.ceil((new Date(imob.trialExpiraEm) - agora) / (1000 * 60 * 60 * 24)));
    } else if (imob.planoExpiraEm) {
      diasRestantes = Math.max(0, Math.ceil((new Date(imob.planoExpiraEm) - agora) / (1000 * 60 * 60 * 24)));
    }

    const comDataset = imob.metaIntegracoes.find((m) => m.metaDatasetId);

    return {
      id: imob.id,
      nome: imob.nome,
      email: imob.email,
      plano: imob.plano,
      trialExpiraEm: imob.trialExpiraEm,
      planoExpiraEm: imob.planoExpiraEm,
      planoBloqueadoEm: imob.planoBloqueadoEm,
      limiteAcessos: imob.limiteAcessos,
      permissoes: imob.permissoes,
      valorCobrancaPersonalizado: imob.valorCobrancaPersonalizado != null ? Number(imob.valorCobrancaPersonalizado) : null,
      criadoEm: imob.criadoEm,
      contasAnuncio: imob.metaIntegracoes.map((m) => ({
        pageId: m.pageId,
        pageName: m.pageName,
        adAccountId: m.adAccountId,
      })),
      conversoesMeta: resumoConversoesMeta(comDataset),
      totalLeads: imob._count.leads,
      totalCorretores: imob._count.corretores,
      totalUsuarios: imob._count.usuarios,
      diasRestantes,
      statusPlano: calcStatusPlano(imob.plano, imob.trialExpiraEm),
    };
  });

  res.json(resultado);
}

// ── atualizarPlano ────────────────────────────────────────────────────────────

async function atualizarPlano(req, res) {
  const { id } = req.params;
  const { plano, planoExpiraEm, diasExtender } = req.body;

  if (!VALID_PLANOS.includes(plano)) {
    return res.status(400).json({ error: `Plano inválido. Use: ${VALID_PLANOS.join(', ')}` });
  }

  const imobiliaria = await prisma.imobiliaria.findUnique({ where: { id } });
  if (!imobiliaria) {
    return res.status(404).json({ error: 'Imobiliária não encontrada' });
  }

  // Ao trocar plano, limpa bloqueio e notificação (exceto cancelado, que bloqueia)
  const data = { plano, planoBloqueadoEm: null, notificacaoVencimento: false };

  if (plano === 'trial') {
    const dias = Number.isInteger(diasExtender) && diasExtender > 0 ? diasExtender : 7;
    data.trialExpiraEm = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);
    data.planoExpiraEm = null;
  } else if (['construcao', 'desenvolvimento', 'sucesso'].includes(plano)) {
    data.planoExpiraEm = planoExpiraEm
      ? new Date(planoExpiraEm)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    data.trialExpiraEm = null;
  } else if (plano === 'legado') {
    data.planoExpiraEm = null;
    data.trialExpiraEm = null;
  } else if (plano === 'cancelado') {
    data.planoBloqueadoEm = new Date(); // bloqueia imediatamente
    data.planoExpiraEm = null;
    data.trialExpiraEm = null;
  }

  // Cancelado mantém as permissões e o limite de acessos como estavam — só bloqueia o acesso.
  if (plano !== 'cancelado') {
    data.permissoes = PERMISSOES_POR_PLANO[plano].permissoes;
    data.limiteAcessos = PERMISSOES_POR_PLANO[plano].limiteAcessos;
  }

  const atualizado = await prisma.imobiliaria.update({ where: { id }, data });
  res.json({
    id: atualizado.id,
    nome: atualizado.nome,
    plano: atualizado.plano,
    trialExpiraEm: atualizado.trialExpiraEm,
    planoExpiraEm: atualizado.planoExpiraEm,
    planoBloqueadoEm: atualizado.planoBloqueadoEm,
  });
}

// ── atualizarPermissoes ───────────────────────────────────────────────────────

async function atualizarPermissoes(req, res) {
  const { id } = req.params;
  const { permissoes } = req.body;

  if (!permissoes || typeof permissoes !== 'object' || Array.isArray(permissoes)) {
    return res.status(400).json({ error: 'Campo permissoes deve ser um objeto' });
  }

  const imobiliaria = await prisma.imobiliaria.findUnique({ where: { id } });
  if (!imobiliaria) return res.status(404).json({ error: 'Imobiliária não encontrada' });

  const atualizado = await prisma.imobiliaria.update({
    where: { id },
    data: { permissoes },
  });
  res.json({ id: atualizado.id, permissoes: atualizado.permissoes });
}

// ── atualizarLimiteAcessos ────────────────────────────────────────────────────

async function atualizarLimiteAcessos(req, res) {
  const { id } = req.params;
  const { limiteAcessos } = req.body;

  if (!Number.isInteger(limiteAcessos) || limiteAcessos < 1) {
    return res.status(400).json({ error: 'limiteAcessos deve ser um inteiro >= 1' });
  }

  const imobiliaria = await prisma.imobiliaria.findUnique({ where: { id } });
  if (!imobiliaria) return res.status(404).json({ error: 'Imobiliária não encontrada' });

  const atualizado = await prisma.imobiliaria.update({
    where: { id },
    data: { limiteAcessos },
  });
  res.json({ id: atualizado.id, limiteAcessos: atualizado.limiteAcessos });
}

// ── atualizarAdAccount ────────────────────────────────────────────────────────

async function atualizarAdAccount(req, res) {
  const { id, pageId } = req.params;
  const { adAccountId } = req.body;

  if (typeof adAccountId !== 'string' || !adAccountId.trim()) {
    return res.status(400).json({ error: 'ID de conta de anúncios inválido' });
  }

  const digitos = adAccountId.trim().replace(/^act_/, '');
  if (!/^\d+$/.test(digitos)) {
    return res.status(400).json({ error: 'ID de conta de anúncios inválido' });
  }
  const normalizado = `act_${digitos}`;

  const imobiliaria = await prisma.imobiliaria.findUnique({ where: { id } });
  if (!imobiliaria) return res.status(404).json({ error: 'Imobiliária não encontrada' });

  const integracao = await prisma.metaIntegracao.findUnique({ where: { pageId } });
  if (!integracao || integracao.imobiliariaId !== id) {
    return res.status(400).json({ error: 'Página não encontrada para esta imobiliária' });
  }

  const atualizado = await prisma.metaIntegracao.update({
    where: { pageId },
    data: { adAccountId: normalizado },
  });

  res.json({ id: atualizado.imobiliariaId, pageId: atualizado.pageId, adAccountId: atualizado.adAccountId });
}

// ── atualizarConversoesMeta ───────────────────────────────────────────────────

// O token nunca sai do servidor — o painel só sabe se ele está configurado.
// modoTeste vem resolvido (painel ou variável de ambiente, mesma precedência do envio): código de
// teste esquecido é falha silenciosa, os eventos param de contar pra otimização, então o painel
// precisa mostrar mesmo quando quem ligou foi a META_CAPI_TEST_EVENT_CODE.
function resumoConversoesMeta(integracao) {
  if (!integracao?.metaDatasetId) return null;
  const codigo = codigoTeste(integracao);
  return {
    pageId: integracao.pageId,
    metaDatasetId: integracao.metaDatasetId,
    metaDatasetTokenConfigurado: !!integracao.metaDatasetToken,
    metaEtapaQualificada: integracao.metaEtapaQualificada,
    metaTestEventCode: integracao.metaTestEventCode,
    modoTeste: codigo ? { codigo, origem: integracao.metaTestEventCode ? 'painel' : 'variavel' } : null,
  };
}

// API de Conversões para CRM: configuração por imobiliária. Só uma integração da imobiliária pode ter
// dataset — salvar numa página limpa as demais. Só os leads dessa página (Lead.metaPageId) são enviados.
// pageId vazio desliga o envio. Token vazio mantém o já salvo. Código de teste vazio = produção.
async function atualizarConversoesMeta(req, res) {
  const { id } = req.params;
  const { pageId, metaDatasetId, metaDatasetToken, metaEtapaQualificada, metaTestEventCode } = req.body;

  const imobiliaria = await prisma.imobiliaria.findUnique({ where: { id } });
  if (!imobiliaria) return res.status(404).json({ error: 'Imobiliária não encontrada' });

  const integracoes = await prisma.metaIntegracao.findMany({ where: { imobiliariaId: id } });

  if (!pageId) {
    await prisma.metaIntegracao.updateMany({
      where: { imobiliariaId: id },
      data: { metaDatasetId: null, metaDatasetToken: null, metaTestEventCode: null },
    });
    console.log(`[admin] conversões Meta desativadas — imobiliaria=${id}`);
    return res.json({ conversoesMeta: null });
  }

  const alvo = integracoes.find((m) => m.pageId === pageId);
  if (!alvo) return res.status(400).json({ error: 'Página não encontrada para esta imobiliária' });

  const datasetId = typeof metaDatasetId === 'string' ? metaDatasetId.trim() : '';
  if (!/^\d+$/.test(datasetId)) return res.status(400).json({ error: 'ID do dataset inválido' });

  if (!ETAPAS_QUALIFICAVEIS.includes(metaEtapaQualificada)) {
    return res.status(400).json({
      error: `Etapa qualificada inválida. Valores aceitos: ${ETAPAS_QUALIFICAVEIS.join(', ')}`,
    });
  }

  const tokenNovo = typeof metaDatasetToken === 'string' ? metaDatasetToken.trim() : '';
  const token = tokenNovo || integracoes.find((m) => m.metaDatasetToken)?.metaDatasetToken;
  if (!token) return res.status(400).json({ error: 'Token do dataset obrigatório' });

  const testEventCode = typeof metaTestEventCode === 'string' && metaTestEventCode.trim()
    ? metaTestEventCode.trim()
    : null;

  const atualizado = await prisma.$transaction(async (tx) => {
    await tx.metaIntegracao.updateMany({
      where: { imobiliariaId: id, id: { not: alvo.id } },
      data: { metaDatasetId: null, metaDatasetToken: null, metaTestEventCode: null },
    });
    return tx.metaIntegracao.update({
      where: { id: alvo.id },
      data: { metaDatasetId: datasetId, metaDatasetToken: token, metaEtapaQualificada, metaTestEventCode: testEventCode },
    });
  });

  console.log(
    `[admin] conversões Meta configuradas — imobiliaria=${id} page=${pageId} dataset=${datasetId} `
    + `etapaQualificada=${metaEtapaQualificada} token=${tokenNovo ? 'novo' : 'mantido'} `
    + `modo=${testEventCode ? `teste (${testEventCode})` : 'produção'}`,
  );

  res.json({ conversoesMeta: resumoConversoesMeta(atualizado) });
}

// ── atualizarValorCobranca ────────────────────────────────────────────────────

async function atualizarValorCobranca(req, res) {
  const { id } = req.params;
  const { valorCobrancaPersonalizado } = req.body;

  if (
    valorCobrancaPersonalizado !== null &&
    (typeof valorCobrancaPersonalizado !== 'number' || !Number.isFinite(valorCobrancaPersonalizado) || valorCobrancaPersonalizado < 0)
  ) {
    return res.status(400).json({ error: 'valorCobrancaPersonalizado deve ser um número >= 0 ou null' });
  }

  const imobiliaria = await prisma.imobiliaria.findUnique({ where: { id } });
  if (!imobiliaria) return res.status(404).json({ error: 'Imobiliária não encontrada' });

  const atualizado = await prisma.imobiliaria.update({
    where: { id },
    data: { valorCobrancaPersonalizado },
  });
  res.json({
    id: atualizado.id,
    valorCobrancaPersonalizado: atualizado.valorCobrancaPersonalizado != null ? Number(atualizado.valorCobrancaPersonalizado) : null,
  });
}

// ── atualizarFranquiaAgente ───────────────────────────────────────────────────
// Franquia de leads do agente de IA, valor do lead excedente e dia do ciclo de
// faturamento. Os três são opcionais: null = sem definição. Só os campos
// presentes no body são alterados.

async function atualizarFranquiaAgente(req, res) {
  const { id } = req.params;
  const { franquiaLeadsAgente, valorLeadExcedente, diaCicloFaturamento } = req.body;
  const data = {};

  if (franquiaLeadsAgente !== undefined) {
    if (franquiaLeadsAgente !== null && (!Number.isInteger(franquiaLeadsAgente) || franquiaLeadsAgente < 1)) {
      return res.status(400).json({ error: 'franquiaLeadsAgente deve ser um inteiro >= 1 ou null' });
    }
    data.franquiaLeadsAgente = franquiaLeadsAgente;
  }

  if (valorLeadExcedente !== undefined) {
    if (
      valorLeadExcedente !== null &&
      (typeof valorLeadExcedente !== 'number' || !Number.isFinite(valorLeadExcedente) || valorLeadExcedente < 0)
    ) {
      return res.status(400).json({ error: 'valorLeadExcedente deve ser um número >= 0 ou null' });
    }
    data.valorLeadExcedente = valorLeadExcedente;
  }

  if (diaCicloFaturamento !== undefined) {
    if (
      diaCicloFaturamento !== null &&
      (!Number.isInteger(diaCicloFaturamento) || diaCicloFaturamento < 1 || diaCicloFaturamento > 31)
    ) {
      return res.status(400).json({ error: 'diaCicloFaturamento deve ser um inteiro entre 1 e 31 ou null' });
    }
    data.diaCicloFaturamento = diaCicloFaturamento;
  }

  const imobiliaria = await prisma.imobiliaria.findUnique({ where: { id }, select: { id: true } });
  if (!imobiliaria) return res.status(404).json({ error: 'Imobiliária não encontrada' });

  const atualizado = await prisma.imobiliaria.update({
    where: { id },
    data,
    select: { id: true, franquiaLeadsAgente: true, valorLeadExcedente: true, diaCicloFaturamento: true },
  });
  res.json({
    ...atualizado,
    valorLeadExcedente: atualizado.valorLeadExcedente != null ? Number(atualizado.valorLeadExcedente) : null,
  });
}

// ── relatorioConsumoAgente ────────────────────────────────────────────────────
// Relatório de faturamento do excedente: consumo do agente de IA de cada
// imobiliária no ciclo atual dela (cada uma tem o seu dia de renovação).
// Só leitura — mesmo cálculo do card do dashboard do gestor.

async function relatorioConsumoAgente(req, res) {
  const imobiliarias = await prisma.imobiliaria.findMany({
    select: { ...SELECT_CONSUMO, nome: true },
    orderBy: { nome: 'asc' },
  });

  const agora = new Date();
  const linhas = await Promise.all(imobiliarias.map(async (imob) => ({
    id: imob.id,
    nome: imob.nome,
    plano: imob.plano,
    agenteIA: temAgenteIA(imob.permissoes),
    diaCicloFaturamento: imob.diaCicloFaturamento,
    diaCicloEfetivo: resolverDiaCiclo(imob),
    ...(await calcularConsumo(imob, agora)),
  })));

  linhas.sort((a, b) =>
    (b.valorExcedente ?? 0) - (a.valorExcedente ?? 0)
    || b.excedente - a.excedente
    || (b.percentual ?? -1) - (a.percentual ?? -1)
    || b.consumido - a.consumido);

  res.json(linhas);
}

// ── listarCobrancas ───────────────────────────────────────────────────────────

async function listarCobrancas(req, res) {
  const cobrancas = await prisma.cobranca.findMany({
    select: {
      id: true,
      valor: true,
      plano: true,
      statusEntrega: true,
      statusEntregaEm: true,
      criadoEm: true,
      imobiliaria: { select: { id: true, nome: true } },
    },
    orderBy: { criadoEm: 'desc' },
    take: 200,
  });
  res.json(cobrancas.map((c) => ({ ...c, valor: Number(c.valor) })));
}

// ── getPlanoCliente ───────────────────────────────────────────────────────────

async function getPlanoCliente(req, res) {
  const { id } = req.params;
  const imobiliaria = await prisma.imobiliaria.findUnique({
    where: { id },
    select: {
      id: true, nome: true, plano: true, trialExpiraEm: true,
      planoExpiraEm: true, planoBloqueadoEm: true,
      notificacaoVencimento: true, criadoEm: true,
      permissoes: true, limiteAcessos: true,
    },
  });
  if (!imobiliaria) return res.status(404).json({ error: 'Imobiliária não encontrada' });

  const agora = new Date();
  let expiraEm = null;
  let diasRestantes = null;

  if (imobiliaria.plano === 'trial') {
    expiraEm = imobiliaria.trialExpiraEm
      ? new Date(imobiliaria.trialExpiraEm)
      : new Date(new Date(imobiliaria.criadoEm).getTime() + 7 * 24 * 60 * 60 * 1000);
    diasRestantes = Math.max(0, Math.ceil((expiraEm - agora) / (1000 * 60 * 60 * 24)));
  } else if (imobiliaria.planoExpiraEm) {
    expiraEm = new Date(imobiliaria.planoExpiraEm);
    diasRestantes = Math.max(0, Math.ceil((expiraEm - agora) / (1000 * 60 * 60 * 24)));
  }

  res.json({
    id: imobiliaria.id,
    nome: imobiliaria.nome,
    plano: imobiliaria.plano,
    trialExpiraEm: imobiliaria.trialExpiraEm,
    planoExpiraEm: imobiliaria.planoExpiraEm,
    planoBloqueadoEm: imobiliaria.planoBloqueadoEm,
    notificacaoVencimento: imobiliaria.notificacaoVencimento,
    permissoes: imobiliaria.permissoes,
    limiteAcessos: imobiliaria.limiteAcessos,
    expiraEm: expiraEm ? expiraEm.toISOString() : null,
    diasRestantes,
    bloqueado: !!imobiliaria.planoBloqueadoEm,
  });
}

// ── criarCliente ──────────────────────────────────────────────────────────────

async function criarCliente(req, res) {
  const { nomeImobiliaria, nomeGestor, emailGestor, senhaInicial } = req.body;

  if (!nomeImobiliaria || !nomeGestor || !emailGestor || !senhaInicial) {
    return res.status(400).json({
      error: 'Campos obrigatórios: nomeImobiliaria, nomeGestor, emailGestor, senhaInicial',
    });
  }
  if (senhaInicial.length < 6) {
    return res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres' });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailGestor)) {
    return res.status(400).json({ error: 'Email inválido' });
  }

  const emailExiste = await prisma.usuario.findUnique({ where: { email: emailGestor } });
  if (emailExiste) {
    return res.status(409).json({ error: 'Email já cadastrado' });
  }

  const senhaHash = await bcrypt.hash(senhaInicial, 12);
  const trialExpiraEm = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const result = await prisma.$transaction(async (tx) => {
    const imobiliaria = await tx.imobiliaria.create({
      data: {
        nome: nomeImobiliaria,
        email: emailGestor,
        plano: 'trial',
        trialExpiraEm,
        apiKey: gerarApiKey(),
        permissoes: PERMISSOES_POR_PLANO.trial.permissoes,
        limiteAcessos: PERMISSOES_POR_PLANO.trial.limiteAcessos,
      },
    });

    const usuario = await tx.usuario.create({
      data: {
        nome: nomeGestor,
        email: emailGestor,
        senhaHash,
        role: 'gestor',
        imobiliariaId: imobiliaria.id,
      },
    });

    await tx.configAgente.create({
      data: { imobiliariaId: imobiliaria.id, perguntas: PERGUNTAS_PADRAO },
    });

    await tx.modeloMensagem.createMany({
      data: [
        {
          nome: 'Reativação Geral',
          conteudo: `Olá, {{nome}}! Tudo bem? Aqui é da ${nomeImobiliaria}. Percebemos que você demonstrou interesse em nossos imóveis e gostaríamos de saber se ainda podemos te ajudar. 😊`,
          imobiliariaId: imobiliaria.id,
        },
        {
          nome: 'Promoção / Lançamento',
          conteudo: `Olá, {{nome}}! 👋 Temos um lançamento imperdível que pode ser exatamente o que você procura. Posso te enviar mais detalhes?`,
          imobiliariaId: imobiliaria.id,
        },
        {
          nome: 'Follow-up Simples',
          conteudo: `Oi, {{nome}}! Como você está? Passando para saber se ficou com alguma dúvida sobre os imóveis que conversamos. Estou à disposição! 🏠`,
          imobiliariaId: imobiliaria.id,
        },
      ],
    });

    await tx.whatsappInstancia.create({
      data: { imobiliariaId: imobiliaria.id },
    });

    return { imobiliaria, usuario };
  });

  res.status(201).json({
    id: result.imobiliaria.id,
    nome: result.imobiliaria.nome,
    email: result.imobiliaria.email,
    plano: result.imobiliaria.plano,
    trialExpiraEm: result.imobiliaria.trialExpiraEm,
    statusPlano: 'trial_ativo',
    gestor: {
      id: result.usuario.id,
      nome: result.usuario.nome,
      email: result.usuario.email,
    },
  });
}

// ── getStats ──────────────────────────────────────────────────────────────────

async function getStats(req, res) {
  const agora = new Date();
  const em7Dias = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [totalClientes, clientesAtivos, trialsExpirando, totalLeads] = await prisma.$transaction([
    prisma.imobiliaria.count(),
    prisma.imobiliaria.count({
      where: { plano: { in: ['construcao', 'desenvolvimento', 'sucesso'] } },
    }),
    prisma.imobiliaria.count({
      where: { plano: 'trial', trialExpiraEm: { gte: agora, lte: em7Dias } },
    }),
    prisma.lead.count(),
  ]);

  res.json({
    totalClientes,
    clientesAtivos,
    trialsExpirando7dias: trialsExpirando,
    totalLeads,
  });
}

module.exports = {
  listarClientes,
  atualizarPlano,
  atualizarPermissoes,
  atualizarLimiteAcessos,
  atualizarAdAccount,
  atualizarConversoesMeta,
  atualizarValorCobranca,
  atualizarFranquiaAgente,
  relatorioConsumoAgente,
  listarCobrancas,
  getPlanoCliente,
  criarCliente,
  getStats,
};
