import { useEffect, useState } from 'react'
import { getDashboardGerente } from '../api/dashboard'
import { useAuth } from '../context/AuthContext'

const STATUS_LABEL = {
  lead: 'Lead', atendimento: 'Atendimento', agendamento: 'Agendamento',
  visita: 'Visita', proposta: 'Proposta', venda: 'Venda', perdido: 'Perdido',
}
const STATUS_COR = {
  lead: '#3B82F6', atendimento: '#6366f1', agendamento: '#8B5CF6',
  visita: '#F59E0B', proposta: '#f97316', venda: '#10B981', perdido: '#EF4444',
}

export default function DashboardGerente() {
  const { usuario } = useAuth()
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    getDashboardGerente()
      .then((res) => setDados(res.data))
      .catch(() => setErro('Erro ao carregar dashboard da equipe'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    )
  }

  if (erro) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm" style={{ color: '#EF4444' }}>{erro}</p>
      </div>
    )
  }

  const cards = [
    { label: 'Leads hoje', value: dados?.leadsHoje ?? 0, cor: '#3B82F6' },
    { label: 'Em atendimento', value: dados?.emAtendimento ?? 0, cor: '#F59E0B' },
    { label: 'Visitas agendadas', value: dados?.visitasAgendadas ?? 0, cor: '#f97316' },
    { label: 'Fechamentos no mês', value: dados?.fechadosMes ?? 0, cor: '#10B981' },
    { label: 'Taxa de conversão', value: `${dados?.taxaConversaoEquipe ?? 0}%`, cor: '#8B5CF6' },
    { label: 'Corretores na equipe', value: dados?.totalCorretores ?? 0, cor: '#6366f1' },
  ]

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold" style={{ color: '#F1F5F9' }}>
          {dados?.nomeEquipe || 'Dashboard da Equipe'}
        </h1>
        <p className="text-sm mt-0.5" style={{ color: '#94A3B8' }}>
          Olá, {usuario?.nome} — métricas da sua equipe
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {cards.map(({ label, value, cor }) => (
          <div
            key={label}
            className="rounded-xl p-4"
            style={{ backgroundColor: '#111827', border: '1px solid #1E293B' }}
          >
            <p className="text-xs font-medium mb-1" style={{ color: '#64748B' }}>{label}</p>
            <p className="text-2xl font-bold" style={{ color: cor }}>{value}</p>
          </div>
        ))}
      </div>

      {dados?.rankingCorretores?.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div
            className="px-5 py-3 font-semibold text-sm"
            style={{ borderBottom: '1px solid #1E293B', color: '#F1F5F9' }}
          >
            Ranking da equipe — mês atual
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ backgroundColor: '#0B1120', borderBottom: '1px solid #1E293B' }}>
                <tr>
                  {['#', 'Corretor', 'Leads', 'Fechamentos'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wide" style={{ color: '#64748B' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dados.rankingCorretores.map((c, idx) => (
                  <tr
                    key={c.nome}
                    style={{
                      borderBottom: '1px solid #1E293B',
                      backgroundColor: idx % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent',
                    }}
                  >
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold"
                        style={idx === 0 ? { backgroundColor: '#4f46e5', color: '#fff' } : { backgroundColor: '#1E293B', color: '#94A3B8' }}
                      >
                        {idx + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium" style={{ color: '#F1F5F9' }}>{c.nome}</td>
                    <td className="px-4 py-3" style={{ color: '#94A3B8' }}>{c.leads}</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold" style={{ color: '#10B981' }}>{c.fechamentos}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {dados?.ultimosLeads?.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div
            className="px-5 py-3 font-semibold text-sm"
            style={{ borderBottom: '1px solid #1E293B', color: '#F1F5F9' }}
          >
            Últimos leads da equipe
          </div>
          <div className="divide-y" style={{ borderColor: '#1E293B' }}>
            {dados.ultimosLeads.map((lead) => (
              <div key={lead.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: '#F1F5F9' }}>{lead.nome}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
                    {lead.telefone}{lead.corretor ? ` · ${lead.corretor.nome}` : ''}
                  </p>
                </div>
                <span
                  className="badge flex-shrink-0 text-xs"
                  style={{
                    color: STATUS_COR[lead.status] || '#94A3B8',
                    backgroundColor: `${STATUS_COR[lead.status]}20` || 'rgba(148,163,184,0.1)',
                  }}
                >
                  {STATUS_LABEL[lead.status] || lead.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
