import { useEffect, useRef, useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Avatar, redimensionarImagem } from './Avatar'
import ChatInterno from '../pages/ChatInterno'
import { getLogoUrl } from '../api/config'

const NAV_GESTOR = [
  { to: '/dashboard',        label: 'Dashboard',         icon: ChartIcon },
  { to: '/kanban',           label: 'Kanban',             icon: KanbanIcon },
  { to: '/leads',            label: 'Leads',              icon: UsersIcon },
  { to: '/corretores',       label: 'Corretores',         icon: HomeIcon },
  { to: '/equipes',          label: 'Equipes',            icon: EquipeIcon },
  { to: '/relatorios',       label: 'Relatórios',         icon: BarChartIcon },
  { to: '/imoveis',          label: 'Imóveis',            icon: BuildingIcon },
  { to: '/arquivos-imoveis', label: 'Arquivos de Imóveis', icon: FolderIcon },
  { to: '/config',           label: 'Agente IA',          icon: BotIcon },
  { to: '/whatsapp',         label: 'WhatsApp',           icon: WhatsAppNavIcon },
  { to: '/chat',             label: 'Assistente IA',      icon: ChatIAIcon },
]

const NAV_CORRETOR = [
  { to: '/meus-leads',     label: 'Meus Leads',     icon: KanbanIcon },
  { to: '/meu-desempenho', label: 'Meu Desempenho', icon: ChartIcon },
  { to: '/meus-contatos',  label: 'Meus Contatos',  icon: ContactIcon },
  { to: '/chat',           label: 'Assistente IA',  icon: ChatIAIcon },
]

const NAV_GERENTE = [
  { to: '/gerente/dashboard',    label: 'Dashboard da Equipe',  icon: ChartIcon },
  { to: '/gerente/leads',        label: 'Leads da Equipe',      icon: KanbanIcon },
  { to: '/gerente/minha-equipe', label: 'Minha Equipe',         icon: UsersIcon },
  { to: '/gerente/relatorios',   label: 'Relatório da Equipe',  icon: BarChartIcon },
  { to: '/imoveis',              label: 'Imóveis',              icon: BuildingIcon },
  { to: '/arquivos-imoveis',     label: 'Arquivos de Imóveis',  icon: FolderIcon },
  { to: '/meus-contatos',        label: 'Meus Contatos',        icon: ContactIcon },
  { to: '/chat',                 label: 'Assistente IA',        icon: ChatIAIcon },
]

export default function Layout() {
  const { usuario, logout, isCorretor, isGerente, atualizarFotoPerfil } = useAuth()
  const navigate = useNavigate()
  const [aberta, setAberta] = useState(false)
  const [salvandoFoto, setSalvandoFoto] = useState(false)
  const [logoUrl, setLogoUrl] = useState(null)
  const fotoInputRef = useRef(null)

  useEffect(() => {
    getLogoUrl()
      .then((res) => setLogoUrl(res.data.logoUrl))
      .catch(() => {})
  }, [])

  const handleFoto = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setSalvandoFoto(true)
    try {
      const base64 = await redimensionarImagem(file)
      await atualizarFotoPerfil(base64)
    } catch {}
    finally {
      setSalvandoFoto(false)
      e.target.value = ''
    }
  }

  const fechar = () => setAberta(false)
  const navItems = isGerente ? NAV_GERENTE : isCorretor ? NAV_CORRETOR : NAV_GESTOR

  return (
    <>
      <div className="app-shell">
        {!aberta && (
          <button
            className="hamburger-btn"
            onClick={() => setAberta(true)}
            aria-label="Abrir menu"
          >
            ☰
          </button>
        )}

        {aberta && (
          <div className="sidebar-overlay" onClick={fechar} />
        )}

        <aside className={`app-sidebar${aberta ? ' sidebar-open' : ''}`}>
          {aberta && (
            <button
              className="hamburger-btn-fechar"
              onClick={fechar}
              aria-label="Fechar menu"
            >
              ✕
            </button>
          )}

          <div className="px-5 py-4 border-b border-indigo-800">
            <img
              src={logoUrl || '/logo-branca.png'}
              alt={usuario?.imobiliaria?.nome || 'ImpulsoLead'}
              style={{ height: '32px', maxWidth: '160px', objectFit: 'contain' }}
            />
            <p className="text-indigo-300 text-xs mt-0.5 truncate">{usuario?.imobiliaria?.nome}</p>
            {isGerente && (
              <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: 'rgba(16,185,129,0.15)', color: '#10B981' }}>
                Gerente
              </span>
            )}
            {isCorretor && (
              <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: 'rgba(99,102,241,0.2)', color: '#818cf8' }}>
                Corretor
              </span>
            )}
          </div>

          <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={fechar}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-700 text-white'
                      : 'text-indigo-200 hover:bg-indigo-800 hover:text-white'
                  }`
                }
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="p-3 border-t border-indigo-800">
            <button
              className="w-full flex items-center gap-2.5 px-2 py-1.5 mb-1 rounded-lg hover:bg-indigo-800 transition-colors text-left"
              onClick={() => fotoInputRef.current?.click()}
              title="Clique para alterar foto de perfil"
              disabled={salvandoFoto}
            >
              <Avatar nome={usuario?.nome} fotoPerfil={usuario?.fotoPerfil} size={36} />
              <span className="text-indigo-200 text-xs truncate flex-1">
                {salvandoFoto ? 'Salvando...' : usuario?.nome}
              </span>
            </button>
            <input
              ref={fotoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFoto}
            />
            <button
              onClick={() => { logout(); navigate('/login') }}
              className="w-full text-left px-3 py-2 text-indigo-300 hover:text-white text-sm rounded-lg hover:bg-indigo-800 transition-colors"
            >
              Sair
            </button>
          </div>
        </aside>

        <div className="app-main">
          <Outlet />
        </div>
      </div>
      <ChatInterno />
    </>
  )
}

function ChartIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  )
}

function KanbanIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
    </svg>
  )
}

function UsersIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )
}

function HomeIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}

function BarChartIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}

function EquipeIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  )
}

function BotIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H4a2 2 0 01-2-2V5a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2h-1" />
    </svg>
  )
}

function ContactIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  )
}

function BuildingIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
    </svg>
  )
}

function ChatIAIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
    </svg>
  )
}

function FolderIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  )
}

function WhatsAppNavIcon({ className }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.37 5.07L2 22l5.07-1.36A9.94 9.94 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.66 0-3.2-.45-4.54-1.23l-.32-.19-3.01.79.8-2.95-.21-.33A7.94 7.94 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8zm4.39-5.97c-.24-.12-1.41-.7-1.63-.78-.22-.08-.38-.12-.54.12s-.62.78-.76.94c-.14.16-.28.18-.52.06a6.53 6.53 0 01-1.91-1.18 7.17 7.17 0 01-1.32-1.64c-.14-.24-.01-.37.1-.49.1-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.29-.74-1.76-.19-.46-.39-.4-.54-.4h-.46c-.16 0-.42.06-.64.3s-.84.82-.84 2 .86 2.32.98 2.48c.12.16 1.68 2.56 4.06 3.59.57.24 1.01.39 1.36.5.57.18 1.09.15 1.5.09.46-.07 1.41-.58 1.61-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28z" />
    </svg>
  )
}
