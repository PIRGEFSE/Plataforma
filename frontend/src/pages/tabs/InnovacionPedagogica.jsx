import { useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import api from '../../lib/api'
import { fmtMoneda, fmtMM, fmtMonedaCorto, fmtN } from '../../lib/format'

// Semáforo para el % de innovación pedagógica sobre el gasto total
function innovSemaforo(pct) {
  if (pct >= 5)  return { color: '#10b981', label: 'Destacado', icon: '🟢' }
  if (pct >= 2)  return { color: '#f59e0b', label: 'Moderado',  icon: '🟡' }
  return           { color: '#ef4444', label: 'Bajo',      icon: '🔴' }
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

const CUENTA_LABEL = {
  '410500': 'Perfeccionamiento y Capacitación Docente (410500)',
  '410600': 'Apoyo Técnico Pedagógico (410600)',
  '410700': 'Material Didáctico y Recursos (410700)',
}

export default function InnovacionPedagogica({ periodos, periodo }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const p = periodo ? `?periodo=${periodo}` : ''
    api.get(`/dashboard/innovacion-pedagogica${p}`)
      .then(r => setData(r.data))
      .finally(() => setLoading(false))
  }, [periodo])

  if (loading) return <div className="loading-area"><div className="spinner" /></div>
  if (!data)   return null

  const semaforo = innovSemaforo(data.pct_sobre_total)
  const anios    = data.serie.map(d => d.periodo)

  // ── Barras dobles: % sobre total y % sobre no remuneracional por año ──────
  const barPctOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: p => `${p[0].name}<br/>${p.map(s => `${s.marker}${s.seriesName}: <b>${Number(s.value).toFixed(2)}%</b>`).join('<br/>')}`,
      backgroundColor: '#1e293b', borderColor: '#334155', textStyle: { color: '#f1f5f9' },
    },
    legend: { data: ['% s/ Gasto Total', '% s/ Gasto No Remuneracional'], textStyle: { color: '#94a3b8' }, top: 0 },
    grid: { left: 60, right: 20, top: 50, bottom: 40 },
    xAxis: { type: 'category', data: anios, axisLabel: { color: '#94a3b8' }, axisLine: { lineStyle: { color: '#334155' } } },
    yAxis: { type: 'value', axisLabel: { color: '#94a3b8', formatter: v => `${v}%` }, splitLine: { lineStyle: { color: '#1e293b' } } },
    series: [
      {
        name: '% s/ Gasto Total',
        type: 'bar', barGap: '5%', barMaxWidth: 45,
        data: data.serie.map(d => Number(d.pct_innovacion_total)),
        itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#6366f1' }, { offset: 1, color: '#4338ca' }] } },
        label: { show: true, position: 'top', color: '#94a3b8', formatter: p => `${Number(p.value).toFixed(1)}%` },
      },
      {
        name: '% s/ Gasto No Remuneracional',
        type: 'bar', barMaxWidth: 45,
        data: data.serie.map(d => Number(d.pct_innovacion_no_rem)),
        itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#10b981' }, { offset: 1, color: '#059669' }] } },
        label: { show: true, position: 'top', color: '#94a3b8', formatter: p => `${Number(p.value).toFixed(1)}%` },
      },
    ],
    backgroundColor: 'transparent',
  }

  // ── Barras absolutas: composición del gasto ───────────────────────────────
  const barCompOption = {
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' },
      formatter: p => `${p[0].name}<br/>${p.map(s => `${s.marker}${s.seriesName}: ${fmtMM(s.value)}`).join('<br/>')}`,
      backgroundColor: '#1e293b', borderColor: '#334155', textStyle: { color: '#f1f5f9' },
    },
    legend: { data: ['Innovación Pedagógica', 'Gasto No Rem. Otro', 'Gasto Remuneracional'], textStyle: { color: '#94a3b8' }, top: 0 },
    grid: { left: 110, right: 20, top: 50, bottom: 40 },
    xAxis: { type: 'category', data: anios, axisLabel: { color: '#94a3b8' }, axisLine: { lineStyle: { color: '#334155' } } },
    yAxis: { type: 'value', axisLabel: { color: '#94a3b8', formatter: v => fmtMonedaCorto(v) }, splitLine: { lineStyle: { color: '#1e293b' } } },
    series: [
      { name: 'Innovación Pedagógica',    type: 'bar', stack: 'g', barMaxWidth: 60, data: data.serie.map(d => d.monto_innovacion),                                     itemStyle: { color: '#6366f1' } },
      { name: 'Gasto No Rem. Otro',       type: 'bar', stack: 'g', barMaxWidth: 60, data: data.serie.map(d => Math.max(0, d.gasto_no_remuneracional - d.monto_innovacion)), itemStyle: { color: '#06b6d4' } },
      { name: 'Gasto Remuneracional',     type: 'bar', stack: 'g', barMaxWidth: 60, data: data.serie.map(d => d.gasto_remuneracional),                                  itemStyle: { color: '#94a3b8' } },
    ],
    backgroundColor: 'transparent',
  }

  return (
    <>
      {/* KPIs principales */}
      <div className="kpi-grid">
        <KPICard
          label="% Gasto en Innovación / Total Gasto"
          value={`${data.pct_sobre_total.toFixed(2)}%`}
          icon={semaforo.icon}
          color={semaforo.color}
          sub={fmtMoneda(data.total_innovacion)}
          badge={semaforo.label}
        />
        <KPICard
          label="% Innovación / Gasto No Remuneracional"
          value={`${data.pct_sobre_no_rem.toFixed(2)}%`}
          icon="🎯"
          color="#6366f1"
          sub={`No rem.: ${fmtMM(data.total_no_rem)}`}
          badge="No Rem."
        />
        <KPICard
          label="Gasto Remuneracional"
          value={fmtMM(data.total_rem)}
          icon="👥"
          color="#94a3b8"
          sub={`${data.total_gasto > 0 ? ((data.total_rem / data.total_gasto) * 100).toFixed(1) : 0}% del total`}
          badge="Nómina"
        />
        <KPICard
          label="Total Gasto (base de cálculo)"
          value={fmtMM(data.total_gasto)}
          icon="📊"
          color="#f59e0b"
          sub="Gastos 410xx + 411xx + 700xx"
          badge="Total"
        />
      </div>

      {/* Advertencia sobre la clasificación multi-año */}
      <div className="alert-info" style={{ padding: '10px 16px', borderRadius: 10, fontSize: '0.82rem', marginBottom: 12 }}>
        ℹ️ <strong>Nota metodológica:</strong> Las cuentas remuneracionales corresponden a la lista oficial del año 2024. Para otros años, la clasificación es aproximada hasta que se cuente con los mapeos definitivos de esa vigencia.
      </div>

      {/* Gráficos */}
      <div className="charts-grid-2">
        <div className="chart-card" style={{ gridColumn: '1 / -1' }}>
          <h3 className="chart-title">% Gasto en Innovación Pedagógica por Año</h3>
          {anios.length === 0
            ? <div className="empty-state">No hay datos para el período seleccionado</div>
            : <ReactECharts option={barPctOption} style={{ height: 320 }} theme="dark" />}
        </div>

        <div className="chart-card" style={{ gridColumn: '1 / -1' }}>
          <h3 className="chart-title">Composición del Gasto por Año (mM$)</h3>
          {anios.length === 0
            ? <div className="empty-state">No hay datos para el período seleccionado</div>
            : <ReactECharts option={barCompOption} style={{ height: 320 }} theme="dark" />}
        </div>
      </div>

      {/* Desglose de cuentas de innovación */}
      <div className="chart-card">
        <h3 className="chart-title">Detalle de Cuentas de Innovación Pedagógica</h3>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Cuenta</th>
                <th>Descripción</th>
                <th>Monto Total</th>
                <th>% s/ Total Gasto</th>
                <th>Establecimientos</th>
              </tr>
            </thead>
            <tbody>
              {data.detalle_innovacion.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: '#64748b' }}>Sin datos de cuentas de innovación</td></tr>
              ) : data.detalle_innovacion.map(d => (
                <tr key={d.cuenta_alias}>
                  <td><code style={{ color: '#6366f1' }}>{d.cuenta_alias}</code></td>
                  <td>{CUENTA_LABEL[d.cuenta_alias] ?? d.cuenta_alias}</td>
                  <td>{fmtMM(d.monto_total)}</td>
                  <td>
                    <strong style={{ color: '#6366f1' }}>
                      {data.total_gasto > 0 ? `${(Number(d.monto_total) / data.total_gasto * 100).toFixed(3)}%` : '—'}
                    </strong>
                  </td>
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
