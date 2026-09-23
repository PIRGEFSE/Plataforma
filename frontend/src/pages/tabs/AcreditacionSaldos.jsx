import { useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { useChartColors } from '../../hooks/useChartColors'
import { useMoneyFmt, shortName, fmtN, KPICard } from '../../components/DashboardWidgets'
import SqlViewer from '../../components/SqlViewer'
import { WidgetWrapper } from './FichaSostenedor'
import { RIESGO_COLORS } from '../../lib/edu-constants'

export function AcreditacionSaldos({ rdbData, periodo, widgetFilter = null }) {
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
    aria: { decal: { show: true } },
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
    color: ['#10b981', 'var(--surface-overlay)'],
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
    aria: { decal: { show: true } },
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
                    <td style={{ color: '#2563eb' }}>{fmtAmt(d.monto_total)}</td>
                    <td style={{ color: '#10b981' }}>{fmtAmt(d.monto_rendido)}</td>
                    <td style={{ color: Number(d.monto_no_rendido) > 0 ? '#ef4444' : '#10b981' }}>{fmtAmt(d.monto_no_rendido)}</td>
                    <td><strong style={{ color: c }}>{Number(d.pct_rendido).toFixed(1)}%</strong></td>
                    <td><span style={{ color: c, fontWeight: 600, fontSize: '0.75rem' }}>{d.nivel_riesgo}</span></td>
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
