import { useEffect, useState, useCallback } from 'react'
import * as leadsApi from '../api/leads'
import * as followupsApi from '../api/followups'
import { useAuth } from '../context/AuthContext'

const COLUNAS = [
  { id: 'novo',        label: 'Novo',        dot: '#3B82F6' },
  { id: 'qualificado', label: 'Qualificado', dot: '#8B5CF6' },
  { id: 'atendimento', label: 'Atendimento', dot: '#F59E0B' },
  { id: 'visita',      label: 'Visita',      dot: '#f97316' },
  { id: 'proposta',    label: 'Proposta',    dot: '#6366f1' },
  { id: 'fechado',     label: 'Fechado',     dot: '#10B981' },
  { id: 'perdido',     label: 'Perdido',     dot: '#EF4444' },
]

const SEQUENCIA = ['novo', 'qualificado', 'atendimento', 'visita', 'proposta', 'fechado']

const URGENCIA_COR = {
  alta: '#EF4444',
  media: '#F59E0B',
  baixa: '#10B981',
}

function tempoNaEtapa(atualizadoEm) {
  const diffMs = Date.now() - new Date(atualizadoEm).getTime()
  const h = diffMs / 3600000
  if (h < 24) {
    const horas = Math.max(1, Math.floor(h))
    return { texto: `${horas}h na etapa`, cor: '#10B981' }
  }
  const dias = Math.floor(h / 24)
  if (dias <= 3) return { texto: `${dias} dia${dias > 1 ? 's' : ''} na etapa`, cor: '#F59E0B' }
  if (dias < 14) return { texto: `${dias} dias na etapa`, cor: '#EF4444' }
  const semanas = Math.floor(dias / 7)
  return { texto: `${semanas} semana${semanas > 1 ? 's' : ''} na etapa`, cor: '#EF4444' }
}

function toInputDateTime(iso) {
  const d = new Date(iso)
  const offset = d.getTimezoneOffset()
  const local = new Date(d.getTime() - offset * 60000)
  return local.toISOString().slice(0, 16)
}

function defaultDataHora() {
  const d = new Date()
  d.setMinutes(0, 0, 0)
  d.setHours(d.getHours() + 1)
  return toInputDateTime(d.toISOString())
}

function formatarFollowUp(dataHora) {
  const now = new Date()
  const d = new Date(dataHora)
  const hojeInicio = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const amanha = new Date(hojeInicio.getTime() + 86400000)
  const dDia = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (d < now) return { texto: `📅 Vencido ${hora}`, cor: '#EF4444' }
  if (dDia.getTime() === hojeInicio.getTime()) return { texto: `📅 Hoje ${hora}`, cor: '#F59E0B' }
  if (dDia.getTime() === amanha.getTime()) return { texto: `📅 Amanhã ${hora}`, cor: '#60A5FA' }
  const data = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  return { texto: `📅 ${data} ${hora}`, cor: '#60A5FA' }
}

function proximoStatus(status) {
  const idx = SEQUENCIA.indexOf(status)
  return idx >= 0 && idx < SEQUENCIA.length - 1 ? SEQUENCIA[idx + 1] : null
}

function agrupar(leads) {
  const grupos = {}
  COLUNAS.forEach((c) => (grupos[c.id] = []))
  leads.forEach((l) => {
    if (grupos[l.status]) grupos[l.status].push(l)
  })
  return grupos
}

