'use strict';

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');

// ── Configurações globais ──────────────────────────────────────────────────────
const API_BASE     = process.env.API_BASE     || 'https://api-crm.impulsoslz.com.br/api';
const INTERNAL_KEY = process.env.INTERNAL_KEY || '';
const MANAGER_KEY  = process.env.MANAGER_KEY  || '';
const HTTP_PORT    = parseInt(process.env.HTTP_PORT || '3010', 10);
const SESSIONS_DIR = path.join(__dirname, 'sessions');

const BLOCKED_INTERVAL = 10 * 60 * 1000;  // 10 min
const MSG_DEDUPE_TTL   = 30 * 60 * 1000;  // 30 min
const RECENT_LEAD_TTL  = 24 * 60 * 60 * 1000; // 24 h
const CLEANUP_INTERVAL = 5  * 60 * 1000;  // 5 min

const retryQueue = [];
const deduplicacaoConteudo = new Map(); // chave → timestamp
const CONTEUDO_DEDUPE_TTL = 5 * 60 * 1000; // 5 min

const logger = pino({ level: 'silent' });

function tag(msg, id = '') {
  const prefix = id ? id.slice(0, 8) : 'manager';
  console.log(`[WA:${prefix}] ${msg}`);
}

// ── HTTP helper ────────────────────────────────────────────────────────────────
function httpReq(method, url, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      method,
      headers: {
        ...(payload
          ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
          : {}),
        ...headers,
      },
    };
    const mod = u.protocol === 'https:' ? https : http;
    const req = mod.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ── Detecção de campanha ───────────────────────────────────────────────────────
const CAMPAIGN_PATTERNS = [
  /quero mais informa[çc][oõ]es (?:do|sobre o|da)\s+(.+?)\.?$/i,
  /vim\s+pel[ao]\s+(.+)/i,
  /vim\s+d[ao]\s+(.+)/i,
  /interesse\s+n[oa]\s+(.+)/i,
  /indicad[ao]\s+pel[ao]\s+(.+)/i,
  /vi\s+n[ao]\s+(.+)/i,
  /tenho interesse e queria mais informa/i,
];

function detectCampaign(text) {
  if (!text) return null;
  for (const p of CAMPAIGN_PATTERNS) {
    const m = text.match(p);
    if (m) return m[1] ? m[1].trim().slice(0, 100) : 'Anúncio';
  }
  return null;
}

// 559888123187 (12 dígitos) → 5598988123187 (13 dígitos)
function normalizarTelefone(phone) {
  if (phone.length === 12 && phone.startsWith('55') && phone[4] !== '9') {
    return phone.slice(0, 4) + '9' + phone.slice(4);
  }
  return phone;
}

// ── Estado por tenant ──────────────────────────────────────────────────────────
// imobiliariaId → TenantState
const tenants = new Map();

function createTenant(imobiliariaId, apiKey) {
  return {
    imobiliariaId,
    apiKey,
    sock: null,
    isConnected: false,
    connecting: false,
    status: 'desconectado', // desconectado | conectando | aguardando_qr | conectado
    qrCode: null,
    seenMsgIds: new Map(),
    recentLeads: new Map(),
    blockedNumbers: new Set(),
    authDir: path.join(SESSIONS_DIR, imobiliariaId),
    reconnectTimer: null,
    blockedTimer: null,
  };
}

// ── Limpeza periódica ──────────────────────────────────────────────────────────
function cleanupTenant(tenant) {
  const now = Date.now();
  for (const [id, ts] of tenant.seenMsgIds) {
    if (now - ts > MSG_DEDUPE_TTL) tenant.seenMsgIds.delete(id);
  }
  for (const [phone, ts] of tenant.recentLeads) {
    if (now - ts > RECENT_LEAD_TTL) tenant.recentLeads.delete(phone);
  }
}

