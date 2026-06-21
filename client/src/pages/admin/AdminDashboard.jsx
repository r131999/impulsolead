import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminAuth } from '../../context/AdminAuthContext'
import {
  getStats, getClientes, criarCliente,
  atualizarPlano, atualizarPermissoes, atualizarLimiteAcessos,
} from '../../api/admin'

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtData(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}

function calcStatus(plano, trialExpiraEm) {
  if (plano === 'cancelado') return 'cancelado'
  if (plano === 'legado') return 'legado'
  if (plano === 'trial') {
    return trialExpiraEm && new Date() <= new Date(trialExpiraEm)
      ? 'trial_ativo'
      : 'trial_expirado'
  }
  return plano // construcao | desenvolvimento | sucesso
}

const STATUS_LABEL = {
  trial_ativo:     'Trial ativo',
  trial_expirado:  'Trial expirado',
  construcao:      'Construção',
  desenvolvimento: 'Desenvolvimento',
  sucesso:         'Sucesso',
  legado:          'Legado',
  cancelado:       'Cancelado',
}

const STATUS_COLOR = {
  trial_ativo:     { bg: 'rgba(234,179,8,0.15)',   text: '#facc15' },
  trial_expirado:  { bg: 'rgba(239,68,68,0.15)',   text: '#f87171' },
  construcao:      { bg: 'rgba(99,102,241,0.15)',  text: '#818cf8' },
  desenvolvimento: { bg: 'rgba(16,185,129,0.15)',  text: '#34d399' },
  sucesso:         { bg: 'rgba(245,158,11,0.15)',  text: '#fbbf24' },
  legado:          { bg: 'rgba(139,92,246,0.15)',  text: '#a78bfa' },
  cancelado:       { bg: 'rgba(100,116,139,0.15)', text: '#94a3b8' },
}

function diasColor(dias) {
  if (dias === null || dias === undefined) return '#94A3B8'
  if (dias < 7) return '#f87171'
  if (dias < 15) return '#fbbf24'
  return '#34d399'
}

// ─── dados de planos ─────────────────────────────────────────────────────────

const PLANOS_OPCOES = [
  { value: 'construcao',    label: 'Construção — R$147/mês' },
  { value: 'desenvolvimento', label: 'Desenvolvimento — R$347/mês' },
  { value: 'sucesso',       label: 'Sucesso — R$597/mês' },
  { value: 'trial',         label: 'Trial' },
  { value: 'legado',        label: 'Legado' },
  { value: 'cancelado',     label: 'Cancelado' },
]

const PERMISSOES_ATUAIS = [
  { key: 'importacaoListas',          label: 'Importação de listas' },
  { key: 'gestaoImoveis',             label: 'Gestão de imóveis' },
  { key: 'arquivosImovel',            label: 'Arquivos de imóveis' },
  { key: 'apresentacaoPersonalizada', label: 'Apresentação personalizada' },
  { key: 'painelCampanhas',           label: 'Painel de campanhas (ROI)' },
  { key: 'relatorios',                label: 'Relatórios' },
  { key: 'followUpAutomatico',        label: 'Follow-up automático' },
]

const PERMISSOES_FUTURAS = [
  { key: 'agenteIA',          label: 'Agente IA (Lia) — Em breve' },
  { key: 'chatLead',          label: 'Chat com lead — Em breve' },
  { key: 'multiplosWhatsapp', label: 'Múltiplos WhatsApp — Em breve' },
]

// ─── componentes base ────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }) {
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-1"
      style={{ backgroundColor: '#0f1929', border: '1px solid #1e2d3d' }}
    >
      <p className="text-xs font-medium" style={{ color: '#64748B' }}>{label}</p>
      <p className="text-3xl font-bold" style={{ color: accent || '#F1F5F9' }}>{value ?? '—'}</p>
      {sub && <p className="text-xs" style={{ color: '#64748B' }}>{sub}</p>}
    </div>
  )
}

