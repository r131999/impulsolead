import axios from 'axios'

const adminApi = axios.create({ baseURL: '/api' })

adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

adminApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('admin_token')
      window.location.href = '/admin/login'
    }
    return Promise.reject(err)
  },
)

export const loginSupremo = (email, senha) =>
  adminApi.post('/auth/login-supremo', { email, senha })

export const meSupremo = () => adminApi.get('/auth/me')

export const getStats = () => adminApi.get('/admin/stats')

export const getClientes = (busca) =>
  adminApi.get('/admin/clientes', { params: busca ? { busca } : {} })

export const criarCliente = (data) => adminApi.post('/admin/clientes', data)

export const atualizarPlano = (id, data) =>
  adminApi.put(`/admin/clientes/${id}/plano`, data)

export const atualizarPermissoes = (id, data) =>
  adminApi.patch(`/admin/clientes/${id}/permissoes`, data)

export const atualizarLimiteAcessos = (id, data) =>
  adminApi.patch(`/admin/clientes/${id}/limite-acessos`, data)

export const atualizarAdAccount = (id, data) =>
  adminApi.patch(`/admin/clientes/${id}/ad-account`, data)
