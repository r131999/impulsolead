const axios = require('axios');
const https = require('https');
const http = require('http');

const prisma = require('../lib/prisma');
const { enviarWhatsApp } = require('../services/notificacao.service');

// ─── Mensagens fixas por etapa ────────────────────────────────────────────────

const MENSAGENS = [
  // 0 — Boas-vindas + pergunta nome
  'Eu sou a Lia e vou te acompanhar nesse primeiro atendimento 💚\nPra conseguir te apresentar as melhores oportunidades, vou te fazer algumas perguntinhas rápidas, tudo bem? 😊\nComo é o seu nome?',
  // 1 — Motivação  ([Nome] é substituído pelo nome real)
  '[Nome], que ótimo! Me conta, o que mais te motivou a buscar um imóvel?\n(Morar melhor, sair do aluguel, investir, conquistar o primeiro imóvel…)',
  // 2 — Região
  'Em qual região ou bairro você sonha em morar? 🏡',
  // 3 e 4 — versões genéricas (usadas como fallback se genero não disponível)
  'Você pretende morar sozinho(a), com companheiro(a) ou com a família? 😊',
  'Hoje você trabalha registrado(a), é autônomo(a), empresário(a) ou possui outra fonte de renda?',
  // 5 — Renda mensal
  'Pra eu conseguir te orientar da melhor forma sobre valores, parcelas e até possíveis subsídios do governo, qual é aproximadamente a renda familiar mensal de vocês? 💰',
  // 6 — Finalização
  'Perfeito 😊 Com essas informações vai ficar muito mais fácil encontrar o imóvel ideal pra você 💚 Em breve um corretor especialista vai entrar em contato com as melhores oportunidades!',
];

// Variantes genderizadas para etapas 3 e 4
const MENSAGENS_GENERO = {
  M: {
    3: 'Você pretende morar sozinho, com companheiro(a) ou com a família? 😊',
    4: 'Hoje você trabalha registrado, é autônomo, empresário ou possui outra fonte de renda?',
  },
  F: {
    3: 'Você pretende morar sozinha, com companheiro(a) ou com a família? 😊',
    4: 'Hoje você trabalha registrada, é autônoma, empresária ou possui outra fonte de renda?',
  },
};

function getMensagem(etapa, nome, genero) {
  let msg;
  if ((etapa === 3 || etapa === 4) && genero && MENSAGENS_GENERO[genero]) {
    msg = MENSAGENS_GENERO[genero][etapa];
  } else {
    msg = MENSAGENS[etapa] || '';
  }
  return msg.replace('[Nome]', nome || '');
}

// ─── Palavras que indicam pergunta fora do escopo da qualificação ─────────────

const PALAVRAS_FORA_ESCOPO = [
  'onde', 'quanto', 'como', 'qual', 'tem', 'existe',
  'valor', 'preço', 'localização', 'endereço', 'disponível',
];

function isPerguntaForaEscopo(mensagem) {
  const texto = mensagem.toLowerCase();
  if (texto.includes('?')) return true;
  return PALAVRAS_FORA_ESCOPO.some((p) => texto.includes(p));
}

// ─── Detecção de gênero via OpenAI ───────────────────────────────────────────

async function detectarGenero(nome) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return 'F';

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: `Dado o nome "${nome}", responda apenas M para masculino ou F para feminino.` }],
        max_tokens: 2,
        temperature: 0,
      },
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 5000,
      },
    );

    const resultado = response.data.choices[0]?.message?.content?.trim().toUpperCase() || '';
    return resultado.startsWith('M') ? 'M' : 'F';
  } catch (err) {
    console.warn('[agente] Falha ao detectar gênero — usando padrão F:', err.message);
    return 'F';
  }
}

// ─── Envio via Evolution API com instância dinâmica ──────────────────────────

async function enviarMensagem(telefone, texto, instancia) {
  const apiUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;

  if (!apiUrl || !apiKey || !instancia) {
    console.warn('[agente] Evolution API não configurada — mensagem não enviada');
    return;
  }

  const numero = String(telefone).replace(/\D/g, '');
  const url = `${apiUrl}/message/sendText/${instancia}`;
  const body = JSON.stringify({ number: numero, text: texto });

  try {
    await httpPost(url, body, { apikey: apiKey });
    console.log(`[agente] Mensagem enviada para ${numero} via instância ${instancia}`);
  } catch (err) {
    console.error(`[agente] Falha ao enviar mensagem para ${numero}:`, err.message);
  }
}