function PlanoBadge({ status }) {
  const c = STATUS_COLOR[status] || STATUS_COLOR.cancelado
  return (
    <span
      className="px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      {STATUS_LABEL[status] || status}
    </span>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg rounded-2xl shadow-2xl flex flex-col"
        style={{ backgroundColor: '#0f1929', border: '1px solid #1e2d3d', maxHeight: '90vh' }}
      >
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid #1e2d3d' }}
        >
          <h2 className="text-white font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>
        <div className="px-6 py-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid #1e2d3d' }}>
      <span className="text-xs" style={{ color: '#64748B' }}>{label}</span>
      <span className="text-sm font-medium" style={{ color: '#F1F5F9' }}>{value ?? '—'}</span>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: '#0B1120', border: '1px solid #1e2d3d' }}>
      <p className="text-xs font-semibold tracking-wider" style={{ color: '#64748B' }}>{title}</p>
      {children}
    </div>
  )
}

function Toggle({ label, value, onChange, disabled }) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5">
      <span className="text-sm" style={{ color: disabled ? '#475569' : value ? '#CBD5E1' : '#64748B' }}>{label}</span>
      <button
        onClick={() => !disabled && onChange(!value)}
        disabled={disabled}
        className="relative flex-shrink-0 w-9 h-5 rounded-full transition-colors"
        style={{ backgroundColor: value ? '#6366f1' : '#1e2d3d', opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
      >
        <span
          className="absolute top-0.5 w-4 h-4 rounded-full transition-transform"
          style={{
            backgroundColor: '#fff',
            transform: value ? 'translateX(17px)' : 'translateX(2px)',
          }}
        />
      </button>
    </div>
  )
}

function SaveButton({ onClick, loading, children }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="w-full py-2 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-50"
      style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
    >
      {loading ? 'Salvando...' : children}
    </button>
  )
}

// ─── modal gerenciar ────────────────────────────────────────────────────────

