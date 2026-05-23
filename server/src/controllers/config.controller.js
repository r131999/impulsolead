'use strict';

const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// ── Upload de logo ────────────────────────────────────────────────────────────

const UPLOAD_DIR_LOGOS = process.env.UPLOAD_DIR_LOGOS || '/opt/uploads/logos';
try { fs.mkdirSync(UPLOAD_DIR_LOGOS, { recursive: true }); } catch {}

const storageLogo = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR_LOGOS),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});

const uploadLogo = multer({
  storage: storageLogo,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Formato inválido. Use JPG, PNG ou WebP.'));
  },
}).single('logo');

function handleUploadLogo(req, res, next) {
  uploadLogo(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Arquivo muito grande. Limite: 2MB' });
      return res.status(400).json({ error: err.message });
    }
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}

async function atualizarLogo(req, res) {
  handleUploadLogo(req, res, async () => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Imagem é obrigatória' });

      // Remove logo anterior do disco se existir
      const imob = await prisma.imobiliaria.findUnique({
        where: { id: req.imobiliariaId },
        select: { logoUrl: true },
      });
      if (imob?.logoUrl) {
        const oldFile = path.join(UPLOAD_DIR_LOGOS, path.basename(imob.logoUrl));
        fs.unlink(oldFile, () => {});
      }

      const logoUrl = `/uploads/logos/${req.file.filename}`;
      await prisma.imobiliaria.update({
        where: { id: req.imobiliariaId },
        data: { logoUrl },
      });

      res.json({ logoUrl });
    } catch (err) {
      console.error('[config] Erro ao atualizar logo:', err.message);
      res.status(500).json({ error: 'Erro ao salvar logo' });
    }
  });
}

async function getLogoImobiliaria(req, res) {
  const imob = await prisma.imobiliaria.findUnique({
    where: { id: req.imobiliariaId },
    select: { logoUrl: true },
  });
  res.json({ logoUrl: imob?.logoUrl || null });
}

async function getConfigAgente(req, res) {
  const config = await prisma.configAgente.findUnique({
    where: { imobiliariaId: req.imobiliariaId },
  });

  if (!config) {
    return res.status(404).json({ error: 'Configuração do agente não encontrada' });
  }

  res.json({ config });
}

async function atualizarConfigAgente(req, res) {
  const { mensagemBoasVindas, perguntas, nomeAgente, tomAgente, ativo } = req.body;

  if (perguntas !== undefined) {
    if (!Array.isArray(perguntas) || perguntas.length === 0) {
      return res.status(400).json({ error: 'perguntas deve ser um array não vazio' });
    }
    if (perguntas.some((p) => typeof p !== 'string' || !p.trim())) {
      return res.status(400).json({ error: 'Todas as perguntas devem ser strings não vazias' });
    }
  }

  const config = await prisma.configAgente.upsert({
    where: { imobiliariaId: req.imobiliariaId },
    update: {
      ...(mensagemBoasVindas !== undefined && { mensagemBoasVindas }),
      ...(perguntas !== undefined && { perguntas }),
      ...(nomeAgente !== undefined && { nomeAgente }),
      ...(tomAgente !== undefined && { tomAgente }),
      ...(ativo !== undefined && { ativo }),
    },
    create: {
      imobiliariaId: req.imobiliariaId,
      mensagemBoasVindas: mensagemBoasVindas || 'Olá! Tudo bem? Aqui é a Lia, assistente virtual. Que bom que você entrou em contato! Como posso te chamar?',
      perguntas: perguntas || [],
      nomeAgente: nomeAgente || 'Lia',
      tomAgente: tomAgente || 'profissional mas leve',
      ativo: ativo !== undefined ? ativo : true,
    },
  });

  res.json({ config });
}

async function atualizarDistribuicao(req, res) {
  const { distribuicaoManual } = req.body;

  if (typeof distribuicaoManual !== 'boolean') {
    return res.status(400).json({ error: 'distribuicaoManual deve ser boolean' });
  }

  const config = await prisma.configAgente.upsert({
    where: { imobiliariaId: req.imobiliariaId },
    update: { distribuicaoManual },
    create: {
      imobiliariaId: req.imobiliariaId,
      mensagemBoasVindas: 'Olá! Tudo bem? Aqui é a Lia, assistente virtual. Que bom que você entrou em contato! Como posso te chamar?',
      perguntas: [],
      nomeAgente: 'Lia',
      tomAgente: 'profissional mas leve',
      distribuicaoManual,
    },
  });

  res.json({ ok: true, distribuicaoManual: config.distribuicaoManual });
}

module.exports = { getLogoImobiliaria, getConfigAgente, atualizarConfigAgente, atualizarDistribuicao, atualizarLogo };
