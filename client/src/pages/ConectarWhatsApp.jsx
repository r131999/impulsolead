import { useEffect, useRef, useState } from 'react'
import QRCode from 'react-qr-code'
import { getStatusWhatsapp, conectarWhatsapp, deletarSessaoWhats } from '../api/whatsapp'
import { getConfig, atualizarConfig } from '../api/config'

const STATUS_LABEL = {
  conectado:     { txt: 'Conectado',        cor: '#10B981' },
  aguardando_qr: { txt: 'Aguardando QR',    cor: '#F59E0B' },
  conectando:    { txt: 'Conectando…',      cor: '#6366F1' },
  desconectado:  { txt: 'Desconectado',     cor: '#EF4444' },
}

export default function ConectarWhatsApp() {
  const [status, setStatus]         = useState(null)
  const [qrCode, setQrCode]         = useState(null)
  const [carregando, setCarregando]  = useState(true)
  const [acao, setAcao]             = useState(null)   // 'conectando' | 'desconectando'
  const [erro, setErro]             = useState(null)
  const [mensagemBV, setMensagemBV]  = useState('')
  const [salvando, setSalvando]     = useState(false)
  const [salvoOk, setSalvoOk]       = useState(false)
  const pollingRef                  = useRef(null)

  // ── Carregar status inicial e mensagem de boas-vindas ────────────────────
  useEffect(() => {
    carregarStatus()
    getConfig().then(({ data }) => {
      setMensagemBV(data.config?.mensagemBoasVindas || '')
    }).catch(() => {})
    return () => pararPolling()
  }, [])

  async function carregarStatus() {
    try {
      const { data } = await getStatusWhatsapp()
      setStatus(data.status)
      setQrCode(data.qrCode || null)

      if (data.status === 'aguardando_qr' || data.status === 'conectando') {
        iniciarPolling()
      }
    } catch {
      setStatus('desconectado')
    } finally {
      setCarregando(false)
    }
  }

  // ── Polling até conectar ou desconectar ───────────────────────────────────
  function iniciarPolling() {
    pararPolling()
    pollingRef.current = setInterval(async () => {
      try {
        const { data } = await getStatusWhatsapp()
        setStatus(data.status)
        setQrCode(data.qrCode || null)

        if (data.status === 'conectado' || data.status === 'desconectado') {
          pararPolling()
          setAcao(null)
        }
      } catch {}
    }, 2500)
  }

  function pararPolling() {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }

  // ── Conectar ──────────────────────────────────────────────────────────────
  async function handleConectar() {
    setErro(null)
    setAcao('conectando')
    try {
      await conectarWhatsapp()
      iniciarPolling()
    } catch (e) {
      setErro(e.response?.data?.error || 'Erro ao iniciar conexão.')
      setAcao(null)
    }
  }

  // ── Salvar mensagem de boas-vindas ────────────────────────────────────────
  async function handleSalvarBV() {
    setSalvando(true)
    setSalvoOk(false)
    try {
      await atualizarConfig({ mensagemBoasVindas: mensagemBV })
      setSalvoOk(true)
      setTimeout(() => setSalvoOk(false), 3000)
    } catch {
      // silencia — o erro visual não é crítico aqui
    } finally {
      setSalvando(false)
    }
  }

  // ── Desconectar ───────────────────────────────────────────────────────────
  async function handleDesconectar() {
    if (!window.confirm('Desconectar o WhatsApp? Você precisará escanear o QR novamente para reconectar.')) return
    setErro(null)
    setAcao('desconectando')
    pararPolling()
    try {
      await deletarSessaoWhats()
      setStatus('desconectado')
      setQrCode(null)
    } catch (e) {
      setErro(e.response?.data?.error || 'Erro ao desconectar.')
    } finally {
      setAcao(null)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const info = STATUS_LABEL[status] ?? STATUS_LABEL.desconectado
  const conectado    = status === 'conectado'
  const aguardandoQr = status === 'aguardando_qr'
  const ocupado      = !!acao

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
          <WhatsAppIcon />
          <h1 className="text-xl font-bold" style={{ color: '#F1F5F9' }}>
            WhatsApp
          </h1>
        </div>
        <p className="text-sm" style={{ color: '#94A3B8' }}>
          Gerencie a conexão do WhatsApp para receber e responder leads em tempo real.
        </p>
      </div>

      {/* Card: status + ações */}
      <div className="card mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium mb-1" style={{ color: '#64748B' }}>STATUS</p>
            <div className="flex items-center gap-2">
              <span
                className="inline-block rounded-full"
                style={{ width: 8, height: 8, backgroundColor: info.cor, flexShrink: 0 }}
              />
              <span className="text-sm font-semibold" style={{ color: info.cor }}>
                {info.txt}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            {!conectado && (
              <button
                onClick={handleConectar}
                disabled={ocupado}
                className="btn-primary text-sm"
              >
                {acao === 'conectando' ? 'Iniciando…' : 'Conectar'}
              </button>
            )}
            {conectado && (
              <button
                onClick={handleDesconectar}
                disabled={ocupado}
                className="text-sm px-4 py-2 rounded-lg font-medium transition-colors"
                style={{
                  backgroundColor: 'rgba(239,68,68,0.12)',
                  color: '#F87171',
                  border: '1px solid rgba(239,68,68,0.25)',
                  opacity: ocupado ? 0.5 : 1,
                }}
              >
                {acao === 'desconectando' ? 'Desconectando…' : 'Desconectar'}
              </button>
            )}
          </div>
        </div>

        {conectado && (
          <div
            className="mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
            style={{ backgroundColor: 'rgba(16,185,129,0.08)', color: '#10B981' }}
          >
            <CheckIcon />
            WhatsApp conectado. Mensagens e leads estão sendo recebidos normalmente.
          </div>
        )}
      </div>

      {/* Card: QR Code */}
      {aguardandoQr && (
        <div className="card text-center">
          <p className="font-semibold mb-1" style={{ color: '#F1F5F9' }}>
            Escaneie o QR Code
          </p>
          <p className="text-xs mb-5" style={{ color: '#94A3B8' }}>
            Abra o WhatsApp no celular → Dispositivos conectados → Conectar dispositivo
          </p>

          {qrCode ? (
            <div
              className="inline-flex p-4 rounded-xl mx-auto"
              style={{ backgroundColor: '#FFFFFF' }}
            >
              <QRCode value={qrCode} size={220} />
            </div>
          ) : (
            <div className="flex items-center justify-center" style={{ height: 220 }}>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
            </div>
          )}

          <p className="text-xs mt-4" style={{ color: '#64748B' }}>
            O código é atualizado automaticamente. Aguarde após escanear.
          </p>
        </div>
      )}

      {/* Card: mensagem de boas-vindas */}
      <div className="card mb-4">
        <label className="block text-xs font-medium mb-2" style={{ color: '#64748B' }}>
          MENSAGEM DE BOAS-VINDAS
        </label>
        <textarea
          rows={3}
          value={mensagemBV}
          onChange={(e) => setMensagemBV(e.target.value)}
          className="w-full rounded-lg px-3 py-2 text-sm resize-none"
          style={{
            backgroundColor: 'rgba(255,255,255,0.05)',
            color: '#F1F5F9',
            border: '1px solid rgba(255,255,255,0.1)',
            outline: 'none',
          }}
        />
        <div className="flex items-center justify-end gap-3 mt-3">
          {salvoOk && (
            <span className="text-xs" style={{ color: '#10B981' }}>Salvo!</span>
          )}
          <button
            onClick={handleSalvarBV}
            disabled={salvando}
            className="btn-primary text-sm"
          >
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* Card: instruções quando desconectado */}
      {status === 'desconectado' && (
        <div className="card">
          <p className="text-sm font-semibold mb-3" style={{ color: '#F1F5F9' }}>
            Como conectar
          </p>
          <ol className="space-y-2">
            {[
              'Clique em "Conectar" acima.',
              'Abra o WhatsApp no celular.',
              'Toque em Dispositivos conectados → Conectar dispositivo.',
              'Escaneie o QR Code que aparecerá aqui.',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm" style={{ color: '#94A3B8' }}>
                <span
                  className="flex-shrink-0 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ width: 20, height: 20, backgroundColor: 'rgba(99,102,241,0.2)', color: '#818cf8' }}
                >
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Erro */}
      {erro && (
        <div
          className="mt-4 rounded-lg px-4 py-3 text-sm"
          style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          {erro}
        </div>
      )}
    </div>
  )
}

// ── Ícones inline ──────────────────────────────────────────────────────────────
function WhatsAppIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="6" fill="#25D366" />
      <path
        d="M12 4.5C7.86 4.5 4.5 7.86 4.5 12c0 1.37.36 2.65.99 3.76L4.5 19.5l3.82-.98A7.46 7.46 0 0012 19.5c4.14 0 7.5-3.36 7.5-7.5S16.14 4.5 12 4.5zm0 13.5c-1.19 0-2.3-.31-3.26-.85l-.23-.14-2.27.59.61-2.21-.15-.24A6 6 0 016 12c0-3.31 2.69-6 6-6s6 2.69 6 6-2.69 6-6 6zm3.29-4.49c-.18-.09-1.06-.52-1.22-.58-.16-.06-.28-.09-.4.09s-.46.58-.56.7c-.1.12-.21.13-.39.04a4.85 4.85 0 01-1.43-.88 5.37 5.37 0 01-.99-1.23c-.1-.18-.01-.28.08-.37.08-.08.18-.21.27-.31.09-.1.12-.18.18-.3.06-.12.03-.22-.01-.31-.04-.09-.4-.96-.55-1.31-.14-.34-.29-.29-.4-.3h-.34c-.12 0-.31.04-.47.22-.16.18-.62.6-.62 1.47s.63 1.7.72 1.82c.09.12 1.25 1.9 3.02 2.66.42.18.75.29 1.01.37.42.13.81.11 1.11.07.34-.05 1.06-.43 1.21-.85.15-.42.15-.78.1-.85-.04-.08-.16-.12-.34-.21z"
        fill="white"
      />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} flexShrink={0}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}
