const { parse } = require('csv-parse/sync');
const XLSX = require('xlsx');
const axios = require('axios');
const { notificarCorretor } = require('../services/notificacao.service');

const prisma = require('../lib/prisma');

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
      if (telefone) linhas.push({ nome: nome.trim(), telefone: normalizarTelefone(telefone) });
    }
  } else {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const dados = XLSX.utils.sheet_to_json(ws, { defval: '' });
    for (const r of dados) {
      const nome = r.nome || r.Nome || r.NOME || '';
      const telefone = r.telefone || r.Telefone || r.TELEFONE || r.phone || r.Phone || '';
      if (telefone) linhas.push({ nome: nome.toString().trim(), telefone: normalizarTelefone(telefone.toString()) });
    }
  }

  return linhas;
}

async function importar(req, res) {
  if (!req.file) return res.status(400).json({ error: 'Arquivo não enviado' });

  const imobiliariaId = req.imobiliariaId;
  const linhas = parsearArquivo(req.file.buffer, req.file.mimetype, req.file.originalname);

  if (linhas.length === 0) {
    return res.status(400).json({ error: 'Nenhum contato encontrado no arquivo. Verifique se as colunas "nome" e "telefone" existem.' });
  }

  const resultados = { importados: 0, duplicados: 0, erros: 0 };

  for (const linha of linhas) {
    if (!linha.telefone || linha.telefone.length < 8) { resultados.erros++; continue; }
    try {
      await prisma.contatoImportado.upsert({
        where: { telefone_imobiliariaId: { telefone: linha.telefone, imobiliariaId } },
        update: { nome: linha.nome || 'Sem nome' },
        create: { nome: linha.nome || 'Sem nome', telefone: linha.telefone, imobiliariaId },
      });
      resultados.importados++;
    } catch {
      resultados.duplicados++;
    }
  }

  res.json({ ...resultados, total: linhas.length });
}

async function listar(req, res) {
  const imobiliariaId = req.imobiliariaId;
  const { status, page = 1, limit = 50 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where = { imobiliariaId };
  if (status) where.status = status;

  const [contatos, total] = await Promise.all([
    prisma.contatoImportado.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
      skip,
      take: parseInt(limit),
    }),
    prisma.contatoImportado.count({ where }),
  ]);

  res.json({ contatos, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
}

async function remover(req, res) {
  const { id } = req.params;
  const imobiliariaId = req.imobiliariaId;

  const contato = await prisma.contatoImportado.findFirst({ where: { id, imobiliariaId } });
  if (!contato) return res.status(404).json({ error: 'Contato não encontrado' });

  await prisma.contatoImportado.delete({ where: { id } });
  res.json({ ok: true });
}

async function enviarMensagem(req, res) {
  const { id } = req.params;
  const { mensagem } = req.body;
  const imobiliariaId = req.imobiliariaId;

  if (!mensagem?.trim()) return res.status(400).json({ error: 'Mensagem não pode ser vazia' });

  const contato = await prisma.contatoImportado.findFirst({ where: { id, imobiliariaId } });
  if (!contato) return res.status(404).json({ error: 'Contato não encontrado' });
  if (contato.status === 'convertido') return res.status(400).json({ error: 'Contato já foi convertido em lead' });

  const { EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE_NAME } = process.env;

  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE_NAME) {
    return res.status(500).json({ error: 'Evolution API não configurada' });
  }

  const telefoneFormatado = contato.telefone.startsWith('55') ? contato.telefone : `55${contato.telefone}`;
  const jid = `${telefoneFormatado}@s.whatsapp.net`;

  try {
    await axios.post(
      `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE_NAME}`,
      { number: telefoneFormatado, text: mensagem },
      { headers: { apikey: EVOLUTION_API_KEY } }
    );
  } catch (err) {
    console.error('[Evolution API] Falha ao enviar mensagem:', {
      message: err.message,
      status: err.response?.status,
      data: err.response?.data,
      url: `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE_NAME}`,
      number: jid,
    });
    await prisma.contatoImportado.update({
      where: { id },
      data: { status: 'erro', mensagemEnviada: mensagem },
    });
    return res.status(502).json({ error: 'Falha ao enviar mensagem via WhatsApp' });
  }

  const lead = await prisma.$transaction(async (tx) => {
    const novoLead = await tx.lead.create({
      data: {
        nome: contato.nome,
        telefone: contato.telefone,
        whatsappJid: jid,
        status: 'lead',
        imobiliariaId,
      },
    });

    await tx.historicoLead.create({
      data: {
        leadId: novoLead.id,
        acao: 'criado',
        detalhes: 'Convertido de contato importado via reativação WhatsApp',
      },
    });

    await tx.contatoImportado.update({
      where: { id },
      data: { status: 'convertido', mensagemEnviada: mensagem, leadId: novoLead.id },
    });

    return novoLead;
  });

  res.json({ ok: true, leadId: lead.id });
}

