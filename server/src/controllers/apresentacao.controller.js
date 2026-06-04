'use strict';

const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');
const prisma = require('../lib/prisma');

const BOT_UA_RE = /whatsapp|facebookexternalhit|twitterbot|telegrambot|linkedinbot|slackbot|bot|crawler|spider/i;
const APP_URL = process.env.APP_URL || 'https://crm.impulsoslz.com.br';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const UPLOAD_DIR = process.env.UPLOAD_DIR_APRESENTACOES || '/opt/uploads/apresentacoes';
try { fs.mkdirSync(UPLOAD_DIR, { recursive: true }); } catch {}

function gerarSlug() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let slug = '';
  for (let i = 0; i < 8; i++) slug += chars[Math.floor(Math.random() * chars.length)];
  return slug;
}

function whereAutorizado(req, id) {
  const where = { id, imobiliariaId: req.imobiliariaId };
  if (req.role === 'corretor' || req.role === 'gerente') where.corretorId = req.corretorId;
  return where;
}

// ── CRUD principal ─────────────────────────────────────────────────────────────

async function listar(req, res) {
  try {
    const where = { imobiliariaId: req.imobiliariaId };
    if (req.role === 'corretor' || req.role === 'gerente') where.corretorId = req.corretorId;

    const apresentacoes = await prisma.apresentacao.findMany({
      where,
      include: { _count: { select: { fotos: true } } },
      orderBy: { criadoEm: 'desc' },
    });
    res.json({ apresentacoes });
  } catch (err) {
    console.error('[apresentacao] listar:', err.message);
    res.status(500).json({ error: 'Erro ao listar apresentações' });
  }
}

async function criar(req, res) {
  try {
    const { nomeImóvel, nomeLocal, descricao, valor, quartos, banheiros, vagas, areaM2,
            nomeLeadPersonalizado, whatsappCorretor, nomeCorretor, publicado } = req.body;

    if (!nomeImóvel?.trim()) return res.status(400).json({ error: 'Nome do imóvel é obrigatório' });

    let slug;
    for (let i = 0; i < 10; i++) {
      slug = gerarSlug();
      const existe = await prisma.apresentacao.findUnique({ where: { slug } });
      if (!existe) break;
    }

    const apresentacao = await prisma.apresentacao.create({
      data: {
        nomeImóvel: nomeImóvel.trim(),
        nomeLocal: nomeLocal?.trim() || null,
        descricao: descricao?.trim() || null,
        valor: valor?.trim() || null,
        quartos: quartos ? Number(quartos) : null,
        banheiros: banheiros ? Number(banheiros) : null,
        vagas: vagas ? Number(vagas) : null,
        areaM2: areaM2 ? parseFloat(areaM2) : null,
        slug,
        publicado: publicado === true || publicado === 'true',
        nomeLeadPersonalizado: nomeLeadPersonalizado?.trim() || null,
        whatsappCorretor: whatsappCorretor?.trim() || null,
        nomeCorretor: nomeCorretor?.trim() || null,
        corretorId: req.corretorId || null,
        imobiliariaId: req.imobiliariaId,
      },
    });
    res.status(201).json({ apresentacao });
  } catch (err) {
    console.error('[apresentacao] criar:', err.message);
    res.status(500).json({ error: 'Erro ao criar apresentação' });
  }
}

async function buscar(req, res) {
  try {
    const { id } = req.params;
    const apresentacao = await prisma.apresentacao.findFirst({
      where: whereAutorizado(req, id),
      include: { fotos: { orderBy: { ordem: 'asc' } } },
    });
    if (!apresentacao) return res.status(404).json({ error: 'Apresentação não encontrada' });
    res.json({ apresentacao });
  } catch (err) {
    console.error('[apresentacao] buscar:', err.message);
    res.status(500).json({ error: 'Erro ao buscar apresentação' });
  }
}

