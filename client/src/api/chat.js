import api from './axios'

export const enviar = (mensagem) => api.post('/chat', { mensagem })
