// Garante que req.imobiliariaId esteja presente após o authMiddleware.
// Usado como segunda camada de proteção em rotas sensíveis.
function tenantMiddleware(req, res, next) {
  if (!req.imobiliariaId) {
    return res.status(403).json({ error: 'Contexto de imobiliária não identificado' });
  }
  next();
}

module.exports = { tenantMiddleware };
