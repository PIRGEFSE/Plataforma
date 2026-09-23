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
import GeoEstablecimiento from './tabs/GeoEstablecimiento'

const NAV_ITEMS = [
  { path: '/vision-global', label: 'Visión Global', icon: '🌍', roles: ['admin'] },
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
  { path: '/mi-ficha', label: 'Mis Establecimientos', icon: '🏛️', roles: ['sostenedor'] },
  { path: '/mi-ficha/educativo-financiero', label: 'Educativo - Financiero', icon: '📊', roles: ['sostenedor'] },
  { path: '/mi-ficha/eficiencia', label: 'Eficiencia del Gasto', icon: '⚙️', roles: ['sostenedor'] },
  { path: '/mi-ficha/sostenibilidad-riesgo', label: 'Sostenibilidad y Riesgo', icon: '🛡️', roles: ['sostenedor'] },
  { path: '/mi-ficha/comportamiento-financiero', label: 'Comportamiento Financiero', icon: '📈', roles: ['sostenedor'] },
  { path: '/mi-ficha/territorio', label: 'Territorio', icon: '🗺️', roles: ['sostenedor'] },
  { path: '/mi-ficha/convivencia', label: 'Convivencia Escolar', icon: '🤝', roles: ['sostenedor'] },
  { path: '/mi-subvencion', label: 'Subvenciones', icon: '🏫', roles: ['sostenedor'], hiddenForUsers: ['sostenedor'] },
  { path: '/mi-establecimiento', label: 'Mi Establecimiento', icon: '🏫', roles: ['establecimiento'] },
  { path: '/mi-establecimiento/financiero', label: 'Financiero', icon: '💵', roles: ['establecimiento'] },
  { path: '/mi-establecimiento/eficiencia', label: 'Eficiencia del Gasto', icon: '⚙️', roles: ['establecimiento'] },
  { path: '/mi-establecimiento/riesgo', label: 'Riesgo', icon: '📊', roles: ['establecimiento'] },
  { path: '/mi-establecimiento/subvencion', label: 'Subvenciones', icon: '🏷️', roles: ['establecimiento'] },
  { path: '/mi-establecimiento/sned-grupo', label: 'Grupo Homogéneo SNED', icon: '🏆', roles: ['establecimiento'] },
]

const SOSTENEDOR_NAV_GROUPS = [
  {
    path: '/mi-ficha/geo-establecimiento',
    label: 'Visión Global',
    icon: '🌍',
    exact: true,
  },
  {
    path: '/mi-ficha/resumen',
    label: 'Resumen',
    icon: '🗂️',
    exact: true,
  },
  {
    path: '/mi-ficha',
    label: 'Mis Establecimientos',
    icon: '🏛️',
    exact: true,
  },
  {
    path: '/mi-ficha/territorio',
    label: '1. Complejidad Educativa',
    icon: '🧩',
    lsKey: 'pirgefse-fichasost-territorio',
    lsVal: 'complejidad',
    isDefault: true
  },
  {
    path: '/mi-ficha/eficiencia',
    label: '2. Costo por Alumno Educativo',
    icon: '🎓',
    lsKey: 'pirgefse-fichasost-eficiencia',
    lsVal: 'costo'
  },
  {
    path: '/mi-ficha/territorio',
    label: '3. Gasto Educativo',
    icon: '💰',
    lsKey: 'pirgefse-fichasost-territorio',
    lsVal: 'gasto'
  },
  {
    path: '/mi-ficha/eficiencia',
    label: '4. Gasto Administrativo',
    icon: '💼',
    lsKey: 'pirgefse-fichasost-eficiencia',
    lsVal: 'administrativo'
  },
  {
    path: '/mi-ficha/sostenibilidad-riesgo',
    label: '5. Variación interanual de ingresos',
    icon: '🛡️',
    lsKey: 'pirgefse-fichasost-sostenibilidad-riesgo',
    lsVal: 'sostenibilidad'
  },
  {
    path: '/mi-ficha/sostenibilidad-riesgo',
    label: '6. Acreditación de Saldos',
    icon: '📊',
    lsKey: 'pirgefse-fichasost-sostenibilidad-riesgo',
    lsVal: 'acreditacion',
    isDefault: true
  },
  {
    path: '/mi-ficha/comportamiento-financiero',
    label: '7. Análisis Rendición',
    icon: '📋',
    lsKey: 'pirgefse-fichasost-comportamiento',
    lsVal: 'analisis_rendicion'
  },
  {
    path: '/mi-ficha/comportamiento-financiero',
    label: '8. Proyección Saldos Iniciales',
    icon: '🔮',
    lsKey: 'pirgefse-fichasost-comportamiento',
    lsVal: 'proyeccion_saldos'
  },
  {
    path: '/mi-ficha/comportamiento-financiero',
    label: '9. Gastos Rem. sobre Ingreso Dep.',
    icon: '📉',
    lsKey: 'pirgefse-fichasost-comportamiento',
    lsVal: 'gasto_rem',
    isDefault: true
  },
  {
    path: '/mi-ficha/eficiencia',
    label: '10. Innovación Pedagógica',
    icon: '💡',
    lsKey: 'pirgefse-fichasost-eficiencia',
    lsVal: 'innovacion',
    isDefault: true
  },
  {
    path: '/mi-ficha/sostenibilidad-riesgo',
    label: '11. HHI Fuentes de Ingreso',
    icon: '💰',
    lsKey: 'pirgefse-fichasost-sostenibilidad-riesgo',
    lsVal: 'hhi'
  },
  {
    path: '/mi-ficha/educativo-financiero',
    label: '12. SNED',
    icon: '🏆',
    lsKey: 'pirgefse-fichasost-educativo-financiero',
    lsVal: 'sned'
  },
  {
    path: '/mi-ficha/eficiencia',
    label: '13. Dotación Docente',
    icon: '🧑‍🏫',
    lsKey: 'pirgefse-fichasost-eficiencia',
    lsVal: 'dotacion'
  },
  {
    path: '/mi-ficha/sostenibilidad-riesgo',
    label: 'HHI Proveedores',
    icon: '🏪',
    lsKey: 'pirgefse-fichasost-sostenibilidad-riesgo',
    lsVal: 'hhi_proveedores'
  },
  {
    path: '/mi-ficha/educativo-financiero',
    label: 'Ingreso - Gasto',
    icon: '💵',
    lsKey: 'pirgefse-fichasost-educativo-financiero',
    lsVal: 'ingreso_gasto',
    isDefault: true
  },
  {
    path: '/mi-ficha/convivencia',
    label: 'Convivencia Escolar',
    icon: '🤝',
    exact: true,
  },
  {
    path: '/mi-ficha/simce',
    label: 'SIMCE',
    icon: '📝',
    exact: true,
  },
]

