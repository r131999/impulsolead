import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import '../utils/leafletIcon'
import * as apApi from '../api/apresentacao'
import { usePermissao } from '../hooks/usePermissao'

const CENTRO_BRASIL = [-14.235, -51.9253]

function MapClickHandler({ onPick }) {
  useMapEvents({
    click(e) { onPick(e.latlng.lat, e.latlng.lng) },
  })
  return null
}

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

const FORM_VAZIO = {
  nomeImóvel: '', nomeLeadPersonalizado: '', descricao: '', valor: '',
  quartos: '', banheiros: '', vagas: '', areaM2: '', nomeLocal: '',
  whatsappCorretor: '', nomeCorretor: '', publicado: false,
  estado: '', cidade: '', bairro: '', rua: '', numero: '', latitude: null, longitude: null,
}

function ModalApresentacao({ ap, onSalvo, onClose }) {
  const editando = !!ap?.id
  const [form, setForm] = useState(ap?.id ? {
    nomeImóvel: ap.nomeImóvel || '',
    nomeLeadPersonalizado: ap.nomeLeadPersonalizado || '',
    descricao: ap.descricao || '',
    valor: ap.valor || '',
    quartos: ap.quartos ?? '',
    banheiros: ap.banheiros ?? '',
    vagas: ap.vagas ?? '',
    areaM2: ap.areaM2 ?? '',
    nomeLocal: ap.nomeLocal || '',
    whatsappCorretor: ap.whatsappCorretor || '',
    nomeCorretor: ap.nomeCorretor || '',
    publicado: ap.publicado || false,
    estado: ap.estado || '',
    cidade: ap.cidade || '',
    bairro: ap.bairro || '',
    rua: ap.rua || '',
    numero: ap.numero || '',
    latitude: ap.latitude ?? null,
    longitude: ap.longitude ?? null,
  } : FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [estados, setEstados] = useState([])
  const [municipios, setMunicipios] = useState([])
  const [loadingMunicipios, setLoadingMunicipios] = useState(false)
  const [buscandoMapa, setBuscandoMapa] = useState(false)
  const [erroMapa, setErroMapa] = useState('')
  const mapRef = useRef(null)

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  useEffect(() => {
    fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome')
      .then((r) => r.json())
      .then((data) => setEstados(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!form.estado) { setMunicipios([]); return }
    setLoadingMunicipios(true)
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${form.estado}/municipios?orderBy=nome`)
      .then((r) => r.json())
      .then((data) => setMunicipios(Array.isArray(data) ? data : []))
      .catch(() => setMunicipios([]))
      .finally(() => setLoadingMunicipios(false))
  }, [form.estado])

  const handlePick = (lat, lng) => {
    set('latitude', lat)
    set('longitude', lng)
  }

  const buscarNoMapa = async () => {
    const partes = [
      [form.rua, form.numero].filter(Boolean).join(' '),
      form.bairro,
      form.cidade,
      form.estado,
      'Brasil',
    ].filter(Boolean)
    if (partes.length === 0) return setErroMapa('Informe pelo menos o estado ou a cidade')
    setErroMapa('')
    setBuscandoMapa(true)
    try {
      const query = encodeURIComponent(partes.join(', '))
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}`)
      const data = await res.json()
      if (data?.[0]) {
        const lat = parseFloat(data[0].lat)
        const lng = parseFloat(data[0].lon)
        handlePick(lat, lng)
        mapRef.current?.setView([lat, lng], 16)
      } else {
        setErroMapa('Endereço não encontrado. Ajuste o pin manualmente no mapa.')
      }
    } catch {
      setErroMapa('Erro ao buscar endereço no mapa')
    } finally {
      setBuscandoMapa(false)
    }
  }

  const handleWhats = (e) => set('whatsappCorretor', e.target.value.replace(/\D/g, '').slice(0, 13))

  const handleSubmit = async () => {
    if (!form.nomeImóvel.trim()) return setErro('Nome do imóvel é obrigatório')
    setSalvando(true)
    setErro('')
    try {
      const payload = {
        ...form,
        quartos: form.quartos !== '' ? Number(form.quartos) : null,
        banheiros: form.banheiros !== '' ? Number(form.banheiros) : null,
        vagas: form.vagas !== '' ? Number(form.vagas) : null,
        areaM2: form.areaM2 !== '' ? parseFloat(form.areaM2) : null,
      }
      if (editando) await apApi.atualizar(ap.id, payload)
      else await apApi.criar(payload)
      onSalvo()
    } catch (e) {
      setErro(e.response?.data?.error || 'Erro ao salvar')
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: '#111827', border: '1px solid #1E293B' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold" style={{ color: '#F1F5F9' }}>{editando ? 'Editar apresentação' : 'Nova apresentação'}</h2>
          <button onClick={onClose} style={{ color: '#64748B', fontSize: 20 }}>✕</button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: '#94A3B8' }}>Nome do imóvel *</label>
            <input className="input w-full" value={form.nomeImóvel} onChange={(e) => set('nomeImóvel', e.target.value)} placeholder="Ex: Apartamento Jardins 120m²" />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: '#94A3B8' }}>Nome do lead (personalização)</label>
            <input className="input w-full" value={form.nomeLeadPersonalizado} onChange={(e) => set('nomeLeadPersonalizado', e.target.value)} placeholder="Ex: João Silva" />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: '#94A3B8' }}>Descrição</label>
            <textarea className="input w-full resize-none" rows={3} value={form.descricao} onChange={(e) => set('descricao', e.target.value)} placeholder="Descreva o imóvel..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: '#94A3B8' }}>Valor</label>
              <input className="input w-full" value={form.valor} onChange={(e) => set('valor', e.target.value)} placeholder="R$ 450.000" />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: '#94A3B8' }}>Localização</label>
              <input className="input w-full" value={form.nomeLocal} onChange={(e) => set('nomeLocal', e.target.value)} placeholder="Jardins, SP" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { k: 'quartos', label: '🛏 Quartos' },
              { k: 'banheiros', label: '🚿 Banh.' },
              { k: 'vagas', label: '🚗 Vagas' },
              { k: 'areaM2', label: '📐 m²' },
            ].map(({ k, label }) => (
              <div key={k}>
                <label className="text-xs font-medium block mb-1" style={{ color: '#94A3B8' }}>{label}</label>
                <input className="input w-full" type="number" min="0" step={k === 'areaM2' ? '0.1' : '1'} value={form[k]} onChange={(e) => set(k, e.target.value)} placeholder="—" />
              </div>
            ))}
          </div>

          <div className="pt-2" style={{ borderTop: '1px solid #1E293B' }}>
            <p className="text-xs font-semibold mb-2" style={{ color: '#94A3B8' }}>📍 Localização (opcional)</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: '#94A3B8' }}>Estado</label>
                <select className="input w-full" value={form.estado} onChange={(e) => { set('estado', e.target.value); set('cidade', '') }}>
                  <option value="">Selecione...</option>
                  {estados.map((uf) => <option key={uf.id} value={uf.sigla}>{uf.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: '#94A3B8' }}>Município</label>
                <select className="input w-full" value={form.cidade} disabled={!form.estado || loadingMunicipios} onChange={(e) => set('cidade', e.target.value)}>
                  <option value="">{form.estado ? 'Selecione...' : 'Escolha o estado primeiro'}</option>
                  {municipios.map((m) => <option key={m.id} value={m.nome}>{m.nome}</option>)}
                </select>
              </div>
            </div>
            <div className="mb-3">
              <label className="text-xs font-medium block mb-1" style={{ color: '#94A3B8' }}>Bairro</label>
              <input className="input w-full" value={form.bairro} onChange={(e) => set('bairro', e.target.value)} placeholder="Ex: Jardins" />
            </div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="col-span-2">
                <label className="text-xs font-medium block mb-1" style={{ color: '#94A3B8' }}>Rua/Avenida</label>
                <input className="input w-full" value={form.rua} onChange={(e) => set('rua', e.target.value)} placeholder="Ex: Av. Paulista" />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: '#94A3B8' }}>Número</label>
                <input className="input w-full" value={form.numero} onChange={(e) => set('numero', e.target.value)} placeholder="—" />
              </div>
            </div>

            <button
              type="button"
              onClick={buscarNoMapa}
              disabled={buscandoMapa}
              className="text-xs px-3 py-2 rounded-lg mb-2 disabled:opacity-50"
              style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: '#818cf8' }}
            >
              {buscandoMapa ? 'Buscando...' : '🔍 Buscar no mapa'}
            </button>
            {erroMapa && <p className="text-xs mb-2" style={{ color: '#EF4444' }}>{erroMapa}</p>}
            <p className="text-xs mb-2" style={{ color: '#64748B' }}>Clique no mapa para marcar o ponto exato do imóvel. Arraste o pin para ajustar.</p>

            <div style={{ height: 240, borderRadius: 8, overflow: 'hidden' }}>
              <MapContainer
                ref={mapRef}
                center={form.latitude != null && form.longitude != null ? [form.latitude, form.longitude] : CENTRO_BRASIL}
                zoom={form.latitude != null && form.longitude != null ? 16 : 4}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />
                <MapClickHandler onPick={handlePick} />
                {form.latitude != null && form.longitude != null && (
                  <Marker
                    position={[form.latitude, form.longitude]}
                    draggable
                    eventHandlers={{
                      dragend: (e) => {
                        const { lat, lng } = e.target.getLatLng()
                        handlePick(lat, lng)
                      },
                    }}
                  />
                )}
              </MapContainer>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: '#94A3B8' }}>Nome do corretor</label>
              <input className="input w-full" value={form.nomeCorretor} onChange={(e) => set('nomeCorretor', e.target.value)} placeholder="João Silva" />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: '#94A3B8' }}>WhatsApp</label>
              <input className="input w-full" value={mascaraWhatsApp(form.whatsappCorretor)} onChange={handleWhats} placeholder="+55 (11) 99999-9999" />
            </div>
          </div>
          <div className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ backgroundColor: '#0F172A' }}>
            <span className="text-sm" style={{ color: '#94A3B8' }}>Status</span>
            <button onClick={() => set('publicado', !form.publicado)} className="flex items-center gap-2 text-sm font-medium">
              <div className="w-10 h-5 rounded-full relative transition-colors" style={{ backgroundColor: form.publicado ? '#6366F1' : '#334155' }}>
                <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform" style={{ transform: form.publicado ? 'translateX(22px)' : 'translateX(2px)' }} />
              </div>
              <span style={{ color: form.publicado ? '#818cf8' : '#64748B' }}>{form.publicado ? 'Publicado' : 'Rascunho'}</span>
            </button>
          </div>
        </div>

        {erro && <p className="text-xs mt-3" style={{ color: '#EF4444' }}>{erro}</p>}

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} disabled={salvando} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={handleSubmit} disabled={salvando} className="flex-1 text-sm font-medium py-2 rounded-lg disabled:opacity-50 transition-colors" style={{ backgroundColor: 'rgba(99,102,241,0.2)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}>
            {salvando ? 'Salvando...' : editando ? 'Salvar' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Apresentacoes() {
  const podeApresentacoes = usePermissao('apresentacaoPersonalizada')
  const navigate = useNavigate()
  const [apresentacoes, setApresentacoes] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [excluindo, setExcluindo] = useState(null)
  const [copiado, setCopiado] = useState(null)

  const carregar = async () => {
    setLoading(true)
    try { const res = await apApi.listar(); setApresentacoes(res.data.apresentacoes || []) }
    catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { carregar() }, [])

  const excluir = async (id) => {
    if (!window.confirm('Excluir esta apresentação e todas as fotos?')) return
    setExcluindo(id)
    try { await apApi.excluir(id); setApresentacoes((p) => p.filter((a) => a.id !== id)) }
    catch {}
    finally { setExcluindo(null) }
  }

  const copiarLink = (ap) => {
    navigator.clipboard.writeText(`${window.location.origin}/ap/${ap.slug}`).then(() => {
      setCopiado(ap.id)
      setTimeout(() => setCopiado(null), 2000)
    })
  }

  if (!podeApresentacoes) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <h1 className="text-xl font-bold mb-6" style={{ color: '#F1F5F9' }}>Apresentações</h1>
        <div style={{ position: 'relative', minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, backdropFilter: 'blur(4px)', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 12, zIndex: 10 }} />
          <div style={{ position: 'relative', zIndex: 20, textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
            <h3 style={{ color: '#F1F5F9', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              Apresentações Personalizadas disponível em um plano superior
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
      <div className="px-4 py-3 md:px-6 md:py-4 flex items-center justify-between flex-shrink-0" style={{ borderBottom: '1px solid #1E293B', backgroundColor: '#111827' }}>
        <div>
          <h1 className="text-lg md:text-xl font-bold" style={{ color: '#F1F5F9' }}>🏡 Apresentações</h1>
          <p className="text-xs md:text-sm" style={{ color: '#94A3B8' }}>{apresentacoes.length} apresentação{apresentacoes.length !== 1 ? 'ões' : ''}</p>
        </div>
        <button
          onClick={() => setModal({ novo: true })}
          className="text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          style={{ backgroundColor: 'rgba(99,102,241,0.2)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.3)' }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.2)' }}
        >
          + Nova Apresentação
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading && <div className="flex justify-center items-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" /></div>}

        {!loading && apresentacoes.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <span style={{ fontSize: 40 }}>🏡</span>
            <p className="text-sm" style={{ color: '#64748B' }}>Nenhuma apresentação criada ainda.</p>
            <button onClick={() => setModal({ novo: true })} className="text-xs px-4 py-2 rounded-lg" style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
              Criar primeira apresentação
            </button>
          </div>
        )}

        {!loading && apresentacoes.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {apresentacoes.map((ap) => (
              <div key={ap.id} className="rounded-xl p-4 flex flex-col gap-3" style={{ backgroundColor: '#111827', border: '1px solid #1E293B' }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate" style={{ color: '#F1F5F9' }}>{ap.nomeImóvel}</p>
                    {ap.nomeLeadPersonalizado && (
                      <p className="text-xs mt-0.5" style={{ color: '#818cf8' }}>Para: {ap.nomeLeadPersonalizado}</p>
                    )}
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0" style={ap.publicado ? { backgroundColor: 'rgba(34,197,94,0.15)', color: '#22C55E' } : { backgroundColor: 'rgba(100,116,139,0.15)', color: '#94A3B8' }}>
                    {ap.publicado ? 'Publicado' : 'Rascunho'}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs" style={{ color: '#475569' }}>
                  <span>📸 {ap._count?.fotos || 0} foto{ap._count?.fotos !== 1 ? 's' : ''}</span>
                  {ap.nomeLocal && <><span>•</span><span>📍 {ap.nomeLocal}</span></>}
                  <span>•</span>
                  <span>{formatarData(ap.criadoEm)}</span>
                </div>

                <div className="grid grid-cols-2 gap-1.5 pt-1" style={{ borderTop: '1px solid #1E293B' }}>
                  <button onClick={() => setModal({ editar: ap })} className="text-xs py-1.5 rounded-lg" style={{ backgroundColor: '#1E293B', color: '#94A3B8' }} onMouseEnter={(e) => { e.currentTarget.style.color = '#F1F5F9' }} onMouseLeave={(e) => { e.currentTarget.style.color = '#94A3B8' }}>
                    Editar
                  </button>
                  <button onClick={() => navigate(`/apresentacoes/${ap.id}/fotos`)} className="text-xs py-1.5 rounded-lg" style={{ backgroundColor: '#1E293B', color: '#94A3B8' }} onMouseEnter={(e) => { e.currentTarget.style.color = '#F1F5F9' }} onMouseLeave={(e) => { e.currentTarget.style.color = '#94A3B8' }}>
                    + Fotos
                  </button>
                  <button onClick={() => copiarLink(ap)} className="text-xs py-1.5 rounded-lg" style={{ backgroundColor: copiado === ap.id ? 'rgba(34,197,94,0.15)' : '#1E293B', color: copiado === ap.id ? '#22C55E' : '#94A3B8' }} onMouseEnter={(e) => { if (copiado !== ap.id) e.currentTarget.style.color = '#F1F5F9' }} onMouseLeave={(e) => { if (copiado !== ap.id) e.currentTarget.style.color = '#94A3B8' }}>
                    {copiado === ap.id ? '✓ Copiado' : 'Copiar Link'}
                  </button>
                  <button onClick={() => excluir(ap.id)} disabled={excluindo === ap.id} className="text-xs py-1.5 rounded-lg disabled:opacity-50" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#EF4444' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.2)' }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)' }}>
                    {excluindo === ap.id ? '...' : 'Excluir'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal?.novo && <ModalApresentacao onSalvo={() => { setModal(null); carregar() }} onClose={() => setModal(null)} />}
      {modal?.editar && <ModalApresentacao ap={modal.editar} onSalvo={() => { setModal(null); carregar() }} onClose={() => setModal(null)} />}
    </div>
  )
}
