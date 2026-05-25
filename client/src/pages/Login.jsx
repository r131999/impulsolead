import { useState, useEffect } from 'react'
import { Link, useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { usuario, login, loginCorretor } = useAuth()
  const navigate = useNavigate()

  const [perfil, setPerfil] = useState('gestor')
  const [form, setForm] = useState({ email: '', senha: '' })
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [suspendedMsg, setSuspendedMsg] = useState('')

  useEffect(() => {
    const msg = localStorage.getItem('suspended_msg')
    if (msg) {
      setSuspendedMsg(msg)
      localStorage.removeItem('suspended_msg')
    }
  }, [])

  if (usuario) {
    return <Navigate to={usuario.role === 'corretor' ? '/meus-leads' : '/dashboard'} replace />
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErro('')
    setLoading(true)
    try {
      if (perfil === 'corretor') {
        await loginCorretor(form.email, form.senha)
        navigate('/meus-leads')
      } else {
        await login(form.email, form.senha)
        navigate('/dashboard')
      }
    } catch (err) {
      setErro(err.response?.data?.error || 'Credenciais inválidas')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #0B1120 0%, #1a1040 50%, #0B1120 100%)' }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src="/logo-colorida.png" alt="ImpulsoLead" style={{ height: '48px', display: 'block' }} />
          <p className="text-indigo-300 mt-1 text-sm">CRM para imobiliárias</p>
        </div>

        {suspendedMsg && (
          <div
            className="flex items-start gap-3 rounded-xl px-4 py-3 mb-4 text-sm"
            style={{ backgroundColor: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#fca5a5' }}
          >
            <span className="mt-0.5 shrink-0">⚠️</span>
            <span>{suspendedMsg}</span>
          </div>
        )}

        <div className="rounded-2xl shadow-2xl p-8" style={{ backgroundColor: '#111827', border: '1px solid #1E293B' }}>
          {/* Tabs Gestor / Corretor */}
          <div className="flex rounded-lg p-1 mb-6" style={{ backgroundColor: '#0B1120' }}>
            <button
              onClick={() => { setPerfil('gestor'); setErro('') }}
              className="flex-1 py-1.5 text-sm font-medium rounded-md transition-colors"
              style={
                perfil === 'gestor'
                  ? { backgroundColor: '#1a2332', color: '#F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }
                  : { color: '#64748B' }
              }
            >
              Gestor
            </button>
            <button
              onClick={() => { setPerfil('corretor'); setErro('') }}
              className="flex-1 py-1.5 text-sm font-medium rounded-md transition-colors"
              style={
                perfil === 'corretor'
                  ? { backgroundColor: '#1a2332', color: '#F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }
                  : { color: '#64748B' }
              }
            >
              Corretor
            </button>
          </div>

          {perfil === 'corretor' && (
            <p className="text-xs mb-4 px-3 py-2 rounded-lg" style={{ color: '#818cf8', backgroundColor: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
              Acesso para corretores — credenciais fornecidas pelo gestor
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">E-mail</label>
              <input
                type="email"
                className="input"
                value={form.email}
                onChange={set('email')}
                placeholder="voce@email.com"
                autoFocus
                required
              />
            </div>

            <div>
              <label className="label">Senha</label>
              <div className="relative">
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  className="input"
                  style={{ paddingRight: '2.5rem' }}
                  value={form.senha}
                  onChange={set('senha')}
                  placeholder="••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: '#64748B' }}
                  tabIndex={-1}
                  aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {mostrarSenha ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            {erro && (
              <p className="text-sm rounded-lg px-3 py-2" style={{ color: '#EF4444', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
                {erro}
              </p>
            )}

            <button type="submit" className="btn-primary w-full py-2.5" disabled={loading}>
              {loading ? 'Entrando…' : perfil === 'corretor' ? 'Entrar como corretor' : 'Entrar'}
            </button>
          </form>

          {/* Link para cadastro */}
          {perfil === 'gestor' && (
            <p className="text-center mt-5 text-sm" style={{ color: '#64748B' }}>
              Não tem conta?{' '}
              <Link to="/cadastro" className="font-medium hover:underline" style={{ color: '#818cf8' }}>
                Criar conta grátis →
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function EyeIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  )
}
