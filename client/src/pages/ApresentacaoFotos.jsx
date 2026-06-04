import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import * as apApi from '../api/apresentacao'

async function converterSeHeic(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  if (ext !== 'heic' && ext !== 'heif') return file
  const heic2any = (await import('heic2any')).default
  const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 })
  const nomeJpeg = file.name.replace(/\.(heic|heif)$/i, '.jpg')
  return new File([blob], nomeJpeg, { type: 'image/jpeg' })
}

export default function ApresentacaoFotos() {
  const { id } = useParams()
  const navigate = useNavigate()
  const fotoInputRef = useRef(null)

  const [ap, setAp] = useState(null)
  const [loading, setLoading] = useState(true)
  const [ambiente, setAmbiente] = useState('')
  const [uploadProgress, setUploadProgress] = useState({})
  const [convertendo, setConvertendo] = useState(null)
  const [excluindo, setExcluindo] = useState(null)

  const carregar = async () => {
    try {
      const res = await apApi.buscar(id)
      setAp(res.data.apresentacao)
    } catch {
      navigate('/apresentacoes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregar() }, [id])

  const handleAdicionarFotos = async (e) => {
    const files = Array.from(e.target.files)
    if (!files.length) return
    if (!ambiente.trim()) { alert('Preencha o nome do ambiente antes de selecionar as fotos.'); return }
    e.target.value = ''

    for (let i = 0; i < files.length; i++) {
      let file = files[i]
      const ext = file.name.split('.').pop().toLowerCase()
      if (ext === 'heic' || ext === 'heif') {
        setConvertendo(`Convertendo ${i + 1} de ${files.length}...`)
        try { file = await converterSeHeic(file) } catch {}
        setConvertendo(null)
      }

      const key = `${file.name}-${Date.now()}`
      setUploadProgress((p) => ({ ...p, [key]: 0 }))
      try {
        const fd = new FormData()
        fd.append('foto', file)
        fd.append('ambiente', ambiente.trim())
        const res = await apApi.uploadFoto(id, fd, (ev) => {
          if (ev.total) setUploadProgress((p) => ({ ...p, [key]: Math.round((ev.loaded / ev.total) * 100) }))
        })
        setAp((prev) => ({ ...prev, fotos: [...prev.fotos, res.data.foto] }))
      } catch {}
      setUploadProgress((p) => { const n = { ...p }; delete n[key]; return n })
    }
  }

  const excluirFoto = async (fotoId) => {
    setExcluindo(fotoId)
    try {
      await apApi.excluirFoto(id, fotoId)
      setAp((prev) => ({ ...prev, fotos: prev.fotos.filter((f) => f.id !== fotoId) }))
    } catch {}
    finally { setExcluindo(null) }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500" />
      </div>
    )
  }

  if (!ap) return null

  const uploading = Object.entries(uploadProgress)
  const ambientes = [...new Set(ap.fotos.map((f) => f.ambiente))]

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: '#0B1120' }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3 flex-shrink-0" style={{ borderBottom: '1px solid #1E293B', backgroundColor: '#111827' }}>
        <button onClick={() => navigate('/apresentacoes')} className="text-sm flex-shrink-0" style={{ color: '#64748B' }}>← Voltar</button>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: '#F1F5F9' }}>{ap.nomeImóvel}</p>
          <p className="text-xs" style={{ color: '#64748B' }}>{ap.fotos.length} foto{ap.fotos.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Upload area */}
      <div className="px-4 py-4 flex-shrink-0" style={{ borderBottom: '1px solid #1E293B', backgroundColor: '#0F172A' }}>
        <p className="text-xs font-medium mb-2" style={{ color: '#94A3B8' }}>Adicionar fotos</p>
        <div className="flex gap-2">
          <input
            className="input flex-1 text-sm"
            value={ambiente}
            onChange={(e) => setAmbiente(e.target.value)}
            placeholder="Ambiente (ex: Sala de Estar, Cozinha, Quarto)"
            onKeyDown={(e) => { if (e.key === 'Enter' && ambiente.trim()) fotoInputRef.current?.click() }}
          />
          <button
            onClick={() => { if (!ambiente.trim()) { alert('Preencha o ambiente primeiro.'); return } fotoInputRef.current?.click() }}
            className="text-sm px-4 py-2 rounded-lg font-medium flex-shrink-0"
            style={{ backgroundColor: 'rgba(99,102,241,0.2)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}
          >
            Selecionar fotos
          </button>
        </div>
        <input ref={fotoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleAdicionarFotos} />

        {/* Progresso */}
        {(convertendo || uploading.length > 0) && (
          <div className="mt-3 space-y-2">
            {convertendo && (
              <div className="flex items-center gap-2 text-xs" style={{ color: '#94A3B8' }}>
                <div className="animate-spin rounded-full h-3 w-3 border-b border-indigo-400 flex-shrink-0" />
                <span>{convertendo}</span>
              </div>
            )}
            {uploading.map(([key, pct]) => (
              <div key={key}>
                <div className="flex justify-between text-xs mb-1" style={{ color: '#94A3B8' }}>
                  <span>Enviando...</span><span>{pct}%</span>
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: '#1E293B' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: '#818cf8' }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Galeria por ambiente */}
      <div className="flex-1 overflow-y-auto p-4">
        {ap.fotos.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <span style={{ fontSize: 40 }}>📷</span>
            <p className="text-sm" style={{ color: '#64748B' }}>Nenhuma foto adicionada ainda.</p>
          </div>
        )}

        {ambientes.map((amb) => {
          const fotosDoAmb = ap.fotos.filter((f) => f.ambiente === amb)
          return (
            <div key={amb} className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <p className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>{amb}</p>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#1E293B', color: '#64748B' }}>{fotosDoAmb.length} foto{fotosDoAmb.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {fotosDoAmb.map((foto) => (
                  <div key={foto.id} className="relative rounded-lg overflow-hidden aspect-square group" style={{ backgroundColor: '#0B1120' }}>
                    <img src={foto.url} alt={amb} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 flex items-end justify-end p-2 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.6))' }}>
                      <button
                        onClick={() => excluirFoto(foto.id)}
                        disabled={excluindo === foto.id}
                        className="text-xs px-2 py-1 rounded font-medium disabled:opacity-50"
                        style={{ backgroundColor: 'rgba(239,68,68,0.85)', color: '#fff' }}
                      >
                        {excluindo === foto.id ? '...' : '✕'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
