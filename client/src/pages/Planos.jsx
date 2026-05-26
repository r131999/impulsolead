import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

const PLANOS = [
  {
    id: 'starter',
    nome: 'Starter',
    preco: 'R$ 197',
    periodo: '/mês',
    descricao: 'Ideal para imobiliárias que querem organizar seus leads e distribuir para a equipe.',
    recursos: [
      'Kanban de leads ilimitado',
      'Gestão de corretores',
      'Distribuição automática de leads',
      'Notificações WhatsApp',
      'Relatórios de desempenho',
      'Arquivos de imóveis',
      'Histórico de distribuição',
    ],
    cor: '#6366F1',
    corFundo: 'rgba(99,102,241,0.08)',
    corBorda: 'rgba(99,102,241,0.25)',
  },
  {
    id: 'pro',
    nome: 'Pro',
    preco: 'R$ 297',
    periodo: '/mês',
    descricao: 'Tudo do Starter mais chat com leads e assistente IA para maximizar as conversões.',
    recursos: [
      'Tudo do Starter',
      'Chat direto com lead via WhatsApp',
      'Assistente IA integrado',
      'Análise inteligente de conversas',
      'Prioridade no suporte',
    ],
    cor: '#10B981',
    corFundo: 'rgba(16,185,129,0.08)',
    corBorda: 'rgba(16,185,129,0.25)',
    destaque: true,
  },
]

export default function Planos() {
  const { planoInfo } = useAuth()
  const [modalPlano, setModalPlano] = useState(null)

  const planoAtual = planoInfo?.plano

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold mb-2" style={{ color: '#F1F5F9' }}>Escolha seu plano</h1>
        <p style={{ color: '#94A3B8' }}>
          {planoAtual === 'trial'
            ? `Você está no período de teste. Escolha um plano para continuar após o trial.`
            : 'Selecione o plano que melhor atende sua imobiliária.'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {PLANOS.map((p) => {
          const atual = planoAtual === p.id
          return (
            <div
              key={p.id}
              className="rounded-xl p-6 flex flex-col"
              style={{
                backgroundColor: p.corFundo,
                border: `1px solid ${atual ? p.cor : p.corBorda}`,
                boxShadow: p.destaque ? `0 0 24px ${p.cor}22` : 'none',
                position: 'relative',
              }}
            >
              {p.destaque && (
                <div
                  className="absolute top-0 right-4 -translate-y-1/2 px-3 py-0.5 rounded-full text-xs font-bold"
                  style={{ backgroundColor: p.cor, color: '#fff' }}
                >
                  Mais popular
                </div>
              )}
              {atual && (
                <div
                  className="absolute top-0 left-4 -translate-y-1/2 px-3 py-0.5 rounded-full text-xs font-bold"
                  style={{ backgroundColor: '#1E293B', color: p.cor, border: `1px solid ${p.cor}` }}
                >
                  Plano atual
                </div>
              )}

              <div className="mb-4">
                <h2 className="text-xl font-bold" style={{ color: p.cor }}>{p.nome}</h2>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl font-bold" style={{ color: '#F1F5F9' }}>{p.preco}</span>
                  <span style={{ color: '#64748B' }}>{p.periodo}</span>
                </div>
                <p className="text-sm mt-2" style={{ color: '#94A3B8' }}>{p.descricao}</p>
              </div>

              <ul className="flex-1 space-y-2 mb-6">
                {p.recursos.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm" style={{ color: '#CBD5E1' }}>
                    <span style={{ color: p.cor, marginTop: 1 }}>✓</span>
                    {r}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => setModalPlano(p)}
                className="w-full py-3 rounded-lg font-semibold text-sm transition-opacity"
                style={{
                  backgroundColor: p.cor,
                  color: '#fff',
                  opacity: atual ? 0.5 : 1,
                  cursor: atual ? 'default' : 'pointer',
                }}
                disabled={atual}
              >
                {atual ? 'Plano ativo' : 'Escolher plano'}
              </button>
            </div>
          )
        })}
      </div>

      {modalPlano && (
        <ModalPix plano={modalPlano} onClose={() => setModalPlano(null)} />
      )}
    </div>
  )
}

function ModalPix({ plano, onClose }) {
  const [copiado, setCopiado] = useState(false)
  const chavePix = '46.603.732/0001-77'

  const copiar = () => {
    navigator.clipboard.writeText(chavePix)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2500)
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}
    >
      <div
        className="rounded-xl p-6 w-full max-w-md"
        style={{ backgroundColor: '#111827', border: '1px solid #1E293B' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg" style={{ color: '#F1F5F9' }}>
            Assinar plano {plano.nome}
          </h3>
          <button onClick={onClose} style={{ color: '#64748B', fontSize: 20 }}>✕</button>
        </div>

        <div className="rounded-lg p-4 mb-4" style={{ backgroundColor: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
          <p className="text-sm font-semibold mb-1" style={{ color: '#94A3B8' }}>Valor</p>
          <p className="text-2xl font-bold" style={{ color: '#F1F5F9' }}>
            {plano.preco}<span className="text-base font-normal" style={{ color: '#64748B' }}>/mês</span>
          </p>
        </div>

        <div className="rounded-lg p-4 mb-4" style={{ backgroundColor: '#0B1120', border: '1px solid #1E293B' }}>
          <p className="text-xs font-medium mb-2" style={{ color: '#64748B' }}>CHAVE PIX</p>
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-sm" style={{ color: '#F1F5F9' }}>{chavePix}</p>
            <button
              onClick={copiar}
              className="text-xs px-3 py-1.5 rounded-lg font-medium flex-shrink-0"
              style={{ backgroundColor: copiado ? 'rgba(16,185,129,0.2)' : 'rgba(99,102,241,0.2)', color: copiado ? '#10B981' : '#818cf8' }}
            >
              {copiado ? '✓ Copiado' : 'Copiar'}
            </button>
          </div>
        </div>

        <div className="rounded-lg p-4 mb-5 text-sm" style={{ backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#D97706' }}>
          <p className="font-semibold mb-1">Como ativar:</p>
          <ol className="space-y-1 list-decimal list-inside" style={{ color: '#94A3B8' }}>
            <li>Faça o PIX com o valor do plano escolhido</li>
            <li>Envie o comprovante para o WhatsApp abaixo</li>
            <li>Seu plano será ativado em até 2 horas</li>
          </ol>
        </div>

        <a
          href="https://wa.me/5598981444954"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-lg font-semibold text-sm"
          style={{ backgroundColor: '#25D366', color: '#fff' }}
        >
          📲 Enviar comprovante — (98) 98144-4954
        </a>
      </div>
    </div>
  )
}
