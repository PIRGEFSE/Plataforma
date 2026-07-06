import { useState, useEffect } from 'react'
import { Routes, Route, NavLink, useNavigate, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import ThemeToggle from '../components/ThemeToggle'
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
import FichaEstablecimiento from './tabs/FichaEstablecimiento'

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
  { path: '/mi-ficha/educativo-financiero', label: 'Educativo - Financiero', icon: '📊', roles: ['sostenedor'] },
  { path: '/mi-ficha/eficiencia', label: 'Eficiencia del Gasto', icon: '⚙️', roles: ['sostenedor'] },
  { path: '/mi-ficha/sostenibilidad-riesgo', label: 'Sostenibilidad y Riesgo', icon: '🛡️', roles: ['sostenedor'] },
  { path: '/mi-ficha/comportamiento-financiero', label: 'Comportamiento Financiero', icon: '📈', roles: ['sostenedor'] },
  { path: '/mi-ficha/territorio', label: 'Territorio', icon: '🗺️', roles: ['sostenedor'] },
  { path: '/mi-subvencion', label: 'Subvenciones', icon: '🏫', roles: ['sostenedor'], hiddenForUsers: ['sostenedor'] },
  { path: '/mi-establecimiento', label: 'Mi Establecimiento', icon: '🏫', roles: ['establecimiento'] },
  { path: '/mi-establecimiento/financiero', label: 'Financiero', icon: '💵', roles: ['establecimiento'] },
  { path: '/mi-establecimiento/eficiencia', label: 'Eficiencia del Gasto', icon: '⚙️', roles: ['establecimiento'] },
  { path: '/mi-establecimiento/riesgo', label: 'Riesgo', icon: '📊', roles: ['establecimiento'] },
  { path: '/mi-establecimiento/subvencion', label: 'Subvenciones', icon: '🏷️', roles: ['establecimiento'] },
]

// Estructura jerárquica de navegación para el rol sostenedor
const SOSTENEDOR_NAV_GROUPS = [
  {
    path: '/mi-ficha/resumen',
    label: 'Resumen',
    icon: '🗂️',
    exact: true,
    children: [],
  },
  {
    path: '/mi-ficha',
    label: 'Mi Ficha',
    icon: '🏛️',
    exact: true,
    children: [],
  },
  {
    path: '/mi-ficha/educativo-financiero',
    label: 'Educativo - Financiero',
    icon: '📊',
    children: [
      { label: 'Ingreso - Gasto', icon: '💵', lsKey: 'pirgefse-fichasost-educativo-financiero', lsVal: 'ingreso_gasto' },
    ],
  },
  {
    path: '/mi-ficha/eficiencia',
    label: 'Eficiencia del Gasto',
    icon: '⚙️',
    children: [
      { label: 'Innovación Pedagógica',      icon: '💡', lsKey: 'pirgefse-fichasost-eficiencia', lsVal: 'innovacion' },
      { label: 'Costo por Alumno Educativo', icon: '🎓', lsKey: 'pirgefse-fichasost-eficiencia', lsVal: 'costo' },
      { label: 'Gasto Administrativo',       icon: '💼', lsKey: 'pirgefse-fichasost-eficiencia', lsVal: 'administrativo' },
    ],
  },
  {
    path: '/mi-ficha/sostenibilidad-riesgo',
    label: 'Sostenibilidad y Riesgo',
    icon: '🛡️',
    children: [
      { label: 'Acreditación de Saldos',       icon: '📊', lsKey: 'pirgefse-fichasost-sostenibilidad-riesgo', lsVal: 'acreditacion' },
      { label: 'Sostenibilidad Rem./Ingreso',   icon: '🛡️', lsKey: 'pirgefse-fichasost-sostenibilidad-riesgo', lsVal: 'sostenibilidad' },
      { label: 'HHI Fuentes de Ingreso',        icon: '💰', lsKey: 'pirgefse-fichasost-sostenibilidad-riesgo', lsVal: 'hhi' },
    ],
  },
  {
    path: '/mi-ficha/comportamiento-financiero',
    label: 'Comportamiento Financiero',
    icon: '📈',
    children: [
      { label: 'Gastos Rem. sobre Ingreso Dep.', icon: '📉', lsKey: 'pirgefse-fichasost-comportamiento', lsVal: 'gasto_rem' },
      { label: 'Análisis Rendición',             icon: '📋', lsKey: 'pirgefse-fichasost-comportamiento', lsVal: 'analisis_rendicion' },
    ],
  },
  {
    path: '/mi-ficha/territorio',
    label: 'Territorio',
    icon: '🗺️',
    children: [
      { label: 'Complejidad Educativa', icon: '🧩', lsKey: 'pirgefse-fichasost-territorio', lsVal: 'complejidad' },
      { label: 'Gasto Educativo',       icon: '💰', lsKey: 'pirgefse-fichasost-territorio', lsVal: 'gasto' },
    ],
  },
]

