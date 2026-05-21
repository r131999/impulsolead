'use strict';

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeInMemoryStore,
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const http = require('http');
const path = require('path');

// ── Configurações ──────────────────────────────────────────────────────────────
const CONFIG = {
  number: '98991272727',
  imobiliariaId: 'd9cafd24-8878-4f66-a42b-6c98de8dbc82',
  apiKey: '842bb34d893bd75e8d6874aed39233dcb162c7165addcb26d898928cc92879bc',
  apiBase: 'https://api-crm.impulsoslz.com.br/api',
  httpPort: 3010,
  authDir: path.join(__dirname, 'auth_info_baileys'),
  blockedCacheInterval: 10 * 60 * 1000,  // 10 min
  msgDedupeeTTL: 30 * 60 * 1000,         // 30 min
  recentLeadTTL: 24 * 60 * 60 * 1000,    // 24 h
};

const logger = pino({ level: 'silent' });
const tag = (msg) => console.log(`[WhatsApp] ${msg}`);

// ── Estado em memória ──────────────────────────────────────────────────────────
let sock = null;
let isConnected = false;
const seenMsgIds = new Map();   // msgId → timestamp
const recentLeads = new Map();  // phone → timestamp
let blockedNumbers = new Set();

// ── Helpers HTTP ───────────────────────────────────────────────────────────────
function jsonPost(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const u = new URL(url);
    const options = {
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...headers,
      },
    };
    const mod = u.protocol === 'https:' ? require('https') : require('http');
    const req = mod.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function jsonGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const options = {
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method: 'GET',
      headers,
    };
    const mod = u.protocol === 'https:' ? require('https') : require('http');
    const req = mod.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.end();
  });
}

// ── Números bloqueados ─────────────────────────────────────────────────────────
async function fetchBlockedNumbers() {
  try {
    const res = await jsonGet(`${CONFIG.apiBase}/webhook/numeros-bloqueados`, {
      'x-api-key': CONFIG.apiKey,
    });
    if (res.status === 200) {
      const json = JSON.parse(res.data);
      const nums = Array.isArray(json)
        ? json
        : (json.telefones || json.numeros || json.numbers || []);
      blockedNumbers = new Set(nums.map((n) => String(n).replace(/\D/g, '')));
      tag(`Números bloqueados atualizados: ${blockedNumbers.size}`);
    }
  } catch (err) {
    tag(`Erro ao buscar números bloqueados: ${err.message}`);
  }
}

// ── Detecção de campanha ───────────────────────────────────────────────────────
const CAMPAIGN_PATTERNS = [
  /vim\s+pel[ao]\s+(.+)/i,
  /vim\s+d[ao]\s+(.+)/i,
  /interesse\s+n[oa]\s+(.+)/i,
  /indicad[ao]\s+pel[ao]\s+(.+)/i,
  /vi\s+n[ao]\s+(.+)/i,
  /tenho interesse e queria mais informa/i,
];

function detectCampaign(text) {
  if (!text) return null;
  for (const pattern of CAMPAIGN_PATTERNS) {
    const m = text.match(pattern);
    if (m) return m[1] ? m[1].trim().slice(0, 100) : 'Anúncio';
  }
  return null;
}

// ── Normalização de telefone ───────────────────────────────────────────────────
// 559888123187 (12 dígitos) → 5598988123187 (13 dígitos): insere 9 após o DDD
function normalizarTelefone(phone) {
  if (phone.length === 12 && phone.startsWith('55') && phone[4] !== '9') {
    return phone.slice(0, 4) + '9' + phone.slice(4);
  }
  return phone;
}

// ── Limpeza periódica dos Maps ─────────────────────────────────────────────────
function cleanupMaps() {
  const now = Date.now();
  for (const [id, ts] of seenMsgIds) {
    if (now - ts > CONFIG.msgDedupeeTTL) seenMsgIds.delete(id);
  }
  for (const [phone, ts] of recentLeads) {
    if (now - ts > CONFIG.recentLeadTTL) recentLeads.delete(phone);
  }
}

