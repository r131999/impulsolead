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

// Grava retroativamente no chat do lead uma conversa que aconteceu ANTES de o lead
// existir (triagem) — sem isso o corretor abre o card sem saber o que já foi dito e
// repete pergunta. Não temos o horário real de cada mensagem (SessaoAgente.respostas.historico
// só guarda role+content), então aproximamos com timestamps crescentes de 1s a partir de
// "agora menos N segundos", só pra garantir a ORDEM correta — a hora exibida não é a real.
async function backfillHistoricoNoChat(tx, { leadId, imobiliariaId, historico, nomeLead, nomeAgente }) {
  if (!Array.isArray(historico) || historico.length === 0) return;

  const base = Date.now() - historico.length * 1000;
  for (let i = 0; i < historico.length; i++) {
    const msg = historico[i];
    if (!msg?.content) continue;
    const isLead = msg.role === 'user';
    await tx.mensagemLead.create({
      data: {
        leadId,
        remetenteTipo: isLead ? 'lead' : 'assistente',
        remetenteNome: isLead ? (nomeLead || 'Lead') : (nomeAgente || 'Lia'),
        conteudo: msg.content,
        tipoMidia: 'texto',
        lida: !isLead, // mensagens da Lia são saída (já "lidas"); do lead ficam pendentes pro corretor ver
        imobiliariaId,
        criadoEm: new Date(base + i * 1000),
      },
    });
  }
}

