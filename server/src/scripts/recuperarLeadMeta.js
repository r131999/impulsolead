/**
 * Recupera um lead do Meta Lead Ads que não foi criado (ex.: descartado antes da correção de
 * telefone inválido), reprocessando o leadgen_id pelo mesmo fluxo do webhook.
 * Rodar dentro do container, DEPOIS do deploy da correção e da migração telefoneInvalido:
 *
 *   node src/scripts/recuperarLeadMeta.js 4500039383577256 --dry-run   # só mostra o que viria
 *   node src/scripts/recuperarLeadMeta.js 4500039383577256             # cria o lead
 *   node src/scripts/recuperarLeadMeta.js <leadgenId> --page <pageId>  # força a página
 *
 * O que faz:
 *  1. Aborta se já existe lead com esse leadgenId (não duplica)
 *  2. Descobre a página dona do lead testando o pageToken de cada MetaIntegracao ativa
 *     (ou usa --page, se informado)
 *  3. Chama receberLeadMeta com o mesmo payload que a Meta mandaria no webhook — criação,
 *     marcação de telefone inválido, distribuição e notificação ao corretor seguem o fluxo normal
 *  4. Confirma que o lead foi criado e mostra o histórico
 */
const prisma = require('../lib/prisma');
const { receberLeadMeta } = require('../controllers/integracoes.controller');

const args = process.argv.slice(2);
const LEADGEN_ID = args.find((a) => /^\d+$/.test(a));
const DRY_RUN = args.includes('--dry-run');
const PAGE_ID_FORCADO = args.includes('--page') ? args[args.indexOf('--page') + 1] : null;

async function buscarNaGraph(leadgenId, pageToken) {
  const r = await fetch(
    `https://graph.facebook.com/v19.0/${leadgenId}?fields=field_data,created_time,campaign_name,adset_name,ad_name,form_id&access_token=${pageToken}`
  );
  return r.json();
}

async function run() {
  if (!LEADGEN_ID) {
    console.error('Uso: node src/scripts/recuperarLeadMeta.js <leadgenId> [--dry-run] [--page <pageId>]');
    process.exit(1);
  }

  // ── 1. Já existe? ────────────────────────────────────────────────────────
  const existente = await prisma.lead.findUnique({
    where: { leadgenId: LEADGEN_ID },
    select: { id: true, nome: true, telefone: true, criadoEm: true },
  });
  if (existente) {
    console.log('Lead já existe — nada a fazer:', existente);
    return;
  }

  // ── 2. Descobrir a página dona do lead ───────────────────────────────────
  const integracoes = await prisma.metaIntegracao.findMany({
    where: { ativo: true, ...(PAGE_ID_FORCADO && { pageId: PAGE_ID_FORCADO }) },
    select: { pageId: true, pageToken: true, imobiliariaId: true },
  });
  if (integracoes.length === 0) {
    console.error('ERRO: nenhuma MetaIntegracao ativa', PAGE_ID_FORCADO ? `para a página ${PAGE_ID_FORCADO}` : '');
    process.exit(1);
  }

  let encontrada = null;
  let leadData = null;
  for (const integracao of integracoes) {
    const json = await buscarNaGraph(LEADGEN_ID, integracao.pageToken);
    if (!json.error) {
      encontrada = integracao;
      leadData = json;
      break;
    }
    console.log(`  página ${integracao.pageId}: ${json.error.message}`);
  }
  if (!encontrada) {
    console.error(`ERRO: nenhuma página ativa conseguiu ler o leadgen_id ${LEADGEN_ID}`);
    process.exit(1);
  }

  console.log(`\nLead encontrado na página ${encontrada.pageId} (imobiliária ${encontrada.imobiliariaId})`);
  console.log('  criado na Meta em:', leadData.created_time);
  console.log('  campanha:', leadData.campaign_name, '| conjunto:', leadData.adset_name, '| anúncio:', leadData.ad_name);
  for (const f of leadData.field_data || []) {
    console.log(`  ${f.name}: ${JSON.stringify(f.values)}`);
  }

  if (DRY_RUN) {
    console.log('\n--dry-run: nada foi criado.');
    return;
  }

  // ── 3. Reprocessar pelo fluxo do webhook ─────────────────────────────────
  console.log('\nReprocessando pelo fluxo do webhook...');
  const req = {
    body: {
      entry: [{ id: encontrada.pageId, changes: [{ field: 'leadgen', value: { leadgen_id: LEADGEN_ID } }] }],
    },
  };
  const res = { status: () => ({ json: () => {} }) };
  await receberLeadMeta(req, res);

  // ── 4. Confirmar ─────────────────────────────────────────────────────────
  const criado = await prisma.lead.findUnique({
    where: { leadgenId: LEADGEN_ID },
    select: {
      id: true, nome: true, telefone: true, telefoneInvalido: true, campanha: true,
      corretor: { select: { nome: true } },
      historico: { select: { acao: true, detalhes: true }, orderBy: { criadoEm: 'asc' } },
    },
  });
  if (!criado) {
    console.error('ERRO: o lead não foi criado — veja os logs [meta-webhook] acima.');
    process.exit(1);
  }
  console.log('\nLead criado:', JSON.stringify(criado, null, 2));
}

run()
  .catch((err) => {
    console.error('Erro:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
