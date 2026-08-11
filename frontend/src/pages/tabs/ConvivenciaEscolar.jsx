import { useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import api from '../../lib/api'
import { useChartColors } from '../../hooks/useChartColors'
import { useMoneyFmt } from './FichaSostenedor'
import { fmtN } from '../../lib/format'

const SUB_TABS = [
  { key: 'resumen',    label: 'Resumen',          icon: '🤝' },
  { key: 'ive',        label: 'vs. IVE',           icon: '🧩' },
  { key: 'sned_simce', label: 'vs. SNED / SIMCE',  icon: '🏆' },
  { key: 'financiero', label: 'vs. Financiero',     icon: '💵' },
]

function shortN(nom, rbd) {
  if (!nom) return `RBD ${rbd}`
  return nom.length > 30 ? nom.slice(0, 28) + '…' : nom
}

function KPI({ icon, label, value, color = '#6366f1', sub }) {
  return (
    <div className="kpi-card" style={{ '--accent': color, transform: 'none', transition: 'none' }}>
      <div className="kpi-icon" style={{ background: `${color}20` }}>{icon}</div>
      <div className="kpi-body">
        <div className="kpi-value" style={{ color }}>{value}</div>
        <div className="kpi-label">{label}</div>
        {sub && <div className="kpi-sub">{sub}</div>}
      </div>
    </div>
  )
}

// ── Sub-tab Resumen ──────────────────────────────────────────────────────────
function TabResumen({ data }) {
  const C = useChartColors()
  if (!data) return null
  const { kpis, serie_anual = [], por_mecanismo = [], por_tema = [] } = data

  const serieOpt = {
    tooltip: { trigger: 'axis', ...C.tooltip },
    legend: { data: ['Total Casos', 'Mediación', 'Denuncias'], textStyle: { color: C.axisLabel }, top: 0 },
    color: ['#6366f1', '#10b981', '#ef4444'],
    grid: { left: 50, right: 20, top: 40, bottom: 30 },
    xAxis: { type: 'category', data: serie_anual.map(d => d.agno), axisLabel: { color: C.axisLabel } },
    yAxis: { type: 'value', axisLabel: { color: C.axisLabel }, splitLine: { lineStyle: { color: C.splitLine } } },
    series: [
      { name: 'Total Casos',  type: 'line', smooth: true, data: serie_anual.map(d => d.total_casos),     lineStyle: { width: 2.5 }, symbolSize: 6 },
      { name: 'Mediación',    type: 'bar',  data: serie_anual.map(d => d.casos_mediacion), barMaxWidth: 24, itemStyle: { color: '#10b981', borderRadius: [3,3,0,0] } },
      { name: 'Denuncias',    type: 'bar',  data: serie_anual.map(d => d.casos_denuncia),  barMaxWidth: 24, itemStyle: { color: '#ef4444', borderRadius: [3,3,0,0] } },
    ],
    backgroundColor: 'transparent',
  }

  const mecOpt = {
    tooltip: { trigger: 'item', ...C.tooltip, formatter: p => `${p.name}: <b>${p.value}</b> (${p.percent}%)` },
    color: ['#6366f1','#10b981','#f59e0b','#3b82f6','#ec4899'],
    series: [{
      type: 'pie', radius: ['42%', '68%'], center: ['50%', '55%'],
      label: { color: C.axisLabel, fontSize: 11 },
      data: por_mecanismo.map(d => ({ name: d.mecanismo, value: d.casos })),
    }],
    backgroundColor: 'transparent',
  }

  const temaOpt = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, ...C.tooltip },
    color: ['#6366f1'],
    grid: { left: 180, right: 40, top: 10, bottom: 10 },
    xAxis: { type: 'value', axisLabel: { color: C.axisLabel }, splitLine: { lineStyle: { color: C.splitLine } } },
    yAxis: { type: 'category', data: [...por_tema].reverse().map(d => d.tema), axisLabel: { color: C.axisLabel, fontSize: 10, width: 170, overflow: 'truncate' } },
    series: [{ type: 'bar', data: [...por_tema].reverse().map(d => d.casos), barMaxWidth: 18, itemStyle: { color: '#6366f1', borderRadius: [0,4,4,0] } }],
    backgroundColor: 'transparent',
  }

  return (
    <>
      <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
        <KPI icon="📂" label="Total Casos" value={fmtN(kpis.total_casos)} color="#6366f1" />
        <KPI icon="✅" label="% Cerrados" value={`${kpis.pct_cerrados}%`} color="#10b981" />
        <KPI icon="🤝" label="% Mediados" value={`${kpis.pct_mediados}%`} color="#3b82f6" />
        <KPI icon="🏫" label="Establec. con Casos" value={fmtN(kpis.n_establecimientos)} color="#f59e0b" />
        <KPI icon="🧩" label="IVE Promedio" value={kpis.ive_promedio != null ? kpis.ive_promedio.toFixed(2) : '—'} color="#8b5cf6" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div className="chart-card">
          <h3 className="chart-title">Serie Histórica — Casos por Año</h3>
          <ReactECharts option={serieOpt} style={{ height: 280 }} />
        </div>
        <div className="chart-card">
          <h3 className="chart-title">Distribución por Mecanismo ({data.periodo_usado})</h3>
          <ReactECharts option={mecOpt} style={{ height: 280 }} />
        </div>
      </div>

      {por_tema.length > 0 && (
        <div className="chart-card">
          <h3 className="chart-title">Top Temas de Ingreso ({data.periodo_usado})</h3>
          <ReactECharts option={temaOpt} style={{ height: Math.max(200, por_tema.length * 30 + 20) }} />
        </div>
      )}
    </>
  )
}

