import { useEffect, useState, useRef, useCallback } from 'react'
import * as api from '../api/contatos-pessoais'

const FORM_VAZIO = { nome: '', telefone: '', email: '', observacoes: '' }

export default function MeusContatos() {
  const [contatos, setContatos] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [buscaInput, setBuscaInput] = useState('')
  const [page, setPage] = useState(1)

  const [modal, setModal] = useState(null) // 'novo' | 'importar' | 'converter'
  const [contatoSel, setContatoSel] = useState(null)

  const [form, setForm] = useState(FORM_VAZIO)
  const [erroForm, setErroForm] = useState('')
  const [salvando, setSalvando] = useState(false)

  const [dragOver, setDragOver] = useState(false)
  const [importando, setImportando] = useState(false)
  const [resultImport, setResultImport] = useState(null)
  const fileInputRef = useRef(null)

  const [convertendo, setConvertendo] = useState(false)
  const [erroConverter, setErroConverter] = useState('')

  const [toast, setToast] = useState('')

  const mostrarToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 4000)
  }

  const carregar = useCallback(() => {
    setLoading(true)
    const params = { page, limit: 50 }
    if (busca) params.busca = busca
    api.listar(params)
      .then((res) => {
        setContatos(res.data.contatos)
        setTotal(res.data.total)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [page, busca])

  useEffect(() => { carregar() }, [carregar])

  // Busca com debounce
  useEffect(() => {
    const t = setTimeout(() => {
      setBusca(buscaInput)
      setPage(1)
    }, 350)
    return () => clearTimeout(t)
  }, [buscaInput])

  const fecharModal = () => {
    setModal(null)
    setContatoSel(null)
    setForm(FORM_VAZIO)
    setErroForm('')
    setErroConverter('')
    setResultImport(null)
  }

  // ----- Cadastro individual -----
  const abrirNovo = () => {
    setForm(FORM_VAZIO)
    setErroForm('')
    setModal('novo')
  }

  const salvarContato = async () => {
    if (!form.nome.trim()) return setErroForm('Nome é obrigatório')
    if (!form.telefone.trim()) return setErroForm('Telefone é obrigatório')
    setSalvando(true)
    setErroForm('')
    try {
      await api.cadastrar(form)
      fecharModal()
      carregar()
      mostrarToast('Contato adicionado com sucesso!')
    } catch (err) {
      setErroForm(err.response?.data?.error || 'Erro ao salvar contato')
    } finally {
      setSalvando(false)
    }
  }

  // ----- Importar arquivo -----
  const importarArquivo = async (file) => {
    if (!file) return
    const fd = new FormData()
    fd.append('arquivo', file)
    setImportando(true)
    setResultImport(null)
    try {
      const res = await api.importar(fd)
      setResultImport(res.data)
      carregar()
    } catch (err) {
      setResultImport({ erro: err.response?.data?.error || 'Erro ao importar arquivo' })
    } finally {
      setImportando(false)
    }
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) importarArquivo(file)
  }

  // ----- Converter em lead -----
  const abrirConverter = (contato) => {
    setContatoSel(contato)
    setErroConverter('')
    setModal('converter')
  }

  const confirmarConverter = async () => {
    setConvertendo(true)
    setErroConverter('')
    try {
      await api.converter(contatoSel.id)
      fecharModal()
      carregar()
      mostrarToast(`"${contatoSel.nome}" foi movido para o kanban como lead!`)
    } catch (err) {
      setErroConverter(err.response?.data?.error || 'Erro ao converter contato')
    } finally {
      setConvertendo(false)
    }
  }

  // ----- Remover -----
  const removerContato = async (contato) => {
    if (!confirm(`Remover "${contato.nome}" da sua lista?`)) return
    try {
      await api.remover(contato.id)
      carregar()
      mostrarToast('Contato removido.')
    } catch {}
  }

  const totalPages = Math.ceil(total / 50)

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">

      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold" style={{ color: '#F1F5F9' }}>Meus Contatos</h1>
          <p className="text-sm mt-0.5" style={{ color: '#94A3B8' }}>{total} contato{total !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setResultImport(null); setModal('importar') }}
            className="btn-secondary text-sm"
          >
            Importar lista
          </button>
          <button onClick={abrirNovo} className="btn-primary text-sm">
            + Novo contato
          </button>
        </div>
      </div>

      {/* Aviso de privacidade */}
      <div
        className="rounded-lg px-4 py-3 text-sm flex items-start gap-2"
        style={{ backgroundColor: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', color: '#818cf8' }}
      >
        <LockIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>Seus contatos são visíveis apenas para você. Somente quando movidos para o kanban o gestor passa a ver.</span>
      </div>

      {/* Busca */}
      <input
        type="text"
        className="input w-full"
        placeholder="Buscar por nome ou telefone..."
        value={buscaInput}
        onChange={(e) => setBuscaInput(e.target.value)}
      />

      {/* Lista */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500" />
          </div>
        ) : contatos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <PersonIcon className="w-10 h-10" style={{ color: '#334155' }} />
            <p className="text-sm" style={{ color: '#64748B' }}>
              {busca ? 'Nenhum contato encontrado para essa busca.' : 'Você ainda não tem contatos. Adicione ou importe uma lista.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead style={{ backgroundColor: '#0B1120', borderBottom: '1px solid #1E293B' }}>
                <tr>
                  {['Nome', 'Telefone', 'Observações', 'Adicionado em', ''].map((h, i) => (
                    <th
                      key={i}
                      className={`text-left px-4 py-3 font-medium text-xs uppercase tracking-wide ${
                        i === 1 ? 'hidden sm:table-cell' :
                        i === 2 ? 'hidden md:table-cell' :
                        i === 3 ? 'hidden lg:table-cell' : ''
                      }`}
                      style={{ color: '#64748B' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contatos.map((c, idx) => (
                  <tr
                    key={c.id}
                    style={{
                      borderBottom: '1px solid #1E293B',
                      backgroundColor: idx % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a2332'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = idx % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent'}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium" style={{ color: '#F1F5F9' }}>{c.nome}</p>
                      {c.email && <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{c.email}</p>}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell" style={{ color: '#94A3B8' }}>{c.telefone}</td>
                    <td className="px-4 py-3 hidden md:table-cell max-w-[200px]">
                      <p className="truncate text-xs" style={{ color: '#64748B' }}>{c.observacoes || '—'}</p>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell" style={{ color: '#64748B' }}>
                      {new Intl.DateTimeFormat('pt-BR').format(new Date(c.criadoEm))}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3 flex-wrap">
                        <button
                          onClick={() => abrirConverter(c)}
                          className="text-xs font-medium hover:opacity-80 transition-opacity whitespace-nowrap"
                          style={{ color: '#10B981' }}
                        >
                          Mover para Kanban
                        </button>
                        <button
                          onClick={() => removerContato(c)}
                          className="text-xs font-medium hover:opacity-80 transition-opacity"
                          style={{ color: '#EF4444' }}
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

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid #1E293B' }}>
            <span className="text-xs" style={{ color: '#64748B' }}>Página {page} de {totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-xs py-1 px-3">Anterior</button>
              <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages} className="btn-secondary text-xs py-1 px-3">Próxima</button>
            </div>
          </div>
        )}
      </div>

      {/* ---- Modal: Novo contato ---- */}
      {modal === 'novo' && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div
            className="w-full rounded-t-2xl sm:rounded-2xl shadow-2xl sm:max-w-md"
            style={{ backgroundColor: '#111827', border: '1px solid #1E293B' }}
          >
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #1E293B' }}>
              <h2 className="font-bold" style={{ color: '#F1F5F9' }}>Novo contato</h2>
              <button onClick={fecharModal} className="text-xl leading-none hover:opacity-80" style={{ color: '#64748B' }}>×</button>
            </div>
            <div className="px-5 py-5 space-y-4">
              <div>
                <label className="label">Nome <span style={{ color: '#EF4444' }}>*</span></label>
                <input
                  className="input w-full"
                  placeholder="Nome completo"
                  value={form.nome}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Telefone <span style={{ color: '#EF4444' }}>*</span></label>
                <input
                  className="input w-full"
                  placeholder="(11) 99999-9999"
                  value={form.telefone}
                  onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">E-mail <span className="text-xs font-normal" style={{ color: '#64748B' }}>(opcional)</span></label>
                <input
                  type="email"
                  className="input w-full"
                  placeholder="contato@email.com"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Observações <span className="text-xs font-normal" style={{ color: '#64748B' }}>(opcional)</span></label>
                <textarea
                  className="input resize-none w-full"
                  rows={3}
                  placeholder="Anotações sobre o contato..."
                  value={form.observacoes}
                  onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
                />
              </div>
              {erroForm && <p className="text-sm" style={{ color: '#EF4444' }}>{erroForm}</p>}
              <div className="flex gap-2 pt-1">
                <button onClick={fecharModal} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={salvarContato} disabled={salvando} className="btn-primary flex-1">
                  {salvando ? 'Salvando...' : 'Salvar contato'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---- Modal: Importar lista ---- */}
      {modal === 'importar' && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div
            className="w-full rounded-t-2xl sm:rounded-2xl shadow-2xl sm:max-w-md"
            style={{ backgroundColor: '#111827', border: '1px solid #1E293B' }}
          >
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #1E293B' }}>
              <h2 className="font-bold" style={{ color: '#F1F5F9' }}>Importar lista de contatos</h2>
              <button onClick={fecharModal} className="text-xl leading-none hover:opacity-80" style={{ color: '#64748B' }}>×</button>
            </div>
            <div className="px-5 py-5 space-y-4">
              <div
                onDrop={onDrop}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center py-10 cursor-pointer transition-colors"
                style={{
                  borderColor: dragOver ? '#6366f1' : '#1E293B',
                  backgroundColor: dragOver ? 'rgba(99,102,241,0.05)' : 'transparent',
                }}
              >
                <svg className="w-8 h-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: '#64748B' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <p className="text-sm font-medium" style={{ color: '#94A3B8' }}>
                  {importando ? 'Importando...' : 'Arraste um CSV ou Excel aqui, ou clique para selecionar'}
                </p>
                <p className="text-xs mt-1" style={{ color: '#64748B' }}>Colunas: nome, telefone (obrigatórias) · email, observacoes (opcionais)</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => importarArquivo(e.target.files[0])}
                />
              </div>

              {resultImport && (
                <div
                  className="rounded-lg px-4 py-3 text-sm"
                  style={{
                    backgroundColor: resultImport.erro ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                    border: `1px solid ${resultImport.erro ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
                    color: resultImport.erro ? '#EF4444' : '#10B981',
                  }}
                >
                  {resultImport.erro
                    ? resultImport.erro
                    : `${resultImport.importados} importados · ${resultImport.erros} com erro`}
                </div>
              )}

              <button onClick={fecharModal} className="btn-secondary w-full">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Modal: Mover para Kanban ---- */}
      {modal === 'converter' && contatoSel && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div
            className="w-full rounded-t-2xl sm:rounded-2xl shadow-2xl sm:max-w-md"
            style={{ backgroundColor: '#111827', border: '1px solid #1E293B' }}
          >
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #1E293B' }}>
              <h2 className="font-bold" style={{ color: '#F1F5F9' }}>Mover para o Kanban</h2>
              <button onClick={fecharModal} className="text-xl leading-none hover:opacity-80" style={{ color: '#64748B' }}>×</button>
            </div>
            <div className="px-5 py-5 space-y-4">
              <div
                className="rounded-lg px-4 py-3"
                style={{ backgroundColor: '#0B1120', border: '1px solid #1E293B' }}
              >
                <p className="font-medium" style={{ color: '#F1F5F9' }}>{contatoSel.nome}</p>
                <p className="text-sm mt-0.5" style={{ color: '#94A3B8' }}>{contatoSel.telefone}</p>
                {contatoSel.observacoes && (
                  <p className="text-xs mt-1" style={{ color: '#64748B' }}>{contatoSel.observacoes}</p>
                )}
              </div>

              <div
                className="rounded-lg px-4 py-3 text-sm flex items-start gap-2"
                style={{ backgroundColor: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#6EE7B7' }}
              >
                <span className="flex-shrink-0 mt-0.5">ℹ</span>
                <span>
                  Este contato será criado como um lead no kanban na coluna "Novo Lead", atribuído a você.
                  O gestor e gerentes da equipe passarão a vê-lo normalmente.
                </span>
              </div>

              {erroConverter && <p className="text-sm" style={{ color: '#EF4444' }}>{erroConverter}</p>}

              <div className="flex gap-2 pt-1">
                <button onClick={fecharModal} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={confirmarConverter} disabled={convertendo} className="btn-primary flex-1">
                  {convertendo ? 'Movendo...' : 'Confirmar e mover'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-lg px-5 py-3 text-sm font-medium z-50 shadow-lg whitespace-nowrap"
          style={{ backgroundColor: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#10B981' }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}

function LockIcon({ className, style }) {
  return (
    <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  )
}

function PersonIcon({ className, style }) {
  return (
    <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  )
}
