import api from './axios'

export const listar = () => api.get('/empreendimentos')
export const criar = (data) => api.post('/empreendimentos', data)
export const editar = (id, data) => api.put(`/empreendimentos/${id}`, data)
export const deletar = (id) => api.delete(`/empreendimentos/${id}`)