function httpPost(url, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...extraHeaders,
      },
      timeout: 8000,
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
        } else {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── Criação do lead no CRM com round-robin ───────────────────────────────────

async function criarLeadNoCRM(sessao, imobiliariaId) {
  const respostas = sessao.respostas || {};
  const telefone  = String(sessao.telefone).replace(/\D/g, '');

  const composicao = respostas.etapa3
    ? `Composição familiar: ${respostas.etapa3}`
    : null;

  const configAgente = await prisma.configAgente.findUnique({
    where: { imobiliariaId },
    select: { distribuicaoManual: true },
  });
  const modoManual = configAgente?.distribuicaoManual ?? false;

  const result = await prisma.$transaction(async (tx) => {
    const lead = await tx.lead.create({
      data: {
        nome:          sessao.nome || 'Sem nome',
        telefone,
        whatsappJid:   `${telefone}@s.whatsapp.net`,
        status:        'lead',
        primeiroImovel: respostas.etapa1 || null,
        regiao:        respostas.etapa2 || null,
        tipoRenda:     respostas.etapa4 || null,
        rendaMensal:   respostas.etapa5 || null,
        observacoes:   composicao,
        origem:        'Agente WhatsApp',
        imobiliariaId,
      },
    });

    if (modoManual) {
      await tx.historicoLead.create({
        data: {
          leadId:   lead.id,
          acao:     'Lead qualificado pelo agente — aguardando distribuição manual',
          detalhes: 'Distribuição manual ativa: corretor deve ser atribuído pelo gestor',
        },
      });
      return { lead, corretor: null };
    }

    const corretores = await tx.corretor.findMany({
      where: { imobiliariaId, ativo: true, disponivel: true },
      orderBy: { posicaoFila: 'asc' },
    });

    let corretor = null;

    if (corretores.length > 0) {
      const proximo    = corretores[0];
      const maxPosicao = corretores[corretores.length - 1].posicaoFila;

      await tx.corretor.update({
        where: { id: proximo.id },
        data: { leadsRecebidos: { increment: 1 }, posicaoFila: maxPosicao + 1 },
      });

      await tx.lead.update({
        where: { id: lead.id },
        data: { corretorId: proximo.id },
      });

      corretor = proximo;

      await tx.historicoLead.create({
        data: {
          leadId:   lead.id,
          acao:     'Lead qualificado pelo agente e atribuído automaticamente',
          detalhes: `Corretor: ${proximo.nome} | Origem: Agente WhatsApp`,
        },
      });
    } else {
      await tx.historicoLead.create({
        data: {
          leadId:   lead.id,
          acao:     'Lead qualificado pelo agente — sem corretor disponível',
          detalhes: 'Atribuição pendente: todos os corretores estão indisponíveis',
        },
      });
    }

    return { lead, corretor };
  });

  return result;
}

// ─── Comparação de telefones normalizados ────────────────────────────────────

function telefonesIguais(tel1, tel2) {
  const a = String(tel1).replace(/\D/g, '');
  const b = String(tel2).replace(/\D/g, '');
  return a.slice(-11) === b.slice(-11) || a.slice(-10) === b.slice(-10);
}

// ─── Handler principal ────────────────────────────────────────────────────────

async function receberMensagem(req, res) {
  const { telefone, mensagem, instancia, pushName } = req.body;
  const imobiliariaId = req.imobiliariaId;

  if (!telefone || !mensagem || !instancia) {
    return res.status(400).json({ error: 'Campos obrigatórios: telefone, mensagem, instancia' });
  }

  const telefoneLimpo = String(telefone).replace(/\D/g, '');

  if (!telefoneLimpo || telefoneLimpo.length < 10) {
    return res.status(400).json({ error: 'Telefone inválido' });
  }

  // Ignora mensagens enviadas por corretores ou gestores da própria imobiliária
  const corretoresDaImobiliaria = await prisma.corretor.findMany({
    where: { imobiliariaId },
    select: { telefone: true, whatsapp: true },
  });

  const ehCorretor = corretoresDaImobiliaria.some(
    (c) => telefonesIguais(telefoneLimpo, c.telefone) || telefonesIguais(telefoneLimpo, c.whatsapp),
  );

  if (ehCorretor) {
    return res.json({ ok: true, ignorado: 'corretor' });
  }

  const gestoresDaImobiliaria = await prisma.usuario.findMany({
    where: { imobiliariaId, telefone: { not: null } },
    select: { telefone: true },
  });

  const ehGestor = gestoresDaImobiliaria.some(
    (u) => telefonesIguais(telefoneLimpo, u.telefone),
  );

  if (ehGestor) {
    return res.json({ ok: true, ignorado: 'gestor' });
  }

  // 1. Busca ou cria sessão
  let sessao = await prisma.sessaoAgente.findUnique({
    where: { telefone_imobiliariaId_tipo: { telefone: telefoneLimpo, imobiliariaId, tipo: 'qualificacao' } },
  });

  if (!sessao) {
    let isNova = false;
    try {
      sessao = await prisma.sessaoAgente.create({
        data: {
          telefone:     telefoneLimpo,
          nome:         pushName || null,
          tipo:         'qualificacao',
          etapaAtual:   0,
          respostas:    {},
          status:       'em_andamento',
          instancia,
          imobiliariaId,
        },
      });
      isNova = true;
    } catch (err) {
      if (err.code !== 'P2002') throw err;
      // Criação concorrente: outro request já criou a sessão
      sessao = await prisma.sessaoAgente.findUnique({
        where: { telefone_imobiliariaId_tipo: { telefone: telefoneLimpo, imobiliariaId, tipo: 'qualificacao' } },
      });
      if (!sessao) throw err;
    }

    if (isNova) {
      // Primeira mensagem do lead → envia boas-vindas (etapa 0)
      await enviarMensagem(telefoneLimpo, getMensagem(0, null, null), instancia);
      return res.json({ ok: true, etapa: 0 });
    }
  }

  // 2. Sessão já finalizada → ignora
  if (sessao.status === 'finalizado') {
    return res.json({ ok: true, finalizado: true });
  }

  const etapaAtual = sessao.etapaAtual;
  const generoSalvo = sessao.respostas?.genero || null;

  // 3. Pergunta fora do escopo → responde e repete a pergunta atual (não avança)
  if (isPerguntaForaEscopo(mensagem)) {
    const perguntaAtual = getMensagem(etapaAtual, sessao.nome, generoSalvo);
    const resposta = `Essa informação o corretor vai te passar com todos os detalhes 😊 ${perguntaAtual}`;
    await enviarMensagem(telefoneLimpo, resposta, instancia);
    return res.json({ ok: true, etapa: etapaAtual, foraEscopo: true });
  }

  // 4. Salva resposta da etapa atual
  const respostasAtualizadas = { ...(sessao.respostas || {}), [`etapa${etapaAtual}`]: mensagem.trim() };

  // 5. Etapa 0 → salva como nome e detecta gênero
  let nomeAtualizado = sessao.nome;
  let generoAtualizado = generoSalvo;

  if (etapaAtual === 0) {
    nomeAtualizado = mensagem.trim();
    generoAtualizado = await detectarGenero(nomeAtualizado);
    respostasAtualizadas.genero = generoAtualizado;
  }

  // 6. Avança etapa
  const proximaEtapa = etapaAtual + 1;

  await prisma.sessaoAgente.update({
    where: { id: sessao.id },
    data: {
      etapaAtual: proximaEtapa,
      respostas:  respostasAtualizadas,
      nome:       nomeAtualizado,
      ...(proximaEtapa >= 6 ? { status: 'finalizado' } : {}),
    },
  });

  // 7. Envia mensagem da próxima etapa
  const textoProxima = getMensagem(proximaEtapa, nomeAtualizado, generoAtualizado);
  await enviarMensagem(telefoneLimpo, textoProxima, instancia);

  // 8. Se chegou na etapa 6 → cria lead no CRM (assíncrono, não bloqueia resposta)
  if (proximaEtapa >= 6) {
    const sessaoFinal = { ...sessao, respostas: respostasAtualizadas, nome: nomeAtualizado };
    criarLeadNoCRM(sessaoFinal, imobiliariaId).catch((err) => {
      console.error('[agente] Falha ao criar lead no CRM:', err.message);
    });
  }

  return res.json({ ok: true, etapa: proximaEtapa });
}

// ─── Triagem de número desconhecido (ConfigAgente.atenderNumeroDesconhecido) ──
//
// Usado pelo manager Baileys (server/whatsapp/manager.js) quando a mensagem vem
// de um número que ainda não é lead no CRM e a imobiliária optou por conversar
// antes de criar o lead, em vez de criar automaticamente. Este controller nunca
// envia mensagem no WhatsApp — só decide o quê responder; quem envia é o manager,
// dono do socket Baileys.
//
// Classificação e resposta vêm da mesma IA (OpenAI, já usada em `detectarGenero`
// acima e nos assistentes internos) — o objetivo é conversa natural, não um
// reconhecimento de palavras-chave. O limite de mensagens é só rede de segurança
// para a IA não ficar pedindo esclarecimento pra sempre; não é o caminho comum.

const LIMITE_MENSAGENS_TRIAGEM = 4; // troca esse tanto de mensagens sem confirmação → desiste

const MENSAGEM_TRIAGEM_FALLBACK =
  'Desculpa, pode repetir? Não consegui entender direito 🙂';

const CLASSIFICACOES_VALIDAS = ['lead_anuncio', 'corretor_parceiro', 'outro', 'indefinido'];

const SYSTEM_PROMPT_TRIAGEM = `Você é a assistente de triagem de uma imobiliária, respondendo pelo WhatsApp. A pessoa que está te escrevendo ainda não é um lead cadastrado no CRM. Sua tarefa é conduzir uma conversa curta, natural e cordial (nunca robótica ou de formulário) para descobrir quem é essa pessoa antes de qualificá-la como lead.

Classifique CADA mensagem em uma destas categorias:
- "lead_anuncio": a pessoa demonstra interesse genuíno em comprar ou alugar um imóvel (cliente em potencial).
- "corretor_parceiro": a pessoa se identifica como corretor(a), representante de outra imobiliária, ou propõe parceria/indicação comercial — não é cliente final.
- "outro": qualquer assunto que não seja interesse em imóvel nem parceria (número errado, spam, cobrança, suporte, reclamação, etc.).
- "indefinido": ainda não dá para saber com confiança — a conversa deve continuar.

Responda SEMPRE em JSON válido, exatamente neste formato:
{"classificacao": "lead_anuncio" | "corretor_parceiro" | "outro" | "indefinido", "resposta": "texto curto e natural para responder ao contato"}

Regras:
- Fale como uma pessoa real e atenciosa, nunca como um robô ou formulário.
- Nunca invente disponibilidade de imóveis, preços, prazos ou dados que você não tem.
- Se classificar como "lead_anuncio", a resposta deve confirmar de forma calorosa que um corretor vai continuar o atendimento.
- Se classificar como "corretor_parceiro" ou "outro", a resposta deve ser educada, breve, e encerrar a conversa sem prometer atendimento comercial.
- Se "indefinido", a resposta deve ser uma pergunta natural (não repetitiva) que ajude a entender se a pessoa busca um imóvel.`;

async function classificarViaIA(historico) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('[agente] OPENAI_API_KEY não configurada — triagem tratando mensagem como indefinida');
    return { classificacao: 'indefinido', resposta: MENSAGEM_TRIAGEM_FALLBACK };
  }

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: SYSTEM_PROMPT_TRIAGEM }, ...historico],
        response_format: { type: 'json_object' },
        max_tokens: 300,
        temperature: 0.6,
      },
      {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 10000,
      },
    );

    const bruto = response.data.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(bruto);

    const classificacao = CLASSIFICACOES_VALIDAS.includes(parsed.classificacao)
      ? parsed.classificacao
      : 'indefinido';
    const resposta = typeof parsed.resposta === 'string' && parsed.resposta.trim()
      ? parsed.resposta.trim()
      : MENSAGEM_TRIAGEM_FALLBACK;

    return { classificacao, resposta };
  } catch (err) {
    console.warn('[agente] Falha na triagem via IA — tratando como indefinido:', err.message);
    return { classificacao: 'indefinido', resposta: MENSAGEM_TRIAGEM_FALLBACK };
  }
}

