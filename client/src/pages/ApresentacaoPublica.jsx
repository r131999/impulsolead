import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import '../utils/leafletIcon'

const CSS = `
  html { scroll-behavior: smooth; }
  body { margin: 0; background: #080808; }
  @keyframes ap-fadein { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
  .ap-fadein { animation: ap-fadein 0.7s ease forwards; }
  .ap-tab { transition: background 0.2s ease, color 0.2s ease; }
  .ap-tab:hover { background: rgba(255,255,255,0.08) !important; }
  .ap-foto-grid-item { cursor: zoom-in; transition: transform 0.2s ease, filter 0.2s ease; overflow: hidden; border-radius: 8px; }
  .ap-foto-grid-item:hover { transform: scale(1.02); filter: brightness(1.1); }
  .ap-wpp { transition: transform 0.2s ease, box-shadow 0.2s ease; }
  .ap-wpp:hover { transform: scale(1.05); box-shadow: 0 8px 28px rgba(37,211,102,0.5) !important; }
  .ap-scroll-x::-webkit-scrollbar { display: none; }
  .ap-scroll-x { scrollbar-width: none; }
  .ap-foto-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  @media (max-width: 640px) { .ap-foto-grid { grid-template-columns: repeat(2, 1fr); } }
`

function IcQuartos() {
  return <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12V7a2 2 0 012-2h14a2 2 0 012 2v5M3 12h18M3 12v5a2 2 0 002 2h14a2 2 0 002-2v-5M9 7v5M15 7v5" /></svg>
}
function IcBanheiros() {
  return <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 12h16M4 12V6a2 2 0 012-2h3M4 12v4a2 2 0 002 2h12a2 2 0 002-2v-4M7 4a1 1 0 000 2" /></svg>
}
function IcVagas() {
  return <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17H7a2 2 0 01-2-2V9a2 2 0 012-2h10a2 2 0 012 2v6a2 2 0 01-2 2h-2m-4 0v2m0-2H9m4 0h-4" /><circle cx="9" cy="17" r="1.5" /><circle cx="15" cy="17" r="1.5" /></svg>
}
function IcArea() {
  return <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" /></svg>
}
function IcLocal() {
  return <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
}
function IcWhatsApp() {
  return <svg width="20" height="20" fill="white" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.37 5.07L2 22l5.07-1.36A9.94 9.94 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.66 0-3.2-.45-4.54-1.23l-.32-.19-3.01.79.8-2.95-.21-.33A7.94 7.94 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8zm4.39-5.97c-.24-.12-1.41-.7-1.63-.78-.22-.08-.38-.12-.54.12s-.62.78-.76.94c-.14.16-.28.18-.52.06a6.53 6.53 0 01-1.91-1.18 7.17 7.17 0 01-1.32-1.64c-.14-.24-.01-.37.1-.49.1-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.29-.74-1.76-.19-.46-.39-.4-.54-.4h-.46c-.16 0-.42.06-.64.3s-.84.82-.84 2 .86 2.32.98 2.48c.12.16 1.68 2.56 4.06 3.59.57.24 1.01.39 1.36.5.57.18 1.09.15 1.5.09.46-.07 1.41-.58 1.61-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28z"/></svg>
}