// ── Números bloqueados ─────────────────────────────────────────────────────────
async function fetchBlockedNumbers(tenant) {
  try {
    const res = await httpReq('GET', `${API_BASE}/webhook/numeros-bloqueados`, null, {
      'x-api-key': tenant.apiKey,
    });
    if (res.status === 200) {
      const json = JSON.parse(res.data);
      const nums = Array.isArray(json)
        ? json
        : (json.telefones || json.numeros || json.numbers || []);
      tenant.blockedNumbers = new Set(nums.map((n) => String(n).replace(/\D/g, '')));
      tag(`Bloqueados: ${tenant.blockedNumbers.size}`, tenant.imobiliariaId);
    }
  } catch (err) {
    tag(`Erro bloqueados: ${err.message}`, tenant.imobiliariaId);
  }
}

// ── Mensagem de boas-vindas ────────────────────────────────────────────────────
const DEFAULT_BV = 'Em breve um de nossos consultores entrará em contato com você.';

async function fetchMensagemBoasVindas(tenant) {
  try {
    const res = await httpReq('GET', `${API_BASE}/webhook/mensagem-boasvindas`, null, {
      'x-api-key': tenant.apiKey,
    });
    if (res.status === 200) {
      const json = JSON.parse(res.data);
      if (json.mensagem) return json.mensagem;
    }
  } catch (err) {
    tag(`Erro boas-vindas fetch: ${err.message}`, tenant.imobiliariaId);
  }
  return DEFAULT_BV;
}

// ── Verificar lead ativo ───────────────────────────────────────────────────────
async function verificarLeadAtivo(tenant, phone, jid = null) {
  try {
    const query = phone.startsWith('lid_') && jid
      ? `jid=${encodeURIComponent(jid)}`
      : `telefone=${phone}`;
    const res = await httpReq(
      'GET',
      `${API_BASE}/webhook/lead-ativo?${query}`,
      null,
      { 'x-api-key': tenant.apiKey },
    );
    if (res.status === 200) return JSON.parse(res.data);
  } catch (err) {
    tag(`Erro lead-ativo: ${err.message}`, tenant.imobiliariaId);
  }
  return { existe: false, leadId: null };
}

// ── Salvar mensagem recebida ───────────────────────────────────────────────────
async function salvarMensagemRecebida(tenant, leadId, conteudo, msgId, remetenteNome) {
  try {
    await httpReq(
      'POST',
      `${API_BASE}/chat-lead/${leadId}/mensagem-recebida`,
      { conteudo, whatsappMsgId: msgId, remetenteNome, tipoMidia: 'texto' },
      { 'x-api-key': tenant.apiKey },
    );
  } catch (err) {
    tag(`Erro salvar msg: ${err.message}`, tenant.imobiliariaId);
  }
}

