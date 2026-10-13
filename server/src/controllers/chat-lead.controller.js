'use strict';

const axios = require('axios');
const { emitirMensagem } = require('../services/socketio.service');

const prisma = require('../lib/prisma');
const { enviarTextoLivre, enviarMidiaLink } = require('../services/whatsappCloudApi.service');

const BAILEYS_URL = process.env.BAILEYS_URL || 'http://impulsolead-whatsapp:3010';

// ── Canal Cloud API ────────────────────────────────────────────────────────────
// Imobiliária com ConfigAgente.canalWhatsapp = 'cloud_api' envia pela Cloud API
// (credenciais da WhatsappCloudApiInstancia dela); qualquer outro valor segue no
// Baileys exatamente como antes. Diferente do Baileys (fire-and-forget), aqui o
// envio é aguardado: a mensagem só é gravada depois que a Meta aceita, já com o
// wamid — que também deduplica o echo, se ele voltar.

const ERRO_JANELA_24H = 131047;
const MSG_JANELA_24H = 'A janela de 24 horas para responder este lead expirou (a última mensagem dele foi há mais de 24h). '
  + 'Pelo WhatsApp oficial, só é possível reabrir a conversa com um template aprovado pela Meta.';

// null = Baileys (comportamento atual); objeto = Cloud API
async function resolverCanalCloudApi(imobiliariaId) {
  const config = await prisma.configAgente.findUnique({
    where: { imobiliariaId },
    select: { canalWhatsapp: true },
  });
  if (config?.canalWhatsapp !== 'cloud_api') return null;

  const instancia = await prisma.whatsappCloudApiInstancia.findUnique({
    where: { imobiliariaId },
    select: { phoneNumberId: true, accessToken: true, ativo: true },
  });
  return { instancia: instancia?.ativo ? instancia : null };
}

function telefoneCloudApi(lead) {
  const jid = lead.whatsappJid || '';
  return String(lead.telefone || (jid.endsWith('@s.whatsapp.net') ? jid.split('@')[0] : '')).replace(/\D/g, '');
}

// Traduz a falha da Meta numa resposta HTTP com mensagem clara pra interface
function respostaFalhaCloudApi(res, resultado, leadId) {
  if (resultado.codigo === ERRO_JANELA_24H) {
    console.warn(`[chat-lead] Cloud API: janela de 24h expirada — lead=${leadId}`);
    return res.status(422).json({ error: MSG_JANELA_24H, codigo: 'janela_24h_expirada' });
  }
  console.error(`[chat-lead] Cloud API: envio falhou — lead=${leadId} codigo=${resultado.codigo} motivo=${resultado.motivo}`);
  return res.status(502).json({ error: `O WhatsApp recusou o envio: ${resultado.motivo}` });
}

// Nome que o lead vê no documento: o nome amigável do arquivo, com a extensão real
function nomeArquivoDocumento(arquivo) {
  const ext = (arquivo.filename.match(/\.[a-z0-9]+$/i) || [''])[0];
  if (!arquivo.nome) return arquivo.filename;
  return arquivo.nome.toLowerCase().endsWith(ext.toLowerCase()) ? arquivo.nome : `${arquivo.nome}${ext}`;
}

const MSG_SEM_INSTANCIA = 'WhatsApp Cloud API não está conectado para esta imobiliária. Conecte em WhatsApp → Cloud API.';

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

    const canalCloudApi = await resolverCanalCloudApi(lead.imobiliariaId);
    if (canalCloudApi) {
      if (!canalCloudApi.instancia) return res.status(409).json({ error: MSG_SEM_INSTANCIA });

      const resultado = await enviarTextoLivre(telefoneCloudApi(lead), conteudo.trim(), canalCloudApi.instancia);
      if (!resultado.enviado) return respostaFalhaCloudApi(res, resultado, leadId);

      const mensagem = await prisma.mensagemLead.create({
        data: {
          leadId,
          remetenteTipo: 'corretor',
          remetenteNome,
          remetenteId,
          conteudo: conteudo.trim(),
          tipoMidia: 'texto',
          whatsappMsgId: resultado.whatsappMsgId || null,
          lida: true,
          imobiliariaId: req.imobiliariaId,
        },
      });
      emitirMensagem(leadId, mensagem);
      return res.status(201).json({ mensagem });
    }

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

    const canalCloudApi = await resolverCanalCloudApi(lead.imobiliariaId);
    if (canalCloudApi) {
      if (!canalCloudApi.instancia) return res.status(409).json({ error: MSG_SEM_INSTANCIA });

      const resultado = await enviarMidiaLink(
        telefoneCloudApi(lead),
        { tipoMidia, url: urlMidia, caption: conteudo?.trim() || '', filename: nomeArquivoDocumento(arquivo) },
        canalCloudApi.instancia,
      );
      if (!resultado.enviado) return respostaFalhaCloudApi(res, resultado, leadId);

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
          whatsappMsgId: resultado.whatsappMsgId || null,
          lida: true,
          imobiliariaId: req.imobiliariaId,
        },
        include: {
          arquivoImovel: {
            select: { id: true, nome: true, tipo: true, filename: true, mimetype: true },
          },
        },
      });
      emitirMensagem(leadId, mensagem);
      return res.status(201).json({ mensagem });
    }

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

// Núcleo puro — devolve {status, body}, reaproveitado pela rota HTTP (manager
// Baileys) e direto pelo handler da Cloud API, que roda no mesmo processo.
async function salvarMensagemRecebidaCore({ leadId, imobiliariaId, conteudo, whatsappMsgId, remetenteNome, tipoMidia }) {
  if (!conteudo && !tipoMidia) {
    return { status: 400, body: { error: 'conteudo ou tipoMidia é obrigatório' } };
  }

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, imobiliariaId },
    select: { id: true },
  });
  if (!lead) return { status: 404, body: { error: 'Lead não encontrado' } };

  // Deduplicação por whatsappMsgId
  if (whatsappMsgId) {
    const existe = await prisma.mensagemLead.findFirst({
      where: { whatsappMsgId },
      select: { id: true },
    });
    if (existe) return { status: 200, body: { ok: true, dedup: true } };
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
      imobiliariaId,
    },
  });

  emitirMensagem(leadId, mensagem);

  return { status: 201, body: { mensagem } };
}

async function receberMensagem(req, res) {
  try {
    const { leadId } = req.params;
    const { conteudo, whatsappMsgId, remetenteNome, tipoMidia } = req.body;
    const resultado = await salvarMensagemRecebidaCore({
      leadId, imobiliariaId: req.imobiliariaId, conteudo, whatsappMsgId, remetenteNome, tipoMidia,
    });
    res.status(resultado.status).json(resultado.body);
  } catch (err) {
    console.error('[chat-lead] receberMensagem:', err.message);
    res.status(500).json({ error: 'Erro ao receber mensagem' });
  }
}

module.exports = {
  listarMensagens, enviarMensagem, enviarArquivo, marcarLidas, receberMensagem,
  salvarMensagemRecebidaCore,
};
