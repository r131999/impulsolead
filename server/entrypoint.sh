#!/bin/sh
set -e

echo "Aguardando banco de dados..."
until node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.\$connect().then(() => { console.log('DB pronto'); p.\$disconnect(); process.exit(0); }).catch(() => process.exit(1));
" 2>/dev/null; do
  echo "Banco indisponível — aguardando 2s..."
  sleep 2
done

echo "Rodando migrations..."
npx prisma migrate deploy

echo "Iniciando servidor..."
exec node src/app.js
