require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const nome = process.env.SUPREMO_NOME || 'Admin Impulso';
  const email = process.env.SUPREMO_EMAIL;
  const senha = process.env.SUPREMO_SENHA;

  if (!email || !senha) {
    console.error('Defina SUPREMO_EMAIL e SUPREMO_SENHA no .env');
    process.exit(1);
  }

  const existe = await prisma.usuarioSupremo.findUnique({ where: { email } });
  if (existe) {
    console.log(`Usuário supremo já existe: ${email}`);
    process.exit(0);
  }

  const senhaHash = await bcrypt.hash(senha, 12);
  const supremo = await prisma.usuarioSupremo.create({
    data: { nome, email, senhaHash },
  });

  console.log(`Usuário supremo criado com sucesso!`);
  console.log(`  ID:    ${supremo.id}`);
  console.log(`  Nome:  ${supremo.nome}`);
  console.log(`  Email: ${supremo.email}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
