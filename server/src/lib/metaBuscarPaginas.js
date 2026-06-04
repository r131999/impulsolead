'use strict';

const BASE = 'https://graph.facebook.com/v19.0';

/**
 * Retorna todas as páginas administradas pelo usuário:
 * - Páginas diretas via me/accounts
 * - Páginas via Business Manager via me/businesses → /{bm.id}/owned_pages
 * Sem duplicatas (deduplicado por id).
 */
async function buscarTodasPaginas(userToken) {
  const paginas = [];

  // 1. Páginas diretas do perfil
  try {
    const r = await fetch(`${BASE}/me/accounts?fields=name,id,access_token&access_token=${userToken}`);
    const d = await r.json();
    if (d.data) paginas.push(...d.data);
  } catch (_) {}

  // 2. Páginas via Business Manager
  try {
    const r2 = await fetch(`${BASE}/me/businesses?fields=name,id&access_token=${userToken}`);
    const d2 = await r2.json();

    if (d2.data) {
      for (const bm of d2.data) {
        try {
          const r3 = await fetch(
            `${BASE}/${bm.id}/owned_pages?fields=name,id,access_token&access_token=${userToken}`
          );
          const d3 = await r3.json();
          if (d3.data) {
            for (const p of d3.data) {
              if (!paginas.find((x) => x.id === p.id)) paginas.push(p);
            }
          }
        } catch (_) {}
      }
    }
  } catch (_) {}

  return paginas;
}

module.exports = { buscarTodasPaginas };
