// Script único — cria a imobiliária "Impulso Notificações" com os mesmos
// registros relacionados que o endpoint POST /admin/clientes cria.
// Uso: node server/scripts/_criar_notif_imob.js
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const PERGUNTAS_PADRAO = [
  'É o seu primeiro imóvel?',
  'Qual é o seu tipo de renda? (CLT, autônomo, servidor público)',
  'Qual é a sua renda mensal aproximada?',
  'Você tem alguma restrição no CPF?',
  'Você tem valor de entrada disponível? Quanto aproximadamente?',
  'Você está comprando agora ou ainda pesquisando?',
  'Qual região você prefere morar?',
  'Qual faixa de valor você tem em mente para o imóvel?',
];

async function run() {
  const nomeImobiliaria = 'Impulso Notificações';
  const nomeGestor      = 'Admin Notificações';
  const emailGestor     = 'notif@impulsoslz.com.br';
  const senhaInicial    = crypto.randomBytes(16).toString('hex');

  const emailExiste = await prisma.usuario.findUnique({ where: { email: emailGestor } });
  if (emailExiste) {
    console.error('Imobiliária já existe (email já cadastrado). Abortando.');
    process.exit(1);
  }

  const senhaHash = await bcrypt.hash(senhaInicial, 12);
  const trialExpiraEm = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const result = await prisma.$transaction(async (tx) => {
    const imobiliaria = await tx.imobiliaria.create({
      data: {
        nome: nomeImobiliaria,
        email: emailGestor,
        plano: 'legado',
        apiKey: crypto.randomBytes(32).toString('hex'),
      },
    });

    const usuario = await tx.usuario.create({
      data: {
        nome: nomeGestor,
        email: emailGestor,
        senhaHash,
        role: 'gestor',
        imobiliariaId: imobiliaria.id,
      },
    });

    await tx.configAgente.create({
      data: { imobiliariaId: imobiliaria.id, perguntas: PERGUNTAS_PADRAO },
    });

    await tx.modeloMensagem.createMany({
      data: [
        {
          nome: 'Reativação Geral',
          conteudo: `Olá, {{nome}}! Tudo bem? Aqui é da ${nomeImobiliaria}. Percebemos que você demonstrou interesse em nossos imóveis e gostaríamos de saber se ainda podemos te ajudar. 😊`,
          imobiliariaId: imobiliaria.id,
        },
        {
          nome: 'Promoção / Lançamento',
          conteudo: `Olá, {{nome}}! 👋 Temos um lançamento imperdível que pode ser exatamente o que você procura. Posso te enviar mais detalhes?`,
          imobiliariaId: imobiliaria.id,
        },
        {
          nome: 'Follow-up Simples',
          conteudo: `Oi, {{nome}}! Como você está? Passando para saber se ficou com alguma dúvida sobre os imóveis que conversamos. Estou à disposição! 🏠`,
          imobiliariaId: imobiliaria.id,
        },
      ],
    });

    await tx.whatsappInstancia.create({
      data: { imobiliariaId: imobiliaria.id },
    });

    return { imobiliaria, usuario };
  });

  console.log('\n=== Imobiliária criada com sucesso ===');
  console.log('id             :', result.imobiliaria.id);
  console.log('nome           :', result.imobiliaria.nome);
  console.log('email          :', result.imobiliaria.email);
  console.log('plano          :', result.imobiliaria.plano);
  console.log('\nDefina no .env / deploy:');
  console.log(`NOTIF_INSTANCE_ID=${result.imobiliaria.id}`);
}

run()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
