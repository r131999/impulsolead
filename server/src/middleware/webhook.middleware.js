const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function webhookAuthMiddleware(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({ error: 'x-api-key header obrigatório' });
  }

  const imobiliaria = await prisma.imobiliaria.findUnique({
    where: { apiKey },
    select: { id: true, nome: true, plano: true, trialExpiraEm: true },
  });

  if (!imobiliaria) {
    return res.status(401).json({ error: 'API key inválida' });
  }

  if (
    imobiliaria.plano === 'trial' &&
    imobiliaria.trialExpiraEm &&
    new Date() > new Date(imobiliaria.trialExpiraEm)
  ) {
    return res.status(403).json({ error: 'Trial expirado' });
  }

  req.imobiliariaId = imobiliaria.id;
  req.imobiliaria = imobiliaria;
  next();
}

module.exports = { webhookAuthMiddleware };