async function atualizar(req, res) {
  try {
    const { id } = req.params;
    const ap = await prisma.apresentacao.findFirst({ where: whereAutorizado(req, id) });
    if (!ap) return res.status(404).json({ error: 'Apresentação não encontrada' });

    const { nomeImóvel, nomeLocal, descricao, valor, quartos, banheiros, vagas, areaM2,
            nomeLeadPersonalizado, whatsappCorretor, nomeCorretor, publicado } = req.body;

    const atualizado = await prisma.apresentacao.update({
      where: { id },
      data: {
        ...(nomeImóvel !== undefined && { nomeImóvel: nomeImóvel.trim() }),
        ...(nomeLocal !== undefined && { nomeLocal: nomeLocal?.trim() || null }),
        ...(descricao !== undefined && { descricao: descricao?.trim() || null }),
        ...(valor !== undefined && { valor: valor?.trim() || null }),
        ...(quartos !== undefined && { quartos: quartos ? Number(quartos) : null }),
        ...(banheiros !== undefined && { banheiros: banheiros ? Number(banheiros) : null }),
        ...(vagas !== undefined && { vagas: vagas ? Number(vagas) : null }),
        ...(areaM2 !== undefined && { areaM2: areaM2 ? parseFloat(areaM2) : null }),
        ...(nomeLeadPersonalizado !== undefined && { nomeLeadPersonalizado: nomeLeadPersonalizado?.trim() || null }),
        ...(whatsappCorretor !== undefined && { whatsappCorretor: whatsappCorretor?.trim() || null }),
        ...(nomeCorretor !== undefined && { nomeCorretor: nomeCorretor?.trim() || null }),
        ...(publicado !== undefined && { publicado: publicado === true || publicado === 'true' }),
      },
    });
    res.json({ apresentacao: atualizado });
  } catch (err) {
    console.error('[apresentacao] atualizar:', err.message);
    res.status(500).json({ error: 'Erro ao atualizar apresentação' });
  }
}

async function excluir(req, res) {
  try {
    const { id } = req.params;
    const ap = await prisma.apresentacao.findFirst({ where: whereAutorizado(req, id) });
    if (!ap) return res.status(404).json({ error: 'Apresentação não encontrada' });

    await prisma.apresentacao.delete({ where: { id } });
    fs.rmSync(path.join(UPLOAD_DIR, id), { recursive: true, force: true });

    res.json({ message: 'Apresentação removida' });
  } catch (err) {
    console.error('[apresentacao] excluir:', err.message);
    res.status(500).json({ error: 'Erro ao excluir apresentação' });
  }
}

async function buscarPublico(req, res) {
  try {
    const { slug } = req.params;
    const ap = await prisma.apresentacao.findUnique({
      where: { slug },
      include: {
        imobiliaria: { select: { nome: true, logoUrl: true } },
        fotos: { orderBy: { ordem: 'asc' } },
      },
    });
    if (!ap || !ap.publicado) return res.status(404).json({ error: 'Apresentação não encontrada' });
    res.json({ apresentacao: ap });
  } catch (err) {
    console.error('[apresentacao] buscarPublico:', err.message);
    res.status(500).json({ error: 'Erro ao buscar apresentação' });
  }
}

// ── Fotos ──────────────────────────────────────────────────────────────────────

const fotoStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const dir = path.join(UPLOAD_DIR, req.params.id);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const fotoUploadMiddleware = multer({
  storage: fotoStorage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Apenas imagens são permitidas'));
  },
}).single('foto');

function handleFotoUpload(req, res, next) {
  fotoUploadMiddleware(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Imagem muito grande. Limite: 15MB' });
      return res.status(400).json({ error: err.message });
    }
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}

async function uploadFoto(req, res) {
  handleFotoUpload(req, res, async () => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Arquivo ausente' });

      const { ambiente } = req.body;
      if (!ambiente?.trim()) {
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ error: 'Ambiente é obrigatório' });
      }

      // Conversão HEIC → JPEG
      const isHeic = ['.heic', '.heif'].includes(path.extname(req.file.originalname).toLowerCase())
        || req.file.mimetype === 'image/heic'
        || req.file.mimetype === 'image/heif';

      if (isHeic) {
        const novoNome = req.file.filename.replace(/\.(heic|heif)$/i, '.jpg');
        const novoCaminho = path.join(path.dirname(req.file.path), novoNome);
        await sharp(req.file.path).jpeg({ quality: 85 }).toFile(novoCaminho);
        fs.unlinkSync(req.file.path);
        req.file.path = novoCaminho;
        req.file.filename = novoNome;
        req.file.mimetype = 'image/jpeg';
      }

      const { id } = req.params;
      const ap = await prisma.apresentacao.findFirst({ where: whereAutorizado(req, id) });
      if (!ap) {
        fs.unlink(req.file.path, () => {});
        return res.status(404).json({ error: 'Apresentação não encontrada' });
      }

      const agg = await prisma.fotoApresentacao.aggregate({ where: { apresentacaoId: id }, _max: { ordem: true } });
      const ordem = (agg._max.ordem ?? -1) + 1;

      const url = `/uploads/apresentacoes/${id}/${req.file.filename}`;
      const foto = await prisma.fotoApresentacao.create({
        data: { apresentacaoId: id, url, tamanho: req.file.size, ambiente: ambiente.trim(), ordem },
      });
      res.status(201).json({ foto });
    } catch (err) {
      if (req.file) fs.unlink(req.file.path, () => {});
      console.error('[apresentacao] uploadFoto:', err.message);
      res.status(500).json({ error: 'Erro ao salvar foto' });
    }
  });
}

