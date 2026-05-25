const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const prisma = require('../lib/prisma');

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

function gerarApiKey() {
  return crypto.randomBytes(32).toString('hex');
}

function calcStatusPlano(plano, trialExpiraEm) {
  if (plano === 'ativo') return 'ativo';
  if (plano === 'cancelado') return 'cancelado';
  if (plano === 'trial') {
    return trialExpiraEm && new Date() <= new Date(trialExpiraEm)
      ? 'trial_ativo'
      : 'trial_expirado';
  }
  return plano;
}

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
      criadoEm: true,
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
  const resultado = imobiliarias.map(imob => {
    const diasRestantes =
      imob.trialExpiraEm
        ? Math.max(0, Math.ceil((new Date(imob.trialExpiraEm) - agora) / (1000 * 60 * 60 * 24)))
        : null;

    return {
      id: imob.id,
      nome: imob.nome,
      email: imob.email,
      plano: imob.plano,
      trialExpiraEm: imob.trialExpiraEm,
      criadoEm: imob.criadoEm,
      totalLeads: imob._count.leads,
      totalCorretores: imob._count.corretores,
      totalUsuarios: imob._count.usuarios,
      diasRestantes,
      statusPlano: calcStatusPlano(imob.plano, imob.trialExpiraEm),
    };
  });

  res.json(resultado);
}

async function atualizarPlano(req, res) {
  const { id } = req.params;
  const { plano, planoExpiraEm, diasExtender } = req.body;

  const validPlanos = ['trial', 'gratuito', 'starter', 'pro', 'legado', 'cancelado'];
  if (!validPlanos.includes(plano)) {
    return res.status(400).json({ error: `Plano inválido. Use: ${validPlanos.join(', ')}` });
  }

  const imobiliaria = await prisma.imobiliaria.findUnique({ where: { id } });
  if (!imobiliaria) {
    return res.status(404).json({ error: 'Imobiliária não encontrada' });
  }

  // Ao atualizar plano pelo admin, sempre limpa o bloqueio
  const data = { plano, planoBloqueadoEm: null, notificacaoVencimento: false };

  if (plano === 'trial') {
    const dias = diasExtender && Number.isInteger(diasExtender) && diasExtender > 0
      ? diasExtender : 7;
    data.trialExpiraEm = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);
    data.planoExpiraEm = null;
  } else if (['gratuito', 'starter', 'pro'].includes(plano)) {
    data.planoExpiraEm = planoExpiraEm
      ? new Date(planoExpiraEm)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    data.trialExpiraEm = null;
  } else if (plano === 'legado') {
    data.planoExpiraEm = null;
    data.trialExpiraEm = null;
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

async function getPlanoCliente(req, res) {
  const { id } = req.params;
  const imobiliaria = await prisma.imobiliaria.findUnique({
    where: { id },
    select: {
      id: true, nome: true, plano: true, trialExpiraEm: true,
      planoExpiraEm: true, planoBloqueadoEm: true,
      notificacaoVencimento: true, criadoEm: true,
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
    expiraEm: expiraEm ? expiraEm.toISOString() : null,
    diasRestantes,
    bloqueado: !!imobiliaria.planoBloqueadoEm,
  });
}

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
      data: {
        imobiliariaId: imobiliaria.id,
        perguntas: PERGUNTAS_PADRAO,
      },
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

async function getStats(req, res) {
  const agora = new Date();
  const em7Dias = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [totalClientes, clientesAtivos, trialsExpirando, totalLeads] = await prisma.$transaction([
    prisma.imobiliaria.count(),
    prisma.imobiliaria.count({ where: { plano: 'ativo' } }),
    prisma.imobiliaria.count({
      where: {
        plano: 'trial',
        trialExpiraEm: { gte: agora, lte: em7Dias },
      },
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

module.exports = { listarClientes, atualizarPlano, getPlanoCliente, criarCliente, getStats };
