import { useEffect, useState, useRef, useCallback, createContext, useContext } from 'react'
import ReactECharts from 'echarts-for-react'
import api from '../../lib/api'
import { useChartColors } from '../../hooks/useChartColors'
import { useAuth } from '../../hooks/useAuth'
import { fmtMM, fmtMonedaCorto, fmtN } from '../../lib/format'
import GastoRemIngresoEstablecimiento from './GastoRemIngresoEstablecimiento'
import AnalisisRendicion from './AnalisisRendicion'
import SNEDSostenedor from './SNEDSostenedor'
import SqlViewer from '../../components/SqlViewer'

// ── Catálogo de Widgets fijables al Resumen ────────────────────────────────────
export const SOSTENEDOR_WIDGETS = [
  // Educativo - Financiero
  { key: 'ef_ingreso_gasto', label: 'Ingreso vs Gasto por EE', section: 'educativo_financiero', icon: '💵', color: '#10b981', grupo: 'Educativo - Financiero' },
  { key: 'ef_superavit', label: 'Superávit / Déficit por EE', section: 'educativo_financiero', icon: '⚖️', color: '#6366f1', grupo: 'Educativo - Financiero' },
  { key: 'ef_sned', label: 'Análisis SNED', section: 'educativo_financiero', icon: '🏆', color: '#8b5cf6', grupo: 'Educativo - Financiero' },
  // Eficiencia del Gasto
  { key: 'eg_distribucion_gasto', label: 'Distribución del Gasto (%)', section: 'eficiencia', icon: '📊', color: '#3b82f6', grupo: 'Eficiencia del Gasto' },
  { key: 'eg_nivel_admin', label: 'Nivel Gasto Administrativo', section: 'eficiencia', icon: '💼', color: '#ef4444', grupo: 'Eficiencia del Gasto' },
  { key: 'eg_costo_alumno_kpis', label: 'KPIs Costo por Alumno', section: 'eficiencia', icon: '🎓', color: '#10b981', grupo: 'Eficiencia del Gasto' },
  { key: 'eg_costo_alumno_tabla', label: 'Tabla Costo por Alumno', section: 'eficiencia', icon: '📋', color: '#06b6d4', grupo: 'Eficiencia del Gasto' },
  { key: 'eg_costo_alumno_graficos', label: 'Gráficos Costo por Alumno', section: 'eficiencia', icon: '📈', color: '#f59e0b', grupo: 'Eficiencia del Gasto' },
  { key: 'eg_gasto_adm_kpis', label: 'KPIs Gasto Administrativo', section: 'eficiencia', icon: '💼', color: '#8b5cf6', grupo: 'Eficiencia del Gasto' },
  { key: 'eg_gasto_adm_tabla', label: 'Tabla Gasto Adm. por RBD', section: 'eficiencia', icon: '📋', color: '#ec4899', grupo: 'Eficiencia del Gasto' },
  { key: 'eg_gasto_adm_graficos', label: 'Gráficos Gasto Administrativo', section: 'eficiencia', icon: '📊', color: '#f97316', grupo: 'Eficiencia del Gasto' },
  // Sostenibilidad y Riesgo — Acreditación de Saldos
  { key: 'sr_acreditacion_grafico', label: 'Acreditación — Gráfico % Rendido', section: 'sostenibilidad_riesgo', icon: '📊', color: '#6366f1', grupo: 'Sostenibilidad y Riesgo' },
  { key: 'sr_acreditacion_monto', label: 'Acreditación — Top Monto No Rendido', section: 'sostenibilidad_riesgo', icon: '💸', color: '#ef4444', grupo: 'Sostenibilidad y Riesgo' },
  // Sostenibilidad y Riesgo — Sostenibilidad Rem./Ingreso
  { key: 'sr_sostenibilidad_ratio', label: 'Ratio Remuneraciones / Ingresos', section: 'sostenibilidad_riesgo', icon: '🛡️', color: '#f59e0b', grupo: 'Sostenibilidad y Riesgo' },
  { key: 'sr_sostenibilidad_scatter', label: 'Funcionarios vs Ingresos (Scatter)', section: 'sostenibilidad_riesgo', icon: '🔵', color: '#22d3ee', grupo: 'Sostenibilidad y Riesgo' },
  // Sostenibilidad y Riesgo — HHI
  { key: 'sr_hhi_graficos', label: 'HHI — Distribución y Evolución', section: 'sostenibilidad_riesgo', icon: '💰', color: '#ef4444', grupo: 'Sostenibilidad y Riesgo' },
  { key: 'sr_hhi_fuentes', label: 'HHI — Composición Fuentes de Ingreso', section: 'sostenibilidad_riesgo', icon: '📋', color: '#8b5cf6', grupo: 'Sostenibilidad y Riesgo' },
  { key: 'sr_hhi_detalle', label: 'HHI — Serie Temporal por Período', section: 'sostenibilidad_riesgo', icon: '📈', color: '#f97316', grupo: 'Sostenibilidad y Riesgo' },
  // Comportamiento Financiero
  { key: 'cf_gasto_rem', label: 'Gastos Rem. sobre Ingreso Dep.', section: 'comportamiento_financiero', icon: '📉', color: '#f59e0b', grupo: 'Comportamiento Financiero' },
  { key: 'cf_analisis_rendicion', label: 'Análisis Rendición', section: 'comportamiento_financiero', icon: '📋', color: '#6366f1', grupo: 'Comportamiento Financiero' },
  // Territorio — Complejidad Educativa
  { key: 'te_complejidad_prioridades', label: 'Complejidad — Distribución Prioridades', section: 'territorio', icon: '📊', color: '#f59e0b', grupo: 'Territorio' },
  { key: 'te_complejidad_scatter', label: 'Complejidad — IVE vs Ingreso', section: 'territorio', icon: '🔵', color: '#3b82f6', grupo: 'Territorio' },
  // Territorio — Gasto Educativo
  { key: 'te_gasto_kpis', label: 'Gasto Educativo — KPIs', section: 'territorio', icon: '💰', color: '#22d3ee', grupo: 'Territorio' },
  { key: 'te_gasto_tabla', label: 'Gasto Educativo — Tabla por Centro', section: 'territorio', icon: '📋', color: '#ec4899', grupo: 'Territorio' },
  { key: 'te_gasto_graficos', label: 'Gasto Educativo — Gráficos', section: 'territorio', icon: '📈', color: '#84cc16', grupo: 'Territorio' },
]

const WIDGET_MAP = Object.fromEntries(SOSTENEDOR_WIDGETS.map(w => [w.key, w]))

// ── Hook: usePinnedWidgets ─────────────────────────────────────────────────────
// Persiste los pins en el servidor (GET/PUT /dashboard/resumen-pins).
// Fallback a localStorage mientras se carga la primera vez.
const LS_KEY = 'pirgefse-resumen-pins-cache'

export function usePinnedWidgets() {
  const [pins, setPins] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') } catch { return [] }
  })
  const [loading, setLoading] = useState(true)
  const saving = useRef(false)

  // Cargar desde servidor al montar
  useEffect(() => {
    api.get('/dashboard/resumen-pins')
      .then(r => {
        const serverPins = r.data.pins || []
        setPins(serverPins)
        localStorage.setItem(LS_KEY, JSON.stringify(serverPins))
      })
      .catch(() => { /* usa caché localStorage */ })
      .finally(() => setLoading(false))
  }, [])

  const togglePin = useCallback(async (key) => {
    setPins(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
      localStorage.setItem(LS_KEY, JSON.stringify(next))
      // Guardar en servidor de forma asíncrona
      if (!saving.current) {
        saving.current = true
        api.put('/dashboard/resumen-pins', { pins: next }).finally(() => { saving.current = false })
      }
      return next
    })
  }, [])

  const isPinned = useCallback((key) => pins.includes(key), [pins])

  return { pins, isPinned, togglePin, loading }
}

// ── Contexto de Pins (compartido en árbol) ────────────────────────────────────
export const PinsCtx = createContext({ pins: [], isPinned: () => false, togglePin: () => { } })
export const usePins = () => useContext(PinsCtx)

