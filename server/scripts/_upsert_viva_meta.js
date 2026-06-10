const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const souza = await prisma.metaIntegracao.findUnique({
    where: { imobiliariaId: 'd9cafd24-8878-4f66-a42b-6c98de8dbc82' }
  });
  if (!souza) { console.error('Registro da Souza não encontrado'); process.exit(1); }
  console.log('Token Souza (últimos 6):', souza.pageToken.slice(-6));

  const viva = await prisma.metaIntegracao.upsert({
    where: { imobiliariaId: '9412a016-43e4-4b4a-a3e2-87e4a89b453f' },
    update: {
      pageId: '134021056468969',
      adAccountId: 'act_1074763177950066',
      pageToken: souza.pageToken,
      adsToken: souza.adsToken,
      ativo: true,
    },
    create: {
      imobiliariaId: '9412a016-43e4-4b4a-a3e2-87e4a89b453f',
      pageId: '134021056468969',
      adAccountId: 'act_1074763177950066',
      pageToken: souza.pageToken,
      adsToken: souza.adsToken,
      ativo: true,
    }
  });

  console.log('--- Registro Viva ---');
  console.log('id:', viva.id);
  console.log('imobiliariaId:', viva.imobiliariaId);
  console.log('pageId:', viva.pageId);
  console.log('adAccountId:', viva.adAccountId);
  console.log('pageToken (últimos 6):', viva.pageToken.slice(-6));
  console.log('adsToken (últimos 6):', viva.adsToken ? viva.adsToken.slice(-6) : 'null');
  console.log('ativo:', viva.ativo);
  console.log('criadoEm:', viva.criadoEm);
}

run()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
