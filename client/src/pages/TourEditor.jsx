import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import * as tourApi from '../api/tour'

export default function TourEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const fotoInputRef = useRef(null)

  const [tour, setTour] = useState(null)
  const [loading, setLoading] = useState(true)
  const [comodoAtivo, setComodoAtivo] = useState(null)
  const [editandoNome, setEditandoNome] = useState('')
  const [adicionandoComodo, setAdicionandoComodo] = useState(false)
  const [novoNomeComodo, setNovoNomeComodo] = useState('')
  const [salvandoComodo, setSalvandoComodo] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({})
  const [dragSrcIdx, setDragSrcIdx] = useState(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)
  const [dragSrcFotoIdx, setDragSrcFotoIdx] = useState(null)
  const [dragOverFotoIdx, setDragOverFotoIdx] = useState(null)
  const [copiado, setCopiado] = useState(false)
  const [publicando, setPublicando] = useState(false)

  const carregar = async () => {
    try {
      const res = await tourApi.buscar(id)
      setTour(res.data.tour)
      setComodoAtivo((prev) => {
        const comodos = res.data.tour.comodos
        if (!prev) return comodos[0] || null
        return comodos.find((c) => c.id === prev.id) || comodos[0] || null
      })
    } catch {
      navigate('/tours')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregar() }, [id])

  useEffect(() => {
    if (comodoAtivo) setEditandoNome(comodoAtivo.nome)
  }, [comodoAtivo?.id])

  // ── Tour actions ────────────────────────────────────────────────────────────

  const togglePublicado = async () => {
    setPublicando(true)
    try {
      const res = await tourApi.atualizar(id, { publicado: !tour.publicado })
      setTour((prev) => ({ ...prev, publicado: res.data.tour.publicado }))
    } catch {}
    finally { setPublicando(false) }
  }

  const copiarLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/tour/${tour.slug}`).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    })
  }

  // ── Cômodos ─────────────────────────────────────────────────────────────────

  const adicionarComodo = async () => {
    if (!novoNomeComodo.trim()) return
    setSalvandoComodo(true)
    try {
      const res = await tourApi.adicionarComodo(id, { nome: novoNomeComodo.trim() })
      const novoComodo = res.data.comodo
      setTour((prev) => ({ ...prev, comodos: [...prev.comodos, novoComodo] }))
      setComodoAtivo(novoComodo)
      setNovoNomeComodo('')
      setAdicionandoComodo(false)
    } catch {}
    finally { setSalvandoComodo(false) }
  }

  const salvarNomeComodo = async () => {
    if (!editandoNome.trim() || editandoNome === comodoAtivo.nome) return
    const nome = editandoNome.trim()
    try {
      await tourApi.atualizarComodo(id, comodoAtivo.id, { nome })
      setTour((prev) => ({
        ...prev,
        comodos: prev.comodos.map((c) => (c.id === comodoAtivo.id ? { ...c, nome } : c)),
      }))
      setComodoAtivo((prev) => ({ ...prev, nome }))
    } catch {}
  }

  const excluirComodo = async (comodoId) => {
    if (!window.confirm('Excluir este cômodo e todas as fotos?')) return
    try {
      await tourApi.excluirComodo(id, comodoId)
      setTour((prev) => {
        const comodos = prev.comodos.filter((c) => c.id !== comodoId)
        return { ...prev, comodos }
      })
      if (comodoAtivo?.id === comodoId) {
        const restantes = tour.comodos.filter((c) => c.id !== comodoId)
        setComodoAtivo(restantes[0] || null)
      }
    } catch {}
  }

  // ── Drag cômodos ─────────────────────────────────────────────────────────────

  const handleDragStartComodo = (idx) => setDragSrcIdx(idx)
  const handleDragOverComodo = (e, idx) => { e.preventDefault(); setDragOverIdx(idx) }
  const handleDragLeaveComodo = () => setDragOverIdx(null)

  const handleDropComodo = async (idx) => {
    if (dragSrcIdx === null || dragSrcIdx === idx) { setDragSrcIdx(null); setDragOverIdx(null); return }
    const comodos = [...tour.comodos]
    const [moved] = comodos.splice(dragSrcIdx, 1)
    comodos.splice(idx, 0, moved)
    const reordenados = comodos.map((c, i) => ({ ...c, ordem: i }))
    setTour((prev) => ({ ...prev, comodos: reordenados }))
    if (comodoAtivo?.id === moved.id) setComodoAtivo(reordenados.find((c) => c.id === moved.id))
    setDragSrcIdx(null)
    setDragOverIdx(null)
    try {
      await tourApi.reordenarComodos(id, reordenados.map((c) => ({ id: c.id, ordem: c.ordem })))
    } catch {}
  }

  // ── Fotos ─────────────────────────────────────────────────────────────────────

  const handleAdicionarFotos = async (e) => {
    const files = Array.from(e.target.files)
    if (!files.length || !comodoAtivo) return
    e.target.value = ''

    for (const file of files) {
      const key = `${file.name}-${Date.now()}`
      setUploadProgress((prev) => ({ ...prev, [key]: 0 }))
      try {
        const fd = new FormData()
        fd.append('foto', file)
        const res = await tourApi.uploadFoto(id, comodoAtivo.id, fd, (event) => {
          if (event.total) {
            setUploadProgress((prev) => ({ ...prev, [key]: Math.round((event.loaded / event.total) * 100) }))
          }
        })
        const novaFoto = res.data.foto
        setTour((prev) => ({
          ...prev,
          comodos: prev.comodos.map((c) =>
            c.id === comodoAtivo.id ? { ...c, fotos: [...c.fotos, novaFoto] } : c
          ),
        }))
        setComodoAtivo((prev) => ({ ...prev, fotos: [...prev.fotos, novaFoto] }))
      } catch {}
      setUploadProgress((prev) => { const n = { ...prev }; delete n[key]; return n })
    }
  }

  const excluirFoto = async (fotoId) => {
    try {
      await tourApi.excluirFoto(id, comodoAtivo.id, fotoId)
      setTour((prev) => ({
        ...prev,
        comodos: prev.comodos.map((c) =>
          c.id === comodoAtivo.id ? { ...c, fotos: c.fotos.filter((f) => f.id !== fotoId) } : c
        ),
      }))
      setComodoAtivo((prev) => ({ ...prev, fotos: prev.fotos.filter((f) => f.id !== fotoId) }))
    } catch {}
  }

  // ── Drag fotos ────────────────────────────────────────────────────────────────

  const handleDragStartFoto = (idx) => setDragSrcFotoIdx(idx)
  const handleDragOverFoto = (e, idx) => { e.preventDefault(); setDragOverFotoIdx(idx) }
  const handleDragLeaveFoto = () => setDragOverFotoIdx(null)

  const handleDropFoto = async (idx) => {
    if (dragSrcFotoIdx === null || dragSrcFotoIdx === idx) { setDragSrcFotoIdx(null); setDragOverFotoIdx(null); return }
    const fotos = [...comodoAtivo.fotos]
    const [moved] = fotos.splice(dragSrcFotoIdx, 1)
    fotos.splice(idx, 0, moved)
    const reordenadas = fotos.map((f, i) => ({ ...f, ordem: i }))
    setComodoAtivo((prev) => ({ ...prev, fotos: reordenadas }))
    setTour((prev) => ({
      ...prev,
      comodos: prev.comodos.map((c) => (c.id === comodoAtivo.id ? { ...c, fotos: reordenadas } : c)),
    }))
    setDragSrcFotoIdx(null)
    setDragOverFotoIdx(null)
    try {
      await tourApi.reordenarFotos(id, comodoAtivo.id, reordenadas.map((f) => ({ id: f.id, ordem: f.ordem })))
    } catch {}
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500" />
      </div>
    )
  }

  if (!tour) return null

  const uploading = Object.entries(uploadProgress)

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: '#0B1120' }}>
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between gap-3 flex-shrink-0"
        style={{ borderBottom: '1px solid #1E293B', backgroundColor: '#111827' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('/tours')}
            className="text-sm flex-shrink-0"
            style={{ color: '#64748B' }}
          >
            ← Voltar
          </button>
          <p className="text-sm font-semibold truncate" style={{ color: '#F1F5F9' }}>{tour.nome}</p>
          <span
            className="px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0"
            style={
              tour.publicado
                ? { backgroundColor: 'rgba(34,197,94,0.15)', color: '#22C55E' }
                : { backgroundColor: 'rgba(100,116,139,0.15)', color: '#94A3B8' }
            }
          >
            {tour.publicado ? 'Publicado' : 'Rascunho'}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={copiarLink}
            className="text-xs px-3 py-1.5 rounded-lg"
            style={{
              backgroundColor: copiado ? 'rgba(34,197,94,0.15)' : '#1E293B',
              color: copiado ? '#22C55E' : '#94A3B8',
            }}
          >
            {copiado ? '✓ Copiado' : '🔗 Copiar link'}
          </button>
          <button
            onClick={togglePublicado}
            disabled={publicando}
            className="text-xs px-3 py-1.5 rounded-lg disabled:opacity-50"
            style={{
              backgroundColor: tour.publicado ? 'rgba(239,68,68,0.1)' : 'rgba(99,102,241,0.2)',
              color: tour.publicado ? '#EF4444' : '#818cf8',
            }}
          >
            {publicando ? '...' : tour.publicado ? 'Despublicar' : 'Publicar'}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Coluna esquerda — lista de cômodos */}
        <div
          className="flex flex-col w-1/3 border-r overflow-hidden"
          style={{ borderColor: '#1E293B', backgroundColor: '#0F172A', minWidth: 200, maxWidth: 280 }}
        >
          <div className="p-3 flex-shrink-0">
            {!adicionandoComodo ? (
              <button
                onClick={() => { setAdicionandoComodo(true); setNovoNomeComodo('') }}
                className="w-full text-xs py-2 rounded-lg transition-colors"
                style={{ backgroundColor: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px dashed rgba(99,102,241,0.3)' }}
              >
                + Adicionar cômodo
              </button>
            ) : (
              <div className="flex gap-1">
                <input
                  autoFocus
                  className="input flex-1 text-xs py-1.5"
                  value={novoNomeComodo}
                  onChange={(e) => setNovoNomeComodo(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') adicionarComodo(); if (e.key === 'Escape') setAdicionandoComodo(false) }}
                  placeholder="Ex: Sala de estar"
                />
                <button
                  onClick={adicionarComodo}
                  disabled={salvandoComodo}
                  className="text-xs px-2 py-1 rounded"
                  style={{ backgroundColor: 'rgba(99,102,241,0.2)', color: '#818cf8' }}
                >
                  {salvandoComodo ? '...' : '✓'}
                </button>
                <button onClick={() => setAdicionandoComodo(false)} className="text-xs px-2" style={{ color: '#64748B' }}>✕</button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
            {tour.comodos.length === 0 && (
              <p className="text-xs text-center py-8" style={{ color: '#475569' }}>Nenhum cômodo ainda</p>
            )}
            {tour.comodos.map((c, idx) => (
              <div
                key={c.id}
                draggable
                onDragStart={() => handleDragStartComodo(idx)}
                onDragOver={(e) => handleDragOverComodo(e, idx)}
                onDragLeave={handleDragLeaveComodo}
                onDrop={() => handleDropComodo(idx)}
                onClick={() => setComodoAtivo(c)}
                className="flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors"
                style={{
                  backgroundColor:
                    comodoAtivo?.id === c.id
                      ? 'rgba(99,102,241,0.2)'
                      : dragOverIdx === idx
                      ? 'rgba(99,102,241,0.1)'
                      : 'transparent',
                  border: `1px solid ${comodoAtivo?.id === c.id ? 'rgba(99,102,241,0.4)' : 'transparent'}`,
                  opacity: dragSrcIdx === idx ? 0.4 : 1,
                }}
              >
                <span className="text-xs cursor-grab select-none" style={{ color: '#475569' }}>⠿</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: comodoAtivo?.id === c.id ? '#818cf8' : '#CBD5E1' }}>
                    {c.nome}
                  </p>
                  <p className="text-xs" style={{ color: '#475569' }}>{c.fotos?.length || 0} foto{c.fotos?.length !== 1 ? 's' : ''}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); excluirComodo(c.id) }}
                  className="text-xs flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: '#EF4444' }}
                  title="Excluir"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Coluna direita — editor do cômodo */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!comodoAtivo ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <span style={{ fontSize: 40 }}>🏠</span>
              <p className="text-sm" style={{ color: '#475569' }}>Selecione ou adicione um cômodo</p>
            </div>
          ) : (
            <>
              {/* Nome do cômodo */}
              <div className="px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid #1E293B' }}>
                <input
                  className="text-base font-semibold bg-transparent border-b border-transparent focus:border-indigo-500 outline-none w-full transition-colors"
                  style={{ color: '#F1F5F9' }}
                  value={editandoNome}
                  onChange={(e) => setEditandoNome(e.target.value)}
                  onBlur={salvarNomeComodo}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur() }}
                />
                <p className="text-xs mt-0.5" style={{ color: '#475569' }}>Clique para renomear · Enter para confirmar</p>
              </div>

              {/* Grid de fotos */}
              <div className="flex-1 overflow-y-auto p-4">
                {/* Uploads em progresso */}
                {uploading.length > 0 && (
                  <div className="mb-4 space-y-2">
                    {uploading.map(([key, pct]) => (
                      <div key={key}>
                        <div className="flex justify-between text-xs mb-1" style={{ color: '#94A3B8' }}>
                          <span>Enviando...</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: '#1E293B' }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: '#818cf8' }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                  {comodoAtivo.fotos.map((foto, idx) => (
                    <div
                      key={foto.id}
                      draggable
                      onDragStart={() => handleDragStartFoto(idx)}
                      onDragOver={(e) => handleDragOverFoto(e, idx)}
                      onDragLeave={handleDragLeaveFoto}
                      onDrop={() => handleDropFoto(idx)}
                      className="relative rounded-lg overflow-hidden aspect-square group"
                      style={{
                        border: dragOverFotoIdx === idx ? '2px solid #818cf8' : '2px solid transparent',
                        opacity: dragSrcFotoIdx === idx ? 0.4 : 1,
                        cursor: 'grab',
                      }}
                    >
                      <img
                        src={foto.url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      <div
                        className="absolute inset-0 flex items-end justify-between p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.7))' }}
                      >
                        <span className="text-xs font-medium text-white">{idx + 1}</span>
                        <button
                          onClick={() => excluirFoto(foto.id)}
                          className="text-xs px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: 'rgba(239,68,68,0.8)', color: '#fff' }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Botão adicionar */}
                  <button
                    onClick={() => fotoInputRef.current?.click()}
                    className="aspect-square rounded-lg flex flex-col items-center justify-center gap-1 transition-colors"
                    style={{ border: '2px dashed #1E293B', backgroundColor: '#0B1120', color: '#475569' }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'; e.currentTarget.style.color = '#818cf8' }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1E293B'; e.currentTarget.style.color = '#475569' }}
                  >
                    <span style={{ fontSize: 24 }}>+</span>
                    <span className="text-xs">Foto</span>
                  </button>
                </div>

                <input
                  ref={fotoInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleAdicionarFotos}
                />

                {comodoAtivo.fotos.length === 0 && uploading.length === 0 && (
                  <p className="text-xs text-center mt-4" style={{ color: '#475569' }}>
                    Nenhuma foto ainda. Clique em "+" para adicionar.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
