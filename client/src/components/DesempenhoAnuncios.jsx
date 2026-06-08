import { useState, useEffect, Component } from 'react'
import api from '../api/axios'

// --- format helpers ---
const brl = (n) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n ?? 0)

const intBr = (n) => Number(n ?? 0).toLocaleString('pt-BR')

function sortAnuncios(anuncios, sortBy) {
  return [...anuncios].sort((a, b) => {
    if (sortBy === 'cpv') {
      const va = a.vendas > 0 ? a.gasto / a.vendas : null
      const vb = b.vendas > 0 ? b.gasto / b.vendas : null
      if (va === null && vb === null) return 0
      if (va === null) return 1
      if (vb === null) return -1
      return va - vb
    }
    const va = a.leads > 0 ? a.gasto / a.leads : null
    const vb = b.leads > 0 ? b.gasto / b.leads : null
    if (va === null && vb === null) return 0
    if (va === null) return 1
    if (vb === null) return -1
    return va - vb
  })
}

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false } }
  static getDerivedStateFromError() { return { hasError: true } }
  render() {
    if (this.state.hasError) {
      return (
        <div className="card mb-6">
          <p className="text-sm" style={{ color: '#EF4444' }}>
            Não foi possível carregar o desempenho dos anúncios.
          </p>
        </div>
      )
    }
    return this.props.children
  }
}

const PERIODOS = [
  { label: '7 dias', dias: 7 },
  { label: '15 dias', dias: 15 },
  { label: '30 dias', dias: 30 },
]

