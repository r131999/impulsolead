const { Router } = require('express');
const { authMiddleware } = require('../middleware/auth.middleware');
const { PERMISSOES_POR_PLANO } = require('../config/permissoes-planos');

const PLANOS_COBRAVEIS = ['construcao', 'desenvolvimento', 'sucesso'];

const router = Router();

// GET /api/planos — fonte única de preço de tabela, consumida por Planos.jsx
// (gestor) e AdminDashboard.jsx (supremo). authMiddleware aceita ambos os tokens.
router.get('/', authMiddleware, (req, res) => {
  const precos = {};
  for (const plano of PLANOS_COBRAVEIS) {
    precos[plano] = { valor: PERMISSOES_POR_PLANO[plano].valor };
  }
  res.json(precos);
});

module.exports = router;
