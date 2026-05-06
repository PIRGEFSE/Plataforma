import { useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import api from '../../lib/api'
import { fmtMoneda, fmtMM, fmtMonedaCorto, fmtN } from '../../lib/format'
import HHIFuentes from './HHIFuentes'

// ── Sub-tabs ──────────────────────────────────────────────────────────────
const SUB_TABS = [
  { id: 'acreditacion', label: 'Acreditación de Saldos',    icon: '📋' },
  { id: 'hhi',          label: 'HHI de Fuentes de Ingreso', icon: '📈' },
]

// ── Paleta de niveles de riesgo (Acreditación de Saldos) ─────────────────
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

function riesgoGlobal(pct) {
  if (pct >= 90) return RIESGO_COLOR['Riesgo Bajo']
  if (pct >= 70) return RIESGO_COLOR['Riesgo Medio']
  if (pct >= 40) return RIESGO_COLOR['Riesgo Alto']
  return RIESGO_COLOR['Riesgo Crítico']
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

// ── Panel Acreditación de Saldos ─────────────────────────────────────────
function AcreditacionSaldos({ periodo }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const p = periodo ? `?periodo=${periodo}` : ''
    api.get(`/dashboard/acreditacion-saldos${p}`)
      .then(r => setData(r.data))
      .finally(() => setLoading(false))
  }, [periodo])

  if (loading) return <div className="loading-area"><div className="spinner" /></div>
  if (!data)   return null

  const anios = [...new Set(data.por_riesgo.map(d => d.periodo))].sort()
  const colorGlobal = riesgoGlobal(data.pct_rendido)

  const gaugeOption = {
    series: [{
      type: 'gauge', startAngle: 200, endAngle: -20, min: 0, max: 100, splitNumber: 4,
      radius: '90%',
      axisLine: { lineStyle: { width: 20, color: [
        [0.40, RIESGO_COLOR['Riesgo Crítico']], [0.70, RIESGO_COLOR['Riesgo Alto']],
        [0.90, RIESGO_COLOR['Riesgo Medio']], [1.00, RIESGO_COLOR['Riesgo Bajo']],
      ] } },
      pointer: { itemStyle: { color: 'auto' }, length: '60%', width: 6 },
      axisTick: { show: false },
      splitLine: { length: 14, lineStyle: { color: 'auto', width: 2 } },
      axisLabel: { color: '#94a3b8', fontSize: 11, formatter: v => `${v}%` },
      title: { offsetCenter: [0, '78%'], color: '#94a3b8', fontSize: 14 },
      detail: { valueAnimation: true, formatter: v => `${v.toFixed(1)}%\nRendido`, color: colorGlobal, fontSize: 22, fontWeight: 700, offsetCenter: [0, '38%'] },
      data: [{ value: data.pct_rendido, name: 'Tasa de Rendición Global' }],
    }],
    backgroundColor: 'transparent',
  }

  const pieOption = {
    tooltip: {
      trigger: 'item',
      formatter: p => `${p.name}<br/>${fmtN(p.value)} registros (${p.percent}%)<br/>${fmtMM(data.global.find(g => g.estado_norm === p.name)?.monto_total ?? 0)}`,
      backgroundColor: '#1e293b', borderColor: '#334155', textStyle: { color: '#f1f5f9' },
    },
    legend: { orient: 'vertical', right: 10, top: 'center', textStyle: { color: '#94a3b8' } },
    series: [{
      type: 'pie', radius: ['42%', '72%'], center: ['40%', '50%'],
      data: [
        { name: 'Rendido',    value: data.n_rendido,    itemStyle: { color: '#10b981' } },
        { name: 'No rendido', value: data.n_no_rendido, itemStyle: { color: '#ef4444' } },
      ],
      label: { show: true, formatter: p => `${p.percent}%`, color: '#f1f5f9', fontSize: 11 },
      emphasis: { itemStyle: { shadowBlur: 12, shadowColor: 'rgba(0,0,0,0.4)' } },
      itemStyle: { borderRadius: 6, borderColor: '#0f172a', borderWidth: 2 },
    }],
    backgroundColor: 'transparent',
  }

  const barRiesgoOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: p => `${p[0].name}<br/>${p.map(s => `${s.marker}${s.seriesName}: ${fmtN(s.value)} sostenedores`).join('<br/>')}`, backgroundColor: '#1e293b', borderColor: '#334155', textStyle: { color: '#f1f5f9' } },
    legend: { data: NIVELES, textStyle: { color: '#94a3b8' }, top: 0 },
    grid: { left: 60, right: 20, top: 50, bottom: 40 },
    xAxis: { type: 'category', data: anios, axisLabel: { color: '#94a3b8' }, axisLine: { lineStyle: { color: '#334155' } } },
    yAxis: { type: 'value', axisLabel: { color: '#94a3b8', formatter: v => fmtN(v) }, splitLine: { lineStyle: { color: '#1e293b' } } },
    series: NIVELES.map(nivel => ({
      name: nivel, type: 'bar', stack: 'riesgo', barMaxWidth: 60,
      data: anios.map(a => { const row = data.por_riesgo.find(d => d.periodo === a && d.nivel_riesgo === nivel); return row ? row.n_sostenedores : 0 }),
      itemStyle: { color: RIESGO_COLOR[nivel] }, label: { show: true, formatter: p => p.value > 0 ? fmtN(p.value) : '', color: '#fff', fontSize: 10 },
    })),
    backgroundColor: 'transparent',
  }

  const barMontoOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: p => `${p[0].name}<br/>${p.map(s => `${s.marker}${s.seriesName}: ${fmtMM(s.value)}`).join('<br/>')}`, backgroundColor: '#1e293b', borderColor: '#334155', textStyle: { color: '#f1f5f9' } },
    legend: { data: NIVELES, textStyle: { color: '#94a3b8' }, top: 0 },
    grid: { left: 110, right: 20, top: 50, bottom: 40 },
    xAxis: { type: 'category', data: anios, axisLabel: { color: '#94a3b8' }, axisLine: { lineStyle: { color: '#334155' } } },
    yAxis: { type: 'value', axisLabel: { color: '#94a3b8', formatter: v => fmtMonedaCorto(v) }, splitLine: { lineStyle: { color: '#1e293b' } } },
    series: NIVELES.map(nivel => ({
      name: nivel, type: 'bar', stack: 'monto', barMaxWidth: 60,
      data: anios.map(a => { const row = data.por_riesgo.find(d => d.periodo === a && d.nivel_riesgo === nivel); return row ? Number(row.monto_no_rendido) : 0 }),
      itemStyle: { color: RIESGO_COLOR[nivel] },
    })),
    backgroundColor: 'transparent',
  }

  return (
    <>
      <div className="kpi-grid">
        <KPICard label="Tasa de Rendición Global" value={`${data.pct_rendido.toFixed(2)}%`} icon={data.pct_rendido >= 90 ? '🟢' : data.pct_rendido >= 70 ? '🟡' : data.pct_rendido >= 40 ? '🟠' : '🔴'} color={colorGlobal} sub={`${fmtN(data.n_rendido)} de ${fmtN(data.n_total)} registros rendidos`} badge={data.pct_rendido >= 90 ? 'Riesgo Bajo' : data.pct_rendido >= 70 ? 'Riesgo Medio' : data.pct_rendido >= 40 ? 'Riesgo Alto' : 'Riesgo Crítico'} />
        <KPICard label="Registros No Rendidos" value={fmtN(data.n_no_rendido)} icon="⚠️" color="#ef4444" sub={`${data.pct_no_rendido.toFixed(2)}% del total`} badge="No Rendido" />
        <KPICard label="Monto No Rendido" value={fmtMM(data.monto_no_rendido)} icon="💸" color="#f97316" sub={`${data.monto_total > 0 ? ((data.monto_no_rendido / data.monto_total) * 100).toFixed(2) : 0}% del monto total`} badge="Exposición" />
        <KPICard label="Sostenedores en Riesgo Alto/Crítico" value={fmtN((data.sost_por_nivel['Riesgo Alto'] ?? 0) + (data.sost_por_nivel['Riesgo Crítico'] ?? 0))} icon="🔴" color="#ef4444" sub={`Medio: ${fmtN(data.sost_por_nivel['Riesgo Medio'] ?? 0)} · Bajo: ${fmtN(data.sost_por_nivel['Riesgo Bajo'] ?? 0)}`} badge="Alta Vigilancia" />
      </div>
      <div className="charts-grid-2">
        <div className="chart-card"><h3 className="chart-title">Tasa de Rendición Global</h3><ReactECharts option={gaugeOption} style={{ height: 280 }} theme="dark" /><div style={{ textAlign: 'center', marginTop: -12, fontSize: '0.8rem', color: '#64748b' }}>🟢 ≥90% Bajo · 🟡 70-89% Medio · 🟠 40-69% Alto · 🔴 &lt;40% Crítico</div></div>
        <div className="chart-card"><h3 className="chart-title">Distribución Rendido vs No Rendido</h3><ReactECharts option={pieOption} style={{ height: 280 }} theme="dark" /></div>
      </div>
      <div className="charts-grid-2">
        <div className="chart-card"><h3 className="chart-title">Sostenedores por Nivel de Riesgo y Año</h3>{anios.length === 0 ? <div className="empty-state">Sin datos</div> : <ReactECharts option={barRiesgoOption} style={{ height: 320 }} theme="dark" />}</div>
        <div className="chart-card"><h3 className="chart-title">Monto No Rendido por Nivel de Riesgo y Año (mM$)</h3>{anios.length === 0 ? <div className="empty-state">Sin datos</div> : <ReactECharts option={barMontoOption} style={{ height: 320 }} theme="dark" />}</div>
      </div>
      <div className="chart-card">
        <h3 className="chart-title">Top 20 Sostenedores con Mayor Monto No Rendido</h3>
        <div className="table-wrapper">
          <table className="data-table">
            <thead><tr><th>Sostenedor ID</th><th>Nivel de Riesgo</th><th>% Rendido</th><th>Monto No Rendido</th><th>Monto Total</th><th>Registros NR</th><th>Región</th></tr></thead>
            <tbody>
              {data.top_sostenedores.map((d, i) => (
                <tr key={`${d.sost_id}-${i}`}>
                  <td><code>{d.sost_id}</code></td>
                  <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `${RIESGO_COLOR[d.nivel_riesgo]}20`, color: RIESGO_COLOR[d.nivel_riesgo], padding: '2px 10px', borderRadius: 999, fontSize: '0.78rem', fontWeight: 600 }}>{RIESGO_ICON[d.nivel_riesgo]} {d.nivel_riesgo}</span></td>
                  <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ width: 60, height: 6, borderRadius: 3, background: '#1e293b', overflow: 'hidden' }}><div style={{ width: `${d.pct_rendido}%`, height: '100%', background: RIESGO_COLOR[d.nivel_riesgo], borderRadius: 3 }} /></div><span style={{ fontSize: '0.82rem' }}>{Number(d.pct_rendido).toFixed(1)}%</span></div></td>
                  <td style={{ color: '#ef4444', fontWeight: 600 }}>{fmtMM(d.monto_no_rendido)}</td>
                  <td>{fmtMM(d.monto_total)}</td>
                  <td>{fmtN(d.n_no_rendido)}</td>
                  <td>{d.region_rbd ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 14, paddingTop: 12, borderTop: '1px solid #1e293b', fontSize: '0.78rem', color: '#64748b' }}>
          {NIVELES.map(n => (<span key={n} style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: RIESGO_COLOR[n], display: 'inline-block' }} />{n}: {n === 'Riesgo Bajo' ? '≥90%' : n === 'Riesgo Medio' ? '70-89%' : n === 'Riesgo Alto' ? '40-69%' : '<40%'} rendido</span>))}
        </div>
      </div>
    </>
  )
}

