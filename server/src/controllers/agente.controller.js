const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const https = require('https');
const http = require('http');

const prisma = new PrismaClient();

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
    where: { telefone_imobiliariaId: { telefone: telefoneLimpo, imobiliariaId } },
  });

  if (!sessao) {
    sessao = await prisma.sessaoAgente.create({
      data: {
        telefone:     telefoneLimpo,
        nome:         pushName || null,
        etapaAtual:   0,
        respostas:    {},
        status:       'em_andamento',
        instancia,
        imobiliariaId,
      },
    });

    // Primeira mensagem do lead → envia boas-vindas (etapa 0)
    await enviarMensagem(telefoneLimpo, getMensagem(0, null, null), instancia);
    return res.json({ ok: true, etapa: 0 });
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

module.exports = { receberMensagem };
