import { useEffect, useRef, useState, useCallback } from 'react'
import { io } from 'socket.io-client'
import * as chatLeadApi from '../api/chat-lead'
import * as arquivosApi from '../api/arquivos-imovel'
import { useAuth } from '../context/AuthContext'

function formatarHora(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })
}

function formatarTamanho(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// ── Bolha de mensagem ──────────────────────────────────────────────────────────

function BolhaMensagem({ msg }) {
  const isLead = msg.remetenteTipo === 'lead'
  const isSistema = msg.remetenteTipo === 'sistema'
  const hora = formatarHora(msg.criadoEm)

  if (isSistema) {
    return (
      <div className="flex justify-center my-1">
        <div
          className="max-w-xs text-center px-3 py-1.5 rounded-full text-xs italic"
          style={{ backgroundColor: 'rgba(139,92,246,0.12)', color: '#A78BFA' }}
        >
          {msg.conteudo}
        </div>
      </div>
    )
  }

  return (
    <div className={`flex ${isLead ? 'justify-start' : 'justify-end'} mb-2`}>
      <div style={{ maxWidth: '72%' }}>
        <p
          className="text-xs mb-1 px-1"
          style={{ color: '#475569', textAlign: isLead ? 'left' : 'right' }}
        >
          {msg.remetenteNome}
        </p>
        <div
          className="px-3 py-2 text-sm leading-relaxed"
          style={{
            backgroundColor: isLead ? '#1E293B' : 'rgba(59,130,246,0.2)',
            color: '#E2E8F0',
            borderRadius: isLead ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
            border: isLead ? '1px solid #334155' : '1px solid rgba(59,130,246,0.3)',
          }}
        >
          <MidiaInline msg={msg} />
          {msg.conteudo && (
            <p className={`whitespace-pre-wrap break-words${msg.tipoMidia !== 'texto' && msg.conteudo ? ' mt-1' : ''}`}>
              {msg.conteudo}
            </p>
          )}
        </div>
        <p
          className="text-xs mt-1 px-1"
          style={{ color: '#334155', textAlign: isLead ? 'left' : 'right' }}
        >
          {hora}
        </p>
      </div>
    </div>
  )
}

function MidiaInline({ msg }) {
  const { tipoMidia, urlMidia, arquivoImovel } = msg
  if (!tipoMidia || tipoMidia === 'texto' || !urlMidia) return null

  const nome = arquivoImovel?.nome || ''

  if (tipoMidia === 'imagem') {
    return (
      <a href={urlMidia} target="_blank" rel="noopener noreferrer" className="block mb-1">
        <img
          src={urlMidia}
          alt={nome || 'imagem'}
          className="rounded-lg max-h-52 object-cover w-full"
          style={{ border: '1px solid #334155' }}
          onError={(e) => { e.target.style.display = 'none' }}
        />
      </a>
    )
  }

  if (tipoMidia === 'video') {
    return (
      <video
        src={urlMidia}
        controls
        className="rounded-lg w-full max-h-52 mb-1"
        style={{ border: '1px solid #334155' }}
      />
    )
  }

  if (tipoMidia === 'audio') {
    return (
      <audio src={urlMidia} controls className="w-full mb-1" />
    )
  }

  if (tipoMidia === 'pdf') {
    return (
      <a
        href={urlMidia}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 p-2 rounded-lg mb-1 transition-colors"
        style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', textDecoration: 'none' }}
      >
        <span style={{ fontSize: 22 }}>📄</span>
        <span className="text-sm font-medium flex-1 truncate" style={{ color: '#FCA5A5' }}>
          {nome || 'documento.pdf'}
        </span>
        <span className="text-xs flex-shrink-0" style={{ color: '#94A3B8' }}>Abrir</span>
      </a>
    )
  }

  return null
}

// ── Modal de seleção de arquivo ────────────────────────────────────────────────

function ModalArquivos({ arquivos, loading, onSelecionar, onClose }) {
  const [filtro, setFiltro] = useState('todos')

  const filtrados = filtro === 'todos' ? arquivos : arquivos.filter((a) => a.tipo === filtro)

  const iconeTipo = { foto: '🖼️', video: '🎬', pdf: '📄' }

  return (
    <div
      className="fixed inset-0 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col"
        style={{ backgroundColor: '#111827', border: '1px solid #1E293B', maxHeight: '70vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid #1E293B' }}>
          <h2 className="font-bold" style={{ color: '#F1F5F9' }}>Enviar arquivo</h2>
          <button onClick={onClose} className="text-xl leading-none" style={{ color: '#64748B' }}>✕</button>
        </div>

        <div className="flex gap-1.5 px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid #1E293B' }}>
          {['todos', 'foto', 'video', 'pdf'].map((t) => (
            <button
              key={t}
              onClick={() => setFiltro(t)}
              className="px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors"
              style={{
                backgroundColor: filtro === t ? 'rgba(99,102,241,0.25)' : '#1E293B',
                color: filtro === t ? '#818cf8' : '#64748B',
              }}
            >
              {t === 'todos' ? 'Todos' : iconeTipo[t] + ' ' + t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading && (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500" />
            </div>
          )}
          {!loading && filtrados.length === 0 && (
            <p className="text-center py-8 text-sm" style={{ color: '#64748B' }}>
              Nenhum arquivo cadastrado.
            </p>
          )}
          {!loading && filtrados.map((a) => (
            <button
              key={a.id}
              onClick={() => onSelecionar(a)}
              className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors"
              style={{ backgroundColor: '#0B1120', border: '1px solid #1E293B' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1E293B' }}
            >
              <span className="text-xl flex-shrink-0">{iconeTipo[a.tipo] || '📎'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: '#F1F5F9' }}>{a.nome}</p>
                <p className="text-xs" style={{ color: '#64748B' }}>{a.tipo} · {formatarTamanho(a.tamanho)}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── ChatLead principal ─────────────────────────────────────────────────────────

export default function ChatLead({ lead, onClose }) {
  const { usuario, isCorretor, isGerente, isGestor } = useAuth()
  const [mensagens, setMensagens] = useState([])
  const [loading, setLoading] = useState(true)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [sugestoes, setSugestoes] = useState(null)
  const [loadingSugestoes, setLoadingSugestoes] = useState(false)
  const [modalArquivos, setModalArquivos] = useState(false)
  const [arquivos, setArquivos] = useState([])
  const [loadingArquivos, setLoadingArquivos] = useState(false)
  const [erro, setErro] = useState('')

  const mensagensRef = useRef(null)
  const inputRef = useRef(null)
  const socketRef = useRef(null)

  const podeEnviar =
    isGestor ||
    isGerente ||
    (isCorretor && lead.corretor?.id === usuario?.id)

  const scrollParaBaixo = useCallback(() => {
    requestAnimationFrame(() => {
      if (mensagensRef.current) {
        mensagensRef.current.scrollTop = mensagensRef.current.scrollHeight
      }
    })
  }, [])

  // Carrega mensagens iniciais
  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await chatLeadApi.listarMensagens(lead.id)
      setMensagens(res.data.mensagens || [])
      chatLeadApi.marcarLidas(lead.id).catch(() => {})
    } catch {
      setErro('Erro ao carregar mensagens')
    } finally {
      setLoading(false)
    }
  }, [lead.id])

  // Socket.io
  useEffect(() => {
    const token = localStorage.getItem('token')
    const socket = io(window.location.origin, {
      auth: { token },
      transports: ['websocket', 'polling'],
    })
    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('join:lead', lead.id)
    })

    socket.on('nova:mensagem', (msg) => {
      setMensagens((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev
        return [...prev, msg]
      })
      if (msg.remetenteTipo === 'lead') {
        chatLeadApi.marcarLidas(lead.id).catch(() => {})
      }
    })

    return () => {
      socket.emit('leave:lead', lead.id)
      socket.disconnect()
    }
  }, [lead.id])

  useEffect(() => {
    carregar()
  }, [carregar])

  useEffect(() => {
    if (!loading) scrollParaBaixo()
  }, [mensagens, loading, scrollParaBaixo])

  // Oculta o botão hambúrguer enquanto o chat estiver aberto no mobile
  useEffect(() => {
    document.body.classList.add('chat-aberto')
    return () => document.body.classList.remove('chat-aberto')
  }, [])

  // Fechar com Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // ── Enviar texto ──────────────────────────────────────────────────────────────

  const enviar = async () => {
    if (!texto.trim() || enviando) return
    setEnviando(true)
    setErro('')
    try {
      await chatLeadApi.enviarMensagem(lead.id, { conteudo: texto.trim() })
      setTexto('')
      setSugestoes(null)
    } catch {
      setErro('Erro ao enviar mensagem')
    } finally {
      setEnviando(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      enviar()
    }
  }

  // ── Sugestões IA ──────────────────────────────────────────────────────────────

  const sugerir = async () => {
    setLoadingSugestoes(true)
    setSugestoes(null)
    try {
      const res = await chatLeadApi.sugerirResposta(lead.id)
      setSugestoes(res.data.sugestoes || [])
    } catch {
      setErro('Erro ao gerar sugestões')
    } finally {
      setLoadingSugestoes(false)
    }
  }

  // ── Enviar arquivo ────────────────────────────────────────────────────────────

  const abrirArquivos = async () => {
    setModalArquivos(true)
    setLoadingArquivos(true)
    try {
      const res = await arquivosApi.listar()
      setArquivos(res.data.arquivos || [])
    } catch {}
    finally { setLoadingArquivos(false) }
  }

  const enviarArquivoSelecionado = async (arquivo) => {
    setModalArquivos(false)
    setEnviando(true)
    try {
      await chatLeadApi.enviarArquivo(lead.id, { arquivoImovelId: arquivo.id })
    } catch {
      setErro('Erro ao enviar arquivo')
    } finally {
      setEnviando(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      <div
        className="fixed inset-0 z-40 flex items-stretch sm:items-center justify-center"
        style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}
        onClick={onClose}
      >
        <div
          className="relative flex flex-col w-full sm:rounded-2xl shadow-2xl overflow-hidden"
          style={{
            backgroundColor: '#0B1120',
            border: '1px solid #1E293B',
            maxWidth: 680,
            height: '100dvh',
            maxHeight: '100dvh',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div
            className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
            style={{ backgroundColor: '#111827', borderBottom: '1px solid #1E293B' }}
          >
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate" style={{ color: '#F1F5F9' }}>
                💬 {lead.nome}
              </p>
              <p className="text-xs truncate" style={{ color: '#64748B' }}>
                {lead.telefone}
                {lead.corretor && (
                  <span style={{ color: '#60A5FA' }}> · 👤 {lead.corretor.nome}</span>
                )}
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex items-center justify-center rounded-lg transition-colors flex-shrink-0"
              style={{ color: '#64748B', minWidth: 36, minHeight: 36 }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)' }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
            >
              ✕
            </button>
          </div>

          {/* ── Mensagens ── */}
          <div ref={mensagensRef} className="flex-1 overflow-y-auto px-4 py-4">
            {loading && (
              <div className="flex justify-center items-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
              </div>
            )}
            {!loading && mensagens.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <span style={{ fontSize: 40 }}>💬</span>
                <p className="text-sm text-center" style={{ color: '#64748B' }}>
                  Nenhuma mensagem ainda.<br />Seja o primeiro a entrar em contato!
                </p>
              </div>
            )}
            {!loading && mensagens.map((msg) => (
              <BolhaMensagem key={msg.id} msg={msg} />
            ))}
          </div>

          {/* ── Sugestões IA ── */}
          {sugestoes && sugestoes.length > 0 && (
            <div className="flex-shrink-0 px-4 pb-2" style={{ borderTop: '1px solid #1E293B' }}>
              <div className="flex items-center justify-between pt-2 pb-1.5">
                <p className="text-xs font-semibold" style={{ color: '#818cf8' }}>✨ Sugestões da IA</p>
                <button
                  onClick={() => setSugestoes(null)}
                  className="text-xs"
                  style={{ color: '#475569' }}
                >
                  fechar
                </button>
              </div>
              <div className="space-y-1.5">
                {sugestoes.map((s) => (
                  <button
                    key={s.opcao}
                    onClick={() => { setTexto(s.texto); setSugestoes(null); inputRef.current?.focus() }}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors"
                    style={{ backgroundColor: '#111827', border: '1px solid #1E293B', color: '#E2E8F0' }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(129,140,248,0.4)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1E293B' }}
                  >
                    {s.texto}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Input ── */}
          {podeEnviar && (
            <div className="flex-shrink-0 px-4 pb-4 pt-3" style={{ borderTop: '1px solid #1E293B' }}>
              {erro && (
                <p className="text-xs mb-2" style={{ color: '#EF4444' }}>{erro}</p>
              )}

              {/* Botão IA */}
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={sugerir}
                  disabled={loadingSugestoes || enviando}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  style={{ backgroundColor: 'rgba(139,92,246,0.12)', color: '#A78BFA', border: '1px solid rgba(139,92,246,0.2)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(139,92,246,0.22)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(139,92,246,0.12)' }}
                >
                  {loadingSugestoes
                    ? <span className="inline-block w-3 h-3 border border-purple-400 border-t-transparent rounded-full animate-spin" />
                    : '✨'}
                  Sugerir resposta
                </button>
              </div>

              {/* Linha de texto + arquivo + enviar */}
              <div className="flex items-end gap-2">
                <button
                  onClick={abrirArquivos}
                  disabled={enviando}
                  className="flex items-center justify-center rounded-lg transition-colors flex-shrink-0 disabled:opacity-50"
                  style={{ backgroundColor: '#1E293B', color: '#64748B', minWidth: 40, minHeight: 40 }}
                  title="Enviar arquivo de imóvel"
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#94A3B8' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#64748B' }}
                >
                  📎
                </button>
                <textarea
                  ref={inputRef}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={enviando}
                  placeholder="Digite uma mensagem... (Enter para enviar)"
                  rows={1}
                  className="flex-1 resize-none rounded-lg px-3 py-2.5 text-sm disabled:opacity-50"
                  style={{
                    backgroundColor: '#111827',
                    border: '1px solid #1E293B',
                    color: '#E2E8F0',
                    outline: 'none',
                    maxHeight: 120,
                    minHeight: 40,
                    lineHeight: '1.5',
                  }}
                  onInput={(e) => {
                    e.target.style.height = 'auto'
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                  }}
                  onFocus={(e) => { e.target.style.borderColor = 'rgba(99,102,241,0.5)' }}
                  onBlur={(e) => { e.target.style.borderColor = '#1E293B' }}
                />
                <button
                  onClick={enviar}
                  disabled={enviando || !texto.trim()}
                  className="flex items-center justify-center rounded-lg transition-colors flex-shrink-0 disabled:opacity-50"
                  style={{ backgroundColor: 'rgba(99,102,241,0.2)', color: '#818cf8', minWidth: 40, minHeight: 40 }}
                  onMouseEnter={(e) => { if (!enviando) e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.35)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.2)' }}
                  title="Enviar (Enter)"
                >
                  {enviando
                    ? <span className="inline-block w-4 h-4 border border-indigo-400 border-t-transparent rounded-full animate-spin" />
                    : (
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                      </svg>
                    )
                  }
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {modalArquivos && (
        <div style={{ zIndex: 60 }}>
          <ModalArquivos
            arquivos={arquivos}
            loading={loadingArquivos}
            onSelecionar={enviarArquivoSelecionado}
            onClose={() => setModalArquivos(false)}
          />
        </div>
      )}
    </>
  )
}
