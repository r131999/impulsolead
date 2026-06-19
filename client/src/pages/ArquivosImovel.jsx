import { useEffect, useRef, useState } from 'react'
import * as arquivosApi from '../api/arquivos-imovel'
import { usePermissao } from '../hooks/usePermissao'

const TIPOS = ['todos', 'foto', 'video', 'pdf']
const ICONE_TIPO = { foto: '🖼️', video: '🎬', pdf: '📄' }

function formatarTamanho(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatarData(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ── Modal de upload ────────────────────────────────────────────────────────────

const CHUNK_THRESHOLD = 10 * 1024 * 1024 // arquivos >= 10 MB usam chunks
const CHUNK_SIZE = 5 * 1024 * 1024        // cada parte = 5 MB

function gerarUploadId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
}

function ModalUpload({ onSalvo, onClose }) {
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState('foto')
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
        // ── Upload em chunks ──────────────────────────────────────────────────
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
          tipo,
          totalChunks,
        })
        setProgresso(100)
      } else {
        // ── Upload simples (fallback para arquivos < 10 MB) ───────────────────
        const fd = new FormData()
        fd.append('nome', nome.trim())
        fd.append('tipo', tipo)
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
          <h2 className="text-lg font-bold" style={{ color: '#F1F5F9' }}>Upload de arquivo</h2>
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
              placeholder="Ex: Book Village das Estrelas"
            />
          </div>

          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: '#94A3B8' }}>Tipo</label>
            <div className="flex gap-2">
              {['foto', 'video', 'pdf'].map((t) => (
                <button
                  key={t}
                  onClick={() => setTipo(t)}
                  className="flex-1 py-2 rounded-lg text-xs font-medium capitalize transition-colors"
                  style={{
                    backgroundColor: tipo === t ? 'rgba(99,102,241,0.2)' : '#1E293B',
                    color: tipo === t ? '#818cf8' : '#64748B',
                    border: tipo === t ? '1px solid rgba(99,102,241,0.4)' : '1px solid #1E293B',
                  }}
                >
                  {ICONE_TIPO[t]} {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: '#94A3B8' }}>Arquivo (max 100MB)</label>
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
                      Upload em partes de 5 MB ({Math.ceil(arquivo.size / CHUNK_SIZE)} partes)
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
              onChange={(e) => { setArquivo(e.target.files[0] || null); setProgresso(0) }}
            />
          </div>

          {salvando && usandoChunks && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs" style={{ color: '#94A3B8' }}>
                  {progresso < 100 ? `Enviando partes... ${progresso}%` : 'Finalizando...'}
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

// ── Página principal ───────────────────────────────────────────────────────────

export default function ArquivosImovel() {
  const podeArquivos = usePermissao('arquivosImovel')

  const [arquivos, setArquivos] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todos')
  const [modalUpload, setModalUpload] = useState(false)
  const [deletando, setDeletando] = useState(null)
  const [abrindo, setAbrindo] = useState(null)
  const [progressoAbrindo, setProgressoAbrindo] = useState(0)
  const [erroDownload, setErroDownload] = useState('')

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

  const carregar = async () => {
    setLoading(true)
    try {
      const res = await arquivosApi.listar()
      setArquivos(res.data.arquivos || [])
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { carregar() }, [])

  const deletar = async (id) => {
    if (!window.confirm('Remover este arquivo?')) return
    setDeletando(id)
    try {
      await arquivosApi.deletar(id)
      setArquivos((prev) => prev.filter((a) => a.id !== id))
    } catch {}
    finally { setDeletando(null) }
  }

  const filtrados = filtro === 'todos' ? arquivos : arquivos.filter((a) => a.tipo === filtro)

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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="px-4 py-3 md:px-6 md:py-4 flex items-center justify-between flex-shrink-0"
        style={{ borderBottom: '1px solid #1E293B', backgroundColor: '#111827' }}
      >
        <div>
          <h1 className="text-lg md:text-xl font-bold" style={{ color: '#F1F5F9' }}>
            📁 Arquivos de Imóveis
          </h1>
          <p className="text-xs md:text-sm" style={{ color: '#94A3B8' }}>
            {arquivos.length} arquivo{arquivos.length !== 1 ? 's' : ''} cadastrado{arquivos.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setModalUpload(true)}
          className="text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          style={{ backgroundColor: 'rgba(99,102,241,0.2)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.3)' }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.2)' }}
        >
          + Upload
        </button>
      </div>

      {/* Filtros */}
      <div
        className="px-4 py-3 flex gap-2 flex-shrink-0"
        style={{ borderBottom: '1px solid #1E293B', backgroundColor: '#0F172A' }}
      >
        {TIPOS.map((t) => (
          <button
            key={t}
            onClick={() => setFiltro(t)}
            className="px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors"
            style={{
              backgroundColor: filtro === t ? 'rgba(99,102,241,0.25)' : '#1E293B',
              color: filtro === t ? '#818cf8' : '#64748B',
            }}
          >
            {t === 'todos' ? 'Todos' : `${ICONE_TIPO[t]} ${t.charAt(0).toUpperCase() + t.slice(1)}`}
          </button>
        ))}
      </div>

      {/* Erro de download */}
      {erroDownload && (
        <div
          className="mx-4 mt-3 p-3 rounded-lg flex items-center justify-between flex-shrink-0"
          style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}
        >
          <p className="text-xs" style={{ color: '#EF4444' }}>{erroDownload}</p>
          <button onClick={() => setErroDownload('')} className="text-xs ml-3 leading-none" style={{ color: '#EF4444' }}>✕</button>
        </div>
      )}

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
          </div>
        )}

        {!loading && filtrados.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 gap-3">
            <span style={{ fontSize: 36 }}>📂</span>
            <p className="text-sm" style={{ color: '#64748B' }}>
              {filtro === 'todos' ? 'Nenhum arquivo cadastrado.' : `Nenhum arquivo do tipo "${filtro}".`}
            </p>
            <button
              onClick={() => setModalUpload(true)}
              className="text-xs px-4 py-2 rounded-lg transition-colors"
              style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: '#818cf8' }}
            >
              Fazer upload
            </button>
          </div>
        )}

        {!loading && filtrados.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtrados.map((a) => (
              <div
                key={a.id}
                className="rounded-xl p-4 flex flex-col gap-2"
                style={{ backgroundColor: '#111827', border: '1px solid #1E293B' }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-2xl flex-shrink-0">{ICONE_TIPO[a.tipo] || '📎'}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: '#F1F5F9' }}>
                        {a.nome}
                      </p>
                      <p className="text-xs" style={{ color: '#64748B' }}>
                        {a.tipo} · {formatarTamanho(a.tamanho)}
                      </p>
                    </div>
                  </div>
                </div>

                <p className="text-xs" style={{ color: '#475569' }}>
                  {formatarData(a.criadoEm)}
                </p>

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
                  <button
                    onClick={() => deletar(a.id)}
                    disabled={deletando === a.id}
                    className="flex-1 text-xs py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#EF4444' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.2)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)' }}
                  >
                    {deletando === a.id ? '...' : 'Remover'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalUpload && (
        <ModalUpload
          onSalvo={() => { setModalUpload(false); carregar() }}
          onClose={() => setModalUpload(false)}
        />
      )}
    </div>
  )
}
