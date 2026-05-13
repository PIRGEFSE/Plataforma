import { useState } from 'react'
import { Routes, Route, NavLink, useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Resumen from './tabs/Resumen'
import Tendencia from './tabs/Tendencia'
import Subvencion from './tabs/Subvencion'
import Sostenedores from './tabs/Sostenedores'
import Remuneraciones from './tabs/Remuneraciones'
import EstadoResultado from './tabs/EstadoResultado'
import EficienciaGasto from './tabs/EficienciaGasto'
import SostenibilidadRiesgo from './tabs/SostenibilidadRiesgo'
import RiesgoEstructural from './tabs/RiesgoEstructural'
import Usuarios from './tabs/Usuarios'
import FichaSostenedor from './tabs/FichaSostenedor'
import SubvencionSostenedor from './tabs/SubvencionSostenedor'

const NAV_ITEMS = [
  { path: '/', label: 'Resumen', icon: '📊', roles: ['admin', 'viewer'] },
  { path: '/tendencia', label: 'Tendencia', icon: '📈', roles: ['admin', 'viewer'] },
  { path: '/subvencion', label: 'Subvenciones', icon: '🏫', roles: ['admin', 'viewer'] },
  { path: '/sostenedores', label: 'Sostenedores', icon: '🏢', roles: ['admin', 'viewer'] },
  { path: '/eficiencia-gasto', label: 'Eficiencia del Gasto', icon: '⚙️', roles: ['admin', 'viewer'] },
  { path: '/sostenibilidad-riesgo', label: 'Sostenibilidad y Riesgo', icon: '🛡️', roles: ['admin', 'viewer'] },
  { path: '/riesgo-estructural', label: 'Riesgo Estructural', icon: '🏗️', roles: ['admin', 'viewer'] },
  { path: '/remuneraciones', label: 'Remuneraciones', icon: '💰', roles: ['admin'] },
  { path: '/estado-resultado', label: 'Estado Resultado', icon: '📋', roles: ['admin'] },
  { path: '/usuarios', label: 'Usuarios', icon: '👥', roles: ['admin'] },
  { path: '/mi-ficha', label: 'Mi Ficha', icon: '🏛️', roles: ['sostenedor'] },
  { path: '/mi-ficha/financiero', label: 'Financiero', icon: '💵', roles: ['sostenedor'] },
  { path: '/mi-ficha/eficiencia', label: 'Eficiencia del Gasto', icon: '⚙️', roles: ['sostenedor'] },
  { path: '/mi-ficha/sostenibilidad', label: 'Sostenibilidad', icon: '🛡️', roles: ['sostenedor'] },
  { path: '/mi-ficha/riesgo', label: 'Riesgo', icon: '📊', roles: ['sostenedor'] },
  { path: '/mi-subvencion', label: 'Subvenciones', icon: '🏫', roles: ['sostenedor'] },
]

export default function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const handleLogout = () => { logout(); navigate('/login') }
  const visibleNav = NAV_ITEMS.filter(n => n.roles.includes(user?.role))

  return (
    <div className={`dashboard-layout ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" rx="10" fill="url(#g2)" />
              <path d="M12 34L24 14L36 34H12Z" fill="white" opacity="0.9" />
              <defs><linearGradient id="g2" x1="0" y1="0" x2="48" y2="48"><stop stopColor="#6366f1"/><stop offset="1" stopColor="#8b5cf6"/></linearGradient></defs>
            </svg>
          </div>
          {sidebarOpen && <span className="sidebar-title">PIRGEFSE</span>}
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(o => !o)}>
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        <nav className="sidebar-nav">
          {visibleNav.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              title={item.label}
            >
              <span className="nav-icon">{item.icon}</span>
              {sidebarOpen && <span className="nav-label">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{user?.username?.[0]?.toUpperCase()}</div>
            {sidebarOpen && (
              <div className="user-details">
                <span className="user-name">{user?.username}</span>
                <span className={`user-role role-${user?.role}`}>{user?.role}</span>
              </div>
            )}
          </div>
          <button className="btn-logout" onClick={handleLogout} title="Cerrar sesión">
            {sidebarOpen ? 'Salir' : '⏻'}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content">
        <div className="page-wrapper">
          <Routes>
            <Route path="/" element={user?.role === 'sostenedor' ? <Navigate to="/mi-ficha" replace /> : <Resumen />} />
            <Route path="/tendencia" element={<Tendencia />} />
            <Route path="/subvencion" element={<Subvencion />} />
            <Route path="/sostenedores" element={<Sostenedores />} />
            <Route path="/eficiencia-gasto" element={<EficienciaGasto />} />
            <Route path="/sostenibilidad-riesgo" element={<SostenibilidadRiesgo />} />
            <Route path="/riesgo-estructural" element={<RiesgoEstructural />} />
            {user?.role === 'admin' && (
              <>
                <Route path="/remuneraciones" element={<Remuneraciones />} />
                <Route path="/estado-resultado" element={<EstadoResultado />} />
                <Route path="/usuarios" element={<Usuarios />} />
              </>
            )}
            {user?.role === 'sostenedor' && (
              <>
                <Route path="/mi-ficha" element={<FichaSostenedor section="perfil" />} />
                <Route path="/mi-ficha/financiero" element={<FichaSostenedor section="financiero" />} />
                <Route path="/mi-ficha/eficiencia" element={<FichaSostenedor section="eficiencia" />} />
                <Route path="/mi-ficha/sostenibilidad" element={<FichaSostenedor section="sostenibilidad" />} />
                <Route path="/mi-ficha/riesgo" element={<FichaSostenedor section="riesgo" />} />
                <Route path="/mi-subvencion" element={<SubvencionSostenedor />} />
              </>
            )}
          </Routes>
        </div>
      </main>
    </div>
  )
}
