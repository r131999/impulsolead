import { useNavigate } from 'react-router-dom'

// Card do dashboard (gestor/admin). Com agenteIA: consumo do ciclo de
// faturamento contra a franquia. Sem agenteIA: leads sem tratativa nos últimos
// 30 dias, com link pra lista filtrada e uma linha discreta sobre o agente.
export default function ConsumoAgenteCard({ consumo }) {
  if (!consumo) return null
  return consumo.agenteIA ? <CardConsumo consumo={consumo} /> : <CardSemTratativa consumo={consumo} />
}

function corDaBarra(percentual) {
  if (percentual >= 100) return '#EF4444'
  if (percentual >= 80) return '#F59E0B'
  return '#818cf8'
}

function CardConsumo({ consumo }) {
  const { consumido, franquia, percentual, projecaoFimCiclo, cicloFim } = consumo
  const temFranquia = franquia != null

  return (
    <div className="rounded-xl p-4 mb-6" style={{ backgroundColor: '#111827', border: '1px solid #1E293B' }}>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <p className="text-xs font-medium" style={{ color: '#94A3B8' }}>Agente de IA · leads atendidos no ciclo</p>
        <p className="text-xs" style={{ color: '#64748B' }}>renova em {formatarDia(cicloFim)}</p>
      </div>

      <p className="text-2xl font-bold" style={{ color: '#F1F5F9' }}>
        {consumido}
        {temFranquia && <span className="text-base font-medium" style={{ color: '#64748B' }}> / {franquia}</span>}
      </p>

      {temFranquia ? (
        <div className="h-2 rounded-full mt-3 overflow-hidden" style={{ backgroundColor: '#1E293B' }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.min(100, percentual)}%`, backgroundColor: corDaBarra(percentual) }}
          />
        </div>
      ) : (
        <p className="text-xs mt-1" style={{ color: '#64748B' }}>Sem franquia definida</p>
      )}

      <p className="text-xs mt-3" style={{ color: '#94A3B8' }}>
        Projeção para o fim do ciclo: <span style={{ color: '#F1F5F9' }}>{projecaoFimCiclo} leads</span>
        {temFranquia && projecaoFimCiclo > franquia && (
          <span style={{ color: '#F59E0B' }}> · acima da franquia</span>
        )}
      </p>
    </div>
  )
}

function CardSemTratativa({ consumo }) {
  const navigate = useNavigate()
  const { leadsSemTratativa, janelaDias } = consumo

  return (
    <div className="rounded-xl p-4 mb-6" style={{ backgroundColor: '#111827', border: '1px solid #1E293B' }}>
      <p className="text-xs font-medium mb-1" style={{ color: '#94A3B8' }}>
        Leads sem nenhuma tratativa · últimos {janelaDias} dias
      </p>
      <div className="flex items-center justify-between gap-3">
        <p className="text-2xl font-bold" style={{ color: leadsSemTratativa > 0 ? '#F59E0B' : '#F1F5F9' }}>
          {leadsSemTratativa}
        </p>
        {leadsSemTratativa > 0 && (
          <button
            type="button"
            onClick={() => navigate('/leads?semTratativa=1')}
            className="text-xs font-medium px-3 py-1.5 rounded-lg"
            style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: '#818cf8' }}
          >
            Ver leads →
          </button>
        )}
      </div>
      <p className="text-xs mt-3" style={{ color: '#475569' }}>
        O agente de IA responde cada lead novo na hora, a qualquer horário.
      </p>
    </div>
  )
}

// cicloFim é o instante do reset (00:00 de Brasília do dia de renovação).
function formatarDia(iso) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })
    .format(new Date(iso))
}
