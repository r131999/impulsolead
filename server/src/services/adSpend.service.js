const prisma = require('../lib/prisma');

const META_VERSION = 'v21.0';

function isoDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

async function buscarPaginado(url) {
  const rows = [];
  let nextUrl = url;

  while (nextUrl) {
    const resp = await fetch(nextUrl);
    const json = await resp.json();

    if (!resp.ok) {
      throw new Error(json?.error?.message || `HTTP ${resp.status}`);
    }

    if (Array.isArray(json.data)) rows.push(...json.data);
    nextUrl = json.paging?.next || null;
  }

  return rows;
}

async function sincronizarGastoAnuncios() {
  console.log('[adspend] Iniciando sincronização de gastos de anúncios...');

  const integracoes = await prisma.metaIntegracao.findMany({
    where: { ativo: true, adAccountId: { not: null }, adsToken: { not: null } },
    select: { imobiliariaId: true, adAccountId: true, adsToken: true },
  });

  console.log(`[adspend] ${integracoes.length} integração(ões) ativa(s) com adAccountId.`);

  const since = isoDate(-30);
  const until = isoDate(0);

  for (const integracao of integracoes) {
    try {
      const params = new URLSearchParams({
        level: 'ad',
        fields: 'ad_id,ad_name,spend',
        time_increment: '1',
        time_range: JSON.stringify({ since, until }),
        limit: '500',
        access_token: integracao.adsToken,
      });

      const url = `https://graph.facebook.com/${META_VERSION}/${integracao.adAccountId}/insights?${params}`;
      const rows = await buscarPaginado(url);

      let upsertados = 0;
      for (const row of rows) {
        if (!row.ad_id || !row.date_start || row.spend == null) continue;

        await prisma.adSpend.upsert({
          where: {
            imobiliariaId_adId_date: {
              imobiliariaId: integracao.imobiliariaId,
              adId: row.ad_id,
              date: new Date(row.date_start),
            },
          },
          update: {
            spend: row.spend,
            accountId: integracao.adAccountId,
          },
          create: {
            imobiliariaId: integracao.imobiliariaId,
            adId: row.ad_id,
            date: new Date(row.date_start),
            spend: row.spend,
            accountId: integracao.adAccountId,
            currency: 'BRL',
          },
        });
        upsertados++;
      }

      console.log(`[adspend] ${integracao.imobiliariaId}: ${upsertados} registro(s) sincronizado(s).`);
    } catch (err) {
      console.error(`[adspend] Erro na integração ${integracao.imobiliariaId}:`, err.message);
    }
  }

  console.log('[adspend] Sincronização concluída.');
}

module.exports = { sincronizarGastoAnuncios };
