'use strict';

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io = null;

function initSocketIO(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || '*',
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.query?.token;

    if (!token) return next(new Error('Token não fornecido'));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.data.userId = decoded.userId || decoded.corretorId;
      socket.data.role = decoded.role;
      next();
    } catch {
      next(new Error('Token inválido'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('join:lead', (leadId) => {
      if (leadId) socket.join(`lead:${leadId}`);
    });

    socket.on('join:imobiliaria', (imobiliariaId) => {
      if (imobiliariaId) socket.join(`imobiliaria:${imobiliariaId}`);
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
