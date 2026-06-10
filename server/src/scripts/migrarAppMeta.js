/**
 * Migração do app Meta para Souza Andrade.
 * Rodar dentro do container: node src/scripts/migrarAppMeta.js
 *
 * O que faz:
 *  1. Atualiza pageToken e adsToken no banco para o token novo do System User
 *  2. Re-inscreve a página 102893685790333 no webhook leadgen do app novo (subscribed_apps)
 *  3. Confirma a inscrição via GET subscribed_apps
 */
const prisma = require('../lib/prisma');

const IMOBILIARIA_ID = 'd9cafd24-8878-4f66-a42b-6c98de8dbc82';
const PAGE_ID = '102893685790333';
const NEW_TOKEN =
  'EAAYolTgoetoBRuIDQgZBZA2rBQpPpluGokKYEnibwCrOUtnbIQcEWaq4HlUdXcP1UIZAMrCbzEYWAJaEIlp6H1ZAQluZAHjjsOsoayIZCxYUNUHZBxFq32QEO4WvZA5NpmuRfzckQTMWfokVeROuaTZCjsWdas4BvXVGpsO8w0xgfDuWTE8q57b4FLu34HwRAJV4wTgZDZD';

async function run() {
  // ── 1. Atualizar DB ──────────────────────────────────────────────────────
  console.log('\n[1/3] Atualizando pageToken e adsToken no banco...');

  const antes = await prisma.metaIntegracao.findFirst({
    where: { imobiliariaId: IMOBILIARIA_ID },
    select: { id: true, pageId: true, adAccountId: true, ativo: true },
  });

  if (!antes) {
    console.error('ERRO: MetaIntegracao não encontrada para imobiliariaId', IMOBILIARIA_ID);
    process.exit(1);
  }

  console.log('  Registro encontrado:', {
    id: antes.id,
    pageId: antes.pageId,
    adAccountId: antes.adAccountId,
    ativo: antes.ativo,
  });

  const atualizado = await prisma.metaIntegracao.update({
    where: { imobiliariaId: IMOBILIARIA_ID },
    data: {
      pageToken: NEW_TOKEN,
      adsToken: NEW_TOKEN,
    },
    select: {
      id: true,
      pageToken: true,
      adsToken: true,
    },
  });

  const tokenFim = NEW_TOKEN.slice(-10);
  const pageOk = atualizado.pageToken.endsWith(tokenFim);
  const adsOk = atualizado.adsToken.endsWith(tokenFim);
  console.log(`  pageToken atualizado: ${pageOk ? 'OK' : 'FALHOU'}`);
  console.log(`  adsToken  atualizado: ${adsOk ? 'OK' : 'FALHOU'}`);

  if (!pageOk || !adsOk) {
    console.error('ERRO: update não persistiu corretamente.');
    process.exit(1);
  }

  // ── 2. Re-inscrever página no webhook do app novo ────────────────────────
  console.log('\n[2/3] Inscrevendo página no webhook leadgen do app novo...');

  const subResp = await fetch(
    `https://graph.facebook.com/v19.0/${PAGE_ID}/subscribed_apps`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        subscribed_fields: 'leadgen',
        access_token: NEW_TOKEN,
      }).toString(),
    }
  );
  const subJson = await subResp.json();

  if (!subResp.ok || subJson.error) {
    console.error('ERRO ao inscrever no webhook:', subJson.error || subJson);
    process.exit(1);
  }
  console.log('  Resposta Meta:', subJson); // esperado: { success: true }

  // ── 3. Confirmar inscrição ───────────────────────────────────────────────
  console.log('\n[3/3] Confirmando inscrição via GET subscribed_apps...');

  const checkResp = await fetch(
    `https://graph.facebook.com/v19.0/${PAGE_ID}/subscribed_apps?access_token=${NEW_TOKEN}`
  );
  const checkJson = await checkResp.json();

  if (!checkResp.ok || checkJson.error) {
    console.error('ERRO ao verificar inscrição:', checkJson.error || checkJson);
    process.exit(1);
  }

  const appId = process.env.META_APP_ID;
  const inscricoes = checkJson.data || [];
  console.log('  Apps inscritos:', inscricoes.map((a) => `${a.name} (${a.id})`).join(', ') || '(nenhum)');

  const inscrito = inscricoes.some((a) => a.id === appId);
  if (appId && !inscrito) {
    console.warn(`  AVISO: app ${appId} não aparece na lista — verifique permissões do System User (pages_manage_metadata, leads_retrieval).`);
  } else {
    console.log('  Inscrição confirmada para o app', appId || '(META_APP_ID não definido no env)');
  }

  console.log('\n✓ Migração concluída.');
  console.log('  Para testar: envie um lead real pelo formulário da página e confira os logs do container:');
  console.log('  docker logs -f impulsolead-server --tail=50\n');
}

run()
  .catch((e) => {
    console.error('ERRO fatal:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
