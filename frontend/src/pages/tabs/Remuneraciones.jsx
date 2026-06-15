import { useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import api from '../../lib/api'
import { fmtMM, fmtMonedaCorto, fmtN } from '../../lib/format'
import { useChartColors } from '../../hooks/useChartColors'

export default function Remuneraciones() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [anio, setAnio] = useState('')

  useEffect(() => {
    setLoading(true)
    const p = anio ? `?anio=${anio}` : ''
    api.get(`/dashboard/remuneraciones${p}`).then(r => setData(r.data)).finally(() => setLoading(false))
  }, [anio])

  if (loading) return <div className="loading-area"><div className="spinner" /></div>
  if (!data) return null

  const C = useChartColors()

  const optAnio = {
    tooltip: {
      trigger: 'axis',
      formatter: p => `${p[0].name}<br/>${p.map(s => `${s.marker}${s.seriesName}: ${fmtMM(s.value)}`).join('<br/>')}`,
      ...C.tooltip,
    },
    legend: { data: ['Promedio Líquido', 'Promedio Haber', 'Promedio Descuento'], textStyle: { color: C.legend.color } },
    grid: { left: 110, right: 20, top: 50, bottom: 30 },
    xAxis: { type: 'category', data: data.por_anio.map(d => d.anio), axisLabel: { color: C.axisLabel }, axisLine: { lineStyle: { color: C.axisLine } } },
    yAxis: { type: 'value', axisLabel: { color: C.axisLabel, formatter: v => fmtMonedaCorto(v) }, splitLine: { lineStyle: { color: C.splitLine } } },
    series: [
      { name: 'Promedio Líquido', type: 'bar', data: data.por_anio.map(d => d.promedio_liquido), itemStyle: { color: '#10b981' }, barGap: '5%', barMaxWidth: 40 },
      { name: 'Promedio Haber', type: 'bar', data: data.por_anio.map(d => d.promedio_haber), itemStyle: { color: '#6366f1' }, barMaxWidth: 40 },
      { name: 'Promedio Descuento', type: 'bar', data: data.por_anio.map(d => d.promedio_descuento), itemStyle: { color: '#ef4444' }, barMaxWidth: 40 },
    ],
    backgroundColor: 'transparent',
  }

  const optTipo = {
    tooltip: {
      trigger: 'item',
      formatter: p => `${p.name}<br/>Registros: ${fmtN(p.value)}`,
      ...C.tooltip,
    },
    legend: { textStyle: { color: C.legend.color }, orient: 'vertical', right: 10 },
    series: [{
      type: 'pie', radius: ['35%', '65%'], center: ['40%', '50%'],
      data: data.por_tipo.map(d => ({ name: d.tip || 'Sin tipo', value: d.n_registros })),
      label: { show: false }, itemStyle: { borderRadius: 6, borderColor: '#0f172a', borderWidth: 2 },
    }],
    backgroundColor: 'transparent',
  }

  return (
    <div className="tab-page">
      <div className="tab-header">
        <div>
          <h2 className="tab-title">Análisis de Remuneraciones <span className="admin-badge">Admin</span></h2>
          <p className="tab-subtitle">Promedios de liquidaciones por año — en miles de millones de pesos (mM$)</p>
        </div>
        <select className="filter-select" value={anio} onChange={e => setAnio(e.target.value)}>
          <option value="">Todos los años</option>
          {[2020,2021,2022,2023,2024].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <div className="charts-grid-2">
        <div className="chart-card" style={{ gridColumn: '1 / -1' }}>
          <h3 className="chart-title">Promedio Líquido / Haber / Descuento por Año (mM$)</h3>
          <ReactECharts option={optAnio} style={{ height: 320 }} />
        </div>
        <div className="chart-card">
          <h3 className="chart-title">Distribución por Tipo de Contrato</h3>
          <ReactECharts option={optTipo} style={{ height: 320 }} />
        </div>
        <div className="chart-card">
          <h3 className="chart-title">Resumen por Año</h3>
          <div className="table-wrapper">
            <table className="data-table">
              <thead><tr><th>Año</th><th>Funcionarios</th><th>Prom. Líquido</th><th>Total Líquido</th></tr></thead>
              <tbody>
                {data.por_anio.map(d => (
                  <tr key={d.anio}>
                    <td>{d.anio}</td>
                    <td>{fmtN(d.n_funcionarios)}</td>
                    <td>{fmtMM(d.promedio_liquido)}</td>
                    <td>{fmtMM(d.total_liquido)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