// ── Sub-tab vs IVE ────────────────────────────────────────────────────────────
function TabVsIVE({ data }) {
  const C = useChartColors()
  if (!data) return null
  const rows = (data.por_establecimiento || []).filter(r => r.ive_sinae != null)

  const scatterOpt = {
    tooltip: {
      trigger: 'item', ...C.tooltip,
      formatter: p => {
        const d = rows[p.dataIndex]
        return `<b>${shortN(d.nom_rbd, d.rbd)}</b><br/>IVE: <b>${d.ive_sinae?.toFixed(2)}</b><br/>Casos: <b>${d.total_casos}</b>`
      },
    },
    color: ['#6366f1'],
    grid: { left: 60, right: 30, top: 30, bottom: 40 },
    xAxis: { name: 'IVE SINAE', nameLocation: 'middle', nameGap: 28, type: 'value', axisLabel: { color: C.axisLabel }, splitLine: { lineStyle: { color: C.splitLine } } },
    yAxis: { name: 'N° Casos', nameLocation: 'middle', nameGap: 40, type: 'value', axisLabel: { color: C.axisLabel }, splitLine: { lineStyle: { color: C.splitLine } } },
    series: [{
      type: 'scatter', symbolSize: 10,
      data: rows.map(d => [d.ive_sinae, d.total_casos]),
      itemStyle: { color: '#6366f1', opacity: 0.75 },
    }],
    backgroundColor: 'transparent',
  }

  return (
    <>
      <div className="chart-card" style={{ marginBottom: '1rem' }}>
        <h3 className="chart-title">IVE vs. Casos de Convivencia por Establecimiento ({data.periodo_usado})</h3>
        {rows.length === 0
          ? <p style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>Sin datos IVE para este año</p>
          : <ReactECharts option={scatterOpt} style={{ height: 340 }} />}
      </div>
      {rows.length > 0 && (
        <div className="chart-card" style={{ padding: 0 }}>
          <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--line-subtle)' }}>
            <h3 className="chart-title" style={{ margin: 0 }}>Tabla IVE por Establecimiento</h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: 'var(--surface-overlay)' }}>
                  {['RBD', 'Establecimiento', 'Casos', 'IVE SINAE'].map(h => (
                    <th key={h} style={{ padding: '0.55rem 0.9rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: h === 'RBD' ? 'left' : 'right', borderBottom: '1px solid var(--line-subtle)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...rows].sort((a,b) => (b.total_casos||0)-(a.total_casos||0)).map((r, i) => (
                  <tr key={r.rbd} style={{ borderBottom: '1px solid var(--line-subtle)', background: i%2===0?'transparent':'var(--surface-overlay)' }}>
                    <td style={{ padding: '0.45rem 0.9rem', fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{r.rbd}</td>
                    <td style={{ padding: '0.45rem 0.9rem' }}>{r.nom_rbd || `RBD ${r.rbd}`}</td>
                    <td style={{ padding: '0.45rem 0.9rem', textAlign: 'right', fontWeight: 600, color: '#6366f1' }}>{fmtN(r.total_casos)}</td>
                    <td style={{ padding: '0.45rem 0.9rem', textAlign: 'right', color: '#8b5cf6' }}>{r.ive_sinae?.toFixed(2) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}

// ── Sub-tab vs SNED / SIMCE ──────────────────────────────────────────────────
function TabVsSNEDSIMCE({ data }) {
  const C = useChartColors()
  if (!data) return null
  const allRows = data.por_establecimiento || []
  const snedRows = allRows.filter(r => r.ind_sned != null)
  const simceRows = allRows.filter(r => r.prom_lect != null || r.prom_mate != null)

  const snedOpt = {
    tooltip: { trigger: 'item', ...C.tooltip,
      formatter: p => { const d = snedRows[p.dataIndex]; return `<b>${shortN(d.nom_rbd, d.rbd)}</b><br/>SNED: <b>${d.ind_sned?.toFixed(2)}</b><br/>Casos: <b>${d.total_casos}</b>` }
    },
    grid: { left: 60, right: 30, top: 30, bottom: 40 },
    xAxis: { name: 'Índice SNED', nameLocation: 'middle', nameGap: 28, type: 'value', axisLabel: { color: C.axisLabel }, splitLine: { lineStyle: { color: C.splitLine } } },
    yAxis: { name: 'N° Casos', nameLocation: 'middle', nameGap: 40, type: 'value', axisLabel: { color: C.axisLabel }, splitLine: { lineStyle: { color: C.splitLine } } },
    series: [{ type: 'scatter', symbolSize: 10, data: snedRows.map(d => [d.ind_sned, d.total_casos]), itemStyle: { color: '#1e40af', opacity: 0.75 } }],
    backgroundColor: 'transparent',
  }

  const simceOpt = {
    tooltip: { trigger: 'item', ...C.tooltip,
      formatter: p => { const d = simceRows[p.dataIndex]; return `<b>${shortN(d.nom_rbd, d.rbd)}</b><br/>Lect: ${d.prom_lect ?? '—'} / Mat: ${d.prom_mate ?? '—'}<br/>Casos: <b>${d.total_casos}</b>` }
    },
    legend: { data: ['Lectura', 'Matemática'], textStyle: { color: C.axisLabel }, top: 0 },
    color: ['#3b82f6', '#10b981'],
    grid: { left: 60, right: 30, top: 40, bottom: 40 },
    xAxis: { name: 'Puntaje SIMCE', nameLocation: 'middle', nameGap: 28, type: 'value', axisLabel: { color: C.axisLabel }, splitLine: { lineStyle: { color: C.splitLine } } },
    yAxis: { name: 'N° Casos', nameLocation: 'middle', nameGap: 40, type: 'value', axisLabel: { color: C.axisLabel }, splitLine: { lineStyle: { color: C.splitLine } } },
    series: [
      { name: 'Lectura',     type: 'scatter', symbolSize: 9, data: simceRows.filter(d=>d.prom_lect!=null).map(d=>[d.prom_lect, d.total_casos]), itemStyle: { color: '#3b82f6', opacity: 0.75 } },
      { name: 'Matemática',  type: 'scatter', symbolSize: 9, data: simceRows.filter(d=>d.prom_mate!=null).map(d=>[d.prom_mate, d.total_casos]), itemStyle: { color: '#10b981', opacity: 0.75 } },
    ],
    backgroundColor: 'transparent',
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
      <div className="chart-card">
        <h3 className="chart-title">SNED vs. Casos ({data.periodo_usado})</h3>
        {snedRows.length === 0
          ? <p style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>Sin datos SNED para este año</p>
          : <ReactECharts option={snedOpt} style={{ height: 320 }} />}
      </div>
      <div className="chart-card">
        <h3 className="chart-title">SIMCE vs. Casos ({data.periodo_usado})</h3>
        {simceRows.length === 0
          ? <p style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>Sin datos SIMCE para este año</p>
          : <ReactECharts option={simceOpt} style={{ height: 320 }} />}
      </div>
    </div>
  )
}

// ── Sub-tab vs Financiero ────────────────────────────────────────────────────
function TabVsFinanciero({ data }) {
  const C = useChartColors()
  const { fmtAmt } = useMoneyFmt()
  if (!data) return null
  const rows = (data.por_establecimiento || []).filter(r => r.ingreso != null || r.gasto != null)

  const ingOpt = {
    tooltip: { trigger: 'item', ...C.tooltip,
      formatter: p => { const d = rows[p.dataIndex]; return `<b>${shortN(d.nom_rbd, d.rbd)}</b><br/>Ingreso: <b>${fmtAmt(d.ingreso)}</b><br/>Casos: <b>${d.total_casos}</b>` }
    },
    color: ['#1e40af'],
    grid: { left: 70, right: 30, top: 20, bottom: 40 },
    xAxis: { name: 'Ingresos', nameLocation: 'middle', nameGap: 28, type: 'value', axisLabel: { color: C.axisLabel, formatter: v => fmtAmt(v) }, splitLine: { lineStyle: { color: C.splitLine } } },
    yAxis: { name: 'N° Casos', nameLocation: 'middle', nameGap: 40, type: 'value', axisLabel: { color: C.axisLabel }, splitLine: { lineStyle: { color: C.splitLine } } },
    series: [{ type: 'scatter', symbolSize: 10, data: rows.filter(r=>r.ingreso!=null).map(d=>[d.ingreso, d.total_casos]), itemStyle: { color: '#1e40af', opacity: 0.75 } }],
    backgroundColor: 'transparent',
  }

  const gasOpt = {
    tooltip: { trigger: 'item', ...C.tooltip,
      formatter: p => { const d = rows[p.dataIndex]; return `<b>${shortN(d.nom_rbd, d.rbd)}</b><br/>Gasto: <b>${fmtAmt(d.gasto)}</b><br/>Casos: <b>${d.total_casos}</b>` }
    },
    color: ['#3b82f6'],
    grid: { left: 70, right: 30, top: 20, bottom: 40 },
    xAxis: { name: 'Gastos', nameLocation: 'middle', nameGap: 28, type: 'value', axisLabel: { color: C.axisLabel, formatter: v => fmtAmt(v) }, splitLine: { lineStyle: { color: C.splitLine } } },
    yAxis: { name: 'N° Casos', nameLocation: 'middle', nameGap: 40, type: 'value', axisLabel: { color: C.axisLabel }, splitLine: { lineStyle: { color: C.splitLine } } },
    series: [{ type: 'scatter', symbolSize: 10, data: rows.filter(r=>r.gasto!=null).map(d=>[d.gasto, d.total_casos]), itemStyle: { color: '#3b82f6', opacity: 0.75 } }],
    backgroundColor: 'transparent',
  }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div className="chart-card">
          <h3 className="chart-title">Ingresos vs. Casos ({data.periodo_usado})</h3>
          {rows.length === 0
            ? <p style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>Sin datos financieros</p>
            : <ReactECharts option={ingOpt} style={{ height: 300 }} />}
        </div>
        <div className="chart-card">
          <h3 className="chart-title">Gastos vs. Casos ({data.periodo_usado})</h3>
          {rows.length === 0
            ? <p style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>Sin datos financieros</p>
            : <ReactECharts option={gasOpt} style={{ height: 300 }} />}
        </div>
      </div>

      {rows.length > 0 && (
        <div className="chart-card" style={{ padding: 0 }}>
          <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--line-subtle)' }}>
            <h3 className="chart-title" style={{ margin: 0 }}>Tabla Financiera por Establecimiento</h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: 'var(--surface-overlay)' }}>
                  {['RBD', 'Establecimiento', 'Casos', 'Ingresos', 'Gastos', 'Superávit'].map(h => (
                    <th key={h} style={{ padding: '0.55rem 0.9rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: h==='RBD'||h==='Establecimiento'?'left':'right', borderBottom: '1px solid var(--line-subtle)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...rows].sort((a,b)=>(b.total_casos||0)-(a.total_casos||0)).map((r, i) => {
                  const superavit = (r.ingreso||0) - (r.gasto||0)
                  return (
                    <tr key={r.rbd} style={{ borderBottom: '1px solid var(--line-subtle)', background: i%2===0?'transparent':'var(--surface-overlay)' }}>
                      <td style={{ padding: '0.45rem 0.9rem', fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{r.rbd}</td>
                      <td style={{ padding: '0.45rem 0.9rem', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nom_rbd || `RBD ${r.rbd}`}</td>
                      <td style={{ padding: '0.45rem 0.9rem', textAlign: 'right', fontWeight: 600, color: '#6366f1' }}>{fmtN(r.total_casos)}</td>
                      <td style={{ padding: '0.45rem 0.9rem', textAlign: 'right', color: '#1e40af' }}>{r.ingreso != null ? fmtAmt(r.ingreso) : '—'}</td>
                      <td style={{ padding: '0.45rem 0.9rem', textAlign: 'right', color: '#3b82f6' }}>{r.gasto != null ? fmtAmt(r.gasto) : '—'}</td>
                      <td style={{ padding: '0.45rem 0.9rem', textAlign: 'right' }}>
                        {r.ingreso != null && r.gasto != null
                          ? <strong style={{ color: superavit >= 0 ? '#10b981' : '#ef4444' }}>{fmtAmt(superavit)}</strong>
                          : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function ConvivenciaEscolar({ sostId, periodo }) {
  const [subTab, setSubTab] = useState('resumen')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get(`/dashboard/ficha-sostenedor/convivencia?sost_id=${sostId}&periodo=${periodo}`)
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [sostId, periodo])

  if (loading) return <div className="loading-area"><div className="spinner" /></div>
  if (!data) return <p style={{ color: 'var(--text-muted)', padding: '2rem' }}>No se pudieron cargar los datos de Convivencia Escolar.</p>
  if (!data.kpis?.total_casos) return (
    <div className="chart-card" style={{ textAlign: 'center', padding: '3rem' }}>
      <p style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🤝</p>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Sin datos de Convivencia Escolar para este sostenedor en {data.periodo_usado ?? periodo}.</p>
    </div>
  )

  return (
    <div>
      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {SUB_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            style={{
              padding: '0.45rem 1rem',
              borderRadius: '0.5rem',
              border: subTab === t.key ? '1.5px solid #6366f1' : '1.5px solid var(--line-subtle)',
              background: subTab === t.key ? '#6366f120' : 'var(--surface-overlay)',
              color: subTab === t.key ? '#6366f1' : 'var(--text-muted)',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              transition: 'all 0.15s',
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.78rem', alignSelf: 'center' }}>
          Datos período: <strong>{data.periodo_usado}</strong>
        </span>
      </div>

      {subTab === 'resumen'    && <TabResumen data={data} />}
      {subTab === 'ive'        && <TabVsIVE data={data} />}
      {subTab === 'sned_simce' && <TabVsSNEDSIMCE data={data} />}
      {subTab === 'financiero' && <TabVsFinanciero data={data} />}
    </div>
  )
}