// Componente de grupo de navegación colapsable para sostenedor
function NavGroup({ group, sidebarOpen, navigate, isActive, currentPath }) {
  const storageKey = `pirgefse-navgroup-open${group.path.replace(/\//g, '-')}`
  const hasChildren = group.children && group.children.length > 0

  const [expanded, setExpanded] = useState(() => {
    const saved = localStorage.getItem(storageKey)
    return saved !== null ? saved === 'true' : (hasChildren && currentPath.startsWith(group.path))
  })

  // Auto-expandir al navegar hacia este grupo
  useEffect(() => {
    if (isActive && hasChildren) setExpanded(true)
  }, [isActive]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    localStorage.setItem(storageKey, String(expanded))
  }, [expanded, storageKey])

  const handleGroupClick = () => {
    if (hasChildren && sidebarOpen) setExpanded(e => !e)
    navigate(group.path)
  }

  const handleChildClick = (child) => {
    if (child.lsKey) {
      localStorage.setItem(child.lsKey, child.lsVal)
      // Notificar al componente montado para que cambie su sub-tab sin re-montar
      window.dispatchEvent(new CustomEvent('pirgefse-subtab', {
        detail: { key: child.lsKey, val: child.lsVal }
      }))
    }
    navigate(group.path)
  }

  const activeSubVal = (lsKey) => {
    try { return localStorage.getItem(lsKey) } catch { return null }
  }

  return (
    <div className="nav-group">
      <button
        className={`nav-group-header${isActive ? ' active' : ''}`}
        onClick={handleGroupClick}
        title={group.label}
      >
        <span className="nav-icon">{group.icon}</span>
        {sidebarOpen && (
          <>
            <span className="nav-label">{group.label}</span>
            {hasChildren && (
              <span
                className="nav-group-chevron"
                style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
              >
                ›
              </span>
            )}
          </>
        )}
      </button>

      {hasChildren && expanded && sidebarOpen && (
        <div className="nav-group-children">
          {group.children.map((child) => {
            const isChildActive = isActive && activeSubVal(child.lsKey) === child.lsVal
            return (
              <button
                key={child.lsVal}
                className={`nav-subitem${isChildActive ? ' active' : ''}`}
                onClick={() => handleChildClick(child)}
                title={child.label}
              >
                <span className="nav-subitem-icon">{child.icon}</span>
                <span className="nav-subitem-label">{child.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(() => localStorage.getItem('pirgefse-sidebar') !== 'closed')

  useEffect(() => {
    localStorage.setItem('pirgefse-sidebar', sidebarOpen ? 'open' : 'closed')
  }, [sidebarOpen])

  const handleLogout = () => { logout(); navigate('/login') }
  const visibleNav = NAV_ITEMS.filter(n =>
    n.roles.includes(user?.role) &&
    !(n.hiddenForUsers && n.hiddenForUsers.includes(user?.username))
  )

  return (
    <div className={`dashboard-layout ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" rx="10" fill="url(#g2)" />
              <path d="M12 34L24 14L36 34H12Z" fill="white" opacity="0.9" />
              <defs>
                <linearGradient id="g2" x1="0" y1="0" x2="48" y2="48">
                  <stop stopColor="#6366f1"/>
                  <stop offset="1" stopColor="#8b5cf6"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          {sidebarOpen && <span className="sidebar-title">PIRGEFSE</span>}
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(o => !o)}>
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        <nav className="sidebar-nav">
          {user?.role === 'sostenedor' ? (
            SOSTENEDOR_NAV_GROUPS.map(group => {
              // Calcular isActive en el padre donde location siempre es reactivo
              const isActive = group.exact
                ? location.pathname === group.path
                : location.pathname === group.path || location.pathname.startsWith(group.path + '/')
              return (
                <NavGroup
                  key={group.path}
                  group={group}
                  sidebarOpen={sidebarOpen}
                  navigate={navigate}
                  isActive={isActive}
                  currentPath={location.pathname}
                />
              )
            })
          ) : (
            visibleNav.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/' || visibleNav.some(other => other.path !== item.path && other.path.startsWith(item.path + '/'))}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                title={item.label}
              >
                <span className="nav-icon">{item.icon}</span>
                {sidebarOpen && <span className="nav-label">{item.label}</span>}
              </NavLink>
            ))
          )}
        </nav>

        <div className="sidebar-footer">
          <ThemeToggle variant="sidebar" collapsed={!sidebarOpen} />
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
            <Route path="/" element={user?.role === 'sostenedor' ? <Navigate to="/mi-ficha" replace /> : user?.role === 'establecimiento' ? <Navigate to="/mi-establecimiento" replace /> : <Resumen />} />
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
                <Route path="/mi-ficha/resumen" element={<FichaSostenedor section="resumen" />} />
                <Route path="/mi-ficha/educativo-financiero" element={<FichaSostenedor section="educativo_financiero" />} />
                <Route path="/mi-ficha/eficiencia" element={<FichaSostenedor section="eficiencia" />} />
                <Route path="/mi-ficha/sostenibilidad-riesgo" element={<FichaSostenedor section="sostenibilidad_riesgo" />} />
                <Route path="/mi-ficha/comportamiento-financiero" element={<FichaSostenedor section="comportamiento_financiero" />} />
                <Route path="/mi-ficha/territorio" element={<FichaSostenedor section="territorio" />} />
                <Route path="/mi-subvencion" element={<SubvencionSostenedor />} />
              </>
            )}
            {user?.role === 'establecimiento' && (
              <>
                <Route path="/mi-establecimiento" element={<FichaEstablecimiento section="perfil" />} />
                <Route path="/mi-establecimiento/financiero" element={<FichaEstablecimiento section="financiero" />} />
                <Route path="/mi-establecimiento/eficiencia" element={<FichaEstablecimiento section="eficiencia" />} />
                <Route path="/mi-establecimiento/riesgo" element={<FichaEstablecimiento section="riesgo" />} />
                <Route path="/mi-establecimiento/subvencion" element={<FichaEstablecimiento section="subvencion" />} />
              </>
            )}
          </Routes>
        </div>
      </main>
    </div>
  )
}
