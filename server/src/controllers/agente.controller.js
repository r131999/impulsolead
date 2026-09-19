const axios = require('axios');
const https = require('https');
const http = require('http');

const prisma = require('../lib/prisma');
const { enviarWhatsApp, notificarCorretorCloudApi } = require('../services/notificacao.service');
const { proximoCorretor } = require('../services/fila.service');
const { enviarPushCorretor } = require('./push.controller');
const { emitirMensagem } = require('../services/socketio.service');

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

// Bloco de texto livre que o gestor escreve na tela do Agente de IA — vale para
// os dois prompts (triagem e qualificação). Fica no fim do prompt, de propósito:
// tem peso real sobre tom/ênfase/conteúdo, mas a moldura deixa explícito que ele
// complementa o fluxo, não o substitui — o gestor pode escrever algo tipo "não
// faça perguntas" ou "sempre transfira na hora" sem quebrar a classificação e o
// formato JSON definidos acima, que são a parte que o resto do sistema depende.
function buildBlocoInstrucoesPersonalizadas(instrucoesPersonalizadas) {
  if (!instrucoesPersonalizadas || !instrucoesPersonalizadas.trim()) return '';
  return `\n\nInstruções específicas desta imobiliária (escritas pelo gestor — siga-as em tom, ênfase e conteúdo sempre que possível):\n${instrucoesPersonalizadas.trim()}\n\nEssas instruções complementam a conversa, mas NUNCA substituem o formato de resposta em JSON nem as regras de classificação definidas acima. Se alguma instrução conflitar diretamente com elas (ex.: pedir para não classificar, pular etapas do formato ou nunca perguntar nada), siga o fluxo estrutural mesmo assim e aplique a instrução do gestor só no que for compatível (tom, ênfase, o que mencionar ou evitar).`;
}

function buildSystemPromptTriagem(qualificacaoAutomatica, nomeAgente, tomAgente, instrucoesPersonalizadas) {
  // A regra do "lead_anuncio" muda conforme o que acontece depois da confirmação:
  // sem qualificação automática, o corretor assume na hora (promessa correta);
  // com ela ligada, é a própria Lia quem continua a conversa — prometer um
  // corretor aqui seria falso e quebraria a continuidade pedida no fluxo.
  const regraLeadAnuncio = qualificacaoAutomatica
    ? '- Se classificar como "lead_anuncio", a resposta deve confirmar de forma calorosa o interesse, sem prometer um corretor — apenas diga que você vai continuar te ajudando a entender melhor o que a pessoa procura.'
    : '- Se classificar como "lead_anuncio", a resposta deve confirmar de forma calorosa que um corretor vai continuar o atendimento.';

  return `Você é ${nomeAgente}, assistente de triagem de uma imobiliária, respondendo pelo WhatsApp. A pessoa que está te escrevendo ainda não é um lead cadastrado no CRM. Sua tarefa é conduzir uma conversa curta, natural e cordial (nunca robótica ou de formulário) para descobrir quem é essa pessoa antes de qualificá-la como lead.

Tom de voz: ${tomAgente}. Mantenha esse tom em todas as respostas, sem perder a naturalidade.

Classifique CADA mensagem em uma destas categorias:
- "lead_anuncio": a pessoa demonstra interesse genuíno em comprar ou alugar um imóvel (cliente em potencial).
- "corretor_parceiro": a pessoa se identifica como corretor(a), representante de outra imobiliária, ou propõe parceria/indicação comercial — não é cliente final.
- "outro": qualquer assunto que não seja interesse em imóvel nem parceria (número errado, spam, cobrança, suporte, reclamação, etc.).
- "indefinido": ainda não dá para saber com confiança — a conversa deve continuar.

Responda SEMPRE em JSON válido, exatamente neste formato:
{"classificacao": "lead_anuncio" | "corretor_parceiro" | "outro" | "indefinido", "resposta": "texto curto e natural para responder ao contato"}

Regras:
- Fale como uma pessoa real e atenciosa, nunca como um robô ou formulário. Se perguntarem seu nome, ou for natural se apresentar, diga que é ${nomeAgente} — nunca "assistente da imobiliária" ou qualquer coisa genérica.
- Antes de emendar a próxima pergunta ou frase, reconheça o que a pessoa acabou de dizer — responda ao conteúdo, não só busque a próxima informação. Se a pessoa deu uma resposta longa, curiosa ou emocional, acolha antes de seguir; não dispare pergunta atrás de pergunta.
- Se souber o nome da pessoa, use-o com naturalidade — não em toda frase, só quando soar como uma pessoa de verdade falaria.
- Se a pessoa corrigir algo que já disse ("na verdade não", "quis dizer X", "me confundi"), trate como correção da informação anterior — nunca como resposta a uma pergunta diferente.
- Nunca invente disponibilidade de imóveis, preços, prazos ou dados que você não tem.
- Nunca comente, opine, confirme ou negue características de imóveis, empreendimentos, bairros ou condomínios específicos (localização, entrega, metragem, valor, diferenciais, se é lançamento, etc.), mesmo que a pessoa já tenha trazido a informação ou pergunte se algo está certo — você não tem esses dados e errar aqui é grave. Pode reconhecer o que ela mencionou ou perguntou (ex.: "Entendi, você tem interesse no Bossa!") e seguir a conversa, mas sem confirmar, negar, qualificar ou descrever nada sobre o imóvel. Se perguntarem detalhes específicos, diga que o corretor passa todas as informações.
- Nunca elogie o comportamento, a decisão ou as escolhas da pessoa (ex.: "você está fazendo um ótimo trabalho pesquisando", "boa escolha"). Acolher e validar o que ela sente é bem-vindo; elogiar a atitude dela soa artificial.
${regraLeadAnuncio}
- Se classificar como "corretor_parceiro" ou "outro", a resposta deve ser educada, breve, e encerrar a conversa sem prometer atendimento comercial.
- Se "indefinido", a resposta deve ser uma pergunta natural (não repetitiva) que ajude a entender se a pessoa busca um imóvel.${buildBlocoInstrucoesPersonalizadas(instrucoesPersonalizadas)}`;
}

