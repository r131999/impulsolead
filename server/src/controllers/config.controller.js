'use strict';

const path = require('path');
const fs = require('fs');
const multer = require('multer');

const prisma = require('../lib/prisma');

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
  try {
    const imob = await prisma.imobiliaria.findUnique({
      where: { id: req.imobiliariaId },
      select: { logoUrl: true },
    });
    res.json({ logoUrl: imob?.logoUrl || null });
  } catch (err) {
    console.error('[config] getLogoImobiliaria:', err.message);
    res.status(500).json({ error: 'Erro ao buscar logo' });
  }
}

async function getConfigAgente(req, res) {
  try {
    const config = await prisma.configAgente.findUnique({
      where: { imobiliariaId: req.imobiliariaId },
    });

    if (!config) {
      return res.status(404).json({ error: 'Configuração do agente não encontrada' });
    }

    res.json({ config });
  } catch (err) {
    console.error('[config] getConfigAgente:', err.message);
    res.status(500).json({ error: 'Erro ao buscar configuração do agente' });
  }
}

async function atualizarConfigAgente(req, res) {
  try {
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
  } catch (err) {
    console.error('[config] atualizarConfigAgente:', err.message);
    res.status(500).json({ error: 'Erro ao atualizar configuração do agente' });
  }
}

async function atualizarDistribuicao(req, res) {
  try {
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
  } catch (err) {
    console.error('[config] atualizarDistribuicao:', err.message);
    res.status(500).json({ error: 'Erro ao atualizar distribuição' });
  }
}

async function getAlertaLead(req, res) {
  try {
    const imob = await prisma.imobiliaria.findUnique({
      where: { id: req.imobiliariaId },
      select: {
        avisoLeadAtivo: true,
        avisoLeadCorretorHoras: true,
        avisoLeadGestorHoras: true,
        telefoneNotificacoes: true,
      },
    });

    res.json({ config: imob });
  } catch (err) {
    console.error('[config] getAlertaLead:', err.message);
    res.status(500).json({ error: 'Erro ao buscar configuração de alertas' });
  }
}

async function atualizarAlertaLead(req, res) {
  try {
    const { avisoLeadAtivo, avisoLeadCorretorHoras, avisoLeadGestorHoras, telefoneNotificacoes } = req.body;

    if (avisoLeadAtivo !== undefined && typeof avisoLeadAtivo !== 'boolean') {
      return res.status(400).json({ error: 'avisoLeadAtivo deve ser boolean' });
    }

    if (avisoLeadCorretorHoras !== undefined && (!Number.isInteger(avisoLeadCorretorHoras) || avisoLeadCorretorHoras < 1)) {
      return res.status(400).json({ error: 'avisoLeadCorretorHoras deve ser um número inteiro maior ou igual a 1' });
    }

    if (avisoLeadGestorHoras !== undefined && (!Number.isInteger(avisoLeadGestorHoras) || avisoLeadGestorHoras < 1)) {
      return res.status(400).json({ error: 'avisoLeadGestorHoras deve ser um número inteiro maior ou igual a 1' });
    }

    if (telefoneNotificacoes !== undefined && telefoneNotificacoes !== null && typeof telefoneNotificacoes !== 'string') {
      return res.status(400).json({ error: 'telefoneNotificacoes deve ser uma string ou nulo' });
    }

    // avisoLeadGestorHoras precisa ser >= avisoLeadCorretorHoras — como o PUT pode enviar
    // só um dos dois campos, comparamos com o valor já salvo para o que não veio no corpo.
    const atual = await prisma.imobiliaria.findUnique({
      where: { id: req.imobiliariaId },
      select: { avisoLeadCorretorHoras: true, avisoLeadGestorHoras: true },
    });

    const corretorHorasFinal = avisoLeadCorretorHoras !== undefined ? avisoLeadCorretorHoras : atual.avisoLeadCorretorHoras;
    const gestorHorasFinal   = avisoLeadGestorHoras   !== undefined ? avisoLeadGestorHoras   : atual.avisoLeadGestorHoras;

    if (gestorHorasFinal < corretorHorasFinal) {
      return res.status(400).json({ error: 'avisoLeadGestorHoras deve ser maior ou igual a avisoLeadCorretorHoras' });
    }

    const imob = await prisma.imobiliaria.update({
      where: { id: req.imobiliariaId },
      data: {
        ...(avisoLeadAtivo !== undefined && { avisoLeadAtivo }),
        ...(avisoLeadCorretorHoras !== undefined && { avisoLeadCorretorHoras }),
        ...(avisoLeadGestorHoras !== undefined && { avisoLeadGestorHoras }),
        ...(telefoneNotificacoes !== undefined && { telefoneNotificacoes: telefoneNotificacoes || null }),
      },
      select: {
        avisoLeadAtivo: true,
        avisoLeadCorretorHoras: true,
        avisoLeadGestorHoras: true,
        telefoneNotificacoes: true,
      },
    });

    res.json({ config: imob });
  } catch (err) {
    console.error('[config] atualizarAlertaLead:', err.message);
    res.status(500).json({ error: 'Erro ao atualizar configuração de alertas' });
  }
}

module.exports = { getLogoImobiliaria, getConfigAgente, atualizarConfigAgente, atualizarDistribuicao, atualizarLogo, getAlertaLead, atualizarAlertaLead };
