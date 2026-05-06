import { useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import api from '../../lib/api'
import { fmtMM, fmtMonedaCorto, fmtN } from '../../lib/format'

// ── Paleta de niveles de concentración HHI ───────────────────────────────
const HHI_COLOR = {
  'Concentración Baja':     '#10b981',
  'Concentración Moderada': '#f59e0b',
  'Concentración Alta':     '#ef4444',
}
const HHI_ICON = {
  'Concentración Baja':     '🟢',
  'Concentración Moderada': '🟡',
  'Concentración Alta':     '🔴',
}
const NIVELES = ['Concentración Baja', 'Concentración Moderada', 'Concentración Alta']

// Colores para las fuentes de ingreso (los más comunes tienen color fijo)
const FUENTE_COLOR = {
  GENERAL:       '#6366f1',
  SEP:           '#10b981',
  PIE:           '#f59e0b',
  ACG:           '#06b6d4',
  MANTENIMIENTO: '#8b5cf6',
  PRORETENCION:  '#ec4899',
  INTERNADO:     '#14b8a6',
  AC:            '#f97316',
}
const FUENTE_COLOR_DEFAULT = ['#84cc16','#a78bfa','#fb923c','#38bdf8','#fb7185']

function getFuenteColor(alias, idx) {
  return FUENTE_COLOR[alias] ?? FUENTE_COLOR_DEFAULT[idx % FUENTE_COLOR_DEFAULT.length]
}

function hHILabel(hhi) {
  if (hhi < 1500) return { label: 'Bajo', color: '#10b981', icon: '🟢' }
  if (hhi < 2500) return { label: 'Moderado', color: '#f59e0b', icon: '🟡' }
  return { label: 'Alto', color: '#ef4444', icon: '🔴' }
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

export default function HHIFuentes({ periodo }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const p = periodo ? `?periodo=${periodo}` : ''
    api.get(`/dashboard/hhi-fuentes${p}`)
      .then(r => setData(r.data))
      .finally(() => setLoading(false))
  }, [periodo])

  if (loading) return <div className="loading-area"><div className="spinner" /></div>
  if (!data)   return null

  const anios = [...new Set(data.por_nivel.map(d => d.periodo))].sort()
  const hLabel = hHILabel(data.avg_hhi)

  // ── Torta de distribución global de fuentes ──────────────────────────────
  const pieFuentesOpt = {
    tooltip: {
      trigger: 'item',
      formatter: p => `${p.name}<br/>${fmtMM(p.value)}<br/><b>${p.percent}%</b> del ingreso total`,
      backgroundColor: '#1e293b', borderColor: '#334155', textStyle: { color: '#f1f5f9' },
    },
    legend: { orient: 'vertical', right: 10, top: 'center', textStyle: { color: '#94a3b8', fontSize: 11 } },
    series: [{
      type: 'pie', radius: ['40%', '70%'], center: ['38%', '50%'],
      data: data.fuentes.map((f, i) => ({
        name: f.subvencion_alias,
        value: Number(f.monto_total),
        itemStyle: { color: getFuenteColor(f.subvencion_alias, i) },
      })),
      label: { show: true, formatter: p => p.percent > 3 ? `${p.percent}%` : '', fontSize: 10, color: '#f1f5f9' },
      emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.4)' } },
      itemStyle: { borderRadius: 4, borderColor: '#0f172a', borderWidth: 1 },
    }],
    backgroundColor: 'transparent',
  }

  // ── Barras: sostenedores por nivel de concentración por año ─────────────
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
      data: anios.map(a => {
        const row = data.por_nivel.find(d => d.periodo === a && d.nivel_concentracion === n)
        return row ? row.n_sostenedores : 0
      }),
      itemStyle: { color: HHI_COLOR[n] },
      label: { show: true, formatter: p => p.value > 0 ? fmtN(p.value) : '', color: '#fff', fontSize: 10 },
    })),
    backgroundColor: 'transparent',
  }

  // ── Línea: HHI promedio por período ─────────────────────────────────────
  const lineHHIOpt = {
    tooltip: {
      trigger: 'axis',
      formatter: p => `${p[0].name}<br/>HHI Promedio: <b>${Number(p[0].value).toFixed(0)}</b>`,
      backgroundColor: '#1e293b', borderColor: '#334155', textStyle: { color: '#f1f5f9' },
    },
    grid: { left: 60, right: 20, top: 30, bottom: 40 },
    xAxis: { type: 'category', data: anios, axisLabel: { color: '#94a3b8' }, axisLine: { lineStyle: { color: '#334155' } } },
    yAxis: {
      type: 'value',
      min: 0, max: 10000,
      axisLabel: { color: '#94a3b8', formatter: v => fmtN(v) },
      splitLine: { lineStyle: { color: '#1e293b' } },
    },
    // Bandas de referencia como markArea
    series: [{
      type: 'line',
      data: anios.map(a => {
        const rows = data.por_nivel.filter(d => d.periodo === a)
        const totalSost = rows.reduce((s, r) => s + r.n_sostenedores, 0)
        const wmAvg = rows.reduce((s, r) => {
          const w = totalSost > 0 ? r.n_sostenedores / totalSost : 0
          return s + Number(r.avg_hhi || 0) * w
        }, 0)
        return totalSost > 0 ? wmAvg : null
      }),
      smooth: true, symbol: 'circle', symbolSize: 8,
      lineStyle: { color: '#6366f1', width: 3 },
      itemStyle: { color: '#6366f1' },
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#6366f140' }, { offset: 1, color: 'transparent' }] } },
      markLine: {
        silent: true,
        data: [
          { yAxis: 1500, lineStyle: { color: '#f59e0b', type: 'dashed' }, label: { formatter: 'HHI 1.500', color: '#f59e0b', fontSize: 10 } },
          { yAxis: 2500, lineStyle: { color: '#ef4444', type: 'dashed' }, label: { formatter: 'HHI 2.500', color: '#ef4444', fontSize: 10 } },
        ],
      },
      label: { show: true, formatter: p => p.value != null ? fmtN(Math.round(p.value)) : '', color: '#94a3b8', fontSize: 10 },
    }],
    backgroundColor: 'transparent',
  }

  return (
    <>
      {/* KPIs */}
      <div className="kpi-grid">
        <KPICard
          label="HHI Promedio Global"
          value={fmtN(Math.round(data.avg_hhi))}
          icon={hLabel.icon}
          color={hLabel.color}
          sub={`Escala 0 – 10.000 (menor es más diversificado)`}
          badge={hLabel.label}
        />
        <KPICard
          label="Sostenedores c/ Alta Concentración"
          value={fmtN(data.sost_alta)}
          icon="🔴"
          color="#ef4444"
          sub={`HHI > 2.500 — alta dependencia de pocas fuentes`}
          badge="Riesgo Alto"
        />
        <KPICard
          label="Total Sostenedores Analizados"
          value={fmtN(data.total_sost)}
          icon="🏢"
          color="#6366f1"
          sub="Sostenedores con ingresos rendidos registrados"
          badge="Universo"
        />
        <KPICard
          label="Fuentes de Ingreso Identificadas"
          value={fmtN(data.fuentes.length)}
          icon="💰"
          color="#10b981"
          sub="Tipos de subvención clasificados como ingreso"
          badge="Fuentes"
        />
      </div>

      {/* Nota metodológica */}
      <div className="alert-info" style={{ padding: '10px 16px', borderRadius: 10, fontSize: '0.82rem', marginBottom: 12 }}>
        ℹ️ <strong>Metodología HHI:</strong> HHI = Σ(pct_i²) en escala 0-10.000.
        <span style={{ marginLeft: 12 }}>🟢 &lt;1.500 Bajo</span>
        <span style={{ marginLeft: 10 }}>🟡 1.500-2.500 Moderado</span>
        <span style={{ marginLeft: 10 }}>🔴 &gt;2.500 Alto — alta vulnerabilidad financiera</span>
      </div>

      <div className="charts-grid-2">
        {/* Torta fuentes */}
        <div className="chart-card">
          <h3 className="chart-title">Distribución Global de Fuentes de Ingreso</h3>
          <ReactECharts option={pieFuentesOpt} style={{ height: 360 }} theme="dark" />
        </div>

        {/* Línea HHI promedio */}
        <div className="chart-card">
          <h3 className="chart-title">HHI Promedio Ponderado por Año</h3>
          <ReactECharts option={lineHHIOpt} style={{ height: 360 }} theme="dark" />
        </div>

        {/* Barras sostenedores */}
        <div className="chart-card" style={{ gridColumn: '1 / -1' }}>
          <h3 className="chart-title">Sostenedores por Nivel de Concentración y Año</h3>
          {anios.length === 0
            ? <div className="empty-state">Sin datos para el período</div>
            : <ReactECharts option={barNivelOpt} style={{ height: 320 }} theme="dark" />}
        </div>
      </div>

      {/* Tabla fuentes de ingreso */}
      <div className="chart-card">
        <h3 className="chart-title">Composición de Fuentes de Ingreso (Rendido)</h3>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr><th>Fuente (Subvención)</th><th>Monto Total</th><th>% del Total</th><th>Sostenedores</th></tr>
            </thead>
            <tbody>
              {data.fuentes.map((f, i) => (
                <tr key={f.subvencion_alias}>
                  <td>
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: getFuenteColor(f.subvencion_alias, i), marginRight: 8 }} />
                    {f.subvencion_alias}
                  </td>
                  <td>{fmtMM(f.monto_total)}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 80, height: 6, borderRadius: 3, background: '#1e293b', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(Number(f.pct_participacion_global), 100)}%`, height: '100%', background: getFuenteColor(f.subvencion_alias, i), borderRadius: 3 }} />
                      </div>
                      <strong style={{ color: getFuenteColor(f.subvencion_alias, i) }}>
                        {Number(f.pct_participacion_global).toFixed(1)}%
                      </strong>
                    </div>
                  </td>
                  <td>{fmtN(f.n_sostenedores)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabla top sostenedores HHI alto */}
      <div className="chart-card">
        <h3 className="chart-title">Top 20 Sostenedores con Mayor Concentración (HHI más alto)</h3>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr><th>Sostenedor ID</th><th>HHI</th><th>Concentración</th><th>N° Fuentes</th><th>Fuente Principal</th><th>% F. Principal</th><th>Monto Total</th></tr>
            </thead>
            <tbody>
              {data.top_sost.map((d, i) => {
                const col = HHI_COLOR[d.nivel_concentracion] ?? '#94a3b8'
                return (
                  <tr key={`${d.sost_id}-${i}`}>
                    <td><code>{d.sost_id}</code></td>
                    <td>
                      <strong style={{ color: col, fontSize: '1rem' }}>{fmtN(Math.round(Number(d.hhi)))}</strong>
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `${col}20`, color: col, padding: '2px 10px', borderRadius: 999, fontSize: '0.78rem', fontWeight: 600 }}>
                        {HHI_ICON[d.nivel_concentracion]} {d.nivel_concentracion}
                      </span>
                    </td>
                    <td>{Number(d.n_fuentes).toFixed(1)}</td>
                    <td>{d.fuente_principal ?? '—'}</td>
                    <td>{d.pct_fuente_principal != null ? `${Number(d.pct_fuente_principal).toFixed(1)}%` : '—'}</td>
                    <td>{fmtMM(d.monto_total)}</td>
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
