'use strict';

const prisma = require('../lib/prisma');

// Medidor de consumo do agente de IA — só leitura. Calcula sob demanda a partir
// de MensagemLead; não grava nada, não bloqueia qualificação, não dispara aviso.
//
// "Lead consumido" = lead com pelo menos uma troca com a Lia no ciclo: ao menos
// uma mensagem do lead E ao menos uma resposta da Lia ('assistente'). Lia só
// grava 'assistente' em resposta a mensagem do lead (qualificação ao vivo em
// agente.controller.js e backfill da triagem em webhook.controller.js), então
// lead de formulário que nunca respondeu não entra. Triagem descartada (contato
// que nunca virou lead) também não entra: não existe Lead nem MensagemLead.

const MS_DIA = 24 * 60 * 60 * 1000;
const OFFSET_BRASILIA_MS = 3 * 60 * 60 * 1000; // UTC-3, sem horário de verão

// Mesma semântica de requirePermissao / usePermissao: fail-open, só é "sem
// agente" quando a chave está explicitamente em false.
function temAgenteIA(permissoes) {
  if (!permissoes || typeof permissoes !== 'object') return true;
  return permissoes.agenteIA !== false;
}

function diaBrasilia(data) {
  return new Date(new Date(data).getTime() - OFFSET_BRASILIA_MS).getUTCDate();
}

// Dia do ciclo: o campo explícito manda; vazio (imobiliária criada depois da
// migration) cai na mesma regra do preenchimento inicial.
function resolverDiaCiclo(imob) {
  if (imob.diaCicloFaturamento) return imob.diaCicloFaturamento;
  return diaBrasilia(imob.planoExpiraEm || imob.criadoEm);
}

function diasNoMes(ano, mes) {
  return new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
}

// 00:00 de Brasília do dia de renovação no mês (ano, mes) — dia 31 em mês
// curto vira o último dia do mês. Date.UTC normaliza mes fora de 0–11.
function inicioDoDiaDeRenovacao(ano, mes, dia) {
  const ref = new Date(Date.UTC(ano, mes, 1));
  const a = ref.getUTCFullYear();
  const m = ref.getUTCMonth();
  const d = Math.min(dia, diasNoMes(a, m));
  return new Date(Date.UTC(a, m, d) + OFFSET_BRASILIA_MS);
}

// Ciclo como aniversário mensal: começa no último dia de renovação <= agora e
// termina no próximo.
function calcularCiclo(diaCiclo, agora = new Date()) {
  const br = new Date(agora.getTime() - OFFSET_BRASILIA_MS);
  const ano = br.getUTCFullYear();
  const mes = br.getUTCMonth();

  let inicio = inicioDoDiaDeRenovacao(ano, mes, diaCiclo);
  let mesInicio = mes;
  if (agora < inicio) {
    mesInicio = mes - 1;
    inicio = inicioDoDiaDeRenovacao(ano, mesInicio, diaCiclo);
  }
  const fim = inicioDoDiaDeRenovacao(ano, mesInicio + 1, diaCiclo);
  return { inicio, fim };
}

async function contarLeadsAtendidosPeloAgente(imobiliariaId, inicio, fim) {
  const [{ total }] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS total FROM (
      SELECT "leadId"
      FROM "MensagemLead"
      WHERE "imobiliariaId" = ${imobiliariaId}
        AND "criadoEm" >= ${inicio}
        AND "criadoEm" < ${fim}
        AND "remetenteTipo" IN ('lead', 'assistente')
      GROUP BY "leadId"
      HAVING COUNT(*) FILTER (WHERE "remetenteTipo" = 'assistente') > 0
         AND COUNT(*) FILTER (WHERE "remetenteTipo" = 'lead') > 0
    ) t
  `;
  return total;
}

// Projeção linear do consumo até o fim do ciclo. Só a partir de 7 dias
// decorridos — antes disso é ruído e assusta o gestor à toa; devolve null.
const DIAS_MINIMOS_PROJECAO = 7;

function projetarFimDoCiclo(consumido, inicio, fim, agora) {
  const decorridos = (agora - inicio) / MS_DIA;
  if (decorridos < DIAS_MINIMOS_PROJECAO) return null;
  const totais = (fim - inicio) / MS_DIA;
  return Math.round((consumido / decorridos) * totais);
}

const SELECT_CONSUMO = {
  id: true,
  plano: true,
  permissoes: true,
  planoExpiraEm: true,
  criadoEm: true,
  franquiaLeadsAgente: true,
  valorLeadExcedente: true,
  diaCicloFaturamento: true,
};

async function calcularConsumo(imob, agora = new Date()) {
  const { inicio, fim } = calcularCiclo(resolverDiaCiclo(imob), agora);
  const consumido = await contarLeadsAtendidosPeloAgente(imob.id, inicio, fim);

  const franquia = imob.franquiaLeadsAgente ?? null;
  const valorLeadExcedente = imob.valorLeadExcedente != null ? Number(imob.valorLeadExcedente) : null;
  const excedente = franquia != null ? Math.max(0, consumido - franquia) : 0;

  return {
    cicloInicio: inicio,
    cicloFim: fim,
    consumido,
    franquia,
    percentual: franquia != null ? Math.round((consumido / franquia) * 100) : null,
    projecaoFimCiclo: projetarFimDoCiclo(consumido, inicio, fim, agora),
    excedente,
    valorLeadExcedente,
    valorExcedente: valorLeadExcedente != null ? Math.round(excedente * valorLeadExcedente * 100) / 100 : null,
  };
}

async function calcularConsumoImobiliaria(imobiliariaId, agora = new Date()) {
  const imob = await prisma.imobiliaria.findUnique({ where: { id: imobiliariaId }, select: SELECT_CONSUMO });
  if (!imob) return null;
  return calcularConsumo(imob, agora);
}

module.exports = {
  SELECT_CONSUMO,
  temAgenteIA,
  calcularCiclo,
  resolverDiaCiclo,
  calcularConsumo,
  calcularConsumoImobiliaria,
};
