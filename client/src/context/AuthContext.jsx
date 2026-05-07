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

  const isCorretor = usuario?.role === 'corretor'
  const isGerente = usuario?.role === 'gerente'
  const isGestor = usuario?.role === 'gestor' || usuario?.role === 'admin'

  return (
    <AuthContext.Provider value={{ usuario, loading, login, loginCorretor, logout, isCorretor, isGerente, isGestor }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
