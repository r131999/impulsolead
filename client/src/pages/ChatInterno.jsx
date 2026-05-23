import { useState, useEffect, useRef, useCallback } from 'react'
import * as chatApi from '../api/chat-interno'
import { Avatar } from '../components/Avatar'

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.25, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.25)
  } catch {}
}

function formatarHora(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function formatarDataCurta(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const hoje = new Date()
  if (d.toDateString() === hoje.toDateString()) return formatarHora(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export default function ChatInterno() {
  const [aberto, setAberto] = useState(false)
  const [tela, setTela] = useState('lista') // 'lista' | 'conversa' | 'nova'
  const [conversas, setConversas] = useState([])
  const [conversaAtiva, setConversaAtiva] = useState(null) // { id, outroParticipanteNome, outroParticipanteFoto, outroParticipanteId, outroParticipanteTipo }
  const [mensagens, setMensagens] = useState([])
  const [texto, setTexto] = useState('')
  const [contextoLead, setContextoLead] = useState(null) // { leadId, leadNome }
  const [naoLidas, setNaoLidas] = useState(0)
  const [participantes, setParticipantes] = useState([])
  const [enviando, setEnviando] = useState(false)
  const [carregandoMsgs, setCarregandoMsgs] = useState(false)

  const mensagensRef = useRef(null)
  const ultimaMsgIdRef = useRef(null)
  const inputRef = useRef(null)
  const pollingConversasRef = useRef(null)
  const pollingMensagensRef = useRef(null)

  const scrollParaBaixo = useCallback(() => {
    if (mensagensRef.current) {
      mensagensRef.current.scrollTop = mensagensRef.current.scrollHeight
    }
  }, [])

  const carregarConversas = useCallback(async () => {
    try {
      const res = await chatApi.listarConversas()
      setConversas(res.data.conversas)
    } catch {}
  }, [])

  const carregarNaoLidas = useCallback(async () => {
    try {
      const res = await chatApi.naoLidasTotal()
      setNaoLidas(res.data.total)
    } catch {}
  }, [])

  const carregarMensagens = useCallback(async (conversaId, silencioso = false) => {
    if (!silencioso) setCarregandoMsgs(true)
    try {
      const res = await chatApi.listarMensagens(conversaId)
      const novas = res.data.mensagens
      setMensagens((prev) => {
        const prevUltimaId = prev.length ? prev[prev.length - 1].id : null
        const novaUltimaId = novas.length ? novas[novas.length - 1].id : null
        if (prevUltimaId && novaUltimaId && novaUltimaId !== prevUltimaId) {
          // Nova mensagem chegou — verificar se não é própria
          const ultimaNova = novas[novas.length - 1]
          if (ultimaNova.id !== ultimaMsgIdRef.current) {
            beep()
          }
        }
        if (novas.length) ultimaMsgIdRef.current = novas[novas.length - 1].id
        return novas
      })
      if (!silencioso) setTimeout(scrollParaBaixo, 50)
    } catch {}
    if (!silencioso) setCarregandoMsgs(false)
  }, [scrollParaBaixo])

  // Polling de conversas quando painel aberto (5s)
  useEffect(() => {
    if (aberto && tela === 'lista') {
      carregarConversas()
      pollingConversasRef.current = setInterval(carregarConversas, 5000)
    }
    return () => clearInterval(pollingConversasRef.current)
  }, [aberto, tela, carregarConversas])

  // Polling de mensagens na conversa ativa (3s)
  useEffect(() => {
    if (aberto && tela === 'conversa' && conversaAtiva) {
      pollingMensagensRef.current = setInterval(() => {
        carregarMensagens(conversaAtiva.id, true)
        carregarNaoLidas()
      }, 3000)
    }
    return () => clearInterval(pollingMensagensRef.current)
  }, [aberto, tela, conversaAtiva, carregarMensagens, carregarNaoLidas])

  // Badge de não lidas — polling leve sempre ativo
  useEffect(() => {
    carregarNaoLidas()
    const id = setInterval(carregarNaoLidas, 10000)
    return () => clearInterval(id)
  }, [carregarNaoLidas])

  // Escuta evento do Kanban para abrir conversa com corretor
  useEffect(() => {
    const handler = async (e) => {
      const { destinatarioId, destinatarioTipo, leadId, leadNome } = e.detail
      setAberto(true)
      setContextoLead(leadId ? { leadId, leadNome } : null)
      try {
        const res = await chatApi.criarOuBuscarConversa({ destinatarioId, destinatarioTipo })
        const conversa = res.data.conversa
        await abrirConversa({
          id: conversa.id,
          outroParticipanteId: destinatarioId,
          outroParticipanteTipo: destinatarioTipo,
          outroParticipanteNome: e.detail.destinatarioNome || 'Corretor',
          outroParticipanteFoto: e.detail.destinatarioFoto || null,
        })
      } catch {}
    }
    window.addEventListener('abrir-chat-interno', handler)
    return () => window.removeEventListener('abrir-chat-interno', handler)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const abrirConversa = async (c) => {
    setConversaAtiva(c)
    setTela('conversa')
    ultimaMsgIdRef.current = null
    await carregarMensagens(c.id)
    await chatApi.marcarLidas(c.id)
    await carregarNaoLidas()
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const voltarParaLista = () => {
    setTela('lista')
    setConversaAtiva(null)
    setMensagens([])
    setContextoLead(null)
    clearInterval(pollingMensagensRef.current)
    carregarConversas()
    carregarNaoLidas()
  }

  const abrirNovaConversa = async () => {
    try {
      const res = await chatApi.listarParticipantes()
      setParticipantes(res.data.participantes)
      setTela('nova')
    } catch {}
  }

  const selecionarParticipante = async (p) => {
    try {
      const res = await chatApi.criarOuBuscarConversa({ destinatarioId: p.id, destinatarioTipo: p.tipo })
      const conversa = res.data.conversa
      await abrirConversa({
        id: conversa.id,
        outroParticipanteId: p.id,
        outroParticipanteTipo: p.tipo,
        outroParticipanteNome: p.nome,
        outroParticipanteFoto: p.fotoPerfil,
      })
    } catch {}
  }

  const enviar = async () => {
    if (!texto.trim() || enviando || !conversaAtiva) return
    setEnviando(true)
    const conteudo = texto.trim()
    setTexto('')
    try {
      const res = await chatApi.enviarMensagem(conversaAtiva.id, {
        conteudo,
        leadId: contextoLead?.leadId || undefined,
        leadNome: contextoLead?.leadNome || undefined,
      })
      const nova = res.data.mensagem
      ultimaMsgIdRef.current = nova.id
      setMensagens((prev) => [...prev, nova])
      setContextoLead(null)
      setTimeout(scrollParaBaixo, 50)
    } catch {}
    setEnviando(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      enviar()
    }
  }

  const togglePainel = () => {
    const next = !aberto
    setAberto(next)
    if (next && tela === 'lista') carregarConversas()
  }

  // Scroll ao carregar mensagens
  useEffect(() => {
    if (tela === 'conversa' && mensagens.length) scrollParaBaixo()
  }, [tela, scrollParaBaixo]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/* Botão flutuante */}
      <button
        onClick={togglePainel}
        title="Mensagens internas"
        className="chat-interno-fab"
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 52,
          height: 52,
          borderRadius: '50%',
          backgroundColor: '#4F46E5',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          boxShadow: '0 4px 16px rgba(79,70,229,0.5)',
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)' }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
        {naoLidas > 0 && (
          <span style={{
            position: 'absolute',
            top: -4,
            right: -4,
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: '#EF4444',
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
            border: '2px solid #0B1120',
          }}>
            {naoLidas > 99 ? '99+' : naoLidas}
          </span>
        )}
      </button>

      {/* Painel flutuante */}
      {aberto && (
        <div style={{
          position: 'fixed',
          bottom: 84,
          right: 24,
          width: 380,
          height: 520,
          borderRadius: 16,
          backgroundColor: '#111827',
          border: '1px solid #1E293B',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          zIndex: 99998,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        className="chat-interno-painel"
        >
          {tela === 'lista' && (
            <TelaLista
              conversas={conversas}
              onAbrirConversa={abrirConversa}
              onNovaConversa={abrirNovaConversa}
              onFechar={() => setAberto(false)}
            />
          )}
          {tela === 'conversa' && conversaAtiva && (
            <TelaConversa
              conversa={conversaAtiva}
              mensagens={mensagens}
              carregando={carregandoMsgs}
              texto={texto}
              setTexto={setTexto}
              contextoLead={contextoLead}
              setContextoLead={setContextoLead}
              enviando={enviando}
              onEnviar={enviar}
              onKeyDown={handleKeyDown}
              onVoltar={voltarParaLista}
              onFechar={() => setAberto(false)}
              mensagensRef={mensagensRef}
              inputRef={inputRef}
            />
          )}
          {tela === 'nova' && (
            <TelaNovaConversa
              participantes={participantes}
              onSelecionar={selecionarParticipante}
              onVoltar={() => setTela('lista')}
              onFechar={() => setAberto(false)}
            />
          )}
        </div>
      )}

      <style>{`
        @media (max-width: 480px) {
          .chat-interno-painel {
            bottom: 0 !important;
            right: 0 !important;
            width: 100vw !important;
            height: 90vh !important;
            border-radius: 16px 16px 0 0 !important;
          }
          .chat-interno-fab {
            bottom: 80px !important;
          }
        }
      `}</style>
    </>
  )
}

function TelaLista({ conversas, onAbrirConversa, onNovaConversa, onFechar }) {
  return (
    <>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #1E293B', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ color: '#F1F5F9', fontWeight: 700, fontSize: 15 }}>Mensagens</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onNovaConversa}
            style={{ fontSize: 12, padding: '5px 10px', borderRadius: 8, backgroundColor: 'rgba(99,102,241,0.15)', color: '#818cf8', border: 'none', cursor: 'pointer', fontWeight: 600 }}
          >
            + Nova
          </button>
          <button onClick={onFechar} style={{ color: '#64748B', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {conversas.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: '#64748B', fontSize: 13 }}>
            Nenhuma conversa ainda.<br />Clique em "+ Nova" para começar.
          </div>
        )}
        {conversas.map((c) => (
          <button
            key={c.id}
            onClick={() => onAbrirConversa(c)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              border: 'none',
              borderBottom: '1px solid rgba(30,41,59,0.6)',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background 0.1s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)' }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            <Avatar nome={c.outroParticipanteNome} fotoPerfil={c.outroParticipanteFoto} size={38} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#F1F5F9', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.outroParticipanteNome}
                </span>
                <span style={{ color: '#475569', fontSize: 11, flexShrink: 0, marginLeft: 4 }}>
                  {formatarDataCurta(c.ultimaMensagem?.criadoEm)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                <span style={{ color: '#64748B', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {c.ultimaMensagem?.conteudo || 'Sem mensagens'}
                </span>
                {c.naoLidas > 0 && (
                  <span style={{
                    minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#EF4444',
                    color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', padding: '0 4px',
                    flexShrink: 0, marginLeft: 6,
                  }}>
                    {c.naoLidas > 99 ? '99+' : c.naoLidas}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </>
  )
}

function TelaConversa({ conversa, mensagens, carregando, texto, setTexto, contextoLead, setContextoLead, enviando, onEnviar, onKeyDown, onVoltar, onFechar, mensagensRef, inputRef }) {
  // Precisamos saber o userId atual para identificar mensagens próprias
  // Usamos o localStorage via token decodificado ou simplesmente guardamos o remetenteId na primeira msg própria
  // Estratégia: msg é própria se remetenteTipo + id correspond ao usuário; como não temos o ID no front facilmente,
  // guardamos uma ref do último envio. Melhor: comparar com o remetenteNome do usuário atual via AuthContext.
  // Solução simples: o backend retorna as msgs com remetenteId; no frontend não temos o userId facilmente.
  // Vamos usar: a mensagem é própria se o remetenteId !== conversa.outroParticipanteId
  const ehPropria = (msg) => msg.remetenteId !== conversa.outroParticipanteId

  return (
    <>
      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #1E293B', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button
          onClick={onVoltar}
          style={{ color: '#64748B', background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '0 4px' }}
          title="Voltar"
        >
          ←
        </button>
        <Avatar nome={conversa.outroParticipanteNome} fotoPerfil={conversa.outroParticipanteFoto} size={34} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: '#F1F5F9', fontSize: 13, fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {conversa.outroParticipanteNome}
          </p>
          <p style={{ color: '#64748B', fontSize: 11, margin: 0, textTransform: 'capitalize' }}>
            {conversa.outroParticipanteTipo}
          </p>
        </div>
        <button onClick={onFechar} style={{ color: '#64748B', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
      </div>

      {/* Mensagens */}
      <div
        ref={mensagensRef}
        style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}
      >
        {carregando && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid transparent', borderTopColor: '#4F46E5', animation: 'spin 0.8s linear infinite' }} />
          </div>
        )}
        {!carregando && mensagens.length === 0 && (
          <div style={{ textAlign: 'center', color: '#475569', fontSize: 12, marginTop: 40 }}>
            Nenhuma mensagem ainda. Diga olá! 👋
          </div>
        )}
        {mensagens.map((msg) => {
          const propria = ehPropria(msg)
          return (
            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: propria ? 'flex-end' : 'flex-start' }}>
              {msg.leadNome && (
                <span style={{
                  fontSize: 11, color: '#60A5FA', marginBottom: 3,
                  backgroundColor: 'rgba(59,130,246,0.12)',
                  padding: '2px 8px', borderRadius: 8,
                }}>
                  📋 Lead: {msg.leadNome}
                </span>
              )}
              <div style={{
                maxWidth: '80%',
                padding: '8px 11px',
                borderRadius: propria ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                backgroundColor: propria ? 'rgba(99,102,241,0.22)' : '#1E293B',
                color: '#E2E8F0',
                fontSize: 13,
                lineHeight: 1.45,
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap',
              }}>
                {!propria && (
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#818cf8', margin: '0 0 3px 0' }}>
                    {msg.remetenteNome}
                  </p>
                )}
                {msg.conteudo}
              </div>
              <span style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>
                {formatarHora(msg.criadoEm)}
              </span>
            </div>
          )
        })}
      </div>

      {/* Contexto de lead ativo */}
      {contextoLead && (
        <div style={{ padding: '6px 14px', backgroundColor: 'rgba(59,130,246,0.1)', borderTop: '1px solid rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: '#60A5FA' }}>📋 Lead: <strong>{contextoLead.leadNome}</strong></span>
          <button
            onClick={() => setContextoLead(null)}
            style={{ color: '#64748B', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '10px 12px', borderTop: '1px solid #1E293B', display: 'flex', gap: 8, alignItems: 'flex-end', flexShrink: 0 }}>
        <textarea
          ref={inputRef}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Mensagem... (Enter para enviar)"
          rows={1}
          style={{
            flex: 1,
            resize: 'none',
            backgroundColor: '#0B1120',
            color: '#E2E8F0',
            border: '1px solid #1E293B',
            borderRadius: 10,
            padding: '9px 12px',
            fontSize: 13,
            outline: 'none',
            fontFamily: 'inherit',
            lineHeight: 1.4,
            maxHeight: 80,
            overflowY: 'auto',
          }}
        />
        <button
          onClick={onEnviar}
          disabled={enviando || !texto.trim()}
          title="Enviar"
          style={{
            width: 36, height: 36,
            borderRadius: 10,
            backgroundColor: texto.trim() ? '#4F46E5' : 'rgba(79,70,229,0.2)',
            color: texto.trim() ? '#fff' : '#4F46E5',
            border: 'none', cursor: texto.trim() ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, transition: 'all 0.15s',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  )
}

function TelaNovaConversa({ participantes, onSelecionar, onVoltar, onFechar }) {
  const [busca, setBusca] = useState('')

  const filtrados = participantes.filter((p) =>
    p.nome.toLowerCase().includes(busca.toLowerCase())
  )

  const label = (tipo) => {
    if (tipo === 'gestor') return 'Gestor'
    if (tipo === 'gerente') return 'Gerente'
    return 'Corretor'
  }

  return (
    <>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #1E293B', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button
          onClick={onVoltar}
          style={{ color: '#64748B', background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}
        >
          ←
        </button>
        <span style={{ color: '#F1F5F9', fontWeight: 700, fontSize: 14, flex: 1 }}>Nova conversa</span>
        <button onClick={onFechar} style={{ color: '#64748B', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
      </div>

      <div style={{ padding: '8px 14px', borderBottom: '1px solid #1E293B', flexShrink: 0 }}>
        <input
          autoFocus
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome..."
          style={{
            width: '100%', backgroundColor: '#0B1120', color: '#E2E8F0',
            border: '1px solid #1E293B', borderRadius: 8, padding: '7px 10px',
            fontSize: 13, outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtrados.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: '#64748B', fontSize: 13 }}>
            Nenhum usuário encontrado.
          </div>
        )}
        {filtrados.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelecionar(p)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', border: 'none', borderBottom: '1px solid rgba(30,41,59,0.6)',
              backgroundColor: 'transparent', cursor: 'pointer', textAlign: 'left',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)' }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            <Avatar nome={p.nome} fotoPerfil={p.fotoPerfil} size={36} />
            <div>
              <p style={{ color: '#F1F5F9', fontSize: 13, fontWeight: 600, margin: 0 }}>{p.nome}</p>
              <p style={{ color: '#64748B', fontSize: 11, margin: 0 }}>{label(p.tipo)}</p>
            </div>
          </button>
        ))}
      </div>
    </>
  )
}
