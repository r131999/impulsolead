import api from './axios'

export const listarConversas = () => api.get('/chat-interno/conversas')
export const listarMensagens = (conversaId) => api.get(`/chat-interno/conversas/${conversaId}/mensagens`)
export const criarOuBuscarConversa = (data) => api.post('/chat-interno/conversas', data)
export const enviarMensagem = (conversaId, data) => api.post(`/chat-interno/conversas/${conversaId}/mensagens`, data)
export const marcarLidas = (conversaId) => api.put(`/chat-interno/conversas/${conversaId}/lidas`)
export const naoLidasTotal = () => api.get('/chat-interno/nao-lidas')
export const listarParticipantes = () => api.get('/chat-interno/participantes')
