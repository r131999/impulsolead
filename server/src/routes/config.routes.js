const { Router } = require('express');
const { authMiddleware, requireRole } = require('../middleware/auth.middleware');
const { getConfigAgente, atualizarConfigAgente, atualizarDistribuicao, atualizarLogo, getLogoImobiliaria, getAlertaLead, atualizarAlertaLead } = require('../controllers/config.controller');

const router = Router();
router.use(authMiddleware);

// Acessível a todos os roles autenticados (gestor, gerente, corretor)
router.get('/logo-url', getLogoImobiliaria);

router.use(requireRole('gestor', 'admin'));

router.get('/agente', getConfigAgente);
router.put('/agente', atualizarConfigAgente);
router.put('/distribuicao', atualizarDistribuicao);
router.put('/logo', atualizarLogo);
router.get('/alerta-lead', getAlertaLead);
router.put('/alerta-lead', atualizarAlertaLead);

module.exports = router;
