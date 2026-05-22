import api from './axios'

export const listar = (params) => api.get('/arquivos-imovel', { params })

export const upload = (formData) =>
  api.post('/arquivos-imovel', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

export const deletar = (id) => api.delete(`/arquivos-imovel/${id}`)

export const downloadUrl = (id) => `/api/arquivos-imovel/${id}/download`
