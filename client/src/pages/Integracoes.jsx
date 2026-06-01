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

  // Passo 3
  const [userToken, setUserToken]           = useState('')
  const [buscandoPaginas, setBuscandoPaginas] = useState(false)
  const [paginasDisponiveis, setPaginasDisponiveis] = useState([])
  const [selectedPageId, setSelectedPageId] = useState('')

  useEffect(() => { carregarStatus() }, [])

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

  // Quando o token muda, descarta a lista de páginas já carregada
  function handleUserTokenChange(val) {
    setUserToken(val)
    if (paginasDisponiveis.length > 0) setPaginasDisponiveis([])
  }

  async function handleBuscarPaginas() {
    const token = userToken.trim()
    setErro(null)
    if (!token) { setErro('Cole o User Access Token antes de buscar.'); return }

    setBuscandoPaginas(true)
    try {
      const resp = await fetch(
        `https://graph.facebook.com/me/accounts?access_token=${encodeURIComponent(token)}&fields=id,name`
      )
      const data = await resp.json()

      if (data.error) {
        setErro('Token inválido. Verifique se copiou o token correto do Graph API Explorer.')
        return
      }

      const pages = data.data || []
      if (pages.length === 0) {
        setErro('Nenhuma página encontrada. Certifique-se de ser administrador de pelo menos uma página.')
        return
      }

      setPaginasDisponiveis(pages)
      setSelectedPageId(pages[0].id)
    } catch {
      setErro('Não foi possível contatar o Facebook. Verifique sua conexão.')
    } finally {
      setBuscandoPaginas(false)
    }
  }

  async function handleConectar() {
    setErro(null)
    setSucesso(null)
    if (!selectedPageId) { setErro('Selecione uma página.'); return }

    setSalvando(true)
    try {
      const { data } = await selecionarPagina({ userAccessToken: userToken.trim(), pageId: selectedPageId })
      const pageName = data.pageName || paginasDisponiveis.find((p) => p.id === selectedPageId)?.name || selectedPageId

      setAtivo(true)
      setPageIdAtual(selectedPageId)
      setPageNameAtual(pageName)
      setCriadoEm(new Date().toISOString())
      setUserToken('')
      setPaginasDisponiveis([])
      setSucesso('Página conectada! Os leads do Facebook/Instagram serão recebidos automaticamente.')
    } catch (e) {
      setErro(e.response?.data?.error || 'Erro ao conectar. Tente novamente.')
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
          <h1 className="text-xl font-bold" style={{ color: '#F1F5F9' }}>Integrações</h1>
        </div>
        <p className="text-sm" style={{ color: '#94A3B8' }}>
          Conecte fontes externas para receber leads automaticamente no CRM.
        </p>
      </div>

      {/* Card de status */}
      <div className="card mb-4">
        <div className="flex items-center gap-3">
          <FacebookIcon />
          <div>
            <p className="font-semibold text-sm" style={{ color: '#F1F5F9' }}>Meta Lead Ads</p>
            <p className="text-xs" style={{ color: '#64748B' }}>Facebook &amp; Instagram Leads</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="inline-block rounded-full"
              style={{ width: 8, height: 8, flexShrink: 0, backgroundColor: ativo ? '#10B981' : '#EF4444' }} />
            <span className="text-xs font-semibold" style={{ color: ativo ? '#10B981' : '#EF4444' }}>
              {ativo ? 'Conectado' : 'Desconectado'}
            </span>
          </div>
        </div>

        {/* Estado conectado */}
        {ativo && pageIdAtual && (
          <div className="mt-4 rounded-lg px-4 py-3"
            style={{ backgroundColor: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: '#10B981' }}>
                  {pageNameAtual || pageIdAtual}
                </p>
                {criadoEm && (
                  <p className="text-xs mt-0.5" style={{ color: '#6EE7B7' }}>
                    Conectado em{' '}
                    {new Date(criadoEm).toLocaleDateString('pt-BR', {
                      day: '2-digit', month: 'long', year: 'numeric',
                    })}
                  </p>
                )}
              </div>
              <button
                onClick={handleDesconectar}
                disabled={salvando}
                className="text-xs px-3 py-1 rounded-lg font-medium flex-shrink-0"
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
      </div>

      {/* Feedback */}
      {sucesso && (
        <div className="rounded-lg px-4 py-3 text-sm mb-4"
          style={{ backgroundColor: 'rgba(16,185,129,0.1)', color: '#6EE7B7', border: '1px solid rgba(16,185,129,0.2)' }}>
          {sucesso}
        </div>
      )}
      {erro && (
        <div className="rounded-lg px-4 py-3 text-sm mb-4"
          style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.2)' }}>
          {erro}
        </div>
      )}

      {/* Fluxo guiado de 3 passos */}
      {!ativo && (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: '#64748B' }}>
            Como conectar — 3 passos
          </p>

          {/* ── PASSO 1 ── */}
          <div className="flex gap-3">
            <StepSidebar last={false} />
            <div className="card flex-1 mb-4">
              <StepHeader n={1} title="Abra o gerador de token" />
              <p className="text-xs mb-3" style={{ color: '#94A3B8' }}>
                Clique no botão abaixo. Vai abrir o Graph API Explorer do Facebook já configurado.
                Faça login com o perfil que administra a página.
              </p>
              <a
                href="https://developers.facebook.com/tools/explorer/893852687057557/?method=GET&path=me%2Faccounts&version=v19.0"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  backgroundColor: '#1877F2', color: '#fff',
                  padding: '7px 14px', borderRadius: 8,
                  fontSize: 13, fontWeight: 600, textDecoration: 'none',
                }}
              >
                <FacebookIconSmall />
                Abrir Graph API Explorer →
              </a>
              <div className="mt-3 rounded-lg px-3 py-2.5 text-xs"
                style={{ backgroundColor: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', color: '#94A3B8', lineHeight: 1.7 }}>
                Após abrir, clique em <strong style={{ color: '#F1F5F9' }}>"Gerar token de acesso"</strong> e marque as
                permissões:{' '}
                <Code>pages_show_list</Code>,{' '}
                <Code>pages_read_engagement</Code>,{' '}
                <Code>leads_retrieval</Code>,{' '}
                <Code>pages_manage_metadata</Code>.
              </div>
            </div>
          </div>

          {/* ── PASSO 2 ── */}
          <div className="flex gap-3">
            <StepSidebar last={false} />
            <div className="card flex-1 mb-4">
              <StepHeader n={2} title="Copie o seu User Access Token" />
              <p className="text-xs mb-3" style={{ color: '#94A3B8' }}>
                No topo do Explorer, após gerar o token, copie o token que aparece no campo{' '}
                <strong style={{ color: '#F1F5F9' }}>"Token de acesso"</strong>.
                NÃO precisa clicar em Enviar.
              </p>

              {/* Mockup visual do campo de token no Explorer */}
              <div className="rounded-lg overflow-hidden text-xs"
                style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                {/* Barra de título do Explorer */}
                <div className="flex items-center gap-2 px-3 py-1.5"
                  style={{ backgroundColor: 'rgba(24,119,242,0.15)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <FacebookIconSmall />
                  <span style={{ color: '#93C5FD', fontWeight: 600 }}>Graph API Explorer</span>
                </div>
                {/* Campo Token de acesso */}
                <div className="px-3 py-2.5" style={{ backgroundColor: 'rgba(0,0,0,0.25)' }}>
                  <div className="text-xs mb-1" style={{ color: '#64748B' }}>Token de acesso</div>
                  <div className="flex items-center gap-2 rounded px-2.5 py-1.5"
                    style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(99,102,241,0.4)' }}>
                    <span className="flex-1 font-mono truncate" style={{ color: '#FCD34D', fontSize: 11 }}>
                      EAAb6z4XxBzMBO...
                    </span>
                    <span className="flex-shrink-0 rounded px-1.5 py-0.5 font-sans font-semibold"
                      style={{ backgroundColor: 'rgba(16,185,129,0.2)', color: '#6EE7B7', fontSize: 10 }}>
                      ← copie aqui
                    </span>
                  </div>
                </div>
                {/* Linha de método/path (decorativa) */}
                <div className="flex items-center gap-2 px-3 py-2"
                  style={{ backgroundColor: 'rgba(0,0,0,0.15)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <span className="rounded px-1.5 py-0.5 font-mono font-bold" style={{ backgroundColor: 'rgba(99,102,241,0.2)', color: '#818cf8', fontSize: 10 }}>GET</span>
                  <span style={{ color: '#475569', fontSize: 11 }}>v19.0 / me/accounts</span>
                </div>
              </div>

              <p className="text-xs mt-2" style={{ color: '#64748B' }}>
                O token começa com <Code amber>EAA...</Code> e é bem longo.
              </p>
            </div>
          </div>

          {/* ── PASSO 3 ── */}
          <div className="flex gap-3">
            <StepSidebar last={true} />
            <div className="card flex-1 mb-0">
              <StepHeader n={3} title="Cole o token e selecione sua página" green />

              <div className="space-y-3">
                {/* Textarea do token */}
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#64748B' }}>
                    USER ACCESS TOKEN
                  </label>
                  <textarea
                    rows={3}
                    value={userToken}
                    onChange={(e) => handleUserTokenChange(e.target.value)}
                    placeholder="Cole o token copiado do Graph API Explorer..."
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      borderRadius: 8, padding: '8px 12px',
                      fontSize: 11, resize: 'none',
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      color: '#F1F5F9',
                      border: paginasDisponiveis.length > 0
                        ? '1px solid rgba(16,185,129,0.4)'
                        : '1px solid rgba(255,255,255,0.1)',
                      outline: 'none',
                      fontFamily: 'monospace',
                      lineHeight: 1.5,
                    }}
                  />
                </div>

                {/* Botão buscar páginas */}
                {paginasDisponiveis.length === 0 && (
                  <button
                    onClick={handleBuscarPaginas}
                    disabled={buscandoPaginas || !userToken.trim()}
                    style={{
                      width: '100%',
                      padding: '8px 16px',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      backgroundColor: buscandoPaginas || !userToken.trim()
                        ? 'rgba(99,102,241,0.2)'
                        : 'rgba(99,102,241,0.25)',
                      color: buscandoPaginas || !userToken.trim() ? '#64748B' : '#A5B4FC',
                      border: '1px solid rgba(99,102,241,0.3)',
                      cursor: buscandoPaginas || !userToken.trim() ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {buscandoPaginas ? 'Buscando páginas…' : 'Buscar minhas páginas →'}
                  </button>
                )}

                {/* Dropdown de páginas (após busca bem-sucedida) */}
                {paginasDisponiveis.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 text-xs" style={{ color: '#6EE7B7' }}>
                      <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Token válido — {paginasDisponiveis.length} página{paginasDisponiveis.length > 1 ? 's' : ''} encontrada{paginasDisponiveis.length > 1 ? 's' : ''}
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: '#64748B' }}>
                        SELECIONE SUA PÁGINA
                      </label>
                      <select
                        value={selectedPageId}
                        onChange={(e) => setSelectedPageId(e.target.value)}
                        style={{
                          width: '100%', boxSizing: 'border-box',
                          borderRadius: 8, padding: '8px 12px',
                          fontSize: 13,
                          backgroundColor: 'rgba(255,255,255,0.05)',
                          color: '#F1F5F9',
                          border: '1px solid rgba(255,255,255,0.15)',
                          outline: 'none',
                        }}
                      >
                        {paginasDisponiveis.map((p) => (
                          <option key={p.id} value={p.id} style={{ backgroundColor: '#1E293B' }}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <button
                        onClick={() => { setPaginasDisponiveis([]); setUserToken('') }}
                        style={{
                          fontSize: 12, color: '#64748B', background: 'none',
                          border: 'none', cursor: 'pointer', padding: 0,
                        }}
                      >
                        ← Usar outro token
                      </button>
                      <button
                        onClick={handleConectar}
                        disabled={salvando || !selectedPageId}
                        style={{
                          padding: '8px 20px', borderRadius: 8,
                          fontSize: 13, fontWeight: 600, border: 'none',
                          backgroundColor: salvando || !selectedPageId ? 'rgba(16,185,129,0.35)' : '#10B981',
                          color: '#fff',
                          cursor: salvando || !selectedPageId ? 'not-allowed' : 'pointer',
                          transition: 'background-color 0.15s',
                        }}
                      >
                        {salvando ? 'Conectando…' : 'Conectar página'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ── sub-componentes ───────────────────────────────────── */

function StepSidebar({ last }) {
  return (
    <div className="flex flex-col items-center" style={{ width: 32, flexShrink: 0 }}>
      <div style={{ height: 20, width: 2, backgroundColor: 'transparent' }} />
      {!last && (
        <div style={{ flex: 1, width: 2, minHeight: 16, backgroundColor: 'rgba(99,102,241,0.2)', marginBottom: -8 }} />
      )}
    </div>
  )
}

function StepHeader({ n, title, green }) {
  const bg    = green ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.15)'
  const color = green ? '#10B981' : '#818cf8'
  return (
    <div className="flex items-center gap-2 mb-2">
      <div className="flex items-center justify-center rounded-full text-xs font-bold flex-shrink-0"
        style={{ width: 24, height: 24, backgroundColor: bg, color }}>
        {n}
      </div>
      <p className="font-semibold text-sm" style={{ color: '#F1F5F9' }}>{title}</p>
    </div>
  )
}

function Code({ children, amber }) {
  return (
    <code style={{ color: amber ? '#FCD34D' : '#818cf8', fontSize: 11 }}>{children}</code>
  )
}

function MetaIcon() {
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 8,
      background: 'linear-gradient(135deg, #1877F2, #0a5dc2)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15v-4H9l3-6 3 6h-2v4h-2z" />
      </svg>
    </div>
  )
}

function FacebookIcon() {
  return (
    <div style={{
      width: 40, height: 40, borderRadius: 10,
      background: 'linear-gradient(135deg, #1877F2, #0a5dc2)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    </div>
  )
}

function FacebookIconSmall() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="white">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}
