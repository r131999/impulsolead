import api from './axios'

export const getRelatorios = (periodo) => api.get('/relatorios', { params: { periodo } })
export const getRelatoriosEquipes = (periodo) => api.get('/relatorios/equipes', { params: { periodo } })
