import { useEffect, useState } from 'react'
import { getStatusMeta, conectarMeta, desconectarMeta } from '../api/integracoes'

export default function Integracoes() {
  const [ativo, setAtivo]           = useState(false)
  const [pageIdAtual, setPageIdAtual] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [pageId, setPageId]         = useState('')
  const [pageToken, setPageToken]   = useState('')
  const [salvando, setSalvando]     = useState(false)
  const [erro, setErro]             = useState(null)
  const [sucesso, setSucesso]       = useState(null)

  useEffect(() => {
    carregarStatus()
  }, [])

  async function carregarStatus() {
    try {
      const { data } = await getStatusMeta()
      setAtivo(data.ativo)
      setPageIdAtual(data.pageId)
    } catch {
      setAtivo(false)
    } finally {
      setCarregando(false)
    }
  }

  async function handleConectar(e) {
    e.preventDefault()
    setErro(null)
    setSucesso(null)
    if (!pageId.trim() || !pageToken.trim()) {
      setErro('Preencha o Page ID e o Page Access Token.')
      return
    }
    setSalvando(true)
    try {
      await conectarMeta({ pageId: pageId.trim(), pageToken: pageToken.trim() })
      setSucesso('Integração salva com sucesso!')
      setAtivo(true)
      setPageIdAtual(pageId.trim())
      setPageId('')
      setPageToken('')
    } catch (e) {
      setErro(e.response?.data?.error || 'Erro ao salvar integração.')
    } finally {
      setSalvando(false)
    }
  }

  async function handleDesconectar() {
    if (!window.confirm('Desconectar a integração com o Meta Lead Ads?')) return
    setErro(null)
    setSucesso(null)
    setSalvando(true)
    try {
      await desconectarMeta()
      setAtivo(false)
      setPageIdAtual(null)
      setSucesso('Integração removida.')
    } catch (e) {
      setErro(e.response?.data?.error || 'Erro ao remover integração.')
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-xl mx-auto">

      {/* Cabeçalho */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <MetaIcon />
          <h1 className="text-xl font-bold" style={{ color: '#F1F5F9' }}>
            Integrações
          </h1>
        </div>
        <p className="text-sm" style={{ color: '#94A3B8' }}>
          Conecte fontes externas para receber leads automaticamente no CRM.
        </p>
      </div>

      {/* Card Meta Lead Ads */}
      <div className="card mb-4">
        <div className="flex items-center gap-3 mb-4">
          <FacebookIcon />
          <div>
            <p className="font-semibold text-sm" style={{ color: '#F1F5F9' }}>Meta Lead Ads</p>
            <p className="text-xs" style={{ color: '#64748B' }}>Facebook &amp; Instagram Leads</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span
              className="inline-block rounded-full"
              style={{ width: 8, height: 8, backgroundColor: ativo ? '#10B981' : '#EF4444', flexShrink: 0 }}
            />
            <span className="text-xs font-semibold" style={{ color: ativo ? '#10B981' : '#EF4444' }}>
              {ativo ? 'Conectado' : 'Desconectado'}
            </span>
          </div>
        </div>

        {ativo && pageIdAtual && (
          <div
            className="flex items-center justify-between rounded-lg px-3 py-2 mb-4 text-sm"
            style={{ backgroundColor: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}
          >
            <span style={{ color: '#10B981' }}>Page ID: <strong>{pageIdAtual}</strong></span>
            <button
              onClick={handleDesconectar}
              disabled={salvando}
              className="text-xs px-3 py-1 rounded-lg font-medium transition-colors"
              style={{
                backgroundColor: 'rgba(239,68,68,0.12)',
                color: '#F87171',
                border: '1px solid rgba(239,68,68,0.25)',
                opacity: salvando ? 0.5 : 1,
                cursor: salvando ? 'not-allowed' : 'pointer',
              }}
            >
              {salvando ? 'Aguarde…' : 'Desconectar'}
            </button>
          </div>
        )}

        {!ativo && (
          <form onSubmit={handleConectar} className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#64748B' }}>
                PAGE ID
              </label>
              <input
                type="text"
                value={pageId}
                onChange={(e) => setPageId(e.target.value)}
                placeholder="Ex: 123456789012345"
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  color: '#F1F5F9',
                  border: '1px solid rgba(255,255,255,0.1)',
                  outline: 'none',
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#64748B' }}>
                PAGE ACCESS TOKEN
              </label>
              <input
                type="password"
                value={pageToken}
                onChange={(e) => setPageToken(e.target.value)}
                placeholder="Cole o token aqui"
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  color: '#F1F5F9',
                  border: '1px solid rgba(255,255,255,0.1)',
                  outline: 'none',
                }}
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={salvando}
                className="btn-primary text-sm"
              >
                {salvando ? 'Salvando…' : 'Conectar'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Feedback */}
      {sucesso && (
        <div
          className="rounded-lg px-4 py-3 text-sm mb-4"
          style={{ backgroundColor: 'rgba(16,185,129,0.1)', color: '#6EE7B7', border: '1px solid rgba(16,185,129,0.2)' }}
        >
          {sucesso}
        </div>
      )}
      {erro && (
        <div
          className="rounded-lg px-4 py-3 text-sm mb-4"
          style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          {erro}
        </div>
      )}

      {/* Instruções */}
      {!ativo && (
        <div className="card">
          <p className="text-sm font-semibold mb-3" style={{ color: '#F1F5F9' }}>
            Como obter o Page Access Token
          </p>
          <ol className="space-y-2">
            {[
              'Acesse developers.facebook.com e vá em "Meus Apps".',
              'Selecione seu app ou crie um novo do tipo "Business".',
              'No menu lateral, acesse "Ferramentas" → "Graph API Explorer".',
              'Em "Permissões", adicione leads_retrieval e pages_read_engagement.',
              'Clique em "Gerar Token de Acesso" e copie o token gerado.',
              'Cole o Page ID da sua página e o token acima.',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm" style={{ color: '#94A3B8' }}>
                <span
                  className="flex-shrink-0 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ width: 20, height: 20, minWidth: 20, backgroundColor: 'rgba(99,102,241,0.2)', color: '#818cf8' }}
                >
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <div
            className="mt-4 rounded-lg px-3 py-2 text-xs"
            style={{ backgroundColor: 'rgba(99,102,241,0.08)', color: '#94A3B8', border: '1px solid rgba(99,102,241,0.15)' }}
          >
            <strong style={{ color: '#818cf8' }}>URL do Webhook:</strong>{' '}
            {window.location.origin.replace(':5173', ':3002')}/api/integracoes/meta/webhook
          </div>
        </div>
      )}
    </div>
  )
}

function MetaIcon() {
  return (
    <div
      style={{
        width: 36, height: 36, borderRadius: 8,
        background: 'linear-gradient(135deg, #1877F2, #0a5dc2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15v-4H9l3-6 3 6h-2v4h-2z" />
      </svg>
    </div>
  )
}

function FacebookIcon() {
  return (
    <div
      style={{
        width: 40, height: 40, borderRadius: 10,
        background: 'linear-gradient(135deg, #1877F2, #0a5dc2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    </div>
  )
}
