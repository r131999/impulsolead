import api from './axios'

export const listar = () => api.get('/equipes')
export const criar = (data) => api.post('/equipes', data)
export const atualizar = (id, data) => api.put(`/equipes/${id}`, data)
export const remover = (id) => api.delete(`/equipes/${id}`)
export const adicionarCorretor = (id, corretorId) =>
  api.post(`/equipes/${id}/corretores`, { corretorId })
export const removerCorretor = (id, corretorId) =>
  api.delete(`/equipes/${id}/corretores/${corretorId}`)
