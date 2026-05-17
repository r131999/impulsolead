require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth.routes');
const leadsRoutes = require('./routes/leads.routes');
const corretoresRoutes = require('./routes/corretores.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const configRoutes = require('./routes/config.routes');
const relatoriosRoutes = require('./routes/relatorios.routes');
const equipesRoutes = require('./routes/equipes.routes');
const contatosRoutes = require('./routes/contatos.routes');
const modelosMensagemRoutes = require('./routes/modelos-mensagem.routes');
const usuariosRoutes = require('./routes/usuarios.routes');
const webhookRoutes = require('./routes/webhook.routes');
const followupsRoutes = require('./routes/followups.routes');
const contatosPessoaisRoutes = require('./routes/contatos-pessoais.routes');
const imoveisRoutes = require('./routes/imoveis.routes');
const chatRoutes = require('./routes/chat.routes');
const chatInternoRoutes = require('./routes/chat-interno.routes');
const adminRoutes = require('./routes/admin.routes');
const agenteRoutes = require('./routes/agente.routes');
const { iniciarCrons } = require('./services/cron.service');

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/corretores', corretoresRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/config', configRoutes);
app.use('/api/relatorios', relatoriosRoutes);
app.use('/api/equipes', equipesRoutes);
app.use('/api/contatos', contatosRoutes);
app.use('/api/modelos-mensagem', modelosMensagemRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/followups', followupsRoutes);
app.use('/api/contatos-pessoais', contatosPessoaisRoutes);
app.use('/api/imoveis', imoveisRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/chat-interno', chatInternoRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/agente', agenteRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`ImpulsoLead API rodando na porta ${PORT}`);
  iniciarCrons();
});

module.exports = app;