async function excluirFoto(req, res) {
  try {
    const { id, fotoId } = req.params;
    const ap = await prisma.apresentacao.findFirst({ where: whereAutorizado(req, id) });
    if (!ap) return res.status(404).json({ error: 'Apresentação não encontrada' });

    const foto = await prisma.fotoApresentacao.findFirst({ where: { id: fotoId, apresentacaoId: id } });
    if (!foto) return res.status(404).json({ error: 'Foto não encontrada' });

    await prisma.fotoApresentacao.delete({ where: { id: fotoId } });
    fs.unlink(path.join(UPLOAD_DIR, id, path.basename(foto.url)), () => {});

    res.json({ message: 'Foto removida' });
  } catch (err) {
    console.error('[apresentacao] excluirFoto:', err.message);
    res.status(500).json({ error: 'Erro ao excluir foto' });
  }
}

// ── Open Graph ─────────────────────────────────────────────────────────────────

async function ogApresentacao(req, res) {
  const { slug } = req.params;
  const ua = req.headers['user-agent'] || '';
  const pageUrl = `${APP_URL}/ap/${slug}`;

  if (!BOT_UA_RE.test(ua)) {
    return res.redirect(302, pageUrl);
  }

  try {
    const ap = await prisma.apresentacao.findUnique({
      where: { slug },
      include: { fotos: { orderBy: { ordem: 'asc' }, take: 1 } },
    });

    if (!ap || !ap.publicado) return res.redirect(302, pageUrl);

    const title = ap.nomeImóvel;
    const description = ap.descricao
      || (ap.nomeLeadPersonalizado ? `Apresentação exclusiva preparada para ${ap.nomeLeadPersonalizado}` : 'Apresentação exclusiva de imóvel');
    const imageUrl = ap.fotos.length > 0 ? `${APP_URL}${ap.fotos[0].url}` : null;

    const ogImageTags = imageUrl
      ? `\n  <meta property="og:image" content="${escapeHtml(imageUrl)}">\n  <meta name="twitter:image" content="${escapeHtml(imageUrl)}">`
      : '';

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="ImpulsoLead">${ogImageTags}
  <meta name="twitter:card" content="summary_large_image">
  <meta http-equiv="refresh" content="0;url=${pageUrl}">
</head>
<body>
  <p>Redirecionando...</p>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('[apresentacao] ogApresentacao:', err.message);
    res.redirect(302, pageUrl);
  }
}

// ── Vídeo ──────────────────────────────────────────────────────────────────────

const ALLOWED_VIDEO_EXTS = ['.mp4', '.mov', '.avi'];

const videoStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const dir = path.join(UPLOAD_DIR, req.params.id);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    cb(null, `video-${unique}${path.extname(file.originalname)}`);
  },
});

const videoUploadMiddleware = multer({
  storage: videoStorage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.mimetype.startsWith('video/') && ALLOWED_VIDEO_EXTS.includes(ext)) cb(null, true);
    else cb(new Error('Apenas vídeos mp4, mov ou avi são permitidos'));
  },
}).single('video');

function handleVideoUpload(req, res, next) {
  videoUploadMiddleware(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Vídeo muito grande. Limite: 100MB' });
      return res.status(400).json({ error: err.message });
    }
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}

async function uploadVideo(req, res) {
  handleVideoUpload(req, res, async () => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Arquivo ausente' });

      const { id } = req.params;
      const ap = await prisma.apresentacao.findFirst({ where: whereAutorizado(req, id) });
      if (!ap) {
        fs.unlink(req.file.path, () => {});
        return res.status(404).json({ error: 'Apresentação não encontrada' });
      }

      if (ap.videoUrl) {
        fs.unlink(path.join(UPLOAD_DIR, id, path.basename(ap.videoUrl)), () => {});
      }

      const videoUrl = `/uploads/apresentacoes/${id}/${req.file.filename}`;
      await prisma.apresentacao.update({ where: { id }, data: { videoUrl } });

      res.json({ videoUrl });
    } catch (err) {
      if (req.file) fs.unlink(req.file.path, () => {});
      console.error('[apresentacao] uploadVideo:', err.message);
      res.status(500).json({ error: 'Erro ao salvar vídeo' });
    }
  });
}

module.exports = { listar, criar, buscar, atualizar, excluir, buscarPublico, ogApresentacao, uploadFoto, excluirFoto, uploadVideo };
