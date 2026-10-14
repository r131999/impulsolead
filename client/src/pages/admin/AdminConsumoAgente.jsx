import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminAuth } from '../../context/AdminAuthContext'
import { getConsumoAgente, atualizarFranquiaAgente } from '../../api/admin'
import { AdminTabs } from './AdminDashboard'

const MS_DIA = 24 * 60 * 60 * 1000

function fmtDia(data) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })
    .format(new Date(data))
}

// cicloFim é o instante do reset — o último dia do ciclo é o anterior.
function fmtCiclo(inicio, fim) {
  return `${fmtDia(inicio)} – ${fmtDia(new Date(new Date(fim).getTime() - MS_DIA))}`
}

function fmtValor(valor) {
  if (valor == null) return '—'
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function corPercentual(p) {
  if (p == null) return '#64748B'
  if (p >= 100) return '#f87171'
  if (p >= 80) return '#facc15'
  return '#94A3B8'
}

// '' = null (sem definição); senão número. Devolve undefined se inválido.
function lerCampo(texto, { inteiro, min, max }) {
  const t = String(texto).trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  if (!Number.isFinite(n) || n < min || (max != null && n > max)) return undefined
  if (inteiro && !Number.isInteger(n)) return undefined
  return n
}

export default function AdminConsumoAgente() {
  const { supremo, logout } = useAdminAuth()
  const navigate = useNavigate()

  const [linhas, setLinhas] = useState([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(null) // { id, franquia, valor, dia }
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getConsumoAgente()
      setLinhas(res.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const handleLogout = () => {
    logout()
    navigate('/admin/login')
  }

  const abrirEdicao = (l) => {
    setErro('')
    setEditando({
      id: l.id,
      franquia: l.franquia ?? '',
      valor: l.valorLeadExcedente ?? '',
      dia: l.diaCicloFaturamento ?? '',
    })
  }

  const salvar = async () => {
    const franquiaLeadsAgente = lerCampo(editando.franquia, { inteiro: true, min: 1 })
    const valorLeadExcedente = lerCampo(editando.valor, { inteiro: false, min: 0 })
    const diaCicloFaturamento = lerCampo(editando.dia, { inteiro: true, min: 1, max: 31 })
    if (franquiaLeadsAgente === undefined) return setErro('Franquia: inteiro maior que zero, ou vazio.')
    if (valorLeadExcedente === undefined) return setErro('Valor por lead: número maior ou igual a zero, ou vazio.')
    if (diaCicloFaturamento === undefined) return setErro('Dia do ciclo: inteiro de 1 a 31, ou vazio.')

    setSalvando(true)
    setErro('')
    try {
      await atualizarFranquiaAgente(editando.id, { franquiaLeadsAgente, valorLeadExcedente, diaCicloFaturamento })
      setEditando(null)
      await carregar()
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  const totalExcedente = linhas.reduce((acc, l) => acc + (l.valorExcedente ?? 0), 0)
  const inputStyle = { backgroundColor: '#0B1120', border: '1px solid #1e2d3d', color: '#F1F5F9' }

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
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold" style={{ color: '#F1F5F9' }}>Consumo do agente de IA</h1>
            <p className="text-xs mt-1" style={{ color: '#64748B' }}>
              Leads com pelo menos uma troca de mensagem com o agente no ciclo atual de cada imobiliária.
              Excedente calculado sobre a franquia; campos vazios = sem definição.
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs" style={{ color: '#64748B' }}>Excedente total nos ciclos atuais</p>
            <p className="text-lg font-semibold" style={{ color: '#F1F5F9' }}>{fmtValor(totalExcedente)}</p>
          </div>
        </div>

        {erro && <p className="text-xs" style={{ color: '#f87171' }}>{erro}</p>}

        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1e2d3d' }}>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
            </div>
          ) : linhas.length === 0 ? (
            <div className="text-center py-16" style={{ color: '#475569' }}>
              <p className="text-sm">Nenhuma imobiliária cadastrada</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: '#0f1929', borderBottom: '1px solid #1e2d3d' }}>
                    {['Imobiliária', 'Plano', 'Dia do ciclo', 'Ciclo atual', 'Consumo', 'Franquia', '%', 'Valor/lead', 'Excedente', 'A faturar', ''].map((h) => (
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
                  {linhas.map((l, i) => {
                    const emEdicao = editando?.id === l.id
                    return (
                      <tr
                        key={l.id}
                        style={{
                          backgroundColor: i % 2 === 0 ? '#0B1120' : '#0d1520',
                          borderBottom: '1px solid #1e2d3d',
                        }}
                      >
                        <td className="px-4 py-3 font-medium text-white">
                          {l.nome}
                          {!l.agenteIA && <span className="block text-xs font-normal" style={{ color: '#475569' }}>sem agente de IA</span>}
                        </td>
                        <td className="px-4 py-3" style={{ color: '#94A3B8' }}>{l.plano}</td>
                        <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#94A3B8' }}>
                          {emEdicao ? (
                            <input
                              className="w-16 rounded px-2 py-1 text-xs"
                              style={inputStyle}
                              value={editando.dia}
                              onChange={(e) => setEditando((ed) => ({ ...ed, dia: e.target.value }))}
                              placeholder={String(l.diaCicloEfetivo)}
                            />
                          ) : (
                            <>
                              {l.diaCicloEfetivo}
                              {l.diaCicloFaturamento == null && <span style={{ color: '#475569' }}> (auto)</span>}
                            </>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#94A3B8' }}>{fmtCiclo(l.cicloInicio, l.cicloFim)}</td>
                        <td className="px-4 py-3" style={{ color: '#F1F5F9' }}>{l.consumido}</td>
                        <td className="px-4 py-3" style={{ color: '#94A3B8' }}>
                          {emEdicao ? (
                            <input
                              className="w-20 rounded px-2 py-1 text-xs"
                              style={inputStyle}
                              value={editando.franquia}
                              onChange={(e) => setEditando((ed) => ({ ...ed, franquia: e.target.value }))}
                              placeholder="—"
                            />
                          ) : (l.franquia ?? '—')}
                        </td>
                        <td className="px-4 py-3 font-medium" style={{ color: corPercentual(l.percentual) }}>
                          {l.percentual != null ? `${l.percentual}%` : '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#94A3B8' }}>
                          {emEdicao ? (
                            <input
                              className="w-20 rounded px-2 py-1 text-xs"
                              style={inputStyle}
                              value={editando.valor}
                              onChange={(e) => setEditando((ed) => ({ ...ed, valor: e.target.value }))}
                              placeholder="—"
                            />
                          ) : fmtValor(l.valorLeadExcedente)}
                        </td>
                        <td className="px-4 py-3" style={{ color: l.excedente > 0 ? '#f87171' : '#94A3B8' }}>{l.excedente}</td>
                        <td className="px-4 py-3 whitespace-nowrap font-medium" style={{ color: '#F1F5F9' }}>
                          {l.excedente > 0 && l.valorExcedente == null ? (
                            <span className="text-xs font-normal" style={{ color: '#facc15' }}>sem valor/lead</span>
                          ) : fmtValor(l.valorExcedente)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          {emEdicao ? (
                            <>
                              <button
                                onClick={salvar}
                                disabled={salvando}
                                className="text-xs font-medium px-2 py-1 rounded mr-1"
                                style={{ backgroundColor: 'rgba(99,102,241,0.2)', color: '#a5b4fc' }}
                              >
                                {salvando ? 'Salvando…' : 'Salvar'}
                              </button>
                              <button
                                onClick={() => { setEditando(null); setErro('') }}
                                className="text-xs px-2 py-1 rounded"
                                style={{ color: '#64748B' }}
                              >
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => abrirEdicao(l)}
                              className="text-xs px-2 py-1 rounded"
                              style={{ color: '#818cf8' }}
                            >
                              Editar
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