export default function Kanban() {
  const { isCorretor, isGerente } = useAuth()
  const [grupos, setGrupos] = useState(() => agrupar([]))
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [atualizando, setAtualizando] = useState(null)
  const [followUpsMap, setFollowUpsMap] = useState({})
  const [modalFU, setModalFU] = useState(null) // { lead, followUp? }
  const [modalConversa, setModalConversa] = useState(null) // lead

  const carregar = useCallback(() => {
    leadsApi
      .listar({ limit: 300 })
      .then((res) => setGrupos(agrupar(res.data.leads)))
      .finally(() => setLoading(false))
  }, [])

  const carregarFollowUps = useCallback(() => {
    followupsApi.pendentes()
      .then((res) => {
        const map = {}
        res.data.followUps.forEach((f) => { map[f.leadId] = f })
        setFollowUpsMap(map)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    carregar()
    carregarFollowUps()
  }, [carregar, carregarFollowUps])

  const avancar = async (lead) => {
    const proximo = proximoStatus(lead.status)
    if (!proximo) return
    setAtualizando(lead.id)
    try {
      await leadsApi.mudarStatus(lead.id, { status: proximo })
      carregar()
    } finally {
      setAtualizando(null)
    }
  }

  const abrirPerda = (lead) => {
    setModal({ leadId: lead.id, statusAtual: lead.status })
  }

  const confirmarPerda = async (motivoPerda) => {
    setAtualizando(modal.leadId)
    try {
      await leadsApi.mudarStatus(modal.leadId, { status: 'perdido', motivoPerda })
      carregar()
    } finally {
      setModal(null)
      setAtualizando(null)
    }
  }

  const salvarFollowUp = async ({ dataHora, observacao }) => {
    const { lead, followUp } = modalFU
    if (followUp) {
      await followupsApi.atualizar(followUp.id, { dataHora, observacao })
    } else {
      await followupsApi.criar(lead.id, { dataHora, observacao })
    }
    carregarFollowUps()
    setModalFU(null)
  }

  const realizarFollowUp = async () => {
    await followupsApi.atualizar(modalFU.followUp.id, { status: 'realizado' })
    carregarFollowUps()
    setModalFU(null)
  }

  const excluirFollowUp = async () => {
    await followupsApi.remover(modalFU.followUp.id)
    carregarFollowUps()
    setModalFU(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    )
  }

  const totalLeads = Object.values(grupos).reduce((s, arr) => s + arr.length, 0)

  return (
    <div className="flex flex-col h-full">
      <div
        className="px-4 py-3 md:px-6 md:py-4 flex items-center justify-between flex-shrink-0"
        style={{ borderBottom: '1px solid #1E293B', backgroundColor: '#111827' }}
      >
        <div>
          <h1 className="text-lg md:text-xl font-bold" style={{ color: '#F1F5F9' }}>
            {isGerente ? 'Leads da Equipe' : isCorretor ? 'Meus Leads' : 'Kanban'}
          </h1>
          <p className="text-xs md:text-sm" style={{ color: '#94A3B8' }}>{totalLeads} leads</p>
        </div>
        <button onClick={carregar} className="btn-secondary text-xs">
          Atualizar
        </button>
      </div>

      <div className="flex-1 overflow-x-auto p-3 md:p-4">
        <div className="flex gap-3 h-full" style={{ minWidth: `${COLUNAS.length * 220}px` }}>
          {COLUNAS.map((col) => (
            <div key={col.id} className="flex flex-col w-52 md:w-56 flex-shrink-0">
              <div className="flex items-center gap-2 mb-2 px-1">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: col.dot }} />
                <span className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>{col.label}</span>
                <span
                  className="ml-auto text-xs rounded-full px-2 py-0.5"
                  style={{ color: '#64748B', backgroundColor: '#1E293B' }}
                >
                  {grupos[col.id].length}
                </span>
              </div>

              <div
                className="flex-1 rounded-xl p-2 space-y-2 overflow-y-auto"
                style={{ minHeight: 80, backgroundColor: '#0B1120' }}
              >
                {grupos[col.id].map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    atualizando={atualizando === lead.id}
                    followUp={followUpsMap[lead.id] || null}
                    onAvancar={() => avancar(lead)}
                    onPerdido={() => abrirPerda(lead)}
                    onFollowUp={() => setModalFU({ lead, followUp: followUpsMap[lead.id] || null })}
                    onConversa={lead.temConversa ? () => setModalConversa(lead) : null}
                  />
                ))}
                {grupos[col.id].length === 0 && (
                  <div
                    className="flex items-center justify-center h-16 rounded-lg text-xs"
                    style={{ color: '#64748B', border: '1px dashed #1E293B' }}
                  >
                    vazio
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {modal && (
        <ModalPerda
          onConfirm={confirmarPerda}
          onCancel={() => setModal(null)}
        />
      )}

      {modalFU && (
        <ModalFollowUp
          lead={modalFU.lead}
          followUp={modalFU.followUp}
          onSalvar={salvarFollowUp}
          onRealizar={realizarFollowUp}
          onRemover={excluirFollowUp}
          onClose={() => setModalFU(null)}
        />
      )}

      {modalConversa && (
        <ModalConversa lead={modalConversa} onClose={() => setModalConversa(null)} />
      )}
    </div>
  )
}

function LeadCard({ lead, atualizando, followUp, onAvancar, onPerdido, onFollowUp, onConversa }) {
  const proximo = proximoStatus(lead.status)
  const podeAvancar = !!proximo
  const podePerdido = lead.status !== 'fechado' && lead.status !== 'perdido'
  const tempo = lead.atualizadoEm ? tempoNaEtapa(lead.atualizadoEm) : null
  const fuInfo = followUp ? formatarFollowUp(followUp.dataHora) : null

  return (
    <div
      className="rounded-lg p-3 transition-shadow"
      style={{
        backgroundColor: '#111827',
        border: fuInfo?.cor === '#EF4444' ? '1px solid rgba(239,68,68,0.35)' : '1px solid #1E293B',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        opacity: atualizando ? 0.6 : 1,
      }}
    >
      <div className="flex items-start justify-between gap-1">
        <p className="text-sm font-semibold truncate" style={{ color: '#F1F5F9' }}>{lead.nome}</p>
        {onConversa && (
          <button
            onClick={onConversa}
            className="flex-shrink-0 text-sm leading-none flex items-center justify-center rounded transition-colors"
            style={{ color: '#64748B', minWidth: 36, minHeight: 36 }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#94A3B8'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#64748B'; e.currentTarget.style.backgroundColor = 'transparent' }}
            title="Ver conversa com agente"
          >
            💬
          </button>
        )}
      </div>
      <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{lead.telefone}</p>
      {tempo && (
        <p className="text-xs mt-1" style={{ color: tempo.cor }}>
          ⏱ {tempo.texto}
        </p>
      )}
      {fuInfo && (
        <p className="text-xs mt-1 font-medium" style={{ color: fuInfo.cor }}>{fuInfo.texto}</p>
      )}
      {lead.corretor && (
        <p className="text-xs mt-1 truncate" style={{ color: '#60A5FA' }}>
          👤 {lead.corretor.nome}
        </p>
      )}
      {(lead.urgencia || lead.regiao) && (
        <div className="flex gap-2 mt-1.5 flex-wrap">
          {lead.urgencia && (
            <span className="text-xs font-medium" style={{ color: URGENCIA_COR[lead.urgencia] || '#94A3B8' }}>
              ● {lead.urgencia}
            </span>
          )}
          {lead.regiao && (
            <span className="text-xs truncate" style={{ color: '#64748B' }}>{lead.regiao}</span>
          )}
        </div>
      )}

      <div className="mt-2.5 pt-2" style={{ borderTop: '1px solid #1E293B' }}>
        {(podeAvancar || podePerdido) && (
          <div className="flex gap-1.5 mb-1.5">
            {podeAvancar && (
              <button
                onClick={onAvancar}
                disabled={atualizando}
                className="flex-1 text-xs font-medium rounded-md transition-colors disabled:opacity-50 flex items-center justify-center"
                style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: '#818cf8', minHeight: 36 }}
                onMouseEnter={(e) => { if (!atualizando) e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.25)' }}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.15)'}
              >
                → Avançar
              </button>
            )}
            {podePerdido && (
              <button
                onClick={onPerdido}
                disabled={atualizando}
                className="text-xs font-medium px-2.5 rounded-md transition-colors disabled:opacity-50 flex items-center justify-center"
                style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: '#EF4444', minHeight: 36 }}
                onMouseEnter={(e) => { if (!atualizando) e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.22)' }}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.12)'}
              >
                Perdido
              </button>
            )}
          </div>
        )}
        <div className="flex gap-1.5">
          {lead.telefone && (
            <button
              onClick={() => {
                const d = lead.telefone.replace(/\D/g, '')
                const numero = d.startsWith('55') && d.length >= 12 ? d : `55${d}`
                window.open(`https://wa.me/${numero}`, '_blank')
              }}
              className="flex-1 flex items-center justify-center rounded-md transition-colors"
              style={{ backgroundColor: 'rgba(37,211,102,0.12)', color: '#25D366', minHeight: 36 }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(37,211,102,0.22)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(37,211,102,0.12)'}
              title="Abrir WhatsApp"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </button>
          )}
          <button
            onClick={onFollowUp}
            className="flex-1 flex items-center justify-center text-sm rounded-md transition-colors"
            style={{
              backgroundColor: followUp ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.08)',
              color: followUp ? '#818cf8' : '#64748B',
              minHeight: 36,
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.25)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = followUp ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.08)'}
            title={followUp ? 'Ver follow-up agendado' : 'Agendar follow-up'}
          >
            📅
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalConversa({ lead, onClose }) {
  const [conversa, setConversa] = useState(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    leadsApi.getHistoricoConversa(lead.id)
      .then((res) => setConversa(res.data.historico))
      .catch(() => setErro('Erro ao carregar conversa'))
      .finally(() => setLoading(false))
  }, [lead.id])

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div
        className="rounded-2xl shadow-2xl w-full max-w-lg flex flex-col"
        style={{ backgroundColor: '#111827', border: '1px solid #1E293B', maxHeight: '85vh' }}
      >
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid #1E293B' }}
        >
          <div>
            <h2 className="font-bold" style={{ color: '#F1F5F9' }}>💬 Conversa com agente</h2>
            <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{lead.nome}</p>
          </div>
          <button onClick={onClose} className="text-lg leading-none ml-4" style={{ color: '#64748B' }}>✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500" />
            </div>
          )}
          {erro && (
            <p className="text-sm text-center py-10" style={{ color: '#EF4444' }}>{erro}</p>
          )}
          {!loading && !erro && (!conversa || conversa.length === 0) && (
            <p className="text-sm text-center py-10" style={{ color: '#64748B' }}>Nenhuma conversa registrada.</p>
          )}
          {!loading && conversa && conversa.map((msg, i) => (
            <MensagemBubble key={i} msg={msg} />
          ))}
        </div>
      </div>
    </div>
  )
}

