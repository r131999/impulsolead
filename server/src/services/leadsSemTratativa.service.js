'use strict';

// Critério de "lead sem tratativa" do card do dashboard e do filtro da tela de
// Leads. É o mesmo núcleo do cron leads-sem-tratativa (processarEscalonamentoCorretorGestor
// em cron.service.js: status 'lead' + observação vazia), com duas diferenças
// deliberadas: janela de 30 dias em vez de 48h, e inclui leads sem corretor
// (o pior caso — ninguém pegou). O cron não usa esta função e segue intocado;
// se o critério do cron mudar, revisar aqui também.

const JANELA_SEM_TRATATIVA_DIAS = 30;

// Terceiro sinal, também só daqui (o cron não tem): nenhuma mensagem em
// MensagemLead na janela. Observação vazia mede ausência de registro, não de
// atendimento — lead que trocou mensagem (com corretor ou com a Lia) não conta.
function criterioSemTratativa(agora = new Date()) {
  const desde = new Date(agora.getTime() - JANELA_SEM_TRATATIVA_DIAS * 24 * 60 * 60 * 1000);
  return {
    status: 'lead',
    criadoEm: { gte: desde },
    OR: [{ observacoes: null }, { observacoes: '' }],
    mensagens: { none: { criadoEm: { gte: desde } } },
  };
}

module.exports = { JANELA_SEM_TRATATIVA_DIAS, criterioSemTratativa };
