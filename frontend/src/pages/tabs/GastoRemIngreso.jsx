import { useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import api from '../../lib/api'
import { fmtMM, fmtMonedaCorto, fmtN } from '../../lib/format'

// ── Paleta de niveles de riesgo ───────────────────────────────────────────
const RIESGO_COLOR = {
  'Riesgo Bajo':    '#10b981',
  'Riesgo Medio':   '#f59e0b',
  'Riesgo Alto':    '#f97316',
  'Riesgo Crítico': '#ef4444',
}
const RIESGO_ICON = {
  'Riesgo Bajo':    '🟢',
  'Riesgo Medio':   '🟡',
  'Riesgo Alto':    '🟠',
  'Riesgo Crítico': '🔴',
}
const NIVELES = ['Riesgo Bajo', 'Riesgo Medio', 'Riesgo Alto', 'Riesgo Crítico']

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

export default function GastoRemIngreso({ periodo }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const p = periodo ? `?periodo=${periodo}` : ''
    api.get(`/dashboard/gasto-rem-ingreso${p}`)
      .then(r => setData(r.data))
      .finally(() => setLoading(false))
  }, [periodo])

  if (loading) return <div className="loading-area"><div className="spinner" /></div>
  if (!data)   return null

  const anios = [...new Set(data.por_nivel.map(d => d.periodo))].sort()
  const rl = ratioLabel(data.ratio_global)

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
      axisLabel: { color: '#94a3b8', fontSize: 11, formatter: v => `${v}%` },
      title: { offsetCenter: [0, '78%'], color: '#94a3b8', fontSize: 13 },
      detail: {
        valueAnimation: true,
        formatter: v => `${v.toFixed(1)}%\nRem/Ingreso`,
        color: rl.color, fontSize: 22, fontWeight: 700, offsetCenter: [0, '38%'],
      },
      data: [{ value: Math.min(data.ratio_global, 150), name: 'Ratio Global' }],
    }],
    backgroundColor: 'transparent',
  }

  // ── Barras apiladas: sostenedores por nivel de riesgo por año ─────────────
  const barNivelOpt = {
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' },
      formatter: p => `${p[0].name}<br/>${p.map(s => `${s.marker}${s.seriesName}: ${fmtN(s.value)} sost.`).join('<br/>')}`,
      backgroundColor: '#1e293b', borderColor: '#334155', textStyle: { color: '#f1f5f9' },
    },
    legend: { data: NIVELES, textStyle: { color: '#94a3b8' }, top: 0 },
    grid: { left: 60, right: 20, top: 50, bottom: 40 },
    xAxis: { type: 'category', data: anios, axisLabel: { color: '#94a3b8' }, axisLine: { lineStyle: { color: '#334155' } } },
    yAxis: { type: 'value', axisLabel: { color: '#94a3b8', formatter: v => fmtN(v) }, splitLine: { lineStyle: { color: '#1e293b' } } },
    series: NIVELES.map(n => ({
      name: n, type: 'bar', stack: 'nivel', barMaxWidth: 60,
      data: anios.map(a => { const r = data.por_nivel.find(d => d.periodo === a && d.nivel_riesgo === n); return r ? r.n_sostenedores : 0 }),
      itemStyle: { color: RIESGO_COLOR[n] },
      label: { show: true, formatter: p => p.value > 0 ? fmtN(p.value) : '', color: '#fff', fontSize: 10 },
    })),
    backgroundColor: 'transparent',
  }

  // ── Línea: ratio promedio por año ─────────────────────────────────────────
  const lineRatioOpt = {
    tooltip: {
      trigger: 'axis',
      formatter: p => `${p[0].name}<br/>Ratio Prom.: <b>${Number(p[0].value).toFixed(1)}%</b>`,
      backgroundColor: '#1e293b', borderColor: '#334155', textStyle: { color: '#f1f5f9' },
    },
    grid: { left: 60, right: 20, top: 30, bottom: 40 },
    xAxis: { type: 'category', data: anios, axisLabel: { color: '#94a3b8' }, axisLine: { lineStyle: { color: '#334155' } } },
    yAxis: { type: 'value', min: 0, max: 150, axisLabel: { color: '#94a3b8', formatter: v => `${v}%` }, splitLine: { lineStyle: { color: '#1e293b' } } },
    series: [{
      type: 'line', smooth: true, symbol: 'circle', symbolSize: 8,
      data: anios.map(a => {
        const rows = data.por_nivel.filter(d => d.periodo === a)
        const tot = rows.reduce((s, r) => s + r.n_sostenedores, 0)
        return tot > 0
          ? rows.reduce((s, r) => s + Number(r.avg_ratio || 0) * r.n_sostenedores / tot, 0)
          : null
      }),
      lineStyle: { color: '#6366f1', width: 3 },
      itemStyle: { color: '#6366f1' },
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#6366f140' }, { offset: 1, color: 'transparent' }] } },
      markLine: {
        silent: true,
        data: [
          { yAxis: 70, lineStyle: { color: '#10b981', type: 'dashed' }, label: { formatter: '70%', color: '#10b981', fontSize: 10 } },
          { yAxis: 85, lineStyle: { color: '#f59e0b', type: 'dashed' }, label: { formatter: '85%', color: '#f59e0b', fontSize: 10 } },
          { yAxis: 95, lineStyle: { color: '#ef4444', type: 'dashed' }, label: { formatter: '95%', color: '#ef4444', fontSize: 10 } },
        ],
      },
      label: { show: true, formatter: p => p.value != null ? `${Number(p.value).toFixed(1)}%` : '', color: '#94a3b8', fontSize: 10 },
    }],
    backgroundColor: 'transparent',
  }

  // ── Barras: Gasto Rem vs Ingreso por año (mM$) ────────────────────────────
  const barCompOpt = {
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' },
      formatter: p => `${p[0].name}<br/>${p.map(s => `${s.marker}${s.seriesName}: ${fmtMM(s.value)}`).join('<br/>')}`,
      backgroundColor: '#1e293b', borderColor: '#334155', textStyle: { color: '#f1f5f9' },
    },
    legend: { data: ['Gasto Remuneracional', 'Ingreso Depurado'], textStyle: { color: '#94a3b8' }, top: 0 },
    grid: { left: 110, right: 20, top: 50, bottom: 40 },
    xAxis: { type: 'category', data: anios, axisLabel: { color: '#94a3b8' }, axisLine: { lineStyle: { color: '#334155' } } },
    yAxis: { type: 'value', axisLabel: { color: '#94a3b8', formatter: v => fmtMonedaCorto(v) }, splitLine: { lineStyle: { color: '#1e293b' } } },
    series: [
      {
        name: 'Gasto Remuneracional', type: 'bar', barGap: '5%', barMaxWidth: 50,
        data: anios.map(a => { const rows = data.por_nivel.filter(d => d.periodo === a); return rows.reduce((s, r) => s + Number(r.total_gasto_rem || 0), 0) }),
        itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#ef4444' }, { offset: 1, color: '#991b1b' }] } },
        label: { show: true, position: 'top', formatter: p => fmtMM(p.value), color: '#94a3b8', fontSize: 10 },
      },
      {
        name: 'Ingreso Depurado', type: 'bar', barMaxWidth: 50,
        data: anios.map(a => { const rows = data.por_nivel.filter(d => d.periodo === a); return rows.reduce((s, r) => s + Number(r.total_ingreso || 0), 0) }),
        itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#6366f1' }, { offset: 1, color: '#4338ca' }] } },
        label: { show: true, position: 'top', formatter: p => fmtMM(p.value), color: '#94a3b8', fontSize: 10 },
      },
    ],
    backgroundColor: 'transparent',
  }

  return (
    <>
      {/* Nota metodológica */}
      <div className="alert-info" style={{ padding: '10px 16px', borderRadius: 10, fontSize: '0.82rem', marginBottom: 12 }}>
        ℹ️ <strong>Metodología:</strong> Ratio = Gasto Remuneracional / Ingreso Depurado × 100.
        La nómina proviene de la tabla <code>remuneraciones</code> (cuentas 2024); el ingreso de <code>estado_resultado</code> filtrado por registros RENDIDO.
        <span className="kpi-badge" style={{ marginLeft: 10, background: '#10b98120', color: '#10b981' }}>🟢 &lt;70% Bajo</span>
        <span className="kpi-badge" style={{ marginLeft: 6, background: '#f59e0b20', color: '#f59e0b' }}>🟡 70-84% Medio</span>
        <span className="kpi-badge" style={{ marginLeft: 6, background: '#f9731620', color: '#f97316' }}>🟠 85-94% Alto</span>
        <span className="kpi-badge" style={{ marginLeft: 6, background: '#ef444420', color: '#ef4444' }}>🔴 ≥95% Crítico</span>
      </div>

      {/* KPIs */}
      <div className="kpi-grid">
        <KPICard label="Ratio Gasto Rem / Ingreso" value={`${data.ratio_global.toFixed(1)}%`} icon={rl.icon} color={rl.color} sub={`Promedio sostenedores: ${data.avg_ratio.toFixed(1)}%`} badge={rl.label} />
        <KPICard label="Sostenedores en Riesgo Alto/Crítico" value={fmtN(data.sost_alto_crit)} icon="🔴" color="#ef4444" sub={`de ${fmtN(data.total_sost)} sostenedores analizados`} badge="Alta Vigilancia" />
        <KPICard label="Total Gasto Remuneracional" value={fmtMM(data.total_rem)} icon="👥" color="#ef4444" sub="Nómina según cuentas 2024 (ref.)" badge="Nómina" />
        <KPICard label="Total Ingreso Depurado" value={fmtMM(data.total_ingreso)} icon="💰" color="#6366f1" sub="Ingresos rendidos en estado_resultado" badge="Ingreso" />
      </div>

      {/* Gráficos */}
      <div className="charts-grid-2">
        <div className="chart-card">
          <h3 className="chart-title">Ratio Global Gasto Rem / Ingreso</h3>
          <ReactECharts option={gaugeOpt} style={{ height: 280 }} theme="dark" />
          <div style={{ textAlign: 'center', marginTop: -12, fontSize: '0.78rem', color: '#64748b' }}>
            Escala 0–150% · Umbral crítico en 95%
          </div>
        </div>
        <div className="chart-card">
          <h3 className="chart-title">Ratio Promedio por Año</h3>
          <ReactECharts option={lineRatioOpt} style={{ height: 280 }} theme="dark" />
        </div>
        <div className="chart-card">
          <h3 className="chart-title">Sostenedores por Nivel de Riesgo y Año</h3>
          {anios.length === 0 ? <div className="empty-state">Sin datos</div> : <ReactECharts option={barNivelOpt} style={{ height: 320 }} theme="dark" />}
        </div>
        <div className="chart-card">
          <h3 className="chart-title">Gasto Remuneracional vs Ingreso Depurado por Año (mM$)</h3>
          {anios.length === 0 ? <div className="empty-state">Sin datos</div> : <ReactECharts option={barCompOpt} style={{ height: 320 }} theme="dark" />}
        </div>
      </div>

      {/* Tabla top 20 */}
      <div className="chart-card">
        <h3 className="chart-title">Top 20 Sostenedores con Mayor Ratio Gasto Rem / Ingreso</h3>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr><th>Sostenedor ID</th><th>Nivel de Riesgo</th><th>Ratio (%)</th><th>Gasto Rem.</th><th>Ingreso Depurado</th></tr>
            </thead>
            <tbody>
              {data.top_sost.map((d, i) => {
                const col = RIESGO_COLOR[d.nivel_riesgo] ?? '#94a3b8'
                return (
                  <tr key={`${d.sost_id}-${i}`}>
                    <td><code>{d.sost_id}</code></td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `${col}20`, color: col, padding: '2px 10px', borderRadius: 999, fontSize: '0.78rem', fontWeight: 600 }}>
                        {RIESGO_ICON[d.nivel_riesgo]} {d.nivel_riesgo}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 70, height: 6, borderRadius: 3, background: '#1e293b', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(Number(d.ratio_pct) / 150 * 100, 100)}%`, height: '100%', background: col, borderRadius: 3 }} />
                        </div>
                        <strong style={{ color: col }}>{Number(d.ratio_pct).toFixed(1)}%</strong>
                      </div>
                    </td>
                    <td>{fmtMM(d.gasto_rem)}</td>
                    <td>{fmtMM(d.ingreso_total)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
