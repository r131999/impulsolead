import api from './axios'

export const listar = () => api.get('/usuarios')
export const criar = (data) => api.post('/usuarios', data)
export const atualizar = (id, data) => api.put(`/usuarios/${id}`, data)
export const remover = (id) => api.delete(`/usuarios/${id}`)
export const resetarSenha = (id, novaSenha) => api.put(`/usuarios/${id}/senha`, { novaSenha })
