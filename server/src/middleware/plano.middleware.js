'use strict';

function requirePlano(...planosPermitidos) {
  return (req, res, next) => {
    const plano = req.imobiliaria?.plano;
    if (!plano) return res.status(403).json({ error: 'Imobiliária não identificada' });
    if (planosPermitidos.includes(plano)) return next();
    return res.status(403).json({
      error: 'Funcionalidade não disponível no seu plano atual',
      planoAtual: plano,
      upgrade: true,
    });
  };
}

function verificarBloqueio(req, res, next) {
  const imobiliaria = req.imobiliaria;
  if (!imobiliaria) return next();
  if (imobiliaria.plano === 'legado') return next();
  if (imobiliaria.planoBloqueadoEm) {
    return res.status(403).json({
      error: 'Acesso suspenso por falta de pagamento. Entre em contato para reativar.',
      bloqueado: true,
    });
  }
  next();
}

module.exports = { requirePlano, verificarBloqueio };