function MensagemBubble({ msg }) {
  const isLia = ['lia', 'assistant', 'bot', 'agent'].includes(String(msg.role).toLowerCase())
  const texto = msg.texto || msg.text || msg.content || msg.mensagem || ''
  const ts = msg.ts || msg.timestamp || msg.criadoEm || null
  const hora = ts ? new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : null

  return (
    <div className={`flex ${isLia ? 'justify-start' : 'justify-end'}`}>
      <div style={{ maxWidth: '82%' }}>
        {isLia && (
          <div className="flex items-center gap-1.5 mb-1">
            <span
              className="flex items-center justify-center w-5 h-5 rounded-full font-bold flex-shrink-0"
              style={{ backgroundColor: 'rgba(139,92,246,0.3)', color: '#A78BFA', fontSize: 10 }}
            >
              L
            </span>
            <span className="text-xs font-semibold" style={{ color: '#8B5CF6' }}>Lia</span>
          </div>
        )}
        <div
          className="px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words"
          style={{
            backgroundColor: isLia ? 'rgba(139,92,246,0.13)' : 'rgba(59,130,246,0.13)',
            color: '#E2E8F0',
            borderRadius: isLia ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
          }}
        >
          {texto}
        </div>
        {hora && (
          <p
            className={`text-xs mt-1 ${isLia ? 'text-left' : 'text-right'}`}
            style={{ color: '#475569' }}
          >
            {hora}
          </p>
        )}
      </div>
    </div>
  )
}