async function receberLead(req, res) {
  const {
    nome, telefone, whatsappJid,
    primeiroImovel, tipoRenda, rendaMensal, restricaoCpf,
    valorEntrada, urgencia, regiao, faixaValor,
    historico, campanha, viaAgenteQualificacao, mensagemInicial,
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
    select: { distribuicaoManual: true, qualificacaoAutomatica: true, mensagemBoasVindas: true, nomeAgente: true },
  });
  const modoManual = configAgente?.distribuicaoManual ?? false;
  // viaAgenteQualificacao só chega true quando o próprio manager (Baileys) está criando o lead
  // dentro de uma conversa ativa — reconferimos o toggle no banco em vez de confiar cegamente
  // no corpo da requisição, para nunca deixar um lead sem origem de conversa "preso" aguardando
  // uma Lia que nunca vai falar com ele (ex.: chamada externa via N8N).
  const qualificacaoAtiva = !!(configAgente?.qualificacaoAutomatica && viaAgenteQualificacao);

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
        emQualificacaoAutomatica: qualificacaoAtiva,
      },
    });

    // 2. Herda o histórico da triagem (se essa conversa passou por lá) e grava
    // retroativamente no chat do lead — o corretor precisa ver o que já foi
    // conversado antes de o lead existir, senão repete pergunta. Vale independente
    // de qualificação automática estar ligada (é sobre a triagem, não sobre ela).
    const sessaoTriagem = await tx.sessaoAgente.findUnique({
      where: { telefone_imobiliariaId_tipo: { telefone: telefoneSanitizado, imobiliariaId: req.imobiliariaId, tipo: 'triagem' } },
    });
    const historicoTriagem = Array.isArray(sessaoTriagem?.respostas?.historico) ? sessaoTriagem.respostas.historico : [];
    if (historicoTriagem.length > 0) {
      await backfillHistoricoNoChat(tx, {
        leadId: lead.id,
        imobiliariaId: req.imobiliariaId,
        historico: historicoTriagem,
        nomeLead: nomeSanitizado,
        nomeAgente: configAgente?.nomeAgente,
      });
    }
    // A última mensagem do histórico de triagem é a mesma mensagem que confirmou o
    // lead (o "text" que o manager também loga via salvarMensagemRecebida depois de
    // criar o lead) — evita duplicar essa mensagem no chat.
    const historicoBackfilled = historicoTriagem.length > 0;

    // 3. Qualificação automática ligada: a Lia conduz a conversa antes de qualquer
    // distribuição — corretor só entra quando a qualificação terminar (ver
    // finalizarQualificacao em agente.controller.js).
    if (qualificacaoAtiva) {
      await tx.historicoLead.create({
        data: {
          leadId: lead.id,
          acao: 'Lead recebido via WhatsApp — Lia iniciando qualificação automática',
          detalhes: 'Corretor será notificado ao final da qualificação (ou em caso de transferência/timeout/limite de mensagens)',
        },
      });

      // Sem histórico de triagem pra herdar: semeia com a boas-vindas + a mensagem
      // que disparou a criação, pra qualificação continuar sem reiniciar do zero.
      let historicoSeed = historicoTriagem;
      if (historicoSeed.length === 0 && mensagemInicial && String(mensagemInicial).trim()) {
        historicoSeed = [
          { role: 'assistant', content: configAgente.mensagemBoasVindas || 'Olá! Tudo bem? Aqui é a Lia, assistente virtual. Que bom que você entrou em contato! Como posso te chamar?' },
          { role: 'user', content: String(mensagemInicial).trim() },
        ];
      }

      await tx.sessaoAgente.upsert({
        where: { telefone_imobiliariaId_tipo: { telefone: telefoneSanitizado, imobiliariaId: req.imobiliariaId, tipo: 'qualificacao_ia' } },
        update: {
          status: 'em_andamento',
          etapaAtual: 0,
          respostas: { leadId: lead.id, historico: historicoSeed, coletado: {} },
          nome: nomeSanitizado,
        },
        create: {
          telefone: telefoneSanitizado,
          nome: nomeSanitizado,
          tipo: 'qualificacao_ia',
          etapaAtual: 0,
          respostas: { leadId: lead.id, historico: historicoSeed, coletado: {} },
          status: 'em_andamento',
          instancia: req.imobiliariaId,
          imobiliariaId: req.imobiliariaId,
        },
      });

      return { lead, corretor: null, historicoBackfilled };
    }

    // 4. Modo manual: sem round-robin, aguarda distribuição pelo gestor
    if (modoManual) {
      await tx.historicoLead.create({
        data: {
          leadId: lead.id,
          acao: 'Lead recebido via webhook — aguardando distribuição manual',
          detalhes: 'Distribuição manual ativa: corretor deve ser atribuído pelo gestor',
        },
      });
      return { lead, corretor: null, historicoBackfilled };
    }

    // 5. Busca próximo corretor via round-robin (dentro da transação)
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

    return { lead, corretor, historicoBackfilled };
  });

  // 6. Notifica corretor de forma assíncrona (não bloqueia a resposta)
  if (result.corretor) {
    notificarCorretorCloudApi(result.corretor, result.lead).catch(() => {});
    enviarPushCorretor(
      result.corretor.id,
      '🏠 Novo lead!',
      `Nome: ${result.lead.nome} | Tel: ${result.lead.telefone}`,
    ).catch(() => {});
  }

  // 7. Busca o lead completo para retornar
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
    aguardandoQualificacao: qualificacaoAtiva,
    historicoBackfilled: result.historicoBackfilled,
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
      select: { id: true, emQualificacaoAutomatica: true },
      orderBy: { criadoEm: 'desc' },
    });

    if (leadPorJid) {
      return res.json({ existe: true, leadId: leadPorJid.id, emQualificacaoAutomatica: leadPorJid.emQualificacaoAutomatica });
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
          select: { id: true, emQualificacaoAutomatica: true },
          orderBy: { criadoEm: 'desc' },
        });

        if (leadPorSufixo) {
          return res.json({ existe: true, leadId: leadPorSufixo.id, emQualificacaoAutomatica: leadPorSufixo.emQualificacaoAutomatica });
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
    select: { id: true, emQualificacaoAutomatica: true },
    orderBy: { criadoEm: 'desc' },
  });

  if (lead) {
    return res.json({ existe: true, leadId: lead.id, emQualificacaoAutomatica: lead.emQualificacaoAutomatica });
  }

  res.json({ existe: false, leadId: null });
}

async function mensagemBoasVindas(req, res) {
  try {
    const config = await prisma.configAgente.findUnique({
      where: { imobiliariaId: req.imobiliariaId },
      select: {
        mensagemBoasVindas: true,
        atenderNumeroDesconhecido: true,
        horarioAtendimentoInicio: true,
        horarioAtendimentoFim: true,
        qualificacaoAutomatica: true,
      },
    });
    const mensagem = config?.mensagemBoasVindas
      || 'Em breve um de nossos consultores entrará em contato com você.';
    res.json({
      mensagem,
      atenderNumeroDesconhecido: !!config?.atenderNumeroDesconhecido,
      horarioAtendimentoInicio: config?.horarioAtendimentoInicio || '00:00',
      horarioAtendimentoFim: config?.horarioAtendimentoFim || '23:59',
      qualificacaoAutomatica: !!config?.qualificacaoAutomatica,
    });
  } catch (err) {
    console.error('[webhook] mensagemBoasVindas:', err.message);
    res.status(500).json({ error: 'Erro ao buscar mensagem' });
  }
}

module.exports = { receberLead, numerosBloqueados, leadAtivo, mensagemBoasVindas };
