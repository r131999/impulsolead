import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { register as registerApi } from '../api/auth'

export default function Login() {
  const { usuario, login, loginCorretor } = useAuth()
  const navigate = useNavigate()

  const [modo, setModo] = useState('login')
  const [perfil, setPerfil] = useState('gestor')
  const [form, setForm] = useState({
    email: '',
    senha: '',
    nomeUsuario: '',
    nomeImobiliaria: '',
    telefone: '',
  })
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  if (usuario) {
    return <Navigate to={usuario.role === 'corretor' ? '/meus-leads' : '/dashboard'} replace />
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErro('')
    setLoading(true)
    try {
      if (modo === 'login') {
        if (perfil === 'corretor') {
          await loginCorretor(form.email, form.senha)
          navigate('/meus-leads')
        } else {
          await login(form.email, form.senha)
          navigate('/dashboard')
        }
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
        navigate('/dashboard')
      }
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
          <img src="/logo-colorida.png" alt="ImpulsoLead" style={{ height: '48px' }} />
          <p className="text-indigo-300 mt-1 text-sm">CRM para imobiliárias</p>
        </div>

        <div className="rounded-2xl shadow-2xl p-8" style={{ backgroundColor: '#111827', border: '1px solid #1E293B' }}>
          {/* Tabs gestor/corretor/registrar */}
          <div className="flex rounded-lg p-1 mb-6" style={{ backgroundColor: '#0B1120' }}>
            <button
              onClick={() => { setModo('login'); setPerfil('gestor'); setErro('') }}
              className="flex-1 py-1.5 text-sm font-medium rounded-md transition-colors"
              style={
                modo === 'login' && perfil === 'gestor'
                  ? { backgroundColor: '#1a2332', color: '#F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }
                  : { color: '#64748B' }
              }
            >
              Gestor
            </button>
            <button
              onClick={() => { setModo('login'); setPerfil('corretor'); setErro('') }}
              className="flex-1 py-1.5 text-sm font-medium rounded-md transition-colors"
              style={
                modo === 'login' && perfil === 'corretor'
                  ? { backgroundColor: '#1a2332', color: '#F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }
                  : { color: '#64748B' }
              }
            >
              Corretor
            </button>
            <button
              onClick={() => { setModo('register'); setPerfil('gestor'); setErro('') }}
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

          {modo === 'login' && perfil === 'corretor' && (
            <p className="text-xs mb-4 px-3 py-2 rounded-lg" style={{ color: '#818cf8', backgroundColor: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
              Acesso para corretores — credenciais fornecidas pelo gestor
            </p>
          )}

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
              {loading
                ? 'Aguarde...'
                : modo === 'register'
                ? 'Criar conta'
                : perfil === 'corretor'
                ? 'Entrar como corretor'
                : 'Entrar'}
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