// ── Componente WidgetWrapper ─────────────────────────────────────────────────
// Envuelve cualquier bloque de contenido (gráfico, tabla, KPIs) con un header
// que incluye el título del widget y el botón de pin.
export function WidgetWrapper({ widgetKey, children, compact = false }) {
  const { isPinned, togglePin } = usePins()
  const pinned = isPinned(widgetKey)
  const widget = WIDGET_MAP[widgetKey]

  return (
    <div style={{ position: 'relative', marginBottom: compact ? '0' : '1.25rem' }}>
      {/* Pin button flotante */}
      <button
        onClick={() => togglePin(widgetKey)}
        title={pinned ? 'Quitar del Resumen' : 'Agregar al Resumen'}
        style={{
          position: 'absolute',
          top: '0.6rem',
          right: '0.75rem',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: '0.3rem',
          padding: '0.25rem 0.65rem',
          borderRadius: '999px',
          border: pinned
            ? `1.5px solid ${widget?.color ?? '#6366f1'}`
            : '1.5px solid var(--line-subtle)',
          background: pinned ? `${widget?.color ?? '#6366f1'}18` : 'var(--surface-overlay)',
          color: pinned ? (widget?.color ?? '#6366f1') : 'var(--text-muted)',
          fontSize: '0.72rem',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.18s',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ fontSize: '0.85rem' }}>{pinned ? '📌' : '📌'}</span>
        {pinned ? 'En Resumen' : 'Agregar al Resumen'}
      </button>
      {children}
    </div>
  )
}


// ── Constantes ────────────────────────────────────────────────────────────────
const RIESGO_COLORS = {
  'Riesgo Bajo': '#10b981',
  'Riesgo Moderado': '#f59e0b',
  'Riesgo Alto': '#ef4444',
}
const EF_COLORS = { Optimo: '#10b981', Moderado: '#f59e0b', Elevado: '#ef4444' }
const ESTADO_LABELS = { 1: 'Funcionando', 2: 'Receso', 3: 'Cerrado' }
const ESTADO_COLORS = { 1: '#10b981', 2: '#f59e0b', 3: '#64748b' }

// Códigos de enseñanza (COD_ENSE) → { label corto, color }
const ENS_MAP = {
  10: { label: 'Parvularia', color: '#f472b6' },
  110: { label: 'Básica', color: 'var(--accent-text)' },
  160: { label: 'Básica Adultos', color: '#93c5fd' },
  161: { label: 'Básica Esp. Adultos', color: '#93c5fd' },
  163: { label: 'Básica Cárcel', color: 'var(--text-muted)' },
  165: { label: 'Básica Ad. Sin Of.', color: '#93c5fd' },
  167: { label: 'Básica Ad. Con Of.', color: '#93c5fd' },
  211: { label: 'Esp. Auditiva', color: '#a78bfa' },
  212: { label: 'Esp. Intelectual', color: '#a78bfa' },
  213: { label: 'Esp. Visual', color: '#a78bfa' },
  214: { label: 'Esp. Lenguaje', color: '#a78bfa' },
  215: { label: 'Esp. Motora', color: '#a78bfa' },
  216: { label: 'Esp. Autismo', color: '#a78bfa' },
  217: { label: 'Esp. Relación/Com.', color: '#a78bfa' },
  218: { label: 'Esp. Múltiple', color: '#a78bfa' },
  219: { label: 'Esp. Sordoceguera', color: '#a78bfa' },
  299: { label: 'PIE Opción 4', color: '#c084fc' },
  310: { label: 'Media H-C', color: '#34d399' },
  360: { label: 'Media H-C Adultos', color: '#6ee7b7' },
  361: { label: 'Media H-C Ad.', color: '#6ee7b7' },
  362: { label: 'Media H-C Cárcel', color: 'var(--text-muted)' },
  363: { label: 'Media H-C Ad.', color: '#6ee7b7' },
  410: { label: 'TP Comercial', color: '#fb923c' },
  460: { label: 'TP Comercial Ad.', color: '#fed7aa' },
  461: { label: 'TP Comercial Ad.', color: '#fed7aa' },
  463: { label: 'TP Comercial Ad.', color: '#fed7aa' },
  510: { label: 'TP Industrial', color: '#facc15' },
  560: { label: 'TP Industrial Ad.', color: '#fef08a' },
  561: { label: 'TP Industrial Ad.', color: '#fef08a' },
  563: { label: 'TP Industrial Ad.', color: '#fef08a' },
  610: { label: 'TP Técnica', color: '#38bdf8' },
  660: { label: 'TP Técnica Ad.', color: '#bae6fd' },
  661: { label: 'TP Técnica Ad.', color: '#bae6fd' },
  663: { label: 'TP Técnica Ad.', color: '#bae6fd' },
  710: { label: 'TP Agrícola', color: '#86efac' },
  760: { label: 'TP Agrícola Ad.', color: '#bbf7d0' },
  761: { label: 'TP Agrícola Ad.', color: '#bbf7d0' },
  763: { label: 'TP Agrícola Ad.', color: '#bbf7d0' },
  810: { label: 'TP Marítima', color: '#67e8f9' },
  860: { label: 'TP Marítima Ad.', color: '#a5f3fc' },
  863: { label: 'TP Marítima Ad.', color: '#a5f3fc' },
  910: { label: 'Media Artística', color: '#f9a8d4' },
  963: { label: 'Art. Adultos', color: '#fbcfe8' },
}

// Reúne los códigos ENS_01..ENS_11 no nulos/cero y devuelve chips JSX
function getEnsenanzas(ee) {
  const claves = ['ens_01', 'ens_02', 'ens_03', 'ens_04', 'ens_05',
    'ens_06', 'ens_07', 'ens_08', 'ens_09', 'ens_10', 'ens_11']
  const unicos = [...new Set(claves.map(k => Number(ee[k] ?? 0)).filter(c => c > 0))]
  if (unicos.length === 0) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem', maxWidth: 280 }}>
      {unicos.map(cod => {
        const e = ENS_MAP[cod]
        const lbl = e?.label ?? `Cod ${cod}`
        const clr = e?.color ?? 'var(--text-muted)'
        return (
          <span key={cod} title={lbl}
            style={{
              fontSize: '0.65rem', fontWeight: 600, color: '#fff',
              background: clr, borderRadius: 999, padding: '0.1rem 0.4rem',
              whiteSpace: 'nowrap', lineHeight: 1.4
            }}>
            {lbl}
          </span>
        )
      })}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function KPICard({ icon, label, value, color = '#6366f1', sub }) {
  return (
    <div className="kpi-card" style={{ '--accent': color }}>
      <div className="kpi-icon" style={{ background: `${color}20` }}>{icon}</div>
      <div className="kpi-body">
        <div className="kpi-value" style={{ color }}>{value}</div>
        <div className="kpi-label">{label}</div>
        {sub && <div className="kpi-sub">{sub}</div>}
      </div>
    </div>
  )
}

function PeriodoSelector({ periodos, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Año:</span>
      <select className="filter-select" value={value} onChange={e => onChange(Number(e.target.value))} style={{ minWidth: 90 }}>
        {periodos.map(p => <option key={p} value={p}>{p}</option>)}
      </select>
    </div>
  )
}

function UnitSelector({ value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Unidad:</span>
      <select className="filter-select" value={value} onChange={e => onChange(e.target.value)} style={{ minWidth: 80 }}>
        <option value="mM">mM$</option>
        <option value="M">M$</option>
        <option value="$">$</option>
      </select>
    </div>
  )
}

function shortName(nom, rbd) {
  if (!nom) return `RBD ${rbd}`
  return nom.length > 38 ? nom.slice(0, 36) + '…' : nom
}
// tt() removed

// ── Contexto de formato monetario ─────────────────────────────────────────
export const MoneyFmtCtx = createContext({ fmtAmt: fmtMM, fmtAxisAmt: fmtMonedaCorto, unitLabel: 'mM$' })
export const useMoneyFmt = () => useContext(MoneyFmtCtx)

const SECTION_TITLES = {
  perfil: { icon: '🏛️', label: 'Mis Establecimientos' },
  financiero: { icon: '💵', label: 'Financiero — Comparación por Establecimiento' },
  educativo_financiero: { icon: '📊', label: 'Educativo — Financiero por Establecimiento' },
  eficiencia: { icon: '⚙️', label: 'Eficiencia del Gasto — por Establecimiento' },
  sostenibilidad_riesgo: { icon: '🛡️', label: 'Sostenibilidad y Riesgo — por Establecimiento' },
  comportamiento_financiero: { icon: '📈', label: 'Comportamiento Financiero — por Establecimiento' },
  territorio: { icon: '🗺️', label: 'Territorio — IVE por Establecimiento' },
  resumen: { icon: '🗂️', label: 'Resumen Personalizado' },
}

// ── Componente principal ───────────────────────────────────────────────────────
// ── Componente principal ───────────────────────────────────────────────────────
export default function FichaSostenedor({ section = 'perfil' }) {
  const { user } = useAuth()
  const [perfil, setPerfil] = useState(null)
  const [establecimientos, setEstablecimientos] = useState([])
  const [loadingPerfil, setLoadingPerfil] = useState(true)
  const pinsCtx = usePinnedWidgets()

  const [rdbData, setRdbData] = useState(null)
  const [loadingRbd, setLoadingRbd] = useState(false)
  const [territorioData, setTerritorioData] = useState(null)
  const [loadingTerritorio, setLoadingTerritorio] = useState(false)
  const [periodo, setPeriodo] = useState(2024)
  const [periodos, setPeriodos] = useState([2020, 2021, 2022, 2023, 2024])
  const [unitMode, setUnitMode] = useState('mM')

  // Funciones de formato monetario según unidad seleccionada
  const _base = fmtMM
  const _axis = fmtMonedaCorto
  const fmtAmt = (v) => {
    const n = Number(v) || 0
    if (unitMode === 'mM') return _base(n)
    if (unitMode === 'M') {
      const m = n / 1000
      const s = m < 0 ? '−' : ''
      return `${s}${Math.abs(m).toLocaleString('es-CL', { maximumFractionDigits: 1 })} M$`
    }
    const s = n < 0 ? '−' : ''
    return `${s}$${Math.abs(Math.round(n)).toLocaleString('es-CL')}`
  }
  const fmtAxisAmt = (v) => {
    const n = Number(v) || 0
    if (unitMode === 'mM') return _axis(n)
    if (unitMode === 'M') {
      const m = n / 1000
      return Math.abs(m) >= 1000 ? `${(m / 1000).toFixed(1)}MM$` : `${m.toFixed(0)}M$`
    }
    const a = Math.abs(n)
    if (a >= 1e9) return `${(n / 1e9).toFixed(1)}B`
    if (a >= 1e6) return `${(n / 1e6).toFixed(1)}M`
    if (a >= 1e3) return `${(n / 1e3).toFixed(0)}K`
    return `$${Math.round(n).toLocaleString('es-CL')}`
  }
  const unitLabel = unitMode === 'mM' ? 'mM$' : unitMode === 'M' ? 'M$' : '$'

  const sostId = user?.sost_id || 69110400
  const perfilFetched = useRef(false)

  // Carga de perfil + establecimientos (filtra por año)
  useEffect(() => {
    setLoadingPerfil(true)
    api.get(`/dashboard/ficha-sostenedor?sost_id=${sostId}&periodo=${periodo}`)
      .then(r => {
        setPerfil(r.data.perfil)
        setEstablecimientos(r.data.establecimientos)
        // Actualizar períodos disponibles desde la fuente de dimensiones
        if (r.data.periodos_disponibles?.length) {
          setPeriodos(prev => {
            const merged = [...new Set([...r.data.periodos_disponibles, ...prev])].sort((a, b) => b - a)
            return merged
          })
        }
      })
      .finally(() => setLoadingPerfil(false))
  }, [sostId, periodo])

  // Carga detalle por RBD (financiero, eficiencia, etc.)
  const fetchRbd = useCallback((per) => {
    setLoadingRbd(true)
    api.get(`/dashboard/ficha-sostenedor/detalle-rbd?sost_id=${sostId}&periodo=${per}`)
      .then(r => {
        setRdbData(r.data)
        if (r.data.periodos_disponibles?.length) {
          setPeriodos(prev => {
            const merged = [...new Set([...r.data.periodos_disponibles, ...prev])].sort((a, b) => b - a)
            return merged
          })
        }
      })
      .finally(() => setLoadingRbd(false))
  }, [sostId])

  useEffect(() => {
    fetchRbd(periodo)
  }, [periodo, fetchRbd])

  // Carga datos de Territorio (IVE) y también para Resumen (puede tener widgets de territorio)
  useEffect(() => {
    if (section !== 'territorio' && section !== 'resumen') return
    setLoadingTerritorio(true)
    api.get(`/dashboard/ficha-sostenedor/territorio?sost_id=${sostId}&periodo=${periodo}`)
      .then(r => {
        setTerritorioData(r.data)
        if (r.data.periodos_disponibles?.length) {
          setPeriodos(prev => {
            const merged = [...new Set([...r.data.periodos_disponibles, ...prev])].sort((a, b) => b - a)
            return merged
          })
        }
      })
      .finally(() => setLoadingTerritorio(false))
  }, [section, sostId, periodo])

  const sec = SECTION_TITLES[section] ?? SECTION_TITLES.perfil

  if (loadingPerfil || !perfil) return (
    <div className="tab-page">
      <div className="tab-header">
        <div><h2 className="tab-title">{sec.icon} {sec.label}</h2></div>
      </div>
      <div className="loading-area"><div className="spinner" /></div>
    </div>
  )

  return (
    <PinsCtx.Provider value={pinsCtx}>
      <MoneyFmtCtx.Provider value={{ fmtAmt, fmtAxisAmt, unitLabel }}>
        <div className="tab-page">
          {/* ── Header ────────────────────────────────────────────────────────── */}
          <div className="tab-header" style={{ position: 'sticky', top: 0, margin: '-30px -30px 20px -30px', padding: '20px 30px 15px', zIndex: 20, backgroundColor: 'var(--surface-raised)', borderBottom: '1px solid var(--line-subtle)', boxShadow: 'var(--shadow-sm)' }}>
            <div>
              <h2 className="tab-title">{sec.icon} {perfil.nombre_sost}</h2>
              <p className="tab-subtitle">
                {sec.label} · RUT {perfil.rut_sost} · {perfil.nom_com_sost}, Región {perfil.cod_reg_sost}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <PeriodoSelector periodos={periodos} value={periodo} onChange={setPeriodo} />
              <UnitSelector value={unitMode} onChange={setUnitMode} />
              <span style={{ padding: '0.3rem 0.8rem', borderRadius: '999px', background: 'var(--accent-dim)', color: 'var(--accent-text)', border: '1px solid var(--line-strong)', fontSize: '0.78rem', fontWeight: 600 }}>
                🏛️ Municipal DAEM
              </span>
              {/*span style={{ padding: '0.3rem 0.8rem', borderRadius: '999px', background: '#05966922', color: '#34d399', border: '1px solid #059669', fontSize: '0.78rem', fontWeight: 600 }}>
            ✅ Riesgo Bajo
          </span>*/}
            </div>
          </div>

          {/* ── KPIs solo en Mi Ficha ─────────────────────────────────────────── */}
          {section === 'perfil' && (
            <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
              <KPICard icon="🏫" label="Establec. Activos" value={fmtN(perfil.num_rbd)} color="#6366f1" sub={`${fmtN(perfil.num_rbd_tot)} totales`} />
              <KPICard icon="👨‍🎓" label="Matrícula Total" value={fmtN(perfil.mat_total)} color="#10b981" />
              <KPICard icon="📚" label="Cargos Docentes" value={fmtN(perfil.num_c_doc)} color="#f59e0b" />
              <KPICard icon="🤝" label="Cargos Asistentes" value={fmtN(perfil.num_c_asis)} color="#8b5cf6" />
            </div>
          )}

          {/* ── Contenido por sección ─────────────────────────────────────────── */}
          {section === 'perfil' && (
            <TabPerfil perfil={perfil} establecimientos={establecimientos}
              financiero_rbd={rdbData?.financiero_rbd ?? []} loadingRbd={loadingRbd} />
          )}

          {section !== 'perfil' && section !== 'territorio' && section !== 'resumen' && (
            loadingRbd
              ? <div className="loading-area"><div className="spinner" /></div>
              : <>
                {section === 'financiero' && <TabFinanciero rdbData={rdbData} periodo={periodo} />}
                {section === 'educativo_financiero' && <TabEducativoFinanciero rdbData={rdbData} periodo={periodo} sostId={sostId} />}
                {section === 'eficiencia' && <TabEficiencia rdbData={rdbData} periodo={periodo} sostId={sostId} />}
                {section === 'sostenibilidad_riesgo' && <TabSostenibilidadRiesgo rdbData={rdbData} periodo={periodo} sostId={sostId} />}
                {section === 'comportamiento_financiero' && <TabComportamientoFinanciero periodo={periodo} sostId={sostId} />}
              </>
          )}

          {section === 'territorio' && (
            loadingTerritorio
              ? <div className="loading-area"><div className="spinner" /></div>
              : <TabTerritorio data={territorioData} periodo={periodo} sostId={sostId} />
          )}

          {section === 'resumen' && (
            <TabResumenSostenedor
              rdbData={rdbData}
              territorioData={territorioData}
              periodo={periodo}
              sostId={sostId}
              loadingRbd={loadingRbd}
            />
          )}
        </div>
      </MoneyFmtCtx.Provider>
    </PinsCtx.Provider>
  )
}


// ── Tab: Perfil ───────────────────────────────────────────────────────────────
function TabPerfil({ perfil, establecimientos, financiero_rbd = [], loadingRbd }) {
  const { fmtAmt, fmtAxisAmt } = useMoneyFmt()
  const C = useChartColors()
  const [searchTerm, setSearchTerm] = useState('')
  const [ensFilter, setEnsFilter] = useState('')
  const [ruralFilter, setRuralFilter] = useState('all')
  const [pieFilter, setPieFilter] = useState('all')
  const [paceFilter, setPaceFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 10

  const activos = establecimientos.filter(e => e.estado_estab === 1 && e.matricula === 1)
  const sinMat = establecimientos.filter(e => e.estado_estab !== 1 || e.matricula !== 1)

  // Mapa RBD → datos financieros para la tabla
  const finMap = Object.fromEntries(financiero_rbd.map(f => [f.rbd, f]))

  const filterText = searchTerm.toLowerCase()

  const hasEnsenanza = (ee, text) => {
    if (!text) return true
    const claves = ['ens_01', 'ens_02', 'ens_03', 'ens_04', 'ens_05', 'ens_06', 'ens_07', 'ens_08', 'ens_09', 'ens_10', 'ens_11']
    const t = text.toLowerCase()
    return claves.some(k => {
      const cod = Number(ee[k] ?? 0)
      if (cod > 0 && ENS_MAP[cod]) return ENS_MAP[cod].label.toLowerCase().includes(t)
      return false
    })
  }

  const filteredEstablecimientos = establecimientos.filter(ee => {
    const matchName = ee.nom_rbd?.toLowerCase().includes(filterText)
    const matchEns = hasEnsenanza(ee, ensFilter)
    const matchRural = ruralFilter === 'all' ? true : ruralFilter === 'yes' ? !!ee.rural_rbd : !ee.rural_rbd
    const matchPie = pieFilter === 'all' ? true : pieFilter === 'yes' ? !!ee.convenio_pie : !ee.convenio_pie
    const matchPace = paceFilter === 'all' ? true : paceFilter === 'yes' ? !!ee.pace : !ee.pace
    return matchName && matchEns && matchRural && matchPie && matchPace
  })

  const inputStyle = { padding: '0.4rem 0.8rem', backgroundColor: 'var(--surface-overlay)', color: 'var(--text-primary)', border: '1px solid var(--line-subtle)', borderRadius: '0.375rem', fontSize: '0.8rem' };

  const availableEnsLabels = [...new Set(establecimientos.flatMap(ee =>
    ['ens_01', 'ens_02', 'ens_03', 'ens_04', 'ens_05', 'ens_06', 'ens_07', 'ens_08', 'ens_09', 'ens_10', 'ens_11']
      .map(k => Number(ee[k] ?? 0)).filter(c => c > 0 && ENS_MAP[c]).map(c => ENS_MAP[c].label)
  ))].sort()

  const totalPages = Math.ceil(filteredEstablecimientos.length / ITEMS_PER_PAGE)
  const paginatedEstablecimientos = filteredEstablecimientos.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  return (
    <>
      {/* Card de Resumen ancho completo */}
      <div className="chart-card" style={{ marginBottom: '1.5rem' }}>
        <h3 className="chart-title">Resumen de Establecimientos</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '1rem', marginTop: '0.5rem' }}>
          {[
            { label: 'Con Matrícula Activa', val: fmtN(activos.length), color: '#10b981', icon: '✅' },
            { label: 'Cerrados / Receso', val: fmtN(sinMat.length), color: 'var(--text-muted)', icon: '⏸️' },
            { label: 'Convenio PIE', val: fmtN(activos.filter(e => e.convenio_pie).length), color: '#6366f1', icon: '🔵' },
            { label: 'PACE', val: fmtN(activos.filter(e => e.pace).length), color: '#8b5cf6', icon: '🎓' },
            { label: 'Rurales', val: fmtN(activos.filter(e => e.rural_rbd).length), color: '#f59e0b', icon: '🌿' },
            { label: 'Urbanos', val: fmtN(activos.filter(e => !e.rural_rbd).length), color: '#22d3ee', icon: '🏙️' },
          ].map(kpi => (
            <div key={kpi.label} style={{ background: 'var(--surface-overlay)', borderRadius: '0.5rem', padding: '0.75rem', border: '1px solid var(--line-subtle)', textAlign: 'center' }}>
              <div style={{ fontSize: '1.1rem' }}>{kpi.icon}</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: kpi.color, marginTop: '0.25rem' }}>{kpi.val}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{kpi.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabla de establecimientos con ingresos y gastos */}
      <div className="chart-card" style={{ padding: 0 }}>
        <div style={{ padding: '1rem 1.25rem 0.75rem', borderBottom: '1px solid var(--line-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h3 className="chart-title" style={{ margin: 0 }}>Catálogo de Establecimientos ({fmtN(filteredEstablecimientos.length)} resultados)</h3>
            {loadingRbd && <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Cargando datos financieros…</span>}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input type="text" placeholder="Buscar Nombre..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} style={{ ...inputStyle, minWidth: '160px' }} />
            <select value={ensFilter} onChange={e => { setEnsFilter(e.target.value); setCurrentPage(1); }} style={{ ...inputStyle, minWidth: '140px' }}>
              <option value="">Enseñanza: Todas</option>
              {availableEnsLabels.map(lbl => <option key={lbl} value={lbl}>{lbl}</option>)}
            </select>
            <select value={ruralFilter} onChange={e => { setRuralFilter(e.target.value); setCurrentPage(1); }} style={inputStyle}>
              <option value="all">Rural: Todos</option><option value="yes">Rural: Sí</option><option value="no">Rural: No</option>
            </select>
            <select value={pieFilter} onChange={e => { setPieFilter(e.target.value); setCurrentPage(1); }} style={inputStyle}>
              <option value="all">PIE: Todos</option><option value="yes">PIE: Sí</option><option value="no">PIE: No</option>
            </select>
            <select value={paceFilter} onChange={e => { setPaceFilter(e.target.value); setCurrentPage(1); }} style={inputStyle}>
              <option value="all">PACE: Todos</option><option value="yes">PACE: Sí</option><option value="no">PACE: No</option>
            </select>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ background: 'var(--surface-overlay)' }}>
                {[
                  { h: 'RBD', align: 'left' },
                  { h: 'Nombre', align: 'left' },
                  { h: 'Estado', align: 'left' },
                  { h: 'Matrícula', align: 'right' },
                  { h: 'Ingresos', align: 'right' },
                  { h: 'Gastos', align: 'right' },
                  { h: 'Superávit', align: 'right' },
                  { h: 'Tipo Enseñanza', align: 'left' },
                  { h: 'Rural', align: 'center' },
                  { h: 'PIE', align: 'center' },
                  { h: 'PACE', align: 'center' },
                ].map(({ h, align }) => (
                  <th key={h} style={{ padding: '0.6rem 0.9rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: align, borderBottom: '1px solid var(--line-subtle)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedEstablecimientos.map((ee, i) => {
                const estado = ESTADO_LABELS[ee.estado_estab] ?? '—'
                const color = ESTADO_COLORS[ee.estado_estab] ?? '#64748b'
                const fin = finMap[ee.rbd]
                const ingreso = fin ? Number(fin.ingreso) : null
                const gasto = fin ? Number(fin.gasto) : null
                const superav = fin ? Number(fin.superavit) : null
                return (
                  <tr key={ee.rbd} style={{ borderBottom: '1px solid var(--line-subtle)', background: i % 2 === 0 ? 'transparent' : 'var(--surface-overlay)' }}>
                    <td style={{ padding: '0.5rem 0.9rem', color: C.axisLabel, fontFamily: 'monospace', fontSize: '0.78rem' }}>{ee.rbd}</td>
                    <td style={{ padding: '0.5rem 0.9rem', color: 'var(--text-primary)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><span title={ee.nom_rbd}>{ee.nom_rbd}</span></td>
                    <td style={{ padding: '0.5rem 0.9rem' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, color, background: `${color}22`, border: `1px solid ${color}`, borderRadius: 999, padding: '0.15rem 0.5rem' }}>{estado}</span>
                    </td>
                    <td style={{ padding: '0.5rem 0.9rem', color: 'var(--text-primary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtN(ee.mat_total)}</td>
                    <td style={{ padding: '0.5rem 0.9rem', color: '#10b981', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{ingreso != null ? fmtAmt(ingreso) : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td style={{ padding: '0.5rem 0.9rem', color: '#ef4444', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{gasto != null ? fmtAmt(gasto) : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td style={{ padding: '0.5rem 0.9rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {superav != null
                        ? <strong style={{ color: superav >= 0 ? '#10b981' : '#ef4444' }}>{fmtAmt(superav)}</strong>
                        : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ padding: '0.5rem 0.6rem' }}>{getEnsenanzas(ee)}</td>
                    <td style={{ padding: '0.5rem 0.9rem', color: ee.rural_rbd ? '#f59e0b' : 'var(--text-muted)', textAlign: 'center' }}>{ee.rural_rbd ? '🌿' : '·'}</td>
                    <td style={{ padding: '0.5rem 0.9rem', color: ee.convenio_pie ? '#6366f1' : 'var(--text-muted)', textAlign: 'center' }}>{ee.convenio_pie ? '✓' : '·'}</td>
                    <td style={{ padding: '0.5rem 0.9rem', color: ee.pace ? '#8b5cf6' : 'var(--text-muted)', textAlign: 'center' }}>{ee.pace ? '✓' : '·'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '1rem', borderTop: '1px solid var(--line-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            Mostrando {filteredEstablecimientos.length === 0 ? 0 : ((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, filteredEstablecimientos.length)} de {filteredEstablecimientos.length}
          </span>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
              style={{ padding: '0.3rem 0.6rem', border: '1px solid var(--line-subtle)', background: currentPage === 1 ? 'var(--surface-base)' : 'var(--surface-overlay)', color: currentPage === 1 ? 'var(--text-disabled)' : 'var(--text-primary)', borderRadius: '0.375rem', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
            >
              Anterior
            </button>
            <span style={{ padding: '0.3rem 0.6rem', color: C.axisLabel, fontSize: '0.85rem' }}>
              Página {currentPage} de {totalPages || 1}
            </span>
            <button
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage(prev => prev + 1)}
              style={{ padding: '0.3rem 0.6rem', border: '1px solid var(--line-subtle)', background: (currentPage === totalPages || totalPages === 0) ? 'var(--surface-base)' : 'var(--surface-overlay)', color: (currentPage === totalPages || totalPages === 0) ? 'var(--text-disabled)' : 'var(--text-primary)', borderRadius: '0.375rem', cursor: (currentPage === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer' }}
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Tab: Educativo – Financiero (contenedor con sub-tabs) ────────────────────────
// El sub-tab "Ingreso - Gasto" muestra el contenido de TabFinanciero.
// Se pueden agregar más sub-tabs aquí en el futuro.
function TabEducativoFinanciero({ rdbData, periodo, sostId }) {
  const [subTab, setSubTab] = useState(
    () => localStorage.getItem('pirgefse-fichasost-educativo-financiero') || 'ingreso_gasto'
  )
  useEffect(() => {
    localStorage.setItem('pirgefse-fichasost-educativo-financiero', subTab)
  }, [subTab])
  useEffect(() => {
    const handler = (e) => { if (e.detail.key === 'pirgefse-fichasost-educativo-financiero') setSubTab(e.detail.val) }
    window.addEventListener('pirgefse-subtab', handler)
    return () => window.removeEventListener('pirgefse-subtab', handler)
  }, [])

  const SUB_TABS = [
    { key: 'ingreso_gasto', label: 'Ingreso - Gasto', icon: '💵', color: '#10b981' },
    { key: 'sned', label: 'SNED', icon: '🏆', color: '#6366f1' },
  ]

  return (
    <div>
      <div style={{
        display: 'flex', gap: '0.5rem', marginBottom: '1.5rem',
        borderBottom: '2px solid var(--line-subtle)', paddingBottom: '0',
      }}>
        {SUB_TABS.map(t => {
          const active = subTab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setSubTab(t.key)}
              style={{
                padding: '0.55rem 1.1rem',
                borderRadius: '0.375rem 0.375rem 0 0',
                fontWeight: 600,
                fontSize: '0.88rem',
                background: active ? t.color : 'transparent',
                color: active ? '#fff' : 'var(--text-muted)',
                border: 'none',
                borderBottom: active ? `2px solid ${t.color}` : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.18s',
                marginBottom: '-2px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <span>{t.icon}</span> {t.label}
            </button>
          )
        })}
      </div>

      {subTab === 'ingreso_gasto' && <TabFinanciero rdbData={rdbData} periodo={periodo} />}
      {subTab === 'sned' && <SNEDSostenedor sostId={sostId} periodo={periodo} />}
    </div>
  )
}

// ── Tab: Financiero por RBD ────────────────────────────────────────────────────
function TabFinanciero({ rdbData, periodo }) {
  const C = useChartColors()
  if (!rdbData) return null
  const { fmtAmt, fmtAxisAmt, unitLabel } = useMoneyFmt()
  const { financiero_rbd = [], remuneraciones_rbd = [] } = rdbData
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  const sorted = [...financiero_rbd].sort((a, b) => Number(b.ingreso) - Number(a.ingreso))

  // Filtrado por nombre y paginado de 10 en 10
  const filterText = search.toLowerCase().trim()
  const filtered = filterText ? sorted.filter(d => (d.nom_rbd ?? '').toLowerCase().includes(filterText)) : sorted
  const totalPages = Math.ceil(filtered.length / 10) || 1
  const safePage = Math.min(page, totalPages - 1)
  const visible = filtered.slice(safePage * 10, (safePage + 1) * 10)
  const names = visible.map(d => shortName(d.nom_rbd, d.rbd))
  const h = Math.max(320, visible.length * 36)

  // Resetear página al cambiar búsqueda
  useEffect(() => { setPage(0) }, [search])

  const barOption = {
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' }, ...C.tooltip,
      formatter: params => {
        const d = visible[params[0].dataIndex]
        return `<b>${shortName(d.nom_rbd, d.rbd)}</b> (${d.rbd})<br/>
          📈 Ingreso: ${fmtAmt(d.ingreso)}<br/>📉 Gasto: ${fmtAmt(d.gasto)}<br/>⚖️ Superávit: <b>${fmtAmt(d.superavit)}</b>`
      },
    },
    legend: { data: ['Ingreso', 'Gasto'], textStyle: { color: C.axisLabel }, top: 0 },
    grid: { left: 260, right: 100, top: 40, bottom: 20 },
    xAxis: { type: 'value', axisLabel: { color: C.axisLabel, formatter: v => fmtAxisAmt(v) }, splitLine: { lineStyle: { color: C.splitLine } } },
    yAxis: { type: 'category', data: names, axisLabel: { color: C.axisLabel, fontSize: 10, width: 250, overflow: 'truncate' } },
    series: [
      { name: 'Ingreso', type: 'bar', data: visible.map(d => Number(d.ingreso)), barMaxWidth: 16, itemStyle: { color: '#10b981', borderRadius: [0, 4, 4, 0] } },
      { name: 'Gasto', type: 'bar', data: visible.map(d => Number(d.gasto)), barMaxWidth: 16, itemStyle: { color: '#ef4444', borderRadius: [0, 4, 4, 0] } },
    ],
    backgroundColor: 'transparent',
  }

  const superavitOption = {
    tooltip: {
      trigger: 'axis', ...C.tooltip,
      formatter: params => {
        const d = visible[params[0].dataIndex]
        const v = Number(d.superavit)
        return `<b>${shortName(d.nom_rbd, d.rbd)}</b><br/>Superávit: <b style="color:${v >= 0 ? '#10b981' : '#ef4444'}">${fmtAmt(v)}</b>`
      },
    },
    grid: { left: 260, right: 100, top: 20, bottom: 20 },
    xAxis: { type: 'value', axisLabel: { color: C.axisLabel, formatter: v => fmtAxisAmt(v) }, splitLine: { lineStyle: { color: C.splitLine } } },
    yAxis: { type: 'category', data: names, axisLabel: { color: C.axisLabel, fontSize: 10, width: 250, overflow: 'truncate' } },
    series: [{
      type: 'bar', barMaxWidth: 16,
      data: visible.map(d => ({ value: Number(d.superavit), itemStyle: { color: Number(d.superavit) >= 0 ? '#10b981' : '#ef4444', borderRadius: [0, 4, 4, 0] } })),
      markLine: { silent: true, data: [{ xAxis: 0, lineStyle: { color: C.axisLabel, type: 'dashed' } }] },
    }],
    backgroundColor: 'transparent',
  }

  const totalIng = sorted.reduce((s, d) => s + Number(d.ingreso), 0)
  const totalGas = sorted.reduce((s, d) => s + Number(d.gasto), 0)
  const conDeficit = sorted.filter(d => Number(d.superavit) < 0).length

  const inputStyle = {
    padding: '0.35rem 0.75rem', backgroundColor: 'var(--surface-overlay)', color: 'var(--text-primary)',
    border: '1px solid var(--line-subtle)', borderRadius: '0.375rem', fontSize: '0.8rem', minWidth: 220,
  }

  const sqlStr = `SELECT
    er.rbd,
    eo.nom_rbd,
    SUM(CASE WHEN UPPER(TRIM(er.desc_tipo_cuenta)) LIKE '%INGRESO%'
             AND UPPER(TRIM(er.desc_estado)) = 'RENDIDO'
             AND er.cuenta_alias_padre LIKE '3%'
             THEN er.monto_declarado ELSE 0 END) AS ingreso,
    SUM(CASE WHEN UPPER(TRIM(er.desc_tipo_cuenta)) LIKE '%GASTO%'
             AND UPPER(TRIM(er.desc_estado)) = 'RENDIDO'
             THEN er.monto_declarado ELSE 0 END) AS gasto,
    SUM(CASE WHEN UPPER(TRIM(er.desc_tipo_cuenta)) LIKE '%INGRESO%'
             AND UPPER(TRIM(er.desc_estado)) = 'RENDIDO'
             AND er.cuenta_alias_padre LIKE '3%'
             THEN er.monto_declarado
             WHEN UPPER(TRIM(er.desc_tipo_cuenta)) LIKE '%GASTO%'
             AND UPPER(TRIM(er.desc_estado)) = 'RENDIDO'
             THEN -er.monto_declarado ELSE 0 END) AS superavit
FROM estado_resultado er
JOIN dim_establecimiento_oficial eo ON eo.rbd = er.rbd AND eo.agno = er.periodo
WHERE er.sost_id = :sid
  AND er.periodo = :per
GROUP BY er.rbd, eo.nom_rbd
ORDER BY ingreso DESC`

  return (
    <>
      <SqlViewer sql={sqlStr} />
      <div className="alert-info" style={{ padding: '10px 16px', borderRadius: 10, fontSize: '0.82rem', marginBottom: 12 }}>
        ℹ️ <strong>Metodología:</strong> Comparación entre el Ingreso Total y el Gasto Total por Establecimiento (RBD) para calcular el Superávit o Déficit del período.
      </div>
      <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
        <KPICard icon="📈" label={`Total Ingresos (${periodo})`} value={fmtAmt(totalIng)} color="#10b981" />
        <KPICard icon="📉" label={`Total Gastos (${periodo})`} value={fmtAmt(totalGas)} color="#ef4444" />
        <KPICard icon="⚖️" label="Superávit Consolidado" value={fmtAmt(totalIng - totalGas)} color="#6366f1" />
        <KPICard icon="⚠️" label="EE con Déficit" value={fmtN(conDeficit)} color={conDeficit > 0 ? '#f59e0b' : '#10b981'} />
      </div>

      {/* Buscador + paginación */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="🔍 Buscar por nombre de establecimiento..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={inputStyle}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            style={{ padding: '0.3rem 0.6rem', background: 'var(--surface-overlay)', border: '1px solid var(--line-subtle)', color: C.axisLabel, borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.78rem' }}
          >
            ✕ Limpiar
          </button>
        )}
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Mostrando{' '}
          <b style={{ color: C.axisLabel }}>{filtered.length === 0 ? 0 : safePage * 10 + 1}–{Math.min((safePage + 1) * 10, filtered.length)}</b>
          {' '}de <b style={{ color: C.axisLabel }}>{filtered.length}</b> establecimientos
        </span>
        {/* Botones Anterior / Siguiente alineados a la derecha */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button
            disabled={safePage === 0}
            onClick={() => setPage(p => p - 1)}
            style={{
              padding: '0.3rem 0.75rem', border: '1px solid var(--line-subtle)', borderRadius: '0.375rem',
              background: safePage === 0 ? 'var(--surface-base)' : 'var(--surface-overlay)',
              color: safePage === 0 ? 'var(--text-disabled)' : 'var(--text-primary)',
              cursor: safePage === 0 ? 'not-allowed' : 'pointer', fontSize: '0.8rem',
            }}
          >
            ← Anterior
          </button>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', minWidth: 56, textAlign: 'center' }}>
            {safePage + 1} / {totalPages}
          </span>
          <button
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage(p => p + 1)}
            style={{
              padding: '0.3rem 0.75rem', border: '1px solid var(--line-subtle)', borderRadius: '0.375rem',
              background: safePage >= totalPages - 1 ? 'var(--surface-base)' : 'var(--surface-overlay)',
              color: safePage >= totalPages - 1 ? 'var(--text-disabled)' : 'var(--text-primary)',
              cursor: safePage >= totalPages - 1 ? 'not-allowed' : 'pointer', fontSize: '0.8rem',
            }}
          >
            Siguiente →
          </button>
        </div>
      </div>

      <WidgetWrapper widgetKey="ef_ingreso_gasto">
        <div className="chart-card" style={{ marginBottom: '1.25rem' }}>
          <h3 className="chart-title">Ingreso vs Gasto por Establecimiento — {periodo} ({unitLabel})</h3>
          {visible.length === 0
            ? <p style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>Sin resultados para «{search}»</p>
            : <ReactECharts option={barOption} style={{ height: h }} />
          }
        </div>
      </WidgetWrapper>
      <WidgetWrapper widgetKey="ef_superavit">
        <div className="chart-card" style={{ marginBottom: '1.25rem' }}>
          <h3 className="chart-title">Superávit / Déficit por Establecimiento — {periodo} ({unitLabel})</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '0.5rem' }}>
            <span style={{ color: '#10b981' }}>■</span> Superávit &nbsp;<span style={{ color: '#ef4444' }}>■</span> Déficit
          </p>
          {visible.length === 0
            ? <p style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>Sin resultados para «{search}»</p>
            : <ReactECharts option={superavitOption} style={{ height: h }} />
          }
        </div>
      </WidgetWrapper>
    </>
  )
}


// ── Tab: Eficiencia (Sub-tabs) ──────────────────────────────────────────────────
function TabEficiencia({ rdbData, periodo, sostId }) {
  const C = useChartColors()
  const [subTab, setSubTab] = useState(() => localStorage.getItem('pirgefse-fichasost-eficiencia') || 'innovacion')
  useEffect(() => { localStorage.setItem('pirgefse-fichasost-eficiencia', subTab) }, [subTab])
  useEffect(() => {
    const handler = (e) => { if (e.detail.key === 'pirgefse-fichasost-eficiencia') setSubTab(e.detail.val) }
    window.addEventListener('pirgefse-subtab', handler)
    return () => window.removeEventListener('pirgefse-subtab', handler)
  }, [])

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--line-subtle)', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => setSubTab('innovacion')}
          style={{
            padding: '0.5rem 1rem', borderRadius: '0.375rem', fontWeight: 600, fontSize: '0.9rem',
            background: subTab === 'innovacion' ? '#3b82f6' : 'transparent',
            color: subTab === 'innovacion' ? '#fff' : 'var(--text-muted)',
            border: 'none', cursor: 'pointer', transition: 'all 0.2s'
          }}
        >
          💡 Innovación Pedagógica
        </button>
        <button
          onClick={() => setSubTab('costo')}
          style={{
            padding: '0.5rem 1rem', borderRadius: '0.375rem', fontWeight: 600, fontSize: '0.9rem',
            background: subTab === 'costo' ? '#10b981' : 'transparent',
            color: subTab === 'costo' ? '#fff' : 'var(--text-muted)',
            border: 'none', cursor: 'pointer', transition: 'all 0.2s'
          }}
        >
          🎓 Costo por Alumno Educativo
        </button>
        <button
          onClick={() => setSubTab('administrativo')}
          style={{
            padding: '0.5rem 1rem', borderRadius: '0.375rem', fontWeight: 600, fontSize: '0.9rem',
            background: subTab === 'administrativo' ? '#8b5cf6' : 'transparent',
            color: subTab === 'administrativo' ? '#fff' : 'var(--text-muted)',
            border: 'none', cursor: 'pointer', transition: 'all 0.2s'
          }}
        >
          💼 Gasto Administrativo
        </button>
      </div>

      {subTab === 'innovacion' && <RenderInnovacionPedagogica rdbData={rdbData} periodo={periodo} />}
      {subTab === 'costo' && <RenderCostoAlumno sostId={sostId} periodo={periodo} />}
      {subTab === 'administrativo' && <RenderGastoAdministrativo sostId={sostId} periodo={periodo} />}
    </div>
  )
}

function RenderInnovacionPedagogica({ rdbData, periodo }) {
  const C = useChartColors()
  if (!rdbData) return null
  const { fmtAmt, fmtAxisAmt, unitLabel } = useMoneyFmt()
  const { eficiencia_rbd = [] } = rdbData
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const sorted = [...eficiencia_rbd].sort((a, b) => Number(b.total_gasto) - Number(a.total_gasto))
  const filterText = search.toLowerCase().trim()
  const filtered = filterText ? sorted.filter(d => (d.nom_rbd ?? '').toLowerCase().includes(filterText)) : sorted
  const totalPages = Math.ceil(filtered.length / 10) || 1
  const safePage = Math.min(page, totalPages - 1)
  const visible = filtered.slice(safePage * 10, (safePage + 1) * 10)
  const names = visible.map(d => shortName(d.nom_rbd, d.rbd))
  const h = Math.max(320, visible.length * 36)
  useEffect(() => { setPage(0) }, [search])

  const tt = () => ({ backgroundColor: 'var(--surface-overlay)', borderColor: 'var(--line-subtle)', textStyle: { color: 'var(--text-primary)', fontSize: 11 } })

  const pct100Option = {
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' }, ...C.tooltip,
      formatter: params => {
        const d = visible[params[0].dataIndex]
        const ef = EF_COLORS[d.nivel_eficiencia] ?? 'var(--text-muted)'
        return `<b>${shortName(d.nom_rbd, d.rbd)}</b><br/>
          <span style="color:#10b981">■</span> Aula: ${d.pct_aula}%<br/>
          <span style="color:#ef4444">■</span> Admin: <b style="color:${ef}">${d.pct_admin}%</b> — ${d.nivel_eficiencia}<br/>
          <span style="color:#f59e0b">■</span> Otros: ${d.pct_otros}%<br/>
          Total: ${fmtAmt(d.total_gasto)}`
      },
    },
    legend: { data: ['Gasto en Aula', 'Gasto Administrativo', 'Otros Gastos'], textStyle: { color: C.axisLabel }, top: 0 },
    grid: { left: 260, right: 80, top: 40, bottom: 20 },
    xAxis: { type: 'value', max: 100, axisLabel: { color: C.axisLabel, formatter: v => `${v}%` }, splitLine: { lineStyle: { color: C.splitLine } } },
    yAxis: { type: 'category', data: names, axisLabel: { color: C.axisLabel, fontSize: 10, width: 250, overflow: 'truncate' } },
    series: [
      { name: 'Gasto en Aula', type: 'bar', stack: 'pct', barMaxWidth: 16, data: visible.map(d => d.pct_aula), itemStyle: { color: '#10b981' } },
      { name: 'Gasto Administrativo', type: 'bar', stack: 'pct', barMaxWidth: 16, data: visible.map(d => d.pct_admin), itemStyle: { color: '#ef4444' } },
      { name: 'Otros Gastos', type: 'bar', stack: 'pct', barMaxWidth: 16, data: visible.map(d => d.pct_otros), itemStyle: { color: '#f59e0b' } },
    ],
    backgroundColor: 'transparent',
  }

  const adminOption = {
    tooltip: {
      trigger: 'axis', ...C.tooltip,
      formatter: params => { const d = visible[params[0].dataIndex]; return `<b>${shortName(d.nom_rbd, d.rbd)}</b><br/>% Administrativo: <b>${d.pct_admin}%</b> — ${d.nivel_eficiencia}` }
    },
    grid: { left: 260, right: 80, top: 20, bottom: 20 },
    xAxis: { type: 'value', max: 100, axisLabel: { color: C.axisLabel, formatter: v => `${v}%` }, splitLine: { lineStyle: { color: C.splitLine } } },
    yAxis: { type: 'category', data: names, axisLabel: { color: C.axisLabel, fontSize: 10, width: 250, overflow: 'truncate' } },
    series: [{
      type: 'bar', barMaxWidth: 16,
      data: visible.map(d => ({ value: d.pct_admin, itemStyle: { color: EF_COLORS[d.nivel_eficiencia] ?? 'var(--text-muted)', borderRadius: [0, 4, 4, 0] } })),
      markLine: {
        silent: true, data: [
          { xAxis: 15, lineStyle: { color: '#10b981', type: 'dashed' }, label: { formatter: '15%', color: '#10b981', fontSize: 10 } },
          { xAxis: 25, lineStyle: { color: '#f59e0b', type: 'dashed' }, label: { formatter: '25%', color: '#f59e0b', fontSize: 10 } },
        ]
      },
    }],
    backgroundColor: 'transparent',
  }

  const prom = sorted.length > 0 ? sorted.reduce((s, d) => s + d.pct_admin, 0) / sorted.length : 0
  const optim = sorted.filter(d => d.nivel_eficiencia === 'Optimo').length
  const elev = sorted.filter(d => d.nivel_eficiencia === 'Elevado').length
  const pgBtn = (dis) => ({ padding: '0.3rem 0.75rem', border: '1px solid var(--line-subtle)', borderRadius: '0.375rem', background: dis ? 'var(--surface-base)' : 'var(--surface-overlay)', color: dis ? 'var(--text-muted)' : 'var(--text-primary)', cursor: dis ? 'not-allowed' : 'pointer', fontSize: '0.8rem' })
  const inpSt = { padding: '0.35rem 0.75rem', backgroundColor: 'var(--surface-base)', color: 'var(--text-primary)', border: '1px solid var(--line-subtle)', borderRadius: '0.375rem', fontSize: '0.8rem', minWidth: 220 }

  const sqlStr = `SELECT
    er.rbd,
    eo.nom_rbd,
    SUM(er.monto_declarado) FILTER (
        WHERE UPPER(TRIM(er.desc_estado)) = 'RENDIDO'
          AND UPPER(TRIM(er.desc_tipo_cuenta)) LIKE '%GASTO%'
    ) AS total_gasto,
    ROUND(100.0 * SUM(er.monto_declarado) FILTER (
            WHERE UPPER(TRIM(er.desc_estado)) = 'RENDIDO'
              AND er.cuenta_alias LIKE '410%'
        ) / NULLIF(SUM(er.monto_declarado) FILTER (
            WHERE UPPER(TRIM(er.desc_estado)) = 'RENDIDO'
              AND UPPER(TRIM(er.desc_tipo_cuenta)) LIKE '%GASTO%'
        ), 0), 1) AS pct_aula,
    ROUND(100.0 * SUM(er.monto_declarado) FILTER (
            WHERE UPPER(TRIM(er.desc_estado)) = 'RENDIDO'
              AND er.cuenta_alias LIKE '411%'
        ) / NULLIF(SUM(er.monto_declarado) FILTER (
            WHERE UPPER(TRIM(er.desc_estado)) = 'RENDIDO'
              AND UPPER(TRIM(er.desc_tipo_cuenta)) LIKE '%GASTO%'
        ), 0), 1) AS pct_admin,
    ROUND(100.0 * SUM(er.monto_declarado) FILTER (
            WHERE UPPER(TRIM(er.desc_estado)) = 'RENDIDO'
              AND er.cuenta_alias LIKE '700%'
        ) / NULLIF(SUM(er.monto_declarado) FILTER (
            WHERE UPPER(TRIM(er.desc_estado)) = 'RENDIDO'
              AND UPPER(TRIM(er.desc_tipo_cuenta)) LIKE '%GASTO%'
        ), 0), 1) AS pct_otros
FROM estado_resultado er
JOIN dim_establecimiento_oficial eo ON eo.rbd = er.rbd AND eo.agno = er.periodo
WHERE er.sost_id = :sid
  AND er.periodo = :per
GROUP BY er.rbd, eo.nom_rbd
HAVING SUM(er.monto_declarado) FILTER (
    WHERE UPPER(TRIM(er.desc_estado)) = 'RENDIDO'
      AND UPPER(TRIM(er.desc_tipo_cuenta)) LIKE '%GASTO%'
) > 0
ORDER BY total_gasto DESC`

  return (
    <>
      <SqlViewer sql={sqlStr} />
      <div className="alert-info" style={{ padding: '10px 16px', borderRadius: 10, fontSize: '0.82rem', marginBottom: 12 }}>
        ℹ️ <strong>Metodología:</strong> Proporción del gasto distribuido categóricamente entre Aula, Administración y Otros ítems respecto al Gasto Total.
      </div>
      <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
        <KPICard icon="📊" label="Prom. Gasto Admin" value={`${prom.toFixed(1)}%`} color={prom <= 15 ? '#10b981' : prom <= 25 ? '#f59e0b' : '#ef4444'} />
        <KPICard icon="🟢" label="EE Óptimos (≤15%)" value={fmtN(optim)} color="#10b981" />
        <KPICard icon="🔴" label="EE Elevados (>25%)" value={fmtN(elev)} color="#ef4444" />
        <KPICard icon="⚙️" label="EE Moderados" value={fmtN(sorted.length - optim - elev)} color="#f59e0b" />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input type="text" placeholder="🔍 Buscar por nombre de establecimiento..." value={search} onChange={e => setSearch(e.target.value)} style={inpSt} />
        {search && <button onClick={() => setSearch('')} style={pgBtn(false)}>✕ Limpiar</button>}
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Mostrando <b style={{ color: C.axisLabel }}>{filtered.length === 0 ? 0 : safePage * 10 + 1}–{Math.min((safePage + 1) * 10, filtered.length)}</b> de <b style={{ color: C.axisLabel }}>{filtered.length}</b> establecimientos</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button disabled={safePage === 0} onClick={() => setPage(p => p - 1)} style={pgBtn(safePage === 0)}>← Anterior</button>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', minWidth: 56, textAlign: 'center' }}>{safePage + 1} / {totalPages}</span>
          <button disabled={safePage >= totalPages - 1} onClick={() => setPage(p => p + 1)} style={pgBtn(safePage >= totalPages - 1)}>Siguiente →</button>
        </div>
      </div>
      <WidgetWrapper widgetKey="eg_distribucion_gasto">
        <div className="chart-card" style={{ marginBottom: '1.25rem' }}>
          <h3 className="chart-title">Distribución del Gasto por Categoría (%) — {periodo}</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '0.5rem' }}>
            <span style={{ color: '#10b981' }}>■</span> Aula &nbsp;<span style={{ color: '#ef4444' }}>■</span> Administrativo &nbsp;<span style={{ color: '#f59e0b' }}>■</span> Otros
          </p>
          <ReactECharts option={pct100Option} style={{ height: h }} />
        </div>
      </WidgetWrapper>
      <WidgetWrapper widgetKey="eg_nivel_admin">
        <div className="chart-card">
          <h3 className="chart-title">Nivel de Gasto Administrativo por Establecimiento (%) — {periodo}</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '0.5rem' }}>
            <span style={{ color: '#10b981' }}>■</span> Óptimo ≤15% &nbsp;<span style={{ color: '#f59e0b' }}>■</span> Moderado ≤25% &nbsp;<span style={{ color: '#ef4444' }}>■</span> Elevado &gt;25%
          </p>
          <ReactECharts option={adminOption} style={{ height: h }} />
        </div>
      </WidgetWrapper>
    </>
  )
}


function RenderCostoAlumno({ sostId, periodo, widgetFilter = null }) {
  const C = useChartColors()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const { fmtAmt, fmtAxisAmt } = useMoneyFmt()
  const ITEMS_PER_PAGE = 10

  useEffect(() => { setPage(1) }, [search, data, periodo])

  useEffect(() => {
    setLoading(true)
    api.get(`/dashboard/ficha-sostenedor/costo-alumno?sost_id=${sostId}&periodo=${periodo}`)
      .then(res => setData(res.data))
      .catch(err => console.error("Error fetching costo alumno", err))
      .finally(() => setLoading(false))
  }, [sostId, periodo])

  if (loading) return <div className="loading-area"><div className="spinner" /></div>
  if (!data) return (
    <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎓</div>
      <p>Sin datos de costo por alumno disponibles para este período.</p>
    </div>
  )

  const { costo_establecimientos = [], resumen = {} } = data

  const filterText = search.toLowerCase().trim()
  const filtered = costo_establecimientos.filter(ee =>
    (ee.nombre_rbd ?? '').toLowerCase().includes(filterText) ||
    String(ee.rbd ?? '').includes(filterText)
  )

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE)

  const inpSt = { padding: '0.35rem 0.75rem', backgroundColor: 'var(--surface-overlay)', color: 'var(--text-primary)', border: '1px solid var(--line-subtle)', borderRadius: '0.375rem', fontSize: '0.8rem' }
  const pgBtn = (dis) => ({ padding: '0.3rem 0.75rem', border: '1px solid var(--line-subtle)', borderRadius: '0.375rem', background: dis ? 'var(--surface-base)' : 'var(--surface-overlay)', color: dis ? 'var(--text-disabled)' : 'var(--text-primary)', cursor: dis ? 'not-allowed' : 'pointer', fontSize: '0.8rem' })
  // ttStyle removed }

  // Gráfico 1: Top 10 Costo por Alumno
  const chartData = [...filtered].sort((a, b) => (b.costo_por_alumno ?? 0) - (a.costo_por_alumno ?? 0)).slice(0, 10)
  const barOption = {
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' }, ...C.tooltip,
      formatter: params => {
        const d = chartData[params[0].dataIndex]
        return `<b>${d.nombre_rbd}</b> (${d.rbd})<br/>
          Costo/Alumno: <b style="color:#10b981">${fmtAmt(d.costo_por_alumno)}</b><br/>
          Matrícula: ${fmtN(d.mat_total)}`
      }
    },
    grid: { left: 270, right: 80, top: 20, bottom: 20 },
    xAxis: { type: 'value', axisLabel: { color: C.axisLabel, formatter: v => fmtAxisAmt(v) }, splitLine: { lineStyle: { color: C.splitLine } } },
    yAxis: { type: 'category', data: chartData.map(d => (d.nombre_rbd?.length > 36 ? d.nombre_rbd.slice(0, 34) + '…' : d.nombre_rbd) || 'Sin nombre'), axisLabel: { color: C.axisLabel, fontSize: 10, width: 260, overflow: 'truncate' } },
    series: [{
      type: 'bar', barMaxWidth: 18,
      data: chartData.map(d => ({ value: d.costo_por_alumno, itemStyle: { color: '#3b82f6', borderRadius: [0, 4, 4, 0] } })),
      label: { show: true, position: 'right', formatter: p => fmtAxisAmt(p.value), fontSize: 10, color: 'var(--text-primary)' }
    }],
    backgroundColor: 'transparent',
  }

  // Gráfico 2: Distribución Docencia vs Operacional (General)
  const pieOption = {
    tooltip: { trigger: 'item', ...C.tooltip, formatter: p => `<b>${p.name}</b><br/>Monto: ${fmtAmt(p.value)}<br/>${p.percent.toFixed(1)}%` },
    legend: { orient: 'vertical', left: '60%', top: 'center', textStyle: { color: C.axisLabel, fontSize: 11 } },
    series: [{
      type: 'pie', radius: ['45%', '70%'], center: ['30%', '50%'],
      data: [
        { name: 'Docencia y Apoyo', value: resumen.total_docencia, itemStyle: { color: '#8b5cf6' } },
        { name: 'Operacional', value: resumen.total_operacional, itemStyle: { color: '#10b981' } }
      ],
      label: { show: false }, emphasis: { label: { show: true, fontSize: 13, fontWeight: 'bold', color: 'var(--text-primary)' } }
    }],
    backgroundColor: 'transparent',
  }

  const sqlStr = `WITH gastos AS (
    SELECT 
        d.rbd,
        d.nombre_rbd,
        SUM(d.monto_declarado) as total_gasto,
        SUM(CASE WHEN d.desc_cuenta_padre IN (
            'GASTOS EN EQUIPAMIENTO DE APOYO PEDAGÓGICO', 
            'GASTOS EN RECURSOS DE APRENDIZAJE', 
            'OTROS GASTOS EN PERSONAL', 
            'GASTOS EN ALUMNOS', 
            'GASTOS BIENESTAR ALUMNOS',
            'ASESORÍA TÉCNICA Y ACTIVIDADES DE INFORMACIÓN Y ORIENTACIÓN'
        ) THEN d.monto_declarado ELSE 0 END) as gasto_docencia,
        SUM(CASE WHEN d.desc_cuenta_padre NOT IN (
            'GASTOS EN EQUIPAMIENTO DE APOYO PEDAGÓGICO', 
            'GASTOS EN RECURSOS DE APRENDIZAJE', 
            'OTROS GASTOS EN PERSONAL', 
            'GASTOS EN ALUMNOS', 
            'GASTOS BIENESTAR ALUMNOS',
            'ASESORÍA TÉCNICA Y ACTIVIDADES DE INFORMACIÓN Y ORIENTACIÓN'
        ) THEN d.monto_declarado ELSE 0 END) as gasto_operacional
    FROM documentos d
    WHERE d.sost_id = :sid AND d.periodo = :agno AND d.rbd IS NOT NULL
    GROUP BY d.rbd, d.nombre_rbd
)
SELECT 
    g.rbd,
    g.nombre_rbd,
    g.total_gasto,
    g.gasto_docencia,
    g.gasto_operacional,
    eo.mat_total,
    CASE WHEN eo.mat_total > 0 THEN g.total_gasto / eo.mat_total ELSE 0 END as costo_por_alumno
FROM gastos g
LEFT JOIN dim_establecimiento_oficial eo ON g.rbd = eo.rbd AND eo.agno = :agno
ORDER BY costo_por_alumno DESC NULLS LAST`

  // ── Early return para el tab Resumen ─────────────────────────────────────
  if (widgetFilter === 'eg_costo_alumno_kpis') {
    return (
      <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
        <KPICard icon="🎓" label="Costo Prom. Alumno" value={fmtAmt(resumen.costo_promedio_general)} color="#3b82f6" sub="Nivel Sostenedor" />
        <KPICard icon="👨‍🎓" label="Matrícula Total" value={fmtN(resumen.total_matricula_evaluada)} color="#10b981" sub="Establecimientos evaluados" />
        <KPICard icon="📚" label="Gasto Docencia" value={fmtAmt(resumen.total_docencia)} color="#8b5cf6" />
        <KPICard icon="⚙️" label="Gasto Operacional" value={fmtAmt(resumen.total_operacional)} color="#f59e0b" />
      </div>
    )
  }
  if (widgetFilter === 'eg_costo_alumno_tabla') {
    return (
      <div className="chart-card" style={{ padding: 0, marginBottom: '1.5rem' }}>
        <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--line-subtle)' }}>
          <h3 className="chart-title" style={{ margin: 0 }}>Detalle Costo por Alumno — {periodo} ({fmtN(filtered.length)} resultados)</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ background: 'var(--surface-overlay)' }}>
                {[{ h: 'RBD', a: 'left' }, { h: 'Establecimiento', a: 'left' }, { h: 'Matrícula', a: 'right' }, { h: 'Gasto Docencia', a: 'right' }, { h: 'Gasto Operacional', a: 'right' }, { h: 'Costo por Alumno', a: 'right' }].map(({ h, a }) => (
                  <th key={h} style={{ padding: '0.55rem 0.8rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: a, borderBottom: '1px solid var(--line-subtle)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 && <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Sin resultados para «{search}»</td></tr>}
              {paginated.map((ee, i) => (
                <tr key={`${ee.rbd}-${ee.nombre_rbd}`} style={{ borderBottom: '1px solid var(--line-subtle)', background: i % 2 === 0 ? 'transparent' : 'var(--surface-overlay)' }}>
                  <td style={{ padding: '0.45rem 0.8rem', color: C.axisLabel, fontFamily: 'monospace', fontSize: '0.76rem' }}>{ee.rbd}</td>
                  <td style={{ padding: '0.45rem 0.8rem', color: 'var(--text-primary)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><span title={ee.nombre_rbd}>{ee.nombre_rbd}</span></td>
                  <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: C.axisLabel }}>{fmtN(ee.mat_total)}</td>
                  <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: '#8b5cf6' }}>{fmtAmt(ee.gasto_docencia)}</td>
                  <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: '#10b981' }}>{fmtAmt(ee.gasto_operacional)}</td>
                  <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: '#3b82f6', fontWeight: 700 }}>{fmtAmt(ee.costo_por_alumno)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }
  if (widgetFilter === 'eg_costo_alumno_graficos') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
        <div className="chart-card">
          <h3 className="chart-title">Top 10 — Mayor Costo por Alumno (filtrado)</h3>
          {chartData.length === 0
            ? <p style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>Sin datos.</p>
            : <ReactECharts option={barOption} style={{ height: Math.max(280, chartData.length * 38) }} />
          }
        </div>
        <div className="chart-card">
          <h3 className="chart-title">Distribución General de Costos</h3>
          <ReactECharts option={pieOption} style={{ height: 300 }} />
        </div>
      </div>
    )
  }

  return (
    <>
      <SqlViewer sql={sqlStr} />
      <div className="alert-info" style={{ padding: '10px 16px', borderRadius: 10, fontSize: '0.82rem', marginBottom: 12 }}>
        ℹ️ <strong>Metodología:</strong> Costo por Alumno = Gasto Total / Matrícula Total del establecimiento para el período seleccionado.
      </div>
      <WidgetWrapper widgetKey="eg_costo_alumno_kpis">
        <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
          <KPICard icon="🎓" label="Costo Prom. Alumno" value={fmtAmt(resumen.costo_promedio_general)} color="#3b82f6" sub="Nivel Sostenedor" />
          <KPICard icon="👨‍🎓" label="Matrícula Total" value={fmtN(resumen.total_matricula_evaluada)} color="#10b981" sub="Establecimientos evaluados" />
          <KPICard icon="📚" label="Gasto Docencia" value={fmtAmt(resumen.total_docencia)} color="#8b5cf6" />
          <KPICard icon="⚙️" label="Gasto Operacional" value={fmtAmt(resumen.total_operacional)} color="#f59e0b" />
        </div>
      </WidgetWrapper>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input type="text" placeholder="🔍 Buscar por nombre de establecimiento o RBD..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inpSt, minWidth: 280 }} />
        {search && <button onClick={() => setSearch('')} style={pgBtn(false)}>✕ Limpiar</button>}

        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Mostrando <b style={{ color: C.axisLabel }}>{filtered.length === 0 ? 0 : (safePage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(safePage * ITEMS_PER_PAGE, filtered.length)}</b> de <b style={{ color: C.axisLabel }}>{filtered.length}</b>
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button disabled={safePage <= 1} onClick={() => setPage(p => p - 1)} style={pgBtn(safePage <= 1)}>← Anterior</button>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', minWidth: 56, textAlign: 'center' }}>{safePage} / {totalPages}</span>
          <button disabled={safePage >= totalPages} onClick={() => setPage(p => p + 1)} style={pgBtn(safePage >= totalPages)}>Siguiente →</button>
        </div>
      </div>

      <WidgetWrapper widgetKey="eg_costo_alumno_tabla">
        <div className="chart-card" style={{ padding: 0, marginBottom: '1.5rem' }}>
          <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--line-subtle)' }}>
            <h3 className="chart-title" style={{ margin: 0 }}>Detalle Costo por Alumno — {periodo} ({fmtN(filtered.length)} resultados)</h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: 'var(--surface-overlay)' }}>
                  {[{ h: 'RBD', a: 'left' }, { h: 'Establecimiento', a: 'left' }, { h: 'Matrícula', a: 'right' }, { h: 'Gasto Docencia', a: 'right' }, { h: 'Gasto Operacional', a: 'right' }, { h: 'Costo por Alumno', a: 'right' }].map(({ h, a }) => (
                    <th key={h} style={{ padding: '0.55rem 0.8rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: a, borderBottom: '1px solid var(--line-subtle)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 && <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Sin resultados para «{search}»</td></tr>}
                {paginated.map((ee, i) => (
                  <tr key={`${ee.rbd}-${ee.nombre_rbd}`} style={{ borderBottom: '1px solid var(--line-subtle)', background: i % 2 === 0 ? 'transparent' : 'var(--surface-overlay)' }}>
                    <td style={{ padding: '0.45rem 0.8rem', color: C.axisLabel, fontFamily: 'monospace', fontSize: '0.76rem' }}>{ee.rbd}</td>
                    <td style={{ padding: '0.45rem 0.8rem', color: 'var(--text-primary)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span title={ee.nombre_rbd}>{ee.nombre_rbd}</span>
                    </td>
                    <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: C.axisLabel, fontVariantNumeric: 'tabular-nums' }}>{fmtN(ee.mat_total)}</td>
                    <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: '#8b5cf6', fontVariantNumeric: 'tabular-nums' }}>{fmtAmt(ee.gasto_docencia)}</td>
                    <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: '#10b981', fontVariantNumeric: 'tabular-nums' }}>{fmtAmt(ee.gasto_operacional)}</td>
                    <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: '#3b82f6', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtAmt(ee.costo_por_alumno)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--line-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{filtered.length === 0 ? 0 : (safePage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(safePage * ITEMS_PER_PAGE, filtered.length)} de {filtered.length}</span>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <button disabled={safePage <= 1} onClick={() => setPage(p => p - 1)} style={pgBtn(safePage <= 1)}>← Anterior</button>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', minWidth: 60, textAlign: 'center' }}>Pág. {safePage} / {totalPages}</span>
              <button disabled={safePage >= totalPages} onClick={() => setPage(p => p + 1)} style={pgBtn(safePage >= totalPages)}>Siguiente →</button>
            </div>
          </div>
        </div>
      </WidgetWrapper>

      <WidgetWrapper widgetKey="eg_costo_alumno_graficos">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
          <div className="chart-card">
            <h3 className="chart-title">Top 10 — Mayor Costo por Alumno (filtrado)</h3>
            {chartData.length === 0
              ? <p style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>Sin datos.</p>
              : <ReactECharts option={barOption} style={{ height: Math.max(280, chartData.length * 38) }} />
            }
          </div>
          <div className="chart-card">
            <h3 className="chart-title">Distribución General de Costos</h3>
            <ReactECharts option={pieOption} style={{ height: 300 }} />
          </div>
        </div>
      </WidgetWrapper>
    </>
  )
}



function RenderGastoAdministrativo({ sostId, periodo, widgetFilter = null }) {
  const C = useChartColors()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const { fmtAmt, fmtAxisAmt } = useMoneyFmt()
  const ITEMS_PER_PAGE = 10

  useEffect(() => { setPage(1) }, [search, data, periodo])

  useEffect(() => {
    setLoading(true)
    api.get(`/dashboard/ficha-sostenedor/gasto-administrativo?sost_id=${sostId}&periodo=${periodo}`)
      .then(res => setData(res.data))
      .catch(err => console.error("Error fetching gasto administrativo", err))
      .finally(() => setLoading(false))
  }, [sostId, periodo])

  if (loading) return <div className="loading-area"><div className="spinner" /></div>
  if (!data) return (
    <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💼</div>
      <p>Sin datos de remuneraciones disponibles para este período.</p>
    </div>
  )

  const { gasto_por_establecimiento = [], gasto_por_funcion = [], gasto_por_cuenta = [], resumen = {} } = data

  const filterText = search.toLowerCase().trim()
  const filtered = gasto_por_establecimiento.filter(ee =>
    (ee.nom_rbd ?? '').toLowerCase().includes(filterText) ||
    String(ee.rbd ?? '').includes(filterText)
  )

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE)

  const inpSt = { padding: '0.35rem 0.75rem', backgroundColor: 'var(--surface-overlay)', color: 'var(--text-primary)', border: '1px solid var(--line-subtle)', borderRadius: '0.375rem', fontSize: '0.8rem' }
  const pgBtn = (dis) => ({ padding: '0.3rem 0.75rem', border: '1px solid var(--line-subtle)', borderRadius: '0.375rem', background: dis ? 'var(--surface-base)' : 'var(--surface-overlay)', color: dis ? 'var(--text-disabled)' : 'var(--text-primary)', cursor: dis ? 'not-allowed' : 'pointer', fontSize: '0.8rem' })
  // ttStyle removed }

  // Gráfico 1: Función
  const barOption = {
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' }, ...C.tooltip,
      formatter: params => {
        const d = gasto_por_funcion[params[0].dataIndex]
        return `<b>${d.fun}</b><br/>Gasto: <b style="color:#8b5cf6">${fmtAmt(d.total)}</b>`
      }
    },
    grid: { left: 80, right: 30, top: 20, bottom: 20 },
    xAxis: { type: 'value', axisLabel: { color: C.axisLabel, formatter: v => fmtAxisAmt(v) }, splitLine: { lineStyle: { color: C.splitLine } } },
    yAxis: { type: 'category', data: gasto_por_funcion.map(d => d.fun.length > 30 ? d.fun.slice(0, 28) + '...' : d.fun), axisLabel: { color: C.axisLabel, fontSize: 10, width: 140, overflow: 'truncate' } },
    series: [{
      type: 'bar', barMaxWidth: 18,
      data: gasto_por_funcion.map(d => ({ value: d.total, itemStyle: { color: '#8b5cf6', borderRadius: [0, 4, 4, 0] } })),
      label: { show: true, position: 'right', formatter: p => fmtAxisAmt(p.value), fontSize: 10, color: 'var(--text-primary)' }
    }],
    backgroundColor: 'transparent',
  }

  // Gráfico 2: Cuenta Alias
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#64748b']
  const pieOption = {
    tooltip: { trigger: 'item', ...C.tooltip, formatter: p => `<b>${p.name}</b><br/>Gasto: ${fmtAmt(p.value)}<br/>${p.percent.toFixed(1)}%` },
    legend: { orient: 'vertical', left: '60%', top: 'center', textStyle: { color: C.axisLabel, fontSize: 10 }, formatter: name => name.length > 35 ? name.slice(0, 33) + '...' : name },
    series: [{
      type: 'pie', radius: ['45%', '70%'], center: ['30%', '50%'],
      data: gasto_por_cuenta.map((c, i) => ({ name: c.cuenta_alias, value: c.total, itemStyle: { color: COLORS[i % COLORS.length] } })),
      label: { show: false }, emphasis: { label: { show: true, fontSize: 13, fontWeight: 'bold', color: 'var(--text-primary)' } }
    }],
    backgroundColor: 'transparent',
  }

  const sqlStr = `-- Gasto por establecimiento y desglosado
WITH base AS (
    SELECT 
        r.rbd,
        eo.nom_rbd,
        SUM(r.monto) as total_gasto,
        SUM(CASE WHEN r.fun = 'DOCAUL' THEN r.monto ELSE 0 END) as gasto_docaul,
        SUM(CASE WHEN r.fun = 'ASIPAR' THEN r.monto ELSE 0 END) as gasto_asipar,
        SUM(CASE WHEN r.fun = 'DOCDIR' THEN r.monto ELSE 0 END) as gasto_docdir,
        SUM(CASE WHEN r.fun NOT IN ('DOCAUL', 'ASIPAR', 'DOCDIR') THEN r.monto ELSE 0 END) as gasto_otros
    FROM remuneraciones r
    LEFT JOIN dim_establecimiento_oficial eo ON r.rbd = eo.rbd AND eo.agno = :agno
    WHERE r.sostenedor = :sid AND r.anio = :agno AND r.cuenta_alias LIKE '4101%'
    GROUP BY r.rbd, eo.nom_rbd
)
SELECT * FROM base ORDER BY total_gasto DESC NULLS LAST;

-- Gasto total por Función
SELECT 
    COALESCE('(' || df.dependencia_funcion || ') ' || df.descripcion, r.fun, 'SIN FUN') as fun, 
    SUM(r.monto) as total
FROM remuneraciones r
LEFT JOIN dim_funcion df ON r.fun = df.abrev
WHERE r.sostenedor = :sid AND r.anio = :agno AND r.cuenta_alias LIKE '4101%'
GROUP BY COALESCE('(' || df.dependencia_funcion || ') ' || df.descripcion, r.fun, 'SIN FUN')
ORDER BY total DESC LIMIT 10;

-- Gasto por Cuenta
SELECT 
    COALESCE(dc.desc_cuenta, r.cuenta_alias) as cuenta_alias, 
    SUM(r.monto) as total
FROM remuneraciones r
LEFT JOIN dim_cuenta dc ON r.cuenta_alias = dc.cuenta_alias
WHERE r.sostenedor = :sid AND r.anio = :agno AND r.cuenta_alias LIKE '4101%'
GROUP BY COALESCE(dc.desc_cuenta, r.cuenta_alias)
ORDER BY total DESC LIMIT 10;`

  // ── Early return para el tab Resumen ─────────────────────────────────────
  if (widgetFilter === 'eg_gasto_adm_kpis') {
    return (
      <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
        <KPICard icon="💼" label="Gasto Total Remuneracional" value={fmtAmt(resumen.total_gasto)} color="#8b5cf6" />
        <KPICard icon="🏢" label="Centros de Costo" value={fmtN(resumen.centros)} color="#3b82f6" sub="Establec. + Adm. Central" />
        <KPICard icon="👨‍🏫" label="Gasto Docentes de Aula" value={fmtAmt(resumen.total_docaul)} color="#10b981" sub="Función DOCAUL" />
        <KPICard icon="📊" label="Promedio por Centro" value={fmtAmt(resumen.centros ? resumen.total_gasto / resumen.centros : 0)} color="#f59e0b" />
      </div>
    )
  }
  if (widgetFilter === 'eg_gasto_adm_tabla') {
    return (
      <div className="chart-card" style={{ padding: 0, marginBottom: '1.5rem' }}>
        <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--line-subtle)' }}>
          <h3 className="chart-title" style={{ margin: 0 }}>Distribución Remuneracional por RBD — {periodo} ({fmtN(filtered.length)} resultados)</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ background: 'var(--surface-overlay)' }}>
                {[{ h: 'RBD', a: 'left' }, { h: 'Establecimiento', a: 'left' }, { h: 'Doc. Aula', a: 'right' }, { h: 'Asist. Parvularia', a: 'right' }, { h: 'Doc. Directivo', a: 'right' }, { h: 'Otros Gastos', a: 'right' }, { h: 'Total Gasto', a: 'right' }].map(({ h, a }) => (
                  <th key={h} style={{ padding: '0.55rem 0.8rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: a, borderBottom: '1px solid var(--line-subtle)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 && <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Sin resultados para «{search}»</td></tr>}
              {paginated.map((ee, i) => (
                <tr key={`${ee.rbd}-${ee.nom_rbd}`} style={{ borderBottom: '1px solid var(--line-subtle)', background: i % 2 === 0 ? 'transparent' : 'var(--surface-overlay)' }}>
                  <td style={{ padding: '0.45rem 0.8rem', color: C.axisLabel, fontFamily: 'monospace', fontSize: '0.76rem' }}>{ee.rbd || 'N/A'}</td>
                  <td style={{ padding: '0.45rem 0.8rem', color: 'var(--text-primary)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><span title={ee.nom_rbd}>{ee.nom_rbd}</span></td>
                  <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: '#10b981' }}>{fmtAmt(ee.gasto_docaul)}</td>
                  <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: '#3b82f6' }}>{fmtAmt(ee.gasto_asipar)}</td>
                  <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: '#f59e0b' }}>{fmtAmt(ee.gasto_docdir)}</td>
                  <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: C.axisLabel }}>{fmtAmt(ee.gasto_otros)}</td>
                  <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: '#8b5cf6', fontWeight: 700 }}>{fmtAmt(ee.total_gasto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }
  if (widgetFilter === 'eg_gasto_adm_graficos') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
        <div className="chart-card">
          <h3 className="chart-title">Top 10 — Gasto por Tipo de Función (FUN)</h3>
          {gasto_por_funcion.length === 0
            ? <p style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>Sin datos.</p>
            : <ReactECharts option={barOption} style={{ height: Math.max(280, gasto_por_funcion.length * 38) }} />
          }
        </div>
        <div className="chart-card">
          <h3 className="chart-title">Top 10 — Gasto por Cuenta Alias</h3>
          {gasto_por_cuenta.length === 0
            ? <p style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>Sin datos.</p>
            : <ReactECharts option={pieOption} style={{ height: 300 }} />
          }
        </div>
      </div>
    )
  }

  return (
    <>
      <SqlViewer sql={sqlStr} />
      <div className="alert-info" style={{ padding: '10px 16px', borderRadius: 10, fontSize: '0.82rem', marginBottom: 12 }}>
        ℹ️ <strong>Metodología:</strong> Nivel de Gasto Administrativo = (Gasto en cuentas de Administración / Gasto Total) × 100.
      </div>
      <WidgetWrapper widgetKey="eg_gasto_adm_kpis">
        <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
          <KPICard icon="💼" label="Gasto Total Remuneracional" value={fmtAmt(resumen.total_gasto)} color="#8b5cf6" />
          <KPICard icon="🏢" label="Centros de Costo" value={fmtN(resumen.centros)} color="#3b82f6" sub="Establec. + Adm. Central" />
          <KPICard icon="👨‍🏫" label="Gasto Docentes de Aula" value={fmtAmt(resumen.total_docaul)} color="#10b981" sub="Función DOCAUL" />
          <KPICard icon="📊" label="Promedio por Centro" value={fmtAmt(resumen.centros ? resumen.total_gasto / resumen.centros : 0)} color="#f59e0b" />
        </div>
      </WidgetWrapper>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input type="text" placeholder="🔍 Buscar por nombre de establecimiento o RBD..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inpSt, minWidth: 280 }} />
        {search && <button onClick={() => setSearch('')} style={pgBtn(false)}>✕ Limpiar</button>}

        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Mostrando <b style={{ color: C.axisLabel }}>{filtered.length === 0 ? 0 : (safePage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(safePage * ITEMS_PER_PAGE, filtered.length)}</b> de <b style={{ color: C.axisLabel }}>{filtered.length}</b>
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button disabled={safePage <= 1} onClick={() => setPage(p => p - 1)} style={pgBtn(safePage <= 1)}>← Anterior</button>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', minWidth: 56, textAlign: 'center' }}>{safePage} / {totalPages}</span>
          <button disabled={safePage >= totalPages} onClick={() => setPage(p => p + 1)} style={pgBtn(safePage >= totalPages)}>Siguiente →</button>
        </div>
      </div>

      <WidgetWrapper widgetKey="eg_gasto_adm_tabla">
        <div className="chart-card" style={{ padding: 0, marginBottom: '1.5rem' }}>
          <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--line-subtle)' }}>
            <h3 className="chart-title" style={{ margin: 0 }}>Distribución Remuneracional por RBD — {periodo} ({fmtN(filtered.length)} resultados)</h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: 'var(--surface-overlay)' }}>
                  {[{ h: 'RBD', a: 'left' }, { h: 'Establecimiento', a: 'left' }, { h: 'Doc. Aula', a: 'right' }, { h: 'Asist. Parvularia', a: 'right' }, { h: 'Doc. Directivo', a: 'right' }, { h: 'Otros Gastos', a: 'right' }, { h: 'Total Gasto', a: 'right' }].map(({ h, a }) => (
                    <th key={h} style={{ padding: '0.55rem 0.8rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: a, borderBottom: '1px solid var(--line-subtle)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 && <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Sin resultados para «{search}»</td></tr>}
                {paginated.map((ee, i) => (
                  <tr key={`${ee.rbd}-${ee.nom_rbd}`} style={{ borderBottom: '1px solid var(--line-subtle)', background: i % 2 === 0 ? 'transparent' : 'var(--surface-overlay)' }}>
                    <td style={{ padding: '0.45rem 0.8rem', color: C.axisLabel, fontFamily: 'monospace', fontSize: '0.76rem' }}>{ee.rbd || 'N/A'}</td>
                    <td style={{ padding: '0.45rem 0.8rem', color: 'var(--text-primary)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span title={ee.nom_rbd}>{ee.nom_rbd}</span>
                    </td>
                    <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: '#10b981', fontVariantNumeric: 'tabular-nums' }}>{fmtAmt(ee.gasto_docaul)}</td>
                    <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: '#3b82f6', fontVariantNumeric: 'tabular-nums' }}>{fmtAmt(ee.gasto_asipar)}</td>
                    <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: '#f59e0b', fontVariantNumeric: 'tabular-nums' }}>{fmtAmt(ee.gasto_docdir)}</td>
                    <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: C.axisLabel, fontVariantNumeric: 'tabular-nums' }}>{fmtAmt(ee.gasto_otros)}</td>
                    <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: '#8b5cf6', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtAmt(ee.total_gasto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--line-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{filtered.length === 0 ? 0 : (safePage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(safePage * ITEMS_PER_PAGE, filtered.length)} de {filtered.length}</span>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <button disabled={safePage <= 1} onClick={() => setPage(p => p - 1)} style={pgBtn(safePage <= 1)}>← Anterior</button>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', minWidth: 60, textAlign: 'center' }}>Pág. {safePage} / {totalPages}</span>
              <button disabled={safePage >= totalPages} onClick={() => setPage(p => p + 1)} style={pgBtn(safePage >= totalPages)}>Siguiente →</button>
            </div>
          </div>
        </div>
      </WidgetWrapper>

      <WidgetWrapper widgetKey="eg_gasto_adm_graficos">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
          <div className="chart-card">
            <h3 className="chart-title">Top 10 — Gasto por Tipo de Función (FUN)</h3>
            {gasto_por_funcion.length === 0
              ? <p style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>Sin datos.</p>
              : <ReactECharts option={barOption} style={{ height: Math.max(280, gasto_por_funcion.length * 38) }} />
            }
          </div>
          <div className="chart-card">
            <h3 className="chart-title">Top 10 — Gasto por Cuenta Alias</h3>
            {gasto_por_cuenta.length === 0
              ? <p style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>Sin datos.</p>
              : <ReactECharts option={pieOption} style={{ height: 300 }} />
            }
          </div>
        </div>
      </WidgetWrapper>
    </>
  )
}


// ── Tab: Sostenibilidad ────────────────────────────────────────────────────────
function TabSostenibilidad({ rdbData, periodo, widgetFilter = null }) {
  const C = useChartColors()
  if (!rdbData) return null
  const { fmtAmt, fmtAxisAmt, unitLabel } = useMoneyFmt()
  const { financiero_rbd = [], remuneraciones_rbd = [] } = rdbData
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  const merged = financiero_rbd.map(f => {
    const rem = remuneraciones_rbd.find(r => r.rbd === f.rbd)
    const ingreso = Number(f.ingreso) || 0
    const total_liq = Number(rem?.total_liquido) || 0
    const ratio = ingreso > 0 ? Math.round(total_liq / ingreso * 10000) / 100 : null
    return {
      rbd: f.rbd, nom_rbd: f.nom_rbd ?? rem?.nom_rbd,
      ingreso, total_liq, funcionarios: Number(rem?.funcionarios) || 0, ratio,
      nivel_ratio: ratio === null ? 'Sin datos' : ratio > 70 ? 'Crítico' : ratio > 50 ? 'Moderado' : 'Saludable',
    }
  }).filter(d => d.ingreso > 0).sort((a, b) => (b.ratio ?? -1) - (a.ratio ?? -1))

  const filterText = search.toLowerCase().trim()
  const filtered = filterText ? merged.filter(d => (d.nom_rbd ?? '').toLowerCase().includes(filterText)) : merged
  const totalPages = Math.ceil(filtered.length / 10) || 1
  const safePage = Math.min(page, totalPages - 1)
  const visible = filtered.slice(safePage * 10, (safePage + 1) * 10)
  const names = visible.map(d => shortName(d.nom_rbd, d.rbd))
  const h = Math.max(320, visible.length * 36)
  useEffect(() => { setPage(0) }, [search])

  const ratioOption = {
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' }, ...C.tooltip,
      formatter: params => {
        const d = visible[params[0].dataIndex]
        return `<b>${shortName(d.nom_rbd, d.rbd)}</b><br/>
          Remuneraciones: ${fmtAmt(d.total_liq)}<br/>Ingresos: ${fmtAmt(d.ingreso)}<br/>
          Ratio: <b>${d.ratio != null ? d.ratio + '%' : 'N/D'}</b> — ${d.nivel_ratio}`
      }
    },
    grid: { left: 260, right: 80, top: 20, bottom: 20 },
    xAxis: { type: 'value', axisLabel: { color: C.axisLabel, formatter: v => `${v}%` }, splitLine: { lineStyle: { color: C.splitLine } } },
    yAxis: { type: 'category', data: names, axisLabel: { color: C.axisLabel, fontSize: 10, width: 250, overflow: 'truncate' } },
    series: [{
      type: 'bar', barMaxWidth: 16,
      data: visible.map(d => ({ value: d.ratio, itemStyle: { color: d.nivel_ratio === 'Crítico' ? '#ef4444' : d.nivel_ratio === 'Moderado' ? '#f59e0b' : '#10b981', borderRadius: [0, 4, 4, 0] } })),
      markLine: {
        silent: true, data: [
          { xAxis: 50, lineStyle: { color: '#f59e0b', type: 'dashed' }, label: { formatter: '50%', color: '#f59e0b', fontSize: 10 } },
          { xAxis: 70, lineStyle: { color: '#ef4444', type: 'dashed' }, label: { formatter: '70%', color: '#ef4444', fontSize: 10 } },
        ]
      },
    }],
    backgroundColor: 'transparent',
  }

  const scatterOption = {
    tooltip: {
      trigger: 'item', ...C.tooltip,
      formatter: p => { const d = merged[p.dataIndex]; return `<b>${shortName(d.nom_rbd, d.rbd)}</b><br/>Funcionarios: ${fmtN(d.funcionarios)}<br/>Ingresos: ${fmtAmt(d.ingreso)}<br/>Ratio: ${d.ratio ?? 'N/D'}%` }
    },
    grid: { left: 80, right: 20, top: 20, bottom: 40 },
    xAxis: { name: 'Funcionarios', type: 'value', axisLabel: { color: C.axisLabel }, splitLine: { lineStyle: { color: C.splitLine } } },
    yAxis: { name: `Ingresos (${unitLabel})`, type: 'value', axisLabel: { color: C.axisLabel, formatter: v => fmtAxisAmt(v) }, splitLine: { lineStyle: { color: C.splitLine } } },
    series: [{ type: 'scatter', data: merged.map(d => [d.funcionarios, d.ingreso]), symbolSize: 10, itemStyle: { color: '#8b5cf6', opacity: 0.8 } }],
    backgroundColor: 'transparent',
  }

  const criticos = merged.filter(d => d.nivel_ratio === 'Crítico').length
  const moderados = merged.filter(d => d.nivel_ratio === 'Moderado').length
  const saludables = merged.filter(d => d.nivel_ratio === 'Saludable').length
  const promRatio = merged.filter(d => d.ratio != null).reduce((s, d) => s + d.ratio, 0) / (merged.filter(d => d.ratio != null).length || 1)

  const pgBtnS = (dis) => ({ padding: '0.3rem 0.75rem', border: '1px solid var(--line-subtle)', borderRadius: '0.375rem', background: dis ? 'var(--surface-base)' : 'var(--surface-overlay)', color: dis ? 'var(--text-muted)' : 'var(--text-primary)', cursor: dis ? 'not-allowed' : 'pointer', fontSize: '0.8rem' })
  const inpStS = { padding: '0.35rem 0.75rem', backgroundColor: 'var(--surface-base)', color: 'var(--text-primary)', border: '1px solid var(--line-subtle)', borderRadius: '0.375rem', fontSize: '0.8rem', minWidth: 220 }

  const sqlStr = `SELECT
    r.rbd,
    eo.nom_rbd,
    COUNT(DISTINCT r.rut) AS funcionarios,
    SUM(r.liquido) AS total_liquido,
    ROUND(AVG(r.liquido), 0) AS promedio_liquido
FROM remuneraciones r
JOIN dim_establecimiento_oficial eo ON eo.rbd = r.rbd AND eo.agno = r.anio
WHERE r.sostenedor = :sid
  AND r.anio = :per
GROUP BY r.rbd, eo.nom_rbd
ORDER BY total_liquido DESC`

  // ── Early return para el tab Resumen ─────────────────────────────────────
  if (widgetFilter === 'sr_sostenibilidad_ratio') {
    return (
      <div className="chart-card" style={{ marginBottom: '1.25rem' }}>
        <h3 className="chart-title">Ratio Remuneraciones / Ingresos por Establecimiento (%) — {periodo}</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '0.5rem' }}>
          <span style={{ color: '#10b981' }}>■</span> Saludable &lt;50% &nbsp;<span style={{ color: '#f59e0b' }}>■</span> Moderado 50–70% &nbsp;<span style={{ color: '#ef4444' }}>■</span> Crítico &gt;70%
        </p>
        {visible.length === 0
          ? <p style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>Sin resultados.</p>
          : <ReactECharts option={ratioOption} style={{ height: h }} />
        }
      </div>
    )
  }
  if (widgetFilter === 'sr_sostenibilidad_scatter') {
    return (
      <div className="chart-card">
        <h3 className="chart-title">Funcionarios vs Ingresos por Establecimiento — {periodo}</h3>
        <ReactECharts option={scatterOption} style={{ height: 320 }} />
      </div>
    )
  }

  return (
    <>
      <SqlViewer sql={sqlStr} />
      <div className="alert-info" style={{ padding: '10px 16px', borderRadius: 10, fontSize: '0.82rem', marginBottom: 12 }}>
        ℹ️ <strong>Metodología:</strong> Análisis de la sostenibilidad financiera evaluando la proporción del Gasto en Remuneraciones frente a los Ingresos.
      </div>
      <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
        <KPICard icon="📊" label="Ratio Prom. Rem/Ingreso" value={`${promRatio.toFixed(1)}%`} color={promRatio > 70 ? '#ef4444' : promRatio > 50 ? '#f59e0b' : '#10b981'} />
        <KPICard icon="✅" label="EE Saludables (<50%)" value={fmtN(saludables)} color="#10b981" />
        <KPICard icon="🟡" label="EE Moderados (50–70%)" value={fmtN(moderados)} color="#f59e0b" />
        <KPICard icon="🔴" label="EE Críticos (>70%)" value={fmtN(criticos)} color="#ef4444" />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input type="text" placeholder="🔍 Buscar por nombre de establecimiento..." value={search} onChange={e => setSearch(e.target.value)} style={inpStS} />
        {search && <button onClick={() => setSearch('')} style={pgBtnS(false)}>✕ Limpiar</button>}
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Mostrando <b style={{ color: C.axisLabel }}>{filtered.length === 0 ? 0 : safePage * 10 + 1}–{Math.min((safePage + 1) * 10, filtered.length)}</b> de <b style={{ color: C.axisLabel }}>{filtered.length}</b> establecimientos</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button disabled={safePage === 0} onClick={() => setPage(p => p - 1)} style={pgBtnS(safePage === 0)}>← Anterior</button>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', minWidth: 56, textAlign: 'center' }}>{safePage + 1} / {totalPages}</span>
          <button disabled={safePage >= totalPages - 1} onClick={() => setPage(p => p + 1)} style={pgBtnS(safePage >= totalPages - 1)}>Siguiente →</button>
        </div>
      </div>
      <WidgetWrapper widgetKey="sr_sostenibilidad_ratio">
        <div className="chart-card" style={{ marginBottom: '1.25rem' }}>
          <h3 className="chart-title">Ratio Remuneraciones / Ingresos por Establecimiento (%) — {periodo}</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '0.5rem' }}>
            <span style={{ color: '#10b981' }}>■</span> Saludable &lt;50% &nbsp;<span style={{ color: '#f59e0b' }}>■</span> Moderado 50–70% &nbsp;<span style={{ color: '#ef4444' }}>■</span> Crítico &gt;70%
          </p>
          {visible.length === 0 ? <p style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>Sin resultados para «{search}»</p> : <ReactECharts option={ratioOption} style={{ height: h }} />}
        </div>
      </WidgetWrapper>
      <WidgetWrapper widgetKey="sr_sostenibilidad_scatter">
        <div className="chart-card">
          <h3 className="chart-title">Funcionarios vs Ingresos por Establecimiento — {periodo}</h3>
          <ReactECharts option={scatterOption} style={{ height: 320 }} />
        </div>
      </WidgetWrapper>
    </>
  )
}

// ── Tab: Riesgo ────────────────────────────────────────────────────────────────
function TabRiesgo({ rdbData, periodo, widgetFilter = null }) {
  const C = useChartColors()
  const [searchTerm, setSearchTerm] = useState('')
  const [riesgoFilter, setRiesgoFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [chartPage, setChartPage] = useState(0)
  const { fmtAmt, fmtAxisAmt, unitLabel } = useMoneyFmt()
  const ITEMS_PER_PAGE = 10

  useEffect(() => {
    setCurrentPage(1)
    setSearchTerm('')
    setRiesgoFilter('all')
    setChartPage(0)
  }, [rdbData, periodo])

  useEffect(() => { setChartPage(0) }, [searchTerm])

  if (!rdbData) return null
  const { acreditacion_rbd = [] } = rdbData
  const sorted = [...acreditacion_rbd].sort((a, b) => Number(a.pct_rendido) - Number(b.pct_rendido))

  // Chart-level filter + pagination using searchTerm
  const chartFilterText = searchTerm.toLowerCase()
  const chartFiltered = chartFilterText ? sorted.filter(d => (d.nom_rbd ?? '').toLowerCase().includes(chartFilterText)) : sorted
  const chartTotalPages = Math.ceil(chartFiltered.length / 10) || 1
  const chartSafePage = Math.min(chartPage, chartTotalPages - 1)
  const chartVisible = chartFiltered.slice(chartSafePage * 10, (chartSafePage + 1) * 10)
  const names = chartVisible.map(d => shortName(d.nom_rbd, d.rbd))
  const h = Math.max(320, chartVisible.length * 36)

  const acredOption = {
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' }, ...C.tooltip,
      formatter: params => {
        const d = chartVisible[params[0].dataIndex]
        return `<b>${d.nom_rbd ?? `RBD ${d.rbd}`}</b> (${d.rbd})<br/>
          ✅ Rendido: ${Number(d.pct_rendido).toFixed(1)}% (${fmtAmt(d.monto_rendido)})<br/>
          ❌ No rendido: ${Number(d.pct_no_rendido).toFixed(1)}% (${fmtAmt(d.monto_no_rendido)})<br/>
          Total: ${fmtAmt(d.monto_total)} — <b>${d.nivel_riesgo}</b>`
      }
    },
    legend: { data: ['% Rendido', '% No Rendido'], textStyle: { color: C.axisLabel }, top: 0 },
    grid: { left: 260, right: 80, top: 40, bottom: 20 },
    xAxis: { type: 'value', max: 100, axisLabel: { color: C.axisLabel, formatter: v => `${v}%` }, splitLine: { lineStyle: { color: C.splitLine } } },
    yAxis: { type: 'category', data: names, axisLabel: { color: C.axisLabel, fontSize: 10, width: 250, overflow: 'truncate' } },
    series: [
      {
        name: '% Rendido', type: 'bar', stack: 'pct', barMaxWidth: 16,
        data: chartVisible.map(d => ({ value: Number(d.pct_rendido), itemStyle: { color: RIESGO_COLORS[d.nivel_riesgo] ?? '#10b981' } }))
      },
      {
        name: '% No Rendido', type: 'bar', stack: 'pct', barMaxWidth: 16,
        data: chartVisible.map(d => Number(d.pct_no_rendido)), itemStyle: { color: 'var(--surface-overlay)' }
      },
    ],
    backgroundColor: 'transparent',
  }

  const topProb = [...acreditacion_rbd].filter(d => Number(d.monto_no_rendido) > 0)
    .sort((a, b) => Number(b.monto_no_rendido) - Number(a.monto_no_rendido)).slice(0, 20)

  const montoOpt = topProb.length > 0 ? {
    tooltip: { trigger: 'axis', ...C.tooltip, formatter: params => { const d = topProb[params[0].dataIndex]; return `<b>${d.nom_rbd ?? `RBD ${d.rbd}`}</b><br/>No rendido: <b style="color:#ef4444">${fmtAmt(d.monto_no_rendido)}</b>` } },
    grid: { left: 260, right: 100, top: 20, bottom: 20 },
    xAxis: { type: 'value', axisLabel: { color: C.axisLabel, formatter: v => fmtAxisAmt(v) }, splitLine: { lineStyle: { color: C.splitLine } } },
    yAxis: { type: 'category', data: topProb.map(d => shortName(d.nom_rbd, d.rbd)), axisLabel: { color: C.axisLabel, fontSize: 10, width: 250, overflow: 'truncate' } },
    series: [{
      type: 'bar', barMaxWidth: 16,
      data: topProb.map(d => ({ value: Number(d.monto_no_rendido), itemStyle: { color: RIESGO_COLORS[d.nivel_riesgo] ?? '#ef4444', borderRadius: [0, 4, 4, 0] } })),
      label: { show: true, position: 'right', formatter: p => fmtAmt(p.value), fontSize: 9 },
    }],
    backgroundColor: 'transparent',
  } : null

  const bajos = sorted.filter(d => d.nivel_riesgo === 'Riesgo Bajo').length
  const moderados = sorted.filter(d => d.nivel_riesgo === 'Riesgo Moderado').length
  const altos = sorted.filter(d => d.nivel_riesgo === 'Riesgo Alto').length
  const totalNR = sorted.reduce((s, d) => s + Number(d.monto_no_rendido), 0)
  const peorEE = sorted[0]

  const filterText = searchTerm.toLowerCase()
  const tableData = [...acreditacion_rbd]
    .sort((a, b) => Number(a.pct_rendido) - Number(b.pct_rendido))
    .filter(d => {
      const matchName = (d.nom_rbd || '').toLowerCase().includes(filterText)
      const matchRiesgo = riesgoFilter === 'all' ? true : d.nivel_riesgo === riesgoFilter
      return matchName && matchRiesgo
    })

  const inputStyle = { padding: '0.4rem 0.8rem', backgroundColor: 'var(--surface-overlay)', color: 'var(--text-primary)', border: '1px solid var(--line-subtle)', borderRadius: '0.375rem', fontSize: '0.8rem' };

  const totalPages = Math.ceil(tableData.length / ITEMS_PER_PAGE)
  const paginatedData = tableData.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  const sqlStr = `SELECT
    er.rbd,
    eo.nom_rbd,
    COALESCE(docs.total_docs, 0) AS total_docs,
    SUM(er.monto_declarado) AS monto_total,
    COALESCE(SUM(er.monto_declarado) FILTER (
        WHERE UPPER(TRIM(er.desc_estado)) = 'RENDIDO'
    ), 0) AS monto_rendido,
    COALESCE(SUM(er.monto_declarado) FILTER (
        WHERE UPPER(TRIM(er.desc_estado)) != 'RENDIDO'
    ), 0) AS monto_no_rendido,
    ROUND(100.0 * COALESCE(SUM(er.monto_declarado) FILTER (
        WHERE UPPER(TRIM(er.desc_estado)) = 'RENDIDO'
    ), 0) / NULLIF(SUM(er.monto_declarado), 0), 1) AS pct_rendido,
    ROUND(100.0 * COALESCE(SUM(er.monto_declarado) FILTER (
        WHERE UPPER(TRIM(er.desc_estado)) != 'RENDIDO'
    ), 0) / NULLIF(SUM(er.monto_declarado), 0), 1) AS pct_no_rendido
FROM estado_resultado er
JOIN dim_establecimiento_oficial eo ON eo.rbd = er.rbd AND eo.agno = er.periodo
LEFT JOIN (
    SELECT rbd, COUNT(*) AS total_docs
    FROM documentos
    WHERE sost_id = :sid
      AND periodo = :per
    GROUP BY rbd
) docs ON docs.rbd = er.rbd
WHERE er.sost_id = :sid
  AND er.periodo = :per
GROUP BY er.rbd, eo.nom_rbd, docs.total_docs
HAVING SUM(er.monto_declarado) > 0
ORDER BY pct_rendido ASC NULLS LAST`

  // ── Early return para el tab Resumen ─────────────────────────────────────
  if (widgetFilter === 'sr_acreditacion_grafico') {
    return (
      <div className="chart-card" style={{ marginBottom: '1.25rem' }}>
        <h3 className="chart-title">Acreditación de Saldos por Establecimiento (%) — {periodo}</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '0.5rem' }}>Ordenado por % rendido ascendente.</p>
        {chartVisible.length === 0
          ? <p style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>Sin resultados.</p>
          : <ReactECharts option={acredOption} style={{ height: h }} />
        }
      </div>
    )
  }
  if (widgetFilter === 'sr_acreditacion_monto') {
    return montoOpt
      ? (
        <div className="chart-card" style={{ marginBottom: '1.25rem' }}>
          <h3 className="chart-title">Top 20 — Monto No Rendido por Establecimiento ({unitLabel}) — {periodo}</h3>
          <ReactECharts option={montoOpt} style={{ height: 520 }} />
        </div>
      )
      : <div style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>Sin datos de monto no rendido.</div>
  }

  return (
    <>
      <SqlViewer sql={sqlStr} />
      <div className="alert-info" style={{ padding: '10px 16px', borderRadius: 10, fontSize: '0.82rem', marginBottom: 12 }}>
        ℹ️ <strong>Metodología:</strong> Porcentaje de Acreditación = (Monto Rendido / Monto Total Declarado) × 100.
      </div>
      <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
        <KPICard icon="✅" label="EE Riesgo Bajo" value={fmtN(bajos)} color="#10b981" sub="≥90% rendido" />
        <KPICard icon="🟡" label="EE Riesgo Moderado" value={fmtN(moderados)} color="#f59e0b" sub="70–90% rendido" />
        <KPICard icon="🔴" label="EE Riesgo Alto" value={fmtN(altos)} color="#ef4444" sub="<70% rendido" />
        <KPICard icon="💸" label="Total No Rendido" value={fmtAmt(totalNR)} color={totalNR > 0 ? '#ef4444' : '#10b981'}
          sub={peorEE ? `Más bajo: ${shortName(peorEE.nom_rbd, peorEE.rbd)} (${Number(peorEE.pct_rendido).toFixed(0)}%)` : ''} />
      </div>
      <WidgetWrapper widgetKey="sr_acreditacion_grafico">
        <div className="chart-card" style={{ marginBottom: '1.25rem' }}>
          <h3 className="chart-title">Acreditación de Saldos por Establecimiento (%) — {periodo}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Ordenado por % rendido ascendente. <span style={{ color: '#10b981' }}>■</span> Rendido &nbsp;<span style={{ color: 'var(--surface-overlay)', border: '1px solid var(--line-subtle)', display: 'inline-block', width: 10, height: 10, verticalAlign: 'middle' }}></span> No rendido</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Mostrando <b style={{ color: C.axisLabel }}>{chartFiltered.length === 0 ? 0 : chartSafePage * 10 + 1}–{Math.min((chartSafePage + 1) * 10, chartFiltered.length)}</b> de <b style={{ color: C.axisLabel }}>{chartFiltered.length}</b></span>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <button disabled={chartSafePage === 0} onClick={() => setChartPage(p => p - 1)} style={{ padding: '0.3rem 0.6rem', border: '1px solid var(--line-subtle)', borderRadius: '0.375rem', background: chartSafePage === 0 ? 'var(--surface-base)' : 'var(--surface-overlay)', color: chartSafePage === 0 ? 'var(--text-muted)' : 'var(--text-primary)', cursor: chartSafePage === 0 ? 'not-allowed' : 'pointer', fontSize: '0.78rem' }}>← Anterior</button>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', minWidth: 56, textAlign: 'center' }}>{chartSafePage + 1} / {chartTotalPages}</span>
              <button disabled={chartSafePage >= chartTotalPages - 1} onClick={() => setChartPage(p => p + 1)} style={{ padding: '0.3rem 0.6rem', border: '1px solid var(--line-subtle)', borderRadius: '0.375rem', background: chartSafePage >= chartTotalPages - 1 ? 'var(--surface-base)' : 'var(--surface-overlay)', color: chartSafePage >= chartTotalPages - 1 ? 'var(--text-muted)' : 'var(--text-primary)', cursor: chartSafePage >= chartTotalPages - 1 ? 'not-allowed' : 'pointer', fontSize: '0.78rem' }}>Siguiente →</button>
            </div>
          </div>
          {chartVisible.length === 0 ? <p style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>Sin resultados para «{searchTerm}»</p> : <ReactECharts option={acredOption} style={{ height: h }} />}
        </div>
      </WidgetWrapper>
      {montoOpt && (
        <WidgetWrapper widgetKey="sr_acreditacion_monto">
          <div className="chart-card" style={{ marginBottom: '1.25rem' }}>
            <h3 className="chart-title">Top 20 — Monto No Rendido por Establecimiento ({unitLabel}) — {periodo}</h3>
            <ReactECharts option={montoOpt} style={{ height: 520 }} />
          </div>
        </WidgetWrapper>
      )}

      <div className="chart-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <h3 className="chart-title" style={{ margin: 0 }}>Detalle de Acreditación por Establecimiento ({fmtN(tableData.length)} resultados)</h3>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input type="text" placeholder="Buscar Nombre..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} style={{ ...inputStyle, minWidth: '180px' }} />
            <select value={riesgoFilter} onChange={e => { setRiesgoFilter(e.target.value); setCurrentPage(1); }} style={inputStyle}>
              <option value="all">Todos los Niveles</option>
              <option value="Riesgo Bajo">Riesgo Bajo</option>
              <option value="Riesgo Moderado">Riesgo Moderado</option>
              <option value="Riesgo Alto">Riesgo Alto</option>
            </select>
          </div>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr><th>RBD</th><th>Establecimiento</th><th>Docs</th><th>Monto Total</th><th>Monto Rendido</th><th>No Rendido</th><th>% Rendido</th><th>Nivel Riesgo</th></tr>
            </thead>
            <tbody>
              {paginatedData.map(d => {
                const c = RIESGO_COLORS[d.nivel_riesgo] ?? '#10b981'
                return (
                  <tr key={d.rbd}>
                    <td style={{ fontFamily: 'monospace', color: C.axisLabel, fontSize: '0.78rem' }}>{d.rbd}</td>
                    <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.nom_rbd ?? `RBD ${d.rbd}`}</td>
                    <td>{fmtN(d.total_docs)}</td>
                    <td style={{ color: '#6366f1' }}>{fmtAmt(d.monto_total)}</td>
                    <td style={{ color: '#10b981' }}>{fmtAmt(d.monto_rendido)}</td>
                    <td style={{ color: Number(d.monto_no_rendido) > 0 ? '#ef4444' : '#10b981' }}>{fmtAmt(d.monto_no_rendido)}</td>
                    <td><strong style={{ color: c }}>{Number(d.pct_rendido).toFixed(1)}%</strong></td>
                    <td><span style={{ color: c, fontWeight: 600, fontSize: '0.72rem', background: `${c}22`, border: `1px solid ${c}`, borderRadius: 999, padding: '0.15rem 0.5rem' }}>{d.nivel_riesgo}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '1rem 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            Mostrando {tableData.length === 0 ? 0 : ((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, tableData.length)} de {tableData.length}
          </span>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
              style={{ padding: '0.3rem 0.6rem', border: '1px solid var(--line-subtle)', background: currentPage === 1 ? 'var(--surface-base)' : 'var(--surface-overlay)', color: currentPage === 1 ? 'var(--text-disabled)' : 'var(--text-primary)', borderRadius: '0.375rem', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
            >
              Anterior
            </button>
            <span style={{ padding: '0.3rem 0.6rem', color: C.axisLabel, fontSize: '0.85rem' }}>
              Página {currentPage} de {totalPages || 1}
            </span>
            <button
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage(prev => prev + 1)}
              style={{ padding: '0.3rem 0.6rem', border: '1px solid var(--line-subtle)', background: (currentPage === totalPages || totalPages === 0) ? 'var(--surface-base)' : 'var(--surface-overlay)', color: (currentPage === totalPages || totalPages === 0) ? 'var(--text-disabled)' : 'var(--text-primary)', borderRadius: '0.375rem', cursor: (currentPage === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer' }}
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>
    </>
  )
}


// ── Tab: Sostenibilidad y Riesgo (con sub-tabs) ─────────────────────────────────────
function TabSostenibilidadRiesgo({ rdbData, periodo, sostId }) {
  const [subTab, setSubTab] = useState(
    () => localStorage.getItem('pirgefse-fichasost-sostenibilidad-riesgo') || 'acreditacion'
  )
  useEffect(() => {
    localStorage.setItem('pirgefse-fichasost-sostenibilidad-riesgo', subTab)
  }, [subTab])
  useEffect(() => {
    const handler = (e) => { if (e.detail.key === 'pirgefse-fichasost-sostenibilidad-riesgo') setSubTab(e.detail.val) }
    window.addEventListener('pirgefse-subtab', handler)
    return () => window.removeEventListener('pirgefse-subtab', handler)
  }, [])

  const SUB_TABS = [
    { key: 'acreditacion', label: 'Acreditación de Saldos', icon: '📊', color: '#6366f1' },
    { key: 'sostenibilidad', label: 'Sostenibilidad Rem./Ingreso', icon: '🛡️', color: '#10b981' },
    { key: 'hhi', label: 'HHI de Fuentes de Ingreso', icon: '💰', color: '#f59e0b' },
  ]

  return (
    <div>
      {/* Sub-tab bar */}
      <div style={{
        display: 'flex', gap: '0.5rem', marginBottom: '1.5rem',
        borderBottom: '2px solid var(--line-subtle)', paddingBottom: '0',
      }}>
        {SUB_TABS.map(t => {
          const active = subTab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setSubTab(t.key)}
              style={{
                padding: '0.55rem 1.1rem',
                borderRadius: '0.375rem 0.375rem 0 0',
                fontWeight: 600,
                fontSize: '0.88rem',
                background: active ? t.color : 'transparent',
                color: active ? '#fff' : 'var(--text-muted)',
                border: 'none',
                borderBottom: active ? `2px solid ${t.color}` : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.18s',
                marginBottom: '-2px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <span>{t.icon}</span> {t.label}
            </button>
          )
        })}
      </div>

      {subTab === 'acreditacion' && <TabRiesgo rdbData={rdbData} periodo={periodo} />}
      {subTab === 'sostenibilidad' && <TabSostenibilidad rdbData={rdbData} periodo={periodo} />}
      {subTab === 'hhi' && <RenderHHISostenedor sostId={sostId} periodo={periodo} />}
    </div>
  )
}

// ── Sub-tab: HHI de Fuentes de Ingreso (vista sostenedor) ───────────────────
const HHI_COLOR_MAP = {
  'Concentración Baja': '#10b981',
  'Concentración Moderada': '#f59e0b',
  'Concentración Alta': '#ef4444',
}
const FUENTE_COLOR_SOST = {
  GENERAL: '#6366f1', SEP: '#10b981', PIE: '#f59e0b', ACG: '#06b6d4',
  MANTENIMIENTO: '#8b5cf6', PRORETENCION: '#ec4899', INTERNADO: '#14b8a6', AC: '#f97316',
}
const FUENTE_COLOR_DEF = ['#84cc16', '#a78bfa', '#fb923c', '#38bdf8', '#fb7185']
function getFColor(alias, i) { return FUENTE_COLOR_SOST[alias] ?? FUENTE_COLOR_DEF[i % FUENTE_COLOR_DEF.length] }
function hhiLabel(hhi) {
  if (hhi < 1500) return { label: 'Concentración Baja', color: '#10b981', icon: '🟢' }
  if (hhi < 2500) return { label: 'Concentración Moderada', color: '#f59e0b', icon: '🟡' }
  return { label: 'Concentración Alta', color: '#ef4444', icon: '🔴' }
}

function RenderHHISostenedor({ sostId, periodo, widgetFilter = null }) {
  const { fmtAmt } = useMoneyFmt()
  const C = useChartColors()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const sid = sostId ?? 69110400

  useEffect(() => {
    setLoading(true)
    const p = periodo ? `&periodo=${periodo}` : ''
    api.get(`/dashboard/hhi-fuentes-sostenedor?sost_id=${sid}${p}`)
      .then(r => setData(r.data))
      .finally(() => setLoading(false))
  }, [sid, periodo])

  if (loading) return <div className="loading-area"><div className="spinner" /></div>
  if (!data || data.hhi_serie.length === 0)
    return <div className="empty-state" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
      Sin datos HHI para este sostenedor.
    </div>

  const { hhi_serie, fuentes, avg_hhi, ultimo } = data
  const anios = hhi_serie.map(d => d.periodo)
  const hLabel = hhiLabel(avg_hhi)
  const ulLabel = ultimo ? hhiLabel(Number(ultimo.hhi)) : hLabel

  // ── Torta de fuentes (último período disponible)
  const pieFuentesOpt = {
    tooltip: {
      trigger: 'item',
      formatter: p => `${p.name}<br/>${fmtAmt(p.value)}<br/><b>${p.percent}%</b> del ingreso total`,
      backgroundColor: 'var(--surface-raised)', borderColor: 'var(--line-subtle)',
      textStyle: { color: 'var(--text-primary)' },
    },
    legend: { orient: 'vertical', right: 10, top: 'center', textStyle: { color: C.axisLabel, fontSize: 11 } },
    series: [{
      type: 'pie', radius: ['40%', '70%'], center: ['38%', '50%'],
      data: fuentes.map((f, i) => ({ name: f.subvencion_alias, value: Number(f.monto_total), itemStyle: { color: getFColor(f.subvencion_alias, i) } })),
      label: { show: true, formatter: p => p.percent > 3 ? `${p.percent}%` : '', fontSize: 10, color: C.axisLabel },
      itemStyle: { borderRadius: 4, borderColor: 'transparent', borderWidth: 1 },
      emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.3)' } },
    }],
    backgroundColor: 'transparent',
  }

  // ── Línea: evolución del HHI por año
  const lineHHIOpt = {
    tooltip: {
      trigger: 'axis',
      formatter: p => {
        const d = hhi_serie[p[0].dataIndex]
        const lbl = hhiLabel(Number(d.hhi))
        return `<b>${d.periodo}</b><br/>HHI: <b style="color:${lbl.color}">${Math.round(Number(d.hhi))}</b> — ${lbl.label}`
      },
      backgroundColor: 'var(--surface-raised)', borderColor: 'var(--line-subtle)',
      textStyle: { color: 'var(--text-primary)' },
    },
    grid: { left: 60, right: 20, top: 30, bottom: 40 },
    xAxis: { type: 'category', data: anios, axisLabel: { color: C.axisLabel }, axisLine: { lineStyle: { color: C.splitLine } } },
    yAxis: {
      type: 'value', min: 0, max: 10000,
      axisLabel: { color: C.axisLabel, formatter: v => fmtN(v) },
      splitLine: { lineStyle: { color: C.splitLine } },
    },
    series: [{
      type: 'line', smooth: true, symbol: 'circle', symbolSize: 8,
      data: hhi_serie.map(d => ({ value: Number(d.hhi), itemStyle: { color: hhiLabel(Number(d.hhi)).color } })),
      lineStyle: { color: '#6366f1', width: 3 },
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#6366f140' }, { offset: 1, color: 'transparent' }] } },
      markLine: {
        silent: true, data: [
          { yAxis: 1500, lineStyle: { color: '#f59e0b', type: 'dashed' }, label: { formatter: 'HHI 1.500', color: '#f59e0b', fontSize: 10 } },
          { yAxis: 2500, lineStyle: { color: '#ef4444', type: 'dashed' }, label: { formatter: 'HHI 2.500', color: '#ef4444', fontSize: 10 } },
        ],
      },
      label: { show: true, formatter: p => p.value != null ? fmtN(Math.round(p.value)) : '', color: C.axisLabel, fontSize: 10 },
    }],
    backgroundColor: 'transparent',
  }

  // ── Barras apiladas: composición de fuentes por año
  const fuentesKeys = [...new Set(
    hhi_serie.flatMap(() => fuentes.map(f => f.subvencion_alias))
  )]
  const barFuenteOpt = {
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' },
      backgroundColor: 'var(--surface-raised)', borderColor: 'var(--line-subtle)',
      textStyle: { color: 'var(--text-primary)' },
    },
    legend: { data: fuentes.map(f => f.subvencion_alias), textStyle: { color: C.axisLabel, fontSize: 10 }, top: 0, type: 'scroll' },
    grid: { left: 60, right: 20, top: 50, bottom: 40 },
    xAxis: { type: 'category', data: anios, axisLabel: { color: C.axisLabel }, axisLine: { lineStyle: { color: C.splitLine } } },
    yAxis: { type: 'value', axisLabel: { color: C.axisLabel, formatter: v => fmtAmt(v) }, splitLine: { lineStyle: { color: C.splitLine } } },
    series: fuentes.map((f, i) => ({
      name: f.subvencion_alias, type: 'bar', stack: 'fuentes', barMaxWidth: 60,
      data: anios.map(a => {
        // For multi-year view, use hhi_serie monto_total as proxy (data already aggregated by sost)
        // exact per-year per-fuente would require extra endpoint; use fuentes monto for current period
        return a === (ultimo?.periodo) ? Number(f.monto_total) : null
      }),
      itemStyle: { color: getFColor(f.subvencion_alias, i) },
    })),
    backgroundColor: 'transparent',
  }

  const sqlStr = `-- Serie temporal HHI del sostenedor
SELECT periodo, hhi, nivel_concentracion, orden_concentracion,
       n_fuentes, monto_total, fuente_principal, pct_fuente_principal
FROM mv_hhi_fuentes
WHERE sost_id = :sid AND periodo = :p
ORDER BY periodo;

-- Fuentes de ingreso del sostenedor (participación por fuente)
SELECT subvencion_alias,
       SUM(monto_declarado)  AS monto_total,
       ROUND(
           SUM(monto_declarado) * 100.0 /
           NULLIF(SUM(SUM(monto_declarado)) OVER (), 0)
       , 2) AS pct_participacion
FROM estado_resultado
WHERE sost_id = :sid
  AND periodo  = :p
  AND UPPER(TRIM(desc_tipo_cuenta)) LIKE '%INGRESO%'
  AND UPPER(TRIM(desc_estado))      = 'RENDIDO'
  AND cuenta_alias_padre LIKE '3%'
  AND subvencion_alias IS NOT NULL
  AND subvencion_alias <> ''
GROUP BY subvencion_alias
ORDER BY monto_total DESC;`

  // ── Early return para el tab Resumen ─────────────────────────────────────
  if (widgetFilter === 'sr_hhi_graficos') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
        <div className="chart-card">
          <h3 className="chart-title">Distribución de Fuentes de Ingreso</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '0.5rem' }}>Período {ultimo?.periodo ?? ''} — datos rendidos</p>
          <ReactECharts option={pieFuentesOpt} style={{ height: 320 }} />
        </div>
        <div className="chart-card">
          <h3 className="chart-title">Evolución del HHI por Año</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '0.5rem' }}>Concentración de financiamiento — serie histórica</p>
          <ReactECharts option={lineHHIOpt} style={{ height: 320 }} />
        </div>
      </div>
    )
  }
  if (widgetFilter === 'sr_hhi_fuentes') {
    return (
      <div className="chart-card">
        <h3 className="chart-title">Composición de Fuentes de Ingreso (Rendido)</h3>
        <div className="table-wrapper">
          <table className="data-table">
            <thead><tr><th>Fuente (Subvención)</th><th>Monto Total</th><th>% Participación</th></tr></thead>
            <tbody>
              {fuentes.map((f, i) => (
                <tr key={f.subvencion_alias}>
                  <td>
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: getFColor(f.subvencion_alias, i), marginRight: 8 }} />
                    {f.subvencion_alias}
                  </td>
                  <td style={{ color: '#10b981' }}>{fmtAmt(f.monto_total)}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 80, height: 6, borderRadius: 3, background: 'var(--surface-overlay)', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(Number(f.pct_participacion), 100)}%`, height: '100%', background: getFColor(f.subvencion_alias, i), borderRadius: 3 }} />
                      </div>
                      <strong style={{ color: getFColor(f.subvencion_alias, i) }}>{Number(f.pct_participacion).toFixed(1)}%</strong>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }
  if (widgetFilter === 'sr_hhi_detalle') {
    return (
      <div className="chart-card">
        <h3 className="chart-title">Detalle HHI por Período</h3>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr><th>Año</th><th>HHI</th><th>Nivel</th><th>N° Fuentes</th><th>Fuente Principal</th><th>% F. Principal</th><th>Monto Total</th></tr>
            </thead>
            <tbody>
              {[...hhi_serie].reverse().map(d => {
                const lbl = hhiLabel(Number(d.hhi))
                return (
                  <tr key={d.periodo}>
                    <td><strong>{d.periodo}</strong></td>
                    <td><strong style={{ color: lbl.color, fontSize: '1rem' }}>{fmtN(Math.round(Number(d.hhi)))}</strong></td>
                    <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `${lbl.color}20`, color: lbl.color, padding: '2px 10px', borderRadius: 999, fontSize: '0.78rem', fontWeight: 600 }}>{lbl.icon} {lbl.label}</span></td>
                    <td>{Number(d.n_fuentes).toFixed(0)}</td>
                    <td>{d.fuente_principal ?? '—'}</td>
                    <td>{d.pct_fuente_principal != null ? `${Number(d.pct_fuente_principal).toFixed(1)}%` : '—'}</td>
                    <td style={{ color: '#6366f1' }}>{fmtAmt(d.monto_total)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <>
      <SqlViewer sql={sqlStr} />
      <div className="alert-info" style={{ padding: '10px 16px', borderRadius: 10, fontSize: '0.82rem', marginBottom: 12 }}>
        ℹ️ <strong>Metodología:</strong> HHI (Índice Herfindahl-Hirschman) = Sumatoria de los cuadrados de la participación porcentual de cada subvención. Un índice menor a 1.500 indica diversificación saludable.
      </div>

      {/* Nota metodológica */}
      <div style={{ padding: '10px 16px', borderRadius: 10, fontSize: '0.82rem', marginBottom: '1rem', background: 'var(--surface-overlay)', border: '1px solid var(--line-subtle)' }}>
        ℹ️ <strong>Metodología HHI:</strong> HHI = Σ(pct_i²) en escala 0-10.000.
        <span style={{ marginLeft: 12 }}>🟢 &lt;1.500 Concentración Baja</span>
        <span style={{ marginLeft: 10 }}>🟡 1.500-2.500 Moderada</span>
        <span style={{ marginLeft: 10 }}>🔴 &gt;2.500 Alta — alta vulnerabilidad financiera</span>
      </div>

      {/* KPIs */}
      <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="kpi-card" style={{ '--accent': hLabel.color }}>
          <div className="kpi-icon" style={{ background: `${hLabel.color}20` }}>{hLabel.icon}</div>
          <div className="kpi-body">
            <div className="kpi-value" style={{ color: hLabel.color }}>{fmtN(Math.round(avg_hhi))}</div>
            <div className="kpi-label">HHI Promedio Histórico</div>
            <div className="kpi-sub">Escala 0–10.000 — menor es más diversificado</div>
          </div>
        </div>
        <div className="kpi-card" style={{ '--accent': ulLabel.color }}>
          <div className="kpi-icon" style={{ background: `${ulLabel.color}20` }}>{ulLabel.icon}</div>
          <div className="kpi-body">
            <div className="kpi-value" style={{ color: ulLabel.color }}>{ultimo ? fmtN(Math.round(Number(ultimo.hhi))) : '—'}</div>
            <div className="kpi-label">HHI Último Período ({ultimo?.periodo ?? '—'})</div>
            <div className="kpi-sub">{ulLabel.label}</div>
          </div>
        </div>
        <div className="kpi-card" style={{ '--accent': '#6366f1' }}>
          <div className="kpi-icon" style={{ background: '#6366f120' }}>📊</div>
          <div className="kpi-body">
            <div className="kpi-value" style={{ color: '#6366f1' }}>{fmtN(ultimo?.n_fuentes ?? fuentes.length)}</div>
            <div className="kpi-label">Número de Fuentes</div>
            <div className="kpi-sub">Tipos de subvención como ingreso rendido</div>
          </div>
        </div>
        <div className="kpi-card" style={{ '--accent': '#10b981' }}>
          <div className="kpi-icon" style={{ background: '#10b98120' }}>🏆</div>
          <div className="kpi-body">
            <div className="kpi-value" style={{ color: '#10b981' }}>{ultimo?.fuente_principal ?? '—'}</div>
            <div className="kpi-label">Fuente Principal ({ultimo?.periodo ?? '—'})</div>
            <div className="kpi-sub">{ultimo?.pct_fuente_principal != null ? `${Number(ultimo.pct_fuente_principal).toFixed(1)}% del ingreso total` : '—'}</div>
          </div>
        </div>
      </div>

      <WidgetWrapper widgetKey="sr_hhi_graficos">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
          <div className="chart-card">
            <h3 className="chart-title">Distribución de Fuentes de Ingreso</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '0.5rem' }}>Período {ultimo?.periodo ?? ''} — datos rendidos</p>
            <ReactECharts option={pieFuentesOpt} style={{ height: 320 }} />
          </div>
          <div className="chart-card">
            <h3 className="chart-title">Evolución del HHI por Año</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '0.5rem' }}>Concentración de financiamiento — serie histórica</p>
            <ReactECharts option={lineHHIOpt} style={{ height: 320 }} />
          </div>
        </div>
      </WidgetWrapper>

      <WidgetWrapper widgetKey="sr_hhi_fuentes">
        <div className="chart-card">
          <h3 className="chart-title">Composición de Fuentes de Ingreso (Rendido)</h3>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fuente (Subvención)</th>
                  <th>Monto Total</th>
                  <th>% Participación</th>
                </tr>
              </thead>
              <tbody>
                {fuentes.map((f, i) => (
                  <tr key={f.subvencion_alias}>
                    <td>
                      <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: getFColor(f.subvencion_alias, i), marginRight: 8 }} />
                      {f.subvencion_alias}
                    </td>
                    <td style={{ color: '#10b981' }}>{fmtAmt(f.monto_total)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 80, height: 6, borderRadius: 3, background: 'var(--surface-overlay)', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(Number(f.pct_participacion), 100)}%`, height: '100%', background: getFColor(f.subvencion_alias, i), borderRadius: 3 }} />
                        </div>
                        <strong style={{ color: getFColor(f.subvencion_alias, i) }}>
                          {Number(f.pct_participacion).toFixed(1)}%
                        </strong>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </WidgetWrapper>

      <WidgetWrapper widgetKey="sr_hhi_detalle">
        <div className="chart-card">
          <h3 className="chart-title">Detalle HHI por Período</h3>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Año</th><th>HHI</th><th>Nivel</th><th>N° Fuentes</th>
                  <th>Fuente Principal</th><th>% F. Principal</th><th>Monto Total</th>
                </tr>
              </thead>
              <tbody>
                {[...hhi_serie].reverse().map(d => {
                  const lbl = hhiLabel(Number(d.hhi))
                  return (
                    <tr key={d.periodo}>
                      <td><strong>{d.periodo}</strong></td>
                      <td><strong style={{ color: lbl.color, fontSize: '1rem' }}>{fmtN(Math.round(Number(d.hhi)))}</strong></td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `${lbl.color}20`, color: lbl.color, padding: '2px 10px', borderRadius: 999, fontSize: '0.78rem', fontWeight: 600 }}>
                          {lbl.icon} {lbl.label}
                        </span>
                      </td>
                      <td>{Number(d.n_fuentes).toFixed(0)}</td>
                      <td>{d.fuente_principal ?? '—'}</td>
                      <td>{d.pct_fuente_principal != null ? `${Number(d.pct_fuente_principal).toFixed(1)}%` : '—'}</td>
                      <td style={{ color: '#6366f1' }}>{fmtAmt(d.monto_total)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </WidgetWrapper>
    </>
  )
}

// ── Tab: Territorio (Sub-tabs) ──────────────────────────────────────────────────
function TabTerritorio({ data, periodo, sostId }) {
  const C = useChartColors()
  const [subTab, setSubTab] = useState(() => localStorage.getItem('pirgefse-fichasost-territorio') || 'complejidad')
  useEffect(() => { localStorage.setItem('pirgefse-fichasost-territorio', subTab) }, [subTab])
  useEffect(() => {
    const handler = (e) => { if (e.detail.key === 'pirgefse-fichasost-territorio') setSubTab(e.detail.val) }
    window.addEventListener('pirgefse-subtab', handler)
    return () => window.removeEventListener('pirgefse-subtab', handler)
  }, [])

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--line-subtle)', paddingBottom: '0.5rem' }}>
        <button
          onClick={() => setSubTab('complejidad')}
          style={{
            padding: '0.5rem 1rem', borderRadius: '0.375rem', fontWeight: 600, fontSize: '0.9rem',
            background: subTab === 'complejidad' ? '#3b82f6' : 'transparent',
            color: subTab === 'complejidad' ? '#fff' : 'var(--text-muted)',
            border: 'none', cursor: 'pointer', transition: 'all 0.2s'
          }}
        >
          🧩 Complejidad Educativa
        </button>
        <button
          onClick={() => setSubTab('gasto')}
          style={{
            padding: '0.5rem 1rem', borderRadius: '0.375rem', fontWeight: 600, fontSize: '0.9rem',
            background: subTab === 'gasto' ? '#10b981' : 'transparent',
            color: subTab === 'gasto' ? '#fff' : 'var(--text-muted)',
            border: 'none', cursor: 'pointer', transition: 'all 0.2s'
          }}
        >
          💰 Gasto Educativo
        </button>
      </div>

      {subTab === 'complejidad' && <RenderComplejidadEducativa data={data} periodo={periodo} />}
      {subTab === 'gasto' && <RenderGastoEducativo sostId={sostId} periodo={periodo} />}
    </div>
  )
}

function RenderComplejidadEducativa({ data, periodo, widgetFilter = null }) {
  const C = useChartColors()
  const { fmtAmt, fmtAxisAmt } = useMoneyFmt()
  const [search, setSearch] = useState('')
  const [nivelFilter, setNivelFilter] = useState('all')
  const [ruralFilter, setRuralFilter] = useState('all')
  const [page, setPage] = useState(1)
  const ITEMS_PER_PAGE = 10
  const [expandedKeys, setExpandedKeys] = useState(new Set())

  const toggleExpand = (k) => {
    setExpandedKeys(prev => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }

  useEffect(() => { setPage(1) }, [search, nivelFilter, ruralFilter, data, periodo])

  if (!data) return (
    <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🗺️</div>
      <p>Sin datos de complejidad disponibles para este período.</p>
    </div>
  )

  const { ive_establecimientos = [], nivel_resumen = [], por_comuna = [], prioridades = {}, financiero_por_rbd = [] } = data

  // Mapa rbd → datos financieros agregados y jerárquicos
  const finMapRaw = {}
  for (const f of financiero_por_rbd) {
    const k = f.rbd
    if (!finMapRaw[k]) {
      finMapRaw[k] = {
        ingreso: 0, gasto: 0,
        tipos: {
          'INGRESO': { total: 0, subvs: {} },
          'GASTO': { total: 0, subvs: {} }
        }
      }
    }

    finMapRaw[k].ingreso += f.ingreso ?? 0
    finMapRaw[k].gasto += f.gasto ?? 0

    const isIngreso = (f.desc_tipo_cuenta || '').toUpperCase().includes('INGRESO')
    const tKey = isIngreso ? 'INGRESO' : 'GASTO'
    const monto = f.monto_declarado ?? (isIngreso ? (f.ingreso ?? 0) : (f.gasto ?? 0))
    const subv = f.subvencion_alias || 'Sin Subvención'
    const cuenta = f.desc_cuenta_padre || 'Sin Cuenta'

    if (monto !== 0) {
      const tNode = finMapRaw[k].tipos[tKey]
      tNode.total += monto

      if (!tNode.subvs[subv]) tNode.subvs[subv] = { total: 0, cuentas: {} }
      tNode.subvs[subv].total += monto

      if (!tNode.subvs[subv].cuentas[cuenta]) tNode.subvs[subv].cuentas[cuenta] = 0
      tNode.subvs[subv].cuentas[cuenta] += monto
    }
  }
  const finMap = finMapRaw

  const filterText = search.toLowerCase().trim()
  const filtered = ive_establecimientos.filter(ee => {
    const matchName = (ee.nom_establecimiento ?? '').toLowerCase().includes(filterText)
    const matchNivel = nivelFilter === 'all' ? true : ee.nivel === nivelFilter
    const matchRural = ruralFilter === 'all' ? true : ruralFilter === 'rural' ? ee.rural_rbd === 1 : ee.rural_rbd !== 1
    return matchName && matchNivel && matchRural
  })

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE)

  const inpSt = { padding: '0.35rem 0.75rem', backgroundColor: 'var(--surface-overlay)', color: 'var(--text-primary)', border: '1px solid var(--line-subtle)', borderRadius: '0.375rem', fontSize: '0.8rem' }
  const pgBtn = (dis) => ({ padding: '0.3rem 0.75rem', border: '1px solid var(--line-subtle)', borderRadius: '0.375rem', background: dis ? 'var(--surface-base)' : 'var(--surface-overlay)', color: dis ? 'var(--text-disabled)' : 'var(--text-primary)', cursor: dis ? 'not-allowed' : 'pointer', fontSize: '0.8rem' })
  const iveColor = (v) => v >= 0.9 ? '#ef4444' : v >= 0.7 ? '#f59e0b' : '#10b981'
  const iveLabel = (v) => v >= 0.9 ? 'Alto' : v >= 0.7 ? 'Medio' : 'Bajo'
  // ttStyle removed }

  const prom_ive = data.ive_promedio ?? 0
  const total_ee = data.total_establecimientos ?? 0
  const total_mat = data.total_matricula ?? 0
  const altoVuln = ive_establecimientos.filter(e => (e.ive_sinae ?? 0) >= 0.9).length

  const prioData = [
    { name: '1ª Prioridad', value: prioridades.primera ?? 0, color: '#ef4444' },
    { name: '2ª Prioridad', value: prioridades.segunda ?? 0, color: '#f59e0b' },
    { name: '3ª Prioridad', value: prioridades.tercera ?? 0, color: '#facc15' },
    { name: 'No Priorizado', value: prioridades.no_priorizado ?? 0, color: '#10b981' },
    { name: 'Sin Info', value: prioridades.sin_informacion ?? 0, color: 'var(--text-muted)' },
  ]
  const prioOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, ...C.tooltip },
    legend: { data: prioData.map(d => d.name), textStyle: { color: C.axisLabel, fontSize: 10 }, top: 0 },
    grid: { left: 20, right: 20, top: 40, bottom: 20 },
    xAxis: { type: 'value', axisLabel: { color: C.axisLabel, formatter: v => fmtN(v) }, splitLine: { lineStyle: { color: C.splitLine } } },
    yAxis: { type: 'category', data: ['Consolidado'], axisLabel: { color: C.axisLabel, fontSize: 11 } },
    series: prioData.map(d => ({ name: d.name, type: 'bar', stack: 'prio', barMaxWidth: 40, data: [d.value], itemStyle: { color: d.color }, label: { show: d.value > 0, position: 'inside', formatter: p => fmtN(p.value), fontSize: 10, color: '#fff', fontWeight: 600 } })),
    backgroundColor: 'transparent',
  }

  // ── Nuevos gráficos IVE × Financiero ──────────────────────────────────────
  // Solo establecimientos con IVE y datos financieros disponibles
  const iveFinData = ive_establecimientos
    .filter(e => e.ive_sinae != null && finMap[e.rbd])
    .map(e => ({ ...e, ingreso: finMap[e.rbd]?.ingreso ?? 0, gasto: finMap[e.rbd]?.gasto ?? 0 }))

  const scatterIveFinOption = {
    tooltip: {
      trigger: 'item', ...C.tooltip,
      formatter: p => {
        const d = p.data
        return `<b>${d[3]}</b> (${d[4]})<br/>IVE: <b style="color:${iveColor(d[0])}">${(d[0] * 100).toFixed(1)}%</b><br/>Ingreso: <b style="color:#10b981">${fmtAmt(d[1])}</b><br/>Gasto: <b style="color:#ef4444">${fmtAmt(d[2])}</b><br/>Nivel: ${d[5]}`
      }
    },
    legend: { data: ['BASICA', 'MEDIA'], textStyle: { color: C.axisLabel, fontSize: 10 }, top: 0 },
    grid: { left: 70, right: 20, top: 40, bottom: 50 },
    xAxis: { type: 'value', name: 'IVE SINAE', nameLocation: 'middle', nameGap: 30, min: 0, max: 1, axisLabel: { color: C.axisLabel, formatter: v => `${(v * 100).toFixed(0)}%` }, splitLine: { lineStyle: { color: C.splitLine } } },
    yAxis: { type: 'value', name: 'Ingreso', nameLocation: 'middle', nameGap: 60, axisLabel: { color: C.axisLabel, formatter: v => fmtAxisAmt(v) }, splitLine: { lineStyle: { color: C.splitLine } } },
    series: ['BASICA', 'MEDIA'].map(nv => ({
      name: nv,
      type: 'scatter',
      symbolSize: d => Math.max(8, Math.min(28, Math.sqrt((d[6] ?? 100) / 4))),
      data: iveFinData.filter(e => e.nivel === nv).map(e => [e.ive_sinae, e.ingreso, e.gasto, e.nom_establecimiento, e.rbd, e.nivel, e.total_matricula ?? 100]),
      itemStyle: { color: nv === 'BASICA' ? '#60a5fa' : '#34d399', opacity: 0.75 },
      emphasis: { scale: 1.4 }
    })),
    backgroundColor: 'transparent',
  }

  const sqlStr = `SELECT
    ive.rbd,
    ive.nom_establecimiento,
    ive.nivel,
    ive.nom_region,
    ive.nom_provincia,
    ive.nom_comuna,
    ive.nom_ruralidad,
    ive.nom_tipo_dependencia,
    ive.primera_prioridad,
    ive.segunda_prioridad,
    ive.tercera_prioridad,
    ive.no_priorizado,
    ive.sin_informacion,
    ive.total_matricula,
    ROUND(CAST(ive.ive_sinae AS NUMERIC), 4) AS ive_sinae,
    eo.rural_rbd,
    eo.convenio_pie,
    eo.pace,
    fin.ingreso,
    fin.gasto,
    fin.desc_tipo_cuenta,
    fin.subvencion_alias,
    fin.cuenta_alias_padre,
    fin.desc_cuenta_padre
FROM dim_ive ive
JOIN dim_establecimiento_oficial eo ON eo.rbd = ive.rbd AND eo.agno = ive.periodo
LEFT JOIN (
    SELECT
        er.rbd,
        er.cuenta_alias_padre,
        er.desc_cuenta_padre,
        er.desc_tipo_cuenta,
        er.subvencion_alias,
        SUM(er.monto_declarado) AS monto_declarado,
        SUM(CASE WHEN UPPER(TRIM(er.desc_tipo_cuenta)) LIKE '%INGRESO%'
                 THEN er.monto_declarado ELSE 0 END) AS ingreso,
        SUM(CASE WHEN UPPER(TRIM(er.desc_tipo_cuenta)) LIKE '%GASTO%'
                 THEN er.monto_declarado ELSE 0 END) AS gasto
    FROM estado_resultado er
    WHERE er.sost_id = :sid
      AND er.periodo  = :agno
      AND UPPER(TRIM(er.desc_estado)) = 'RENDIDO'
      AND er.monto_declarado <> 0
    GROUP BY
        er.rbd, er.cuenta_alias_padre, er.desc_cuenta_padre,
        er.desc_tipo_cuenta, er.subvencion_alias
) fin ON fin.rbd = ive.rbd
WHERE eo.rut_sostenedor = :sid
  AND ive.periodo = :agno
ORDER BY ive.ive_sinae DESC NULLS LAST, ive.nom_establecimiento`

  // ── Early return para el tab Resumen (solo fragmento específico) ─────────────
  if (widgetFilter === 'te_complejidad_prioridades') {
    return (
      <div className="chart-card">
        <h3 className="chart-title">Distribución de Prioridades de Vulnerabilidad — {periodo}</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '0.75rem' }}>Suma total de alumnos por categoría de prioridad IVE-SINAE.</p>
        <ReactECharts option={prioOption} style={{ height: 100 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem', marginTop: '1rem' }}>
          {prioData.map(p => (
            <div key={p.name} style={{ textAlign: 'center', background: 'var(--surface-overlay)', borderRadius: '0.5rem', padding: '0.6rem', border: '1px solid var(--line-subtle)' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: p.color }}>{fmtN(p.value)}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{p.name}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }
  if (widgetFilter === 'te_complejidad_scatter') {
    return (
      <div className="chart-card" style={{ marginBottom: '1.5rem' }}>
        <h3 className="chart-title">IVE vs Ingreso por Establecimiento — {periodo}</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '0.5rem' }}>
          Relación entre vulnerabilidad educativa (IVE SINAE) e ingresos rendidos. Tamaño proporcional a matrícula.
          <span style={{ marginLeft: 12, color: '#60a5fa' }}>● Básica</span>
          <span style={{ marginLeft: 8, color: '#34d399' }}>● Media</span>
        </p>
        {iveFinData.length === 0
          ? <p style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>Sin datos financieros cruzados para este período.</p>
          : <ReactECharts option={scatterIveFinOption} style={{ height: Math.max(320, iveFinData.length * 6 + 100) }} />
        }
      </div>
    )
  }

  return (
    <>
      <SqlViewer sql={sqlStr} />

      {/* Nota metodológica */}
      <div className="alert-info" style={{ padding: '10px 16px', borderRadius: 10, fontSize: '0.82rem', marginBottom: 12 }}>
        ℹ️ <strong>Metodología:</strong> Análisis de vulnerabilidad basado en el Índice de Vulnerabilidad Escolar (IVE), concentración de estudiantes prioritarios y matrícula total.
      </div>

      {/* Indicadores */}

      <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
        <KPICard icon="🗺️" label="Establec. con IVE" value={fmtN(total_ee)} color="#6366f1" />
        <KPICard icon="📊" label="IVE Promedio" value={`${(prom_ive * 100).toFixed(1)}%`} color={iveColor(prom_ive)} sub={iveLabel(prom_ive) + ' vulnerabilidad'} />
        <KPICard icon="🔴" label="IVE Alto (≥90%)" value={fmtN(altoVuln)} color="#ef4444" sub="establecimientos" />
        <KPICard icon="👨‍🎓" label="Matrícula Total" value={fmtN(total_mat)} color="#10b981" />
      </div>

      <WidgetWrapper widgetKey="te_complejidad_prioridades">
        <div className="chart-card">
          <h3 className="chart-title">Distribución de Prioridades de Vulnerabilidad — {periodo}</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '0.75rem' }}>Suma total de alumnos por categoría de prioridad IVE-SINAE.</p>
          <ReactECharts option={prioOption} style={{ height: 100 }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem', marginTop: '1rem' }}>
            {prioData.map(p => (
              <div key={p.name} style={{ textAlign: 'center', background: 'var(--surface-overlay)', borderRadius: '0.5rem', padding: '0.6rem', border: '1px solid var(--line-subtle)' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: p.color }}>{fmtN(p.value)}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{p.name}</div>
              </div>
            ))}
          </div>
        </div>
      </WidgetWrapper>

      <WidgetWrapper widgetKey="te_complejidad_scatter">
        <div className="chart-card" style={{ marginBottom: '1.5rem' }}>
          <h3 className="chart-title">IVE vs Ingreso por Establecimiento — {periodo}</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '0.5rem' }}>
            Relación entre vulnerabilidad educativa (IVE SINAE) e ingresos rendidos. El tamaño del punto es proporcional a la matrícula.
            <span style={{ marginLeft: 12, color: '#60a5fa' }}>● Básica</span>
            <span style={{ marginLeft: 8, color: '#34d399' }}>● Media</span>
          </p>
          {iveFinData.length === 0
            ? <p style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>Sin datos financieros cruzados para este período.</p>
            : <ReactECharts option={scatterIveFinOption} style={{ height: Math.max(320, iveFinData.length * 6 + 100) }} />
          }
        </div>
      </WidgetWrapper>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input type="text" placeholder="🔍 Buscar por nombre de establecimiento..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inpSt, minWidth: 240 }} />
        {search && <button onClick={() => setSearch('')} style={pgBtn(false)}>✕ Limpiar</button>}
        <select value={nivelFilter} onChange={e => setNivelFilter(e.target.value)} style={inpSt}>
          <option value="all">Nivel: Todos</option>
          <option value="BASICA">Básica</option>
          <option value="MEDIA">Media</option>
        </select>
        <select value={ruralFilter} onChange={e => setRuralFilter(e.target.value)} style={inpSt}>
          <option value="all">Ruralidad: Todos</option>
          <option value="rural">Rural</option>
          <option value="urbano">Urbano</option>
        </select>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Mostrando <b style={{ color: C.axisLabel }}>{filtered.length === 0 ? 0 : (safePage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(safePage * ITEMS_PER_PAGE, filtered.length)}</b> de <b style={{ color: C.axisLabel }}>{filtered.length}</b>
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button disabled={safePage <= 1} onClick={() => setPage(p => p - 1)} style={pgBtn(safePage <= 1)}>← Anterior</button>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', minWidth: 56, textAlign: 'center' }}>{safePage} / {totalPages}</span>
          <button disabled={safePage >= totalPages} onClick={() => setPage(p => p + 1)} style={pgBtn(safePage >= totalPages)}>Siguiente →</button>
        </div>
      </div>

      <div className="chart-card" style={{ padding: 0, marginBottom: '1.5rem' }}>
        <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--line-subtle)' }}>
          <h3 className="chart-title" style={{ margin: 0 }}>Detalle Establecimientos — IVE {periodo} ({fmtN(filtered.length)} resultados)</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ background: 'var(--surface-overlay)' }}>
                {[{ h: 'RBD', a: 'left' }, { h: 'Nombre', a: 'left' }, { h: 'Nivel', a: 'center' }, { h: 'IVE', a: 'center' }, { h: '1ª Prior.', a: 'right' }, { h: '2ª Prior.', a: 'right' }, { h: '3ª Prior.', a: 'right' }, { h: 'No Prior.', a: 'right' }, { h: 'Total Mat.', a: 'right' }, { h: 'Ingresos', a: 'right' }, { h: 'Gastos', a: 'right' }, { h: 'Rural', a: 'center' }, { h: 'Comuna', a: 'left' }].map(({ h, a }) => (
                  <th key={h} style={{ padding: '0.55rem 0.8rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: a, borderBottom: '1px solid var(--line-subtle)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 && <tr><td colSpan={13} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Sin resultados para «{search}»</td></tr>}
              {paginated.map((ee, i) => {
                const ive = ee.ive_sinae ?? 0
                const clr = iveColor(ive)
                const fData = finMap[ee.rbd]
                const hasFin = !!fData
                const isExpandedRbd = expandedKeys.has(ee.rbd)

                const rows = [
                  <tr key={`${ee.rbd}-main`} style={{ borderBottom: '1px solid var(--line-subtle)', background: i % 2 === 0 ? 'transparent' : 'var(--surface-overlay)' }}>
                    <td style={{ padding: '0.45rem 0.8rem', color: C.axisLabel, fontFamily: 'monospace', fontSize: '0.76rem' }}>{ee.rbd}</td>
                    <td style={{ padding: '0.45rem 0.8rem', color: 'var(--text-primary)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {hasFin ? (
                        <button onClick={() => toggleExpand(ee.rbd)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: 0, marginRight: '0.4rem', fontSize: '0.8rem', fontWeight: 700 }}>
                          {isExpandedRbd ? '▼' : '▶'}
                        </button>
                      ) : <span style={{ display: 'inline-block', width: '1.2rem' }}></span>}
                      <span title={ee.nom_establecimiento}>{ee.nom_establecimiento}</span>
                    </td>
                    <td style={{ padding: '0.45rem 0.8rem', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 600, color: ee.nivel === 'MEDIA' ? '#34d399' : '#60a5fa', background: ee.nivel === 'MEDIA' ? '#34d39922' : '#60a5fa22', borderRadius: 999, padding: '0.15rem 0.5rem', border: `1px solid ${ee.nivel === 'MEDIA' ? '#34d399' : '#60a5fa'}` }}>{ee.nivel}</span>
                    </td>
                    <td style={{ padding: '0.45rem 0.8rem', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: clr, background: `${clr}22`, border: `1px solid ${clr}`, borderRadius: 999, padding: '0.15rem 0.5rem' }}>{(ive * 100).toFixed(1)}%</span>
                    </td>
                    <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: '#ef4444', fontVariantNumeric: 'tabular-nums' }}>{fmtN(ee.primera_prioridad)}</td>
                    <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: '#f59e0b', fontVariantNumeric: 'tabular-nums' }}>{fmtN(ee.segunda_prioridad)}</td>
                    <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: '#facc15', fontVariantNumeric: 'tabular-nums' }}>{fmtN(ee.tercera_prioridad)}</td>
                    <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: '#10b981', fontVariantNumeric: 'tabular-nums' }}>{fmtN(ee.no_priorizado)}</td>
                    <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: 'var(--text-primary)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtN(ee.total_matricula)}</td>
                    <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: '#10b981', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fData ? fmtAmt(fData.ingreso) : '—'}</td>
                    <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: '#ef4444', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fData ? fmtAmt(fData.gasto) : '—'}</td>
                    <td style={{ padding: '0.45rem 0.8rem', textAlign: 'center', color: ee.rural_rbd === 1 ? '#f59e0b' : 'var(--line-subtle)' }}>{ee.rural_rbd === 1 ? '🌿' : '·'}</td>
                    <td style={{ padding: '0.45rem 0.8rem', color: C.axisLabel, fontSize: '0.76rem' }}>{ee.nom_comuna}</td>
                  </tr>
                ]

                if (hasFin && isExpandedRbd) {
                  ['INGRESO', 'GASTO'].forEach(tKey => {
                    const tNode = fData.tipos[tKey]
                    if (tNode.total !== 0) {
                      const tId = `${ee.rbd}-${tKey}`
                      const isExpT = expandedKeys.has(tId)
                      rows.push(
                        <tr key={tId} style={{ background: i % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'var(--surface-overlay)', borderBottom: '1px solid var(--line-subtle)' }}>
                          <td></td>
                          <td colSpan={8} style={{ padding: '0.35rem 0.8rem', paddingLeft: '1.8rem', color: tKey === 'INGRESO' ? '#10b981' : '#ef4444', fontWeight: 600, fontSize: '0.78rem' }}>
                            <button onClick={() => toggleExpand(tId)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, marginRight: '0.4rem', fontSize: '0.75rem' }}>{isExpT ? '▼' : '▶'}</button>
                            {tKey === 'INGRESO' ? 'Ingresos' : 'Gastos'}
                          </td>
                          <td style={{ padding: '0.35rem 0.8rem', textAlign: 'right', color: '#10b981', fontWeight: 600 }}>{tKey === 'INGRESO' ? fmtAmt(tNode.total) : ''}</td>
                          <td style={{ padding: '0.35rem 0.8rem', textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>{tKey === 'GASTO' ? fmtAmt(tNode.total) : ''}</td>
                          <td colSpan={2}></td>
                        </tr>
                      )
                      if (isExpT) {
                        Object.entries(tNode.subvs).forEach(([subv, sNode]) => {
                          const sId = `${tId}-${subv}`
                          const isExpS = expandedKeys.has(sId)
                          rows.push(
                            <tr key={sId} style={{ background: i % 2 === 0 ? 'rgba(0,0,0,0.03)' : 'var(--surface-overlay)', borderBottom: '1px dashed var(--line-subtle)' }}>
                              <td></td>
                              <td colSpan={8} style={{ padding: '0.25rem 0.8rem', paddingLeft: '3.2rem', color: 'var(--text-primary)', fontSize: '0.75rem' }}>
                                <button onClick={() => toggleExpand(sId)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, marginRight: '0.4rem', fontSize: '0.7rem' }}>{isExpS ? '▼' : '▶'}</button>
                                {subv}
                              </td>
                              <td style={{ padding: '0.25rem 0.8rem', textAlign: 'right', color: '#10b981', fontSize: '0.75rem' }}>{tKey === 'INGRESO' ? fmtAmt(sNode.total) : ''}</td>
                              <td style={{ padding: '0.25rem 0.8rem', textAlign: 'right', color: '#ef4444', fontSize: '0.75rem' }}>{tKey === 'GASTO' ? fmtAmt(sNode.total) : ''}</td>
                              <td colSpan={2}></td>
                            </tr>
                          )
                          if (isExpS) {
                            Object.entries(sNode.cuentas).forEach(([cuenta, cMonto]) => {
                              rows.push(
                                <tr key={`${sId}-${cuenta}`} style={{ background: i % 2 === 0 ? 'rgba(0,0,0,0.04)' : 'var(--surface-overlay)' }}>
                                  <td></td>
                                  <td colSpan={8} style={{ padding: '0.2rem 0.8rem', paddingLeft: '4.6rem', color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                                    └ {cuenta}
                                  </td>
                                  <td style={{ padding: '0.2rem 0.8rem', textAlign: 'right', color: '#10b981', fontSize: '0.7rem', opacity: 0.8 }}>{tKey === 'INGRESO' ? fmtAmt(cMonto) : ''}</td>
                                  <td style={{ padding: '0.2rem 0.8rem', textAlign: 'right', color: '#ef4444', fontSize: '0.7rem', opacity: 0.8 }}>{tKey === 'GASTO' ? fmtAmt(cMonto) : ''}</td>
                                  <td colSpan={2}></td>
                                </tr>
                              )
                            })
                          }
                        })
                      }
                    }
                  })
                }

                return rows
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--line-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{filtered.length === 0 ? 0 : (safePage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(safePage * ITEMS_PER_PAGE, filtered.length)} de {filtered.length}</span>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <button disabled={safePage <= 1} onClick={() => setPage(p => p - 1)} style={pgBtn(safePage <= 1)}>← Anterior</button>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', minWidth: 60, textAlign: 'center' }}>Pág. {safePage} / {totalPages}</span>
            <button disabled={safePage >= totalPages} onClick={() => setPage(p => p + 1)} style={pgBtn(safePage >= totalPages)}>Siguiente →</button>
          </div>
        </div>
      </div>

      {/*<WidgetWrapper widgetKey="te_complejidad_prioridades">
        <div className="chart-card">
          <h3 className="chart-title">Distribución de Prioridades de Vulnerabilidad — {periodo}</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '0.75rem' }}>Suma total de alumnos por categoría de prioridad IVE-SINAE.</p>
          <ReactECharts option={prioOption} style={{ height: 100 }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem', marginTop: '1rem' }}>
            {prioData.map(p => (
              <div key={p.name} style={{ textAlign: 'center', background: 'var(--surface-overlay)', borderRadius: '0.5rem', padding: '0.6rem', border: '1px solid var(--line-subtle)' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: p.color }}>{fmtN(p.value)}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{p.name}</div>
              </div>
            ))}
          </div>
        </div>
      </WidgetWrapper>*/}

      {/*<WidgetWrapper widgetKey="te_complejidad_scatter">
        <div className="chart-card" style={{ marginBottom: '1.5rem' }}>
          <h3 className="chart-title">IVE vs Ingreso por Establecimiento — {periodo}</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '0.5rem' }}>
            Relación entre vulnerabilidad educativa (IVE SINAE) e ingresos rendidos. El tamaño del punto es proporcional a la matrícula.
            <span style={{ marginLeft: 12, color: '#60a5fa' }}>● Básica</span>
            <span style={{ marginLeft: 8, color: '#34d399' }}>● Media</span>
          </p>
          {iveFinData.length === 0
            ? <p style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>Sin datos financieros cruzados para este período.</p>
            : <ReactECharts option={scatterIveFinOption} style={{ height: Math.max(320, iveFinData.length * 6 + 100) }} />
          }
        </div>
      </WidgetWrapper>*/}
    </>
  )
}

function RenderGastoEducativo({ sostId, periodo, widgetFilter = null }) {
  const C = useChartColors()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const { fmtAmt: fmt } = useMoneyFmt()
  const ITEMS_PER_PAGE = 10

  useEffect(() => { setPage(1) }, [search, data, periodo])

  useEffect(() => {
    setLoading(true)
    api.get(`/dashboard/ficha-sostenedor/gasto-educativo?sost_id=${sostId}&periodo=${periodo}`)
      .then(res => setData(res.data))
      .catch(err => console.error("Error fetching gasto educativo", err))
      .finally(() => setLoading(false))
  }, [sostId, periodo])

  if (loading) return <div className="loading-area"><div className="spinner" /></div>
  if (!data) return (
    <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💰</div>
      <p>Sin datos de gasto disponibles para este período.</p>
    </div>
  )

  const { gasto_establecimientos = [], gasto_por_cuenta = [], resumen = {} } = data

  const filterText = search.toLowerCase().trim()
  const filtered = gasto_establecimientos.filter(ee =>
    (ee.nombre_rbd ?? '').toLowerCase().includes(filterText) ||
    String(ee.rbd ?? '').includes(filterText)
  )

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE)

  const inpSt = { padding: '0.35rem 0.75rem', backgroundColor: 'var(--surface-overlay)', color: 'var(--text-primary)', border: '1px solid var(--line-subtle)', borderRadius: '0.375rem', fontSize: '0.8rem' }
  const pgBtn = (dis) => ({ padding: '0.3rem 0.75rem', border: '1px solid var(--line-subtle)', borderRadius: '0.375rem', background: dis ? 'var(--surface-base)' : 'var(--surface-overlay)', color: dis ? 'var(--text-disabled)' : 'var(--text-primary)', cursor: dis ? 'not-allowed' : 'pointer', fontSize: '0.8rem' })
  // ttStyle removed }

  // Gráfico: Top 10 gastos
  const chartData = [...filtered].sort((a, b) => (b.total_gasto ?? 0) - (a.total_gasto ?? 0)).slice(0, 10)
  const barOption = {
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' }, ...C.tooltip,
      formatter: params => {
        const d = chartData[params[0].dataIndex]
        return `<b>${d.nombre_rbd}</b> ${d.rbd ? `(${d.rbd})` : ''}<br/>Monto: <b style="color:#10b981">${fmt(d.total_gasto)}</b><br/>Documentos: ${fmtN(d.num_documentos)}`
      }
    },
    grid: { left: 270, right: 80, top: 20, bottom: 20 },
    xAxis: { type: 'value', axisLabel: { color: C.axisLabel, formatter: v => fmt(v) }, splitLine: { lineStyle: { color: C.splitLine } } },
    yAxis: { type: 'category', data: chartData.map(d => (d.nombre_rbd?.length > 36 ? d.nombre_rbd.slice(0, 34) + '…' : d.nombre_rbd) || 'Sin nombre'), axisLabel: { color: C.axisLabel, fontSize: 10, width: 260, overflow: 'truncate' } },
    series: [{
      type: 'bar', barMaxWidth: 18,
      data: chartData.map(d => ({ value: d.total_gasto, itemStyle: { color: '#10b981', borderRadius: [0, 4, 4, 0] } })),
      label: { show: true, position: 'right', formatter: p => fmt(p.value), fontSize: 10, color: 'var(--text-primary)' }
    }],
    backgroundColor: 'transparent',
  }

  // Gráfico: Gasto por Cuenta Padre
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#64748b']
  const cuentaChart = [...gasto_por_cuenta].sort((a, b) => b.total_gasto - a.total_gasto)
  const pieOption = {
    tooltip: { trigger: 'item', ...C.tooltip, formatter: p => `<b>${p.name}</b><br/>Monto: ${fmt(p.value)}<br/>${p.percent.toFixed(1)}%` },
    legend: { orient: 'vertical', left: '55%', top: 'center', textStyle: { color: C.axisLabel, fontSize: 10 }, formatter: name => name.length > 40 ? name.slice(0, 38) + '...' : name },
    series: [{
      type: 'pie', radius: ['40%', '70%'], center: ['25%', '50%'],
      data: cuentaChart.map((c, i) => ({ name: c.categoria, value: c.total_gasto, itemStyle: { color: COLORS[i % COLORS.length] } })),
      label: { show: false }, emphasis: { label: { show: false } }
    }],
    backgroundColor: 'transparent',
  }

  const sqlStr = `-- Gasto por Establecimiento / Centro de costo
SELECT 
    d.rbd, 
    d.nombre_rbd, 
    SUM(d.monto_declarado) as total_gasto,
    COUNT(d.id) as num_documentos,
    eo.estado_estab, 
    eo.matricula,
    eo.rural_rbd,
    eo.cod_com_rbd,
    eo.nom_com_rbd
FROM documentos d
LEFT JOIN dim_establecimiento_oficial eo ON d.rbd = eo.rbd AND eo.agno = d.periodo
WHERE d.sost_id = :sid AND d.periodo = :agno
GROUP BY d.rbd, d.nombre_rbd, eo.estado_estab, eo.matricula, eo.rural_rbd, eo.cod_com_rbd, eo.nom_com_rbd
ORDER BY total_gasto DESC NULLS LAST;

-- Gasto por Cuenta Padre
SELECT 
    COALESCE(desc_cuenta_padre, 'SIN INFORMACIÓN') as categoria, 
    SUM(monto_declarado) as total_gasto
FROM documentos
WHERE sost_id = :sid AND periodo = :agno
GROUP BY COALESCE(desc_cuenta_padre, 'SIN INFORMACIÓN')
ORDER BY total_gasto DESC NULLS LAST;`

  // ── Early return para el tab Resumen (solo fragmento específico) ─────────────
  if (widgetFilter === 'te_gasto_kpis') {
    if (!resumen) return <div className="loading-area"><div className="spinner" /></div>
    return (
      <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
        <KPICard icon="🏢" label="Centros de Costo" value={fmtN(resumen.total_centros)} color="#8b5cf6" sub="Establec. + Adm. Central" />
        <KPICard icon="💵" label="Gasto Total" value={fmt(resumen.total_gasto)} color="#10b981" />
        <KPICard icon="📄" label="Documentos" value={fmtN(resumen.total_documentos)} color="#3b82f6" />
        <KPICard icon="📊" label="Promedio por Centro" value={fmt(resumen.total_centros ? resumen.total_gasto / resumen.total_centros : 0)} color="#f59e0b" />
      </div>
    )
  }
  if (widgetFilter === 'te_gasto_tabla') {
    if (!paginated) return <div className="loading-area"><div className="spinner" /></div>
    return (
      <div className="chart-card" style={{ padding: 0, marginBottom: '1.5rem' }}>
        <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--line-subtle)' }}>
          <h3 className="chart-title" style={{ margin: 0 }}>Gasto por Centro de Costo — {periodo} ({fmtN(filtered.length)} resultados)</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ background: 'var(--surface-overlay)' }}>
                {[{ h: 'RBD', a: 'left' }, { h: 'Nombre / Centro Costo', a: 'left' }, { h: 'Nº Docs', a: 'right' }, { h: 'Rural', a: 'center' }, { h: 'Comuna', a: 'left' }, { h: 'Monto Total', a: 'right' }].map(({ h, a }) => (
                  <th key={h} style={{ padding: '0.55rem 0.8rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: a, borderBottom: '1px solid var(--line-subtle)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 && <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Sin resultados para «{search}»</td></tr>}
              {paginated.map((ee, i) => (
                <tr key={`${ee.rbd}-${ee.nombre_rbd}`} style={{ borderBottom: '1px solid var(--line-subtle)', background: i % 2 === 0 ? 'transparent' : 'var(--surface-overlay)' }}>
                  <td style={{ padding: '0.45rem 0.8rem', color: C.axisLabel, fontFamily: 'monospace', fontSize: '0.76rem' }}>{ee.rbd || 'N/A'}</td>
                  <td style={{ padding: '0.45rem 0.8rem', color: 'var(--text-primary)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span title={ee.nombre_rbd}>{ee.nombre_rbd}</span>
                  </td>
                  <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: C.axisLabel }}>{fmtN(ee.num_documentos)}</td>
                  <td style={{ padding: '0.45rem 0.8rem', textAlign: 'center', color: ee.rural_rbd === 1 ? '#f59e0b' : 'var(--line-subtle)' }}>{ee.rural_rbd === 1 ? '🌿' : (ee.rbd ? '·' : '')}</td>
                  <td style={{ padding: '0.45rem 0.8rem', color: C.axisLabel, fontSize: '0.76rem' }}>{ee.nom_com_rbd || ''}</td>
                  <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: '#10b981', fontWeight: 700 }}>{fmt(ee.total_gasto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }
  if (widgetFilter === 'te_gasto_graficos') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
        <div className="chart-card">
          <h3 className="chart-title">Top 10 — Mayor Gasto (filtrado)</h3>
          {chartData.length === 0
            ? <p style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>Sin datos.</p>
            : <ReactECharts option={barOption} style={{ height: Math.max(280, chartData.length * 38) }} />
          }
        </div>
        <div className="chart-card">
          <h3 className="chart-title">Gasto por Categoría (Cuenta Padre)</h3>
          <ReactECharts option={pieOption} style={{ height: 300 }} />
        </div>
      </div>
    )
  }

  return (
    <>
      <SqlViewer sql={sqlStr} />
      <div className="alert-info" style={{ padding: '10px 16px', borderRadius: 10, fontSize: '0.82rem', marginBottom: 12 }}>
        ℹ️ <strong>Metodología:</strong> Análisis de la distribución territorial del Gasto Total y Costo por Alumno, segmentado por área geográfica (Rural/Urbano).
      </div>
      <WidgetWrapper widgetKey="te_gasto_kpis">
        <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
          <KPICard icon="🏢" label="Centros de Costo" value={fmtN(resumen.total_centros)} color="#8b5cf6" sub="Establec. + Adm. Central" />
          <KPICard icon="💵" label="Gasto Total" value={fmt(resumen.total_gasto)} color="#10b981" />
          <KPICard icon="📄" label="Documentos" value={fmtN(resumen.total_documentos)} color="#3b82f6" />
          <KPICard icon="📊" label="Promedio por Centro" value={fmt(resumen.total_centros ? resumen.total_gasto / resumen.total_centros : 0)} color="#f59e0b" />
        </div>
      </WidgetWrapper>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input type="text" placeholder="🔍 Buscar por centro de costo o RBD..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inpSt, minWidth: 280 }} />
        {search && <button onClick={() => setSearch('')} style={pgBtn(false)}>✕ Limpiar</button>}

        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Mostrando <b style={{ color: C.axisLabel }}>{filtered.length === 0 ? 0 : (safePage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(safePage * ITEMS_PER_PAGE, filtered.length)}</b> de <b style={{ color: C.axisLabel }}>{filtered.length}</b>
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button disabled={safePage <= 1} onClick={() => setPage(p => p - 1)} style={pgBtn(safePage <= 1)}>← Anterior</button>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', minWidth: 56, textAlign: 'center' }}>{safePage} / {totalPages}</span>
          <button disabled={safePage >= totalPages} onClick={() => setPage(p => p + 1)} style={pgBtn(safePage >= totalPages)}>Siguiente →</button>
        </div>
      </div>

      <WidgetWrapper widgetKey="te_gasto_tabla">
        <div className="chart-card" style={{ padding: 0, marginBottom: '1.5rem' }}>
          <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--line-subtle)' }}>
            <h3 className="chart-title" style={{ margin: 0 }}>Gasto por Centro de Costo — {periodo} ({fmtN(filtered.length)} resultados)</h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: 'var(--surface-overlay)' }}>
                  {[{ h: 'RBD', a: 'left' }, { h: 'Nombre / Centro Costo', a: 'left' }, { h: 'Nº Docs', a: 'right' }, { h: 'Rural', a: 'center' }, { h: 'Comuna', a: 'left' }, { h: 'Monto Total', a: 'right' }].map(({ h, a }) => (
                    <th key={h} style={{ padding: '0.55rem 0.8rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: a, borderBottom: '1px solid var(--line-subtle)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 && <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Sin resultados para «{search}»</td></tr>}
                {paginated.map((ee, i) => (
                  <tr key={`${ee.rbd}-${ee.nombre_rbd}`} style={{ borderBottom: '1px solid var(--line-subtle)', background: i % 2 === 0 ? 'transparent' : 'var(--surface-overlay)' }}>
                    <td style={{ padding: '0.45rem 0.8rem', color: C.axisLabel, fontFamily: 'monospace', fontSize: '0.76rem' }}>{ee.rbd || 'N/A'}</td>
                    <td style={{ padding: '0.45rem 0.8rem', color: 'var(--text-primary)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span title={ee.nombre_rbd}>{ee.nombre_rbd}</span>
                    </td>
                    <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: C.axisLabel, fontVariantNumeric: 'tabular-nums' }}>{fmtN(ee.num_documentos)}</td>
                    <td style={{ padding: '0.45rem 0.8rem', textAlign: 'center', color: ee.rural_rbd === 1 ? '#f59e0b' : 'var(--line-subtle)' }}>{ee.rural_rbd === 1 ? '🌿' : (ee.rbd ? '·' : '')}</td>
                    <td style={{ padding: '0.45rem 0.8rem', color: C.axisLabel, fontSize: '0.76rem' }}>{ee.nom_com_rbd || ''}</td>
                    <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: '#10b981', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(ee.total_gasto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--line-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{filtered.length === 0 ? 0 : (safePage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(safePage * ITEMS_PER_PAGE, filtered.length)} de {filtered.length}</span>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <button disabled={safePage <= 1} onClick={() => setPage(p => p - 1)} style={pgBtn(safePage <= 1)}>← Anterior</button>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', minWidth: 60, textAlign: 'center' }}>Pág. {safePage} / {totalPages}</span>
              <button disabled={safePage >= totalPages} onClick={() => setPage(p => p + 1)} style={pgBtn(safePage >= totalPages)}>Siguiente →</button>
            </div>
          </div>
        </div>
      </WidgetWrapper>

      <WidgetWrapper widgetKey="te_gasto_graficos">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
          <div className="chart-card">
            <h3 className="chart-title">Top 10 — Mayor Gasto (filtrado)</h3>
            {chartData.length === 0
              ? <p style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>Sin datos.</p>
              : <ReactECharts option={barOption} style={{ height: Math.max(280, chartData.length * 38) }} />
            }
          </div>
          <div className="chart-card">
            <h3 className="chart-title">Gasto por Categoría (Cuenta Padre)</h3>
            <ReactECharts option={pieOption} style={{ height: 300 }} />
            <div style={{ marginTop: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
              {cuentaChart.map((c, i) => (
                <div key={c.categoria} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', borderBottom: '1px solid var(--line-subtle)', fontSize: '0.75rem' }}>
                  <span style={{ color: COLORS[i % COLORS.length] || 'var(--text-muted)', fontWeight: 600, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.categoria}>{c.categoria}</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600, marginLeft: '0.5rem' }}>{fmt(c.total_gasto)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </WidgetWrapper>
    </>
  )
}

// ── Tab: Comportamiento Financiero (Sub-tabs) ──────────────────────────────────────────────────
function TabComportamientoFinanciero({ periodo, sostId }) {
  const [subTab, setSubTab] = useState(() => localStorage.getItem('pirgefse-fichasost-comportamiento') || 'gasto_rem')
  useEffect(() => { localStorage.setItem('pirgefse-fichasost-comportamiento', subTab) }, [subTab])
  useEffect(() => {
    const handler = (e) => { if (e.detail.key === 'pirgefse-fichasost-comportamiento') setSubTab(e.detail.val) }
    window.addEventListener('pirgefse-subtab', handler)
    return () => window.removeEventListener('pirgefse-subtab', handler)
  }, [])

  const SUB_TABS = [
    { key: 'gasto_rem', label: 'Gastos Rem. sobre Ingreso Dep.', icon: '📈', color: '#f59e0b' },
    { key: 'analisis_rendicion', label: 'Análisis Rendición', icon: '📋', color: '#6366f1' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--line-subtle)', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
        {SUB_TABS.map(t => {
          const active = subTab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setSubTab(t.key)}
              style={{
                padding: '0.5rem 1rem', borderRadius: '0.375rem', fontWeight: 600, fontSize: '0.9rem',
                background: active ? t.color : 'transparent',
                color: active ? '#fff' : 'var(--text-muted)',
                border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', gap: '0.4rem',
              }}
            >
              <span>{t.icon}</span> {t.label}
            </button>
          )
        })}
      </div>

      {subTab === 'gasto_rem' && (
        <WidgetWrapper widgetKey="cf_gasto_rem">
          <GastoRemIngresoEstablecimiento sostId={sostId} periodo={periodo} />
        </WidgetWrapper>
      )}
      {subTab === 'analisis_rendicion' && (
        <WidgetWrapper widgetKey="cf_analisis_rendicion">
          <AnalisisRendicion sostId={sostId} periodo={periodo} />
        </WidgetWrapper>
      )}
    </div>
  )
}

// ── Tab: Resumen Personalizado del Sostenedor ─────────────────────────────────
function TabResumenSostenedor({ rdbData, territorioData, periodo, sostId, loadingRbd }) {
  const { pins, togglePin } = usePins()
  const { fmtAmt, fmtAxisAmt, unitLabel } = useMoneyFmt()

  // Grupos del catálogo para mostrar panel de selección
  const grupos = [...new Set(SOSTENEDOR_WIDGETS.map(w => w.grupo))]

  if (pins.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 420, gap: '1.5rem', padding: '3rem' }}>
        <div style={{ fontSize: '4rem' }}>📌</div>
        <h3 style={{ color: 'var(--text-primary)', fontSize: '1.3rem', fontWeight: 700, margin: 0 }}>Tu Resumen está vacío</h3>
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', maxWidth: 480, margin: 0, lineHeight: 1.6 }}>
          Navega a cualquier sección (Educativo-Financiero, Eficiencia, Sostenibilidad, etc.) y presiona el botón
          {' '}<strong style={{ color: '#6366f1' }}>📌 Agregar al Resumen</strong>{' '}
          en los gráficos o tablas que quieras ver aquí.
        </p>
        {/* Panel rápido de selección */}
        <div style={{ width: '100%', maxWidth: 720, marginTop: '1rem' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '0.75rem', textAlign: 'center' }}>
            O agrega indicadores directamente desde aquí:
          </p>
          {grupos.map(grupo => (
            <div key={grupo} style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>{grupo}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {SOSTENEDOR_WIDGETS.filter(w => w.grupo === grupo).map(w => (
                  <button
                    key={w.key}
                    onClick={() => togglePin(w.key)}
                    style={{
                      padding: '0.3rem 0.75rem',
                      borderRadius: '999px',
                      border: `1.5px solid ${w.color}44`,
                      background: `${w.color}10`,
                      color: w.color,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span>{w.icon}</span> {w.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Renderizar los widgets pinneados en orden
  return (
    <div>
      {/* Header con conteo y botón para editar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '1.1rem' }}>📌</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.9rem' }}>
            {pins.length} indicador{pins.length !== 1 ? 'es' : ''} en tu Resumen
          </span>
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
          · Año seleccionado: <strong>{periodo}</strong>
        </span>
      </div>

      {/* Panel de selección rápida para agregar más */}
      <details style={{ marginBottom: '1.5rem' }}>
        <summary style={{ cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600, padding: '0.5rem 0', userSelect: 'none' }}>
          ➕ Agregar / quitar indicadores
        </summary>
        <div style={{ marginTop: '0.75rem', padding: '1rem', background: 'var(--surface-overlay)', borderRadius: '0.5rem', border: '1px solid var(--line-subtle)' }}>
          {grupos.map(grupo => (
            <div key={grupo} style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.35rem' }}>{grupo}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {SOSTENEDOR_WIDGETS.filter(w => w.grupo === grupo).map(w => {
                  const pinned = pins.includes(w.key)
                  return (
                    <button
                      key={w.key}
                      onClick={() => togglePin(w.key)}
                      style={{
                        padding: '0.25rem 0.65rem',
                        borderRadius: '999px',
                        border: pinned ? `1.5px solid ${w.color}` : `1.5px solid ${w.color}44`,
                        background: pinned ? `${w.color}22` : `${w.color}08`,
                        color: pinned ? w.color : `${w.color}99`,
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        transition: 'all 0.15s',
                      }}
                    >
                      {pinned ? '📌' : '○'} {w.icon} {w.label}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </details>

      {/* Renderizar cada widget pinneado */}
      {pins.map(key => {
        const widget = WIDGET_MAP[key]
        if (!widget) return null
        return (
          <ResumenWidgetCard
            key={key}
            widget={widget}
            rdbData={rdbData}
            territorioData={territorioData}
            periodo={periodo}
            sostId={sostId}
            loadingRbd={loadingRbd}
            onUnpin={() => togglePin(key)}
          />
        )
      })}
    </div>
  )
}

// ── Tarjeta contenedora de widget en el Resumen ────────────────────────────────
function ResumenWidgetCard({ widget, rdbData, territorioData, periodo, sostId, loadingRbd, onUnpin }) {
  const content = renderWidgetContent(widget.key, { rdbData, territorioData, periodo, sostId, loadingRbd })
  if (!content) return null

  return (
    <div style={{
      marginBottom: '1.5rem',
      border: `1px solid ${widget.color}44`,
      borderRadius: '0.75rem',
      overflow: 'hidden',
      boxShadow: '0 1px 6px rgba(0,0,0,0.08)',
    }}>
      {/* Header de la card */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.75rem 1.25rem',
        background: `${widget.color}10`,
        borderBottom: `1px solid ${widget.color}30`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.1rem' }}>{widget.icon}</span>
          <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.92rem' }}>{widget.label}</span>
          <span style={{
            fontSize: '0.68rem', fontWeight: 600, color: widget.color,
            background: `${widget.color}18`, border: `1px solid ${widget.color}44`,
            borderRadius: '999px', padding: '0.1rem 0.5rem',
          }}>
            {widget.grupo}
          </span>
        </div>
        <button
          onClick={onUnpin}
          title="Quitar del Resumen"
          style={{
            padding: '0.25rem 0.6rem',
            borderRadius: '999px',
            border: '1px solid var(--line-subtle)',
            background: 'var(--surface-overlay)',
            color: 'var(--text-muted)',
            fontSize: '0.72rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            transition: 'all 0.15s',
          }}
        >
          🗑️ Quitar
        </button>
      </div>
      {/* Contenido */}
      <div style={{ padding: '1.25rem' }}>
        {content}
      </div>
    </div>
  )
}

// ── Función que devuelve el contenido JSX según el widget key ─────────────────
function renderWidgetContent(key, { rdbData, territorioData, periodo, sostId, loadingRbd }) {
  if (loadingRbd && (key.startsWith('ef_') || key.startsWith('eg_') || key.startsWith('sr_'))) {
    return <div className="loading-area" style={{ minHeight: 120 }}><div className="spinner" /></div>
  }

  switch (key) {
    // ── Educativo-Financiero ──────────────────────────────────────────────────
    case 'ef_ingreso_gasto':
    case 'ef_superavit':
      return <RenderFinancieroWidget rdbData={rdbData} periodo={periodo} widgetKey={key} />
    case 'ef_sned':
      return <SNEDSostenedor sostId={sostId} periodo={periodo} />
    // ── Eficiencia ────────────────────────────────────────────────────────────
    case 'eg_distribucion_gasto':
    case 'eg_nivel_admin':
      return <RenderInnovacionPedagogicaWidget rdbData={rdbData} periodo={periodo} widgetKey={key} />
    case 'eg_costo_alumno_kpis':
    case 'eg_costo_alumno_tabla':
    case 'eg_costo_alumno_graficos':
      return <RenderCostoAlumno sostId={sostId} periodo={periodo} widgetFilter={key} />
    case 'eg_gasto_adm_kpis':
    case 'eg_gasto_adm_tabla':
    case 'eg_gasto_adm_graficos':
      return <RenderGastoAdministrativo sostId={sostId} periodo={periodo} widgetFilter={key} />
    // ── Sostenibilidad y Riesgo ───────────────────────────────────────────────
    case 'sr_acreditacion_grafico':
    case 'sr_acreditacion_monto':
      return <TabRiesgo rdbData={rdbData} periodo={periodo} widgetFilter={key} />
    case 'sr_sostenibilidad_ratio':
    case 'sr_sostenibilidad_scatter':
      return <TabSostenibilidad rdbData={rdbData} periodo={periodo} widgetFilter={key} />
    case 'sr_hhi_graficos':
    case 'sr_hhi_fuentes':
    case 'sr_hhi_detalle':
      return <RenderHHISostenedor sostId={sostId} periodo={periodo} widgetFilter={key} />
    // ── Comportamiento Financiero ─────────────────────────────────────────────
    case 'cf_gasto_rem':
      return <GastoRemIngresoEstablecimiento sostId={sostId} periodo={periodo} />
    case 'cf_analisis_rendicion':
      return <AnalisisRendicion sostId={sostId} periodo={periodo} />
    // ── Territorio ────────────────────────────────────────────────────────────
    case 'te_complejidad_prioridades':
    case 'te_complejidad_scatter':
      return <RenderComplejidadEducativa data={territorioData} periodo={periodo} widgetFilter={key} />
    case 'te_gasto_kpis':
    case 'te_gasto_tabla':
    case 'te_gasto_graficos':
      return <RenderGastoEducativo sostId={sostId} periodo={periodo} widgetFilter={key} />
    default:
      return null
  }
}

// ── Helpers para renderizar fragmentos específicos de widgets ─────────────────

function RenderFinancieroWidget({ rdbData, periodo, widgetKey }) {
  const C = useChartColors()
  const { fmtAmt, fmtAxisAmt, unitLabel } = useMoneyFmt()
  if (!rdbData) return null
  const { financiero_rbd = [], remuneraciones_rbd = [] } = rdbData
  const sorted = [...financiero_rbd].sort((a, b) => Number(b.ingreso) - Number(a.ingreso))
  const visible = sorted.slice(0, 15)
  const names = visible.map(d => shortName(d.nom_rbd, d.rbd))
  const h = Math.max(280, visible.length * 36)

  if (widgetKey === 'ef_ingreso_gasto') {
    const opt = {
      tooltip: {
        trigger: 'axis', axisPointer: { type: 'shadow' }, ...C.tooltip,
        formatter: params => { const d = visible[params[0].dataIndex]; return `<b>${shortName(d.nom_rbd, d.rbd)}</b><br/>📈 ${fmtAmt(d.ingreso)}<br/>📉 ${fmtAmt(d.gasto)}` }
      },
      legend: { data: ['Ingreso', 'Gasto'], textStyle: { color: C.axisLabel }, top: 0 },
      grid: { left: 260, right: 80, top: 40, bottom: 20 },
      xAxis: { type: 'value', axisLabel: { color: C.axisLabel, formatter: v => fmtAxisAmt(v) }, splitLine: { lineStyle: { color: C.splitLine } } },
      yAxis: { type: 'category', data: names, axisLabel: { color: C.axisLabel, fontSize: 10, width: 250, overflow: 'truncate' } },
      series: [
        { name: 'Ingreso', type: 'bar', data: visible.map(d => Number(d.ingreso)), barMaxWidth: 14, itemStyle: { color: '#10b981', borderRadius: [0, 4, 4, 0] } },
        { name: 'Gasto', type: 'bar', data: visible.map(d => Number(d.gasto)), barMaxWidth: 14, itemStyle: { color: '#ef4444', borderRadius: [0, 4, 4, 0] } },
      ],
      backgroundColor: 'transparent',
    }
    return <ReactECharts option={opt} style={{ height: h }} />
  }

  if (widgetKey === 'ef_superavit') {
    const opt = {
      tooltip: {
        trigger: 'axis', ...C.tooltip,
        formatter: params => { const d = visible[params[0].dataIndex]; const v = Number(d.superavit); return `<b>${shortName(d.nom_rbd, d.rbd)}</b><br/>Superávit: <b>${fmtAmt(v)}</b>` }
      },
      grid: { left: 260, right: 80, top: 20, bottom: 20 },
      xAxis: { type: 'value', axisLabel: { color: C.axisLabel, formatter: v => fmtAxisAmt(v) }, splitLine: { lineStyle: { color: C.splitLine } } },
      yAxis: { type: 'category', data: names, axisLabel: { color: C.axisLabel, fontSize: 10, width: 250, overflow: 'truncate' } },
      series: [{ type: 'bar', barMaxWidth: 14, data: visible.map(d => ({ value: Number(d.superavit), itemStyle: { color: Number(d.superavit) >= 0 ? '#10b981' : '#ef4444', borderRadius: [0, 4, 4, 0] } })) }],
      backgroundColor: 'transparent',
    }
    return <ReactECharts option={opt} style={{ height: h }} />
  }


  return null
}

function RenderInnovacionPedagogicaWidget({ rdbData, periodo, widgetKey }) {
  const C = useChartColors()
  if (!rdbData) return null
  const { eficiencia_rbd = [] } = rdbData
  const sorted = [...eficiencia_rbd].sort((a, b) => Number(b.total_gasto) - Number(a.total_gasto))
  const visible = sorted.slice(0, 15)
  const names = visible.map(d => shortName(d.nom_rbd, d.rbd))
  const h = Math.max(280, visible.length * 36)

  if (widgetKey === 'eg_distribucion_gasto') {
    const opt = {
      tooltip: {
        trigger: 'axis', axisPointer: { type: 'shadow' }, ...C.tooltip,
        formatter: params => { const d = visible[params[0].dataIndex]; return `<b>${shortName(d.nom_rbd, d.rbd)}</b><br/>Aula: ${d.pct_aula}% | Admin: ${d.pct_admin}% | Otros: ${d.pct_otros}%` }
      },
      legend: { data: ['Gasto en Aula', 'Gasto Admin.', 'Otros'], textStyle: { color: C.axisLabel }, top: 0 },
      grid: { left: 260, right: 80, top: 40, bottom: 20 },
      xAxis: { type: 'value', max: 100, axisLabel: { color: C.axisLabel, formatter: v => `${v}%` }, splitLine: { lineStyle: { color: C.splitLine } } },
      yAxis: { type: 'category', data: names, axisLabel: { color: C.axisLabel, fontSize: 10, width: 250, overflow: 'truncate' } },
      series: [
        { name: 'Gasto en Aula', type: 'bar', stack: 'pct', barMaxWidth: 14, data: visible.map(d => d.pct_aula), itemStyle: { color: '#10b981' } },
        { name: 'Gasto Admin.', type: 'bar', stack: 'pct', barMaxWidth: 14, data: visible.map(d => d.pct_admin), itemStyle: { color: '#ef4444' } },
        { name: 'Otros', type: 'bar', stack: 'pct', barMaxWidth: 14, data: visible.map(d => d.pct_otros), itemStyle: { color: '#f59e0b' } },
      ],
      backgroundColor: 'transparent',
    }
    return <ReactECharts option={opt} style={{ height: h }} />
  }

  if (widgetKey === 'eg_nivel_admin') {
    const opt = {
      tooltip: {
        trigger: 'axis', ...C.tooltip,
        formatter: params => { const d = visible[params[0].dataIndex]; return `<b>${shortName(d.nom_rbd, d.rbd)}</b><br/>% Admin: <b>${d.pct_admin}%</b> — ${d.nivel_eficiencia}` }
      },
      grid: { left: 260, right: 80, top: 20, bottom: 20 },
      xAxis: { type: 'value', max: 100, axisLabel: { color: C.axisLabel, formatter: v => `${v}%` }, splitLine: { lineStyle: { color: C.splitLine } } },
      yAxis: { type: 'category', data: names, axisLabel: { color: C.axisLabel, fontSize: 10, width: 250, overflow: 'truncate' } },
      series: [{ type: 'bar', barMaxWidth: 14, data: visible.map(d => ({ value: d.pct_admin, itemStyle: { color: EF_COLORS[d.nivel_eficiencia] ?? '#64748b', borderRadius: [0, 4, 4, 0] } })) }],
      backgroundColor: 'transparent',
    }
    return <ReactECharts option={opt} style={{ height: h }} />
  }

  return null
}

function TabTerritorioWidget({ data, periodo, sostId, widgetKey }) {
  // Renderiza solo el fragmento relevante según la clave granular
  if (!data) return <div style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>Cargando datos de territorio…</div>
  if (widgetKey.startsWith('te_complejidad')) {
    return <RenderComplejidadEducativa data={data} periodo={periodo} widgetFilter={widgetKey} />
  }
  if (widgetKey.startsWith('te_gasto')) {
    return <RenderGastoEducativo sostId={sostId} periodo={periodo} widgetFilter={widgetKey} />
  }
  return null
}
