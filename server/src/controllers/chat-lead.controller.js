'use strict';

const axios = require('axios');
const { emitirMensagem } = require('../services/socketio.service');

const prisma = require('../lib/prisma');

const BAILEYS_URL = process.env.BAILEYS_URL || 'http://impulsolead-whatsapp:3010';

// ── Helpers ────────────────────────────────────────────────────────────────────

async function resolverPermissaoLead(req, leadId) {
  const where = { id: leadId, imobiliariaId: req.imobiliariaId };

  if (req.role === 'corretor') {
    where.corretorId = req.corretorId;
  } else if (req.role === 'gerente') {
    if (req.equipeId) {
      const ids = await prisma.corretor.findMany({
        where: { equipeId: req.equipeId, imobiliariaId: req.imobiliariaId },
        select: { id: true },
      });
      where.corretorId = { in: ids.map((c) => c.id) };
    } else {
      where.corretorId = req.corretorId;
    }
  }

  return prisma.lead.findFirst({
    where,
    select: { id: true, nome: true, telefone: true, whatsappJid: true, imobiliariaId: true, corretorId: true },
  });
}

// ── Listar mensagens ───────────────────────────────────────────────────────────

async function listarMensagens(req, res) {
  try {
    const { leadId } = req.params;

    const lead = await resolverPermissaoLead(req, leadId);
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

    const mensagens = await prisma.mensagemLead.findMany({
      where: { leadId },
      orderBy: { criadoEm: 'asc' },
      include: {
        arquivoImovel: {
          select: { id: true, nome: true, tipo: true, filename: true, mimetype: true },
        },
      },
    });

    res.json({ mensagens });
  } catch (err) {
    console.error('[chat-lead] listarMensagens:', err.message);
    res.status(500).json({ error: 'Erro ao listar mensagens' });
  }
}

// ── Enviar mensagem de texto ───────────────────────────────────────────────────

async function enviarMensagem(req, res) {
  try {
    const { leadId } = req.params;
    const { conteudo } = req.body;

    if (!conteudo?.trim()) {
      return res.status(400).json({ error: 'conteudo é obrigatório' });
    }

    const lead = await resolverPermissaoLead(req, leadId);
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

    const remetenteNome = req.usuario?.nome || 'Corretor';
    const remetenteId = req.corretorId || req.usuario?.id || null;

    const mensagem = await prisma.mensagemLead.create({
      data: {
        leadId,
        remetenteTipo: 'corretor',
        remetenteNome,
        remetenteId,
        conteudo: conteudo.trim(),
        tipoMidia: 'texto',
        lida: true,
        imobiliariaId: req.imobiliariaId,
      },
    });

    // Enviar via Baileys (não-bloqueante para o response)
    const numero = lead.whatsappJid || `${lead.telefone}@s.whatsapp.net`;
    const jid = numero.includes('@') ? numero.split('@')[0] : numero;

    axios
      .post(`${BAILEYS_URL}/send`, { imobiliariaId: lead.imobiliariaId, number: jid, text: conteudo.trim() })
      .catch((err) => console.error('[chat-lead] erro Baileys:', err.message));

    emitirMensagem(leadId, mensagem);

    res.status(201).json({ mensagem });
  } catch (err) {
    console.error('[chat-lead] enviarMensagem:', err.message);
    res.status(500).json({ error: 'Erro ao enviar mensagem' });
  }
}

// ── Enviar arquivo da biblioteca ───────────────────────────────────────────────