// ── Processar mensagem recebida ────────────────────────────────────────────────
async function handleMessage(tenant, msg) {
  try {
    if (!msg.message || msg.messageStubType) return;

    const { key, message } = msg;

    if (key.fromMe) return;
    if (!key.remoteJid) return;
    if (key.remoteJid.endsWith('@g.us')) return;
    if (key.remoteJid === 'status@broadcast') return;

    const text =
      message?.conversation ||
      message?.extendedTextMessage?.text ||
      message?.imageMessage?.caption ||
      message?.videoMessage?.caption ||
      '';

    if (!text.trim()) return;

    const msgId = key.id;
    if (tenant.seenMsgIds.has(msgId)) return;
    tenant.seenMsgIds.set(msgId, Date.now());

    const remoteJid = key.remoteJid;
    let realJid = remoteJid;
    let phone;

    if (remoteJid.endsWith('@lid')) {
      const participant = key.participant || msg.participant || key.senderPn || '';
      if (participant && participant.includes('@')) {
        realJid = participant;
        phone = participant.split('@')[0].replace(/\D/g, '');
      } else if (participant) {
        phone = String(participant).replace(/\D/g, '');
        realJid = `${phone}@s.whatsapp.net`;
      } else {
        // @lid sem senderPn — cria identificador temporário para não perder o lead
        const lidRaw = remoteJid.replace('@lid', '').replace(/\D/g, '');
        phone = `lid_${lidRaw.slice(-12)}`;
        tag(`@lid sem participant — identificador temporário: ${phone}`, tenant.imobiliariaId);
      }
    } else {
      phone = remoteJid.split('@')[0].replace(/\D/g, '');
    }

    if (!phone) {
      tag(`Não foi possível extrair número de: ${remoteJid}`, tenant.imobiliariaId);
      return;
    }

    if (!phone.startsWith('lid_')) {
      phone = normalizarTelefone(phone);
      const phoneValido = phone.startsWith('55')
        ? phone.length === 12 || phone.length === 13
        : phone.length >= 10 && phone.length <= 13;
      if (!phoneValido) {
        tag(`Número inválido: ${phone}`, tenant.imobiliariaId);
        return;
      }
    }

    const rawName = msg.pushName || '';
    const nome = rawName && rawName !== 'undefined' && rawName.trim()
      ? rawName.trim()
      : 'Lead WhatsApp';

    if (tenant.blockedNumbers.has(phone)) {
      tag(`Bloqueado: ${phone}`, tenant.imobiliariaId);
      return;
    }

    // ── CAMINHO 1: Lead existente ─────────────────────────────────────────────
    tag(`Verificando lead — phone: ${phone}, jid: ${realJid}`, tenant.imobiliariaId);
    const leadAtivo = await verificarLeadAtivo(tenant, phone, realJid);
    tag(`Lead ativo: ${leadAtivo.existe} | leadId: ${leadAtivo.leadId}`, tenant.imobiliariaId);
    if (leadAtivo.existe && leadAtivo.leadId) {
      tag(`Lead já existe — salvando mensagem`, tenant.imobiliariaId);
      await salvarMensagemRecebida(tenant, leadAtivo.leadId, text, msgId, nome);
      return;
    }

    tag(`Lead novo — criando no CRM`, tenant.imobiliariaId);
    // ── CAMINHO 2: Novo lead ──────────────────────────────────────────────────
    const senderPnRaw = (key.senderPn || msg.participant || '').split('@')[0].replace(/\D/g, '');
    if (tenant.recentLeads.has(phone) || (senderPnRaw && tenant.recentLeads.has(senderPnRaw))) {
      tag(`Lead recente (24h): ${phone}`, tenant.imobiliariaId);
      return;
    }

    const chaveConteudo = `${tenant.imobiliariaId}:${text.trim().toLowerCase().slice(0, 50)}`;
    const tsConteudo = deduplicacaoConteudo.get(chaveConteudo);
    if (tsConteudo && Date.now() - tsConteudo < CONTEUDO_DEDUPE_TTL) {
      tag(`Conteúdo duplicado (5min) — descartando: ${chaveConteudo}`, tenant.imobiliariaId);
      return;
    }
    deduplicacaoConteudo.set(chaveConteudo, Date.now());

    const campanha = detectCampaign(text);
    tag(`Novo lead: ${phone} (${nome})${campanha ? ` | campanha: ${campanha}` : ''}`, tenant.imobiliariaId);

    try {
      const mensagemBV = await fetchMensagemBoasVindas(tenant);
      await tenant.sock.sendMessage(realJid, { text: mensagemBV });
    } catch (err) {
      tag(`Erro boas-vindas: ${err.message}`, tenant.imobiliariaId);
    }

    await new Promise((r) => setTimeout(r, 1000));

    const now = Date.now();
    tenant.recentLeads.set(phone, now);
    if (senderPnRaw && senderPnRaw !== phone) tenant.recentLeads.set(senderPnRaw, now);

    let res;
    try {
      res = await httpReq(
        'POST',
        `${API_BASE}/webhook/lead`,
        {
          nome,
          telefone: phone,
          whatsappJid: realJid,
          campanha: campanha || undefined,
          imobiliariaId: tenant.imobiliariaId,
        },
        { 'x-api-key': tenant.apiKey },
      );
    } catch (err) {
      tag(`Erro ao criar lead, adicionando à fila de retry: ${err.message}`, tenant.imobiliariaId);
      retryQueue.push({
        phone,
        nome,
        text,
        realJid,
        campanha,
        msgId,
        imobiliariaId: tenant.imobiliariaId,
        apiKey: tenant.apiKey,
        tentativas: 0,
        maxTentativas: 3,
        proximaTentativa: Date.now() + 30000,
      });
      return;
    }

    tag(`Lead enviado — status: ${res.status}`, tenant.imobiliariaId);

    if (res.status >= 500) {
      tag(`Erro servidor ao criar lead (${res.status}), adicionando à fila de retry`, tenant.imobiliariaId);
      retryQueue.push({
        phone,
        nome,
        text,
        realJid,
        campanha,
        msgId,
        imobiliariaId: tenant.imobiliariaId,
        apiKey: tenant.apiKey,
        tentativas: 0,
        maxTentativas: 3,
        proximaTentativa: Date.now() + 30000,
      });
      return;
    }

    if (res.status === 201 && text.trim()) {
      try {
        const body = JSON.parse(res.data);
        const leadId = body?.lead?.id;
        if (leadId) {
          await salvarMensagemRecebida(tenant, leadId, text, msgId, nome);
          tag(`Mensagem inicial salva — lead ${leadId}`, tenant.imobiliariaId);
        }
      } catch (err) {
        tag(`Erro msg inicial: ${err.message}`, tenant.imobiliariaId);
      }
    }
  } catch (err) {
    tag(`Erro handleMessage: ${err.message}`, tenant.imobiliariaId);
  }
}

