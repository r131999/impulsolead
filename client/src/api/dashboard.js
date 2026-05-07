import api from './axios'

export const getDashboard = () => api.get('/dashboard')
export const getDashboardCorretor = () => api.get('/dashboard/corretor')
export const getDashboardGerente = () => api.get('/dashboard/gerente')
