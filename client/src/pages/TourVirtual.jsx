import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as tourApi from '../api/tour'

function formatarData(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function mascaraWhatsApp(valor) {
  const d = valor.replace(/\D/g, '').slice(0, 13)
  if (d.length <= 2) return d
  if (d.length <= 4) return `+${d.slice(0, 2)} (${d.slice(2)}`
  if (d.length <= 9) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4)}`
  return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9, 13)}`
}

function ModalTour({ tour, onSalvo, onClose }) {
  const editando = !!tour?.id
  const [form, setForm] = useState({
    nome: tour?.nome || '',
    descricao: tour?.descricao || '',
    nomeCorretor: tour?.nomeCorretor || '',
    whatsappCorretor: tour?.whatsappCorretor || '',
    publicado: tour?.publicado || false,
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  const handleWhats = (e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 13)
    set('whatsappCorretor', raw)
  }

  const handleSubmit = async () => {
    if (!form.nome.trim()) return setErro('Nome é obrigatório')
    setSalvando(true)
    setErro('')
    try {
      const payload = {
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || null,
        nomeCorretor: form.nomeCorretor.trim() || null,
        whatsappCorretor: form.whatsappCorretor.trim() || null,
        publicado: form.publicado,
      }
      if (editando) {
        await tourApi.atualizar(tour.id, payload)
      } else {
        await tourApi.criar(payload)
      }
      onSalvo()
    } catch (e) {
      setErro(e.response?.data?.error || 'Erro ao salvar tour')
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
        className="w-full max-w-md rounded-2xl shadow-2xl p-6"
        style={{ backgroundColor: '#111827', border: '1px solid #1E293B' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold" style={{ color: '#F1F5F9' }}>
            {editando ? 'Editar tour' : 'Novo tour'}
          </h2>
          <button onClick={onClose} style={{ color: '#64748B', fontSize: 20 }}>✕</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: '#94A3B8' }}>
              Nome do tour *
            </label>
            <input
              className="input w-full"
              value={form.nome}
              onChange={(e) => set('nome', e.target.value)}
              placeholder="Ex: Residencial Vista Verde"
            />
          </div>

          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: '#94A3B8' }}>Descrição</label>
            <textarea
              className="input w-full resize-none"
              rows={2}
              value={form.descricao}
              onChange={(e) => set('descricao', e.target.value)}
              placeholder="Descrição opcional do imóvel..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: '#94A3B8' }}>Nome do corretor</label>
              <input
                className="input w-full"
                value={form.nomeCorretor}
                onChange={(e) => set('nomeCorretor', e.target.value)}
                placeholder="João Silva"
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: '#94A3B8' }}>WhatsApp</label>
              <input
                className="input w-full"
                value={mascaraWhatsApp(form.whatsappCorretor)}
                onChange={handleWhats}
                placeholder="+55 (11) 99999-9999"
              />
            </div>
          </div>

          <div className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ backgroundColor: '#0F172A' }}>
            <span className="text-sm" style={{ color: '#94A3B8' }}>Status</span>
            <button
              onClick={() => set('publicado', !form.publicado)}
              className="flex items-center gap-2 text-sm font-medium"
            >
              <div
                className="w-10 h-5 rounded-full relative transition-colors"
                style={{ backgroundColor: form.publicado ? '#6366F1' : '#334155' }}
              >
                <div
                  className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                  style={{ transform: form.publicado ? 'translateX(22px)' : 'translateX(2px)' }}
                />
              </div>
              <span style={{ color: form.publicado ? '#818cf8' : '#64748B' }}>
                {form.publicado ? 'Publicado' : 'Rascunho'}
              </span>
            </button>
          </div>
        </div>

        {erro && <p className="text-xs mt-3" style={{ color: '#EF4444' }}>{erro}</p>}

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} disabled={salvando} className="btn-secondary flex-1">Cancelar</button>
          <button
            onClick={handleSubmit}
            disabled={salvando}
            className="flex-1 text-sm font-medium py-2 rounded-lg disabled:opacity-50 transition-colors"
            style={{ backgroundColor: 'rgba(99,102,241,0.2)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}
          >
            {salvando ? 'Salvando...' : editando ? 'Salvar' : 'Criar tour'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function TourVirtual() {
  const navigate = useNavigate()
  const [tours, setTours] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [excluindo, setExcluindo] = useState(null)
  const [copiado, setCopiado] = useState(null)

  const carregar = async () => {
    setLoading(true)
    try {
      const res = await tourApi.listar()
      setTours(res.data.tours || [])
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { carregar() }, [])

  const excluir = async (id) => {
    if (!window.confirm('Excluir este tour e todos os cômodos e fotos?')) return
    setExcluindo(id)
    try {
      await tourApi.excluir(id)
      setTours((prev) => prev.filter((t) => t.id !== id))
    } catch {}
    finally { setExcluindo(null) }
  }

  const copiarLink = (tour) => {
    const url = `${window.location.origin}/tour/${tour.slug}`
    navigator.clipboard.writeText(url).then(() => {
      setCopiado(tour.id)
      setTimeout(() => setCopiado(null), 2000)
    })
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
            🎥 Tour Virtual
          </h1>
          <p className="text-xs md:text-sm" style={{ color: '#94A3B8' }}>
            {tours.length} tour{tours.length !== 1 ? 's' : ''} cadastrado{tours.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setModal({ novo: true })}
          className="text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          style={{ backgroundColor: 'rgba(99,102,241,0.2)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.3)' }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.2)' }}
        >
          + Novo Tour
        </button>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
          </div>
        )}

        {!loading && tours.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <span style={{ fontSize: 40 }}>🎥</span>
            <p className="text-sm" style={{ color: '#64748B' }}>Nenhum tour criado ainda.</p>
            <button
              onClick={() => setModal({ novo: true })}
              className="text-xs px-4 py-2 rounded-lg"
              style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: '#818cf8' }}
            >
              Criar primeiro tour
            </button>
          </div>
        )}

        {!loading && tours.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tours.map((t) => (
              <div
                key={t.id}
                className="rounded-xl p-4 flex flex-col gap-3"
                style={{ backgroundColor: '#111827', border: '1px solid #1E293B' }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate" style={{ color: '#F1F5F9' }}>{t.nome}</p>
                    {t.descricao && (
                      <p className="text-xs mt-0.5 line-clamp-2" style={{ color: '#64748B' }}>{t.descricao}</p>
                    )}
                  </div>
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0"
                    style={
                      t.publicado
                        ? { backgroundColor: 'rgba(34,197,94,0.15)', color: '#22C55E' }
                        : { backgroundColor: 'rgba(100,116,139,0.15)', color: '#94A3B8' }
                    }
                  >
                    {t.publicado ? 'Publicado' : 'Rascunho'}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs" style={{ color: '#475569' }}>
                  <span>🏠 {t._count?.comodos || 0} cômodo{t._count?.comodos !== 1 ? 's' : ''}</span>
                  <span>•</span>
                  <span>{formatarData(t.criadoEm)}</span>
                </div>

                <div className="flex gap-2 pt-1" style={{ borderTop: '1px solid #1E293B' }}>
                  <button
                    onClick={() => navigate(`/tours/${t.id}/editar`)}
                    className="flex-1 text-xs py-1.5 rounded-lg transition-colors"
                    style={{ backgroundColor: '#1E293B', color: '#94A3B8' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#F1F5F9' }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#94A3B8' }}
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => copiarLink(t)}
                    className="flex-1 text-xs py-1.5 rounded-lg transition-colors"
                    style={{
                      backgroundColor: copiado === t.id ? 'rgba(34,197,94,0.15)' : '#1E293B',
                      color: copiado === t.id ? '#22C55E' : '#94A3B8',
                    }}
                    onMouseEnter={(e) => { if (copiado !== t.id) e.currentTarget.style.color = '#F1F5F9' }}
                    onMouseLeave={(e) => { if (copiado !== t.id) e.currentTarget.style.color = '#94A3B8' }}
                  >
                    {copiado === t.id ? '✓ Copiado' : 'Copiar Link'}
                  </button>
                  <button
                    onClick={() => excluir(t.id)}
                    disabled={excluindo === t.id}
                    className="flex-1 text-xs py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#EF4444' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.2)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)' }}
                  >
                    {excluindo === t.id ? '...' : 'Excluir'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal?.novo && (
        <ModalTour
          onSalvo={() => { setModal(null); carregar() }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.editar && (
        <ModalTour
          tour={modal.editar}
          onSalvo={() => { setModal(null); carregar() }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
