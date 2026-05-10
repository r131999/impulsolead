import { useEffect, useState, useCallback } from 'react'
import * as leadsApi from '../api/leads'
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
  const [modal, setModal] = useState(null) // { leadId, statusAtual }
  const [atualizando, setAtualizando] = useState(null) // leadId em progresso

  const carregar = useCallback(() => {
    leadsApi
      .listar({ limit: 300 })
      .then((res) => setGrupos(agrupar(res.data.leads)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { carregar() }, [carregar])

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
                    onAvancar={() => avancar(lead)}
                    onPerdido={() => abrirPerda(lead)}
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
    </div>
  )
}

function LeadCard({ lead, atualizando, onAvancar, onPerdido }) {
  const proximo = proximoStatus(lead.status)
  const podeAvancar = !!proximo
  const podePerdido = lead.status !== 'fechado' && lead.status !== 'perdido'

  return (
    <div
      className="rounded-lg p-3 transition-shadow"
      style={{
        backgroundColor: '#111827',
        border: '1px solid #1E293B',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        opacity: atualizando ? 0.6 : 1,
      }}
    >
      <p className="text-sm font-semibold truncate" style={{ color: '#F1F5F9' }}>{lead.nome}</p>
      <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{lead.telefone}</p>
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

      {(podeAvancar || podePerdido || lead.telefone) && (
        <div className="flex gap-1.5 mt-2.5 pt-2" style={{ borderTop: '1px solid #1E293B' }}>
          {podeAvancar && (
            <button
              onClick={onAvancar}
              disabled={atualizando}
              className="flex-1 text-xs font-medium py-1 rounded-md transition-colors disabled:opacity-50"
              style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: '#818cf8' }}
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
              className="text-xs font-medium px-2 py-1 rounded-md transition-colors disabled:opacity-50"
              style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: '#EF4444' }}
              onMouseEnter={(e) => { if (!atualizando) e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.22)' }}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.12)'}
            >
              Perdido
            </button>
          )}
          {lead.telefone && (
            <button
              onClick={() => {
                const d = lead.telefone.replace(/\D/g, '')
                const numero = d.startsWith('55') && d.length >= 12 ? d : `55${d}`
                window.open(`https://wa.me/${numero}`, '_blank')
              }}
              className="text-xs font-medium px-2 py-1 rounded-md transition-colors"
              style={{ backgroundColor: 'rgba(37,211,102,0.12)', color: '#25D366' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(37,211,102,0.22)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(37,211,102,0.12)'}
              title="Abrir WhatsApp"
            >
              💬
            </button>
          )}
        </div>
      )}
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
