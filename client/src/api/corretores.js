import api from './axios'

export const listar = (params) => api.get('/corretores', { params })
export const buscarFila = () => api.get('/corretores/fila')
export const criar = (data) => api.post('/corretores', data)
export const atualizar = (id, data) => api.put(`/corretores/${id}`, data)
export const atualizarDisponibilidade = (id, disponivel) =>
  api.put(`/corretores/${id}/disponibilidade`, { disponivel })
export const remover = (id) => api.delete(`/corretores/${id}`)
export const ativarAcesso = (id, email, senha, role = 'corretor') =>
  api.post(`/corretores/${id}/ativar-acesso`, { email, senha, role })
export const resetarSenha = (id, novaSenha) =>
  api.put(`/corretores/${id}/resetar-senha`, { novaSenha })
export const atualizarFoto = (id, fotoPerfil) =>
  api.put(`/corretores/${id}/foto-perfil`, { fotoPerfil })
