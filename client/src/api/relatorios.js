import api from './axios'

export const getRelatorios = (periodo) => api.get('/relatorios', { params: { periodo } })
