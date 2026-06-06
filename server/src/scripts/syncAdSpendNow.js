/**
 * Teste manual do sync de gasto de anúncios Meta.
 * Rodar dentro do container: node src/scripts/syncAdSpendNow.js
 */
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
      const err = json?.error || {};
      throw Object.assign(new Error(err.message || `HTTP ${resp.status}`), {
        code: err.code,
        type: err.type,
        fbtraceId: err.fbtrace_id,
      });
    }

    if (Array.isArray(json.data)) rows.push(...json.data);
    nextUrl = json.paging?.next || null;
  }

  return rows;
}

async function main() {
  console.log('=== syncAdSpendNow — teste manual ===');
  console.log(`Janela: ${isoDate(-30)} → ${isoDate(0)}\n`);

  const integracoes = await prisma.metaIntegracao.findMany({
    where: { ativo: true, adAccountId: { not: null }, adsToken: { not: null } },
    select: { imobiliariaId: true, adAccountId: true, adsToken: true },
  });

  console.log(`Integrações encontradas: ${integracoes.length}\n`);

  const since = isoDate(-30);
  const until = isoDate(0);
  let totalGravadas = 0;

  for (const integracao of integracoes) {
    console.log(`--- imobiliariaId: ${integracao.imobiliariaId} | adAccountId: ${integracao.adAccountId} ---`);

    try {
      const params = new URLSearchParams({
        level: 'ad',
        fields: 'ad_id,ad_name,spend',
        time_increment: '1',
        time_range: JSON.stringify({ since, until }),
        limit: '500',
        access_token: integracao.adsToken,
      });

      const urlSemToken = `https://graph.facebook.com/${META_VERSION}/${integracao.adAccountId}/insights?level=ad&fields=ad_id,ad_name,spend&time_increment=1&...`;
      console.log(`  URL chamada: ${urlSemToken}`);
      const url = `https://graph.facebook.com/${META_VERSION}/${integracao.adAccountId}/insights?${params}`;
      const rows = await buscarPaginado(url);

      console.log(`  Linhas retornadas pela Meta: ${rows.length}`);

      const amostra = [];
      let gravadas = 0;

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
          update: { spend: row.spend, adName: row.ad_name || null, accountId: integracao.adAccountId },
          create: {
            imobiliariaId: integracao.imobiliariaId,
            adId: row.ad_id,
            adName: row.ad_name || null,
            date: new Date(row.date_start),
            spend: row.spend,
            accountId: integracao.adAccountId,
            currency: 'BRL',
          },
        });

        if (amostra.length < 5) {
          amostra.push({ ad_id: row.ad_id, ad_name: row.ad_name, date: row.date_start, spend: row.spend });
        }
        gravadas++;
      }

      totalGravadas += gravadas;
      console.log(`  Registros gravados/atualizados: ${gravadas}`);

      if (amostra.length > 0) {
        console.log('  Amostra (até 5 registros):');
        for (const s of amostra) {
          console.log(`    ad_id=${s.ad_id} | date=${s.date} | spend=R$${s.spend} | nome="${s.ad_name}"`);
        }
      }
    } catch (err) {
      console.error(`  ERRO Meta API:`);
      console.error(`    message : ${err.message}`);
      console.error(`    code    : ${err.code ?? 'n/a'}`);
      console.error(`    type    : ${err.type ?? 'n/a'}`);
      console.error(`    traceId : ${err.fbtraceId ?? 'n/a'}`);
    }

    console.log('');
  }

  console.log(`=== Total gravadas/atualizadas na AdSpend: ${totalGravadas} ===`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
