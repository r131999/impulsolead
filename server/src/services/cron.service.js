const cron = require('node-cron');
const https = require('https');
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

// ── Job 3: monitor de saúde da instância Evolution API ───────────────────────

const MONITOR_CONFIG = {
  apiUrl:      'https://api.impulsoslz.com.br',
  apiKey:      'impulso2026_api_key',
  instancia:   'testeimpulso',
  adminPhone:  '5598984802694',
};

// Flag em memória: timestamp do último alerta enviado (anti-spam — 1 alerta/hora)
let ultimoAlertaEnviadoEm = null;

function horaBrasilia() {
  return new Date().toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function httpJson(method, url, body, headers) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const bodyStr = body ? JSON.stringify(body) : '';
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        apikey: MONITOR_CONFIG.apiKey,
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
        ...headers,
      },
      timeout: 10000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function enviarAlertaAdmin(texto) {
  const { apiUrl, instancia, adminPhone } = MONITOR_CONFIG;
  const payload = { number: adminPhone, text: texto };

  try {
    await httpJson('POST', `${apiUrl}/message/sendText/${instancia}`, payload);
    console.log('[monitor] Alerta WhatsApp enviado para admin');
    return true;
  } catch (err) {
    // testeimpulso está down — tenta instância configurada por env se for diferente
    const envInstancia = process.env.EVOLUTION_INSTANCE_NAME;
    if (envInstancia && envInstancia !== instancia) {
      try {
        await httpJson('POST', `${apiUrl}/message/sendText/${envInstancia}`, payload);
        console.log(`[monitor] Alerta enviado via instância alternativa: ${envInstancia}`);
        return true;
      } catch (err2) {
        console.error('[monitor] Instância alternativa também falhou:', err2.message);
      }
    }
    console.error('[monitor] ALERTA NÃO ENVIADO (fallback console):\n' + texto);
    return false;
  }
}

async function verificarInstanciaEvolution() {
  console.log('[monitor] Verificando estado da instância WhatsApp...');
  const { apiUrl, instancia } = MONITOR_CONFIG;

  let estado;
  try {
    const res = await httpJson('GET', `${apiUrl}/instance/connectionState/${instancia}`);
    // Evolution v2: { instance: { state: '...' } } | v1: { state: '...' }
    estado = res.body?.instance?.state || res.body?.state || 'unknown';
    console.log(`[monitor] Estado da instância "${instancia}": ${estado}`);
  } catch (err) {
    console.error('[monitor] Erro ao consultar connectionState:', err.message);
    return;
  }

  if (estado === 'open') return; // Conectado — nada a fazer

  // ── Instância desconectada: tentar reconexão automática ──────────────────
  console.log('[monitor] Instância desconectada. Tentando reconexão automática...');
  let reconectou = false;

  try {
    const resConn = await httpJson('POST', `${apiUrl}/instance/connect/${instancia}`, {});
    if (resConn.status === 200 || resConn.status === 201) {
      console.log('[monitor] Requisição de reconexão aceita. Aguardando 30s...');
      await new Promise((r) => setTimeout(r, 30000));

      const res2 = await httpJson('GET', `${apiUrl}/instance/connectionState/${instancia}`);
      const estado2 = res2.body?.instance?.state || res2.body?.state || 'unknown';
      console.log(`[monitor] Estado após reconexão: ${estado2}`);

      if (estado2 === 'open') {
        reconectou = true;
        await enviarAlertaAdmin('✅ Instância reconectada automaticamente!');
        return;
      }
      estado = estado2; // atualiza estado para o alerta
    }
  } catch (err) {
    console.error('[monitor] Erro ao tentar reconexão:', err.message);
  }

  // ── Anti-spam: máximo 1 alerta por hora ──────────────────────────────────
  const agora = Date.now();
  if (ultimoAlertaEnviadoEm && agora - ultimoAlertaEnviadoEm < 60 * 60 * 1000) {
    console.log('[monitor] Alerta já enviado há menos de 1h — suprimido para evitar spam.');
    return;
  }

  const msgAlerta = [
    '⚠️ ALERTA ImpulsoLead',
    '',
    `A instância WhatsApp (${instancia}) está DESCONECTADA.`,
    '',
    `Estado: ${estado}`,
    `Horário: ${horaBrasilia()}`,
    '',
    'Acesse o painel da Evolution API para reconectar:',
    `${apiUrl}/manager`,
  ].join('\n');

  ultimoAlertaEnviadoEm = agora;
  await enviarAlertaAdmin(msgAlerta);
  console.log(`[monitor] Alerta de desconexão enviado (estado: ${estado})`);
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

  cron.schedule('*/5 * * * *', async () => {
    try {
      await verificarInstanciaEvolution();
    } catch (err) {
      console.error('[cron] Erro no job monitor-evolution:', err.message);
    }
  });

  console.log('[cron] Jobs iniciados: leads-parados (a cada 6h) | relatorio-semanal (dom 8h) | monitor-evolution (a cada 5min)');
}

module.exports = { iniciarCrons };
