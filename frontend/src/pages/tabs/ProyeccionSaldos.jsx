import { useEffect, useState, useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import api from '../../lib/api'
import { useChartColors } from '../../hooks/useChartColors'
import { useMoneyFmt, KPICard, fmtN } from '../../components/DashboardWidgets'
import SqlViewer from '../../components/SqlViewer'

const PROJECTION_YEAR = 2025

// Función para regresión lineal simple
function linearRegression(data) {
  const n = data.length
  if (n < 2) return { slope: 0, intercept: data[0]?.y || 0 }
  const sumX = data.reduce((s, d) => s + d.x, 0)
  const sumY = data.reduce((s, d) => s + d.y, 0)
  const sumXY = data.reduce((s, d) => s + d.x * d.y, 0)
  const sumX2 = data.reduce((s, d) => s + d.x * d.x, 0)
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n
  return { slope, intercept }
}

// Calcular coeficiente de variación para detectar volatilidad
function calculateCV(data) {
  const n = data.length
  if (n < 2) return 0
  const mean = data.reduce((s, d) => s + d.y, 0) / n
  if (mean === 0) return 0
  const variance = data.reduce((s, d) => s + Math.pow(d.y - mean, 2), 0) / n
  const stdDev = Math.sqrt(variance)
  return Math.abs(stdDev / mean)
}

const selSt = {
  padding: '0.35rem 0.7rem',
  backgroundColor: 'var(--surface-overlay)',
  color: 'var(--text-primary)',
  border: '1px solid var(--line-subtle)',
  borderRadius: '0.375rem',
  fontSize: '0.8rem',
}

export default function ProyeccionSaldos({ sostId, periodo }) {
  const C = useChartColors()
  const { fmtAmt, fmtAxisAmt, unitLabel } = useMoneyFmt()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filtros
  const [estadoFiltro, setEstadoFiltro] = useState('RENDIDO')
  const [rbdFiltro, setRbdFiltro] = useState('')
  const [subvencionFiltro, setSubvencionFiltro] = useState('')

  useEffect(() => {
    setLoading(true)
    api.get(`/dashboard/ficha-sostenedor/proyeccion-saldos?sost_id=${sostId}`)
      .then(r => setData(r.data))
      .catch(() => setError('Error al cargar la proyección de saldos'))
      .finally(() => setLoading(false))
  }, [sostId])

  // Opciones de filtros
  const opts = useMemo(() => {
    if (!data) return { rbds: [], subvenciones: [] }
    const rbds = Array.from(new Set(data.serie.map(d => d.rbd)))
      .map(rbd => ({
        id: rbd,
        nombre: data.serie.find(d => d.rbd === rbd)?.nom_rbd || rbd
      }))
      .sort((a, b) => a.id === -1 ? -1 : b.id === -1 ? 1 : a.nombre.localeCompare(b.nombre))
    return {
      rbds,
      subvenciones: data.subvenciones
    }
  }, [data])

  // Procesamiento y cálculo de proyecciones
  const projections = useMemo(() => {
    if (!data) return []
    
    // Filtrar serie inicial
    const filteredSerie = data.serie.filter(d => 
      d.estado === estadoFiltro &&
      (rbdFiltro === '' || d.rbd === Number(rbdFiltro)) &&
      (subvencionFiltro === '' || d.subvencion_alias === subvencionFiltro)
    )

    // Agrupar por subvención y periodo para calcular regresión
    const grouped = {}
    filteredSerie.forEach(d => {
      if (!grouped[d.subvencion_alias]) {
        grouped[d.subvencion_alias] = {}
        data.periodos.forEach(p => grouped[d.subvencion_alias][p] = 0)
      }
      grouped[d.subvencion_alias][d.periodo] += d.saldo_total
    })

    const results = []
    Object.keys(grouped).forEach(subv => {
      const historyPoints = []
      const historyDict = {}
      
      data.periodos.forEach(p => {
        const val = grouped[subv][p] || 0
        historyPoints.push({ x: p, y: val })
        historyDict[p] = val
      })

      const { slope, intercept } = linearRegression(historyPoints)
      const projected2025 = slope * PROJECTION_YEAR + intercept
      const lastActual = historyDict[Math.max(...data.periodos)] || 0
      
      const variation = lastActual !== 0 ? ((projected2025 - lastActual) / Math.abs(lastActual)) * 100 : 0
      const cv = calculateCV(historyPoints)

      // Reglas de alertas
      let alertLevel = 'normal'
      let alertMsg = 'Fondo estable o creciente.'
      
      if (projected2025 < 0 || variation < -20) {
        alertLevel = 'critico'
        alertMsg = projected2025 < 0 
          ? 'Saldo proyectado negativo. Urgente revisar déficit arrastrado.'
          : 'Fuerte tendencia a la baja detectada (>20%).'
      } else if (variation < -5 || cv > 0.3) {
        alertLevel = 'advertencia'
        alertMsg = cv > 0.3 
          ? 'Alta volatilidad en los saldos iniciales (CV > 30%).'
          : 'Tendencia moderada a la baja.'
      } else if (subv === 'SEP' || subv === 'PIE') {
         alertMsg = 'Fondo principal con tendencia positiva, mantener ejecución presupuestaria.'
      }

      results.push({
        subvencion: subv,
        history: historyDict,
        slope,
        projected2025,
        lastActual,
        variation,
        cv,
        alertLevel,
        alertMsg
      })
    })

    return results.sort((a, b) => b.lastActual - a.lastActual)
  }, [data, estadoFiltro, rbdFiltro, subvencionFiltro])

  if (loading) return <div className="loading-area"><div className="spinner" /></div>
  if (error) return <div className="empty-state" style={{ color: '#ef4444' }}>{error}</div>
  if (!data) return null

  // Gráfico Multilíneas (Histórico + Proyección)
  const lineSeries = []
  const chartPeriodos = [...data.periodos, PROJECTION_YEAR]
  
  projections.forEach(proj => {
    const dataPoints = chartPeriodos.map(p => {
      if (p === PROJECTION_YEAR) return proj.projected2025
      return proj.history[p]
    })
    
    lineSeries.push({
      name: proj.subvencion,
      type: 'line',
      data: dataPoints,
      symbol: 'circle',
      symbolSize: (value, params) => params.dataIndex === chartPeriodos.length - 1 ? 8 : 6,
      itemStyle: {
        borderWidth: 2
      },
      lineStyle: {
        width: 2,
        type: 'solid'
      },
      markLine: {
        symbol: ['none', 'none'],
        data: [{ xAxis: PROJECTION_YEAR.toString() }],
        lineStyle: { type: 'dashed', color: C.splitLine, width: 2 },
        label: { show: false }
      }
    })
  })

  // Forzar línea punteada para el segmento 2024 -> 2025 usando un serie separada invisible
  const multiLineOption = {
    tooltip: {
      trigger: 'axis',
      ...C.tooltip,
      formatter: params => {
        let title = `<b>${params[0].axisValue}</b>`
        if (params[0].axisValue === PROJECTION_YEAR.toString()) {
          title += ` <span style="color:#f59e0b;font-size:0.8rem">(Proyectado)</span>`
        }
        const lines = params.map(p => `${p.marker}${p.seriesName}: <b>${fmtAmt(p.value)}</b>`)
        return `${title}<br/>${lines.join('<br/>')}`
      }
    },
    legend: {
      type: 'scroll',
      top: 0,
      textStyle: { color: C.axisLabel }
    },
    grid: { left: 80, right: 30, top: 40, bottom: 30 },
    xAxis: {
      type: 'category',
      data: chartPeriodos.map(String),
      axisLabel: { color: C.axisLabel },
      axisLine: { lineStyle: { color: C.axisLine } }
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: C.axisLabel, formatter: v => fmtAxisAmt(v) },
      splitLine: { lineStyle: { color: C.splitLine } }
    },
    series: lineSeries,
    backgroundColor: 'transparent'
  }

  const sqlStr = `-- Saldos Iniciales y Proyecciones
SELECT 
    periodo,
    COALESCE(rbd, -1) as rbd,
    subvencion_alias,
    cuenta_alias,
    UPPER(TRIM(desc_estado)) AS estado,
    SUM(monto_declarado) AS saldo_total
FROM estado_resultado
WHERE sost_id = :sid
  AND cuenta_alias_padre = '500000'
  AND monto_declarado <> 0
GROUP BY periodo, COALESCE(rbd, -1), subvencion_alias, cuenta_alias, UPPER(TRIM(desc_estado))
ORDER BY periodo, COALESCE(rbd, -1), subvencion_alias`

  return (
    <>
      <SqlViewer sql={sqlStr} />
      <div className="alert-info" style={{ padding: '10px 16px', borderRadius: 10, fontSize: '0.82rem', marginBottom: 12 }}>
        🔮 <strong>Proyección Saldos Iniciales (Cuenta 500000):</strong> Análisis predictivo mediante regresión lineal simple sobre los saldos históricos de cada subvención. Permite anticipar déficit o superávit para el período {PROJECTION_YEAR}.
      </div>

      {/* KPIs Generales */}
      <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
        <KPICard 
          icon="💵" 
          label={`Total Último Año (${unitLabel})`} 
          value={fmtAmt(projections.reduce((s, p) => s + p.lastActual, 0))} 
          color="#3b82f6" 
          sub={`Sumatoria saldos año ${Math.max(...data.periodos)}`}
        />
        <KPICard 
          icon="📊" 
          label="Total Proyectado 2025" 
          value={fmtAmt(projections.reduce((s, p) => s + p.projected2025, 0))} 
          color="#8b5cf6" 
          sub={`Sumatoria proyección (${unitLabel})`}
        />
        <KPICard 
          icon="🏫" 
          label="Establecimientos" 
          value={fmtN(data.resumen.n_establecimientos)} 
          color="#10b981" 
          sub="Con saldos registrados"
        />
        <KPICard 
          icon="📂" 
          label="Subvenciones" 
          value={fmtN(projections.length)} 
          color="#f59e0b" 
          sub="Fondos activos en el filtro"
        />
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 }}>Filtros:</span>
        <select style={selSt} value={estadoFiltro} onChange={e => setEstadoFiltro(e.target.value)}>
          <option value="RENDIDO">Estado: RENDIDO</option>
          <option value="NO RENDIDO">Estado: NO RENDIDO</option>
        </select>
        <select style={selSt} value={rbdFiltro} onChange={e => setRbdFiltro(e.target.value)}>
          <option value="">RBD: Todos (Consolidado)</option>
          {opts.rbds.map(r => (
            <option key={r.id} value={r.id}>{r.nombre}</option>
          ))}
        </select>
        <select style={selSt} value={subvencionFiltro} onChange={e => setSubvencionFiltro(e.target.value)}>
          <option value="">Subvención: Todas</option>
          {opts.subvenciones.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {(estadoFiltro !== 'RENDIDO' || rbdFiltro !== '' || subvencionFiltro !== '') && (
          <button
            onClick={() => { setEstadoFiltro('RENDIDO'); setRbdFiltro(''); setSubvencionFiltro(''); }}
            style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem', background: 'var(--surface-overlay)', border: '1px solid var(--line-subtle)', borderRadius: 6, color: 'var(--text-primary)', cursor: 'pointer' }}
          >
            ✕ Limpiar
          </button>
        )}
      </div>

      {/* Gráfico y Alertas */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
        <div className="chart-card">
          <h3 className="chart-title">Evolución y Proyección de Saldos ({unitLabel})</h3>
          {projections.length === 0 ? (
            <div className="empty-state">No hay datos para los filtros seleccionados</div>
          ) : (
            <ReactECharts option={multiLineOption} style={{ height: 350 }} notMerge={true} />
          )}
        </div>
        
        <div className="chart-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 className="chart-title">Alertas y Recomendaciones</h3>
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {projections.filter(p => !p.subvencion.startsWith('FAEPC')).length === 0 && <div className="empty-state" style={{ height: '100%' }}>Sin alertas</div>}
            
            {projections.filter(p => !p.subvencion.startsWith('FAEPC')).map(proj => {
              const alertColors = {
                critico: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b', icon: '🚨' },
                advertencia: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e', icon: '⚠️' },
                normal: { bg: '#dcfce7', border: '#10b981', text: '#166534', icon: '✅' }
              }
              const st = alertColors[proj.alertLevel]
              // Solo mostrar advertencias y críticos, o el top si no hay
              if (proj.alertLevel === 'normal' && projections.length > 3 && proj.variation < 5) return null

              return (
                <div key={proj.subvencion} style={{
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  borderLeft: `4px solid ${st.border}`,
                  background: 'var(--surface-overlay)',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                      {st.icon} Fondo {proj.subvencion}
                    </strong>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: proj.variation >= 0 ? '#10b981' : '#ef4444' }}>
                      {proj.variation > 0 ? '+' : ''}{proj.variation.toFixed(1)}%
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    {proj.alertMsg}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Tabla de Detalle */}
      <div className="chart-card" style={{ padding: 0 }}>
        <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--line-subtle)' }}>
          <h3 className="chart-title" style={{ margin: 0 }}>Detalle de Proyecciones por Subvención</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead>
              <tr style={{ background: 'var(--surface-overlay)' }}>
                <th style={{ padding: '0.55rem 0.75rem', textAlign: 'left', color: 'var(--text-muted)', borderBottom: '1px solid var(--line-subtle)' }}>Subvención</th>
                {data.periodos.map(p => (
                  <th key={p} style={{ padding: '0.55rem 0.75rem', textAlign: 'right', color: 'var(--text-muted)', borderBottom: '1px solid var(--line-subtle)' }}>{p}</th>
                ))}
                <th style={{ padding: '0.55rem 0.75rem', textAlign: 'right', color: '#8b5cf6', borderBottom: '1px solid var(--line-subtle)' }}>Proy. {PROJECTION_YEAR}</th>
                <th style={{ padding: '0.55rem 0.75rem', textAlign: 'right', color: 'var(--text-muted)', borderBottom: '1px solid var(--line-subtle)' }}>Variación</th>
                <th style={{ padding: '0.55rem 0.75rem', textAlign: 'center', color: 'var(--text-muted)', borderBottom: '1px solid var(--line-subtle)' }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {projections.length === 0 ? (
                <tr><td colSpan={data.periodos.length + 4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Sin datos</td></tr>
              ) : projections.map((proj, i) => (
                <tr key={proj.subvencion} style={{ borderBottom: '1px solid var(--line-subtle)', background: i % 2 === 0 ? 'transparent' : 'var(--surface-overlay)' }}>
                  <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>{proj.subvencion}</td>
                  {data.periodos.map(p => (
                    <td key={p} style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtAmt(proj.history[p])}
                    </td>
                  ))}
                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 700, color: '#8b5cf6', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtAmt(proj.projected2025)}
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600, color: proj.variation >= 0 ? '#10b981' : '#ef4444', fontVariantNumeric: 'tabular-nums' }}>
                    {proj.variation > 0 ? '+' : ''}{proj.variation.toFixed(1)}%
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontSize: '1rem' }}>
                    {proj.alertLevel === 'critico' ? '🚨' : proj.alertLevel === 'advertencia' ? '⚠️' : '✅'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
