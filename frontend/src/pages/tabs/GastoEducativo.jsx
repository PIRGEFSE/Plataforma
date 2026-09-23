import { useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import api from '../../lib/api'
import { useChartColors } from '../../hooks/useChartColors'
import { useMoneyFmt, fmtN, KPICard } from '../../components/DashboardWidgets'
import SqlViewer from '../../components/SqlViewer'
import { WidgetWrapper } from './FichaSostenedor'

export function RenderGastoEducativo({ sostId, periodo, widgetFilter = null }) {
  const C = useChartColors()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectedCategory, setSelectedCategory] = useState(null)
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

  // Gráfico: Top 10 gastos
  const chartData = [...filtered].sort((a, b) => {
    const gpaA = a.mat_total > 0 ? a.total_gasto / a.mat_total : 0;
    const gpaB = b.mat_total > 0 ? b.total_gasto / b.mat_total : 0;
    return gpaB - gpaA;
  }).slice(0, 10)
  const barOption = {
    aria: { decal: { show: true } },
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' }, ...C.tooltip,
      formatter: params => {
        const d = chartData[params[0].dataIndex]
        const val = d.mat_total > 0 ? d.total_gasto / d.mat_total : 0;
        return `<b>${d.nombre_rbd}</b> ${d.rbd ? `(${d.rbd})` : ''}<br/>Monto por Alumno: <b style="color:#1d4ed8">${fmt(val)}</b><br/>Matrícula: ${fmtN(d.mat_total || 0)}<br/>Gasto Total: ${fmt(d.total_gasto)}<br/>Documentos: ${fmtN(d.num_documentos)}`
      }
    },
    grid: { left: 270, right: 80, top: 20, bottom: 20 },
    xAxis: { show: false, type: 'value', axisLabel: { color: C.axisLabel, formatter: v => fmt(v) }, splitLine: { lineStyle: { color: C.splitLine } } },
    yAxis: { type: 'category', inverse: true, data: chartData.map(d => (d.nombre_rbd?.length > 36 ? d.nombre_rbd.slice(0, 34) + '…' : d.nombre_rbd) || 'Sin nombre'), axisLabel: { color: C.axisLabel, fontSize: 10, width: 260, overflow: 'truncate' } },
    series: [{
      type: 'bar', barMaxWidth: 18,
      data: chartData.map(d => ({ value: d.mat_total > 0 ? d.total_gasto / d.mat_total : 0, itemStyle: { color: '#1d4ed8', borderRadius: [0, 4, 4, 0] } })),
      label: { show: true, position: 'right', formatter: p => fmt(p.value), fontSize: 10, color: 'var(--text-primary)' }
    }],
    backgroundColor: 'transparent',
  }

  // Gráfico: Gasto por Cuenta Padre
  const COLORS = ['#1e40af', '#3b82f6', '#60a5fa', '#93c5fd', '#1d4ed8', '#2563eb', '#bfdbfe']

  const groupedCuenta = gasto_por_cuenta.reduce((acc, curr) => {
    if (!acc[curr.categoria]) acc[curr.categoria] = 0;
    acc[curr.categoria] += curr.total_gasto;
    return acc;
  }, {});
  const cuentaChart = Object.keys(groupedCuenta).map(k => ({ categoria: k, total_gasto: groupedCuenta[k] })).sort((a, b) => b.total_gasto - a.total_gasto)

  const pieOption = {
    aria: { decal: { show: true } },
    tooltip: { trigger: 'item', ...C.tooltip, formatter: p => `<b>${p.name}</b><br/>Monto: ${fmt(p.value)}<br/>${p.percent.toFixed(1)}%` },
    legend: { orient: 'vertical', left: '55%', top: 'center', textStyle: { color: C.axisLabel, fontSize: 10 }, formatter: name => name.length > 40 ? name.slice(0, 38) + '...' : name },
    series: [{
      type: 'pie', radius: ['40%', '70%'], center: ['25%', '50%'],
      data: cuentaChart.map((c, i) => ({ name: c.categoria, value: c.total_gasto, itemStyle: { color: COLORS[i % COLORS.length] } })),
      label: { show: false }, emphasis: { label: { show: false } }
    }],
    backgroundColor: 'transparent',
  }
  const pieEvents = { click: (e) => setSelectedCategory(e.name) }

  const sqlStr = `-- Gasto por Establecimiento / Centro de costo
SELECT 
    d.rbd, 
    d.nombre_rbd, 
    SUM(d.monto_declarado) as total_gasto,
    COUNT(d.id) as num_documentos,
    eo.estado_estab, 
    eo.matricula,
    eo.mat_total,
    eo.latitud,
    eo.longitud,
    eo.rural_rbd,
    eo.cod_com_rbd,
    eo.nom_com_rbd
FROM documentos d
LEFT JOIN dim_establecimiento_oficial eo ON d.rbd = eo.rbd AND eo.agno = d.periodo
WHERE d.sost_id = :sid AND d.periodo = :agno
GROUP BY d.rbd, d.nombre_rbd, eo.estado_estab, eo.matricula, eo.mat_total, eo.latitud, eo.longitud, eo.rural_rbd, eo.cod_com_rbd, eo.nom_com_rbd
ORDER BY total_gasto DESC NULLS LAST;

-- Gasto por Cuenta Padre
SELECT 
    COALESCE(desc_cuenta_padre, 'SIN INFORMACIÓN') as categoria, 
    COALESCE(desc_cuenta, 'SIN INFORMACIÓN') as sub_categoria,
    SUM(monto_declarado) as total_gasto
FROM documentos
WHERE sost_id = :sid AND periodo = :agno
GROUP BY COALESCE(desc_cuenta_padre, 'SIN INFORMACIÓN'), COALESCE(desc_cuenta, 'SIN INFORMACIÓN')
ORDER BY categoria, total_gasto DESC NULLS LAST;`

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
                {[{ h: 'RBD', a: 'left' }, { h: 'Nombre / Centro Costo', a: 'left' }, { h: 'Nº Docs', a: 'right' }, { h: 'Rural', a: 'center' }, { h: 'Comuna', a: 'left' }, { h: 'Matrícula', a: 'right' }, { h: 'Monto Total', a: 'right' }].map(({ h, a }) => (
                  <th key={h} style={{ padding: '0.55rem 0.8rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: a, borderBottom: '1px solid var(--line-subtle)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 && <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Sin resultados para «{search}»</td></tr>}
              {paginated.map((ee, i) => (
                <tr key={`${ee.rbd}-${ee.nombre_rbd}`} style={{ borderBottom: '1px solid var(--line-subtle)', background: i % 2 === 0 ? 'transparent' : 'var(--surface-overlay)' }}>
                  <td style={{ padding: '0.45rem 0.8rem', color: C.axisLabel, fontFamily: 'monospace', fontSize: '0.76rem' }}>{ee.rbd || 'N/A'}</td>
                  <td style={{ padding: '0.45rem 0.8rem', color: 'var(--text-primary)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span title={ee.nombre_rbd}>{ee.nombre_rbd}</span>
                  </td>
                  <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: C.axisLabel }}>{fmtN(ee.num_documentos)}</td>
                  <td style={{ padding: '0.45rem 0.8rem', textAlign: 'center', color: ee.rural_rbd === 1 ? '#f59e0b' : 'var(--line-subtle)' }}>{ee.rural_rbd === 1 ? '🌿' : (ee.rbd ? '·' : '')}</td>
                  <td style={{ padding: '0.45rem 0.8rem', color: C.axisLabel, fontSize: '0.76rem' }}>{ee.nom_com_rbd || ''}</td>
                  <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: C.axisLabel, fontVariantNumeric: 'tabular-nums' }}>{fmtN(ee.mat_total || 0)}</td>
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
          <h3 className="chart-title">Top 10 — Mayor Gasto por Alumno (filtrado)</h3>
          {chartData.length === 0
            ? <p style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>Sin datos.</p>
            : <ReactECharts option={barOption} style={{ height: Math.max(280, chartData.length * 38) }} />
          }
        </div>
        <div className="chart-card">
          <h3 className="chart-title">Gasto por Categoría (Cuenta Padre)</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '0.5rem' }}>Haz clic en una categoría para ver sus sub-categorías.</p>
          <ReactECharts option={pieOption} style={{ height: 300 }} onEvents={pieEvents} />
          {selectedCategory ? (
            <div style={{ marginTop: '1rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem' }}>Sub-categorías: {selectedCategory}</h4>
              <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                  <tbody>
                    {gasto_por_cuenta.filter(c => c.categoria === selectedCategory).sort((a, b) => b.total_gasto - a.total_gasto).map(sub => (
                      <tr key={sub.sub_categoria} style={{ borderBottom: '1px solid var(--line-subtle)' }}>
                        <td style={{ padding: '0.3rem', color: 'var(--text-primary)' }}>{sub.sub_categoria}</td>
                        <td style={{ padding: '0.3rem', textAlign: 'right', fontWeight: 600 }}>{fmt(sub.total_gasto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
              {cuentaChart.map((c, i) => (
                <div key={c.categoria} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', borderBottom: '1px solid var(--line-subtle)', fontSize: '0.75rem' }}>
                  <span style={{ color: COLORS[i % COLORS.length] || 'var(--text-muted)', fontWeight: 600, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.categoria}>{c.categoria}</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600, marginLeft: '0.5rem' }}>{fmt(c.total_gasto)}</span>
                </div>
              ))}
            </div>
          )}
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
                  {[{ h: 'RBD', a: 'left' }, { h: 'Nombre / Centro Costo', a: 'left' }, { h: 'Nº Docs', a: 'right' }, { h: 'Rural', a: 'center' }, { h: 'Comuna', a: 'left' }, { h: 'Matrícula', a: 'right' }, { h: 'Monto Total', a: 'right' }].map(({ h, a }) => (
                    <th key={h} style={{ padding: '0.55rem 0.8rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: a, borderBottom: '1px solid var(--line-subtle)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 && <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Sin resultados para «{search}»</td></tr>}
                {paginated.map((ee, i) => (
                  <tr key={`${ee.rbd}-${ee.nombre_rbd}`} style={{ borderBottom: '1px solid var(--line-subtle)', background: i % 2 === 0 ? 'transparent' : 'var(--surface-overlay)' }}>
                    <td style={{ padding: '0.45rem 0.8rem', color: C.axisLabel, fontFamily: 'monospace', fontSize: '0.76rem' }}>{ee.rbd || 'N/A'}</td>
                    <td style={{ padding: '0.45rem 0.8rem', color: 'var(--text-primary)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span title={ee.nombre_rbd}>{ee.nombre_rbd}</span>
                    </td>
                    <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: C.axisLabel }}>{fmtN(ee.num_documentos)}</td>
                    <td style={{ padding: '0.45rem 0.8rem', textAlign: 'center', color: ee.rural_rbd === 1 ? '#f59e0b' : 'var(--line-subtle)' }}>{ee.rural_rbd === 1 ? '🌿' : (ee.rbd ? '·' : '')}</td>
                    <td style={{ padding: '0.45rem 0.8rem', color: C.axisLabel, fontSize: '0.76rem' }}>{ee.nom_com_rbd || ''}</td>
                    <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: C.axisLabel, fontVariantNumeric: 'tabular-nums' }}>{fmtN(ee.mat_total || 0)}</td>
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
            <h3 className="chart-title">Top 10 — Mayor Gasto por Alumno (filtrado)</h3>
            {chartData.length === 0
              ? <p style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>Sin datos.</p>
              : <ReactECharts option={barOption} style={{ height: Math.max(280, chartData.length * 38) }} />
            }
          </div>
          <div className="chart-card">
            <h3 className="chart-title">Gasto por Categoría (Cuenta Padre)</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '0.5rem' }}>Haz clic en una categoría para ver sus sub-categorías.</p>
            <ReactECharts option={pieOption} style={{ height: 300 }} onEvents={pieEvents} />
            {selectedCategory ? (
              <div style={{ marginTop: '1rem' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem' }}>Sub-categorías: {selectedCategory}</h4>
                <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                    <tbody>
                      {gasto_por_cuenta.filter(c => c.categoria === selectedCategory).sort((a, b) => b.total_gasto - a.total_gasto).map(sub => (
                        <tr key={sub.sub_categoria} style={{ borderBottom: '1px solid var(--line-subtle)' }}>
                          <td style={{ padding: '0.3rem', color: 'var(--text-primary)' }}>{sub.sub_categoria}</td>
                          <td style={{ padding: '0.3rem', textAlign: 'right', fontWeight: 600 }}>{fmt(sub.total_gasto)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
                {cuentaChart.map((c, i) => (
                  <div key={c.categoria} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', borderBottom: '1px solid var(--line-subtle)', fontSize: '0.75rem' }}>
                    <span style={{ color: COLORS[i % COLORS.length] || 'var(--text-muted)', fontWeight: 600, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.categoria}>{c.categoria}</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600, marginLeft: '0.5rem' }}>{fmt(c.total_gasto)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
    </WidgetWrapper>

      <WidgetWrapper widgetKey="te_gasto_contexto_territorial">
        <div className="chart-card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
          <h3 className="chart-title">Índice de Contexto Territorial del Gasto</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '1.25rem' }}>
            Relación entre el gasto operacional en áreas clave (Transporte, Infraestructura, Conectividad) y el nivel de ruralidad y dispersión del territorio.
          </p>
          
          {(() => {
            const sumGasto = (arr, key) => arr.reduce((acc, curr) => acc + (curr[key] || 0), 0)
            const rural = gasto_establecimientos.filter(e => e.rural_rbd === 1)
            const urbano = gasto_establecimientos.filter(e => e.rural_rbd === 0)
            
            const scatterTerritorialData = paginated.map(d => {
              const territorial = (d.gasto_transporte || 0) + (d.gasto_infraestructura || 0) + (d.gasto_conectividad || 0)
              const perCapita = d.mat_total > 0 ? territorial / d.mat_total : 0
              return {
                name: d.nombre_rbd,
                rbd: d.rbd,
                value: [d.mat_total || 0, perCapita, territorial, d.rural_rbd],
                itemStyle: { color: d.rural_rbd === 1 ? '#f59e0b' : '#3b82f6' }
              }
            })
            
            const scatterTerritorialOpt = {
              aria: { decal: { show: true } },
              tooltip: {
                trigger: 'item', ...C.tooltip,
                formatter: p => {
                  const d = p.data
                  return `<b>${d.name}</b> (${d.rbd})<br/>
                    🌿 Contexto: <b>${d.value[3] === 1 ? 'Rural' : 'Urbano'}</b><br/>
                    👥 Matrícula: <b>${fmtN(d.value[0])}</b><br/>
                    💰 Gasto Territorial Total: <b>${fmt(d.value[2])}</b><br/>
                    📊 Gasto Territorial Per Cápita: <b>${fmt(d.value[1])}</b>`
                }
              },
              grid: { left: 80, right: 30, top: 20, bottom: 50 },
              xAxis: {
                type: 'value', name: 'Matrícula', nameLocation: 'middle', nameGap: 30, scale: true,
                axisLabel: { color: C.axisLabel, formatter: v => fmtN(v) }, splitLine: { lineStyle: { color: C.splitLine } },
              },
              yAxis: {
                type: 'value', name: 'Gasto Terr. Per Cápita ($)', nameLocation: 'middle', nameGap: 60, scale: true,
                axisLabel: { color: C.axisLabel, formatter: v => `$${(v / 1000).toFixed(0)}k` }, splitLine: { lineStyle: { color: C.splitLine } },
              },
              series: [{
                name: 'Gasto Territorial', type: 'scatter', symbolSize: 12,
                itemStyle: { borderColor: '#fff', borderWidth: 1 },
                data: scatterTerritorialData
              }],
              backgroundColor: 'transparent',
            }

            return (
              <>
                <div className="kpi-grid" style={{ marginBottom: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                  <KPICard icon="🚌" label="Transporte (Rural)" value={fmt(sumGasto(rural, 'gasto_transporte'))} color="#f59e0b" />
                  <KPICard icon="🏢" label="Infraest. (Rural)" value={fmt(sumGasto(rural, 'gasto_infraestructura'))} color="#f59e0b" />
                  <KPICard icon="📶" label="Conectividad (Rural)" value={fmt(sumGasto(rural, 'gasto_conectividad'))} color="#f59e0b" />
                  <KPICard icon="🚌" label="Transporte (Urbano)" value={fmt(sumGasto(urbano, 'gasto_transporte'))} color="#3b82f6" />
                </div>
                
                <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem' }}>Dispersión: Matrícula vs Gasto Territorial Per Cápita</h4>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '0.5rem', fontSize: '0.8rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', backgroundColor: '#f59e0b' }}></span> Rural</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', backgroundColor: '#3b82f6' }}></span> Urbano</span>
                </div>
                <ReactECharts option={scatterTerritorialOpt} style={{ height: 350 }} />
              </>
            )
          })()}
        </div>
      </WidgetWrapper>
    </>
  )
}
