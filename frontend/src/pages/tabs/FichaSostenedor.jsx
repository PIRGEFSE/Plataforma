import { useEffect, useState, useRef, useCallback, createContext, useContext } from 'react'
import ReactECharts from 'echarts-for-react'
import api from '../../lib/api'
import { useChartColors } from '../../hooks/useChartColors'
import { useAuth } from '../../hooks/useAuth'
import { fmtMM, fmtMonedaCorto, fmtN } from '../../lib/format'

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
const MoneyFmtCtx = createContext({ fmtAmt: fmtMM, fmtAxisAmt: fmtMonedaCorto, unitLabel: 'mM$' })
const useMoneyFmt = () => useContext(MoneyFmtCtx)

const SECTION_TITLES = {
  perfil: { icon: '🏛️', label: 'Mi Ficha' },
  financiero: { icon: '💵', label: 'Financiero — Comparación por Establecimiento' },
  eficiencia: { icon: '⚙️', label: 'Eficiencia del Gasto — por Establecimiento' },
  sostenibilidad: { icon: '🛡️', label: 'Sostenibilidad — por Establecimiento' },
  riesgo: { icon: '📊', label: 'Riesgo — por Establecimiento' },
  territorio: { icon: '🗺️', label: 'Territorio — IVE por Establecimiento' },
}

// ── Componente principal ───────────────────────────────────────────────────────
// ── Componente principal ───────────────────────────────────────────────────────
export default function FichaSostenedor({ section = 'perfil' }) {
  const { user } = useAuth()
  const [perfil, setPerfil] = useState(null)
  const [establecimientos, setEstablecimientos] = useState([])
  const [loadingPerfil, setLoadingPerfil] = useState(true)

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

  // Carga datos de Territorio (IVE)
  useEffect(() => {
    if (section !== 'territorio') return
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
          <span style={{ padding: '0.3rem 0.8rem', borderRadius: '999px', background: '#05966922', color: '#34d399', border: '1px solid #059669', fontSize: '0.78rem', fontWeight: 600 }}>
            ✅ Riesgo Bajo
          </span>
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

      {section !== 'perfil' && section !== 'territorio' && (
        loadingRbd
          ? <div className="loading-area"><div className="spinner" /></div>
          : <>
            {section === 'financiero' && <TabFinanciero rdbData={rdbData} periodo={periodo} />}
            {section === 'eficiencia' && <TabEficiencia rdbData={rdbData} periodo={periodo} sostId={sostId} />}
            {section === 'sostenibilidad' && <TabSostenibilidad rdbData={rdbData} periodo={periodo} />}
            {section === 'riesgo' && <TabRiesgo rdbData={rdbData} periodo={periodo} />}
          </>
      )}

      {section === 'territorio' && (
        loadingTerritorio
          ? <div className="loading-area"><div className="spinner" /></div>
          : <TabTerritorio data={territorioData} periodo={periodo} sostId={sostId} />
      )}
    </div>
    </MoneyFmtCtx.Provider>
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
      { name: 'Gasto',   type: 'bar', data: visible.map(d => Number(d.gasto)),   barMaxWidth: 16, itemStyle: { color: '#ef4444', borderRadius: [0, 4, 4, 0] } },
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

  const remTop = [...remuneraciones_rbd].sort((a, b) => Number(b.total_liquido) - Number(a.total_liquido)).slice(0, 15)
  const remOption = {
    tooltip: {
      trigger: 'axis', ...C.tooltip,
      formatter: params => {
        const d = remTop[params[0].dataIndex]
        return `<b>${shortName(d.nom_rbd, d.rbd)}</b><br/>Funcionarios: ${fmtN(d.funcionarios)}<br/>Total líq.: ${fmtAmt(d.total_liquido)}<br/>Prom.: $${fmtN(d.promedio_liquido)}`
      }
    },
    grid: { left: 260, right: 100, top: 20, bottom: 20 },
    xAxis: { type: 'value', axisLabel: { color: C.axisLabel, formatter: v => fmtAxisAmt(v) }, splitLine: { lineStyle: { color: C.splitLine } } },
    yAxis: { type: 'category', data: remTop.map(d => shortName(d.nom_rbd, d.rbd)), axisLabel: { color: C.axisLabel, fontSize: 10, width: 250, overflow: 'truncate' } },
    series: [{
      type: 'bar', barMaxWidth: 16, data: remTop.map(d => Number(d.total_liquido)),
      itemStyle: { color: '#f59e0b', borderRadius: [0, 4, 4, 0] },
      label: { show: true, position: 'right', formatter: p => fmtAmt(p.value), fontSize: 9, color: '#fde68a' },
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

  return (
    <>
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

      <div className="chart-card" style={{ marginBottom: '1.25rem' }}>
        <h3 className="chart-title">Ingreso vs Gasto por Establecimiento — {periodo} ({unitLabel})</h3>
        {visible.length === 0
          ? <p style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>Sin resultados para «{search}»</p>
          : <ReactECharts option={barOption} style={{ height: h }} />
        }
      </div>
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
      <div className="chart-card">
        <h3 className="chart-title">Top 15 — Remuneraciones Líquidas por Establecimiento — {periodo} ({unitLabel})</h3>
        <ReactECharts option={remOption} style={{ height: 440 }} />
      </div>
    </>
  )
}

// ── Tab: Eficiencia (Sub-tabs) ──────────────────────────────────────────────────
function TabEficiencia({ rdbData, periodo, sostId }) {
  const C = useChartColors()
  const [subTab, setSubTab] = useState(() => localStorage.getItem('pirgefse-fichasost-eficiencia') || 'innovacion')
  useEffect(() => { localStorage.setItem('pirgefse-fichasost-eficiencia', subTab) }, [subTab])

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
  const pgBtn = (dis) => ({ padding:'0.3rem 0.75rem', border:'1px solid var(--line-subtle)', borderRadius:'0.375rem', background: dis?'var(--surface-base)':'var(--surface-overlay)', color: dis?'var(--text-muted)':'var(--text-primary)', cursor: dis?'not-allowed':'pointer', fontSize:'0.8rem' })
  const inpSt = { padding:'0.35rem 0.75rem', backgroundColor:'var(--surface-base)', color: 'var(--text-primary)', border:'1px solid var(--line-subtle)', borderRadius:'0.375rem', fontSize:'0.8rem', minWidth:220 }

  return (
    <>
      <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
        <KPICard icon="📊" label="Prom. Gasto Admin" value={`${prom.toFixed(1)}%`} color={prom <= 15 ? '#10b981' : prom <= 25 ? '#f59e0b' : '#ef4444'} />
        <KPICard icon="🟢" label="EE Óptimos (≤15%)" value={fmtN(optim)} color="#10b981" />
        <KPICard icon="🔴" label="EE Elevados (>25%)" value={fmtN(elev)} color="#ef4444" />
        <KPICard icon="⚙️" label="EE Moderados" value={fmtN(sorted.length - optim - elev)} color="#f59e0b" />
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'1rem', flexWrap:'wrap' }}>
        <input type="text" placeholder="🔍 Buscar por nombre de establecimiento..." value={search} onChange={e => setSearch(e.target.value)} style={inpSt} />
        {search && <button onClick={() => setSearch('')} style={pgBtn(false)}>✕ Limpiar</button>}
        <span style={{ fontSize:'0.78rem', color: 'var(--text-muted)' }}>Mostrando <b style={{ color: C.axisLabel }}>{filtered.length===0?0:safePage*10+1}–{Math.min((safePage+1)*10,filtered.length)}</b> de <b style={{ color: C.axisLabel }}>{filtered.length}</b> establecimientos</span>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:'0.4rem' }}>
          <button disabled={safePage===0} onClick={() => setPage(p=>p-1)} style={pgBtn(safePage===0)}>← Anterior</button>
          <span style={{ color: 'var(--text-muted)', fontSize:'0.78rem', minWidth:56, textAlign:'center' }}>{safePage+1} / {totalPages}</span>
          <button disabled={safePage>=totalPages-1} onClick={() => setPage(p=>p+1)} style={pgBtn(safePage>=totalPages-1)}>Siguiente →</button>
        </div>
      </div>
      <div className="chart-card" style={{ marginBottom: '1.25rem' }}>
        <h3 className="chart-title">Distribución del Gasto por Categoría (%) — {periodo}</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '0.5rem' }}>
          <span style={{ color: '#10b981' }}>■</span> Aula &nbsp;<span style={{ color: '#ef4444' }}>■</span> Administrativo &nbsp;<span style={{ color: '#f59e0b' }}>■</span> Otros
        </p>
        <ReactECharts option={pct100Option} style={{ height: h }} />
      </div>
      <div className="chart-card">
        <h3 className="chart-title">Nivel de Gasto Administrativo por Establecimiento (%) — {periodo}</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '0.5rem' }}>
          <span style={{ color: '#10b981' }}>■</span> Óptimo ≤15% &nbsp;<span style={{ color: '#f59e0b' }}>■</span> Moderado ≤25% &nbsp;<span style={{ color: '#ef4444' }}>■</span> Elevado &gt;25%
        </p>
        <ReactECharts option={adminOption} style={{ height: h }} />
      </div>
    </>
  )
}

