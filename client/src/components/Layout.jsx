import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: ChartIcon },
  { to: '/kanban', label: 'Kanban', icon: KanbanIcon },
  { to: '/leads', label: 'Leads', icon: UsersIcon },
  { to: '/corretores', label: 'Corretores', icon: HomeIcon },
  { to: '/relatorios', label: 'Relatórios', icon: BarChartIcon },
  { to: '/config', label: 'Agente IA', icon: BotIcon },
]

export default function Layout() {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarAberta, setSidebarAberta] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const fecharSidebar = () => setSidebarAberta(false)

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Overlay escuro no mobile quando sidebar aberta */}
      {sidebarAberta && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={fecharSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-indigo-900 flex flex-col flex-shrink-0
          transition-transform duration-300 ease-in-out
          ${sidebarAberta ? 'translate-x-0' : '-translate-x-full'}
          md:relative md:w-56 md:translate-x-0`}
      >
        <div className="px-5 py-4 border-b border-indigo-800 flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="text-white font-bold text-lg tracking-tight">ImpulsoLead</h1>
            <p className="text-indigo-300 text-xs mt-0.5 truncate">{usuario?.imobiliaria?.nome}</p>
          </div>
          <button
            className="md:hidden text-indigo-300 hover:text-white p-1 flex-shrink-0 ml-2"
            onClick={fecharSidebar}
            aria-label="Fechar menu"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={fecharSidebar}
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
          <div className="px-3 py-1.5 text-indigo-300 text-xs truncate">{usuario?.nome}</div>
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 text-indigo-300 hover:text-white text-sm rounded-lg hover:bg-indigo-800 transition-colors"
          >
            Sair
          </button>
        </div>
      </aside>

      {/* Conteúdo principal */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Barra superior mobile com botão hambúrguer */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-indigo-900 flex-shrink-0 shadow-md">
          <button
            onClick={() => setSidebarAberta(true)}
            className="text-white p-1"
            aria-label="Abrir menu"
          >
            <HamburgerIcon className="w-6 h-6" />
          </button>
          <h1 className="text-white font-bold text-base">ImpulsoLead</h1>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function HamburgerIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

function XIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
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

function BotIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H4a2 2 0 01-2-2V5a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2h-1" />
    </svg>
  )
}
