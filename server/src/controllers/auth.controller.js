const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const prisma = require('../lib/prisma');

function gerarApiKey() {
  return crypto.randomBytes(32).toString('hex');
}

function calcPlanoInfo(imob) {
  if (!imob) return null;
  const agora = new Date();
  const plano = imob.plano;
  let expiraEm = null;
  let diasParaVencer = null;
  if (imob.planoExpiraEm) {
    expiraEm = new Date(imob.planoExpiraEm);
    diasParaVencer = Math.max(0, Math.ceil((expiraEm - agora) / (1000 * 60 * 60 * 24)));
  } else if (plano === 'trial') {
    expiraEm = imob.trialExpiraEm
      ? new Date(imob.trialExpiraEm)
      : new Date(new Date(imob.criadoEm).getTime() + 7 * 24 * 60 * 60 * 1000);
    diasParaVencer = Math.max(0, Math.ceil((expiraEm - agora) / (1000 * 60 * 60 * 24)));
  }
  const bloqueado = !!imob.planoBloqueadoEm;
  const avisoVencimento = !bloqueado && diasParaVencer !== null && diasParaVencer <= 3;
  return {
    plano,
    trialExpiraEm: imob.trialExpiraEm || null,
    planoExpiraEm: imob.planoExpiraEm || null,
    planoBloqueadoEm: imob.planoBloqueadoEm || null,
    expiraEm: expiraEm ? expiraEm.toISOString() : null,
    diasParaVencer,
    avisoVencimento,
    bloqueado,
    permissoes: imob.permissoes || {},
  };
}

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

// Trial = acesso total por 7 dias
const PERMISSOES_TRIAL = {
  importacaoListas:          true,
  gestaoImoveis:             true,
  arquivosImovel:            true,
  apresentacaoPersonalizada: true,
  tourVirtual:               true,
  painelCampanhas:           true,
  relatorios:                true,
  followUpAutomatico:        true,
  agenteIA:                  true,
  chatLead:                  true,
  multiplosWhatsapp:         true,
};

