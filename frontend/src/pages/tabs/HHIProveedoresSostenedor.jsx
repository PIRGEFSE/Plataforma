import { useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import api from '../../lib/api'
import { useChartColors } from '../../hooks/useChartColors'
import { useMoneyFmt, fmtN } from '../../components/DashboardWidgets'
import { WidgetWrapper } from './FichaSostenedor'

const HHI_COLOR_MAP = {
  'Concentracion Baja':     '#059669',
  'Concentracion Moderada': '#d97706',
  'Concentracion Alta':     '#dc2626',
}

const PROV_COLORS = [
  '#2563eb', '#059669', '#d97706', '#0ea5e9', '#7c3aed',
  '#dc2626', '#0891b2', '#ca8a04', '#16a34a', '#9333ea',
  '#be185d', '#0284c7', '#b45309', '#047857', '#6d28d9',
]
function getProvColor(idx) {
  return PROV_COLORS[idx % PROV_COLORS.length]
}

function hhiLabel(hhi) {
  if (hhi < 1500) return { label: 'Concentracion Baja',     color: '#059669', icon: '🟢' }
  if (hhi < 2500) return { label: 'Concentracion Moderada', color: '#d97706', icon: '🟡' }
  return             { label: 'Concentracion Alta',     color: '#dc2626', icon: '🔴' }
}

export function RenderHHIProveedoresSostenedor({ sostId, periodo, widgetFilter = null }) {
  const { fmtAmt } = useMoneyFmt()
  const C = useChartColors()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const sid = sostId ?? 69110400

  useEffect(() => {
    setLoading(true)
    const p = periodo ? `&periodo=${periodo}` : ''
    api.get(`/dashboard/hhi-proveedores-sostenedor?sost_id=${sid}${p}`)
      .then(r => setData(r.data))
      .finally(() => setLoading(false))
  }, [sid, periodo])

  if (loading) return <div className="loading-area"><div className="spinner" /></div>
  if (!data || data.hhi_serie.length === 0)
    return (
      <div className="empty-state" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Sin datos de proveedores para este sostenedor en el período seleccionado.
      </div>
    )

  const { hhi_serie, proveedores, avg_hhi, ultimo } = data
  const anios = hhi_serie.map(d => d.periodo)
  const hLabel = hhiLabel(avg_hhi)
  const ulLabel = ultimo ? hhiLabel(Number(ultimo.hhi)) : hLabel

  // ── Torta de proveedores (último período disponible)
  const pieProvOpt = {
    aria: { decal: { show: true } },
    tooltip: {
      trigger: 'item',
      formatter: p => `<b>${p.name}</b><br/>${fmtAmt(p.value)}<br/><b>${p.percent}%</b> del gasto total`,
      backgroundColor: 'var(--surface-raised)', borderColor: 'var(--line-subtle)',
      textStyle: { color: 'var(--text-primary)' },
    },
    legend: { orient: 'vertical', right: 10, top: 'center', textStyle: { color: C.axisLabel, fontSize: 11 }, type: 'scroll' },
    series: [{
      type: 'pie', radius: ['40%', '70%'], center: ['38%', '50%'],
      data: proveedores.slice(0, 12).map((p, i) => ({
        name: p.rut_documento,
        value: Number(p.monto_total),
        itemStyle: { color: getProvColor(i) },
      })),
      label: { show: true, formatter: p => p.percent > 3 ? `${p.percent}%` : '', fontSize: 10, color: C.axisLabel },
      itemStyle: { borderRadius: 4, borderColor: 'transparent', borderWidth: 1 },
      emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.3)' } },
    }],
    backgroundColor: 'transparent',
  }

  // ── Línea: evolución del HHI por año
  const lineHHIOpt = {
    aria: { decal: { show: true } },
    tooltip: {
      trigger: 'axis',
      formatter: p => {
        const d = hhi_serie[p[0].dataIndex]
        const lbl = hhiLabel(Number(d.hhi))
        return `<b>${d.periodo}</b><br/>HHI: <b style="color:${lbl.color}">${Math.round(Number(d.hhi))}</b> — ${lbl.label}`
      },
      backgroundColor: 'var(--surface-raised)', borderColor: 'var(--line-subtle)',
      textStyle: { color: 'var(--text-primary)' },
    },
    grid: { left: 60, right: 20, top: 30, bottom: 40 },
    xAxis: { type: 'category', data: anios, axisLabel: { color: C.axisLabel }, axisLine: { lineStyle: { color: C.splitLine } } },
    yAxis: {
      type: 'value', min: 0, max: 10000,
      axisLabel: { color: C.axisLabel, formatter: v => fmtN(v) },
      splitLine: { lineStyle: { color: C.splitLine } },
    },
    series: [{
      type: 'line', smooth: true, symbol: 'circle', symbolSize: 8,
      data: hhi_serie.map(d => ({ value: Number(d.hhi), itemStyle: { color: hhiLabel(Number(d.hhi)).color } })),
      lineStyle: { color: '#7c3aed', width: 3 },
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#7c3aed38' }, { offset: 1, color: 'transparent' }] } },
      markLine: {
        silent: true, data: [
          { yAxis: 1500, lineStyle: { color: '#d97706', type: 'dashed' }, label: { formatter: 'HHI 1.500', color: '#d97706', fontSize: 10 } },
          { yAxis: 2500, lineStyle: { color: '#dc2626', type: 'dashed' }, label: { formatter: 'HHI 2.500', color: '#dc2626', fontSize: 10 } },
        ],
      },
      label: { show: true, formatter: p => p.value != null ? fmtN(Math.round(p.value)) : '', color: C.axisLabel, fontSize: 10 },
    }],
    backgroundColor: 'transparent',
  }

  // ── Early return para widget Resumen — Gráficos
  if (widgetFilter === 'sr_hhi_prov_graficos') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
        <div className="chart-card">
          <h3 className="chart-title">Distribución de Gasto por Proveedor</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '0.5rem' }}>Período {ultimo?.periodo ?? ''} — todos los documentos</p>
          <ReactECharts option={pieProvOpt} style={{ height: 320 }} />
        </div>
        <div className="chart-card">
          <h3 className="chart-title">Evolución del HHI por Año</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '0.5rem' }}>Concentración en proveedores — serie histórica</p>
          <ReactECharts option={lineHHIOpt} style={{ height: 320 }} />
        </div>
      </div>
    )
  }

  if (widgetFilter === 'sr_hhi_prov_composicion') {
    return (
      <div className="chart-card">
        <h3 className="chart-title">Composición de Proveedores</h3>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>RUT Proveedor</th>
                <th>Nombre / Razón Social</th>
                <th>Monto Total</th>
                <th>% Participación</th>
                <th>Categoría Principal</th>
                <th>N° Docs</th>
              </tr>
            </thead>
            <tbody>
              {proveedores.map((p, i) => (
                <tr key={p.rut_documento}>
                  <td><code style={{ fontSize: '0.8rem' }}>{p.rut_documento}</code></td>
                  <td>
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: getProvColor(i), marginRight: 8 }} />
                    {p.nombre_prov ?? '—'}
                  </td>
                  <td style={{ color: '#7c3aed' }}>{fmtAmt(p.monto_total)}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 80, height: 6, borderRadius: 3, background: 'var(--surface-overlay)', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(Number(p.pct_participacion), 100)}%`, height: '100%', background: getProvColor(i), borderRadius: 3 }} />
                      </div>
                      <strong style={{ color: getProvColor(i) }}>{Number(p.pct_participacion).toFixed(1)}%</strong>
                    </div>
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{p.categoria_principal ?? '—'}</td>
                  <td>{fmtN(p.n_documentos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (widgetFilter === 'sr_hhi_prov_detalle') {
    return (
      <div className="chart-card">
        <h3 className="chart-title">Detalle HHI Proveedores por Período</h3>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Año</th><th>HHI</th><th>Nivel</th><th>N° Proveedores</th>
                <th>RUT P. Principal</th><th>Nombre P. Principal</th><th>% P. Principal</th><th>Monto Total</th>
              </tr>
            </thead>
            <tbody>
              {[...hhi_serie].reverse().map(d => {
                const lbl = hhiLabel(Number(d.hhi))
                return (
                  <tr key={d.periodo}>
                    <td><strong>{d.periodo}</strong></td>
                    <td><strong style={{ color: lbl.color, fontSize: '1rem' }}>{fmtN(Math.round(Number(d.hhi)))}</strong></td>
                    <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: lbl.color, fontSize: '0.8rem', fontWeight: 600 }}>{lbl.icon} {lbl.label}</span></td>
                    <td>{Number(d.n_proveedores).toFixed(0)}</td>
                    <td><code style={{ fontSize: '0.8rem' }}>{d.prov_principal ?? '—'}</code></td>
                    <td>{d.nombre_prov_principal ?? '—'}</td>
                    <td>{d.pct_prov_principal != null ? `${Number(d.pct_prov_principal).toFixed(1)}%` : '—'}</td>
                    <td style={{ color: '#7c3aed' }}>{fmtAmt(d.monto_total)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Nota metodológica */}
      <div style={{ padding: '10px 16px', borderRadius: 10, fontSize: '0.82rem', marginBottom: '1rem', background: 'var(--surface-overlay)', border: '1px solid var(--line-subtle)' }}>
        ℹ️ <strong>Metodología HHI de Proveedores:</strong> HHI = Σ(pct_i²) en escala 0-10.000, donde pct_i es la participación porcentual del proveedor i en el gasto total.
        <span style={{ marginLeft: 12 }}>🟢 &lt;1.500 Concentración Baja</span>
        <span style={{ marginLeft: 10 }}>🟡 1.500-2.500 Moderada</span>
        <span style={{ marginLeft: 10 }}>🔴 &gt;2.500 Alta — alta dependencia de pocos proveedores</span>
      </div>

      {/* KPIs */}
      <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="kpi-card" style={{ '--accent': hLabel.color }}>
          <div className="kpi-icon" style={{ background: `${hLabel.color}20` }}>{hLabel.icon}</div>
          <div className="kpi-body">
            <div className="kpi-value" style={{ color: hLabel.color }}>{fmtN(Math.round(avg_hhi))}</div>
            <div className="kpi-label">HHI Promedio Histórico</div>
            <div className="kpi-sub">Escala 0–10.000 — menor es más diversificado</div>
          </div>
        </div>
        <div className="kpi-card" style={{ '--accent': ulLabel.color }}>
          <div className="kpi-icon" style={{ background: `${ulLabel.color}20` }}>{ulLabel.icon}</div>
          <div className="kpi-body">
            <div className="kpi-value" style={{ color: ulLabel.color }}>{ultimo ? fmtN(Math.round(Number(ultimo.hhi))) : '—'}</div>
            <div className="kpi-label">HHI Último Período ({ultimo?.periodo ?? '—'})</div>
            <div className="kpi-sub">{ulLabel.label}</div>
          </div>
        </div>
        <div className="kpi-card" style={{ '--accent': '#7c3aed' }}>
          <div className="kpi-icon" style={{ background: '#7c3aed20' }}>🏪</div>
          <div className="kpi-body">
            <div className="kpi-value" style={{ color: '#7c3aed' }}>{fmtN(ultimo?.n_proveedores ?? proveedores.length)}</div>
            <div className="kpi-label">Número de Proveedores</div>
            <div className="kpi-sub">RUT únicos de proveedores registrados</div>
          </div>
        </div>
        <div className="kpi-card" style={{ '--accent': '#10b981' }}>
          <div className="kpi-icon" style={{ background: '#10b98120' }}>🏆</div>
          <div className="kpi-body">
            <div className="kpi-value" style={{ color: '#10b981', fontSize: '0.9rem' }}>{ultimo?.prov_principal ?? '—'}</div>
            <div className="kpi-label">RUT Proveedor Principal ({ultimo?.periodo ?? '—'})</div>
            <div className="kpi-sub">
              {ultimo?.nombre_prov_principal ?? ''}
              {ultimo?.pct_prov_principal != null ? ` — ${Number(ultimo.pct_prov_principal).toFixed(1)}% del gasto` : ''}
            </div>
          </div>
        </div>
      </div>

      <WidgetWrapper widgetKey="sr_hhi_prov_graficos">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
          <div className="chart-card">
            <h3 className="chart-title">Distribución de Gasto por Proveedor</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '0.5rem' }}>Período {ultimo?.periodo ?? ''} — todos los documentos</p>
            <ReactECharts option={pieProvOpt} style={{ height: 320 }} />
          </div>
          <div className="chart-card">
            <h3 className="chart-title">Evolución del HHI por Año</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '0.5rem' }}>Concentración en proveedores — serie histórica</p>
            <ReactECharts option={lineHHIOpt} style={{ height: 320 }} />
          </div>
        </div>
      </WidgetWrapper>

      <WidgetWrapper widgetKey="sr_hhi_prov_composicion">
        <div className="chart-card">
          <h3 className="chart-title">Composición de Proveedores</h3>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>RUT Proveedor</th>
                  <th>Nombre / Razón Social</th>
                  <th>Monto Total</th>
                  <th>% Participación</th>
                  <th>Categoría Principal</th>
                  <th>N° Docs</th>
                </tr>
              </thead>
              <tbody>
                {proveedores.map((p, i) => (
                  <tr key={p.rut_documento}>
                    <td><code style={{ fontSize: '0.8rem' }}>{p.rut_documento}</code></td>
                    <td>
                      <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: getProvColor(i), marginRight: 8 }} />
                      {p.nombre_prov ?? '—'}
                    </td>
                    <td style={{ color: '#7c3aed' }}>{fmtAmt(p.monto_total)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 80, height: 6, borderRadius: 3, background: 'var(--surface-overlay)', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(Number(p.pct_participacion), 100)}%`, height: '100%', background: getProvColor(i), borderRadius: 3 }} />
                        </div>
                        <strong style={{ color: getProvColor(i) }}>
                          {Number(p.pct_participacion).toFixed(1)}%
                        </strong>
                      </div>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{p.categoria_principal ?? '—'}</td>
                    <td>{fmtN(p.n_documentos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </WidgetWrapper>

      <WidgetWrapper widgetKey="sr_hhi_prov_detalle">
        <div className="chart-card">
          <h3 className="chart-title">Detalle HHI Proveedores por Período</h3>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Año</th><th>HHI</th><th>Nivel</th><th>N° Proveedores</th>
                  <th>RUT P. Principal</th><th>Nombre P. Principal</th><th>% P. Principal</th><th>Monto Total</th>
                </tr>
              </thead>
              <tbody>
                {[...hhi_serie].reverse().map(d => {
                  const lbl = hhiLabel(Number(d.hhi))
                  return (
                    <tr key={d.periodo}>
                      <td><strong>{d.periodo}</strong></td>
                      <td><strong style={{ color: lbl.color, fontSize: '1rem' }}>{fmtN(Math.round(Number(d.hhi)))}</strong></td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: lbl.color, fontSize: '0.8rem', fontWeight: 600 }}>
                          {lbl.icon} {lbl.label}
                        </span>
                      </td>
                      <td>{Number(d.n_proveedores).toFixed(0)}</td>
                      <td><code style={{ fontSize: '0.8rem' }}>{d.prov_principal ?? '—'}</code></td>
                      <td>{d.nombre_prov_principal ?? '—'}</td>
                      <td>{d.pct_prov_principal != null ? `${Number(d.pct_prov_principal).toFixed(1)}%` : '—'}</td>
                      <td style={{ color: '#7c3aed' }}>{fmtAmt(d.monto_total)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </WidgetWrapper>
    </>
  )
}
