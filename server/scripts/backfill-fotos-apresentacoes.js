#!/usr/bin/env node
'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const UPLOAD_DIR = process.env.UPLOAD_DIR_APRESENTACOES || '/opt/uploads/apresentacoes';

async function main() {
  const fotos = await prisma.fotoApresentacao.findMany({
    select: { id: true, url: true, apresentacaoId: true },
    orderBy: { ordem: 'asc' },
  });

  console.log(`Total de fotos: ${fotos.length}`);
  let geradas = 0, puladas = 0, erros = 0;

  for (const foto of fotos) {
    const filename = path.basename(foto.url);
    const dir = path.join(UPLOAD_DIR, foto.apresentacaoId);
    const srcPath = path.join(dir, filename);
    const stem = filename.replace(/\.[^.]+$/, '');
    const thumbPath = path.join(dir, `${stem}_thumb.jpg`);

    // Idempotente: pula se thumb já existe
    if (fs.existsSync(thumbPath)) {
      puladas++;
      continue;
    }

    if (!fs.existsSync(srcPath)) {
      console.warn(`[SKIP] Arquivo não encontrado: ${srcPath}`);
      erros++;
      continue;
    }

    try {
      const isJpeg = /\.jpe?g$/i.test(filename);

      if (isJpeg) {
        // Reprocessa web version in-place via tmp
        const tmpPath = `${srcPath}.tmp`;
        await sharp(srcPath)
          .rotate()
          .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toFile(tmpPath);
        fs.renameSync(tmpPath, srcPath);
      }

      // Thumb sempre gerado a partir do arquivo em disco (já processado se JPEG)
      await sharp(srcPath)
        .rotate()
        .resize(600, 600, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 70 })
        .toFile(thumbPath);

      console.log(`[OK] ${foto.url}`);
      geradas++;
    } catch (err) {
      console.error(`[ERRO] ${foto.url}: ${err.message}`);
      erros++;
    }
  }

  console.log(`\nGeradas: ${geradas} | Puladas: ${puladas} | Erros: ${erros}`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