// ── Contenedor principal con sub-navegación ───────────────────────────────
export default function SostenibilidadRiesgo() {
  const [subTab, setSubTab] = useState('acreditacion')
  const [periodos, setPeriodos] = useState([])
  const [periodo, setPeriodo] = useState('')

  useEffect(() => { api.get('/dashboard/filtros/periodos').then(r => setPeriodos(r.data)) }, [])

  return (
    <div className="tab-page">
      <div className="tab-header">
        <div>
          <h2 className="tab-title">Dimensión: Sostenibilidad y Riesgo Financiero</h2>
          <p className="tab-subtitle">Análisis de riesgo en rendición de cuentas y concentración de fuentes de financiamiento</p>
        </div>
        <select className="filter-select" value={periodo} onChange={e => setPeriodo(e.target.value)}>
          <option value="">Todos los períodos</option>
          {periodos.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Sub-navegación interna */}
      <div className="sub-tab-nav">
        {SUB_TABS.map(t => (
          <button key={t.id} className={`sub-tab-btn ${subTab === t.id ? 'active' : ''}`} onClick={() => setSubTab(t.id)}>
            <span>{t.icon}</span><span>{t.label}</span>
          </button>
        ))}
      </div>

      <div className="sub-tab-content">
        {subTab === 'acreditacion' && <AcreditacionSaldos periodo={periodo} />}
        {subTab === 'hhi'          && <HHIFuentes periodos={periodos} periodo={periodo} />}
      </div>
    </div>
  )
}
