const { PrismaClient } = require('@prisma/client');
const { parse } = require('csv-parse/sync');
const XLSX = require('xlsx');
const { notificarCorretor } = require('../services/notificacao.service');

const prisma = new PrismaClient();

function normalizarTelefone(raw) {
  return raw.toString().replace(/\D/g, '');
}

function parsearArquivo(buffer, mimetype, originalname) {
  const ext = originalname.split('.').pop().toLowerCase();
  const linhas = [];

  if (ext === 'csv' || mimetype === 'text/csv') {
    const registros = parse(buffer, { columns: true, skip_empty_lines: true, trim: true });
    for (const r of registros) {
      const nome = r.nome || r.Nome || r.NOME || '';
      const telefone = r.telefone || r.Telefone || r.TELEFONE || r.phone || r.Phone || '';
      const email = r.email || r.Email || r.EMAIL || '';
      const observacoes = r.observacoes || r.Observacoes || r.OBSERVACOES || '';
      if (telefone) linhas.push({
        nome: nome.trim(),
        telefone: normalizarTelefone(telefone),
        email: email.trim(),
        observacoes: observacoes.trim(),
      });
    }
  } else {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const dados = XLSX.utils.sheet_to_json(ws, { defval: '' });
    for (const r of dados) {
      const nome = r.nome || r.Nome || r.NOME || '';
      const telefone = r.telefone || r.Telefone || r.TELEFONE || r.phone || r.Phone || '';
      const email = r.email || r.Email || r.EMAIL || '';
      const observacoes = r.observacoes || r.Observacoes || r.OBSERVACOES || '';
      if (telefone) linhas.push({
        nome: nome.toString().trim(),
        telefone: normalizarTelefone(telefone.toString()),
        email: email.toString().trim(),
        observacoes: observacoes.toString().trim(),
      });
    }
  }

  return linhas;
}

async function cadastrar(req, res) {
  const { nome, telefone, email, observacoes } = req.body;
  const corretorId = req.corretorId;
  const imobiliariaId = req.imobiliariaId;

  if (!nome?.trim()) return res.status(400).json({ error: 'Nome é obrigatório' });
  if (!telefone?.trim()) return res.status(400).json({ error: 'Telefone é obrigatório' });

  const contato = await prisma.contatoPessoal.create({
    data: {
      nome: nome.trim(),
      telefone: normalizarTelefone(telefone),
      email: email?.trim() || null,
      observacoes: observacoes?.trim() || null,
      corretorId,
      imobiliariaId,
    },
  });

  res.status(201).json(contato);
}

async function importar(req, res) {
  if (!req.file) return res.status(400).json({ error: 'Arquivo não enviado' });

  const corretorId = req.corretorId;
  const imobiliariaId = req.imobiliariaId;
  const linhas = parsearArquivo(req.file.buffer, req.file.mimetype, req.file.originalname);

  if (linhas.length === 0) {
    return res.status(400).json({ error: 'Nenhum contato encontrado no arquivo. Verifique se as colunas "nome" e "telefone" existem.' });
  }

  const resultados = { importados: 0, erros: 0 };

  for (const linha of linhas) {
    if (!linha.telefone || linha.telefone.length < 8) { resultados.erros++; continue; }
    try {
      await prisma.contatoPessoal.create({
        data: {
          nome: linha.nome || 'Sem nome',
          telefone: linha.telefone,
          email: linha.email || null,
          observacoes: linha.observacoes || null,
          corretorId,
          imobiliariaId,
        },
      });
      resultados.importados++;
    } catch {
      resultados.erros++;
    }
  }

  res.json({ ...resultados, total: linhas.length });
}

async function listar(req, res) {
  const corretorId = req.corretorId;
  const imobiliariaId = req.imobiliariaId;
  const { busca, page = 1, limit = 100 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where = { corretorId, imobiliariaId, status: 'ativo' };

  if (busca) {
    const isPostgres = process.env.DATABASE_URL?.includes('postgres');
    where.AND = [
      { status: 'ativo' },
      {
        OR: [
          { nome: { contains: busca, ...(isPostgres && { mode: 'insensitive' }) } },
          { telefone: { contains: busca } },
        ],
      },
    ];
    delete where.status;
  }

  const [contatos, total] = await Promise.all([
    prisma.contatoPessoal.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
      skip,
      take: parseInt(limit),
    }),
    prisma.contatoPessoal.count({ where }),
  ]);

  res.json({ contatos, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
}

async function remover(req, res) {
  const { id } = req.params;
  const corretorId = req.corretorId;
  const imobiliariaId = req.imobiliariaId;

  const contato = await prisma.contatoPessoal.findFirst({ where: { id, corretorId, imobiliariaId } });
  if (!contato) return res.status(404).json({ error: 'Contato não encontrado' });

  await prisma.contatoPessoal.delete({ where: { id } });
  res.json({ ok: true });
}

async function converter(req, res) {
  const { id } = req.params;
  const corretorId = req.corretorId;
  const imobiliariaId = req.imobiliariaId;

  const contato = await prisma.contatoPessoal.findFirst({ where: { id, corretorId, imobiliariaId } });
  if (!contato) return res.status(404).json({ error: 'Contato não encontrado' });
  if (contato.status === 'convertido') return res.status(400).json({ error: 'Contato já foi convertido em lead' });

  const telefoneFormatado = contato.telefone.startsWith('55') ? contato.telefone : `55${contato.telefone}`;
  const jid = `${telefoneFormatado}@s.whatsapp.net`;

  const lead = await prisma.$transaction(async (tx) => {
    const novoLead = await tx.lead.create({
      data: {
        nome: contato.nome,
        telefone: contato.telefone,
        whatsappJid: jid,
        status: 'lead',
        observacoes: contato.observacoes || null,
        origem: 'contato_pessoal',
        corretorId,
        imobiliariaId,
      },
    });

    await tx.historicoLead.create({
      data: {
        leadId: novoLead.id,
        acao: 'criado',
        detalhes: `Convertido de contato pessoal do corretor`,
      },
    });

    await tx.contatoPessoal.update({
      where: { id },
      data: { status: 'convertido', leadId: novoLead.id },
    });

    return novoLead;
  });

  // Notificação assíncrona — não bloqueia a resposta
  prisma.corretor.findUnique({
    where: { id: corretorId },
    include: { imobiliaria: { select: { id: true, nome: true } } },
  }).then((corretor) => {
    if (corretor) {
      notificarCorretor(corretor, lead, corretor.imobiliaria).catch(() => {});
    }
  }).catch(() => {});

  res.json({ ok: true, leadId: lead.id });
}

module.exports = { cadastrar, importar, listar, remover, converter };
