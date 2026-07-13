const { proximoCorretor } = require('../services/fila.service');
const { notificarCorretorCloudApi } = require('../services/notificacao.service');
const { enviarPushCorretor } = require('./push.controller');

const prisma = require('../lib/prisma');

function sanitizarTexto(valor) {
  if (valor == null) return null;
  return String(valor)
    .replace(/<[^>]*>/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
    .slice(0, 500);
}

function processarHistorico(historico) {
  if (historico == null) return null;
  const texto = typeof historico === 'string'
    ? historico
    : JSON.stringify(historico);
  return texto.slice(0, 200000); // cap 200KB
}

async function receberLead(req, res) {
  const {
    nome, telefone, whatsappJid,
    primeiroImovel, tipoRenda, rendaMensal, restricaoCpf,
    valorEntrada, urgencia, regiao, faixaValor,
    historico, campanha,
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

  const historicoProcessado  = processarHistorico(historico);
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
  const campanhasSan         = sanitizarTexto(campanha);

  const configAgente = await prisma.configAgente.findUnique({
    where: { imobiliariaId: req.imobiliariaId },
    select: { distribuicaoManual: true },
  });
  const modoManual = configAgente?.distribuicaoManual ?? false;

  const result = await prisma.$transaction(async (tx) => {
    // 1. Cria o lead com status lead
    const lead = await tx.lead.create({
      data: {
        nome: nomeSanitizado,
        telefone: telefoneSanitizado,
        whatsappJid: whatsappJid || `${telefoneSanitizado}@s.whatsapp.net`,
        status: 'lead',
        primeiroImovel: primeiroImovelSan,
        tipoRenda: tipoRendaSan,
        rendaMensal: rendaMensalSan,
        restricaoCpf: restricaoCpfSan,
        valorEntrada: valorEntradaSan,
        urgencia: urgenciaSan,
        regiao: regiaoSanitizada,
        faixaValor: faixaValorSan,
        historicoConversa: historicoProcessado,
        temConversa: !!historicoProcessado,
        campanha: campanhasSan || null,
        imobiliariaId: req.imobiliariaId,
      },
    });

    // 2. Modo manual: sem round-robin, aguarda distribuição pelo gestor
    if (modoManual) {
      await tx.historicoLead.create({
        data: {
          leadId: lead.id,
          acao: 'Lead recebido via webhook — aguardando distribuição manual',
          detalhes: 'Distribuição manual ativa: corretor deve ser atribuído pelo gestor',
        },
      });
      return { lead, corretor: null };
    }

    // 3. Busca próximo corretor via round-robin (dentro da transação)
    const corretores = await tx.corretor.findMany({
      where: { imobiliariaId: req.imobiliariaId, ativo: true, disponivel: true },
      orderBy: { posicaoFila: 'asc' },
    });

    let corretor = null;

    if (corretores.length > 0) {
      const proximo = corretores[0];
      const maxPosicao = corretores[corretores.length - 1].posicaoFila;

      // 4. Move corretor para o final da fila
      await tx.corretor.update({
        where: { id: proximo.id },
        data: {
          leadsRecebidos: { increment: 1 },
          posicaoFila: maxPosicao + 1,
        },
      });

      // 5. Atribui lead ao corretor
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

      await tx.historicoDistribuicao.create({
        data: {
          leadId: lead.id,
          leadNome: nomeSanitizado,
          leadTelefone: telefoneSanitizado,
          corretorId: proximo.id,
          corretorNome: proximo.nome,
          distribuidoPor: 'automatico',
          imobiliariaId: req.imobiliariaId,
        },
      });
    } else {
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
    notificarCorretorCloudApi(result.corretor, result.lead).catch(() => {});
    enviarPushCorretor(
      result.corretor.id,
      '🏠 Novo lead!',
      `Nome: ${result.lead.nome} | Tel: ${result.lead.telefone}`,
    ).catch(() => {});
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
    aguardandoDistribuicao: modoManual,
  });
}

async function numerosBloqueados(req, res) {
  const { imobiliariaId } = req;

  const [corretores, usuarios] = await Promise.all([
    prisma.corretor.findMany({
      where: { imobiliariaId },
      select: { telefone: true, whatsapp: true },
    }),
    prisma.usuario.findMany({
      where: { imobiliariaId, telefone: { not: null } },
      select: { telefone: true },
    }),
  ]);

  const todos = [
    ...corretores.flatMap((c) => [c.telefone, c.whatsapp]),
    ...usuarios.map((u) => u.telefone),
  ];

  const telefones = [...new Set(
    todos
      .filter(Boolean)
      .map((t) => String(t).replace(/\D/g, ''))
      .filter((t) => t.length >= 10),
  )];

  res.json({ telefones });
}

async function leadAtivo(req, res) {
  const { telefone, jid } = req.query;

  if (!telefone && !jid) {
    return res.status(400).json({ error: 'Parâmetro obrigatório: telefone ou jid' });
  }

  if (jid) {
    const leadPorJid = await prisma.lead.findFirst({
      where: {
        imobiliariaId: req.imobiliariaId,
        whatsappJid: jid,
        status: { notIn: ['perdido'] },
      },
      select: { id: true },
      orderBy: { criadoEm: 'desc' },
    });

    if (leadPorJid) {
      return res.json({ existe: true, leadId: leadPorJid.id });
    }

    // Busca por sufixo numérico quando o JID é @lid e não houve match exato
    if (jid.endsWith('@lid')) {
      const lidDigits = jid.replace('@lid', '').replace(/\D/g, '');
      const sufixo = lidDigits.slice(-10);
      if (sufixo.length >= 8) {
        const leadPorSufixo = await prisma.lead.findFirst({
          where: {
            imobiliariaId: req.imobiliariaId,
            telefone: { endsWith: sufixo },
            status: { notIn: ['perdido'] },
          },
          select: { id: true },
          orderBy: { criadoEm: 'desc' },
        });

        if (leadPorSufixo) {
          return res.json({ existe: true, leadId: leadPorSufixo.id });
        }
      }
    }
  }

  if (!telefone) {
    return res.json({ existe: false, leadId: null });
  }

  const digitos = String(telefone).replace(/\D/g, '');

  // Busca pelo telefone exato ou pela variante sem/com dígito 9
  const variantes = [digitos];
  if (digitos.startsWith('55') && digitos.length === 13) {
    variantes.push(digitos.slice(0, 4) + digitos.slice(5)); // remove o 9
  } else if (digitos.startsWith('55') && digitos.length === 12) {
    variantes.push(digitos.slice(0, 4) + '9' + digitos.slice(4)); // insere o 9
  }

  const lead = await prisma.lead.findFirst({
    where: {
      imobiliariaId: req.imobiliariaId,
      telefone: { in: variantes },
      status: { notIn: ['perdido'] },
    },
    select: { id: true },
    orderBy: { criadoEm: 'desc' },
  });

  if (lead) {
    return res.json({ existe: true, leadId: lead.id });
  }

  res.json({ existe: false, leadId: null });
}

async function mensagemBoasVindas(req, res) {
  try {
    const config = await prisma.configAgente.findUnique({
      where: { imobiliariaId: req.imobiliariaId },
      select: { mensagemBoasVindas: true },
    });
    const mensagem = config?.mensagemBoasVindas
      || 'Em breve um de nossos consultores entrará em contato com você.';
    res.json({ mensagem });
  } catch (err) {
    console.error('[webhook] mensagemBoasVindas:', err.message);
    res.status(500).json({ error: 'Erro ao buscar mensagem' });
  }
}

module.exports = { receberLead, numerosBloqueados, leadAtivo, mensagemBoasVindas };