async function obterTelefoneGestor(imobiliariaId) {
  const imobiliaria = await prisma.imobiliaria.findUnique({
    where: { id: imobiliariaId },
    select: {
      telefoneNotificacoes: true,
      usuarios: {
        where: { role: 'gestor', telefone: { not: null } },
        select: { telefone: true },
        orderBy: { criadoEm: 'asc' },
        take: 1,
      },
    },
  });
  return imobiliaria?.telefoneNotificacoes || imobiliaria?.usuarios?.[0]?.telefone || null;
}

async function notificarGestorTriagem(imobiliariaId, telefoneContato, motivo) {
  const telefoneGestor = await obterTelefoneGestor(imobiliariaId);
  if (!telefoneGestor) return;

  const textos = {
    corretor_parceiro: `🤝 O agente identificou que o contato ${telefoneContato} parece ser corretor(a)/parceiro(a), não um lead. Nenhum lead foi criado.`,
    outro: `ℹ️ O agente conversou com ${telefoneContato}, mas não era sobre interesse em imóvel. Nenhum lead foi criado.`,
    limite_mensagens: `🤔 O agente conversou com ${telefoneContato} mas não conseguiu confirmar se é um lead depois de algumas mensagens. A conversa foi encerrada sem criar lead — avalie se vale um contato manual.`,
  };

  await enviarWhatsApp(telefoneGestor, textos[motivo] || textos.limite_mensagens, imobiliariaId);
}

