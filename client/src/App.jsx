import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Kanban from './pages/Kanban'
import Leads from './pages/Leads'
import Corretores from './pages/Corretores'
import Relatorios from './pages/Relatorios'
import ConfigAgente from './pages/ConfigAgente'
import DesempenhoCorretor from './pages/DesempenhoCorretor'
import Equipes from './pages/Equipes'
import DashboardGerente from './pages/DashboardGerente'
import MinhaEquipe from './pages/MinhaEquipe'
import RelatoriosGerente from './pages/RelatoriosGerente'
import MeusContatos from './pages/MeusContatos'

function HomeRedirect() {
  const { usuario } = useAuth()
  if (usuario?.role === 'gerente') return <Navigate to="/gerente/dashboard" replace />
  if (usuario?.role === 'corretor') return <Navigate to="/meus-leads" replace />
  return <Navigate to="/dashboard" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<HomeRedirect />} />

            {/* Rotas do gestor */}
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="kanban" element={<Kanban />} />
            <Route path="leads" element={<Leads />} />
            <Route path="corretores" element={<Corretores />} />
            <Route path="equipes" element={<Equipes />} />
            <Route path="relatorios" element={<Relatorios />} />
            <Route path="config" element={<ConfigAgente />} />

            {/* Rotas do corretor */}
            <Route path="meus-leads" element={<Kanban />} />
            <Route path="meu-desempenho" element={<DesempenhoCorretor />} />
            <Route path="meus-contatos" element={<MeusContatos />} />

            {/* Rotas do gerente */}
            <Route path="gerente/dashboard" element={<DashboardGerente />} />
            <Route path="gerente/leads" element={<Kanban />} />
            <Route path="gerente/minha-equipe" element={<MinhaEquipe />} />
            <Route path="gerente/relatorios" element={<RelatoriosGerente />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
