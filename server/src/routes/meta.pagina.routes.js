'use strict';

const { Router } = require('express');
const axios = require('axios');
const prisma = require('../lib/prisma');
const { authMiddleware, requireRole } = require('../middleware/auth.middleware');

const router = Router();

// POST /api/integracoes/meta/selecionar-pagina
// Recebe userAccessToken + pageId, troca por token permanente de página e salva
router.post(
  '/meta/selecionar-pagina',
  authMiddleware,
  requireRole('gestor', 'admin'),
  async (req, res) => {
    const { userAccessToken, pageId } = req.body;

    if (!userAccessToken || !pageId) {
      return res.status(400).json({ error: 'userAccessToken e pageId são obrigatórios' });
    }

    try {
      // 1. Troca o user token por long-lived user token (60 dias → page tokens não expiram)
      const { data: longTokenData } = await axios.get(
        'https://graph.facebook.com/v19.0/oauth/access_token',
        {
          params: {
            grant_type: 'fb_exchange_token',
            client_id: process.env.META_APP_ID,
            client_secret: process.env.META_APP_SECRET,
            fb_exchange_token: userAccessToken,
          },
        }
      );

      const longLivedUserToken = longTokenData.access_token;

      // 2. Busca as páginas com o long-lived token para obter o page token permanente
      const { data: accountsData } = await axios.get(
        'https://graph.facebook.com/v19.0/me/accounts',
        { params: { access_token: longLivedUserToken } }
      );

      const page = (accountsData.data || []).find((p) => p.id === pageId);

      if (!page) {
        return res.status(400).json({
          error: 'Página não encontrada. Verifique se você é administrador desta página.',
        });
      }

      const pageToken = page.access_token; // token permanente da página
      const pageName  = page.name;

      // 3. Inscreve a página no webhook de leadgen
      await axios.post(
        `https://graph.facebook.com/v19.0/${pageId}/subscribed_apps`,
        new URLSearchParams({ subscribed_fields: 'leadgen', access_token: pageToken }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      // 4. Salva no banco com o token permanente
      await prisma.metaIntegracao.upsert({
        where: { imobiliariaId: req.imobiliariaId },
        create: {
          imobiliariaId: req.imobiliariaId,
          pageId,
          pageToken,
          pageName,
          ativo: true,
          paginasPendentes: null,
        },
        update: {
          pageId,
          pageToken,
          pageName,
          ativo: true,
          paginasPendentes: null,
        },
      });

      res.json({ success: true, pageName });
    } catch (err) {
      console.error('[meta-pagina] Erro ao selecionar página:', err.message);

      const fbError = err.response?.data?.error;
      if (fbError) {
        return res.status(400).json({
          error: fbError.message || 'Erro ao processar token do Facebook',
        });
      }

      res.status(500).json({ error: 'Erro ao configurar a integração com o Facebook' });
    }
  }
);

module.exports = router;
