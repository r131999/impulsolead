import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Kanban from './pages/Kanban'
import Leads from './pages/Leads'
import Corretores from './pages/Corretores'
import Relatorios from './pages/Relatorios'
import ConfigAgente from './pages/ConfigAgente'

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
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="kanban" element={<Kanban />} />
            <Route path="leads" element={<Leads />} />
            <Route path="corretores" element={<Corretores />} />
            <Route path="relatorios" element={<Relatorios />} />
            <Route path="config" element={<ConfigAgente />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
