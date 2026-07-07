import api from './axios'

export const getStatusMeta    = ()          => api.get('/integracoes/meta/status')
export const conectarMeta     = (data)      => api.post('/integracoes/meta/conectar', data)
export const desconectarMeta  = ()          => api.delete('/integracoes/meta/desconectar')
export const selecionarPagina = (data)      => api.post('/integracoes/meta/selecionar-pagina', data)
export const gerarTokenMake      = ()       => api.post('/integracoes/make/gerar-token')
export const regenerarTokenMake  = ()       => api.post('/integracoes/make/regenerar-token')
