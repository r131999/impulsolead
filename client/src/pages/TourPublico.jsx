import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'

// ── CSS injetado (hover, keyframes, scrollbar) ─────────────────────────────────

const ESTILOS = `
  @keyframes tour-spin { to { transform: rotate(360deg); } }
  @keyframes tour-pulse {
    0%, 100% { transform: scale(1.0); }
    50%       { transform: scale(1.03); }
  }
  .tour-btn-explorar {
    animation: tour-pulse 2.4s ease-in-out infinite;
    transition: background 0.25s ease, color 0.25s ease, border-color 0.25s ease;
  }
  .tour-btn-explorar:hover {
    animation: none !important;
    background: rgba(255,255,255,1) !important;
    color: #0a0a0a !important;
    border-color: transparent !important;
    transform: scale(1) !important;
  }
  .tour-btn-explorar:active { animation: none !important; transform: scale(0.97) !important; }
  .tour-seta { transition: background 0.18s ease; }
  .tour-seta:hover { background: rgba(255,255,255,0.28) !important; }
  .tour-thumb-wrap { transition: opacity 0.2s ease; }
  .tour-thumb-inner { transition: filter 0.2s ease; }
  .tour-thumb-wrap:hover .tour-thumb-inner { filter: brightness(1.25); }
  .tour-wpp { transition: transform 0.2s ease, box-shadow 0.2s ease; }
  .tour-wpp:hover { transform: scale(1.06); box-shadow: 0 8px 28px rgba(37,211,102,0.5) !important; }
  .comodos-scroll::-webkit-scrollbar { display: none; }
  .comodos-scroll { scrollbar-width: none; -ms-overflow-style: none; }
`

// ── Ícones SVG ──────────────────────────────────────────────────────────────────

function IconeChevronEsq() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function IconeChevronDir() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function IconeWhatsApp() {
  return (
    <svg width="18" height="18" fill="white" viewBox="0 0 24 24">
      <path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.37 5.07L2 22l5.07-1.36A9.94 9.94 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.66 0-3.2-.45-4.54-1.23l-.32-.19-3.01.79.8-2.95-.21-.33A7.94 7.94 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8zm4.39-5.97c-.24-.12-1.41-.7-1.63-.78-.22-.08-.38-.12-.54.12s-.62.78-.76.94c-.14.16-.28.18-.52.06a6.53 6.53 0 01-1.91-1.18 7.17 7.17 0 01-1.32-1.64c-.14-.24-.01-.37.1-.49.1-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.29-.74-1.76-.19-.46-.39-.4-.54-.4h-.46c-.16 0-.42.06-.64.3s-.84.82-.84 2 .86 2.32.98 2.48c.12.16 1.68 2.56 4.06 3.59.57.24 1.01.39 1.36.5.57.18 1.09.15 1.5.09.46-.07 1.41-.58 1.61-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28z" />
    </svg>
  )
}

// ── Componente principal ────────────────────────────────────────────────────────

