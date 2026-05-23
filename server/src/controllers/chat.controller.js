const axios = require('axios');

const prisma = require('../lib/prisma');

const SYSTEM_PROMPT =
  'Você é um assistente especializado para corretores de imóveis. Você tem acesso ao catálogo completo de imóveis da imobiliária e também dá dicas de vendas, como abordar clientes e como responder mensagens de leads. Responda de forma direta, objetiva e profissional. Se não souber a resposta com base no catálogo, diga claramente.';

function formatarCatalogo(imoveis) {
  if (!imoveis.length) return 'Nenhum imóvel cadastrado no catálogo no momento.';

  return imoveis
    .map((im, i) => {
      const linhas = [
        `${i + 1}. ${im.nome} (${im.tipo})`,
        `   Localização: ${im.localizacao}`,
        `   Status: ${im.status}`,
      ];
      if (im.quartos) linhas.push(`   Quartos: ${im.quartos}`);
      if (im.area) linhas.push(`   Área: ${im.area}`);
      if (im.valorMin || im.valorMax) {
        const min = im.valorMin ? `R$ ${im.valorMin.toLocaleString('pt-BR')}` : '';
        const max = im.valorMax ? `R$ ${im.valorMax.toLocaleString('pt-BR')}` : '';
        const faixa = min && max ? `${min} a ${max}` : min || max;
        linhas.push(`   Valor: ${faixa}`);
      }
      if (im.destaque) linhas.push('   Destaque: sim');
      linhas.push(`   Descrição: ${im.descricao}`);
      return linhas.join('\n');
    })
    .join('\n\n');
}

async function chat(req, res) {
  const { mensagem } = req.body;
  if (!mensagem?.trim()) {
    return res.status(400).json({ error: 'Mensagem é obrigatória' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY não configurada no servidor' });
  }

  const imoveis = await prisma.imovel.findMany({
    where: {
      imobiliariaId: req.imobiliariaId,
      status: { not: 'vendido' },
    },
    orderBy: [{ destaque: 'desc' }, { criadoEm: 'desc' }],
  });

  const catalogo = formatarCatalogo(imoveis);

  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `${SYSTEM_PROMPT}\n\nCATÁLOGO DE IMÓVEIS DA IMOBILIÁRIA:\n\n${catalogo}`,
        },
        {
          role: 'user',
          content: mensagem.trim(),
        },
      ],
      max_tokens: 800,
      temperature: 0.7,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const resposta = response.data.choices[0].message.content;
  res.json({ resposta });
}

module.exports = { chat };
