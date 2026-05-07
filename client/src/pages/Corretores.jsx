import { useEffect, useState, useCallback } from 'react'
import * as corretoresApi from '../api/corretores'
import * as equipesApi from '../api/equipes'

const FORM_VAZIO = { nome: '', telefone: '', whatsapp: '', email: '' }
const FORM_ACESSO_VAZIO = { email: '', senha: '' }
const FORM_RESET_VAZIO = { novaSenha: '' }

export default function Corretores() {
  const [corretores, setCorretores] = useState([])
  const [fila, setFila] = useState([])
  const [equipes, setEquipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(FORM_VAZIO)
  const [formAcesso, setFormAcesso] = useState(FORM_ACESSO_VAZIO)
  const [formReset, setFormReset] = useState(FORM_RESET_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [aba, setAba] = useState('lista')
  const [atualizandoEquipe, setAtualizandoEquipe] = useState(null)

  const carregar = useCallback(() => {
    Promise.all([
      corretoresApi.listar(),
      corretoresApi.buscarFila(),
      equipesApi.listar(),
    ])
      .then(([r1, r2, r3]) => {
        setCorretores(r1.data.corretores)
        setFila(r2.data.fila)
        setEquipes(r3.data.equipes)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const setAcesso = (k) => (e) => setFormAcesso((f) => ({ ...f, [k]: e.target.value }))
  const setReset = (k) => (e) => setFormReset((f) => ({ ...f, [k]: e.target.value }))

  const abrirCriar = () => { setEditando(null); setForm(FORM_VAZIO); setErro(''); setModal('form') }
  const abrirEditar = (c) => {
    setEditando(c)
    setForm({ nome: c.nome, telefone: c.telefone, whatsapp: c.whatsapp, email: c.email || '' })
    setErro('')
    setModal('form')
  }
  const abrirAcesso = (c) => {
    setEditando(c)
    setFormAcesso({ email: c.email || '', senha: '' })
    setErro('')
    setModal('acesso')
  }
  const abrirReset = (c) => {
    setEditando(c)
    setFormReset(FORM_RESET_VAZIO)
    setErro('')
    setModal('reset')
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

  const salvarAcesso = async (e) => {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    try {
      await corretoresApi.ativarAcesso(editando.id, formAcesso.email, formAcesso.senha)
      setModal(null)
      carregar()
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao ativar acesso')
    } finally {
      setSalvando(false)
    }
  }

  const salvarReset = async (e) => {
    e.preventDefault()
    setErro('')
    setSalvando(true)
    try {
      await corretoresApi.resetarSenha(editando.id, formReset.novaSenha)
      setModal(null)
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao resetar senha')
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

  const mudarEquipe = async (c, novoEquipeId) => {
    setAtualizandoEquipe(c.id)
    try {
      await corretoresApi.atualizar(c.id, { equipeId: novoEquipeId || null })
      carregar()
    } finally {
      setAtualizandoEquipe(null)
    }
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
            <table className="w-full text-sm min-w-[600px]">
              <thead style={{ backgroundColor: '#0B1120', borderBottom: '1px solid #1E293B' }}>
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wide" style={{ color: '#64748B' }}>Nome</th>
                  <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wide hidden sm:table-cell" style={{ color: '#64748B' }}>Telefone</th>
                  <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wide" style={{ color: '#64748B' }}>Status</th>
                  <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wide hidden md:table-cell" style={{ color: '#64748B' }}>Equipe</th>
                  <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wide hidden sm:table-cell" style={{ color: '#64748B' }}>Leads</th>
                  <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wide" style={{ color: '#64748B' }}>Acesso</th>
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
                    <td className="px-4 py-3 hidden md:table-cell">
                      <select
                        value={c.equipeId || ''}
                        onChange={(e) => mudarEquipe(c, e.target.value)}
                        disabled={atualizandoEquipe === c.id || !c.ativo}
                        className="text-xs rounded-md px-2 py-1 transition-opacity disabled:opacity-50"
                        style={{
                          backgroundColor: '#0B1120',
                          border: '1px solid #1E293B',
                          color: c.equipeId ? '#818cf8' : '#64748B',
                          minWidth: 120,
                        }}
                      >
                        <option value="">Sem equipe</option>
                        {equipes.map((eq) => (
                          <option key={eq.id} value={eq.id}>{eq.nome}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell" style={{ color: '#94A3B8' }}>{c.leadsRecebidos}</td>
                    <td className="px-4 py-3">
                      {c.usuarioAtivo ? (
                        <button
                          onClick={() => abrirReset(c)}
                          className="badge cursor-pointer"
                          style={{ color: '#10B981', backgroundColor: 'rgba(16,185,129,0.15)' }}
                        >
                          Ativo
                        </button>
                      ) : (
                        <button
                          onClick={() => abrirAcesso(c)}
                          className="badge cursor-pointer"
                          style={{ color: '#64748B', backgroundColor: 'rgba(100,116,139,0.15)' }}
                        >
                          Sem acesso
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3">
                        <button onClick={() => abrirEditar(c)} className="text-xs font-medium hover:opacity-80" style={{ color: '#60A5FA' }}>
                          Editar
                        </button>
                        {c.ativo && (
                          <button onClick={() => remover(c)} className="text-xs font-medium hover:opacity-80" style={{ color: '#EF4444' }}>
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
          <div className="px-5 py-3 text-sm" style={{ backgroundColor: 'rgba(99,102,241,0.1)', borderBottom: '1px solid rgba(99,102,241,0.2)', color: '#818cf8' }}>
            Próximo lead será atribuído ao corretor na posição 1
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[360px]">
              <thead style={{ backgroundColor: '#0B1120', borderBottom: '1px solid #1E293B' }}>
                <tr>
                  {['Posição', 'Corretor', 'Disponível', 'Leads recebidos'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wide" style={{ color: '#64748B' }}>{h}</th>
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
                        style={f.posicao === 1 ? { backgroundColor: '#4f46e5', color: '#fff' } : { backgroundColor: '#1E293B', color: '#94A3B8' }}
                      >
                        {f.posicao}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium" style={{ color: '#F1F5F9' }}>{f.nome}</td>
                    <td className="px-4 py-3">
                      <span
                        className="badge"
                        style={f.disponivel ? { color: '#10B981', backgroundColor: 'rgba(16,185,129,0.15)' } : { color: '#64748B', backgroundColor: 'rgba(100,116,139,0.15)' }}
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

      {/* Modal: criar/editar corretor */}
      {modal === 'form' && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[92vh] flex flex-col" style={{ backgroundColor: '#111827', border: '1px solid #1E293B' }}>
            <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid #1E293B' }}>
              <h2 className="font-bold" style={{ color: '#F1F5F9' }}>{editando ? 'Editar corretor' : 'Novo corretor'}</h2>
              <button onClick={() => setModal(null)} className="text-xl leading-none hover:opacity-80" style={{ color: '#64748B' }}>×</button>
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

      {/* Modal: ativar acesso */}
      {modal === 'acesso' && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl shadow-2xl w-full max-w-sm" style={{ backgroundColor: '#111827', border: '1px solid #1E293B' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #1E293B' }}>
              <div>
                <h2 className="font-bold" style={{ color: '#F1F5F9' }}>Ativar acesso</h2>
                <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{editando?.nome}</p>
              </div>
              <button onClick={() => setModal(null)} className="text-xl leading-none hover:opacity-80" style={{ color: '#64748B' }}>×</button>
            </div>
            <form onSubmit={salvarAcesso} className="px-5 py-5 space-y-3">
              <div>
                <label className="label">E-mail de acesso *</label>
                <input
                  type="email"
                  className="input"
                  value={formAcesso.email}
                  onChange={setAcesso('email')}
                  placeholder="corretor@email.com"
                  required
                />
              </div>
              <div>
                <label className="label">Senha temporária *</label>
                <input
                  type="password"
                  className="input"
                  value={formAcesso.senha}
                  onChange={setAcesso('senha')}
                  placeholder="mínimo 6 caracteres"
                  minLength={6}
                  required
                />
              </div>
              {erro && <p className="text-sm" style={{ color: '#EF4444' }}>{erro}</p>}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" className="btn-primary flex-1" disabled={salvando}>
                  {salvando ? 'Ativando...' : 'Ativar acesso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: resetar senha */}
      {modal === 'reset' && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl shadow-2xl w-full max-w-sm" style={{ backgroundColor: '#111827', border: '1px solid #1E293B' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #1E293B' }}>
              <div>
                <h2 className="font-bold" style={{ color: '#F1F5F9' }}>Resetar senha</h2>
                <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{editando?.nome}</p>
              </div>
              <button onClick={() => setModal(null)} className="text-xl leading-none hover:opacity-80" style={{ color: '#64748B' }}>×</button>
            </div>
            <form onSubmit={salvarReset} className="px-5 py-5 space-y-3">
              <div>
                <label className="label">Nova senha *</label>
                <input
                  type="password"
                  className="input"
                  value={formReset.novaSenha}
                  onChange={setReset('novaSenha')}
                  placeholder="mínimo 6 caracteres"
                  minLength={6}
                  required
                />
              </div>
              {erro && <p className="text-sm" style={{ color: '#EF4444' }}>{erro}</p>}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" className="btn-primary flex-1" disabled={salvando}>
                  {salvando ? 'Salvando...' : 'Resetar senha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
