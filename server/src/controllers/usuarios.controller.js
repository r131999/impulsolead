const bcrypt = require('bcryptjs');

const prisma = require('../lib/prisma');

const SELECT_USUARIO = {
  id: true, nome: true, email: true, role: true,
  ativo: true, telefone: true, fotoPerfil: true, criadoEm: true,
};

async function buscarPrincipalId(imobiliariaId) {
  const p = await prisma.usuario.findFirst({
    where: { imobiliariaId },
    orderBy: { criadoEm: 'asc' },
    select: { id: true },
  });
  return p?.id ?? null;
}

async function listar(req, res) {
  const usuarios = await prisma.usuario.findMany({
    where: { imobiliariaId: req.imobiliariaId },
    select: SELECT_USUARIO,
    orderBy: { criadoEm: 'asc' },
  });
  res.json({ usuarios });
}

async function criar(req, res) {
  const { nome, email, senha } = req.body;

  if (!nome?.trim() || !email?.trim() || !senha) {
    return res.status(400).json({ error: 'nome, email e senha são obrigatórios' });
  }
  if (senha.length < 6) {
    return res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Email inválido' });
  }

  const existe = await prisma.usuario.findUnique({ where: { email } });
  if (existe) return res.status(409).json({ error: 'Email já cadastrado' });

  const senhaHash = await bcrypt.hash(senha, 12);
  const usuario = await prisma.usuario.create({
    data: { nome: nome.trim(), email: email.trim(), senhaHash, role: 'gestor', imobiliariaId: req.imobiliariaId },
    select: SELECT_USUARIO,
  });
  res.status(201).json({ usuario });
}

async function atualizar(req, res) {
  const { id } = req.params;
  const { nome, email, telefone } = req.body;

  if (!nome?.trim() && !email?.trim() && telefone === undefined) {
    return res.status(400).json({ error: 'Informe ao menos nome, email ou telefone para atualizar' });
  }

  const principalId = await buscarPrincipalId(req.imobiliariaId);
  const logadoEhPrincipal = req.usuario.id === principalId;
  if (!logadoEhPrincipal && id !== req.usuario.id) {
    return res.status(403).json({ error: 'Sem permissão para editar outros usuários' });
  }

  const usuario = await prisma.usuario.findFirst({ where: { id, imobiliariaId: req.imobiliariaId } });
  if (!usuario) return res.status(404).json({ error: 'Usuário não encontrado' });

  if (email && email !== usuario.email) {
    const existe = await prisma.usuario.findUnique({ where: { email } });
    if (existe) return res.status(409).json({ error: 'Email já está em uso' });
  }

  const data = {};
  if (nome?.trim()) data.nome = nome.trim();
  if (email?.trim()) data.email = email.trim();
  if (telefone !== undefined) data.telefone = telefone?.trim() || null;

  const atualizado = await prisma.usuario.update({ where: { id }, data, select: SELECT_USUARIO });
  res.json({ usuario: atualizado });
}

async function remover(req, res) {
  const { id } = req.params;
  const imobiliariaId = req.imobiliariaId;

  if (id === req.usuario.id) {
    return res.status(400).json({ error: 'Não é possível remover seu próprio usuário' });
  }

  const principalId = await buscarPrincipalId(imobiliariaId);
  if (req.usuario.id !== principalId) {
    return res.status(403).json({ error: 'Sem permissão para remover usuários' });
  }
  if (id === principalId) {
    return res.status(403).json({ error: 'Este usuário não pode ser removido' });
  }

  const usuario = await prisma.usuario.findFirst({ where: { id, imobiliariaId } });
  if (!usuario) return res.status(404).json({ error: 'Usuário não encontrado' });

  await prisma.usuario.delete({ where: { id } });
  res.json({ ok: true });
}

async function resetarSenha(req, res) {
  const { id } = req.params;
  const { novaSenha } = req.body;

  if (!novaSenha || novaSenha.length < 6) {
    return res.status(400).json({ error: 'Nova senha deve ter no mínimo 6 caracteres' });
  }

  const principalId = await buscarPrincipalId(req.imobiliariaId);
  const logadoEhPrincipal = req.usuario.id === principalId;
  if (!logadoEhPrincipal && id !== req.usuario.id) {
    return res.status(403).json({ error: 'Sem permissão para resetar senha de outros usuários' });
  }

  const usuario = await prisma.usuario.findFirst({ where: { id, imobiliariaId: req.imobiliariaId } });
  if (!usuario) return res.status(404).json({ error: 'Usuário não encontrado' });

  const senhaHash = await bcrypt.hash(novaSenha, 12);
  await prisma.usuario.update({ where: { id }, data: { senhaHash } });
  res.json({ ok: true });
}

module.exports = { listar, criar, atualizar, remover, resetarSenha };
