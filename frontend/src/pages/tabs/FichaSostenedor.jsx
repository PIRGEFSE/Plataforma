import { useEffect, useState, useRef, useCallback, createContext, useContext } from 'react'
import ReactECharts from 'echarts-for-react'
import api from '../../lib/api'
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
  110: { label: 'Básica', color: '#60a5fa' },
  160: { label: 'Básica Adultos', color: '#93c5fd' },
  161: { label: 'Básica Esp. Adultos', color: '#93c5fd' },
  163: { label: 'Básica Cárcel', color: '#475569' },
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
  362: { label: 'Media H-C Cárcel', color: '#475569' },
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
  if (unicos.length === 0) return <span style={{ color: '#334155' }}>—</span>
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem', maxWidth: 280 }}>
      {unicos.map(cod => {
        const e = ENS_MAP[cod]
        const lbl = e?.label ?? `Cod ${cod}`
        const clr = e?.color ?? '#94a3b8'
        return (
          <span key={cod} title={lbl}
            style={{
              fontSize: '0.65rem', fontWeight: 600, color: '#0f172a',
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
      <span style={{ color: '#64748b', fontSize: '0.82rem' }}>Año:</span>
      <select className="filter-select" value={value} onChange={e => onChange(Number(e.target.value))} style={{ minWidth: 90 }}>
        {periodos.map(p => <option key={p} value={p}>{p}</option>)}
      </select>
    </div>
  )
}

function UnitSelector({ value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <span style={{ color: '#64748b', fontSize: '0.82rem' }}>Unidad:</span>
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

function tt() {
  return { backgroundColor: '#1e293b', borderColor: '#334155', textStyle: { color: '#f1f5f9', fontSize: 11 } }
}

// ── Contexto de formato monetario ─────────────────────────────────────────
const MoneyFmtCtx = createContext({ fmtAmt: fmtMM, fmtAxisAmt: fmtMonedaCorto, unitLabel: 'mM$' })
const useMoneyFmt = () => useContext(MoneyFmtCtx)

const SECTION_TITLES = {
  perfil: { icon: '🏛️', label: 'Mi Ficha' },
  financiero: { icon: '💵', label: 'Financiero — Comparación por Establecimiento' },
  eficiencia: { icon: '⚙️', label: 'Eficiencia del Gasto — por Establecimiento' },
  sostenibilidad: { icon: '🛡️', label: 'Sostenibilidad — por Establecimiento' },
  riesgo: { icon: '📊', label: 'Riesgo — por Establecimiento' },
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
      <div className="tab-header" style={{ position: 'sticky', top: 0, zIndex: 20, backgroundColor: '#0b1120', boxShadow: '0 2px 12px rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)' }}>
        <div>
          <h2 className="tab-title">{sec.icon} {perfil.nombre_sost}</h2>
          <p className="tab-subtitle">
            {sec.label} · RUT {perfil.rut_sost} · {perfil.nom_com_sost}, Región {perfil.cod_reg_sost}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <PeriodoSelector periodos={periodos} value={periodo} onChange={setPeriodo} />
          <UnitSelector value={unitMode} onChange={setUnitMode} />
          <span style={{ padding: '0.3rem 0.8rem', borderRadius: '999px', background: '#1e40af22', color: '#60a5fa', border: '1px solid #1e40af', fontSize: '0.78rem', fontWeight: 600 }}>
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

      {section !== 'perfil' && (
        loadingRbd
          ? <div className="loading-area"><div className="spinner" /></div>
          : <>
            {section === 'financiero' && <TabFinanciero rdbData={rdbData} periodo={periodo} />}
            {section === 'eficiencia' && <TabEficiencia rdbData={rdbData} periodo={periodo} />}
            {section === 'sostenibilidad' && <TabSostenibilidad rdbData={rdbData} periodo={periodo} />}
            {section === 'riesgo' && <TabRiesgo rdbData={rdbData} periodo={periodo} />}
          </>
      )}
    </div>
    </MoneyFmtCtx.Provider>
  )
}

// ── Tab: Perfil ───────────────────────────────────────────────────────────────
function TabPerfil({ perfil, establecimientos, financiero_rbd = [], loadingRbd }) {
  const { fmtAmt, fmtAxisAmt } = useMoneyFmt()
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

  const inputStyle = { padding: '0.4rem 0.8rem', backgroundColor: '#0f172a', color: '#f1f5f9', border: '1px solid #334155', borderRadius: '0.375rem', fontSize: '0.8rem' };

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
            { label: 'Cerrados / Receso', val: fmtN(sinMat.length), color: '#64748b', icon: '⏸️' },
            { label: 'Convenio PIE', val: fmtN(activos.filter(e => e.convenio_pie).length), color: '#6366f1', icon: '🔵' },
            { label: 'PACE', val: fmtN(activos.filter(e => e.pace).length), color: '#8b5cf6', icon: '🎓' },
            { label: 'Rurales', val: fmtN(activos.filter(e => e.rural_rbd).length), color: '#f59e0b', icon: '🌿' },
            { label: 'Urbanos', val: fmtN(activos.filter(e => !e.rural_rbd).length), color: '#22d3ee', icon: '🏙️' },
          ].map(kpi => (
            <div key={kpi.label} style={{ background: '#0f172a', borderRadius: '0.5rem', padding: '0.75rem', border: '1px solid #1e293b', textAlign: 'center' }}>
              <div style={{ fontSize: '1.1rem' }}>{kpi.icon}</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: kpi.color, marginTop: '0.25rem' }}>{kpi.val}</div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.15rem' }}>{kpi.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabla de establecimientos con ingresos y gastos */}
      <div className="chart-card" style={{ padding: 0 }}>
        <div style={{ padding: '1rem 1.25rem 0.75rem', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h3 className="chart-title" style={{ margin: 0 }}>Catálogo de Establecimientos ({fmtN(filteredEstablecimientos.length)} resultados)</h3>
            {loadingRbd && <span style={{ color: '#64748b', fontSize: '0.78rem' }}>Cargando datos financieros…</span>}
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
              <tr style={{ background: '#0f172a' }}>
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
                  <th key={h} style={{ padding: '0.6rem 0.9rem', color: '#64748b', fontWeight: 600, textAlign: align, borderBottom: '1px solid #1e293b', whiteSpace: 'nowrap' }}>{h}</th>
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
                  <tr key={ee.rbd} style={{ borderBottom: '1px solid #1e293b', background: i % 2 === 0 ? 'transparent' : '#0f172a44' }}>
                    <td style={{ padding: '0.5rem 0.9rem', color: '#94a3b8', fontFamily: 'monospace', fontSize: '0.78rem' }}>{ee.rbd}</td>
                    <td style={{ padding: '0.5rem 0.9rem', color: '#e2e8f0', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><span title={ee.nom_rbd}>{ee.nom_rbd}</span></td>
                    <td style={{ padding: '0.5rem 0.9rem' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, color, background: `${color}22`, border: `1px solid ${color}`, borderRadius: 999, padding: '0.15rem 0.5rem' }}>{estado}</span>
                    </td>
                    <td style={{ padding: '0.5rem 0.9rem', color: '#f1f5f9', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtN(ee.mat_total)}</td>
                    <td style={{ padding: '0.5rem 0.9rem', color: '#10b981', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{ingreso != null ? fmtAmt(ingreso) : <span style={{ color: '#334155' }}>—</span>}</td>
                    <td style={{ padding: '0.5rem 0.9rem', color: '#ef4444', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{gasto != null ? fmtAmt(gasto) : <span style={{ color: '#334155' }}>—</span>}</td>
                    <td style={{ padding: '0.5rem 0.9rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {superav != null
                        ? <strong style={{ color: superav >= 0 ? '#10b981' : '#ef4444' }}>{fmtAmt(superav)}</strong>
                        : <span style={{ color: '#334155' }}>—</span>}
                    </td>
                    <td style={{ padding: '0.5rem 0.6rem' }}>{getEnsenanzas(ee)}</td>
                    <td style={{ padding: '0.5rem 0.9rem', color: ee.rural_rbd ? '#f59e0b' : '#334155', textAlign: 'center' }}>{ee.rural_rbd ? '🌿' : '·'}</td>
                    <td style={{ padding: '0.5rem 0.9rem', color: ee.convenio_pie ? '#6366f1' : '#334155', textAlign: 'center' }}>{ee.convenio_pie ? '✓' : '·'}</td>
                    <td style={{ padding: '0.5rem 0.9rem', color: ee.pace ? '#8b5cf6' : '#334155', textAlign: 'center' }}>{ee.pace ? '✓' : '·'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '1rem', borderTop: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <span style={{ color: '#64748b', fontSize: '0.8rem' }}>
            Mostrando {filteredEstablecimientos.length === 0 ? 0 : ((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, filteredEstablecimientos.length)} de {filteredEstablecimientos.length}
          </span>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
              style={{ padding: '0.3rem 0.6rem', border: '1px solid #334155', background: currentPage === 1 ? '#0f172a' : '#1e293b', color: currentPage === 1 ? '#475569' : '#e2e8f0', borderRadius: '0.375rem', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
            >
              Anterior
            </button>
            <span style={{ padding: '0.3rem 0.6rem', color: '#94a3b8', fontSize: '0.85rem' }}>
              Página {currentPage} de {totalPages || 1}
            </span>
            <button
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage(prev => prev + 1)}
              style={{ padding: '0.3rem 0.6rem', border: '1px solid #334155', background: (currentPage === totalPages || totalPages === 0) ? '#0f172a' : '#1e293b', color: (currentPage === totalPages || totalPages === 0) ? '#475569' : '#e2e8f0', borderRadius: '0.375rem', cursor: (currentPage === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer' }}
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
      trigger: 'axis', axisPointer: { type: 'shadow' }, ...tt(),
      formatter: params => {
        const d = visible[params[0].dataIndex]
        return `<b>${shortName(d.nom_rbd, d.rbd)}</b> (${d.rbd})<br/>
          📈 Ingreso: ${fmtAmt(d.ingreso)}<br/>📉 Gasto: ${fmtAmt(d.gasto)}<br/>⚖️ Superávit: <b>${fmtAmt(d.superavit)}</b>`
      },
    },
    legend: { data: ['Ingreso', 'Gasto'], textStyle: { color: '#94a3b8' }, top: 0 },
    grid: { left: 260, right: 100, top: 40, bottom: 20 },
    xAxis: { type: 'value', axisLabel: { color: '#94a3b8', formatter: v => fmtAxisAmt(v) }, splitLine: { lineStyle: { color: '#1e293b' } } },
    yAxis: { type: 'category', data: names, axisLabel: { color: '#e2e8f0', fontSize: 10, width: 250, overflow: 'truncate' } },
    series: [
      { name: 'Ingreso', type: 'bar', data: visible.map(d => Number(d.ingreso)), barMaxWidth: 16, itemStyle: { color: '#10b981', borderRadius: [0, 4, 4, 0] } },
      { name: 'Gasto',   type: 'bar', data: visible.map(d => Number(d.gasto)),   barMaxWidth: 16, itemStyle: { color: '#ef4444', borderRadius: [0, 4, 4, 0] } },
    ],
    backgroundColor: 'transparent',
  }

  const superavitOption = {
    tooltip: {
      trigger: 'axis', ...tt(),
      formatter: params => {
        const d = visible[params[0].dataIndex]
        const v = Number(d.superavit)
        return `<b>${shortName(d.nom_rbd, d.rbd)}</b><br/>Superávit: <b style="color:${v >= 0 ? '#10b981' : '#ef4444'}">${fmtAmt(v)}</b>`
      },
    },
    grid: { left: 260, right: 100, top: 20, bottom: 20 },
    xAxis: { type: 'value', axisLabel: { color: '#94a3b8', formatter: v => fmtAxisAmt(v) }, splitLine: { lineStyle: { color: '#1e293b' } } },
    yAxis: { type: 'category', data: names, axisLabel: { color: '#e2e8f0', fontSize: 10, width: 250, overflow: 'truncate' } },
    series: [{
      type: 'bar', barMaxWidth: 16,
      data: visible.map(d => ({ value: Number(d.superavit), itemStyle: { color: Number(d.superavit) >= 0 ? '#10b981' : '#ef4444', borderRadius: [0, 4, 4, 0] } })),
      markLine: { silent: true, data: [{ xAxis: 0, lineStyle: { color: '#475569', type: 'dashed' } }] },
    }],
    backgroundColor: 'transparent',
  }

  const remTop = [...remuneraciones_rbd].sort((a, b) => Number(b.total_liquido) - Number(a.total_liquido)).slice(0, 15)
  const remOption = {
    tooltip: {
      trigger: 'axis', ...tt(),
      formatter: params => {
        const d = remTop[params[0].dataIndex]
        return `<b>${shortName(d.nom_rbd, d.rbd)}</b><br/>Funcionarios: ${fmtN(d.funcionarios)}<br/>Total líq.: ${fmtAmt(d.total_liquido)}<br/>Prom.: $${fmtN(d.promedio_liquido)}`
      }
    },
    grid: { left: 260, right: 100, top: 20, bottom: 20 },
    xAxis: { type: 'value', axisLabel: { color: '#94a3b8', formatter: v => fmtAxisAmt(v) }, splitLine: { lineStyle: { color: '#1e293b' } } },
    yAxis: { type: 'category', data: remTop.map(d => shortName(d.nom_rbd, d.rbd)), axisLabel: { color: '#e2e8f0', fontSize: 10, width: 250, overflow: 'truncate' } },
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
    padding: '0.35rem 0.75rem', backgroundColor: '#0f172a', color: '#f1f5f9',
    border: '1px solid #334155', borderRadius: '0.375rem', fontSize: '0.8rem', minWidth: 220,
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
            style={{ padding: '0.3rem 0.6rem', background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.78rem' }}
          >
            ✕ Limpiar
          </button>
        )}
        <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
          Mostrando{' '}
          <b style={{ color: '#94a3b8' }}>{filtered.length === 0 ? 0 : safePage * 10 + 1}–{Math.min((safePage + 1) * 10, filtered.length)}</b>
          {' '}de <b style={{ color: '#94a3b8' }}>{filtered.length}</b> establecimientos
        </span>
        {/* Botones Anterior / Siguiente alineados a la derecha */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button
            disabled={safePage === 0}
            onClick={() => setPage(p => p - 1)}
            style={{
              padding: '0.3rem 0.75rem', border: '1px solid #334155', borderRadius: '0.375rem',
              background: safePage === 0 ? '#0f172a' : '#1e293b',
              color: safePage === 0 ? '#475569' : '#e2e8f0',
              cursor: safePage === 0 ? 'not-allowed' : 'pointer', fontSize: '0.8rem',
            }}
          >
            ← Anterior
          </button>
          <span style={{ color: '#64748b', fontSize: '0.78rem', minWidth: 56, textAlign: 'center' }}>
            {safePage + 1} / {totalPages}
          </span>
          <button
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage(p => p + 1)}
            style={{
              padding: '0.3rem 0.75rem', border: '1px solid #334155', borderRadius: '0.375rem',
              background: safePage >= totalPages - 1 ? '#0f172a' : '#1e293b',
              color: safePage >= totalPages - 1 ? '#475569' : '#e2e8f0',
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
          ? <p style={{ color: '#64748b', padding: '2rem', textAlign: 'center' }}>Sin resultados para «{search}»</p>
          : <ReactECharts option={barOption} style={{ height: h }} theme="dark" />
        }
      </div>
      <div className="chart-card" style={{ marginBottom: '1.25rem' }}>
        <h3 className="chart-title">Superávit / Déficit por Establecimiento — {periodo} ({unitLabel})</h3>
        <p style={{ color: '#64748b', fontSize: '0.78rem', marginBottom: '0.5rem' }}>
          <span style={{ color: '#10b981' }}>■</span> Superávit &nbsp;<span style={{ color: '#ef4444' }}>■</span> Déficit
        </p>
        {visible.length === 0
          ? <p style={{ color: '#64748b', padding: '2rem', textAlign: 'center' }}>Sin resultados para «{search}»</p>
          : <ReactECharts option={superavitOption} style={{ height: h }} theme="dark" />
        }
      </div>
      <div className="chart-card">
        <h3 className="chart-title">Top 15 — Remuneraciones Líquidas por Establecimiento — {periodo} ({unitLabel})</h3>
        <ReactECharts option={remOption} style={{ height: 440 }} theme="dark" />
      </div>
    </>
  )
}

// ── Tab: Eficiencia del Gasto por RBD ─────────────────────────────────────────
function TabEficiencia({ rdbData, periodo }) {
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

  const pct100Option = {
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' }, ...tt(),
      formatter: params => {
        const d = visible[params[0].dataIndex]
        const ef = EF_COLORS[d.nivel_eficiencia] ?? '#94a3b8'
        return `<b>${shortName(d.nom_rbd, d.rbd)}</b><br/>
          <span style="color:#10b981">■</span> Aula: ${d.pct_aula}%<br/>
          <span style="color:#ef4444">■</span> Admin: <b style="color:${ef}">${d.pct_admin}%</b> — ${d.nivel_eficiencia}<br/>
          <span style="color:#f59e0b">■</span> Otros: ${d.pct_otros}%<br/>
          Total: ${fmtAmt(d.total_gasto)}`
      },
    },
    legend: { data: ['Gasto en Aula', 'Gasto Administrativo', 'Otros Gastos'], textStyle: { color: '#94a3b8' }, top: 0 },
    grid: { left: 260, right: 80, top: 40, bottom: 20 },
    xAxis: { type: 'value', max: 100, axisLabel: { color: '#94a3b8', formatter: v => `${v}%` }, splitLine: { lineStyle: { color: '#1e293b' } } },
    yAxis: { type: 'category', data: names, axisLabel: { color: '#e2e8f0', fontSize: 10, width: 250, overflow: 'truncate' } },
    series: [
      { name: 'Gasto en Aula', type: 'bar', stack: 'pct', barMaxWidth: 16, data: visible.map(d => d.pct_aula), itemStyle: { color: '#10b981' } },
      { name: 'Gasto Administrativo', type: 'bar', stack: 'pct', barMaxWidth: 16, data: visible.map(d => d.pct_admin), itemStyle: { color: '#ef4444' } },
      { name: 'Otros Gastos', type: 'bar', stack: 'pct', barMaxWidth: 16, data: visible.map(d => d.pct_otros), itemStyle: { color: '#f59e0b' } },
    ],
    backgroundColor: 'transparent',
  }

  const adminOption = {
    tooltip: {
      trigger: 'axis', ...tt(),
      formatter: params => { const d = visible[params[0].dataIndex]; return `<b>${shortName(d.nom_rbd, d.rbd)}</b><br/>% Administrativo: <b>${d.pct_admin}%</b> — ${d.nivel_eficiencia}` }
    },
    grid: { left: 260, right: 80, top: 20, bottom: 20 },
    xAxis: { type: 'value', max: 100, axisLabel: { color: '#94a3b8', formatter: v => `${v}%` }, splitLine: { lineStyle: { color: '#1e293b' } } },
    yAxis: { type: 'category', data: names, axisLabel: { color: '#e2e8f0', fontSize: 10, width: 250, overflow: 'truncate' } },
    series: [{
      type: 'bar', barMaxWidth: 16,
      data: visible.map(d => ({ value: d.pct_admin, itemStyle: { color: EF_COLORS[d.nivel_eficiencia] ?? '#94a3b8', borderRadius: [0, 4, 4, 0] } })),
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
  const pgBtn = (dis) => ({ padding:'0.3rem 0.75rem', border:'1px solid #334155', borderRadius:'0.375rem', background: dis?'#0f172a':'#1e293b', color: dis?'#475569':'#e2e8f0', cursor: dis?'not-allowed':'pointer', fontSize:'0.8rem' })
  const inpSt = { padding:'0.35rem 0.75rem', backgroundColor:'#0f172a', color:'#f1f5f9', border:'1px solid #334155', borderRadius:'0.375rem', fontSize:'0.8rem', minWidth:220 }

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
        <span style={{ fontSize:'0.78rem', color:'#64748b' }}>Mostrando <b style={{ color:'#94a3b8' }}>{filtered.length===0?0:safePage*10+1}–{Math.min((safePage+1)*10,filtered.length)}</b> de <b style={{ color:'#94a3b8' }}>{filtered.length}</b> establecimientos</span>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:'0.4rem' }}>
          <button disabled={safePage===0} onClick={() => setPage(p=>p-1)} style={pgBtn(safePage===0)}>← Anterior</button>
          <span style={{ color:'#64748b', fontSize:'0.78rem', minWidth:56, textAlign:'center' }}>{safePage+1} / {totalPages}</span>
          <button disabled={safePage>=totalPages-1} onClick={() => setPage(p=>p+1)} style={pgBtn(safePage>=totalPages-1)}>Siguiente →</button>
        </div>
      </div>
      <div className="chart-card" style={{ marginBottom: '1.25rem' }}>
        <h3 className="chart-title">Distribución del Gasto por Categoría (%) — {periodo}</h3>
        <p style={{ color: '#64748b', fontSize: '0.78rem', marginBottom: '0.5rem' }}>
          <span style={{ color: '#10b981' }}>■</span> Aula &nbsp;<span style={{ color: '#ef4444' }}>■</span> Administrativo &nbsp;<span style={{ color: '#f59e0b' }}>■</span> Otros
        </p>
        <ReactECharts option={pct100Option} style={{ height: h }} theme="dark" />
      </div>
      <div className="chart-card">
        <h3 className="chart-title">Nivel de Gasto Administrativo por Establecimiento (%) — {periodo}</h3>
        <p style={{ color: '#64748b', fontSize: '0.78rem', marginBottom: '0.5rem' }}>
          <span style={{ color: '#10b981' }}>■</span> Óptimo ≤15% &nbsp;<span style={{ color: '#f59e0b' }}>■</span> Moderado ≤25% &nbsp;<span style={{ color: '#ef4444' }}>■</span> Elevado &gt;25%
        </p>
        <ReactECharts option={adminOption} style={{ height: h }} theme="dark" />
      </div>
    </>
  )
}

// ── Tab: Sostenibilidad ────────────────────────────────────────────────────────
function TabSostenibilidad({ rdbData, periodo }) {
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
      trigger: 'axis', axisPointer: { type: 'shadow' }, ...tt(),
      formatter: params => {
        const d = visible[params[0].dataIndex]
        return `<b>${shortName(d.nom_rbd, d.rbd)}</b><br/>
          Remuneraciones: ${fmtAmt(d.total_liq)}<br/>Ingresos: ${fmtAmt(d.ingreso)}<br/>
          Ratio: <b>${d.ratio != null ? d.ratio + '%' : 'N/D'}</b> — ${d.nivel_ratio}`
      }
    },
    grid: { left: 260, right: 80, top: 20, bottom: 20 },
    xAxis: { type: 'value', axisLabel: { color: '#94a3b8', formatter: v => `${v}%` }, splitLine: { lineStyle: { color: '#1e293b' } } },
    yAxis: { type: 'category', data: names, axisLabel: { color: '#e2e8f0', fontSize: 10, width: 250, overflow: 'truncate' } },
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
      trigger: 'item', ...tt(),
      formatter: p => { const d = merged[p.dataIndex]; return `<b>${shortName(d.nom_rbd, d.rbd)}</b><br/>Funcionarios: ${fmtN(d.funcionarios)}<br/>Ingresos: ${fmtAmt(d.ingreso)}<br/>Ratio: ${d.ratio ?? 'N/D'}%` }
    },
    grid: { left: 80, right: 20, top: 20, bottom: 40 },
    xAxis: { name: 'Funcionarios', type: 'value', axisLabel: { color: '#94a3b8' }, splitLine: { lineStyle: { color: '#1e293b' } } },
    yAxis: { name: `Ingresos (${unitLabel})`, type: 'value', axisLabel: { color: '#94a3b8', formatter: v => fmtAxisAmt(v) }, splitLine: { lineStyle: { color: '#1e293b' } } },
    series: [{ type: 'scatter', data: merged.map(d => [d.funcionarios, d.ingreso]), symbolSize: 10, itemStyle: { color: '#8b5cf6', opacity: 0.8 } }],
    backgroundColor: 'transparent',
  }

  const criticos = merged.filter(d => d.nivel_ratio === 'Crítico').length
  const moderados = merged.filter(d => d.nivel_ratio === 'Moderado').length
  const saludables = merged.filter(d => d.nivel_ratio === 'Saludable').length
  const promRatio = merged.filter(d => d.ratio != null).reduce((s, d) => s + d.ratio, 0) / (merged.filter(d => d.ratio != null).length || 1)

  const pgBtnS = (dis) => ({ padding:'0.3rem 0.75rem', border:'1px solid #334155', borderRadius:'0.375rem', background: dis?'#0f172a':'#1e293b', color: dis?'#475569':'#e2e8f0', cursor: dis?'not-allowed':'pointer', fontSize:'0.8rem' })
  const inpStS = { padding:'0.35rem 0.75rem', backgroundColor:'#0f172a', color:'#f1f5f9', border:'1px solid #334155', borderRadius:'0.375rem', fontSize:'0.8rem', minWidth:220 }

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
        <span style={{ fontSize:'0.78rem', color:'#64748b' }}>Mostrando <b style={{ color:'#94a3b8' }}>{filtered.length===0?0:safePage*10+1}–{Math.min((safePage+1)*10,filtered.length)}</b> de <b style={{ color:'#94a3b8' }}>{filtered.length}</b> establecimientos</span>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:'0.4rem' }}>
          <button disabled={safePage===0} onClick={() => setPage(p=>p-1)} style={pgBtnS(safePage===0)}>← Anterior</button>
          <span style={{ color:'#64748b', fontSize:'0.78rem', minWidth:56, textAlign:'center' }}>{safePage+1} / {totalPages}</span>
          <button disabled={safePage>=totalPages-1} onClick={() => setPage(p=>p+1)} style={pgBtnS(safePage>=totalPages-1)}>Siguiente →</button>
        </div>
      </div>
      <div className="chart-card" style={{ marginBottom: '1.25rem' }}>
        <h3 className="chart-title">Ratio Remuneraciones / Ingresos por Establecimiento (%) — {periodo}</h3>
        <p style={{ color: '#64748b', fontSize: '0.78rem', marginBottom: '0.5rem' }}>
          <span style={{ color: '#10b981' }}>■</span> Saludable &lt;50% &nbsp;<span style={{ color: '#f59e0b' }}>■</span> Moderado 50–70% &nbsp;<span style={{ color: '#ef4444' }}>■</span> Crítico &gt;70%
        </p>
        {visible.length===0 ? <p style={{ color:'#64748b', padding:'2rem', textAlign:'center' }}>Sin resultados para «{search}»</p> : <ReactECharts option={ratioOption} style={{ height: h }} theme="dark" />}
      </div>
      <div className="chart-card">
        <h3 className="chart-title">Funcionarios vs Ingresos por Establecimiento — {periodo}</h3>
        <ReactECharts option={scatterOption} style={{ height: 320 }} theme="dark" />
      </div>
    </>
  )
}

// ── Tab: Riesgo ────────────────────────────────────────────────────────────────
function TabRiesgo({ rdbData, periodo }) {
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
      trigger: 'axis', axisPointer: { type: 'shadow' }, ...tt(),
      formatter: params => {
        const d = chartVisible[params[0].dataIndex]
        return `<b>${d.nom_rbd ?? `RBD ${d.rbd}`}</b> (${d.rbd})<br/>
          ✅ Rendido: ${Number(d.pct_rendido).toFixed(1)}% (${fmtAmt(d.monto_rendido)})<br/>
          ❌ No rendido: ${Number(d.pct_no_rendido).toFixed(1)}% (${fmtAmt(d.monto_no_rendido)})<br/>
          Total: ${fmtAmt(d.monto_total)} — <b>${d.nivel_riesgo}</b>`
      }
    },
    legend: { data: ['% Rendido', '% No Rendido'], textStyle: { color: '#94a3b8' }, top: 0 },
    grid: { left: 260, right: 80, top: 40, bottom: 20 },
    xAxis: { type: 'value', max: 100, axisLabel: { color: '#94a3b8', formatter: v => `${v}%` }, splitLine: { lineStyle: { color: '#1e293b' } } },
    yAxis: { type: 'category', data: names, axisLabel: { color: '#e2e8f0', fontSize: 10, width: 250, overflow: 'truncate' } },
    series: [
      {
        name: '% Rendido', type: 'bar', stack: 'pct', barMaxWidth: 16,
        data: chartVisible.map(d => ({ value: Number(d.pct_rendido), itemStyle: { color: RIESGO_COLORS[d.nivel_riesgo] ?? '#10b981' } }))
      },
      {
        name: '% No Rendido', type: 'bar', stack: 'pct', barMaxWidth: 16,
        data: chartVisible.map(d => Number(d.pct_no_rendido)), itemStyle: { color: '#1e293b' }
      },
    ],
    backgroundColor: 'transparent',
  }

  const topProb = [...acreditacion_rbd].filter(d => Number(d.monto_no_rendido) > 0)
    .sort((a, b) => Number(b.monto_no_rendido) - Number(a.monto_no_rendido)).slice(0, 20)

  const montoOpt = topProb.length > 0 ? {
    tooltip: { trigger: 'axis', ...tt(), formatter: params => { const d = topProb[params[0].dataIndex]; return `<b>${d.nom_rbd ?? `RBD ${d.rbd}`}</b><br/>No rendido: <b style="color:#ef4444">${fmtAmt(d.monto_no_rendido)}</b>` } },
    grid: { left: 260, right: 100, top: 20, bottom: 20 },
    xAxis: { type: 'value', axisLabel: { color: '#94a3b8', formatter: v => fmtAxisAmt(v) }, splitLine: { lineStyle: { color: '#1e293b' } } },
    yAxis: { type: 'category', data: topProb.map(d => shortName(d.nom_rbd, d.rbd)), axisLabel: { color: '#e2e8f0', fontSize: 10, width: 250, overflow: 'truncate' } },
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

  const inputStyle = { padding: '0.4rem 0.8rem', backgroundColor: '#0f172a', color: '#f1f5f9', border: '1px solid #334155', borderRadius: '0.375rem', fontSize: '0.8rem' };

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
          <span style={{ fontSize:'0.78rem', color:'#64748b' }}>Ordenado por % rendido ascendente. <span style={{ color:'#10b981' }}>■</span> Rendido &nbsp;<span style={{ color:'#1e293b', border:'1px solid #334155', display:'inline-block', width:10, height:10, verticalAlign:'middle' }}></span> No rendido</span>
          <span style={{ fontSize:'0.78rem', color:'#64748b' }}>Mostrando <b style={{ color:'#94a3b8' }}>{chartFiltered.length===0?0:chartSafePage*10+1}–{Math.min((chartSafePage+1)*10,chartFiltered.length)}</b> de <b style={{ color:'#94a3b8' }}>{chartFiltered.length}</b></span>
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:'0.4rem' }}>
            <button disabled={chartSafePage===0} onClick={() => setChartPage(p=>p-1)} style={{ padding:'0.3rem 0.6rem', border:'1px solid #334155', borderRadius:'0.375rem', background: chartSafePage===0?'#0f172a':'#1e293b', color: chartSafePage===0?'#475569':'#e2e8f0', cursor: chartSafePage===0?'not-allowed':'pointer', fontSize:'0.78rem' }}>← Anterior</button>
            <span style={{ color:'#64748b', fontSize:'0.78rem', minWidth:56, textAlign:'center' }}>{chartSafePage+1} / {chartTotalPages}</span>
            <button disabled={chartSafePage>=chartTotalPages-1} onClick={() => setChartPage(p=>p+1)} style={{ padding:'0.3rem 0.6rem', border:'1px solid #334155', borderRadius:'0.375rem', background: chartSafePage>=chartTotalPages-1?'#0f172a':'#1e293b', color: chartSafePage>=chartTotalPages-1?'#475569':'#e2e8f0', cursor: chartSafePage>=chartTotalPages-1?'not-allowed':'pointer', fontSize:'0.78rem' }}>Siguiente →</button>
          </div>
        </div>
        {chartVisible.length===0 ? <p style={{ color:'#64748b', padding:'2rem', textAlign:'center' }}>Sin resultados para «{searchTerm}»</p> : <ReactECharts option={acredOption} style={{ height: h }} theme="dark" />}
      </div>
      {montoOpt && (
        <div className="chart-card" style={{ marginBottom: '1.25rem' }}>
          <h3 className="chart-title">Top 20 — Monto No Rendido por Establecimiento ({unitLabel}) — {periodo}</h3>
          <ReactECharts option={montoOpt} style={{ height: 520 }} theme="dark" />
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
                    <td style={{ fontFamily: 'monospace', color: '#94a3b8', fontSize: '0.78rem' }}>{d.rbd}</td>
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
          <span style={{ color: '#64748b', fontSize: '0.8rem' }}>
            Mostrando {tableData.length === 0 ? 0 : ((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, tableData.length)} de {tableData.length}
          </span>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
              style={{ padding: '0.3rem 0.6rem', border: '1px solid #334155', background: currentPage === 1 ? '#0f172a' : '#1e293b', color: currentPage === 1 ? '#475569' : '#e2e8f0', borderRadius: '0.375rem', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
            >
              Anterior
            </button>
            <span style={{ padding: '0.3rem 0.6rem', color: '#94a3b8', fontSize: '0.85rem' }}>
              Página {currentPage} de {totalPages || 1}
            </span>
            <button
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage(prev => prev + 1)}
              style={{ padding: '0.3rem 0.6rem', border: '1px solid #334155', background: (currentPage === totalPages || totalPages === 0) ? '#0f172a' : '#1e293b', color: (currentPage === totalPages || totalPages === 0) ? '#475569' : '#e2e8f0', borderRadius: '0.375rem', cursor: (currentPage === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer' }}
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

