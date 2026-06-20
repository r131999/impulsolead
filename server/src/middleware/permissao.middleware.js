const prisma = require('../lib/prisma');

// Espelha exatamente a semântica de client/src/hooks/usePermissao.js: fail-open.
// Só bloqueia quando a permissão está explicitamente em `false`; JSON ausente,
// não-objeto ou chave ausente liberam o acesso (mesmo comportamento do hook).
function requirePermissao(chave) {
  return async (req, res, next) => {
    try {
      if (!req.imobiliariaId) {
        return res.status(401).json({ error: 'Não autenticado' });
      }

      const imob = await prisma.imobiliaria.findUnique({
        where: { id: req.imobiliariaId },
        select: { permissoes: true },
      });

      const perm = imob?.permissoes;
      if (perm && typeof perm === 'object' && perm[chave] === false) {
        return res.status(403).json({
          error: 'Recurso não disponível no seu plano',
          permissao: chave,
          bloqueado: true,
        });
      }

      return next();
    } catch (e) {
      console.error('[requirePermissao] erro:', e);
      // Em erro inesperado, fail-open pra não derrubar a feature por falha de infra.
      return next();
    }
  };
}

module.exports = { requirePermissao };
