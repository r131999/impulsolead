const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { enviarWhatsApp } = require('./notificacao.service');

const prisma = new PrismaClient();

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

    await enviarWhatsApp(telefoneGestor, texto);

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

      await enviarWhatsApp(telefoneGestor, texto);
      console.log(`[cron] Relatório semanal enviado para ${imob.nome}`);
    } catch (err) {
      console.error(`[cron] Erro no relatório de ${imob.nome}:`, err.message);
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

  console.log('[cron] Jobs iniciados: leads-parados (a cada 6h) | relatorio-semanal (dom 8h)');
}

module.exports = { iniciarCrons };
