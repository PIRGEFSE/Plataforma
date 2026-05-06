import { useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import api from '../../lib/api'
import { fmtMoneda, fmtMM, fmtMonedaCorto, fmtN } from '../../lib/format'
import InnovacionPedagogica from './InnovacionPedagogica'

// ── Sub-tabs disponibles dentro de Eficiencia del Gasto ───────────────────
const SUB_TABS = [
  { id: 'concentracion', label: 'Concentración del Gasto Administrativo', icon: '⚙️' },
  { id: 'innovacion',    label: '% Gasto en Innovación Pedagógica',        icon: '🎓' },
]

// Paleta fija para las 3 categorías de concentración
const CAT_COLORS = {
  'Gasto en Aula':         '#10b981',
  'Gasto Administrativo':  '#ef4444',
  'Otros Gastos':          '#f59e0b',
}
const CATEGORIAS = ['Gasto en Aula', 'Gasto Administrativo', 'Otros Gastos']

function concSemaforo(pct) {
  if (pct <= 15) return { color: '#10b981', label: 'Óptimo', icon: '🟢' }
  if (pct <= 25) return { color: '#f59e0b', label: 'Moderado', icon: '🟡' }
  return { color: '#ef4444', label: 'Elevado', icon: '🔴' }
}

function KPICard({ label, value, icon, color, sub, badge }) {
  return (
    <div className="kpi-card" style={{ '--accent': color }}>
      <div className="kpi-icon" style={{ background: `${color}20` }}>{icon}</div>
      <div className="kpi-body">
        <div className="kpi-value" style={{ color }}>{value}</div>
        <div className="kpi-label">{label}</div>
        {sub   && <div className="kpi-sub">{sub}</div>}
        {badge && <span className="kpi-badge" style={{ background: `${color}20`, color }}>{badge}</span>}
      </div>
    </div>
  )
}

// ── Panel Concentración del Gasto Administrativo ──────────────────────────
function ConcentracionGasto({ periodo }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const p = periodo ? `?periodo=${periodo}` : ''
    api.get(`/dashboard/eficiencia-gasto${p}`)
      .then(r => setData(r.data))
      .finally(() => setLoading(false))
  }, [periodo])

  const anios = [...new Set((data?.por_periodo ?? []).map(d => d.periodo))].sort()

  const pieOption = !data ? null : {
    tooltip: {
      trigger: 'item',
      formatter: p => `${p.name}<br/>${fmtMM(p.value)}<br/><b>${p.percent}%</b> del gasto total`,
      backgroundColor: '#1e293b', borderColor: '#334155', textStyle: { color: '#f1f5f9' },
    },
    legend: { orient: 'vertical', right: 10, top: 'center', textStyle: { color: '#94a3b8', fontSize: 12 } },
    series: [{
      type: 'pie', radius: ['42%', '72%'], center: ['40%', '50%'],
      data: data.por_categoria.filter(d => CAT_COLORS[d.categoria_gasto])
        .map(d => ({ name: d.categoria_gasto, value: d.monto_total, itemStyle: { color: CAT_COLORS[d.categoria_gasto] } })),
      label: { show: true, formatter: p => `${p.percent}%`, color: '#f1f5f9', fontSize: 11 },
      emphasis: { itemStyle: { shadowBlur: 12, shadowColor: 'rgba(0,0,0,0.4)' } },
      itemStyle: { borderRadius: 6, borderColor: '#0f172a', borderWidth: 2 },
    }],
    backgroundColor: 'transparent',
  }

  const barOption = !data ? null : {
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' },
      formatter: p => {
        const total = p.reduce((s, x) => s + (x.value || 0), 0)
        const lines = p.map(s => `${s.marker}${s.seriesName}: ${fmtMM(s.value)} (${total > 0 ? ((s.value/total)*100).toFixed(1) : 0}%)`).join('<br/>')
        return `${p[0].name}<br/>${lines}<br/><b>Total: ${fmtMM(total)}</b>`
      },
      backgroundColor: '#1e293b', borderColor: '#334155', textStyle: { color: '#f1f5f9' },
    },
    legend: { data: CATEGORIAS, textStyle: { color: '#94a3b8' }, top: 0 },
    grid: { left: 110, right: 20, top: 50, bottom: 40 },
    xAxis: { type: 'category', data: anios, axisLabel: { color: '#94a3b8' }, axisLine: { lineStyle: { color: '#334155' } } },
    yAxis: { type: 'value', axisLabel: { color: '#94a3b8', formatter: v => fmtMonedaCorto(v) }, splitLine: { lineStyle: { color: '#1e293b' } } },
    series: CATEGORIAS.map(cat => ({
      name: cat, type: 'bar', stack: 'gasto', barMaxWidth: 70,
      data: anios.map(a => { const row = data.por_periodo.find(d => d.periodo === a && d.categoria_gasto === cat); return row ? row.monto_total : 0 }),
      itemStyle: { color: CAT_COLORS[cat] }, label: { show: false },
    })),
    backgroundColor: 'transparent',
  }

  const bar100Option = !data ? null : {
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' },
      formatter: p => `${p[0].name}<br/>${p.map(s => `${s.marker}${s.seriesName}: <b>${s.value?.toFixed(1)}%</b>`).join('<br/>')}`,
      backgroundColor: '#1e293b', borderColor: '#334155', textStyle: { color: '#f1f5f9' },
    },
    legend: { data: CATEGORIAS, textStyle: { color: '#94a3b8' }, top: 0 },
    grid: { left: 60, right: 20, top: 50, bottom: 40 },
    xAxis: { type: 'category', data: anios, axisLabel: { color: '#94a3b8' }, axisLine: { lineStyle: { color: '#334155' } } },
    yAxis: { type: 'value', max: 100, axisLabel: { color: '#94a3b8', formatter: v => `${v}%` }, splitLine: { lineStyle: { color: '#1e293b' } } },
    series: CATEGORIAS.map(cat => ({
      name: cat, type: 'bar', stack: 'pct', barMaxWidth: 70,
      data: anios.map(a => {
        const total = data.por_periodo.filter(d => d.periodo === a).reduce((s, d) => s + Number(d.monto_total || 0), 0)
        const row = data.por_periodo.find(d => d.periodo === a && d.categoria_gasto === cat)
        return total > 0 && row ? (Number(row.monto_total) / total * 100) : 0
      }),
      itemStyle: { color: CAT_COLORS[cat] },
      label: { show: true, formatter: p => p.value > 3 ? `${p.value.toFixed(0)}%` : '', color: '#fff', fontSize: 10 },
    })),
    backgroundColor: 'transparent',
  }

  const semaforo = data ? concSemaforo(data.concentracion_admin) : null

  if (loading) return <div className="loading-area"><div className="spinner" /></div>
  if (!data)   return null

  return (
    <>
      <div className="kpi-grid">
        <KPICard label="Gasto Administrativo (411xx)" value={`${data.concentracion_admin.toFixed(1)}%`} icon={semaforo.icon} color={semaforo.color} sub={fmtMoneda(data.monto_admin)} badge={semaforo.label} />
        <KPICard label="Gasto en Aula (410xx)" value={`${data.total_gasto > 0 ? (data.monto_aula / data.total_gasto * 100).toFixed(1) : 0}%`} icon="📚" color="#10b981" sub={fmtMoneda(data.monto_aula)} badge="Aula" />
        <KPICard label="Otros Gastos (700xx)" value={`${data.total_gasto > 0 ? (data.monto_otros / data.total_gasto * 100).toFixed(1) : 0}%`} icon="📦" color="#f59e0b" sub={fmtMoneda(data.monto_otros)} badge="Otros" />
        <KPICard label="Ratio Aula / Administración" value={data.ratio_aula_admin != null ? `${data.ratio_aula_admin.toFixed(2)}x` : '—'} icon="⚖️" color="#6366f1" sub="Por cada peso en admin., cuántos van al aula" badge={data.ratio_aula_admin > 2 ? 'Favorable' : data.ratio_aula_admin > 1 ? 'Moderado' : 'Crítico'} />
      </div>
      <div className="charts-grid-2">
        <div className="chart-card"><h3 className="chart-title">Distribución del Gasto por Categoría</h3><ReactECharts option={pieOption} style={{ height: 360 }} theme="dark" /></div>
        <div className="chart-card"><h3 className="chart-title">Proporción del Gasto por Año (%)</h3><ReactECharts option={bar100Option} style={{ height: 360 }} theme="dark" /></div>
        <div className="chart-card" style={{ gridColumn: '1 / -1' }}>
          <h3 className="chart-title">Monto del Gasto por Categoría y Año (mM$)</h3>
          {anios.length === 0 ? <div className="empty-state">Sin datos para el período</div> : <ReactECharts option={barOption} style={{ height: 320 }} theme="dark" />}
        </div>
      </div>
      <div className="chart-card">
        <h3 className="chart-title">Resumen por Categoría</h3>
        <div className="table-wrapper">
          <table className="data-table">
            <thead><tr><th>Categoría</th><th>Prefijo</th><th>Monto Total</th><th>% del Total</th><th>Establecimientos</th></tr></thead>
            <tbody>
              {data.por_categoria.map(d => (
                <tr key={d.categoria_gasto}>
                  <td><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: CAT_COLORS[d.categoria_gasto], marginRight: 8 }} />{d.categoria_gasto}</td>
                  <td>{d.categoria_gasto === 'Gasto en Aula' && '410xx'}{d.categoria_gasto === 'Gasto Administrativo' && '411xx'}{d.categoria_gasto === 'Otros Gastos' && '700xx'}</td>
                  <td>{fmtMM(d.monto_total)}</td>
                  <td><strong style={{ color: CAT_COLORS[d.categoria_gasto] }}>{data.total_gasto > 0 ? `${(Number(d.monto_total) / data.total_gasto * 100).toFixed(2)}%` : '—'}</strong></td>
                  <td>{fmtN(d.n_establecimientos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

// ── Contenedor principal con sub-navegación ───────────────────────────────
export default function EficienciaGasto() {
  const [subTab, setSubTab] = useState('concentracion')
  const [periodos, setPeriodos] = useState([])
  const [periodo, setPeriodo] = useState('')

  useEffect(() => { api.get('/dashboard/filtros/periodos').then(r => setPeriodos(r.data)) }, [])

  const activeSubTab = SUB_TABS.find(t => t.id === subTab)

  return (
    <div className="tab-page">
      {/* Header principal */}
      <div className="tab-header">
        <div>
          <h2 className="tab-title">Dimensión: Eficiencia y Estructura del Gasto</h2>
          <p className="tab-subtitle">Análisis de la eficiencia y composición del gasto en establecimientos educacionales</p>
        </div>
        <select className="filter-select" value={periodo} onChange={e => setPeriodo(e.target.value)}>
          <option value="">Todos los períodos</option>
          {periodos.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Sub-navegación interna */}
      <div className="sub-tab-nav">
        {SUB_TABS.map(t => (
          <button
            key={t.id}
            className={`sub-tab-btn ${subTab === t.id ? 'active' : ''}`}
            onClick={() => setSubTab(t.id)}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Contenido del sub-tab activo */}
      <div className="sub-tab-content">
        {subTab === 'concentracion' && <ConcentracionGasto periodo={periodo} />}
        {subTab === 'innovacion'    && <InnovacionPedagogica periodos={periodos} periodo={periodo} />}
      </div>
    </div>
  )
}
