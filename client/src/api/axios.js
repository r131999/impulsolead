import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

const MSGS_PLANO = ['Plano cancelado', 'Período de teste expirado']

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status
    const msg = err.response?.data?.error || ''

    if (status === 403 && MSGS_PLANO.some((m) => msg.includes(m))) {
      localStorage.removeItem('token')
      localStorage.setItem('suspended_msg', 'Seu acesso foi suspenso. Entre em contato com o suporte: (98) 98144-4954')
      window.location.href = '/login'
      return
    }

    if (status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }

    return Promise.reject(err)
  },
)

export default api
