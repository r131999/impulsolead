'use strict';

const { Router } = require('express');
const axios = require('axios');
const prisma = require('../lib/prisma');
const { authMiddleware, requireRole } = require('../middleware/auth.middleware');

const router = Router();

// POST /api/integracoes/meta/selecionar-pagina
// Salva a página escolhida pelo gestor e inscreve no webhook de leadgen
router.post(
  '/meta/selecionar-pagina',
  authMiddleware,
  requireRole('gestor', 'admin'),
  async (req, res) => {
    const { pageId, pageName, pageToken } = req.body;

    if (!pageId || !pageToken) {
      return res.status(400).json({ error: 'pageId e pageToken são obrigatórios' });
    }

    try {
      await prisma.metaIntegracao.upsert({
        where: { imobiliariaId: req.imobiliariaId },
        create: {
          imobiliariaId: req.imobiliariaId,
          pageId,
          pageToken,
          pageName: pageName || null,
          ativo: true,
          paginasPendentes: null,
        },
        update: {
          pageId,
          pageToken,
          pageName: pageName || null,
          ativo: true,
          paginasPendentes: null,
        },
      });

      // Inscreve a página no webhook de leadgen
      await axios.post(
        `https://graph.facebook.com/v19.0/${pageId}/subscribed_apps`,
        new URLSearchParams({ subscribed_fields: 'leadgen', access_token: pageToken }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      res.json({ success: true });
    } catch (err) {
      console.error('[meta-pagina] Erro ao selecionar página:', err.message);
      res.status(500).json({ error: 'Erro ao configurar a integração com o Facebook' });
    }
  }
);

module.exports = router;
