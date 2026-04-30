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
const webhookRoutes = require('./routes/webhook.routes');

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true,
}));
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
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
app.use('/api/webhook', webhookRoutes);

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
});

module.exports = app;
