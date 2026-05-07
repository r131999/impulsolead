import { useEffect, useState, useCallback } from 'react'
import * as corretoresApi from '../api/corretores'

export default function MinhaEquipe() {
  const [corretores, setCorretores] = useState([])
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(() => {
    corretoresApi
      .listar()
      .then((res) => setCorretores(res.data.corretores))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { carregar() }, [carregar])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500" />
      </div>
    )
  }

  const ativos = corretores.filter((c) => c.ativo)
  const disponiveis = ativos.filter((c) => c.disponivel)

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold" style={{ color: '#F1F5F9' }}>Minha Equipe</h1>
        <p className="text-xs md:text-sm mt-0.5" style={{ color: '#94A3B8' }}>
          {ativos.length} ativos · {disponiveis.length} disponíveis
        </p>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead style={{ backgroundColor: '#0B1120', borderBottom: '1px solid #1E293B' }}>
              <tr>
                <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wide" style={{ color: '#64748B' }}>Corretor</th>
                <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wide hidden sm:table-cell" style={{ color: '#64748B' }}>Telefone</th>
                <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wide" style={{ color: '#64748B' }}>Status</th>
                <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wide" style={{ color: '#64748B' }}>Leads recebidos</th>
                <th className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wide hidden sm:table-cell" style={{ color: '#64748B' }}>Posição fila</th>
              </tr>
            </thead>
            <tbody>
              {corretores.map((c, idx) => (
                <tr
                  key={c.id}
                  style={{
                    borderBottom: '1px solid #1E293B',
                    opacity: !c.ativo ? 0.45 : 1,
                    backgroundColor: idx % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent',
                  }}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium" style={{ color: '#F1F5F9' }}>{c.nome}</p>
                    {c.email && <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{c.email}</p>}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell" style={{ color: '#94A3B8' }}>{c.telefone}</td>
                  <td className="px-4 py-3">
                    {c.ativo ? (
                      <span
                        className="badge"
                        style={
                          c.disponivel
                            ? { color: '#10B981', backgroundColor: 'rgba(16,185,129,0.15)' }
                            : { color: '#64748B', backgroundColor: 'rgba(100,116,139,0.15)' }
                        }
                      >
                        {c.disponivel ? 'Disponível' : 'Indisponível'}
                      </span>
                    ) : (
                      <span className="badge" style={{ color: '#EF4444', backgroundColor: 'rgba(239,68,68,0.15)' }}>
                        Inativo
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold" style={{ color: '#F1F5F9' }}>{c.leadsRecebidos}</td>
                  <td className="px-4 py-3 hidden sm:table-cell" style={{ color: '#94A3B8' }}>#{c.posicaoFila + 1}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {corretores.length === 0 && (
          <p className="text-center py-12 text-sm" style={{ color: '#64748B' }}>Nenhum corretor na equipe.</p>
        )}
      </div>
    </div>
  )
}