// ── Conectar tenant ────────────────────────────────────────────────────────────
async function connectTenant(tenant) {
  if (tenant.connecting) return;
  tenant.connecting = true;

  if (tenant.reconnectTimer) {
    clearTimeout(tenant.reconnectTimer);
    tenant.reconnectTimer = null;
  }

  try {
    if (!fs.existsSync(tenant.authDir)) {
      fs.mkdirSync(tenant.authDir, { recursive: true });
    }

    // Detecta se havia sessão anterior antes de criar o socket.
    // Usado no handler de 401 para distinguir logout forçado de primeira conexão.
    const hadSession = fs.existsSync(path.join(tenant.authDir, 'creds.json'));

    const { state, saveCreds } = await useMultiFileAuthState(tenant.authDir);
    const { version } = await fetchLatestBaileysVersion();

    tenant.status = 'conectando';

    tenant.sock = makeWASocket({
      version,
      logger,
      auth: state,
      printQRInTerminal: false,
      browser: ['ImpulsoLead', 'Chrome', '120.0.0'],
      connectTimeoutMs: 30000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
      retryRequestDelayMs: 2000,
    });

    tenant.sock.ev.on('creds.update', saveCreds);

    tenant.sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        tenant.qrCode = qr;
        tenant.status = 'aguardando_qr';
        tag('QR Code gerado', tenant.imobiliariaId);
      }

      if (connection === 'close') {
        tenant.isConnected = false;
        tenant.connecting = false;
        tenant.status = 'desconectado';
        tenant.qrCode = null;

        const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
        tag(`Desconectado. Motivo: ${reason}`, tenant.imobiliariaId);

        if (reason === DisconnectReason.loggedOut) {
          if (hadSession) {
            // Sessão anterior rejeitada pelo WhatsApp (logout forçado pelo app).
            // Limpa os arquivos de auth para que a próxima tentativa gere novo QR.
            tag('Logout forçado — limpando sessão anterior, aguardando ação do gestor', tenant.imobiliariaId);
            try {
              fs.rmSync(tenant.authDir, { recursive: true, force: true });
              fs.mkdirSync(tenant.authDir, { recursive: true });
            } catch (e) {
              tag(`Erro ao limpar sessão: ${e.message}`, tenant.imobiliariaId);
            }
            // Não reconecta automaticamente — gestor precisa clicar em Conectar
          } else {
            // Nova sessão sem arquivos recebeu 401 antes do QR — reconecta para gerar QR
            tag('Sessão nova recebeu 401 — reconectando para gerar QR Code', tenant.imobiliariaId);
            tenant.reconnectTimer = setTimeout(() => connectTenant(tenant), 3000);
          }
        } else {
          // Outros erros (queda de rede, timeout etc.) — reconecta normalmente
          tenant.reconnectTimer = setTimeout(() => connectTenant(tenant), 3000);
        }
      } else if (connection === 'open') {
        tenant.isConnected = true;
        tenant.connecting = false;
        tenant.status = 'conectado';
        tenant.qrCode = null;
        tag('Conectado!', tenant.imobiliariaId);
      }
    });

    tenant.sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const msg of messages) {
        await handleMessage(tenant, msg);
      }
    });
  } catch (err) {
    tenant.connecting = false;
    tenant.status = 'desconectado';
    tag(`Erro ao conectar: ${err.message}`, tenant.imobiliariaId);
    tenant.reconnectTimer = setTimeout(() => connectTenant(tenant), 5000);
  }
}