function DesempenhoAnunciosInner() {
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(false)
  const [dias, setDias] = useState(30)
  const [sortBy, setSortBy] = useState('cpv')
  const [filtro, setFiltro] = useState('ativas')
  const [sincronizando, setSincronizando] = useState(false)
  const [erroSync, setErroSync] = useState(null)

  function carregarDados(diasParam) {
    setLoading(true)
    setErro(false)
    api
      .get('/desempenho-anuncios', { params: { dias: diasParam } })
      .then((res) => setDados(res.data))
      .catch(() => setErro(true))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    carregarDados(dias)
  }, [dias])

  async function handleSincronizar() {
    setSincronizando(true)
    setErroSync(null)
    try {
      await api.post('/desempenho-anuncios/sincronizar')
      carregarDados(dias)
    } catch {
      setErroSync('Falha ao sincronizar. Tente novamente.')
    } finally {
      setSincronizando(false)
    }
  }

  // Filtro client-side — não refaz chamada ao alternar
  const anunciosFiltrados = dados
    ? filtro === 'ativas'
      ? dados.anuncios.filter((a) => a.ativo)
      : dados.anuncios
    : []

  // Totais recalculados dos anúncios visíveis (batem sempre com a tabela)
  const totaisVisiveis = anunciosFiltrados.reduce(
    (acc, a) => ({
      gasto: acc.gasto + a.gasto,
      leads: acc.leads + a.leads,
      vendas: acc.vendas + a.vendas,
      valorVendido: acc.valorVendido + a.valorVendido,
    }),
    { gasto: 0, leads: 0, vendas: 0, valorVendido: 0 }
  )

  return (
    <div className="mb-8">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold" style={{ color: '#F1F5F9' }}>
            Desempenho por anúncio
          </h2>
          <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
            Origem: Meta Lead Ads
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
          {/* Toggle Ativas / Todas */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #1E293B' }}>
            {['ativas', 'todas'].map((f) => (
              <button
                key={f}
                onClick={() => setFiltro(f)}
                className="text-xs px-3 py-1.5 font-medium transition-colors"
                style={
                  filtro === f
                    ? { backgroundColor: '#6366f1', color: '#fff' }
                    : { backgroundColor: '#111827', color: '#94A3B8' }
                }
              >
                {f === 'ativas' ? 'Ativas' : 'Todas'}
              </button>
            ))}
          </div>

          {/* Seletor de período */}
          <div className="flex gap-1">
            {PERIODOS.map((p) => (
              <button
                key={p.dias}
                onClick={() => setDias(p.dias)}
                disabled={loading}
                className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-60"
                style={
                  dias === p.dias
                    ? { backgroundColor: '#6366f1', color: '#fff' }
                    : { backgroundColor: '#1E293B', color: '#94A3B8' }
                }
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Botão Atualizar */}
          <button
            onClick={handleSincronizar}
            disabled={sincronizando || loading}
            className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-60"
            style={{ backgroundColor: '#1E293B', color: sincronizando ? '#64748B' : '#94A3B8', border: '1px solid #334155' }}
          >
            {sincronizando ? 'Atualizando…' : '↻ Atualizar'}
          </button>
        </div>
      </div>

      {/* Erro de sincronização sob demanda */}
      {erroSync && (
        <p className="text-xs mb-3" style={{ color: '#EF4444' }}>{erroSync}</p>
      )}

      {/* Skeleton */}
      {loading && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="rounded-xl p-4 animate-pulse"
                style={{ backgroundColor: '#111827', border: '1px solid #1E293B', height: 76 }}
              />
            ))}
          </div>
          <div className="card">
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="h-10 rounded-lg animate-pulse"
                  style={{ backgroundColor: '#1E293B' }}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Erro */}
      {!loading && erro && (
        <div className="card">
          <p className="text-sm" style={{ color: '#EF4444' }}>
            Não foi possível carregar o desempenho dos anúncios.
          </p>
        </div>
      )}

      {/* Conteúdo */}
      {!loading && !erro && dados && (
        <>
          {/* Cards resumo — refletem os anúncios visíveis */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
            {[
              {
                label: 'Investido',
                value: brl(totaisVisiveis.gasto),
                cor: '#60A5FA',
              },
              {
                label: 'Leads',
                value: intBr(totaisVisiveis.leads),
                cor: '#818cf8',
              },
              {
                label: 'Vendas',
                value: intBr(totaisVisiveis.vendas),
                cor: '#10B981',
              },
              {
                label: 'Valor vendido',
                value: brl(totaisVisiveis.valorVendido),
                cor: '#10B981',
              },
              {
                label: 'Custo por venda',
                value:
                  totaisVisiveis.vendas > 0
                    ? brl(totaisVisiveis.gasto / totaisVisiveis.vendas)
                    : '—',
                cor: totaisVisiveis.vendas > 0 ? '#F59E0B' : '#64748B',
              },
            ].map(({ label, value, cor }) => (
              <div
                key={label}
                className="rounded-xl p-4"
                style={{ backgroundColor: '#111827', border: '1px solid #1E293B' }}
              >
                <p className="text-xs font-medium mb-1" style={{ color: '#64748B' }}>
                  {label}
                </p>
                <p className="text-lg font-bold leading-tight" style={{ color: cor }}>
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* Botões de ordenação */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs" style={{ color: '#64748B' }}>
              Ordenar por:
            </span>
            {[
              { key: 'cpv', label: 'Custo por venda' },
              { key: 'cpl', label: 'CPL' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSortBy(key)}
                className="text-xs px-3 py-1 rounded-lg font-medium transition-colors"
                style={
                  sortBy === key
                    ? {
                        backgroundColor: 'rgba(99,102,241,0.2)',
                        color: '#818cf8',
                        border: '1px solid #6366f1',
                      }
                    : {
                        backgroundColor: '#1E293B',
                        color: '#64748B',
                        border: '1px solid #1E293B',
                      }
                }
              >
                {label} ↑
              </button>
            ))}
          </div>

          {/* Tabela */}
          {anunciosFiltrados.length === 0 ? (
            <div className="card">
              <p className="text-sm text-center py-6" style={{ color: '#64748B' }}>
                {filtro === 'ativas'
                  ? 'Nenhum anúncio ativo no período. Alterne para "Todas" para ver todos.'
                  : 'Nenhum dado de anúncio encontrado no período.'}
              </p>
            </div>
          ) : (
            <div className="card p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead
                    style={{
                      backgroundColor: '#0B1120',
                      borderBottom: '1px solid #1E293B',
                    }}
                  >
                    <tr>
                      {[
                        'Anúncio',
                        'Gasto (R$)',
                        'Leads',
                        'CPL',
                        'Visitas',
                        'Vendas',
                        'Custo/venda',
                        'Valor vendido',
                      ].map((h) => (
                        <th
                          key={h}
                          className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide whitespace-nowrap"
                          style={{ color: '#64748B' }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortAnuncios(anunciosFiltrados, sortBy).map((ad, idx) => {
                      const qualifPct =
                        ad.leads > 0
                          ? `${((ad.qualificados / ad.leads) * 100).toFixed(1)}%`
                          : null

                      return (
                        <tr
                          key={ad.adId}
                          style={{
                            borderBottom: '1px solid #1E293B',
                            backgroundColor:
                              idx % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent',
                          }}
                        >
                          {/* Anúncio */}
                          <td
                            className="px-4 py-3 font-medium"
                            style={{ color: '#F1F5F9', maxWidth: 220 }}
                          >
                            <span
                              className="block truncate"
                              title={ad.adName || ad.adId}
                            >
                              {ad.adName || ad.adId || '—'}
                            </span>
                          </td>

                          {/* Gasto */}
                          <td
                            className="px-4 py-3 whitespace-nowrap"
                            style={{ color: '#94A3B8' }}
                          >
                            {brl(ad.gasto)}
                          </td>

                          {/* Leads + qualif */}
                          <td className="px-4 py-3">
                            <span className="font-medium" style={{ color: '#F1F5F9' }}>
                              {ad.leads}
                            </span>
                            {qualifPct && (
                              <span
                                className="block text-xs mt-0.5"
                                style={{ color: '#64748B' }}
                              >
                                Qualif.: {qualifPct}
                              </span>
                            )}
                          </td>

                          {/* CPL */}
                          <td
                            className="px-4 py-3 whitespace-nowrap"
                            style={{ color: ad.leads > 0 ? '#94A3B8' : '#475569' }}
                          >
                            {ad.leads > 0 ? brl(ad.gasto / ad.leads) : '—'}
                          </td>

                          {/* Visitas */}
                          <td className="px-4 py-3" style={{ color: '#94A3B8' }}>
                            {ad.visitas}
                          </td>

                          {/* Vendas */}
                          <td
                            className="px-4 py-3 font-medium"
                            style={{ color: ad.vendas > 0 ? '#10B981' : '#94A3B8' }}
                          >
                            {ad.vendas}
                          </td>

                          {/* Custo/venda */}
                          <td
                            className="px-4 py-3 whitespace-nowrap"
                            style={{ color: ad.vendas > 0 ? '#F59E0B' : '#475569' }}
                          >
                            {ad.vendas > 0 ? brl(ad.gasto / ad.vendas) : '—'}
                          </td>

                          {/* Valor vendido */}
                          <td
                            className="px-4 py-3 whitespace-nowrap font-medium"
                            style={{
                              color: ad.valorVendido > 0 ? '#10B981' : '#64748B',
                            }}
                          >
                            {ad.valorVendido > 0 ? brl(ad.valorVendido) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function DesempenhoAnuncios() {
  return (
    <ErrorBoundary>
      <DesempenhoAnunciosInner />
    </ErrorBoundary>
  )
}
