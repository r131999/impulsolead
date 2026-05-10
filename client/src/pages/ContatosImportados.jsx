import { useEffect, useState, useRef, useCallback } from 'react'
import * as contatosApi from '../api/contatos'
import * as modelosApi from '../api/modelos-mensagem'
import * as corretoresApi from '../api/corretores'

const STATUS_STYLE = {
  pendente:   { color: '#94A3B8', bg: 'rgba(148,163,184,0.15)' },
  enviado:    { color: '#60A5FA', bg: 'rgba(59,130,246,0.15)' },
  convertido: { color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
  erro:       { color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
}

export default function ContatosImportados() {
  const [contatos, setContatos] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState('')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(null)
  const [contatoSel, setContatoSel] = useState(null)
  const [modelos, setModelos] = useState([])
  const [mensagem, setMensagem] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erroEnvio, setErroEnvio] = useState('')
  const [importando, setImportando] = useState(false)
  const [resultImport, setResultImport] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)
  const [modalTransferir, setModalTransferir] = useState(false)
  const [contatoTransf, setContatoTransf] = useState(null)
  const [corretores, setCorretores] = useState([])
  const [tipoAtrib, setTipoAtrib] = useState('roundRobin')
  const [corretorIdSel, setCorretorIdSel] = useState('')
  const [transferindo, setTransferindo] = useState(false)
  const [erroTransf, setErroTransf] = useState('')
  const [toast, setToast] = useState('')

  const carregar = useCallback(() => {
    setLoading(true)
    const params = { page, limit: 50 }
    if (filtroStatus) params.status = filtroStatus
    contatosApi.listar(params)
      .then((res) => {
        setContatos(res.data.contatos)
        setTotal(res.data.total)
      })
      .finally(() => setLoading(false))
  }, [page, filtroStatus])

  useEffect(() => { carregar() }, [carregar])
  useEffect(() => { modelosApi.listar().then((res) => setModelos(res.data)) }, [])

  const importarArquivo = async (file) => {
    if (!file) return
    const fd = new FormData()
    fd.append('arquivo', file)
    setImportando(true)
    setResultImport(null)
    try {
      const res = await contatosApi.importar(fd)
      setResultImport(res.data)
      carregar()
    } catch (err) {
      setResultImport({ erro: err.response?.data?.error || 'Erro ao importar' })
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

  const abrirEnviar = (contato) => {
    setContatoSel(contato)
    setMensagem('')
    setErroEnvio('')
    setModal('enviar')
  }

  const enviar = async () => {
    if (!mensagem.trim()) return
    setEnviando(true)
    setErroEnvio('')
    try {
      await contatosApi.enviarMensagem(contatoSel.id, mensagem)
      setModal(null)
      carregar()
    } catch (err) {
      setErroEnvio(err.response?.data?.error || 'Erro ao enviar mensagem')
    } finally {
      setEnviando(false)
    }
  }

  const remover = async (contato) => {
    if (!confirm(`Remover contato "${contato.nome}"?`)) return
    await contatosApi.remover(contato.id)
    carregar()
  }

  const abrirTransferir = async (contato) => {
    setContatoTransf(contato)
    setTipoAtrib('roundRobin')
    setCorretorIdSel('')
    setErroTransf('')
    setModalTransferir(true)
    if (corretores.length === 0) {
      try {
        const res = await corretoresApi.listar({ ativo: true })
        setCorretores(res.data.corretores || [])
      } catch {}
    }
  }

  const confirmarTransferir = async () => {
    setTransferindo(true)
    setErroTransf('')
    try {
      await contatosApi.transferir(contatoTransf.id, tipoAtrib === 'especifico' ? corretorIdSel : null)
      setModalTransferir(false)
      setToast('Contato transferido e lead criado com sucesso!')
      setTimeout(() => setToast(''), 4000)
      carregar()
    } catch (err) {
      setErroTransf(err.response?.data?.error || 'Erro ao transferir contato')
    } finally {
      setTransferindo(false)
    }
  }

  const totalPages = Math.ceil(total / 50)

  return (
    <div className="space-y-4">
      {/* Importar zona */}
      <div
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => fileInputRef.current?.click()}
        className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center py-8 cursor-pointer transition-colors"
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
        <p className="text-xs mt-1" style={{ color: '#64748B' }}>Colunas necessárias: nome, telefone</p>
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
            : `${resultImport.importados} importados · ${resultImport.duplicados} duplicados ignorados · ${resultImport.erros} com erro`}
        </div>
      )}

      {/* Aviso de limite */}
      <div
        className="rounded-lg px-4 py-3 text-sm flex items-start gap-2"
        style={{ backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#F59E0B' }}
      >
        <span className="flex-shrink-0 mt-0.5">⚠</span>
        <span>Recomendamos enviar no máximo 20–30 mensagens por dia para evitar bloqueio do número WhatsApp.</span>
      </div>

      {/* Filtros e contagem */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm" style={{ color: '#64748B' }}>{total} contatos</p>
        <select
          className="input sm:max-w-[180px]"
          value={filtroStatus}
          onChange={(e) => { setFiltroStatus(e.target.value); setPage(1) }}
        >
          <option value="">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="enviado">Enviado</option>
          <option value="convertido">Convertido em lead</option>
          <option value="erro">Erro</option>
        </select>
      </div>

      {/* Tabela */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500" />
          </div>
        ) : contatos.length === 0 ? (
          <p className="text-center py-16 text-sm" style={{ color: '#64748B' }}>
            Nenhum contato importado ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead style={{ backgroundColor: '#0B1120', borderBottom: '1px solid #1E293B' }}>
                <tr>
                  {['Nome', 'Telefone', 'Status', 'Importado em', ''].map((h, i) => (
                    <th
                      key={i}
                      className={`text-left px-4 py-3 font-medium text-xs uppercase tracking-wide ${i === 1 ? 'hidden sm:table-cell' : i === 3 ? 'hidden md:table-cell' : ''}`}
                      style={{ color: '#64748B' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contatos.map((c, idx) => {
                  const badge = STATUS_STYLE[c.status] || STATUS_STYLE.pendente
                  return (
                    <tr
                      key={c.id}
                      style={{
                        borderBottom: '1px solid #1E293B',
                        backgroundColor: idx % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a2332'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = idx % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent'}
                    >
                      <td className="px-4 py-3 font-medium" style={{ color: '#F1F5F9' }}>{c.nome}</td>
                      <td className="px-4 py-3 hidden sm:table-cell" style={{ color: '#94A3B8' }}>{c.telefone}</td>
                      <td className="px-4 py-3">
                        <span className="badge" style={{ color: badge.color, backgroundColor: badge.bg }}>
                          {c.status === 'convertido' ? 'lead criado' : c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell" style={{ color: '#64748B' }}>
                        {new Intl.DateTimeFormat('pt-BR').format(new Date(c.criadoEm))}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 flex-wrap">
                          {(c.status === 'pendente' || c.status === 'erro') && (
                            <button
                              onClick={() => abrirEnviar(c)}
                              className="text-xs font-medium hover:opacity-80 transition-opacity"
                              style={{ color: '#818cf8' }}
                            >
                              Enviar msg
                            </button>
                          )}
                          {c.status !== 'convertido' && (
                            <button
                              onClick={() => abrirTransferir(c)}
                              className="text-xs font-medium hover:opacity-80 transition-opacity"
                              style={{ color: '#10B981' }}
                            >
                              Transferir
                            </button>
                          )}
                          <button
                            onClick={() => remover(c)}
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

      {/* Modal transferir para corretor */}
      {modalTransferir && contatoTransf && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div
            className="w-full rounded-t-2xl sm:rounded-2xl shadow-2xl sm:max-w-lg"
            style={{ backgroundColor: '#111827', border: '1px solid #1E293B' }}
          >
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #1E293B' }}>
              <div>
                <h2 className="font-bold" style={{ color: '#F1F5F9' }}>Transferir para corretor</h2>
                <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{contatoTransf.nome} · {contatoTransf.telefone}</p>
              </div>
              <button onClick={() => setModalTransferir(false)} className="text-xl leading-none hover:opacity-80" style={{ color: '#64748B' }}>×</button>
            </div>
            <div className="px-5 py-5 space-y-4">
              <div className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    className="mt-0.5 accent-indigo-500"
                    checked={tipoAtrib === 'roundRobin'}
                    onChange={() => setTipoAtrib('roundRobin')}
                  />
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#F1F5F9' }}>Próximo da fila (round-robin)</p>
                    <p className="text-xs" style={{ color: '#64748B' }}>Atribui ao próximo corretor disponível automaticamente</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    className="mt-0.5 accent-indigo-500"
                    checked={tipoAtrib === 'especifico'}
                    onChange={() => setTipoAtrib('especifico')}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: '#F1F5F9' }}>Corretor específico</p>
                    <p className="text-xs mb-2" style={{ color: '#64748B' }}>Escolha um corretor manualmente</p>
                    {tipoAtrib === 'especifico' && (
                      <select
                        className="input w-full"
                        value={corretorIdSel}
                        onChange={(e) => setCorretorIdSel(e.target.value)}
                      >
                        <option value="">Selecione um corretor...</option>
                        {corretores.map((cor) => (
                          <option key={cor.id} value={cor.id}>
                            {cor.nome}{!cor.disponivel ? ' (indisponível)' : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </label>
              </div>

              {erroTransf && <p className="text-sm" style={{ color: '#EF4444' }}>{erroTransf}</p>}

              <div className="flex gap-2 pt-1">
                <button onClick={() => setModalTransferir(false)} className="btn-secondary flex-1">Cancelar</button>
                <button
                  onClick={confirmarTransferir}
                  disabled={transferindo || (tipoAtrib === 'especifico' && !corretorIdSel)}
                  className="btn-primary flex-1"
                >
                  {transferindo ? 'Transferindo...' : 'Confirmar transferência'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast de sucesso */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-lg px-5 py-3 text-sm font-medium z-50 shadow-lg whitespace-nowrap"
          style={{ backgroundColor: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#10B981' }}
        >
          {toast}
        </div>
      )}

      {/* Modal enviar mensagem */}
      {modal === 'enviar' && contatoSel && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div
            className="w-full rounded-t-2xl sm:rounded-2xl shadow-2xl sm:max-w-lg max-h-[92vh] flex flex-col"
            style={{ backgroundColor: '#111827', border: '1px solid #1E293B' }}
          >
            <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid #1E293B' }}>
              <div>
                <h2 className="font-bold" style={{ color: '#F1F5F9' }}>Enviar mensagem</h2>
                <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{contatoSel.nome} · {contatoSel.telefone}</p>
              </div>
              <button onClick={() => setModal(null)} className="text-xl leading-none hover:opacity-80" style={{ color: '#64748B' }}>×</button>
            </div>
            <div className="px-5 py-5 overflow-y-auto space-y-4">
              {modelos.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-2" style={{ color: '#64748B' }}>Modelos rápidos</p>
                  <div className="space-y-2">
                    {modelos.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setMensagem(m.conteudo.replace('{{nome}}', contatoSel.nome))}
                        className="w-full text-left rounded-lg px-3 py-2.5 text-sm transition-colors"
                        style={{ backgroundColor: '#0B1120', border: '1px solid #1E293B', color: '#94A3B8' }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = '#6366f1'}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = '#1E293B'}
                      >
                        <span className="block text-xs font-medium mb-0.5" style={{ color: '#818cf8' }}>{m.nome}</span>
                        <span className="line-clamp-2">{m.conteudo}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="label">Mensagem personalizada</label>
                <textarea
                  className="input resize-none"
                  rows={4}
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  placeholder="Digite a mensagem ou selecione um modelo acima..."
                />
                <p className="text-xs mt-1" style={{ color: '#64748B' }}>{mensagem.length} caracteres</p>
              </div>

              {erroEnvio && <p className="text-sm" style={{ color: '#EF4444' }}>{erroEnvio}</p>}

              <div className="flex gap-2 pt-1">
                <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancelar</button>
                <button
                  onClick={enviar}
                  disabled={!mensagem.trim() || enviando}
                  className="btn-primary flex-1"
                >
                  {enviando ? 'Enviando...' : 'Enviar via WhatsApp'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
