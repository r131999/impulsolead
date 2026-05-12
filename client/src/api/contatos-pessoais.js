import api from './axios'

export const cadastrar = (data) => api.post('/contatos-pessoais', data)
export const importar = (formData) => api.post('/contatos-pessoais/importar', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
})
export const listar = (params) => api.get('/contatos-pessoais', { params })
export const remover = (id) => api.delete(`/contatos-pessoais/${id}`)
export const converter = (id) => api.post(`/contatos-pessoais/${id}/converter`)
