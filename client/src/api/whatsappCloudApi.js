import api from './axios'

export const getStatusCloudApi = () => api.get('/whatsapp-cloud-api/status')
export const conectarCloudApi = (data) => api.post('/whatsapp-cloud-api/conectar', data)
