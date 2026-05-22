import api from './axios'

export const listarMensagens = (leadId) => api.get(`/chat-lead/${leadId}/mensagens`)
export const enviarMensagem = (leadId, data) => api.post(`/chat-lead/${leadId}/mensagem`, data)
export const enviarArquivo = (leadId, data) => api.post(`/chat-lead/${leadId}/mensagem-arquivo`, data)
export const marcarLidas = (leadId) => api.put(`/chat-lead/${leadId}/marcar-lidas`)
export const sugerirResposta = (leadId) => api.post(`/chat-lead/${leadId}/sugerir-resposta`)
