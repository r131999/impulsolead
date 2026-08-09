import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminAuth } from '../../context/AdminAuthContext'
import { getCobrancas } from '../../api/admin'
import { AdminTabs } from './AdminDashboard'

function fmtDataHora(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR')
}

function fmtValor(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const STATUS_LABEL = {
  sent: 'Enviado',
  delivered: 'Entregue',
  failed: 'Falhou',
}

const STATUS_COLOR = {
  sent:      { bg: 'rgba(234,179,8,0.15)',  text: '#facc15' },
  delivered: { bg: 'rgba(16,185,129,0.15)', text: '#34d399' },
  failed:    { bg: 'rgba(239,68,68,0.15)',  text: '#f87171' },
}

function StatusBadge({ status }) {
  if (!status) {
    return (
      <span
        className="px-2 py-0.5 rounded-full text-xs font-medium"
        style={{ backgroundColor: 'rgba(100,116,139,0.15)', color: '#94a3b8' }}
      >
        Sem registro
      </span>
    )
  }
  const c = STATUS_COLOR[status] || STATUS_COLOR.sent
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: c.bg, color: c.text }}>
      {STATUS_LABEL[status] || status}
    </span>
  )
}

export default function AdminCobrancas() {
  const { supremo, logout } = useAdminAuth()
  const navigate = useNavigate()

  const [cobrancas, setCobrancas] = useState([])
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getCobrancas()
      setCobrancas(res.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const handleLogout = () => {
    logout()
    navigate('/admin/login')
  }

  return (
    <div className="min-h-screen" style={{ background: '#0B1120' }}>
      <header
        className="sticky top-0 z-30 flex items-center justify-between px-6 py-3"
        style={{ backgroundColor: '#0f1929', borderBottom: '1px solid #1e2d3d' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            I
          </div>
          <div>
            <p className="text-white text-sm font-semibold leading-none">Impulso Produções</p>
            <p className="text-indigo-400 text-xs">Painel Admin</p>
          </div>
          <div className="ml-4">
            <AdminTabs />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs" style={{ color: '#64748B' }}>{supremo?.nome}</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-red-500/10"
            style={{ color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            Sair
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: '#F1F5F9' }}>Cobranças</h1>
          <p className="text-xs mt-1" style={{ color: '#64748B' }}>
            Auditoria das cobranças geradas. O disparo automático ainda não está ativo nesta versão —
            esta tela lista os registros conforme forem criados.
          </p>
        </div>

        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1e2d3d' }}>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
            </div>
          ) : cobrancas.length === 0 ? (
            <div className="text-center py-16" style={{ color: '#475569' }}>
              <p className="text-sm">Nenhuma cobrança registrada ainda</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: '#0f1929', borderBottom: '1px solid #1e2d3d' }}>
                    {['Data/hora', 'Imobiliária', 'Plano', 'Valor', 'Status de entrega'].map((h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-3 text-xs font-medium whitespace-nowrap"
                        style={{ color: '#64748B' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cobrancas.map((c, i) => (
                    <tr
                      key={c.id}
                      style={{
                        backgroundColor: i % 2 === 0 ? '#0B1120' : '#0d1520',
                        borderBottom: '1px solid #1e2d3d',
                      }}
                    >
                      <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#94A3B8' }}>{fmtDataHora(c.criadoEm)}</td>
                      <td className="px-4 py-3 font-medium text-white">{c.imobiliaria?.nome ?? '—'}</td>
                      <td className="px-4 py-3" style={{ color: '#94A3B8' }}>{c.plano}</td>
                      <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#F1F5F9' }}>{fmtValor(c.valor)}</td>
                      <td className="px-4 py-3"><StatusBadge status={c.statusEntrega} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
