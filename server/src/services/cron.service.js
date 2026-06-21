const cron = require('node-cron');
const { enviarWhatsApp } = require('./notificacao.service');
const { sincronizarGastoAnuncios } = require('./adSpend.service');
const { enviarPushCorretor } = require('../controllers/push.controller');

const prisma = require('../lib/prisma');

// Brasília = UTC-3. Midnight Brasília = 03:00 UTC.
function inicioDiaBrasilia(agora) {
  const d = new Date(agora);
  d.setUTCHours(3, 0, 0, 0);
  if (agora.getUTCHours() < 3) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return d;
}

function fmtDataBrasilia(d) {
  const br = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  const dd = String(br.getUTCDate()).padStart(2, '0');
  const mm = String(br.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

function fmtHoraBrasilia(d) {
  const br = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  const hh = String(br.getUTCHours()).padStart(2, '0');
  const mm = String(br.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function dentroDoHorarioComercial(d) {
  const horaBrasilia = new Date(d.getTime() - 3 * 60 * 60 * 1000).getUTCHours();
  return horaBrasilia >= 8 && horaBrasilia < 20;
}

const STATUS_LABEL = {
  lead:        'Novo lead',
  atendimento: 'Em atendimento',
  agendamento: 'Agendamento',
  visita:      'Visita',
  proposta:    'Proposta',
};

// ── Job 1: notificar gestor sobre leads parados há mais de 48h ───────────────

async function verificarLeadsParados() {
  console.log('[cron] Verificando leads parados...');

  const limite48h = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const inicioDia = inicioDiaBrasilia(new Date());

  const leads = await prisma.lead.findMany({
    where: {
      status: { notIn: ['venda', 'perdido'] },
      atualizadoEm: { lt: limite48h },
      OR: [
        { ultimaNotificacaoGestor: null },
        { ultimaNotificacaoGestor: { lt: inicioDia } },
      ],
    },
    select: {
      id: true,
      nome: true,
      status: true,
      corretor: { select: { nome: true } },
      imobiliaria: {
        select: {
          id: true,
          nome: true,
          usuarios: {
            where: { role: 'gestor', telefone: { not: null } },
            select: { telefone: true },
            orderBy: { criadoEm: 'asc' },
            take: 1,
          },
        },
      },
    },
  });

  if (leads.length === 0) {
    console.log('[cron] Nenhum lead parado encontrado.');
    return;
  }

  // Agrupar por imobiliária
  const porImobiliaria = new Map();
  for (const lead of leads) {
    const id = lead.imobiliaria.id;
    if (!porImobiliaria.has(id)) {
      porImobiliaria.set(id, { imobiliaria: lead.imobiliaria, leads: [] });
    }
    porImobiliaria.get(id).leads.push(lead);
  }

  for (const { imobiliaria, leads: grupo } of porImobiliaria.values()) {
    const telefoneGestor = imobiliaria.usuarios[0]?.telefone;
    if (!telefoneGestor) {
      console.log(`[cron] ${imobiliaria.nome} sem telefone de gestor — notificação pulada.`);
      continue;
    }

    const linhas = grupo
      .map((l) => `• ${l.nome} — Etapa: ${STATUS_LABEL[l.status] || l.status} — Corretor: ${l.corretor?.nome || 'Sem corretor'}`)
      .join('\n');

    const texto =
      `⚠️ Leads parados há mais de 48h na ${imobiliaria.nome}:\n\n` +
      `${linhas}\n\n` +
      `Acesse o CRM para verificar.`;

    await enviarWhatsApp(telefoneGestor, texto, imobiliaria.id);

    await prisma.lead.updateMany({
      where: { id: { in: grupo.map((l) => l.id) } },
      data: { ultimaNotificacaoGestor: new Date() },
    });

    console.log(`[cron] Leads parados: notificação enviada para ${imobiliaria.nome} (${grupo.length} lead(s))`);
  }
}

// ── Job 2: relatório semanal todo domingo às 8h ───────────────────────────────

async function enviarRelatorioSemanal() {
  console.log('[cron] Enviando relatórios semanais...');

  const agora = new Date();
  const seteDiasAtras = new Date(inicioDiaBrasilia(agora).getTime() - 7 * 24 * 60 * 60 * 1000);

  const imobiliarias = await prisma.imobiliaria.findMany({
    where: { plano: { not: 'cancelado' } },
    select: {
      id: true,
      nome: true,
      usuarios: {
        where: { role: 'gestor', telefone: { not: null } },
        select: { telefone: true },
        orderBy: { criadoEm: 'asc' },
        take: 1,
      },
    },
  });

  for (const imob of imobiliarias) {
    const telefoneGestor = imob.usuarios[0]?.telefone;
    if (!telefoneGestor) {
      console.log(`[cron] ${imob.nome} sem telefone de gestor — relatório pulado.`);
      continue;
    }

    try {
      const [leadsRecebidos, vendasFechadas, emAtendimento, ranking] = await Promise.all([
        prisma.lead.count({
          where: { imobiliariaId: imob.id, criadoEm: { gte: seteDiasAtras } },
        }),
        prisma.lead.count({
          where: {
            imobiliariaId: imob.id,
            status: 'venda',
            atualizadoEm: { gte: seteDiasAtras },
          },
        }),
        prisma.lead.count({
          where: {
            imobiliariaId: imob.id,
            status: { notIn: ['venda', 'perdido'] },
          },
        }),
        prisma.lead.groupBy({
          by: ['corretorId'],
          where: {
            imobiliariaId: imob.id,
            criadoEm: { gte: seteDiasAtras },
            corretorId: { not: null },
          },
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: 1,
        }),
      ]);

      let destaqueTexto = 'Nenhum destaque esta semana';
      if (ranking.length > 0) {
        const corretor = await prisma.corretor.findUnique({
          where: { id: ranking[0].corretorId },
          select: { nome: true },
        });
        if (corretor) {
          const qt = ranking[0]._count.id;
          destaqueTexto = `${corretor.nome} com ${qt} lead${qt !== 1 ? 's' : ''}`;
        }
      }

      const texto = [
        `📊 Relatório semanal — ${imob.nome}`,
        ``,
        `Semana de ${fmtDataBrasilia(seteDiasAtras)} a ${fmtDataBrasilia(agora)}`,
        ``,
        `📥 Leads recebidos: ${leadsRecebidos}`,
        `✅ Vendas fechadas: ${vendasFechadas}`,
        `📋 Em atendimento: ${emAtendimento}`,
        ``,
        `🏆 Destaque da semana: ${destaqueTexto}`,
        ``,
        `Acesse o CRM para ver todos os detalhes.`,
      ].join('\n');

      await enviarWhatsApp(telefoneGestor, texto, imob.id);
      console.log(`[cron] Relatório semanal enviado para ${imob.nome}`);
    } catch (err) {
      console.error(`[cron] Erro no relatório de ${imob.nome}:`, err.message);
    }
  }
}

// ── Job 3: verificar planos vencendo / expirados ──────────────────────────────

async function verificarPlanoVencimento() {
  console.log('[cron] Verificando planos vencendo/vencidos...');
  const agora = new Date();
  const em2Dias = new Date(agora.getTime() + 2 * 24 * 60 * 60 * 1000);
  const ha5Dias = new Date(agora.getTime() - 5 * 24 * 60 * 60 * 1000);

  // 1. Marcar notificacaoVencimento para planos pagos vencendo em <= 2 dias
  await prisma.imobiliaria.updateMany({
    where: {
      plano: { notIn: ['legado', 'cancelado', 'trial'] },
      planoBloqueadoEm: null,
      planoExpiraEm: { gte: agora, lte: em2Dias },
    },
    data: { notificacaoVencimento: true },
  });

  // Trials vencendo em <= 2 dias (precisamos fazer em JS pois a data é calculada)
  const todosTrials = await prisma.imobiliaria.findMany({
    where: { plano: 'trial', planoBloqueadoEm: null },
    select: { id: true, trialExpiraEm: true, criadoEm: true },
  });

  const trialsExpirando = todosTrials.filter((imob) => {
    const expira = imob.trialExpiraEm
      ? new Date(imob.trialExpiraEm)
      : new Date(new Date(imob.criadoEm).getTime() + 7 * 24 * 60 * 60 * 1000);
    const dias = (expira - agora) / (1000 * 60 * 60 * 24);
    return dias >= 0 && dias <= 2;
  }).map((imob) => imob.id);

  if (trialsExpirando.length > 0) {
    await prisma.imobiliaria.updateMany({
      where: { id: { in: trialsExpirando } },
      data: { notificacaoVencimento: true },
    });
    console.log(`[cron] ${trialsExpirando.length} trial(s) marcado(s) para notificação`);
  }

  // 2. Bloquear planos pagos vencidos há mais de 5 dias
  await prisma.imobiliaria.updateMany({
    where: {
      plano: { notIn: ['legado', 'cancelado'] },
      planoBloqueadoEm: null,
      planoExpiraEm: { lt: ha5Dias },
    },
    data: { planoBloqueadoEm: agora },
  });

  // 3. Bloquear trials expirados há mais de 5 dias
  const trialsParaBloquear = todosTrials.filter((imob) => {
    const expira = imob.trialExpiraEm
      ? new Date(imob.trialExpiraEm)
      : new Date(new Date(imob.criadoEm).getTime() + 7 * 24 * 60 * 60 * 1000);
    return expira < ha5Dias;
  }).map((imob) => imob.id);

  if (trialsParaBloquear.length > 0) {
    await prisma.imobiliaria.updateMany({
      where: { id: { in: trialsParaBloquear } },
      data: { planoBloqueadoEm: agora },
    });
    console.log(`[cron] ${trialsParaBloquear.length} trial(s) bloqueado(s)`);
  }

  console.log('[cron] Verificação de planos concluída');
}

// ── Job 5: alerta escalonado de leads sem tratativa (corretor → gestor) ──────

// Teto de idade dos leads considerados "novos esfriando" — evita disparar o
// alerta contra backlog histórico acumulado (lead antigo parado não é o caso de uso).
const TETO_IDADE_COM_CORRETOR_H = 48;   // Parte A: só leads criados nas últimas 48h
const TETO_IDADE_SEM_CORRETOR_H = 168;  // Parte B: só leads criados nos últimos 7 dias (24h x 7)

async function obterTelefoneGestor(imobiliaria) {
  if (imobiliaria.telefoneNotificacoes) return imobiliaria.telefoneNotificacoes;
  return imobiliaria.usuarios[0]?.telefone || null;
}

// Parte A: leads com corretor, sem tratativa — avisa corretor e escala para gestor
async function processarEscalonamentoCorretorGestor(imobiliaria, agora) {
  const tetoIdade = new Date(agora.getTime() - TETO_IDADE_COM_CORRETOR_H * 60 * 60 * 1000);

  const leads = await prisma.lead.findMany({
    where: {
      imobiliariaId: imobiliaria.id,
      status: 'lead',
      corretorId: { not: null },
      criadoEm: { gte: tetoIdade },
      OR: [{ observacoes: null }, { observacoes: '' }],
    },
    select: {
      id: true,
      nome: true,
      criadoEm: true,
      avisoCorretorEm: true,
      avisoGestorEm: true,
      corretor: { select: { id: true, nome: true, telefone: true, whatsapp: true } },
    },
  });

  if (leads.length === 0) return;

  const porCorretor = new Map();
  const paraGestor = [];

  for (const lead of leads) {
    const horas = (agora - new Date(lead.criadoEm)) / (1000 * 60 * 60);

    if (horas >= imobiliaria.avisoLeadCorretorHoras && !lead.avisoCorretorEm) {
      const corretorId = lead.corretor.id;
      if (!porCorretor.has(corretorId)) {
        porCorretor.set(corretorId, { corretor: lead.corretor, leads: [] });
      }
      porCorretor.get(corretorId).leads.push(lead);
    }

    if (horas >= imobiliaria.avisoLeadGestorHoras && !lead.avisoGestorEm) {
      paraGestor.push({ lead, horas });
    }
  }

  for (const { corretor, leads: grupo } of porCorretor.values()) {
    const linhas = grupo
      .map((l) => `• ${l.nome} — recebido às ${fmtHoraBrasilia(l.criadoEm)}`)
      .join('\n');

    const texto =
      `⏰ Você tem lead(s) aguardando há mais de ${imobiliaria.avisoLeadCorretorHoras}h sem nenhuma atualização:\n` +
      `${linhas}\n` +
      `Fale com o lead e registre a tratativa na observação do card.`;

    await enviarPushCorretor(corretor.id, '⏰ Leads aguardando atualização', texto);
    await enviarWhatsApp(corretor.whatsapp || corretor.telefone, texto, imobiliaria.id);

    await prisma.lead.updateMany({
      where: { id: { in: grupo.map((l) => l.id) } },
      data: { avisoCorretorEm: agora },
    });

    console.log(`[cron] Aviso de corretor enviado para ${corretor.nome} (${grupo.length} lead(s))`);
  }

  if (paraGestor.length > 0) {
    const telefoneGestor = await obterTelefoneGestor(imobiliaria);
    if (!telefoneGestor) {
      console.log(`[cron] ${imobiliaria.nome} sem telefone de gestor — escalonamento pulado.`);
    } else {
      const linhas = paraGestor
        .map(({ lead, horas }) => `• ${lead.nome} — Corretor: ${lead.corretor.nome} — parado há ${Math.floor(horas)}h`)
        .join('\n');

      const texto =
        `⚠️ Lead(s) sem tratativa há mais de ${imobiliaria.avisoLeadGestorHoras}h, o corretor já foi avisado e não atualizou:\n` +
        `${linhas}\n` +
        `Entre no CRM para falar com o corretor ou transferir o lead.`;

      await enviarWhatsApp(telefoneGestor, texto, imobiliaria.id);

      console.log(`[cron] Escalonamento ao gestor enviado para ${imobiliaria.nome} (${paraGestor.length} lead(s))`);
    }

    await prisma.lead.updateMany({
      where: { id: { in: paraGestor.map(({ lead }) => lead.id) } },
      data: { avisoGestorEm: agora },
    });
  }
}

// Parte B: leads sem corretor parados há mais de 24h — alerta diário ao gestor
async function processarLeadsSemCorretor(imobiliaria, agora) {
  const limite24h = new Date(agora.getTime() - 24 * 60 * 60 * 1000);
  const tetoIdade = new Date(agora.getTime() - TETO_IDADE_SEM_CORRETOR_H * 60 * 60 * 1000);
  const inicioDia = inicioDiaBrasilia(agora);

  const jaAvisadoHoje =
    imobiliaria.ultimoAlertaSemCorretorEm && new Date(imobiliaria.ultimoAlertaSemCorretorEm) >= inicioDia;
  if (jaAvisadoHoje) return;

  const existeLeadParado = await prisma.lead.findFirst({
    where: {
      imobiliariaId: imobiliaria.id,
      status: 'lead',
      corretorId: null,
      criadoEm: { lt: limite24h, gte: tetoIdade },
    },
    select: { id: true },
  });

  if (!existeLeadParado) return;

  const telefoneGestor = await obterTelefoneGestor(imobiliaria);
  if (!telefoneGestor) {
    console.log(`[cron] ${imobiliaria.nome} sem telefone de gestor — alerta sem-corretor pulado.`);
    return;
  }

  const texto = '📋 Existem leads parados há mais de 24h aguardando distribuição no CRM. Entre e distribua para algum corretor.';
  await enviarWhatsApp(telefoneGestor, texto, imobiliaria.id);

  await prisma.imobiliaria.update({
    where: { id: imobiliaria.id },
    data: { ultimoAlertaSemCorretorEm: agora },
  });

  console.log(`[cron] Alerta de leads sem corretor enviado para ${imobiliaria.nome}`);
}

async function verificarLeadsSemTratativa() {
  console.log('[cron] Verificando leads sem tratativa...');

  const agora = new Date();
  if (!dentroDoHorarioComercial(agora)) {
    console.log('[cron] Fora do horário comercial (8h–20h Brasília) — aguardando próximo ciclo.');
    return;
  }

  const imobiliarias = await prisma.imobiliaria.findMany({
    where: { avisoLeadAtivo: true },
    select: {
      id: true,
      nome: true,
      avisoLeadCorretorHoras: true,
      avisoLeadGestorHoras: true,
      telefoneNotificacoes: true,
      ultimoAlertaSemCorretorEm: true,
      usuarios: {
        where: { role: 'gestor', telefone: { not: null } },
        select: { telefone: true },
        orderBy: { criadoEm: 'asc' },
        take: 1,
      },
    },
  });

  for (const imobiliaria of imobiliarias) {
    try {
      await processarEscalonamentoCorretorGestor(imobiliaria, agora);
      await processarLeadsSemCorretor(imobiliaria, agora);
    } catch (err) {
      console.error(`[cron] Erro ao verificar leads sem tratativa de ${imobiliaria.nome}:`, err.message);
    }
  }
}

// ── Inicialização ─────────────────────────────────────────────────────────────

function iniciarCrons() {
  cron.schedule('0 */6 * * *', async () => {
    try {
      await verificarLeadsParados();
    } catch (err) {
      console.error('[cron] Erro no job leads-parados:', err.message);
    }
  });

  cron.schedule('0 8 * * 0', async () => {
    try {
      await enviarRelatorioSemanal();
    } catch (err) {
      console.error('[cron] Erro no job relatorio-semanal:', err.message);
    }
  });

  // Job 3: verificação de planos — todo dia às 9h Brasília (12h UTC)
  cron.schedule('0 12 * * *', async () => {
    try {
      await verificarPlanoVencimento();
    } catch (err) {
      console.error('[cron] Erro no job plano-vencimento:', err.message);
    }
  });

  // Job 4: sincronizar gasto de anúncios Meta — a cada 20 minutos
  cron.schedule('*/20 * * * *', async () => {
    try {
      await sincronizarGastoAnuncios();
    } catch (err) {
      console.error('[cron] Erro no job ad-spend:', err.message);
    }
  });

  // Job 5: alerta escalonado de leads sem tratativa — a cada 15 minutos
  cron.schedule('*/15 * * * *', async () => {
    try {
      await verificarLeadsSemTratativa();
    } catch (err) {
      console.error('[cron] Erro no job leads-sem-tratativa:', err.message);
    }
  });

  console.log('[cron] Jobs iniciados: leads-parados (6h) | relatorio-semanal (dom 8h) | plano-vencimento (diário 9h) | ad-spend (20min) | leads-sem-tratativa (15min)');
}

module.exports = { iniciarCrons };
