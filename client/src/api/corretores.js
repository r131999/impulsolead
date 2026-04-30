import api from './axios'

export const listar = (params) => api.get('/corretores', { params })
export const buscarFila = () => api.get('/corretores/fila')
export const criar = (data) => api.post('/corretores', data)
export const atualizar = (id, data) => api.put(`/corretores/${id}`, data)
export const atualizarDisponibilidade = (id, disponivel) =>
  api.put(`/corretores/${id}/disponibilidade`, { disponivel })
export const remover = (id) => api.delete(`/corretores/${id}`)
