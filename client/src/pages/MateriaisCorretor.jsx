import { useEffect, useState } from 'react'
import * as arquivosApi from '../api/arquivos-imovel'
import * as empreendimentosApi from '../api/empreendimentos'

const CATEGORIAS = [
  { key: 'foto',      label: 'Fotos',     icone: '🖼️', desc: 'JPG, PNG, WebP, GIF' },
  { key: 'video',     label: 'Vídeos',    icone: '🎬', desc: 'MP4, MOV' },
  { key: 'book',      label: 'Books',     icone: '📚', desc: 'PDF, Word, Excel' },
  { key: 'descricao', label: 'Descrição', icone: '📝', desc: 'Texto descritivo' },
]

function formatarTamanho(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatarData(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function IconeFoto({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  )
}

function IconeVideo({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
    </svg>
  )
}

function IconePDF({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  )
}

const ICONE_POR_CATEGORIA = { foto: IconeFoto, video: IconeVideo, book: IconePDF }

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

export default function MateriaisCorretor() {
  // Navegação
  const [nivel, setNivel] = useState('empreendimentos') // 'empreendimentos' | 'categorias' | 'arquivos' | 'descricao'
  const [empreendimentoAtual, setEmpreendimentoAtual] = useState(null)
  const [categoriaAtual, setCategoriaAtual] = useState(null)

  // Dados
  const [empreendimentos, setEmpreendimentos] = useState([])
  const [loadingEmps, setLoadingEmps] = useState(true)
  const [arquivos, setArquivos] = useState([])
  const [loadingArquivos, setLoadingArquivos] = useState(false)

  // Download
  const [baixando, setBaixando] = useState(null)
  const [progressoBaixando, setProgressoBaixando] = useState(0)
  const [erroDownload, setErroDownload] = useState('')

  useEffect(() => {
    empreendimentosApi.listar()
      .then((res) => setEmpreendimentos(res.data.empreendimentos || []))
      .catch(() => {})
      .finally(() => setLoadingEmps(false))
  }, [])

  // ── Navegação ─────────────────────────────────────────────────────────────────

  const abrirEmpreendimento = (emp) => {
    setEmpreendimentoAtual(emp)
    setCategoriaAtual(null)
    setNivel('categorias')
  }

  const abrirCategoria = (cat) => {
    if (cat === 'descricao') {
      setNivel('descricao')
    } else {
      setCategoriaAtual(cat)
      setNivel('arquivos')
      setLoadingArquivos(true)
      arquivosApi.listar({ empreendimentoId: empreendimentoAtual.id, categoria: cat })
        .then((res) => setArquivos(res.data.arquivos || []))
        .catch(() => {})
        .finally(() => setLoadingArquivos(false))
    }
  }

  const voltarParaEmpreendimentos = () => {
    setNivel('empreendimentos')
    setEmpreendimentoAtual(null)
    setCategoriaAtual(null)
  }

  const voltarParaCategorias = () => {
    setNivel('categorias')
    setCategoriaAtual(null)
    setArquivos([])
    setErroDownload('')
  }

  // ── Download ──────────────────────────────────────────────────────────────────

  const baixarArquivo = async (arquivo) => {
    setBaixando(arquivo.id)
    setProgressoBaixando(0)
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
        if (total > 0) setProgressoBaixando(Math.round((recebido / total) * 100))
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
      setErroDownload('Erro ao baixar arquivo. Tente novamente.')
    } finally {
      setBaixando(null)
      setProgressoBaixando(0)
    }
  }

  const catLabel = CATEGORIAS.find((c) => c.key === categoriaAtual)?.label

  // ── Nível 1: Empreendimentos ──────────────────────────────────────────────────

  if (nivel === 'empreendimentos') {
    return (
      <div className="flex flex-col h-full">
        <div
          className="px-4 py-3 md:px-6 md:py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid #1E293B', backgroundColor: '#111827' }}
        >
          <h1 className="text-lg md:text-xl font-bold" style={{ color: '#F1F5F9' }}>
            📁 Materiais de Vendas
          </h1>
          <p className="text-xs md:text-sm mt-0.5" style={{ color: '#94A3B8' }}>
            Baixe fotos, vídeos e documentos dos empreendimentos
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loadingEmps && (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
            </div>
          )}

          {!loadingEmps && empreendimentos.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 gap-3">
              <span style={{ fontSize: 36 }}>📂</span>
              <p className="text-sm" style={{ color: '#64748B' }}>Nenhum material disponível ainda.</p>
            </div>
          )}

          {!loadingEmps && empreendimentos.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {empreendimentos.map((emp) => (
                <div
                  key={emp.id}
                  className="rounded-xl p-4 flex items-center gap-3 cursor-pointer transition-colors"
                  style={{ backgroundColor: '#111827', border: '1px solid #1E293B' }}
                  onClick={() => abrirEmpreendimento(emp)}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1E293B' }}
                >
                  <span style={{ fontSize: 26, flexShrink: 0 }}>🏢</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: '#F1F5F9' }}>{emp.nome}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                      {emp._count?.arquivos ?? 0} arquivo{(emp._count?.arquivos ?? 0) !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Nível 2: Categorias ───────────────────────────────────────────────────────

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
              Materiais de Vendas › <span style={{ color: '#94A3B8' }}>{empreendimentoAtual?.nome}</span>
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

  // ── Nível 3b: Descrição (somente leitura) ─────────────────────────────────────

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
              Materiais de Vendas › {empreendimentoAtual?.nome} › <span style={{ color: '#94A3B8' }}>Descrição</span>
            </p>
            <h1 className="text-lg font-bold" style={{ color: '#F1F5F9' }}>Descrição</h1>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div
            className="rounded-xl p-4"
            style={{ backgroundColor: '#111827', border: '1px solid #1E293B' }}
          >
            {empreendimentoAtual?.descricao ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#CBD5E1' }}>
                {empreendimentoAtual.descricao}
              </p>
            ) : (
              <p className="text-sm" style={{ color: '#475569' }}>Sem descrição cadastrada.</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Nível 3a: Arquivos de uma categoria ───────────────────────────────────────

  const Icone = ICONE_POR_CATEGORIA[categoriaAtual] || IconePDF

  return (
    <div className="flex flex-col h-full">
      <div
        className="px-4 py-3 md:px-6 md:py-4 flex items-center gap-3 flex-shrink-0"
        style={{ borderBottom: '1px solid #1E293B', backgroundColor: '#111827' }}
      >
        <BotaoVoltar onClick={voltarParaCategorias} />
        <div className="min-w-0">
          <p className="text-xs" style={{ color: '#64748B' }}>
            Materiais de Vendas › {empreendimentoAtual?.nome} › <span style={{ color: '#94A3B8' }}>{catLabel}</span>
          </p>
          <h1 className="text-lg font-bold" style={{ color: '#F1F5F9' }}>{catLabel}</h1>
        </div>
      </div>

      {erroDownload && (
        <div
          className="mx-4 mt-3 p-3 rounded-lg flex items-center justify-between flex-shrink-0"
          style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}
        >
          <p className="text-xs" style={{ color: '#EF4444' }}>{erroDownload}</p>
          <button
            onClick={() => setErroDownload('')}
            className="text-xs ml-3 leading-none"
            style={{ color: '#EF4444' }}
          >
            ✕
          </button>
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
          </div>
        )}

        {!loadingArquivos && arquivos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {arquivos.map((a) => (
              <div
                key={a.id}
                className="rounded-xl p-4 flex flex-col gap-2"
                style={{ backgroundColor: '#111827', border: '1px solid #1E293B' }}
              >
                <div
                  className="flex items-center justify-center rounded-lg mb-1"
                  style={{ height: 64, backgroundColor: '#0B1120' }}
                >
                  <Icone size={36} />
                </div>

                <div className="min-w-0">
                  <p
                    className="text-sm font-semibold truncate leading-tight"
                    style={{ color: '#F1F5F9' }}
                    title={a.nome}
                  >
                    {a.nome}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{formatarTamanho(a.tamanho)}</p>
                  <p className="text-xs" style={{ color: '#475569' }}>{formatarData(a.criadoEm)}</p>
                </div>

                <button
                  onClick={() => baixarArquivo(a)}
                  disabled={baixando === a.id}
                  className="mt-auto w-full text-xs font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
                  style={{
                    backgroundColor: 'rgba(99,102,241,0.15)',
                    color: '#818cf8',
                    border: '1px solid rgba(99,102,241,0.25)',
                  }}
                  onMouseEnter={(e) => { if (baixando !== a.id) e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.28)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.15)' }}
                >
                  {baixando === a.id
                    ? `Baixando... ${progressoBaixando > 0 ? progressoBaixando + '%' : ''}`
                    : '⬇ Baixar'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
