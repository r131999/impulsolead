const crypto = require('crypto');
const prisma = require('../lib/prisma');

// API de Conversões para CRM (Conversion Leads). Formato conferido na doc da Meta em 19/10/2026:
// action_source 'system_generated' no topo, event_source/lead_event_source dentro de custom_data,
// user_data.lead_id com o leadgen_id do webhook. v26.0 é a versão atual da Graph API (29/07/2026).
const CAPI_VERSION = 'v26.0';

// Etapas do kanban em ordem de profundidade no funil. 'perdido' fica de fora: é saída, não profundidade.
const ORDEM_FUNIL = ['lead', 'atendimento', 'em_espera', 'agendamento', 'visita', 'proposta', 'venda'];
const ETAPAS_QUALIFICAVEIS = ORDEM_FUNIL.slice(1);
const ETAPA_QUALIFICADA_PADRAO = 'agendamento';

// A Meta só aceita backfill de até 7 dias; evento mais antigo que isso é descartado por ela.
const JANELA_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_TENTATIVAS = 5;
// Evento parado em 'enviando' além disso teve o envio interrompido (ex.: processo reiniciou no meio).
const ENVIO_TRAVADO_MS = 10 * 60 * 1000;
const LEAD_EVENT_SOURCE = 'ImpulsoLead';

const SELECT_LEAD = { id: true, imobiliariaId: true, leadgenId: true, metaPageId: true, criadoEm: true };

function hash(valor) {
  if (!valor) return null;
  return crypto.createHash('sha256').update(String(valor).trim().toLowerCase()).digest('hex');
}

// Lead.telefone é salvo só com dígitos (ver normalizarTelefone em integracoes.controller.js),
// mas nem sempre com o DDI — números sem DDI têm no máximo 11 dígitos (DDD + até 9 dígitos).
// A Meta espera o `ph` com DDI, então prefixamos 55 quando ele ainda não está presente.
function telefoneComDDI(telefone) {
  if (!telefone) return null;
  const digitos = String(telefone).replace(/\D/g, '');
  if (!digitos) return null;
  return digitos.length <= 11 ? `55${digitos}` : digitos;
}

function inicioJanela() {
  return new Date(Date.now() - JANELA_MS);
}

// Modo de teste: com test_event_code os eventos só aparecem na aba Eventos de Teste do Gerenciador
// e não valem pra otimização. O código da integração (painel admin) tem precedência sobre a
// variável META_CAPI_TEST_EVENT_CODE, que vale pra todas as imobiliárias.
function codigoTeste(integracao) {
  return integracao.metaTestEventCode || process.env.META_CAPI_TEST_EVENT_CODE || null;
}

// Integração Meta da imobiliária que tem dataset + token. O vínculo é lead → página Meta de origem
// (Lead.metaPageId) → dataset daquela página: com duas páginas (ex.: Souza: Souzaandradeslz com
// dataset e Flávio dos Santos deliberadamente sem), só os leads da página com dataset são enviados.
// Mais de uma integração com dataset não deveria existir (o admin impede); se existir, não envia.
async function obterIntegracaoCapi(imobiliariaId) {
  const comDataset = await prisma.metaIntegracao.findMany({
    where: {
      imobiliariaId, ativo: true, pageId: { not: null }, metaDatasetId: { not: null }, metaDatasetToken: { not: null },
    },
  });
  if (comDataset.length === 0) return null;

  if (comDataset.length > 1) {
    console.warn(
      `[metaCapi] imobiliaria=${imobiliariaId} NÃO ENVIADA — ${comDataset.length} integrações Meta com dataset `
      + `(${comDataset.map((m) => m.pageName || m.pageId).join(', ')}); deixe o dataset em só uma`,
    );
    return null;
  }
  return comDataset[0];
}

