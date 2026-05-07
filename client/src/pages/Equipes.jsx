import { useEffect, useState, useCallback } from 'react'
import * as equipesApi from '../api/equipes'
import * as corretoresApi from '../api/corretores'

const FORM_VAZIO = { nome: '', liderId: '', descricao: '' }

export default function Equipes() {
  const [equipes, setEquipes] = useState([])
  const [corretores, setCorretores] = useState([])
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState('lista') // 'lista' | 'detalhe'
  const [equipeSelecionada, setEquipeSelecionada] = useState(null)
  const [modal, setModal] = useState(null) // null | 'criar' | 'editar' | 'addCorretor'
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(FORM_VAZIO)
  const [corretorParaAdd, setCorretorParaAdd] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const carregar = useCallback(() => {
    Promise.all([equipesApi.listar(), corretoresApi.listar({ ativo: 'true' })])
      .then(([r1, r2]) => {
        const eq = r1.data.equipes
        setEquipes(eq)
        setCorretores(r2.data.corretores)
        if (equipeSelecionada) {
          const atualizada = eq.find((e) => e.id === equipeSelecionada.id)
          if (atualizada) setEquipeSelecionada(atualizada)
        }
      })
      .finally(() => setLoading(false))
  }, [equipeSelecionada?.id])

  useEffect(() => { carregar() }, [])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const abrirCriar = () => {
    setEditando(null); setForm(FORM_VAZIO); setErro(''); setModal('criar')
  }
  const abrirEditar = (eq) => {
    setEditando(eq)
    setForm({ nome: eq.nome, liderId: eq.lider?.id || '', descricao: eq.descricao || '' })
    setErro('')
    setModal('editar')
  }
  const abrirDetalhe = (eq) => { setEquipeSelecionada(eq); setVista('detalhe') }
  const voltarLista = () => { setVista('lista'); setEquipeSelecionada(null) }

  const salvar = async (e) => {
    e.preventDefault(); setErro(''); setSalvando(true)
    try {
      const payload = { nome: form.nome, descricao: form.descricao || null, liderId: form.liderId || null }
      if (modal === 'criar') {
        await equipesApi.criar(payload)
      } else {
        await equipesApi.atualizar(editando.id, payload)
      }
      setModal(null)
      carregar()
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  const confirmarRemover = async (eq) => {
    if (!confirm(`Remover equipe "${eq.nome}"? Os corretores ficam sem equipe.`)) return
    await equipesApi.remover(eq.id)
    if (vista === 'detalhe') voltarLista()
    carregar()
  }

  const salvarAddCorretor = async (e) => {
    e.preventDefault(); setErro(''); setSalvando(true)
    try {
      await equipesApi.adicionarCorretor(equipeSelecionada.id, corretorParaAdd)
      setModal(null); setCorretorParaAdd('')
      carregar()
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao adicionar')
    } finally {
      setSalvando(false)
    }
  }

  const removerCorretorDaEquipe = async (corretorId) => {
    if (!confirm('Remover corretor da equipe?')) return
    await equipesApi.removerCorretor(equipeSelecionada.id, corretorId)
    carregar()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {vista === 'lista' ? (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
            <div>
              <h1 className="text-xl md:text-2xl font-bold" style={{ color: '#F1F5F9' }}>Equipes</h1>
              <p className="text-xs md:text-sm mt-0.5" style={{ color: '#94A3B8' }}>
                {equipes.length} equipe{equipes.length !== 1 ? 's' : ''} cadastrada{equipes.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button onClick={abrirCriar} className="btn-primary self-start sm:self-auto">
              + Nova equipe
            </button>
          </div>

          {equipes.length === 0 ? (
            <div
              className="rounded-xl p-12 text-center"
              style={{ backgroundColor: '#111827', border: '1px solid #1E293B' }}
            >
              <p className="text-lg font-semibold mb-1" style={{ color: '#F1F5F9' }}>Nenhuma equipe ainda</p>
              <p className="text-sm mb-4" style={{ color: '#64748B' }}>
                Crie equipes para organizar seus corretores e acompanhar o desempenho por grupo.
              </p>
              <button onClick={abrirCriar} className="btn-primary">+ Criar primeira equipe</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
              {equipes.map((eq) => (
                <EquipeCard
                  key={eq.id}
                  equipe={eq}
                  onDetalhe={() => abrirDetalhe(eq)}
                  onEditar={() => abrirEditar(eq)}
                  onRemover={() => confirmarRemover(eq)}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <DetalheEquipe
          equipe={equipeSelecionada}
          onVoltar={voltarLista}
          onEditar={() => abrirEditar(equipeSelecionada)}
          onAddCorretor={() => { setCorretorParaAdd(''); setErro(''); setModal('addCorretor') }}
          onRemoverCorretor={removerCorretorDaEquipe}
          onRemoverEquipe={() => confirmarRemover(equipeSelecionada)}
        />
      )}

      {/* Modal criar / editar equipe */}
      {(modal === 'criar' || modal === 'editar') && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div
            className="rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md"
            style={{ backgroundColor: '#111827', border: '1px solid #1E293B' }}
          >
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #1E293B' }}>
              <h2 className="font-bold" style={{ color: '#F1F5F9' }}>
                {modal === 'criar' ? 'Nova equipe' : 'Editar equipe'}
              </h2>
              <button onClick={() => setModal(null)} className="text-xl leading-none hover:opacity-80" style={{ color: '#64748B' }}>×</button>
            </div>
            <form onSubmit={salvar} className="px-5 py-5 space-y-3">
              <div>
                <label className="label">Nome da equipe *</label>
                <input
                  className="input"
                  value={form.nome}
                  onChange={set('nome')}
                  placeholder="Ex: Equipe Diego"
                  required
                />
              </div>
              <div>
                <label className="label">Líder (opcional)</label>
                <select className="input" value={form.liderId} onChange={set('liderId')}>
                  <option value="">— Sem líder —</option>
                  {corretores.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Descrição (opcional)</label>
                <input
                  className="input"
                  value={form.descricao}
                  onChange={set('descricao')}
                  placeholder="Ex: Equipe do setor norte"
                />
              </div>
              {erro && <p className="text-sm" style={{ color: '#EF4444' }}>{erro}</p>}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" className="btn-primary flex-1" disabled={salvando}>
                  {salvando ? 'Salvando...' : modal === 'criar' ? 'Criar' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal adicionar corretor */}
      {modal === 'addCorretor' && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div
            className="rounded-2xl shadow-2xl w-full max-w-sm"
            style={{ backgroundColor: '#111827', border: '1px solid #1E293B' }}
          >
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #1E293B' }}>
              <h2 className="font-bold" style={{ color: '#F1F5F9' }}>Adicionar corretor</h2>
              <button onClick={() => setModal(null)} className="text-xl leading-none hover:opacity-80" style={{ color: '#64748B' }}>×</button>
            </div>
            <form onSubmit={salvarAddCorretor} className="px-5 py-5 space-y-3">
              <div>
                <label className="label">Corretor *</label>
                <select
                  className="input"
                  value={corretorParaAdd}
                  onChange={(e) => setCorretorParaAdd(e.target.value)}
                  required
                >
                  <option value="">— Selecione um corretor —</option>
                  {corretores
                    .filter((c) => c.id !== equipeSelecionada?.lider?.id ||
                      !equipeSelecionada?.corretores?.some((ec) => ec.id === c.id))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}{c.equipe ? ` (${c.equipe.nome})` : ''}
                      </option>
                    ))}
                </select>
              </div>
              {erro && <p className="text-sm" style={{ color: '#EF4444' }}>{erro}</p>}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" className="btn-primary flex-1" disabled={salvando || !corretorParaAdd}>
                  {salvando ? 'Adicionando...' : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function EquipeCard({ equipe, onDetalhe, onEditar, onRemover }) {
  const { nome, lider, totalCorretores, metricas } = equipe
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-4"
      style={{ backgroundColor: '#111827', border: '1px solid #1E293B' }}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <h3 className="font-bold text-base truncate" style={{ color: '#F1F5F9' }}>{nome}</h3>
          <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
            {lider ? `Líder: ${lider.nome}` : 'Sem líder definido'}
          </p>
        </div>
        <span
          className="ml-2 flex-shrink-0 text-xs rounded-full px-2.5 py-1 font-medium"
          style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: '#818cf8' }}
        >
          {totalCorretores} corretor{totalCorretores !== 1 ? 'es' : ''}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <MetricaMini label="Leads/mês" valor={metricas.totalLeads} cor="#3B82F6" />
        <MetricaMini label="Fechamentos" valor={metricas.fechamentos} cor="#10B981" />
        <MetricaMini label="Conversão" valor={`${metricas.taxaConversao}%`} cor="#8B5CF6" />
      </div>

      <div className="flex gap-2 pt-1" style={{ borderTop: '1px solid #1E293B' }}>
        <button
          onClick={onDetalhe}
          className="flex-1 text-sm font-medium py-1.5 rounded-lg transition-colors"
          style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: '#818cf8' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.25)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.15)'}
        >
          Ver detalhes
        </button>
        <button
          onClick={onEditar}
          className="px-3 text-sm font-medium py-1.5 rounded-lg transition-colors"
          style={{ backgroundColor: 'rgba(59,130,246,0.1)', color: '#60A5FA' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(59,130,246,0.2)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(59,130,246,0.1)'}
        >
          Editar
        </button>
        <button
          onClick={onRemover}
          className="px-3 text-sm font-medium py-1.5 rounded-lg transition-colors"
          style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: '#EF4444' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.18)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.08)'}
        >
          Remover
        </button>
      </div>
    </div>
  )
}

function MetricaMini({ label, valor, cor }) {
  return (
    <div className="rounded-lg p-2 text-center" style={{ backgroundColor: '#0B1120' }}>
      <p className="text-xs mb-0.5" style={{ color: '#64748B' }}>{label}</p>
      <p className="text-base font-bold" style={{ color: cor }}>{valor}</p>
    </div>
  )
}

function DetalheEquipe({ equipe, onVoltar, onEditar, onAddCorretor, onRemoverCorretor, onRemoverEquipe }) {
  if (!equipe) return null
  const { nome, lider, totalCorretores, metricas, corretores } = equipe

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={onVoltar}
          className="text-sm font-medium flex items-center gap-1 hover:opacity-80 transition-opacity"
          style={{ color: '#818cf8' }}
        >
          ← Voltar
        </button>
      </div>

      <div className="rounded-xl p-5" style={{ backgroundColor: '#111827', border: '1px solid #1E293B' }}>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold" style={{ color: '#F1F5F9' }}>{nome}</h2>
            <p className="text-sm mt-0.5" style={{ color: '#94A3B8' }}>
              {lider ? `Líder: ${lider.nome}` : 'Sem líder definido'} · {totalCorretores} corretores
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={onEditar} className="btn-secondary text-sm py-1.5 px-3">Editar</button>
            <button
              onClick={onRemoverEquipe}
              className="text-sm font-medium px-3 py-1.5 rounded-lg"
              style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#EF4444' }}
            >
              Remover equipe
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <MetricaMini label="Leads/mês" valor={metricas.totalLeads} cor="#3B82F6" />
          <MetricaMini label="Em atendimento" valor={metricas.emAtendimento} cor="#F59E0B" />
          <MetricaMini label="Fechamentos" valor={metricas.fechamentos} cor="#10B981" />
          <MetricaMini label="Conversão" valor={`${metricas.taxaConversao}%`} cor="#8B5CF6" />
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div
          className="px-5 py-3 flex items-center justify-between"
          style={{ borderBottom: '1px solid #1E293B' }}
        >
          <h3 className="font-semibold text-sm" style={{ color: '#F1F5F9' }}>
            Corretores ({corretores.length})
          </h3>
          <button onClick={onAddCorretor} className="btn-primary text-xs py-1.5 px-3">
            + Adicionar
          </button>
        </div>

        {corretores.length === 0 ? (
          <p className="text-center py-10 text-sm" style={{ color: '#64748B' }}>
            Nenhum corretor nesta equipe.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead style={{ backgroundColor: '#0B1120', borderBottom: '1px solid #1E293B' }}>
                <tr>
                  {['Corretor', 'Leads', 'Atend.', 'Visitas', 'Fechamentos', 'Conversão', ''].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-medium text-xs uppercase tracking-wide" style={{ color: '#64748B' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {corretores
                  .slice()
                  .sort((a, b) => b.fechamentos - a.fechamentos)
                  .map((c, idx) => (
                    <tr
                      key={c.id}
                      style={{
                        borderBottom: '1px solid #1E293B',
                        backgroundColor: idx % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent',
                      }}
                    >
                      <td className="px-4 py-3 font-medium" style={{ color: '#F1F5F9' }}>
                        {c.nome}
                        {lider?.id === c.id && (
                          <span className="ml-1.5 text-xs" style={{ color: '#818cf8' }}>★</span>
                        )}
                      </td>
                      <td className="px-4 py-3" style={{ color: '#94A3B8' }}>{c.leads}</td>
                      <td className="px-4 py-3" style={{ color: '#F59E0B' }}>{c.emAtendimento}</td>
                      <td className="px-4 py-3" style={{ color: '#f97316' }}>{c.visitasAgendadas}</td>
                      <td className="px-4 py-3 font-medium" style={{ color: '#10B981' }}>{c.fechamentos}</td>
                      <td className="px-4 py-3">
                        <span
                          className="badge"
                          style={
                            c.taxaConversao >= 30
                              ? { color: '#10B981', backgroundColor: 'rgba(16,185,129,0.15)' }
                              : c.taxaConversao >= 15
                              ? { color: '#F59E0B', backgroundColor: 'rgba(245,158,11,0.15)' }
                              : { color: '#EF4444', backgroundColor: 'rgba(239,68,68,0.15)' }
                          }
                        >
                          {c.taxaConversao}%
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => onRemoverCorretor(c.id)}
                          className="text-xs hover:opacity-80 transition-opacity"
                          style={{ color: '#EF4444' }}
                        >
                          Remover
                        </button>
                      </td>
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
