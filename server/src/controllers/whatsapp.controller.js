'use strict';

const axios = require('axios');
const prisma = require('../lib/prisma');

const MANAGER_URL = process.env.BAILEYS_URL || 'http://impulsolead-whatsapp:3010';
const MANAGER_KEY = process.env.MANAGER_KEY || '';

const managerHeaders = () => ({ 'x-manager-key': MANAGER_KEY });

// ── Gestor: status da própria instância ───────────────────────────────────────
async function getStatus(req, res) {
  try {
    const { data } = await axios.get(`${MANAGER_URL}/status/${req.imobiliariaId}`, {
      headers: managerHeaders(),
      timeout: 5000,
    });
    res.json(data);
  } catch {
    res.json({
      imobiliariaId: req.imobiliariaId,
      status: 'desconectado',
      connected: false,
      qrCode: null,
    });
  }
}

// ── Gestor: conectar/criar instância ──────────────────────────────────────────
async function conectar(req, res) {
  try {
    const imobiliaria = await prisma.imobiliaria.findUnique({
      where: { id: req.imobiliariaId },
      select: { apiKey: true },
    });
    if (!imobiliaria) return res.status(404).json({ error: 'Imobiliária não encontrada' });

    // Garante registro no BD
    await prisma.whatsappInstancia.upsert({
      where: { imobiliariaId: req.imobiliariaId },
      update: { ativo: true, status: 'conectado' },
      create: { imobiliariaId: req.imobiliariaId, ativo: true, status: 'conectado' },
    });

    await axios.post(
      `${MANAGER_URL}/connect/${req.imobiliariaId}`,
      { apiKey: imobiliaria.apiKey },
      { headers: managerHeaders(), timeout: 10000 },
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('[whatsapp] conectar:', err.message);
    res.status(500).json({ error: 'Erro ao conectar instância' });
  }
}

// ── Gestor: logout + deletar sessão ───────────────────────────────────────────
async function deletarSessao(req, res) {
  try {
    await axios.delete(`${MANAGER_URL}/session/${req.imobiliariaId}`, {
      headers: managerHeaders(),
      timeout: 10000,
    });

    await prisma.whatsappInstancia.updateMany({
      where: { imobiliariaId: req.imobiliariaId },
      data: { status: 'desconectado', numero: null },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('[whatsapp] deletarSessao:', err.message);
    res.status(500).json({ error: 'Erro ao deletar sessão' });
  }
}

// ── Admin (supremo): status de todas as instâncias ───────────────────────────
async function getAllStatus(req, res) {
  try {
    const { data } = await axios.get(`${MANAGER_URL}/status`, {
      headers: managerHeaders(),
      timeout: 5000,
    });
    res.json(data);
  } catch (err) {
    console.error('[whatsapp] getAllStatus:', err.message);
    res.status(500).json({ error: 'Erro ao obter status das instâncias' });
  }
}

// ── Admin (supremo): conectar instância de qualquer tenant ────────────────────
async function adminConectar(req, res) {
  try {
    const { id } = req.params;

    const imobiliaria = await prisma.imobiliaria.findUnique({
      where: { id },
      select: { apiKey: true },
    });
    if (!imobiliaria) return res.status(404).json({ error: 'Imobiliária não encontrada' });

    await prisma.whatsappInstancia.upsert({
      where: { imobiliariaId: id },
      update: { ativo: true, status: 'conectado' },
      create: { imobiliariaId: id, ativo: true, status: 'conectado' },
    });

    await axios.post(
      `${MANAGER_URL}/connect/${id}`,
      { apiKey: imobiliaria.apiKey },
      { headers: managerHeaders(), timeout: 10000 },
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('[whatsapp] adminConectar:', err.message);
    res.status(500).json({ error: 'Erro ao conectar instância' });
  }
}

// ── Admin (supremo): status específico (com QR) ───────────────────────────────
async function adminGetStatus(req, res) {
  try {
    const { id } = req.params;
    const { data } = await axios.get(`${MANAGER_URL}/status/${id}`, {
      headers: managerHeaders(),
      timeout: 5000,
    });
    res.json(data);
  } catch (err) {
    console.error('[whatsapp] adminGetStatus:', err.message);
    res.json({ imobiliariaId: req.params.id, status: 'desconectado', connected: false, qrCode: null });
  }
}

// ── Admin (supremo): deletar sessão de qualquer tenant ───────────────────────
async function adminDeletarSessao(req, res) {
  try {
    const { id } = req.params;
    await axios.delete(`${MANAGER_URL}/session/${id}`, {
      headers: managerHeaders(),
      timeout: 10000,
    });
    await prisma.whatsappInstancia.updateMany({
      where: { imobiliariaId: id },
      data: { status: 'desconectado', numero: null },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[whatsapp] adminDeletarSessao:', err.message);
    res.status(500).json({ error: 'Erro ao deletar sessão' });
  }
}

// ── Interno: endpoint chamado pelo manager para listar tenants ativos ─────────
async function listarInstanciasInterno(req, res) {
  const key = req.headers['x-internal-key'];
  if (!key || key !== process.env.INTERNAL_KEY) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  try {
    const instancias = await prisma.whatsappInstancia.findMany({
      where: { ativo: true },
      include: { imobiliaria: { select: { apiKey: true } } },
    });

    res.json(instancias.map((i) => ({
      imobiliariaId: i.imobiliariaId,
      apiKey: i.imobiliaria.apiKey,
      status: i.status,
    })));
  } catch (err) {
    console.error('[whatsapp] listarInstanciasInterno:', err.message);
    res.status(500).json({ error: 'Erro interno' });
  }
}

module.exports = {
  getStatus,
  conectar,
  deletarSessao,
  getAllStatus,
  adminConectar,
  adminGetStatus,
  adminDeletarSessao,
  listarInstanciasInterno,
};
