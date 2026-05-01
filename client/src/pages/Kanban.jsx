import { useEffect, useState, useCallback } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import * as leadsApi from '../api/leads'

const COLUNAS = [
  { id: 'novo', label: 'Novo', cor: 'bg-blue-500' },
  { id: 'qualificado', label: 'Qualificado', cor: 'bg-purple-500' },
  { id: 'atendimento', label: 'Atendimento', cor: 'bg-yellow-500' },
  { id: 'visita', label: 'Visita', cor: 'bg-orange-500' },
  { id: 'proposta', label: 'Proposta', cor: 'bg-indigo-500' },
  { id: 'fechado', label: 'Fechado', cor: 'bg-green-500' },
  { id: 'perdido', label: 'Perdido', cor: 'bg-red-400' },
]

const URGENCIA_COR = {
  alta: 'text-red-600',
  media: 'text-yellow-600',
  baixa: 'text-green-600',
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

    // Atualização otimista
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  const totalLeads = Object.values(grupos).reduce((s, arr) => s + arr.length, 0)

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-200 bg-white flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-gray-900">Kanban</h1>
          <p className="text-gray-500 text-xs md:text-sm">{totalLeads} leads</p>
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
                  <span className={`w-2 h-2 rounded-full ${col.cor}`} />
                  <span className="text-sm font-semibold text-gray-700">{col.label}</span>
                  <span className="ml-auto text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                    {grupos[col.id].length}
                  </span>
                </div>

                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 rounded-xl p-2 space-y-2 overflow-y-auto transition-colors ${
                        snapshot.isDraggingOver ? 'bg-indigo-50 ring-2 ring-indigo-200' : 'bg-gray-100'
                      }`}
                      style={{ minHeight: 80 }}
                    >
                      {grupos[col.id].map((lead, index) => (
                        <Draggable key={lead.id} draggableId={lead.id} index={index}>
                          {(prov, snap) => (
                            <div
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              {...prov.dragHandleProps}
                              className={`bg-white rounded-lg p-3 shadow-sm border border-gray-100 cursor-grab select-none ${
                                snap.isDragging ? 'shadow-lg ring-2 ring-indigo-300' : ''
                              }`}
                            >
                              <p className="text-sm font-semibold text-gray-900 truncate">{lead.nome}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{lead.telefone}</p>
                              {lead.corretor && (
                                <p className="text-xs text-indigo-600 mt-1 truncate">
                                  👤 {lead.corretor.nome}
                                </p>
                              )}
                              <div className="flex gap-2 mt-2 flex-wrap">
                                {lead.urgencia && (
                                  <span className={`text-xs font-medium ${URGENCIA_COR[lead.urgencia] || ''}`}>
                                    ● {lead.urgencia}
                                  </span>
                                )}
                                {lead.regiao && (
                                  <span className="text-xs text-gray-400 truncate">{lead.regiao}</span>
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Motivo da perda</h2>
        <p className="text-sm text-gray-500 mb-4">Informe por que este lead foi perdido.</p>
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