async function classificarViaIA(historico, qualificacaoAutomatica = false, nomeAgente = 'Lia', tomAgente = 'profissional mas leve', instrucoesPersonalizadas = null) {
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
        messages: [{ role: 'system', content: buildSystemPromptTriagem(qualificacaoAutomatica, nomeAgente, tomAgente, instrucoesPersonalizadas) }, ...historico],
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

  const configAgente = await prisma.configAgente.findUnique({
    where: { imobiliariaId },
    select: { qualificacaoAutomatica: true, nomeAgente: true, tomAgente: true, instrucoesPersonalizadas: true },
  });

  const { classificacao, resposta } = await classificarViaIA(
    historico,
    !!configAgente?.qualificacaoAutomatica,
    configAgente?.nomeAgente || 'Lia',
    configAgente?.tomAgente || 'profissional mas leve',
    configAgente?.instrucoesPersonalizadas || null,
  );
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

// ─── Qualificação automática (ConfigAgente.qualificacaoAutomatica) ────────────
//
// Usado pelo manager Baileys quando o lead já foi criado (direto ou via triagem
// confirmada) e a imobiliária ligou o toggle: em vez de notificar o corretor na
// hora, a Lia conduz o roteiro de ConfigAgente.perguntas como guia de conversa
// (não um formulário lido em ordem) até uma das quatro saídas abaixo. Só então o
// corretor é notificado, com o que foi coletado gravado em Lead.respostasFormulario
// (mesmo campo/formato que leads de Meta Ads já usam, para reaproveitar a UI existente).
//
// Igual à triagem, este controller nunca fala com o WhatsApp diretamente — só
// decide o texto; quem envia é o manager, dono do socket Baileys.

const LIMITE_MENSAGENS_QUALIFICACAO = 20; // roteiro padrão tem ~8 perguntas; até 2 idas-e-voltas cada + folga — rede de segurança, não o caminho comum (mesmo espírito do limite da triagem)

const MENSAGEM_QUALIFICACAO_FALLBACK =
  'Desculpa, pode repetir? Não consegui entender direito 🙂';

const CLASSIFICACOES_QUALIFICACAO_VALIDAS = ['andamento', 'concluido', 'transferir_humano'];

function buildSystemPromptQualificacao(perguntas, coletadoAtual, nomeAgente, tomAgente, instrucoesPersonalizadas) {
  const roteiro = (Array.isArray(perguntas) && perguntas.length ? perguntas : [
    'Nome', 'Motivação para buscar um imóvel', 'Região de interesse', 'Renda familiar aproximada',
  ]).map((p, i) => `${i + 1}. ${p}`).join('\n');

  const coletadoTexto = coletadoAtual && Object.keys(coletadoAtual).length
    ? JSON.stringify(coletadoAtual)
    : '(nada coletado ainda)';

  return `Você é ${nomeAgente}, assistente de qualificação de uma imobiliária, conversando pelo WhatsApp com uma pessoa que ACABOU de confirmar interesse em um imóvel — já é um lead no CRM. Sua tarefa é conduzir uma conversa curta, natural e cordial para descobrir as informações do roteiro abaixo, usando-o como guia do que precisa saber — nunca como um formulário lido pergunta por pergunta.

Tom de voz: ${tomAgente}. Mantenha esse tom em todas as respostas, sem perder a naturalidade.

Roteiro do que você precisa descobrir:
${roteiro}

O que já foi coletado até agora (não pergunte de novo o que já está aqui):
${coletadoTexto}

Responda SEMPRE em JSON válido, exatamente neste formato:
{"classificacao": "andamento" | "concluido" | "transferir_humano", "resposta": "texto curto e natural para responder ao contato", "coletado": {"<pergunta do roteiro>": "<o que foi entendido, resumido>"}}

Regras:
- "coletado" deve trazer o estado ATUALIZADO e COMPLETO de tudo que você já sabe (o que já estava + o que esta mensagem acrescentou), usando o texto de cada pergunta do roteiro como chave.
- Se perguntarem seu nome, ou for natural se apresentar, diga que é ${nomeAgente} — nunca "assistente da imobiliária" ou qualquer coisa genérica.
- Fale como uma pessoa real e atenciosa, nunca como um robô ou formulário. Antes de emendar a próxima pergunta, reconheça o que a pessoa acabou de responder — um comentário curto, genuíno, sobre o que ela disse — em vez de só coletar o dado e seguir para a próxima pergunta do roteiro.
- Uma pergunta por vez, sem repetir o que já foi respondido. Adapte o ritmo: se a resposta veio curta e direta, siga; se veio longa ou revelou algo importante (ex: dificuldade financeira, urgência, motivo pessoal), acolha antes de continuar — não dispare pergunta atrás de pergunta.
- Se souber o nome da pessoa, use-o com naturalidade — não em toda frase, só quando soar como uma pessoa de verdade falaria, não um script.
- Se a pessoa corrigir uma resposta que já deu (ex: "tenho" → "não tenho", "na verdade é X", "me confundi, é Y"), trate como correção do dado JÁ coletado: atualize a chave correspondente em "coletado" com o valor corrigido, sobrescrevendo o anterior. NUNCA aplique a correção como resposta a uma pergunta diferente ou nova — se a mensagem só contém a correção, não avance o roteiro nessa resposta.
- Nunca invente disponibilidade de imóveis, preços, prazos ou dados que você não tem.
- Nunca comente, opine, confirme ou negue características de imóveis, empreendimentos, bairros ou condomínios específicos (localização, entrega, metragem, valor, diferenciais, se é lançamento, etc.), mesmo que a pessoa já tenha trazido a informação ou pergunte se algo está certo (ex.: "o Bossa não é um lançamento?") — você não tem esses dados e errar aqui é grave (são leads de imóveis de alto valor). Pode reconhecer o que ela mencionou ou perguntou (ex.: "Entendi, você tem interesse no Bossa") e seguir com a próxima pergunta, mas sem confirmar, negar, qualificar ou descrever nada sobre o imóvel. Se perguntarem detalhes específicos, diga que o corretor passa todas as informações.
- Nunca elogie o comportamento, a decisão ou as escolhas da pessoa (ex.: "você está fazendo um ótimo trabalho pesquisando", "boa escolha"). Acolher e validar o que ela sente é bem-vindo; elogiar a atitude dela soa artificial.
- O texto de "resposta" tem que ser sempre coerente com a "classificacao" que você está retornando NESSA mensagem. Se classificar como "andamento", a resposta NUNCA pode soar como um encerramento ou despedida (nada de "um corretor vai te contatar", "combinado então", "qualquer coisa é só chamar", "foi um prazer") — a conversa continua e a próxima pergunta do roteiro vem naturalmente. Frases de encerramento só podem aparecer na mensagem em que você de fato classifica como "concluido" ou "transferir_humano", nunca antes disso.
- Lead real chega querendo informação, não querendo ser entrevistado — perguntar sobre o imóvel, o empreendimento, valores ou condições é o comportamento mais comum e NÃO é motivo para transferir. Nesses casos, classifique como "andamento": reconheça a pergunta, diga que o consultor vai trazer esses detalhes, e emende naturalmente para a próxima pergunta do roteiro.
- Só classifique como "transferir_humano" quando a pessoa pedir explicitamente para falar com um humano/atendente/corretor, ou demonstrar recusa clara em continuar respondendo (ex.: "não quero responder isso", "para de perguntar"). Fazer perguntas, mesmo repetidas, não é recusa.
- Classifique como "concluido" quando já tiver o essencial do roteiro (não precisa 100% se a pessoa já demonstrou impaciência) — a resposta deve agradecer e avisar que um corretor vai continuar o atendimento a partir daqui.
- Caso contrário, classifique como "andamento" e siga com a próxima pergunta natural do roteiro.${buildBlocoInstrucoesPersonalizadas(instrucoesPersonalizadas)}`;
}

async function classificarQualificacaoViaIA(historico, perguntas, coletadoAtual, nomeAgente = 'Lia', tomAgente = 'profissional mas leve', instrucoesPersonalizadas = null) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('[agente] OPENAI_API_KEY não configurada — qualificação automática transferindo para humano');
    return { classificacao: 'transferir_humano', resposta: MENSAGEM_QUALIFICACAO_FALLBACK, coletado: coletadoAtual || {} };
  }

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: buildSystemPromptQualificacao(perguntas, coletadoAtual, nomeAgente, tomAgente, instrucoesPersonalizadas) }, ...historico],
        response_format: { type: 'json_object' },
        max_tokens: 500,
        temperature: 0.6,
      },
      {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 10000,
      },
    );

    const bruto = response.data.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(bruto);

    const classificacao = CLASSIFICACOES_QUALIFICACAO_VALIDAS.includes(parsed.classificacao)
      ? parsed.classificacao
      : 'andamento';
    const resposta = typeof parsed.resposta === 'string' && parsed.resposta.trim()
      ? parsed.resposta.trim()
      : MENSAGEM_QUALIFICACAO_FALLBACK;
    const coletado = (parsed.coletado && typeof parsed.coletado === 'object' && !Array.isArray(parsed.coletado))
      ? parsed.coletado
      : (coletadoAtual || {});

    return { classificacao, resposta, coletado };
  } catch (err) {
    console.warn('[agente] Falha na qualificação via IA — mantendo em andamento:', err.message);
    return { classificacao: 'andamento', resposta: MENSAGEM_QUALIFICACAO_FALLBACK, coletado: coletadoAtual || {} };
  }
}