async function transferir(req, res) {
  const { id } = req.params;
  const { corretorId } = req.body; // null/undefined = round-robin
  const imobiliariaId = req.imobiliariaId;

  const contato = await prisma.contatoImportado.findFirst({ where: { id, imobiliariaId } });
  if (!contato) return res.status(404).json({ error: 'Contato não encontrado' });
  if (contato.status === 'convertido') return res.status(400).json({ error: 'Contato já foi convertido em lead' });

  const telefoneFormatado = contato.telefone.startsWith('55') ? contato.telefone : `55${contato.telefone}`;
  const jid = `${telefoneFormatado}@s.whatsapp.net`;

  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
      const lead = await tx.lead.create({
        data: {
          nome: contato.nome,
          telefone: contato.telefone,
          whatsappJid: jid,
          status: 'lead',
          imobiliariaId,
        },
      });

      let corretor = null;

      if (corretorId) {
        corretor = await tx.corretor.findFirst({ where: { id: corretorId, imobiliariaId, ativo: true } });
        if (!corretor) throw Object.assign(new Error('Corretor não encontrado ou inativo'), { status: 404 });
        await tx.lead.update({ where: { id: lead.id }, data: { corretorId: corretor.id } });
      } else {
        // Round-robin: pega o próximo disponível e rotaciona a fila
        const corretores = await tx.corretor.findMany({
          where: { imobiliariaId, ativo: true, disponivel: true },
          orderBy: { posicaoFila: 'asc' },
        });
        if (corretores.length > 0) {
          const proximo = corretores[0];
          const maxPosicao = corretores[corretores.length - 1].posicaoFila;
          await tx.corretor.update({
            where: { id: proximo.id },
            data: { leadsRecebidos: { increment: 1 }, posicaoFila: maxPosicao + 1 },
          });
          await tx.lead.update({ where: { id: lead.id }, data: { corretorId: proximo.id } });
          corretor = proximo;
        }
      }

      const origemTexto = corretorId ? 'selecionado manualmente' : 'round-robin';
      const detalhes = corretor
        ? `Corretor: ${corretor.nome} | Origem: Transferência de contato importado (${origemTexto})`
        : 'Sem corretor disponível na fila';

      await tx.historicoLead.create({
        data: { leadId: lead.id, acao: 'criado', detalhes },
      });

      if (corretor) {
        await tx.historicoDistribuicao.create({
          data: {
            leadId: lead.id,
            leadNome: lead.nome,
            leadTelefone: lead.telefone,
            corretorId: corretor.id,
            corretorNome: corretor.nome,
            distribuidoPor: corretorId ? 'manual' : 'automatico',
            distribuidoPorNome: corretorId ? (req.usuario?.nome || null) : null,
            imobiliariaId,
          },
        });
      }

      await tx.contatoImportado.update({
        where: { id },
        data: { status: 'convertido', leadId: lead.id },
      });

      return { lead, corretor };
    });
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ error: err.message });
    throw err;
  }

  if (result.corretor) {
    notificarCorretor(result.corretor, result.lead, req.imobiliaria).catch(() => {});
  }

  res.json({ ok: true, leadId: result.lead.id, semCorretor: !result.corretor });
}