// ── Desconectar tenant ─────────────────────────────────────────────────────────
async function disconnectTenant(imobiliariaId) {
  const tenant = tenants.get(imobiliariaId);
  if (!tenant) return;

  if (tenant.reconnectTimer) {
    clearTimeout(tenant.reconnectTimer);
    tenant.reconnectTimer = null;
  }

  if (tenant.sock) {
    try { await tenant.sock.logout(); } catch (_) {}
    tenant.sock = null;
  }

  tenant.isConnected = false;
  tenant.connecting = false;
  tenant.status = 'desconectado';
  tenant.qrCode = null;
}

// ── Deletar sessão (logout + arquivos de auth) ─────────────────────────────────
async function deleteSession(imobiliariaId) {
  await disconnectTenant(imobiliariaId);
  const tenant = tenants.get(imobiliariaId);
  if (tenant && fs.existsSync(tenant.authDir)) {
    fs.rmSync(tenant.authDir, { recursive: true, force: true });
    tag('Sessão deletada', imobiliariaId);
  }
}

// ── Carregar tenants da API principal ──────────────────────────────────────────
async function loadTenants() {
  try {
    const res = await httpReq('GET', `${API_BASE}/internal/whatsapp-instancias`, null, {
      'x-internal-key': INTERNAL_KEY,
    });
    if (res.status !== 200) {
      tag(`Falha ao carregar tenants: HTTP ${res.status}`);
      return [];
    }
    const instancias = JSON.parse(res.data);
    tag(`${instancias.length} instância(s) encontrada(s)`);
    return instancias;
  } catch (err) {
    tag(`Erro ao carregar tenants: ${err.message}`);
    return [];
  }
}

// ── Iniciar tenant (conectar + agendar blocked refresh) ───────────────────────
async function startTenant(imobiliariaId, apiKey) {
  let tenant = tenants.get(imobiliariaId);
  if (!tenant) {
    tenant = createTenant(imobiliariaId, apiKey);
    tenants.set(imobiliariaId, tenant);
  }

  await connectTenant(tenant);
  await fetchBlockedNumbers(tenant);

  if (!tenant.blockedTimer) {
    tenant.blockedTimer = setInterval(() => fetchBlockedNumbers(tenant), BLOCKED_INTERVAL);
  }

  return tenant;
}

