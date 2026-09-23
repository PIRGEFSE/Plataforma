import { useEffect, useState, useCallback, useRef, useContext, createContext } from 'react'
import ReactECharts from 'echarts-for-react'
import api from '../../lib/api'
import { useAuth } from '../../hooks/useAuth'
import { useChartColors } from '../../hooks/useChartColors'
import { ESTADO_LABELS, ESTADO_COLORS, COLORS_CHART } from '../../lib/edu-constants'
import {
  MoneyFmtCtx, useMoneyFmt, KPICard, PeriodoSelector, UnitSelector,
  BreadcrumbHeader, StickyDashboardHeader, getEnsenanzas, buildMoneyFormatters, fmtN
} from '../../components/DashboardWidgets'

// ── Catálogo de Widgets fijables al Resumen ────────────────────────────────────
export const ESTABLECIMIENTO_WIDGETS = [
  { key: 'fin_ingreso_gasto',     label: 'Ingreso vs Gasto (Histórico)',        section: 'financiero', icon: '💵', color: '#1e40af', grupo: 'Financiero' },
  { key: 'ef_distribucion_gasto', label: 'Distribución del Gasto (%)',          section: 'eficiencia', icon: '📊', color: '#059669', grupo: 'Eficiencia del Gasto' },
  { key: 'ri_acreditacion',       label: 'Acreditación de Saldos',             section: 'riesgo',     icon: '🛡️', color: '#dc2626', grupo: 'Riesgo' },
  { key: 'sv_composicion',        label: 'Composición de Subvenciones',        section: 'subvencion', icon: '🏷️', color: '#8b5cf6', grupo: 'Subvenciones' },
  { key: 'sned_kpis',             label: 'SNED — KPIs del Grupo',              section: 'sned_grupo', icon: '🏆', color: '#1e40af', grupo: 'SNED' },
  { key: 'sned_tabla',            label: 'SNED — Establecimientos del Grupo',  section: 'sned_grupo', icon: '📋', color: '#3b82f6', grupo: 'SNED' },
]

const EE_WIDGET_MAP = Object.fromEntries(ESTABLECIMIENTO_WIDGETS.map(w => [w.key, w]))

// ── Hook: usePinnedWidgetsEE ───────────────────────────────────────────────────
const LS_KEY_EE = 'pirgefse-ee-resumen-pins-cache'

export function usePinnedWidgetsEE() {
  const [pins, setPins] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY_EE) || '[]') } catch { return [] }
  })
  const saving = useRef(false)

  useEffect(() => {
    api.get('/dashboard/resumen-pins')
      .then(r => {
        const serverPins = r.data.pins || []
        setPins(serverPins)
        localStorage.setItem(LS_KEY_EE, JSON.stringify(serverPins))
      })
      .catch(() => {})
  }, [])

  const togglePin = useCallback((key) => {
    setPins(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
      localStorage.setItem(LS_KEY_EE, JSON.stringify(next))
      if (!saving.current) {
        saving.current = true
        api.put('/dashboard/resumen-pins', { pins: next }).finally(() => { saving.current = false })
      }
      return next
    })
  }, [])

  const isPinned = useCallback((key) => pins.includes(key), [pins])
  return { pins, isPinned, togglePin }
}

// ── Contexto de Pins ───────────────────────────────────────────────────────────
export const PinsCtxEE = createContext({ pins: [], isPinned: () => false, togglePin: () => {} })
export const usePinsEE = () => useContext(PinsCtxEE)

// ── WidgetWrapperEE ────────────────────────────────────────────────────────────
export function WidgetWrapperEE({ widgetKey, children, compact = false }) {
  const { isPinned, togglePin } = usePinsEE()
  const pinned = isPinned(widgetKey)
  const widget = EE_WIDGET_MAP[widgetKey]
  return (
    <div style={{ position: 'relative', marginBottom: compact ? '0' : '1.25rem' }}>
      <button
        onClick={() => togglePin(widgetKey)}
        title={pinned ? 'Quitar del Resumen' : 'Agregar al Resumen'}
        style={{
          position: 'absolute', top: '0.6rem', right: '0.75rem', zIndex: 10,
          display: 'flex', alignItems: 'center', gap: '0.3rem',
          padding: '0.25rem 0.65rem', borderRadius: '999px',
          border: pinned ? `1.5px solid ${widget?.color ?? '#6366f1'}` : '1.5px solid var(--line-subtle)',
          background: pinned ? `${widget?.color ?? '#6366f1'}18` : 'var(--surface-overlay)',
          color: pinned ? (widget?.color ?? '#6366f1') : 'var(--text-muted)',
          fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
          transition: 'all 0.18s', whiteSpace: 'nowrap',
        }}
      >
        <span style={{ fontSize: '0.85rem' }}>📌</span>
        {pinned ? 'En Resumen' : 'Agregar al Resumen'}
      </button>
      {children}
    </div>
  )
}

const SECTION_TITLES = {
  perfil:     { icon: '🏫', label: 'Mi Establecimiento' },
  financiero: { icon: '💵', label: 'Financiero — Serie Temporal' },
  eficiencia: { icon: '⚙️', label: 'Eficiencia del Gasto' },
  riesgo:     { icon: '📊', label: 'Riesgo — Acreditación de Saldos' },
  subvencion: { icon: '🏷️', label: 'Subvenciones' },
  sned_grupo: { icon: '🏆', label: 'Grupo Homogéneo SNED' },
  resumen:    { icon: '🗂️', label: 'Resumen Personalizado' },
}

