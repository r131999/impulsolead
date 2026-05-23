'use strict';

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

let io = null;

function initSocketIO(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || '*',
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.query?.token;

    if (!token) return next(new Error('Token não fornecido'));

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return next(new Error('Token inválido'));
    }

    try {
      let imobiliariaId = null;
      let userId = null;

      if (decoded.corretorId) {
        const corretor = await prisma.corretor.findUnique({
          where: { id: decoded.corretorId },
          select: { id: true, imobiliariaId: true },
        });
        if (!corretor) return next(new Error('Usuário não encontrado'));
        imobiliariaId = corretor.imobiliariaId;
        userId = corretor.id;
      } else if (decoded.userId) {
        const usuario = await prisma.usuario.findUnique({
          where: { id: decoded.userId },
          select: { id: true, imobiliariaId: true },
        });
        if (!usuario) return next(new Error('Usuário não encontrado'));
        imobiliariaId = usuario.imobiliariaId;
        userId = usuario.id;
      } else {
        return next(new Error('Token inválido'));
      }

      socket.data.userId = userId;
      socket.data.role = decoded.role;
      socket.data.imobiliariaId = imobiliariaId;
      next();
    } catch (err) {
      next(new Error('Erro de autenticação'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('join:lead', async (leadId) => {
      if (!leadId) return;
      try {
        const lead = await prisma.lead.findFirst({
          where: { id: leadId, imobiliariaId: socket.data.imobiliariaId },
          select: { id: true, corretorId: true },
        });
        if (!lead) return;
        if (socket.data.role === 'corretor' && lead.corretorId !== socket.data.userId) return;
        socket.join(`lead:${leadId}`);
      } catch {}
    });

    socket.on('join:imobiliaria', (imobiliariaId) => {
      if (!imobiliariaId) return;
      if (imobiliariaId !== socket.data.imobiliariaId) return;
      socket.join(`imobiliaria:${imobiliariaId}`);
    });

    socket.on('leave:lead', (leadId) => {
      if (leadId) socket.leave(`lead:${leadId}`);
    });
  });
}

function emitirMensagem(leadId, mensagem) {
  if (!io) return;
  io.to(`lead:${leadId}`).emit('nova:mensagem', mensagem);
}

function getIO() {
  return io;
}

module.exports = { initSocketIO, emitirMensagem, getIO };
