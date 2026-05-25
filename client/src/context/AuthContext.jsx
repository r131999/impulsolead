import { createContext, useContext, useState, useEffect } from 'react'
import * as authApi from '../api/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      authApi
        .me()
        .then((res) => setUsuario(res.data))
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const register = async (data) => {
    const res = await authApi.register(data)
    localStorage.setItem('token', res.data.token)
    setUsuario(res.data.usuario)
    return res.data
  }

  const login = async (email, senha) => {
    const res = await authApi.login(email, senha)
    localStorage.setItem('token', res.data.token)
    setUsuario(res.data.usuario)
    return res.data
  }

  const loginCorretor = async (email, senha) => {
    const res = await authApi.loginCorretor(email, senha)
    localStorage.setItem('token', res.data.token)
    setUsuario(res.data.corretor)
    return res.data
  }

  const logout = () => {
    localStorage.removeItem('token')
    setUsuario(null)
  }

  const atualizarFotoPerfil = async (fotoPerfil) => {
    const role = usuario?.role
    if (role === 'corretor' || role === 'gerente') {
      await authApi.atualizarFotoPerfilCorretor(fotoPerfil)
    } else {
      await authApi.atualizarFotoPerfil(fotoPerfil)
    }
    setUsuario((prev) => ({ ...prev, fotoPerfil }))
  }

  const atualizarLogoImobiliaria = (logoUrl) => {
    setUsuario((prev) => ({
      ...prev,
      imobiliaria: { ...prev.imobiliaria, logoUrl },
    }))
  }

  const isCorretor = usuario?.role === 'corretor'
  const isGerente = usuario?.role === 'gerente'
  const isGestor = usuario?.role === 'gestor' || usuario?.role === 'admin'
  const planoInfo = usuario?.planoInfo ?? null
  const isBloqueado = !!planoInfo?.planoBloqueadoEm
  const isLegado = planoInfo?.plano === 'legado'

  return (
    <AuthContext.Provider value={{ usuario, loading, register, login, loginCorretor, logout, isCorretor, isGerente, isGestor, atualizarFotoPerfil, atualizarLogoImobiliaria, planoInfo, isBloqueado, isLegado }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
