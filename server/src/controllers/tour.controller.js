'use strict';

const path = require('path');
const fs = require('fs');
const multer = require('multer');
const prisma = require('../lib/prisma');

const UPLOAD_DIR_TOURS = process.env.UPLOAD_DIR_TOURS || '/opt/uploads/tours';
try { fs.mkdirSync(UPLOAD_DIR_TOURS, { recursive: true }); } catch {}

function gerarSlug() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let slug = '';
  for (let i = 0; i < 8; i++) slug += chars[Math.floor(Math.random() * chars.length)];
  return slug;
}

// ── Tours ──────────────────────────────────────────────────────────────────────

async function listarTours(req, res) {
  try {
    const tours = await prisma.tourVirtual.findMany({
      where: { imobiliariaId: req.imobiliariaId },
      include: { _count: { select: { comodos: true } } },
      orderBy: { criadoEm: 'desc' },
    });
    res.json({ tours });
  } catch (err) {
    console.error('[tour] listar:', err.message);
    res.status(500).json({ error: 'Erro ao listar tours' });
  }
}

async function criarTour(req, res) {
  try {
    const { nome, descricao, whatsappCorretor, nomeCorretor, publicado } = req.body;
    if (!nome?.trim()) return res.status(400).json({ error: 'Nome é obrigatório' });

    let slug;
    for (let i = 0; i < 10; i++) {
      slug = gerarSlug();
      const existe = await prisma.tourVirtual.findUnique({ where: { slug } });
      if (!existe) break;
    }

    const tour = await prisma.tourVirtual.create({
      data: {
        nome: nome.trim(),
        descricao: descricao?.trim() || null,
        slug,
        publicado: publicado === true || publicado === 'true',
        whatsappCorretor: whatsappCorretor?.trim() || null,
        nomeCorretor: nomeCorretor?.trim() || null,
        imobiliariaId: req.imobiliariaId,
      },
    });
    res.status(201).json({ tour });
  } catch (err) {
    console.error('[tour] criar:', err.message);
    res.status(500).json({ error: 'Erro ao criar tour' });
  }
}

async function buscarTour(req, res) {
  try {
    const { id } = req.params;
    const tour = await prisma.tourVirtual.findFirst({
      where: { id, imobiliariaId: req.imobiliariaId },
      include: {
        comodos: {
          orderBy: { ordem: 'asc' },
          include: { fotos: { orderBy: { ordem: 'asc' } } },
        },
      },
    });
    if (!tour) return res.status(404).json({ error: 'Tour não encontrado' });
    res.json({ tour });
  } catch (err) {
    console.error('[tour] buscar:', err.message);
    res.status(500).json({ error: 'Erro ao buscar tour' });
  }
}

async function atualizarTour(req, res) {
  try {
    const { id } = req.params;
    const { nome, descricao, whatsappCorretor, nomeCorretor, publicado } = req.body;

    const tour = await prisma.tourVirtual.findFirst({ where: { id, imobiliariaId: req.imobiliariaId } });
    if (!tour) return res.status(404).json({ error: 'Tour não encontrado' });

    const atualizado = await prisma.tourVirtual.update({
      where: { id },
      data: {
        ...(nome !== undefined && { nome: nome.trim() }),
        ...(descricao !== undefined && { descricao: descricao?.trim() || null }),
        ...(whatsappCorretor !== undefined && { whatsappCorretor: whatsappCorretor?.trim() || null }),
        ...(nomeCorretor !== undefined && { nomeCorretor: nomeCorretor?.trim() || null }),
        ...(publicado !== undefined && { publicado: publicado === true || publicado === 'true' }),
      },
    });
    res.json({ tour: atualizado });
  } catch (err) {
    console.error('[tour] atualizar:', err.message);
    res.status(500).json({ error: 'Erro ao atualizar tour' });
  }
}

async function excluirTour(req, res) {
  try {
    const { id } = req.params;
    const tour = await prisma.tourVirtual.findFirst({ where: { id, imobiliariaId: req.imobiliariaId } });
    if (!tour) return res.status(404).json({ error: 'Tour não encontrado' });

    await prisma.tourVirtual.delete({ where: { id } });
    fs.rmSync(path.join(UPLOAD_DIR_TOURS, id), { recursive: true, force: true });

    res.json({ message: 'Tour removido' });
  } catch (err) {
    console.error('[tour] excluir:', err.message);
    res.status(500).json({ error: 'Erro ao excluir tour' });
  }
}