function thumbUrl(url) {
  return url ? url.replace(/\.[^./?#]+$/, '_thumb.jpg') : url;
}

function montarEndereco(ap) {
  const linha1 = [[ap.rua, ap.numero].filter(Boolean).join(', '), ap.bairro].filter(Boolean).join(' — ')
  const linha2 = [ap.cidade, ap.estado].filter(Boolean).join(' - ')
  return [linha1, linha2].filter(Boolean).join(', ')
}

export default function ApresentacaoPublica() {
  const { slug } = useParams()
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [ambienteAtivo, setAmbienteAtivo] = useState(null)
  const [lightbox, setLightbox] = useState(null) // { fotos, idx }
  const tabsRef = useRef(null)

  useEffect(() => {
    fetch(`/api/apresentacoes/publico/${slug}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.apresentacao) setDados(d.apresentacao)
        else setErro(d.error || 'Apresentação não encontrada')
      })
      .catch(() => setErro('Erro ao carregar'))
      .finally(() => setLoading(false))
  }, [slug])

  const ap = dados
  const fotos = ap?.fotos || []
  const ambientes = [...new Set(fotos.map((f) => f.ambiente))]

  useEffect(() => {
    if (ambientes.length > 0 && !ambienteAtivo) setAmbienteAtivo(ambientes[0])
  }, [dados])

  useEffect(() => {
    if (!lightbox) return
    const handler = (e) => {
      if (e.key === 'Escape') setLightbox(null)
      if (e.key === 'ArrowLeft') setLightbox((p) => p && { ...p, idx: Math.max(0, p.idx - 1) })
      if (e.key === 'ArrowRight') setLightbox((p) => p && { ...p, idx: Math.min(p.fotos.length - 1, p.idx + 1) })
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [lightbox])

  const heroFoto = fotos[0]?.url || null
  const fotosDoAmb = fotos.filter((f) => f.ambiente === ambienteAtivo)

  const whatsappUrl = ap?.whatsappCorretor
    ? `https://wa.me/${ap.whatsappCorretor}?text=${encodeURIComponent(
        `Olá${ap.nomeCorretor ? ' ' + ap.nomeCorretor : ''}, vi a apresentação do ${ap.nomeImóvel} e gostaria de agendar uma visita!`
      )}`
    : null

  const temCaracteristicas = ap && (ap.quartos || ap.banheiros || ap.vagas || ap.areaM2 || ap.valor)
  const temLocalizacao = ap && ap.latitude != null && ap.longitude != null
  const enderecoTexto = ap ? montarEndereco(ap) : ''

  const scrollParaGaleria = () => document.getElementById('galeria')?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  // ── Loading / Erro ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <>
        <style>{CSS}</style>
        <div style={{ minHeight: '100vh', background: '#080808', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
          <div style={{ width: 36, height: 36, border: '2px solid rgba(255,255,255,0.1)', borderTop: '2px solid rgba(255,255,255,0.8)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, letterSpacing: '0.1em', margin: 0 }}>Carregando...</p>
        </div>
      </>
    )
  }

  if (erro || !ap) {
    return (
      <>
        <style>{CSS}</style>
        <div style={{ minHeight: '100vh', background: '#080808', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 20, fontWeight: 300, margin: 0 }}>Apresentação não encontrada</p>
          <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13, margin: 0 }}>{erro}</p>
        </div>
      </>
    )
  }

  // ── Página ─────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{CSS}</style>

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section style={{ position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: '#080808' }}>
        {heroFoto && (
          <img src={heroFoto} alt="" fetchpriority="high" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.55 }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.85) 100%)' }} />

        <div className="ap-fadein" style={{ position: 'relative', zIndex: 2, textAlign: 'center', padding: '40px 24px', maxWidth: 700, width: '100%' }}>
          {ap.nomeLeadPersonalizado && (
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 20, fontWeight: 300 }}>
              Preparamos esta apresentação especialmente para
            </p>
          )}
          {ap.nomeLeadPersonalizado && (
            <>
              <div style={{ width: 48, height: 1, background: 'rgba(255,255,255,0.3)', margin: '0 auto 20px' }} />
              <h1 style={{ color: '#fff', fontSize: 'clamp(2.5rem, 8vw, 4.5rem)', fontWeight: 700, margin: '0 0 16px', lineHeight: 1.1 }}>
                {ap.nomeLeadPersonalizado}
              </h1>
            </>
          )}
          <p style={{ color: ap.nomeLeadPersonalizado ? 'rgba(255,255,255,0.75)' : '#fff', fontSize: ap.nomeLeadPersonalizado ? 'clamp(1rem, 3vw, 1.4rem)' : 'clamp(2rem, 7vw, 3.5rem)', fontWeight: ap.nomeLeadPersonalizado ? 300 : 600, margin: '0 0 12px', lineHeight: 1.3 }}>
            {ap.nomeImóvel}
          </p>
          {ap.nomeLocal && (
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, margin: '0 0 40px' }}>
              <IcLocal /> {ap.nomeLocal}
            </p>
          )}
          {!ap.nomeLocal && <div style={{ height: 40 }} />}
          {fotos.length > 0 && (
            <button
              onClick={scrollParaGaleria}
              className="ap-tab"
              style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 50, padding: '14px 36px', fontSize: 14, fontWeight: 400, letterSpacing: '0.08em', cursor: 'pointer' }}
            >
              Ver imóvel ↓
            </button>
          )}
        </div>
      </section>

      {/* ── VÍDEO ─────────────────────────────────────────────────────────── */}
      {ap.videoUrl && (
        <section style={{ background: '#080808', padding: '60px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 20px' }}>
            <h2 style={{ color: 'rgba(255,255,255,0.9)', fontSize: 'clamp(1.2rem, 3vw, 1.6rem)', fontWeight: 300, marginBottom: 24, letterSpacing: '0.02em' }}>
              Conheça o imóvel
            </h2>
            <video
              src={ap.videoUrl}
              controls
              playsInline
              preload="none"
              poster={fotos[0]?.url}
              style={{ width: '100%', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', display: 'block' }}
            />
          </div>
        </section>
      )}

      {/* ── GALERIA ────────────────────────────────────────────────────────── */}
      {fotos.length > 0 && (
        <section id="galeria" style={{ background: '#0d0d0d', padding: '60px 0' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px' }}>
            <h2 style={{ color: 'rgba(255,255,255,0.9)', fontSize: 'clamp(1.2rem, 3vw, 1.6rem)', fontWeight: 300, marginBottom: 32, letterSpacing: '0.02em' }}>
              Galeria de fotos
            </h2>

            {/* Tabs de ambiente */}
            {ambientes.length > 1 && (
              <div ref={tabsRef} className="ap-scroll-x" style={{ display: 'flex', gap: 8, marginBottom: 28, overflowX: 'auto', paddingBottom: 4 }}>
                {ambientes.map((amb) => (
                  <button
                    key={amb}
                    className="ap-tab"
                    onClick={() => setAmbienteAtivo(amb)}
                    style={{
                      flexShrink: 0,
                      padding: '8px 18px',
                      borderRadius: 50,
                      border: '1px solid',
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: 'pointer',
                      background: ambienteAtivo === amb ? 'rgba(255,255,255,0.15)' : 'transparent',
                      borderColor: ambienteAtivo === amb ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.15)',
                      color: ambienteAtivo === amb ? '#fff' : 'rgba(255,255,255,0.45)',
                    }}
                  >
                    {amb}
                  </button>
                ))}
              </div>
            )}

            {/* Grid de fotos */}
            <div className="ap-foto-grid">
              {fotosDoAmb.map((foto, idx) => (
                <div
                  key={foto.id}
                  className="ap-foto-grid-item"
                  onClick={() => setLightbox({ fotos: fotosDoAmb, idx })}
                  style={{ aspectRatio: '4/3', background: '#111' }}
                >
                  <img
                    src={thumbUrl(foto.url)}
                    alt={foto.ambiente}
                    loading="lazy"
                    onError={(e) => { if (!e.currentTarget.dataset.fb) { e.currentTarget.dataset.fb = '1'; e.currentTarget.src = foto.url; } }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CARACTERÍSTICAS ────────────────────────────────────────────────── */}
      {temCaracteristicas && (
        <section style={{ background: '#080808', padding: '60px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px' }}>
            <h2 style={{ color: 'rgba(255,255,255,0.9)', fontSize: 'clamp(1.2rem, 3vw, 1.6rem)', fontWeight: 300, marginBottom: 36, letterSpacing: '0.02em' }}>
              Características
            </h2>

            {ap.valor && (
              <div style={{ marginBottom: 36 }}>
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 6 }}>Valor</p>
                <p style={{ color: '#fff', fontSize: 'clamp(1.8rem, 5vw, 2.6rem)', fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>
                  {(() => { try { const n = Number(ap.valor.replace(/[^\d.,]/g, '').replace(',', '.')); return isNaN(n) ? ap.valor : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) } catch { return ap.valor } })()}
                </p>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 16 }}>
              {ap.quartos != null && (
                <div style={{ background: '#111', borderRadius: 12, padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}><IcQuartos /></span>
                  <p style={{ color: '#fff', fontSize: 28, fontWeight: 700, margin: 0 }}>{ap.quartos}</p>
                  <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, margin: 0, letterSpacing: '0.05em' }}>Quartos</p>
                </div>
              )}
              {ap.banheiros != null && (
                <div style={{ background: '#111', borderRadius: 12, padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}><IcBanheiros /></span>
                  <p style={{ color: '#fff', fontSize: 28, fontWeight: 700, margin: 0 }}>{ap.banheiros}</p>
                  <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, margin: 0, letterSpacing: '0.05em' }}>Banheiros</p>
                </div>
              )}
              {ap.vagas != null && (
                <div style={{ background: '#111', borderRadius: 12, padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}><IcVagas /></span>
                  <p style={{ color: '#fff', fontSize: 28, fontWeight: 700, margin: 0 }}>{ap.vagas}</p>
                  <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, margin: 0, letterSpacing: '0.05em' }}>Vagas</p>
                </div>
              )}
              {ap.areaM2 != null && (
                <div style={{ background: '#111', borderRadius: 12, padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}><IcArea /></span>
                  <p style={{ color: '#fff', fontSize: 28, fontWeight: 700, margin: 0 }}>{ap.areaM2}</p>
                  <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, margin: 0, letterSpacing: '0.05em' }}>m²</p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── SOBRE ─────────────────────────────────────────────────────────── */}
      {ap.descricao && (
        <section style={{ background: '#0d0d0d', padding: '60px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px' }}>
            <div style={{ maxWidth: 760 }}>
              <h2 style={{ color: 'rgba(255,255,255,0.9)', fontSize: 'clamp(1.2rem, 3vw, 1.6rem)', fontWeight: 300, marginBottom: 24, letterSpacing: '0.02em' }}>
                Sobre o imóvel
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 16, lineHeight: 1.85, fontWeight: 300, margin: 0, whiteSpace: 'pre-line' }}>
                {ap.descricao}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ── LOCALIZAÇÃO ───────────────────────────────────────────────────── */}
      {temLocalizacao && (
        <section style={{ background: '#080808', padding: '60px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px' }}>
            <h2 style={{ color: 'rgba(255,255,255,0.9)', fontSize: 'clamp(1.2rem, 3vw, 1.6rem)', fontWeight: 300, marginBottom: 16, letterSpacing: '0.02em' }}>
              Localização
            </h2>
            {enderecoTexto && (
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 6 }}>
                <IcLocal /> {enderecoTexto}
              </p>
            )}
            <div style={{ height: 360, borderRadius: 12, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
              <MapContainer
                center={[ap.latitude, ap.longitude]}
                zoom={16}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />
                <Marker position={[ap.latitude, ap.longitude]} />
              </MapContainer>
            </div>
          </div>
        </section>
      )}

      {/* ── RODAPÉ ────────────────────────────────────────────────────────── */}
      <footer style={{ background: '#050505', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '40px 20px', textAlign: 'center' }}>
        {ap.imobiliaria?.logoUrl ? (
          <img src={ap.imobiliaria.logoUrl} alt={ap.imobiliaria.nome} style={{ height: 32, maxWidth: 160, objectFit: 'contain', marginBottom: 16, filter: 'brightness(0.7)' }} />
        ) : (
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 16 }}>
            {ap.imobiliaria?.nome}
          </p>
        )}
        <p style={{ color: 'rgba(255,255,255,0.15)', fontSize: 12, margin: 0 }}>
          Apresentação gerada pelo ImpulsoLead
        </p>
      </footer>

      {/* ── BOTÃO WHATSAPP FLUTUANTE ──────────────────────────────────────── */}
      {whatsappUrl && (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ap-wpp"
          style={{
            position: 'fixed', bottom: 24, right: 20, zIndex: 100,
            background: '#25D366', color: '#fff',
            borderRadius: 50, padding: '13px 22px',
            fontWeight: 600, fontSize: 14, textDecoration: 'none',
            display: 'flex', alignItems: 'center', gap: 9,
            boxShadow: '0 4px 20px rgba(37,211,102,0.35)',
            letterSpacing: '0.02em',
          }}
        >
          <IcWhatsApp /> Agendar visita
        </a>
      )}

      {/* ── LIGHTBOX ──────────────────────────────────────────────────────── */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.93)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: 40, height: 40, borderRadius: '50%', fontSize: 18, cursor: 'pointer' }}>✕</button>

          {lightbox.idx > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightbox((p) => ({ ...p, idx: p.idx - 1 })) }}
              style={{ position: 'absolute', left: 16, background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', width: 48, height: 48, borderRadius: '50%', fontSize: 22, cursor: 'pointer' }}
            >‹</button>
          )}

          <img
            src={lightbox.fotos[lightbox.idx]?.url}
            alt=""
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 4 }}
          />

          {lightbox.idx < lightbox.fotos.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightbox((p) => ({ ...p, idx: p.idx + 1 })) }}
              style={{ position: 'absolute', right: 16, background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', width: 48, height: 48, borderRadius: '50%', fontSize: 22, cursor: 'pointer' }}
            >›</button>
          )}

          <p style={{ position: 'absolute', bottom: 20, color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: 0 }}>
            {lightbox.idx + 1} / {lightbox.fotos.length}
          </p>
        </div>
      )}
    </>
  )
}