// ── API HTTP (porta 3010) ──────────────────────────────────────────────────────
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error('JSON inválido')); }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, obj) {
  const payload = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function checkManagerKey(req, res) {
  if (!MANAGER_KEY) return true;
  if (req.headers['x-manager-key'] !== MANAGER_KEY) {
    sendJson(res, 401, { error: 'Não autorizado' });
    return false;
  }
  return true;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname;

    // GET /status — resumo de todas as instâncias
    if (req.method === 'GET' && pathname === '/status') {
      const list = [];
      for (const [id, t] of tenants) {
        list.push({
          imobiliariaId: id,
          status: t.status,
          connected: t.isConnected,
          hasQr: !!t.qrCode,
        });
      }
      return sendJson(res, 200, list);
    }

    // GET /status/:imobiliariaId — instância específica (com QR)
    const statusMatch = pathname.match(/^\/status\/([^/]+)$/);
    if (req.method === 'GET' && statusMatch) {
      const tenant = tenants.get(statusMatch[1]);
      if (!tenant) return sendJson(res, 404, { error: 'Tenant não encontrado' });
      return sendJson(res, 200, {
        imobiliariaId: tenant.imobiliariaId,
        status: tenant.status,
        connected: tenant.isConnected,
        qrCode: tenant.qrCode,
      });
    }

    // POST /send — { imobiliariaId, number, text }
    if (req.method === 'POST' && pathname === '/send') {
      const body = await parseBody(req);
      const { imobiliariaId, number, text } = body;

      if (!imobiliariaId || !number || !text) {
        return sendJson(res, 400, { error: 'imobiliariaId, number e text são obrigatórios' });
      }

      const tenant = tenants.get(imobiliariaId);
      if (!tenant?.isConnected || !tenant.sock) {
        return sendJson(res, 503, { error: 'WhatsApp não conectado para este tenant' });
      }

      const jid = number.includes('@') ? number : `${number.replace(/\D/g, '')}@s.whatsapp.net`;
      console.log('[WA:send] Tentando enviar para', jid, 'via', imobiliariaId);
      try {
        await tenant.sock.sendMessage(jid, { text });
        console.log('[WA:send] Enviado com sucesso para', jid);
        return sendJson(res, 200, { ok: true });
      } catch (err) {
        console.error('[WA:send] Erro ao enviar para', jid, ':', err.message);
        return sendJson(res, 500, { error: err.message });
      }
    }

    // POST /send-media — { imobiliariaId, number, mediaUrl, tipo, ... }
    if (req.method === 'POST' && pathname === '/send-media') {
      const body = await parseBody(req);
      const { imobiliariaId, number, mediaUrl, tipo, filename, mimetype, caption } = body;

      if (!imobiliariaId || !number || !mediaUrl || !tipo) {
        return sendJson(res, 400, { error: 'imobiliariaId, number, mediaUrl e tipo são obrigatórios' });
      }

      const tenant = tenants.get(imobiliariaId);
      if (!tenant?.isConnected || !tenant.sock) {
        return sendJson(res, 503, { error: 'WhatsApp não conectado para este tenant' });
      }

      const jid = number.includes('@') ? number : `${number.replace(/\D/g, '')}@s.whatsapp.net`;
      const source = { url: mediaUrl };
      let msgContent;

      if (tipo === 'imagem' || tipo === 'foto') {
        msgContent = { image: source, caption: caption || '' };
      } else if (tipo === 'video') {
        msgContent = { video: source, caption: caption || '' };
      } else if (tipo === 'audio') {
        msgContent = { audio: source, mimetype: mimetype || 'audio/mp4', ptt: false };
      } else {
        msgContent = {
          document: source,
          mimetype: mimetype || 'application/pdf',
          fileName: filename || 'arquivo.pdf',
          caption: caption || '',
        };
      }

      try {
        await tenant.sock.sendMessage(jid, msgContent);
        return sendJson(res, 200, { ok: true });
      } catch (err) {
        return sendJson(res, 500, { error: err.message });
      }
    }

    // POST /connect/:imobiliariaId — conectar/adicionar tenant dinamicamente
    const connectMatch = pathname.match(/^\/connect\/([^/]+)$/);
    if (req.method === 'POST' && connectMatch) {
      if (!checkManagerKey(req, res)) return;

      const imobiliariaId = connectMatch[1];
      const body = await parseBody(req);
      const { apiKey } = body;

      if (!apiKey && !tenants.has(imobiliariaId)) {
        return sendJson(res, 400, { error: 'apiKey obrigatório para novo tenant' });
      }

      const effectiveKey = apiKey || tenants.get(imobiliariaId)?.apiKey;

      // Encerra completamente a sessão anterior antes de criar nova,
      // evitando o erro 440 (stream replaced / múltiplos dispositivos).
      const existing = tenants.get(imobiliariaId);
      if (existing) {
        tag('Encerrando sessão anterior antes de reconectar', imobiliariaId);
        if (existing.reconnectTimer) {
          clearTimeout(existing.reconnectTimer);
          existing.reconnectTimer = null;
        }
        if (existing.blockedTimer) {
          clearInterval(existing.blockedTimer);
          existing.blockedTimer = null;
        }
        if (existing.sock) {
          try { existing.sock.end(); } catch (_) {}
          existing.sock = null;
        }
        tenants.delete(imobiliariaId);
        // Aguarda o socket fechar antes de abrir nova conexão
        await new Promise((r) => setTimeout(r, 500));
      }

      const tenant = await startTenant(imobiliariaId, effectiveKey);
      return sendJson(res, 200, { ok: true, status: tenant.status });
    }

    // DELETE /session/:imobiliariaId — logout + deletar arquivos de auth
    const sessionMatch = pathname.match(/^\/session\/([^/]+)$/);
    if (req.method === 'DELETE' && sessionMatch) {
      if (!checkManagerKey(req, res)) return;

      await deleteSession(sessionMatch[1]);
      return sendJson(res, 200, { ok: true });
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error('[manager] Erro HTTP:', err.message);
    sendJson(res, 500, { error: err.message });
  }
});

