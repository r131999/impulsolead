import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'

export default function TourPublico() {
  const { slug } = useParams()
  const [tour, setTour] = useState(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [iniciado, setIniciado] = useState(false)
  const [comodoAtual, setComodoAtual] = useState(0)
  const [fotoAtual, setFotoAtual] = useState(0)
  const [controlsVisible, setControlsVisible] = useState(true)
  const touchStartX = useRef(null)
  const thumbRefs = useRef([])

  useEffect(() => {
    fetch(`/api/tours/publico/${slug}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.tour) setTour(data.tour)
        else setErro(data.error || 'Tour não encontrado')
      })
      .catch(() => setErro('Erro ao carregar tour'))
      .finally(() => setLoading(false))
  }, [slug])

  const comodos = tour?.comodos || []
  const comodoData = comodos[comodoAtual]
  const fotos = comodoData?.fotos || []
  const totalFotos = fotos.length
  const totalComodos = comodos.length
  const fotoUrl = fotos[fotoAtual]?.url

  const primeiraFoto = comodos[0]?.fotos?.[0]?.url

  useEffect(() => {
    thumbRefs.current[comodoAtual]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [comodoAtual])

  const irProxima = () => {
    if (fotoAtual < totalFotos - 1) {
      setFotoAtual((p) => p + 1)
    } else if (comodoAtual < totalComodos - 1) {
      setComodoAtual((p) => p + 1)
      setFotoAtual(0)
    }
  }

  const irAnterior = () => {
    if (fotoAtual > 0) {
      setFotoAtual((p) => p - 1)
    } else if (comodoAtual > 0) {
      const prevComodo = comodos[comodoAtual - 1]
      setComodoAtual((p) => p - 1)
      setFotoAtual(Math.max(0, (prevComodo?.fotos?.length || 1) - 1))
    }
  }

  const irParaComodo = (idx) => {
    setComodoAtual(idx)
    setFotoAtual(0)
  }

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX }
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return
    const diff = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 50) {
      if (diff > 0) irProxima()
      else irAnterior()
    }
    touchStartX.current = null
  }

  const handleTapFoto = () => setControlsVisible((p) => !p)

  const temProxima = fotoAtual < totalFotos - 1 || comodoAtual < totalComodos - 1
  const temAnterior = fotoAtual > 0 || comodoAtual > 0

  const whatsappUrl = tour?.whatsappCorretor
    ? `https://wa.me/${tour.whatsappCorretor}?text=${encodeURIComponent(
        `Olá ${tour.nomeCorretor || ''}, vi o tour do imóvel ${tour.nome} e tenho interesse!`.trim()
      )}`
    : null

  // ── Loading / Erro ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, backgroundColor: '#0B1120', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500" />
      </div>
    )
  }

  if (erro || !tour) {
    return (
      <div style={{ position: 'fixed', inset: 0, backgroundColor: '#0B1120', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <span style={{ fontSize: 48 }}>🏠</span>
        <p style={{ color: '#94A3B8', fontSize: 18, fontWeight: 600 }}>Tour não encontrado</p>
        <p style={{ color: '#64748B', fontSize: 14 }}>{erro || 'Verifique o link e tente novamente.'}</p>
      </div>
    )
  }

  // ── Tela de entrada ───────────────────────────────────────────────────────────

  if (!iniciado) {
    return (
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', backgroundColor: '#0B1120' }}>
        {/* Hero com blur */}
        {primeiraFoto && (
          <>
            <img
              src={primeiraFoto}
              alt=""
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(18px)', transform: 'scale(1.05)' }}
            />
            <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)' }} />
          </>
        )}

        {/* Conteúdo */}
        <div style={{ position: 'relative', zIndex: 10, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
          {tour.imobiliaria?.logoUrl && (
            <img
              src={tour.imobiliaria.logoUrl}
              alt={tour.imobiliaria.nome}
              style={{ height: 52, maxWidth: 200, objectFit: 'contain', marginBottom: 24 }}
            />
          )}
          {!tour.imobiliaria?.logoUrl && tour.imobiliaria?.nome && (
            <p style={{ color: '#94A3B8', fontSize: 14, marginBottom: 24, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase' }}>
              {tour.imobiliaria.nome}
            </p>
          )}

          <h1 style={{ color: '#F1F5F9', fontSize: 'clamp(1.5rem, 5vw, 2.5rem)', fontWeight: 700, lineHeight: 1.2, maxWidth: 600, marginBottom: 12 }}>
            {tour.nome}
          </h1>

          {tour.descricao && (
            <p style={{ color: '#94A3B8', fontSize: 'clamp(0.875rem, 2.5vw, 1rem)', maxWidth: 480, marginBottom: 8, lineHeight: 1.6 }}>
              {tour.descricao}
            </p>
          )}

          <p style={{ color: '#64748B', fontSize: 13, marginBottom: 32 }}>
            {totalComodos} cômodo{totalComodos !== 1 ? 's' : ''} · {comodos.reduce((acc, c) => acc + (c.fotos?.length || 0), 0)} foto{comodos.reduce((acc, c) => acc + (c.fotos?.length || 0), 0) !== 1 ? 's' : ''}
          </p>

          <button
            onClick={() => setIniciado(true)}
            style={{
              backgroundColor: '#6366F1',
              color: '#fff',
              fontWeight: 700,
              fontSize: 'clamp(0.875rem, 2.5vw, 1rem)',
              padding: '14px 36px',
              borderRadius: 50,
              border: 'none',
              cursor: 'pointer',
              letterSpacing: 0.5,
              boxShadow: '0 4px 24px rgba(99,102,241,0.4)',
            }}
          >
            Iniciar Tour →
          </button>
        </div>
      </div>
    )
  }

  // ── Visualizador ──────────────────────────────────────────────────────────────

  return (
    <div
      style={{ position: 'fixed', inset: 0, backgroundColor: '#000', overflow: 'hidden' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Foto principal */}
      {fotoUrl ? (
        <img
          key={fotoUrl}
          src={fotoUrl}
          alt=""
          onClick={handleTapFoto}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
        />
      ) : (
        <div
          onClick={handleTapFoto}
          style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B1120', cursor: 'pointer' }}
        >
          <p style={{ color: '#475569', fontSize: 14 }}>Este cômodo não possui fotos</p>
        </div>
      )}

      {/* Gradiente topo */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 100, background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)', pointerEvents: 'none' }} />
      {/* Gradiente base */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 220, background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)', pointerEvents: 'none' }} />

      {controlsVisible && (
        <>
          {/* Topo */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600, letterSpacing: 0.5 }}>
              {tour.imobiliaria?.nome}
            </p>
            <p style={{ color: '#fff', fontSize: 14, fontWeight: 700, textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
              {comodoData?.nome}
            </p>
            <div style={{ width: 80 }} />
          </div>

          {/* Seta esquerda */}
          {temAnterior && (
            <button
              onClick={irAnterior}
              style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                width: 48, height: 48, borderRadius: '50%', border: 'none',
                backgroundColor: 'rgba(0,0,0,0.45)', color: '#fff', fontSize: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', backdropFilter: 'blur(4px)',
              }}
            >
              ‹
            </button>
          )}

          {/* Seta direita */}
          {temProxima && (
            <button
              onClick={irProxima}
              style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                width: 48, height: 48, borderRadius: '50%', border: 'none',
                backgroundColor: 'rgba(0,0,0,0.45)', color: '#fff', fontSize: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', backdropFilter: 'blur(4px)',
              }}
            >
              ›
            </button>
          )}

          {/* Base */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
            {/* Bolinhas de progresso */}
            {totalFotos > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 12 }}>
                {fotos.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setFotoAtual(idx)}
                    style={{
                      width: idx === fotoAtual ? 20 : 6,
                      height: 6,
                      borderRadius: 3,
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'width 0.2s, background-color 0.2s',
                      backgroundColor: idx === fotoAtual ? '#fff' : 'rgba(255,255,255,0.35)',
                      padding: 0,
                    }}
                  />
                ))}
              </div>
            )}

            {/* Thumbnails de cômodos */}
            {totalComodos > 1 && (
              <div style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '0 16px 16px', scrollbarWidth: 'none' }}>
                {comodos.map((c, idx) => {
                  const thumb = c.fotos?.[0]?.url
                  const ativo = idx === comodoAtual
                  return (
                    <button
                      key={c.id}
                      ref={(el) => (thumbRefs.current[idx] = el)}
                      onClick={() => irParaComodo(idx)}
                      style={{
                        flexShrink: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 4,
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      <div
                        style={{
                          width: 60,
                          height: 44,
                          borderRadius: 6,
                          overflow: 'hidden',
                          border: ativo ? '2px solid #6366F1' : '2px solid rgba(255,255,255,0.15)',
                          backgroundColor: '#1E293B',
                        }}
                      >
                        {thumb ? (
                          <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: 16 }}>🏠</span>
                          </div>
                        )}
                      </div>
                      <span
                        style={{
                          color: ativo ? '#818cf8' : 'rgba(255,255,255,0.55)',
                          fontSize: 10,
                          fontWeight: ativo ? 600 : 400,
                          maxWidth: 64,
                          textAlign: 'center',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {c.nome}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Padding se só 1 cômodo */}
            {totalComodos <= 1 && <div style={{ height: 24 }} />}
          </div>
        </>
      )}

      {/* Botão WhatsApp — sempre visível */}
      {whatsappUrl && (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            position: 'absolute',
            bottom: controlsVisible && totalComodos > 1 ? 110 : 24,
            right: 16,
            backgroundColor: '#25D366',
            color: '#fff',
            borderRadius: 50,
            padding: '10px 16px',
            fontWeight: 700,
            fontSize: 13,
            textDecoration: 'none',
            boxShadow: '0 4px 16px rgba(37,211,102,0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            zIndex: 20,
            transition: 'bottom 0.2s',
          }}
        >
          <span style={{ fontSize: 16 }}>💬</span>
          Falar com corretor
        </a>
      )}
    </div>
  )
}
