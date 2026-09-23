import { useState, useEffect } from 'react'
import ReactECharts from 'echarts-for-react'
import { useChartColors } from '../../hooks/useChartColors'
import { useMoneyFmt, fmtN, KPICard, shortName } from '../../components/DashboardWidgets'
import SqlViewer from '../../components/SqlViewer'
import { WidgetWrapper } from './FichaSostenedor'
import IngresoGastoDetalle from './IngresoGastoDetalle'

export function TabFinanciero({ rdbData, periodo, sostId, rbdsContextoStr }) {
  const C = useChartColors()
  if (!rdbData) return null
  const { fmtAmt, fmtAxisAmt, unitLabel } = useMoneyFmt()
  const { financiero_rbd = [], remuneraciones_rbd = [] } = rdbData
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  const sorted = [...financiero_rbd]
    .map(d => ({ ...d, nom_rbd: (d.nom_rbd && d.nom_rbd !== 'null') ? d.nom_rbd : 'ADMINISTRACIÓN CENTRAL' }))
    .sort((a, b) => Number(b.ingreso) - Number(a.ingreso))

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
    aria: { decal: { show: true } },
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' }, ...C.tooltip,
      formatter: params => {
        const d = visible[params[0].dataIndex]
        return `<b>${shortName(d.nom_rbd, d.rbd)}</b> (${d.rbd})<br/>
          📈 Ingreso: ${fmtAmt(d.ingreso)}<br/>📉 Gasto: ${fmtAmt(d.gasto)}<br/>⚖️ Superávit: <b>${fmtAmt(d.superavit)}</b>`
      },
    },
    legend: { data: ['Ingreso', 'Gasto'], textStyle: { color: C.axisLabel }, top: 0 },
    color: ['#1e40af', '#3b82f6'],
    grid: { left: 260, right: 100, top: 40, bottom: 20 },
    xAxis: { type: 'value', axisLabel: { color: C.axisLabel, formatter: v => fmtAxisAmt(v) }, splitLine: { lineStyle: { color: C.splitLine } } },
    yAxis: { type: 'category', data: names, axisLabel: { color: C.axisLabel, fontSize: 10, width: 250, overflow: 'truncate' } },
    series: [
      { name: 'Ingreso', type: 'bar', data: visible.map(d => Number(d.ingreso)), barMaxWidth: 16, itemStyle: { color: '#1e40af', borderRadius: [0, 4, 4, 0] } },
      { name: 'Gasto',   type: 'bar', data: visible.map(d => Number(d.gasto)),   barMaxWidth: 16, itemStyle: { color: '#3b82f6', borderRadius: [0, 4, 4, 0] } },
    ],
    backgroundColor: 'transparent',
  }

  const superavitOption = {
    aria: { decal: { show: true } },
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
      data: visible.map(d => ({ value: Number(d.superavit), itemStyle: { color: Number(d.superavit) >= 0 ? '#059669' : '#dc2626', borderRadius: [0, 4, 4, 0] } })),
      markLine: { silent: true, data: [{ xAxis: 0, lineStyle: { color: C.axisLabel, type: 'dashed' } }] },
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

  const sqlStr = `-- Gasto por establecimiento y desglosado
SELECT
    er.rbd,
    eo.nom_rbd,
    SUM(CASE WHEN UPPER(TRIM(er.desc_tipo_cuenta)) LIKE '%INGRESO%'
             AND UPPER(TRIM(er.desc_estado)) = 'RENDIDO'
             AND er.cuenta_alias_padre LIKE '3%'
             THEN er.monto_declarado ELSE 0 END) AS ingreso,
    SUM(CASE WHEN UPPER(TRIM(er.desc_tipo_cuenta)) LIKE '%GASTO%'
             AND UPPER(TRIM(er.desc_estado)) = 'RENDIDO'
             THEN er.monto_declarado ELSE 0 END) AS gasto,
    SUM(CASE WHEN UPPER(TRIM(er.desc_tipo_cuenta)) LIKE '%INGRESO%'
             AND UPPER(TRIM(er.desc_estado)) = 'RENDIDO'
             AND er.cuenta_alias_padre LIKE '3%'
             THEN er.monto_declarado
             WHEN UPPER(TRIM(er.desc_tipo_cuenta)) LIKE '%GASTO%'
             AND UPPER(TRIM(er.desc_estado)) = 'RENDIDO'
             THEN -er.monto_declarado ELSE 0 END) AS superavit
FROM estado_resultado er
JOIN dim_establecimiento_oficial eo ON eo.rbd = er.rbd AND eo.agno = er.periodo
WHERE er.sost_id = :sid
  AND er.periodo = :per
GROUP BY er.rbd, eo.nom_rbd
ORDER BY ingreso DESC`

  return (
    <>
      <SqlViewer sql={sqlStr} />
      <div className="alert-info" style={{ padding: '10px 16px', borderRadius: 10, fontSize: '0.82rem', marginBottom: 12 }}>
        ℹ️ <strong>Metodología:</strong> Comparación entre el Ingreso Total y el Gasto Total por Establecimiento (RBD) para calcular el Superávit o Déficit del período.
      </div>
      <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
        <KPICard icon="📈" label={`Total Ingresos (${periodo})`} value={fmtAmt(totalIng)} color="#1e40af" />
        <KPICard icon="📉" label={`Total Gastos (${periodo})`} value={fmtAmt(totalGas)} color="#3b82f6" />
        <KPICard icon="⚖️" label="Superávit Consolidado" value={fmtAmt(totalIng - totalGas)} color="#2563eb" />
        <KPICard icon="⚠️" label="EE con Déficit" value={fmtN(conDeficit)} color={conDeficit > 0 ? '#d97706' : '#059669'} />
      </div>

      {/* Buscador + paginación */}
      <div style={{ 
        display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap',
        position: 'sticky', top: '5.5rem', zIndex: 15, 
        background: 'var(--surface-raised)', padding: '0.75rem 1rem', 
        borderRadius: '8px', border: '1px solid var(--line-subtle)',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
      }}>
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

      <WidgetWrapper widgetKey="ef_ingreso_gasto">
        <div className="chart-card" style={{ marginBottom: '1.25rem' }}>
          <h3 className="chart-title">Ingreso vs Gasto por Establecimiento — {periodo} ({unitLabel})</h3>
          {visible.length === 0
            ? <p style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>Sin resultados para «{search}»</p>
            : <ReactECharts option={barOption} style={{ height: h }} />
          }
        </div>
      </WidgetWrapper>
      <WidgetWrapper widgetKey="ef_superavit">
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
      </WidgetWrapper>

      <div style={{ marginTop: '2rem' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
          Análisis de Composición y Drill-Down
        </h2>
        {sostId ? (
          <IngresoGastoDetalle sostId={sostId} periodo={periodo} rbdsContextoStr={rbdsContextoStr} visibleRbds={visible.map(d => Number(d.rbd))} />
        ) : (
          <p style={{ color: 'var(--text-muted)' }}>Falta identificador del sostenedor para cargar el detalle.</p>
        )}
      </div>
    </>
  )
}
