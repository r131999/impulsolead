const webPush = require('web-push');
const prisma = require('../lib/prisma');

const VAPID_PUBLIC_KEY = 'BC6rfEDScAcEgMc050TDVwtImqRkBQNKBEgmjNWi-gxba6tane4rLhKio6IcpeVLjPHDqLuzW4Ajjth2lL0dXLg';
const VAPID_PRIVATE_KEY = 'dRHs4M7ZNO0xrKfWmWTAhltgGqjR5ggVBJeWMJcimJE';

webPush.setVapidDetails(
  'mailto:contato@impulsolead.com.br',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
);

async function subscribe(req, res) {
  const { subscription } = req.body;

  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Subscription inválida' });
  }

  const corretorId = req.corretorId;
  if (!corretorId) {
    return res.status(403).json({ error: 'Apenas corretores podem se inscrever em notificações' });
  }

  // Remove entradas antigas com o mesmo endpoint e recria
  await prisma.pushSubscription.deleteMany({
    where: { corretorId, subscription: { contains: subscription.endpoint } },
  });

  await prisma.pushSubscription.create({
    data: { corretorId, subscription: JSON.stringify(subscription) },
  });

  res.json({ ok: true });
}

async function enviarPushCorretor(corretorId, titulo, corpo) {
  if (!corretorId) return;

  let subs;
  try {
    subs = await prisma.pushSubscription.findMany({ where: { corretorId } });
  } catch {
    return;
  }

  if (!subs.length) return;

  const payload = JSON.stringify({ title: titulo, body: corpo });

  await Promise.allSettled(
    subs.map(async (row) => {
      let sub;
      try {
        sub = JSON.parse(row.subscription);
      } catch {
        return;
      }
      try {
        await webPush.sendNotification(sub, payload);
      } catch (err) {
        // 410 Gone / 404 = subscription expirada, remove
        if (err.statusCode === 410 || err.statusCode === 404) {
          await prisma.pushSubscription.delete({ where: { id: row.id } }).catch(() => {});
        }
      }
    }),
  );
}

module.exports = { subscribe, enviarPushCorretor, VAPID_PUBLIC_KEY };
