const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticação não fornecido' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.corretorId) {
      const corretor = await prisma.corretor.findUnique({
        where: { id: decoded.corretorId },
        include: {
          imobiliaria: {
            select: { id: true, nome: true, plano: true, trialExpiraEm: true },
          },
        },
      });

      if (!corretor || !corretor.usuarioAtivo) {
        return res.status(401).json({ error: 'Corretor não encontrado ou sem acesso ativo' });
      }

      if (
        corretor.imobiliaria.plano === 'trial' &&
        corretor.imobiliaria.trialExpiraEm &&
        new Date() > new Date(corretor.imobiliaria.trialExpiraEm)
      ) {
        return res.status(403).json({ error: 'Período de trial expirado. Entre em contato para contratar o plano.' });
      }

      req.role = corretor.role || 'corretor';
      req.corretorId = corretor.id;
      req.imobiliariaId = corretor.imobiliariaId;
      req.imobiliaria = corretor.imobiliaria;
      req.equipeId = decoded.equipeId || null;
      req.usuario = { id: corretor.id, nome: corretor.nome, email: corretor.email, role: corretor.role || 'corretor' };
    } else {
      const usuario = await prisma.usuario.findUnique({
        where: { id: decoded.userId },
        include: {
          imobiliaria: {
            select: { id: true, nome: true, plano: true, trialExpiraEm: true },
          },
        },
      });

      if (!usuario || !usuario.ativo) {
        return res.status(401).json({ error: 'Usuário não encontrado ou inativo' });
      }

      if (
        usuario.imobiliaria.plano === 'trial' &&
        usuario.imobiliaria.trialExpiraEm &&
        new Date() > new Date(usuario.imobiliaria.trialExpiraEm)
      ) {
        return res.status(403).json({ error: 'Período de trial expirado. Entre em contato para contratar o plano.' });
      }

      req.role = usuario.role;
      req.imobiliariaId = usuario.imobiliariaId;
      req.imobiliaria = usuario.imobiliaria;
      req.usuario = { id: usuario.id, nome: usuario.nome, email: usuario.email, role: usuario.role };
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

module.exports = { authMiddleware, requireRole };
