import api from './axios'

export const listar = () => api.get('/imoveis')
export const criar = (data) => api.post('/imoveis', data)
export const atualizar = (id, data) => api.put(`/imoveis/${id}`, data)
export const remover = (id) => api.delete(`/imoveis/${id}`)
