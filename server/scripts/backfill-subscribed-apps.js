#!/usr/bin/env node
'use strict';

// As linhas de WhatsappCloudApiInstancia inseridas manualmente por SQL (antes do
// Embedded Signup existir) nunca passaram pelo POST /{waba-id}/subscribed_apps —
// sem isso a Meta nunca manda mensagem nenhuma pro nosso webhook pra essa WABA,
// mesmo com token e phoneNumberId corretos no banco. Este script confere cada
// instância ativa e assina as que ainda não estão.
//
// Idempotente: GET antes de POST, só assina quem realmente falta.

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const CLOUD_API_VERSION = 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${CLOUD_API_VERSION}`;
const APP_ID = process.env.META_WA_APP_ID;

async function jaAssinado(wabaId, accessToken) {
  const resp = await fetch(`${GRAPH_BASE}/${wabaId}/subscribed_apps`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(json?.error?.message || `HTTP ${resp.status}`);

  const apps = Array.isArray(json.data) ? json.data : [];
  return apps.some((a) => String(a.id) === String(APP_ID) || String(a.whatsapp_business_api_data?.id) === String(APP_ID));
}

async function assinar(wabaId, accessToken) {
  const resp = await fetch(`${GRAPH_BASE}/${wabaId}/subscribed_apps`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || json.success !== true) {
    throw new Error(json?.error?.message || `HTTP ${resp.status}`);
  }
}

async function main() {
  if (!APP_ID) {
    console.error('META_WA_APP_ID não configurado — necessário pra checar se o app já está na lista de assinantes.');
    process.exit(1);
  }

  const instancias = await prisma.whatsappCloudApiInstancia.findMany({
    where: { ativo: true },
    include: { imobiliaria: { select: { nome: true } } },
  });

  console.log(`Instâncias Cloud API ativas: ${instancias.length}`);

  let assinadas = 0, jaCorretas = 0, comErro = 0;

  for (const inst of instancias) {
    const rotulo = `${inst.imobiliaria.nome} (waba=${inst.businessAccountId || 'sem waba_id'})`;

    if (!inst.businessAccountId) {
      console.warn(`[PULO] ${rotulo} — sem businessAccountId (waba_id) gravado, não dá pra assinar`);
      comErro++;
      continue;
    }

    try {
      if (await jaAssinado(inst.businessAccountId, inst.accessToken)) {
        jaCorretas++;
        continue;
      }

      await assinar(inst.businessAccountId, inst.accessToken);
      console.log(`[OK] ${rotulo} — assinada agora`);
      assinadas++;
    } catch (err) {
      console.error(`[ERRO] ${rotulo} — ${err.message}`);
      comErro++;
    }
  }

  console.log(`\nAssinadas agora: ${assinadas} | Já corretas: ${jaCorretas} | Com erro: ${comErro}`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
