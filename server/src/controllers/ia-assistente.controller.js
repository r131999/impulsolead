'use strict';

const axios = require('axios');

const prisma = require('../lib/prisma');

const SYSTEM_PROMPT =
  'Você é um expert em vendas imobiliárias e comunicação via WhatsApp. Sua missão é ajudar corretores a conversar de forma humanizada, genuína e persuasiva com leads. Analise o histórico da conversa, identifique o perfil do lead (tom de linguagem, nível de interesse, objeções) e sugira 3 respostas curtas, naturais e humanizadas. NUNCA use linguagem robótica, vendedora demais ou com muitos emojis. As respostas devem parecer de uma pessoa real e atenciosa.';

const CAMPOS_QUALIFICACAO = [
  'primeiroImovel', 'tipoRenda', 'rendaMensal', 'restricaoCpf',
  'valorEntrada', 'urgencia', 'regiao', 'faixaValor',
];

const LABELS_QUALIFICACAO = {
  primeiroImovel: 'Primeiro imóvel',
  tipoRenda: 'Tipo de renda',
  rendaMensal: 'Renda mensal',
  restricaoCpf: 'Restrição CPF',
  valorEntrada: 'Valor de entrada',
  urgencia: 'Urgência',
  regiao: 'Região',
  faixaValor: 'Faixa de valor',
};

async function sugerirResposta(req, res) {
  try {
    const { leadId } = req.params;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'OPENAI_API_KEY não configurada no servidor' });
    }

    const wherePermissao = { id: leadId, imobiliariaId: req.imobiliariaId };
    if (req.role === 'corretor') wherePermissao.corretorId = req.corretorId;

    const lead = await prisma.lead.findFirst({
      where: wherePermissao,
      select: {
        id: true, nome: true, interesse: true,
        primeiroImovel: true, tipoRenda: true, rendaMensal: true,
        restricaoCpf: true, valorEntrada: true, urgencia: true,
        regiao: true, faixaValor: true,
      },
    });
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

    const mensagens = await prisma.mensagemLead.findMany({
      where: { leadId },
      orderBy: { criadoEm: 'asc' },
      select: { remetenteTipo: true, remetenteNome: true, conteudo: true, criadoEm: true },
    });

    if (mensagens.length === 0) {
      return res.status(400).json({ error: 'Nenhuma mensagem encontrada para sugerir resposta' });
    }

    const historicoFormatado = mensagens
      .filter((m) => m.conteudo)
      .map((m) => {
        const quem = m.remetenteTipo === 'lead' ? lead.nome : m.remetenteNome;
        return `${quem}: ${m.conteudo}`;
      })
      .join('\n');

    const dadosQual = CAMPOS_QUALIFICACAO
      .filter((c) => lead[c])
      .map((c) => `${LABELS_QUALIFICACAO[c]}: ${lead[c]}`)
      .join('\n');

    const contexto = [
      `Lead: ${lead.nome}`,
      lead.interesse ? `Interesse: ${lead.interesse}` : null,
      dadosQual ? `\nQualificação:\n${dadosQual}` : null,
      `\nHistórico da conversa:\n${historicoFormatado}`,
    ].filter(Boolean).join('\n');

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `${contexto}\n\nSugira 3 respostas para a última mensagem do lead. Responda APENAS em JSON: [{"opcao": 1, "texto": "..."}, {"opcao": 2, "texto": "..."}, {"opcao": 3, "texto": "..."}]`,
          },
        ],
        max_tokens: 600,
        temperature: 0.8,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const raw = response.data.choices[0].message.content.trim();

    let sugestoes;
    try {
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      sugestoes = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch {
      return res.status(500).json({ error: 'Erro ao interpretar sugestões da IA' });
    }

    res.json({ sugestoes });
  } catch (err) {
    console.error('[ia-assistente] sugerirResposta:', err.message);
    res.status(500).json({ error: 'Erro ao sugerir resposta' });
  }
}

module.exports = { sugerirResposta };