// Um evento por avanço de etapa, lido do histórico — nunca um retrato do status atual.
// Retrocesso (ir pra etapa igual ou anterior à mais funda já atingida) não gera nada.
// QualifiedLead sai quando o lead atinge a etapa qualificada OU qualquer etapa mais funda: num
// salto (ex.: lead → venda) a Meta não pode ficar sem o evento que alimenta a otimização.
// Os demais intermediários pulados ficam de fora.
function derivarEventos(lead, historico, etapaQualificada) {
  const limiarQualificado = ORDEM_FUNIL.indexOf(etapaQualificada);
  const eventos = [{ eventName: 'Lead', etapa: 'lead', eventTime: lead.criadoEm }];
  let profundidadeMax = 0;

  for (const h of historico) {
    if (h.statusNovo === 'perdido') {
      eventos.push({ eventName: 'DisqualifiedLead', etapa: h.statusNovo, eventTime: h.alteradoEm });
      continue;
    }

    const profundidade = ORDEM_FUNIL.indexOf(h.statusNovo);
    if (profundidade <= profundidadeMax) continue;
    profundidadeMax = profundidade;

    if (h.statusNovo === 'atendimento') {
      eventos.push({ eventName: 'Contacted', etapa: h.statusNovo, eventTime: h.alteradoEm });
    }
    if (profundidade >= limiarQualificado) {
      eventos.push({ eventName: 'QualifiedLead', etapa: h.statusNovo, eventTime: h.alteradoEm });
    }
    if (h.statusNovo === 'venda') {
      eventos.push({ eventName: 'ConvertedLead', etapa: h.statusNovo, eventTime: h.alteradoEm });
    }
  }

  // Cada evento sai uma vez só por lead (o mesmo vale no banco, via @@unique([leadId, eventName])).
  const vistos = new Set();
  return eventos.filter((e) => !vistos.has(e.eventName) && vistos.add(e.eventName));
}

// Materializa em EventoMetaCapi os eventos ainda não registrados dos leads, dentro da janela de 7 dias.
async function registrarEventos(leads, integracao) {
  // A query já exclui leadgenId nulo (WhatsApp, manual, Make); aqui sai também o que não for um
  // leadgen_id numérico, que a Meta rejeitaria, e o lead de outra página (ou de página nula, criado
  // antes da coluna metaPageId) — vale também pro disparo inline, que não passa pela query do cron.
  const comLeadgen = leads.filter((l) => /^\d+$/.test(l.leadgenId || '') && l.metaPageId === integracao.pageId);
  if (comLeadgen.length === 0) return 0;

  const etapaQualificada = ETAPAS_QUALIFICAVEIS.includes(integracao.metaEtapaQualificada)
    ? integracao.metaEtapaQualificada
    : ETAPA_QUALIFICADA_PADRAO;

  // Histórico completo, não só o da janela: a regra de retrocesso depende da etapa mais funda já atingida.
  const historicos = await prisma.historicoEtapaLead.findMany({
    where: { leadId: { in: comLeadgen.map((l) => l.id) } },
    orderBy: { alteradoEm: 'asc' },
    select: { leadId: true, statusNovo: true, alteradoEm: true },
  });
  const porLead = new Map();
  for (const h of historicos) {
    if (!porLead.has(h.leadId)) porLead.set(h.leadId, []);
    porLead.get(h.leadId).push(h);
  }

  const limite = inicioJanela();
  const linhas = comLeadgen.flatMap((lead) => derivarEventos(lead, porLead.get(lead.id) || [], etapaQualificada)
    .filter((e) => e.eventTime >= limite)
    .map((e) => ({ ...e, imobiliariaId: lead.imobiliariaId, leadId: lead.id, leadgenId: lead.leadgenId })));
  if (linhas.length === 0) return 0;

  const { count } = await prisma.eventoMetaCapi.createMany({ data: linhas, skipDuplicates: true });
  return count;
}

// A Meta quer lead_id como número, mas o leadgen_id tem 15–17 dígitos, acima do inteiro seguro do
// JS (2^53): Number('29247709128180613') vira ...612 e o evento cairia em outro lead. Então o literal
// do banco entra direto no texto do JSON, sem nunca passar por Number.
function corpoComLeadIdNumerico(payload, leadgenId) {
  const json = JSON.stringify(payload);
  if (!/^\d+$/.test(leadgenId)) return json;
  return json.replace(`"lead_id":"${leadgenId}"`, `"lead_id":${leadgenId}`);
}