async function buscarTourPublico(req, res) {
  try {
    const { slug } = req.params;
    const tour = await prisma.tourVirtual.findUnique({
      where: { slug },
      include: {
        imobiliaria: { select: { nome: true, logoUrl: true } },
        comodos: {
          orderBy: { ordem: 'asc' },
          include: { fotos: { orderBy: { ordem: 'asc' } } },
        },
      },
    });
    if (!tour || !tour.publicado) return res.status(404).json({ error: 'Tour não encontrado' });
    res.json({ tour });
  } catch (err) {
    console.error('[tour] buscarPublico:', err.message);
    res.status(500).json({ error: 'Erro ao buscar tour' });
  }
}

// ── Cômodos ────────────────────────────────────────────────────────────────────

async function adicionarComodo(req, res) {
  try {
    const { id: tourId } = req.params;
    const { nome } = req.body;
    if (!nome?.trim()) return res.status(400).json({ error: 'Nome é obrigatório' });

    const tour = await prisma.tourVirtual.findFirst({ where: { id: tourId, imobiliariaId: req.imobiliariaId } });
    if (!tour) return res.status(404).json({ error: 'Tour não encontrado' });

    const agg = await prisma.comodo.aggregate({ where: { tourId }, _max: { ordem: true } });
    const ordem = (agg._max.ordem ?? -1) + 1;

    const comodo = await prisma.comodo.create({ data: { tourId, nome: nome.trim(), ordem } });
    res.status(201).json({ comodo: { ...comodo, fotos: [] } });
  } catch (err) {
    console.error('[tour] adicionarComodo:', err.message);
    res.status(500).json({ error: 'Erro ao adicionar cômodo' });
  }
}

async function atualizarComodo(req, res) {
  try {
    const { id: tourId, comodoId } = req.params;
    const { nome, ordem } = req.body;

    const tour = await prisma.tourVirtual.findFirst({ where: { id: tourId, imobiliariaId: req.imobiliariaId } });
    if (!tour) return res.status(404).json({ error: 'Tour não encontrado' });

    const comodo = await prisma.comodo.findFirst({ where: { id: comodoId, tourId } });
    if (!comodo) return res.status(404).json({ error: 'Cômodo não encontrado' });

    const atualizado = await prisma.comodo.update({
      where: { id: comodoId },
      data: {
        ...(nome !== undefined && { nome: nome.trim() }),
        ...(ordem !== undefined && { ordem: Number(ordem) }),
      },
    });
    res.json({ comodo: atualizado });
  } catch (err) {
    console.error('[tour] atualizarComodo:', err.message);
    res.status(500).json({ error: 'Erro ao atualizar cômodo' });
  }
}

async function excluirComodo(req, res) {
  try {
    const { id: tourId, comodoId } = req.params;

    const tour = await prisma.tourVirtual.findFirst({ where: { id: tourId, imobiliariaId: req.imobiliariaId } });
    if (!tour) return res.status(404).json({ error: 'Tour não encontrado' });

    const comodo = await prisma.comodo.findFirst({ where: { id: comodoId, tourId } });
    if (!comodo) return res.status(404).json({ error: 'Cômodo não encontrado' });

    await prisma.comodo.delete({ where: { id: comodoId } });
    fs.rmSync(path.join(UPLOAD_DIR_TOURS, tourId, comodoId), { recursive: true, force: true });

    res.json({ message: 'Cômodo removido' });
  } catch (err) {
    console.error('[tour] excluirComodo:', err.message);
    res.status(500).json({ error: 'Erro ao excluir cômodo' });
  }
}

async function reordenarComodos(req, res) {
  try {
    const { id: tourId } = req.params;
    const { ordem } = req.body;

    if (!Array.isArray(ordem)) return res.status(400).json({ error: 'ordem deve ser um array' });

    const tour = await prisma.tourVirtual.findFirst({ where: { id: tourId, imobiliariaId: req.imobiliariaId } });
    if (!tour) return res.status(404).json({ error: 'Tour não encontrado' });

    await prisma.$transaction(
      ordem.map(({ id, ordem: ord }) => prisma.comodo.update({ where: { id }, data: { ordem: Number(ord) } }))
    );
    res.json({ message: 'Reordenado' });
  } catch (err) {
    console.error('[tour] reordenarComodos:', err.message);
    res.status(500).json({ error: 'Erro ao reordenar cômodos' });
  }
}

