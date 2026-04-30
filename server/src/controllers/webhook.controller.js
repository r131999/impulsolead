const { PrismaClient } = require('@prisma/client');
const { proximoCorretor } = require('../services/fila.service');
const { notificarCorretor } = require('../services/notificacao.service');

const prisma = new PrismaClient();

async function receberLead(req, res) {
  const {
    nome, telefone, whatsappJid,
    primeiroImovel, tipoRenda, rendaMensal, restricaoCpf,
    valorEntrada, urgencia, regiao, faixaValor,
  } = req.body;

  if (!nome || !telefone) {
    return res.status(400).json({ error: 'Campos obrigatórios: nome, telefone' });
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Cria o lead com status qualificado
    const lead = await tx.lead.create({
      data: {
        nome,
        telefone,
        whatsappJid: whatsappJid || `${telefone}@s.whatsapp.net`,
        status: 'qualificado',
        primeiroImovel: primeiroImovel || null,
        tipoRenda: tipoRenda || null,
        rendaMensal: rendaMensal || null,
        restricaoCpf: restricaoCpf || null,
        valorEntrada: valorEntrada || null,
        urgencia: urgencia || null,
        regiao: regiao || null,
        faixaValor: faixaValor || null,
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
