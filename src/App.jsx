import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { LandingPage } from './pages/LandingPage'
import { Entry } from './pages/Entry'
import { Login } from './pages/Login'
import { RegisterClient } from './pages/RegisterClient'
import { RegisterProvider } from './pages/RegisterProvider'
import { ClientMap } from './pages/ClientMap'
import { ProviderDashboard } from './pages/ProviderDashboard'
import { NotFound } from './pages/NotFound'

function PrivateRoute({ children, requiredType }) {
  const { profile, loading } = useAuth()
  if (loading) return (
    <div className="h-screen grid place-items-center" style={{ background: 'var(--bg)' }}>
      <span className="w-8 h-8 border-4 border-teal-400 border-t-transparent rounded-full animate-spin"/>
    </div>
  )
  if (!profile) return <Navigate to="/login" replace/>
  if (requiredType && profile.tipo !== requiredType) return <Navigate to="/" replace/>
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage/>}/>
      <Route path="/entrar" element={<Entry/>}/>
      <Route path="/login" element={<Login/>}/>
      <Route path="/cadastro/cliente" element={<RegisterClient/>}/>
      <Route path="/cadastro/prestador" element={<RegisterProvider/>}/>
      <Route path="/mapa" element={<PrivateRoute requiredType="cliente"><ClientMap/></PrivateRoute>}/>
      <Route path="/dashboard" element={<PrivateRoute requiredType="prestador"><ProviderDashboard/></PrivateRoute>}/>
      <Route path="*" element={<NotFound/>}/>
    </Routes>
  )
}