// Estructura jerárquica de navegación para el rol establecimiento
const ESTABLECIMIENTO_NAV_GROUPS = [
  {
    path: '/mi-establecimiento/resumen',
    label: 'Resumen',
    icon: '🗂️',
    exact: true,
    children: [],
  },
  {
    path: '/mi-establecimiento',
    label: 'Mi Establecimiento',
    icon: '🏫',
    exact: true,
    children: [],
  },
  {
    path: '/mi-establecimiento/financiero',
    label: 'Educativo - Financiero',
    icon: '📊',
    exact: true,
    children: [
      { label: 'Ingreso vs Gasto', icon: '💵', lsKey: 'pirgefse-ee-financiero', lsVal: 'ingreso_gasto' },
      { label: '12. SNED',             icon: '🏆', lsKey: 'pirgefse-ee-financiero', lsVal: 'sned' },
    ],
  },
  {
    path: '/mi-establecimiento/eficiencia',
    label: 'Eficiencia del Gasto',
    icon: '⚙️',
    exact: true,
    children: [
      { label: 'Distribución del Gasto', icon: '📊', lsKey: 'pirgefse-ee-eficiencia', lsVal: 'distribucion' },
    ],
  },
  {
    path: '/mi-establecimiento/riesgo',
    label: 'Riesgo',
    icon: '📊',
    exact: true,
    children: [
      { label: '6. Acreditación de Saldos', icon: '🛡️', lsKey: 'pirgefse-ee-riesgo', lsVal: 'acreditacion' },
    ],
  },
  {
    path: '/mi-establecimiento/subvencion',
    label: 'Subvenciones',
    icon: '🏷️',
    exact: true,
    children: [
      { label: 'Composición', icon: '🥧', lsKey: 'pirgefse-ee-subvencion', lsVal: 'composicion' },
    ],
  },
  {
    path: '/mi-establecimiento/sned-grupo',
    label: 'Grupo Homogéneo SNED',
    icon: '🏆',
    exact: true,
    children: [
      { label: 'KPIs del Grupo',               icon: '🏆', lsKey: 'pirgefse-ee-sned', lsVal: 'kpis' },
      { label: 'Establecimientos del Grupo',   icon: '📋', lsKey: 'pirgefse-ee-sned', lsVal: 'tabla' },
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

  const [localVal, setLocalVal] = useState(() => {
    try { return group.lsKey ? localStorage.getItem(group.lsKey) : null } catch { return null }
  })

  // Auto-expandir al navegar hacia este grupo
  useEffect(() => {
    if (isActive && hasChildren) setExpanded(true)
  }, [isActive, hasChildren])

  useEffect(() => {
    localStorage.setItem(storageKey, String(expanded))
  }, [expanded, storageKey])

  useEffect(() => {
    if (!group.lsKey) return
    const handler = (e) => {
      if (e.detail.key === group.lsKey) {
        setLocalVal(e.detail.val)
      }
    }
    window.addEventListener('pirgefse-subtab', handler)
    return () => window.removeEventListener('pirgefse-subtab', handler)
  }, [group.lsKey])

  const handleGroupClick = () => {
    if (group.lsKey) {
      localStorage.setItem(group.lsKey, group.lsVal)
      window.dispatchEvent(new CustomEvent('pirgefse-subtab', {
        detail: { key: group.lsKey, val: group.lsVal }
      }))
    }

    if (isActive) {
      if (hasChildren && sidebarOpen) setExpanded(e => !e)
    } else {
      if (hasChildren && sidebarOpen) setExpanded(true)
    }
    navigate(group.path)
  }

  const handleChildClick = (child) => {
    if (child.lsKey) {
      localStorage.setItem(child.lsKey, child.lsVal)
      window.dispatchEvent(new CustomEvent('pirgefse-subtab', {
        detail: { key: child.lsKey, val: child.lsVal }
      }))
    }
    navigate(group.path)
  }

  const activeSubVal = (lsKey) => {
    try { return localStorage.getItem(lsKey) } catch { return null }
  }

  const isActiveMatch = !group.lsKey || localVal === group.lsVal || (localVal === null && group.isDefault)
  const isGroupActive = isActive && isActiveMatch

  return (
    <div className={hasChildren ? "nav-group" : ""}>
      <button
        className={`nav-group-header${(!hasChildren && isGroupActive) ? ' active' : ''}`}
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
              const isActive = group.exact
                ? location.pathname === group.path
                : location.pathname === group.path || location.pathname.startsWith(group.path + '/')
              
              const uniqueKey = group.lsVal ? `${group.path}-${group.lsVal}` : group.path;
              return (
                <NavGroup
                  key={uniqueKey}
                  group={group}
                  sidebarOpen={sidebarOpen}
                  navigate={navigate}
                  isActive={isActive}
                  currentPath={location.pathname}
                />
              )
            })
          ) : user?.role === 'establecimiento' ? (
            ESTABLECIMIENTO_NAV_GROUPS.map(group => {
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

      {/* Theme Switch (Top Right) */}
      <ThemeToggle variant="switch" />

      {/* Main content */}
      <main className="main-content">
        <div className="page-wrapper">
          <Routes>
            <Route path="/" element={user?.role === 'sostenedor' ? <Navigate to="/mi-ficha/resumen" replace /> : user?.role === 'establecimiento' ? <Navigate to="/mi-establecimiento" replace /> : <Resumen />} />
            <Route path="/tendencia" element={<Tendencia />} />
            <Route path="/subvencion" element={<Subvencion />} />
            <Route path="/sostenedores" element={<Sostenedores />} />
            <Route path="/eficiencia-gasto" element={<EficienciaGasto />} />
            <Route path="/sostenibilidad-riesgo" element={<SostenibilidadRiesgo />} />
            <Route path="/riesgo-estructural" element={<RiesgoEstructural />} />
            {user?.role === 'admin' && (
              <>
                <Route path="/vision-global" element={<GeoEstablecimiento />} />
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
                <Route path="/mi-ficha/presupuesto" element={<FichaSostenedor section="presupuesto" />} />
                <Route path="/mi-ficha/geo-establecimiento" element={<FichaSostenedor section="geo_establecimiento" />} />
                <Route path="/mi-ficha/convivencia" element={<FichaSostenedor section="convivencia" />} />

                <Route path="/mi-ficha/simce" element={<FichaSostenedor section="simce" />} />
                <Route path="/mi-subvencion" element={<SubvencionSostenedor />} />
              </>
            )}
            {user?.role === 'establecimiento' && (
              <>
                <Route path="/mi-establecimiento" element={<FichaEstablecimiento section="perfil" />} />
                <Route path="/mi-establecimiento/resumen" element={<FichaEstablecimiento section="resumen" />} />
                <Route path="/mi-establecimiento/financiero" element={<FichaEstablecimiento section="financiero" />} />
                <Route path="/mi-establecimiento/eficiencia" element={<FichaEstablecimiento section="eficiencia" />} />
                <Route path="/mi-establecimiento/riesgo" element={<FichaEstablecimiento section="riesgo" />} />
                <Route path="/mi-establecimiento/subvencion" element={<FichaEstablecimiento section="subvencion" />} />
                <Route path="/mi-establecimiento/sned-grupo" element={<FichaEstablecimiento section="sned_grupo" />} />
              </>
            )}
          </Routes>
        </div>
      </main>
    </div>
  )
}
