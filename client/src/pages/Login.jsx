import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { register as registerApi } from '../api/auth'

export default function Login() {
  const { usuario, login } = useAuth()
  const navigate = useNavigate()

  const [modo, setModo] = useState('login')
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
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #0B1120 0%, #1a1040 50%, #0B1120 100%)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">ImpulsoLead</h1>
          <p className="text-indigo-300 mt-1 text-sm">CRM para imobiliárias</p>
        </div>

        <div className="rounded-2xl shadow-2xl p-8" style={{ backgroundColor: '#111827', border: '1px solid #1E293B' }}>
          <div className="flex rounded-lg p-1 mb-6" style={{ backgroundColor: '#0B1120' }}>
            <button
              onClick={() => setModo('login')}
              className="flex-1 py-1.5 text-sm font-medium rounded-md transition-colors"
              style={
                modo === 'login'
                  ? { backgroundColor: '#1a2332', color: '#F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }
                  : { color: '#64748B' }
              }
            >
              Entrar
            </button>
            <button
              onClick={() => setModo('register')}
              className="flex-1 py-1.5 text-sm font-medium rounded-md transition-colors"
              style={
                modo === 'register'
                  ? { backgroundColor: '#1a2332', color: '#F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }
                  : { color: '#64748B' }
              }
            >
              Criar conta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {modo === 'register' && (
              <>
                <div>
                  <label className="label">Nome da imobiliária</label>
                  <input
                    className="input"
                    value={form.nomeImobiliaria}
                    onChange={set('nomeImobiliaria')}
                    placeholder="Ex: Imobiliária Exemplo"
                    required
                  />
                </div>
                <div>
                  <label className="label">Seu nome</label>
                  <input
                    className="input"
                    value={form.nomeUsuario}
                    onChange={set('nomeUsuario')}
                    placeholder="Ex: João Silva"
                    required
                  />
                </div>
                <div>
                  <label className="label">Telefone</label>
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
              <label className="label">E-mail</label>
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
              <label className="label">Senha</label>
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
              <p className="text-sm rounded-lg px-3 py-2" style={{ color: '#EF4444', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
                {erro}
              </p>
            )}

            <button type="submit" className="btn-primary w-full py-2.5" disabled={loading}>
              {loading ? 'Aguarde...' : modo === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          </form>

          {modo === 'register' && (
            <p className="text-xs text-center mt-4" style={{ color: '#64748B' }}>
              7 dias grátis, sem cartão de crédito
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
