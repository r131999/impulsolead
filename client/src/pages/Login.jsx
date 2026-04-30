import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { register as registerApi } from '../api/auth'

export default function Login() {
  const { usuario, login } = useAuth()
  const navigate = useNavigate()

  const [modo, setModo] = useState('login') // 'login' | 'register'
  const [form, setForm] = useState({
    email: '',
    senha: '',
    nomeUsuario: '',
    nomeImobiliaria: '',
    telefone: '',
  })
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  if (usuario) return <Navigate to="/dashboard" replace />

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErro('')
    setLoading(true)
    try {
      if (modo === 'login') {
        await login(form.email, form.senha)
      } else {
        const res = await registerApi({
          nomeImobiliaria: form.nomeImobiliaria,
          nomeUsuario: form.nomeUsuario,
          email: form.email,
          senha: form.senha,
          telefone: form.telefone,
        })
        localStorage.setItem('token', res.data.token)
        await login(form.email, form.senha)
      }
      navigate('/dashboard')
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao autenticar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-indigo-700 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">ImpulsoLead</h1>
          <p className="text-indigo-200 mt-1 text-sm">CRM para imobiliárias</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex rounded-lg bg-gray-100 p-1 mb-6">
            <button
              onClick={() => setModo('login')}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                modo === 'login' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Entrar
            </button>
            <button
              onClick={() => setModo('register')}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                modo === 'register' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Criar conta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {modo === 'register' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome da imobiliária
                  </label>
                  <input
                    className="input"
                    value={form.nomeImobiliaria}
                    onChange={set('nomeImobiliaria')}
                    placeholder="Ex: Imobiliária Exemplo"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Seu nome</label>
                  <input
                    className="input"
                    value={form.nomeUsuario}
                    onChange={set('nomeUsuario')}
                    placeholder="Ex: João Silva"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                  <input
                    className="input"
                    value={form.telefone}
                    onChange={set('telefone')}
                    placeholder="(11) 99999-9999"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
              <input
                type="email"
                className="input"
                value={form.email}
                onChange={set('email')}
                placeholder="voce@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
              <input
                type="password"
                className="input"
                value={form.senha}
                onChange={set('senha')}
                placeholder="••••••"
                required
              />
            </div>

            {erro && (
              <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {erro}
              </p>
            )}

            <button type="submit" className="btn-primary w-full py-2.5" disabled={loading}>
              {loading ? 'Aguarde...' : modo === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          </form>

          {modo === 'register' && (
            <p className="text-xs text-gray-500 text-center mt-4">
              7 dias grátis, sem cartão de crédito
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
