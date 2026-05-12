import { useEffect, useState, useCallback } from 'react'
import * as leadsApi from '../api/leads'
import * as corretoresApi from '../api/corretores'
import ContatosImportados from './ContatosImportados'

const STATUS_BADGE_STYLE = {
  lead:        { color: '#60A5FA',  bg: 'rgba(59,130,246,0.15)' },
  atendimento: { color: '#818cf8',  bg: 'rgba(99,102,241,0.15)' },
  agendamento: { color: '#A78BFA',  bg: 'rgba(139,92,246,0.15)' },
  visita:      { color: '#F59E0B',  bg: 'rgba(245,158,11,0.15)' },
  proposta:    { color: '#fb923c',  bg: 'rgba(249,115,22,0.15)' },
  venda:       { color: '#10B981',  bg: 'rgba(16,185,129,0.15)' },
  perdido:     { color: '#EF4444',  bg: 'rgba(239,68,68,0.15)' },
}

const STATUS_LIST = ['lead', 'atendimento', 'agendamento', 'visita', 'proposta', 'venda', 'perdido']

const FORM_VAZIO = {
  nome: '', telefone: '', corretorId: '', observacoes: '',
  urgencia: '', regiao: '', faixaValor: '', primeiroImovel: '',
  tipoRenda: '', rendaMensal: '', restricaoCpf: '', valorEntrada: '',
}

