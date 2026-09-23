import { useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import api from '../../lib/api'
import { useChartColors } from '../../hooks/useChartColors'
import { useMoneyFmt, fmtN, KPICard } from '../../components/DashboardWidgets'
import SqlViewer from '../../components/SqlViewer'
import { WidgetWrapper } from './FichaSostenedor'

export function RenderCostoAlumno({ sostId, periodo, rbdsContextoStr, esContextoAmpliado, widgetFilter = null }) {
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
    const rbdsParam = rbdsContextoStr ? `&rbds_contexto=${encodeURIComponent(rbdsContextoStr)}` : ''
    api.get(`/dashboard/ficha-sostenedor/costo-alumno?sost_id=${sostId}&periodo=${periodo}${rbdsParam}`)
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

  // Gráfico 1: Top 10 Costo por Alumno
  const chartData = [...filtered].sort((a, b) => (b.costo_por_alumno ?? 0) - (a.costo_por_alumno ?? 0)).slice(0, 10)
  const barOption = {
    aria: { decal: { show: true } },
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
    xAxis: { show: false, type: 'value', axisLabel: { color: C.axisLabel, formatter: v => fmtAxisAmt(v) }, splitLine: { lineStyle: { color: C.splitLine } } },
    yAxis: { type: 'category', inverse: true, data: chartData.map(d => (d.nombre_rbd?.length > 36 ? d.nombre_rbd.slice(0, 34) + '…' : d.nombre_rbd) || 'Sin nombre'), axisLabel: { color: C.axisLabel, fontSize: 10, width: 260, overflow: 'truncate' } },
    series: [{
      type: 'bar', barMaxWidth: 18,
      data: chartData.map(d => ({ value: d.costo_por_alumno, itemStyle: { color: '#3b82f6', borderRadius: [0, 4, 4, 0] } })),
      label: { show: true, position: 'right', formatter: p => fmtAxisAmt(p.value), fontSize: 10, color: 'var(--text-primary)' }
    }],
    backgroundColor: 'transparent',
  }

  // Gráfico 2: Distribución Docencia vs Operacional (General)
  const pieOption = {
    aria: { decal: { show: true } },
    tooltip: { trigger: 'item', ...C.tooltip, formatter: p => `<b>${p.name}</b><br/>Monto: ${fmtAmt(p.value)}<br/>${p.percent.toFixed(1)}%` },
    legend: { orient: 'vertical', left: '60%', top: 'center', textStyle: { color: C.axisLabel, fontSize: 11 } },
    color: ['#3b82f6', '#60a5fa'],
    series: [{
      type: 'pie', radius: ['45%', '70%'], center: ['30%', '50%'],
      data: [
        { name: 'Docencia y Apoyo', value: resumen.total_docencia, itemStyle: { color: '#3b82f6' } },
        { name: 'Operacional', value: resumen.total_operacional, itemStyle: { color: '#60a5fa' } }
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
        <KPICard icon="👨‍🎓" label="Matrícula Total" value={fmtN(resumen.total_matricula_evaluada)} color="#1d4ed8" sub="Establecimientos evaluados" />
        <KPICard icon="📚" label="Gasto Docencia" value={fmtAmt(resumen.total_docencia)} color="#60a5fa" />
        <KPICard icon="⚙️" label="Gasto Operacional" value={fmtAmt(resumen.total_operacional)} color="#93c5fd" />
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
                  <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: '#1e40af' }}>{fmtAmt(ee.gasto_docencia)}</td>
                  <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: '#3b82f6' }}>{fmtAmt(ee.gasto_operacional)}</td>
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
                  {[{ h: 'RBD', a: 'left' }, { h: 'Establecimiento', a: 'left' }, ...(esContextoAmpliado ? [{ h: 'Tipo', a: 'center' }] : []), { h: 'Matrícula', a: 'right' }, { h: 'Gasto Docencia', a: 'right' }, { h: 'Gasto Operacional', a: 'right' }, { h: 'Costo por Alumno', a: 'right' }].map(({ h, a }) => (
                    <th key={h} style={{ padding: '0.55rem 0.8rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: a, borderBottom: '1px solid var(--line-subtle)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 && <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Sin resultados para «{search}»</td></tr>}
                {paginated.map((ee, i) => {
                  const esPropio = ee.es_propio !== false // default true
                  const rowBg = esContextoAmpliado && esPropio
                    ? i % 2 === 0 ? 'rgba(30, 64, 175, 0.06)' : 'rgba(30, 64, 175, 0.1)'
                    : i % 2 === 0 ? 'transparent' : 'var(--surface-overlay)'
                  const leftBorder = esContextoAmpliado ? (esPropio ? '3px solid #2563eb' : '3px solid transparent') : 'none'
                  return (
                    <tr key={`${ee.rbd}-${ee.nombre_rbd}`} style={{ borderBottom: '1px solid var(--line-subtle)', background: rowBg, borderLeft: leftBorder }}>
                      <td style={{ padding: '0.45rem 0.8rem', color: C.axisLabel, fontFamily: 'monospace', fontSize: '0.76rem' }}>{ee.rbd}</td>
                      <td style={{ padding: '0.45rem 0.8rem', color: 'var(--text-primary)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span title={ee.nombre_rbd}>{ee.nombre_rbd}</span>
                      </td>
                      {esContextoAmpliado && (
                        <td style={{ padding: '0.45rem 0.6rem', textAlign: 'center' }}>
                          {esPropio
                            ? <span title="Establecimiento propio" style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1e40af', background: '#dbeafe', padding: '1px 7px', borderRadius: 999 }}>Propio</span>
                            : <span title="Establecimiento de referencia del grupo" style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', background: 'var(--surface-overlay)', padding: '1px 7px', borderRadius: 999 }}>Grupo</span>
                          }
                        </td>
                      )}
                      <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: C.axisLabel, fontVariantNumeric: 'tabular-nums' }}>{fmtN(ee.mat_total)}</td>
                      <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: '#1e40af', fontVariantNumeric: 'tabular-nums' }}>{fmtAmt(ee.gasto_docencia)}</td>
                      <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: '#3b82f6', fontVariantNumeric: 'tabular-nums' }}>{fmtAmt(ee.gasto_operacional)}</td>
                      <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: '#3b82f6', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtAmt(ee.costo_por_alumno)}</td>
                    </tr>
                  )
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