async function transferirLote(req, res) {
  const { contatoIds, corretorId } = req.body;
  const imobiliariaId = req.imobiliariaId;

  if (!Array.isArray(contatoIds) || contatoIds.length === 0) {
    return res.status(400).json({ error: 'Informe ao menos um contato' });
  }

  if (corretorId) {
    const corretor = await prisma.corretor.findFirst({
      where: { id: corretorId, imobiliariaId, ativo: true },
    });
    if (!corretor) return res.status(400).json({ error: 'Corretor não encontrado ou inativo' });
  }

  let sucesso = 0;
  let erros = 0;
  const notificacoes = [];

  for (const id of contatoIds) {
    try {
      const contato = await prisma.contatoImportado.findFirst({ where: { id, imobiliariaId } });
      if (!contato || contato.status === 'convertido') { erros++; continue; }

      const telefoneFormatado = contato.telefone.startsWith('55') ? contato.telefone : `55${contato.telefone}`;
      const jid = `${telefoneFormatado}@s.whatsapp.net`;

      const result = await prisma.$transaction(async (tx) => {
        const lead = await tx.lead.create({
          data: { nome: contato.nome, telefone: contato.telefone, whatsappJid: jid, status: 'lead', imobiliariaId },
        });

        let corretor = null;

        if (corretorId) {
          corretor = await tx.corretor.findFirst({ where: { id: corretorId, imobiliariaId, ativo: true } });
          if (corretor) await tx.lead.update({ where: { id: lead.id }, data: { corretorId: corretor.id } });
        } else {
          const corretores = await tx.corretor.findMany({
            where: { imobiliariaId, ativo: true, disponivel: true },
            orderBy: { posicaoFila: 'asc' },
          });
          if (corretores.length > 0) {
            const proximo = corretores[0];
            const maxPosicao = corretores[corretores.length - 1].posicaoFila;
            await tx.corretor.update({
              where: { id: proximo.id },
              data: { leadsRecebidos: { increment: 1 }, posicaoFila: maxPosicao + 1 },
            });
            await tx.lead.update({ where: { id: lead.id }, data: { corretorId: proximo.id } });
            corretor = proximo;
          }
        }

        const origemTexto = corretorId ? 'selecionado manualmente' : 'round-robin';
        await tx.historicoLead.create({
          data: {
            leadId: lead.id,
            acao: 'criado',
            detalhes: corretor
              ? `Corretor: ${corretor.nome} | Origem: Transferência em lote (${origemTexto})`
              : 'Sem corretor disponível na fila',
          },
        });

        if (corretor) {
          await tx.historicoDistribuicao.create({
            data: {
              leadId: lead.id,
              leadNome: lead.nome,
              leadTelefone: lead.telefone,
              corretorId: corretor.id,
              corretorNome: corretor.nome,
              distribuidoPor: corretorId ? 'manual' : 'automatico',
              distribuidoPorNome: corretorId ? (req.usuario?.nome || null) : null,
              imobiliariaId,
            },
          });
        }

        await tx.contatoImportado.update({ where: { id }, data: { status: 'convertido', leadId: lead.id } });

        return { lead, corretor };
      });

      if (result.corretor) notificacoes.push({ corretor: result.corretor, lead: result.lead });
      sucesso++;
    } catch (err) {
      console.error(`[transferirLote] Erro ao transferir contato ${id}:`, err.message);
      erros++;
    }
  }

  for (const { corretor, lead } of notificacoes) {
    notificarCorretor(corretor, lead, req.imobiliaria).catch(() => {});
  }

  res.json({ sucesso, erros });
}

async function limpar(req, res) {
  const imobiliariaId = req.imobiliariaId;
  const { status } = req.query;

  const where = { imobiliariaId };
  if (status) where.status = status;

  const { count } = await prisma.contatoImportado.deleteMany({ where });
  res.json({ removidos: count });
}

module.exports = { importar, listar, remover, enviarMensagem, transferir, transferirLote, limpar };