// Cria (1ª mensagem) ou atualiza (mensagens seguintes) a sessão de triagem numa
// única chamada atômica — evita a corrida de criação concorrente sem precisar
// do try/create + catch P2002 usado no fluxo de qualificação acima.
function salvarSessaoTriagem({ telefoneLimpo, pushName, instancia, imobiliariaId, numeroMensagens, historico, status, motivoDescarte }) {
  const respostas = motivoDescarte ? { historico, _motivoDescarte: motivoDescarte } : { historico };

  return prisma.sessaoAgente.upsert({
    where: { telefone_imobiliariaId_tipo: { telefone: telefoneLimpo, imobiliariaId, tipo: 'triagem' } },
    update: { etapaAtual: numeroMensagens, respostas, status },
    create: {
      telefone: telefoneLimpo,
      nome: pushName || null,
      tipo: 'triagem',
      etapaAtual: numeroMensagens,
      respostas,
      status,
      instancia,
      imobiliariaId,
    },
  });
}

// POST /api/agente/triagem
async function processarTriagem(req, res) {
  const { telefone, mensagem, instancia, pushName } = req.body;
  const imobiliariaId = req.imobiliariaId;

  if (!telefone || !mensagem || !instancia) {
    return res.status(400).json({ error: 'Campos obrigatórios: telefone, mensagem, instancia' });
  }

  const telefoneLimpo = String(telefone).replace(/\D/g, '');
  if (!telefoneLimpo || telefoneLimpo.length < 10) {
    return res.status(400).json({ error: 'Telefone inválido' });
  }

  const sessao = await prisma.sessaoAgente.findUnique({
    where: { telefone_imobiliariaId_tipo: { telefone: telefoneLimpo, imobiliariaId, tipo: 'triagem' } },
  });

  // Sessão já concluída (virou lead, foi descartada ou bateu o limite) — não responde mais.
  if (sessao && sessao.status !== 'em_andamento') {
    return res.json({ ok: true, acao: 'ignorado' });
  }

  const historicoAnterior = sessao?.respostas?.historico || [];
  const historico = [...historicoAnterior, { role: 'user', content: mensagem.trim() }];
  const numeroMensagens = (sessao?.etapaAtual || 0) + 1;
  const noLimite = numeroMensagens >= LIMITE_MENSAGENS_TRIAGEM;

  const { classificacao, resposta } = await classificarViaIA(historico);
  const historicoFinal = [...historico, { role: 'assistant', content: resposta }];

  const salvarComum = (status, motivoDescarte) => salvarSessaoTriagem({
    telefoneLimpo, pushName, instancia, imobiliariaId, numeroMensagens, historico: historicoFinal, status, motivoDescarte,
  });

  if (classificacao === 'lead_anuncio') {
    await salvarComum('finalizado');
    return res.json({ ok: true, acao: 'lead_confirmado', mensagemResposta: resposta });
  }

  if (classificacao === 'corretor_parceiro' || classificacao === 'outro') {
    await salvarComum('descartado', classificacao);
    notificarGestorTriagem(imobiliariaId, telefoneLimpo, classificacao).catch((err) => {
      console.error('[agente] Falha ao notificar gestor (triagem):', err.message);
    });
    return res.json({ ok: true, acao: 'descartado', mensagemResposta: resposta });
  }

  // "indefinido": no limite de mensagens é exceção — desiste em vez de insistir pra sempre
  if (noLimite) {
    await salvarComum('descartado', 'limite_mensagens');
    notificarGestorTriagem(imobiliariaId, telefoneLimpo, 'limite_mensagens').catch((err) => {
      console.error('[agente] Falha ao notificar gestor (triagem):', err.message);
    });
    return res.json({ ok: true, acao: 'descartado' });
  }

  // Caminho comum: ainda indefinido, dentro do limite — segue a conversa
  await salvarComum('em_andamento');
  return res.json({ ok: true, acao: 'pergunta', mensagemResposta: resposta });
}

module.exports = { receberMensagem, processarTriagem };