const MOTIVO_LABEL_QUALIFICACAO = {
  concluido: 'Qualificação automática concluída pela Lia',
  transferencia_humana: 'Lead pediu para falar com um atendente — transferido pela Lia',
  timeout: 'Lead não respondeu dentro do tempo configurado — qualificação encerrada pela Lia',
  limite_mensagens: 'Qualificação atingiu o limite de mensagens — encerrada pela Lia',
};

// Encerra a qualificação e só AQUI o corretor entra em cena — chamada tanto pelo
// fim natural da conversa (processarQualificacao abaixo) quanto pelo cron de
// timeout (cron.service.js:verificarQualificacoesInativas). O updateMany com
// where emQualificacaoAutomatica:true funciona como trava atômica: se as duas
// chamadas colidirem (IA concluindo bem na hora em que o cron dispara), só uma
// delas consegue flipar o campo e seguir com a distribuição.
async function finalizarQualificacao(leadId, imobiliariaId, { coletado, motivo }) {
  const guard = await prisma.lead.updateMany({
    where: { id: leadId, emQualificacaoAutomatica: true },
    data: { emQualificacaoAutomatica: false },
  });
  if (guard.count === 0) {
    console.log(`[agente] finalizarQualificacao (${leadId}) — ignorado, já não estava em qualificação (motivo tentado: ${motivo})`);
    return; // já finalizada por outro caminho
  }
  console.log(`[agente] finalizarQualificacao (${leadId}) — motivo=${motivo}`);

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return;

  // As chaves de "coletado" são o texto da pergunta como a IA de fato o formulou
  // na resposta (buildSystemPromptQualificacao só entrega o roteiro como guia —
  // na prática ela parafraseia/encurta), então não dá pra casar contra o array
  // `perguntas` (config, literal) por igualdade de string — nunca bate e o campo
  // fica sempre vazio. Usa direto as chaves reais de `coletado`.
  const respostasFormulario = Object.entries(coletado || {})
    .filter(([, resposta]) => resposta)
    .map(([pergunta, resposta]) => ({ pergunta, resposta }));

  const configAgente = await prisma.configAgente.findUnique({
    where: { imobiliariaId },
    select: { distribuicaoManual: true },
  });
  const modoManual = configAgente?.distribuicaoManual ?? false;

  const corretor = modoManual ? null : await proximoCorretor(imobiliariaId);
  const label = MOTIVO_LABEL_QUALIFICACAO[motivo] || 'Qualificação automática encerrada';

  await prisma.$transaction(async (tx) => {
    await tx.lead.update({
      where: { id: leadId },
      data: {
        ...(respostasFormulario.length && { respostasFormulario }),
        ...(corretor && { corretorId: corretor.id }),
      },
    });

    if (corretor) {
      await tx.historicoLead.create({
        data: {
          leadId,
          acao: `${label} — lead atribuído`,
          detalhes: `Corretor: ${corretor.nome}`,
        },
      });
      await tx.historicoDistribuicao.create({
        data: {
          leadId,
          leadNome: lead.nome,
          leadTelefone: lead.telefone,
          corretorId: corretor.id,
          corretorNome: corretor.nome,
          distribuidoPor: 'automatico',
          imobiliariaId,
        },
      });
    } else {
      await tx.historicoLead.create({
        data: {
          leadId,
          acao: `${label} — ${modoManual ? 'aguardando distribuição manual' : 'sem corretor disponível'}`,
        },
      });
    }
  });

  if (corretor) {
    console.log(`[agente] finalizarQualificacao (${leadId}) — atribuído a ${corretor.nome}, notificando`);
    const leadAtualizado = await prisma.lead.findUnique({ where: { id: leadId } });
    notificarCorretorCloudApi(corretor, leadAtualizado).catch(() => {});
    enviarPushCorretor(
      corretor.id,
      '🏠 Novo lead qualificado!',
      `Nome: ${leadAtualizado.nome} | Tel: ${leadAtualizado.telefone}`,
    ).catch(() => {});
  } else {
    console.log(`[agente] finalizarQualificacao (${leadId}) — sem corretor (modo manual ou fila vazia)`);
  }
}

