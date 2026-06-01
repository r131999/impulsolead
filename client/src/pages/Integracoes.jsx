import { useEffect, useState } from 'react'
import { getStatusMeta, desconectarMeta, selecionarPagina } from '../api/integracoes'

export default function Integracoes() {
  const [ativo, setAtivo]               = useState(false)
  const [pageIdAtual, setPageIdAtual]   = useState(null)
  const [pageNameAtual, setPageNameAtual] = useState(null)
  const [criadoEm, setCriadoEm]         = useState(null)
  const [carregando, setCarregando]     = useState(true)
  const [salvando, setSalvando]         = useState(false)
  const [erro, setErro]                 = useState(null)
  const [sucesso, setSucesso]           = useState(null)
  const [paginasOAuth, setPaginasOAuth] = useState([])
  const [selectedPageId, setSelectedPageId] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const status = params.get('status')

    if (status === 'paginas_ok') {
      const paginasJson = params.get('paginas')
      try {
        const paginas = JSON.parse(decodeURIComponent(paginasJson || '[]'))
        setPaginasOAuth(paginas)
        if (paginas.length > 0) setSelectedPageId(paginas[0].id)
      } catch {
        setErro('Erro ao carregar as páginas do Facebook.')
      }
      window.history.replaceState({}, '', '/integracoes')
    } else if (status === 'cancelado') {
      const erroParam = params.get('erro')
      setErro(erroParam ? decodeURIComponent(erroParam) : 'Conexão com o Facebook cancelada.')
      window.history.replaceState({}, '', '/integracoes')
    }

    carregarStatus()
  }, [])

  async function carregarStatus() {
    try {
      const { data } = await getStatusMeta()
      setAtivo(data.ativo)
      setPageIdAtual(data.pageId)
      setPageNameAtual(data.pageName)
      setCriadoEm(data.criadoEm)
    } catch {
      setAtivo(false)
    } finally {
      setCarregando(false)
    }
  }

  function handleIniciarOAuth() {
    const token = localStorage.getItem('token')
    window.location.href = `/api/integracoes/meta/oauth/iniciar?token=${encodeURIComponent(token)}`
  }

  async function handleConfirmarPagina() {
    const page = paginasOAuth.find((p) => p.id === selectedPageId)
    if (!page) return
    setErro(null)
    setSucesso(null)
    setSalvando(true)
    try {
      await selecionarPagina({ pageId: page.id, pageName: page.name, pageToken: page.access_token })
      setAtivo(true)
      setPageIdAtual(page.id)
      setPageNameAtual(page.name)
      setCriadoEm(new Date().toISOString())
      setPaginasOAuth([])
      setSucesso('Página conectada com sucesso! Os leads do Facebook/Instagram serão recebidos automaticamente.')
    } catch (e) {
      setErro(e.response?.data?.error || 'Erro ao confirmar conexão.')
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
      setPageNameAtual(null)
      setCriadoEm(null)
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
              style={{
                width: 8, height: 8, flexShrink: 0,
                backgroundColor: ativo ? '#10B981' : paginasOAuth.length > 0 ? '#F59E0B' : '#EF4444',
              }}
            />
            <span className="text-xs font-semibold" style={{
              color: ativo ? '#10B981' : paginasOAuth.length > 0 ? '#F59E0B' : '#EF4444',
            }}>
              {ativo ? 'Conectado' : paginasOAuth.length > 0 ? 'Aguardando seleção' : 'Desconectado'}
            </span>
          </div>
        </div>

        {/* ESTADO 3 — Conectado */}
        {ativo && pageIdAtual && (
          <div
            className="rounded-lg px-4 py-3 mb-2"
            style={{ backgroundColor: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: '#10B981' }}>
                  {pageNameAtual || pageIdAtual}
                </p>
                {criadoEm && (
                  <p className="text-xs mt-0.5" style={{ color: '#6EE7B7' }}>
                    Conectado em {new Date(criadoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                )}
              </div>
              <button
                onClick={handleDesconectar}
                disabled={salvando}
                className="text-xs px-3 py-1 rounded-lg font-medium transition-colors flex-shrink-0"
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
          </div>
        )}

        {/* ESTADO 2 — Selecionar página */}
        {!ativo && paginasOAuth.length > 0 && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#94A3B8' }}>
                Selecione qual página receberá os leads
              </label>
              <select
                value={selectedPageId}
                onChange={(e) => setSelectedPageId(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  color: '#F1F5F9',
                  border: '1px solid rgba(255,255,255,0.15)',
                  outline: 'none',
                }}
              >
                {paginasOAuth.map((p) => (
                  <option key={p.id} value={p.id} style={{ backgroundColor: '#1E293B' }}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleConfirmarPagina}
                disabled={salvando || !selectedPageId}
                className="btn-primary text-sm"
              >
                {salvando ? 'Conectando…' : 'Confirmar conexão'}
              </button>
            </div>
          </div>
        )}

        {/* ESTADO 1 — Desconectado */}
        {!ativo && paginasOAuth.length === 0 && (
          <button
            onClick={handleIniciarOAuth}
            disabled={salvando}
            className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-colors"
            style={{
              backgroundColor: '#1877F2',
              color: '#fff',
              opacity: salvando ? 0.6 : 1,
              cursor: salvando ? 'not-allowed' : 'pointer',
            }}
          >
            <FacebookIconSmall />
            Conectar com Facebook
          </button>
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

      {/* Informações do webhook (sempre visível quando não conectado) */}
      {!ativo && paginasOAuth.length === 0 && (
        <div className="card">
          <p className="text-sm font-semibold mb-1" style={{ color: '#F1F5F9' }}>
            Como funciona
          </p>
          <p className="text-sm mb-3" style={{ color: '#94A3B8' }}>
            Clique em "Conectar com Facebook", autorize o acesso às suas páginas e selecione a página que enviará os leads para o CRM.
          </p>
          <div
            className="rounded-lg px-3 py-2 text-xs"
            style={{ backgroundColor: 'rgba(99,102,241,0.08)', color: '#94A3B8', border: '1px solid rgba(99,102,241,0.15)' }}
          >
            <strong style={{ color: '#818cf8' }}>URL do Webhook (Meta App):</strong>{' '}
            https://api-crm.impulsoslz.com.br/api/integracoes/meta/webhook
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

function FacebookIconSmall() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}
