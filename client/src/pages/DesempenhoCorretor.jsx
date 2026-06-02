import { useEffect, useState } from 'react'
import { getDashboardCorretor } from '../api/dashboard'
import { useAuth } from '../context/AuthContext'

export default function DesempenhoCorretor() {
  const { usuario } = useAuth()
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(true)

  const carregarDados = () => {
    getDashboardCorretor()
      .then((res) => setDados(res.data))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    carregarDados()
    const intervalo = setInterval(carregarDados, 30000)
    return () => clearInterval(intervalo)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    )
  }

  const cards = [
    { label: 'Leads recebidos', value: dados?.leadsAtribuidos ?? 0, sub: `${dados?.leadsHoje ?? 0} hoje`, cor: '#3B82F6' },
    { label: 'Em atendimento', value: dados?.emAtendimento ?? 0, cor: '#F59E0B' },
    { label: 'Agendamentos', value: dados?.agendamentos ?? 0, cor: '#8B5CF6' },
    { label: 'Visitas', value: dados?.visitas ?? 0, cor: '#f97316' },
    { label: 'Fechamentos no mês', value: dados?.fechadosMes ?? 0, cor: '#10B981' },
    { label: 'Taxa de conversão', value: `${dados?.taxaConversaoPessoal ?? 0}%`, cor: '#6366f1' },
    { label: 'Posição na fila', value: `#${dados?.posicaoNaFila ?? '—'}`, cor: '#818cf8' },
  ]

  const STATUS_LABEL = {
    lead: 'Lead', atendimento: 'Atendimento', agendamento: 'Agendamento',
    visita: 'Visita', proposta: 'Proposta', venda: 'Venda', perdido: 'Perdido',
  }
  const STATUS_COR = {
    lead: '#3B82F6', atendimento: '#6366f1', agendamento: '#8B5CF6',
    visita: '#F59E0B', proposta: '#f97316', venda: '#10B981', perdido: '#EF4444',
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold" style={{ color: '#F1F5F9' }}>
          Meu Desempenho
        </h1>
        <p className="text-sm mt-0.5" style={{ color: '#94A3B8' }}>
          Olá, {usuario?.nome} — aqui estão suas métricas pessoais
        </p>
        {dados?.equipe && (
          <span
            className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium"
            style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: '#818cf8' }}
          >
            {dados.equipe.nome}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {cards.map(({ label, value, sub, cor }) => (
          <div
            key={label}
            className="rounded-xl p-4"
            style={{ backgroundColor: '#111827', border: '1px solid #1E293B' }}
          >
            <p className="text-xs font-medium mb-1" style={{ color: '#64748B' }}>{label}</p>
            <p className="text-2xl font-bold" style={{ color: cor }}>{value}</p>
            {sub && <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{sub}</p>}
          </div>
        ))}
      </div>

      {dados?.ultimosLeads?.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div
            className="px-5 py-3 font-semibold text-sm"
            style={{ borderBottom: '1px solid #1E293B', color: '#F1F5F9' }}
          >
            Últimos leads recebidos
          </div>
          <div className="divide-y" style={{ borderColor: '#1E293B' }}>
            {dados.ultimosLeads.map((lead) => (
              <div key={lead.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: '#F1F5F9' }}>{lead.nome}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{lead.telefone}</p>
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
