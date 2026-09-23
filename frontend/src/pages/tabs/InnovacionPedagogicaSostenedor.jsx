import { useState, useEffect } from 'react'
import ReactECharts from 'echarts-for-react'
import { useChartColors } from '../../hooks/useChartColors'
import { useMoneyFmt, fmtN, KPICard, shortName } from '../../components/DashboardWidgets'
import SqlViewer from '../../components/SqlViewer'
import { EF_COLORS } from '../../lib/edu-constants'
import { WidgetWrapper } from './FichaSostenedor'

export function RenderInnovacionPedagogica({ rdbData, periodo }) {
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

  const pct100Option = {
    aria: { decal: { show: true } },
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
    color: ['#1d4ed8', '#3b82f6', '#93c5fd'],
    grid: { left: 260, right: 80, top: 40, bottom: 20 },
    xAxis: { type: 'value', max: 100, axisLabel: { color: C.axisLabel, formatter: v => `${v}%` }, splitLine: { lineStyle: { color: C.splitLine } } },
    yAxis: { type: 'category', data: names, axisLabel: { color: C.axisLabel, fontSize: 10, width: 250, overflow: 'truncate' } },
    series: [
      { name: 'Gasto en Aula', type: 'bar', stack: 'pct', barMaxWidth: 16, data: visible.map(d => d.pct_aula), itemStyle: { color: '#1d4ed8' } },
      { name: 'Gasto Administrativo', type: 'bar', stack: 'pct', barMaxWidth: 16, data: visible.map(d => d.pct_admin), itemStyle: { color: '#3b82f6' } },
      { name: 'Otros Gastos', type: 'bar', stack: 'pct', barMaxWidth: 16, data: visible.map(d => d.pct_otros), itemStyle: { color: '#93c5fd' } },
    ],
    backgroundColor: 'transparent',
  }

  const adminOption = {
    aria: { decal: { show: true } },
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
            <span style={{ color: '#1d4ed8' }}>■</span> Aula &nbsp;<span style={{ color: '#3b82f6' }}>■</span> Administrativo &nbsp;<span style={{ color: '#93c5fd' }}>■</span> Otros
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

export function RenderInnovacionPedagogicaWidget({ rdbData, periodo, widgetKey }) {
  const C = useChartColors()
  if (!rdbData) return null
  const { eficiencia_rbd = [] } = rdbData
  const sorted = [...eficiencia_rbd].sort((a, b) => Number(b.total_gasto) - Number(a.total_gasto))
  const visible = sorted.slice(0, 15)
  const names = visible.map(d => shortName(d.nom_rbd, d.rbd))
  const h = Math.max(280, visible.length * 36)

  if (widgetKey === 'eg_distribucion_gasto') {
    const opt = {
      aria: { decal: { show: true } },
      tooltip: {
        trigger: 'axis', axisPointer: { type: 'shadow' }, ...C.tooltip,
        formatter: params => { const d = visible[params[0].dataIndex]; return `<b>${shortName(d.nom_rbd, d.rbd)}</b><br/>Aula: ${d.pct_aula}% | Admin: ${d.pct_admin}% | Otros: ${d.pct_otros}%` }
      },
      legend: { data: ['Gasto en Aula', 'Gasto Admin.', 'Otros'], textStyle: { color: C.axisLabel }, top: 0 },
      color: ['#1d4ed8', '#3b82f6', '#93c5fd'],
      grid: { left: 260, right: 80, top: 40, bottom: 20 },
      xAxis: { type: 'value', max: 100, axisLabel: { color: C.axisLabel, formatter: v => `${v}%` }, splitLine: { lineStyle: { color: C.splitLine } } },
      yAxis: { type: 'category', data: names, axisLabel: { color: C.axisLabel, fontSize: 10, width: 250, overflow: 'truncate' } },
      series: [
        { name: 'Gasto en Aula', type: 'bar', stack: 'pct', barMaxWidth: 14, data: visible.map(d => d.pct_aula), itemStyle: { color: '#1d4ed8' } },
        { name: 'Gasto Admin.', type: 'bar', stack: 'pct', barMaxWidth: 14, data: visible.map(d => d.pct_admin), itemStyle: { color: '#3b82f6' } },
        { name: 'Otros', type: 'bar', stack: 'pct', barMaxWidth: 14, data: visible.map(d => d.pct_otros), itemStyle: { color: '#93c5fd' } },
      ],
      backgroundColor: 'transparent',
    }
    return <ReactECharts option={opt} style={{ height: h }} />
  }

  if (widgetKey === 'eg_nivel_admin') {
    const opt = {
      aria: { decal: { show: true } },
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
