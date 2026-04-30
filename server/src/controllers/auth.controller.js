const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function gerarApiKey() {
  return crypto.randomBytes(32).toString('hex');
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

  const result = await prisma.$transaction(async (tx) => {
    const imobiliaria = await tx.imobiliaria.create({
      data: {
        nome: nomeImobiliaria,
        email,
        telefone: telefone || null,
        plano: 'trial',
        trialExpiraEm,
        apiKey: gerarApiKey(),
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

    return { imobiliaria, usuario };
  });

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
        select: { id: true, nome: true, plano: true, trialExpiraEm: true },
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
      imobiliariaId: usuario.imobiliariaId,
      imobiliaria: usuario.imobiliaria,
    },
  });
}

async function me(req, res) {
  const usuario = await prisma.usuario.findUnique({
    where: { id: req.usuario.id },
    include: {
      imobiliaria: {
        select: { id: true, nome: true, email: true, telefone: true, logoUrl: true, plano: true, trialExpiraEm: true, apiKey: true },
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
    imobiliariaId: usuario.imobiliariaId,
    imobiliaria: usuario.imobiliaria,
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

module.exports = { register, login, me, alterarSenha };
