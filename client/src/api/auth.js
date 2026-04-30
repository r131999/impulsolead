import api from './axios'

export const login = (email, senha) => api.post('/auth/login', { email, senha })
export const register = (data) => api.post('/auth/register', data)
export const me = () => api.get('/auth/me')
export const alterarSenha = (senhaAtual, novaSenha) =>
  api.put('/auth/password', { senhaAtual, novaSenha })