export default function Leads() {
  const [aba, setAba] = useState('leads')
  const [leads, setLeads] = useState([])
  const [total, setTotal] = useState(0)
  const [corretores, setCorretores] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtros, setFiltros] = useState({ status: '', busca: '', page: 1 })
  const [modal, setModal] = useState(null)
  const [leadSelecionado, setLeadSelecionado] = useState(null)
  const [form, setForm] = useState(FORM_VAZIO)
  const [statusForm, setStatusForm] = useState({ status: '', observacao: '', motivoPerda: '' })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const carregar = useCallback(() => {
    const params = { page: filtros.page, limit: 30 }
    if (filtros.status) params.status = filtros.status
    if (filtros.busca) params.busca = filtros.busca
    leadsApi
      .listar(params)
      .then((res) => {
        setLeads(res.data.leads)
        setTotal(res.data.total)
      })
      .finally(() => setLoading(false))
  }, [filtros])

  useEffect(() => { carregar() }, [carregar])

  useEffect(() => {
    corretoresApi.listar({ ativo: true }).then((res) => setCorretores(res.data.corretores))
  }, [])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const setFiltro = (k) => (e) => setFiltros((f) => ({ ...f, [k]: e.target.value, page: 1 }))

  const abrirCriar = () => { setForm(FORM_VAZIO); setErro(''); setModal('criar') }
  const abrirStatus = (lead) => {
    setLeadSelecionado(lead)
    setStatusForm({ status: lead.status, observacao: '', motivoPerda: '' })
    setErro('')
    setModal('status')
  }
  const abrirDetalhe = async (lead) => {
    const res = await leadsApi.buscarPorId(lead.id)
    setLeadSelecionado(res.data.lead)
    setModal('detalhe')
  }

  const salvarLead = async (e) => {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    try {
      await leadsApi.criar(form)
      setModal(null)
      carregar()
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao criar lead')
    } finally {
      setSalvando(false)
    }
  }

  const salvarStatus = async (e) => {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    try {
      await leadsApi.mudarStatus(leadSelecionado.id, statusForm)
      setModal(null)
      carregar()
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao atualizar status')
    } finally {
      setSalvando(false)
    }
  }

  const removerLead = async (lead) => {
    if (!confirm(`Remover o lead "${lead.nome}"?`)) return
    await leadsApi.remover(lead.id)
    carregar()
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold" style={{ color: '#F1F5F9' }}>Leads</h1>
          <p className="text-xs md:text-sm mt-0.5" style={{ color: '#94A3B8' }}>
            {aba === 'leads' ? `${total} leads encontrados` : 'Contatos importados para reativação'}
          </p>
        </div>
        {aba === 'leads' && (
          <button onClick={abrirCriar} className="btn-primary self-start sm:self-auto">+ Novo lead</button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 p-1 rounded-xl w-fit" style={{ backgroundColor: '#0B1120' }}>
        {[
          { key: 'leads', label: 'Leads' },
          { key: 'contatos', label: 'Contatos Importados' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setAba(key)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: aba === key ? '#1E293B' : 'transparent',
              color: aba === key ? '#F1F5F9' : '#64748B',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {aba === 'contatos' && <ContatosImportados />}

      {aba === 'leads' && <>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-4">
        <input
          className="input sm:max-w-xs"
          placeholder="Buscar por nome ou telefone..."
          value={filtros.busca}
          onChange={setFiltro('busca')}
        />
        <select className="input sm:max-w-[180px]" value={filtros.status} onChange={setFiltro('status')}>
          <option value="">Todos os status</option>
          {STATUS_LIST.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Tabela */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500" />
          </div>
        ) : leads.length === 0 ? (
          <p className="text-center py-16 text-sm" style={{ color: '#64748B' }}>Nenhum lead encontrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead style={{ backgroundColor: '#0B1120', borderBottom: '1px solid #1E293B' }}>
                <tr>
                  {['Nome', 'Telefone', 'Status', 'Corretor', 'Urgência', 'Região', 'Criado em', ''].map((h, i) => (
                    <th
                      key={i}
                      className={`text-left px-4 py-3 font-medium text-xs uppercase tracking-wide ${
                        i === 1 ? 'hidden sm:table-cell' :
                        i === 3 ? 'hidden md:table-cell' :
                        i === 4 || i === 5 ? 'hidden lg:table-cell' :
                        i === 6 ? 'hidden sm:table-cell' : ''
                      }`}
                      style={{ color: '#64748B' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.map((lead, idx) => {
                  const badge = STATUS_BADGE_STYLE[lead.status] || { color: '#64748B', bg: 'rgba(100,116,139,0.15)' }
                  return (
                    <tr
                      key={lead.id}
                      className="transition-colors"
                      style={{
                        borderBottom: '1px solid #1E293B',
                        backgroundColor: idx % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a2332'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = idx % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent'}
                    >
                      <td className="px-4 py-3 font-medium" style={{ color: '#F1F5F9' }}>
                        <button
                          onClick={() => abrirDetalhe(lead)}
                          className="text-left hover:opacity-80 transition-opacity"
                          style={{ color: '#F1F5F9' }}
                          onMouseEnter={(e) => e.currentTarget.style.color = '#60A5FA'}
                          onMouseLeave={(e) => e.currentTarget.style.color = '#F1F5F9'}
                        >
                          {lead.nome}
                        </button>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell" style={{ color: '#94A3B8' }}>{lead.telefone}</td>
                      <td className="px-4 py-3">
                        <span className="badge" style={{ color: badge.color, backgroundColor: badge.bg }}>
                          {lead.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell" style={{ color: '#94A3B8' }}>{lead.corretor?.nome || '—'}</td>
                      <td className="px-4 py-3 hidden lg:table-cell" style={{ color: '#94A3B8' }}>{lead.urgencia || '—'}</td>
                      <td className="px-4 py-3 hidden lg:table-cell" style={{ color: '#94A3B8' }}>{lead.regiao || '—'}</td>
                      <td className="px-4 py-3 hidden sm:table-cell" style={{ color: '#64748B' }}>
                        {new Intl.DateTimeFormat('pt-BR').format(new Date(lead.criadoEm))}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 sm:flex-row sm:gap-2">
                          <button
                            onClick={() => abrirStatus(lead)}
                            className="text-xs font-medium hover:opacity-80 transition-opacity"
                            style={{ color: '#60A5FA' }}
                          >
                            Status
                          </button>
                          <button
                            onClick={() => removerLead(lead)}
                            className="text-xs font-medium hover:opacity-80 transition-opacity"
                            style={{ color: '#EF4444' }}
                          >
                            Remover
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginação */}
        {total > 30 && (
          <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid #1E293B' }}>
            <span className="text-xs" style={{ color: '#64748B' }}>
              Página {filtros.page} de {Math.ceil(total / 30)}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setFiltros((f) => ({ ...f, page: Math.max(1, f.page - 1) }))}
                disabled={filtros.page === 1}
                className="btn-secondary text-xs py-1 px-3"
              >
                Anterior
              </button>
              <button
                onClick={() => setFiltros((f) => ({ ...f, page: f.page + 1 }))}
                disabled={filtros.page >= Math.ceil(total / 30)}
                className="btn-secondary text-xs py-1 px-3"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      </> }

      {/* Modal criar lead */}
      {modal === 'criar' && (
        <Modal titulo="Novo lead" onClose={() => setModal(null)}>
          <form onSubmit={salvarLead} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Nome *</label>
                <input className="input" value={form.nome} onChange={set('nome')} required />
              </div>
              <div>
                <label className="label">Telefone *</label>
                <input className="input" value={form.telefone} onChange={set('telefone')} required />
              </div>
              <div>
                <label className="label">Corretor</label>
                <select className="input" value={form.corretorId} onChange={set('corretorId')}>
                  <option value="">Round-robin automático</option>
                  {corretores.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Urgência</label>
                <select className="input" value={form.urgencia} onChange={set('urgencia')}>
                  <option value="">—</option>
                  <option>alta</option>
                  <option>media</option>
                  <option>baixa</option>
                </select>
              </div>
              <div>
                <label className="label">Região</label>
                <input className="input" value={form.regiao} onChange={set('regiao')} />
              </div>
              <div>
                <label className="label">Faixa de valor</label>
                <input className="input" value={form.faixaValor} onChange={set('faixaValor')} />
              </div>
            </div>
            <div>
              <label className="label">Observações</label>
              <textarea className="input resize-none" rows={2} value={form.observacoes} onChange={set('observacoes')} />
            </div>
            {erro && <p className="text-sm" style={{ color: '#EF4444' }}>{erro}</p>}
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1">Cancelar</button>
              <button type="submit" className="btn-primary flex-1" disabled={salvando}>
                {salvando ? 'Salvando...' : 'Criar lead'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal status */}
      {modal === 'status' && leadSelecionado && (
        <Modal titulo={`Status: ${leadSelecionado.nome}`} onClose={() => setModal(null)}>
          <form onSubmit={salvarStatus} className="space-y-3">
            <div>
              <label className="label">Novo status</label>
              <select
                className="input"
                value={statusForm.status}
                onChange={(e) => setStatusForm((f) => ({ ...f, status: e.target.value }))}
                required
              >
                {STATUS_LIST.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            {statusForm.status === 'perdido' && (
              <div>
                <label className="label">Motivo da perda *</label>
                <textarea
                  className="input resize-none"
                  rows={2}
                  value={statusForm.motivoPerda}
                  onChange={(e) => setStatusForm((f) => ({ ...f, motivoPerda: e.target.value }))}
                  required
                />
              </div>
            )}
            <div>
              <label className="label">Observação</label>
              <input
                className="input"
                value={statusForm.observacao}
                onChange={(e) => setStatusForm((f) => ({ ...f, observacao: e.target.value }))}
              />
            </div>
            {erro && <p className="text-sm" style={{ color: '#EF4444' }}>{erro}</p>}
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1">Cancelar</button>
              <button type="submit" className="btn-primary flex-1" disabled={salvando}>
                {salvando ? 'Salvando...' : 'Atualizar'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal detalhe */}
      {modal === 'detalhe' && leadSelecionado && (
        <Modal titulo={leadSelecionado.nome} onClose={() => setModal(null)} large>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm mb-4">
            <Campo label="Telefone" valor={leadSelecionado.telefone} />
            <Campo label="Status" valor={leadSelecionado.status} />
            <Campo label="Corretor" valor={leadSelecionado.corretor?.nome} />
            <Campo label="Urgência" valor={leadSelecionado.urgencia} />
            <Campo label="Região" valor={leadSelecionado.regiao} />
            <Campo label="Faixa de valor" valor={leadSelecionado.faixaValor} />
            <Campo label="Renda mensal" valor={leadSelecionado.rendaMensal} />
            <Campo label="Tipo de renda" valor={leadSelecionado.tipoRenda} />
            <Campo label="Primeiro imóvel" valor={leadSelecionado.primeiroImovel} />
            <Campo label="Restrição CPF" valor={leadSelecionado.restricaoCpf} />
            <Campo label="Valor de entrada" valor={leadSelecionado.valorEntrada} />
            {leadSelecionado.motivoPerda && (
              <Campo label="Motivo da perda" valor={leadSelecionado.motivoPerda} />
            )}
          </div>
          {leadSelecionado.observacoes && (
            <div className="mb-4 p-3 rounded-lg text-sm" style={{ backgroundColor: '#0B1120', border: '1px solid #1E293B' }}>
              <span className="text-xs font-medium" style={{ color: '#64748B' }}>Observações</span>
              <p className="mt-1" style={{ color: '#94A3B8' }}>{leadSelecionado.observacoes}</p>
            </div>
          )}
          {leadSelecionado.historico?.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: '#64748B' }}>Histórico</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {leadSelecionado.historico.map((h) => (
                  <div key={h.id} className="text-xs pl-3" style={{ borderLeft: '2px solid rgba(59,130,246,0.4)' }}>
                    <p className="font-medium" style={{ color: '#94A3B8' }}>{h.acao}</p>
                    {h.detalhes && <p style={{ color: '#64748B' }}>{h.detalhes}</p>}
                    <p className="mt-0.5" style={{ color: '#64748B' }}>
                      {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(h.criadoEm))}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

function Modal({ titulo, onClose, children, large }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div
        className={`w-full rounded-t-2xl sm:rounded-2xl shadow-2xl ${large ? 'sm:max-w-2xl' : 'sm:max-w-md'} max-h-[92vh] flex flex-col`}
        style={{ backgroundColor: '#111827', border: '1px solid #1E293B' }}
      >
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid #1E293B' }}>
          <h2 className="font-bold truncate pr-4" style={{ color: '#F1F5F9' }}>{titulo}</h2>
          <button
            onClick={onClose}
            className="text-xl leading-none flex-shrink-0 hover:opacity-80 transition-opacity"
            style={{ color: '#64748B' }}
          >
            ×
          </button>
        </div>
        <div className="px-5 py-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

function Campo({ label, valor }) {
  return (
    <div>
      <span className="text-xs font-medium" style={{ color: '#64748B' }}>{label}</span>
      <p className="mt-0.5" style={{ color: '#94A3B8' }}>{valor || '—'}</p>
    </div>
  )
}
