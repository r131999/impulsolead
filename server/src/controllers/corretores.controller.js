const bcrypt = require('bcryptjs');
const { reordenarFila } = require('../services/fila.service');

const prisma = require('../lib/prisma');

async function listar(req, res) {
  const { ativo, disponivel } = req.query;

  const where = { imobiliariaId: req.imobiliariaId };
  if (req.role === 'gerente' && req.equipeId) where.equipeId = req.equipeId;
  if (ativo !== undefined) where.ativo = ativo === 'true';
  if (disponivel !== undefined) where.disponivel = disponivel === 'true';

  const [corretores, imobiliaria] = await Promise.all([
    prisma.corretor.findMany({
      where,
      orderBy: { posicaoFila: 'asc' },
      select: {
        id: true, nome: true, email: true, telefone: true, whatsapp: true,
        ativo: true, disponivel: true, posicaoFila: true, leadsRecebidos: true,
        usuarioAtivo: true, equipeId: true, fotoPerfil: true, criadoEm: true,
        equipe: { select: { id: true, nome: true } },
        _count: { select: { leads: true } },
      },
    }),
    prisma.imobiliaria.findUnique({
      where: { id: req.imobiliariaId },
      select: { limiteAcessos: true },
    }),
  ]);

  res.json({ corretores, limiteAcessos: imobiliaria?.limiteAcessos ?? 999 });
}

async function buscarFila(req, res) {
  const corretores = await prisma.corretor.findMany({
    where: { imobiliariaId: req.imobiliariaId, ativo: true },
    orderBy: { posicaoFila: 'asc' },
    select: { id: true, nome: true, disponivel: true, posicaoFila: true, leadsRecebidos: true },
  });

  const fila = corretores.map((c, idx) => ({
    posicao: idx + 1,
    corretorId: c.id,
    nome: c.nome,
    disponivel: c.disponivel,
    leadsRecebidos: c.leadsRecebidos,
  }));

  res.json({ fila });
}

async function criar(req, res) {
  const { nome, email, telefone, whatsapp, ciente } = req.body;

  if (!nome || !telefone || !whatsapp) {
    return res.status(400).json({ error: 'Campos obrigatórios: nome, telefone, whatsapp' });
  }

  const [totalAtivos, imobiliaria] = await Promise.all([
    prisma.corretor.count({ where: { imobiliariaId: req.imobiliariaId, ativo: true } }),
    prisma.imobiliaria.findUnique({ where: { id: req.imobiliariaId }, select: { limiteAcessos: true } }),
  ]);

  const limite = imobiliaria?.limiteAcessos ?? 999;
  const novoTotal = totalAtivos + 1;

  // Bloqueia: N+1 > limiteAcessos+2 (mais de 2 acima do contrato)
  if (novoTotal > limite + 2) {
    return res.status(422).json({
      bloqueado: true,
      error: `Limite máximo atingido. Seu plano permite até ${limite + 2} acessos no total. Entre em contato com o suporte para ampliar.`,
      totalAtivos,
      limiteAcessos: limite,
    });
  }

  // Aviso: limiteAcessos < N+1 <= limiteAcessos+2 e gestor não confirmou
  if (novoTotal > limite && !ciente) {
    return res.status(402).json({
      faixaCobranca: true,
      mensagem: `Seu plano inclui ${limite} acessos. Este corretor será o ${novoTotal}º acesso, gerando R$25/mês adicionais.`,
      totalAtivos,
      limiteAcessos: limite,
    });
  }

  const corretor = await prisma.corretor.create({
    data: {
      nome,
      email: email || null,
      telefone,
      whatsapp,
      imobiliariaId: req.imobiliariaId,
      posicaoFila: totalAtivos,
    },
  });

  res.status(201).json({ corretor });
}

async function atualizar(req, res) {
  const { id } = req.params;
  const { nome, email, telefone, whatsapp, equipeId } = req.body;

  const corretor = await prisma.corretor.findFirst({
    where: { id, imobiliariaId: req.imobiliariaId },
  });

  if (!corretor) {
    return res.status(404).json({ error: 'Corretor não encontrado' });
  }

  if (equipeId) {
    const equipe = await prisma.equipe.findFirst({
      where: { id: equipeId, imobiliariaId: req.imobiliariaId, ativo: true },
    });
    if (!equipe) return res.status(400).json({ error: 'Equipe não encontrada' });
  }

  const atualizado = await prisma.corretor.update({
    where: { id },
    data: {
      ...(nome && { nome }),
      ...(email !== undefined && { email }),
      ...(telefone && { telefone }),
      ...(whatsapp && { whatsapp }),
      ...(equipeId !== undefined && { equipeId: equipeId || null }),
    },
  });

  res.json({ corretor: atualizado });
}

