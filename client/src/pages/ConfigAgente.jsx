import { useEffect, useState } from 'react'
import { getConfig, atualizarConfig } from '../api/config'
import { useAuth } from '../context/AuthContext'

export default function ConfigAgente() {
  const { usuario } = useAuth()
  const [config, setConfig] = useState(null)
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [erro, setErro] = useState('')
  const [novaPergunta, setNovaPergunta] = useState('')

  useEffect(() => {
    getConfig()
      .then((res) => {
        setConfig(res.data.config)
        setForm({ ...res.data.config })
      })
      .finally(() => setLoading(false))
  }, [])

  const set = (k) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [k]: val }))
  }

  const adicionarPergunta = () => {
    if (!novaPergunta.trim()) return
    setForm((f) => ({ ...f, perguntas: [...(f.perguntas || []), novaPergunta.trim()] }))
    setNovaPergunta('')
  }

  const removerPergunta = (idx) => {
    setForm((f) => ({ ...f, perguntas: f.perguntas.filter((_, i) => i !== idx) }))
  }

  const moverPergunta = (idx, dir) => {
    setForm((f) => {
      const arr = [...f.perguntas]
      const alvo = idx + dir
      if (alvo < 0 || alvo >= arr.length) return f
      ;[arr[idx], arr[alvo]] = [arr[alvo], arr[idx]]
      return { ...f, perguntas: arr }
    })
  }

  const salvar = async (e) => {
    e.preventDefault()
    setErro('')
    setSucesso(false)
    if (!form.perguntas || form.perguntas.length === 0) {
      setErro('Adicione ao menos uma pergunta para o agente.')
      return
    }
    setSalvando(true)
    try {
      const res = await atualizarConfig({
        nomeAgente: form.nomeAgente,
        tomAgente: form.tomAgente,
        mensagemBoasVindas: form.mensagemBoasVindas,
        perguntas: form.perguntas,
        ativo: form.ativo,
      })
      setConfig(res.data.config)
      setSucesso(true)
      setTimeout(() => setSucesso(false), 3000)
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500" />
      </div>
    )
  }

  if (!form) return null

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#F1F5F9' }}>Configuração do Agente IA</h1>
        <p className="text-sm mt-0.5" style={{ color: '#94A3B8' }}>
          Personalize como o agente qualifica seus leads no WhatsApp
        </p>
      </div>

      {/* API Key */}
      <div className="card mb-6">
        <h2 className="font-semibold mb-3" style={{ color: '#F1F5F9' }}>Integração N8N / Webhook</h2>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#64748B' }}>API Key da imobiliária</label>
          <div className="flex gap-2">
            <input
              readOnly
              className="input font-mono text-xs"
              style={{ backgroundColor: '#0B1120', color: '#94A3B8' }}
              value={usuario?.imobiliaria?.apiKey || '—'}
            />
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(usuario?.imobiliaria?.apiKey || '')}
              className="btn-secondary text-xs flex-shrink-0"
            >
              Copiar
            </button>
          </div>
          <p className="text-xs mt-1" style={{ color: '#64748B' }}>
            Use no header{' '}
            <code
              className="px-1 rounded text-xs"
              style={{ backgroundColor: '#1E293B', color: '#94A3B8' }}
            >
              x-api-key
            </code>{' '}
            das requisições ao webhook.
          </p>
        </div>
      </div>

      <form onSubmit={salvar} className="space-y-6">
        {/* Identidade */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold" style={{ color: '#F1F5F9' }}>Identidade do agente</h2>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-sm" style={{ color: '#94A3B8' }}>{form.ativo ? 'Ativo' : 'Inativo'}</span>
              <div
                onClick={() => setForm((f) => ({ ...f, ativo: !f.ativo }))}
                className="relative w-10 h-5 rounded-full transition-colors cursor-pointer"
                style={{ backgroundColor: form.ativo ? '#4f46e5' : '#1E293B' }}
              >
                <span
                  className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
                  style={{ transform: form.ativo ? 'translateX(20px)' : 'translateX(0)' }}
                />
              </div>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Nome do agente</label>
              <input
                className="input"
                value={form.nomeAgente}
                onChange={set('nomeAgente')}
                placeholder="Ex: Lia"
              />
            </div>
            <div>
              <label className="label">Tom de voz</label>
              <select className="input" value={form.tomAgente} onChange={set('tomAgente')}>
                <option value="profissional mas leve">Profissional mas leve</option>
                <option value="formal">Formal</option>
                <option value="descontraído">Descontraído</option>
                <option value="empático">Empático</option>
              </select>
            </div>
          </div>
        </div>

        {/* Mensagem de boas-vindas */}
        <div className="card">
          <h2 className="font-semibold mb-3" style={{ color: '#F1F5F9' }}>Mensagem de boas-vindas</h2>
          <textarea
            className="input resize-none"
            rows={3}
            value={form.mensagemBoasVindas}
            onChange={set('mensagemBoasVindas')}
            placeholder="Mensagem enviada quando um novo contato inicia conversa..."
          />
          <p className="text-xs mt-1" style={{ color: '#64748B' }}>
            Esta é a primeira mensagem que o lead recebe ao entrar em contato.
          </p>
        </div>

        {/* Perguntas de qualificação */}
        <div className="card">
          <h2 className="font-semibold mb-1" style={{ color: '#F1F5F9' }}>Perguntas de qualificação</h2>
          <p className="text-xs mb-4" style={{ color: '#94A3B8' }}>
            O agente fará estas perguntas em sequência para qualificar o lead.
          </p>

          <div className="space-y-2 mb-4">
            {(form.perguntas || []).map((p, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-lg px-3 py-2"
                style={{ backgroundColor: '#0B1120', border: '1px solid #1E293B' }}
              >
                <span className="text-xs w-5 flex-shrink-0 font-mono" style={{ color: '#64748B' }}>{i + 1}.</span>
                <span className="flex-1 text-sm" style={{ color: '#94A3B8' }}>{p}</span>
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => moverPergunta(i, -1)}
                    disabled={i === 0}
                    className="p-1 transition-opacity hover:opacity-80 disabled:opacity-30"
                    style={{ color: '#64748B' }}
                    title="Mover para cima"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moverPergunta(i, 1)}
                    disabled={i === (form.perguntas?.length || 0) - 1}
                    className="p-1 transition-opacity hover:opacity-80 disabled:opacity-30"
                    style={{ color: '#64748B' }}
                    title="Mover para baixo"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removerPergunta(i)}
                    className="p-1 transition-opacity hover:opacity-80"
                    style={{ color: '#EF4444' }}
                    title="Remover"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
            {(!form.perguntas || form.perguntas.length === 0) && (
              <p className="text-sm text-center py-4" style={{ color: '#64748B' }}>
                Nenhuma pergunta. Adicione abaixo.
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <input
              className="input flex-1"
              value={novaPergunta}
              onChange={(e) => setNovaPergunta(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), adicionarPergunta())}
              placeholder="Nova pergunta... (Enter para adicionar)"
            />
            <button
              type="button"
              onClick={adicionarPergunta}
              disabled={!novaPergunta.trim()}
              className="btn-secondary flex-shrink-0"
            >
              Adicionar
            </button>
          </div>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-4">
          <button type="submit" className="btn-primary px-8" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar configuração'}
          </button>
          {sucesso && (
            <span className="text-sm font-medium flex items-center gap-1" style={{ color: '#10B981' }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Salvo com sucesso!
            </span>
          )}
          {erro && <span className="text-sm" style={{ color: '#EF4444' }}>{erro}</span>}
        </div>
      </form>
    </div>
  )
}
