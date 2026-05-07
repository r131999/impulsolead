import api from './axios'

export const listar = () => api.get('/modelos-mensagem')
export const criar = (data) => api.post('/modelos-mensagem', data)
export const atualizar = (id, data) => api.put(`/modelos-mensagem/${id}`, data)
export const remover = (id) => api.delete(`/modelos-mensagem/${id}`)
