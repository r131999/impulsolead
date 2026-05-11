import api from './axios'

export const getRelatorios = (periodo) => api.get('/relatorios', { params: { periodo } })
export const getRelatoriosEquipes = (periodo) => api.get('/relatorios/equipes', { params: { periodo } })
export const getRelatoriosGerente = (periodo) => api.get('/relatorios/gerente', { params: { periodo } })
export const getRelatoriosOrigem = (periodo) => api.get('/relatorios/origem', { params: { periodo } })
