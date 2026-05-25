import api from './axios'

export const getStatusWhatsapp  = ()  => api.get('/whatsapp/status')
export const conectarWhatsapp   = ()  => api.post('/whatsapp/connect')
export const deletarSessaoWhats = ()  => api.delete('/whatsapp/session')
