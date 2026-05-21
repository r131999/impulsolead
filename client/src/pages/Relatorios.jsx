import { useEffect, useState } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { getRelatorios, getRelatoriosEquipes, getRelatoriosOrigem } from '../api/relatorios'

const CORES_FUNIL = {
  lead:        '#3b82f6',
  atendimento: '#6366f1',
  agendamento: '#8b5cf6',
  visita:      '#f59e0b',
  proposta:    '#f97316',
  venda:       '#10B981',
  perdido:     '#ef4444',
}

const CORES_PIE = ['#6366f1', '#f59e0b', '#ef4444', '#10B981', '#8b5cf6', '#f97316']
const CORES_EQUIPES = ['#6366f1', '#10B981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#f97316']

const TOOLTIP_STYLE = {
  backgroundColor: '#111827',
  border: '1px solid #1E293B',
  borderRadius: '8px',
  color: '#F1F5F9',
}

const LABEL_STYLE = { color: '#94A3B8' }

export default function Relatorios() {
  const [aba, setAba] = useState('geral')
  const [dados, setDados] = useState(null)
  const [dadosEquipes, setDadosEquipes] = useState(null)
  const [periodo, setPeriodo] = useState(30)
  const [loading, setLoading] = useState(true)
  const [loadingEquipes, setLoadingEquipes] = useState(false)
  const [dadosOrigem, setDadosOrigem] = useState(null)
  const [loadingOrigem, setLoadingOrigem] = useState(false)

  useEffect(() => {
    setLoading(true)
    getRelatorios(periodo)
      .then((res) => setDados(res.data))
      .finally(() => setLoading(false))
  }, [periodo])

  useEffect(() => {
    if (aba === 'equipes') {
      setLoadingEquipes(true)
      getRelatoriosEquipes(periodo)
        .then((res) => setDadosEquipes(res.data))
        .finally(() => setLoadingEquipes(false))
    }
  }, [aba, periodo])

  useEffect(() => {
    if (aba === 'origem') {
      setLoadingOrigem(true)
      getRelatoriosOrigem(periodo)
        .then((res) => setDadosOrigem(res.data))
        .finally(() => setLoadingOrigem(false))
    }
  }, [aba, periodo])

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold" style={{ color: '#F1F5F9' }}>Relatórios</h1>
          {dados && aba === 'geral' && (
            <p className="text-xs md:text-sm mt-0.5" style={{ color: '#94A3B8' }}>
              Desde {new Intl.DateTimeFormat('pt-BR').format(new Date(dados.dataInicio))}
            </p>
          )}
        </div>
        <div className="flex gap-1 p-1 rounded-lg self-start sm:self-auto" style={{ backgroundColor: '#0B1120' }}>
          {[7, 30, 90].map((p) => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
              style={
                periodo === p
                  ? { backgroundColor: '#1a2332', color: '#F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }
                  : { color: '#64748B' }
              }
            >
              {p}d
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-lg w-fit" style={{ backgroundColor: '#0B1120' }}>
        {[{ id: 'geral', label: 'Geral' }, { id: 'equipes', label: 'Equipes' }, { id: 'origem', label: 'Origem' }].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            className="px-5 py-1.5 rounded-md text-sm font-medium transition-colors"
            style={
              aba === id
                ? { backgroundColor: '#1a2332', color: '#F1F5F9', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }
                : { color: '#64748B' }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {aba === 'geral' && (
        loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <ResumoCard titulo="Total de leads" valor={dados.resumo.total} sub={variacao(dados.resumo.variacaoTotal)} cor="indigo" />
              <ResumoCard titulo="Leads fechados" valor={dados.resumo.fechados} cor="green" />
              <ResumoCard titulo="Taxa de conversão" valor={`${dados.resumo.taxaConversao}%`} cor="purple" />
              <ResumoCard titulo="Tempo médio resposta" valor={formatarTempo(dados.resumo.tempoMedioResposta)} cor="blue" />
              <ResumoCard titulo="📣 Leads de Campanha" valor={dados.resumo.leadsCampanha} cor="orange" />
            </div>

            <div className="card">
              <h2 className="font-semibold mb-4" style={{ color: '#F1F5F9' }}>Leads por dia</h2>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={dados.leadsPorDia} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                  <XAxis
                    dataKey="data"
                    tickFormatter={(v) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(v))}
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    interval="preserveStartEnd"
                    axisLine={{ stroke: '#1E293B' }}
                    tickLine={{ stroke: '#1E293B' }}
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} axisLine={{ stroke: '#1E293B' }} tickLine={{ stroke: '#1E293B' }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={LABEL_STYLE} labelFormatter={(v) => new Intl.DateTimeFormat('pt-BR').format(new Date(v))} formatter={(v) => [v, 'Leads']} />
                  <Line type="monotone" dataKey="leads" stroke="#6366f1" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#818cf8' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card">
                <h2 className="font-semibold mb-4" style={{ color: '#F1F5F9' }}>Funil de conversão</h2>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={dados.funil} layout="vertical" margin={{ top: 0, right: 16, left: 60, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#1E293B" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} axisLine={{ stroke: '#1E293B' }} tickLine={{ stroke: '#1E293B' }} />
                    <YAxis type="category" dataKey="status" tick={{ fontSize: 12, fill: '#94A3B8' }} axisLine={{ stroke: '#1E293B' }} tickLine={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={LABEL_STYLE} formatter={(v) => [v, 'Leads']} />
                    <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                      {dados.funil.map((entry) => (
                        <Cell key={entry.status} fill={CORES_FUNIL[entry.status] || '#94a3b8'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="card">
                <h2 className="font-semibold mb-4" style={{ color: '#F1F5F9' }}>Motivos de perda</h2>
                {dados.motivosPerda.length === 0 ? (
                  <div className="flex items-center justify-center h-48 text-sm" style={{ color: '#64748B' }}>
                    Nenhum lead perdido no período
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={dados.motivosPerda}
                        dataKey="total"
                        nameKey="motivo"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ motivo, percent }) =>
                          `${motivo.slice(0, 16)}${motivo.length > 16 ? '…' : ''} (${(percent * 100).toFixed(0)}%)`
                        }
                        labelLine={false}
                      >
                        {dados.motivosPerda.map((_, i) => (
                          <Cell key={i} fill={CORES_PIE[i % CORES_PIE.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={LABEL_STYLE} formatter={(v, n) => [v, n]} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card">
                <h2 className="font-semibold mb-4" style={{ color: '#F1F5F9' }}>Desempenho por corretor</h2>
                {dados.porCorretor.length === 0 ? (
                  <p className="text-sm text-center py-8" style={{ color: '#64748B' }}>Sem dados no período</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ borderBottom: '1px solid #1E293B' }}>
                          <th className="text-left py-2 font-medium text-xs" style={{ color: '#64748B' }}>Corretor</th>
                          <th className="text-right py-2 font-medium text-xs" style={{ color: '#64748B' }}>Leads</th>
                          <th className="text-right py-2 font-medium text-xs" style={{ color: '#64748B' }}>Fechados</th>
                          <th className="text-right py-2 font-medium text-xs" style={{ color: '#64748B' }}>Conv.</th>
                          <th className="text-right py-2 font-medium text-xs" style={{ color: '#64748B' }}>📣 Camp.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dados.porCorretor.map((c, idx) => (
                          <tr key={c.id} style={{ borderBottom: '1px solid #1E293B', backgroundColor: idx % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                            <td className="py-2 font-medium" style={{ color: '#F1F5F9' }}>{c.nome}</td>
                            <td className="py-2 text-right" style={{ color: '#94A3B8' }}>{c.totalLeads}</td>
                            <td className="py-2 text-right font-medium" style={{ color: '#10B981' }}>{c.fechados}</td>
                            <td className="py-2 text-right">
                              <span className="badge" style={c.taxaConversao >= 50 ? { color: '#10B981', backgroundColor: 'rgba(16,185,129,0.15)' } : c.taxaConversao >= 20 ? { color: '#F59E0B', backgroundColor: 'rgba(245,158,11,0.15)' } : { color: '#EF4444', backgroundColor: 'rgba(239,68,68,0.15)' }}>
                                {c.taxaConversao}%
                              </span>
                            </td>
                            <td className="py-2 text-right">
                              {c.leadsCampanha > 0 ? (
                                <span className="text-xs font-medium" style={{ color: '#F59E0B' }}>
                                  📣 {c.leadsCampanha} ({c.percentualCampanha}%)
                                </span>
                              ) : (
                                <span style={{ color: '#475569' }}>—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="card">
                <h2 className="font-semibold mb-4" style={{ color: '#F1F5F9' }}>Top regiões</h2>
                {dados.topRegioes.length === 0 ? (
                  <p className="text-sm text-center py-8" style={{ color: '#64748B' }}>Sem dados no período</p>
                ) : (
                  <div className="space-y-3">
                    {dados.topRegioes.map((r) => {
                      const max = dados.topRegioes[0].total
                      const pct = Math.round((r.total / max) * 100)
                      return (
                        <div key={r.regiao}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium" style={{ color: '#F1F5F9' }}>{r.regiao}</span>
                            <span className="text-sm" style={{ color: '#94A3B8' }}>{r.total} leads</span>
                          </div>
                          <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#1E293B' }}>
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: '#6366f1' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      )}

      {aba === 'equipes' && (
        loadingEquipes ? (
          <div className="flex items-center justify-center py-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
          </div>
        ) : !dadosEquipes || dadosEquipes.equipes.length === 0 ? (
          <div className="rounded-xl p-12 text-center" style={{ backgroundColor: '#111827', border: '1px solid #1E293B' }}>
            <p className="text-lg font-semibold mb-1" style={{ color: '#F1F5F9' }}>Nenhuma equipe cadastrada</p>
            <p className="text-sm" style={{ color: '#64748B' }}>
              Crie equipes na página de Equipes para ver o comparativo aqui.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Destaques */}
            {(dadosEquipes.equipeMaisLeads || dadosEquipes.equipeMaiorConversao) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {dadosEquipes.equipeMaisLeads && (
                  <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                    <p className="text-xs font-medium mb-1" style={{ color: '#818cf8' }}>Mais leads no período</p>
                    <p className="text-lg font-bold" style={{ color: '#F1F5F9' }}>{dadosEquipes.equipeMaisLeads}</p>
                  </div>
                )}
                {dadosEquipes.equipeMaiorConversao && (
                  <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <p className="text-xs font-medium mb-1" style={{ color: '#10B981' }}>Maior conversão no período</p>
                    <p className="text-lg font-bold" style={{ color: '#F1F5F9' }}>{dadosEquipes.equipeMaiorConversao}</p>
                  </div>
                )}
              </div>
            )}

            {/* Gráficos comparativos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card">
                <h2 className="font-semibold mb-4" style={{ color: '#F1F5F9' }}>Leads por equipe</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={dadosEquipes.equipes} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                    <XAxis dataKey="nome" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={{ stroke: '#1E293B' }} tickLine={{ stroke: '#1E293B' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} axisLine={{ stroke: '#1E293B' }} tickLine={{ stroke: '#1E293B' }} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={LABEL_STYLE} formatter={(v) => [v, 'Leads']} />
                    <Bar dataKey="totalLeads" radius={[4, 4, 0, 0]}>
                      {dadosEquipes.equipes.map((_, i) => (
                        <Cell key={i} fill={CORES_EQUIPES[i % CORES_EQUIPES.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="card">
                <h2 className="font-semibold mb-4" style={{ color: '#F1F5F9' }}>Fechamentos por equipe</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={dadosEquipes.equipes} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                    <XAxis dataKey="nome" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={{ stroke: '#1E293B' }} tickLine={{ stroke: '#1E293B' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} axisLine={{ stroke: '#1E293B' }} tickLine={{ stroke: '#1E293B' }} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={LABEL_STYLE} formatter={(v) => [v, 'Fechamentos']} />
                    <Bar dataKey="fechamentos" radius={[4, 4, 0, 0]}>
                      {dadosEquipes.equipes.map((_, i) => (
                        <Cell key={i} fill={CORES_EQUIPES[i % CORES_EQUIPES.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Tabela comparativa */}
            <div className="card p-0 overflow-hidden">
              <div className="px-5 py-3 font-semibold text-sm" style={{ borderBottom: '1px solid #1E293B', color: '#F1F5F9' }}>
                Comparativo de equipes — últimos {periodo} dias
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[480px]">
                  <thead style={{ backgroundColor: '#0B1120', borderBottom: '1px solid #1E293B' }}>
                    <tr>
                      {['Equipe', 'Líder', 'Leads', 'Fechamentos', 'Conversão', 'Campanha'].map((h) => (
                        <th key={h} className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wide" style={{ color: '#64748B' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dadosEquipes.equipes.map((eq, idx) => (
                      <tr key={eq.id} style={{ borderBottom: '1px solid #1E293B', backgroundColor: idx % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                        <td className="px-4 py-3 font-medium" style={{ color: '#F1F5F9' }}>{eq.nome}</td>
                        <td className="px-4 py-3" style={{ color: '#94A3B8' }}>{eq.lider?.nome || '—'}</td>
                        <td className="px-4 py-3" style={{ color: '#94A3B8' }}>{eq.totalLeads}</td>
                        <td className="px-4 py-3 font-medium" style={{ color: '#10B981' }}>{eq.fechamentos}</td>
                        <td className="px-4 py-3">
                          <span className="badge" style={eq.taxaConversao >= 25 ? { color: '#10B981', backgroundColor: 'rgba(16,185,129,0.15)' } : eq.taxaConversao >= 10 ? { color: '#F59E0B', backgroundColor: 'rgba(245,158,11,0.15)' } : { color: '#EF4444', backgroundColor: 'rgba(239,68,68,0.15)' }}>
                            {eq.taxaConversao}%
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {eq.leadsCampanha > 0 ? (
                            <span className="text-xs font-medium" style={{ color: '#F59E0B' }}>
                              📣 {eq.leadsCampanha}
                            </span>
                          ) : (
                            <span style={{ color: '#475569' }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Ranking de corretores por equipe */}
            <div className="space-y-4">
              <h2 className="font-semibold" style={{ color: '#F1F5F9' }}>Ranking de corretores por equipe</h2>
              {dadosEquipes.equipes.map((eq, eqIdx) => (
                eq.rankingCorretores.length > 0 && (
                  <div key={eq.id} className="card p-0 overflow-hidden">
                    <div
                      className="px-5 py-3 flex items-center gap-2"
                      style={{ borderBottom: '1px solid #1E293B', backgroundColor: `${CORES_EQUIPES[eqIdx % CORES_EQUIPES.length]}18` }}
                    >
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CORES_EQUIPES[eqIdx % CORES_EQUIPES.length] }} />
                      <span className="font-semibold text-sm" style={{ color: '#F1F5F9' }}>{eq.nome}</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm min-w-[360px]">
                        <thead style={{ backgroundColor: '#0B1120', borderBottom: '1px solid #1E293B' }}>
                          <tr>
                            {['#', 'Corretor', 'Leads', 'Fechamentos'].map((h) => (
                              <th key={h} className="text-left px-4 py-2.5 font-medium text-xs uppercase tracking-wide" style={{ color: '#64748B' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {eq.rankingCorretores.map((c, idx) => (
                            <tr key={c.id} style={{ borderBottom: '1px solid #1E293B', backgroundColor: idx % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                              <td className="px-4 py-2.5">
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold" style={idx === 0 ? { backgroundColor: CORES_EQUIPES[eqIdx % CORES_EQUIPES.length], color: '#fff' } : { backgroundColor: '#1E293B', color: '#94A3B8' }}>
                                  {idx + 1}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 font-medium" style={{ color: '#F1F5F9' }}>{c.nome}</td>
                              <td className="px-4 py-2.5" style={{ color: '#94A3B8' }}>{c.leads}</td>
                              <td className="px-4 py-2.5 font-medium" style={{ color: '#10B981' }}>{c.fechamentos}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>
        )
      )}
      {aba === 'origem' && (
        loadingOrigem ? (
          <div className="flex items-center justify-center py-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
          </div>
        ) : !dadosOrigem || dadosOrigem.origens.length === 0 ? (
          <div className="rounded-xl p-12 text-center" style={{ backgroundColor: '#111827', border: '1px solid #1E293B' }}>
            <p className="text-lg font-semibold mb-2" style={{ color: '#F1F5F9' }}>Sem leads no período</p>
            <p className="text-sm" style={{ color: '#64748B' }}>
              Registre a origem dos leads para ver os dados aqui.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Card destaque: melhor origem */}
            {dadosOrigem.melhorOrigem && (() => {
              const best = dadosOrigem.origens.find((o) => o.origem === dadosOrigem.melhorOrigem)
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <p className="text-xs font-medium mb-1" style={{ color: '#10B981' }}>Melhor taxa de conversão</p>
                    <p className="text-lg font-bold" style={{ color: '#F1F5F9' }}>{best.origem}</p>
                    <p className="text-sm mt-0.5" style={{ color: '#94A3B8' }}>
                      {best.conversao}% de conversão · {best.total} lead{best.total !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                    <p className="text-xs font-medium mb-1" style={{ color: '#818cf8' }}>Origem com mais leads</p>
                    <p className="text-lg font-bold" style={{ color: '#F1F5F9' }}>{dadosOrigem.origens[0].origem}</p>
                    <p className="text-sm mt-0.5" style={{ color: '#94A3B8' }}>
                      {dadosOrigem.origens[0].total} lead{dadosOrigem.origens[0].total !== 1 ? 's' : ''} · {dadosOrigem.origens[0].conversao}% conv.
                    </p>
                  </div>
                </div>
              )
            })()}

            {/* Aviso se nenhuma origem nomeada */}
            {dadosOrigem.origens.every((o) => o.origem === 'Não informado') && (
              <div className="rounded-lg px-4 py-3 flex items-start gap-2" style={{ backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <span style={{ color: '#F59E0B' }}>⚠</span>
                <p className="text-sm" style={{ color: '#94A3B8' }}>
                  Registre a origem dos leads para ver os dados aqui.
                </p>
              </div>
            )}

            {/* Tabela com barra de progresso */}
            <div className="card p-0 overflow-hidden">
              <div className="px-5 py-3 font-semibold text-sm" style={{ borderBottom: '1px solid #1E293B', color: '#F1F5F9' }}>
                Conversão por origem — últimos {periodo} dias
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[480px]">
                  <thead style={{ backgroundColor: '#0B1120', borderBottom: '1px solid #1E293B' }}>
                    <tr>
                      {['Origem', 'Total de Leads', 'Fechamentos', 'Taxa de Conversão'].map((h) => (
                        <th key={h} className="text-left px-5 py-3 font-medium text-xs uppercase tracking-wide" style={{ color: '#64748B' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dadosOrigem.origens.map((o, idx) => {
                      const corConv = o.conversao >= 25 ? '#10B981' : o.conversao >= 10 ? '#F59E0B' : '#EF4444'
                      return (
                        <tr key={o.origem} style={{ borderBottom: '1px solid #1E293B', backgroundColor: idx % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                          <td className="px-5 py-3 font-medium" style={{ color: o.origem === 'Não informado' ? '#64748B' : '#F1F5F9' }}>
                            {o.origem}
                          </td>
                          <td className="px-5 py-3" style={{ color: '#94A3B8' }}>{o.total}</td>
                          <td className="px-5 py-3 font-medium" style={{ color: '#10B981' }}>{o.fechados}</td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-semibold w-9 text-right flex-shrink-0" style={{ color: corConv }}>
                                {o.conversao}%
                              </span>
                              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#1E293B', minWidth: 80 }}>
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${o.conversao}%`, backgroundColor: corConv, transition: 'width 0.4s ease' }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  )
}

function ResumoCard({ titulo, valor, sub, cor }) {
  const cores = {
    indigo:  { bg: 'rgba(99,102,241,0.12)',  text: '#818cf8' },
    green:   { bg: 'rgba(16,185,129,0.12)',  text: '#10B981' },
    purple:  { bg: 'rgba(139,92,246,0.12)',  text: '#8B5CF6' },
    blue:    { bg: 'rgba(59,130,246,0.12)',  text: '#60A5FA' },
    orange:  { bg: 'rgba(249,115,22,0.12)',  text: '#fb923c' },
  }
  const { bg, text } = cores[cor] || cores.blue
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: bg }}>
      <p className="text-xs font-medium mb-1" style={{ color: text, opacity: 0.85 }}>{titulo}</p>
      <p className="text-2xl font-bold" style={{ color: text }}>{valor}</p>
      {sub && <p className="text-xs mt-1" style={{ color: text, opacity: 0.75 }}>{sub}</p>}
    </div>
  )
}

function variacao(v) {
  if (v === undefined || v === null) return null
  const sinal = v > 0 ? '+' : ''
  return `${sinal}${v}% vs período anterior`
}

function formatarTempo(min) {
  if (!min) return '—'
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}
