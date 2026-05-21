import api from './axios'

export const importar = (formData) => api.post('/contatos/importar', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
})
export const listar = (params) => api.get('/contatos', { params })
export const remover = (id) => api.delete(`/contatos/${id}`)
export const enviarMensagem = (id, mensagem) => api.post(`/contatos/${id}/enviar`, { mensagem })
export const transferir = (id, corretorId) => api.post(`/contatos/${id}/transferir`, { corretorId: corretorId || null })
export const limpar = (status) => api.delete('/contatos/limpar', { params: status ? { status } : {} })
export const transferirLote = (contatoIds, corretorId) =>
  api.post('/contatos/transferir-lote', { contatoIds, corretorId: corretorId || null })
