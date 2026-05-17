const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function obterRemetente(req) {
  return {
    remetenteId: req.usuario.id,
    remetenteTipo: req.role,
    remetenteNome: req.usuario.nome,
  };
}

// Normaliza par de IDs para garantir ordem consistente (@@unique)
function normalizarPar(idA, tipoA, idB, tipoB) {
  if (idA < idB) {
    return { p1Id: idA, p1Tipo: tipoA, p2Id: idB, p2Tipo: tipoB };
  }
  return { p1Id: idB, p1Tipo: tipoB, p2Id: idA, p2Tipo: tipoA };
}

async function listarConversas(req, res) {
  try {
    const { remetenteId } = obterRemetente(req);

    const conversas = await prisma.chatConversa.findMany({
      where: {
        imobiliariaId: req.imobiliariaId,
        OR: [{ participante1Id: remetenteId }, { participante2Id: remetenteId }],
      },
      include: {
        mensagens: {
          orderBy: { criadoEm: 'desc' },
          take: 1,
          select: { conteudo: true, criadoEm: true, remetenteId: true },
        },
      },
      orderBy: { atualizadoEm: 'desc' },
    });

    if (!conversas.length) return res.json({ conversas: [] });

    // Contagem de não lidas por conversa
    const naoLidasRows = await prisma.chatMensagem.groupBy({
      by: ['conversaId'],
      where: {
        conversaId: { in: conversas.map((c) => c.id) },
        lida: false,
        remetenteId: { not: remetenteId },
      },
      _count: { id: true },
    });
    const naoLidasMap = {};
    naoLidasRows.forEach((r) => { naoLidasMap[r.conversaId] = r._count.id; });

    // Identificar os outros participantes
    const usuariosIds = new Set();
    const corretoresIds = new Set();
    conversas.forEach((c) => {
      const outroId = c.participante1Id === remetenteId ? c.participante2Id : c.participante1Id;
      const outroTipo = c.participante1Id === remetenteId ? c.participante2Tipo : c.participante1Tipo;
      if (outroTipo === 'corretor' || outroTipo === 'gerente') {
        // gerente também é da tabela Corretor
        if (outroTipo === 'gerente') usuariosIds.add(outroId);
        else corretoresIds.add(outroId);
      } else {
        usuariosIds.add(outroId);
      }
    });

    // Buscar dados dos outros participantes
    const [usuariosDb, corretoresDb, gerentesDb] = await Promise.all([
      usuariosIds.size
        ? prisma.usuario.findMany({
            where: { id: { in: [...usuariosIds] } },
            select: { id: true, nome: true, fotoPerfil: true },
          })
        : [],
      corretoresIds.size
        ? prisma.corretor.findMany({
            where: { id: { in: [...corretoresIds] } },
            select: { id: true, nome: true, fotoPerfil: true, role: true },
          })
        : [],
      // gerentes também são da tabela Corretor
      prisma.corretor.findMany({
        where: {
          id: { in: conversas.map((c) =>
            c.participante1Id === remetenteId ? c.participante2Id : c.participante1Id
          )},
          role: 'gerente',
        },
        select: { id: true, nome: true, fotoPerfil: true, role: true },
      }),
    ]);

    const usuariosMap = Object.fromEntries(usuariosDb.map((u) => [u.id, u]));
    const corretoresMap = Object.fromEntries(corretoresDb.map((c) => [c.id, c]));
    const gerentesMap = Object.fromEntries(gerentesDb.map((c) => [c.id, c]));

    const result = conversas.map((c) => {
      const outroId = c.participante1Id === remetenteId ? c.participante2Id : c.participante1Id;
      const outroTipo = c.participante1Id === remetenteId ? c.participante2Tipo : c.participante1Tipo;
      const outroInfo = usuariosMap[outroId] || corretoresMap[outroId] || gerentesMap[outroId];

      return {
        id: c.id,
        outroParticipanteId: outroId,
        outroParticipanteTipo: outroTipo,
        outroParticipanteNome: outroInfo?.nome || 'Usuário',
        outroParticipanteFoto: outroInfo?.fotoPerfil || null,
        ultimaMensagem: c.mensagens[0] || null,
        naoLidas: naoLidasMap[c.id] || 0,
        atualizadoEm: c.atualizadoEm,
      };
    });

    res.json({ conversas: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao listar conversas' });
  }
}

async function listarMensagens(req, res) {
  try {
    const { conversaId } = req.params;
    const { remetenteId } = obterRemetente(req);

    const conversa = await prisma.chatConversa.findFirst({
      where: {
        id: conversaId,
        imobiliariaId: req.imobiliariaId,
        OR: [{ participante1Id: remetenteId }, { participante2Id: remetenteId }],
      },
    });

    if (!conversa) return res.status(404).json({ error: 'Conversa não encontrada' });

    const mensagens = await prisma.chatMensagem.findMany({
      where: { conversaId },
      orderBy: { criadoEm: 'asc' },
      take: 100,
    });

    res.json({ mensagens });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao listar mensagens' });
  }
}

async function criarOuBuscarConversa(req, res) {
  try {
    const { destinatarioId, destinatarioTipo } = req.body;
    if (!destinatarioId || !destinatarioTipo) {
      return res.status(400).json({ error: 'destinatarioId e destinatarioTipo são obrigatórios' });
    }

    const { remetenteId, remetenteTipo } = obterRemetente(req);

    if (remetenteId === destinatarioId) {
      return res.status(400).json({ error: 'Não é possível conversar consigo mesmo' });
    }

    const { p1Id, p1Tipo, p2Id, p2Tipo } = normalizarPar(
      remetenteId, remetenteTipo, destinatarioId, destinatarioTipo
    );

    const conversa = await prisma.chatConversa.upsert({
      where: { participante1Id_participante2Id: { participante1Id: p1Id, participante2Id: p2Id } },
      create: {
        participante1Id: p1Id,
        participante1Tipo: p1Tipo,
        participante2Id: p2Id,
        participante2Tipo: p2Tipo,
        imobiliariaId: req.imobiliariaId,
      },
      update: {},
    });

    res.json({ conversa });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar/buscar conversa' });
  }
}

async function enviarMensagem(req, res) {
  try {
    const { conversaId } = req.params;
    const { conteudo, leadId, leadNome } = req.body;
    const { remetenteId, remetenteTipo, remetenteNome } = obterRemetente(req);

    if (!conteudo?.trim()) {
      return res.status(400).json({ error: 'Conteúdo é obrigatório' });
    }

    const conversa = await prisma.chatConversa.findFirst({
      where: {
        id: conversaId,
        imobiliariaId: req.imobiliariaId,
        OR: [{ participante1Id: remetenteId }, { participante2Id: remetenteId }],
      },
    });

    if (!conversa) return res.status(404).json({ error: 'Conversa não encontrada' });

    const [mensagem] = await prisma.$transaction([
      prisma.chatMensagem.create({
        data: {
          conversaId,
          remetenteId,
          remetenteTipo,
          remetenteNome,
          conteudo: conteudo.trim(),
          leadId: leadId || null,
          leadNome: leadNome || null,
        },
      }),
      // Atualiza atualizadoEm da conversa para ordenação
      prisma.chatConversa.update({
        where: { id: conversaId },
        data: { atualizadoEm: new Date() },
      }),
    ]);

    res.json({ mensagem });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao enviar mensagem' });
  }
}

async function marcarLidas(req, res) {
  try {
    const { conversaId } = req.params;
    const { remetenteId } = obterRemetente(req);

    const conversa = await prisma.chatConversa.findFirst({
      where: {
        id: conversaId,
        imobiliariaId: req.imobiliariaId,
        OR: [{ participante1Id: remetenteId }, { participante2Id: remetenteId }],
      },
    });

    if (!conversa) return res.status(404).json({ error: 'Conversa não encontrada' });

    await prisma.chatMensagem.updateMany({
      where: { conversaId, lida: false, remetenteId: { not: remetenteId } },
      data: { lida: true },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao marcar mensagens como lidas' });
  }
}

async function naoLidasTotal(req, res) {
  try {
    const { remetenteId } = obterRemetente(req);

    const conversas = await prisma.chatConversa.findMany({
      where: {
        imobiliariaId: req.imobiliariaId,
        OR: [{ participante1Id: remetenteId }, { participante2Id: remetenteId }],
      },
      select: { id: true },
    });

    const total = await prisma.chatMensagem.count({
      where: {
        conversaId: { in: conversas.map((c) => c.id) },
        lida: false,
        remetenteId: { not: remetenteId },
      },
    });

    res.json({ total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao contar não lidas' });
  }
}

async function listarParticipantes(req, res) {
  try {
    const { remetenteId } = obterRemetente(req);

    const [usuarios, corretores] = await Promise.all([
      prisma.usuario.findMany({
        where: { imobiliariaId: req.imobiliariaId, ativo: true, id: { not: remetenteId } },
        select: { id: true, nome: true, role: true, fotoPerfil: true },
        orderBy: { nome: 'asc' },
      }),
      prisma.corretor.findMany({
        where: { imobiliariaId: req.imobiliariaId, ativo: true, usuarioAtivo: true, id: { not: remetenteId } },
        select: { id: true, nome: true, role: true, fotoPerfil: true },
        orderBy: { nome: 'asc' },
      }),
    ]);

    const participantes = [
      ...usuarios.map((u) => ({ ...u, tipo: u.role })),
      ...corretores.map((c) => ({ ...c, tipo: c.role || 'corretor' })),
    ];

    res.json({ participantes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao listar participantes' });
  }
}

module.exports = {
  listarConversas,
  listarMensagens,
  criarOuBuscarConversa,
  enviarMensagem,
  marcarLidas,
  naoLidasTotal,
  listarParticipantes,
};