async function enviarEvento(evento, integracao) {
  const testEventCode = codigoTeste(integracao);
  const ref = `evento=${evento.id} ${evento.eventName} lead=${evento.leadId} leadgenId=${evento.leadgenId} `
    + `dataset=${integracao.metaDatasetId}${testEventCode ? ` teste=${testEventCode}` : ''}`;

  // Trava atômica: cron e mudança de etapa podem tentar o mesmo evento ao mesmo tempo.
  const trava = await prisma.eventoMetaCapi.updateMany({
    where: { id: evento.id, status: { in: ['pendente', 'falha'] } },
    data: { status: 'enviando', tentativas: { increment: 1 }, metaDatasetId: integracao.metaDatasetId, testEventCode },
  });
  if (trava.count === 0) return;
  const tentativa = evento.tentativas + 1;

  const lead = await prisma.lead.findUnique({
    where: { id: evento.leadId },
    select: { email: true, telefone: true, telefoneInvalido: true },
  });
  const userData = { lead_id: evento.leadgenId };
  if (lead?.email) userData.em = [hash(lead.email)];
  if (lead?.telefone && !lead.telefoneInvalido) userData.ph = [hash(telefoneComDDI(lead.telefone))];

  // Um evento por requisição: a Meta descarta o lote inteiro se um evento dele for inválido.
  // Token no corpo, nunca na URL, pra não vazar em log de erro.
  const body = corpoComLeadIdNumerico({
    access_token: integracao.metaDatasetToken,
    ...(testEventCode && { test_event_code: testEventCode }),
    data: [{
      action_source: 'system_generated',
      event_name: evento.eventName,
      // Determinístico: a Meta deduplica por event_id + event_name, então reenvio (cron duas vezes,
      // redeploy, falha após a Meta já ter recebido, enviado_teste voltando pra fila) não duplica.
      event_id: `${evento.leadId}:${evento.eventName}`,
      event_time: Math.floor(new Date(evento.eventTime).getTime() / 1000),
      custom_data: { event_source: 'crm', lead_event_source: LEAD_EVENT_SOURCE },
      user_data: userData,
    }],
  }, evento.leadgenId);

  try {
    const resp = await fetch(`https://graph.facebook.com/${CAPI_VERSION}/${integracao.metaDatasetId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    const texto = await resp.text();
    let json = null;
    try { json = JSON.parse(texto); } catch { /* corpo não-JSON: vai cru pro log */ }
    // Um evento por requisição: 200 sem events_received: 1 também é recusa.
    if (!resp.ok || json?.error || json?.events_received !== 1) {
      const motivo = json?.error?.message
        || (resp.ok && json ? `events_received=${json.events_received ?? 'ausente'}` : `HTTP ${resp.status}`);
      throw Object.assign(new Error(motivo), {
        httpStatus: resp.status,
        resposta: json ?? { corpo: texto.slice(0, 2000) },
      });
    }

    await prisma.eventoMetaCapi.update({
      where: { id: evento.id },
      data: { status: testEventCode ? 'enviado_teste' : 'enviado', enviadoEm: new Date(), respostaMeta: json, ultimoErro: null },
    });
    console.log(`[metaCapi] ${testEventCode ? 'enviado em teste' : 'enviado'} ${ref} tentativa=${tentativa} events_received=${json?.events_received} fbtrace_id=${json?.fbtrace_id}`);
  } catch (err) {
    // Corpo inteiro da resposta (code, error_subcode, error_user_msg, fbtrace_id): rejeição sem o
    // motivo da Meta é tão silenciosa quanto não enviar.
    console.error(
      `[metaCapi] falha ${ref} tentativa=${tentativa}/${MAX_TENTATIVAS} http=${err.httpStatus ?? '-'}: ${err.message}`
      + (err.resposta ? ` | resposta Meta: ${JSON.stringify(err.resposta)}` : ''),
    );
    await prisma.eventoMetaCapi.update({
      where: { id: evento.id },
      data: {
        status: 'falha',
        ultimoErro: String(err.message).slice(0, 1000),
        ...(err.resposta && { respostaMeta: err.resposta }),
      },
    });
  }
}

async function enviarPendentes(integracao, filtro = {}) {
  // Fora do modo de teste, o que só foi pra aba Eventos de Teste volta pra fila e sai como dado real.
  if (!codigoTeste(integracao)) {
    const reenfileirados = await prisma.eventoMetaCapi.updateMany({
      where: { imobiliariaId: integracao.imobiliariaId, status: 'enviado_teste', ...filtro },
      data: { status: 'pendente', tentativas: 0 },
    });
    if (reenfileirados.count) {
      console.log(`[metaCapi] imobiliaria=${integracao.imobiliariaId} — ${reenfileirados.count} evento(s) de teste voltaram pra fila de produção`);
    }
  }

  const pendentes = await prisma.eventoMetaCapi.findMany({
    where: {
      imobiliariaId: integracao.imobiliariaId,
      status: { in: ['pendente', 'falha'] },
      tentativas: { lt: MAX_TENTATIVAS },
      eventTime: { gte: inicioJanela() },
      ...filtro,
    },
    orderBy: { eventTime: 'asc' },
  });
  for (const evento of pendentes) {
    await enviarEvento(evento, integracao);
  }
  return pendentes.length;
}

// Disparo imediato após mudança de etapa no kanban. Só lê estado e envia; quem chama não espera.
// O cron cobre o que falhar aqui.
async function sincronizarEventosLead(leadId) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: SELECT_LEAD });
  if (!lead?.leadgenId) return; // WhatsApp, manual, Make etc.: ignorado em silêncio

  const integracao = await obterIntegracaoCapi(lead.imobiliariaId);
  if (!integracao) return;

  await registrarEventos([lead], integracao);
  await enviarPendentes(integracao, { leadId });
}

// Cron: registra o que mudou nos últimos 7 dias (inclusive o evento Lead da criação, sem tocar no
// webhook da Meta) e envia/reenvia tudo que estiver pendente ou com falha.
async function sincronizarEventosMetaCapi() {
  const limite = inicioJanela();

  const destravados = await prisma.eventoMetaCapi.updateMany({
    where: { status: 'enviando', atualizadoEm: { lt: new Date(Date.now() - ENVIO_TRAVADO_MS) } },
    data: { status: 'falha', ultimoErro: 'Envio interrompido antes da resposta da Meta' },
  });
  if (destravados.count) console.warn(`[metaCapi] ${destravados.count} envio(s) interrompido(s) voltaram para falha`);

  const expirados = await prisma.eventoMetaCapi.updateMany({
    where: { status: { in: ['pendente', 'falha'] }, eventTime: { lt: limite } },
    data: { status: 'expirado' },
  });
  if (expirados.count) console.warn(`[metaCapi] ${expirados.count} evento(s) expirado(s) — fora da janela de 7 dias da Meta`);

  const configuradas = await prisma.metaIntegracao.findMany({
    where: { ativo: true, metaDatasetId: { not: null }, metaDatasetToken: { not: null } },
    select: { imobiliariaId: true },
    distinct: ['imobiliariaId'],
  });

  if (process.env.META_CAPI_TEST_EVENT_CODE) {
    console.warn(
      `[metaCapi] MODO DE TESTE GLOBAL ATIVO (META_CAPI_TEST_EVENT_CODE=${process.env.META_CAPI_TEST_EVENT_CODE}) — `
      + 'eventos vão só pra aba Eventos de Teste e NÃO contam pra otimização',
    );
  }

  for (const { imobiliariaId } of configuradas) {
    try {
      const integracao = await obterIntegracaoCapi(imobiliariaId);
      if (!integracao) continue;
      if (integracao.metaTestEventCode) {
        console.warn(
          `[metaCapi] imobiliaria=${imobiliariaId} em MODO DE TESTE (test_event_code=${integracao.metaTestEventCode}) — `
          + 'eventos NÃO contam pra otimização',
        );
      }

      const leads = await prisma.lead.findMany({
        where: {
          imobiliariaId,
          leadgenId: { not: null },
          metaPageId: integracao.pageId, // só a página que tem o dataset; página nula fica de fora
          OR: [
            { criadoEm: { gte: limite } },
            { historicoEtapaLead: { some: { alteradoEm: { gte: limite } } } },
          ],
        },
        select: SELECT_LEAD,
      });

      const registrados = await registrarEventos(leads, integracao);
      const processados = await enviarPendentes(integracao);
      if (registrados || processados) {
        console.log(`[metaCapi] imobiliaria=${imobiliariaId} — ${registrados} evento(s) novo(s), ${processados} envio(s) tentado(s)`);
      }
    } catch (err) {
      console.error(`[metaCapi] erro ao sincronizar imobiliaria=${imobiliariaId}:`, err.message);
    }
  }
}

module.exports = {
  sincronizarEventosLead,
  sincronizarEventosMetaCapi,
  derivarEventos,
  codigoTeste,
  ETAPAS_QUALIFICAVEIS,
};