export default function FichaEstablecimiento({ section = 'perfil' }) {
  const { user } = useAuth()
  const rbdId = user?.rbd_id || 2979
  const pinsCtx = usePinnedWidgetsEE()

  const [perfil, setPerfil]           = useState(null)
  const [detalleData, setDetalleData] = useState(null)
  const [subvData, setSubvData]       = useState([])
  const [snedData, setSnedData]       = useState(null)
  const [periodos, setPeriodos]       = useState([2020, 2021, 2022, 2023, 2024])
  const [periodo, setPeriodo]         = useState(2024)
  const [unitMode, setUnitMode]       = useState('mM')
  const [loading, setLoading]         = useState(true)

  const { fmtAmt, fmtAxisAmt, unitLabel } = buildMoneyFormatters(unitMode)

  useEffect(() => {
    setLoading(true)
    api.get(`/dashboard/ficha-rbd?rbd=${rbdId}&periodo=${periodo}`).then(r => {
      setPerfil(r.data.perfil)
      if (r.data.periodos_disponibles?.length) {
        setPeriodos(prev => [...new Set([...r.data.periodos_disponibles, ...prev])].sort((a, b) => b - a))
      }
    }).finally(() => setLoading(false))
  }, [rbdId, periodo])

  const fetchDetalle = useCallback(() => {
    api.get(`/dashboard/ficha-rbd/detalle?rbd=${rbdId}`).then(r => setDetalleData(r.data))
  }, [rbdId])

  useEffect(() => { fetchDetalle() }, [fetchDetalle])

  useEffect(() => {
    if (section === 'subvencion') {
      const p = periodo ? `&periodo=${periodo}` : ''
      api.get(`/dashboard/subvencion-rbd?rbd=${rbdId}${p}`).then(r => setSubvData(r.data))
    }
  }, [rbdId, periodo, section])

  useEffect(() => {
    if (section === 'sned_grupo' || section === 'financiero') {
      api.get(`/dashboard/ficha-rbd/sned-grupo?rbd=${rbdId}&periodo=${periodo}`)
        .then(r => setSnedData(r.data))
    }
  }, [rbdId, periodo, section])

  const sec = SECTION_TITLES[section] ?? SECTION_TITLES.perfil

  if (loading || !perfil) return (
    <div className="tab-page">
      <StickyDashboardHeader title={`${sec.icon} Cargando...`} />
      <div className="loading-area"><div className="spinner" /></div>
    </div>
  )

  return (
    <PinsCtxEE.Provider value={pinsCtx}>
      <MoneyFmtCtx.Provider value={{ fmtAmt, fmtAxisAmt, unitLabel }}>
        <div className="tab-page">
          <StickyDashboardHeader
            title={`${sec.icon} ${perfil?.nom_rbd ?? `RBD ${rbdId}`}`}
            subtitle={`${sec.label} · RBD ${rbdId}${perfil.nombre_sostenedor ? ` · ${perfil.nombre_sostenedor}` : ''}`}
          >
            {section !== 'sned_grupo' && section !== 'subvencion' && section !== 'resumen' && (
              <PeriodoSelector periodos={periodos} value={periodo} onChange={setPeriodo} />
            )}
            {section !== 'perfil' && section !== 'sned_grupo' && section !== 'subvencion' && section !== 'resumen' && (
              <UnitSelector value={unitMode} onChange={setUnitMode} />
            )}
            <span style={{ padding: '0.3rem 0.8rem', borderRadius: 999, background: 'var(--accent-dim)', color: 'var(--accent-text)', border: '1px solid var(--line-strong)', fontSize: '0.78rem', fontWeight: 600 }}>
              🏫 RBD {rbdId}
            </span>
            {perfil?.rural_rbd && <span style={{ padding: '0.3rem 0.8rem', borderRadius: 999, background: 'var(--warning-dim)', color: 'var(--warning-text)', border: '1px solid var(--line-default)', fontSize: '0.78rem', fontWeight: 600 }}>🌿 Rural</span>}
            {perfil?.convenio_pie && <span style={{ padding: '0.3rem 0.8rem', borderRadius: 999, background: 'var(--accent-dim)', color: 'var(--accent-text)', border: '1px solid var(--line-default)', fontSize: '0.78rem', fontWeight: 600 }}>🔵 PIE</span>}
            {perfil?.pace && <span style={{ padding: '0.3rem 0.8rem', borderRadius: 999, background: 'rgba(139,92,246,0.10)', color: '#a78bfa', border: '1px solid var(--line-default)', fontSize: '0.78rem', fontWeight: 600 }}>🎓 PACE</span>}
          </StickyDashboardHeader>

          {section === 'perfil'     && <TabPerfil perfil={perfil} detalleData={detalleData} periodo={periodo} />}
          {section === 'financiero' && <TabFinanciero detalleData={detalleData} snedData={snedData} periodo={periodo} />}
          {section === 'eficiencia' && <TabEficiencia detalleData={detalleData} />}
          {section === 'riesgo'     && <TabRiesgo detalleData={detalleData} />}
          {section === 'subvencion' && <TabSubvencion data={subvData} periodo={periodo} />}
          {section === 'sned_grupo' && <TabGrupoSNED snedData={snedData} periodo={periodo} />}
          {section === 'resumen'    && <TabResumenEstablecimiento detalleData={detalleData} periodo={periodo} />}
        </div>
      </MoneyFmtCtx.Provider>
    </PinsCtxEE.Provider>
  )
}

