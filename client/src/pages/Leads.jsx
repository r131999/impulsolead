import { useEffect, useState, useCallback } from 'react'
import * as leadsApi from '../api/leads'
import * as corretoresApi from '../api/corretores'

const STATUS_BADGE = {
  novo: 'bg-blue-100 text-blue-700',
  qualificado: 'bg-purple-100 text-purple-700',
  atendimento: 'bg-yellow-100 text-yellow-700',
  visita: 'bg-orange-100 text-orange-700',
  proposta: 'bg-indigo-100 text-indigo-700',
  fechado: 'bg-green-100 text-green-700',
  perdido: 'bg-red-100 text-red-700',
}

const STATUS_LIST = ['novo', 'qualificado', 'atendimento', 'visita', 'proposta', 'fechado', 'perdido']

const FORM_VAZIO = {
  nome: '', telefone: '', corretorId: '', observacoes: '',
  urgencia: '', regiao: '', faixaValor: '', primeiroImovel: '',
  tipoRenda: '', rendaMensal: '', restricaoCpf: '', valorEntrada: '',
}

export default function Leads() {
  const [leads, setLeads] = useState([])
  const [total, setTotal] = useState(0)
  const [corretores, setCorretores] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtros, setFiltros] = useState({ status: '', busca: '', page: 1 })
  const [modal, setModal] = useState(null) // null | 'criar' | 'status' | 'detalhe'
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

  const abrirCriar = () => {
    setForm(FORM_VAZIO)
    setErro('')
    setModal('criar')
  }

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
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-gray-500 text-sm mt-0.5">{total} leads encontrados</p>
        </div>
        <button onClick={abrirCriar} className="btn-primary">+ Novo lead</button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 mb-4">
        <input
          className="input max-w-xs"
          placeholder="Buscar por nome ou telefone..."
          value={filtros.busca}
          onChange={setFiltro('busca')}
        />
        <select className="input max-w-[180px]" value={filtros.status} onChange={setFiltro('status')}>
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
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
          </div>
        ) : leads.length === 0 ? (
          <p className="text-center text-gray-500 py-16 text-sm">Nenhum lead encontrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Nome', 'Telefone', 'Status', 'Corretor', 'Urgência', 'Região', 'Criado em', ''].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <button onClick={() => abrirDetalhe(lead)} className="hover:text-indigo-600">
                        {lead.nome}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{lead.telefone}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${STATUS_BADGE[lead.status] || 'bg-gray-100 text-gray-700'}`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{lead.corretor?.nome || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{lead.urgencia || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{lead.regiao || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Intl.DateTimeFormat('pt-BR').format(new Date(lead.criadoEm))}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => abrirStatus(lead)}
                          className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                          Status
                        </button>
                        <button
                          onClick={() => removerLead(lead)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium"
                        >
                          Remover
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginação */}
        {total > 30 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">
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

      {/* Modal criar lead */}
      {modal === 'criar' && (
        <Modal titulo="Novo lead" onClose={() => setModal(null)}>
          <form onSubmit={salvarLead} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
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
            {erro && <p className="text-red-600 text-sm">{erro}</p>}
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
            {erro && <p className="text-red-600 text-sm">{erro}</p>}
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
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm mb-4">
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
            <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm">
              <span className="text-gray-500 text-xs font-medium">Observações</span>
              <p className="mt-1 text-gray-700">{leadSelecionado.observacoes}</p>
            </div>
          )}
          {leadSelecionado.historico?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Histórico</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {leadSelecionado.historico.map((h) => (
                  <div key={h.id} className="text-xs border-l-2 border-indigo-200 pl-3">
                    <p className="font-medium text-gray-700">{h.acao}</p>
                    {h.detalhes && <p className="text-gray-500">{h.detalhes}</p>}
                    <p className="text-gray-400 mt-0.5">
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-2xl shadow-xl w-full ${large ? 'max-w-2xl' : 'max-w-md'}`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">{titulo}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

function Campo({ label, valor }) {
  return (
    <div>
      <span className="text-xs text-gray-400 font-medium">{label}</span>
      <p className="text-gray-700 mt-0.5">{valor || '—'}</p>
    </div>
  )
}
