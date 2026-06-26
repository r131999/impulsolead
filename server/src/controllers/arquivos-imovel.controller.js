'use strict';

const path = require('path');
const fs = require('fs');
const multer = require('multer');

const prisma = require('../lib/prisma');

const UPLOAD_DIR = process.env.UPLOAD_DIR_IMOVEIS || '/opt/uploads/imoveis';
const TMP_DIR = process.env.UPLOAD_DIR_TMP || '/opt/uploads/tmp';

try { fs.mkdirSync(UPLOAD_DIR, { recursive: true }); } catch {}
try { fs.mkdirSync(TMP_DIR, { recursive: true }); } catch {}

// ── Upload simples ─────────────────────────────────────────────────────────────

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});

const ALLOWED_MIMETYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/quicktime',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];
const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.mov', '.pdf', '.doc', '.docx', '.xls', '.xlsx'];
const BOOK_EXTS   = ['.pdf', '.doc', '.docx', '.xls', '.xlsx'];

const MIMETYPE_MAP = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.gif': 'image/gif',
  '.mp4': 'video/mp4', '.mov': 'video/quicktime',
  '.pdf': 'application/pdf',
  '.doc':  'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls':  'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    // Para arquivos office/book, o navegador pode enviar mimetype impreciso — confiar na extensão
    if (BOOK_EXTS.includes(ext)) return cb(null, true);
    if (ALLOWED_MIMETYPES.includes(file.mimetype) && ALLOWED_EXTS.includes(ext)) {
      return cb(null, true);
    }
    cb(new Error('Tipo de arquivo não permitido. Use: JPG, PNG, WebP, GIF, MP4, MOV, PDF, DOC, DOCX, XLS, XLSX'));
  },
}).single('arquivo');

function handleUpload(req, res, next) {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Arquivo muito grande. Limite: 100MB' });
      }
      return res.status(400).json({ error: err.message });
    }
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}

async function validarEmpreendimento(empreendimentoId, imobiliariaId) {
  if (!empreendimentoId) return null;
  const emp = await prisma.empreendimento.findFirst({
    where: { id: empreendimentoId, imobiliariaId },
  });
  return emp || false; // false = não encontrado
}

async function enviar(req, res) {
  handleUpload(req, res, async () => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Arquivo é obrigatório' });
      }

      const { nome, tipo, empreendimentoId, categoria } = req.body;
      if (!nome?.trim()) {
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ error: 'Campo obrigatório: nome' });
      }

      const tiposValidos = ['foto', 'video', 'pdf'];
      if (!tiposValidos.includes(tipo)) {
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ error: 'Tipo inválido. Use: foto, video, pdf' });
      }

      if (empreendimentoId) {
        const emp = await validarEmpreendimento(empreendimentoId, req.imobiliariaId);
        if (emp === false) {
          fs.unlink(req.file.path, () => {});
          return res.status(400).json({ error: 'Empreendimento não encontrado' });
        }
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
          empreendimentoId: empreendimentoId || null,
          categoria: categoria || null,
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

// ── Upload em chunks ───────────────────────────────────────────────────────────

const chunkUploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 }, // 5 MB chunk + overhead
}).single('chunk');

function handleChunkUpload(req, res, next) {
  chunkUploadMiddleware(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: err.message });
    }
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}

function validarUploadId(uploadId) {
  // Impede path traversal — só aceita chars seguros
  return typeof uploadId === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(uploadId);
}

async function receberChunk(req, res) {
  handleChunkUpload(req, res, async () => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Chunk ausente' });

      const { chunkIndex, totalChunks, uploadId, fileName } = req.body;

      if (!uploadId || chunkIndex === undefined || !totalChunks || !fileName) {
        return res.status(400).json({ error: 'Campos obrigatórios: uploadId, chunkIndex, totalChunks, fileName' });
      }

      if (!validarUploadId(uploadId)) {
        return res.status(400).json({ error: 'uploadId inválido' });
      }

      const idx = Number(chunkIndex);
      if (!Number.isInteger(idx) || idx < 0) {
        return res.status(400).json({ error: 'chunkIndex inválido' });
      }

      const chunkDir = path.join(TMP_DIR, uploadId);
      fs.mkdirSync(chunkDir, { recursive: true });

      const chunkPath = path.join(chunkDir, `chunk_${idx}`);
      fs.writeFileSync(chunkPath, req.file.buffer);

      res.json({ received: true, chunkIndex: idx });
    } catch (err) {
      console.error('[arquivos-imovel] receberChunk:', err.message);
      res.status(500).json({ error: 'Erro ao salvar chunk' });
    }
  });
}

