import { useEffect, useRef, useState } from 'react'
import * as arquivosApi from '../api/arquivos-imovel'
import * as empreendimentosApi from '../api/empreendimentos'
import { usePermissao } from '../hooks/usePermissao'
import { useAuth } from '../context/AuthContext'

const CHUNK_THRESHOLD = 10 * 1024 * 1024
const CHUNK_SIZE = 5 * 1024 * 1024

const CATEGORIAS = [
  { key: 'foto',      label: 'Fotos',     icone: '🖼️', accept: 'image/jpeg,image/png,image/webp,image/gif',  desc: 'JPG, PNG, WebP, GIF' },
  { key: 'video',     label: 'Vídeos',    icone: '🎬', accept: 'video/mp4,video/quicktime',                  desc: 'MP4, MOV' },
  { key: 'book',      label: 'Books',     icone: '📚', accept: '.pdf,.doc,.docx,.xls,.xlsx',                 desc: 'PDF, Word, Excel' },
  { key: 'descricao', label: 'Descrição', icone: '📝', accept: null,                                         desc: 'Texto descritivo' },
]

// tipo legado gravado no ArquivoImovel para retrocompat com MateriaisCorretor/ChatLead
const CATEGORIA_TIPO = { foto: 'foto', video: 'video', book: 'pdf' }

function gerarUploadId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
}

