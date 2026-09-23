import { useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import api from '../../lib/api'
import { useChartColors } from '../../hooks/useChartColors'
import { useMoneyFmt, fmtN, KPICard } from '../../components/DashboardWidgets'
import SqlViewer from '../../components/SqlViewer'
import { WidgetWrapper } from './FichaSostenedor'

export function RenderGastoAdministrativo({ sostId, periodo, rbdsContextoStr, esContextoAmpliado, widgetFilter = null }) {
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
    api.get(`/dashboard/ficha-sostenedor/gasto-administrativo?sost_id=${sostId}&periodo=${periodo}${rbdsParam}`)
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

  // Gráfico 1: Función
  const barOption = {
    aria: { decal: { show: true } },
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' }, ...C.tooltip,
      formatter: params => {
        const d = gasto_por_funcion[params[0].dataIndex]
        return `<b>${d.fun}</b><br/>Gasto: <b style="color:#8b5cf6">${fmtAmt(d.total)}</b>`
      }
    },
    grid: { left: 80, right: 30, top: 20, bottom: 20, containLabel: true },
    xAxis: { show: false, type: 'value', axisLabel: { color: C.axisLabel, formatter: v => fmtAxisAmt(v) }, splitLine: { lineStyle: { color: C.splitLine } } },
    yAxis: { type: 'category', inverse: true, data: gasto_por_funcion.map(d => d.fun.length > 30 ? d.fun.slice(0, 28) + '...' : d.fun), axisLabel: { color: C.axisLabel, fontSize: 10, width: 140, overflow: 'truncate' } },
    series: [{
      type: 'bar', barMaxWidth: 18,
      data: gasto_por_funcion.map(d => ({ value: d.total, itemStyle: { color: '#3b82f6', borderRadius: [0, 4, 4, 0] } })),
      label: { show: true, position: 'right', formatter: p => fmtAxisAmt(p.value), fontSize: 10, color: 'var(--text-primary)' }
    }],
    backgroundColor: 'transparent',
  }

  // Gráfico 2: Cuenta Alias
  const COLORS = ['#1e40af', '#3b82f6', '#60a5fa', '#93c5fd', '#1d4ed8', '#2563eb', '#bfdbfe']
  const pieOption = {
    aria: { decal: { show: true } },
    tooltip: { trigger: 'item', ...C.tooltip, formatter: p => `<b>${p.name}</b><br/>Gasto: ${fmtAmt(p.value)}<br/>${p.percent.toFixed(1)}%` },
    legend: { orient: 'vertical', left: '60%', top: 'center', textStyle: { color: C.axisLabel, fontSize: 10 }, formatter: name => name.length > 35 ? name.slice(0, 33) + '...' : name },
    color: COLORS,
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
                  <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: '#1e40af', fontVariantNumeric: 'tabular-nums' }}>{fmtAmt(ee.gasto_docaul)}</td>
                  <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: '#3b82f6', fontVariantNumeric: 'tabular-nums' }}>{fmtAmt(ee.gasto_asipar)}</td>
                  <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: '#60a5fa', fontVariantNumeric: 'tabular-nums' }}>{fmtAmt(ee.gasto_docdir)}</td>
                  <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: C.axisLabel, fontVariantNumeric: 'tabular-nums' }}>{fmtAmt(ee.gasto_otros)}</td>
                  <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: '#1d4ed8', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtAmt(ee.total_gasto)}</td>
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
                  {[{ h: 'RBD', a: 'left' }, { h: 'Establecimiento', a: 'left' }, ...(esContextoAmpliado ? [{ h: 'Tipo', a: 'center' }] : []), { h: 'Doc. Aula', a: 'right' }, { h: 'Asist. Parvularia', a: 'right' }, { h: 'Doc. Directivo', a: 'right' }, { h: 'Otros Gastos', a: 'right' }, { h: 'Total Gasto', a: 'right' }].map(({ h, a }) => (
                    <th key={h} style={{ padding: '0.55rem 0.8rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: a, borderBottom: '1px solid var(--line-subtle)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 && <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Sin resultados para «{search}»</td></tr>}
                {paginated.map((ee, i) => {
                  const esPropio = ee.es_propio !== false // default true
                  const rowBg = esContextoAmpliado && esPropio
                    ? i % 2 === 0 ? 'rgba(30, 64, 175, 0.06)' : 'rgba(30, 64, 175, 0.1)'
                    : i % 2 === 0 ? 'transparent' : 'var(--surface-overlay)'
                  const leftBorder = esContextoAmpliado ? (esPropio ? '3px solid #2563eb' : '3px solid transparent') : 'none'
                  return (
                    <tr key={`${ee.rbd}-${ee.nom_rbd}`} style={{ borderBottom: '1px solid var(--line-subtle)', background: rowBg, borderLeft: leftBorder }}>
                      <td style={{ padding: '0.45rem 0.8rem', color: C.axisLabel, fontFamily: 'monospace', fontSize: '0.76rem' }}>{ee.rbd || 'N/A'}</td>
                      <td style={{ padding: '0.45rem 0.8rem', color: 'var(--text-primary)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span title={ee.nom_rbd}>{ee.nom_rbd}</span>
                      </td>
                      {esContextoAmpliado && (
                        <td style={{ padding: '0.45rem 0.6rem', textAlign: 'center' }}>
                          {esPropio
                            ? <span title="Establecimiento propio" style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1e40af', background: '#dbeafe', padding: '1px 7px', borderRadius: 999 }}>Propio</span>
                            : <span title="Establecimiento de referencia del grupo" style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', background: 'var(--surface-overlay)', padding: '1px 7px', borderRadius: 999 }}>Grupo</span>
                          }
                        </td>
                      )}
                      <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: '#1e40af', fontVariantNumeric: 'tabular-nums' }}>{fmtAmt(ee.gasto_docaul)}</td>
                      <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: '#3b82f6', fontVariantNumeric: 'tabular-nums' }}>{fmtAmt(ee.gasto_asipar)}</td>
                      <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: '#60a5fa', fontVariantNumeric: 'tabular-nums' }}>{fmtAmt(ee.gasto_docdir)}</td>
                      <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: C.axisLabel, fontVariantNumeric: 'tabular-nums' }}>{fmtAmt(ee.gasto_otros)}</td>
                      <td style={{ padding: '0.45rem 0.8rem', textAlign: 'right', color: '#1d4ed8', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtAmt(ee.total_gasto)}</td>
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