export default function TourPublico() {
  const { slug } = useParams()

  // API
  const [tour, setTour]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [erro, setErro]         = useState('')

  // Preload
  const [primeiraFotoOk, setPrimeiraFotoOk] = useState(false)

  // Fluxo
  const [iniciado, setIniciado]           = useState(false)
  const [viewerOpacity, setViewerOpacity] = useState(0)

  // Navegação
  const [comodoAtual, setComodoAtual] = useState(0)
  const [fotoAtual, setFotoAtual]     = useState(0)
  const [controlsVisible, setControlsVisible] = useState(true)

  // Animação de foto
  const [displayUrl, setDisplayUrl] = useState(null)
  const [imgStyle, setImgStyle]     = useState({ opacity: 0 })

  // Swipe
  const [swipeTranslate, setSwipeTranslate] = useState(0)
  const touchStartX     = useRef(null)
  const thumbRefs       = useRef([])
  const isComodoChange  = useRef(false)
  const fadeTimer       = useRef(null)

  // ── Fetch ─────────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch(`/api/tours/publico/${slug}`)
      .then((r) => r.json())
      .then((d) => { if (d.tour) setTour(d.tour); else setErro(d.error || 'Tour não encontrado') })
      .catch(() => setErro('Erro ao carregar tour'))
      .finally(() => setLoading(false))
  }, [slug])

  // ── Preload ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!tour) return
    const urls = tour.comodos.flatMap((c) => c.fotos.map((f) => f.url))
    if (!urls.length) { setPrimeiraFotoOk(true); return }

    const img = new window.Image()
    img.onload = img.onerror = () => setPrimeiraFotoOk(true)
    img.src = urls[0]

    urls.slice(1).forEach((u) => { const i = new window.Image(); i.src = u })
  }, [tour])

  // ── Dados derivados ───────────────────────────────────────────────────────────

  const comodos       = tour?.comodos || []
  const comodoData    = comodos[comodoAtual]
  const fotos         = comodoData?.fotos || []
  const totalFotos    = fotos.length
  const totalComodos  = comodos.length
  const fotoUrl       = fotos[fotoAtual]?.url || null
  const primeiraFoto  = comodos[0]?.fotos?.[0]?.url || null
  const totalFotosAll = comodos.reduce((a, c) => a + (c.fotos?.length || 0), 0)

  // ── Animação da foto ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!iniciado) return
    clearTimeout(fadeTimer.current)

    const entrandoComodo = isComodoChange.current
    isComodoChange.current = false

    if (!fotoUrl) { setDisplayUrl(null); setImgStyle({ opacity: 0 }); return }

    setDisplayUrl(fotoUrl)
    setImgStyle({ opacity: 0, transform: entrandoComodo ? 'scale(1.05)' : 'scale(1.02)', transition: 'none' })

    fadeTimer.current = setTimeout(() => {
      setImgStyle({
        opacity: 1,
        transform: 'scale(1)',
        transition: `opacity ${entrandoComodo ? 0.55 : 0.38}s ease, transform ${entrandoComodo ? 0.75 : 0.45}s ease`,
      })
    }, 30)

    return () => clearTimeout(fadeTimer.current)
  }, [fotoUrl, iniciado])

  // ── Scroll automático do thumb ativo ──────────────────────────────────────────

  useEffect(() => {
    thumbRefs.current[comodoAtual]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [comodoAtual])

  // ── Navegação ─────────────────────────────────────────────────────────────────

  const mudarComodo = (idx, foto = 0) => {
    isComodoChange.current = true
    setComodoAtual(idx)
    setFotoAtual(foto)
    setControlsVisible(true)
  }

  const irProxima = () => {
    if (fotoAtual < totalFotos - 1) setFotoAtual((p) => p + 1)
    else if (comodoAtual < totalComodos - 1) mudarComodo(comodoAtual + 1, 0)
  }

  const irAnterior = () => {
    if (fotoAtual > 0) setFotoAtual((p) => p - 1)
    else if (comodoAtual > 0) {
      const prev = comodos[comodoAtual - 1]
      mudarComodo(comodoAtual - 1, Math.max(0, (prev?.fotos?.length || 1) - 1))
    }
  }

  // ── Touch ─────────────────────────────────────────────────────────────────────

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX }

  const handleTouchMove = (e) => {
    if (touchStartX.current === null) return
    setSwipeTranslate((e.touches[0].clientX - touchStartX.current) * 0.12)
  }

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return
    const diff = touchStartX.current - e.changedTouches[0].clientX
    setSwipeTranslate(0)
    if (Math.abs(diff) > 50) diff > 0 ? irProxima() : irAnterior()
    touchStartX.current = null
  }

  // ── Iniciar tour ──────────────────────────────────────────────────────────────

  const iniciarTour = () => {
    setIniciado(true)
    setTimeout(() => setViewerOpacity(1), 30)
  }

  // ── Derivados ─────────────────────────────────────────────────────────────────

  const temProxima  = fotoAtual < totalFotos - 1 || comodoAtual < totalComodos - 1
  const temAnterior = fotoAtual > 0 || comodoAtual > 0

  const whatsappUrl = tour?.whatsappCorretor
    ? `https://wa.me/${tour.whatsappCorretor}?text=${encodeURIComponent(
        `Olá${tour.nomeCorretor ? ' ' + tour.nomeCorretor : ''}, vi o tour do imóvel ${tour.nome} e tenho interesse!`
      )}`
    : null

  // ── Loading ───────────────────────────────────────────────────────────────────

  if (loading || (tour && !primeiraFotoOk)) {
    return (
      <>
        <style>{ESTILOS}</style>
        <div style={{ position: 'fixed', inset: 0, backgroundColor: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.12)', borderTop: '1.5px solid rgba(255,255,255,0.85)', animation: 'tour-spin 0.85s linear infinite' }} />
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>
            Carregando tour...
          </p>
        </div>
      </>
    )
  }

  // ── Erro ──────────────────────────────────────────────────────────────────────

  if (erro || !tour) {
    return (
      <>
        <style>{ESTILOS}</style>
        <div style={{ position: 'fixed', inset: 0, backgroundColor: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 18, fontWeight: 300, margin: 0 }}>Tour não encontrado</p>
          <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13, margin: 0 }}>{erro || 'Verifique o link e tente novamente.'}</p>
        </div>
      </>
    )
  }

  // ── Tela de entrada ───────────────────────────────────────────────────────────

  if (!iniciado) {
    return (
      <>
        <style>{ESTILOS}</style>
        <div style={{ position: 'fixed', inset: 0, backgroundColor: '#000', overflow: 'hidden' }}>
          {/* Foto fullscreen */}
          {primeiraFoto && (
            <img
              src={primeiraFoto}
              alt=""
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}

          {/* Overlay escuro */}
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)' }} />

          {/* Logo / nome da imobiliária — topo */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '32px 24px' }}>
            {tour.imobiliaria?.logoUrl ? (
              <img
                src={tour.imobiliaria.logoUrl}
                alt={tour.imobiliaria.nome}
                style={{ height: 34, maxWidth: 160, objectFit: 'contain', filter: 'drop-shadow(0 1px 6px rgba(0,0,0,0.7))' }}
              />
            ) : (
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 300, letterSpacing: '0.28em', textTransform: 'uppercase', margin: 0 }}>
                {tour.imobiliaria?.nome}
              </p>
            )}
          </div>

          {/* Conteúdo central */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 32px', textAlign: 'center', pointerEvents: 'none' }}>
            <h1 style={{ color: '#fff', fontSize: 'clamp(1.8rem, 6vw, 3rem)', fontWeight: 300, lineHeight: 1.15, maxWidth: 660, margin: '0 0 18px', letterSpacing: '-0.01em' }}>
              {tour.nome}
            </h1>

            {tour.descricao && (
              <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 'clamp(0.875rem, 2.5vw, 1rem)', maxWidth: 480, margin: '0 0 14px', lineHeight: 1.75, fontWeight: 300 }}>
                {tour.descricao}
              </p>
            )}

            <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: 11, fontWeight: 400, letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 52px' }}>
              {totalComodos} cômodo{totalComodos !== 1 ? 's' : ''} · {totalFotosAll} foto{totalFotosAll !== 1 ? 's' : ''}
            </p>

            <button
              className="tour-btn-explorar"
              onClick={iniciarTour}
              style={{
                background: 'transparent',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.65)',
                borderRadius: 50,
                padding: '16px 48px',
                fontSize: 'clamp(0.75rem, 1.8vw, 0.85rem)',
                fontWeight: 400,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                pointerEvents: 'all',
              }}
            >
              Explorar imóvel →
            </button>
          </div>
        </div>
      </>
    )
  }

  // ── Visualizador ──────────────────────────────────────────────────────────────

  return (
    <>
      <style>{ESTILOS}</style>
      <div
        style={{ position: 'fixed', inset: 0, backgroundColor: '#000', overflow: 'hidden', opacity: viewerOpacity, transition: 'opacity 0.5s ease' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* ── Foto com transição ────────────────────────────────────────────── */}
        <div
          onClick={() => setControlsVisible((p) => !p)}
          style={{ position: 'absolute', inset: 0, cursor: 'pointer', ...imgStyle }}
        >
          {displayUrl ? (
            <img
              src={displayUrl}
              alt=""
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
                transform: `translateX(${swipeTranslate}px)`,
                transition: swipeTranslate !== 0 ? 'none' : 'transform 0.3s ease',
              }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 14, fontWeight: 300 }}>Sem fotos neste cômodo</p>
            </div>
          )}
        </div>

        {/* ── Gradientes ────────────────────────────────────────────────────── */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 130, background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 260, background: 'linear-gradient(to top, rgba(0,0,0,0.88), transparent)', pointerEvents: 'none' }} />

        {/* ── Controles (ocultáveis) ────────────────────────────────────────── */}
        {controlsVisible && (
          <>
            {/* Topo: imobiliária | cômodo | contador */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 24px', gap: 12, pointerEvents: 'none' }}>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 300, letterSpacing: '0.12em', textTransform: 'uppercase', margin: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {tour.imobiliaria?.nome}
              </p>
              <p style={{ color: '#fff', fontSize: 14, fontWeight: 600, margin: 0, flex: 2, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {comodoData?.nome}
              </p>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 300, margin: 0, flex: 1, textAlign: 'right', whiteSpace: 'nowrap' }}>
                {totalFotos > 0 ? `${fotoAtual + 1} / ${totalFotos} fotos` : ''}
              </p>
            </div>

            {/* Seta esquerda */}
            {temAnterior && (
              <button
                className="tour-seta"
                onClick={irAnterior}
                style={{
                  position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
                  width: 56, height: 56, borderRadius: '50%',
                  border: '1px solid rgba(255,255,255,0.18)',
                  background: 'rgba(255,255,255,0.15)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <IconeChevronEsq />
              </button>
            )}

            {/* Seta direita */}
            {temProxima && (
              <button
                className="tour-seta"
                onClick={irProxima}
                style={{
                  position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
                  width: 56, height: 56, borderRadius: '50%',
                  border: '1px solid rgba(255,255,255,0.18)',
                  background: 'rgba(255,255,255,0.15)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <IconeChevronDir />
              </button>
            )}

            {/* Base: bolinhas + thumbnails */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
              {/* Bolinhas */}
              {totalFotos > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 7, marginBottom: 18 }}>
                  {fotos.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setFotoAtual(idx)}
                      style={{
                        width:   idx === fotoAtual ? 8 : 6,
                        height:  idx === fotoAtual ? 8 : 6,
                        borderRadius: '50%',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        background: idx === fotoAtual ? '#fff' : 'rgba(255,255,255,0.4)',
                        transition: 'width 0.2s ease, height 0.2s ease, background 0.2s ease',
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Thumbnails de cômodos */}
              {totalComodos > 1 && (
                <div
                  className="comodos-scroll"
                  style={{
                    display: 'flex',
                    gap: 12,
                    overflowX: 'auto',
                    padding: '0 24px 22px',
                    justifyContent: totalComodos <= 5 ? 'center' : 'flex-start',
                  }}
                >
                  {comodos.map((c, idx) => {
                    const thumb = c.fotos?.[0]?.url
                    const ativo = idx === comodoAtual
                    return (
                      <button
                        key={c.id}
                        ref={(el) => (thumbRefs.current[idx] = el)}
                        className="tour-thumb-wrap"
                        onClick={() => { if (idx !== comodoAtual) mudarComodo(idx, 0) }}
                        style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: 'none', border: 'none', padding: 0, cursor: 'pointer', opacity: ativo ? 1 : 0.6, transition: 'opacity 0.2s ease' }}
                      >
                        <div
                          className="tour-thumb-inner"
                          style={{
                            width: 80, height: 60, borderRadius: 5,
                            overflow: 'hidden', backgroundColor: '#111',
                            borderBottom: `2px solid ${ativo ? '#fff' : 'transparent'}`,
                            transition: 'border-color 0.2s ease',
                          }}
                        >
                          {thumb ? (
                            <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <svg width="18" height="18" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" viewBox="0 0 24 24">
                                <rect x="3" y="3" width="18" height="18" rx="2" />
                                <path d="M3 9l4-4 4 4 4-4 4 4" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <span style={{ color: ativo ? '#fff' : 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: ativo ? 500 : 400, maxWidth: 80, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '0.02em', transition: 'color 0.2s ease' }}>
                          {c.nome}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              {totalComodos <= 1 && <div style={{ height: 24 }} />}
            </div>
          </>
        )}

        {/* ── WhatsApp — sempre visível ─────────────────────────────────────── */}
        {whatsappUrl && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="tour-wpp"
            style={{
              position: 'absolute',
              bottom: controlsVisible && totalComodos > 1 ? 118 : 24,
              right: 20,
              backgroundColor: '#25D366',
              color: '#fff',
              borderRadius: 50,
              padding: '11px 20px',
              fontWeight: 600,
              fontSize: 13,
              textDecoration: 'none',
              boxShadow: '0 4px 20px rgba(37,211,102,0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              zIndex: 20,
              letterSpacing: '0.02em',
              transition: 'bottom 0.3s ease',
            }}
          >
            <IconeWhatsApp />
            Falar com corretor
          </a>
        )}
      </div>
    </>
  )
}
