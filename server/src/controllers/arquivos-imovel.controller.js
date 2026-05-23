'use strict';

const path = require('path');
const fs = require('fs');
const multer = require('multer');

const prisma = require('../lib/prisma');

const UPLOAD_DIR = process.env.UPLOAD_DIR_IMOVEIS || '/opt/uploads/imoveis';

try { fs.mkdirSync(UPLOAD_DIR, { recursive: true }); } catch {}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});

const ALLOWED_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'application/pdf'];
const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.mov', '.pdf'];

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_MIMETYPES.includes(file.mimetype) && ALLOWED_EXTS.includes(ext)) {
      return cb(null, true);
    }
    cb(new Error('Tipo de arquivo não permitido. Use: JPG, PNG, WebP, GIF, MP4, MOV, PDF'));
  },
}).single('arquivo');

function handleUpload(req, res, next) {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Arquivo muito grande. Limite: 50MB' });
      }
      return res.status(400).json({ error: err.message });
    }
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}

async function enviar(req, res) {
  handleUpload(req, res, async () => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Arquivo é obrigatório' });
      }

      const { nome, tipo } = req.body;
      if (!nome?.trim()) {
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ error: 'Campo obrigatório: nome' });
      }

      const tiposValidos = ['foto', 'video', 'pdf'];
      if (!tiposValidos.includes(tipo)) {
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ error: 'Tipo inválido. Use: foto, video, pdf' });
      }

      const arquivo = await prisma.arquivoImovel.create({
        data: {
          nome: nome.trim(),
          tipo,
          filename: req.file.filename,
          mimetype: req.file.mimetype,
          tamanho: req.file.size,
          criadoPorId: req.corretorId || req.usuario?.id,
          imobiliariaId: req.imobiliariaId,
        },
      });

      res.status(201).json({ arquivo });
    } catch (err) {
      if (req.file) fs.unlink(req.file.path, () => {});
      console.error('[arquivos-imovel] erro no upload:', err.message);
      res.status(500).json({ error: 'Erro ao salvar arquivo' });
    }
  });
}

async function listar(req, res) {
  try {
    const { tipo } = req.query;
    const where = { imobiliariaId: req.imobiliariaId };
    if (tipo) where.tipo = tipo;

    const arquivos = await prisma.arquivoImovel.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
    });

    res.json({ arquivos });
  } catch (err) {
    console.error('[arquivos-imovel] listar:', err.message);
    res.status(500).json({ error: 'Erro ao listar arquivos' });
  }
}

async function remover(req, res) {
  try {
    const { id } = req.params;

    const arquivo = await prisma.arquivoImovel.findFirst({
      where: { id, imobiliariaId: req.imobiliariaId },
    });
    if (!arquivo) return res.status(404).json({ error: 'Arquivo não encontrado' });

    await prisma.arquivoImovel.delete({ where: { id } });

    const filePath = path.join(UPLOAD_DIR, arquivo.filename);
    fs.unlink(filePath, () => {});

    res.json({ message: 'Arquivo removido' });
  } catch (err) {
    console.error('[arquivos-imovel] remover:', err.message);
    res.status(500).json({ error: 'Erro ao remover arquivo' });
  }
}

async function download(req, res) {
  try {
    const { id } = req.params;

    const arquivo = await prisma.arquivoImovel.findFirst({
      where: { id, imobiliariaId: req.imobiliariaId },
    });
    if (!arquivo) return res.status(404).json({ error: 'Arquivo não encontrado' });

    const filePath = path.join(UPLOAD_DIR, arquivo.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Arquivo não encontrado no servidor' });
    }

    res.setHeader('Content-Type', arquivo.mimetype);
    res.setHeader('Content-Disposition', `inline; filename="${arquivo.filename}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error('[arquivos-imovel] download:', err.message);
    res.status(500).json({ error: 'Erro ao baixar arquivo' });
  }
}

module.exports = { enviar, listar, remover, download };