// ── Tab: Perfil ────────────────────────────────────────────────────────────────
function TabPerfil({ perfil, detalleData, periodo }) {
  const { fmtAmt } = useContext(MoneyFmtCtx)
  if (!perfil) return <div className="loading-area"><div className="spinner" /></div>
  const finUlt = detalleData?.financiero_serie?.slice(-1)[0]
  const estado = ESTADO_LABELS[perfil.estado_estab] ?? '—'
  const estadoColor = ESTADO_COLORS[perfil.estado_estab] ?? '#64748b'

  return (
    <>
      <BreadcrumbHeader mainLabel="Mi Establecimiento" mainIcon="🏫" subLabel={`Perfil ${periodo}`} subIcon="📄" />
      <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
        <KPICard icon="👨‍🎓" label="Matrícula Total" value={fmtN(perfil.mat_total)} color="#1d4ed8" />
        <KPICard icon="📈" label="Último Ingreso" value={finUlt ? fmtAmt(finUlt.ingreso) : '—'} color="#1e40af" sub={finUlt ? `Año ${finUlt.periodo}` : ''} />
        <KPICard icon="📉" label="Último Gasto" value={finUlt ? fmtAmt(finUlt.gasto) : '—'} color="#3b82f6" sub={finUlt ? `Año ${finUlt.periodo}` : ''} />
        <KPICard icon="⚖️" label="Superávit" value={finUlt ? fmtAmt(finUlt.superavit) : '—'} color={finUlt && finUlt.superavit >= 0 ? '#059669' : '#dc2626'} />
      </div>
      <div className="chart-card" style={{ marginBottom: '1.5rem' }}>
        <h3 className="chart-title">Datos del Establecimiento</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '1rem', marginTop: '0.75rem' }}>
          {[
            { label: 'RBD', val: perfil.rbd, icon: '🔢' },
            { label: 'Nombre', val: perfil.nom_rbd, icon: '🏫' },
            { label: 'Estado', val: <span style={{ color: estadoColor, fontWeight: 600 }}>{estado}</span>, icon: '📌' },
            { label: 'Matrícula Activa', val: perfil.matricula ? 'Sí' : 'No', icon: '✅' },
            { label: 'Sostenedor', val: perfil.nombre_sostenedor, icon: '🏢' },
            { label: 'RUT Sostenedor', val: perfil.rut_sostenedor, icon: '🔑' },
            { label: 'Rural', val: perfil.rural_rbd ? 'Sí' : 'No', icon: '🌿' },
            { label: 'Convenio PIE', val: perfil.convenio_pie ? 'Sí' : 'No', icon: '🔵' },
            { label: 'PACE', val: perfil.pace ? 'Sí' : 'No', icon: '🎓' },
          ].map(({ label, val, icon }) => (
            <div key={label} style={{ background: 'var(--surface-overlay)', borderRadius: '0.5rem', padding: '0.75rem', border: '1px solid var(--line-subtle)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{icon} {label}</div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.9rem' }}>{val || '—'}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: '1rem' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>🎓 Tipos de Enseñanza</div>
          {getEnsenanzas(perfil)}
        </div>
      </div>
      {detalleData?.financiero_serie?.length > 0 && (
        <div className="chart-card">
          <h3 className="chart-title">Resumen Financiero Histórico</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: 'var(--surface-overlay)' }}>
                  {['Año', 'Ingresos', 'Gastos', 'Superávit'].map(h => (
                    <th key={h} style={{ padding: '0.6rem 1rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right', borderBottom: '1px solid var(--line-default)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...detalleData.financiero_serie].reverse().map((r, i) => (
                  <tr key={r.periodo} style={{ borderBottom: '1px solid var(--line-subtle)', background: i % 2 === 0 ? 'transparent' : 'var(--surface-overlay)' }}>
                    <td style={{ padding: '0.5rem 1rem', color: 'var(--text-secondary)', textAlign: 'right' }}>{r.periodo}</td>
                    <td style={{ padding: '0.5rem 1rem', color: 'var(--success)', textAlign: 'right' }}>{fmtAmt(r.ingreso)}</td>
                    <td style={{ padding: '0.5rem 1rem', color: 'var(--danger)', textAlign: 'right' }}>{fmtAmt(r.gasto)}</td>
                    <td style={{ padding: '0.5rem 1rem', textAlign: 'right' }}>
                      <strong style={{ color: Number(r.superavit) >= 0 ? 'var(--success)' : 'var(--danger)' }}>{fmtAmt(r.superavit)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}

// ── Tab: Financiero (con sub-tabs: Ingreso vs Gasto | SNED) ────────────────────
function TabFinanciero({ detalleData, snedData, periodo }) {
  const [subTab, setSubTab] = useState(() => localStorage.getItem('pirgefse-ee-financiero') || 'ingreso_gasto')
  useEffect(() => { localStorage.setItem('pirgefse-ee-financiero', subTab) }, [subTab])
  useEffect(() => {
    const handler = (e) => { if (e.detail.key === 'pirgefse-ee-financiero') setSubTab(e.detail.val) }
    window.addEventListener('pirgefse-subtab', handler)
    return () => window.removeEventListener('pirgefse-subtab', handler)
  }, [])
  const SUB_TABS = [
    { key: 'ingreso_gasto', label: 'Ingreso vs Gasto', icon: '💵' },
    { key: 'sned', label: 'SNED', icon: '🏆' },
  ]
  const currentTab = SUB_TABS.find(t => t.key === subTab) || SUB_TABS[0]
  return (
    <div>
      <BreadcrumbHeader mainLabel="Educativo - Financiero" mainIcon="📊" subLabel={currentTab.label} subIcon={currentTab.icon} />
      {subTab === 'ingreso_gasto' && (
        <WidgetWrapperEE widgetKey="fin_ingreso_gasto">
          <FinancieroChart detalleData={detalleData} />
        </WidgetWrapperEE>
      )}
      {subTab === 'sned' && (
        <TabGrupoSNED snedData={snedData} periodo={periodo} />
      )}
    </div>
  )
}

function FinancieroChart({ detalleData }) {
  const C = useChartColors()
  const { fmtAmt, fmtAxisAmt, unitLabel } = useContext(MoneyFmtCtx)
  const serie = detalleData?.financiero_serie ?? []
  if (!serie.length) return <div className="alert-info">No hay datos financieros.</div>
  const option = {
    aria: { decal: { show: true } },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, ...C.tooltip, formatter: params => {
      let html = `<b>Año ${params[0].name}</b><br/>`
      let sup = 0
      params.forEach(p => { html += `${p.marker} ${p.seriesName}: <b>${fmtAmt(p.value)}</b><br/>`; if (p.seriesName === 'Ingreso') sup += p.value; if (p.seriesName === 'Gasto') sup -= p.value })
      html += `<hr style="margin:4px 0;border-color:var(--line-subtle)"/>Superávit: <b style="color:${sup >= 0 ? '#10b981' : '#ef4444'}">${fmtAmt(sup)}</b>`
      return html
    }},
    legend: { data: ['Ingreso', 'Gasto'], textStyle: { color: C.axisLabel } },
    color: ['#1e40af', '#3b82f6'],
    grid: { left: 80, right: 20, bottom: 40, top: 40 },
    xAxis: { type: 'category', data: serie.map(d => d.periodo), axisLine: { lineStyle: { color: C.splitLine } }, axisLabel: { color: C.axisLabel } },
    yAxis: { type: 'value', axisLabel: { color: C.axisLabel, formatter: v => fmtAxisAmt(v) }, splitLine: { lineStyle: { color: C.splitLine } } },
    series: [
      { name: 'Ingreso', type: 'bar', data: serie.map(d => Number(d.ingreso)), barMaxWidth: 40, itemStyle: { borderRadius: [4, 4, 0, 0] } },
      { name: 'Gasto', type: 'bar', data: serie.map(d => Number(d.gasto)), barMaxWidth: 40, itemStyle: { borderRadius: [4, 4, 0, 0] } },
    ],
    backgroundColor: 'transparent',
  }
  return (
    <div className="chart-card">
      <h3 className="chart-title">Evolución Ingreso vs Gasto ({unitLabel})</h3>
      <ReactECharts option={option} style={{ height: 400 }} />
    </div>
  )
}

// ── Tab: Eficiencia (con sub-tabs) ─────────────────────────────────────────────
function TabEficiencia({ detalleData }) {
  const [subTab, setSubTab] = useState(() => localStorage.getItem('pirgefse-ee-eficiencia') || 'distribucion')
  useEffect(() => { localStorage.setItem('pirgefse-ee-eficiencia', subTab) }, [subTab])
  useEffect(() => {
    const handler = (e) => { if (e.detail.key === 'pirgefse-ee-eficiencia') setSubTab(e.detail.val) }
    window.addEventListener('pirgefse-subtab', handler)
    return () => window.removeEventListener('pirgefse-subtab', handler)
  }, [])
  const SUB_TABS = [{ key: 'distribucion', label: 'Distribución del Gasto', icon: '📊' }]
  const currentTab = SUB_TABS.find(t => t.key === subTab) || SUB_TABS[0]
  return (
    <div>
      <BreadcrumbHeader mainLabel="Eficiencia del Gasto" mainIcon="⚙️" subLabel={currentTab.label} subIcon={currentTab.icon} />
      {subTab === 'distribucion' && (
        <WidgetWrapperEE widgetKey="ef_distribucion_gasto">
          <EficienciaChart detalleData={detalleData} />
        </WidgetWrapperEE>
      )}
    </div>
  )
}

function EficienciaChart({ detalleData }) {
  const C = useChartColors()
  const { unitLabel } = useContext(MoneyFmtCtx)
  const serie = detalleData?.eficiencia_serie ?? []
  if (!serie.length) return <div className="alert-info">No hay datos de eficiencia.</div>
  const option = {
    aria: { decal: { show: true } },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, ...C.tooltip, formatter: params => {
      let html = `<b>Año ${params[0].name}</b><br/>`
      params.forEach(p => { html += `${p.marker} ${p.seriesName}: <b>${p.value}%</b><br/>` })
      return html
    }},
    legend: { data: ['% Aula', '% Admin', '% Otros'], textStyle: { color: C.axisLabel }, bottom: 0 },
    color: ['#059669', '#d97706', '#64748b'],
    grid: { left: 40, right: 20, bottom: 60, top: 40 },
    xAxis: { type: 'category', data: serie.map(d => d.periodo), axisLine: { lineStyle: { color: C.splitLine } }, axisLabel: { color: C.axisLabel } },
    yAxis: { type: 'value', max: 100, axisLabel: { color: C.axisLabel, formatter: '{value}%' }, splitLine: { lineStyle: { color: C.splitLine } } },
    series: [
      { name: '% Aula', type: 'bar', stack: 'total', data: serie.map(d => Number(d.pct_aula)), barMaxWidth: 60 },
      { name: '% Admin', type: 'bar', stack: 'total', data: serie.map(d => Number(d.pct_admin)), barMaxWidth: 60 },
      { name: '% Otros', type: 'bar', stack: 'total', data: serie.map(d => Number(d.pct_otros)), barMaxWidth: 60, itemStyle: { borderRadius: [4, 4, 0, 0] } },
    ],
    backgroundColor: 'transparent',
  }
  return (
    <div className="chart-card">
      <h3 className="chart-title">Distribución del Gasto (%)</h3>
      <ReactECharts option={option} style={{ height: 400 }} />
    </div>
  )
}

// ── Tab: Riesgo (con sub-tabs) ─────────────────────────────────────────────────
function TabRiesgo({ detalleData }) {
  const [subTab, setSubTab] = useState(() => localStorage.getItem('pirgefse-ee-riesgo') || 'acreditacion')
  useEffect(() => { localStorage.setItem('pirgefse-ee-riesgo', subTab) }, [subTab])
  useEffect(() => {
    const handler = (e) => { if (e.detail.key === 'pirgefse-ee-riesgo') setSubTab(e.detail.val) }
    window.addEventListener('pirgefse-subtab', handler)
    return () => window.removeEventListener('pirgefse-subtab', handler)
  }, [])
  const SUB_TABS = [{ key: 'acreditacion', label: 'Acreditación de Saldos', icon: '🛡️' }]
  const currentTab = SUB_TABS.find(t => t.key === subTab) || SUB_TABS[0]
  return (
    <div>
      <BreadcrumbHeader mainLabel="Riesgo de Reintegro" mainIcon="📊" subLabel={currentTab.label} subIcon={currentTab.icon} />
      {subTab === 'acreditacion' && (
        <WidgetWrapperEE widgetKey="ri_acreditacion">
          <RiesgoChart detalleData={detalleData} />
        </WidgetWrapperEE>
      )}
    </div>
  )
}

function RiesgoChart({ detalleData }) {
  const C = useChartColors()
  const serie = detalleData?.acreditacion_serie ?? []
  if (!serie.length) return <div className="alert-info">No hay datos de acreditación.</div>
  const option = {
    aria: { decal: { show: true } },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, ...C.tooltip, formatter: params => {
      let html = `<b>Año ${params[0].name}</b><br/>`
      const rendido = params.find(p => p.seriesName === '% Rendido')
      const noRendido = params.find(p => p.seriesName === '% No Rendido')
      if (rendido) html += `${rendido.marker} ${rendido.seriesName}: <b>${rendido.value}%</b><br/>`
      if (noRendido) html += `${noRendido.marker} ${noRendido.seriesName}: <b>${noRendido.value}%</b><br/>`
      return html
    }},
    legend: { data: ['% Rendido', '% No Rendido'], textStyle: { color: C.axisLabel }, bottom: 0 },
    color: ['#059669', '#dc2626'],
    grid: { left: 40, right: 20, bottom: 60, top: 40 },
    xAxis: { type: 'category', data: serie.map(d => d.periodo), axisLine: { lineStyle: { color: C.splitLine } }, axisLabel: { color: C.axisLabel } },
    yAxis: { type: 'value', max: 100, axisLabel: { color: C.axisLabel, formatter: '{value}%' }, splitLine: { lineStyle: { color: C.splitLine } } },
    series: [
      { name: '% Rendido', type: 'bar', stack: 'total', data: serie.map(d => Number(d.pct_rendido)), barMaxWidth: 60 },
      { name: '% No Rendido', type: 'bar', stack: 'total', data: serie.map(d => Number(d.pct_no_rendido)), barMaxWidth: 60, itemStyle: { borderRadius: [4, 4, 0, 0] } },
    ],
    backgroundColor: 'transparent',
  }
  return (
    <div className="chart-card">
      <h3 className="chart-title">Acreditación de Saldos (Serie Temporal)</h3>
      <ReactECharts option={option} style={{ height: 400 }} />
    </div>
  )
}

// ── Tab: Subvencion (con sub-tabs) ─────────────────────────────────────────────
function TabSubvencion({ data, periodo }) {
  const C = useChartColors()
  const { fmtAmt, unitLabel } = useContext(MoneyFmtCtx)
  const [subTab, setSubTab] = useState(() => localStorage.getItem('pirgefse-ee-subvencion') || 'composicion')
  useEffect(() => { localStorage.setItem('pirgefse-ee-subvencion', subTab) }, [subTab])
  useEffect(() => {
    const handler = (e) => { if (e.detail.key === 'pirgefse-ee-subvencion') setSubTab(e.detail.val) }
    window.addEventListener('pirgefse-subtab', handler)
    return () => window.removeEventListener('pirgefse-subtab', handler)
  }, [])
  const SUB_TABS = [{ key: 'composicion', label: 'Composición', icon: '🥧' }]
  const currentTab = SUB_TABS.find(t => t.key === subTab) || SUB_TABS[0]

  if (!data || data.length === 0) return (
    <div>
      <BreadcrumbHeader mainLabel="Subvenciones" mainIcon="🏷️" subLabel={currentTab.label} subIcon={currentTab.icon} />
      <div className="alert-info">No hay datos de subvenciones para {periodo || 'este período'}.</div>
    </div>
  )

  const total = data.reduce((s, d) => s + Number(d.monto_total), 0)
  const option = {
    aria: { decal: { show: true } },
    tooltip: { trigger: 'item', ...C.tooltip, formatter: p => `<b>${p.name}</b><br/>Monto: <b>${fmtAmt(p.value)}</b> (${p.percent}%)` },
    legend: { orient: 'vertical', left: 'left', textStyle: { color: C.axisLabel } },
    color: COLORS_CHART,
    series: [{
      name: 'Subvenciones', type: 'pie', radius: ['40%', '70%'], center: ['65%', '50%'],
      itemStyle: { borderRadius: 10, borderColor: C.bg, borderWidth: 2 },
      label: { show: false, position: 'center' },
      emphasis: { label: { show: true, fontSize: '14', fontWeight: 'bold', color: C.axisLabel } },
      labelLine: { show: false },
      data: data.map(d => ({ value: Number(d.monto_total), name: d.subvencion_alias })),
    }],
    backgroundColor: 'transparent',
  }
  return (
    <div>
      <BreadcrumbHeader mainLabel="Subvenciones" mainIcon="🏷️" subLabel={currentTab.label} subIcon={currentTab.icon} />
      {subTab === 'composicion' && (
        <WidgetWrapperEE widgetKey="sv_composicion">
          <div>
            <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
              <KPICard icon="💰" label="Monto Total" value={fmtAmt(total)} color="#8b5cf6" sub={`En ${periodo || 'total histórico'}`} />
              <KPICard icon="📋" label="Líneas de Subvención" value={data.length} color="#ec4899" />
            </div>
            <div className="chart-card">
              <h3 className="chart-title">Composición por Subvención ({unitLabel})</h3>
              <ReactECharts option={option} style={{ height: 450 }} />
            </div>
          </div>
        </WidgetWrapperEE>
      )}
    </div>
  )
}

// ── Tab: Grupo SNED (con sub-tabs) ─────────────────────────────────────────────
function TabGrupoSNED({ snedData, periodo }) {
  const [subTab, setSubTab] = useState(() => localStorage.getItem('pirgefse-ee-sned') || 'kpis')
  useEffect(() => { localStorage.setItem('pirgefse-ee-sned', subTab) }, [subTab])
  useEffect(() => {
    const handler = (e) => { if (e.detail.key === 'pirgefse-ee-sned') setSubTab(e.detail.val) }
    window.addEventListener('pirgefse-subtab', handler)
    return () => window.removeEventListener('pirgefse-subtab', handler)
  }, [])
  const SUB_TABS = [
    { key: 'kpis', label: 'KPIs del Grupo', icon: '🏆' },
    { key: 'tabla', label: 'Establecimientos del Grupo', icon: '📋' },
  ]
  const currentTab = SUB_TABS.find(t => t.key === subTab) || SUB_TABS[0]

  if (!snedData) return <div className="loading-area"><div className="spinner" /></div>
  if (!snedData.grupo_homogeneo) return (
    <div>
      <BreadcrumbHeader mainLabel="SNED" mainIcon="🏆" subLabel={currentTab.label} subIcon={currentTab.icon} />
      <div className="chart-card">
        <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          No se encontró grupo homogéneo SNED para este establecimiento en el año {snedData.agno_sned} (periodo {periodo}).
        </p>
      </div>
    </div>
  )

  const { mi_establecimiento, establecimientos, grupo_homogeneo, agno_sned } = snedData
  const todos = establecimientos || []

  // Colores por estado SNED
  const getEstadoColor = (sel) => {
    const s = (sel || '').toLowerCase()
    if (s.includes('100%')) return '#10b981'
    if (s.includes('60%'))  return '#f59e0b'
    if (s.includes('no premiado') || s === '') return '#94a3b8'
    return '#6366f1'
  }

  const getEstadoBadge = (sel, esMe) => {
    const s = (sel || '').toLowerCase()
    const color = getEstadoColor(sel)
    const label = sel || 'No Premiado'
    return (
      <span style={{
        padding: '0.2rem 0.6rem', borderRadius: 999, fontSize: '0.72rem', fontWeight: 600,
        background: `${color}18`, color, border: `1px solid ${color}44`,
      }}>
        {label}
      </span>
    )
  }

  // KPIs
  const n_premiados = todos.filter(e => e.es_premiado).length
  const n_no_premiados = todos.filter(e => !e.es_premiado).length
  const sel_color = getEstadoColor(mi_establecimiento?.seleccionado_sned)

  const kpisContent = (
    <div>
      <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
        <KPICard icon="👥" label="Grupo Homogéneo" value={grupo_homogeneo.split('-').pop()?.trim() || 'Grupo'} color="#1e40af"
          sub={grupo_homogeneo.length > 30 ? grupo_homogeneo.slice(0, 30) + '...' : ''} />
        <KPICard icon="🏫" label="Total EE en el Grupo" value={mi_establecimiento?.n_establecimientos_gh ?? todos.length} color="#3b82f6" />
        <KPICard icon="🏆" label="EE Premiados" value={n_premiados} color="#10b981" sub={`${n_no_premiados} No Premiados`} />
        <KPICard icon="🥇" label="Mi Estado SNED" value={mi_establecimiento?.seleccionado_sned || 'No Premiado'}
          color={sel_color} sub={`Posición ${mi_establecimiento?.posicion_gh ?? '—'}`} />
      </div>
    </div>
  )

  // Tabla completa con todos los EE del grupo
  const tablaContent = (
    <div className="chart-card">
      <h3 className="chart-title">Todos los Establecimientos del Grupo Homogéneo — SNED {agno_sned}</h3>
      <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: 'var(--surface-overlay)' }}>
              {['Pos.', 'RBD', 'Nombre Establecimiento', 'Estado SNED'].map(h => (
                <th key={h} style={{ padding: '0.65rem 1rem', textAlign: h === 'Pos.' ? 'center' : 'left', borderBottom: '1px solid var(--line-subtle)', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.78rem' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {todos.length === 0 ? (
              <tr><td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Sin datos para este grupo.</td></tr>
            ) : todos.map((e, idx) => {
              const isMe = e.es_mi_rbd
              const isPremiado = e.es_premiado
              // Separador antes del primer No Premiado
              const prevPremiado = idx > 0 ? todos[idx - 1].es_premiado : true
              const showSeparator = !isPremiado && prevPremiado && !isMe

              const rowBg = isMe
                ? 'rgba(99,102,241,0.08)'
                : !isPremiado
                  ? 'transparent'
                  : (idx % 2 === 0 ? 'transparent' : 'var(--surface-overlay)')

              return (
                <>
                  {showSeparator && (
                    <tr key={`sep-${idx}`}>
                      <td colSpan="4" style={{ padding: '0.4rem 1rem', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', background: 'var(--surface-overlay)', textTransform: 'uppercase', letterSpacing: '0.07em', borderTop: '2px solid var(--line-subtle)', borderBottom: '1px solid var(--line-subtle)' }}>
                        No Premiados ({n_no_premiados})
                      </td>
                    </tr>
                  )}
                  <tr key={e.rbd} style={{ borderBottom: '1px solid var(--line-subtle)', background: rowBg, opacity: isPremiado || isMe ? 1 : 0.6 }}>
                    <td style={{ padding: '0.65rem 1rem', textAlign: 'center', fontWeight: isMe ? 700 : 500, color: isMe ? '#6366f1' : 'var(--text-secondary)' }}>{e.posicion_gh ?? '—'}</td>
                    <td style={{ padding: '0.65rem 1rem', fontFamily: 'monospace', fontSize: '0.8rem', color: isMe ? '#6366f1' : 'var(--text-secondary)' }}>{e.rbd}</td>
                    <td style={{ padding: '0.65rem 1rem', fontWeight: isMe ? 700 : 400, color: isMe ? '#6366f1' : 'var(--text-primary)' }}>
                      {e.nom_rbd}
                      {isMe && <span style={{ marginLeft: '0.5rem', background: '#6366f1', color: 'white', padding: '0.15rem 0.5rem', borderRadius: 999, fontSize: '0.68rem' }}>Mi Establecimiento</span>}
                    </td>
                    <td style={{ padding: '0.65rem 1rem' }}>{getEstadoBadge(e.seleccionado_sned, isMe)}</td>
                  </tr>
                </>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )

  return (
    <div>
      <BreadcrumbHeader mainLabel="SNED" mainIcon="🏆" subLabel={currentTab.label} subIcon={currentTab.icon} />
      <div className="alert-info" style={{ marginBottom: '1.5rem', borderRadius: '8px' }}>
        ℹ️ Resultados SNED año <strong>{agno_sned}</strong>. Se muestran <strong>todos los establecimientos</strong> del grupo homogéneo.
        Se destacan primero tu establecimiento, luego los <strong>premiados</strong> y finalmente los <strong>no premiados</strong>.
      </div>
      {subTab === 'kpis'  && <WidgetWrapperEE widgetKey="sned_kpis">{kpisContent}</WidgetWrapperEE>}
      {subTab === 'tabla' && <WidgetWrapperEE widgetKey="sned_tabla">{tablaContent}</WidgetWrapperEE>}
    </div>
  )
}


// ── Tab: Resumen Personalizado ─────────────────────────────────────────────────
function TabResumenEstablecimiento({ detalleData, periodo }) {
  const { pins, togglePin } = usePinsEE()
  const grupos = [...new Set(ESTABLECIMIENTO_WIDGETS.map(w => w.grupo))]

  if (pins.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 420, gap: '1.5rem', padding: '3rem' }}>
        <div style={{ fontSize: '4rem' }}>📌</div>
        <h3 style={{ color: 'var(--text-primary)', fontSize: '1.3rem', fontWeight: 700, margin: 0 }}>Tu Resumen está vacío</h3>
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', maxWidth: 480, margin: 0, lineHeight: 1.6 }}>
          Navega a cualquier sección (Financiero, Eficiencia, Riesgo, etc.) y presiona el botón{' '}
          <strong style={{ color: '#6366f1' }}>📌 Agregar al Resumen</strong>{' '}en los gráficos que quieras ver aquí.
        </p>
        <div style={{ width: '100%', maxWidth: 720, marginTop: '1rem' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '0.75rem', textAlign: 'center' }}>
            O agrega indicadores directamente desde aquí:
          </p>
          {grupos.map(grupo => (
            <div key={grupo} style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>{grupo}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {ESTABLECIMIENTO_WIDGETS.filter(w => w.grupo === grupo).map(w => (
                  <button key={w.key} onClick={() => togglePin(w.key)}
                    style={{ padding: '0.3rem 0.75rem', borderRadius: '999px', border: `1.5px solid ${w.color}44`, background: `${w.color}10`, color: w.color, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', transition: 'all 0.15s' }}>
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

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '1.1rem' }}>📌</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.9rem' }}>
            {pins.length} indicador{pins.length !== 1 ? 'es' : ''} en tu Resumen
          </span>
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>· Año seleccionado: <strong>{periodo}</strong></span>
      </div>
      <details style={{ marginBottom: '1.5rem' }}>
        <summary style={{ cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600, padding: '0.5rem 0', userSelect: 'none' }}>
          ➕ Agregar / quitar indicadores
        </summary>
        <div style={{ marginTop: '0.75rem', padding: '1rem', background: 'var(--surface-overlay)', borderRadius: '0.5rem', border: '1px solid var(--line-subtle)' }}>
          {grupos.map(grupo => (
            <div key={grupo} style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.35rem' }}>{grupo}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {ESTABLECIMIENTO_WIDGETS.filter(w => w.grupo === grupo).map(w => {
                  const pinned = pins.includes(w.key)
                  return (
                    <button key={w.key} onClick={() => togglePin(w.key)}
                      style={{ padding: '0.25rem 0.65rem', borderRadius: '999px', border: pinned ? `1.5px solid ${w.color}` : `1.5px solid ${w.color}44`, background: pinned ? `${w.color}22` : `${w.color}08`, color: pinned ? w.color : `${w.color}99`, fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', transition: 'all 0.15s' }}>
                      {pinned ? '📌' : '○'} {w.icon} {w.label}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </details>
      {pins.map(key => {
        const widget = EE_WIDGET_MAP[key]
        if (!widget) return null
        const content = renderEEWidgetContent(key, { detalleData, periodo })
        if (!content) return null
        return (
          <div key={key} style={{ marginBottom: '1.5rem', border: `1px solid ${widget.color}44`, borderRadius: '0.75rem', overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1.25rem', background: `${widget.color}10`, borderBottom: `1px solid ${widget.color}30` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.1rem' }}>{widget.icon}</span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.92rem' }}>{widget.label}</span>
                <span style={{ fontSize: '0.68rem', fontWeight: 600, color: widget.color, background: `${widget.color}18`, border: `1px solid ${widget.color}44`, borderRadius: '999px', padding: '0.1rem 0.5rem' }}>{widget.grupo}</span>
              </div>
              <button
                onClick={() => { if (window.confirm(`¿Quitar "${widget.label}" del resumen?`)) togglePin(key) }}
                title="Quitar del Resumen"
                style={{ padding: '0.25rem 0.6rem', borderRadius: '999px', border: '1px solid var(--line-subtle)', background: 'var(--surface-overlay)', color: 'var(--text-muted)', fontSize: '0.72rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', transition: 'all 0.15s' }}>
                🗑️ Quitar
              </button>
            </div>
            <div style={{ padding: '1.25rem' }}>{content}</div>
          </div>
        )
      })}
    </div>
  )
}

// ── Render de widgets en el Resumen ───────────────────────────────────────────
function renderEEWidgetContent(key, { detalleData, periodo }) {
  switch (key) {
    case 'fin_ingreso_gasto':   return <FinancieroChart detalleData={detalleData} />
    case 'ef_distribucion_gasto': return <EficienciaChart detalleData={detalleData} />
    case 'ri_acreditacion':     return <RiesgoChart detalleData={detalleData} />
    case 'sv_composicion':      return <div className="alert-info">Selecciona la sección Subvenciones para ver este indicador.</div>
    case 'sned_kpis':           return <div className="alert-info">Selecciona la sección SNED para ver los KPIs.</div>
    case 'sned_tabla':          return <div className="alert-info">Selecciona la sección SNED para ver la tabla del grupo.</div>
    default:                    return null
  }
}
