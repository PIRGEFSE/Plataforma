import { useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import api from '../../lib/api'
import { fmtMM, fmtMonedaCorto, fmtN } from '../../lib/format'
import { useChartColors } from '../../hooks/useChartColors'
import { useMoneyFmt } from './FichaSostenedor'

// ── Paleta de niveles de riesgo ───────────────────────────────────────────
const RIESGO_COLOR = {
  'Riesgo Bajo':    '#10b981',
  'Riesgo Medio':   '#f59e0b',
  'Riesgo Alto':    '#f97316',
  'Riesgo Crítico': '#ef4444',
  'Sin Datos':      '#64748b',
}
const RIESGO_ICON = {
  'Riesgo Bajo':    '🟢',
  'Riesgo Medio':   '🟡',
  'Riesgo Alto':    '🟠',
  'Riesgo Crítico': '🔴',
  'Sin Datos':      '⚪',
}
const NIVELES = ['Riesgo Bajo', 'Riesgo Medio', 'Riesgo Alto', 'Riesgo Crítico', 'Sin Datos']

function ratioLabel(pct) {
  if (pct < 70) return { ...RIESGO_COLOR['Riesgo Bajo'],    icon: '🟢', label: 'Riesgo Bajo',    color: RIESGO_COLOR['Riesgo Bajo'] }
  if (pct < 85) return { ...RIESGO_COLOR['Riesgo Medio'],   icon: '🟡', label: 'Riesgo Medio',   color: RIESGO_COLOR['Riesgo Medio'] }
  if (pct < 95) return { ...RIESGO_COLOR['Riesgo Alto'],    icon: '🟠', label: 'Riesgo Alto',    color: RIESGO_COLOR['Riesgo Alto'] }
  return              { ...RIESGO_COLOR['Riesgo Crítico'],  icon: '🔴', label: 'Riesgo Crítico', color: RIESGO_COLOR['Riesgo Crítico'] }
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

function shortName(nom, rbd) {
  if (!nom) return `RBD ${rbd}`
  return nom.length > 38 ? nom.slice(0, 36) + '…' : nom
}

export default function GastoRemIngresoEstablecimiento({ sostId, periodo }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const ITEMS_PER_PAGE = 10
  const C = useChartColors()
  const { fmtAmt, unitLabel } = useMoneyFmt()

  useEffect(() => {
    setLoading(true)
    const p = periodo ? `&periodo=${periodo}` : ''
    api.get(`/dashboard/gasto-rem-ingreso-establecimiento?sost_id=${sostId}${p}`)
      .then(r => setData(r.data))
      .finally(() => setLoading(false))
  }, [sostId, periodo])

  useEffect(() => { setPage(0) }, [search, periodo])

  if (loading) return <div className="loading-area"><div className="spinner" /></div>
  if (!data)   return null

  const anios = [...new Set(data.por_nivel.map(d => d.periodo))].sort()
  const rl = ratioLabel(data.ratio_global)

  // ── Filtrado y Paginación para Gráficos y Tabla ───────────────────────────
  const filterText = search.toLowerCase().trim()
  const filteredEstab = data.top_estab.filter(d => 
    (d.nom_rbd || '').toLowerCase().includes(filterText) || (d.rbd != null ? String(d.rbd).includes(filterText) : false)
  )
  const totalPages = Math.ceil(filteredEstab.length / ITEMS_PER_PAGE) || 1
  const safePage = Math.min(page, totalPages - 1)
  const paginatedEstab = filteredEstab.slice(safePage * ITEMS_PER_PAGE, (safePage + 1) * ITEMS_PER_PAGE)
  const chartHeight = Math.max(320, paginatedEstab.length * 40)

  // ── Gauge del ratio global ────────────────────────────────────────────────
  const gaugeOpt = {
    series: [{
      type: 'gauge', startAngle: 200, endAngle: -20,
      min: 0, max: 150, splitNumber: 5, radius: '90%',
      axisLine: { lineStyle: { width: 20, color: [
        [0.467, RIESGO_COLOR['Riesgo Bajo']],
        [0.567, RIESGO_COLOR['Riesgo Medio']],
        [0.633, RIESGO_COLOR['Riesgo Alto']],
        [1.000, RIESGO_COLOR['Riesgo Crítico']],
      ] } },
      pointer: { itemStyle: { color: 'auto' }, length: '60%', width: 6 },
      axisTick: { show: false },
      splitLine: { length: 14, lineStyle: { color: 'auto', width: 2 } },
      axisLabel: { color: C.axisLabel, fontSize: 11, formatter: v => `${v}%` },
      title: { offsetCenter: [0, '78%'], color: C.axisLabel, fontSize: 13 },
      detail: {
        valueAnimation: true,
        formatter: v => `${v.toFixed(1)}%\nRem/Ingreso`,
        color: rl.color, fontSize: 22, fontWeight: 700, offsetCenter: [0, '38%'],
      },
      data: [{ value: Math.min(data.ratio_global, 150), name: 'Ratio Global' }],
    }],
    backgroundColor: 'transparent',
  }

  // ── Barras apiladas: establecimientos por nivel de riesgo por año ─────────────
  const barNivelOpt = {
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' }, ...C.tooltip,
      formatter: p => `${p[0].name}<br/>${p.map(s => `${s.marker}${s.seriesName}: ${fmtN(s.value)} estab.`).join('<br/>')}`,
    },
    legend: { data: NIVELES, textStyle: { color: C.axisLabel }, top: 0 },
    grid: { left: 60, right: 20, top: 50, bottom: 40 },
    xAxis: { type: 'category', data: anios, axisLabel: { color: C.axisLabel }, axisLine: { lineStyle: { color: C.splitLine } } },
    yAxis: { type: 'value', axisLabel: { color: C.axisLabel, formatter: v => fmtN(v) }, splitLine: { lineStyle: { color: C.splitLine } } },
    series: NIVELES.map(n => ({
      name: n, type: 'bar', stack: 'nivel', barMaxWidth: 60,
      data: anios.map(a => { const r = data.por_nivel.find(d => d.periodo === a && d.nivel_riesgo === n); return r ? r.n_establecimientos : 0 }),
      itemStyle: { color: RIESGO_COLOR[n] },
      label: { show: true, formatter: p => p.value > 0 ? fmtN(p.value) : '', color: '#fff', fontSize: 10 },
    })),
    backgroundColor: 'transparent',
  }

  // ── Barras horizontales: Ratio por Establecimiento (paginado) ─────────────
  const chartData = [...paginatedEstab].reverse()
  const barRatioEstabOpt = {
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' }, ...C.tooltip,
      formatter: params => {
        const d = chartData[params[0].dataIndex]
        if (!d) return ''
        return `<b>${d.nom_rbd}</b> (${d.rbd})<br/>
          Ratio: <b>${d.ratio_pct != null ? Number(d.ratio_pct).toFixed(1) + '%' : 'Sin Datos'}</b><br/>
          Gasto Rem.: ${fmtAmt(d.gasto_rem)}<br/>
          Ingreso Dep.: ${fmtAmt(d.ingreso_total)}`
      }
    },
    grid: { left: 260, right: 60, top: 20, bottom: 20 },
    xAxis: { type: 'value', axisLabel: { color: C.axisLabel, formatter: v => `${v}%` }, splitLine: { lineStyle: { color: C.splitLine } } },
    yAxis: { type: 'category', data: chartData.map(d => shortName(d.nom_rbd, d.rbd)), axisLabel: { color: C.axisLabel, fontSize: 10, width: 250, overflow: 'truncate' } },
    series: [{
      type: 'bar', barMaxWidth: 20,
      data: chartData.map(d => ({
        value: d.ratio_pct != null ? Number(d.ratio_pct) : 0,
        itemStyle: { color: RIESGO_COLOR[d.nivel_riesgo] || '#64748b', borderRadius: [0, 4, 4, 0] }
      })),
      label: { show: true, position: 'right', formatter: p => p.value > 0 ? `${Number(p.value).toFixed(1)}%` : 'N/A', color: C.axisLabel, fontSize: 10 },
      markLine: {
        silent: true,
        data: [
          { xAxis: 70, lineStyle: { color: '#10b981', type: 'dashed' }, label: { formatter: '70%', color: '#10b981', fontSize: 10, position: 'end' } },
          { xAxis: 95, lineStyle: { color: '#ef4444', type: 'dashed' }, label: { formatter: '95%', color: '#ef4444', fontSize: 10, position: 'end' } },
        ]
      }
    }],
    backgroundColor: 'transparent',
  }

  const inputStyle = {
    padding: '0.35rem 0.75rem', backgroundColor: 'var(--surface-overlay)', color: 'var(--text-primary)',
    border: '1px solid var(--line-subtle)', borderRadius: '0.375rem', fontSize: '0.8rem', minWidth: 220,
  }

  return (
    <>
      <div className="alert-info" style={{ padding: '10px 16px', borderRadius: 10, fontSize: '0.82rem', marginBottom: 12 }}>
        ℹ️ <strong>Metodología:</strong> Ratio = Gasto Remuneracional / Ingreso Depurado × 100 por Establecimiento (RBD).
        <span className="kpi-badge" style={{ marginLeft: 10, background: '#10b98120', color: '#10b981' }}>🟢 &lt;70% Bajo</span>
        <span className="kpi-badge" style={{ marginLeft: 6, background: '#f59e0b20', color: '#f59e0b' }}>🟡 70-84% Medio</span>
        <span className="kpi-badge" style={{ marginLeft: 6, background: '#f9731620', color: '#f97316' }}>🟠 85-94% Alto</span>
        <span className="kpi-badge" style={{ marginLeft: 6, background: '#ef444420', color: '#ef4444' }}>🔴 ≥95% Crítico</span>
      </div>

      <div className="kpi-grid">
        <KPICard label={`Ratio Global Sostenedor (${periodo})`} value={`${data.ratio_global.toFixed(1)}%`} icon={rl.icon} color={rl.color} sub={`Promedio EE: ${data.avg_ratio.toFixed(1)}%`} badge={rl.label} />
        <KPICard label="EE en Riesgo Alto/Crítico" value={fmtN(data.estab_alto_crit)} icon="🔴" color="#ef4444" sub={`de ${fmtN(data.total_estab)} establecimientos`} badge="Atención" />
        <KPICard label={`Total Gasto Remuneracional`} value={fmtAmt(data.total_rem)} icon="👥" color="#ef4444" sub={`Consolidado EE (${unitLabel})`} badge="Nómina" />
        <KPICard label={`Total Ingreso Depurado`} value={fmtAmt(data.total_ingreso)} icon="💰" color="#6366f1" sub={`Consolidado EE (${unitLabel})`} badge="Ingreso" />
      </div>

      <div className="charts-grid-2" style={{ marginBottom: '1.5rem' }}>
        <div className="chart-card">
          <h3 className="chart-title">Ratio Global Gasto Rem / Ingreso ({periodo})</h3>
          <ReactECharts option={gaugeOpt} style={{ height: 280 }} />
          <div style={{ textAlign: 'center', marginTop: -12, fontSize: '0.78rem', color: C.axisLabel }}>
            Escala 0–150% · Umbral crítico en 95%
          </div>
        </div>
        <div className="chart-card">
          <h3 className="chart-title">Establecimientos por Nivel de Riesgo y Año</h3>
          {anios.length === 0 ? <div className="empty-state">Sin datos</div> : <ReactECharts option={barNivelOpt} style={{ height: 320 }} />}
        </div>
      </div>

      {/* Buscador y Paginación */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="🔍 Buscar por RBD o Nombre..."
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
          <b style={{ color: C.axisLabel }}>{filteredEstab.length === 0 ? 0 : safePage * ITEMS_PER_PAGE + 1}–{Math.min((safePage + 1) * ITEMS_PER_PAGE, filteredEstab.length)}</b>
          {' '}de <b style={{ color: C.axisLabel }}>{filteredEstab.length}</b> establecimientos
        </span>
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

      <div className="chart-card" style={{ marginBottom: '1.5rem' }}>
        <h3 className="chart-title">Ratio Gasto Remuneracional / Ingreso Depurado ({periodo})</h3>
        {paginatedEstab.length === 0 ? (
          <div className="empty-state">Sin resultados para la búsqueda</div>
        ) : (
          <ReactECharts option={barRatioEstabOpt} style={{ height: chartHeight }} />
        )}
      </div>

      <div className="chart-card">
        <h3 className="chart-title">Detalle por Establecimiento ({periodo})</h3>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr><th>RBD</th><th>Nombre</th><th>Nivel de Riesgo</th><th>Ratio (%)</th><th>Gasto Rem. ({unitLabel})</th><th>Ingreso Depurado ({unitLabel})</th></tr>
            </thead>
            <tbody>
              {paginatedEstab.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>Sin resultados</td></tr>
              ) : (
                paginatedEstab.map((d, i) => {
                  const col = RIESGO_COLOR[d.nivel_riesgo] ?? '#94a3b8'
                  return (
                    <tr key={`${d.rbd || 'adm'}-${i}`}>
                      <td>{d.rbd != null ? <code>{d.rbd}</code> : <span style={{ color: 'var(--text-muted)' }}>-</span>}</td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.nom_rbd}>{d.nom_rbd}</td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `${col}20`, color: col, padding: '2px 10px', borderRadius: 999, fontSize: '0.78rem', fontWeight: 600 }}>
                          {RIESGO_ICON[d.nivel_riesgo]} {d.nivel_riesgo}
                        </span>
                      </td>
                      <td>
                        {d.ratio_pct != null ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 70, height: 6, borderRadius: 3, background: 'var(--line-subtle)', overflow: 'hidden' }}>
                              <div style={{ width: `${Math.min(Number(d.ratio_pct) / 150 * 100, 100)}%`, height: '100%', background: col, borderRadius: 3 }} />
                            </div>
                            <strong style={{ color: col }}>{Number(d.ratio_pct).toFixed(1)}%</strong>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>N/A</span>
                        )}
                      </td>
                      <td>{fmtAmt(d.gasto_rem)}</td>
                      <td>{fmtAmt(d.ingreso_total)}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
