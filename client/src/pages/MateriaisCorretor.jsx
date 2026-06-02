import { useEffect, useState } from 'react'
import * as arquivosApi from '../api/arquivos-imovel'

const FILTROS = [
  { key: 'todos',  label: 'Todos'  },
  { key: 'foto',   label: 'Fotos'  },
  { key: 'video',  label: 'Vídeos' },
  { key: 'pdf',    label: 'PDFs'   },
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

const ICONE_POR_TIPO = { foto: IconeFoto, video: IconeVideo, pdf: IconePDF }

export default function MateriaisCorretor() {
  const [arquivos, setArquivos] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todos')
  const [baixando, setBaixando] = useState(null)
  const [erroDownload, setErroDownload] = useState('')

  useEffect(() => {
    arquivosApi.listar()
      .then((res) => setArquivos(res.data.arquivos || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const baixarArquivo = async (arquivo) => {
    setBaixando(arquivo.id)
    setErroDownload('')
    try {
      const token = localStorage.getItem('token')
      const resp = await fetch(`/api/arquivos-imovel/${arquivo.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!resp.ok) throw new Error()
      const blob = await resp.blob()
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
    }
  }

  const filtrados = filtro === 'todos' ? arquivos : arquivos.filter((a) => a.tipo === filtro)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
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

      {/* Filtros */}
      <div
        className="px-4 py-3 flex gap-2 flex-wrap flex-shrink-0"
        style={{ borderBottom: '1px solid #1E293B', backgroundColor: '#0F172A' }}
      >
        {FILTROS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFiltro(key)}
            className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
            style={{
              backgroundColor: filtro === key ? 'rgba(99,102,241,0.25)' : '#1E293B',
              color: filtro === key ? '#818cf8' : '#64748B',
            }}
          >
            {label}
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
          <button
            onClick={() => setErroDownload('')}
            className="text-xs ml-3 leading-none"
            style={{ color: '#EF4444' }}
          >
            ✕
          </button>
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
              {filtro === 'todos'
                ? 'Nenhum material disponível ainda.'
                : 'Nenhum arquivo deste tipo.'}
            </p>
          </div>
        )}

        {!loading && filtrados.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtrados.map((a) => {
              const Icone = ICONE_POR_TIPO[a.tipo] || IconePDF
              return (
                <div
                  key={a.id}
                  className="rounded-xl p-4 flex flex-col gap-2"
                  style={{ backgroundColor: '#111827', border: '1px solid #1E293B' }}
                >
                  {/* Ícone */}
                  <div
                    className="flex items-center justify-center rounded-lg mb-1"
                    style={{ height: 64, backgroundColor: '#0B1120' }}
                  >
                    <Icone size={36} />
                  </div>

                  {/* Info */}
                  <div className="min-w-0">
                    <p
                      className="text-sm font-semibold truncate leading-tight"
                      style={{ color: '#F1F5F9' }}
                      title={a.nome}
                    >
                      {a.nome}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                      {formatarTamanho(a.tamanho)}
                    </p>
                    <p className="text-xs" style={{ color: '#475569' }}>
                      {formatarData(a.criadoEm)}
                    </p>
                  </div>

                  {/* Botão */}
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
                    {baixando === a.id ? 'Baixando...' : '⬇ Baixar'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