async function finalizarChunk(req, res) {
  try {
    const { uploadId, fileName, nome, tipo, totalChunks, empreendimentoId, categoria } = req.body;

    if (!uploadId || !fileName || !nome?.trim() || !tipo) {
      return res.status(400).json({ error: 'Campos obrigatórios: uploadId, fileName, nome, tipo' });
    }

    if (!validarUploadId(uploadId)) {
      return res.status(400).json({ error: 'uploadId inválido' });
    }

    const tiposValidos = ['foto', 'video', 'pdf'];
    if (!tiposValidos.includes(tipo)) {
      return res.status(400).json({ error: 'Tipo inválido. Use: foto, video, pdf' });
    }

    const ext = path.extname(fileName).toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) {
      return res.status(400).json({ error: 'Tipo de arquivo não permitido' });
    }

    if (empreendimentoId) {
      const emp = await validarEmpreendimento(empreendimentoId, req.imobiliariaId);
      if (emp === false) {
        return res.status(400).json({ error: 'Empreendimento não encontrado' });
      }
    }

    const chunkDir = path.join(TMP_DIR, uploadId);
    if (!fs.existsSync(chunkDir)) {
      return res.status(400).json({ error: 'Upload não encontrado ou expirado' });
    }

    const chunkFiles = fs.readdirSync(chunkDir)
      .filter((f) => f.startsWith('chunk_'))
      .sort((a, b) => {
        return parseInt(a.split('_')[1], 10) - parseInt(b.split('_')[1], 10);
      });

    if (chunkFiles.length === 0) {
      return res.status(400).json({ error: 'Nenhum chunk encontrado' });
    }

    if (totalChunks && chunkFiles.length !== Number(totalChunks)) {
      return res.status(400).json({
        error: `Upload incompleto: esperados ${totalChunks} chunks, recebidos ${chunkFiles.length}`,
      });
    }

    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const finalFilename = `${unique}${ext}`;
    const finalPath = path.join(UPLOAD_DIR, finalFilename);

    for (const chunkFile of chunkFiles) {
      const data = fs.readFileSync(path.join(chunkDir, chunkFile));
      fs.appendFileSync(finalPath, data);
    }

    const stats = fs.statSync(finalPath);

    const arquivo = await prisma.arquivoImovel.create({
      data: {
        nome: nome.trim(),
        tipo,
        filename: finalFilename,
        mimetype: MIMETYPE_MAP[ext] || 'application/octet-stream',
        tamanho: stats.size,
        criadoPorId: req.corretorId || req.usuario?.id,
        imobiliariaId: req.imobiliariaId,
        empreendimentoId: empreendimentoId || null,
        categoria: categoria || null,
      },
    });

    fs.rmSync(chunkDir, { recursive: true, force: true });

    res.status(201).json({ arquivo });
  } catch (err) {
    console.error('[arquivos-imovel] finalizarChunk:', err.message);
    res.status(500).json({ error: 'Erro ao finalizar upload' });
  }
}

// ── Listagem / remoção / download ──────────────────────────────────────────────

async function listar(req, res) {
  try {
    const { tipo, empreendimentoId, categoria } = req.query;
    const where = { imobiliariaId: req.imobiliariaId };
    if (tipo) where.tipo = tipo;
    if (empreendimentoId) where.empreendimentoId = empreendimentoId;
    if (categoria) where.categoria = categoria;

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

    const { size } = fs.statSync(filePath);
    res.setHeader('Content-Type', arquivo.mimetype);
    res.setHeader('Content-Disposition', `attachment; filename="${arquivo.nome || arquivo.filename}"`);
    res.setHeader('Content-Length', size);
    res.setHeader('Accept-Ranges', 'bytes');

    const stream = fs.createReadStream(filePath);
    stream.on('error', () => { if (!res.headersSent) res.status(500).json({ error: 'Erro ao ler arquivo' }); });
    stream.pipe(res);
  } catch (err) {
    console.error('[arquivos-imovel] download:', err.message);
    res.status(500).json({ error: 'Erro ao baixar arquivo' });
  }
}

module.exports = { enviar, listar, remover, download, receberChunk, finalizarChunk };