function RenderCostoAlumno({ sostId, periodo }) {
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

  return (
    <>
      <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
        <KPICard icon="🎓" label="Costo Prom. Alumno" value={fmtAmt(resumen.costo_promedio_general)} color="#3b82f6" sub="Nivel Sostenedor" />
        <KPICard icon="👨‍🎓" label="Matrícula Total" value={fmtN(resumen.total_matricula_evaluada)} color="#10b981" sub="Establecimientos evaluados" />
        <KPICard icon="📚" label="Gasto Docencia" value={fmtAmt(resumen.total_docencia)} color="#8b5cf6" />
        <KPICard icon="⚙️" label="Gasto Operacional" value={fmtAmt(resumen.total_operacional)} color="#f59e0b" />
      </div>

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

      <div className="chart-card" style={{ padding: 0, marginBottom: '1.5rem' }}>
        <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--line-subtle)' }}>
          <h3 className="chart-title" style={{ margin: 0 }}>Detalle Costo por Alumno — {periodo} ({fmtN(filtered.length)} resultados)</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ background: 'var(--surface-overlay)' }}>
                {[{h:'RBD',a:'left'},{h:'Establecimiento',a:'left'},{h:'Matrícula',a:'right'},{h:'Gasto Docencia',a:'right'},{h:'Gasto Operacional',a:'right'},{h:'Costo por Alumno',a:'right'}].map(({h,a})=>(
                  <th key={h} style={{padding:'0.55rem 0.8rem',color: 'var(--text-muted)',fontWeight:600,textAlign:a,borderBottom: '1px solid var(--line-subtle)',whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 && <tr><td colSpan={6} style={{padding:'2rem',textAlign:'center',color: 'var(--text-muted)'}}>Sin resultados para «{search}»</td></tr>}
              {paginated.map((ee, i) => (
                <tr key={`${ee.rbd}-${ee.nombre_rbd}`} style={{borderBottom: '1px solid var(--line-subtle)',background:i%2===0?'transparent':'var(--surface-overlay)'}}>
                  <td style={{padding:'0.45rem 0.8rem',color: C.axisLabel,fontFamily:'monospace',fontSize:'0.76rem'}}>{ee.rbd}</td>
                  <td style={{padding:'0.45rem 0.8rem',color: 'var(--text-primary)',maxWidth:260,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    <span title={ee.nombre_rbd}>{ee.nombre_rbd}</span>
                  </td>
                  <td style={{padding:'0.45rem 0.8rem',textAlign:'right',color: C.axisLabel,fontVariantNumeric:'tabular-nums'}}>{fmtN(ee.mat_total)}</td>
                  <td style={{padding:'0.45rem 0.8rem',textAlign:'right',color:'#8b5cf6',fontVariantNumeric:'tabular-nums'}}>{fmtAmt(ee.gasto_docencia)}</td>
                  <td style={{padding:'0.45rem 0.8rem',textAlign:'right',color:'#10b981',fontVariantNumeric:'tabular-nums'}}>{fmtAmt(ee.gasto_operacional)}</td>
                  <td style={{padding:'0.45rem 0.8rem',textAlign:'right',color:'#3b82f6',fontWeight:700,fontVariantNumeric:'tabular-nums'}}>{fmtAmt(ee.costo_por_alumno)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{padding:'0.75rem 1.25rem',borderTop: '1px solid var(--line-subtle)',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'0.5rem'}}>
          <span style={{color: 'var(--text-muted)',fontSize:'0.78rem'}}>{filtered.length===0?0:(safePage-1)*ITEMS_PER_PAGE+1}–{Math.min(safePage*ITEMS_PER_PAGE,filtered.length)} de {filtered.length}</span>
          <div style={{display:'flex',gap:'0.4rem',alignItems:'center'}}>
            <button disabled={safePage<=1} onClick={()=>setPage(p=>p-1)} style={pgBtn(safePage<=1)}>← Anterior</button>
            <span style={{color: 'var(--text-muted)',fontSize:'0.78rem',minWidth:60,textAlign:'center'}}>Pág. {safePage} / {totalPages}</span>
            <button disabled={safePage>=totalPages} onClick={()=>setPage(p=>p+1)} style={pgBtn(safePage>=totalPages)}>Siguiente →</button>
          </div>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1.25rem',marginBottom:'1.5rem'}}>
        <div className="chart-card">
          <h3 className="chart-title">Top 10 — Mayor Costo por Alumno (filtrado)</h3>
          {chartData.length===0
            ? <p style={{color: 'var(--text-muted)',padding:'2rem',textAlign:'center'}}>Sin datos.</p>
            : <ReactECharts option={barOption} style={{height:Math.max(280,chartData.length*38)}} />
          }
        </div>
        <div className="chart-card">
          <h3 className="chart-title">Distribución General de Costos</h3>
          <ReactECharts option={pieOption} style={{height:300}} />
        </div>
      </div>
    </>
  )
}



function RenderGastoAdministrativo({ sostId, periodo }) {
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

  return (
    <>
      <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
        <KPICard icon="💼" label="Gasto Total Remuneracional" value={fmtAmt(resumen.total_gasto)} color="#8b5cf6" />
        <KPICard icon="🏢" label="Centros de Costo" value={fmtN(resumen.centros)} color="#3b82f6" sub="Establec. + Adm. Central" />
        <KPICard icon="👨‍🏫" label="Gasto Docentes de Aula" value={fmtAmt(resumen.total_docaul)} color="#10b981" sub="Función DOCAUL" />
        <KPICard icon="📊" label="Promedio por Centro" value={fmtAmt(resumen.centros ? resumen.total_gasto / resumen.centros : 0)} color="#f59e0b" />
      </div>

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

      <div className="chart-card" style={{ padding: 0, marginBottom: '1.5rem' }}>
        <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--line-subtle)' }}>
          <h3 className="chart-title" style={{ margin: 0 }}>Distribución Remuneracional por RBD — {periodo} ({fmtN(filtered.length)} resultados)</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ background: 'var(--surface-overlay)' }}>
                {[{h:'RBD',a:'left'},{h:'Establecimiento',a:'left'},{h:'Doc. Aula',a:'right'},{h:'Asist. Parvularia',a:'right'},{h:'Doc. Directivo',a:'right'},{h:'Otros Gastos',a:'right'},{h:'Total Gasto',a:'right'}].map(({h,a})=>(
                  <th key={h} style={{padding:'0.55rem 0.8rem',color: 'var(--text-muted)',fontWeight:600,textAlign:a,borderBottom: '1px solid var(--line-subtle)',whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 && <tr><td colSpan={7} style={{padding:'2rem',textAlign:'center',color: 'var(--text-muted)'}}>Sin resultados para «{search}»</td></tr>}
              {paginated.map((ee, i) => (
                <tr key={`${ee.rbd}-${ee.nom_rbd}`} style={{borderBottom: '1px solid var(--line-subtle)',background:i%2===0?'transparent':'var(--surface-overlay)'}}>
                  <td style={{padding:'0.45rem 0.8rem',color: C.axisLabel,fontFamily:'monospace',fontSize:'0.76rem'}}>{ee.rbd || 'N/A'}</td>
                  <td style={{padding:'0.45rem 0.8rem',color: 'var(--text-primary)',maxWidth:240,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    <span title={ee.nom_rbd}>{ee.nom_rbd}</span>
                  </td>
                  <td style={{padding:'0.45rem 0.8rem',textAlign:'right',color:'#10b981',fontVariantNumeric:'tabular-nums'}}>{fmtAmt(ee.gasto_docaul)}</td>
                  <td style={{padding:'0.45rem 0.8rem',textAlign:'right',color:'#3b82f6',fontVariantNumeric:'tabular-nums'}}>{fmtAmt(ee.gasto_asipar)}</td>
                  <td style={{padding:'0.45rem 0.8rem',textAlign:'right',color:'#f59e0b',fontVariantNumeric:'tabular-nums'}}>{fmtAmt(ee.gasto_docdir)}</td>
                  <td style={{padding:'0.45rem 0.8rem',textAlign:'right',color: C.axisLabel,fontVariantNumeric:'tabular-nums'}}>{fmtAmt(ee.gasto_otros)}</td>
                  <td style={{padding:'0.45rem 0.8rem',textAlign:'right',color:'#8b5cf6',fontWeight:700,fontVariantNumeric:'tabular-nums'}}>{fmtAmt(ee.total_gasto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{padding:'0.75rem 1.25rem',borderTop: '1px solid var(--line-subtle)',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'0.5rem'}}>
          <span style={{color: 'var(--text-muted)',fontSize:'0.78rem'}}>{filtered.length===0?0:(safePage-1)*ITEMS_PER_PAGE+1}–{Math.min(safePage*ITEMS_PER_PAGE,filtered.length)} de {filtered.length}</span>
          <div style={{display:'flex',gap:'0.4rem',alignItems:'center'}}>
            <button disabled={safePage<=1} onClick={()=>setPage(p=>p-1)} style={pgBtn(safePage<=1)}>← Anterior</button>
            <span style={{color: 'var(--text-muted)',fontSize:'0.78rem',minWidth:60,textAlign:'center'}}>Pág. {safePage} / {totalPages}</span>
            <button disabled={safePage>=totalPages} onClick={()=>setPage(p=>p+1)} style={pgBtn(safePage>=totalPages)}>Siguiente →</button>
          </div>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1.25rem',marginBottom:'1.5rem'}}>
        <div className="chart-card">
          <h3 className="chart-title">Top 10 — Gasto por Tipo de Función (FUN)</h3>
          {gasto_por_funcion.length===0
            ? <p style={{color: 'var(--text-muted)',padding:'2rem',textAlign:'center'}}>Sin datos.</p>
            : <ReactECharts option={barOption} style={{height:Math.max(280,gasto_por_funcion.length*38)}} />
          }
        </div>
        <div className="chart-card">
          <h3 className="chart-title">Top 10 — Gasto por Cuenta Alias</h3>
          {gasto_por_cuenta.length===0
            ? <p style={{color: 'var(--text-muted)',padding:'2rem',textAlign:'center'}}>Sin datos.</p>
            : <ReactECharts option={pieOption} style={{height:300}} />
          }
        </div>
      </div>
    </>
  )
}


// ── Tab: Sostenibilidad ────────────────────────────────────────────────────────
function TabSostenibilidad({ rdbData, periodo }) {
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

  const pgBtnS = (dis) => ({ padding:'0.3rem 0.75rem', border:'1px solid var(--line-subtle)', borderRadius:'0.375rem', background: dis?'var(--surface-base)':'var(--surface-overlay)', color: dis?'var(--text-muted)':'var(--text-primary)', cursor: dis?'not-allowed':'pointer', fontSize:'0.8rem' })
  const inpStS = { padding:'0.35rem 0.75rem', backgroundColor:'var(--surface-base)', color: 'var(--text-primary)', border:'1px solid var(--line-subtle)', borderRadius:'0.375rem', fontSize:'0.8rem', minWidth:220 }

  return (
    <>
      <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
        <KPICard icon="📊" label="Ratio Prom. Rem/Ingreso" value={`${promRatio.toFixed(1)}%`} color={promRatio > 70 ? '#ef4444' : promRatio > 50 ? '#f59e0b' : '#10b981'} />
        <KPICard icon="✅" label="EE Saludables (<50%)" value={fmtN(saludables)} color="#10b981" />
        <KPICard icon="🟡" label="EE Moderados (50–70%)" value={fmtN(moderados)} color="#f59e0b" />
        <KPICard icon="🔴" label="EE Críticos (>70%)" value={fmtN(criticos)} color="#ef4444" />
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'1rem', flexWrap:'wrap' }}>
        <input type="text" placeholder="🔍 Buscar por nombre de establecimiento..." value={search} onChange={e => setSearch(e.target.value)} style={inpStS} />
        {search && <button onClick={() => setSearch('')} style={pgBtnS(false)}>✕ Limpiar</button>}
        <span style={{ fontSize:'0.78rem', color: 'var(--text-muted)' }}>Mostrando <b style={{ color: C.axisLabel }}>{filtered.length===0?0:safePage*10+1}–{Math.min((safePage+1)*10,filtered.length)}</b> de <b style={{ color: C.axisLabel }}>{filtered.length}</b> establecimientos</span>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:'0.4rem' }}>
          <button disabled={safePage===0} onClick={() => setPage(p=>p-1)} style={pgBtnS(safePage===0)}>← Anterior</button>
          <span style={{ color: 'var(--text-muted)', fontSize:'0.78rem', minWidth:56, textAlign:'center' }}>{safePage+1} / {totalPages}</span>
          <button disabled={safePage>=totalPages-1} onClick={() => setPage(p=>p+1)} style={pgBtnS(safePage>=totalPages-1)}>Siguiente →</button>
        </div>
      </div>
      <div className="chart-card" style={{ marginBottom: '1.25rem' }}>
        <h3 className="chart-title">Ratio Remuneraciones / Ingresos por Establecimiento (%) — {periodo}</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '0.5rem' }}>
          <span style={{ color: '#10b981' }}>■</span> Saludable &lt;50% &nbsp;<span style={{ color: '#f59e0b' }}>■</span> Moderado 50–70% &nbsp;<span style={{ color: '#ef4444' }}>■</span> Crítico &gt;70%
        </p>
        {visible.length===0 ? <p style={{ color: 'var(--text-muted)', padding:'2rem', textAlign:'center' }}>Sin resultados para «{search}»</p> : <ReactECharts option={ratioOption} style={{ height: h }} />}
      </div>
      <div className="chart-card">
        <h3 className="chart-title">Funcionarios vs Ingresos por Establecimiento — {periodo}</h3>
        <ReactECharts option={scatterOption} style={{ height: 320 }} />
      </div>
    </>
  )
}

// ── Tab: Riesgo ────────────────────────────────────────────────────────────────
function TabRiesgo({ rdbData, periodo }) {
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

  return (
    <>
      <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
        <KPICard icon="✅" label="EE Riesgo Bajo" value={fmtN(bajos)} color="#10b981" sub="≥90% rendido" />
        <KPICard icon="🟡" label="EE Riesgo Moderado" value={fmtN(moderados)} color="#f59e0b" sub="70–90% rendido" />
        <KPICard icon="🔴" label="EE Riesgo Alto" value={fmtN(altos)} color="#ef4444" sub="<70% rendido" />
        <KPICard icon="💸" label="Total No Rendido" value={fmtAmt(totalNR)} color={totalNR > 0 ? '#ef4444' : '#10b981'}
          sub={peorEE ? `Más bajo: ${shortName(peorEE.nom_rbd, peorEE.rbd)} (${Number(peorEE.pct_rendido).toFixed(0)}%)` : ''} />
      </div>
      <div className="chart-card" style={{ marginBottom: '1.25rem' }}>
        <h3 className="chart-title">Acreditación de Saldos por Establecimiento (%) — {periodo}</h3>
        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'0.75rem', flexWrap:'wrap' }}>
          <span style={{ fontSize:'0.78rem', color: 'var(--text-muted)' }}>Ordenado por % rendido ascendente. <span style={{ color:'#10b981' }}>■</span> Rendido &nbsp;<span style={{ color:'var(--surface-overlay)', border:'1px solid var(--line-subtle)', display:'inline-block', width:10, height:10, verticalAlign:'middle' }}></span> No rendido</span>
          <span style={{ fontSize:'0.78rem', color: 'var(--text-muted)' }}>Mostrando <b style={{ color: C.axisLabel }}>{chartFiltered.length===0?0:chartSafePage*10+1}–{Math.min((chartSafePage+1)*10,chartFiltered.length)}</b> de <b style={{ color: C.axisLabel }}>{chartFiltered.length}</b></span>
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:'0.4rem' }}>
            <button disabled={chartSafePage===0} onClick={() => setChartPage(p=>p-1)} style={{ padding:'0.3rem 0.6rem', border:'1px solid var(--line-subtle)', borderRadius:'0.375rem', background: chartSafePage===0?'var(--surface-base)':'var(--surface-overlay)', color: chartSafePage===0?'var(--text-muted)':'var(--text-primary)', cursor: chartSafePage===0?'not-allowed':'pointer', fontSize:'0.78rem' }}>← Anterior</button>
            <span style={{ color: 'var(--text-muted)', fontSize:'0.78rem', minWidth:56, textAlign:'center' }}>{chartSafePage+1} / {chartTotalPages}</span>
            <button disabled={chartSafePage>=chartTotalPages-1} onClick={() => setChartPage(p=>p+1)} style={{ padding:'0.3rem 0.6rem', border:'1px solid var(--line-subtle)', borderRadius:'0.375rem', background: chartSafePage>=chartTotalPages-1?'var(--surface-base)':'var(--surface-overlay)', color: chartSafePage>=chartTotalPages-1?'var(--text-muted)':'var(--text-primary)', cursor: chartSafePage>=chartTotalPages-1?'not-allowed':'pointer', fontSize:'0.78rem' }}>Siguiente →</button>
          </div>
        </div>
        {chartVisible.length===0 ? <p style={{ color: 'var(--text-muted)', padding:'2rem', textAlign:'center' }}>Sin resultados para «{searchTerm}»</p> : <ReactECharts option={acredOption} style={{ height: h }} />}
      </div>
      {montoOpt && (
        <div className="chart-card" style={{ marginBottom: '1.25rem' }}>
          <h3 className="chart-title">Top 20 — Monto No Rendido por Establecimiento ({unitLabel}) — {periodo}</h3>
          <ReactECharts option={montoOpt} style={{ height: 520 }} />
        </div>
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


// ── Tab: Territorio (Sub-tabs) ──────────────────────────────────────────────────
function TabTerritorio({ data, periodo, sostId }) {
  const C = useChartColors()
  const [subTab, setSubTab] = useState(() => localStorage.getItem('pirgefse-fichasost-territorio') || 'complejidad')
  useEffect(() => { localStorage.setItem('pirgefse-fichasost-territorio', subTab) }, [subTab])
  
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

function RenderComplejidadEducativa({ data, periodo }) {
  const C = useChartColors()
  const [search, setSearch] = useState('')
  const [nivelFilter, setNivelFilter] = useState('all')
  const [ruralFilter, setRuralFilter] = useState('all')
  const [page, setPage] = useState(1)
  const ITEMS_PER_PAGE = 10

  useEffect(() => { setPage(1) }, [search, nivelFilter, ruralFilter, data, periodo])

  if (!data) return (
    <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🗺️</div>
      <p>Sin datos de complejidad disponibles para este período.</p>
    </div>
  )

  const { ive_establecimientos = [], nivel_resumen = [], por_comuna = [], prioridades = {} } = data

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
  const NIV_CLR = { BASICA: '#60a5fa', MEDIA: '#34d399' }

  const prom_ive = data.ive_promedio ?? 0
  const total_ee = data.total_establecimientos ?? 0
  const total_mat = data.total_matricula ?? 0
  const altoVuln = ive_establecimientos.filter(e => (e.ive_sinae ?? 0) >= 0.9).length

  const chartData = [...filtered].sort((a, b) => (b.ive_sinae ?? 0) - (a.ive_sinae ?? 0)).slice(0, 10)

  const iveBarOption = {
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' }, ...C.tooltip,
      formatter: params => {
        const d = chartData[params[0].dataIndex]
        return `<b>${d.nom_establecimiento}</b> (${d.rbd})<br/>IVE: <b style="color:${iveColor(d.ive_sinae)}">${(d.ive_sinae * 100).toFixed(1)}%</b> — ${iveLabel(d.ive_sinae)}<br/>Nivel: ${d.nivel}<br/>Matrícula: ${fmtN(d.total_matricula)}`
      }
    },
    grid: { left: 270, right: 100, top: 20, bottom: 20 },
    xAxis: { type: 'value', max: 1, axisLabel: { color: C.axisLabel, formatter: v => `${(v * 100).toFixed(0)}%` }, splitLine: { lineStyle: { color: C.splitLine } } },
    yAxis: { type: 'category', data: chartData.map(d => d.nom_establecimiento.length > 36 ? d.nom_establecimiento.slice(0, 34) + '…' : d.nom_establecimiento), axisLabel: { color: C.axisLabel, fontSize: 10, width: 260, overflow: 'truncate' } },
    series: [{
      type: 'bar', barMaxWidth: 18,
      data: chartData.map(d => ({ value: d.ive_sinae, itemStyle: { color: iveColor(d.ive_sinae), borderRadius: [0, 4, 4, 0] } })),
      label: { show: true, position: 'right', formatter: p => `${(p.value * 100).toFixed(1)}%`, fontSize: 10, color: 'var(--text-primary)' },
      markLine: { silent: true, data: [{ xAxis: 0.7, lineStyle: { color: '#f59e0b', type: 'dashed' }, label: { formatter: '70%', color: '#f59e0b', fontSize: 9 } }, { xAxis: 0.9, lineStyle: { color: '#ef4444', type: 'dashed' }, label: { formatter: '90%', color: '#ef4444', fontSize: 9 } }] }
    }],
    backgroundColor: 'transparent',
  }

  const donaOption = {
    tooltip: { trigger: 'item', ...C.tooltip, formatter: p => `<b>${p.name}</b><br/>Matrícula: ${fmtN(p.value)}<br/>${p.percent.toFixed(1)}%` },
    legend: { orient: 'vertical', left: '60%', top: 'center', textStyle: { color: C.axisLabel, fontSize: 11 } },
    series: [{ type: 'pie', radius: ['45%', '70%'], center: ['30%', '50%'], data: nivel_resumen.map(n => ({ name: n.nivel, value: n.total_matricula, itemStyle: { color: NIV_CLR[n.nivel] ?? 'var(--text-muted)' } })), label: { show: false }, emphasis: { label: { show: true, fontSize: 13, fontWeight: 'bold', color: 'var(--text-primary)' } } }],
    backgroundColor: 'transparent',
  }

  const comunasChart = [...por_comuna].slice(0, 15)
  const comunaOption = {
    tooltip: { trigger: 'axis', ...C.tooltip, formatter: params => { const d = comunasChart[params[0].dataIndex]; return `<b>${d.nom_comuna}</b><br/>IVE prom: <b>${(d.ive_promedio * 100).toFixed(1)}%</b><br/>EE: ${d.n_establecimientos} · Mat: ${fmtN(d.total_matricula)}` } },
    grid: { left: 140, right: 80, top: 10, bottom: 10 },
    xAxis: { type: 'value', max: 1, axisLabel: { color: C.axisLabel, formatter: v => `${(v * 100).toFixed(0)}%` }, splitLine: { lineStyle: { color: C.splitLine } } },
    yAxis: { type: 'category', data: comunasChart.map(d => d.nom_comuna), axisLabel: { color: C.axisLabel, fontSize: 10, width: 130, overflow: 'truncate' } },
    series: [{ type: 'bar', barMaxWidth: 18, data: comunasChart.map(d => ({ value: d.ive_promedio, itemStyle: { color: iveColor(d.ive_promedio), borderRadius: [0, 4, 4, 0] } })), label: { show: true, position: 'right', formatter: p => `${(p.value * 100).toFixed(1)}%`, fontSize: 10, color: 'var(--text-primary)' } }],
    backgroundColor: 'transparent',
  }

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
    grid: { left: 20, right: 20, top: 40, bottom: 10 },
    xAxis: { type: 'value', axisLabel: { color: C.axisLabel, formatter: v => fmtN(v) }, splitLine: { lineStyle: { color: C.splitLine } } },
    yAxis: { type: 'category', data: ['Consolidado'], axisLabel: { color: C.axisLabel, fontSize: 11 } },
    series: prioData.map(d => ({ name: d.name, type: 'bar', stack: 'prio', barMaxWidth: 40, data: [d.value], itemStyle: { color: d.color }, label: { show: d.value > 0, position: 'inside', formatter: p => fmtN(p.value), fontSize: 10, color: '#fff', fontWeight: 600 } })),
    backgroundColor: 'transparent',
  }

  return (
    <>
      <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
        <KPICard icon="🗺️" label="Establec. con IVE" value={fmtN(total_ee)} color="#6366f1" />
        <KPICard icon="📊" label="IVE Promedio" value={`${(prom_ive * 100).toFixed(1)}%`} color={iveColor(prom_ive)} sub={iveLabel(prom_ive) + ' vulnerabilidad'} />
        <KPICard icon="🔴" label="IVE Alto (≥90%)" value={fmtN(altoVuln)} color="#ef4444" sub="establecimientos" />
        <KPICard icon="👨‍🎓" label="Matrícula Total" value={fmtN(total_mat)} color="#10b981" />
      </div>

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
                {[{h:'RBD',a:'left'},{h:'Nombre',a:'left'},{h:'Nivel',a:'center'},{h:'IVE',a:'center'},{h:'1ª Prior.',a:'right'},{h:'2ª Prior.',a:'right'},{h:'3ª Prior.',a:'right'},{h:'No Prior.',a:'right'},{h:'Total Mat.',a:'right'},{h:'Rural',a:'center'},{h:'Comuna',a:'left'}].map(({h,a})=>(
                  <th key={h} style={{padding:'0.55rem 0.8rem',color: 'var(--text-muted)',fontWeight:600,textAlign:a,borderBottom: '1px solid var(--line-subtle)',whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 && <tr><td colSpan={11} style={{padding:'2rem',textAlign:'center',color: 'var(--text-muted)'}}>Sin resultados para «{search}»</td></tr>}
              {paginated.map((ee, i) => {
                const ive = ee.ive_sinae ?? 0
                const clr = iveColor(ive)
                return (
                  <tr key={`${ee.rbd}-${ee.nivel}`} style={{borderBottom: '1px solid var(--line-subtle)',background:i%2===0?'transparent':'var(--surface-overlay)'}}>
                    <td style={{padding:'0.45rem 0.8rem',color: C.axisLabel,fontFamily:'monospace',fontSize:'0.76rem'}}>{ee.rbd}</td>
                    <td style={{padding:'0.45rem 0.8rem',color: 'var(--text-primary)',maxWidth:220,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}><span title={ee.nom_establecimiento}>{ee.nom_establecimiento}</span></td>
                    <td style={{padding:'0.45rem 0.8rem',textAlign:'center'}}>
                      <span style={{fontSize:'0.7rem',fontWeight:600,color:ee.nivel==='MEDIA'?'#34d399':'#60a5fa',background:ee.nivel==='MEDIA'?'#34d39922':'#60a5fa22',borderRadius:999,padding:'0.15rem 0.5rem',border:`1px solid ${ee.nivel==='MEDIA'?'#34d399':'#60a5fa'}`}}>{ee.nivel}</span>
                    </td>
                    <td style={{padding:'0.45rem 0.8rem',textAlign:'center'}}>
                      <span style={{fontSize:'0.78rem',fontWeight:700,color:clr,background:`${clr}22`,border:`1px solid ${clr}`,borderRadius:999,padding:'0.15rem 0.5rem'}}>{(ive*100).toFixed(1)}%</span>
                    </td>
                    <td style={{padding:'0.45rem 0.8rem',textAlign:'right',color:'#ef4444',fontVariantNumeric:'tabular-nums'}}>{fmtN(ee.primera_prioridad)}</td>
                    <td style={{padding:'0.45rem 0.8rem',textAlign:'right',color:'#f59e0b',fontVariantNumeric:'tabular-nums'}}>{fmtN(ee.segunda_prioridad)}</td>
                    <td style={{padding:'0.45rem 0.8rem',textAlign:'right',color:'#facc15',fontVariantNumeric:'tabular-nums'}}>{fmtN(ee.tercera_prioridad)}</td>
                    <td style={{padding:'0.45rem 0.8rem',textAlign:'right',color:'#10b981',fontVariantNumeric:'tabular-nums'}}>{fmtN(ee.no_priorizado)}</td>
                    <td style={{padding:'0.45rem 0.8rem',textAlign:'right',color: 'var(--text-primary)',fontWeight:600,fontVariantNumeric:'tabular-nums'}}>{fmtN(ee.total_matricula)}</td>
                    <td style={{padding:'0.45rem 0.8rem',textAlign:'center',color:ee.rural_rbd===1?'#f59e0b':'var(--line-subtle)'}}>{ee.rural_rbd===1?'🌿':'·'}</td>
                    <td style={{padding:'0.45rem 0.8rem',color: C.axisLabel,fontSize:'0.76rem'}}>{ee.nom_comuna}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{padding:'0.75rem 1.25rem',borderTop: '1px solid var(--line-subtle)',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'0.5rem'}}>
          <span style={{color: 'var(--text-muted)',fontSize:'0.78rem'}}>{filtered.length===0?0:(safePage-1)*ITEMS_PER_PAGE+1}–{Math.min(safePage*ITEMS_PER_PAGE,filtered.length)} de {filtered.length}</span>
          <div style={{display:'flex',gap:'0.4rem',alignItems:'center'}}>
            <button disabled={safePage<=1} onClick={()=>setPage(p=>p-1)} style={pgBtn(safePage<=1)}>← Anterior</button>
            <span style={{color: 'var(--text-muted)',fontSize:'0.78rem',minWidth:60,textAlign:'center'}}>Pág. {safePage} / {totalPages}</span>
            <button disabled={safePage>=totalPages} onClick={()=>setPage(p=>p+1)} style={pgBtn(safePage>=totalPages)}>Siguiente →</button>
          </div>
        </div>
      </div>

      <div className="chart-card" style={{ marginBottom: '1.5rem' }}>
        <h3 className="chart-title">Top 10 — IVE por Establecimiento (filtrado) — {periodo}</h3>
        <p style={{color: 'var(--text-muted)',fontSize:'0.78rem',marginBottom:'0.5rem'}}>
          <span style={{color:'#ef4444'}}>■</span> Alto ≥90% &nbsp;<span style={{color:'#f59e0b'}}>■</span> Medio 70–90% &nbsp;<span style={{color:'#10b981'}}>■</span> Bajo &lt;70%
        </p>
        {chartData.length===0
          ? <p style={{color: 'var(--text-muted)',padding:'2rem',textAlign:'center'}}>Sin datos para mostrar.</p>
          : <ReactECharts option={iveBarOption} style={{height:Math.max(280,chartData.length*38)}} />
        }
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1.25rem',marginBottom:'1.5rem'}}>
        <div className="chart-card">
          <h3 className="chart-title">Matrícula por Nivel — {periodo}</h3>
          <ReactECharts option={donaOption} style={{height:220}} />
          <div style={{marginTop:'0.5rem'}}>
            {nivel_resumen.map(n=>(
              <div key={n.nivel} style={{display:'flex',justifyContent:'space-between',padding:'0.3rem 0',borderBottom: '1px solid var(--line-subtle)',fontSize:'0.8rem'}}>
                <span style={{color:NIV_CLR[n.nivel]??'var(--text-muted)',fontWeight:600}}>{n.nivel}</span>
                <span style={{color: C.axisLabel}}>{n.n_establecimientos} EE · {fmtN(n.total_matricula)} mat. · IVE: <b style={{color:iveColor(n.ive_promedio)}}>{(n.ive_promedio*100).toFixed(1)}%</b></span>
              </div>
            ))}
          </div>
        </div>
        <div className="chart-card">
          <h3 className="chart-title">IVE Promedio por Comuna — Top 15</h3>
          {comunasChart.length===0
            ? <p style={{color: 'var(--text-muted)',textAlign:'center',padding:'2rem'}}>Sin datos.</p>
            : <ReactECharts option={comunaOption} style={{height:Math.max(220,comunasChart.length*26)}} />
          }
        </div>
      </div>

      <div className="chart-card">
        <h3 className="chart-title">Distribución de Prioridades de Vulnerabilidad — {periodo}</h3>
        <p style={{color: 'var(--text-muted)',fontSize:'0.78rem',marginBottom:'0.75rem'}}>Suma total de alumnos por categoría de prioridad IVE-SINAE.</p>
        <ReactECharts option={prioOption} style={{height:100}} />
        <div style={{display:'grid',gridTemplateColumns:'repeat(5, 1fr)',gap:'0.75rem',marginTop:'1rem'}}>
          {prioData.map(p=>(
            <div key={p.name} style={{textAlign:'center',background: 'var(--surface-overlay)',borderRadius:'0.5rem',padding:'0.6rem',border: '1px solid var(--line-subtle)'}}>
              <div style={{fontSize:'1.2rem',fontWeight:700,color:p.color}}>{fmtN(p.value)}</div>
              <div style={{fontSize:'0.7rem',color: 'var(--text-muted)',marginTop:'0.2rem'}}>{p.name}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function RenderGastoEducativo({ sostId, periodo }) {
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

  return (
    <>
      <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
        <KPICard icon="🏢" label="Centros de Costo" value={fmtN(resumen.total_centros)} color="#8b5cf6" sub="Establec. + Adm. Central" />
        <KPICard icon="💵" label="Gasto Total" value={fmt(resumen.total_gasto)} color="#10b981" />
        <KPICard icon="📄" label="Documentos" value={fmtN(resumen.total_documentos)} color="#3b82f6" />
        <KPICard icon="📊" label="Promedio por Centro" value={fmt(resumen.total_centros ? resumen.total_gasto / resumen.total_centros : 0)} color="#f59e0b" />
      </div>

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

      <div className="chart-card" style={{ padding: 0, marginBottom: '1.5rem' }}>
        <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--line-subtle)' }}>
          <h3 className="chart-title" style={{ margin: 0 }}>Gasto por Centro de Costo — {periodo} ({fmtN(filtered.length)} resultados)</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ background: 'var(--surface-overlay)' }}>
                {[{h:'RBD',a:'left'},{h:'Nombre / Centro Costo',a:'left'},{h:'Nº Docs',a:'right'},{h:'Rural',a:'center'},{h:'Comuna',a:'left'},{h:'Monto Total',a:'right'}].map(({h,a})=>(
                  <th key={h} style={{padding:'0.55rem 0.8rem',color: 'var(--text-muted)',fontWeight:600,textAlign:a,borderBottom: '1px solid var(--line-subtle)',whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 && <tr><td colSpan={6} style={{padding:'2rem',textAlign:'center',color: 'var(--text-muted)'}}>Sin resultados para «{search}»</td></tr>}
              {paginated.map((ee, i) => (
                <tr key={`${ee.rbd}-${ee.nombre_rbd}`} style={{borderBottom: '1px solid var(--line-subtle)',background:i%2===0?'transparent':'var(--surface-overlay)'}}>
                  <td style={{padding:'0.45rem 0.8rem',color: C.axisLabel,fontFamily:'monospace',fontSize:'0.76rem'}}>{ee.rbd || 'N/A'}</td>
                  <td style={{padding:'0.45rem 0.8rem',color: 'var(--text-primary)',maxWidth:280,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    <span title={ee.nombre_rbd}>{ee.nombre_rbd}</span>
                  </td>
                  <td style={{padding:'0.45rem 0.8rem',textAlign:'right',color: C.axisLabel,fontVariantNumeric:'tabular-nums'}}>{fmtN(ee.num_documentos)}</td>
                  <td style={{padding:'0.45rem 0.8rem',textAlign:'center',color:ee.rural_rbd===1?'#f59e0b':'var(--line-subtle)'}}>{ee.rural_rbd===1?'🌿':(ee.rbd? '·' : '')}</td>
                  <td style={{padding:'0.45rem 0.8rem',color: C.axisLabel,fontSize:'0.76rem'}}>{ee.nom_comuna || ''}</td>
                  <td style={{padding:'0.45rem 0.8rem',textAlign:'right',color:'#10b981',fontWeight:700,fontVariantNumeric:'tabular-nums'}}>{fmt(ee.total_gasto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{padding:'0.75rem 1.25rem',borderTop: '1px solid var(--line-subtle)',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'0.5rem'}}>
          <span style={{color: 'var(--text-muted)',fontSize:'0.78rem'}}>{filtered.length===0?0:(safePage-1)*ITEMS_PER_PAGE+1}–{Math.min(safePage*ITEMS_PER_PAGE,filtered.length)} de {filtered.length}</span>
          <div style={{display:'flex',gap:'0.4rem',alignItems:'center'}}>
            <button disabled={safePage<=1} onClick={()=>setPage(p=>p-1)} style={pgBtn(safePage<=1)}>← Anterior</button>
            <span style={{color: 'var(--text-muted)',fontSize:'0.78rem',minWidth:60,textAlign:'center'}}>Pág. {safePage} / {totalPages}</span>
            <button disabled={safePage>=totalPages} onClick={()=>setPage(p=>p+1)} style={pgBtn(safePage>=totalPages)}>Siguiente →</button>
          </div>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1.25rem',marginBottom:'1.5rem'}}>
        <div className="chart-card">
          <h3 className="chart-title">Top 10 — Mayor Gasto (filtrado)</h3>
          {chartData.length===0
            ? <p style={{color: 'var(--text-muted)',padding:'2rem',textAlign:'center'}}>Sin datos.</p>
            : <ReactECharts option={barOption} style={{height:Math.max(280,chartData.length*38)}} />
          }
        </div>
        <div className="chart-card">
          <h3 className="chart-title">Gasto por Categoría (Cuenta Padre)</h3>
          <ReactECharts option={pieOption} style={{height:300}} />
          <div style={{marginTop:'0.5rem', maxHeight:'200px', overflowY:'auto'}}>
            {cuentaChart.map((c, i) => (
              <div key={c.categoria} style={{display:'flex',justifyContent:'space-between',padding:'0.3rem 0',borderBottom: '1px solid var(--line-subtle)',fontSize:'0.75rem'}}>
                <span style={{color:COLORS[i % COLORS.length] || 'var(--text-muted)', fontWeight:600, flex:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}} title={c.categoria}>{c.categoria}</span>
                <span style={{color: 'var(--text-primary)', fontWeight:600, marginLeft:'0.5rem'}}>{fmt(c.total_gasto)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
