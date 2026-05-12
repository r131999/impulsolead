import { useEffect, useState } from 'react'
import { getRelatoriosGerente } from '../api/relatorios'

const PERIODOS = [7, 30, 90]

const STATUS_LABEL = {
  lead: 'Lead', atendimento: 'Atendimento', agendamento: 'Agendamento',
  visita: 'Visita', proposta: 'Proposta', venda: 'Venda', perdido: 'Perdido',
}
const STATUS_COR = {
  lead: '#3B82F6', atendimento: '#6366f1', agendamento: '#8B5CF6',
  visita: '#F59E0B', proposta: '#f97316', venda: '#10B981', perdido: '#EF4444',
}

export default function RelatoriosGerente() {
  const [dados, setDados] = useState(null)
  const [periodo, setPeriodo] = useState(30)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getRelatoriosGerente(periodo)
      .then((res) => setDados(res.data))
      .finally(() => setLoading(false))
  }, [periodo])

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold" style={{ color: '#F1F5F9' }}>
            {dados?.nomeEquipe ? `Relatório — ${dados.nomeEquipe}` : 'Relatório da Equipe'}
          </h1>
          <p className="text-xs md:text-sm mt-0.5" style={{ color: '#94A3B8' }}>Métricas filtradas pela sua equipe</p>
        </div>
        <div className="flex gap-1 p-1 rounded-lg w-fit" style={{ backgroundColor: '#0B1120' }}>
          {PERIODOS.map((p) => (
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

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
        </div>
      ) : !dados ? null : (
        <>
          {/* Resumo */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'Total de leads', value: dados.resumo.total, cor: '#3B82F6' },
              { label: 'Fechamentos', value: dados.resumo.fechados, cor: '#10B981' },
              { label: 'Taxa de conversão', value: `${dados.resumo.taxaConversao}%`, cor: '#8B5CF6' },
            ].map(({ label, value, cor }) => (
              <div key={label} className="rounded-xl p-4" style={{ backgroundColor: '#111827', border: '1px solid #1E293B' }}>
                <p className="text-xs font-medium mb-1" style={{ color: '#64748B' }}>{label}</p>
                <p className="text-2xl font-bold" style={{ color: cor }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Funil */}
          <div className="card p-0 overflow-hidden">
            <div className="px-5 py-3 font-semibold text-sm" style={{ borderBottom: '1px solid #1E293B', color: '#F1F5F9' }}>
              Funil de leads
            </div>
            <div className="p-4 space-y-2">
              {dados.funil.map(({ status, total: t }) => {
                const maxTotal = Math.max(...dados.funil.map((f) => f.total), 1)
                const pct = Math.round((t / maxTotal) * 100)
                return (
                  <div key={status} className="flex items-center gap-3">
                    <span className="text-xs w-24 flex-shrink-0" style={{ color: '#94A3B8' }}>{STATUS_LABEL[status]}</span>
                    <div className="flex-1 rounded-full h-2" style={{ backgroundColor: '#1E293B' }}>
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: STATUS_COR[status] || '#64748B' }}
                      />
                    </div>
                    <span className="text-xs w-6 text-right" style={{ color: '#64748B' }}>{t}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Ranking por corretor */}
          {dados.porCorretor?.length > 0 && (
            <div className="card p-0 overflow-hidden">
              <div className="px-5 py-3 font-semibold text-sm" style={{ borderBottom: '1px solid #1E293B', color: '#F1F5F9' }}>
                Desempenho por corretor
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead style={{ backgroundColor: '#0B1120', borderBottom: '1px solid #1E293B' }}>
                    <tr>
                      {['Corretor', 'Leads', 'Fechamentos', 'Conversão'].map((h) => (
                        <th key={h} className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wide" style={{ color: '#64748B' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dados.porCorretor.map((c, idx) => (
                      <tr
                        key={c.id}
                        style={{
                          borderBottom: '1px solid #1E293B',
                          backgroundColor: idx % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent',
                        }}
                      >
                        <td className="px-4 py-3 font-medium" style={{ color: '#F1F5F9' }}>{c.nome}</td>
                        <td className="px-4 py-3" style={{ color: '#94A3B8' }}>{c.totalLeads}</td>
                        <td className="px-4 py-3 font-semibold" style={{ color: '#10B981' }}>{c.fechados}</td>
                        <td className="px-4 py-3">
                          <span
                            className="badge"
                            style={{ color: '#8B5CF6', backgroundColor: 'rgba(139,92,246,0.15)' }}
                          >
                            {c.taxaConversao}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Top regiões */}
          {dados.topRegioes?.length > 0 && (
            <div className="card p-4">
              <p className="font-semibold text-sm mb-3" style={{ color: '#F1F5F9' }}>Top regiões</p>
              <div className="space-y-2">
                {dados.topRegioes.map(({ regiao, total: t }) => (
                  <div key={regiao} className="flex items-center justify-between">
                    <span className="text-sm" style={{ color: '#94A3B8' }}>{regiao}</span>
                    <span className="badge" style={{ color: '#60A5FA', backgroundColor: 'rgba(96,165,250,0.15)' }}>{t}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