// ── Bootstrap ──────────────────────────────────────────────────────────────────
process.on('uncaughtException', (err) => console.error('[manager] uncaughtException:', err.message));
process.on('unhandledRejection', (reason) => console.error('[manager] unhandledRejection:', reason));

(async () => {
  tag('Iniciando manager multi-tenant...');

  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  }

  const instancias = await loadTenants();
  const paraConectar = instancias.filter((i) => i.status === 'conectado');
  tag(`${paraConectar.length} instância(s) com status=conectado serão reconectadas (${instancias.length - paraConectar.length} ignoradas)`);
  for (const inst of paraConectar) {
    await startTenant(inst.imobiliariaId, inst.apiKey);
  }

  // Limpeza periódica de todos os tenants e deduplicação de conteúdo
  setInterval(() => {
    for (const tenant of tenants.values()) cleanupTenant(tenant);
    const now = Date.now();
    for (const [k, ts] of deduplicacaoConteudo) {
      if (now - ts > CONTEUDO_DEDUPE_TTL) deduplicacaoConteudo.delete(k);
    }
  }, CLEANUP_INTERVAL);

  // Retry de leads que falharam
  setInterval(async () => {
    const now = Date.now();
    for (const item of retryQueue.filter((i) => i.tentativas < i.maxTentativas && now >= i.proximaTentativa)) {
      try {
        const res = await httpReq(
          'POST',
          `${API_BASE}/webhook/lead`,
          {
            nome: item.nome,
            telefone: item.phone,
            whatsappJid: item.realJid,
            campanha: item.campanha || undefined,
            imobiliariaId: item.imobiliariaId,
          },
          { 'x-api-key': item.apiKey },
        );

        if (res.status >= 200 && res.status < 300) {
          const idx = retryQueue.indexOf(item);
          if (idx !== -1) retryQueue.splice(idx, 1);
          tag(`Retry lead ${item.phone} — sucesso (status ${res.status})`, item.imobiliariaId);

          if (res.status === 201 && item.text?.trim()) {
            try {
              const body = JSON.parse(res.data);
              const leadId = body?.lead?.id;
              if (leadId) {
                const tenant = tenants.get(item.imobiliariaId);
                if (tenant) await salvarMensagemRecebida(tenant, leadId, item.text, item.msgId, item.nome);
              }
            } catch (_) {}
          }
        } else {
          item.tentativas++;
          item.proximaTentativa = Date.now() + 60000;
          tag(`Retry lead ${item.phone} — falha (status ${res.status}), tentativa ${item.tentativas}/${item.maxTentativas}`, item.imobiliariaId);
        }
      } catch (err) {
        item.tentativas++;
        item.proximaTentativa = Date.now() + 60000;
        tag(`Retry lead ${item.phone} — erro: ${err.message}, tentativa ${item.tentativas}/${item.maxTentativas}`, item.imobiliariaId);
      }
    }

    for (let i = retryQueue.length - 1; i >= 0; i--) {
      if (retryQueue[i].tentativas >= retryQueue[i].maxTentativas) {
        tag(`Retry lead ${retryQueue[i].phone} — máximo de tentativas atingido, removendo da fila`, retryQueue[i].imobiliariaId);
        retryQueue.splice(i, 1);
      }
    }
  }, 15000);

  server.listen(HTTP_PORT, () => {
    tag(`API HTTP disponível em http://localhost:${HTTP_PORT}`);
  });
})();
