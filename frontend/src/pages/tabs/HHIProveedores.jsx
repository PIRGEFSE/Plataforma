import { useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import api from '../../lib/api'
import { fmtMM, fmtN } from '../../lib/format'

// ── Paleta de niveles de concentración HHI ─────────────────────────────────
const HHI_COLOR = {
  'Concentracion Baja':     '#10b981',
  'Concentracion Moderada': '#f59e0b',
  'Concentracion Alta':     '#ef4444',
}
const HHI_ICON = {
  'Concentracion Baja':     '🟢',
  'Concentracion Moderada': '🟡',
  'Concentracion Alta':     '🔴',
}
const NIVELES = ['Concentracion Baja', 'Concentracion Moderada', 'Concentracion Alta']

const PROV_COLORS = [
  '#2563eb', '#059669', '#d97706', '#0ea5e9', '#7c3aed',
  '#dc2626', '#0891b2', '#ca8a04', '#16a34a', '#9333ea',
  '#be185d', '#0284c7', '#b45309', '#047857', '#6d28d9',
]
function getProvColor(idx) {
  return PROV_COLORS[idx % PROV_COLORS.length]
}

function hHILabel(hhi) {
  if (hhi < 1500) return { label: 'Bajo',     color: '#059669', icon: '🟢' }
  if (hhi < 2500) return { label: 'Moderado', color: '#d97706', icon: '🟡' }
  return             { label: 'Alto',     color: '#dc2626', icon: '🔴' }
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

export default function HHIProveedores({ periodo }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const p = periodo ? `?periodo=${periodo}` : ''
    api.get(`/dashboard/hhi-proveedores${p}`)
      .then(r => setData(r.data))
      .finally(() => setLoading(false))
  }, [periodo])

  if (loading) return <div className="loading-area"><div className="spinner" /></div>
  if (!data)   return null

  const anios = [...new Set(data.por_nivel.map(d => d.periodo))].sort()
  const hLabel = hHILabel(data.avg_hhi)

  const pieProvOpt = {
    tooltip: {
      trigger: 'item',
      formatter: p => `<b>${p.name}</b><br/>${fmtMM(p.value)}<br/><b>${p.percent}%</b> del gasto total`,
      backgroundColor: '#1e293b', borderColor: '#334155', textStyle: { color: '#f1f5f9' },
    },
    legend: { orient: 'vertical', right: 10, top: 'center', textStyle: { color: '#94a3b8', fontSize: 11 }, type: 'scroll' },
    series: [{
      type: 'pie', radius: ['40%', '70%'], center: ['38%', '50%'],
      data: data.proveedores.slice(0, 12).map((p, i) => ({
        name: p.rut_documento,
        value: Number(p.monto_total),
        itemStyle: { color: getProvColor(i) },
      })),
      label: { show: true, formatter: p => p.percent > 3 ? `${p.percent}%` : '', fontSize: 10, color: '#f1f5f9' },
      emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.4)' } },
      itemStyle: { borderRadius: 4, borderColor: '#0f172a', borderWidth: 1 },
    }],
    backgroundColor: 'transparent',
  }

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

  const lineHHIOpt = {
    tooltip: {
      trigger: 'axis',
      formatter: p => `${p[0].name}<br/>HHI Promedio: <b>${Number(p[0].value).toFixed(0)}</b>`,
      backgroundColor: '#1e293b', borderColor: '#334155', textStyle: { color: '#f1f5f9' },
    },
    grid: { left: 60, right: 20, top: 30, bottom: 40 },
    xAxis: { type: 'category', data: anios, axisLabel: { color: '#94a3b8' }, axisLine: { lineStyle: { color: '#334155' } } },
    yAxis: {
      type: 'value', min: 0, max: 10000,
      axisLabel: { color: '#94a3b8', formatter: v => fmtN(v) },
      splitLine: { lineStyle: { color: '#1e293b' } },
    },
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
      lineStyle: { color: '#7c3aed', width: 3 },
      itemStyle: { color: '#7c3aed' },
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#7c3aed38' }, { offset: 1, color: 'transparent' }] } },
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
      <div className="kpi-grid">
        <KPICard
          label="HHI Promedio Global de Proveedores"
          value={fmtN(Math.round(data.avg_hhi))}
          icon={hLabel.icon}
          color={hLabel.color}
          sub="Escala 0 – 10.000 (menor es más diversificado)"
          badge={hLabel.label}
        />
        <KPICard
          label="Sostenedores c/ Alta Concentración"
          value={fmtN(data.sost_alta)}
          icon="🔴"
          color="#ef4444"
          sub="HHI > 2.500 — alta dependencia de pocos proveedores"
          badge="Riesgo Alto"
        />
        <KPICard
          label="Total Sostenedores Analizados"
          value={fmtN(data.total_sost)}
          icon="🏢"
          color="#2563eb"
          sub="Sostenedores con gastos registrados"
          badge="Universo"
        />
        <KPICard
          label="Proveedores Únicos Identificados"
          value={fmtN(data.proveedores.length)}
          icon="🏪"
          color="#10b981"
          sub="RUT de proveedores con documentos registrados"
          badge="Proveedores"
        />
      </div>

      <div className="alert-info" style={{ padding: '10px 16px', borderRadius: 10, fontSize: '0.82rem', marginBottom: 12 }}>
        ℹ️ <strong>Metodología HHI de Proveedores:</strong> HHI = Σ(pct_i²) en escala 0-10.000, donde pct_i es la participación porcentual del proveedor i en el gasto total del sostenedor.
        <span style={{ marginLeft: 12 }}>🟢 &lt;1.500 Baja concentración</span>
        <span style={{ marginLeft: 10 }}>🟡 1.500-2.500 Moderada</span>
        <span style={{ marginLeft: 10 }}>🔴 &gt;2.500 Alta — alta dependencia de pocos proveedores</span>
      </div>

      <div className="charts-grid-2">
        <div className="chart-card">
          <h3 className="chart-title">Distribución Global de Gasto por Proveedor (Top 12)</h3>
          <ReactECharts option={pieProvOpt} style={{ height: 360 }} theme="dark" />
        </div>
        <div className="chart-card">
          <h3 className="chart-title">HHI Promedio Ponderado por Año</h3>
          <ReactECharts option={lineHHIOpt} style={{ height: 360 }} theme="dark" />
        </div>
        <div className="chart-card" style={{ gridColumn: '1 / -1' }}>
          <h3 className="chart-title">Sostenedores por Nivel de Concentración en Proveedores y Año</h3>
          {anios.length === 0
            ? <div className="empty-state">Sin datos para el período</div>
            : <ReactECharts option={barNivelOpt} style={{ height: 320 }} theme="dark" />}
        </div>
      </div>

      <div className="chart-card">
        <h3 className="chart-title">Top Proveedores por Monto Total de Gasto</h3>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>RUT Proveedor</th>
                <th>Nombre / Razón Social</th>
                <th>Monto Total</th>
                <th>% del Total</th>
                <th>N° Sostenedores</th>
                <th>N° Documentos</th>
              </tr>
            </thead>
            <tbody>
              {data.proveedores.map((p, i) => (
                <tr key={p.rut_documento}>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{i + 1}</td>
                  <td><code style={{ fontSize: '0.82rem' }}>{p.rut_documento}</code></td>
                  <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: getProvColor(i), marginRight: 8 }} />
                    {p.nombre_prov ?? '—'}
                  </td>
                  <td style={{ color: '#7c3aed', fontWeight: 600 }}>{fmtMM(p.monto_total)}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 80, height: 6, borderRadius: 3, background: 'var(--surface-overlay)', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(Number(p.pct_participacion_global), 100)}%`, height: '100%', background: getProvColor(i), borderRadius: 3 }} />
                      </div>
                      <strong style={{ color: getProvColor(i) }}>
                        {Number(p.pct_participacion_global).toFixed(1)}%
                      </strong>
                    </div>
                  </td>
                  <td>{fmtN(p.n_sostenedores)}</td>
                  <td>{fmtN(p.n_documentos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="chart-card">
        <h3 className="chart-title">Top 20 Sostenedores con Mayor Concentración en Proveedores</h3>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Sostenedor ID</th>
                <th>HHI</th>
                <th>Concentración</th>
                <th>N° Proveedores</th>
                <th>RUT P. Principal</th>
                <th>Nombre P. Principal</th>
                <th>% P. Principal</th>
                <th>Monto Total</th>
              </tr>
            </thead>
            <tbody>
              {data.top_sost.map((d, i) => {
                const col = HHI_COLOR[d.nivel_concentracion] ?? '#94a3b8'
                return (
                  <tr key={`${d.sost_id}-${i}`}>
                    <td><code>{d.sost_id}</code></td>
                    <td><strong style={{ color: col, fontSize: '1rem' }}>{fmtN(Math.round(Number(d.hhi)))}</strong></td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: col, fontSize: '0.8rem', fontWeight: 600 }}>
                        {HHI_ICON[d.nivel_concentracion]} {d.nivel_concentracion}
                      </span>
                    </td>
                    <td>{fmtN(d.n_proveedores)}</td>
                    <td><code style={{ fontSize: '0.8rem' }}>{d.prov_principal ?? '—'}</code></td>
                    <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.nombre_prov_principal ?? '—'}
                    </td>
                    <td>{d.pct_prov_principal != null ? `${Number(d.pct_prov_principal).toFixed(1)}%` : '—'}</td>
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