function ModalGerenciar({ cliente, onClose, onAtualizado }) {
  // ── plano ──
  const [planoSel, setPlanoSel] = useState(cliente.plano)
  const [expiraEm, setExpiraEm] = useState(
    cliente.planoExpiraEm
      ? new Date(cliente.planoExpiraEm).toISOString().split('T')[0]
      : ''
  )
  const [diasTrial, setDiasTrial] = useState(30)
  const [salvandoPlano, setSalvandoPlano] = useState(false)

  // ── permissões ──
  const [perms, setPerms] = useState(
    typeof cliente.permissoes === 'object' && cliente.permissoes !== null
      ? { ...cliente.permissoes }
      : {}
  )
  const [salvandoPerms, setSalvandoPerms] = useState(false)

  // ── limite ──
  const [limite, setLimite] = useState(cliente.limiteAcessos ?? 5)
  const [salvandoLimite, setSalvandoLimite] = useState(false)

  // ── feedback ──
  const [msg, setMsg] = useState({ texto: '', erro: false })

  const feedback = (texto, erro = false) => {
    setMsg({ texto, erro })
    setTimeout(() => setMsg({ texto: '', erro: false }), 3000)
  }

  const salvarPlano = async () => {
    setSalvandoPlano(true)
    try {
      const payload = { plano: planoSel }
      if (planoSel === 'trial') {
        payload.diasExtender = Number(diasTrial)
      } else if (['construcao', 'desenvolvimento', 'sucesso'].includes(planoSel) && expiraEm) {
        payload.planoExpiraEm = expiraEm
      }
      await atualizarPlano(cliente.id, payload)
      onAtualizado()
      onClose()
    } catch (err) {
      feedback(err.response?.data?.error || 'Erro ao atualizar plano', true)
    } finally {
      setSalvandoPlano(false)
    }
  }

  const salvarPermissoes = async () => {
    setSalvandoPerms(true)
    try {
      await atualizarPermissoes(cliente.id, { permissoes: perms })
      onAtualizado()
      feedback('Permissões salvas')
    } catch (err) {
      feedback(err.response?.data?.error || 'Erro ao salvar permissões', true)
    } finally {
      setSalvandoPerms(false)
    }
  }

  const salvarLimite = async () => {
    setSalvandoLimite(true)
    try {
      await atualizarLimiteAcessos(cliente.id, { limiteAcessos: Number(limite) })
      onAtualizado()
      feedback('Limite atualizado')
    } catch (err) {
      feedback(err.response?.data?.error || 'Erro ao atualizar limite', true)
    } finally {
      setSalvandoLimite(false)
    }
  }

  const togglePerm = (key) => (val) => setPerms((p) => ({ ...p, [key]: val }))

  const isPago = ['construcao', 'desenvolvimento', 'sucesso'].includes(planoSel)
  const acessosEmUso = cliente.totalCorretores ?? 0
  const status = calcStatus(cliente.plano, cliente.trialExpiraEm)

  const inputStyle = {
    backgroundColor: '#111827', border: '1px solid #1e2d3d', color: '#F1F5F9',
  }

  return (
    <Modal title="Gerenciar cliente" onClose={onClose}>
      {/* Info */}
      <div className="space-y-1 mb-5">
        <InfoRow label="Nome" value={cliente.nome} />
        <InfoRow label="Email" value={cliente.email} />
        <InfoRow label="Plano atual" value={<PlanoBadge status={status} />} />
        <InfoRow label="Expira em" value={fmtData(cliente.planoExpiraEm || cliente.trialExpiraEm)} />
        <InfoRow label="Cadastrado em" value={fmtData(cliente.criadoEm)} />
        <InfoRow label="Total de leads" value={cliente.totalLeads} />
      </div>

      {msg.texto && (
        <p
          className="text-xs mb-3 px-3 py-2 rounded-lg"
          style={{
            backgroundColor: msg.erro ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
            color: msg.erro ? '#f87171' : '#34d399',
          }}
        >
          {msg.texto}
        </p>
      )}

      <div className="space-y-4">
        {/* ── Seção Plano ── */}
        <Section title="PLANO">
          <select
            value={planoSel}
            onChange={(e) => setPlanoSel(e.target.value)}
            className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
            style={inputStyle}
          >
            {PLANOS_OPCOES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>

          {planoSel === 'trial' && (
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                max="365"
                value={diasTrial}
                onChange={(e) => setDiasTrial(e.target.value)}
                className="w-24 rounded-lg px-3 py-2 text-sm outline-none"
                style={inputStyle}
              />
              <span className="text-sm" style={{ color: '#64748B' }}>dias a partir de hoje</span>
            </div>
          )}

          {isPago && (
            <div>
              <label className="block text-xs mb-1.5" style={{ color: '#64748B' }}>Expiração do plano</label>
              <input
                type="date"
                value={expiraEm}
                onChange={(e) => setExpiraEm(e.target.value)}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                style={inputStyle}
              />
            </div>
          )}

          {planoSel === 'cancelado' && (
            <p className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: '#f87171' }}>
              O cliente será bloqueado imediatamente ao salvar.
            </p>
          )}

          <SaveButton onClick={salvarPlano} loading={salvandoPlano}>
            Salvar plano
          </SaveButton>
        </Section>

        {/* ── Seção Acessos ── */}
        <Section title="ACESSOS">
          {/* Contador */}
          <div className="flex items-center justify-between px-1">
            <span className="text-sm" style={{ color: '#94A3B8' }}>Em uso agora</span>
            <span
              className="text-sm font-bold px-3 py-1 rounded-lg"
              style={{
                backgroundColor: acessosEmUso >= limite ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.1)',
                color: acessosEmUso >= limite ? '#f87171' : '#34d399',
              }}
            >
              {acessosEmUso} / {limite}
            </span>
          </div>

          <div>
            <label className="block text-xs mb-1.5" style={{ color: '#64748B' }}>Limite de acessos</label>
            <input
              type="number"
              min="1"
              value={limite}
              onChange={(e) => setLimite(e.target.value)}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            />
          </div>

          <SaveButton onClick={salvarLimite} loading={salvandoLimite}>
            Salvar limite
          </SaveButton>
        </Section>

        {/* ── Seção Permissões ── */}
        <Section title="PERMISSÕES">
          <div className="space-y-2">
            {PERMISSOES_ATUAIS.map(({ key, label }) => (
              <Toggle key={key} label={label} value={!!perms[key]} onChange={togglePerm(key)} />
            ))}
          </div>

          <div className="my-2" style={{ borderTop: '1px solid #1e2d3d' }} />

          <p className="text-xs mb-2" style={{ color: '#475569' }}>Futuras</p>
          <div className="space-y-2">
            {PERMISSOES_FUTURAS.map(({ key, label }) => (
              <Toggle key={key} label={label} value={!!perms[key]} onChange={togglePerm(key)} disabled />
            ))}
          </div>

          <SaveButton onClick={salvarPermissoes} loading={salvandoPerms}>
            Salvar permissões
          </SaveButton>
        </Section>
      </div>
    </Modal>
  )
}

