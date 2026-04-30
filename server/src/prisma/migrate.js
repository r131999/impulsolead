// Script executado pelo entrypoint antes de iniciar o servidor.
// Garante que as migrations estão aplicadas no banco.
const { execSync } = require('child_process');

try {
  console.log('[migrate] Aplicando migrations...');
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
  console.log('[migrate] Migrations aplicadas com sucesso.');
} catch (err) {
  console.error('[migrate] Falha ao aplicar migrations:', err.message);
  process.exit(1);
}
