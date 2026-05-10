import api from './axios'

export const login = (email, senha) => api.post('/auth/login', { email, senha })
export const loginCorretor = (email, senha) => api.post('/auth/login-corretor', { email, senha })
export const register = (data) => api.post('/auth/register', data)
export const me = () => api.get('/auth/me')
export const alterarSenha = (senhaAtual, novaSenha) =>
  api.put('/auth/password', { senhaAtual, novaSenha })
export const alterarSenhaCorretor = (senhaAtual, novaSenha) =>
  api.put('/auth/corretor/password', { senhaAtual, novaSenha })
export const atualizarFotoPerfil = (fotoPerfil) =>
  api.put('/auth/foto-perfil', { fotoPerfil })
export const atualizarFotoPerfilCorretor = (fotoPerfil) =>
  api.put('/auth/corretor/foto-perfil', { fotoPerfil })
