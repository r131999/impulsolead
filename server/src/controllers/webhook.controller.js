const { PrismaClient } = require('@prisma/client');
const { proximoCorretor } = require('../services/fila.service');
const { notificarCorretor } = require('../services/notificacao.service');

const prisma = new PrismaClient();

function sanitizarTexto(valor) {
  if (valor == null) return null;
  return String(valor)
    .replace(/<[^>]*>/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
    .slice(0, 500);
}

async function receberLead(req, res) {
  const {
    nome, telefone, whatsappJid,
    primeiroImovel, tipoRenda, rendaMensal, restricaoCpf,
    valorEntrada, urgencia, regiao, faixaValor,
  } = req.body;

  if (!nome || !String(nome).trim()) {
    return res.status(400).json({ error: 'Campos obrigatórios: nome, telefone' });
  }
  if (!telefone) {
    return res.status(400).json({ error: 'Campos obrigatórios: nome, telefone' });
  }

  const digitos = String(telefone).replace(/\D/g, '');
  if (digitos.length < 10 || digitos.length > 15) {
    return res.status(400).json({ error: 'Telefone deve ter entre 10 e 15 dígitos numéricos' });
  }

  const nomeSanitizado       = sanitizarTexto(nome);
  const telefoneSanitizado   = digitos;
  const regiaoSanitizada     = sanitizarTexto(regiao);
  const primeiroImovelSan    = sanitizarTexto(primeiroImovel);
  const tipoRendaSan         = sanitizarTexto(tipoRenda);
  const rendaMensalSan       = sanitizarTexto(rendaMensal);
  const restricaoCpfSan      = sanitizarTexto(restricaoCpf);
  const valorEntradaSan      = sanitizarTexto(valorEntrada);
  const urgenciaSan          = sanitizarTexto(urgencia);
  const faixaValorSan        = sanitizarTexto(faixaValor);

  const result = await prisma.$transaction(async (tx) => {
    // 1. Cria o lead com status qualificado
    const lead = await tx.lead.create({
      data: {
        nome: nomeSanitizado,
        telefone: telefoneSanitizado,
        whatsappJid: whatsappJid || `${telefoneSanitizado}@s.whatsapp.net`,
        status: 'qualificado',
        primeiroImovel: primeiroImovelSan,
        tipoRenda: tipoRendaSan,
        rendaMensal: rendaMensalSan,
        restricaoCpf: restricaoCpfSan,
        valorEntrada: valorEntradaSan,
        urgencia: urgenciaSan,
        regiao: regiaoSanitizada,
        faixaValor: faixaValorSan,
        imobiliariaId: req.imobiliariaId,
      },
    });

    // 2. Busca próximo corretor via round-robin (dentro da transação)
    const corretores = await tx.corretor.findMany({
      where: { imobiliariaId: req.imobiliariaId, ativo: true, disponivel: true },
      orderBy: { posicaoFila: 'asc' },
    });

    let corretor = null;

    if (corretores.length > 0) {
      const proximo = corretores[0];
      const maxPosicao = corretores[corretores.length - 1].posicaoFila;

      // 3. Move corretor para o final da fila
      await tx.corretor.update({
        where: { id: proximo.id },
        data: {
          leadsRecebidos: { increment: 1 },
          posicaoFila: maxPosicao + 1,
        },
      });

      // 4. Atribui lead ao corretor
      await tx.lead.update({
        where: { id: lead.id },
        data: { corretorId: proximo.id },
      });

      corretor = proximo;

      await tx.historicoLead.create({
        data: {
          leadId: lead.id,
          acao: 'Lead recebido via webhook e atribuído automaticamente',
          detalhes: `Corretor: ${proximo.nome} | Origem: N8N/WhatsApp`,
        },
      });
    } else {
      // Nenhum corretor disponível
      await tx.historicoLead.create({
        data: {
          leadId: lead.id,
          acao: 'Lead recebido via webhook — sem corretor disponível na fila',
          detalhes: 'Atribuição pendente: todos os corretores estão indisponíveis',
        },
      });
    }

    return { lead, corretor };
  });

  // 5. Notifica corretor de forma assíncrona (não bloqueia a resposta)
  if (result.corretor) {
    notificarCorretor(result.corretor, result.lead, req.imobiliaria).catch(() => {});
  }

  // 6. Busca o lead completo para retornar
  const leadCompleto = await prisma.lead.findUnique({
    where: { id: result.lead.id },
    include: { corretor: { select: { id: true, nome: true, whatsapp: true } } },
  });

  res.status(201).json({
    success: true,
    lead: {
      id: leadCompleto.id,
      nome: leadCompleto.nome,
      status: leadCompleto.status,
      corretor: leadCompleto.corretor || null,
    },
    semCorretor: !result.corretor,
  });
}

module.exports = { receberLead };
