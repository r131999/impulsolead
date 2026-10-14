'use strict';

// Critério de "lead sem tratativa" do card do dashboard e do filtro da tela de
// Leads. É o mesmo núcleo do cron leads-sem-tratativa (processarEscalonamentoCorretorGestor
// em cron.service.js: status 'lead' + observação vazia), com duas diferenças
// deliberadas: janela de 30 dias em vez de 48h, e inclui leads sem corretor
// (o pior caso — ninguém pegou). O cron não usa esta função e segue intocado;
// se o critério do cron mudar, revisar aqui também.

const JANELA_SEM_TRATATIVA_DIAS = 30;

function criterioSemTratativa(agora = new Date()) {
  return {
    status: 'lead',
    criadoEm: { gte: new Date(agora.getTime() - JANELA_SEM_TRATATIVA_DIAS * 24 * 60 * 60 * 1000) },
    OR: [{ observacoes: null }, { observacoes: '' }],
  };
}

module.exports = { JANELA_SEM_TRATATIVA_DIAS, criterioSemTratativa };