async function atualizarDisponibilidade(req, res) {
  const { id } = req.params;
  const { disponivel } = req.body;

  if (disponivel === undefined) {
    return res.status(400).json({ error: 'Campo obrigatório: disponivel (boolean)' });
  }

  const corretor = await prisma.corretor.findFirst({
    where: { id, imobiliariaId: req.imobiliariaId },
  });

  if (!corretor) {
    return res.status(404).json({ error: 'Corretor não encontrado' });
  }

  const atualizado = await prisma.corretor.update({
    where: { id },
    data: { disponivel },
  });

  res.json({
    corretor: { id: atualizado.id, nome: atualizado.nome, disponivel: atualizado.disponivel },
    message: disponivel ? 'Corretor marcado como disponível' : 'Corretor marcado como indisponível',
  });
}

async function remover(req, res) {
  const { id } = req.params;

  const corretor = await prisma.corretor.findFirst({
    where: { id, imobiliariaId: req.imobiliariaId },
  });

  if (!corretor) {
    return res.status(404).json({ error: 'Corretor não encontrado' });
  }

  // Soft delete: desativa em vez de apagar
  await prisma.corretor.update({
    where: { id },
    data: { ativo: false, disponivel: false },
  });

  // Reordena a fila após remoção
  await reordenarFila(req.imobiliariaId);

  res.json({ message: 'Corretor removido da fila' });
}

async function ativarAcesso(req, res) {
  const { id } = req.params;
  const { email, senha, role } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ error: 'Campos obrigatórios: email, senha' });
  }

  const roleValido = ['corretor', 'gerente'].includes(role) ? role : 'corretor';

  if (senha.length < 6) {
    return res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres' });
  }

  const corretor = await prisma.corretor.findFirst({
    where: { id, imobiliariaId: req.imobiliariaId },
  });

  if (!corretor) {
    return res.status(404).json({ error: 'Corretor não encontrado' });
  }

  const emailEmUso = await prisma.corretor.findFirst({
    where: { email, id: { not: id } },
  });
  if (emailEmUso) {
    return res.status(409).json({ error: 'Email já está em uso por outro corretor' });
  }

  const senhaHash = await bcrypt.hash(senha, 12);

  const atualizado = await prisma.corretor.update({
    where: { id },
    data: { email, senhaHash, usuarioAtivo: true, role: roleValido },
  });

  res.json({
    message: 'Acesso ativado com sucesso',
    corretor: { id: atualizado.id, nome: atualizado.nome, email: atualizado.email, usuarioAtivo: atualizado.usuarioAtivo, role: atualizado.role },
  });
}

async function resetarSenha(req, res) {
  const { id } = req.params;
  const { novaSenha } = req.body;

  if (!novaSenha) {
    return res.status(400).json({ error: 'Campo obrigatório: novaSenha' });
  }

  if (novaSenha.length < 6) {
    return res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres' });
  }

  const corretor = await prisma.corretor.findFirst({
    where: { id, imobiliariaId: req.imobiliariaId },
  });

  if (!corretor) {
    return res.status(404).json({ error: 'Corretor não encontrado' });
  }

  const senhaHash = await bcrypt.hash(novaSenha, 12);
  await prisma.corretor.update({ where: { id }, data: { senhaHash } });

  res.json({ message: 'Senha resetada com sucesso' });
}

async function atualizarFotoCorretor(req, res) {
  const { id } = req.params;
  const { fotoPerfil } = req.body;
  const imobiliariaId = req.imobiliariaId;

  if (!fotoPerfil || !fotoPerfil.startsWith('data:image/')) {
    return res.status(400).json({ error: 'Foto inválida' });
  }

  const corretor = await prisma.corretor.findFirst({ where: { id, imobiliariaId } });
  if (!corretor) return res.status(404).json({ error: 'Corretor não encontrado' });

  await prisma.corretor.update({ where: { id }, data: { fotoPerfil } });
  res.json({ ok: true });
}

module.exports = { listar, buscarFila, criar, atualizar, atualizarDisponibilidade, remover, ativarAcesso, resetarSenha, atualizarFotoCorretor };
