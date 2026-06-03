import api from './axios'

export const listar = () => api.get('/tours')
export const criar = (data) => api.post('/tours', data)
export const buscar = (id) => api.get(`/tours/${id}`)
export const atualizar = (id, data) => api.put(`/tours/${id}`, data)
export const excluir = (id) => api.delete(`/tours/${id}`)

export const adicionarComodo = (tourId, data) => api.post(`/tours/${tourId}/comodos`, data)
export const atualizarComodo = (tourId, comodoId, data) => api.put(`/tours/${tourId}/comodos/${comodoId}`, data)
export const excluirComodo = (tourId, comodoId) => api.delete(`/tours/${tourId}/comodos/${comodoId}`)
export const reordenarComodos = (tourId, ordem) => api.put(`/tours/${tourId}/comodos/reordenar`, { ordem })

export const uploadFoto = (tourId, comodoId, formData, onUploadProgress) =>
  api.post(`/tours/${tourId}/comodos/${comodoId}/fotos`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress,
  })
export const excluirFoto = (tourId, comodoId, fotoId) =>
  api.delete(`/tours/${tourId}/comodos/${comodoId}/fotos/${fotoId}`)
export const reordenarFotos = (tourId, comodoId, ordem) =>
  api.put(`/tours/${tourId}/comodos/${comodoId}/fotos/reordenar`, { ordem })