async function enviarArquivo(req, res) {
  try {
    const { leadId } = req.params;
    const { arquivoImovelId, conteudo } = req.body;

    if (!arquivoImovelId) {
      return res.status(400).json({ error: 'arquivoImovelId é obrigatório' });
    }

    const lead = await resolverPermissaoLead(req, leadId);
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

    const arquivo = await prisma.arquivoImovel.findFirst({
      where: { id: arquivoImovelId, imobiliariaId: req.imobiliariaId },
    });
    if (!arquivo) return res.status(404).json({ error: 'Arquivo não encontrado' });

    const baseUrl = process.env.API_BASE_URL || 'https://api-crm.impulsoslz.com.br';
    const urlMidia = `${baseUrl}/uploads/imoveis/${arquivo.filename}`;

    const tipoMidiaMap = { foto: 'imagem', video: 'video', pdf: 'pdf' };
    const tipoMidia = tipoMidiaMap[arquivo.tipo] || 'pdf';

    const remetenteNome = req.usuario?.nome || 'Corretor';
    const remetenteId = req.corretorId || req.usuario?.id || null;

    const mensagem = await prisma.mensagemLead.create({
      data: {
        leadId,
        remetenteTipo: 'corretor',
        remetenteNome,
        remetenteId,
        conteudo: conteudo?.trim() || null,
        tipoMidia,
        arquivoImovelId,
        urlMidia,
        lida: true,
        imobiliariaId: req.imobiliariaId,
      },
      include: {
        arquivoImovel: {
          select: { id: true, nome: true, tipo: true, filename: true, mimetype: true },
        },
      },
    });

    // Enviar via Baileys
    const jid = (lead.whatsappJid || `${lead.telefone}@s.whatsapp.net`).split('@')[0];

    axios
      .post(`${BAILEYS_URL}/send-media`, {
        imobiliariaId: lead.imobiliariaId,
        number: jid,
        mediaUrl: urlMidia,
        tipo: tipoMidia,
        filename: arquivo.filename,
        mimetype: arquivo.mimetype,
        caption: conteudo?.trim() || '',
      })
      .catch((err) => console.error('[chat-lead] erro Baileys media:', err.message));

    emitirMensagem(leadId, mensagem);

    res.status(201).json({ mensagem });
  } catch (err) {
    console.error('[chat-lead] enviarArquivo:', err.message);
    res.status(500).json({ error: 'Erro ao enviar arquivo' });
  }
}

// ── Marcar mensagens como lidas ────────────────────────────────────────────────

async function marcarLidas(req, res) {
  try {
    const { leadId } = req.params;

    const lead = await resolverPermissaoLead(req, leadId);
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

    await prisma.mensagemLead.updateMany({
      where: { leadId, remetenteTipo: 'lead', lida: false },
      data: { lida: true },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('[chat-lead] marcarLidas:', err.message);
    res.status(500).json({ error: 'Erro ao marcar mensagens como lidas' });
  }
}

// ── Receber mensagem do Baileys (rota interna, x-api-key) ──────────────────────

async function receberMensagem(req, res) {
  try {
    const { leadId } = req.params;
    const { conteudo, whatsappMsgId, remetenteNome, tipoMidia } = req.body;

    if (!conteudo && !tipoMidia) {
      return res.status(400).json({ error: 'conteudo ou tipoMidia é obrigatório' });
    }

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, imobiliariaId: req.imobiliariaId },
      select: { id: true },
    });
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

    // Deduplicação por whatsappMsgId
    if (whatsappMsgId) {
      const existe = await prisma.mensagemLead.findFirst({
        where: { whatsappMsgId },
        select: { id: true },
      });
      if (existe) return res.json({ ok: true, dedup: true });
    }

    const mensagem = await prisma.mensagemLead.create({
      data: {
        leadId,
        remetenteTipo: 'lead',
        remetenteNome: remetenteNome || 'Lead',
        conteudo: conteudo || null,
        tipoMidia: tipoMidia || 'texto',
        whatsappMsgId: whatsappMsgId || null,
        lida: false,
        imobiliariaId: req.imobiliariaId,
      },
    });

    emitirMensagem(leadId, mensagem);

    res.status(201).json({ mensagem });
  } catch (err) {
    console.error('[chat-lead] receberMensagem:', err.message);
    res.status(500).json({ error: 'Erro ao receber mensagem' });
  }
}

module.exports = { listarMensagens, enviarMensagem, enviarArquivo, marcarLidas, receberMensagem };