// ── Processamento de mensagens ─────────────────────────────────────────────────
async function handleMessage(msg) {
  try {
    // Rejeitar antes de qualquer extração: sem conteúdo real ou mensagem de sistema.
    // Bad MAC / erros de descriptografia chegam sem msg.message ou com messageStubType.
    if (!msg.message || msg.messageStubType) return;

    const { key, message } = msg;

    // Filtros básicos
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

    // Deduplicação
    const msgId = key.id;
    if (seenMsgIds.has(msgId)) return;
    seenMsgIds.set(msgId, Date.now());

    // ── Extração do JID real e telefone ────────────────────────────────────────
    // @lid = Linked ID (novo formato do WhatsApp Business API) — o número real
    // fica em key.participant, msg.participant ou key.senderPn
    const remoteJid = key.remoteJid;
    let realJid = remoteJid;
    let phone;

    if (remoteJid.endsWith('@lid')) {
      const participant =
        key.participant ||
        msg.participant ||
        key.senderPn ||
        '';

      if (participant && participant.includes('@')) {
        realJid = participant;
        phone = participant.split('@')[0].replace(/\D/g, '');
      } else if (participant) {
        phone = String(participant).replace(/\D/g, '');
        realJid = `${phone}@s.whatsapp.net`;
      } else {
        // Último recurso: lid numérico como identificador
        phone = remoteJid.replace('@lid', '').replace(/\D/g, '');
        tag(`JID @lid sem participant — usando lid como id: ${phone}`);
      }
    } else {
      phone = remoteJid.split('@')[0].replace(/\D/g, '');
    }

    if (!phone) {
      tag(`Não foi possível extrair número do JID: ${remoteJid}`);
      return;
    }

    phone = normalizarTelefone(phone);

    // Validação do número: rejeita JIDs @lid gigantes e números inválidos.
    // Números brasileiros: 55 + DDD(2) + número(8 ou 9) = 12 ou 13 dígitos.
    const phoneValido = phone.startsWith('55')
      ? phone.length === 12 || phone.length === 13
      : phone.length >= 10 && phone.length <= 13;
    if (!phoneValido) {
      tag(`Número inválido ignorado: ${phone}`);
      return;
    }

    // Nome do lead vem do pushName
    const rawName = msg.pushName || '';
    const nome = rawName && rawName !== 'undefined' && rawName.trim()
      ? rawName.trim()
      : 'Lead WhatsApp';

    // Bloquear números de corretores/gestores
    if (blockedNumbers.has(phone)) {
      tag(`Mensagem ignorada — número bloqueado: ${phone}`);
      return;
    }

    // Bloquear atendido nas últimas 24h
    // Verifica tanto o phone extraído quanto o senderPn bruto para cobrir o caso
    // em que o mesmo contato chegou antes como @s.whatsapp.net e agora como @lid
    const senderPnRaw = (key.senderPn || msg.participant || '').split('@')[0].replace(/\D/g, '');
    if (recentLeads.has(phone) || (senderPnRaw && recentLeads.has(senderPnRaw))) {
      tag(`Mensagem ignorada — lead recente (24h): ${phone}`);
      return;
    }

    const campanha = detectCampaign(text);

    tag(`Novo lead detectado: ${phone} (${nome})${campanha ? ` | campanha: ${campanha}` : ''}`);

    // Mensagem de boas-vindas antes de registrar no CRM
    try {
      await sock.sendMessage(realJid, {
        text: 'Em breve um de nossos consultores entrará em contato com você.',
      });
    } catch (err) {
      tag(`Erro ao enviar boas-vindas: ${err.message}`);
    }

    await new Promise((r) => setTimeout(r, 1000));

    // Registrar lead no CRM
    const leadBody = {
      nome,
      telefone: phone,
      whatsappJid: realJid,
      campanha: campanha || undefined,
      imobiliariaId: CONFIG.imobiliariaId,
    };

    const res = await jsonPost(`${CONFIG.apiBase}/webhook/lead`, leadBody, {
      'x-api-key': CONFIG.apiKey,
    });

    const now = Date.now();
    recentLeads.set(phone, now);
    if (senderPnRaw && senderPnRaw !== phone) recentLeads.set(senderPnRaw, now);
    tag(`Lead enviado ao CRM — status: ${res.status}`);
  } catch (err) {
    tag(`Erro ao processar mensagem: ${err.message}`);
  }
}

// ── Conexão Baileys ────────────────────────────────────────────────────────────
async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(CONFIG.authDir);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
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

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      tag('QR Code gerado — escaneie com o WhatsApp:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      isConnected = false;
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
      tag(`Conexão encerrada. Motivo: ${reason}`);

      if (reason === DisconnectReason.loggedOut) {
        tag('Logout forçado — aguardando novo QR Code...');
        setTimeout(connectToWhatsApp, 3000);
      } else {
        tag('Reconectando...');
        setTimeout(connectToWhatsApp, 3000);
      }
    } else if (connection === 'open') {
      isConnected = true;
      tag('Conectado!');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      await handleMessage(msg);
    }
  });
}

// ── API HTTP (porta 3010) ──────────────────────────────────────────────────────
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('JSON inválido'));
      }
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

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/status') {
      return sendJson(res, 200, { connected: isConnected, number: CONFIG.number });
    }

    if (req.method === 'POST' && req.url === '/send') {
      const body = await parseBody(req);
      const { number, text } = body;

      if (!number || !text) {
        return sendJson(res, 400, { error: 'number e text são obrigatórios' });
      }
      if (!isConnected || !sock) {
        return sendJson(res, 503, { error: 'WhatsApp não conectado' });
      }

      const jid = number.includes('@') ? number : `${number.replace(/\D/g, '')}@s.whatsapp.net`;
      console.log('[WhatsApp] Enviando mensagem para:', jid);
      try {
        await sock.sendMessage(jid, { text });
        console.log('[WhatsApp] Mensagem enviada com sucesso para:', jid);
      } catch (err) {
        console.error('[WhatsApp] Erro ao enviar mensagem para:', jid, '-', err.message);
        return sendJson(res, 500, { error: err.message });
      }
      return sendJson(res, 200, { ok: true });
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    tag(`Erro na API HTTP: ${err.message}`);
    sendJson(res, 500, { error: err.message });
  }
});

// ── Bootstrap ──────────────────────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  tag(`uncaughtException: ${err.message}`);
});
process.on('unhandledRejection', (reason) => {
  tag(`unhandledRejection: ${reason}`);
});

(async () => {
  tag('Iniciando microserviço WhatsApp (Baileys)...');

  await fetchBlockedNumbers();
  setInterval(fetchBlockedNumbers, CONFIG.blockedCacheInterval);
  setInterval(cleanupMaps, 5 * 60 * 1000);

  await connectToWhatsApp();

  server.listen(CONFIG.httpPort, () => {
    tag(`API HTTP disponível em http://localhost:${CONFIG.httpPort}`);
  });
})();
