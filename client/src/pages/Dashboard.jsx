import { useEffect, useState } from 'react'
import { getDashboard, getFunil } from '../api/dashboard'
import { pendentes as followUpsPendentes, atualizar as atualizarFollowUp } from '../api/followups'
import { useNavigate } from 'react-router-dom'
import DesempenhoAnuncios from '../components/DesempenhoAnuncios'
import { usePermissao } from '../hooks/usePermissao'

const STATUS_BADGE = {
  lead:        'text-[#60A5FA]',
  atendimento: 'text-indigo-400',
  agendamento: 'text-[#A78BFA]',
  visita:      'text-[#F59E0B]',
  proposta:    'text-orange-400',
  venda:       'text-[#10B981]',
  perdido:     'text-[#EF4444]',
}

const STATUS_BADGE_BG = {
  lead:        'rgba(59,130,246,0.15)',
  atendimento: 'rgba(99,102,241,0.15)',
  agendamento: 'rgba(139,92,246,0.15)',
  visita:      'rgba(245,158,11,0.15)',
  proposta:    'rgba(249,115,22,0.15)',
  venda:       'rgba(16,185,129,0.15)',
  perdido:     'rgba(239,68,68,0.15)',
}

export default function Dashboard() {
  const podePainelCampanhas = usePermissao('painelCampanhas')
  const [dados, setDados] = useState(null)
  const [funil, setFunil] = useState(null)
  const [followUps, setFollowUps] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(false)
  const navigate = useNavigate()

  const carregarFollowUps = () => {
    followUpsPendentes()
      .then((res) => setFollowUps(res.data.followUps))
      .catch(() => {})
  }

  useEffect(() => {
    Promise.all([getDashboard(), getFunil()])
      .then(([kpi, f]) => {
        setDados(kpi.data)
        setFunil(f.data)
      })
      .catch(() => setErro(true))
      .finally(() => setLoading(false))
    carregarFollowUps()
  }, [])

  const realizarFollowUp = async (id) => {
    await atualizarFollowUp(id, { status: 'realizado' })
    carregarFollowUps()
  }

  if (loading) return <PageLoading />
  if (erro || !dados) return (
    <div className="flex items-center justify-center h-full">
      <p className="text-sm" style={{ color: '#EF4444' }}>Erro ao carregar dashboard. Recarregue a página.</p>
    </div>
  )

  const {
    leadsHoje,
    leadsHojeVariacao,
    emAtendimento,
    agendamentos,
    visitas,
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
    { titulo: 'Agendamentos', valor: agendamentos, cor: 'purple' },
    { titulo: 'Visitas', valor: visitas, cor: 'orange' },
    { titulo: 'Fechados este mês', valor: fechadosMes, cor: 'green' },
    { titulo: 'Taxa de conversão', valor: `${taxaConversao}%`, variacao: taxaConversaoVariacao, cor: 'purple' },
    { titulo: 'Tempo médio resposta', valor: formatarTempo(tempoMedioResposta), cor: 'blue' },
    { titulo: 'Corretores disponíveis', valor: corretoresAtivos, cor: 'teal' },
    { titulo: 'Leads na fila', valor: leadsNaFila, cor: leadsNaFila > 0 ? 'red' : 'gray' },
  ]

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {podePainelCampanhas ? (
        <DesempenhoAnuncios />
      ) : (
        <div
          className="rounded-xl mb-4 p-4 flex items-center justify-between"
          style={{ backgroundColor: '#111827', border: '1px solid #1E293B' }}
        >
          <p className="text-sm" style={{ color: '#475569' }}>🔒 Painel de Campanhas disponível em um plano superior.</p>
          <a
            href="https://wa.me/5598981444954"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium px-3 py-1.5 rounded-lg flex-shrink-0 ml-4"
            style={{ backgroundColor: 'rgba(37,211,102,0.15)', color: '#25D366' }}
          >
            Falar com suporte
          </a>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold" style={{ color: '#F1F5F9' }}>Dashboard</h1>
          <p className="text-xs md:text-sm mt-0.5" style={{ color: '#94A3B8' }}>{formatarData(new Date())}</p>
        </div>
        <button onClick={() => navigate('/kanban')} className="btn-primary self-start sm:self-auto">
          Abrir Kanban
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3 md:gap-4 mb-6">
        {metricas.map((m) => (
          <MetricCard key={m.titulo} {...m} />
        ))}
      </div>

      {leadsNaFila > 0 && (
        <div
          className="flex items-center justify-between p-4 rounded-xl mb-6 cursor-pointer"
          style={{ backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}
          onClick={() => navigate('/kanban')}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">⏳</span>
            <div>
              <p className="font-semibold" style={{ color: '#F59E0B' }}>
                {leadsNaFila} lead{leadsNaFila > 1 ? 's' : ''} aguardando distribuição
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#92400e' }}>
                Clique para abrir o Kanban e distribuir
              </p>
            </div>
          </div>
          <span className="text-lg" style={{ color: '#F59E0B' }}>→</span>
        </div>
      )}

      {funil && (
        <FunilVendas
          funil={funil.funil}
          perdidos={funil.perdidos}
          emEspera={funil.funil.find((e) => e.status === 'em_espera')?.total || 0}
        />
      )}

      <FollowUpsHoje followUps={followUps} onRealizar={realizarFollowUp} />

      <div className="card mt-6">
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

const FUNIL_CONFIG = [
  { status: 'lead',        label: 'Lead',        cor: '#3B82F6' },
  { status: 'atendimento', label: 'Atendimento', cor: '#6366f1' },
  { status: 'agendamento', label: 'Agendamento', cor: '#8B5CF6' },
  { status: 'visita',      label: 'Visita',      cor: '#F59E0B' },
  { status: 'proposta',    label: 'Proposta',    cor: '#F97316' },
  { status: 'venda',       label: 'Venda',       cor: '#10B981' },
]

function FunilVendas({ funil, perdidos, emEspera }) {
  const funnelData = FUNIL_CONFIG.map(({ status, label, cor }, i) => {
    const value = FUNIL_CONFIG.slice(i).reduce((sum, etapa) => {
      const found = funil.find((e) => e.status === etapa.status)
      return sum + (found?.total || 0)
    }, 0)
    return { label, value, cor }
  })

  const VIEWBOX_W = 400
  const STAGE_H = 48
  const N = funnelData.length
  const MAX_W = 400
  const MIN_W = 40
  const step = (MAX_W - MIN_W) / (N - 1)

  const widths = funnelData.map((_, i) => MAX_W - i * step)

  return (
    <div className="card mb-6">
      <h2 className="font-semibold mb-5" style={{ color: '#F1F5F9' }}>Funil de Vendas</h2>

      <svg
        width="100%"
        viewBox={`0 0 ${VIEWBOX_W} ${FUNIL_CONFIG.length * STAGE_H}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        {funnelData.map(({ label, value, cor }, i) => {
          const topW = widths[i]
          const botW = i < funnelData.length - 1 ? widths[i + 1] : 0
          const cx = VIEWBOX_W / 2
          const y = i * STAGE_H
          const tl = cx - topW / 2
          const tr = cx + topW / 2
          const bl = cx - botW / 2
          const br = cx + botW / 2

          return (
            <g key={label}>
              <path
                d={`M ${tl},${y} L ${tr},${y} L ${br},${y + STAGE_H} L ${bl},${y + STAGE_H} Z`}
                fill={cor}
              />
              <text
                x={cx}
                y={y + STAGE_H / 2 - 5}
                textAnchor="middle"
                fill="#000000"
                fontSize="10"
                fontWeight="600"
              >
                {label}
              </text>
              <text
                x={cx}
                y={y + STAGE_H / 2 + 10}
                textAnchor="middle"
                fill="#000000"
                fontSize="13"
                fontWeight="700"
              >
                {value}
              </text>
            </g>
          )
        })}
      </svg>

      <div
        className="mt-4 pt-4 grid grid-cols-2 gap-3"
        style={{ borderTop: '1px solid #1E293B' }}
      >
        <div
          className="rounded-lg p-3"
          style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          <p className="text-xs font-semibold" style={{ color: '#EF4444' }}>Perdidos</p>
          <p className="text-2xl font-bold mt-1" style={{ color: '#EF4444' }}>{perdidos}</p>
          <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>no período</p>
        </div>
        <div
          className="rounded-lg p-3"
          style={{ backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}
        >
          <p className="text-xs font-semibold" style={{ color: '#F59E0B' }}>Em Espera</p>
          <p className="text-2xl font-bold mt-1" style={{ color: '#F59E0B' }}>{emEspera}</p>
          <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>aguardando retomada</p>
        </div>
      </div>
    </div>
  )
}

function FollowUpsHoje({ followUps, onRealizar }) {
  const now = new Date()
  const hojeInicio = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const hojeProx = new Date(hojeInicio.getTime() + 86400000)

  const hoje = followUps.filter((f) => {
    const d = new Date(f.dataHora)
    return d >= hojeInicio && d < hojeProx
  })
  const vencidos = followUps.filter((f) => new Date(f.dataHora) < hojeInicio)
  const itens = [...vencidos, ...hoje]

  if (itens.length === 0) return null

  return (
    <div className="card mt-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold" style={{ color: '#F1F5F9' }}>📅 Follow-ups de hoje</h2>
        <span
          className="text-xs px-2.5 py-1 rounded-full font-medium"
          style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}
        >
          {itens.length} pendente{itens.length > 1 ? 's' : ''}
        </span>
      </div>
      <div className="space-y-2">
        {itens.map((fu) => (
          <FollowUpCard key={fu.id} followUp={fu} onRealizar={() => onRealizar(fu.id)} />
        ))}
      </div>
    </div>
  )
}

function FollowUpCard({ followUp, onRealizar }) {
  const [realizando, setRealizando] = useState(false)
  const d = new Date(followUp.dataHora)
  const vencido = d < new Date()
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  const handleRealizar = async () => {
    setRealizando(true)
    try { await onRealizar() } finally { setRealizando(false) }
  }

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-lg"
      style={{
        backgroundColor: vencido ? 'rgba(239,68,68,0.07)' : 'rgba(245,158,11,0.07)',
        border: `1px solid ${vencido ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`,
      }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: '#F1F5F9' }}>
          {followUp.lead.nome}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs font-medium" style={{ color: vencido ? '#EF4444' : '#F59E0B' }}>
            {vencido ? `Vencido ${hora}` : hora}
          </span>
          {followUp.observacao && (
            <span className="text-xs truncate max-w-[160px]" style={{ color: '#64748B' }}>
              {followUp.observacao}
            </span>
          )}
          {followUp.corretor && (
            <span className="text-xs" style={{ color: '#60A5FA' }}>
              👤 {followUp.corretor.nome}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={handleRealizar}
        disabled={realizando}
        className="text-xs font-medium px-3 py-1.5 rounded-lg flex-shrink-0 disabled:opacity-50 transition-colors"
        style={{ backgroundColor: 'rgba(16,185,129,0.15)', color: '#10B981' }}
        title="Marcar como realizado"
      >
        {realizando ? '...' : '✓ Feito'}
      </button>
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
