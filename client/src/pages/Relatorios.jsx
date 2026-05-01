import { useEffect, useState } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { getRelatorios } from '../api/relatorios'

const CORES_FUNIL = {
  novo: '#3b82f6',
  qualificado: '#8b5cf6',
  atendimento: '#f59e0b',
  visita: '#f97316',
  proposta: '#6366f1',
  fechado: '#22c55e',
  perdido: '#ef4444',
}

const CORES_PIE = ['#6366f1', '#f59e0b', '#ef4444', '#22c55e', '#8b5cf6', '#f97316']

export default function Relatorios() {
  const [dados, setDados] = useState(null)
  const [periodo, setPeriodo] = useState(30)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getRelatorios(periodo)
      .then((res) => setDados(res.data))
      .finally(() => setLoading(false))
  }, [periodo])

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Relatórios</h1>
          {dados && (
            <p className="text-gray-500 text-xs md:text-sm mt-0.5">
              Desde {new Intl.DateTimeFormat('pt-BR').format(new Date(dados.dataInicio))}
            </p>
          )}
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg self-start sm:self-auto">
          {[7, 30, 90].map((p) => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                periodo === p ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {p}d
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Cards de resumo */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <ResumoCard
              titulo="Total de leads"
              valor={dados.resumo.total}
              sub={variacao(dados.resumo.variacaoTotal)}
              cor="indigo"
            />
            <ResumoCard
              titulo="Leads fechados"
              valor={dados.resumo.fechados}
              cor="green"
            />
            <ResumoCard
              titulo="Taxa de conversão"
              valor={`${dados.resumo.taxaConversao}%`}
              cor="purple"
            />
            <ResumoCard
              titulo="Tempo médio resposta"
              valor={formatarTempo(dados.resumo.tempoMedioResposta)}
              cor="blue"
            />
          </div>

          {/* Gráfico de linha: leads por dia */}
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-4">Leads por dia</h2>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={dados.leadsPorDia} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="data"
                  tickFormatter={(v) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(v))}
                  tick={{ fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  labelFormatter={(v) => new Intl.DateTimeFormat('pt-BR').format(new Date(v))}
                  formatter={(v) => [v, 'Leads']}
                />
                <Line
                  type="monotone"
                  dataKey="leads"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Funil de conversão */}
            <div className="card">
              <h2 className="font-semibold text-gray-900 mb-4">Funil de conversão</h2>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={dados.funil}
                  layout="vertical"
                  margin={{ top: 0, right: 16, left: 60, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="status" tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => [v, 'Leads']} />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                    {dados.funil.map((entry) => (
                      <Cell key={entry.status} fill={CORES_FUNIL[entry.status] || '#94a3b8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Motivos de perda */}
            <div className="card">
              <h2 className="font-semibold text-gray-900 mb-4">Motivos de perda</h2>
              {dados.motivosPerda.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
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
                    <Tooltip formatter={(v, n) => [v, n]} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Por corretor */}
            <div className="card">
              <h2 className="font-semibold text-gray-900 mb-4">Desempenho por corretor</h2>
              {dados.porCorretor.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">Sem dados no período</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2 text-gray-500 font-medium text-xs">Corretor</th>
                        <th className="text-right py-2 text-gray-500 font-medium text-xs">Leads</th>
                        <th className="text-right py-2 text-gray-500 font-medium text-xs">Fechados</th>
                        <th className="text-right py-2 text-gray-500 font-medium text-xs">Conv.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dados.porCorretor.map((c) => (
                        <tr key={c.id} className="border-b border-gray-50">
                          <td className="py-2 font-medium text-gray-800">{c.nome}</td>
                          <td className="py-2 text-right text-gray-600">{c.totalLeads}</td>
                          <td className="py-2 text-right text-green-600 font-medium">{c.fechados}</td>
                          <td className="py-2 text-right">
                            <span className={`badge ${c.taxaConversao >= 50 ? 'bg-green-100 text-green-700' : c.taxaConversao >= 20 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'}`}>
                              {c.taxaConversao}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Top regiões */}
            <div className="card">
              <h2 className="font-semibold text-gray-900 mb-4">Top regiões</h2>
              {dados.topRegioes.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">Sem dados no período</p>
              ) : (
                <div className="space-y-3">
                  {dados.topRegioes.map((r, i) => {
                    const max = dados.topRegioes[0].total
                    const pct = Math.round((r.total / max) * 100)
                    return (
                      <div key={r.regiao}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-700 font-medium">{r.regiao}</span>
                          <span className="text-sm text-gray-500">{r.total} leads</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-indigo-500 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ResumoCard({ titulo, valor, sub, cor }) {
  const cores = {
    indigo: 'text-indigo-600 bg-indigo-50',
    green: 'text-green-600 bg-green-50',
    purple: 'text-purple-600 bg-purple-50',
    blue: 'text-blue-600 bg-blue-50',
  }
  return (
    <div className={`rounded-xl p-4 ${cores[cor]}`}>
      <p className="text-xs font-medium opacity-75 mb-1">{titulo}</p>
      <p className="text-2xl font-bold">{valor}</p>
      {sub && <p className="text-xs mt-1 opacity-75">{sub}</p>}
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
