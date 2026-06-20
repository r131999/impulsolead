import api from './axios'

export const getConfig = () => api.get('/config/agente')
export const atualizarConfig = (data) => api.put('/config/agente', data)
export const atualizarDistribuicao = (distribuicaoManual) => api.put('/config/distribuicao', { distribuicaoManual })
export const atualizarLogo = (formData) => api.put('/config/logo', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
})
export const getLogoUrl = () => api.get('/config/logo-url')
export const getAlertaLead = () => api.get('/config/alerta-lead')
export const atualizarAlertaLead = (data) => api.put('/config/alerta-lead', data)