// ── Fotos ──────────────────────────────────────────────────────────────────────

const tourFotoStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const { id: tourId, comodoId } = req.params;
    const dir = path.join(UPLOAD_DIR_TOURS, tourId, comodoId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});

const fotoUploadMiddleware = multer({
  storage: tourFotoStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Apenas imagens são permitidas'));
  },
}).single('foto');

function handleFotoUpload(req, res, next) {
  fotoUploadMiddleware(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Imagem muito grande. Limite: 10MB' });
      return res.status(400).json({ error: err.message });
    }
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}

async function uploadFotoComodo(req, res) {
  handleFotoUpload(req, res, async () => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Arquivo ausente' });

      const { id: tourId, comodoId } = req.params;

      const tour = await prisma.tourVirtual.findFirst({ where: { id: tourId, imobiliariaId: req.imobiliariaId } });
      if (!tour) {
        fs.unlink(req.file.path, () => {});
        return res.status(404).json({ error: 'Tour não encontrado' });
      }

      const comodo = await prisma.comodo.findFirst({ where: { id: comodoId, tourId } });
      if (!comodo) {
        fs.unlink(req.file.path, () => {});
        return res.status(404).json({ error: 'Cômodo não encontrado' });
      }

      const agg = await prisma.fotoComodo.aggregate({ where: { comodoId }, _max: { ordem: true } });
      const ordem = (agg._max.ordem ?? -1) + 1;

      const url = `/uploads/tours/${tourId}/${comodoId}/${req.file.filename}`;
      const foto = await prisma.fotoComodo.create({
        data: { comodoId, url, tamanho: req.file.size, ordem },
      });
      res.status(201).json({ foto });
    } catch (err) {
      if (req.file) fs.unlink(req.file.path, () => {});
      console.error('[tour] uploadFoto:', err.message);
      res.status(500).json({ error: 'Erro ao salvar foto' });
    }
  });
}

async function excluirFoto(req, res) {
  try {
    const { id: tourId, comodoId, fotoId } = req.params;

    const tour = await prisma.tourVirtual.findFirst({ where: { id: tourId, imobiliariaId: req.imobiliariaId } });
    if (!tour) return res.status(404).json({ error: 'Tour não encontrado' });

    const comodo = await prisma.comodo.findFirst({ where: { id: comodoId, tourId } });
    if (!comodo) return res.status(404).json({ error: 'Cômodo não encontrado' });

    const foto = await prisma.fotoComodo.findFirst({ where: { id: fotoId, comodoId } });
    if (!foto) return res.status(404).json({ error: 'Foto não encontrada' });

    await prisma.fotoComodo.delete({ where: { id: fotoId } });

    const filePath = path.join(UPLOAD_DIR_TOURS, tourId, comodoId, path.basename(foto.url));
    fs.unlink(filePath, () => {});

    res.json({ message: 'Foto removida' });
  } catch (err) {
    console.error('[tour] excluirFoto:', err.message);
    res.status(500).json({ error: 'Erro ao excluir foto' });
  }
}

async function reordenarFotos(req, res) {
  try {
    const { id: tourId, comodoId } = req.params;
    const { ordem } = req.body;

    if (!Array.isArray(ordem)) return res.status(400).json({ error: 'ordem deve ser um array' });

    const tour = await prisma.tourVirtual.findFirst({ where: { id: tourId, imobiliariaId: req.imobiliariaId } });
    if (!tour) return res.status(404).json({ error: 'Tour não encontrado' });

    const comodo = await prisma.comodo.findFirst({ where: { id: comodoId, tourId } });
    if (!comodo) return res.status(404).json({ error: 'Cômodo não encontrado' });

    await prisma.$transaction(
      ordem.map(({ id, ordem: ord }) => prisma.fotoComodo.update({ where: { id }, data: { ordem: Number(ord) } }))
    );
    res.json({ message: 'Reordenado' });
  } catch (err) {
    console.error('[tour] reordenarFotos:', err.message);
    res.status(500).json({ error: 'Erro ao reordenar fotos' });
  }
}

module.exports = {
  listarTours, criarTour, buscarTour, atualizarTour, excluirTour, buscarTourPublico,
  adicionarComodo, atualizarComodo, excluirComodo, reordenarComodos,
  uploadFotoComodo, excluirFoto, reordenarFotos,
};
