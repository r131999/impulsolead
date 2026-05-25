import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Cadastro() {
  const { usuario, register } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    nomeImobiliaria: '',
    nomeUsuario: '',
    telefone: '',
    email: '',
    senha: '',
    confirmarSenha: '',
  })
  const [erro, setErro]       = useState('')
  const [loading, setLoading] = useState(false)
  const [mostrarSenha, setMostrarSenha] = useState(false)

  if (usuario) {
    return <Navigate to="/dashboard" replace />
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  function validar() {
    if (!form.nomeImobiliaria.trim()) return 'Informe o nome da imobiliária.'
    if (!form.nomeUsuario.trim())     return 'Informe seu nome.'
    if (!form.email.trim())           return 'Informe seu e-mail.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'E-mail inválido.'
    if (form.senha.length < 6)        return 'A senha deve ter no mínimo 6 caracteres.'
    if (form.senha !== form.confirmarSenha) return 'As senhas não coincidem.'
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')

    const erroValidacao = validar()
    if (erroValidacao) { setErro(erroValidacao); return }

    setLoading(true)
    try {
      await register({
        nomeImobiliaria: form.nomeImobiliaria.trim(),
        nomeUsuario:     form.nomeUsuario.trim(),
        email:           form.email.trim().toLowerCase(),
        senha:           form.senha,
        telefone:        form.telefone.trim() || undefined,
      })
      navigate('/dashboard')
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao criar conta. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #0B1120 0%, #1a1040 50%, #0B1120 100%)' }}
    >
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src="/logo-colorida.png" alt="ImpulsoLead" style={{ height: '48px' }} />
          <p className="text-indigo-300 mt-1 text-sm">CRM para imobiliárias</p>
        </div>

        {/* Badge trial */}
        <div className="flex justify-center mb-5">
          <span
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full"
            style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            7 dias grátis · Sem cartão de crédito
          </span>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl shadow-2xl p-8"
          style={{ backgroundColor: '#111827', border: '1px solid #1E293B' }}
        >
          <h1 className="text-lg font-bold mb-1" style={{ color: '#F1F5F9' }}>
            Criar conta grátis
          </h1>
          <p className="text-sm mb-6" style={{ color: '#64748B' }}>
            Configure seu CRM em menos de 2 minutos.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Nome da imobiliária */}
            <div>
              <label className="label">Nome da imobiliária</label>
              <input
                className="input"
                value={form.nomeImobiliaria}
                onChange={set('nomeImobiliaria')}
                placeholder="Ex: Imobiliária Horizonte"
                autoFocus
                required
              />
            </div>

            {/* Seu nome */}
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

            {/* Telefone */}
            <div>
              <label className="label">
                Telefone
                <span className="ml-1 text-xs" style={{ color: '#475569' }}>(opcional)</span>
              </label>
              <input
                className="input"
                value={form.telefone}
                onChange={set('telefone')}
                placeholder="(11) 99999-9999"
                type="tel"
              />
            </div>

            {/* Divisor */}
            <div style={{ borderTop: '1px solid #1E293B', margin: '0.5rem 0' }} />

            {/* E-mail */}
            <div>
              <label className="label">E-mail</label>
              <input
                type="email"
                className="input"
                value={form.email}
                onChange={set('email')}
                placeholder="voce@empresa.com"
                required
              />
            </div>

            {/* Senha */}
            <div>
              <label className="label">Senha</label>
              <div className="relative">
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  className="input"
                  style={{ paddingRight: '2.5rem' }}
                  value={form.senha}
                  onChange={set('senha')}
                  placeholder="Mínimo 6 caracteres"
                  required
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: '#64748B' }}
                  tabIndex={-1}
                >
                  {mostrarSenha ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            {/* Confirmar senha */}
            <div>
              <label className="label">Confirmar senha</label>
              <input
                type={mostrarSenha ? 'text' : 'password'}
                className="input"
                value={form.confirmarSenha}
                onChange={set('confirmarSenha')}
                placeholder="Repita a senha"
                required
              />
            </div>

            {/* Erro */}
            {erro && (
              <p
                className="text-sm rounded-lg px-3 py-2"
                style={{ color: '#EF4444', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}
              >
                {erro}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              className="btn-primary w-full py-2.5 mt-2"
              disabled={loading}
            >
              {loading ? 'Criando conta…' : 'Criar conta grátis'}
            </button>
          </form>

          {/* Link para login */}
          <p className="text-center mt-5 text-sm" style={{ color: '#64748B' }}>
            Já tem conta?{' '}
            <Link to="/login" className="font-medium hover:underline" style={{ color: '#818cf8' }}>
              Entrar
            </Link>
          </p>
        </div>

        {/* Rodapé */}
        <p className="text-center mt-6 text-xs" style={{ color: '#334155' }}>
          © {new Date().getFullYear()} ImpulsoLead · Todos os direitos reservados
        </p>
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
