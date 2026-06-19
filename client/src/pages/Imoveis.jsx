import { useEffect, useState, useCallback } from 'react'
import * as api from '../api/imoveis'
import { usePermissao } from '../hooks/usePermissao'

const TIPOS = ['apartamento', 'casa', 'terreno', 'comercial', 'lançamento']
const STATUS_OPTS = ['disponivel', 'em_lancamento', 'vendido']

const FORM_VAZIO = {
  nome: '',
  descricao: '',
  tipo: 'apartamento',
  localizacao: '',
  valorMin: '',
  valorMax: '',
  quartos: '',
  area: '',
  status: 'disponivel',
  destaque: false,
}

const STATUS_LABEL = {
  disponivel: 'Disponível',
  em_lancamento: 'Em lançamento',
  vendido: 'Vendido',
}

const STATUS_STYLE = {
  disponivel: { backgroundColor: 'rgba(16,185,129,0.12)', color: '#10B981', border: '1px solid rgba(16,185,129,0.25)' },
  em_lancamento: { backgroundColor: 'rgba(59,130,246,0.12)', color: '#60A5FA', border: '1px solid rgba(59,130,246,0.25)' },
  vendido: { backgroundColor: 'rgba(100,116,139,0.12)', color: '#94A3B8', border: '1px solid rgba(100,116,139,0.25)' },
}

const TIPO_LABEL = {
  apartamento: 'Apartamento',
  casa: 'Casa',
  terreno: 'Terreno',
  comercial: 'Comercial',
  'lançamento': 'Lançamento',
}

function formatarValor(v) {
  if (!v) return null
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)
}

