import api from './axios'

export const listar = () => api.get('/apresentacoes')
export const criar = (data) => api.post('/apresentacoes', data)
export const buscar = (id) => api.get(`/apresentacoes/${id}`)
export const atualizar = (id, data) => api.put(`/apresentacoes/${id}`, data)
export const excluir = (id) => api.delete(`/apresentacoes/${id}`)

export const uploadFoto = (apId, formData, onUploadProgress) =>
  api.post(`/apresentacoes/${apId}/fotos`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress,
  })

export const excluirFoto = (apId, fotoId) =>
  api.delete(`/apresentacoes/${apId}/fotos/${fotoId}`)
