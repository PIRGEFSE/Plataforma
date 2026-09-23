import { useState, useEffect } from 'react'
import ReactECharts from 'echarts-for-react'
import { useChartColors } from '../../hooks/useChartColors'
import { useMoneyFmt, KPICard, shortName } from '../../components/DashboardWidgets'

export function TabPresupuesto({ data, periodo, sostId }) {
  const [subTab, setSubTab] = useState(
    () => localStorage.getItem('pirgefse-fichasost-presupuesto') || 'por_rbd'
  )

  useEffect(() => {
    localStorage.setItem('pirgefse-fichasost-presupuesto', subTab)
  }, [subTab])

  useEffect(() => {
    const handler = (e) => { if (e.detail.key === 'pirgefse-fichasost-presupuesto') setSubTab(e.detail.val) }
    window.addEventListener('pirgefse-subtab', handler)
    return () => window.removeEventListener('pirgefse-subtab', handler)
  }, [])

  const { fmtAmt, fmtAxisAmt, unitLabel } = useMoneyFmt()
  const C = useChartColors()

  if (!data) return null

  const tabs = [
    { key: 'por_rbd', label: 'Por Establecimiento', icon: '🏫' },
    { key: 'por_componente', label: 'Por Componente', icon: '🧩' },
    { key: 'mensual', label: 'Evolución Mensual', icon: '📅' },
  ]

  const kpis = data.kpis || {}

  const renderContent = () => {
    if (subTab === 'por_rbd') {
      const opt = {
        aria: { decal: { show: true } },
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: v => fmtAmt(v) },
        legend: { bottom: 0 },
        color: ['#1e40af', '#3b82f6'],
        grid: { left: '3%', right: '4%', bottom: '10%', containLabel: true },
        xAxis: { type: 'value', axisLabel: { formatter: v => fmtAxisAmt(v) } },
        yAxis: { type: 'category', data: data.por_rbd.map(r => shortName(r.nombre_rbd, r.rbd)).reverse() },
        series: [
          { name: 'Proyectado (Subvenciones)', type: 'bar', data: data.por_rbd.map(r => r.proyectado).reverse(), itemStyle: { color: '#1e40af' } },
          { name: 'Ejecutado (Ingresos)', type: 'bar', data: data.por_rbd.map(r => r.ejecutado).reverse(), itemStyle: { color: '#3b82f6' } }
        ]
      }
      return (
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', color: 'var(--text-strong)' }}>Comparación por Establecimiento</h3>
          <ReactECharts option={opt} style={{ height: Math.max(400, data.por_rbd.length * 45) }} />

          <div className="table-responsive" style={{ marginTop: '2rem' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>RBD</th>
                  <th>Establecimiento</th>
                  <th style={{ textAlign: 'right' }}>Proyectado ({unitLabel})</th>
                  <th style={{ textAlign: 'right' }}>Ejecutado ({unitLabel})</th>
                  <th style={{ textAlign: 'right' }}>Brecha ({unitLabel})</th>
                  <th style={{ textAlign: 'center' }}>Cobertura</th>
                </tr>
              </thead>
              <tbody>
                {data.por_rbd.map(r => (
                  <tr key={r.rbd}>
                    <td>{r.rbd}</td>
                    <td>{shortName(r.nombre_rbd, r.rbd)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 500, color: '#2563eb' }}>{fmtAmt(r.proyectado)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 500, color: '#10b981' }}>{fmtAmt(r.ejecutado)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: r.brecha >= 0 ? '#10b981' : '#ef4444' }}>
                      {r.brecha > 0 ? '+' : ''}{fmtAmt(r.brecha)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${r.pct_cobertura >= 90 ? 'success' : r.pct_cobertura >= 70 ? 'warning' : 'danger'}`}>
                        {r.pct_cobertura != null ? `${r.pct_cobertura}%` : '-'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
    }

    if (subTab === 'por_componente') {
      const optProy = {
        aria: { decal: { show: true } },
        tooltip: { trigger: 'item', valueFormatter: v => fmtAmt(v) },
        legend: { type: 'scroll', orient: 'vertical', right: 10, top: 20, bottom: 20 },
        series: [{
          name: 'Componentes Proyectados',
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['40%', '50%'],
          itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
          data: data.por_componente.map(c => ({ name: c.componente, value: c.monto_proyectado }))
        }]
      }
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', color: 'var(--text-strong)' }}>Desglose Proyectado (Subvenciones)</h3>
            <ReactECharts option={optProy} style={{ height: 350 }} />
            <div className="table-responsive" style={{ marginTop: '1rem' }}>
              <table className="data-table">
                <thead><tr><th>Componente</th><th style={{ textAlign: 'right' }}>Monto ({unitLabel})</th></tr></thead>
                <tbody>
                  {data.por_componente.map((c, i) => (
                    <tr key={i}><td>{c.componente}</td><td style={{ textAlign: 'right' }}>{fmtAmt(c.monto_proyectado)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', color: 'var(--text-strong)' }}>Desglose Ejecutado (Cuentas Ingreso)</h3>
            <div className="table-responsive" style={{ marginTop: '1rem' }}>
              <table className="data-table">
                <thead><tr><th>Cuenta Padre</th><th style={{ textAlign: 'right' }}>Monto ({unitLabel})</th></tr></thead>
                <tbody>
                  {data.por_cuenta_er.map((c, i) => (
                    <tr key={i}><td>{c.cuenta_padre}</td><td style={{ textAlign: 'right' }}>{fmtAmt(c.monto_ejecutado)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )
    }

    if (subTab === 'mensual') {
      const optMensual = {
        aria: { decal: { show: true } },
        tooltip: { trigger: 'axis', valueFormatter: v => fmtAmt(v) },
        legend: { bottom: 0 },
        color: ['#1e40af', '#3b82f6', '#60a5fa'],
        grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
        xAxis: { type: 'category', data: data.mensual.map(r => `Mes ${r.mes}`) },
        yAxis: { type: 'value', axisLabel: { formatter: v => fmtAxisAmt(v) } },
        series: [
          { name: 'Total Proyectado', type: 'line', smooth: true, data: data.mensual.map(r => r.proyectado_mes), itemStyle: { color: '#1e40af' }, areaStyle: { opacity: 0.1 } },
          { name: 'Subv. Normal', type: 'line', smooth: true, data: data.mensual.map(r => r.sub_normal_mes), itemStyle: { color: '#3b82f6' } },
          { name: 'SEP (Prio + Pref)', type: 'line', smooth: true, data: data.mensual.map(r => r.sep_mes), itemStyle: { color: '#60a5fa' } }
        ]
      }
      return (
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', color: 'var(--text-strong)' }}>Evolución Mensual (Proyectado)</h3>
          <ReactECharts option={optMensual} style={{ height: 400 }} />
        </div>
      )
    }
    return null
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="kpi-grid">
        <KPICard icon="📐" label="Total Proyectado" value={fmtAmt(kpis.total_proyectado)} color="#2563eb" sub={`${kpis.n_rbds_proyectados} estab.`} />
        <KPICard icon="💵" label="Total Ejecutado" value={fmtAmt(kpis.total_ejecutado)} color="#10b981" sub={`${kpis.n_rbds_ejecutados} estab.`} />
        <KPICard icon="⚖️" label="Brecha Total" value={(kpis.brecha > 0 ? '+' : '') + fmtAmt(kpis.brecha)} color={kpis.brecha >= 0 ? '#10b981' : '#ef4444'} sub={kpis.pct_cobertura != null ? `Cobertura: ${kpis.pct_cobertura}%` : ''} />
        <KPICard icon="🎯" label="Cobertura" value={kpis.pct_cobertura != null ? `${kpis.pct_cobertura}%` : '-'} color={kpis.pct_cobertura >= 100 ? '#10b981' : '#f59e0b'} sub="Ejecutado / Proyectado" />
      </div>

      <div className="subtabs-container">
        <div className="subtabs-nav">
          {tabs.map(t => {
            const active = subTab === t.key
            return (
              <button key={t.key} className={`subtab-btn ${active ? 'active' : ''}`}
                onClick={() => setSubTab(t.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.2rem',
                  border: 'none', background: 'transparent', cursor: 'pointer',
                  borderBottom: active ? '2px solid var(--accent-text)' : '2px solid transparent',
                  color: active ? 'var(--accent-text)' : 'var(--text-muted)',
                  fontWeight: active ? 600 : 500, transition: 'all 0.2s', fontSize: '0.9rem'
                }}
              >
                <span>{t.icon}</span> {t.label}
              </button>
            )
          })}
        </div>
        <div className="subtab-content" style={{ padding: '1.5rem 0' }}>
          {renderContent()}
        </div>
      </div>
    </div>
  )
}
