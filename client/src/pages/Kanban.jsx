import { useEffect, useState, useCallback } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import * as leadsApi from '../api/leads'

const COLUNAS = [
  { id: 'novo',        label: 'Novo',        cor: 'bg-blue-500',   dot: '#3B82F6' },
  { id: 'qualificado', label: 'Qualificado', cor: 'bg-purple-500', dot: '#8B5CF6' },
  { id: 'atendimento', label: 'Atendimento', cor: 'bg-yellow-500', dot: '#F59E0B' },
  { id: 'visita',      label: 'Visita',      cor: 'bg-orange-500', dot: '#f97316' },
  { id: 'proposta',    label: 'Proposta',    cor: 'bg-indigo-500', dot: '#6366f1' },
  { id: 'fechado',     label: 'Fechado',     cor: 'bg-green-500',  dot: '#10B981' },
  { id: 'perdido',     label: 'Perdido',     cor: 'bg-red-400',    dot: '#EF4444' },
]

const URGENCIA_COR = {
  alta: '#EF4444',
  media: '#F59E0B',
  baixa: '#10B981',
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
  const [grupos, setGrupos] = useState(() => agrupar([]))
  const [loading, setLoading] = useState(true)
  const [novoLeadStatus, setNovoLeadStatus] = useState(null)
  const [modal, setModal] = useState(null)

  const carregar = useCallback(() => {
    leadsApi
      .listar({ limit: 300 })
      .then((res) => setGrupos(agrupar(res.data.leads)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const onDragEnd = async (result) => {
    const { draggableId, source, destination } = result
    if (!destination || destination.droppableId === source.droppableId) return

    const novoStatus = destination.droppableId
    const leadId = draggableId

    setGrupos((prev) => {
      const next = { ...prev }
      const lead = prev[source.droppableId].find((l) => l.id === leadId)
      if (!lead) return prev
      next[source.droppableId] = prev[source.droppableId].filter((l) => l.id !== leadId)
      next[destination.droppableId] = [
        ...prev[destination.droppableId].slice(0, destination.index),
        { ...lead, status: novoStatus },
        ...prev[destination.droppableId].slice(destination.index),
      ]
      return next
    })

    if (novoStatus === 'perdido') {
      setModal({ leadId, statusAnterior: source.droppableId })
      return
    }

    try {
      await leadsApi.mudarStatus(leadId, { status: novoStatus })
    } catch {
      carregar()
    }
  }

  const confirmarPerda = async (motivoPerda) => {
    try {
      await leadsApi.mudarStatus(modal.leadId, { status: 'perdido', motivoPerda })
    } catch {
      carregar()
    } finally {
      setModal(null)
    }
  }

  const cancelarPerda = () => {
    carregar()
    setModal(null)
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
          <h1 className="text-lg md:text-xl font-bold" style={{ color: '#F1F5F9' }}>Kanban</h1>
          <p className="text-xs md:text-sm" style={{ color: '#94A3B8' }}>{totalLeads} leads</p>
        </div>
        <button onClick={carregar} className="btn-secondary text-xs">
          Atualizar
        </button>
      </div>

      <div className="flex-1 overflow-x-auto p-3 md:p-4">
        <DragDropContext onDragEnd={onDragEnd}>
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

                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="flex-1 rounded-xl p-2 space-y-2 overflow-y-auto transition-colors"
                      style={{
                        minHeight: 80,
                        backgroundColor: snapshot.isDraggingOver ? '#1a2332' : '#0B1120',
                        boxShadow: snapshot.isDraggingOver ? `inset 0 0 0 2px rgba(59,130,246,0.3)` : 'none',
                      }}
                    >
                      {grupos[col.id].map((lead, index) => (
                        <Draggable key={lead.id} draggableId={lead.id} index={index}>
                          {(prov, snap) => (
                            <div
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              {...prov.dragHandleProps}
                              className="rounded-lg p-3 cursor-grab select-none transition-shadow"
                              style={{
                                backgroundColor: '#111827',
                                border: snap.isDragging ? '1px solid #3B82F6' : '1px solid #1E293B',
                                boxShadow: snap.isDragging ? '0 8px 24px rgba(0,0,0,0.5)' : '0 1px 3px rgba(0,0,0,0.3)',
                              }}
                            >
                              <p className="text-sm font-semibold truncate" style={{ color: '#F1F5F9' }}>{lead.nome}</p>
                              <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{lead.telefone}</p>
                              {lead.corretor && (
                                <p className="text-xs mt-1 truncate" style={{ color: '#60A5FA' }}>
                                  👤 {lead.corretor.nome}
                                </p>
                              )}
                              <div className="flex gap-2 mt-2 flex-wrap">
                                {lead.urgencia && (
                                  <span
                                    className="text-xs font-medium"
                                    style={{ color: URGENCIA_COR[lead.urgencia] || '#94A3B8' }}
                                  >
                                    ● {lead.urgencia}
                                  </span>
                                )}
                                {lead.regiao && (
                                  <span className="text-xs truncate" style={{ color: '#64748B' }}>{lead.regiao}</span>
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>
      </div>

      {modal && <ModalPerda onConfirm={confirmarPerda} onCancel={cancelarPerda} />}
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
