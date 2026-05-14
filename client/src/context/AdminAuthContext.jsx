import { createContext, useContext, useState, useEffect } from 'react'
import { loginSupremo as loginSupremoApi, meSupremo } from '../api/admin'

const AdminAuthContext = createContext(null)

export function AdminAuthProvider({ children }) {
  const [supremo, setSupremo] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (token) {
      meSupremo()
        .then((res) => setSupremo(res.data))
        .catch(() => localStorage.removeItem('admin_token'))
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (email, senha) => {
    const res = await loginSupremoApi(email, senha)
    localStorage.setItem('admin_token', res.data.token)
    setSupremo(res.data.usuario)
    return res.data
  }

  const logout = () => {
    localStorage.removeItem('admin_token')
    setSupremo(null)
  }

  return (
    <AdminAuthContext.Provider value={{ supremo, loading, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  )
}

export const useAdminAuth = () => useContext(AdminAuthContext)
