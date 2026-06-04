'use strict';

const { Router } = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { buscarTodasPaginas } = require('../lib/metaBuscarPaginas');

const router = Router();

// GET /api/integracoes/meta/oauth/iniciar
// Recebe o JWT do usuário via query param, valida e redireciona para o diálogo OAuth do Facebook
router.get('/meta/oauth/iniciar', (req, res) => {
  const FRONTEND_URL = process.env.CLIENT_URL || 'https://crm.impulsoslz.com.br';
  const token = req.query.token;

  if (!token) {
    return res.redirect(`${FRONTEND_URL}/integracoes?status=cancelado&erro=${encodeURIComponent('token_ausente')}`);
  }

  try {
    jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.redirect(`${FRONTEND_URL}/integracoes?status=cancelado&erro=${encodeURIComponent('token_invalido')}`);
  }

  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID,
    redirect_uri: process.env.META_REDIRECT_URI,
    scope: 'pages_show_list,pages_read_engagement,leads_retrieval,pages_manage_metadata',
    response_type: 'code',
    state: token,
  });

  res.redirect(`https://www.facebook.com/v19.0/dialog/oauth?${params}`);
});

// GET /api/integracoes/meta/oauth/callback
// Recebe code e state do Facebook, troca por tokens, busca páginas e redireciona para o frontend
router.get('/meta/oauth/callback', async (req, res) => {
  const FRONTEND_URL = process.env.CLIENT_URL || 'https://crm.impulsoslz.com.br';
  const { code, state, error } = req.query;

  if (error || !code || !state) {
    const msg = error === 'access_denied'
      ? 'Permissão negada. Autorize o acesso para conectar suas páginas.'
      : 'Conexão cancelada.';
    return res.redirect(
      `${FRONTEND_URL}/integracoes?status=cancelado&erro=${encodeURIComponent(msg)}`
    );
  }

  try {
    const decoded = jwt.verify(state, process.env.JWT_SECRET);

    let imobiliariaId;
    if (decoded.corretorId) {
      const corretor = await prisma.corretor.findUnique({
        where: { id: decoded.corretorId },
        select: { imobiliariaId: true },
      });
      imobiliariaId = corretor?.imobiliariaId;
    } else if (decoded.userId) {
      const usuario = await prisma.usuario.findUnique({
        where: { id: decoded.userId },
        select: { imobiliariaId: true },
      });
      imobiliariaId = usuario?.imobiliariaId;
    }

    if (!imobiliariaId) {
      throw new Error('Imobiliária não identificada no token');
    }

    // Troca code por short-lived token
    const { data: shortData } = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
      params: {
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        redirect_uri: process.env.META_REDIRECT_URI,
        code,
      },
    });

    // Troca short-lived por long-lived token
    const { data: longData } = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        fb_exchange_token: shortData.access_token,
      },
    });

    // Busca páginas diretas + via Business Manager
    const pages = await buscarTodasPaginas(longData.access_token);

    if (pages.length === 0) {
      return res.redirect(
        `${FRONTEND_URL}/integracoes?status=cancelado&erro=${encodeURIComponent(
          'Nenhuma página encontrada. Certifique-se de ser administrador de uma página do Facebook.'
        )}`
      );
    }

    // Salva o array de páginas no banco (pendente de seleção)
    await prisma.metaIntegracao.upsert({
      where: { imobiliariaId },
      create: { imobiliariaId, pageId: '', pageToken: '', ativo: false, paginasPendentes: pages },
      update: { ativo: false, paginasPendentes: pages },
    });

    const paginasParam = encodeURIComponent(JSON.stringify(pages));
    return res.redirect(`${FRONTEND_URL}/integracoes?status=paginas_ok&paginas=${paginasParam}`);
  } catch (err) {
    console.error('[meta-oauth] Erro no callback:', err.message);
    return res.redirect(
      `${FRONTEND_URL}/integracoes?status=cancelado&erro=${encodeURIComponent(
        'Erro ao conectar com o Facebook. Tente novamente.'
      )}`
    );
  }
});

module.exports = router;
