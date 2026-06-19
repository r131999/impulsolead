import { useAuth } from '../context/AuthContext'

export function usePermissao(chave) {
  const { planoInfo } = useAuth()
  const perm = planoInfo?.permissoes
  if (!perm || typeof perm !== 'object') return true
  if (!(chave in perm)) return true
  return perm[chave] !== false
}
