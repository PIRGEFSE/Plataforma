import { useTheme } from '../hooks/useTheme'

const MoonIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
)

const SunIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1"  x2="12" y2="3"  stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="4.22"  y1="4.22"  x2="5.64"  y2="5.64"  stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="1"  y1="12" x2="3"  y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="21" y1="12" x2="23" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="4.22"  y1="19.78" x2="5.64"  y2="18.36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="18.36" y1="5.64"  x2="19.78" y2="4.22"  stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
)

/**
 * variant="fixed"   → posición fija esquina superior derecha (Login)
 * variant="sidebar" → inline dentro del sidebar-footer (Dashboard)
 *   collapsed        → cuando el sidebar está contraído, muestra solo el ícono
 */
export default function ThemeToggle({ variant = 'fixed', collapsed = false }) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  const label  = isDark ? 'Oscuro' : 'Claro'
  const title  = isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'

  if (variant === 'sidebar') {
    return (
      <button
        className={`theme-toggle-sidebar${collapsed ? ' theme-toggle-sidebar--collapsed' : ''}`}
        onClick={toggleTheme}
        title={title}
        aria-label={title}
        id="theme-toggle-btn"
      >
        <span className="theme-toggle-track">
          <span className="theme-toggle-thumb">
            {isDark ? <MoonIcon /> : <SunIcon />}
          </span>
        </span>
        {!collapsed && (
          <span className="theme-toggle-label">{label}</span>
        )}
      </button>
    )
  }

  // variant="fixed" — Login
  return (
    <button
      className="theme-toggle"
      onClick={toggleTheme}
      title={title}
      aria-label={title}
      id="theme-toggle-btn"
    >
      <span className="theme-toggle-track">
        <span className="theme-toggle-thumb">
          {isDark ? <MoonIcon /> : <SunIcon />}
        </span>
      </span>
      <span className="theme-toggle-label">{label}</span>
    </button>
  )
}