// POST /api/agente/qualificacao
// Grava uma mensagem "ao vivo" da qualificação no chat do lead (diferente do
// backfill de triagem em webhook.controller.js, que é retroativo) — dedup por
// whatsappMsgId no lado do lead evita duplicar em caso de retry do manager.
async function registrarMensagemQualificacao({ leadId, imobiliariaId, remetenteTipo, remetenteNome, conteudo, whatsappMsgId }) {
  if (!conteudo) return;

  if (whatsappMsgId) {
    const existe = await prisma.mensagemLead.findFirst({ where: { whatsappMsgId }, select: { id: true } });
    if (existe) return;
  }

  const mensagem = await prisma.mensagemLead.create({
    data: {
      leadId,
      remetenteTipo,
      remetenteNome,
      conteudo,
      tipoMidia: 'texto',
      whatsappMsgId: whatsappMsgId || null,
      lida: remetenteTipo !== 'lead', // saída da Lia já "lida"; do lead fica pendente pro corretor ver
      imobiliariaId,
    },
  });
  emitirMensagem(leadId, mensagem);
}

async function processarQualificacao(req, res) {
  const { telefone, mensagem, instancia, pushName, whatsappMsgId } = req.body;
  const imobiliariaId = req.imobiliariaId;
  console.log(`[agente] POST /qualificacao recebido — telefone=${telefone} imobiliaria=${imobiliariaId}`);

  if (!telefone || !mensagem || !instancia) {
    return res.status(400).json({ error: 'Campos obrigatórios: telefone, mensagem, instancia' });
  }

  const telefoneLimpo = String(telefone).replace(/\D/g, '');
  if (!telefoneLimpo || telefoneLimpo.length < 10) {
    return res.status(400).json({ error: 'Telefone inválido' });
  }

  const sessao = await prisma.sessaoAgente.findUnique({
    where: { telefone_imobiliariaId_tipo: { telefone: telefoneLimpo, imobiliariaId, tipo: 'qualificacao_ia' } },
  });

  // Sem sessão ativa (já finalizada, ou esse telefone nunca entrou em qualificação
  // automática) — nada a fazer. O manager só chama esta rota quando o lead ainda
  // está com emQualificacaoAutomatica=true, mas a checagem aqui é redundante de propósito.
  if (!sessao || sessao.status !== 'em_andamento') {
    console.log(`[agente] qualificação ignorada (${telefoneLimpo}) — sessão ${sessao ? `status=${sessao.status}` : 'inexistente'}`);
    return res.json({ ok: true, acao: 'ignorado' });
  }

  const leadId = sessao.respostas?.leadId;
  if (!leadId) {
    console.log(`[agente] qualificação ignorada (${telefoneLimpo}) — sessão sem leadId em respostas`);
    return res.json({ ok: true, acao: 'ignorado' });
  }

  // Retry do manager pra uma mensagem já processada — não reprocessa nem chama a IA de novo.
  if (whatsappMsgId) {
    const jaProcessada = await prisma.mensagemLead.findFirst({ where: { whatsappMsgId }, select: { id: true } });
    if (jaProcessada) return res.json({ ok: true, acao: 'ignorado', dedup: true });
  }

  const configAgente = await prisma.configAgente.findUnique({
    where: { imobiliariaId },
    select: { perguntas: true, nomeAgente: true, tomAgente: true, instrucoesPersonalizadas: true },
  });
  const perguntas = Array.isArray(configAgente?.perguntas) ? configAgente.perguntas : [];
  const nomeAgente = configAgente?.nomeAgente || 'Lia';
  const tomAgente = configAgente?.tomAgente || 'profissional mas leve';
  const instrucoesPersonalizadas = configAgente?.instrucoesPersonalizadas || null;

  await registrarMensagemQualificacao({
    leadId, imobiliariaId, remetenteTipo: 'lead',
    remetenteNome: sessao.nome || pushName || 'Lead',
    conteudo: mensagem.trim(), whatsappMsgId,
  });

  const historicoAnterior = Array.isArray(sessao.respostas?.historico) ? sessao.respostas.historico : [];
  const historico = [...historicoAnterior, { role: 'user', content: mensagem.trim() }];
  const numeroMensagens = (sessao.etapaAtual || 0) + 1;
  const coletadoAnterior = sessao.respostas?.coletado || {};
  const noLimite = numeroMensagens >= LIMITE_MENSAGENS_QUALIFICACAO;

  const { classificacao, resposta, coletado } = await classificarQualificacaoViaIA(historico, perguntas, coletadoAnterior, nomeAgente, tomAgente, instrucoesPersonalizadas);
  const historicoFinal = [...historico, { role: 'assistant', content: resposta }];
  console.log(`[agente] qualificação (${telefoneLimpo}) — msg ${numeroMensagens}/${LIMITE_MENSAGENS_QUALIFICACAO} — classificacao=${classificacao}`);

  await registrarMensagemQualificacao({
    leadId, imobiliariaId, remetenteTipo: 'assistente', remetenteNome: nomeAgente, conteudo: resposta,
  });

  const salvarSessao = (status) => prisma.sessaoAgente.update({
    where: { id: sessao.id },
    data: { etapaAtual: numeroMensagens, respostas: { leadId, historico: historicoFinal, coletado }, status },
  });

  if (classificacao === 'transferir_humano') {
    await salvarSessao('finalizado');
    await finalizarQualificacao(leadId, imobiliariaId, { coletado, motivo: 'transferencia_humana' });
    return res.json({ ok: true, acao: 'transferido', mensagemResposta: resposta });
  }

  if (classificacao === 'concluido' || noLimite) {
    await salvarSessao('finalizado');
    const motivo = classificacao === 'concluido' ? 'concluido' : 'limite_mensagens';
    await finalizarQualificacao(leadId, imobiliariaId, { coletado, motivo });
    return res.json({ ok: true, acao: 'concluido', mensagemResposta: resposta });
  }

  // Caminho comum: ainda em andamento, dentro do limite — segue a conversa
  await salvarSessao('em_andamento');
  return res.json({ ok: true, acao: 'pergunta', mensagemResposta: resposta });
}

module.exports = { receberMensagem, processarTriagem, processarQualificacao, finalizarQualificacao };