// ─── modal novo cliente ──────────────────────────────────────────────────────

function ModalNovoCliente({ onClose, onCriado }) {
  const [form, setForm] = useState({
    nomeImobiliaria: '',
    nomeGestor: '',
    emailGestor: '',
    senhaInicial: '',
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSalvando(true)
    setErro('')
    try {
      await criarCliente(form)
      onCriado()
      onClose()
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao criar cliente')
    } finally {
      setSalvando(false)
    }
  }

  const inputStyle = { backgroundColor: '#0B1120', border: '1px solid #1e2d3d', color: '#F1F5F9' }

  return (
    <Modal title="Novo cliente" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nome da imobiliária">
          <input
            type="text"
            value={form.nomeImobiliaria}
            onChange={set('nomeImobiliaria')}
            required
            placeholder="Ex: Imobiliária Sol Nascente"
            className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
            style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = '#6366f1')}
            onBlur={(e) => (e.target.style.borderColor = '#1e2d3d')}
          />
        </Field>

        <Field label="Nome do gestor">
          <input
            type="text"
            value={form.nomeGestor}
            onChange={set('nomeGestor')}
            required
            placeholder="Ex: João Silva"
            className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
            style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = '#6366f1')}
            onBlur={(e) => (e.target.style.borderColor = '#1e2d3d')}
          />
        </Field>

        <Field label="Email do gestor">
          <input
            type="email"
            value={form.emailGestor}
            onChange={set('emailGestor')}
            required
            placeholder="gestor@imobiliaria.com.br"
            className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
            style={inputStyle}
            onFocus={(e) => (e.target.style.borderColor = '#6366f1')}
            onBlur={(e) => (e.target.style.borderColor = '#1e2d3d')}
          />
        </Field>

        <Field label="Senha inicial">
          <div className="relative">
            <input
              type={mostrarSenha ? 'text' : 'password'}
              value={form.senhaInicial}
              onChange={set('senhaInicial')}
              required
              placeholder="Mínimo 6 caracteres"
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none pr-10"
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = '#6366f1')}
              onBlur={(e) => (e.target.style.borderColor = '#1e2d3d')}
            />
            <button
              type="button"
              onClick={() => setMostrarSenha((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              tabIndex={-1}
            >
              {mostrarSenha ? '🙈' : '👁️'}
            </button>
          </div>
        </Field>

        <p className="text-xs" style={{ color: '#64748B' }}>
          Criado com 7 dias de trial e todas as permissões ativas.
        </p>

        {erro && <p className="text-xs text-red-400">{erro}</p>}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{ backgroundColor: '#1e2d3d', color: '#94A3B8' }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salvando}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            {salvando ? 'Criando...' : 'Criar cliente'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: '#94A3B8' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

// ─── página principal ────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { supremo, logout } = useAdminAuth()
  const navigate = useNavigate()

  const [stats, setStats] = useState(null)
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [clienteGerenciar, setClienteGerenciar] = useState(null)
  const [modalNovo, setModalNovo] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [s, c] = await Promise.all([getStats(), getClientes(busca || undefined)])
      setStats(s.data)
      setClientes(c.data)
    } finally {
      setLoading(false)
    }
  }, [busca])

  useEffect(() => { carregar() }, [carregar])

  const handleLogout = () => {
    logout()
    navigate('/admin/login')
  }

  return (
    <div className="min-h-screen" style={{ background: '#0B1120' }}>
      {/* Navbar */}
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
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs" style={{ color: '#64748B' }}>{supremo?.nome}</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-red-500/10"
            style={{ color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            <LogoutIcon />
            Sair
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total de clientes" value={stats?.totalClientes} />
          <StatCard
            label="Planos ativos"
            value={stats?.clientesAtivos}
            accent="#34d399"
          />
          <StatCard
            label="Trials expirando (7d)"
            value={stats?.trialsExpirando7dias}
            accent={stats?.trialsExpirando7dias > 0 ? '#f87171' : undefined}
            sub={stats?.trialsExpirando7dias > 0 ? 'Atenção necessária' : 'Tudo em ordem'}
          />
          <StatCard label="Total de leads" value={stats?.totalLeads} accent="#818cf8" />
        </div>

        {/* Barra de ações */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative w-full sm:w-72">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar imobiliária..."
              className="w-full rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none"
              style={{ backgroundColor: '#0f1929', border: '1px solid #1e2d3d', color: '#F1F5F9' }}
              onFocus={(e) => (e.target.style.borderColor = '#6366f1')}
              onBlur={(e) => (e.target.style.borderColor = '#1e2d3d')}
            />
          </div>
          <button
            onClick={() => setModalNovo(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            <span className="text-base leading-none">+</span>
            Novo cliente
          </button>
        </div>

        {/* Tabela */}
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1e2d3d' }}>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
            </div>
          ) : clientes.length === 0 ? (
            <div className="text-center py-16" style={{ color: '#475569' }}>
              <p className="text-sm">Nenhum cliente encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: '#0f1929', borderBottom: '1px solid #1e2d3d' }}>
                    {['Imobiliária', 'Plano', 'Dias restantes', 'Acessos', 'Leads', 'Cadastro', ''].map((h) => (
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
                  {clientes.map((c, i) => {
                    const status = calcStatus(c.plano, c.trialExpiraEm)
                    return (
                      <tr
                        key={c.id}
                        style={{
                          backgroundColor: i % 2 === 0 ? '#0B1120' : '#0d1520',
                          borderBottom: '1px solid #1e2d3d',
                        }}
                        className="hover:bg-indigo-500/5 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-white">{c.nome}</p>
                            <p className="text-xs" style={{ color: '#475569' }}>{c.email}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <PlanoBadge status={status} />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {c.diasRestantes !== null ? (
                            <span className="font-medium" style={{ color: diasColor(c.diasRestantes) }}>
                              {c.diasRestantes}d
                            </span>
                          ) : (
                            <span style={{ color: '#475569' }}>—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <span
                            className="text-xs font-medium px-2 py-0.5 rounded"
                            style={{
                              backgroundColor: c.totalCorretores >= c.limiteAcessos
                                ? 'rgba(239,68,68,0.12)'
                                : 'rgba(100,116,139,0.12)',
                              color: c.totalCorretores >= c.limiteAcessos ? '#f87171' : '#94A3B8',
                            }}
                          >
                            {c.totalCorretores}/{c.limiteAcessos}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center" style={{ color: '#94A3B8' }}>
                          {c.totalLeads}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#64748B' }}>
                          {fmtData(c.criadoEm)}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setClienteGerenciar(c)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-indigo-500/20"
                            style={{ color: '#818cf8', border: '1px solid rgba(129,140,248,0.3)' }}
                          >
                            Gerenciar
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-xs text-center" style={{ color: '#334155' }}>
          {clientes.length} cliente{clientes.length !== 1 ? 's' : ''}
          {busca ? ` para "${busca}"` : ''}
        </p>
      </main>

      {clienteGerenciar && (
        <ModalGerenciar
          cliente={clienteGerenciar}
          onClose={() => setClienteGerenciar(null)}
          onAtualizado={carregar}
        />
      )}

      {modalNovo && (
        <ModalNovoCliente
          onClose={() => setModalNovo(false)}
          onCriado={carregar}
        />
      )}
    </div>
  )
}

// ─── ícones ──────────────────────────────────────────────────────────────────

function LogoutIcon() {
  return (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

function SearchIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}