export default function Imoveis() {
  const podeImoveis = usePermissao('gestaoImoveis')
  const [imoveis, setImoveis] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // 'novo' | 'editar'
  const [selecionado, setSelecionado] = useState(null)
  const [form, setForm] = useState(FORM_VAZIO)
  const [erroForm, setErroForm] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [toast, setToast] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [excluindo, setExcluindo] = useState(false)

  const mostrarToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 4000)
  }

  const carregar = useCallback(() => {
    setLoading(true)
    api.listar()
      .then((res) => setImoveis(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const fecharModal = () => {
    setModal(null)
    setSelecionado(null)
    setForm(FORM_VAZIO)
    setErroForm('')
  }

  const abrirNovo = () => {
    setForm(FORM_VAZIO)
    setErroForm('')
    setModal('novo')
  }

  const abrirEditar = (imovel) => {
    setSelecionado(imovel)
    setForm({
      nome: imovel.nome,
      descricao: imovel.descricao,
      tipo: imovel.tipo,
      localizacao: imovel.localizacao,
      valorMin: imovel.valorMin ?? '',
      valorMax: imovel.valorMax ?? '',
      quartos: imovel.quartos ?? '',
      area: imovel.area ?? '',
      status: imovel.status,
      destaque: imovel.destaque,
    })
    setErroForm('')
    setModal('editar')
  }

  const salvar = async () => {
    if (!form.nome.trim()) return setErroForm('Nome é obrigatório')
    if (!form.descricao.trim()) return setErroForm('Descrição é obrigatória')
    if (!form.tipo.trim()) return setErroForm('Tipo é obrigatório')
    if (!form.localizacao.trim()) return setErroForm('Localização é obrigatória')

    setSalvando(true)
    setErroForm('')
    try {
      if (modal === 'editar') {
        await api.atualizar(selecionado.id, form)
        mostrarToast('Imóvel atualizado com sucesso!')
      } else {
        await api.criar(form)
        mostrarToast('Imóvel cadastrado com sucesso!')
      }
      fecharModal()
      carregar()
    } catch (err) {
      setErroForm(err.response?.data?.error || 'Erro ao salvar imóvel')
    } finally {
      setSalvando(false)
    }
  }

  const excluir = async (imovel) => {
    setExcluindo(true)
    try {
      await api.remover(imovel.id)
      setConfirmDelete(null)
      carregar()
      mostrarToast('Imóvel removido.')
    } catch (err) {
      mostrarToast(err.response?.data?.error || 'Erro ao remover imóvel.')
    } finally {
      setExcluindo(false)
    }
  }

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  if (!podeImoveis) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <h1 className="text-xl font-bold mb-6" style={{ color: '#F1F5F9' }}>Imóveis</h1>
        <div style={{ position: 'relative', minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, backdropFilter: 'blur(4px)', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 12, zIndex: 10 }} />
          <div style={{ position: 'relative', zIndex: 20, textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
            <h3 style={{ color: '#F1F5F9', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              Gestão de Imóveis disponível em um plano superior
            </h3>
            <p style={{ color: '#94A3B8', marginBottom: 20, fontSize: 14 }}>Entre em contato com o suporte para fazer upgrade.</p>
            <a
              href="https://wa.me/5598981444954"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-block', backgroundColor: '#25D366', color: '#fff', fontWeight: 700, padding: '10px 24px', borderRadius: 8, textDecoration: 'none', fontSize: 14 }}
            >
              Falar com suporte
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">

      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold" style={{ color: '#F1F5F9' }}>Imóveis</h1>
          <p className="text-sm mt-0.5" style={{ color: '#94A3B8' }}>{imoveis.length} imóvel{imoveis.length !== 1 ? 'is' : ''} cadastrado{imoveis.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={abrirNovo} className="btn-primary text-sm">
          + Novo imóvel
        </button>
      </div>

      {/* Lista */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500" />
          </div>
        ) : imoveis.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <BuildingIcon className="w-10 h-10" style={{ color: '#334155' }} />
            <p className="text-sm" style={{ color: '#64748B' }}>Nenhum imóvel cadastrado ainda.</p>
            <button onClick={abrirNovo} className="btn-primary text-sm">Cadastrar primeiro imóvel</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead style={{ backgroundColor: '#0B1120', borderBottom: '1px solid #1E293B' }}>
                <tr>
                  {['Nome', 'Tipo', 'Localização', 'Valor', 'Status', ''].map((h, i) => (
                    <th
                      key={i}
                      className={`text-left px-4 py-3 font-medium text-xs uppercase tracking-wide ${
                        i === 1 ? 'hidden sm:table-cell' :
                        i === 2 ? 'hidden md:table-cell' :
                        i === 3 ? 'hidden lg:table-cell' : ''
                      }`}
                      style={{ color: '#64748B' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {imoveis.map((im, idx) => (
                  <tr
                    key={im.id}
                    style={{
                      borderBottom: '1px solid #1E293B',
                      backgroundColor: idx % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a2332'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = idx % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent'}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <p className="font-medium" style={{ color: '#F1F5F9' }}>{im.nome}</p>
                        {im.destaque && (
                          <span
                            className="text-xs px-1.5 py-0.5 rounded font-medium"
                            style={{ backgroundColor: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.25)' }}
                          >
                            Destaque
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell" style={{ color: '#94A3B8' }}>
                      {TIPO_LABEL[im.tipo] || im.tipo}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell max-w-[200px]">
                      <p className="truncate text-xs" style={{ color: '#64748B' }}>{im.localizacao}</p>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs" style={{ color: '#94A3B8' }}>
                      {im.valorMin || im.valorMax
                        ? [formatarValor(im.valorMin), formatarValor(im.valorMax)].filter(Boolean).join(' – ')
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs px-2 py-1 rounded-full font-medium"
                        style={STATUS_STYLE[im.status] || STATUS_STYLE.disponivel}
                      >
                        {STATUS_LABEL[im.status] || im.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3">
                        <button
                          onClick={() => abrirEditar(im)}
                          className="text-xs font-medium hover:opacity-80 transition-opacity"
                          style={{ color: '#818cf8' }}
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => setConfirmDelete(im)}
                          className="text-xs font-medium hover:opacity-80 transition-opacity"
                          style={{ color: '#EF4444' }}
                        >
                          Remover
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de cadastro/edição */}
      {(modal === 'novo' || modal === 'editar') && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div
            className="w-full rounded-t-2xl sm:rounded-2xl shadow-2xl sm:max-w-2xl max-h-[90vh] flex flex-col"
            style={{ backgroundColor: '#111827', border: '1px solid #1E293B' }}
          >
            <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid #1E293B' }}>
              <h2 className="font-bold" style={{ color: '#F1F5F9' }}>
                {modal === 'editar' ? 'Editar imóvel' : 'Novo imóvel'}
              </h2>
              <button onClick={fecharModal} className="text-xl leading-none hover:opacity-80" style={{ color: '#64748B' }}>×</button>
            </div>

            <div className="px-5 py-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="label">Nome <span style={{ color: '#EF4444' }}>*</span></label>
                  <input
                    className="input w-full"
                    placeholder="Ex: Residencial Aurora"
                    value={form.nome}
                    onChange={(e) => setField('nome', e.target.value)}
                  />
                </div>

                <div>
                  <label className="label">Tipo <span style={{ color: '#EF4444' }}>*</span></label>
                  <select
                    className="input w-full"
                    value={form.tipo}
                    onChange={(e) => setField('tipo', e.target.value)}
                  >
                    {TIPOS.map((t) => (
                      <option key={t} value={t}>{TIPO_LABEL[t] || t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Status <span style={{ color: '#EF4444' }}>*</span></label>
                  <select
                    className="input w-full"
                    value={form.status}
                    onChange={(e) => setField('status', e.target.value)}
                  >
                    {STATUS_OPTS.map((s) => (
                      <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="label">Localização <span style={{ color: '#EF4444' }}>*</span></label>
                  <input
                    className="input w-full"
                    placeholder="Bairro ou endereço"
                    value={form.localizacao}
                    onChange={(e) => setField('localizacao', e.target.value)}
                  />
                </div>

                <div>
                  <label className="label">Valor mínimo <span className="text-xs font-normal" style={{ color: '#64748B' }}>(opcional)</span></label>
                  <input
                    type="number"
                    className="input w-full"
                    placeholder="Ex: 350000"
                    value={form.valorMin}
                    onChange={(e) => setField('valorMin', e.target.value)}
                  />
                </div>

                <div>
                  <label className="label">Valor máximo <span className="text-xs font-normal" style={{ color: '#64748B' }}>(opcional)</span></label>
                  <input
                    type="number"
                    className="input w-full"
                    placeholder="Ex: 450000"
                    value={form.valorMax}
                    onChange={(e) => setField('valorMax', e.target.value)}
                  />
                </div>

                <div>
                  <label className="label">Quartos <span className="text-xs font-normal" style={{ color: '#64748B' }}>(opcional)</span></label>
                  <input
                    type="number"
                    className="input w-full"
                    placeholder="Ex: 3"
                    value={form.quartos}
                    onChange={(e) => setField('quartos', e.target.value)}
                  />
                </div>

                <div>
                  <label className="label">Área <span className="text-xs font-normal" style={{ color: '#64748B' }}>(opcional)</span></label>
                  <input
                    className="input w-full"
                    placeholder="Ex: 65m²"
                    value={form.area}
                    onChange={(e) => setField('area', e.target.value)}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="label">Descrição <span style={{ color: '#EF4444' }}>*</span></label>
                  <textarea
                    className="input resize-none w-full"
                    rows={4}
                    placeholder="Descreva o imóvel com detalhes relevantes para os corretores..."
                    value={form.descricao}
                    onChange={(e) => setField('descricao', e.target.value)}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded accent-indigo-500"
                      checked={form.destaque}
                      onChange={(e) => setField('destaque', e.target.checked)}
                    />
                    <span className="text-sm" style={{ color: '#94A3B8' }}>
                      Marcar como <strong style={{ color: '#F59E0B' }}>Destaque</strong>
                    </span>
                  </label>
                </div>
              </div>

              {erroForm && <p className="text-sm" style={{ color: '#EF4444' }}>{erroForm}</p>}

              <div className="flex gap-2 pt-1">
                <button onClick={fecharModal} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={salvar} disabled={salvando} className="btn-primary flex-1">
                  {salvando ? 'Salvando...' : modal === 'editar' ? 'Salvar alterações' : 'Cadastrar imóvel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmação de exclusão */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div
            className="w-full max-w-sm rounded-2xl shadow-2xl p-6 space-y-4"
            style={{ backgroundColor: '#111827', border: '1px solid #1E293B' }}
          >
            <p className="font-bold" style={{ color: '#F1F5F9' }}>Remover imóvel?</p>
            <p className="text-sm" style={{ color: '#94A3B8' }}>
              Tem certeza que deseja remover <strong style={{ color: '#F1F5F9' }}>{confirmDelete.nome}</strong>?
              Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary flex-1">Cancelar</button>
              <button
                onClick={() => excluir(confirmDelete)}
                disabled={excluindo}
                className="btn-danger flex-1"
              >
                {excluindo ? 'Removendo...' : 'Remover'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-lg px-5 py-3 text-sm font-medium z-50 shadow-lg whitespace-nowrap"
          style={{ backgroundColor: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#10B981' }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}

function BuildingIcon({ className, style }) {
  return (
    <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
    </svg>
  )
}
