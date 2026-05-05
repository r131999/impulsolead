import { useEffect, useState } from 'react'
import { getDashboard } from '../api/dashboard'
import { useNavigate } from 'react-router-dom'

const STATUS_BADGE = {
  novo: 'text-[#60A5FA]',
  qualificado: 'text-[#8B5CF6]',
  atendimento: 'text-[#F59E0B]',
  visita: 'text-orange-400',
  proposta: 'text-indigo-400',
  fechado: 'text-[#10B981]',
  perdido: 'text-[#EF4444]',
}

const STATUS_BADGE_BG = {
  novo: 'rgba(59,130,246,0.15)',
  qualificado: 'rgba(139,92,246,0.15)',
  atendimento: 'rgba(245,158,11,0.15)',
  visita: 'rgba(249,115,22,0.15)',
  proposta: 'rgba(99,102,241,0.15)',
  fechado: 'rgba(16,185,129,0.15)',
  perdido: 'rgba(239,68,68,0.15)',
}

export default function Dashboard() {
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    getDashboard()
      .then((res) => setDados(res.data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <PageLoading />

  const {
    leadsHoje,
    leadsHojeVariacao,
    emAtendimento,
    visitasAgendadas,
    fechadosMes,
    taxaConversao,
    taxaConversaoVariacao,
    tempoMedioResposta,
    corretoresAtivos,
    leadsNaFila,
    ultimosLeads,
  } = dados

  const metricas = [
    { titulo: 'Leads hoje', valor: leadsHoje, variacao: leadsHojeVariacao, cor: 'indigo' },
    { titulo: 'Em atendimento', valor: emAtendimento, cor: 'yellow' },
    { titulo: 'Visitas agendadas', valor: visitasAgendadas, cor: 'orange' },
    { titulo: 'Fechados este mês', valor: fechadosMes, cor: 'green' },
    { titulo: 'Taxa de conversão', valor: `${taxaConversao}%`, variacao: taxaConversaoVariacao, cor: 'purple' },
    { titulo: 'Tempo médio resposta', valor: formatarTempo(tempoMedioResposta), cor: 'blue' },
    { titulo: 'Corretores disponíveis', valor: corretoresAtivos, cor: 'teal' },
    { titulo: 'Leads na fila', valor: leadsNaFila, cor: leadsNaFila > 0 ? 'red' : 'gray' },
  ]

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold" style={{ color: '#F1F5F9' }}>Dashboard</h1>
          <p className="text-xs md:text-sm mt-0.5" style={{ color: '#94A3B8' }}>{formatarData(new Date())}</p>
        </div>
        <button onClick={() => navigate('/kanban')} className="btn-primary self-start sm:self-auto">
          Abrir Kanban
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        {metricas.map((m) => (
          <MetricCard key={m.titulo} {...m} />
        ))}
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold" style={{ color: '#F1F5F9' }}>Últimos leads</h2>
          <button
            onClick={() => navigate('/leads')}
            className="text-sm font-medium hover:opacity-80 transition-opacity"
            style={{ color: '#60A5FA' }}
          >
            Ver todos →
          </button>
        </div>

        {ultimosLeads.length === 0 ? (
          <p className="text-sm py-8 text-center" style={{ color: '#64748B' }}>Nenhum lead ainda.</p>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm min-w-[540px]">
              <thead>
                <tr style={{ borderBottom: '1px solid #1E293B' }}>
                  <th className="text-left py-2 px-5 font-medium" style={{ color: '#64748B' }}>Nome</th>
                  <th className="text-left py-2 font-medium" style={{ color: '#64748B' }}>Status</th>
                  <th className="text-left py-2 font-medium hidden sm:table-cell" style={{ color: '#64748B' }}>Corretor</th>
                  <th className="text-left py-2 font-medium hidden md:table-cell" style={{ color: '#64748B' }}>Urgência</th>
                  <th className="text-left py-2 font-medium hidden md:table-cell" style={{ color: '#64748B' }}>Região</th>
                  <th className="text-left py-2 font-medium" style={{ color: '#64748B' }}>Criado em</th>
                </tr>
              </thead>
              <tbody>
                {ultimosLeads.map((lead, idx) => (
                  <tr
                    key={lead.id}
                    className="transition-colors"
                    style={{
                      borderBottom: '1px solid #1E293B',
                      backgroundColor: idx % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a2332'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = idx % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent'}
                  >
                    <td className="py-2.5 px-5 font-medium" style={{ color: '#F1F5F9' }}>{lead.nome}</td>
                    <td className="py-2.5">
                      <span
                        className={`badge ${STATUS_BADGE[lead.status] || 'text-[#64748B]'}`}
                        style={{ backgroundColor: STATUS_BADGE_BG[lead.status] || 'rgba(100,116,139,0.15)' }}
                      >
                        {lead.status}
                      </span>
                    </td>
                    <td className="py-2.5 hidden sm:table-cell" style={{ color: '#94A3B8' }}>{lead.corretor?.nome || '—'}</td>
                    <td className="py-2.5 hidden md:table-cell" style={{ color: '#94A3B8' }}>{lead.urgencia || '—'}</td>
                    <td className="py-2.5 hidden md:table-cell" style={{ color: '#94A3B8' }}>{lead.regiao || '—'}</td>
                    <td className="py-2.5" style={{ color: '#64748B' }}>{formatarDataCurta(lead.criadoEm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function MetricCard({ titulo, valor, variacao, cor }) {
  const cores = {
    indigo: { bg: 'rgba(99,102,241,0.12)', text: '#818cf8' },
    yellow: { bg: 'rgba(245,158,11,0.12)', text: '#F59E0B' },
    orange: { bg: 'rgba(249,115,22,0.12)', text: '#fb923c' },
    green: { bg: 'rgba(16,185,129,0.12)', text: '#10B981' },
    purple: { bg: 'rgba(139,92,246,0.12)', text: '#8B5CF6' },
    blue: { bg: 'rgba(59,130,246,0.12)', text: '#60A5FA' },
    teal: { bg: 'rgba(20,184,166,0.12)', text: '#2dd4bf' },
    red: { bg: 'rgba(239,68,68,0.12)', text: '#EF4444' },
    gray: { bg: 'rgba(100,116,139,0.08)', text: '#64748B' },
  }

  const { bg, text } = cores[cor] || cores.gray

  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: bg }}>
      <p className="text-xs font-medium mb-1" style={{ color: text, opacity: 0.85 }}>{titulo}</p>
      <p className="text-2xl font-bold" style={{ color: text }}>{valor}</p>
      {variacao !== undefined && (
        <p className="text-xs mt-1" style={{ color: text, opacity: 0.75 }}>
          {variacao > 0 ? '+' : ''}{variacao}% vs período anterior
        </p>
      )}
    </div>
  )
}

function PageLoading() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
    </div>
  )
}

function formatarTempo(minutos) {
  if (minutos < 60) return `${minutos}min`
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

function formatarData(d) {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d)
}

function formatarDataCurta(iso) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    .format(new Date(iso))
}
