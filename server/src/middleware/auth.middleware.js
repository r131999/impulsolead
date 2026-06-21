const jwt = require('jsonwebtoken');

const prisma = require('../lib/prisma');

const METODOS_ESCRITA = ['POST', 'PUT', 'PATCH', 'DELETE'];

function verificarPlano(imobiliaria) {
  if (imobiliaria.plano === 'legado') return null;
  if (imobiliaria.plano === 'cancelado') {
    return { error: 'Plano cancelado. Entre em contato com o suporte.' };
  }
  // planoBloqueadoEm é tratado pelo frontend via planoInfo (overlay completo)
  return null;
}

// Trial ou plano pago vencido (nunca 'legado'/'cancelado') => acesso só leitura.
function emModoLeitura(imobiliaria) {
  if (imobiliaria.plano === 'legado' || imobiliaria.plano === 'cancelado') return false;

  if (imobiliaria.plano === 'trial') {
    return !!imobiliaria.trialExpiraEm && new Date() > new Date(imobiliaria.trialExpiraEm);
  }

  if (['construcao', 'desenvolvimento', 'sucesso'].includes(imobiliaria.plano)) {
    return !!imobiliaria.planoExpiraEm && new Date() > new Date(imobiliaria.planoExpiraEm);
  }

  return false;
}

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticação não fornecido' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role === 'supremo') {
      const supremo = await prisma.usuarioSupremo.findUnique({
        where: { id: decoded.userId },
      });

      if (!supremo || !supremo.ativo) {
        return res.status(401).json({ error: 'Usuário supremo não encontrado ou inativo' });
      }

      req.role = 'supremo';
      req.usuario = { id: supremo.id, nome: supremo.nome, email: supremo.email, role: 'supremo' };
    } else if (decoded.corretorId) {
      const corretor = await prisma.corretor.findUnique({
        where: { id: decoded.corretorId },
        include: {
          imobiliaria: {
            select: { id: true, nome: true, plano: true, trialExpiraEm: true, planoExpiraEm: true, planoBloqueadoEm: true, criadoEm: true },
          },
        },
      });

      if (!corretor || !corretor.usuarioAtivo) {
        return res.status(401).json({ error: 'Corretor não encontrado ou sem acesso ativo' });
      }

      const erroPlanoCorretor = verificarPlano(corretor.imobiliaria);
      if (erroPlanoCorretor) return res.status(403).json(erroPlanoCorretor);

      req.role = corretor.role || 'corretor';
      req.corretorId = corretor.id;
      req.imobiliariaId = corretor.imobiliariaId;
      req.imobiliaria = corretor.imobiliaria;
      req.equipeId = decoded.equipeId || null;
      req.usuario = { id: corretor.id, nome: corretor.nome, email: corretor.email, role: corretor.role || 'corretor' };

      if (emModoLeitura(req.imobiliaria) && METODOS_ESCRITA.includes(req.method)) {
        return res.status(403).json({
          modoLeitura: true,
          bloqueado: true,
          motivo: req.imobiliaria.plano === 'trial' ? 'trial_expirado' : 'plano_vencido',
          error: 'Ação indisponível: assine um plano para continuar usando o ImpulsoLead.',
        });
      }
    } else {
      const usuario = await prisma.usuario.findUnique({
        where: { id: decoded.userId },
        include: {
          imobiliaria: {
            select: { id: true, nome: true, plano: true, trialExpiraEm: true, planoExpiraEm: true, planoBloqueadoEm: true, criadoEm: true },
          },
        },
      });

      if (!usuario || !usuario.ativo) {
        return res.status(401).json({ error: 'Usuário não encontrado ou inativo' });
      }

      const erroPlanoUsuario = verificarPlano(usuario.imobiliaria);
      if (erroPlanoUsuario) return res.status(403).json(erroPlanoUsuario);

      req.role = usuario.role;
      req.imobiliariaId = usuario.imobiliariaId;
      req.imobiliaria = usuario.imobiliaria;
      req.usuario = { id: usuario.id, nome: usuario.nome, email: usuario.email, role: usuario.role };

      if (emModoLeitura(req.imobiliaria) && METODOS_ESCRITA.includes(req.method)) {
        return res.status(403).json({
          modoLeitura: true,
          bloqueado: true,
          motivo: req.imobiliaria.plano === 'trial' ? 'trial_expirado' : 'plano_vencido',
          error: 'Ação indisponível: assine um plano para continuar usando o ImpulsoLead.',
        });
      }
    }

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado. Faça login novamente.' });
    }
    return res.status(401).json({ error: 'Token inválido' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    const role = req.role || req.usuario?.role;
    if (!roles.includes(role)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    next();
  };
}

module.exports = { authMiddleware, requireRole, emModoLeitura };
