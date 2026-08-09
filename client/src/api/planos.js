import api from './axios'

export const getPlanos = () => api.get('/planos')
