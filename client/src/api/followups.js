import api from './axios'

export const criar = (leadId, data) => api.post(`/leads/${leadId}/followup`, data)
export const atualizar = (id, data) => api.put(`/followups/${id}`, data)
export const remover = (id) => api.delete(`/followups/${id}`)
export const pendentes = () => api.get('/followups/pendentes')
