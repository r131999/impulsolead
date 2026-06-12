// Script único — define a senha do gestor da imobiliária "Impulso Notificações".
// Usa bcrypt.hash(senha, 12), idêntico ao auth.controller.js do projeto.
// Uso: node server/scripts/_set_notif_senha.js
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const EMAIL          = 'notif@impulsoslz.com.br';
const IMOBILIARIA_ID = '86949b73-6c6c-4ad1-8278-2cfa09dec145';
const NOVA_SENHA     = 'ImpulsoNotif2026!';

async function run() {
  const usuario = await prisma.usuario.findUnique({ where: { email: EMAIL } });

  if (!usuario) {
    console.error(`Usuário não encontrado: ${EMAIL}`);
    process.exit(1);
  }

  if (usuario.imobiliariaId !== IMOBILIARIA_ID) {
    console.error(`imobiliariaId diverge: esperado ${IMOBILIARIA_ID}, encontrado ${usuario.imobiliariaId}`);
    process.exit(1);
  }

  const senhaHash = await bcrypt.hash(NOVA_SENHA, 12);

  await prisma.usuario.update({
    where: { email: EMAIL },
    data:  { senhaHash },
  });

  console.log('Senha atualizada com sucesso.');
  console.log('email        :', usuario.email);
  console.log('imobiliariaId:', usuario.imobiliariaId);
}

run()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