function formatarTamanho(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatarData(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ── Modal empreendimento (criar / editar) ──────────────────────────────────────

function ModalEmpreendimento({ empreendimento, onSalvo, onClose }) {
  const editando = !!empreendimento
  const [nome, setNome] = useState(empreendimento?.nome || '')
  const [descricao, setDescricao] = useState(empreendimento?.descricao || '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const handleSubmit = async () => {
    if (!nome.trim()) return setErro('Nome é obrigatório')
    setSalvando(true)
    setErro('')
    try {
      if (editando) {
        await empreendimentosApi.editar(empreendimento.id, { nome: nome.trim(), descricao: descricao.trim() })
      } else {
        await empreendimentosApi.criar({ nome: nome.trim(), descricao: descricao.trim() })
      }
      onSalvo()
    } catch (e) {
      setErro(e.response?.data?.error || 'Erro ao salvar')
      setSalvando(false)
    }
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl shadow-2xl p-6"
        style={{ backgroundColor: '#111827', border: '1px solid #1E293B' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-bold" style={{ color: '#F1F5F9' }}>
            {editando ? 'Editar empreendimento' : 'Novo empreendimento'}
          </h2>
          <button onClick={onClose} className="text-xl leading-none ml-4" style={{ color: '#64748B' }}>✕</button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: '#94A3B8' }}>Nome *</label>
            <input
              className="input w-full"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Village das Estrelas"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: '#94A3B8' }}>Descrição (opcional)</label>
            <textarea
              className="input w-full resize-none"
              rows={3}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descrição do empreendimento..."
            />
          </div>
        </div>

        {erro && <p className="text-xs mt-3" style={{ color: '#EF4444' }}>{erro}</p>}

        <div className="flex gap-2 mt-4">
          <button onClick={onClose} disabled={salvando} className="btn-secondary flex-1">Cancelar</button>
          <button
            onClick={handleSubmit}
            disabled={salvando}
            className="flex-1 text-sm font-medium py-2 rounded-lg disabled:opacity-50 transition-colors"
            style={{ backgroundColor: 'rgba(99,102,241,0.2)', color: '#818cf8' }}
            onMouseEnter={(e) => { if (!salvando) e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.3)' }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.2)' }}
          >
            {salvando ? 'Salvando...' : (editando ? 'Salvar' : 'Criar')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal de upload ────────────────────────────────────────────────────────────

function ModalUpload({ empreendimentoId, categoria, onSalvo, onClose }) {
  const catConfig = CATEGORIAS.find((c) => c.key === categoria)
  const tipoBackend = CATEGORIA_TIPO[categoria] || 'pdf'

  const [nome, setNome] = useState('')
  const [arquivo, setArquivo] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [progresso, setProgresso] = useState(0)
  const [erro, setErro] = useState('')
  const fileRef = useRef(null)

  const handleSubmit = async () => {
    if (!nome.trim()) return setErro('Nome é obrigatório')
    if (!arquivo) return setErro('Selecione um arquivo')

    setSalvando(true)
    setErro('')
    setProgresso(0)

    try {
      if (arquivo.size >= CHUNK_THRESHOLD) {
        const uploadId = gerarUploadId()
        const totalChunks = Math.ceil(arquivo.size / CHUNK_SIZE)

        for (let i = 0; i < totalChunks; i++) {
          const start = i * CHUNK_SIZE
          const end = Math.min(start + CHUNK_SIZE, arquivo.size)
          const fd = new FormData()
          fd.append('uploadId', uploadId)
          fd.append('chunkIndex', String(i))
          fd.append('totalChunks', String(totalChunks))
          fd.append('fileName', arquivo.name)
          fd.append('chunk', arquivo.slice(start, end))
          await arquivosApi.uploadChunk(fd)
          setProgresso(Math.round(((i + 1) / totalChunks) * 90))
        }

        await arquivosApi.finalizarUploadChunk({
          uploadId,
          fileName: arquivo.name,
          nome: nome.trim(),
          tipo: tipoBackend,
          totalChunks,
          empreendimentoId,
          categoria,
        })
        setProgresso(100)
      } else {
        const fd = new FormData()
        fd.append('nome', nome.trim())
        fd.append('tipo', tipoBackend)
        fd.append('empreendimentoId', empreendimentoId)
        fd.append('categoria', categoria)
        fd.append('arquivo', arquivo)
        await arquivosApi.upload(fd)
      }

      onSalvo()
    } catch (e) {
      setErro(e.response?.data?.error || 'Erro ao fazer upload')
      setSalvando(false)
      setProgresso(0)
    }
  }

  const usandoChunks = arquivo && arquivo.size >= CHUNK_THRESHOLD

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl shadow-2xl p-6"
        style={{ backgroundColor: '#111827', border: '1px solid #1E293B' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-bold" style={{ color: '#F1F5F9' }}>
            Upload — {catConfig?.label}
          </h2>
          <button onClick={onClose} className="text-xl leading-none ml-4" style={{ color: '#64748B' }}>✕</button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: '#94A3B8' }}>
              Nome de identificação
            </label>
            <input
              className="input w-full"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder={categoria === 'book' ? 'Ex: Book Village das Estrelas' : 'Ex: Fachada principal'}
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: '#94A3B8' }}>
              Arquivo (max 100MB) — {catConfig?.desc}
            </label>
            <div
              className="rounded-lg p-4 text-center cursor-pointer transition-colors"
              style={{ border: '2px dashed #1E293B', backgroundColor: '#0B1120' }}
              onClick={() => fileRef.current?.click()}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1E293B' }}
            >
              {arquivo ? (
                <div>
                  <p className="text-sm font-medium truncate" style={{ color: '#818cf8' }}>{arquivo.name}</p>
                  {usandoChunks && (
                    <p className="text-xs mt-1" style={{ color: '#475569' }}>
                      Upload em partes ({Math.ceil(arquivo.size / CHUNK_SIZE)} partes de 5 MB)
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm" style={{ color: '#475569' }}>Clique para selecionar</p>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept={catConfig?.accept}
              onChange={(e) => { setArquivo(e.target.files[0] || null); setProgresso(0) }}
            />
          </div>

          {salvando && usandoChunks && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs" style={{ color: '#94A3B8' }}>
                  {progresso < 100 ? `Enviando... ${progresso}%` : 'Finalizando...'}
                </span>
                <span className="text-xs font-medium" style={{ color: '#818cf8' }}>{progresso}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#1E293B' }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${progresso}%`, backgroundColor: '#818cf8' }}
                />
              </div>
            </div>
          )}
        </div>

        {erro && <p className="text-xs mt-3" style={{ color: '#EF4444' }}>{erro}</p>}

        <div className="flex gap-2 mt-4">
          <button onClick={onClose} disabled={salvando} className="btn-secondary flex-1">Cancelar</button>
          <button
            onClick={handleSubmit}
            disabled={salvando}
            className="flex-1 text-sm font-medium py-2 rounded-lg disabled:opacity-50 transition-colors"
            style={{ backgroundColor: 'rgba(99,102,241,0.2)', color: '#818cf8' }}
            onMouseEnter={(e) => { if (!salvando) e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.3)' }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.2)' }}
          >
            {salvando
              ? (usandoChunks ? `Enviando... ${progresso}%` : 'Enviando...')
              : 'Fazer upload'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Componente de botão "voltar" ───────────────────────────────────────────────

function BotaoVoltar({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="p-1.5 rounded-lg flex-shrink-0 text-sm font-medium"
      style={{ backgroundColor: '#1E293B', color: '#94A3B8' }}
      onMouseEnter={(e) => { e.currentTarget.style.color = '#F1F5F9' }}
      onMouseLeave={(e) => { e.currentTarget.style.color = '#94A3B8' }}
    >
      ← Voltar
    </button>
  )
}

// ── Página principal ───────────────────────────────────────────────────────────

export default function ArquivosImovel() {
  const podeArquivos = usePermissao('arquivosImovel')
  const { usuario } = useAuth()
  const podeGerenciar = ['gestor', 'gerente', 'admin'].includes(usuario?.role)

  // Navegação
  const [nivel, setNivel] = useState('empreendimentos') // 'empreendimentos' | 'categorias' | 'arquivos' | 'descricao'
  const [empreendimentoAtual, setEmpreendimentoAtual] = useState(null)
  const [categoriaAtual, setCategoriaAtual] = useState(null)

  // Dados
  const [empreendimentos, setEmpreendimentos] = useState([])
  const [arquivos, setArquivos] = useState([])
  const [loadingEmps, setLoadingEmps] = useState(true)
  const [loadingArquivos, setLoadingArquivos] = useState(false)

  // Modais
  const [modalEmpreendimento, setModalEmpreendimento] = useState(null) // null | 'criar' | {objeto}
  const [modalUpload, setModalUpload] = useState(false)

  // Estados diversos
  const [deletandoArquivo, setDeletandoArquivo] = useState(null)
  const [deletandoEmp, setDeletandoEmp] = useState(null)
  const [erroDeletarEmp, setErroDeletarEmp] = useState('')
  const [abrindo, setAbrindo] = useState(null)
  const [progressoAbrindo, setProgressoAbrindo] = useState(0)
  const [erroDownload, setErroDownload] = useState('')
  const [descricaoEditavel, setDescricaoEditavel] = useState('')
  const [salvandoDescricao, setSalvandoDescricao] = useState(false)
  const [erroDescricao, setErroDescricao] = useState('')
  const [sucessoDescricao, setSucessoDescricao] = useState(false)

  const carregarEmpreendimentos = async () => {
    setLoadingEmps(true)
    try {
      const res = await empreendimentosApi.listar()
      setEmpreendimentos(res.data.empreendimentos || [])
    } catch {}
    finally { setLoadingEmps(false) }
  }

  const carregarArquivos = async (empId, cat) => {
    setLoadingArquivos(true)
    try {
      const res = await arquivosApi.listar({ empreendimentoId: empId, categoria: cat })
      setArquivos(res.data.arquivos || [])
    } catch {}
    finally { setLoadingArquivos(false) }
  }

  useEffect(() => { carregarEmpreendimentos() }, [])

  // ── Navegação ─────────────────────────────────────────────────────────────────

  const abrirEmpreendimento = (emp) => {
    setEmpreendimentoAtual(emp)
    setCategoriaAtual(null)
    setErroDeletarEmp('')
    setNivel('categorias')
  }

  const abrirCategoria = (cat) => {
    if (cat === 'descricao') {
      setDescricaoEditavel(empreendimentoAtual?.descricao || '')
      setErroDescricao('')
      setSucessoDescricao(false)
      setNivel('descricao')
    } else {
      setCategoriaAtual(cat)
      setNivel('arquivos')
      carregarArquivos(empreendimentoAtual.id, cat)
    }
  }

  const voltarParaEmpreendimentos = () => {
    setNivel('empreendimentos')
    setEmpreendimentoAtual(null)
    setCategoriaAtual(null)
    carregarEmpreendimentos()
  }

  const voltarParaCategorias = () => {
    setNivel('categorias')
    setCategoriaAtual(null)
    setArquivos([])
    setErroDownload('')
  }

  // ── Ações ──────────────────────────────────────────────────────────────────────

  const downloadArquivo = async (arquivo) => {
    setAbrindo(arquivo.id)
    setProgressoAbrindo(0)
    setErroDownload('')
    try {
      const token = localStorage.getItem('token')
      const resp = await fetch(`/api/arquivos-imovel/${arquivo.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!resp.ok) throw new Error()

      const total = Number(resp.headers.get('content-length')) || 0
      const reader = resp.body.getReader()
      const chunks = []
      let recebido = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        recebido += value.length
        if (total > 0) setProgressoAbrindo(Math.round((recebido / total) * 100))
      }

      const blob = new Blob(chunks, { type: resp.headers.get('content-type') || 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const ext = arquivo.filename ? `.${arquivo.filename.split('.').pop()}` : ''
      const link = document.createElement('a')
      link.href = url
      link.download = arquivo.nome + ext
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch {
      setErroDownload('Erro ao abrir arquivo. Tente novamente.')
    } finally {
      setAbrindo(null)
      setProgressoAbrindo(0)
    }
  }

  const deletarArquivo = async (id) => {
    if (!window.confirm('Remover este arquivo?')) return
    setDeletandoArquivo(id)
    try {
      await arquivosApi.deletar(id)
      setArquivos((prev) => prev.filter((a) => a.id !== id))
    } catch {}
    finally { setDeletandoArquivo(null) }
  }

  const deletarEmpreendimento = async (emp) => {
    if (!window.confirm(`Excluir o empreendimento "${emp.nome}"?`)) return
    setDeletandoEmp(emp.id)
    setErroDeletarEmp('')
    try {
      await empreendimentosApi.deletar(emp.id)
      setEmpreendimentos((prev) => prev.filter((e) => e.id !== emp.id))
    } catch (e) {
      setErroDeletarEmp(e.response?.data?.error || 'Erro ao excluir empreendimento')
    } finally {
      setDeletandoEmp(null)
    }
  }

  const salvarDescricao = async () => {
    setSalvandoDescricao(true)
    setErroDescricao('')
    setSucessoDescricao(false)
    try {
      const res = await empreendimentosApi.editar(empreendimentoAtual.id, { descricao: descricaoEditavel })
      setEmpreendimentoAtual((prev) => ({ ...prev, descricao: res.data.empreendimento.descricao }))
      setSucessoDescricao(true)
      setTimeout(() => setSucessoDescricao(false), 3000)
    } catch (e) {
      setErroDescricao(e.response?.data?.error || 'Erro ao salvar')
    } finally {
      setSalvandoDescricao(false)
    }
  }

  // ── Gate de permissão ─────────────────────────────────────────────────────────

  if (!podeArquivos) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <h1 className="text-xl font-bold mb-6" style={{ color: '#F1F5F9' }}>📁 Arquivos de Imóveis</h1>
        <div style={{ position: 'relative', minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, backdropFilter: 'blur(4px)', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 12, zIndex: 10 }} />
          <div style={{ position: 'relative', zIndex: 20, textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
            <h3 style={{ color: '#F1F5F9', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              Arquivos de Imóveis disponível em um plano superior
            </h3>
            <p style={{ color: '#94A3B8', marginBottom: 20, fontSize: 14 }}>Entre em contato com o suporte para fazer upgrade.</p>
            <a
              href="https://wa.me/5598981444954"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-block', backgroundColor: '#25D366', color: '#fff', fontWeight: 700, padding: '10px 24px', borderRadius: 8, textDecoration: 'none', fontSize: 14 }}
            >
              Falar com suporte
            </a>
          </div>
        </div>
      </div>
    )
  }

  const catLabel = CATEGORIAS.find((c) => c.key === categoriaAtual)?.label

  // ── Nível 1: Lista de empreendimentos ─────────────────────────────────────────

  if (nivel === 'empreendimentos') {
    return (
      <div className="flex flex-col h-full">
        <div
          className="px-4 py-3 md:px-6 md:py-4 flex items-center justify-between flex-shrink-0"
          style={{ borderBottom: '1px solid #1E293B', backgroundColor: '#111827' }}
        >
          <div>
            <h1 className="text-lg md:text-xl font-bold" style={{ color: '#F1F5F9' }}>📁 Arquivos de Imóveis</h1>
            <p className="text-xs md:text-sm" style={{ color: '#94A3B8' }}>
              {empreendimentos.length} empreendimento{empreendimentos.length !== 1 ? 's' : ''}
            </p>
          </div>
          {podeGerenciar && (
            <button
              onClick={() => setModalEmpreendimento('criar')}
              className="text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              style={{ backgroundColor: 'rgba(99,102,241,0.2)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.3)' }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.2)' }}
            >
              + Empreendimento
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {erroDeletarEmp && (
            <div
              className="mb-4 p-3 rounded-lg flex items-center justify-between"
              style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}
            >
              <p className="text-xs" style={{ color: '#EF4444' }}>{erroDeletarEmp}</p>
              <button onClick={() => setErroDeletarEmp('')} className="text-xs ml-3 leading-none" style={{ color: '#EF4444' }}>✕</button>
            </div>
          )}

          {loadingEmps && (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
            </div>
          )}

          {!loadingEmps && empreendimentos.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 gap-3">
              <span style={{ fontSize: 36 }}>🏗️</span>
              <p className="text-sm" style={{ color: '#64748B' }}>Nenhum empreendimento cadastrado.</p>
              {podeGerenciar && (
                <button
                  onClick={() => setModalEmpreendimento('criar')}
                  className="text-xs px-4 py-2 rounded-lg"
                  style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: '#818cf8' }}
                >
                  Criar empreendimento
                </button>
              )}
            </div>
          )}

          {!loadingEmps && empreendimentos.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {empreendimentos.map((emp) => (
                <div
                  key={emp.id}
                  className="rounded-xl p-4 flex flex-col gap-2 cursor-pointer transition-colors"
                  style={{ backgroundColor: '#111827', border: '1px solid #1E293B' }}
                  onClick={() => abrirEmpreendimento(emp)}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1E293B' }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <span style={{ fontSize: 26, flexShrink: 0 }}>🏢</span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: '#F1F5F9' }}>{emp.nome}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                          {emp._count?.arquivos ?? 0} arquivo{(emp._count?.arquivos ?? 0) !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>

                    {podeGerenciar && (
                      <div className="flex gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setModalEmpreendimento(emp)}
                          className="p-1.5 rounded-lg transition-colors text-xs"
                          style={{ backgroundColor: 'rgba(99,102,241,0.1)', color: '#818cf8' }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.2)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.1)' }}
                          title="Editar"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => deletarEmpreendimento(emp)}
                          disabled={deletandoEmp === emp.id}
                          className="p-1.5 rounded-lg transition-colors text-xs disabled:opacity-50"
                          style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#EF4444' }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.2)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)' }}
                          title="Excluir"
                        >
                          {deletandoEmp === emp.id ? '...' : '🗑'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {modalEmpreendimento && (
          <ModalEmpreendimento
            empreendimento={modalEmpreendimento === 'criar' ? null : modalEmpreendimento}
            onSalvo={() => { setModalEmpreendimento(null); carregarEmpreendimentos() }}
            onClose={() => setModalEmpreendimento(null)}
          />
        )}
      </div>
    )
  }

  // ── Nível 2: Categorias do empreendimento ─────────────────────────────────────

  if (nivel === 'categorias') {
    return (
      <div className="flex flex-col h-full">
        <div
          className="px-4 py-3 md:px-6 md:py-4 flex items-center gap-3 flex-shrink-0"
          style={{ borderBottom: '1px solid #1E293B', backgroundColor: '#111827' }}
        >
          <BotaoVoltar onClick={voltarParaEmpreendimentos} />
          <div className="min-w-0">
            <p className="text-xs" style={{ color: '#64748B' }}>
              Arquivos de Imóveis › <span style={{ color: '#94A3B8' }}>{empreendimentoAtual?.nome}</span>
            </p>
            <h1 className="text-lg font-bold truncate" style={{ color: '#F1F5F9' }}>
              {empreendimentoAtual?.nome}
            </h1>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-3">
            {CATEGORIAS.map((cat) => (
              <button
                key={cat.key}
                onClick={() => abrirCategoria(cat.key)}
                className="rounded-xl p-5 flex flex-col items-center gap-3 text-center transition-colors"
                style={{ backgroundColor: '#111827', border: '1px solid #1E293B' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1E293B' }}
              >
                <span style={{ fontSize: 32 }}>{cat.icone}</span>
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>{cat.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{cat.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Nível 3b: Descrição ───────────────────────────────────────────────────────

  if (nivel === 'descricao') {
    return (
      <div className="flex flex-col h-full">
        <div
          className="px-4 py-3 md:px-6 md:py-4 flex items-center gap-3 flex-shrink-0"
          style={{ borderBottom: '1px solid #1E293B', backgroundColor: '#111827' }}
        >
          <BotaoVoltar onClick={voltarParaCategorias} />
          <div className="min-w-0">
            <p className="text-xs" style={{ color: '#64748B' }}>
              Arquivos de Imóveis › {empreendimentoAtual?.nome} › <span style={{ color: '#94A3B8' }}>Descrição</span>
            </p>
            <h1 className="text-lg font-bold" style={{ color: '#F1F5F9' }}>Descrição</h1>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div
            className="rounded-xl p-4 flex flex-col gap-3"
            style={{ backgroundColor: '#111827', border: '1px solid #1E293B' }}
          >
            <label className="text-xs font-medium" style={{ color: '#94A3B8' }}>
              Descrição do empreendimento
            </label>
            <textarea
              className="input w-full resize-none"
              rows={8}
              value={descricaoEditavel}
              onChange={(e) => setDescricaoEditavel(e.target.value)}
              placeholder="Escreva uma descrição para este empreendimento..."
              style={{ minHeight: 160 }}
            />
            {erroDescricao && <p className="text-xs" style={{ color: '#EF4444' }}>{erroDescricao}</p>}
            {sucessoDescricao && <p className="text-xs" style={{ color: '#22C55E' }}>Descrição salva com sucesso!</p>}
            <div className="flex justify-end">
              <button
                onClick={salvarDescricao}
                disabled={salvandoDescricao}
                className="text-sm font-medium py-2 px-6 rounded-lg disabled:opacity-50 transition-colors"
                style={{ backgroundColor: 'rgba(99,102,241,0.2)', color: '#818cf8' }}
                onMouseEnter={(e) => { if (!salvandoDescricao) e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.3)' }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.2)' }}
              >
                {salvandoDescricao ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Nível 3a: Arquivos de uma categoria ───────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      <div
        className="px-4 py-3 md:px-6 md:py-4 flex items-center justify-between flex-shrink-0"
        style={{ borderBottom: '1px solid #1E293B', backgroundColor: '#111827' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <BotaoVoltar onClick={voltarParaCategorias} />
          <div className="min-w-0">
            <p className="text-xs" style={{ color: '#64748B' }}>
              Arquivos de Imóveis › {empreendimentoAtual?.nome} › <span style={{ color: '#94A3B8' }}>{catLabel}</span>
            </p>
            <h1 className="text-lg font-bold" style={{ color: '#F1F5F9' }}>{catLabel}</h1>
          </div>
        </div>
        {podeGerenciar && (
          <button
            onClick={() => setModalUpload(true)}
            className="text-sm font-medium px-4 py-2 rounded-lg transition-colors flex-shrink-0 ml-3"
            style={{ backgroundColor: 'rgba(99,102,241,0.2)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.3)' }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.2)' }}
          >
            + Upload
          </button>
        )}
      </div>

      {erroDownload && (
        <div
          className="mx-4 mt-3 p-3 rounded-lg flex items-center justify-between flex-shrink-0"
          style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}
        >
          <p className="text-xs" style={{ color: '#EF4444' }}>{erroDownload}</p>
          <button onClick={() => setErroDownload('')} className="text-xs ml-3 leading-none" style={{ color: '#EF4444' }}>✕</button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {loadingArquivos && (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
          </div>
        )}

        {!loadingArquivos && arquivos.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 gap-3">
            <span style={{ fontSize: 36 }}>📂</span>
            <p className="text-sm" style={{ color: '#64748B' }}>Nenhum arquivo nesta categoria.</p>
            {podeGerenciar && (
              <button
                onClick={() => setModalUpload(true)}
                className="text-xs px-4 py-2 rounded-lg"
                style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: '#818cf8' }}
              >
                Fazer upload
              </button>
            )}
          </div>
        )}

        {!loadingArquivos && arquivos.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {arquivos.map((a) => (
              <div
                key={a.id}
                className="rounded-xl p-4 flex flex-col gap-2"
                style={{ backgroundColor: '#111827', border: '1px solid #1E293B' }}
              >
                <div className="flex items-start gap-2">
                  <span className="text-2xl flex-shrink-0">
                    {categoriaAtual === 'foto' ? '🖼️' : categoriaAtual === 'video' ? '🎬' : '📚'}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: '#F1F5F9' }}>{a.nome}</p>
                    <p className="text-xs" style={{ color: '#64748B' }}>{formatarTamanho(a.tamanho)}</p>
                  </div>
                </div>

                <p className="text-xs" style={{ color: '#475569' }}>{formatarData(a.criadoEm)}</p>

                <div className="flex gap-2 mt-auto pt-1" style={{ borderTop: '1px solid #1E293B' }}>
                  <button
                    onClick={() => downloadArquivo(a)}
                    disabled={abrindo === a.id}
                    className="flex-1 text-center text-xs py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    style={{ backgroundColor: '#1E293B', color: '#94A3B8' }}
                    onMouseEnter={(e) => { if (abrindo !== a.id) e.currentTarget.style.color = '#F1F5F9' }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#94A3B8' }}
                  >
                    {abrindo === a.id
                      ? `${progressoAbrindo > 0 ? progressoAbrindo + '%' : '...'}`
                      : 'Abrir'}
                  </button>
                  {podeGerenciar && (
                    <button
                      onClick={() => deletarArquivo(a.id)}
                      disabled={deletandoArquivo === a.id}
                      className="flex-1 text-xs py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#EF4444' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.2)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)' }}
                    >
                      {deletandoArquivo === a.id ? '...' : 'Remover'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalUpload && (
        <ModalUpload
          empreendimentoId={empreendimentoAtual.id}
          categoria={categoriaAtual}
          onSalvo={() => { setModalUpload(false); carregarArquivos(empreendimentoAtual.id, categoriaAtual) }}
          onClose={() => setModalUpload(false)}
        />
      )}
    </div>
  )
}
