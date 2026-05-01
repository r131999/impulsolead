import { useEffect, useState, useCallback } from 'react'
import * as corretoresApi from '../api/corretores'

const FORM_VAZIO = { nome: '', telefone: '', whatsapp: '', email: '' }

export default function Corretores() {
  const [corretores, setCorretores] = useState([])
  const [fila, setFila] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [aba, setAba] = useState('lista') // 'lista' | 'fila'

  const carregar = useCallback(() => {
    Promise.all([corretoresApi.listar(), corretoresApi.buscarFila()])
      .then(([r1, r2]) => {
        setCorretores(r1.data.corretores)
        setFila(r2.data.fila)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const abrirCriar = () => {
    setEditando(null)
    setForm(FORM_VAZIO)
    setErro('')
    setModal('form')
  }

  const abrirEditar = (c) => {
    setEditando(c)
    setForm({ nome: c.nome, telefone: c.telefone, whatsapp: c.whatsapp, email: c.email || '' })
    setErro('')
    setModal('form')
  }

  const salvar = async (e) => {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    try {
      if (editando) {
        await corretoresApi.atualizar(editando.id, form)
      } else {
        await corretoresApi.criar(form)
      }
      setModal(null)
      carregar()
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  const toggleDisponivel = async (c) => {
    await corretoresApi.atualizarDisponibilidade(c.id, !c.disponivel)
    carregar()
  }

  const remover = async (c) => {
    if (!confirm(`Remover ${c.nome} da fila?`)) return
    await corretoresApi.remover(c.id)
    carregar()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Corretores</h1>
          <p className="text-gray-500 text-xs md:text-sm mt-0.5">
            {corretores.filter((c) => c.ativo).length} ativos ·{' '}
            {corretores.filter((c) => c.ativo && c.disponivel).length} disponíveis
          </p>
        </div>
        <button onClick={abrirCriar} className="btn-primary self-start sm:self-auto">+ Novo corretor</button>
      </div>

      {/* Abas */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {[{ id: 'lista', label: 'Lista' }, { id: 'fila', label: 'Fila round-robin' }].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              aba === id ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {aba === 'lista' && (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wide">Nome</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wide hidden sm:table-cell">Telefone</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wide hidden md:table-cell">WhatsApp</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wide hidden sm:table-cell">Leads recebidos</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wide"></th>
              </tr>
            </thead>
            <tbody>
              {corretores.map((c) => (
                <tr key={c.id} className={`border-b border-gray-50 ${!c.ativo ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-medium text-gray-900">{c.nome}</td>
                  <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{c.telefone}</td>
                  <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{c.whatsapp}</td>
                  <td className="px-4 py-3">
                    {c.ativo ? (
                      <button
                        onClick={() => toggleDisponivel(c)}
                        className={`badge cursor-pointer ${
                          c.disponivel ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {c.disponivel ? 'Disponível' : 'Indisponível'}
                      </button>
                    ) : (
                      <span className="badge bg-red-100 text-red-600">Inativo</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{c.leadsRecebidos}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <button
                        onClick={() => abrirEditar(c)}
                        className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                      >
                        Editar
                      </button>
                      {c.ativo && (
                        <button
                          onClick={() => remover(c)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium"
                        >
                          Remover
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {corretores.length === 0 && (
            <p className="text-center text-gray-500 py-12 text-sm">Nenhum corretor cadastrado.</p>
          )}
        </div>
      )}

      {aba === 'fila' && (
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-3 bg-indigo-50 border-b border-indigo-100 text-sm text-indigo-700">
            Próximo lead será atribuído ao corretor na posição 1
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[360px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Posição', 'Corretor', 'Disponível', 'Leads recebidos'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fila.map((f) => (
                <tr key={f.corretorId} className={`border-b border-gray-50 ${!f.disponivel ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                      f.posicao === 1 ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {f.posicao}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{f.nome}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${f.disponivel ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {f.disponivel ? 'Sim' : 'Não'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{f.leadsRecebidos}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {fila.length === 0 && (
            <p className="text-center text-gray-500 py-12 text-sm">Nenhum corretor ativo na fila.</p>
          )}
          </div>
        </div>
      )}

      {/* Modal form */}
      {modal === 'form' && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <h2 className="font-bold text-gray-900">{editando ? 'Editar corretor' : 'Novo corretor'}</h2>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <form onSubmit={salvar} className="px-5 py-5 space-y-3 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input className="input" value={form.nome} onChange={set('nome')} required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefone *</label>
                  <input className="input" value={form.telefone} onChange={set('telefone')} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp *</label>
                  <input className="input" value={form.whatsapp} onChange={set('whatsapp')} required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                <input type="email" className="input" value={form.email} onChange={set('email')} />
              </div>
              {erro && <p className="text-red-600 text-sm">{erro}</p>}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" className="btn-primary flex-1" disabled={salvando}>
                  {salvando ? 'Salvando...' : editando ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
