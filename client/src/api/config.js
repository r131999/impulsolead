import api from './axios'

export const getConfig = () => api.get('/config/agente')
export const atualizarConfig = (data) => api.put('/config/agente', data)