async function register(req, res) {
  const { nomeImobiliaria, nomeUsuario, email, senha, telefone } = req.body;

  if (!nomeImobiliaria || !nomeUsuario || !email || !senha) {
    return res.status(400).json({ error: 'Campos obrigatórios: nomeImobiliaria, nomeUsuario, email, senha' });
  }

  if (senha.length < 6) {
    return res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Email inválido' });
  }

  const usuarioExistente = await prisma.usuario.findUnique({ where: { email } });
  if (usuarioExistente) {
    return res.status(409).json({ error: 'Email já cadastrado' });
  }

  const senhaHash = await bcrypt.hash(senha, 12);
  const trialExpiraEm = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  let result;
  try {
  result = await prisma.$transaction(async (tx) => {
    const imobiliaria = await tx.imobiliaria.create({
      data: {
        nome: nomeImobiliaria,
        email,
        telefone: telefone || null,
        plano: 'trial',
        trialExpiraEm,
        apiKey: gerarApiKey(),
        permissoes: PERMISSOES_TRIAL,
        limiteAcessos: 25,
      },
    });

    const usuario = await tx.usuario.create({
      data: {
        nome: nomeUsuario,
        email,
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
          conteudo: `Olá, {{nome}}! Tudo bem? Aqui é da ${nomeImobiliaria}. Percebemos que você demonstrou interesse em nossos imóveis e gostaríamos de saber se ainda podemos te ajudar. Temos ótimas oportunidades disponíveis! 😊`,
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
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Email já cadastrado' });
    }
    throw err;
  }

  const token = jwt.sign(
    { userId: result.usuario.id, imobiliariaId: result.imobiliaria.id, role: 'gestor' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  res.status(201).json({
    token,
    usuario: {
      id: result.usuario.id,
      nome: result.usuario.nome,
      email: result.usuario.email,
      role: result.usuario.role,
      imobiliariaId: result.imobiliaria.id,
      imobiliaria: {
        id: result.imobiliaria.id,
        nome: result.imobiliaria.nome,
        plano: result.imobiliaria.plano,
        trialExpiraEm: result.imobiliaria.trialExpiraEm,
        apiKey: result.imobiliaria.apiKey,
      },
    },
  });
}

async function login(req, res) {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  }

  const usuario = await prisma.usuario.findUnique({
    where: { email },
    include: {
      imobiliaria: {
        select: { id: true, nome: true, plano: true, trialExpiraEm: true, planoExpiraEm: true, planoBloqueadoEm: true, criadoEm: true, permissoes: true },
      },
    },
  });

  if (!usuario || !usuario.ativo) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const senhaValida = await bcrypt.compare(senha, usuario.senhaHash);
  if (!senhaValida) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const token = jwt.sign(
    { userId: usuario.id, imobiliariaId: usuario.imobiliariaId, role: usuario.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  res.json({
    token,
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      role: usuario.role,
      fotoPerfil: usuario.fotoPerfil || null,
      imobiliariaId: usuario.imobiliariaId,
      imobiliaria: usuario.imobiliaria,
      planoInfo: calcPlanoInfo(usuario.imobiliaria),
    },
  });
}

async function loginSupremo(req, res) {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  }

  const supremo = await prisma.usuarioSupremo.findUnique({ where: { email } });
  if (!supremo || !supremo.ativo) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const senhaValida = await bcrypt.compare(senha, supremo.senhaHash);
  if (!senhaValida) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const token = jwt.sign(
    { userId: supremo.id, role: 'supremo' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  res.json({
    token,
    usuario: {
      id: supremo.id,
      nome: supremo.nome,
      email: supremo.email,
      role: 'supremo',
    },
  });
}

async function setupSupremo(req, res) {
  const { secret, nome, email, senha } = req.body;

  if (!process.env.SUPREMO_SETUP_SECRET || secret !== process.env.SUPREMO_SETUP_SECRET) {
    return res.status(403).json({ error: 'Secret inválido' });
  }

  if (!nome || !email || !senha) {
    return res.status(400).json({ error: 'Campos obrigatórios: nome, email, senha' });
  }

  if (senha.length < 8) {
    return res.status(400).json({ error: 'A senha deve ter no mínimo 8 caracteres' });
  }

  const existe = await prisma.usuarioSupremo.findFirst();
  if (existe) {
    return res.status(409).json({ error: 'Usuário supremo já existe' });
  }

  const senhaHash = await bcrypt.hash(senha, 12);
  const supremo = await prisma.usuarioSupremo.create({
    data: { nome, email, senhaHash },
  });

  res.status(201).json({ id: supremo.id, nome: supremo.nome, email: supremo.email });
}

async function me(req, res) {
  if (req.role === 'supremo') {
    const supremo = await prisma.usuarioSupremo.findUnique({
      where: { id: req.usuario.id },
    });
    if (!supremo) return res.status(404).json({ error: 'Usuário não encontrado' });
    return res.json({
      id: supremo.id,
      nome: supremo.nome,
      email: supremo.email,
      role: 'supremo',
      fotoPerfil: null,
      imobiliariaId: null,
      imobiliaria: null,
    });
  }

  if (req.role === 'corretor' || req.role === 'gerente') {
    const corretor = await prisma.corretor.findUnique({
      where: { id: req.corretorId },
      include: {
        imobiliaria: {
          select: { id: true, nome: true, plano: true, trialExpiraEm: true, planoExpiraEm: true, planoBloqueadoEm: true, criadoEm: true, permissoes: true },
        },
      },
    });

    if (!corretor) return res.status(404).json({ error: 'Corretor não encontrado' });

    return res.json({
      id: corretor.id,
      nome: corretor.nome,
      email: corretor.email,
      role: corretor.role || 'corretor',
      fotoPerfil: corretor.fotoPerfil || null,
      imobiliariaId: corretor.imobiliariaId,
      imobiliaria: corretor.imobiliaria,
      equipeId: req.equipeId || null,
      planoInfo: calcPlanoInfo(corretor.imobiliaria),
    });
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: req.usuario.id },
    include: {
      imobiliaria: {
        select: { id: true, nome: true, email: true, telefone: true, logoUrl: true, plano: true, trialExpiraEm: true, planoExpiraEm: true, planoBloqueadoEm: true, criadoEm: true, apiKey: true, permissoes: true },
      },
    },
  });

  if (!usuario) {
    return res.status(404).json({ error: 'Usuário não encontrado' });
  }

  res.json({
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    role: usuario.role,
    fotoPerfil: usuario.fotoPerfil || null,
    imobiliariaId: usuario.imobiliariaId,
    imobiliaria: usuario.imobiliaria,
    planoInfo: calcPlanoInfo(usuario.imobiliaria),
  });
}

async function alterarSenha(req, res) {
  const { senhaAtual, novaSenha } = req.body;

  if (!senhaAtual || !novaSenha) {
    return res.status(400).json({ error: 'senhaAtual e novaSenha são obrigatórios' });
  }

  if (novaSenha.length < 6) {
    return res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres' });
  }

  const usuario = await prisma.usuario.findUnique({ where: { id: req.usuario.id } });
  if (!usuario) return res.status(404).json({ error: 'Usuário não encontrado' });

  const senhaValida = await bcrypt.compare(senhaAtual, usuario.senhaHash);
  if (!senhaValida) {
    return res.status(401).json({ error: 'Senha atual incorreta' });
  }

  const novaSenhaHash = await bcrypt.hash(novaSenha, 12);

  await prisma.usuario.update({
    where: { id: req.usuario.id },
    data: { senhaHash: novaSenhaHash },
  });

  res.json({ message: 'Senha alterada com sucesso' });
}

async function loginCorretor(req, res) {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  }

  const corretor = await prisma.corretor.findFirst({
    where: { email, ativo: true, usuarioAtivo: true },
    include: {
      imobiliaria: {
        select: { id: true, nome: true, plano: true, trialExpiraEm: true, planoExpiraEm: true, planoBloqueadoEm: true, criadoEm: true, permissoes: true },
      },
    },
  });

  if (!corretor || !corretor.senhaHash) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const senhaValida = await bcrypt.compare(senha, corretor.senhaHash);
  if (!senhaValida) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const roleCorretor = corretor.role || 'corretor';
  let equipeId = null;

  if (roleCorretor === 'gerente') {
    const equipe = await prisma.equipe.findFirst({
      where: { liderId: corretor.id, imobiliariaId: corretor.imobiliariaId, ativo: true },
      select: { id: true },
    });
    equipeId = equipe?.id || null;
  }

  const token = jwt.sign(
    {
      corretorId: corretor.id,
      imobiliariaId: corretor.imobiliariaId,
      role: roleCorretor,
      ...(equipeId && { equipeId }),
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  res.json({
    token,
    corretor: {
      id: corretor.id,
      nome: corretor.nome,
      email: corretor.email,
      role: roleCorretor,
      fotoPerfil: corretor.fotoPerfil || null,
      imobiliariaId: corretor.imobiliariaId,
      imobiliaria: corretor.imobiliaria,
      planoInfo: calcPlanoInfo(corretor.imobiliaria),
      ...(equipeId && { equipeId }),
    },
  });
}

async function alterarSenhaCorretor(req, res) {
  const { senhaAtual, novaSenha } = req.body;

  if (!senhaAtual || !novaSenha) {
    return res.status(400).json({ error: 'senhaAtual e novaSenha são obrigatórios' });
  }

  if (novaSenha.length < 6) {
    return res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres' });
  }

  const corretor = await prisma.corretor.findUnique({ where: { id: req.corretorId } });
  if (!corretor || !corretor.senhaHash) {
    return res.status(401).json({ error: 'Corretor não encontrado' });
  }

  const senhaValida = await bcrypt.compare(senhaAtual, corretor.senhaHash);
  if (!senhaValida) {
    return res.status(401).json({ error: 'Senha atual incorreta' });
  }

  const novaSenhaHash = await bcrypt.hash(novaSenha, 12);
  await prisma.corretor.update({ where: { id: req.corretorId }, data: { senhaHash: novaSenhaHash } });

  res.json({ message: 'Senha alterada com sucesso' });
}

async function atualizarFotoPerfilGestor(req, res) {
  const { fotoPerfil } = req.body;
  if (!fotoPerfil || !fotoPerfil.startsWith('data:image/')) {
    return res.status(400).json({ error: 'Foto inválida' });
  }
  await prisma.usuario.update({ where: { id: req.usuario.id }, data: { fotoPerfil } });
  res.json({ ok: true });
}

async function atualizarFotoPerfilCorretor(req, res) {
  const { fotoPerfil } = req.body;
  if (!fotoPerfil || !fotoPerfil.startsWith('data:image/')) {
    return res.status(400).json({ error: 'Foto inválida' });
  }
  await prisma.corretor.update({ where: { id: req.corretorId }, data: { fotoPerfil } });
  res.json({ ok: true });
}

module.exports = { register, login, me, alterarSenha, loginCorretor, alterarSenhaCorretor, atualizarFotoPerfilGestor, atualizarFotoPerfilCorretor, loginSupremo, setupSupremo };
