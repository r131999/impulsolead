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
  const [aba, setAba] = useState('lista')

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

  const abrirCriar = () => { setEditando(null); setForm(FORM_VAZIO); setErro(''); setModal('form') }
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
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold" style={{ color: '#F1F5F9' }}>Corretores</h1>
          <p className="text-xs md:text-sm mt-0.5" style={{ color: '#94A3B8' }}>
            {corretores.filter((c) => c.ativo).length} ativos ·{' '}
            {corretores.filter((c) => c.ativo && c.disponivel).length} disponíveis
          </p>
        </div>
        <button onClick={abrirCriar} className="btn-primary self-start sm:self-auto">+ Novo corretor</button>
      </div>

      {/* Abas */}
      <div className="flex gap-1 mb-4 p-1 rounded-lg w-fit" style={{ backgroundColor: '#0B1120' }}>
        {[{ id: 'lista', label: 'Lista' }, { id: 'fila', label: 'Fila round-robin' }].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            className="px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
            style={
              aba === id
                ? { backgroundColor: '#1a2332', color: '#F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }
                : { color: '#64748B' }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {aba === 'lista' && (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead style={{ backgroundColor: '#0B1120', borderBottom: '1px solid #1E293B' }}>
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wide" style={{ color: '#64748B' }}>Nome</th>
                  <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wide hidden sm:table-cell" style={{ color: '#64748B' }}>Telefone</th>
                  <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wide hidden md:table-cell" style={{ color: '#64748B' }}>WhatsApp</th>
                  <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wide" style={{ color: '#64748B' }}>Status</th>
                  <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wide hidden sm:table-cell" style={{ color: '#64748B' }}>Leads recebidos</th>
                  <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wide" style={{ color: '#64748B' }}></th>
                </tr>
              </thead>
              <tbody>
                {corretores.map((c, idx) => (
                  <tr
                    key={c.id}
                    className="transition-colors"
                    style={{
                      borderBottom: '1px solid #1E293B',
                      opacity: !c.ativo ? 0.45 : 1,
                      backgroundColor: idx % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent',
                    }}
                    onMouseEnter={(e) => { if (c.ativo) e.currentTarget.style.backgroundColor = '#1a2332' }}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = idx % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent'}
                  >
                    <td className="px-4 py-3 font-medium" style={{ color: '#F1F5F9' }}>{c.nome}</td>
                    <td className="px-4 py-3 hidden sm:table-cell" style={{ color: '#94A3B8' }}>{c.telefone}</td>
                    <td className="px-4 py-3 hidden md:table-cell" style={{ color: '#94A3B8' }}>{c.whatsapp}</td>
                    <td className="px-4 py-3">
                      {c.ativo ? (
                        <button
                          onClick={() => toggleDisponivel(c)}
                          className="badge cursor-pointer transition-colors"
                          style={
                            c.disponivel
                              ? { color: '#10B981', backgroundColor: 'rgba(16,185,129,0.15)' }
                              : { color: '#64748B', backgroundColor: 'rgba(100,116,139,0.15)' }
                          }
                        >
                          {c.disponivel ? 'Disponível' : 'Indisponível'}
                        </button>
                      ) : (
                        <span className="badge" style={{ color: '#EF4444', backgroundColor: 'rgba(239,68,68,0.15)' }}>
                          Inativo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell" style={{ color: '#94A3B8' }}>{c.leadsRecebidos}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3">
                        <button
                          onClick={() => abrirEditar(c)}
                          className="text-xs font-medium hover:opacity-80 transition-opacity"
                          style={{ color: '#60A5FA' }}
                        >
                          Editar
                        </button>
                        {c.ativo && (
                          <button
                            onClick={() => remover(c)}
                            className="text-xs font-medium hover:opacity-80 transition-opacity"
                            style={{ color: '#EF4444' }}
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
            <p className="text-center py-12 text-sm" style={{ color: '#64748B' }}>Nenhum corretor cadastrado.</p>
          )}
        </div>
      )}

      {aba === 'fila' && (
        <div className="card p-0 overflow-hidden">
          <div
            className="px-5 py-3 text-sm"
            style={{ backgroundColor: 'rgba(99,102,241,0.1)', borderBottom: '1px solid rgba(99,102,241,0.2)', color: '#818cf8' }}
          >
            Próximo lead será atribuído ao corretor na posição 1
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[360px]">
              <thead style={{ backgroundColor: '#0B1120', borderBottom: '1px solid #1E293B' }}>
                <tr>
                  {['Posição', 'Corretor', 'Disponível', 'Leads recebidos'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wide" style={{ color: '#64748B' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fila.map((f, idx) => (
                  <tr
                    key={f.corretorId}
                    className="transition-colors"
                    style={{
                      borderBottom: '1px solid #1E293B',
                      opacity: !f.disponivel ? 0.5 : 1,
                      backgroundColor: idx % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a2332'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = idx % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent'}
                  >
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold"
                        style={
                          f.posicao === 1
                            ? { backgroundColor: '#4f46e5', color: '#fff' }
                            : { backgroundColor: '#1E293B', color: '#94A3B8' }
                        }
                      >
                        {f.posicao}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium" style={{ color: '#F1F5F9' }}>{f.nome}</td>
                    <td className="px-4 py-3">
                      <span
                        className="badge"
                        style={
                          f.disponivel
                            ? { color: '#10B981', backgroundColor: 'rgba(16,185,129,0.15)' }
                            : { color: '#64748B', backgroundColor: 'rgba(100,116,139,0.15)' }
                        }
                      >
                        {f.disponivel ? 'Sim' : 'Não'}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: '#94A3B8' }}>{f.leadsRecebidos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {fila.length === 0 && (
              <p className="text-center py-12 text-sm" style={{ color: '#64748B' }}>Nenhum corretor ativo na fila.</p>
            )}
          </div>
        </div>
      )}

      {/* Modal form */}
      {modal === 'form' && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div
            className="rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[92vh] flex flex-col"
            style={{ backgroundColor: '#111827', border: '1px solid #1E293B' }}
          >
            <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid #1E293B' }}>
              <h2 className="font-bold" style={{ color: '#F1F5F9' }}>{editando ? 'Editar corretor' : 'Novo corretor'}</h2>
              <button
                onClick={() => setModal(null)}
                className="text-xl leading-none hover:opacity-80 transition-opacity"
                style={{ color: '#64748B' }}
              >
                ×
              </button>
            </div>
            <form onSubmit={salvar} className="px-5 py-5 space-y-3 overflow-y-auto">
              <div>
                <label className="label">Nome *</label>
                <input className="input" value={form.nome} onChange={set('nome')} required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Telefone *</label>
                  <input className="input" value={form.telefone} onChange={set('telefone')} required />
                </div>
                <div>
                  <label className="label">WhatsApp *</label>
                  <input className="input" value={form.whatsapp} onChange={set('whatsapp')} required />
                </div>
              </div>
              <div>
                <label className="label">E-mail</label>
                <input type="email" className="input" value={form.email} onChange={set('email')} />
              </div>
              {erro && <p className="text-sm" style={{ color: '#EF4444' }}>{erro}</p>}
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