function ModalFollowUp({ lead, followUp, onSalvar, onRealizar, onRemover, onClose }) {
  const [dataHora, setDataHora] = useState(
    followUp ? toInputDateTime(followUp.dataHora) : defaultDataHora()
  )
  const [observacao, setObservacao] = useState(followUp?.observacao || '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const handleSalvar = async () => {
    if (!dataHora) return setErro('Selecione data e hora')
    setSalvando(true)
    setErro('')
    try {
      await onSalvar({ dataHora: new Date(dataHora).toISOString(), observacao: observacao.trim() })
    } catch (e) {
      setErro(e.response?.data?.error || 'Erro ao salvar')
      setSalvando(false)
    }
  }

  const handleRealizar = async () => {
    setSalvando(true)
    try { await onRealizar() } catch { setSalvando(false) }
  }

  const handleRemover = async () => {
    setSalvando(true)
    try { await onRemover() } catch { setSalvando(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="rounded-2xl shadow-2xl p-6 w-full max-w-sm" style={{ backgroundColor: '#111827', border: '1px solid #1E293B' }}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold" style={{ color: '#F1F5F9' }}>
              {followUp ? 'Follow-up agendado' : 'Agendar follow-up'}
            </h2>
            <p className="text-sm mt-0.5" style={{ color: '#94A3B8' }}>{lead.nome}</p>
          </div>
          <button
            onClick={onClose}
            className="text-lg leading-none ml-4 flex-shrink-0"
            style={{ color: '#64748B' }}
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: '#94A3B8' }}>Data e hora</label>
            <input
              type="datetime-local"
              className="input"
              value={dataHora}
              onChange={(e) => setDataHora(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: '#94A3B8' }}>Observação (opcional)</label>
            <textarea
              className="input resize-none"
              rows={2}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="O que vai falar com o lead?"
            />
          </div>
        </div>

        {erro && <p className="text-xs mt-2" style={{ color: '#EF4444' }}>{erro}</p>}

        <div className="flex gap-2 mt-4">
          {followUp && (
            <>
              <button
                onClick={handleRealizar}
                disabled={salvando}
                className="flex-1 text-xs font-medium py-2 rounded-lg disabled:opacity-50 transition-colors"
                style={{ backgroundColor: 'rgba(16,185,129,0.15)', color: '#10B981' }}
              >
                ✓ Realizado
              </button>
              <button
                onClick={handleRemover}
                disabled={salvando}
                className="text-xs font-medium px-3 py-2 rounded-lg disabled:opacity-50 transition-colors"
                style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: '#EF4444' }}
              >
                Excluir
              </button>
            </>
          )}
          <button
            onClick={handleSalvar}
            disabled={salvando || !dataHora}
            className="flex-1 text-xs font-medium py-2 rounded-lg disabled:opacity-50 transition-colors"
            style={{ backgroundColor: 'rgba(99,102,241,0.2)', color: '#818cf8' }}
          >
            {salvando ? 'Salvando...' : followUp ? 'Reagendar' : 'Agendar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalPerda({ onConfirm, onCancel }) {
  const [motivo, setMotivo] = useState('')

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="rounded-2xl shadow-2xl p-6 w-full max-w-sm" style={{ backgroundColor: '#111827', border: '1px solid #1E293B' }}>
        <h2 className="text-lg font-bold mb-1" style={{ color: '#F1F5F9' }}>Motivo da perda</h2>
        <p className="text-sm mb-4" style={{ color: '#94A3B8' }}>Informe por que este lead foi perdido.</p>
        <textarea
          className="input resize-none"
          rows={3}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ex: cliente desistiu, fora do orçamento..."
          autoFocus
        />
        <div className="flex gap-2 mt-4">
          <button onClick={onCancel} className="btn-secondary flex-1">Cancelar</button>
          <button
            onClick={() => motivo.trim() && onConfirm(motivo)}
            disabled={!motivo.trim()}
            className="btn-danger flex-1"
          >
            Confirmar perda
          </button>
        </div>
      </div>
    </div>
  )
}
