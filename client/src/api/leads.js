import api from './axios'

export const listar = (params) => api.get('/leads', { params })
export const buscarPorId = (id) => api.get(`/leads/${id}`)
export const criar = (data) => api.post('/leads', data)
export const atualizar = (id, data) => api.put(`/leads/${id}`, data)
export const mudarStatus = (id, data) => api.put(`/leads/${id}/status`, data)
export const remover = (id) => api.delete(`/leads/${id}`)
