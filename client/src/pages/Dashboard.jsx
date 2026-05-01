import { useEffect, useState } from 'react'
import { getDashboard } from '../api/dashboard'
import { useNavigate } from 'react-router-dom'

const STATUS_BADGE = {
  novo: 'bg-blue-100 text-blue-700',
  qualificado: 'bg-purple-100 text-purple-700',
  atendimento: 'bg-yellow-100 text-yellow-700',
  visita: 'bg-orange-100 text-orange-700',
  proposta: 'bg-indigo-100 text-indigo-700',
  fechado: 'bg-green-100 text-green-700',
  perdido: 'bg-red-100 text-red-700',
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
    {
      titulo: 'Leads hoje',
      valor: leadsHoje,
      variacao: leadsHojeVariacao,
      cor: 'indigo',
    },
    {
      titulo: 'Em atendimento',
      valor: emAtendimento,
      cor: 'yellow',
    },
    {
      titulo: 'Visitas agendadas',
      valor: visitasAgendadas,
      cor: 'orange',
    },
    {
      titulo: 'Fechados este mês',
      valor: fechadosMes,
      cor: 'green',
    },
    {
      titulo: 'Taxa de conversão',
      valor: `${taxaConversao}%`,
      variacao: taxaConversaoVariacao,
      cor: 'purple',
    },
    {
      titulo: 'Tempo médio resposta',
      valor: formatarTempo(tempoMedioResposta),
      cor: 'blue',
    },
    {
      titulo: 'Corretores disponíveis',
      valor: corretoresAtivos,
      cor: 'teal',
    },
    {
      titulo: 'Leads na fila',
      valor: leadsNaFila,
      cor: leadsNaFila > 0 ? 'red' : 'gray',
    },
  ]

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-xs md:text-sm mt-0.5">{formatarData(new Date())}</p>
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
          <h2 className="font-semibold text-gray-900">Últimos leads</h2>
          <button
            onClick={() => navigate('/leads')}
            className="text-indigo-600 text-sm hover:text-indigo-700 font-medium"
          >
            Ver todos →
          </button>
        </div>

        {ultimosLeads.length === 0 ? (
          <p className="text-gray-500 text-sm py-8 text-center">Nenhum lead ainda.</p>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm min-w-[540px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-5 text-gray-500 font-medium">Nome</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Status</th>
                  <th className="text-left py-2 text-gray-500 font-medium hidden sm:table-cell">Corretor</th>
                  <th className="text-left py-2 text-gray-500 font-medium hidden md:table-cell">Urgência</th>
                  <th className="text-left py-2 text-gray-500 font-medium hidden md:table-cell">Região</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Criado em</th>
                </tr>
              </thead>
              <tbody>
                {ultimosLeads.map((lead) => (
                  <tr key={lead.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5 px-5 font-medium">{lead.nome}</td>
                    <td className="py-2.5">
                      <span className={`badge ${STATUS_BADGE[lead.status] || 'bg-gray-100 text-gray-700'}`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-gray-600 hidden sm:table-cell">{lead.corretor?.nome || '—'}</td>
                    <td className="py-2.5 text-gray-600 hidden md:table-cell">{lead.urgencia || '—'}</td>
                    <td className="py-2.5 text-gray-600 hidden md:table-cell">{lead.regiao || '—'}</td>
                    <td className="py-2.5 text-gray-500">{formatarDataCurta(lead.criadoEm)}</td>
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
    indigo: 'bg-indigo-50 text-indigo-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    orange: 'bg-orange-50 text-orange-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    blue: 'bg-blue-50 text-blue-600',
    teal: 'bg-teal-50 text-teal-600',
    red: 'bg-red-50 text-red-600',
    gray: 'bg-gray-50 text-gray-500',
  }

  return (
    <div className={`rounded-xl p-4 ${cores[cor] || cores.gray}`}>
      <p className="text-xs font-medium opacity-75 mb-1">{titulo}</p>
      <p className="text-2xl font-bold">{valor}</p>
      {variacao !== undefined && (
        <p className="text-xs mt-1 opacity-75">
          {variacao > 0 ? '+' : ''}{variacao}% vs período anterior
        </p>
      )}
    </div>
  )
}

function PageLoading() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
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
