import { useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import api from '../../lib/api'
import { useChartColors } from '../../hooks/useChartColors'
import { useMoneyFmt, fmtN } from '../../components/DashboardWidgets'
import SqlViewer from '../../components/SqlViewer'
import { WidgetWrapper } from './FichaSostenedor'

const HHI_COLOR_MAP = {
  'Concentración Baja':     '#059669',
  'Concentración Moderada': '#d97706',
  'Concentración Alta':     '#dc2626',
}
const FUENTE_COLOR_SOST = {
  GENERAL: '#1e40af', SEP: '#1d4ed8', PIE: '#2563eb', ACG: '#3b82f6',
  MANTENIMIENTO: '#60a5fa', PRORETENCION: '#93c5fd', INTERNADO: '#bfdbfe', AC: '#0284c7',
}
const FUENTE_COLOR_DEF = ['#1e40af', '#3b82f6', '#60a5fa', '#93c5fd', '#1d4ed8', '#2563eb', '#bfdbfe']
function getFColor(alias, i) { return FUENTE_COLOR_SOST[alias] ?? FUENTE_COLOR_DEF[i % FUENTE_COLOR_DEF.length] }
function hhiLabel(hhi) {
  if (hhi < 1500) return { label: 'Concentración Baja',     color: '#059669', icon: '🟢' }
  if (hhi < 2500) return { label: 'Concentración Moderada', color: '#d97706', icon: '🟡' }
  return             { label: 'Concentración Alta',     color: '#dc2626', icon: '🔴' }
}

export function RenderHHISostenedor({ sostId, periodo, widgetFilter = null }) {
  const { fmtAmt } = useMoneyFmt()
  const C = useChartColors()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const sid = sostId ?? 69110400

  useEffect(() => {
    setLoading(true)
    const p = periodo ? `&periodo=${periodo}` : ''
    api.get(`/dashboard/hhi-fuentes-sostenedor?sost_id=${sid}${p}`)
      .then(r => setData(r.data))
      .finally(() => setLoading(false))
  }, [sid, periodo])

  if (loading) return <div className="loading-area"><div className="spinner" /></div>
  if (!data || data.hhi_serie.length === 0)
    return <div className="empty-state" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
      Sin datos HHI para este sostenedor.
    </div>

  const { hhi_serie, fuentes, avg_hhi, ultimo } = data
  const anios = hhi_serie.map(d => d.periodo)
  const hLabel = hhiLabel(avg_hhi)
  const ulLabel = ultimo ? hhiLabel(Number(ultimo.hhi)) : hLabel

  // ── Torta de fuentes (último período disponible)
  const pieFuentesOpt = {
    aria: { decal: { show: true } },
    tooltip: {
      trigger: 'item',
      formatter: p => `${p.name}<br/>${fmtAmt(p.value)}<br/><b>${p.percent}%</b> del ingreso total`,
      backgroundColor: 'var(--surface-raised)', borderColor: 'var(--line-subtle)',
      textStyle: { color: 'var(--text-primary)' },
    },
    legend: { orient: 'vertical', right: 10, top: 'center', textStyle: { color: C.axisLabel, fontSize: 11 } },
    series: [{
      type: 'pie', radius: ['40%', '70%'], center: ['38%', '50%'],
      data: fuentes.map((f, i) => ({ name: f.subvencion_alias, value: Number(f.monto_total), itemStyle: { color: getFColor(f.subvencion_alias, i) } })),
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
      lineStyle: { color: '#2563eb', width: 3 },
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#2563eb38' }, { offset: 1, color: 'transparent' }] } },
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

  // ── Barras apiladas: composición de fuentes por año
  const fuentesKeys = [...new Set(
    hhi_serie.flatMap(() => fuentes.map(f => f.subvencion_alias))
  )]
  const barFuenteOpt = {
    aria: { decal: { show: true } },
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' },
      backgroundColor: 'var(--surface-raised)', borderColor: 'var(--line-subtle)',
      textStyle: { color: 'var(--text-primary)' },
    },
    legend: { data: fuentes.map(f => f.subvencion_alias), textStyle: { color: C.axisLabel, fontSize: 10 }, top: 0, type: 'scroll' },
    grid: { left: 60, right: 20, top: 50, bottom: 40 },
    xAxis: { type: 'category', data: anios, axisLabel: { color: C.axisLabel }, axisLine: { lineStyle: { color: C.splitLine } } },
    yAxis: { type: 'value', axisLabel: { color: C.axisLabel, formatter: v => fmtAmt(v) }, splitLine: { lineStyle: { color: C.splitLine } } },
    series: fuentes.map((f, i) => ({
      name: f.subvencion_alias, type: 'bar', stack: 'fuentes', barMaxWidth: 60,
      data: anios.map(a => {
        // For multi-year view, use hhi_serie monto_total as proxy (data already aggregated by sost)
        // exact per-year per-fuente would require extra endpoint; use fuentes monto for current period
        return a === (ultimo?.periodo) ? Number(f.monto_total) : null
      }),
      itemStyle: { color: getFColor(f.subvencion_alias, i) },
    })),
    backgroundColor: 'transparent',
  }

  const sqlStr = `-- Serie temporal HHI del sostenedor
SELECT periodo, hhi, nivel_concentracion, orden_concentracion,
       n_fuentes, monto_total, fuente_principal, pct_fuente_principal
FROM mv_hhi_fuentes
WHERE sost_id = :sid AND periodo = :p
ORDER BY periodo;

-- Fuentes de ingreso del sostenedor (participación por fuente)
SELECT subvencion_alias,
       SUM(monto_declarado)  AS monto_total,
       ROUND(
           SUM(monto_declarado) * 100.0 /
           NULLIF(SUM(SUM(monto_declarado)) OVER (), 0)
       , 2) AS pct_participacion
FROM estado_resultado
WHERE sost_id = :sid
  AND periodo  = :p
  AND UPPER(TRIM(desc_tipo_cuenta)) LIKE '%INGRESO%'
  AND UPPER(TRIM(desc_estado))      = 'RENDIDO'
  AND cuenta_alias_padre LIKE '3%'
  AND subvencion_alias IS NOT NULL
  AND subvencion_alias <> ''
GROUP BY subvencion_alias
ORDER BY monto_total DESC;`

  // ── Early return para el tab Resumen ─────────────────────────────────────
  if (widgetFilter === 'sr_hhi_graficos') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
        <div className="chart-card">
          <h3 className="chart-title">Distribución de Fuentes de Ingreso</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '0.5rem' }}>Período {ultimo?.periodo ?? ''} — datos rendidos</p>
          <ReactECharts option={pieFuentesOpt} style={{ height: 320 }} />
        </div>
        <div className="chart-card">
          <h3 className="chart-title">Evolución del HHI por Año</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '0.5rem' }}>Concentración de financiamiento — serie histórica</p>
          <ReactECharts option={lineHHIOpt} style={{ height: 320 }} />
        </div>
      </div>
    )
  }
  if (widgetFilter === 'sr_hhi_fuentes') {
    return (
      <div className="chart-card">
        <h3 className="chart-title">Composición de Fuentes de Ingreso (Rendido)</h3>
        <div className="table-wrapper">
          <table className="data-table">
            <thead><tr><th>Fuente (Subvención)</th><th>Monto Total</th><th>% Participación</th></tr></thead>
            <tbody>
              {fuentes.map((f, i) => (
                <tr key={f.subvencion_alias}>
                  <td>
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: getFColor(f.subvencion_alias, i), marginRight: 8 }} />
                    {f.subvencion_alias}
                  </td>
                  <td style={{ color: '#1e40af' }}>{fmtAmt(f.monto_total)}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 80, height: 6, borderRadius: 3, background: 'var(--surface-overlay)', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(Number(f.pct_participacion), 100)}%`, height: '100%', background: getFColor(f.subvencion_alias, i), borderRadius: 3 }} />
                      </div>
                      <strong style={{ color: getFColor(f.subvencion_alias, i) }}>{Number(f.pct_participacion).toFixed(1)}%</strong>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }
  if (widgetFilter === 'sr_hhi_detalle') {
    return (
      <div className="chart-card">
        <h3 className="chart-title">Detalle HHI por Período</h3>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr><th>Año</th><th>HHI</th><th>Nivel</th><th>N° Fuentes</th><th>Fuente Principal</th><th>% F. Principal</th><th>Monto Total</th></tr>
            </thead>
            <tbody>
              {[...hhi_serie].reverse().map(d => {
                const lbl = hhiLabel(Number(d.hhi))
                return (
                  <tr key={d.periodo}>
                    <td><strong>{d.periodo}</strong></td>
                    <td><strong style={{ color: lbl.color, fontSize: '1rem' }}>{fmtN(Math.round(Number(d.hhi)))}</strong></td>
                    <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: lbl.color, fontSize: '0.8rem', fontWeight: 600 }}>{lbl.icon} {lbl.label}</span></td>
                    <td>{Number(d.n_fuentes).toFixed(0)}</td>
                    <td>{d.fuente_principal ?? '—'}</td>
                    <td>{d.pct_fuente_principal != null ? `${Number(d.pct_fuente_principal).toFixed(1)}%` : '—'}</td>
                    <td style={{ color: '#2563eb' }}>{fmtAmt(d.monto_total)}</td>
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
      <SqlViewer sql={sqlStr} />
      <div className="alert-info" style={{ padding: '10px 16px', borderRadius: 10, fontSize: '0.82rem', marginBottom: 12 }}>
        ℹ️ <strong>Metodología:</strong> HHI (Índice Herfindahl-Hirschman) = Sumatoria de los cuadrados de la participación porcentual de cada subvención. Un índice menor a 1.500 indica diversificación saludable.
      </div>

      {/* Nota metodológica */}
      <div style={{ padding: '10px 16px', borderRadius: 10, fontSize: '0.82rem', marginBottom: '1rem', background: 'var(--surface-overlay)', border: '1px solid var(--line-subtle)' }}>
        ℹ️ <strong>Metodología HHI:</strong> HHI = Σ(pct_i²) en escala 0-10.000.
        <span style={{ marginLeft: 12 }}>🟢 &lt;1.500 Concentración Baja</span>
        <span style={{ marginLeft: 10 }}>🟡 1.500-2.500 Moderada</span>
        <span style={{ marginLeft: 10 }}>🔴 &gt;2.500 Alta — alta vulnerabilidad financiera</span>
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
        <div className="kpi-card" style={{ '--accent': '#2563eb' }}>
          <div className="kpi-icon" style={{ background: '#2563eb20' }}>📊</div>
          <div className="kpi-body">
            <div className="kpi-value" style={{ color: '#2563eb' }}>{fmtN(ultimo?.n_fuentes ?? fuentes.length)}</div>
            <div className="kpi-label">Número de Fuentes</div>
            <div className="kpi-sub">Tipos de subvención como ingreso rendido</div>
          </div>
        </div>
        <div className="kpi-card" style={{ '--accent': '#10b981' }}>
          <div className="kpi-icon" style={{ background: '#10b98120' }}>🏆</div>
          <div className="kpi-body">
            <div className="kpi-value" style={{ color: '#10b981' }}>{ultimo?.fuente_principal ?? '—'}</div>
            <div className="kpi-label">Fuente Principal ({ultimo?.periodo ?? '—'})</div>
            <div className="kpi-sub">{ultimo?.pct_fuente_principal != null ? `${Number(ultimo.pct_fuente_principal).toFixed(1)}% del ingreso total` : '—'}</div>
          </div>
        </div>
      </div>

      <WidgetWrapper widgetKey="sr_hhi_graficos">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
          <div className="chart-card">
            <h3 className="chart-title">Distribución de Fuentes de Ingreso</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '0.5rem' }}>Período {ultimo?.periodo ?? ''} — datos rendidos</p>
            <ReactECharts option={pieFuentesOpt} style={{ height: 320 }} />
          </div>
          <div className="chart-card">
            <h3 className="chart-title">Evolución del HHI por Año</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '0.5rem' }}>Concentración de financiamiento — serie histórica</p>
            <ReactECharts option={lineHHIOpt} style={{ height: 320 }} />
          </div>
        </div>
      </WidgetWrapper>

      <WidgetWrapper widgetKey="sr_hhi_fuentes">
        <div className="chart-card">
          <h3 className="chart-title">Composición de Fuentes de Ingreso (Rendido)</h3>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fuente (Subvención)</th>
                  <th>Monto Total</th>
                  <th>% Participación</th>
                </tr>
              </thead>
              <tbody>
                {fuentes.map((f, i) => (
                  <tr key={f.subvencion_alias}>
                    <td>
                      <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: getFColor(f.subvencion_alias, i), marginRight: 8 }} />
                      {f.subvencion_alias}
                    </td>
                    <td style={{ color: '#1e40af' }}>{fmtAmt(f.monto_total)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 80, height: 6, borderRadius: 3, background: 'var(--surface-overlay)', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(Number(f.pct_participacion), 100)}%`, height: '100%', background: getFColor(f.subvencion_alias, i), borderRadius: 3 }} />
                        </div>
                        <strong style={{ color: getFColor(f.subvencion_alias, i) }}>
                          {Number(f.pct_participacion).toFixed(1)}%
                        </strong>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </WidgetWrapper>

      <WidgetWrapper widgetKey="sr_hhi_detalle">
        <div className="chart-card">
          <h3 className="chart-title">Detalle HHI por Período</h3>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Año</th><th>HHI</th><th>Nivel</th><th>N° Fuentes</th>
                  <th>Fuente Principal</th><th>% F. Principal</th><th>Monto Total</th>
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
                      <td>{Number(d.n_fuentes).toFixed(0)}</td>
                      <td>{d.fuente_principal ?? '—'}</td>
                      <td>{d.pct_fuente_principal != null ? `${Number(d.pct_fuente_principal).toFixed(1)}%` : '—'}</td>
                      <td style={{ color: '#6366f1' }}>{fmtAmt(d.monto_total)}</td>
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
