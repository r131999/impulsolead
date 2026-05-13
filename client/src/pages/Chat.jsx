import { useState, useRef, useEffect } from 'react'
import { enviar } from '../api/chat'

const SUGESTOES = [
  'Quais imóveis estão disponíveis?',
  'Como abordar um cliente que está só pesquisando?',
  'Como responder um lead que pediu desconto?',
  'Quais são os lançamentos disponíveis?',
]

export default function Chat() {
  const [mensagens, setMensagens] = useState([])
  const [texto, setTexto] = useState('')
  const [carregando, setCarregando] = useState(false)
  const fimRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens, carregando])

  const enviarMensagem = async (msg) => {
    const texto = (msg || '').trim()
    if (!texto || carregando) return

    const novaMsgUsuario = { role: 'user', content: texto }
    setMensagens((prev) => [...prev, novaMsgUsuario])
    setTexto('')
    setCarregando(true)

    try {
      const res = await enviar(texto)
      setMensagens((prev) => [...prev, { role: 'assistant', content: res.data.resposta }])
    } catch (err) {
      const erroMsg = err.response?.data?.error || 'Erro ao conectar com a IA. Tente novamente.'
      setMensagens((prev) => [...prev, { role: 'assistant', content: erroMsg, erro: true }])
    } finally {
      setCarregando(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      enviarMensagem(texto)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-0px)]" style={{ backgroundColor: '#0B1120' }}>

      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid #1E293B', backgroundColor: '#111827' }}
      >
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8B5CF6)', color: '#fff' }}
        >
          IA
        </div>
        <div>
          <p className="font-semibold text-sm" style={{ color: '#F1F5F9' }}>Assistente IA</p>
          <p className="text-xs" style={{ color: '#64748B' }}>Especializado em imóveis e vendas</p>
        </div>
      </div>

      {/* Área de mensagens */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">

        {/* Estado inicial — sugestões */}
        {mensagens.length === 0 && !carregando && (
          <div className="flex flex-col items-center justify-center h-full gap-6 py-8">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold"
              style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))', border: '1px solid rgba(99,102,241,0.3)' }}
            >
              <SparklesIcon className="w-8 h-8" style={{ color: '#818cf8' }} />
            </div>
            <div className="text-center">
              <p className="font-semibold" style={{ color: '#F1F5F9' }}>Olá! Sou o Assistente IA</p>
              <p className="text-sm mt-1" style={{ color: '#64748B' }}>Pergunte sobre imóveis do catálogo ou peça dicas de vendas</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              {SUGESTOES.map((s) => (
                <button
                  key={s}
                  onClick={() => enviarMensagem(s)}
                  className="rounded-xl px-4 py-3 text-sm text-left transition-all hover:opacity-80"
                  style={{
                    backgroundColor: 'rgba(99,102,241,0.08)',
                    border: '1px solid rgba(99,102,241,0.2)',
                    color: '#818cf8',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Mensagens */}
        {mensagens.map((msg, i) => (
          <div
            key={i}
            className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold mb-0.5"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8B5CF6)', color: '#fff' }}
              >
                IA
              </div>
            )}
            <div
              className="rounded-2xl px-4 py-3 text-sm max-w-[75%] leading-relaxed whitespace-pre-wrap"
              style={
                msg.role === 'user'
                  ? { backgroundColor: '#4F46E5', color: '#fff', borderBottomRightRadius: '4px' }
                  : msg.erro
                  ? { backgroundColor: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)', color: '#FCA5A5', borderBottomLeftRadius: '4px' }
                  : { backgroundColor: '#1E293B', color: '#E2E8F0', borderBottomLeftRadius: '4px' }
              }
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* Spinner de carregamento */}
        {carregando && (
          <div className="flex items-end gap-2 justify-start">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold mb-0.5"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8B5CF6)', color: '#fff' }}
            >
              IA
            </div>
            <div
              className="rounded-2xl px-4 py-3 flex items-center gap-1.5"
              style={{ backgroundColor: '#1E293B', borderBottomLeftRadius: '4px' }}
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-2 h-2 rounded-full animate-bounce"
                  style={{ backgroundColor: '#64748B', animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}

        <div ref={fimRef} />
      </div>

      {/* Input */}
      <div
        className="flex-shrink-0 px-4 py-4"
        style={{ borderTop: '1px solid #1E293B', backgroundColor: '#111827' }}
      >
        <div
          className="flex items-end gap-2 rounded-2xl px-4 py-2"
          style={{ backgroundColor: '#1E293B', border: '1px solid #334155' }}
        >
          <textarea
            ref={inputRef}
            rows={1}
            className="flex-1 bg-transparent resize-none text-sm outline-none py-1.5"
            style={{ color: '#F1F5F9', maxHeight: '120px' }}
            placeholder="Digite sua pergunta..."
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
            }}
            onKeyDown={onKeyDown}
            disabled={carregando}
          />
          <button
            onClick={() => enviarMensagem(texto)}
            disabled={!texto.trim() || carregando}
            className="rounded-xl p-2 transition-all flex-shrink-0 mb-0.5"
            style={{
              backgroundColor: texto.trim() && !carregando ? '#4F46E5' : 'rgba(99,102,241,0.15)',
              color: texto.trim() && !carregando ? '#fff' : '#475569',
            }}
          >
            <SendIcon className="w-4 h-4" />
          </button>
        </div>
        <p className="text-center text-xs mt-2" style={{ color: '#334155' }}>
          Enter para enviar · Shift+Enter para quebrar linha
        </p>
      </div>
    </div>
  )
}

function SparklesIcon({ className, style }) {
  return (
    <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  )
}

function SendIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
    </svg>
  )
}
